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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/arms.json'), 'utf8'));

/** ประมาณจำนวน token แบบหยาบ — ไทยราว 1 token ต่อ 2 อักขระ, อังกฤษราว 1 ต่อ 4 */
function estTokens(text) {
  const thai = (text.match(/[฀-๿]/g) ?? []).length;
  return Math.round(thai / 2 + (text.length - thai) / 4);
}

/**
 * แยก 2 ตัวเลขที่ไม่เหมือนกัน และเป็นหัวใจของข้อโต้แย้งเรื่อง progressive disclosure:
 *   always = สิ่งที่อยู่ใน context ทุก request ไม่ว่างานจะเป็นอะไร  <- ตัวที่ต้องจับคู่กับ placebo
 *   full   = ถ้า skill ถูกโหลดครบทุกตัวพร้อมกัน (worst case)
 * สำหรับ skill: context ที่กินตลอดคือ frontmatter description เท่านั้น ตัว body โหลดเมื่อถูก trigger
 */
function armText(arm) {
  let always = '', full = '';
  for (const f of arm.contextFiles ?? []) {
    const p = path.join(ROOT, f);
    if (fs.existsSync(p)) { const s = fs.readFileSync(p, 'utf8') + '\n'; always += s; full += s; }
  }
  if (arm.skillsDir) {
    const dir = path.join(ROOT, arm.skillsDir);
    if (fs.existsSync(dir)) {
      for (const d of fs.readdirSync(dir)) {
        const p = path.join(dir, d, 'SKILL.md');
        if (!fs.existsSync(p)) continue;
        const body = fs.readFileSync(p, 'utf8');
        full += body + '\n';
        const fm = body.match(/^---\n([\s\S]*?)\n---/);
        always += (fm ? fm[1] : '') + '\n';   // เฉพาะ name+description
      }
    }
  }
  return { always, full };
}

/** เนื้อหากฎที่ A1 และ A2 ต้องครอบคลุมเท่ากัน — ถ้าไม่เท่า การเปรียบเทียบไม่ยุติธรรม */
const RULE_CONCEPTS = {
  'ขอบเขตงาน':        /ไม่ทำมากกว่า|นอกขอบเขต|เกินขอบเขต/,
  'ห้าม refactor พ่วง': /refactor/i,
  'ห้ามแตะ config':    /config|package\.json|tsconfig/i,
  'อ่านก่อนแก้':       /อ่าน.*ก่อน|ก่อนแก้|ห้ามเดา/,
  'ห้าม hardcode สี':  /hardcode|hex/i,
  'ถามเมื่อกำกวม':     /กำกวม|ถามก่อน|หยุดถาม|ยังไม่ชัด/,
  'ห้ามลง dep เอง':    /dependency|npm install|yarn add/i,
  'ห้ามคำสั่งทำลาย':   /migrate reset|accept-data-loss|DROP|TRUNCATE/i,
  'ห้ามแตะ migration': /migration.*(ห้าม|deploy)|ห้าม.*migration/,
  'ต้องเช็ค status':   /migrate status|migrate diff/i,
  'git commit/push':   /git\s+(commit|push)/i,
  'prompt injection':  /ข้อมูล.*ไม่ใช่.*คำสั่ง|ฝังอยู่|อนุมัติ.*แล้ว|injection/i,
  'รายงานตามจริง':     /รายงานตามจริง|ไม่ผ่านให้บอก|ห้ามบอกว่าเสร็จ/,
};

console.log('\n=== ตรวจการออกแบบการทดลอง ===\n');
let fail = 0;

// --- 1. token overhead ต่อ arm ---
console.log('1) ขนาด context ต่อ arm  (always = กินทุก request, full = ถ้าโหลด skill ครบทุกตัว)');
const sizes = {};
for (const arm of config.arms) {
  const { always, full } = armText(arm);
  sizes[arm.id] = { always: estTokens(always), full: estTokens(full), text: always, fullText: full };
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

// --- 3. A1 กับ A2 ต้องมีกฎครบเท่ากัน ---
console.log('3) ความเท่าเทียมของเนื้อหากฎ A1 vs A2');
const t1 = armText(config.arms.find((a) => a.id === 'A1')).full;
const t2 = armText(config.arms.find((a) => a.id === 'A2')).full;
for (const [name, re] of Object.entries(RULE_CONCEPTS)) {
  const in1 = re.test(t1), in2 = re.test(t2);
  const ok = in1 === in2;
  if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(20)} A1=${in1 ? 'มี' : '-- '} A2=${in2 ? 'มี' : '-- '}`);
}
console.log('   > ถ้าไม่เท่ากัน แปลว่ากำลังเทียบ "กฎเยอะกว่า" ไม่ใช่ "โครงสร้างต่างกัน"');
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

// --- 5. เตือนเรื่องขนาดตัวอย่าง ---
console.log('5) ขนาดตัวอย่าง');
const nScen = fs.readdirSync(scDir).filter((x) => x.endsWith('.json')).length;
console.log(`   scenario ปัจจุบัน = ${nScen}`);
console.log(`   ต้องการ n>=74 run/arm (เพื่อจับผลต่าง 60%->85%) => ${Math.ceil(74 / nScen)} repetition ต่อ scenario`);
if (nScen < 8) console.log(`   คำแนะนำ: เพิ่มเป็น 8-12 scenario จะดีกว่าเพิ่ม repetition เพราะ CI ถูกจำกัดด้วยจำนวน cluster ไม่ใช่จำนวน run`);
console.log('');

console.log(fail === 0 ? '=== ผ่านทุกข้อ พร้อมเก็บข้อมูลจริง ===\n'
                       : `=== ไม่ผ่าน ${fail} ข้อ แก้ก่อนเก็บข้อมูล ===\n`);
process.exit(fail === 0 ? 0 : 1);
