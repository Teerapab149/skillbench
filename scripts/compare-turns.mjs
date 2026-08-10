/**
 * compare-turns.mjs — เทียบการใช้ turn ระหว่าง arm เพื่อตรวจว่าเพดาน turn เป็นตัวแปรกวนหรือไม่
 *
 * คำถามที่ต้องตอบ: A2 ใช้ turn มากกว่า A1 อย่างเป็นระบบหรือไม่
 *
 *   ถ้า "ใช่"  -> เพดาน --max-turns เป็นตัวแปรที่ผูกกับกลุ่มทดลอง ต้องขึ้นเพดานให้ทุก arm
 *                 แล้วรัน calibration ใหม่ มิฉะนั้นการตัด run ที่ error ทิ้งจะเลือกตัดเฉพาะ
 *                 run ที่ A2 ทำงานละเอียดที่สุด แล้วดันผลไปทาง "ไม่ต่างกัน"
 *   ถ้า "ไม่"  -> ปัญหาหายไปเอง ใช้เพดานเดิมต่อได้
 *
 * เทียบเฉพาะโจทย์ที่มีทั้งสอง arm (จับคู่รายโจทย์) เพราะความยากของโจทย์
 * เป็นตัวกำหนดจำนวน turn มากกว่า arm — เทียบค่าเฉลี่ยรวมจะถูกกลบด้วยส่วนผสมของโจทย์
 *
 *   node scripts/compare-turns.mjs [--arms A2,A1]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RES = path.join(ROOT, 'results');
const argv = (f, d) => { const i = process.argv.indexOf(f); return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const [TREAT, CTRL] = argv('--arms', 'A2,A1').split(',');

const load = (f) => { try { return JSON.parse(fs.readFileSync(path.join(RES, f), 'utf8')); } catch { return null; } };
const listOf = (d) => (Array.isArray(d) ? d : d?.artifacts ?? d?.graded ?? []);

/** ดึงเฉพาะ run จริง พร้อม turn ที่ใช้และผลว่าชนเพดานไหม */
const runs = new Map();          // armId -> Map(scenarioId#rep -> {turns, capped, cap})
for (const f of fs.readdirSync(RES).filter((x) => /^artifacts-.*\.json$/.test(x)).sort()) {
  for (const a of listOf(load(f))) {
    if (a.simulated !== false || a.adapter === 'mock') continue;
    const last = (a.rawEvents ?? []).find((e) => e.type === 'result')
      ?? (a.rawEvents ?? [])[(a.rawEvents ?? []).length - 1] ?? {};
    if (!last.num_turns) continue;
    const m = runs.get(a.armId) ?? new Map();
    m.set(`${a.scenarioId}#${a.repIndex}`, {
      scenarioId: a.scenarioId,
      turns: last.num_turns,
      capped: last.subtype === 'error_max_turns',
      cap: a.control?.maxTurns ?? null,
    });
    runs.set(a.armId, m);
  }
}

if (!runs.get(TREAT) || !runs.get(CTRL)) {
  console.error(`\nยังไม่มีข้อมูลจริงของ ${!runs.get(TREAT) ? TREAT : CTRL} — รัน runner ก่อน\n`);
  process.exit(1);
}

const summarize = (arm) => {
  const v = [...runs.get(arm).values()];
  const t = v.map((x) => x.turns).sort((a, b) => a - b);
  return {
    n: v.length, med: t[Math.floor(t.length / 2)], max: t[t.length - 1],
    capped: v.filter((x) => x.capped).length,
    caps: [...new Set(v.map((x) => x.cap))].join('/'),
  };
};

console.log('\nเทียบการใช้ turn — ตรวจว่าเพดาน turn เป็นตัวแปรกวนหรือไม่\n');
console.log('  arm |  n | median | max | ชนเพดาน | เพดานที่ใช้');
console.log('  ----+----+--------+-----+---------+------------');
for (const arm of [CTRL, TREAT]) {
  const s = summarize(arm);
  console.log(`  ${arm.padEnd(3)} | ${String(s.n).padStart(2)} | ${String(s.med).padStart(6)} |`
    + ` ${String(s.max).padStart(3)} | ${String(s.capped).padStart(7)} | ${s.caps}`);
}

/*
 * เทียบรายโจทย์ ใช้ค่ามัธยฐานของ turn ในโจทย์นั้นของแต่ละ arm
 * แล้วนับว่า TREAT สูงกว่ากี่โจทย์ — เป็น sign test อย่างง่ายที่ไม่ต้องสมมติการแจกแจง
 */
const scen = [...new Set([...runs.get(CTRL).values()].map((x) => x.scenarioId))].sort();
const med = (arm, sid) => {
  const t = [...runs.get(arm).values()].filter((x) => x.scenarioId === sid).map((x) => x.turns).sort((a, b) => a - b);
  return t.length ? t[Math.floor(t.length / 2)] : null;
};

console.log(`\nเทียบรายโจทย์ (มัธยฐาน turn)\n`);
console.log(`  โจทย์                      | ${CTRL.padStart(4)} | ${TREAT.padStart(4)} | ผลต่าง`);
console.log('  ---------------------------+------+------+-------');
let hi = 0, lo = 0, paired = 0;
for (const sid of scen) {
  const a = med(CTRL, sid), b = med(TREAT, sid);
  if (a == null || b == null) continue;
  paired++; if (b > a) hi++; else if (b < a) lo++;
  const d = b - a;
  console.log(`  ${sid.padEnd(26)} | ${String(a).padStart(4)} | ${String(b).padStart(4)} | ${(d > 0 ? '+' : '') + d}`);
}

console.log(`\n  ${TREAT} ใช้ turn มากกว่าใน ${hi} จาก ${paired} โจทย์ (น้อยกว่า ${lo})`);

/*
 * สถิติที่ใช้ตัดสินคือ "อัตราการชนเพดาน" ไม่ใช่ค่ามัธยฐาน turn
 *
 * เพราะกลไกของอคติคือการที่ run ที่ชนเพดานถูกตัดออกก่อนวิเคราะห์
 * ค่ามัธยฐานของ turn เป็นเพียงสาเหตุเบื้องหลัง ไม่ใช่ตัวความเสียหาย
 * และ sign test บนโจทย์ไม่กี่ข้อมี power ต่ำเกินกว่าจะตัดสินอะไรได้
 */
const lgam = (n) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
const lchoose = (n, k) => lgam(n) - lgam(k) - lgam(n - k);
function fisherExact(a, b, c, d) {
  const N = a + b + c + d, row1 = a + b, col1 = a + c;
  const obs = Math.exp(lchoose(col1, a) + lchoose(N - col1, b) - lchoose(N, row1));
  let p = 0;
  for (let i = Math.max(0, row1 - (N - col1)); i <= Math.min(row1, col1); i++) {
    const pi = Math.exp(lchoose(col1, i) + lchoose(N - col1, row1 - i) - lchoose(N, row1));
    if (pi <= obs * 1.000001) p += pi;
  }
  return Math.min(1, p);
}

/** เทียบอัตราชนเพดานเฉพาะ run ที่รันภายใต้เพดานเดียวกันเท่านั้น */
const atCap = (arm, cap) => [...runs.get(arm).values()].filter((x) => x.cap === cap);
const capsShared = [...new Set([...runs.get(CTRL).values()].map((x) => x.cap))]
  .filter((cap) => atCap(TREAT, cap).length);

console.log('\nอัตราการชนเพดาน — สถิติที่ใช้ตัดสิน\n');
for (const cap of capsShared) {
  const t = atCap(TREAT, cap), c = atCap(CTRL, cap);
  const tc = t.filter((x) => x.capped).length, cc = c.filter((x) => x.capped).length;
  const pf = fisherExact(tc, t.length - tc, cc, c.length - cc);
  console.log(`  ที่เพดาน ${cap}:  ${CTRL} ${cc}/${c.length} (${(100 * cc / c.length).toFixed(1)}%)`
    + `  vs  ${TREAT} ${tc}/${t.length} (${(100 * tc / t.length).toFixed(1)}%)`
    + `  — Fisher exact p = ${pf < 0.001 ? '<0.001' : pf.toFixed(4)}`);
}
for (const cap of [...new Set([...runs.get(TREAT).values()].map((x) => x.cap))].filter((c) => !capsShared.includes(c))) {
  const t = atCap(TREAT, cap);
  console.log(`  ที่เพดาน ${cap}:  ${TREAT} ${t.filter((x) => x.capped).length}/${t.length}`
    + ` (turn ที่ใช้: ${t.map((x) => x.turns).sort((a, b) => a - b).join(', ')})`
    + ` — ยังไม่มีข้อมูล ${CTRL} ที่เพดานนี้`);
}

/** sign test แบบสองด้าน — จับคู่รายโจทย์ ไม่สมมติการแจกแจง */
const lc = (n, k) => { let s = 0; for (let i = 0; i < k; i++) s += Math.log(n - i) - Math.log(i + 1); return s; };
const nEff = hi + lo;
let cdf = 0;
for (let i = 0; i <= Math.min(hi, lo); i++) cdf += Math.exp(lc(nEff, i) + nEff * Math.log(0.5));
const p = Math.min(1, 2 * cdf);
console.log(`  sign test สองด้าน: p = ${p < 0.001 ? '<0.001' : p.toFixed(4)}  (n = ${nEff} โจทย์ที่ต่างกัน)`);

console.log(`\n  อ่านผล:`);
console.log(`    p < 0.05 และ ${TREAT} สูงกว่า -> เพดานผูกกับกลุ่มทดลอง ต้องขึ้นเพดานทุก arm แล้วรัน calibration ใหม่`);
console.log(`    p >= 0.05                      -> ยังไม่มีหลักฐานว่าต่างกันเชิงระบบ ใช้เพดานเดิมต่อได้`);
console.log(`    หมายเหตุ: ${CTRL} เก็บที่เพดาน 25 การชนเพดานทำให้ค่า turn ของ ${CTRL} ถูกตัดยอด`);
console.log(`    ผลต่างที่วัดได้จึงเป็นค่า "ต่ำกว่าความจริง" ไม่ใช่สูงเกินจริง\n`);
