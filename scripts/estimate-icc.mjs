/**
 * estimate-icc.mjs — ประมาณ ICC และขนาดตัวอย่างจากข้อมูลที่เก็บมาแล้วจริง
 *
 * ทำไมต้องมีสคริปต์นี้:
 *   requiredNPerArm() ใช้ designEffect = 1.5 ซึ่งเป็นค่าที่เดาเอา
 *   DE = 1 + (m-1)*ICC ที่ m = 10-14 ค่านั้นแปลว่า ICC ~ 0.04
 *   ถ้าโจทย์กำหนดผลลัพธ์มากกว่านั้น (ซึ่งตาราง CRIT บ่งชี้ชัดว่าใช่) n ที่ประกาศไว้จะน้อยเกินจริง
 *
 * ตัวเลขที่ต้องได้จากสคริปต์นี้ก่อนจึงจะประกาศขนาดตัวอย่างได้:
 *   1. ICC ของ CRIT ภายใน arm         — บอกว่า cluster กินข้อมูลไปเท่าไหร่
 *   2. pi01 / pi10 ระหว่าง A2 กับ A1   — ใส่สูตร McNemar โดยตรง
 *   3. ICC ของ "ผลต่าง" รายโจทย์       — ตัวจริงที่กำหนด design effect ของการทดสอบแบบจับคู่
 *
 *   node scripts/estimate-icc.mjs [--metric CRIT] [--arms A2,A1]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { iccOneWay, effectiveN, requiredPairsMcNemar, requiredNPerArm, fmtPct } from '../src/stats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = (f, d) => { const i = process.argv.indexOf(f); return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const METRIC = argv('--metric', 'CRIT');
const [TREAT, CTRL] = argv('--arms', 'A2,A1').split(',');

/*
 * โหลดจากไฟล์ graded ที่ "ใหม่ที่สุดของแต่ละ arm" ไม่ใช่จาก latest.json
 *
 * เหตุผล: latest.json ถูกเขียนทับทุกครั้งที่รัน การรัน A2 จะลบตัวชี้ของ A1 ทิ้ง
 * และไฟล์เก่า (4-7 ส.ค.) ถูกให้คะแนนด้วยตัวตรวจคนละรุ่นกับตอนนี้ — เอามาปนไม่ได้
 * จึงยึด "ไฟล์ล่าสุดที่มี arm นั้น" แล้วพิมพ์บอกว่าใช้ไฟล์ไหน เพื่อให้ตรวจย้อนหลังได้
 *
 * และต้องคัด run ที่จำลอง (adapter=mock) ออกก่อนทุกอย่าง
 *
 *   ฉบับแรกของสคริปต์นี้ไม่ได้คัด แล้วดูด graded-2026-08-07T18-00-17.json
 *   (110 run ของครบทั้ง 5 arm ที่ simulated=true ทั้งหมด) เข้ามาคำนวณ
 *   ได้ ICC = 0.483 กับ pi10 = 0.264 ออกมา ซึ่ง "ดูสมเหตุสมผลทุกประการ"
 *   ทั้งที่ไม่มี run จริงของ A2 อยู่ในระบบเลยแม้แต่ run เดียว
 *
 *   บันทึกไว้เป็นข้อบกพร่องที่ 21 — ตัวเลขปลอมที่ผ่านการตรวจสอบด้วยสายตาได้
 *   จึงคัดแบบ fail-closed: ถ้าพิสูจน์ไม่ได้ว่าเป็น run จริง ให้ทิ้ง
 */
const RES = path.join(ROOT, 'results');
const files = fs.readdirSync(RES).filter((f) => /^graded-.*\.json$/.test(f)).sort();
const load = (f) => { try { return JSON.parse(fs.readFileSync(path.join(RES, f), 'utf8')); } catch { return null; } };
const listOf = (d) => (Array.isArray(d) ? d : d?.graded ?? d?.artifacts ?? []);

/** runId ที่พิสูจน์ได้ว่าเป็น run จริง โดยดูจากไฟล์ artifacts คู่กันที่ timestamp เดียวกัน */
function realRunIds(gradedFile) {
  const arts = load(gradedFile.replace(/^graded-/, 'artifacts-'));
  if (!arts) return null;                     // ไม่มีคู่ให้ตรวจ -> ทิ้งทั้งไฟล์
  const ok = new Set();
  for (const a of listOf(arts)) if (a.simulated === false && a.adapter !== 'mock') ok.add(a.runId);
  return ok;
}

const bySource = {}, rows = {}, skipped = [];
for (const f of files) {                      // เรียงจากเก่าไปใหม่ -> ไฟล์ใหม่ทับไฟล์เก่า
  const real = realRunIds(f);
  const recs = listOf(load(f)).filter((r) => !r.error && real?.has(r.runId));
  if (!recs.length) { skipped.push(f); continue; }
  const armsHere = new Set(recs.map((r) => r.armId));
  for (const a of armsHere) rows[a] = new Map();   // ไฟล์ใหม่แทนที่ของเดิมทั้งชุด ไม่ใช่ merge
  for (const r of recs) { rows[r.armId].set(`${r.scenarioId}#${r.rep}`, r); bySource[r.armId] = f; }
}
if (skipped.length) console.log(`  ข้าม ${skipped.length} ไฟล์ที่เป็น run จำลองหรือตรวจที่มาไม่ได้`);

const armsFound = Object.keys(rows);
if (!armsFound.length) { console.error('ไม่พบข้อมูลที่ให้คะแนนแล้ว'); process.exit(1); }

console.log(`\nประมาณ ICC และขนาดตัวอย่าง — metric = ${METRIC}\n`);
console.log('แหล่งข้อมูลที่ใช้ (ไฟล์ล่าสุดของแต่ละ arm):');
for (const a of armsFound) console.log(`  ${a}  ${bySource[a]}  (${rows[a].size} run)`);

// ---------- 1. ICC ภายใน arm ----------
console.log(`\n1) ICC ของ ${METRIC} ภายในแต่ละ arm (cluster = scenario)\n`);
console.log('  arm | k  |  N | ค่าเฉลี่ย |   ICC | DE@m=10 | n_eff@m=10 | เพดาน k/ICC');
console.log('  ----+----+----+-----------+-------+---------+------------+------------');
const iccByArm = {};
for (const a of armsFound) {
  const cl = {};
  for (const r of rows[a].values()) (cl[r.scenarioId] ??= []).push(r[METRIC]);
  const res = iccOneWay(cl);
  iccByArm[a] = res.icc;
  const e = effectiveN(res.k, 10, res.icc);
  console.log(`  ${a.padEnd(3)} | ${String(res.k).padStart(2)} | ${String(res.N).padStart(2)} |`
    + ` ${fmtPct(res.grand).padStart(9)} | ${res.icc.toFixed(3)} |`
    + ` ${e.de.toFixed(2).padStart(7)} | ${e.nEff.toFixed(0).padStart(10)} |`
    + ` ${Number.isFinite(e.ceiling) ? e.ceiling.toFixed(0) : '∞'}`);
}

// ---------- 2. การจับคู่ระหว่าง arm ----------
if (!rows[TREAT] || !rows[CTRL]) {
  console.log(`\n2) ยังเปรียบเทียบ ${TREAT} vs ${CTRL} ไม่ได้ — ยังไม่มีข้อมูลของ ${!rows[TREAT] ? TREAT : CTRL}`);
  console.log('   รัน pilot ก่อน:  node src/runner.mjs --adapter claude-cli --arms A2 --reps 3\n');
  process.exit(0);
}

let b = 0, c = 0, both = 0, neither = 0;
const diffByScen = {};
for (const [k, rt] of rows[TREAT]) {
  const rc = rows[CTRL].get(k); if (!rc) continue;
  const t = rt[METRIC] === 1, n = rc[METRIC] === 1;
  if (t && !n) b++; else if (!t && n) c++; else if (t) both++; else neither++;
  (diffByScen[rt.scenarioId] ??= []).push((rt[METRIC] ?? 0) - (rc[METRIC] ?? 0));
}
const pairs = b + c + both + neither;
if (!pairs) { console.error('\nไม่มีคู่ที่จับกันได้เลย — ตรวจว่า scenarioId/rep ตรงกันไหม'); process.exit(1); }

const pi10 = b / pairs, pi01 = c / pairs;
console.log(`\n2) การจับคู่ ${TREAT} vs ${CTRL} — ${pairs} คู่ (จับด้วย scenarioId#rep)\n`);
console.log(`  ${TREAT} ผ่าน / ${CTRL} ตก   b = ${b}   (pi10 = ${pi10.toFixed(3)})`);
console.log(`  ${TREAT} ตก / ${CTRL} ผ่าน   c = ${c}   (pi01 = ${pi01.toFixed(3)})`);
console.log(`  ผ่านทั้งคู่ ${both} · ตกทั้งคู่ ${neither} · คู่ที่ไม่ตรงกันรวม ${b + c}`);

const iccDiff = iccOneWay(diffByScen);
console.log(`\n3) ICC ของ "ผลต่าง" รายโจทย์ = ${iccDiff.icc.toFixed(3)}`
  + `  (k = ${iccDiff.k}, N = ${iccDiff.N})`);
console.log('   นี่คือตัวที่กำหนด design effect ของการทดสอบแบบจับคู่ ไม่ใช่ ICC ในข้อ 1');

// ---------- 4. ขนาดตัวอย่าง ----------
console.log('\n4) จำนวนคู่ที่ต้องใช้ (McNemar — ตรงกับ test ที่ประกาศไว้)\n');
console.log('  สมมติฐานผลต่าง | pi01  | pi10  | คู่ (ไม่ปรับ) | คู่ (ปรับ cluster m=10)');
console.log('  ---------------+-------+-------+---------------+------------------------');
const scen = [
  ['สังเกตจริง', pi01, pi10],
  ['0.75→0.90', 0.02, 0.17],
  ['0.75→0.85', 0.03, 0.13],
];
for (const [label, a, d] of scen) {
  const r = requiredPairsMcNemar(a, d, { icc: iccDiff.icc, m: 10 });
  console.log(`  ${label.padEnd(14)} | ${a.toFixed(3)} | ${d.toFixed(3)} |`
    + ` ${String(Number.isFinite(r.pairs) ? r.pairs : '∞').padStart(13)} |`
    + ` ${String(Number.isFinite(r.pairsAdjusted) ? r.pairsAdjusted : '∞').padStart(23)}`);
}

const pT = [...rows[TREAT].values()].reduce((s, r) => s + (r[METRIC] ?? 0), 0) / rows[TREAT].size;
const pC = [...rows[CTRL].values()].reduce((s, r) => s + (r[METRIC] ?? 0), 0) / rows[CTRL].size;
const unpaired = requiredNPerArm(pT, pC);
console.log(`\n  เทียบ sensitivity แบบไม่จับคู่ (สูตรเดิม ${fmtPct(pC)} → ${fmtPct(pT)}):`
  + ` ${unpaired.raw} run/arm ดิบ, ${unpaired.adjusted} เมื่อคูณ DE=1.5`);
console.log('  สูตรเดิมทิ้งข้อมูลการจับคู่ → ใช้เป็นตัวเทียบเท่านั้น ไม่ใช่ตัวตัดสิน\n');

// ---------- 5. จัดสรร ----------
console.log('5) ทางเลือกการจัดสรรที่งบใกล้เคียงกัน (ICC ของผลต่างที่วัดได้)\n');
console.log('  k โจทย์ | m รอบ | run/arm |   DE | n_eff | เพดาน k/ICC');
console.log('  --------+-------+---------+------+-------+------------');
for (const [k, m] of [[11, 11], [11, 14], [14, 11], [16, 10], [16, 14]]) {
  const e = effectiveN(k, m, iccDiff.icc);
  console.log(`  ${String(k).padStart(7)} | ${String(m).padStart(5)} | ${String(k * m).padStart(7)} |`
    + ` ${e.de.toFixed(2).padStart(4)} | ${e.nEff.toFixed(0).padStart(5)} |`
    + ` ${Number.isFinite(e.ceiling) ? e.ceiling.toFixed(0) : '∞'}`);
}
console.log('');
