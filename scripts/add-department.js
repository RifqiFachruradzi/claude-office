#!/usr/bin/env node
// =============================================================================
// add-department.js — Scaffold a new office department/agent role
//
// Writes the subagent definition and wires it into every place the office
// needs to recognise the role: hooks/agent-tracker.sh, src/types.ts,
// src/config.ts, and scripts/chat-ai-watcher.sh's keyword routing.
//
// Usage:
//   node scripts/add-department.js
// =============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const SPRITES = ['dev-1', 'dev-2', 'employee-1', 'employee-2', 'employee-3', 'Frontend-dev-1', 'explore-1', 'security-audit-1']

function slugify(s) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '')
}

function insertBefore(content, anchor, insertion, label) {
  if (!content.includes(anchor)) {
    throw new Error(`Anchor tidak ditemukan untuk: ${label}. File mungkin sudah berubah format — tambahkan manual.`)
  }
  return content.replace(anchor, insertion + anchor)
}

async function prompt() {
  const rl = readline.createInterface({ input, output })
  const ask = async (q, def) => {
    const a = (await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim()
    return a || def || ''
  }

  console.log('\n=== Tambah Departemen / Agent Baru ===\n')

  const name = await ask('Nama departemen (contoh: Marketing)')
  if (!name) {
    rl.close()
    throw new Error('Nama wajib diisi.')
  }
  const id = slugify(await ask('ID role (huruf kecil, tanpa spasi)', slugify(name)))

  const agentFile = join(ROOT, '.claude', 'agents', `${id}.md`)
  if (existsSync(agentFile)) {
    rl.close()
    throw new Error(`Role "${id}" sudah ada (${agentFile}).`)
  }

  const emoji = await ask('Emoji', '🧩')
  const color = await ask('Warna hex', '#607d8b')
  const description = await ask('Deskripsi tugas untuk subagent (kapan dia dipanggil)')
  const keywordsRaw = await ask('Kata kunci pemicu di chat (pisah koma)', id)
  const keywords = keywordsRaw.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)

  console.log(`\nPilihan sprite karakter: ${SPRITES.join(', ')}`)
  let sprite = await ask('Sprite karakter', 'employee-3')
  if (!SPRITES.includes(sprite)) {
    console.log(`"${sprite}" tidak dikenal, pakai "employee-3" sebagai gantinya.`)
    sprite = 'employee-3'
  }

  const tools = await ask('Tools yang diizinkan (pisah koma)', 'Read, Grep, Glob, Bash')

  rl.close()
  return { id, name, emoji, color, description, keywords, sprite, tools }
}

function writeAgentFile({ id, description, tools }) {
  const dir = join(ROOT, '.claude', 'agents')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${id}.md`)
  writeFileSync(
    file,
    `---
name: ${id}
description: ${description}
tools: ${tools}
---

Anda adalah spesialis ${id}. Kerjakan tugas yang diminta dengan teliti, dan
tunjukkan langkah serta temuan Anda secara eksplisit — jangan hanya memberi
kesimpulan tanpa bukti.
`
  )
  return file
}

function patchAgentTracker({ id, name }) {
  const file = join(ROOT, 'hooks', 'agent-tracker.sh')
  let content = readFileSync(file, 'utf8')
  content = insertBefore(
    content,
    `        }\n        role = role_map.get(subagent_type, 'general-purpose')`,
    `            '${id}': '${id}',\n`,
    'role_map (hooks/agent-tracker.sh)'
  )
  content = insertBefore(
    content,
    `        }\n        name = name_map.get(role, 'Agent')`,
    `            '${id}': '${name}',\n`,
    'name_map (hooks/agent-tracker.sh)'
  )
  writeFileSync(file, content)
}

function patchTypesTs({ id, color, emoji, name }) {
  const file = join(ROOT, 'src', 'types.ts')
  let content = readFileSync(file, 'utf8')
  content = insertBefore(
    content,
    `  // MCPs`,
    `  '${id}': { color: '${color}', emoji: '${emoji}', title: '${name}' },\n`,
    'AGENT_CONFIGS (src/types.ts)'
  )
  writeFileSync(file, content)
}

function patchConfigTs({ id, sprite }) {
  const file = join(ROOT, 'src', 'config.ts')
  let content = readFileSync(file, 'utf8')
  content = insertBefore(content, `  // MCPs`, `  '${id}': '${sprite}',\n`, 'ROLE_TO_CHAR (src/config.ts)')
  writeFileSync(file, content)
}

function patchChatWatcher({ id, name, keywords }) {
  const file = join(ROOT, 'scripts', 'chat-ai-watcher.sh')
  if (!existsSync(file)) return // optional — some setups may not have this file
  let content = readFileSync(file, 'utf8')
  const pyList = keywords.map((k) => `'${k.replace(/'/g, "\\'")}'`).join(',')
  content = insertBefore(
    content,
    `]\nfor keywords, role, name in routes:`,
    `    ([${pyList}], '${id}', '${name}'),\n`,
    'routes (scripts/chat-ai-watcher.sh)'
  )
  writeFileSync(file, content)
}

async function main() {
  const cfg = await prompt()

  const agentFile = writeAgentFile(cfg)
  patchAgentTracker(cfg)
  patchTypesTs(cfg)
  patchConfigTs(cfg)
  patchChatWatcher(cfg)

  console.log(`\n✅ Departemen "${cfg.name}" (role: ${cfg.id}) berhasil ditambahkan.\n`)
  console.log(`   Subagent: ${agentFile}`)
  console.log(`   Warna/emoji/judul terdaftar di src/types.ts`)
  console.log(`   Sprite terdaftar di src/config.ts`)
  console.log(`   Hook role_map/name_map terdaftar di hooks/agent-tracker.sh`)
  console.log(`   Keyword chat terdaftar di scripts/chat-ai-watcher.sh: ${cfg.keywords.join(', ')}`)
  console.log(`\nRestart office, lalu coba:`)
  console.log(`   - Ketik salah satu kata kunci di atas di chat office, atau`)
  console.log(`   - Prompt Claude Code: "Gunakan subagent ${cfg.id} untuk ..."`)
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`)
  process.exit(1)
})
