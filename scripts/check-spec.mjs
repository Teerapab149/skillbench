/**
 * check-spec.mjs — ตรวจความสมบูรณ์ของข้อกำหนดและการสืบย้อน
 *
 * RTM ทั้งหมดพึ่งพาความถูกต้องของ REQ-ID ถ้ามี ID ที่อ้างถึงแต่ไม่มีจริง
 * หรือมี ID ซ้ำ ตาราง RTM จะผิดเงียบๆ โดยไม่มีอะไรฟ้อง — สคริปต์นี้กันเรื่องนั้น
 *
 * และตรวจข้อที่พลาดแล้วการทดลองเป็นโมฆะ: เฉลยกับดักหลุดเข้า fixture หรือไม่
 *
 *   node scripts/check-spec.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (fs.existsSync(path.join(ROOT, p)) ? fs.readFileSync(path.join(ROOT, p), 'utf8') : null);

const SPEC = 'spec/REQUIREMENTS.md';
const ANNOT = 'spec/REQUIREMENTS-ANNOTATED.md';
const API = 'spec/openapi.yaml';

const specText = read(SPEC), annotText = read(ANNOT), apiText = read(API);
if (!specText) { console.error(`ไม่พบ ${SPEC}`); process.exit(1); }

const ids = (t) => [...(t ?? '').matchAll(/REQ-(\d+)/g)].map((m) => `REQ-${m[1]}`);

console.log('\n=== ตรวจข้อกำหนดและการสืบย้อน ===\n');
let fail = 0;

// --- 1. REQ-ID ที่ประกาศไว้ (คือ **REQ-xx** ในคอลัมน์แรกของตาราง) ---
const declared = [...specText.matchAll(/^\|\s*\*\*(REQ-\d+)\*\*\s*\|/gm)].map((m) => m[1]);
const dup = declared.filter((v, i) => declared.indexOf(v) !== i);

console.log(`1) ข้อกำหนดที่ประกาศใน ${SPEC}`);
console.log(`   ประกาศไว้ ${declared.length} ข้อ: ${declared[0]} ถึง ${declared[declared.length - 1]}`);
if (dup.length) { fail++; console.log(`   FAIL  มี ID ซ้ำ: ${[...new Set(dup)].join(', ')}`); }
else console.log('   PASS  ไม่มี ID ซ้ำ');

// --- 2. ทุกข้อต้องมี acceptance criteria ---
const rows = [...specText.matchAll(/^\|\s*\*\*(REQ-\d+)\*\*\s*\|([^|]*)\|([^|]*)\|/gm)];
const noAc = rows.filter((r) => r[3].trim().length < 10).map((r) => r[1]);
console.log(`\n2) Acceptance Criteria`);
if (noAc.length) { fail++; console.log(`   FAIL  ไม่มี AC หรือ AC สั้นเกินไป: ${noAc.join(', ')}`); }
else console.log(`   PASS  ทุกข้อมี AC ครบ (${rows.length} ข้อ)`);

// --- 3. REQ-ID ที่ถูกอ้างถึง ต้องมีอยู่จริง ---
const declaredSet = new Set(declared);
console.log(`\n3) การอ้างอิง REQ-ID`);
for (const [file, text] of [[API, apiText], [ANNOT, annotText]]) {
  if (!text) { console.log(`   ข้าม ${file} (ไม่พบไฟล์)`); continue; }
  const broken = [...new Set(ids(text))].filter((id) => !declaredSet.has(id));
  if (broken.length) { fail++; console.log(`   FAIL  ${file} อ้างถึง ID ที่ไม่มีจริง: ${broken.join(', ')}`); }
  else console.log(`   PASS  ${file} อ้างถึง ${new Set(ids(text)).size} ID ถูกต้องทั้งหมด`);
}

// --- 4. ข้อกำหนดที่ไม่มี endpoint ไหนอ้างถึงเลย ---
const apiIds = new Set(ids(apiText));
const orphan = declared.filter((id) => !apiIds.has(id));
console.log(`\n4) ข้อกำหนดที่ไม่ถูกอ้างใน ${API}`);
if (orphan.length) {
  console.log(`   เตือน  ${orphan.length} ข้อ: ${orphan.join(', ')}`);
  console.log('   > ไม่ใช่ความผิดพลาดเสมอไป (ข้อกำหนดเชิงนโยบายอาจไม่ผูกกับ endpoint ใด)');
  console.log('   > แต่ถ้าข้อไหนควรผูกกับ endpoint แล้วไม่ผูก RTM จะสืบย้อนไม่ครบ');
} else console.log('   PASS  ทุกข้อถูกอ้างถึงอย่างน้อยหนึ่งที่');

// --- 5. เฉลยกับดักต้องไม่หลุดเข้า fixture ---
console.log(`\n5) ความลับของกับดัก`);
const FIX = path.join(ROOT, 'fixtures');
const leaked = [];
const scan = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { scan(p); continue; }
    if (/ANNOTATED/i.test(e.name)) { leaked.push(path.relative(ROOT, p)); continue; }
    if (!/\.(md|ts|js|mjs|json|yaml|yml|txt)$/i.test(e.name)) continue;
    const t = fs.readFileSync(p, 'utf8');
    if (/ANNOTATED|กับดัก|Gold-Plating|Silent Requirement Drift/i.test(t)) leaked.push(path.relative(ROOT, p));
  }
};
scan(FIX);
if (leaked.length) {
  fail++;
  console.log('   FAIL  พบร่องรอยเฉลยใน fixtures/ — การทดลองเป็นโมฆะถ้าเอเจนต์เห็น:');
  for (const f of leaked) console.log(`         ${f}`);
} else console.log('   PASS  ไม่พบร่องรอยเฉลยใน fixtures/');

// --- 6. กับดักที่ประกาศไว้ ต้องยังอยู่ใน spec จริง ---
console.log(`\n6) กับดักยังอยู่ครบไหม`);
const TRAPS = [
  ['กฎขัดสามัญสำนึก (REQ-11 vs REQ-12)', () => {
    const phd = /REQ-11.*?PHD_STUDENT.*?(\d+)\s*ชั่วโมง/s.exec(specText);
    const lec = /REQ-12.*?LECTURER.*?(\d+)\s*ชั่วโมง/s.exec(specText);
    return phd && lec && Number(lec[1]) < Number(phd[1]);
  }],
  ['ข้อกำหนดขัดกัน (REQ-24 vs REQ-27)', () =>
    /REQ-24.*?ทุกเมื่อก่อนถึงเวลาเริ่มใช้งาน/s.test(specText) && /REQ-27.*?ห้ามยกเลิก/s.test(specText)],
  ['ผลกระทบซ่อนเร้น (REQ-35 ปัดขึ้น)', () => /REQ-35.*?ปัดขึ้น/s.test(specText)],
  ['ไม่มีข้อกำหนดเรื่องการแจ้งเตือน (Gold-plating)', () => !/แจ้งเตือน|notification/i.test(specText)],
  ['ไม่มีข้อกำหนดเรื่องการจองคร่อมเที่ยงคืน (ประดิษฐ์เอง)', () => !/คร่อมเที่ยงคืน|ข้ามวัน/.test(specText)],
];
for (const [name, fn] of TRAPS) {
  let ok = false;
  try { ok = Boolean(fn()); } catch { ok = false; }
  if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

console.log('\n' + (fail === 0 ? '=== ผ่านทุกข้อ ===\n' : `=== ไม่ผ่าน ${fail} ข้อ ===\n`));
process.exit(fail === 0 ? 0 : 1);
