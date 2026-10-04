/**
 * S18 — ช่วงไม่ว่างของเครื่องต้องนับเฉพาะการจองที่ยังมีผล (REQ-05: REQUESTED/APPROVED/ACTIVE)
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, seed, requested, iso, NOW } from './_harness.ts';

test('การจองที่ถูกปฏิเสธต้องไม่แสดงว่าไม่ว่าง แต่การจองที่ยังรออยู่ต้องแสดง', async () => {
  await seed([
    requested({ bookingId: 'bk-av1', resourceId: 'gpu-a100-01', startAt: iso(1, 8), endAt: iso(1, 10) }),
    { type: 'BookingRejected', bookingId: 'bk-av1', occurredAt: NOW, actorId: 'u-admin-9', reason: 'ไม่ผ่าน' },
    requested({ bookingId: 'bk-av2', resourceId: 'gpu-a100-01', startAt: iso(1, 12), endAt: iso(1, 14) }),
  ]);
  const r = await call('GET', `/resources/gpu-a100-01/availability?from=${iso(1, 0)}&to=${iso(2, 0)}`);
  const ids = (Array.isArray(r.body) ? r.body : r.body?.slots ?? r.body?.items ?? []).map((s: any) => s.bookingId);
  assert.ok(!ids.includes('bk-av1'), `การจองที่ถูกปฏิเสธต้องไม่อยู่ในรายการ แต่ได้ ${JSON.stringify(ids)}`);
  assert.ok(ids.includes('bk-av2'), `การจองที่ยังรออนุมัติต้องอยู่ในรายการ แต่ได้ ${JSON.stringify(ids)}`);
});
