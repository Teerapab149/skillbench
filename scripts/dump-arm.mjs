/**
 * dump-arm.mjs — ดัมป์ทุกอย่างที่เอเจนต์ "เห็น" ที่ turn 0 ของแต่ละ arm ออกมาเป็นไฟล์
 *
 * ตอบคำถามที่จะโดนถามแน่นอนในวันนำเสนอ: *"เอาสิ่งที่ป้อนให้ AI จริง ๆ มาดูหน่อย"*
 *
 * ตัวแปรต้นทั้งหมดของการทดลองนี้อยู่ในไฟล์ที่ถูกติดตั้งลง workspace ก่อนเอเจนต์เริ่มทำงาน
 * แต่ที่ผ่านมาไม่เคยมีการแสดงมันออกมาเลยสักครั้ง ทั้งในสไลด์และในเล่ม
 *
 *   node scripts/dump-arm.mjs                  # ทุก arm ลง tmp/arm-dump/
 *   node scripts/dump-arm.mjs --arm A4         # เฉพาะ arm เดียว
 *   node scripts/dump-arm.mjs --out somewhere  # เลือกที่เก็บเอง
 *
 * ปลอดภัยกับ fixture: ติดตั้งแล้วถอนทุกครั้ง และถอนให้เองแม้สคริปต์ตายกลางคัน
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installArm, uninstallArm, BASELINE_TAG } from '../src/install-arm.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/arms.json'), 'utf8'));
const FIXTURE = path.join(ROOT, 'fixtures/gpu-booking');

const argv = (flag, dflt = '') => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};

const outDir = path.resolve(ROOT, argv('--out', 'tmp/arm-dump'));
const only = argv('--arm', '');
const arms = config.arms.filter((a) => !only || a.id === only);
if (!arms.length) { console.error(`ไม่รู้จัก arm ${only}`); process.exit(1); }

fs.mkdirSync(outDir, { recursive: true });
process.on('exit', () => { try { uninstallArm(FIXTURE); } catch { /* ปิดเงียบตอน exit */ } });

/** ไฟล์ที่ arm ติดตั้งเข้าไป — ไม่ใช่ไฟล์ของ fixture ที่มีอยู่แล้ว */
function armOwnedFiles(cwd) {
  const out = [];
  const claude = path.join(cwd, 'CLAUDE.md');
  if (fs.existsSync(claude)) out.push('CLAUDE.md');
  const skills = path.join(cwd, '.claude', 'skills');
  if (fs.existsSync(skills)) {
    for (const d of fs.readdirSync(skills).sort()) {
      const f = path.join(skills, d, 'SKILL.md');
      if (fs.existsSync(f)) out.push(`.claude/skills/${d}/SKILL.md`);
    }
  }
  return out;
}

function estTokens(text) {
  const thai = (text.match(/[฀-๿]/g) ?? []).length;
  return Math.round(thai / 2 + (text.length - thai) / 4);
}

const index = [];
console.log(`\ndump สิ่งที่เอเจนต์เห็นที่ turn 0 -> ${path.relative(ROOT, outDir)}/\n`);

for (const arm of arms) {
  installArm({ workspace: FIXTURE, arm });

  const files = armOwnedFiles(FIXTURE);
  const armDir = path.join(outDir, arm.id);
  fs.rmSync(armDir, { recursive: true, force: true });
  fs.mkdirSync(armDir, { recursive: true });

  let always = 0, full = 0;
  for (const rel of files) {
    const body = fs.readFileSync(path.join(FIXTURE, rel), 'utf8');
    const dest = path.join(armDir, rel.replace(/[\\/]/g, '__'));
    fs.writeFileSync(dest, body);
    full += estTokens(body);
    if (rel === 'CLAUDE.md') always += estTokens(body);
    else {
      // skill: กิน context ตลอดเวลาเฉพาะ frontmatter ตัว body โหลดเมื่อถูก trigger
      const fm = body.match(/^---\n([\s\S]*?)\n---/);
      always += estTokens(fm ? fm[1] : '');
    }
  }

  /*
   * ความต่างของ A4 ไม่ได้อยู่ในไฟล์ที่ติดตั้ง แต่อยู่ในการแก้ไฟล์ของ fixture เอง
   * จึงต้องดึงมาจาก git diff ไม่ใช่จากรายการไฟล์ — ถ้าไม่ทำ A4 จะดูเหมือน A2 ทุกประการ
   */
  let injectionDiff = '';
  try {
    // ต้องเทียบกับ baseline tag ไม่ใช่ `git diff` เปล่า ๆ — installArm commit ไฟล์ที่ติดตั้ง
    // ทับลงไปเพื่อให้ git status สะอาด (ไม่งั้นไฟล์ของ arm จะถูกนับเป็นผลงานของเอเจนต์)
    // ผลคือข้อความล่อของ A4 ถูก commit ไปด้วย และ `git diff` จะว่างเปล่าเสมอ
    injectionDiff = execFileSync('git', ['diff', BASELINE_TAG, '--', 'src/'],
      { cwd: FIXTURE, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  } catch { /* ไม่มี git หรือไม่มี tag ก็ข้าม */ }
  if (injectionDiff.trim()) fs.writeFileSync(path.join(armDir, 'INJECTED.diff'), injectionDiff);

  index.push({ id: arm.id, name: arm.name, files, always, full, injected: injectionDiff.trim().length > 0 });
  console.log(`  ${arm.id.padEnd(3)} ไฟล์ ${String(files.length).padStart(2)} · always ~${String(always).padStart(5)} tok · full ~${String(full).padStart(5)} tok${injectionDiff.trim() ? ' · มีข้อความล่อฝังใน fixture' : ''}`);

  uninstallArm(FIXTURE);
}

fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index, null, 2));
console.log(`\nเขียนแล้ว: ${path.relative(ROOT, outDir)}/index.json และโฟลเดอร์ของแต่ละ arm`);
console.log('ไฟล์ในนั้นคือสิ่งที่โมเดลเห็นจริง ไม่ใช่คำอธิบายว่าน่าจะเห็นอะไร\n');
