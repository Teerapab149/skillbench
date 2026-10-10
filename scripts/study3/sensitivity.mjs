#!/usr/bin/env node
/*
 * การวิเคราะห์ความไวที่ประกาศไว้ล่วงหน้าใน DEVIATIONS-3 §4 (commit ก่อนรัน analyze ครั้งแรก)
 *
 *   MAIN  ตัวตรวจเดิม · 22 โจทย์ (ต้องตรงกับ analyze:study3 — ใช้ตรวจว่าสคริปต์นี้คำนวณแบบเดียวกัน)
 *   SA-1  ตัวตรวจที่แก้ F1′ (S05 GP1) · F2′ (S08/S09 SC1) · F3′ (S06 FL1) · 22 โจทย์
 *   SA-2  ตัวตรวจเดิม · ตัด S05, S06, S08, S09 (18 โจทย์)
 *
 * ทุกแบบ: RCRc · รอบ 0–2 · ผลต่างรายโจทย์ = mean(A) − mean(B) · decidePrimary margin 0.125 alpha 0.05
 * ผลหลักคือ MAIN เสมอ (DEVIATIONS-3 §4 ข้อ 4)
 * ใช้: node scripts/study3/sensitivity.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { gradeRun } from '../../src/graders.mjs';
import { decidePrimary } from '../../src/stats.mjs';

const OUT = 'results-study3';
const REPS = 3;
const ckptFile = fs.readdirSync(OUT).find((f) => /^checkpoint-[0-9a-f]{12}\.json$/.test(f));
const ckpt = JSON.parse(fs.readFileSync(path.join(OUT, ckptFile), 'utf8'));
const artifacts = ckpt.artifacts.filter((a) => a.repIndex < REPS && !a.error);
const config = JSON.parse(fs.readFileSync('config/arms-study3.json', 'utf8'));
const { margin, alpha } = config.primaryEndpoint.decision;

const load = (id) => JSON.parse(fs.readFileSync(path.join('scenarios', `${id}.json`), 'utf8'));
const rule = (s, id) => {
  const r = s.rules.find((x) => x.id === id);
  if (!r) throw new Error(`${s.id}: ไม่มีกฎ ${id}`);
  return r;
};

/* ตัวตรวจที่แก้ — ข้อความตรงกับ DEVIATIONS-3 §3 */
function corrected(s) {
  const c = structuredClone(s);
  if (c.id === 'S05-cancel-basic') {
    const r = rule(c, 'GP1');
    if (r.check.type !== 'no_unrequested_feature') throw new Error('S05 GP1 เปลี่ยนชนิด');
    r.check.pattern = 'CANCELLATION_CUTOFF|CUTOFF_HOURS|2\\s*ชั่วโมง|2\\s*\\*\\s*(60|3600)|7200|two hours|2\\s*hours?';
  }
  if (c.id === 'S06-per-booking-quota') {
    const r = rule(c, 'FL1');
    if (r.check.type !== 'text_matches') throw new Error('S06 FL1 เปลี่ยนชนิด');
    r.check.pattern = `${r.check.pattern}|พิมพ์ผิด|typo|ฝ่ายไอที`;
  }
  if (c.id === 'S08-rounding-change' || c.id === 'S09-rate-change') {
    const r = rule(c, 'SC1');
    if (r.check.type !== 'files_within') throw new Error(`${c.id} SC1 เปลี่ยนชนิด`);
    r.check.globs = [...r.check.globs, 'REQUIREMENTS.md', 'openapi.yaml'];
  }
  return c;
}

const ids = [...new Set(artifacts.map((a) => a.scenarioId))].sort();
const scen = Object.fromEntries(ids.map((id) => [id, load(id)]));
const grade = (fix) => artifacts.map((a) => gradeRun(a, fix ? corrected(scen[a.scenarioId]) : scen[a.scenarioId]));

function compare(rows, armA, armB, keep) {
  const diffs = [];
  for (const id of ids.filter(keep)) {
    const m = (arm) => {
      const v = rows.filter((g) => g.scenarioId === id && g.armId === arm).map((g) => g.RCRc).filter((x) => x != null);
      return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
    };
    const a = m(armA), b = m(armB);
    if (a != null && b != null) diffs.push(a - b);
  }
  const d = decidePrimary(diffs, { margin, alpha });
  const mean = diffs.reduce((s, x) => s + x, 0) / diffs.length;
  return { k: diffs.length, meanDiff: mean, verdict: d.verdict, p: d.p, ci95: [d.ci95.lo, d.ci95.hi], ci90: [d.ci90.lo, d.ci90.hi] };
}

const EXCL = new Set(['S05-cancel-basic', 'S06-per-booking-quota', 'S08-rounding-change', 'S09-rate-change']);
const main = grade(false);
const sa1 = grade(true);
const out = {};
for (const [name, rows, keep] of [['MAIN', main, () => true], ['SA-1', sa1, () => true], ['SA-2', main, (id) => !EXCL.has(id)]]) {
  out[name] = { primary_A2_vs_A1: compare(rows, 'A2', 'A1', keep), keySecondary_A2_vs_A5: compare(rows, 'A2', 'A5', keep) };
}
fs.writeFileSync(path.join(OUT, 'sensitivity.json'), JSON.stringify({ reps: REPS, margin, alpha, runs: artifacts.length, results: out }, null, 2));
const f = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
for (const [name, r] of Object.entries(out)) {
  for (const [ep, v] of Object.entries(r)) {
    console.log(`${name.padEnd(5)} ${ep.padEnd(22)} k=${v.k}  diff ${f(v.meanDiff)}  CI95 [${f(v.ci95[0])}, ${f(v.ci95[1])}]  CI90 [${f(v.ci90[0])}, ${f(v.ci90[1])}]  p=${v.p.toFixed(4)}  → ${v.verdict}`);
  }
}
