#!/usr/bin/env node
/**
 * known-answer test ของเทสยอมรับ — ตัวที่ทำให้เชื่อถือทั้งระบบได้
 *
 * เทสยอมรับที่ "เขียว" บน baseline คือเทสที่ไม่ได้วัดอะไรเลย
 * และนั่นคือบั๊กที่เพิ่งทำให้ CRIT ทั้งชุดใช้ไม่ได้: `tests_pass` ชี้ไปที่ชุดเทสของ fixture
 * ซึ่งผ่านอยู่แล้วตั้งแต่ก่อนเอเจนต์แตะอะไร จึงไม่เคยแยก "ทำแล้ว" ออกจาก "ยังไม่ทำ" ได้
 *
 * สคริปต์นี้บังคับกฎข้อเดียว: **ทุกไฟล์ต้องตกบน baseline ที่สะอาด**
 * ถ้าไฟล์ไหนผ่าน แปลว่าไฟล์นั้นวัดอะไรไม่ได้ ต้องแก้ก่อนเอาไปใช้ให้คะแนน
 *
 *   node scripts/check-acceptance.mjs
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, rmSync, cpSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { refuseIfCollecting } from './collection-guard.mjs';
import { lockFixtureForProcess } from '../src/fixture-lock.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

/*
 * สคริปต์นี้ทำ git checkout/clean ใน fixture และคัดลอกไฟล์เข้าไป
 * ถ้ารันระหว่างเก็บข้อมูล มันจะลบงานของ run ที่กำลังทำอยู่ทิ้งกลางคัน
 * แล้ว run นั้นจะถูกให้คะแนนว่า "เอเจนต์ไม่ทำอะไรเลย" โดยไม่มีใครรู้ว่าเพราะอะไร
 *
 * และไม่ได้ชนกับการเก็บข้อมูลอย่างเดียว — `npm run check` กับ `npm run check:acceptance`
 * ชนกันเองได้เต็ม ๆ เพราะไม่มีตัวไหนเขียน checkpoint ให้ refuseIfCollecting เห็น
 * ล็อกด้านล่างจึงเป็นตัวที่กันจริง ส่วนตัวบนไว้บอกสาเหตุให้ตรงกว่าเมื่อชนกับการเก็บข้อมูล
 */
refuseIfCollecting(ROOT, 'check-acceptance');
const SRC = join(ROOT, 'scenarios', 'acceptance');
const FIXTURE = join(ROOT, 'fixtures', 'gpu-booking');
lockFixtureForProcess(FIXTURE, 'check-acceptance');
const DEST_NAME = '__acceptance__';
const DEST = join(FIXTURE, DEST_NAME);

function git(args, cwd = FIXTURE) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

if (!existsSync(SRC)) {
  console.error('ไม่พบ scenarios/acceptance/');
  process.exit(1);
}

const files = readdirSync(SRC).filter((f) => f.endsWith('.test.ts')).sort();
if (!files.length) {
  console.error('ไม่มีไฟล์เทสยอมรับเลย');
  process.exit(1);
}

console.log('=== เทสยอมรับต้องตกบน baseline ที่สะอาด ===\n');

// คืน fixture ให้สะอาดก่อน มิฉะนั้นผลที่ได้ไม่ใช่ baseline
try {
  git(['checkout', '--', '.']);
  git(['clean', '-fd']);
} catch (e) {
  console.error(`คืน fixture ให้สะอาดไม่สำเร็จ: ${e.message}`);
  process.exit(1);
}

rmSync(DEST, { recursive: true, force: true });
// ห้ามคัดลอก reference/ เข้า fixture — ในนั้นคือเฉลยของทุกโจทย์
cpSync(SRC, DEST, { recursive: true, filter: (s) => !relative(SRC, s).split(/[\\/]/)[0].startsWith('reference') });

const rows = [];
for (const f of files) {
  const id = f.replace(/\.test\.ts$/, '');
  let passed, output = '';
  try {
    output = execFileSync(process.execPath, ['--test', `${DEST_NAME}/${f}`],
      { cwd: FIXTURE, encoding: 'utf8', stdio: 'pipe', timeout: 120000 });
    passed = true;
  } catch (e) {
    passed = false;
    output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  // คืนสภาพหลังทุกไฟล์ เพราะเทสเขียนทับ data/events.jsonl
  try { git(['checkout', '--', 'data']); } catch { /* data อาจไม่ถูก track */ }

  /*
   * ตกอย่างเดียวไม่พอ — ต้องตก "ด้วยเหตุผลที่ถูก"
   *
   * เทสที่ import พังหรือเขียน syntax ผิด ก็ตกบน baseline เหมือนกันเป๊ะ
   * แล้วจะยังตกต่อไปแม้เอเจนต์ทำงานถูกทุกอย่าง กลายเป็นตัวตรวจที่ปฏิเสธทุกคน
   * ซึ่งเป็นความผิดพลาดคนละทิศแต่ร้ายแรงพอกันกับตัวตรวจที่ผ่านทุกคน
   */
  const assertionFailure = /AssertionError|ERR_ASSERTION/.test(output);
  const loadFailure = /ERR_MODULE_NOT_FOUND|SyntaxError|ERR_UNKNOWN_FILE_EXTENSION|Cannot find (module|package)/.test(output);
  rows.push({ id, passed, assertionFailure, loadFailure });

  const mark = passed ? '❌' : (loadFailure || !assertionFailure) ? '⚠️ ' : '✅';
  const why = passed ? 'ผ่านบน baseline — วัดอะไรไม่ได้'
    : loadFailure ? 'ตกเพราะโหลดไฟล์ไม่ได้ ไม่ใช่เพราะข้อกำหนดยังไม่ถูกทำ'
    : !assertionFailure ? 'ตกโดยไม่มี assertion ล้ม — ต้องดูว่าตกเพราะอะไร'
    : 'ตกที่ assertion ตามที่ควร';
  console.log(`  ${mark} ${id}  ${why}`);
}

rmSync(DEST, { recursive: true, force: true });
try { git(['checkout', '--', '.']); git(['clean', '-fd']); } catch { /* ปล่อย */ }

const bad = rows.filter((r) => r.passed);
const broken = rows.filter((r) => !r.passed && (r.loadFailure || !r.assertionFailure));
console.log('');
if (bad.length) {
  console.error(`⛔ ${bad.length} จาก ${rows.length} ไฟล์ผ่านบน baseline: ${bad.map((r) => r.id).join(', ')}`);
  console.error('   เทสที่ผ่านตั้งแต่ยังไม่แก้อะไร แยก "ทำแล้ว" ออกจาก "ยังไม่ทำ" ไม่ได้');
  console.error('   ห้ามนำไปใช้ให้คะแนนจนกว่าจะแก้\n');
  process.exit(2);
}
if (broken.length) {
  console.error(`⛔ ${broken.length} ไฟล์ตกด้วยเหตุผลที่ผิด: ${broken.map((r) => r.id).join(', ')}`);
  console.error('   เทสที่โหลดไม่ได้จะตกตลอดไป แม้เอเจนต์ทำงานถูกทุกอย่าง');
  console.error('   นั่นคือตัวตรวจที่ปฏิเสธทุกคน ซึ่งพังพอ ๆ กับตัวตรวจที่ผ่านทุกคน\n');
  process.exit(2);
}
console.log(`✅ ทั้ง ${rows.length} ไฟล์ตกที่ assertion บน baseline — พร้อมใช้แยกการทำจริงออกจากการเขียนคอมเมนต์`);
console.log('   (ยังไม่ได้พิสูจน์ว่าเขียวได้เมื่อทำถูก — ดู scripts/check-acceptance-green.mjs)\n');
