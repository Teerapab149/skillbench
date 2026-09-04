/**
 * tests/gate-rep0.test.mjs — ประตู rep 0 ต้องตัดสินตามเกณฑ์ที่ประกาศไว้ ไม่ใช่ตามความรู้สึก
 *
 * และต้อง **ไม่มีทาง** คำนวณผลเปรียบเทียบระหว่าง arm ออกมาได้
 * เพราะถ้าคำนวณได้ มันจะกลายเป็น interim analysis ที่ทำให้ alpha พองโดยไม่มีใครเห็น
 *
 *   node --test tests/gate-rep0.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateGate, difficultyMap, CRITERIA } from '../scripts/gate-rep0.mjs';

const SCEN = Array.from({ length: 11 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`);
const ARMS = ['A0', 'A1', 'A2', 'A3', 'A4'];

/** สร้างชุด rep 0 ครบ 55 cell โดยกำหนดอัตราผ่านรายโจทย์ได้ */
function makeGraded(passPerScenario) {
  const out = [];
  for (const s of SCEN) {
    const nPass = passPerScenario[s] ?? 2;
    ARMS.forEach((a, i) => {
      out.push({ runId: `${s}__${a}__r0`, scenarioId: s, armId: a, rep: 0, CRIT: i < nPass ? 1 : 0 });
    });
  }
  return out;
}

const ok = (r, name) => r.checks.find((c) => c.name.includes(name))?.ok;

test('ชุดที่สมบูรณ์และกระจายดี ต้อง GO', () => {
  const r = evaluateGate({ graded: makeGraded({}), scenIds: SCEN, armIds: ARMS });
  assert.ok(r.checks.every((c) => c.ok), r.checks.filter((c) => !c.ok).map((c) => c.name).join(', '));
});

test('cell ขาด ต้องไม่ผ่านข้อความครบ', () => {
  const g = makeGraded({}).slice(0, 54);
  const r = evaluateGate({ graded: g, scenIds: SCEN, armIds: ARMS });
  assert.equal(ok(r, 'ความครบ'), false);
});

test('cell ซ้ำ ต้องไม่ผ่าน แม้ยอดรวมจะเท่าเดิม', () => {
  const g = makeGraded({});
  g[10] = { ...g[0] };            // ทำให้ cell แรกซ้ำ และของเดิมหายไป — ยอดรวมยังเป็น 55
  const r = evaluateGate({ graded: g, scenIds: SCEN, armIds: ARMS });
  assert.equal(g.length, 55, 'ยอดรวมต้องไม่เปลี่ยน มิฉะนั้นเทสนี้ไม่ได้ทดสอบสิ่งที่ตั้งใจ');
  assert.equal(ok(r, 'ความครบ'), false);
});

test('โจทย์ชนเพดานเกินเกณฑ์ ต้อง NO-GO', () => {
  // 9 โจทย์ได้ 5/5 — เกินเกณฑ์ที่ประกาศไว้ (สูงสุด 8)
  const pp = {};
  SCEN.slice(0, 9).forEach((s) => { pp[s] = 5; });
  SCEN.slice(9).forEach((s) => { pp[s] = 2; });
  const r = evaluateGate({ graded: makeGraded(pp), scenIds: SCEN, armIds: ARMS });
  assert.equal(r.degenerate, 9);
  assert.equal(ok(r, 'แยกแยะ'), false);
});

test('โจทย์ชนพื้นก็ต้องนับเป็น degenerate เหมือนกัน', () => {
  const pp = {};
  SCEN.slice(0, 9).forEach((s) => { pp[s] = 0; });
  SCEN.slice(9).forEach((s) => { pp[s] = 2; });
  const r = evaluateGate({ graded: makeGraded(pp), scenIds: SCEN, armIds: ARMS });
  assert.equal(r.degenerate, 9);
  assert.equal(ok(r, 'แยกแยะ'), false);
});

test('degenerate พอดีเกณฑ์ (8 โจทย์) ยังต้องผ่าน', () => {
  const pp = {};
  SCEN.slice(0, 8).forEach((s) => { pp[s] = 5; });
  SCEN.slice(8).forEach((s) => { pp[s] = 2; });
  const r = evaluateGate({ graded: makeGraded(pp), scenIds: SCEN, armIds: ARMS });
  assert.equal(r.degenerate, CRITERIA.degenerateScenarioMax);
  assert.equal(ok(r, 'แยกแยะ'), true);
});

test('อัตราผ่านรวมชนพื้น ต้อง NO-GO', () => {
  const pp = {};
  SCEN.forEach((s) => { pp[s] = 0; });
  const r = evaluateGate({ graded: makeGraded(pp), scenIds: SCEN, armIds: ARMS });
  assert.equal(ok(r, 'อัตราผ่านรวม'), false);
});

test('อัตราผ่านรวมชนเพดาน ต้อง NO-GO', () => {
  const pp = {};
  SCEN.forEach((s) => { pp[s] = 5; });
  const r = evaluateGate({ graded: makeGraded(pp), scenIds: SCEN, armIds: ARMS });
  assert.equal(ok(r, 'อัตราผ่านรวม'), false);
});

test('แผนที่ความยากรวมทุก arm — n ต่อโจทย์ต้องเท่าจำนวน arm', () => {
  const dm = difficultyMap(makeGraded({}), SCEN);
  assert.equal(dm.length, 11);
  for (const d of dm) assert.equal(d.n, ARMS.length, `${d.id} ควรมี ${ARMS.length} run`);
});

test('ผลของประตูต้องไม่ขึ้นกับว่า arm ไหนเป็นตัวที่ผ่าน', () => {
  // สลับว่า arm ไหนได้ 1 โดยคงจำนวนที่ผ่านต่อโจทย์ไว้เท่าเดิม -> ผลประตูต้องเหมือนเดิมทุกประการ
  const base = makeGraded({});
  const shuffled = base.map((g) => ({ ...g }));
  for (const s of SCEN) {
    const rows = shuffled.filter((g) => g.scenarioId === s);
    const vals = rows.map((g) => g.CRIT).reverse();
    rows.forEach((g, i) => { g.CRIT = vals[i]; });
  }
  const a = evaluateGate({ graded: base, scenIds: SCEN, armIds: ARMS });
  const b = evaluateGate({ graded: shuffled, scenIds: SCEN, armIds: ARMS });
  assert.deepEqual(a.difficulty, b.difficulty);
  assert.equal(a.pooled, b.pooled);
  assert.deepEqual(a.checks.map((c) => c.ok), b.checks.map((c) => c.ok));
});

test('ซอร์สของประตูต้องไม่มีการจัดกลุ่มตาม arm สำหรับผลลัพธ์', () => {
  // บังคับด้วยโค้ด ไม่ใช่ด้วยวินัย — ถ้าใครเผลอเพิ่มการเทียบราย arm เทสนี้จะตก
  const src = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../scripts/gate-rep0.mjs'), 'utf8');
  const body = src.split('export function evaluateGate')[1].split('// ------')[0];
  for (const bad of ['armId ===', 'A2', 'A1', 'byArm', 'perArm']) {
    assert.ok(!body.includes(bad), `evaluateGate ต้องไม่อ้างถึง "${bad}" — จะกลายเป็น interim comparison`);
  }
});
