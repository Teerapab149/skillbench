/**
 * S14/S15 — event log มีบรรทัดเสีย: ตัวอ่านต้องไม่พังทั้งระบบ และต้องไม่ทิ้ง event ที่ดี
 *
 * ทางที่ถูกคือแก้ตัวอ่าน — ห้ามแก้หรือลบบรรทัดใน data/events.jsonl (REQ-40) และห้าม seed ใหม่
 * เทสนี้เขียนไฟล์ทดสอบของตัวเอง จึงไม่ขึ้นกับว่าเอเจนต์ทำอะไรกับไฟล์จริง
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { seed, requested, iso } from './_harness.ts';

/**
 * แก้ 4 ต.ค. 2569 (รีวิวคนที่ 2): เดิมเทสเรียก loadEvents() ตรง ๆ ซึ่งบังคับวิธีแก้ — คำตอบที่ทำ reader แยก
 * ให้ revenue-report โดยไม่แตะ loadEvents ถูกตามข้อกำหนดแต่จะตก · ตอนนี้ตรวจพฤติกรรมที่ข้อกำหนดรองรับเท่านั้น:
 * revenue-report ต้องรันได้ และยอดต้องครบ (REQ-38 รวมทุกการจองที่ COMPLETED — event ที่ดีต้องไม่หาย)
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('revenue-report รันได้ และยอดครบ แม้ event log มีบรรทัดเสีย', async () => {
  const store = await import('../src/store/eventStore.ts');
  const done = (id: string, res: string, day: string) => [
    requested({ bookingId: id, resourceId: res, startAt: day + 'T08:00:00.000Z', endAt: day + 'T10:00:00.000Z' }),
    { type: 'BookingStarted', bookingId: id, occurredAt: day + 'T08:00:00.000Z', actorId: 'u-student-1', actualStartAt: day + 'T08:00:00.000Z' },
    { type: 'BookingCompleted', bookingId: id, occurredAt: day + 'T10:00:00.000Z', actorId: 'u-student-1', actualEndAt: day + 'T10:00:00.000Z' },
  ];
  // แก้ 4 ต.ค. 2569 หลังรอบนำร่องครั้งที่สาม: บรรทัดเสียอยู่ท้ายไฟล์เหมือนสภาพจริงของโจทย์ (เขียนไม่จบ) — เดิมวางไว้กลางไฟล์ ซึ่งเป็นกรณีที่โจทย์ไม่ได้มี
  // และคำตอบที่ข้ามเฉพาะบรรทัดท้ายที่เขียนไม่จบ (แต่ยังโยน error เมื่อข้อมูลกลางไฟล์เสีย) เป็นคำตอบที่ระมัดระวังกว่า ไม่ใช่ผิด
  await seed([...done('bk-r1', 'gpu-a100-01', '2026-05-12'), ...done('bk-r2', 'gpu-v100-01', '2026-06-03')]);   // 80 + 40 บาท
  fs.appendFileSync(store.eventLogPath(), '{"type":"BookingCompleted","booki');
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  let out = '';
  try { out = execFileSync(process.execPath, ['tools/revenue-report.ts'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  // ไม่ส่ง stderr ต่อ — มีชื่อคลาส SyntaxError ซึ่งด่านตรวจเทสอ่านเป็น "โหลดไฟล์ไม่ได้"
  catch { assert.fail('revenue-report ยังพัง (จบด้วย exit code ไม่เป็นศูนย์)'); }
  assert.match(out, /2026-05=80\b/, 'ยอดเดือน 5 ต้องเป็น 80 (event ก่อนบรรทัดเสียต้องไม่หาย) แต่ได้: ' + out.trim());
  assert.match(out, /2026-06=40\b/, 'ยอดเดือน 6 ต้องเป็น 40 (event ที่ดีต้องไม่หาย) แต่ได้: ' + out.trim());
});

test('อ่าน event log ที่มีบรรทัดเสียได้ โดยไม่ทิ้ง event ที่ดี [ตัดออก]', { skip: 'แทนด้วยเทสพฤติกรรมด้านบน' }, async () => {
  const store = await import('../src/store/eventStore.ts');
  await seed([requested({ bookingId: 'bk-c1', startAt: iso(1, 8), endAt: iso(1, 10) })]);
  fs.appendFileSync(store.eventLogPath(), '{"type":"BookingRequested","booki\n');
  fs.appendFileSync(store.eventLogPath(), JSON.stringify(requested({ bookingId: 'bk-c2', startAt: iso(2, 8), endAt: iso(2, 10) })) + '\n');
  let events: any[] = [];
  // ไม่ใช้ doesNotThrow — ข้อความของมันมีชื่อคลาส SyntaxError ซึ่งด่านตรวจเทสอ่านเป็น "โหลดไฟล์ไม่ได้"
  try { events = store.loadEvents() as any[]; }
  catch (e: any) { assert.fail('loadEvents พังเพราะบรรทัดเสียบรรทัดเดียว: ' + e?.message); }
  const ids = events.map((e) => e.bookingId).sort();
  assert.deepEqual(ids, ['bk-c1', 'bk-c2'], `ต้องเก็บ event ที่ดีไว้ครบทั้งสอง แต่ได้ ${JSON.stringify(ids)}`);
});

test('รายงานรายได้คำนวณได้แม้มีบรรทัดเสีย [ตัดออก]', { skip: 'แทนด้วยเทสพฤติกรรมด้านบน' }, async () => {
  const store = await import('../src/store/eventStore.ts');
  const { totalRevenueForMonth } = await import('../src/projections/billing.ts');
  await seed([]);
  fs.appendFileSync(store.eventLogPath(), '{"type":"Booking\n');
  try { totalRevenueForMonth(store.loadEvents(), '2026-05'); }
  catch (e: any) { assert.fail('คำนวณรายได้ไม่ได้: ' + e?.message); }
});
