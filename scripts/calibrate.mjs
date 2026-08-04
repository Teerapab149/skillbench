/**
 * calibrate.mjs — ตรวจว่าโจทย์ยากพอดีหรือไม่ ก่อนเก็บข้อมูลจริง
 *
 * ความเสี่ยงอันดับหนึ่งของงานนี้คือ ceiling effect: ถ้าโจทย์ง่ายเกินไป
 * A1 จะได้เกือบ 100% แล้วจะไม่เห็นความต่างระหว่าง arm เลย การทดลองพัง
 *
 * หลักการเดียวกับการออกข้อสอบ (item difficulty) — ข้อที่ทุกคนทำถูกหมด
 * แยกคนเก่งกับคนอ่อนไม่ได้
 *
 * วิธีใช้ (ประมาณ 55 runs ใช้เวลาไม่ถึงครึ่งวัน แต่กันทั้งโปรเจกต์ไม่ให้พัง):
 *
 *   node src/runner.mjs --adapter claude-cli --arms A1 --reps 5
 *   node scripts/calibrate.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wilson, fmtPct } from '../src/stats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(ROOT, 'results/latest.json');

if (!fs.existsSync(file)) {
  console.error('ไม่พบ results/latest.json — รัน runner ก่อน');
  process.exit(1);
}

const { meta, graded } = JSON.parse(fs.readFileSync(file, 'utf8'));

/** arm ที่ใช้เทียบ ควรเป็น control ที่แข็งที่สุดที่มีอยู่ */
const REF = ['A1', 'A0', meta.arms[0]].find((a) => meta.arms.includes(a));
const rows = graded.filter((g) => g.armId === REF);

console.log('\n=== Item Difficulty Calibration ===\n');
if (meta.simulated) {
  console.log('  [SIMULATION] ข้อมูลชุดนี้มาจาก mock — ผลที่ได้ใช้ตัดสินความยากจริงไม่ได้');
  console.log('  ต้องรันด้วย --adapter claude-cli เท่านั้น\n');
}
console.log(`  arm อ้างอิง: ${REF} | repetition: ${meta.reps} | โจทย์: ${meta.scenarios.length}\n`);

const ZONES = [
  { max: 0.15, label: 'ยากเกิน (floor)', action: 'ลดความยาก หรือตรวจว่า checker เขียนผิด' },
  { max: 0.30, label: 'ค่อนข้างยาก', action: 'ใช้ได้ แต่จับตาดู' },
  { max: 0.70, label: 'โซนที่ต้องการ', action: 'เก็บไว้' },
  { max: 0.85, label: 'ค่อนข้างง่าย', action: 'ใช้ได้ แต่จับตาดู' },
  { max: 1.01, label: 'ง่ายเกิน (ceiling)', action: 'เพิ่มกับดัก หรือทิ้ง' },
];
const zoneOf = (p) => ZONES.find((z) => p < z.max);

let bad = 0;
const perScenario = [];

/**
 * ดัชนีความยากใช้ RCR (สัดส่วนกฎที่ผ่าน) ไม่ใช่ CRIT (ผ่านครบทุกข้อ)
 *
 * เหตุผล: CRIT ต้องผ่านกฎวิกฤต 5-7 ข้อพร้อมกัน ความน่าจะเป็นจึงทบกันจนตกพื้น
 * แม้เอเจนต์จะทำได้ดีรายข้อ ทำให้แยกไม่ออกว่าโจทย์ยากจริงหรือแค่มีกฎเยอะ
 * RCR เป็นค่าต่อเนื่อง จึงสะท้อนความยากของโจทย์ได้ตรงกว่า
 * และตรงกับ primary endpoint ที่ประกาศไว้ใน config/arms.json ด้วย
 */
for (const sid of meta.scenarios) {
  const rs = rows.filter((g) => g.scenarioId === sid);
  if (!rs.length) continue;
  const allRules = rs.flatMap((g) => g.rules);
  const ci = wilson(allRules.filter((r) => r.passed).length, allRules.length);
  const crit = rs.filter((g) => g.CRIT === 1).length / rs.length;
  const z = zoneOf(ci.p);
  const ok = ci.p >= 0.15 && ci.p <= 0.85;
  if (!ok) bad++;
  perScenario.push({ sid, family: rs[0].family, p: ci.p, lo: ci.lo, hi: ci.hi, crit, n: rs.length, zone: z, ok });
}

perScenario.sort((a, b) => a.p - b.p);

console.log('  scenario                  family                 p (RCR)   95% CI            CRIT    สถานะ');
console.log('  ' + '-'.repeat(100));
for (const s of perScenario) {
  console.log(
    `  ${s.sid.padEnd(25)} ${String(s.family).padEnd(22)} ${fmtPct(s.p).padStart(7)}  ` +
    `[${fmtPct(s.lo).padStart(6)}, ${fmtPct(s.hi).padStart(6)}]  ${fmtPct(s.crit).padStart(6)}  ${s.ok ? '  ' : '! '}${s.zone.label}`,
  );
}

console.log('');
if (bad) {
  console.log(`  ต้องแก้ ${bad} โจทย์ก่อนเก็บข้อมูลจริง:\n`);
  for (const s of perScenario.filter((x) => !x.ok)) {
    console.log(`    ${s.sid}  ->  ${s.zone.action}`);
  }
} else {
  console.log('  ทุกโจทย์อยู่ในช่วงที่ใช้งานได้ (0.15–0.85) พร้อมเก็บข้อมูลจริง');
}

console.log('');
console.log('  หมายเหตุ: CI ยังกว้างมากที่ 5 repetition — ใช้ตัดโจทย์ที่ "ชัดว่าพัง" เท่านั้น');
console.log('  อย่าใช้ตัวเลขจากขั้นนี้ไปสรุปผลการทดลอง\n');

// เตือนกฎที่ไม่แยกแยะอะไรเลย
const ruleStat = new Map();
for (const g of rows) {
  for (const r of g.rules) {
    const k = `${g.scenarioId}/${r.id}`;
    if (!ruleStat.has(k)) ruleStat.set(k, { pass: 0, n: 0 });
    const s = ruleStat.get(k); s.n++; if (r.passed) s.pass++;
  }
}
const never = [...ruleStat.entries()].filter(([, v]) => v.pass === 0).map(([k]) => k);
const always = [...ruleStat.entries()].filter(([, v]) => v.pass === v.n).map(([k]) => k);

if (never.length) {
  console.log(`  กฎที่ ${REF} ตกทุกครั้ง (${never.length} ข้อ) — ตรวจว่า checker เขียนถูกไหม:`);
  for (const k of never) console.log(`    ${k}`);
  console.log('');
}
if (always.length) {
  console.log(`  กฎที่ ${REF} ผ่านทุกครั้ง (${always.length} ข้อ) — อาจง่ายเกินจนไม่แยกแยะอะไร:`);
  for (const k of always) console.log(`    ${k}`);
  console.log('');
}
