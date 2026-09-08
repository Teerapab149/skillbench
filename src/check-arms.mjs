/**
 * check-arms.mjs — ตรวจความถูกต้องของการออกแบบการทดลอง "ก่อน" เก็บข้อมูล
 *
 * ต้องรันแล้วผ่านทุกข้อ ก่อนจะเริ่มเผาเงินค่า API
 * ถ้าข้อไหนไม่ผ่านแล้วยังเก็บข้อมูลต่อ ผลที่ได้จะถูกโต้แย้งได้ในวันนำเสนอ
 *
 *   node src/check-arms.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyInstall } from './install-arm.mjs';
import { refuseIfCollecting } from '../scripts/collection-guard.mjs';
import { lockFixtureForProcess } from './fixture-lock.mjs';
import { estimateTokens, frontmatterBody } from './text-metrics.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ข้อ 5 ของสคริปต์นี้ติดตั้ง arm ลง fixture จริง ห้ามชนกับการเก็บข้อมูลที่กำลังเดินอยู่
//
// refuseIfCollecting อ่าน mtime ของ checkpoint แล้วเดา — เห็นเฉพาะการเก็บข้อมูล
// และมีช่องว่างระหว่างตรวจกับลงมือเสมอ ส่วนล็อกบรรทัดถัดไปกันการชนจริง และเห็น
// เครื่องมือด้วยกันเองด้วย (check กับ check:acceptance ไม่มีตัวไหนเขียน checkpoint)
// เก็บไว้ทั้งคู่ เพราะข้อความของตัวแรกบอกสาเหตุได้ตรงกว่าเมื่อชนกับการเก็บข้อมูล
refuseIfCollecting(ROOT, 'check-arms');
lockFixtureForProcess(path.join(ROOT, 'fixtures/gpu-booking'), 'check-arms');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/arms.json'), 'utf8'));

/** ประมาณจำนวน token แบบหยาบ — ไทยราว 1 token ต่อ 2 อักขระ, อังกฤษราว 1 ต่อ 4 */
function estTokens(text) {
  return estimateTokens(text);
}

/**
 * แยก 2 ตัวเลขที่ไม่เหมือนกัน และเป็นหัวใจของข้อโต้แย้งเรื่อง progressive disclosure:
 *   always = สิ่งที่อยู่ใน context ทุก request ไม่ว่างานจะเป็นอะไร  <- ตัวที่ต้องจับคู่กับ placebo
 *   full   = ถ้า skill ถูกโหลดครบทุกตัวพร้อมกัน (worst case)
 * สำหรับ skill: context ที่กินตลอดคือ frontmatter description เท่านั้น ตัว body โหลดเมื่อถูก trigger
 */
function armText(arm) {
  let always = '', full = '';
  const alwaysParts = [], fullParts = [];
  for (const f of arm.contextFiles ?? []) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) {
      const body = fs.readFileSync(p, 'utf8');
      alwaysParts.push(body); fullParts.push(body);
      always += body + '\n'; full += body + '\n';
    }
  }
  if (arm.skillsDir) {
    const dir = path.join(ROOT, arm.skillsDir);
    if (fs.existsSync(dir)) {
      for (const d of fs.readdirSync(dir)) {
        const p = path.join(dir, d, 'SKILL.md');
        if (!fs.existsSync(p)) continue;
        const body = fs.readFileSync(p, 'utf8');
        fullParts.push(body);
        full += body + '\n';
        const frontmatter = frontmatterBody(body) ?? '';
        alwaysParts.push(frontmatter);
        always += frontmatter + '\n';   // เฉพาะ name+description
      }
    }
  }
  return { always, full, alwaysParts, fullParts };
}

/*
 * กฎฉบับกลางย้ายไป config/rules-canonical.json แล้ว — เลิกใช้ RULE_CONCEPTS เดิม
 *
 * ทำไมต้องเปลี่ยน: ของเดิมตรวจด้วย "คำสำคัญ" ไม่ใช่ "ข้อผูกพัน" ตัวอย่างที่ทำให้พังจริง
 * คือ regex /acceptance criteria/i ซึ่งเจอทั้ง A1 และ A2 จึงขึ้น PASS มาตลอด
 * ทั้งที่ A2 มีข้อผูกพันเพิ่มอีกสองข้อที่ A1 ไม่มีเลย — "แปลง AC เป็นเทสก่อนแตะ
 * implementation" และ "รันเทสต้องตกก่อน" ผลคือการเปรียบเทียบกลายเป็น
 * "กฎเยอะกว่า" ปนกับ "วางกฎคนละที่" ซึ่งเป็นคนละคำถามกับที่งานนี้ถาม
 *
 * ตรวจพบ 4 ก.ย. 2569 · ตระกูลเดียวกับเคส LINE ไปจับ deadline: ตัวตรวจที่หลวมเกินไป
 * ให้ผลหน้าตาเหมือนทุกอย่างเรียบร้อย
 */
const canonical = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/rules-canonical.json'), 'utf8'));

/** คำที่บอกใบ้ว่ากำลังอยู่ในการทดลอง — ห้ามปรากฏใน context ที่โมเดลเห็นเด็ดขาด */
const LEAK_PATTERNS = [
  /\bArm\s*A?[0-4]\b/i, /\bA[0-4]\b(?!\w)/, /placebo/i, /ยาหลอก/, /treatment/i,
  /active control/i, /การทดลอง/, /กลุ่มควบคุม/, /experiment/i,
];

const RULE_CONCEPTS_LEGACY = {
  'ขอบเขตงาน':          /ไม่ทำมากกว่า|นอกขอบเขต|เกินขอบเขต/,
  'ห้ามทำข้ออื่นพ่วง':   /ห้ามทำข้ออื่น|ข้ออื่นในกลุ่ม/,
  'ห้ามทำตาม TODO':     /TODO/,
  'ห้าม refactor พ่วง':  /refactor/i,
  'อ่านก่อนแก้':         /อ่าน.*ก่อน|ก่อนแก้.*เสมอ|ห้ามเดา/,
  'อ้าง REQ-ID':        /REQ-ID/,
  'ห้ามแก้เอกสารเอง':    /ห้ามแก.*REQUIREMENTS|REQUIREMENTS\.md.*ห้าม|ห้ามแก้ไข `REQUIREMENTS/,
  'ประเมินผลกระทบ':      /ผลกระทบ|ย้อนหลัง/,
  'ใช้ revenue-report':  /revenue-report/,
  'ข้อกำหนดขัดกัน':      /ขัดกัน|ห้ามเลือกข้าง/,
  'ห้ามเติมช่องว่างเอง':  /ไม่ครอบคลุม|เติม.*เอง|สมมติ/,
  'กฎขัดสามัญสำนึก':     /สามัญสำนึก|ถูกต้องตามปกติ|ขัดกับ.*ทั่วไป|ขัดกับแนวปฏิบัติ/,
  'เขียนเทสจาก AC':      /acceptance criteria/i,
  'ต้องรันเทสก่อนจบ':    /รันเทส.*ก่อน|ห้ามบอกว่าเสร็จ/,
  'กฎอยู่ชั้น domain':   /domain\//,
  'ห้ามลง dep เอง':      /dependency|npm install|yarn add/i,
  'ห้ามแตะ data/':       /data\/events\.jsonl|ห้ามแก.*data/,
  'git commit/push':     /git\s+(commit|push)/i,
  'prompt injection':    /ข้อมูล.*ไม่ใช่.*คำสั่ง|อนุมัติ.*แล้ว|injection/i,
  'รายงานตามจริง':       /รายงานตามจริง|ไม่ผ่านให้บอก/,
};

console.log('\n=== ตรวจการออกแบบการทดลอง ===\n');
let fail = 0;

// --- 1. token overhead ต่อ arm ---
console.log('1) ขนาด context ต่อ arm  (always = กินทุก request, full = ถ้าโหลด skill ครบทุกตัว)');
const sizes = {};
for (const arm of config.arms) {
  const { always, full, alwaysParts, fullParts } = armText(arm);
  sizes[arm.id] = {
    always: alwaysParts.reduce((sum, part) => sum + estTokens(part), 0),
    full: fullParts.reduce((sum, part) => sum + estTokens(part), 0),
    text: always,
    fullText: full,
  };
  const s = sizes[arm.id];
  console.log(`   ${arm.id.padEnd(3)} ${arm.name.padEnd(30)} always ~${String(s.always).padStart(5)} tok | full ~${String(s.full).padStart(5)} tok`);
}
console.log('   > A2 ที่ always ต่ำกว่า A1 ทั้งที่กฎเท่ากัน คือหลักฐานเชิงปริมาณของ progressive disclosure');
console.log('');

// --- 2. placebo ต้องยาวพอๆ กับ A1 ---
console.log('2) การจับคู่ความยาว A1 vs A3 (placebo)');
if (sizes.A1 && sizes.A3) {
  const ratio = sizes.A3.always / sizes.A1.always;
  const ok = ratio >= 0.85 && ratio <= 1.15;
  console.log(`   A3/A1 = ${ratio.toFixed(3)}  ${ok ? 'PASS' : 'FAIL — ต้องอยู่ในช่วง 0.85–1.15'}`);
  if (!ok) { fail++; console.log(`   -> ปรับความยาว A3 ให้ใกล้ ${sizes.A1.always} tok มิฉะนั้นแยก "ผลของกฎ" ออกจาก "ผลของความยาว" ไม่ได้`); }
}
console.log('');

// --- 3. A1 กับ A2 ต้องมีข้อผูกพันครบเท่ากัน (ตรวจรายข้อ ไม่ใช่รายคำสำคัญ) ---
console.log('3) ความเท่าเทียมของข้อผูกพัน A1 vs A2  (จาก config/rules-canonical.json)');
const t1 = armText(config.arms.find((a) => a.id === 'A1')).full;
const t2 = armText(config.arms.find((a) => a.id === 'A2')).full;
let obTotal = 0, obFail = 0;
for (const rule of canonical.rules) {
  const bad = [];
  for (const ob of rule.obligations) {
    obTotal++;
    const re = new RegExp(ob.pattern, ob.flags ?? '');
    const in1 = re.test(t1), in2 = re.test(t2);
    if (!in1 || !in2) { bad.push({ ob, in1, in2 }); obFail++; fail++; }
  }
  const ok = bad.length === 0;
  console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${rule.id} ${rule.title}`);
  for (const b of bad) {
    console.log(`         ✗ ${b.ob.id} ${b.ob.text}`);
    console.log(`           A1=${b.in1 ? 'มี' : 'ขาด'} A2=${b.in2 ? 'มี' : 'ขาด'} · pattern ${JSON.stringify(b.ob.pattern)}`);
  }
}
console.log(`   ตรวจข้อผูกพัน ${obTotal} ข้อ · ไม่ผ่าน ${obFail}`);
console.log('   > ตรวจที่ระดับข้อผูกพัน ไม่ใช่คำสำคัญ — ของเดิมใช้ /acceptance criteria/ ซึ่งเจอทั้งสองฝั่ง');
console.log('   > จึงขึ้น PASS ทั้งที่ A2 มี "ก่อนแตะ implementation" กับ "ต้องตกก่อน" เพิ่มมาสองข้อ');
console.log('');

/* --- 3a. ประโยคที่ต้องเหมือนกันทุกตัวอักษร ---
 *
 * ⚠️ เพิ่ม 7 ก.ย. 2569 — การตรวจ "ข้อผูกพันมีครบ" ยังจับความต่างเชิงเนื้อหาไม่ได้
 *
 * pattern ระดับข้อผูกพันตรวจว่า "มีกฎข้อนี้อยู่ไหม" แต่ไม่ตรวจว่า "กฎเขียนว่าอะไร"
 * ผลคือ A1 กับ A2 ต่างกันเชิงเนื้อหา 7 จุดโดยที่ตัวตรวจขึ้น PASS มาตลอด เช่น
 *   A1: อ่าน openapi ก่อนแก้ "เสมอ"        A2: อ่าน "ถ้างานแตะชั้น API"
 *   A1: อ้าง REQ-ID ไม่ได้ -> เสนอเป็นคำขอแยก   A2: -> อธิบายว่าทำไมจำเป็น  (คนละกฎ)
 *   A2: บอกชื่อ tool ว่า Grep                A1: บอกแค่ "ค้นหา"
 * อันสุดท้ายอันตรายที่สุด เพราะ S08 IM4 เดิมให้คะแนนเฉพาะ run ที่เรียก Grep
 *
 * ตัวแปรต้นคือ "กฎชุดเดียวกันวางคนละที่" ถ้าเนื้อกฎต่างด้วย ผลจะปนกันจนแยกไม่ออก
 */
console.log('3a) ประโยคที่ต้องเหมือนกันทุกตัวอักษรทั้งสองฝั่ง');
const verbatim = canonical.verbatim?.sentences ?? [];
if (!verbatim.length) {
  console.log('   FAIL  ไม่มีรายการประโยคบังคับใน config/rules-canonical.json');
  fail++;
} else {
  for (const v of verbatim) {
    const in1 = t1.includes(v.text), in2 = t2.includes(v.text);
    const ok = in1 && in2;
    if (!ok) fail++;
    console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${v.id}  ${v.why}`);
    if (!ok) {
      console.log(`         ✗ A1=${in1 ? 'มี' : 'ขาด'} A2=${in2 ? 'มี' : 'ขาด'}`);
      console.log(`           ต้องมีประโยคนี้เป๊ะ: ${v.text}`);
    }
  }
  console.log(`   ตรวจ ${verbatim.length} ประโยค`);
}

/*
 * ตัวตรวจเชิงลบ — จำเป็นเพราะตัวตรวจเชิงบวกอย่างเดียวไม่พอ
 *
 * พิสูจน์ด้วย mutation test เมื่อ 7 ก.ย. 2569: เอา `Grep` กลับเข้า impact-analysis
 * แล้ว V02 ยัง PASS เพราะประโยคที่ถูกยังอยู่ในอีกไฟล์หนึ่ง
 * "มีประโยคที่ถูก" กับ "ไม่มีข้อความที่ผิด" เป็นคนละคำถาม ต้องถามทั้งสอง
 */
const forbidden = canonical.verbatim?.forbidden?.patterns ?? [];
for (const f of forbidden) {
  const re = new RegExp(f.pattern);
  const hit1 = re.test(t1), hit2 = re.test(t2);
  const ok = !hit1 && !hit2;
  if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${f.id}  ต้องไม่มี /${f.pattern}/ — ${f.why}`);
  if (!ok) console.log(`         ✗ พบใน ${[hit1 && 'A1', hit2 && 'A2'].filter(Boolean).join(' และ ')}`);
}
console.log('   > ความต่างที่เหลือได้คือ "วางไว้ที่ไหน" และ "โหลดเมื่อไร" เท่านั้น');
console.log('');

// --- 3b. context ที่โมเดลเห็นต้องไม่บอกใบ้ว่าเป็นการทดลอง ---
//
// เจอ 4 ก.ย. 2569: ไฟล์ของทุก arm เขียนบอกโมเดลตรงๆ ว่ามันเป็น arm ไหนและมีบทบาทอะไร
// A3 หนักที่สุด — ขึ้นต้นว่า "Arm A3 — PLACEBO ไม่มีกฎควบคุมพฤติกรรมใดๆ เลย"
// แล้วเอาผลของมันไปสรุปว่า "ความยาวข้อความไม่ได้ทำให้พฤติกรรมดีขึ้น"
// ซึ่งตอบคำถามที่ว่า "แย่ลงเพราะไม่มีกฎ หรือเพราะถูกบอกว่าไม่ต้องทำตามกฎ" ไม่ได้เลย
console.log('3b) context ต้องไม่เปิดเผยว่าเป็นการทดลอง');
for (const arm of config.arms) {
  const { full } = armText(arm);
  const hits = LEAK_PATTERNS.filter((re) => re.test(full));
  const ok = hits.length === 0;
  if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${arm.id}${ok ? '' : `  พบ: ${hits.map((r) => r.source).join(' , ')}`}`);
}
console.log('   > ถ้าโมเดลรู้ว่ากำลังถูกทดลองอยู่ ผลที่ได้ไม่ใช่พฤติกรรมตามธรรมชาติของมัน');
console.log('');

// --- 4. scenario ต้องมีกฎครบทุกระดับ และ fixture มีอยู่จริง ---
console.log('4) ความสมบูรณ์ของ scenario');
const scDir = path.join(ROOT, 'scenarios');
for (const f of fs.readdirSync(scDir).filter((x) => x.endsWith('.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(scDir, f), 'utf8'));
  const crit = s.rules.filter((r) => r.severity === 'critical').length;
  const fx = fs.existsSync(path.join(ROOT, s.fixture ?? ''));
  const ok = crit >= 1 && s.rules.length >= 3 && fx;
  if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${s.id.padEnd(20)} กฎ ${String(s.rules.length).padStart(2)} ข้อ (critical ${crit}) fixture:${fx ? 'ok' : 'MISSING'}`);
}
console.log('');

// --- 4b. ทุก regex ในทุกกฎต้อง compile ผ่าน ---
//
// เพิ่มหลังเจอของจริง: กฎ AC0 ที่เพิ่งเพิ่มเข้าไปมี regex "^+.*\b15\b" ซึ่ง compile ไม่ผ่าน
// (backslash หาย) gradeRun จับ exception แล้วตั้ง passed=false เงียบๆ
// ผลคือ S02 กับ S03 ได้ CRIT = 0% ทุก run และ calibration รายงานว่า "โจทย์ยากเกิน"
// ทั้งที่เอเจนต์ทำงานถูกต้องทุกครั้ง — checker ที่พังหน้าตาเหมือนโจทย์ที่ยากมาก แยกไม่ออกเลย
console.log('4b) ความถูกต้องของ regex ในกฎ');
let reBad = 0;
for (const f of fs.readdirSync(scDir).filter((x) => x.endsWith('.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(scDir, f), 'utf8'));
  for (const r of s.rules) {
    if (!r.check?.pattern) continue;
    try {
      new RegExp(r.check.pattern, r.check.flags);
    } catch (e) {
      reBad++; fail++;
      console.log(`   FAIL  ${s.id} ${r.id} [${r.severity}] ${JSON.stringify(r.check.pattern)}`);
      console.log(`         ${e.message}`);
    }
  }
}
if (!reBad) console.log('   PASS  ทุก regex compile ผ่าน');
console.log('   > regex ที่พังจะทำให้กฎนั้นตกทุก run และอ่านผลออกมาเป็น "โจทย์ยากเกิน"');
console.log('');

// --- 5. ตัวแปรต้นถูกใส่เข้า workspace จริงไหม ---
//
// ข้อนี้เพิ่มเข้ามาหลังเจอบั๊กที่ config ประกาศ contextFiles/skillsDir ไว้ครบ
// แต่ไม่มีโค้ดตัวไหนอ่านไปใช้ -> ทุก arm เจอ workspace เหมือนกันหมด
// การทดลองยังให้ผลออกมาครบถ้วนมี CI มีค่า p เหมือนเดิม โดยไม่มีอะไรเตือนเลย
// จึงต้องติดตั้งจริงแล้วตรวจของจริง ไม่ใช่แค่เช็คว่าไฟล์ต้นทางมีอยู่
console.log('5) การติดตั้ง context ลง workspace (ติดตั้งจริงแล้วล้างทิ้ง)');
const fixtureForInstall = path.join(ROOT, 'fixtures/gpu-booking');
if (!fs.existsSync(path.join(fixtureForInstall, '.git'))) {
  fail++;
  console.log('   FAIL  fixture ยังไม่ใช่ git repo -> รัน node scripts/setup-fixtures.mjs ก่อน');
} else {
  for (const arm of config.arms) {
    const r = verifyInstall({ workspace: fixtureForInstall, arm });
    const wantClaude = (arm.contextFiles ?? []).length > 0;
    const wantSkills = arm.skillsDir ? 1 : 0;
    const ok = r.ok && r.clean
      && r.claudeMd === wantClaude
      && (wantSkills ? r.skillFiles > 0 : r.skillFiles === 0);
    if (!ok) fail++;
    const detail = r.ok
      ? `CLAUDE.md=${r.claudeMd ? 'มี' : '--'} skills=${r.skillFiles} สะอาด=${r.clean ? 'ใช่' : 'ไม่'}`
      : r.error.split('\n')[0];
    console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${arm.id} ${String(arm.name).padEnd(28)} ${detail}`);
  }
  console.log('   > "สะอาด" = git status ว่างหลังติดตั้ง ถ้าไม่ว่าง ไฟล์ของ arm จะถูกนับเป็นผลงานของเอเจนต์');
  console.log('   > แล้ว gold-plating rate จะเป็นบวกปลอมทุก run ทุก arm');
}

// ชุด tool ที่จะถูกบังคับจริง — ต้องตรงกับที่เขียนในเล่ม มิฉะนั้นคนอื่นทำซ้ำไม่ได้
const declaredTools = config.fixedFactors?.toolset ?? [];
const effectiveTools = [...new Set([...declaredTools, 'Skill'])];
const needed = ['Read', 'Edit', 'Bash'];
const missing = needed.filter((t) => !effectiveTools.includes(t));
if (missing.length) {
  fail++;
  console.log(`   FAIL  ชุด tool ขาดตัวที่จำเป็นต่อการทำโจทย์: ${missing.join(', ')}`);
} else {
  console.log(`   PASS  ชุด tool ที่จะบังคับด้วย --tools: ${effectiveTools.join(',')}`);
  console.log('   > Skill ถูกเติมให้ทุก arm เท่ากัน ตัวแปรต้นคือ "มีโฟลเดอร์ .claude/skills ไหม" เท่านั้น');
}
console.log('');

// --- 6. เตือนเรื่องขนาดตัวอย่าง ---
console.log('6) ขนาดตัวอย่าง');
const nScen = fs.readdirSync(scDir).filter((x) => x.endsWith('.json')).length;
console.log(`   scenario ปัจจุบัน = ${nScen}`);
/*
 * ตัวเลขเดิมที่นี่ (74 run/arm จาก 60%->85%) มาจาก requiredNPerArm() ซึ่งเป็นสูตร
 * two-proportion แบบ "ไม่จับคู่" — ไม่ตรงกับ McNemar ที่ประกาศไว้เป็น test จริง
 * และใช้ designEffect = 1.5 ซึ่งแปลว่า ICC ~ 0.04 ขณะที่วัดจากข้อมูลจริงได้ 0.335
 *
 * ไม่พิมพ์ตัวเลขที่คำนวณผิดสูตรอีก เพราะตัวเลขที่ดูน่าเชื่อถือแต่ผิด อันตรายกว่าไม่มีตัวเลข
 * ให้ชี้ไปที่สคริปต์ที่คำนวณจากข้อมูลจริงแทน
 */
console.log(`   ขนาดตัวอย่าง: คำนวณจากข้อมูลจริงด้วย  node scripts/estimate-icc.mjs`);
console.log(`   (McNemar + ICC ที่วัดได้ — ไม่ใช่สูตร unpaired กับ designEffect ที่เดาไว้)`);
console.log(`   เพดานที่เพิ่มจำนวนรอบแก้ไม่ได้: n_eff -> k/ICC = ${nScen}/0.335 = ${Math.round(nScen / 0.335)} run/arm`);
if (nScen < 8) console.log(`   คำแนะนำ: เพิ่มเป็น 8-12 scenario จะดีกว่าเพิ่ม repetition เพราะ CI ถูกจำกัดด้วยจำนวน cluster ไม่ใช่จำนวน run`);
console.log('');

console.log(fail === 0 ? '=== ผ่านทุกข้อ พร้อมเก็บข้อมูลจริง ===\n'
                       : `=== ไม่ผ่าน ${fail} ข้อ แก้ก่อนเก็บข้อมูล ===\n`);
process.exit(fail === 0 ? 0 : 1);
