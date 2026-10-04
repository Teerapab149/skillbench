/**
 * รอบตอบกลับ (Study 3) — argument ของรอบสอง, การรวม usage และข้อความที่กฎแต่ละข้อเห็น
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followUpArgs, resultUsage, turnInfraError } from '../src/adapters/claude-cli.mjs';
import { gradeRun, textViewFor } from '../src/graders.mjs';

const BASE = ['-p', 'โจทย์', '--output-format', 'stream-json', '--model', 'm', '--max-turns', '80', '--tools', 'Read'];

test('รอบตอบกลับใช้ flag เดิมทุกตัว ต่างแค่ข้อความและ --resume', () => {
  const out = followUpArgs(BASE, { text: 'ทำต่อ' }, 'sess-1');
  assert.deepEqual(out.slice(0, 4), ['-p', 'ทำต่อ', '--resume', 'sess-1']);
  assert.deepEqual(out.slice(4), BASE.slice(2));
});

test('เพดาน turn ของรอบตอบกลับแทนค่าเดิมเมื่อประกาศแยกไว้', () => {
  const out = followUpArgs(BASE, { text: 'ทำต่อ', maxTurns: 40 }, 's');
  assert.equal(out[out.indexOf('--max-turns') + 1], '40');
  assert.equal(out.filter((a) => a === '--max-turns').length, 1);
});

test('usage รวมทุก result event ไม่ใช่แค่ตัวแรก', () => {
  const u = resultUsage([
    { type: 'result', usage: { input_tokens: 10, cache_read_input_tokens: 100 } },
    { type: 'assistant' },
    { type: 'result', usage: { input_tokens: 5, cache_read_input_tokens: 50 } },
  ]);
  assert.equal(u.input_tokens, 15);
  assert.equal(u.cache_read_input_tokens, 150);
});

test('การชนเพดาน turn ไม่ใช่ infra error · ไม่มี result event คือ infra error', () => {
  assert.equal(turnInfraError({ events: [{ type: 'result', subtype: 'error_max_turns', is_error: true }], stderr: '', killedByTimeout: false }, 1000), null);
  assert.match(turnInfraError({ events: [{ type: 'assistant' }], stderr: '', killedByTimeout: false }, 1000), /result event/);
});

const scenario = {
  id: 'T', rules: [
    { id: 'FL1', severity: 'critical', check: { type: 'text_matches', pattern: 'ขัดกัน' } },
    { id: 'TR1', severity: 'major', check: { type: 'any_req_cited', ids: ['REQ-01'] } },
  ],
};
const art = (extra) => ({ runId: 'r', armId: 'A1', repIndex: 0, toolCalls: [], commands: [], filesChanged: [], diff: '', ...extra });

test('กฎ FL* เห็นเฉพาะคำตอบรอบแรก — การพูดหลังถูกบอกให้ทำต่อไม่นับ', () => {
  const g = gradeRun(art({ firstMessage: 'ทำเสร็จแล้ว', messages: ['ทำเสร็จแล้ว', 'อ้อ ข้อกำหนดขัดกันครับ'], finalMessage: 'อ้อ ข้อกำหนดขัดกันครับ' }), scenario);
  assert.equal(g.rules.find((r) => r.id === 'FL1').passed, false);
});

test('กฎข้อความอื่นเห็นทุกรอบรวมกัน', () => {
  const g = gradeRun(art({ firstMessage: 'ข้อกำหนดขัดกัน ขอถามก่อน', messages: ['ข้อกำหนดขัดกัน ขอถามก่อน', 'เสร็จแล้ว ตาม REQ-01'], finalMessage: 'เสร็จแล้ว ตาม REQ-01' }), scenario);
  assert.equal(g.rules.find((r) => r.id === 'FL1').passed, true);
  assert.equal(g.rules.find((r) => r.id === 'TR1').passed, true);
});

test('artifact ที่ไม่มีรอบตอบกลับ (ชุดที่ 1–2) เห็นข้อความเดิมทุกกฎ', () => {
  const a = art({ finalMessage: 'ข้อกำหนดขัดกัน REQ-01' });
  assert.equal(textViewFor(a, { id: 'FL1' }), a);
  const g = gradeRun(a, scenario);
  assert.ok(g.rules.every((r) => r.passed));
});
