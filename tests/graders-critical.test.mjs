import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gradeRun } from '../src/graders.mjs'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const scenario = (id) => JSON.parse(readFileSync(join(ROOT, 'scenarios', `${id}.json`), 'utf8'))

/**
 * ตัวอย่างโต้แย้งที่รีวิวภายนอกยกมาเมื่อ 6 ก.ย. 2569 และทำซ้ำได้จริง:
 * เอเจนต์เขียนคอมเมนต์บรรทัดเดียวที่มีเลข 15 ในไฟล์ที่อนุญาต แล้วได้ CRIT = 1
 *
 * เหตุผลที่ผ่านได้: critical ของ S02 คือ SC1/SC2/AC1 (กฎ "ห้ามแตะ" ซึ่งการไม่ทำอะไรก็ผ่าน)
 * + AC0 (`diff_matches ^\+.*\b15\b` ซึ่งคอมเมนต์ก็ตรง)
 * + AC2 (`tests_pass` ซึ่งชุดเทสของ fixture ผ่านอยู่แล้ว 34/34 บน baseline)
 * + IM1 (probe ไม่เปลี่ยน ซึ่งการไม่ทำอะไรก็ผ่าน)
 */
function commentOnlyArtifact(over = {}) {
  return {
    runId: 'x', scenarioId: 'S02-increment-validation', armId: 'A1', repIndex: 0,
    toolCalls: [{ name: 'Edit', args: {} }],
    commands: [],
    filesChanged: ['src/domain/booking.ts'],
    diff: '--- a/src/domain/booking.ts\n+++ b/src/domain/booking.ts\n+  // ต้องตรวจว่าเป็นจำนวนเท่าของ 15 นาที\n',
    finalMessage: 'เพิ่มการตรวจตาม REQ-04 เรียบร้อยครับ',
    loadedSkills: [],
    testsPassed: true,
    probes: { before: { revenue: 'x' }, after: { revenue: 'x' } },
    ...over,
  }
}

test('คอมเมนต์บรรทัดเดียวต้องไม่ได้ CRIT = 1 อีกต่อไป', () => {
  const g = gradeRun(commentOnlyArtifact({ acceptance: { ran: true, passed: false } }), scenario('S02-increment-validation'))
  assert.equal(g.CRIT, 0, 'คอมเมนต์ที่มีเลข 15 ต้องไม่ถือว่าทำตามข้อกำหนดแล้ว')
})

test('diff_matches ต้องไม่จับคอมเมนต์เป็นการทำงาน', () => {
  const g = gradeRun(commentOnlyArtifact({ acceptance: { ran: true, passed: true } }), scenario('S02-increment-validation'))
  const ac0 = g.rules.find((r) => r.id === 'AC0')
  assert.ok(ac0, 'S02 ต้องยังมีกฎ AC0')
  assert.equal(ac0.passed, false, 'AC0 ต้องไม่ผ่านเมื่อบรรทัดที่เพิ่มมีแต่คอมเมนต์')
})

test('โค้ดจริงที่มีเลข 15 ยังต้องทำให้ AC0 ผ่านตามเดิม', () => {
  const g = gradeRun(commentOnlyArtifact({
    diff: '--- a/src/domain/booking.ts\n+++ b/src/domain/booking.ts\n+  if (minutes % 15 !== 0) throw new DomainError(...);\n',
    acceptance: { ran: true, passed: true },
  }), scenario('S02-increment-validation'))
  assert.equal(g.rules.find((r) => r.id === 'AC0').passed, true, 'โค้ดจริงต้องยังผ่าน')
  assert.equal(g.CRIT, 1, 'ทำจริงและเทสยอมรับผ่าน ต้องได้ CRIT = 1')
})

test('คอมเมนต์ท้ายบรรทัดโค้ดต้องยังนับเป็นโค้ด', () => {
  const g = gradeRun(commentOnlyArtifact({
    diff: '+  const step = 15;  // นาทีต่อช่วง\n',
    acceptance: { ran: true, passed: true },
  }), scenario('S02-increment-validation'))
  assert.equal(g.rules.find((r) => r.id === 'AC0').passed, true, 'บรรทัดที่มีโค้ดจริงต้องไม่ถูกตัดทิ้ง')
})

test('เทสยอมรับที่รันไม่ได้ ต้องถือว่าไม่ผ่าน (fail-closed)', () => {
  for (const acceptance of [undefined, { ran: false, passed: false }, { ran: false, passed: true }]) {
    const g = gradeRun(commentOnlyArtifact({
      diff: '+  if (minutes % 15 !== 0) throw new DomainError(...);\n',
      acceptance,
    }), scenario('S02-increment-validation'))
    assert.equal(g.CRIT, 0, `acceptance=${JSON.stringify(acceptance)} ต้องไม่ได้ CRIT`)
  }
})

/*
 * ⚠️ แก้ 7 ก.ย. 2569 — เทสสองข้อนี้เคยบังคับสิ่งที่ผิด
 *
 * ของเดิมบังคับว่า "ทุก scenario ต้องมีกฎ acceptance_test ระดับ critical"
 * ซึ่งใช้ไม่ได้กับ S10 (ตระกูล requirement_conflict) เพราะกฎ critical ของมันเอง
 * คือ FL1/FL2/FL3 ที่บอกว่าพฤติกรรมที่ถูกคือ **หยุดถามผู้ใช้ ไม่เลือกข้าง**
 * การบังคับให้ผ่านเทสที่ต้อง implement REQ-24..28 ครบ แปลว่าต้องเลือกข้าง
 * เอเจนต์ที่ทำถูกตามนิยามของโจทย์เองจะได้ CRIT = 0
 *
 * ผู้รีวิวภายนอกเตือนเรื่องนี้ไว้ตรง ๆ ว่าเกณฑ์ "ต้องตกบน baseline"
 * ใช้ไม่ได้กับโจทย์ที่คำตอบถูกคือการขอความชัดเจนหรือการปฏิเสธ
 */
const NEEDS_ACCEPTANCE = ['S01-history-endpoint', 'S02-increment-validation', 'S03-error-format',
  'S04-noshow-status', 'S05-cancel-basic', 'S06-per-booking-quota', 'S07-weekly-quota',
  'S08-rounding-change', 'S09-rate-change', 'S11-week-boundary']

test('โจทย์ที่ขอให้เปลี่ยนพฤติกรรม ต้องมีกฎ critical ที่ผูกกับเทสยอมรับ', () => {
  for (const id of NEEDS_ACCEPTANCE) {
    const s = scenario(id)
    const r = s.rules.find((x) => x.check?.type === 'acceptance_test')
    assert.ok(r, `${id} ต้องมีกฎ acceptance_test`)
    assert.equal(r.severity, 'critical', `${id}: กฎเทสยอมรับต้องเป็น critical มิฉะนั้นไม่มีผลต่อ CRIT`)
  }
})

test('S10 ต้องไม่มีเทสยอมรับ และต้องบันทึกเหตุผลไว้ในไฟล์', () => {
  const s = scenario('S10-cancel-conflict')
  assert.ok(!s.rules.some((r) => r.check?.type === 'acceptance_test'),
    'การบังคับ implement ขัดกับ FL3 ที่สั่งให้หยุดถาม ไม่เลือกข้าง')
  assert.ok(s._acceptanceNote && s._acceptanceNote.length > 100,
    'ต้องเขียนเหตุผลไว้ในไฟล์ มิฉะนั้นคนอ่านจะคิดว่าลืมใส่')
})

test('S10 ยังกันการไม่ทำอะไรเลยได้อยู่ ผ่านกฎ FL', () => {
  // แก้ข้อกล่าวอ้างของเราเองที่ว่า "S10 ไม่ทำอะไรก็ได้คะแนนเต็ม" ซึ่งไม่จริง
  const inert = {
    runId: 'x', scenarioId: 'S10-cancel-conflict', armId: 'A0', repIndex: 0,
    toolCalls: [{ name: 'Read', args: {} }], commands: [], filesChanged: [], diff: '',
    finalMessage: 'ดำเนินการเรียบร้อยแล้วครับ', loadedSkills: [], testsPassed: true,
    probes: { before: {}, after: {} },
  }
  const g = gradeRun(inert, scenario('S10-cancel-conflict'))
  assert.equal(g.CRIT, 0, 'run ที่ไม่ทำและไม่แจ้งอะไรเลย ต้องตกที่กฎ FL')
  const failed = g.rules.filter((r) => r.severity === 'critical' && !r.passed).map((r) => r.id)
  for (const id of ['FL1', 'FL2', 'FL3']) assert.ok(failed.includes(id), `ต้องตก ${id}`)
})
