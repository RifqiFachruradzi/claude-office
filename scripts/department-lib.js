// =============================================================================
// department-lib.js — shared logic for scaffolding a new office department
//
// Used by both scripts/add-department.js (CLI wizard) and server/index.js
// (POST /department, called from the office web UI) so the two stay in sync.
// =============================================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export const SPRITES = ['dev-1', 'dev-2', 'employee-1', 'employee-2', 'employee-3', 'Frontend-dev-1', 'explore-1', 'security-audit-1']

export function slugify(s) {
  return String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '')
}

function insertBefore(content, anchor, insertion, label) {
  if (!content.includes(anchor)) {
    throw new Error(`Anchor tidak ditemukan untuk: ${label}. File mungkin sudah berubah format — tambahkan manual.`)
  }
  return content.replace(anchor, insertion + anchor)
}

function escapeSingleQuotes(s) {
  return String(s).replace(/'/g, "\\'")
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
    `            '${id}': '${escapeSingleQuotes(name)}',\n`,
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
    `  '${id}': { color: '${color}', emoji: '${emoji}', title: '${escapeSingleQuotes(name)}' },\n`,
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
  if (!existsSync(file)) return
  let content = readFileSync(file, 'utf8')
  const pyList = keywords.map((k) => `'${escapeSingleQuotes(k)}'`).join(',')
  content = insertBefore(
    content,
    `]\nfor keywords, role, name in routes:`,
    `    ([${pyList}], '${id}', '${escapeSingleQuotes(name)}'),\n`,
    'routes (scripts/chat-ai-watcher.sh)'
  )
  writeFileSync(file, content)
}

/**
 * Validate + normalise raw input (as it would come from the CLI wizard or
 * a web form) into the config shape the patch* functions expect.
 */
export function normaliseDepartmentInput(raw) {
  const name = String(raw.name ?? '').trim()
  if (!name) throw new Error('Nama departemen wajib diisi.')

  const id = slugify(raw.id || name)
  if (!id) throw new Error('ID role tidak valid setelah dinormalisasi.')

  const agentFile = join(ROOT, '.claude', 'agents', `${id}.md`)
  if (existsSync(agentFile)) {
    throw new Error(`Role "${id}" sudah ada.`)
  }

  const emoji = String(raw.emoji ?? '🧩').trim() || '🧩'
  const color = String(raw.color ?? '#607d8b').trim() || '#607d8b'
  const description = String(raw.description ?? `Menangani tugas terkait ${name}`).trim()
  const keywords = (Array.isArray(raw.keywords) ? raw.keywords : String(raw.keywords ?? id).split(','))
    .map((k) => String(k).trim().toLowerCase())
    .filter(Boolean)
  const sprite = SPRITES.includes(raw.sprite) ? raw.sprite : 'employee-3'
  const tools = String(raw.tools ?? 'Read, Grep, Glob, Bash').trim() || 'Read, Grep, Glob, Bash'

  return { id, name, emoji, color, description, keywords, sprite, tools }
}

/**
 * Scaffold a new department end-to-end. Throws on invalid input or if the
 * role already exists — caller decides how to report that (console vs HTTP).
 */
export function addDepartment(rawCfg) {
  const cfg = normaliseDepartmentInput(rawCfg)
  const agentFile = writeAgentFile(cfg)
  patchAgentTracker(cfg)
  patchTypesTs(cfg)
  patchConfigTs(cfg)
  patchChatWatcher(cfg)
  return { ...cfg, agentFile }
}
