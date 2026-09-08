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
console.log(`ไฟล์ล็อก: ${lockPathFor(FIXTURE)}\n`);

if (!holder) {
  console.log('  ว่าง — ไม่มีใครถืออยู่\n');
  process.exit(0);
}

const mins = (holder.ageMs / 60000).toFixed(1);
console.log(`  ถือโดย : ${holder.info?.owner ?? '(ไม่ทราบ)'}  pid ${holder.info?.pid ?? '?'} บนเครื่อง ${holder.info?.hostname ?? '?'}`);
console.log(`  เริ่ม  : ${holder.info?.startedAt ?? '(ไม่ทราบ)'}  (${mins} นาทีที่แล้ว)`);
if (holder.info?.command) console.log(`  คำสั่ง : ${holder.info.command}`);
console.log(`  สถานะ : ${holder.reason}`);
console.log(`  แกะได้ : ${holder.stale ? 'ได้ — เจ้าของไม่อยู่แล้ว' : 'ไม่ได้ — ต้องรอ'}\n`);

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
console.error('  ถ้าแน่ใจว่าเจ้าของตายไปแล้วและ pid ถูกใช้ซ้ำ ให้สั่ง --break --force');
console.error('  เดาผิดเมื่อไร งานของ run ที่กำลังเดินอยู่จะถูกลบทิ้งกลางคัน\n');
process.exit(1);
