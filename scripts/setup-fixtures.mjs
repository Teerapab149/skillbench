/**
 * setup-fixtures.mjs — เตรียม fixture ให้พร้อมรัน (ต้องรัน 1 ครั้งหลัง clone)
 *
 * ทำไมต้องมีขั้นตอนนี้:
 *   adapter ตัวจริงใช้ git เพื่อ (1) reset workspace ให้สะอาดก่อนทุก run
 *   และ (2) อ่านว่าเอเจนต์แก้ไฟล์อะไรไปบ้าง จาก `git status` + `git diff`
 *   ซึ่งเป็น ground truth ที่เชื่อถือได้ ไม่ใช่คำบอกเล่าของเอเจนต์เอง
 *
 *   แต่ละ fixture จึงต้องเป็น git repo ของตัวเอง — และ repo ซ้อน repo commit ไม่ได้
 *   (จะกลายเป็น gitlink ที่เสีย) เราจึงไม่ commit .git ของ fixture แต่สร้างเอาตอน setup
 *
 *   node scripts/setup-fixtures.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES = path.join(ROOT, 'fixtures');

if (!fs.existsSync(FIXTURES)) {
  console.error('ไม่พบโฟลเดอร์ fixtures/');
  process.exit(1);
}

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' });

let n = 0;
for (const name of fs.readdirSync(FIXTURES)) {
  const dir = path.join(FIXTURES, name);
  if (!fs.statSync(dir).isDirectory()) continue;

  if (fs.existsSync(path.join(dir, '.git'))) {
    console.log(`  ${name.padEnd(24)} มี git อยู่แล้ว ข้าม`);
    continue;
  }

  try {
    git(dir, ['init', '-q']);
    git(dir, ['add', '-A']);
    git(dir, ['-c', 'user.email=bench@local', '-c', 'user.name=skillbench', 'commit', '-qm', 'fixture baseline']);
    const sha = git(dir, ['rev-parse', '--short', 'HEAD']).trim();
    console.log(`  ${name.padEnd(24)} พร้อมแล้ว (baseline ${sha})`);
    n++;
  } catch (e) {
    console.error(`  ${name.padEnd(24)} ล้มเหลว: ${e.message.split('\n')[0]}`);
  }
}

console.log(`\nเตรียม fixture เสร็จ ${n} ตัว — baseline commit นี้คือสถานะที่ทุก run จะถูก reset กลับมา\n`);
