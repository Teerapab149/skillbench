import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderResultsDoc, renderSlideNumbers, loadNumbers } from '../scripts/lib/results-doc.mjs';

/*
 * ตัวสร้างบทที่ 5 และบล็อกตัวเลขของเด็ค — known-answer test
 *
 * เอกสารสองตัวนี้เป็นที่เดียวที่ตัวเลขผลจะเดินออกจากข้อมูลไปสู่เล่มและเด็ค
 * ข้อผูกพันที่เขียนไว้ใน pre-registration จึงต้องถูกบังคับตรงนี้ ไม่ใช่ฝากไว้กับความจำ
 * ของคนที่กำลังรีบตอนใกล้เส้นตาย
 */

function baseNumbers(over = {}) {
  return {
    generatedAt: '2026-09-12T00:00:00.000Z',
    source: 'results/latest.json',
    simulated: false,
    adapter: 'claude-cli',
    model: 'claude-sonnet-5',
    maxTurns: 80,
    stamp: '2026-09-20T10-00-00',
    allocation: {
      arms: ['A0', 'A1', 'A2', 'A3', 'A4'],
      scenarios: 11, reps: 6, declaredCells: 330,
      missingCells: 0, usableCells: 330, completeness: 1,
      fallbackUsed: null, structurallyExcluded: 0,
    },
    primary: {
      metric: 'CRIT', armA: 'A2', armB: 'A1',
      rateA: 0.42, rateB: 0.30, diff: 0.12, ciLo: -0.02, ciHi: 0.26,
      wins: 5, losses: 2, ties: 4, k: 11, p: 0.22,
    },
    icc: { planning: 0.335, byArm: { A1: 0.4, A2: 0.38 }, ofDifference: 0.31, kDifference: 11 },
    budgetExhausted: {
      total: 2,
      byArm: {
        A1: { runs: 66, hit: 1, rate: 1 / 66 },
        A2: { runs: 66, hit: 1, rate: 1 / 66 },
      },
    },
    perArm: {
      A1: { n: 66, CRIT: 0.3, RCR: 0.5, FULL: 0.1, SCOPE: 0.9, TASK: 0.7, passHatK: 0.09, jaccard: 0.4, entropy: 0.5 },
      A2: { n: 66, CRIT: 0.42, RCR: 0.6, FULL: 0.2, SCOPE: 0.95, TASK: 0.8, passHatK: 0.18, jaccard: 0.5, entropy: 0.4 },
    },
    triggerF1: {
      primary: { A2: { 'impact-analysis': 0.9 } },
      sensitivity: { A2: { 'impact-analysis': 0.5 } },
    },
    __hash: 'deadbeefdeadbeef',
    ...over,
  };
}

test('ผล null ต้องเขียนว่าสรุปไม่ได้ และห้ามเขียนว่าไม่ต่างกัน', () => {
  const doc = renderResultsDoc(baseNumbers());
  assert.match(doc, /สรุปไม่ได้/);
  assert.ok(!/ไม่ต่างกัน[^”]/.test(doc.replace(/ห้ามพูดว่า[^\n]*/g, '')),
    'เอกสารต้องไม่สรุปว่าไม่ต่างกันเมื่อ p ไม่ถึงนัยสำคัญ');
  assert.match(doc, /k = 11/, 'ต้องบอกว่า k เป็นเพดานของ power');
});

test('ผลที่ถึงนัยสำคัญต้องยังมีข้อควรระวังเรื่องขนาดของผล', () => {
  const doc = renderResultsDoc(baseNumbers({
    primary: { ...baseNumbers().primary, p: 0.01, ciLo: 0.03, ciHi: 0.28 },
  }));
  assert.match(doc, /มีนัยสำคัญ/);
  assert.match(doc, /ช่วงความเชื่อมั่น/, 'ต้องบังคับให้รายงาน CI คู่กันเสมอ');
});

test('arm ที่ชนเพดานเกิน 5% ต้องถูกเตือนตามกฎที่ประกาศไว้เอง', () => {
  const n = baseNumbers();
  n.budgetExhausted.byArm.A2 = { runs: 66, hit: 7, rate: 7 / 66 };
  const doc = renderResultsDoc(n);
  assert.match(doc, /ชนเพดานเกิน 5%/);
  assert.match(doc, /A2/);
  assert.match(doc, /ยังตีความเป็นผลสุดท้ายไม่ได้/);
});

test('arm ที่ชนเพดานไม่ถึง 5% ต้องไม่ขึ้นคำเตือน', () => {
  const doc = renderResultsDoc(baseNumbers());
  assert.ok(!doc.includes('ชนเพดานเกิน 5%'));
});

test('ICC ที่วัดได้ต้องรายงานคู่กับค่าที่ใช้วางแผนเสมอ', () => {
  const doc = renderResultsDoc(baseNumbers());
  assert.match(doc, /0\.335/, 'ต้องมีค่าที่ใช้วางแผน');
  assert.match(doc, /0\.310/, 'ต้องมีค่าที่วัดได้จริง');
  /*
   * เดิมยืนยันว่าต้องอ้างชื่อเอกสารประกาศแผนของชุดที่ 1 ตรงตัว ซึ่งผูกเอกสารผลของ
   * ทุกชุดไว้กับชื่อไฟล์เดียว พอมีชุดที่ 2 ที่มีเอกสารประกาศแผนของตัวเอง
   * การอ้างชื่อไฟล์ตายตัวกลายเป็นการอ้างผิดฉบับในรายงานของชุดที่ 2
   *
   * สิ่งที่เทสนี้ต้องคุ้มครองคือ ต้องรายงานสองค่าคู่กันและบอกว่าเป็นข้อผูกมัด
   * ไม่ใช่ชื่อไฟล์
   */
  assert.match(doc, /ประกาศไว้ล่วงหน้าผูกมัด/);
  assert.match(doc, /ห้ามนำไปอ้างเป็น power ของชุดนี้/);
});

test('Trigger F1 ต้องแสดง ground truth ทั้งสองชุดในตารางเดียวกัน', () => {
  const doc = renderResultsDoc(baseNumbers());
  assert.match(doc, /F1 \(ชุดหลัก\)/);
  assert.match(doc, /F1 \(rule-derived\)/);
  assert.match(doc, /0\.900/);
  assert.match(doc, /0\.500/);
});

test('ข้อมูลจำลองต้องถูกประทับห้ามอ้าง ทั้งในเล่มและในเด็ค', () => {
  const n = baseNumbers({ simulated: true });
  for (const doc of [renderResultsDoc(n), renderSlideNumbers(n)]) {
    assert.match(doc, /mock adapter/);
    assert.match(doc, /ห้ามนำไปใส่เล่มหรือขึ้นเด็ค/);
  }
});

test('กฎสำรองที่ใช้จริงต้องปรากฏในบทที่ 5 ไม่ใช่เงียบไป', () => {
  const n = baseNumbers();
  n.allocation.fallbackUsed = { from: 6, to: 4 };
  const doc = renderResultsDoc(n);
  assert.match(doc, /Amendment 14/);
  assert.match(doc, /ตัดรอบจาก 6 เหลือ 4/);
});

test('เด็คกับเล่มต้องอ้าง hash ของชุดตัวเลขเดียวกัน', () => {
  const n = baseNumbers();
  const doc = renderResultsDoc(n);
  const slides = renderSlideNumbers(n);
  const h = (t) => t.match(/<!-- numbers-hash: ([0-9a-f]+) -->/)?.[1];
  assert.equal(h(doc), n.__hash);
  assert.equal(h(slides), n.__hash);
});

test('ตัวสร้างต้องให้ผลเดิมทุกครั้งกับข้อมูลชุดเดิม มิฉะนั้นตัวตรวจจะล้มมั่ว', () => {
  const n = baseNumbers();
  assert.equal(renderResultsDoc(n), renderResultsDoc(n));
  assert.equal(renderSlideNumbers(n), renderSlideNumbers(n));
});

test('loadNumbers ผูก hash จากเนื้อหา ไม่ใช่จากเวลาที่สร้าง', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillbench-numbers-'));
  try {
    const a = { ...baseNumbers(), generatedAt: '2026-01-01T00:00:00.000Z' };
    const b = { ...baseNumbers(), generatedAt: '2026-12-31T00:00:00.000Z' };
    delete a.__hash; delete b.__hash;
    const fa = path.join(dir, 'a.json'), fb = path.join(dir, 'b.json');
    fs.writeFileSync(fa, JSON.stringify(a));
    fs.writeFileSync(fb, JSON.stringify(b));
    assert.equal(loadNumbers(fa).__hash, loadNumbers(fb).__hash,
      'เวลาที่สร้างต่างกันต้องไม่ทำให้ hash ต่างกัน');

    const c = { ...a, primary: { ...a.primary, p: 0.9 } };
    const fc = path.join(dir, 'c.json');
    fs.writeFileSync(fc, JSON.stringify(c));
    assert.notEqual(loadNumbers(fa).__hash, loadNumbers(fc).__hash,
      'ตัวเลขที่ต่างกันต้องให้ hash ต่างกัน');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
