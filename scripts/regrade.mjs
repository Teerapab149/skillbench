/**
 * regrade.mjs — ให้คะแนน artifact ใหม่ทั้งชุดด้วยตัวตรวจฉบับปัจจุบัน แล้วเทียบกับคะแนนเดิม
 *
 * ทำไมต้องมี:
 *   คะแนนของแต่ละ run ถูกคำนวณ "ตอนที่ run นั้นจบ" ซึ่งอาจห่างกันหลายวัน
 *   ถ้าตัวตรวจถูกแก้ระหว่างนั้น ชุดข้อมูลจะมีคะแนนที่มาจากเกณฑ์คนละฉบับปนกัน
 *   โดยไม่มีอะไรเตือน และไม่มีใครรู้ตอนอ่านรายงาน
 *
 *   README เคลมว่า "รันตัวตรวจซ้ำกับ artifact เดิม ต้องได้ผลเดิมเสมอ 100% (re-gradable)"
 *   ไฟล์นี้คือตัวพิสูจน์คำเคลมนั้น ไม่ใช่แค่เขียนไว้เฉยๆ
 *
 * ผลลัพธ์ที่ต้องการคือ "ไม่มีอะไรต่าง" ถ้าต่างแปลว่าอย่างใดอย่างหนึ่ง:
 *   - ตัวตรวจถูกแก้หลังเก็บข้อมูลไปแล้วบางส่วน -> ต้องใช้คะแนนชุดใหม่ทั้งหมด และเขียนในเล่มว่าแก้อะไร
 *   - ตัวตรวจมีความไม่แน่นอน (อ่านเวลา สุ่ม ฯลฯ) -> เป็นบั๊ก ต้องแก้ก่อนใช้ผล
 *
 *   node scripts/regrade.mjs                      # เทียบกับ results/latest.json
 *   node scripts/regrade.mjs --write              # เขียนคะแนนชุดใหม่ทับ latest.json
 *   node scripts/regrade.mjs --file results/graded-....json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gradeRun } from '../src/graders.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');

const fileArg = (() => {
  const i = process.argv.indexOf('--file');
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : 'results/latest.json';
})();

const gradedPath = path.join(ROOT, fileArg);
if (!fs.existsSync(gradedPath)) {
  console.error(`ไม่พบ ${fileArg} — รัน runner ก่อน`);
  process.exit(1);
}
const { meta, graded } = JSON.parse(fs.readFileSync(gradedPath, 'utf8'));

// artifact ดิบอยู่คนละไฟล์ ต้องหาคู่ที่ตรงกับ stamp เดียวกัน
const artPath = path.join(ROOT, 'results', `artifacts-${meta.stamp}.json`);
if (!fs.existsSync(artPath)) {
  console.error(`ไม่พบ artifacts-${meta.stamp}.json — ให้คะแนนใหม่ไม่ได้ถ้าไม่มีข้อมูลดิบ`);
  process.exit(1);
}
const artifacts = JSON.parse(fs.readFileSync(artPath, 'utf8'));

const scenarios = Object.fromEntries(
  fs.readdirSync(path.join(ROOT, 'scenarios'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const s = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenarios', f), 'utf8'));
      return [s.id, s];
    }));

console.log('\n=== ให้คะแนนใหม่ด้วยตัวตรวจฉบับปัจจุบัน ===\n');
console.log(`ข้อมูล: ${fileArg} (เก็บเมื่อ ${meta.stamp}, adapter ${meta.adapter})`);
console.log(`artifact: ${artifacts.length} run\n`);

const fresh = [];
const diffs = [];

for (const a of artifacts) {
  const sc = scenarios[a.scenarioId];
  if (!sc) { console.log(`  ข้าม ${a.runId} — ไม่พบ scenario ${a.scenarioId}`); continue; }
  const g = gradeRun(a, sc);
  fresh.push(g);

  const old = graded.find((x) => x.runId === a.runId);
  if (!old) { diffs.push({ runId: a.runId, what: 'ไม่มีคะแนนเดิม' }); continue; }

  for (const r of g.rules) {
    const o = old.rules.find((x) => x.id === r.id);
    if (!o) { diffs.push({ runId: a.runId, what: `กฎ ${r.id} เป็นกฎใหม่ ไม่มีในคะแนนเดิม` }); continue; }
    if (o.passed !== r.passed) {
      diffs.push({ runId: a.runId, what: `กฎ ${r.id}: เดิม ${o.passed ? 'ผ่าน' : 'ตก'} -> ใหม่ ${r.passed ? 'ผ่าน' : 'ตก'}` });
    }
  }
  for (const m of ['RCR', 'FULL', 'CRIT', 'SCOPE', 'TASK']) {
    if (Math.abs((old[m] ?? 0) - (g[m] ?? 0)) > 1e-9) {
      diffs.push({ runId: a.runId, what: `${m}: ${old[m]} -> ${g[m]}` });
    }
  }
}

if (!diffs.length) {
  console.log(`ไม่มีความต่างเลย — คะแนนทั้ง ${fresh.length} run มาจากเกณฑ์ฉบับเดียวกัน`);
  console.log('ยืนยันคำเคลมเรื่อง re-gradable ใน README ได้\n');
} else {
  console.log(`พบความต่าง ${diffs.length} จุด จาก ${fresh.length} run\n`);
  const byRun = {};
  for (const d of diffs) (byRun[d.runId] ??= []).push(d.what);
  for (const [runId, list] of Object.entries(byRun).slice(0, 30)) {
    console.log(`  ${runId}`);
    for (const w of list) console.log(`     ${w}`);
  }
  if (Object.keys(byRun).length > 30) console.log(`  ... และอีก ${Object.keys(byRun).length - 30} run`);
  console.log('\nแปลว่าตัวตรวจถูกแก้หลังเก็บข้อมูลไปแล้วบางส่วน');
  console.log('ต้องใช้คะแนนชุดใหม่ทั้งหมด (--write) และเขียนในเล่มว่าแก้อะไรเมื่อไหร่\n');
}

if (write) {
  fs.writeFileSync(gradedPath, JSON.stringify({ meta: { ...meta, regradedAt: new Date().toISOString() }, graded: fresh }, null, 2));
  console.log(`เขียนคะแนนชุดใหม่ทับ ${fileArg} แล้ว — รัน node src/analyze.mjs ต่อ\n`);
} else if (diffs.length) {
  console.log('เพิ่ม --write เพื่อเขียนคะแนนชุดใหม่ทับ\n');
}

process.exit(0);
