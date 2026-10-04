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

test('อ่าน event log ที่มีบรรทัดเสียได้ โดยไม่ทิ้ง event ที่ดี', async () => {
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

test('รายงานรายได้คำนวณได้แม้มีบรรทัดเสีย', async () => {
  const store = await import('../src/store/eventStore.ts');
  const { totalRevenueForMonth } = await import('../src/projections/billing.ts');
  await seed([]);
  fs.appendFileSync(store.eventLogPath(), '{"type":"Booking\n');
  try { totalRevenueForMonth(store.loadEvents(), '2026-05'); }
  catch (e: any) { assert.fail('คำนวณรายได้ไม่ได้: ' + e?.message); }
});
