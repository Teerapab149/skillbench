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
import { BASELINE_TAG } from '../src/install-arm.mjs';

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

  const hasGit = fs.existsSync(path.join(dir, '.git'));

  try {
    if (!hasGit) {
      git(dir, ['init', '-q']);
      // ปิดการแปลง line ending — บน Windows ถ้าเปิดไว้ การ checkout จะเขียนไฟล์ใหม่เป็น CRLF
      // ทำให้ git status ขึ้นว่าไฟล์ถูกแก้ทั้งที่เอเจนต์ไม่ได้แตะ -> filesChanged เพี้ยนทุก run
      git(dir, ['config', 'core.autocrlf', 'false']);
      git(dir, ['add', '-A']);
      git(dir, ['-c', 'user.email=bench@local', '-c', 'user.name=skillbench', 'commit', '-qm', 'fixture baseline']);
    }

    // tag baseline — จุดที่ทุก run จะถูกพากลับมา
    // ต้องเป็น tag ไม่ใช่ HEAD เพราะกฎข้อหนึ่งที่วัดคือ "ห้าม git commit เอง"
    // ถ้าเอเจนต์ commit จริงแล้วเรา reset ไปที่ HEAD commit นั้นจะค้างและปนเปื้อนทุก run ถัดไป
    const tagged = git(dir, ['tag', '-l', BASELINE_TAG]).trim();
    if (!tagged) git(dir, ['tag', BASELINE_TAG]);

    const sha = git(dir, ['rev-parse', '--short', BASELINE_TAG]).trim();
    console.log(`  ${name.padEnd(24)} ${hasGit ? 'มี git อยู่แล้ว' : 'พร้อมแล้ว'} (baseline ${sha}${tagged ? '' : ' + ติด tag ใหม่'})`);
    n++;
  } catch (e) {
    console.error(`  ${name.padEnd(24)} ล้มเหลว: ${e.message.split('\n')[0]}`);
  }
}

console.log(`\nเตรียม fixture เสร็จ ${n} ตัว — baseline commit นี้คือสถานะที่ทุก run จะถูก reset กลับมา\n`);
