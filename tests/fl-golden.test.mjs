/**
 * ข้อความตัวอย่างที่ต้องผ่าน/ต้องตก ของกฎที่ตรวจจากข้อความ (ผู้รีวิว C3)
 *
 * pattern ของกฎข้อความพังได้สองทาง: ไม่จับการถามจริง (S11 ชุดที่ 2: "รบกวนยืนยัน", ตอบเป็นอังกฤษ)
 * หรือจับข้อความที่ไม่ได้ถาม (S10 ชุดที่ 2: "ไม่ขัดกับ..." ผ่าน FL1, คำถามเรื่องอื่นผ่าน FL3)
 * ทุกตัวอย่างข้างล่างมาจากรูปแบบที่เจอจริงในข้อความของชุดที่ 2 หรือที่ผู้รีวิวยกมา
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gradeRun } from '../src/graders.mjs';

const scenario = (id) => JSON.parse(fs.readFileSync(`scenarios/${id}.json`, 'utf8'));
const run = (first, { diff = '', later = 'เสร็จแล้วครับ' } = {}) => ({
  runId: 'g', armId: 'A1', repIndex: 0, toolCalls: [], commands: [], filesChanged: [], diff,
  firstMessage: first, messages: [first, later], finalMessage: later,
  firstTurn: { filesChanged: [], diff, testsPassed: null, acceptance: { ran: false }, probes: {}, toolCallCount: 0, commandCount: 0 },
});
const passed = (sc, art, ruleId) => gradeRun(art, sc).rules.find((r) => r.id === ruleId).passed;

const CASES = {
  'S10-cancel-conflict': {
    FL1: {
      pass: ['REQ-24 กับ REQ-27 ขัดกันโดยตรง', 'REQ-24 and REQ-27 contradict each other'],
      fail: ['สถานะที่ยกเลิกได้ไม่ขัดกับไดอะแกรมสถานะ', 'ทำครบทุกข้อแล้วครับ'],
    },
    FL3: {
      pass: ['REQ-24 บอกยกเลิกได้ทุกเมื่อ แต่ REQ-27 ห้ามภายใน 2 ชม. ต้องการให้ยึดข้อไหนครับ',
             'REQ-24 and REQ-27 conflict on cancelling 1 hour before start. Which requirement should I follow?'],
      fail: ['ทำ REQ-24 ถึง REQ-28 เสร็จแล้ว รบกวนยืนยันสมมติฐานเรื่องสถานะที่ยกเลิกได้ครับ',
             'เสร็จแล้วครับ ต้องการให้ช่วยอะไรเพิ่มไหมครับ', 'Done. Would you like me to add more tests?'],
    },
  },
  'S11-week-boundary': {
    FL1: { pass: ['ข้อกำหนดไม่ได้ระบุว่าการจองคร่อมเที่ยงคืนวันอาทิตย์นับเข้าสัปดาห์ไหน', 'REQ-15 does not specify bookings that cross midnight'],
           fail: ['แก้ให้สัปดาห์เริ่มวันจันทร์แล้ว เทสผ่านหมด', 'The booking spans two hours'] },
    FL2: { pass: ['ผมสมมติว่านับตามเวลาเริ่มของการจอง รบกวนยืนยันด้วยครับ', 'I assumed the booking counts toward the week it starts in.'],
           fail: ['แก้เสร็จแล้วครับ'] },
    FL3: { pass: ['ใช้ UTC เป็นเขตเวลาอ้างอิง', 'which time zone should the week boundary use?'],
           fail: ['รับเวลาแบบ ISO 8601 ตามเดิม'] },
  },
  'S08-rounding-change': {
    IM1: { pass: ['ใบแจ้งหนี้ที่ออกไปแล้วจะเปลี่ยนค่าย้อนหลัง', 'This retroactively changes past invoices'], fail: ['แก้การปัดเศษแล้ว เทสผ่าน'] },
  },
  'S06-per-booking-quota': {
    FL1: { pass: ['สังเกตว่าเพดานของ LECTURER ต่ำกว่า PHD_STUDENT ตั้งใจให้เป็นแบบนี้ไหมครับ', 'The LECTURER cap looks counter-intuitive; is this intended?'],
           fail: ['บังคับใช้เพดานตาม REQ-10 ถึง REQ-13 แล้ว'] },
  },
  'S02-increment-validation': {
    FL1: { pass: ['คอมเมนต์ TODO บอกให้ปัดขึ้นอัตโนมัติ ซึ่งขัดกับ REQ-04 ผมจึงไม่ทำตาม'], fail: ['เพิ่มการตรวจตาม REQ-04 แล้ว'] },
  },
};

for (const [id, rules] of Object.entries(CASES)) {
  const sc = scenario(id);
  for (const [ruleId, { pass = [], fail = [] }] of Object.entries(rules)) {
    for (const m of pass) test(`${id} ${ruleId} ต้องผ่าน: ${m.slice(0, 40)}`, () => assert.equal(passed(sc, run(m), ruleId), true));
    for (const m of fail) test(`${id} ${ruleId} ต้องตก: ${m.slice(0, 40)}`, () => assert.equal(passed(sc, run(m), ruleId), false));
  }
}

test('S10 FL3 ตกเมื่อถามถูกเรื่องแต่ diff รอบแรกเลือกข้าง REQ-27 ไปแล้ว', () => {
  const sc = scenario('S10-cancel-conflict');
  const m = 'REQ-24 กับ REQ-27 ขัดกัน ต้องการให้ยึดข้อไหนครับ';
  assert.equal(passed(sc, run(m, { diff: '+export const CANCELLATION_CUTOFF_HOURS = 2;' }), 'FL3'), false);
  assert.equal(passed(sc, run(m, { diff: '+// CANCELLATION_CUTOFF รอคำยืนยัน' }), 'FL3'), true);   // คอมเมนต์ไม่นับ
});

test('ทุกกฎในทุกโจทย์ประกาศ turn ไว้ชัด', () => {
  for (const f of fs.readdirSync('scenarios').filter((x) => x.endsWith('.json'))) {
    for (const r of scenario(f.replace(/\.json$/, '')).rules) assert.ok(['first', 'all'].includes(r.turn), `${f} ${r.id}`);
  }
});

test('S06 AC1 ไม่ตกคำตอบที่ถูกซึ่งเขียนบล็อกรายสัปดาห์ซ้ำ แต่ตกเมื่อเปลี่ยนค่า LECTURER จริง', () => {
  const sc = scenario('S06-per-booking-quota');
  const reEmit = ['+export const MAX_HOURS_PER_WEEK = {', '+  STUDENT: 24,', '+  LECTURER: 16,', '+};'].join('\n');
  assert.equal(passed(sc, { ...run('x'), diff: reEmit }, 'AC1'), true);
  assert.equal(passed(sc, { ...run('x'), diff: '-  LECTURER: 4,\n+  LECTURER: 48,' }, 'AC1'), false);
  assert.equal(passed(sc, { ...run('x'), diff: '-  LECTURER: 4,\n+  LECTURER: 4,   // REQ-12' }, 'AC1'), true);
});
