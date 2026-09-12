#!/usr/bin/env node
/**
 * fixture-lock.mjs (สคริปต์) — ดูว่าใครถือล็อก fixture อยู่ และแกะล็อกค้างด้วยมือ
 *
 *   node scripts/fixture-lock.mjs            ดูสถานะ
 *   node scripts/fixture-lock.mjs --break    แกะล็อกที่เจ้าของตายไปแล้ว
 *   node scripts/fixture-lock.mjs --break --force
 *
 * --force มีไว้สำหรับกรณีที่ pid ถูกใช้ซ้ำโดยโปรเซสอื่น ซึ่งทำให้ระบบเห็นว่า
 * "เจ้าของยังอยู่" ทั้งที่ตายไปแล้ว เป็นการตัดสินใจของคน ไม่ใช่ของสคริปต์
 * จึงต้องพิมพ์สั่งเอง และมีคำเตือนว่าถ้าเดาผิดจะไปลบงานของ run ที่กำลังเดินอยู่
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectLock, breakLock, lockPathFor } from '../src/fixture-lock.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = path.join(ROOT, 'fixtures', 'gpu-booking');

const wantBreak = process.argv.includes('--break');
const force = process.argv.includes('--force');

const holder = inspectLock(FIXTURE);
console.log(`\nfixture : ${FIXTURE}`);
console.log(`ไฟล์ล็อก: ${holder?.lockPath ?? lockPathFor(FIXTURE)}\n`);

if (!holder) {
  console.log('  ว่าง — ไม่มีใครถืออยู่\n');
  process.exit(0);
}

const mins = (holder.ageMs / 60000).toFixed(1);
console.log(`  ถือโดย : ${holder.info?.owner ?? '(ไม่ทราบ)'}  pid ${holder.info?.pid ?? '?'} บนเครื่อง ${holder.info?.hostname ?? '?'}`);
console.log(`  เริ่ม  : ${holder.info?.startedAt ?? '(ไม่ทราบ)'}  (${mins} นาทีที่แล้ว)`);
if (holder.info?.command) console.log(`  คำสั่ง : ${holder.info.command}`);
console.log(`  สถานะ : ${holder.reason}`);
console.log(`  แกะปกติ: ${holder.stale ? 'ได้ — เจ้าของไม่อยู่แล้ว' : 'ไม่ได้ — ต้องรอหรือยืนยันแล้วใช้ --force'}\n`);

if (!wantBreak) {
  if (holder.stale) console.log('  แกะด้วย: node scripts/fixture-lock.mjs --break\n');
  process.exit(0);
}

const r = breakLock(FIXTURE, { force });
if (r.broken) {
  console.log(`  แกะแล้ว (${r.reason})${force && !r.holder?.stale ? ' — ด้วย --force ทั้งที่ระบบเห็นว่าเจ้าของยังอยู่' : ''}\n`);
  process.exit(0);
}
console.error(`  ไม่แกะให้ — ${r.reason}`);
if (holder.format === 'legacy-file') {
  console.error('  ล็อก schema เก่าต้องเอาออกใน maintenance window หลังหยุด SkillBench รุ่นเก่าทุก process');
} else {
  console.error('  ถ้าแน่ใจว่าไม่มีเจ้าของจริง (เช่น pid ถูกใช้ซ้ำ/metadata เสีย) ให้สั่ง --break --force');
  console.error('  force ยังตรวจ owner token ซ้ำ และจะไม่ย้าย replacement owner\n');
}
process.exit(1);
