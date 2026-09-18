import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectReadiness } from '../src/readiness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESULTS = path.join(ROOT, 'results');

function digest(dir) {
  const rows = [];
  const walk = (base, rel = '') => {
    for (const e of fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(base, e.name), r = path.join(rel, e.name);
      if (e.isDirectory()) walk(p, r); else rows.push([r, fs.readFileSync(p)]);
    }
  };
  walk(dir);
  /*
   * ย่อยทีละไฟล์ ไม่ต่อเป็นสตริงเดียว — แก้เมื่อ 18 ก.ย. 2569
   * พอ results/ มีข้อมูลจริง (artifact หลายสิบเมกะไบต์) การ join เป็นสตริงเดียว
   * เกิน string length ของ V8 และเทสล้มด้วย RangeError ทั้งที่โค้ดที่ตรวจไม่มีอะไรผิด
   */
  const h = crypto.createHash('sha256');
  for (const [r, b] of rows) { h.update(r); h.update(b); }
  return h.digest('hex');
}

test('read-only preflight reports advisory engineering/collection states and does not write results', () => {
  const before = digest(RESULTS);
  const report = collectReadiness({ root: ROOT });
  const after = digest(RESULTS);
  assert.equal(after, before);
  assert.equal(report.advisory, true);
  assert.deepEqual(report.allocation, { arms: 5, scenarios: 11, repetitions: 6, cells: 330, source: 'config/arms.json preRegisteredAllocation' });
  assert.equal(report.collectionReady, false);
});

/*
 * Amendment 16 (12 ก.ย. 2569) — การอนุมัติ Amendment 11–13 ทำให้ pending ว่าง
 *
 * ก่อนแก้ collectionReady คือ engineeringReady && pending.length === 0 แปลว่าการอนุมัติ
 * amendment ตัวสุดท้ายจะพลิก COLLECTION READY เป็น true ทันที ทั้งที่ยังไม่เคยรัน CLI จริง
 * เลยสักครั้ง — ซึ่งเป็นข้อเดียวที่ซอฟต์แวร์ตัดสินแทนไม่ได้
 */
test('collection readiness ไม่พลิกเป็น true เพียงเพราะไม่เหลือ pending decision', () => {
  const report = collectReadiness({ root: ROOT });
  assert.deepEqual(report.pendingResearchDecisions, [], 'Amendment 11–13 อนุมัติแล้ว');
  assert.ok(Array.isArray(report.collectionBlockers));
  /*
   * เดิมเทสนี้ยืนยันว่า "ต้องเหลือ blocker เรื่อง runtime preflight" ซึ่งผูกกับสถานะ
   * ของโลกตอนเขียน คือยังไม่เคยรัน CLI จริง พอรันจริงแล้ว blocker นั้นหายไปตามที่ควร
   * เทสจึงล้มทั้งที่ไม่มีอะไรผิด
   *
   * สิ่งที่ต้องคุ้มครองจริง ๆ คือ *กฎ* ไม่ใช่สถานะ: ความพร้อมเก็บข้อมูลต้องเป็น
   * engineeringReady และไม่เหลือ blocker พร้อมกัน — pending ว่างอย่างเดียว
   * ห้ามทำให้พลิกเป็น true เด็ดขาด
   */
  assert.equal(
    report.collectionReady,
    report.engineeringReady && report.collectionBlockers.length === 0,
    'collectionReady ต้องเป็นการและกันของสองเงื่อนไขเสมอ ไม่ใช่ผลของ pending ว่าง',
  );
  if (report.collectionBlockers.length > 0) {
    assert.equal(report.collectionReady, false, 'มี blocker อยู่แล้วห้ามพร้อม');
  }
});

test('manifest ที่แช่แข็งไว้กับนิยามการทดลองคนละชุดต้องไม่นับเป็นหลักฐาน auth', () => {
  const report = collectReadiness({ root: ROOT });
  const mf = report.checks.find((c) => c.name === 'runtime-manifest');
  const auth = report.checks.find((c) => c.name === 'auth-presence');
  assert.ok(mf && auth);
  if (mf.state === "pass") {
    assert.equal(auth.state, 'pass', 'manifest ตรง digest แล้วต้องนับเป็น init evidence');
  } else {
    assert.equal(auth.state, 'unknown', 'manifest ไม่ตรง digest ต้องไม่ทำให้ auth ผ่าน');
    assert.equal(report.collectionReady, false);
  }
});

// Amendment 14: the declared allocation lives in config/arms.json only. Preflight must
// read it there and check it against what is actually on disk, not restate a literal.
test('preflight checks the declared allocation against the arms and scenarios on disk', () => {
  const report = collectReadiness({ root: ROOT });
  const check = report.checks.find((c) => c.name === 'allocation-declared');
  assert.ok(check, "allocation-declared check must exist");
  assert.equal(check.state, 'pass');
  assert.equal(check.evidence.prereg.cells, 330);
  assert.equal(check.evidence.prereg.fallback.type, 'uniform-rep-truncation');
  assert.equal(check.evidence.prereg.surplusRule.status, 'void');
  assert.equal(report.allocation.repetitions, check.evidence.prereg.reps);
});

test('a declared allocation that disagrees with the real arm count fails the check', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skillbench-alloc-'));
  try {
    fs.mkdirSync(path.join(tmp, 'config'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'scenarios'), { recursive: true });
    const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'arms.json'), 'utf8'));
    real.preRegisteredAllocation.arms = [...real.preRegisteredAllocation.arms, "A9"];
    fs.writeFileSync(path.join(tmp, 'config', 'arms.json'), JSON.stringify(real));
    const report = collectReadiness({ root: tmp, resultsDir: path.join(tmp, "results") });
    const check = report.checks.find((c) => c.name === 'allocation-declared');
    assert.equal(check.state, 'fail');
    assert.equal(report.engineeringReady, false);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('mock runner refuses production results before creating output', () => {
  const before = digest(RESULTS);
  const run = spawnSync(process.execPath, ['src/runner.mjs', '--adapter', 'mock', '--arms', 'A0', '--scenarios', 'S01', '--reps', '1'], {
    cwd: ROOT, encoding: 'utf8',
  });
  assert.notEqual(run.status, 0);
  assert.match(`${run.stdout}${run.stderr}`, /mock.*ห้ามเขียนลง results/i);
  assert.equal(digest(RESULTS), before);
});

test('mock runner can still write to a disposable output directory', (t) => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'skillbench-preflight-mock-'));
  t.after(() => fs.rmSync(out, { recursive: true, force: true }));
  const run = spawnSync(process.execPath, ['src/runner.mjs', '--adapter', 'mock', '--arms', 'A0', '--scenarios', 'S01', '--reps', '1', '--out', out], {
    cwd: ROOT, encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.equal(fs.existsSync(path.join(out, 'latest.json')), true);
});
