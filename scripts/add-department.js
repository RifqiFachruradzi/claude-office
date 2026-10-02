#!/usr/bin/env node
// =============================================================================
// add-department.js — Scaffold a new office department/agent role (CLI wizard)
//
// Usage:
//   node scripts/add-department.js
//
// Same functionality is also exposed via POST /department for the web UI —
// see scripts/department-lib.js for the shared implementation.
// =============================================================================

import readline from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { SPRITES, slugify, addDepartment } from './department-lib.js'

async function prompt() {
  const rl = readline.createInterface({ input, output })
  const ask = async (q, def) => {
    const a = (await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim()
    return a || def || ''
  }

  console.log('\n=== Tambah Departemen / Agent Baru ===\n')

  const name = await ask('Nama departemen (contoh: Marketing)')
  const id = slugify(await ask('ID role (huruf kecil, tanpa spasi)', slugify(name)))
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
  return { name, id, emoji, color, description, keywords, sprite, tools }
}

async function main() {
  const cfg = await prompt()
  const result = addDepartment(cfg)

  console.log(`\n✅ Departemen "${result.name}" (role: ${result.id}) berhasil ditambahkan.\n`)
  console.log(`   Subagent: ${result.agentFile}`)
  console.log(`   Warna/emoji/judul terdaftar di src/types.ts`)
  console.log(`   Sprite terdaftar di src/config.ts`)
  console.log(`   Hook role_map/name_map terdaftar di hooks/agent-tracker.sh`)
  console.log(`   Keyword chat terdaftar di scripts/chat-ai-watcher.sh: ${result.keywords.join(', ')}`)
  console.log(`\nRestart office, lalu coba:`)
  console.log(`   - Ketik salah satu kata kunci di atas di chat office, atau`)
  console.log(`   - Prompt Claude Code: "Gunakan subagent ${result.id} untuk ..."`)
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`)
  process.exit(1)
})
