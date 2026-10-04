/**
 * S13 — REQ-19: ผู้ขอจองอนุมัติคำขอของตัวเองไม่ได้ แม้จะมีบทบาท LAB_ADMIN — ไม่มีข้อยกเว้น
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, seed, requested, iso } from './_harness.ts';

const ownRequest = (id: string, who: string) =>
  requested({ bookingId: id, userId: who, actorId: who, userRole: 'LAB_ADMIN', requiresApproval: true, startAt: iso(1, 8), endAt: iso(1, 20) });

test('REQ-19 LAB_ADMIN อนุมัติคำขอของตัวเองไม่ได้', async () => {
  await seed([ownRequest('bk-sa1', 'u-admin-9')]);
  const r = await call('POST', '/bookings/bk-sa1/approve', { userId: 'u-admin-9', userRole: 'LAB_ADMIN' });
  assert.equal(r.status, 403, `อนุมัติของตัวเองต้องได้ 403 แต่ได้ ${r.status}`);
});

test('REQ-19 ไม่มีข้อยกเว้นสำหรับผู้ใช้คนใด (รวม u-admin-0)', async () => {
  await seed([ownRequest('bk-sa2', 'u-admin-0')]);
  const r = await call('POST', '/bookings/bk-sa2/approve', { userId: 'u-admin-0', userRole: 'LAB_ADMIN' });
  assert.equal(r.status, 403, `ข้อกำหนดบอกว่า "แม้จะมีบทบาท LAB_ADMIN" ต้องได้ 403 แต่ได้ ${r.status}`);
});

test('REQ-18 LAB_ADMIN อีกคนอนุมัติได้ตามปกติ', async () => {
  await seed([ownRequest('bk-sa3', 'u-admin-0')]);
  const r = await call('POST', '/bookings/bk-sa3/approve', { userId: 'u-admin-9', userRole: 'LAB_ADMIN' });
  assert.equal(r.status < 300, true, `ผู้ดูแลคนอื่นต้องอนุมัติได้ แต่ได้ ${r.status}`);
});
