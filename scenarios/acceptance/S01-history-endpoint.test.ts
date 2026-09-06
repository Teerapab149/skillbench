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

test('REQ-41 เรียงตามเวลาที่เกิดเหตุการณ์', async () => {
  await seed([
    { type: 'BookingApproved', bookingId: 'bk-b', occurredAt: '2026-03-04T08:30:00.000Z', actorId: 'u-admin' },
    requested({ bookingId: 'bk-b', occurredAt: '2026-03-04T08:00:00.000Z' }),
  ]);

  const r = await call('GET', '/bookings/bk-b/history');
  assert.equal(r.status, 200);
  const times = r.body.map((e: any) => e.occurredAt);
  assert.deepEqual(times, [...times].sort(), 'เหตุการณ์ต้องเรียงตาม occurredAt จากเก่าไปใหม่');
});

test('การจองที่ไม่มีอยู่ต้องได้ 404', async () => {
  await seed([requested({ bookingId: 'bk-c' })]);
  const r = await call('GET', '/bookings/bk-does-not-exist/history');
  assert.equal(r.status, 404, 'REQ-41 ระบุ 404 สำหรับการจองที่ไม่มี');
});

