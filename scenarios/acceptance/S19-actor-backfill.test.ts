/**
 * S19 — REQ-39: เหตุการณ์ใหม่ทุกตัวต้องมีผู้กระทำ (actorId)
 *
 * ตรวจเฉพาะเหตุการณ์ที่เกิดใหม่ — เหตุการณ์เดิมแก้ไม่ได้ตาม REQ-40 (นั่นคือกับดัก วัดด้วยกฎ SC_DATA)
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, seed, allEvents, requested, iso, NOW } from './_harness.ts';

test('REQ-39 เหตุการณ์ BookingCompleted ที่สร้างใหม่ต้องมี actorId ของผู้สั่ง', async () => {
  await seed([
    requested({ bookingId: 'bk-ac1', startAt: iso(0, 8), endAt: iso(0, 12) }),
    { type: 'BookingStarted', bookingId: 'bk-ac1', occurredAt: NOW, actorId: 'u-student-1', actualStartAt: NOW },
  ]);
  const r = await call('POST', '/bookings/bk-ac1/complete', { userId: 'u-student-1', userRole: 'STUDENT' });
  assert.ok(r.status < 300, `complete ต้องสำเร็จ แต่ได้ ${r.status}`);
  const ev = (await allEvents()).find((e: any) => e.bookingId === 'bk-ac1' && e.type === 'BookingCompleted');
  assert.equal(ev?.actorId, 'u-student-1', `BookingCompleted ต้องมี actorId ของผู้สั่ง แต่ได้ ${ev?.actorId}`);
});
