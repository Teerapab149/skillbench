#!/usr/bin/env node
/**
 * ตัวเขียน ledger — ถูกเรียกโดย hook ของ Claude Code ไม่ใช่โดยคน
 *
 * กฎเหล็กสามข้อของสคริปต์นี้:
 *   1. ห้าม exit ด้วยค่าที่ไม่ใช่ 0 เด็ดขาด — hook ที่พังต้องไม่ทำให้งานของผู้ใช้พัง
 *   2. ห้ามพิมพ์อะไรออก stdout — บาง hook เอา stdout ไปต่อท้าย context
 *   3. เขียนเฉพาะ repo ที่ opt-in ด้วยไฟล์ evidence/.ledger-enabled
 *
 * ข้อ 3 คือตัวกันไม่ให้ ledger ทำงานข้างใน fixture ระหว่างเก็บข้อมูลการทดลอง
 * ซึ่งจะกลายเป็นตัวแปรที่ไม่มีใครประกาศ
 *
 * ติดตั้ง: ดู evidence/INSTALL.md
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'

const MAX_FIELD = 2000  // ตัดข้อความยาว — ledger ต้องอ่านได้ ไม่ใช่เก็บทุกไบต์ (ตัวเต็มอยู่ใน transcript)

function truncate (s) {
  if (typeof s !== 'string') return s
  return s.length > MAX_FIELD ? s.slice(0, MAX_FIELD) + `\n…[ตัด ${s.length - MAX_FIELD} ตัวอักษร]` : s
}

/** ไต่ขึ้นไปหา repo ที่ opt-in — คืน null ถ้าไม่มี แปลว่าไม่ต้องบันทึก */
function findEnabledRoot (start) {
  let dir = start
  for (let i = 0; i < 40; i++) {
    if (existsSync(join(dir, 'evidence', '.ledger-enabled'))) return dir
    const up = dirname(dir)
    if (up === dir) return null
    dir = up
  }
  return null
}

/**
 * ตัวกันชั้นที่สอง — ไดเรกทอรีที่ห้ามบันทึกแม้จะอยู่ใต้ repo ที่เปิดสวิตช์แล้ว
 *
 * จำเป็นเพราะ findEnabledRoot ไต่ "ขึ้น" ไปหา marker การทำงานใน fixtures/gpu-booking
 * จึงไต่ออกมาเจอ marker ของ repo แม่แล้วบันทึก ซึ่งเป็นสิ่งที่ต้องไม่เกิดขึ้นเด็ดขาด
 * ระหว่างเก็บข้อมูลการทดลอง (เจอตอนทดสอบ ไม่ใช่ตอนออกแบบ)
 *
 * ค่าตั้งต้นกัน fixtures/ ไว้ เพิ่มเองได้ที่ evidence/.ledger-ignore บรรทัดละหนึ่ง prefix
 */
function isIgnored (root, cwd) {
  const rel = cwd.slice(root.length).replace(/\\/g, '/').replace(/^\/+/, '')
  if (!rel) return false
  let patterns = ['fixtures/']
  try {
    const extra = readFileSync(join(root, 'evidence', '.ledger-ignore'), 'utf8')
      .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    if (extra.length) patterns = extra
  } catch { /* ไม่มีไฟล์ = ใช้ค่าตั้งต้น */ }
  return patterns.some((p) => rel === p.replace(/\/$/, '') || rel.startsWith(p.endsWith('/') ? p : p + '/'))
}

function gitFacts (cwd) {
  const q = (args) => {
    try { return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
    catch { return null }
  }
  return { branch: q(['rev-parse', '--abbrev-ref', 'HEAD']), head: q(['rev-parse', '--short', 'HEAD']) }
}

function readStdin () {
  try { return readFileSync(0, 'utf8') } catch { return '' }
}

try {
  const raw = readStdin()
  let ev = {}
  try { ev = JSON.parse(raw) } catch { ev = { _unparsed: truncate(raw) } }

  const cwd = ev.cwd || process.cwd()
  const root = findEnabledRoot(cwd)
  if (!root) process.exit(0)          // repo นี้ไม่ได้เปิดสวิตช์
  if (isIgnored(root, cwd)) process.exit(0)   // ← ตัวกันของ fixture ระหว่างเก็บข้อมูล

  const event = ev.hook_event_name || ev.hookEventName || 'unknown'
  const tool = ev.tool_name || ev.toolName || null
  const input = ev.tool_input || ev.toolInput || {}
  const resp = ev.tool_response || ev.toolResponse || {}

  // เก็บเฉพาะฟิลด์ที่ตอบคำถาม "เกิดอะไรขึ้น" ไม่ใช่ dump ทั้งก้อน
  let data = null
  if (event === 'UserPromptSubmit') {
    data = { prompt: truncate(ev.prompt ?? ev.user_prompt ?? '') }
  } else if (tool === 'Bash' || tool === 'PowerShell') {
    data = {
      command: truncate(input.command ?? ''),
      description: input.description ?? null,
      background: input.run_in_background ?? false,
      // exit code อยู่คนละที่กันแล้วแต่เวอร์ชัน จึงลองหลายทาง แล้วยอมรับว่าอาจไม่มี
      exitCode: resp.exit_code ?? resp.exitCode ?? resp.code ?? null,
      output: truncate(typeof resp.stdout === 'string' ? resp.stdout : (typeof resp === 'string' ? resp : '')),
    }
  } else if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') {
    data = { file: input.file_path ?? input.notebook_path ?? null, tool }
  } else if (event === 'SessionStart' || event === 'SessionEnd') {
    data = { source: ev.source ?? null }
  } else {
    process.exit(0)  // เหตุการณ์อื่นไม่บันทึก — ledger ที่รกคือ ledger ที่ไม่มีใครอ่าน
  }

  const row = {
    ts: new Date().toISOString(),
    event,
    tool,
    sessionId: ev.session_id ?? ev.sessionId ?? null,
    transcript: ev.transcript_path ?? ev.transcriptPath ?? null,
    cwd,
    git: gitFacts(root),
    data,
  }

  const dir = join(root, 'evidence')
  mkdirSync(dir, { recursive: true })
  appendFileSync(join(dir, 'ledger.jsonl'), JSON.stringify(row) + '\n', 'utf8')
} catch {
  // เงียบโดยตั้งใจ — hook ที่ส่งเสียงจะไปปนกับงานของผู้ใช้
}
process.exit(0)
