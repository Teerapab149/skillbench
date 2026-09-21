/*
 * สร้าง report/ARMS-REVIEW.md จากไฟล์จริงในโฟลเดอร์ arms/
 *
 * เอกสารนั้นประกาศตัวเองว่า "สร้างอัตโนมัติจากไฟล์จริง" มาตลอด แต่เดิมไม่มีสคริปต์
 * ที่สร้างมันจริง ๆ จึงไม่มีทางรู้ว่ามันตรงกับไฟล์ปัจจุบันหรือไม่ · ไฟล์นี้ปิดช่องนั้น
 *
 *   node scripts/make-arms-review.mjs          เขียนทับเอกสาร
 *   node scripts/make-arms-review.mjs --check   ตรวจอย่างเดียว ไม่เขียน (ใช้ในด่านตรวจ)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'report', 'ARMS-REVIEW.md');
const LF = String.fromCharCode(10);
const FENCE = String.fromCharCode(96).repeat(4);
const TICK = String.fromCharCode(96);

const CHECK = process.argv.includes('--check');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').split(String.fromCharCode(13) + LF).join(LF);
const bytes = (rel) => Buffer.byteLength(read(rel), 'utf8');

/* ลำดับและหัวข้อของแต่ละส่วน — ส่วนนี้เป็นบรรณาธิการ ไม่ใช่ข้อมูล
   แต่ "เนื้อหา" กับ "ขนาด" อ่านจากไฟล์จริงทั้งหมด */
const SECTIONS = [
  ['A1 — ไฟล์เดียวโหลดตลอดเวลา (active control)', 'arms/A1/CLAUDE.md', 'markdown'],
  ['A2 — ไฟล์หลักของกลุ่ม skill', 'arms/A2/CLAUDE.md', 'markdown'],
  [`A2 · skill ${TICK}acceptance-first${TICK}`, 'arms/A2/skills/acceptance-first/SKILL.md', 'markdown'],
  [`A2 · skill ${TICK}impact-analysis${TICK}`, 'arms/A2/skills/impact-analysis/SKILL.md', 'markdown'],
  [`A2 · skill ${TICK}safe-shell${TICK}`, 'arms/A2/skills/safe-shell/SKILL.md', 'markdown'],
  [`A2 · skill ${TICK}trace-to-requirement${TICK}`, 'arms/A2/skills/trace-to-requirement/SKILL.md', 'markdown'],
  ['A3 — กลุ่มควบคุมเชิงความยาว (placebo) · ใช้เฉพาะชุดที่ 1', 'arms/A3/CLAUDE.md', 'markdown'],
  ['A5 — ข้อความชุดเดียวกับ A2 แต่รวมเป็นไฟล์เดียว · ใช้เฉพาะชุดที่ 2', 'arms/A5/CLAUDE.md', 'markdown'],
  ['A4 — ข้อความที่ฉีดลง fixture (ไม่ใช่กฎ)', 'arms/A4/adversarial/inject.json', 'json'],
];

/* ตารางสรุป — อ่านบทบาทและไฟล์จาก config ของทั้งสองชุด */
const cfg1 = JSON.parse(read('config/arms.json'));
const cfg2 = JSON.parse(read('config/arms-study2.json'));
const byId = new Map();
for (const a of cfg1.arms) byId.set(a.id, { ...a, studies: ['1'] });
for (const a of cfg2.arms) {
  const prev = byId.get(a.id);
  if (prev) prev.studies.push('2');
  else byId.set(a.id, { ...a, studies: ['2'] });
}

const skillsOf = (arm) => {
  if (!arm.skillsEnabled || !arm.skillsDir) return '—';
  const dir = path.join(ROOT, arm.skillsDir);
  if (!fs.existsSync(dir)) return '—';
  return fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'SKILL.md'))).sort().join(' · ');
};

const rows = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)).map((a) => {
  const files = (a.contextFiles ?? []).length ? a.contextFiles.map((f) => f).join(' · ') : '— ไม่มีเลย —';
  const used = a.studies.length === 2 ? '1 และ 2' : a.studies[0];
  return `| **${a.id}** ${a.name} | ${a.role} | ${files} | ${skillsOf(a)} | ${used} |`;
});

const out = [];
out.push('# บริบทและ skill ที่แต่ละ arm ได้รับ — ฉบับตรวจทาน');
out.push('');
out.push(`> **สร้างอัตโนมัติจากไฟล์จริงที่ติดตั้งให้เอเจนต์** ด้วย ${TICK}npm run arms:review${TICK}`);
out.push('> ห้ามแก้ไฟล์นี้ด้วยมือ · ถ้าไฟล์ในโฟลเดอร์ `arms/` เปลี่ยน ให้สร้างใหม่');
out.push('');
out.push('## สรุป');
out.push('');
out.push('| arm | บทบาท | ไฟล์ที่โหลดตลอดเวลา | skill ที่ติดตั้ง | ใช้ในชุดที่ |');
out.push('|---|---|---|---|---|');
out.push(...rows);
out.push('');
out.push('**A4 ใช้ไฟล์ชุดเดียวกับ A2 ทุกประการ** ต่างกันที่มีการฉีดข้อความล่อลวงลงใน fixture ไม่ใช่ที่ตัวกฎ');
out.push('');

for (const [heading, rel, lang] of SECTIONS) {
  out.push('---');
  out.push('');
  out.push(`## ${heading}`);
  out.push('');
  out.push(`${TICK}${rel}${TICK} · ${bytes(rel)} ไบต์`);
  out.push('');
  out.push(FENCE + lang);
  out.push(read(rel).replace(/\n+$/, ''));
  out.push(FENCE);
  out.push('');
}

const text = out.join(LF).replace(/\n+$/, '') + LF;

if (CHECK) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').split(String.fromCharCode(13) + LF).join(LF) : '';
  if (cur !== text) {
    console.error('❌ report/ARMS-REVIEW.md ไม่ตรงกับไฟล์ใน arms/ — สร้างใหม่ด้วย npm run arms:review');
    process.exit(1);
  }
  console.log('✅ report/ARMS-REVIEW.md ตรงกับไฟล์จริงใน arms/');
} else {
  fs.writeFileSync(OUT, text);
  console.log('เขียน report/ARMS-REVIEW.md แล้ว ·', SECTIONS.length, 'ไฟล์ ·', text.split(LF).length, 'บรรทัด');
}
