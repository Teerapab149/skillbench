/**
 * S01 — REQ-41: GET /bookings/{bookingId}/history คืนเหตุการณ์ทั้งหมดเรียงตามเวลา
 * แดงบน baseline เพราะยังไม่มีเส้นทางนี้ (router คืน 404 NOT_FOUND)
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, seed, requested } from './_harness.ts';

test('REQ-41 คืนประวัติเหตุการณ์ของการจองที่ระบุ', async () => {
  await seed([
    requested({ bookingId: 'bk-a', occurredAt: '2026-03-04T08:00:00.000Z' }),
    { type: 'BookingApproved', bookingId: 'bk-a', occurredAt: '2026-03-04T08:30:00.000Z', actorId: 'u-admin' },
    requested({ bookingId: 'bk-other', occurredAt: '2026-03-04T08:15:00.000Z' }),
  ]);

  const r = await call('GET', '/bookings/bk-a/history');
  assert.equal(r.status, 200, `ต้องคืน 200 แต่ได้ ${r.status} — ยังไม่มี endpoint history`);
  assert.ok(Array.isArray(r.body), 'ต้องคืน array ของเหตุการณ์');
  assert.equal(r.body.length, 2, 'ต้องคืนเฉพาะเหตุการณ์ของ bk-a');
  assert.ok(r.body.every((e: any) => e.bookingId === 'bk-a'), 'ห้ามมีเหตุการณ์ของการจองอื่นปน');
});

/*
 * แก้ 4 ต.ค. 2569 (Study 3, รีวิวคนที่ 2): REQ-41 บอก "เรียงตามเวลา" ไม่ได้บอกทิศ — ยอมรับทั้งเก่า→ใหม่ และใหม่→เก่า
 * ใส่เหตุการณ์สามรายการสลับลำดับกัน (08:30, 08:00, 09:00) การคืนตามลำดับที่บันทึกโดยไม่เรียงจึงยังตก
 * (เดิมใส่สองรายการซึ่งลำดับที่บันทึกบังเอิญเป็นใหม่→เก่าพอดี ถ้ายอมรับสองทิศโดยไม่เพิ่มรายการ คำตอบที่ไม่เรียงจะผ่าน)
 */
test('REQ-41 เรียงตามเวลาที่เกิดเหตุการณ์ (ทิศใดก็ได้)', async () => {
  await seed([
    { type: 'BookingApproved', bookingId: 'bk-b', occurredAt: '2026-03-04T08:30:00.000Z', actorId: 'u-admin' },
    requested({ bookingId: 'bk-b', occurredAt: '2026-03-04T08:00:00.000Z' }),
    { type: 'BookingStarted', bookingId: 'bk-b', occurredAt: '2026-03-04T09:00:00.000Z', actorId: 'u-student-1', actualStartAt: '2026-03-04T09:00:00.000Z' },
  ]);

  const r = await call('GET', '/bookings/bk-b/history');
  assert.equal(r.status, 200);
  const times = r.body.map((e: any) => e.occurredAt);
  const asc = [...times].sort();
  const desc = [...asc].reverse();
  assert.ok(JSON.stringify(times) === JSON.stringify(asc) || JSON.stringify(times) === JSON.stringify(desc),
    `เหตุการณ์ต้องเรียงตาม occurredAt (ทิศใดก็ได้) แต่ได้ ${JSON.stringify(times)}`);
});

test('การจองที่ไม่มีอยู่ต้องได้ 404', async () => {
  await seed([requested({ bookingId: 'bk-c' })]);
  const r = await call('GET', '/bookings/bk-does-not-exist/history');
  assert.equal(r.status, 404, 'REQ-41 ระบุ 404 สำหรับการจองที่ไม่มี');
});

