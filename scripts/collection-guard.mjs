/**
 * collection-guard.mjs — กันไม่ให้เครื่องมือที่แตะ fixture ไปชนกับการเก็บข้อมูลที่กำลังเดินอยู่
 *
 * ปัญหาจริงที่กันไว้: `check-arms`, `arms:doc`, `arms:dump` ทุกตัวติดตั้ง arm ลง
 * `fixtures/gpu-booking` แล้วถอนออก ซึ่งเป็นโฟลเดอร์เดียวกับที่ runner กำลังใช้อยู่
 * ถ้ารันทับกันระหว่างเก็บข้อมูล จะเกิดสองอย่างพร้อมกัน:
 *
 *   1. run ที่กำลังทำงานอยู่ถูกรีเซ็ต workspace กลางคัน -> ผลของ run นั้นเชื่อไม่ได้
 *   2. ไฟล์ของ arm ที่เครื่องมือติดตั้งค้างไว้ อาจถูกนับเป็นผลงานของเอเจนต์ใน run ถัดไป
 *      ซึ่งจะทำให้ตัวชี้วัดการทำงานเกินขอบเขตเป็นบวกปลอมทุก run
 *
 * ตรวจโดยดู mtime ของ checkpoint แทนการใช้ไฟล์ล็อก เพราะไม่ต้องแตะ runner.mjs
 * ซึ่งอยู่ใน digest ของการทดลอง — การแก้ไฟล์นั้นระหว่างเก็บข้อมูลจะทำให้การรันหยุดทันที
 */

import fs from 'node:fs';
import path from 'node:path';

const STALE_MINUTES = 20;

/** คืนข้อมูลการเก็บที่ยังเดินอยู่ ถ้าไม่มีคืน null */
export function activeCollection(root) {
  const dir = path.join(root, 'results');
  if (!fs.existsSync(dir)) return null;
  let newest = null;
  for (const f of fs.readdirSync(dir)) {
    if (!f.startsWith('checkpoint-') || f.includes('retired')) continue;
    const p = path.join(dir, f);
    const m = fs.statSync(p).mtimeMs;
    if (!newest || m > newest.mtimeMs) newest = { file: f, path: p, mtimeMs: m };
  }
  if (!newest) return null;
  const ageMin = (Date.now() - newest.mtimeMs) / 60000;
  if (ageMin > STALE_MINUTES) return null;

  let done = null, total = null;
  try {
    const ck = JSON.parse(fs.readFileSync(newest.path, 'utf8'));
    done = ck.artifacts?.length ?? null;
  } catch { /* อ่านไม่ได้ก็ยังถือว่ากำลังเดิน เพราะ mtime สด */ }
  return { ...newest, ageMin, done, total };
}

/**
 * เรียกที่ต้นสคริปต์ที่จะแตะ fixture — ถ้ามีการเก็บข้อมูลเดินอยู่ให้หยุดทันที
 * ข้ามได้ด้วย --force สำหรับกรณีที่รู้ตัวว่า checkpoint ค้างจากการรันที่ตายไปแล้ว
 */
export function refuseIfCollecting(root, toolName) {
  if (process.argv.includes('--force')) {
    console.error(`  ⚠️  ${toolName}: ข้ามการตรวจด้วย --force — ถ้ามีการเก็บข้อมูลเดินอยู่ ผลของ run นั้นจะเชื่อไม่ได้\n`);
    return;
  }
  const act = activeCollection(root);
  if (!act) return;
  console.error(`\n⛔ ${toolName} ถูกปฏิเสธ — มีการเก็บข้อมูลกำลังเดินอยู่`);
  console.error(`   ${act.file} ถูกเขียนเมื่อ ${act.ageMin.toFixed(1)} นาทีที่แล้ว`
    + (act.done !== null ? ` · เก็บไปแล้ว ${act.done} run` : ''));
  console.error('');
  console.error('   เครื่องมือนี้ติดตั้ง arm ลง fixtures/gpu-booking ซึ่งเป็นโฟลเดอร์เดียวกับที่ runner ใช้อยู่');
  console.error('   ถ้ารันทับกัน run ที่กำลังทำงานจะถูกรีเซ็ต workspace กลางคัน และผลของมันจะเชื่อไม่ได้');
  console.error('');
  console.error('   รอให้เก็บข้อมูลจบก่อน แล้วค่อยรันใหม่');
  console.error(`   ถ้าแน่ใจว่า checkpoint ค้างจากการรันที่ตายไปแล้ว ให้ใส่ --force\n`);
  process.exit(3);
}
