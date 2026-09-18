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
import { createHash } from 'node:crypto';
import { gradeRun } from '../src/graders.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/*
 * --scenarios: ให้คะแนนใหม่ด้วยชุดโจทย์ที่ระบุ ไม่ใช่ไฟล์ปัจจุบันเสมอไป
 *
 * ชุดโจทย์ถูกแก้ไประหว่างเตรียมชุดที่ 2 (ลดชั้นกฎ 11 ข้อ) การให้คะแนนชุดที่ 1 ใหม่
 * ด้วยไฟล์ปัจจุบันจะได้ตัวเลขคนละชุดกับที่รายงานไว้ โดยไม่มีอะไรเตือน
 * ชุดที่ใช้ตอนเก็บชุดที่ 1 แช่แข็งไว้ที่ evidence/study1-scenarios/
 */
const si = process.argv.indexOf('--scenarios');
const SCEN_DIR = path.resolve(ROOT, si !== -1 && process.argv[si + 1] ? process.argv[si + 1] : 'scenarios');
if (SCEN_DIR !== path.join(ROOT, 'scenarios')) console.log('  ใช้ชุดโจทย์จาก ' + path.relative(ROOT, SCEN_DIR));

/*
 * ปฏิเสธถ้าชุดโจทย์ไม่ตรงกับที่ตรึงไว้ตอนเก็บข้อมูล
 *
 * การให้คะแนนใหม่มีไว้ตอบว่า "ถ้าใช้ตัวตรวจฉบับนี้ ข้อมูลชุดเดิมจะได้คะแนนเท่าไร"
 * ถ้าโจทย์ก็เปลี่ยนไปด้วย คำตอบจะกลายเป็นของคนละการทดลอง โดยไม่มีอะไรบอก
 * manifest ตรึง sha256 ของทุกไฟล์โจทย์ไว้ตั้งแต่ run แรก จึงเทียบได้ตรง ๆ
 *
 * ข้ามได้ด้วย --allow-scenario-drift ซึ่งต้องพิมพ์เองและถูกบันทึกไว้ในผลลัพธ์
 */
/*
 * เทียบเนื้อหาโดยไม่นับรูปแบบการขึ้นบรรทัด
 *
 * digest ใน manifest คิดจากไบต์ดิบของไฟล์ตอนเก็บข้อมูล ซึ่งบนเครื่อง Windows
 * เป็น CRLF ส่วนไฟล์ที่ดึงออกจาก git มาแช่แข็งไว้เป็น LF เนื้อหาเหมือนกันทุกตัวอักษร
 * แต่ sha256 ต่างกัน ถ้าเทียบไบต์ตรง ๆ ชุดที่แช่แข็งไว้จะถูกปฏิเสธทั้งที่ถูกต้อง
 *
 * การขึ้นบรรทัดไม่เปลี่ยนผลการ parse JSON จึงไม่เปลี่ยนคะแนน การเทียบหลังทำให้
 * เป็นรูปแบบเดียวกันจึงตรงกับสิ่งที่ด่านนี้ต้องการตอบ คือ "กฎกับตัวตรวจชุดเดียวกันไหม"
 */
const CR_CH = String.fromCharCode(13);
const LF_CH = String.fromCharCode(10);
/* manifest เก็บ sha256 แบบตัด 16 ตัวแรก ไม่ใช่เต็ม — ต้องตัดให้ตรงกัน */
const sha = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);
/** ตรงกันไหม โดยยอมให้รูปแบบการขึ้นบรรทัดต่างกันได้ */
function contentMatches(raw, want) {
  const text = raw.toString('utf8');
  if (sha(raw) === want) return true;
  const lf = text.split(CR_CH + LF_CH).join(LF_CH);
  if (sha(lf) === want) return true;
  return sha(lf.split(LF_CH).join(CR_CH + LF_CH)) === want;
}

function assertScenarioSetMatches(outDir) {
  const mf = fs.existsSync(outDir)
    ? fs.readdirSync(outDir).find((f) => f.startsWith('manifest-')) : null;
  if (!mf) { console.log('  (ไม่พบ manifest — ข้ามการตรวจชุดโจทย์)'); return; }
  const files = JSON.parse(fs.readFileSync(path.join(outDir, mf), 'utf8')).experimentFiles ?? {};
  /*
   * เทียบเฉพาะไฟล์นิยามโจทย์ชั้นบนสุด ซึ่งเป็นไฟล์เดียวที่การให้คะแนนใหม่อ่านจริง
   *
   * ไฟล์ใน scenarios/acceptance/ มีผลตอนเก็บข้อมูล (เทสที่เอเจนต์มองไม่เห็น)
   * ไม่ใช่ตอนให้คะแนนใหม่ ความต่างของไฟล์พวกนั้นจึงไม่ทำให้คะแนนเพี้ยน
   * แต่ยังรายงานเป็นคำเตือน เพราะมันบอกว่าชุดข้อมูลกับ repo ไม่ตรงกันแล้ว
   */
  const isDefinition = (k) => k.startsWith("scenarios/") && !k.slice(11).includes("/") && k.endsWith(".json");
  const frozen = Object.entries(files).filter(([k]) => isDefinition(k));
  const others = Object.entries(files).filter(([k]) => k.startsWith('scenarios/') && !isDefinition(k));
  const otherDrift = others.filter(([rel, want]) => {
    const here = path.join(ROOT, rel);
    if (!fs.existsSync(here)) return true;
    return !contentMatches(fs.readFileSync(here), want);
  });
  if (otherDrift.length) {
    console.log(`  ⚠️  ไฟล์ประกอบของโจทย์ต่างจากที่ตรึงไว้ ${otherDrift.length} ไฟล์ (เทสยอมรับ/เฉลย)`);
    console.log('     ไม่กระทบการให้คะแนนใหม่ แต่แปลว่า repo ไม่ตรงกับตอนเก็บข้อมูลแล้ว');
  }
  const drift = [];
  for (const [rel, want] of frozen) {
    const here = path.join(SCEN_DIR, path.basename(rel));
    if (!fs.existsSync(here)) { drift.push(rel + ' — ไม่มีในชุดที่เลือก'); continue; }
    const raw = fs.readFileSync(here);
    if (!contentMatches(raw, want)) drift.push(rel);
  }
  if (!drift.length) { console.log(`  ชุดโจทย์ตรงกับที่ตรึงไว้ครบ ${frozen.length} ไฟล์`); return; }
  if (process.argv.includes('--allow-scenario-drift')) {
    console.log(`  ⚠️  ชุดโจทย์ต่างจากที่ตรึงไว้ ${drift.length} ไฟล์ แต่สั่ง --allow-scenario-drift ไว้`);
    for (const d of drift) console.log(`     · ${d}`);
    return;
  }
  console.error(`${String.fromCharCode(10)}⛔ ชุดโจทย์ไม่ตรงกับที่ตรึงไว้ตอนเก็บข้อมูล ${drift.length} ไฟล์`);
  for (const d of drift) console.error(`   · ${d}`);
  console.error('   ให้คะแนนใหม่ด้วยชุดที่แช่แข็งไว้: --scenarios evidence/study1-scenarios');
  console.error('   หรือยืนยันว่าตั้งใจ: --allow-scenario-drift' + String.fromCharCode(10));
  process.exit(2);
}
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
assertScenarioSetMatches(path.dirname(gradedPath));

const scenarios = Object.fromEntries(
  fs.readdirSync(SCEN_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const s = JSON.parse(fs.readFileSync(path.join(SCEN_DIR, f), 'utf8'));
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
