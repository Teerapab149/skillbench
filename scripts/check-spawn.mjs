/**
 * check-spawn.mjs — ตรวจว่า prompt เดินทางไปถึง CLI ครบถ้วน
 *
 * ที่มาของไฟล์นี้: บั๊กที่เกือบทำให้ข้อมูลทั้งชุดเป็นโมฆะ
 *
 *   adapter เรียก spawn('claude', args, { shell: true }) บน Windows
 *   Node ต่อ args เข้าด้วยกันโดยไม่ escape (คำเตือน DEP0190)
 *   prompt "เพิ่ม endpoint GET /bookings/..." จึงขาดที่ช่องว่างแรก
 *   เอเจนต์ได้รับโจทย์แค่คำว่า "เพิ่ม"
 *
 * สิ่งที่ทำให้บั๊กนี้อันตรายเป็นพิเศษ: CLI ไม่ error เลย
 * ทุก arm ตอบกลับมาอย่างสุภาพว่า "ยังไม่ระบุว่าให้เพิ่มอะไร" แล้วไม่แก้ไฟล์
 * ตัวตรวจอ่านว่า "เอเจนต์เลือกที่จะไม่ทำ" = ทำตามกฎขอบเขตได้ดีมาก
 * ผลคือคะแนนออกมาสวย มี CI มีค่า p ครบ ทั้งที่ไม่มี run ไหนได้รับโจทย์จริงเลย
 *
 * บทเรียน: การทดสอบว่า "ระบบรันผ่าน" ไม่พอ ต้องทดสอบว่า "ข้อมูลไปถึงปลายทางครบ"
 *
 *   node scripts/check-spawn.mjs
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveClaudeBin } from '../src/adapters/claude-cli.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// โปรแกรมจิ๋วที่พิมพ์ argv ออกมา ใช้แทน claude เพื่อทดสอบเส้นทางการส่ง argument
// โดยไม่ต้องเสียค่า API และไม่ต้องมี auth
const dump = path.join(os.tmpdir(), 'skillbench-argvdump.mjs');
fs.writeFileSync(dump, 'console.log(JSON.stringify(process.argv.slice(2)));\n');

function quoteWin(arg) {
  const s = String(arg);
  if (s === '') return '""';
  const escaped = s.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1');
  return `"${escaped}"`;
}

/** จำลองเส้นทางการ spawn ของ adapter เป๊ะๆ แต่เปลี่ยนปลายทางเป็นตัวพิมพ์ argv */
function roundTrip(prompt, mode) {
  const args = [dump, '-p', prompt, '--model', 'claude-opus-5', '--tools', 'Read,Bash,Skill'];
  return new Promise((res) => {
    let out = '';
    const child = mode === 'direct'
      ? spawn(process.execPath, args, { cwd: ROOT })
      : spawn([process.execPath, ...args.map(quoteWin)].join(' '), { cwd: ROOT, shell: true });
    child.stdout.on('data', (d) => { out += d; });
    child.on('close', () => {
      // argv ที่ตัวพิมพ์เห็นคือ ['-p', prompt, '--model', ...] -> prompt อยู่ตำแหน่งที่ 1
      try { res(JSON.parse(out)[1]); } catch { res(null); }
    });
    child.on('error', () => res(null));
  });
}

const TRICKY = [
  ['ช่องว่าง (บั๊กตัวจริง)', 'เพิ่ม endpoint GET /bookings/{bookingId}/history ตาม REQ-41'],
  ['เครื่องหมายคำพูด',      'เพิ่ม endpoint "history" ตาม REQ-41'],
  ['ตัวแปร %VAR%',          'ปัดขึ้น 100% ตาม REQ-35 และ %PATH% ต้องไม่เปลี่ยน'],
  ['& และ |',               'แก้ A && B | C ตาม REQ-01'],
  ['ลงท้าย backslash',      'แก้ไฟล์ src\\domain\\'],
  ['^ และ >',               'ถ้า x > 8 ให้ใช้ ^2'],
];

console.log('\n=== ตรวจว่า prompt เดินทางถึง CLI ครบ ===\n');

const claudeBin = resolveClaudeBin();
console.log(`โหมด spawn: ${claudeBin.mode}  (พบจาก: ${claudeBin.how})`);
if (claudeBin.mode === 'direct') console.log(`ไฟล์: ${claudeBin.bin}`);
else console.log('เตือน: ใช้ทางถอยผ่าน shell — ยังกัน %VAR% ไม่ได้ ตั้ง SKILLBENCH_CLAUDE_BIN ชี้ไปที่ไฟล์ปฏิบัติการโดยตรง');
console.log('');

let fail = 0;

console.log('1) อักขระที่ชอบทำให้ shell พัง');
for (const [name, prompt] of TRICKY) {
  const got = await roundTrip(prompt, claudeBin.mode);
  const ok = got === prompt;
  if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) {
    console.log(`         ส่งไป : ${JSON.stringify(prompt)}`);
    console.log(`         ได้รับ: ${JSON.stringify(got)?.slice(0, 160)}`);
  }
}
console.log('');

console.log('2) prompt จริงของทุก scenario');
const scDir = path.join(ROOT, 'scenarios');
for (const f of fs.readdirSync(scDir).filter((x) => x.endsWith('.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(scDir, f), 'utf8'));
  const got = await roundTrip(s.prompt, claudeBin.mode);
  const ok = got === s.prompt;
  if (!ok) fail++;
  console.log(`   ${ok ? 'PASS' : 'FAIL'}  ${s.id.padEnd(24)} ${s.prompt.length} อักขระ`);
  if (!ok) console.log(`         ได้รับ: ${JSON.stringify(got)?.slice(0, 160)}`);
}
console.log('');

fs.rmSync(dump, { force: true });

console.log(fail === 0
  ? '=== ผ่านทุกข้อ — prompt ถึงปลายทางครบทุก scenario ===\n'
  : `=== ไม่ผ่าน ${fail} ข้อ ห้ามเก็บข้อมูลจนกว่าจะแก้ ===\n`);
process.exit(fail === 0 ? 0 : 1);
