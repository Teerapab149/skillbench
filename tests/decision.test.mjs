/**
 * ตารางตัดสินผลหลักของชุดที่ 3 (C7) — p และ CI มาจาก sign-flip ตัวเดียวกัน
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signFlipP, signFlipCI, decidePrimary, exactSignFlipTest, makeRng } from '../src/stats.mjs';

test('meet-in-the-middle ให้ p เท่ากับการแจกแจงครบทุกแบบ', () => {
  const rnd = makeRng(7);
  for (let t = 0; t < 500; t++) {
    const k = 1 + Math.floor(rnd() * 14);
    const d = Array.from({ length: k }, () => (rnd() < 0.3 ? 0 : Math.round((rnd() - 0.4) * 8) / 8));
    assert.equal(signFlipP(d), exactSignFlipTest(d).p);
  }
});

test('ข้อมูลชุดที่ 2 ให้ p = 0.25 เหมือนที่รายงานไว้', () => {
  assert.equal(signFlipP([-0.18, 0, 0, 0.75, -0.03, 0, 0, 0.45, 0.23, 0, 0]), 0.25);
});

test('CI จากการกลับด้านคร่อมค่าเฉลี่ย และ CI 90% แคบกว่า 95%', () => {
  const d = [0.1, 0.2, -0.05, 0.3, 0, 0.15, -0.1, 0.25];
  const c95 = signFlipCI(d, 0.95), c90 = signFlipCI(d, 0.90);
  assert.ok(c95.lo <= c95.mean && c95.mean <= c95.hi);
  assert.ok(c90.lo >= c95.lo - 1e-9 && c90.hi <= c95.hi + 1e-9);
});

test('ตารางตัดสินครบสี่ทาง', () => {
  const big = Array.from({ length: 12 }, (_, i) => 0.3 + (i % 3) * 0.05);
  assert.equal(decidePrimary(big, { margin: 0.125 }).verdict, 'A_better');
  assert.equal(decidePrimary(big.map((x) => -x), { margin: 0.125 }).verdict, 'B_better');
  const tiny = Array.from({ length: 22 }, (_, i) => (i % 2 ? 0.02 : -0.02));
  assert.equal(decidePrimary(tiny, { margin: 0.125 }).verdict, 'equivalent');
  const wide = [0.6, -0.5, 0.4, -0.3, 0.7, -0.6];
  assert.equal(decidePrimary(wide, { margin: 0.125 }).verdict, 'inconclusive');
  const smallButSure = Array.from({ length: 20 }, () => 0.03);
  assert.equal(decidePrimary(smallButSure, { margin: 0.125 }).verdict, 'different_but_trivial');
});

test('ต้องประกาศ margin เสมอ', () => {
  assert.throws(() => decidePrimary([0.1, 0.2]), /margin/);
});
