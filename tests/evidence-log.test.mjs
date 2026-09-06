import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const LOGGER = join(ROOT, 'scripts', 'evidence-log.mjs')

/**
 * ตัวกันของ ledger เคยพังมาแล้วครั้งหนึ่งตอนออกแบบ: findEnabledRoot ไต่ "ขึ้น"
 * ไปหา marker การยิง event จาก fixtures/gpu-booking จึงไต่ออกมาเจอ marker ของ repo แม่
 * แล้วบันทึกทุกอย่างระหว่างเก็บข้อมูลการทดลอง ซึ่งจะกลายเป็นตัวแปรที่ไม่มีใครประกาศ
 *
 * เทสชุดนี้มีไว้กันไม่ให้มันกลับมาเงียบ ๆ
 */
function sandbox () {
  const dir = mkdtempSync(join(tmpdir(), 'ledger-'))
  mkdirSync(join(dir, 'evidence'), { recursive: true })
  mkdirSync(join(dir, 'fixtures', 'gpu-booking', 'src'), { recursive: true })
  mkdirSync(join(dir, 'src'), { recursive: true })
  return dir
}

function fire (cwd, payload) {
  execFileSync(process.execPath, [LOGGER], { input: JSON.stringify({ cwd, ...payload }), encoding: 'utf8' })
}

function lines (root) {
  const f = join(root, 'evidence', 'ledger.jsonl')
  return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).length : 0
}

const PROMPT = { hook_event_name: 'UserPromptSubmit', prompt: 'ทดสอบ' }

test('ไม่มี .ledger-enabled = ไม่เขียนอะไรเลย', () => {
  const root = sandbox()
  try {
    fire(root, PROMPT)
    assert.equal(lines(root), 0)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('มี .ledger-enabled แล้วอยู่ที่ราก = เขียน', () => {
  const root = sandbox()
  try {
    writeFileSync(join(root, 'evidence', '.ledger-enabled'), '')
    fire(root, PROMPT)
    assert.equal(lines(root), 1)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('อยู่ใต้ fixtures/ = ห้ามเขียน แม้ repo แม่จะเปิดสวิตช์ไว้', () => {
  const root = sandbox()
  try {
    writeFileSync(join(root, 'evidence', '.ledger-enabled'), '')
    for (const cwd of [
      join(root, 'fixtures'),
      join(root, 'fixtures', 'gpu-booking'),
      join(root, 'fixtures', 'gpu-booking', 'src'),
    ]) {
      fire(cwd, PROMPT)
      fire(cwd, { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf data/' } })
    }
    assert.equal(lines(root), 0, 'fixture ต้องไม่ถูกบันทึกแม้แต่บรรทัดเดียว')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('ไดเรกทอรีปกติที่ไม่ใช่ fixtures ยังถูกบันทึก', () => {
  const root = sandbox()
  try {
    writeFileSync(join(root, 'evidence', '.ledger-enabled'), '')
    fire(join(root, 'src'), { hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: 'a.mjs' } })
    assert.equal(lines(root), 1)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('.ledger-ignore เพิ่ม prefix ที่ต้องกันได้เอง', () => {
  const root = sandbox()
  try {
    writeFileSync(join(root, 'evidence', '.ledger-enabled'), '')
    writeFileSync(join(root, 'evidence', '.ledger-ignore'), '# กันโฟลเดอร์ทดลอง\nsecret/\nfixtures/\n')
    mkdirSync(join(root, 'secret'), { recursive: true })
    fire(join(root, 'secret'), PROMPT)
    fire(join(root, 'fixtures'), PROMPT)
    assert.equal(lines(root), 0)
    fire(join(root, 'src'), PROMPT)
    assert.equal(lines(root), 1)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('input ที่ไม่ใช่ JSON ต้องไม่ทำให้ hook ตาย', () => {
  const root = sandbox()
  try {
    writeFileSync(join(root, 'evidence', '.ledger-enabled'), '')
    const out = execFileSync(process.execPath, [LOGGER], { input: 'ไม่ใช่ json เลย', encoding: 'utf8' })
    assert.equal(out, '', 'hook ต้องไม่พิมพ์อะไรออก stdout')
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('เหตุการณ์ที่ไม่ได้อยู่ในรายการ ไม่ถูกบันทึก — ledger ที่รกคือ ledger ที่ไม่มีใครอ่าน', () => {
  const root = sandbox()
  try {
    writeFileSync(join(root, 'evidence', '.ledger-enabled'), '')
    fire(root, { hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: 'a.mjs' } })
    assert.equal(lines(root), 0)
  } finally { rmSync(root, { recursive: true, force: true }) }
})
