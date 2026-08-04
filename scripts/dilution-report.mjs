/**
 * dilution-report.mjs — สร้างเส้นโค้ง Rule Dilution
 *
 * ตอบคำถาม: กฎที่โหลดพร้อมกันมากขึ้น ทำให้กฎเป้าหมายถูกละเลยมากขึ้นหรือไม่
 *
 * ผลลัพธ์: results/dilution.md — ตาราง + กราฟ ASCII + การทดสอบแนวโน้ม
 *
 *   node scripts/dilution-report.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wilson, fmtPct, fmtP, normCdf } from '../src/stats.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { meta, graded } = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/latest.json'), 'utf8'));

if (!meta.arms.some((a) => a.startsWith('D'))) {
  console.error('ผลล่าสุดไม่ใช่การทดลอง dilution — รัน runner ด้วย --config config/dilution.json ก่อน');
  process.exit(1);
}

const levels = meta.arms
  .filter((a) => /^D\d+$/.test(a))
  .map((a) => ({ arm: a, n: Number(a.slice(1)) }))
  .sort((a, b) => a.n - b.n);

/** วัดที่ "กฎเป้าหมาย" เท่านั้น — กฎกลุ่ม IM (ผลกระทบย้อนหลัง) */
function targetRuleStats(armId) {
  const rows = graded.filter((g) => g.armId === armId);
  const rules = rows.flatMap((g) => g.rules.filter((r) => r.id.startsWith('IM')));
  const passes = rules.filter((r) => r.passed).length;
  const ci = wilson(passes, rules.length);
  return { p: ci.p, lo: ci.lo, hi: ci.hi, nRules: rules.length, passes };
}

const points = levels.map((l) => ({ ...l, ...targetRuleStats(l.arm) }));

/**
 * Cochran–Armitage trend test — ทดสอบว่ามีแนวโน้มเชิงเส้นจริงหรือเป็นแค่ความบังเอิญ
 *
 * ใช้ตัวทดสอบแนวโน้มแทนการเทียบหัวท้าย เพราะเราสนใจ "ความสัมพันธ์ตามปริมาณ"
 * ไม่ใช่แค่ "ปลายสองข้างต่างกัน" — ซึ่งเป็นสิ่งที่ทำให้เส้นโค้งมีน้ำหนักกว่าการเทียบสองกลุ่ม
 */
function trendTest(pts) {
  const N = pts.reduce((s, p) => s + p.n_, 0);
  const R = pts.reduce((s, p) => s + p.k, 0);
  if (!N || !R || R === N) return { z: NaN, p: NaN };
  const pbar = R / N;
  const T = pts.reduce((s, p) => s + p.dose * p.k, 0);
  const ET = pbar * pts.reduce((s, p) => s + p.dose * p.n_, 0);
  const sumWx = pts.reduce((s, p) => s + p.n_ * p.dose, 0);
  const sumWx2 = pts.reduce((s, p) => s + p.n_ * p.dose * p.dose, 0);
  const varT = pbar * (1 - pbar) * (sumWx2 - (sumWx * sumWx) / N);
  if (varT <= 0) return { z: NaN, p: NaN };
  const z = (T - ET) / Math.sqrt(varT);
  return { z, p: 2 * (1 - normCdf(Math.abs(z))) };
}

const trend = trendTest(points.map((p) => ({ dose: p.n, n_: p.nRules, k: p.passes })));

const L = [];
const say = (s = '') => L.push(s);

say('# Rule Dilution — กฎเจือจางกันเองหรือไม่');
say('');
if (meta.simulated) {
  say('> **คำเตือน: ข้อมูลจาก mock adapter — ตัวเลขเป็นของปลอม ห้ามใส่รายงาน**');
  say('');
}
say(`- เวลา: ${meta.stamp} | adapter: \`${meta.adapter}\` | repetition: ${meta.reps}`);
say(`- โจทย์ที่ใช้: ${meta.scenarios.join(', ')}`);
say('- วัดเฉพาะ **กฎเป้าหมาย** (กลุ่ม IM — การประเมินผลกระทบย้อนหลัง) ซึ่งเหมือนกันเป๊ะทุก arm');
say('');

say('## ผล');
say('');
say('| จำนวนกฎที่โหลดพร้อมกัน | อัตราทำตามกฎเป้าหมาย | 95% CI | n (กฎที่ตรวจ) |');
say('|---:|---|---|---:|');
for (const p of points) {
  say(`| ${p.n + 1} | ${fmtPct(p.p)} | [${fmtPct(p.lo)}, ${fmtPct(p.hi)}] | ${p.nRules} |`);
}
say('');

say('## เส้นโค้ง');
say('');
say('```');
const H = 12;
const maxP = 1;
for (let row = H; row >= 0; row--) {
  const val = (row / H) * maxP;
  let line = `${String(Math.round(val * 100)).padStart(4)}% |`;
  for (const p of points) {
    const cell = Math.abs(p.p - val) < maxP / (H * 2) ? '  ●  ' : '     ';
    line += cell + '  ';
  }
  say(line);
}
say('      +' + '-'.repeat(points.length * 7));
say('       ' + points.map((p) => String(p.n + 1).padStart(4) + '   ').join(''));
say('       ' + ' '.repeat(points.length * 3) + 'จำนวนกฎที่โหลดพร้อมกัน');
say('```');
say('');

say('## การทดสอบแนวโน้ม (Cochran–Armitage)');
say('');
if (Number.isFinite(trend.p)) {
  say(`z = ${trend.z.toFixed(3)} | p = ${fmtP(trend.p)}`);
  say('');
  const first = points[0].p, last = points[points.length - 1].p;
  if (trend.p < 0.05 && last < first) {
    say(`**พบแนวโน้มลดลงอย่างมีนัยสำคัญ** — จาก ${fmtPct(first)} ที่กฎ ${points[0].n + 1} ข้อ`);
    say(`เหลือ ${fmtPct(last)} ที่กฎ ${points[points.length - 1].n + 1} ข้อ`);
    say('');
    say('> นี่คือหลักฐานเชิงกลไกว่าทำไม progressive disclosure ถึงได้ผล');
    say('> ไม่ใช่เพราะ skill วิเศษ แต่เพราะกฎที่โหลดพร้อมกันน้อยกว่า ถูกทำตามมากกว่า');
    say('> และแปลว่าการเขียนไฟล์กฎยาวๆ ทำร้ายกฎที่สำคัญที่สุดของตัวเอง');
  } else if (trend.p >= 0.05) {
    say('**ไม่พบแนวโน้มที่มีนัยสำคัญ** — จำนวนกฎที่โหลดพร้อมกันไม่ได้ทำให้กฎเป้าหมายถูกละเลย');
    say('');
    say('> ข้อสรุปนี้มีค่าเท่ากัน: มันแปลว่าข้อได้เปรียบของ skill ไม่ได้มาจากการลดจำนวนกฎ');
    say('> ต้องหาคำอธิบายอื่น เช่น จังหวะการโหลด หรือความใกล้ของกฎกับงานตรงหน้า');
  } else {
    say('**พบแนวโน้มเพิ่มขึ้น** — ผลตรงข้ามกับสมมติฐาน ต้องตรวจสอบการออกแบบก่อนตีความ');
  }
} else {
  say('ข้อมูลไม่พอสำหรับทดสอบแนวโน้ม');
}
say('');
say('> ใช้ตัวทดสอบแนวโน้มแทนการเทียบหัวท้าย เพราะสิ่งที่ต้องการแสดงคือ');
say('> **ความสัมพันธ์ตามปริมาณ** ไม่ใช่แค่ "ปลายสองข้างต่างกัน" ซึ่งอธิบายด้วยความบังเอิญได้ง่ายกว่า');

const out = path.join(ROOT, 'results/dilution.md');
fs.writeFileSync(out, L.join('\n'));
console.log(L.join('\n'));
console.log(`\n[เขียนแล้ว] results/dilution.md\n`);
