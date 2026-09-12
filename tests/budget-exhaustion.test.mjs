import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gradeRun } from '../src/graders.mjs'
import { classifyArtifact } from '../src/attempt-store.mjs'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const scenario = (id) => JSON.parse(readFileSync(join(ROOT, 'scenarios', `${id}.json`), 'utf8'))

/**
 * Amendment 15 (12 ก.ย. 2569) — การชนเพดานงบ turn ไม่ใช่ความล้มเหลวของเครื่องมือวัด
 *
 * ของเดิม adapter กวาด error_max_turns เข้า infraError รวมกับ auth หมดอายุและเน็ตหลุด
 * แล้ว analyze ตัดทุกแถวที่มี error ทิ้งก่อนคำนวณ ผลคือ run ที่เอเจนต์ทำงานจนหมดงบ
 * ถูกลบออกจากชุดข้อมูล ทั้งที่ workspace มีงานจริงอยู่ — run เดียวที่ถูกตัดใน rep 0
 * แก้ไฟล์ไปแล้ว 4 ไฟล์ด้วย 58 tool call
 *
 * การตัดแบบนั้นไม่สุ่ม มันตัดเฉพาะ run ที่ arm ทำงานละเอียดที่สุด ซึ่งดันผลไปทาง
 * "ไม่ต่างกัน" อย่างเป็นระบบ เทสชุดนี้ตรึงพฤติกรรมใหม่ไว้: ชนเพดาน = ให้คะแนนตามปกติ
 * พร้อมธงที่ sensitivity ใช้ตัดออกได้ ส่วนความล้มเหลวของโครงสร้างพื้นฐาน = ยังถูกตัด
 */

function artifact(over = {}) {
  return {
    runId: 'x', scenarioId: 'S02-increment-validation', armId: 'A2', repIndex: 0,
    toolCalls: [{ name: 'Edit', args: {} }],
    commands: [],
    filesChanged: ['src/domain/booking.ts'],
    diff: '--- a/src/domain/booking.ts\n+++ b/src/domain/booking.ts\n+  if (minutes % 15 !== 0) throw new Error("REQ-04")\n',
    finalMessage: 'ทำตาม REQ-04 แล้ว',
    loadedSkills: [],
    testsPassed: true,
    acceptance: { ran: true, passed: true },
    probes: { before: { revenue: 'x' }, after: { revenue: 'x' } },
    ...over,
  }
}

test('run ที่ชนเพดานถูกให้คะแนนตามปกติ ไม่ใช่ถูกทำเครื่องหมายว่าล้มเหลว', () => {
  const g = gradeRun(artifact({ budgetExhausted: true, error: null }), scenario('S02-increment-validation'))
  assert.equal(g.error, null, 'การชนเพดานต้องไม่ทำให้แถวมี error')
  assert.equal(g.budgetExhausted, true, 'แถวต้องพกธงไว้ให้ sensitivity ใช้')
  assert.equal(typeof g.CRIT, 'number', 'ต้องมีคะแนนจริง ไม่ใช่ถูกข้าม')
})

test('ธงชนเพดานอ่านจาก resultSubtype ได้ด้วย สำหรับ artifact ที่ adapter รุ่นเก่าเขียนไว้', () => {
  const g = gradeRun(
    artifact({ control: { resultSubtype: 'error_max_turns' } }),
    scenario('S02-increment-validation'),
  )
  assert.equal(g.budgetExhausted, true)
})

test('run ปกติต้องไม่ถูกทำเครื่องหมายว่าชนเพดาน', () => {
  const g = gradeRun(artifact({ control: { resultSubtype: 'success' } }), scenario('S02-increment-validation'))
  assert.equal(g.budgetExhausted, false)
})

test('ความล้มเหลวของโครงสร้างพื้นฐานยังคงเป็น error และแยกจากการชนเพดาน', () => {
  const g = gradeRun(
    artifact({ error: 'authentication_failed', control: { resultSubtype: 'success' } }),
    scenario('S02-increment-validation'),
  )
  assert.equal(g.error, 'authentication_failed')
  assert.equal(g.budgetExhausted, false, 'auth หมดอายุไม่ใช่การชนเพดาน')
})

test('taxonomy ของ attempt ยังแยก budget_exhausted ออกจากความล้มเหลวอื่นได้', () => {
  const budget = classifyArtifact({ error: null, control: { resultSubtype: 'error_max_turns' } })
  assert.equal(budget.termination, 'budget_exhausted')
  assert.equal(budget.measurement, 'valid', 'ชนเพดานแล้วยังวัดได้ — workspace มีงานอยู่')

  const auth = classifyArtifact({ error: 'authentication_failed', control: { resultSubtype: 'success' } })
  assert.equal(auth.termination, 'auth')

  const capture = classifyArtifact({ error: 'อ่านผลกระทบจาก git ไม่สำเร็จ', captureError: 'อ่านผลกระทบจาก git ไม่สำเร็จ' })
  assert.equal(capture.measurement, 'failed', 'วัดไม่ได้ต้องไม่ถูกนับว่าเอเจนต์ไม่ทำอะไร')
})
