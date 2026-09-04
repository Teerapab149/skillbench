/**
 * tests/stats.test.mjs — known-answer test ของสถิติที่ผลการทดลองจะพิงอยู่
 *
 * ต้องรันผ่าน "ก่อน" เก็บข้อมูลจริง ไม่ใช่หลัง
 *
 * เหตุผลไม่ใช่เรื่องคุณภาพโค้ดทั่วไป แต่มาจากบทเรียนของโปรเจกต์นี้เอง:
 * เคยมี regex ของกฎที่ compile ไม่ผ่าน ทำให้ S02/S03 ได้ CRIT = 0% ทุก run
 * แล้ว calibration อ่านผลออกมาเป็น "โจทย์ยากเกินไป" ทั้งที่เอเจนต์ทำถูกทุกครั้ง
 * เครื่องมือวัดที่พังกับปรากฏการณ์ที่น่าสนใจ ให้ตัวเลขหน้าตาเหมือนกันเป๊ะ
 * ทางเดียวที่แยกออกคือป้อนข้อมูลที่รู้คำตอบล่วงหน้าเข้าไป
 *
 *   node --test tests/stats.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  passHatK, exactSignFlipTest, mcnemarExact, wilson, iccOneWay, designEffect, clusterBootstrapDiff,
  tostFromCI,
} from '../src/stats.mjs';

// ---------- passHatK ----------

test('passHatK: scenario ที่ผ่านครบทุกรอบเท่านั้นที่นับว่าผ่าน', () => {
  const r = passHatK({ S1: [1, 1, 1], S2: [1, 0, 1], S3: [1, 1] });
  assert.equal(r.passed, 2);
  assert.equal(r.total, 3);
  assert.equal(r.value, 2 / 3);
  assert.equal(r.missing, 0);
});

test('passHatK: scenario ที่ไม่มีข้อมูลเลย ต้องไม่ถูกนับว่าผ่าน', () => {
  // นี่คือบั๊กจริงที่แก้เมื่อ 4 ก.ย. 2569 — [].every() คืน true เสมอ
  // scenario ที่เก็บข้อมูลไม่ได้จึงเคยถูกนับเป็น "ผ่านครบทุกครั้ง"
  // และมันเด้งตอนโควตาตัดกลางคัน = ยิ่งข้อมูลขาด ตัวเลขยิ่งสวย
  const r = passHatK({ S1: [1, 1], S2: [], S3: [0, 1] });
  assert.equal(r.passed, 1, 'ผ่านจริงมีแค่ S1');
  assert.equal(r.total, 2, 'ตัวหารต้องนับเฉพาะ scenario ที่มีข้อมูล');
  assert.equal(r.value, 0.5);
  assert.equal(r.missing, 1);
  assert.deepEqual(r.missingIds, ['S2']);
});

test('passHatK: ไม่มีข้อมูลเลยทั้งชุด ต้องได้ NaN ไม่ใช่ 1', () => {
  const r = passHatK({ S1: [], S2: [] });
  assert.ok(Number.isNaN(r.value));
  assert.equal(r.missing, 2);
});

// ---------- exact sign-flip (สถิติหลัก) ----------

test('sign-flip: ผลต่างเป็นบวกทุกโจทย์ k=11 ต้องได้ p = 2/2048', () => {
  // ทุกโจทย์ไปทางเดียวกัน มีเพียงสองรูปแบบ (ทั้งบวกหมด / ทั้งลบหมด) ที่สุดขั้วเท่าหรือกว่า
  const d = Array(11).fill(0.2);
  const r = exactSignFlipTest(d);
  assert.equal(r.k, 11);
  assert.equal(r.permutations, 2048);
  assert.equal(r.p, 2 / 2048);
});

test('sign-flip: ค่าสมมาตรรอบศูนย์ ต้องได้ p = 1', () => {
  const r = exactSignFlipTest([0.5, -0.5]);
  assert.equal(r.observed, 0);
  assert.equal(r.p, 1, 'ค่าเฉลี่ยเป็นศูนย์ ทุกการพลิกเครื่องหมายสุดขั้วเท่ากันหมด');
});

test('sign-flip: k=3 ทุกค่าเท่ากันและเป็นบวก ต้องได้ 2/8', () => {
  const r = exactSignFlipTest([1, 1, 1]);
  assert.equal(r.p, 2 / 8);
});

test('sign-flip: ทิศทางกลับด้านต้องได้ p เท่ากัน (two-sided)', () => {
  const a = exactSignFlipTest([0.3, 0.1, 0.4, 0.2]);
  const b = exactSignFlipTest([-0.3, -0.1, -0.4, -0.2]);
  assert.equal(a.p, b.p);
  assert.equal(a.observed, -b.observed);
});

test('sign-flip: ไม่มีข้อมูล ต้องคืน NaN ไม่ใช่ 0 หรือ 1', () => {
  const r = exactSignFlipTest([]);
  assert.ok(Number.isNaN(r.p));
});

// ---------- McNemar (ตอนนี้เป็น sensitivity ไม่ใช่ primary) ----------

test('McNemar exact: b=0 c=0 ต้องได้ p = 1', () => {
  assert.equal(mcnemarExact(0, 0).p, 1);
});

test('McNemar exact: b=0 c=5 ต้องได้ p = 2 * 0.5^5', () => {
  const r = mcnemarExact(0, 5);
  assert.ok(Math.abs(r.p - 2 * Math.pow(0.5, 5)) < 1e-12);
});

// ---------- Wilson ----------

test('Wilson: 5/5 ขอบล่างต้องประมาณ 0.57 ไม่ใช่ 1.0', () => {
  // ตัวเลขนี้ถูกอ้างบนสไลด์ ถ้าสูตรเพี้ยนคำตอบในห้องจะผิดตาม
  const w = wilson(5, 5);
  assert.ok(w.lo > 0.5 && w.lo < 0.63, `ได้ ${w.lo}`);
  assert.equal(w.hi, 1);
});

// ---------- ICC / design effect ----------

test('designEffect: m=1 ต้องได้ 1 เสมอไม่ว่า ICC เท่าไหร่', () => {
  assert.equal(designEffect(1, 0.335), 1);
});

test('designEffect: ตรงกับตัวเลขที่ใช้วางแผน (m=6, ICC=0.335)', () => {
  assert.ok(Math.abs(designEffect(6, 0.335) - 2.675) < 1e-9);
});

test('ICC: ทุก cluster เหมือนกันภายใน แต่ต่างกันระหว่าง cluster -> ICC สูง', () => {
  const r = iccOneWay({ A: [1, 1, 1, 1], B: [0, 0, 0, 0], C: [1, 1, 1, 1], D: [0, 0, 0, 0] });
  assert.ok(r.icc > 0.9, `ควรใกล้ 1 แต่ได้ ${r.icc}`);
});

// ---------- cluster bootstrap ----------

test('cluster bootstrap: ข้อมูลเหมือนกันทุกประการ ผลต่างต้องเป็น 0 และ CI คร่อม 0', () => {
  const A = { S1: [1, 0, 1], S2: [1, 1, 0], S3: [0, 0, 1] };
  const B = { S1: [1, 0, 1], S2: [1, 1, 0], S3: [0, 0, 1] };
  const r = clusterBootstrapDiff(A, B, { iters: 500 });
  assert.equal(r.diff, 0);
  assert.ok(r.lo <= 0 && r.hi >= 0);
});

test('cluster bootstrap: ใช้เฉพาะ cluster ที่มีทั้งสองฝั่ง (matched cells)', () => {
  const A = { S1: [1, 1], S2: [1, 1], S9: [0, 0] };
  const B = { S1: [0, 0], S2: [0, 0] };
  const r = clusterBootstrapDiff(A, B, { iters: 200 });
  assert.equal(r.clusters, 2, 'S9 ที่มีข้างเดียวต้องไม่ถูกนับ');
  assert.equal(r.diff, 1);
});

// ---------- TOST (equivalence) ----------

test('TOST: CI แคบและอยู่ในกรอบ -> equivalent', () => {
  const r = tostFromCI({ lo: -0.04, hi: 0.05, margin: 0.10 });
  assert.equal(r.verdict, 'equivalent');
});

test('TOST: CI กว้างกว่ากรอบ -> inconclusive ไม่ใช่ equivalent', () => {
  // นี่คือกับดักหลักของงานนี้ — "ไม่มีนัยสำคัญ" ไม่เท่ากับ "เท่ากัน"
  const r = tostFromCI({ lo: -0.20, hi: 0.18, margin: 0.10 });
  assert.equal(r.verdict, 'inconclusive');
});

test('TOST: CI คร่อมศูนย์แต่ล้นกรอบข้างเดียว -> inconclusive', () => {
  const r = tostFromCI({ lo: -0.02, hi: 0.15, margin: 0.10 });
  assert.equal(r.verdict, 'inconclusive');
});

test('TOST: CI อยู่นอกกรอบทั้งช่วง -> different', () => {
  const r = tostFromCI({ lo: 0.12, hi: 0.30, margin: 0.10 });
  assert.equal(r.verdict, 'different');
});

test('TOST: ขอบพอดี margin ต้องไม่นับว่า equivalent', () => {
  const r = tostFromCI({ lo: -0.10, hi: 0.10, margin: 0.10 });
  assert.notEqual(r.verdict, 'equivalent');
});

test('TOST: ไม่มี CI -> inconclusive ไม่ใช่ตัดสินมั่ว', () => {
  assert.equal(tostFromCI({ lo: NaN, hi: NaN, margin: 0.10 }).verdict, 'inconclusive');
});

// ---------- matched cells ----------

test('cluster bootstrap: cluster ที่มีชื่อทั้งสองฝั่งแต่ข้างหนึ่งว่าง ต้องไม่ถูกนับ', () => {
  const A = { S1: [1, 1], S2: [1, 1] };
  const B = { S1: [0, 0], S2: [] };
  const r = clusterBootstrapDiff(A, B, { iters: 200 });
  assert.equal(r.clusters, 1, 'S2 ที่ว่างข้างหนึ่งต้องถูกตัด');
  assert.equal(r.diff, 1);
});

test('cluster bootstrap: conf 0.90 ต้องให้ช่วงแคบกว่า 0.95', () => {
  const A = { S1: [1, 0], S2: [1, 1], S3: [0, 1], S4: [1, 0] };
  const B = { S1: [0, 0], S2: [1, 0], S3: [0, 0], S4: [0, 1] };
  const w = (c) => { const r = clusterBootstrapDiff(A, B, { iters: 3000, conf: c }); return r.hi - r.lo; };
  assert.ok(w(0.90) <= w(0.95), `90% ควรแคบกว่าหรือเท่า 95% (${w(0.90)} vs ${w(0.95)})`);
});
