/**
 * S22 — REQ-21: การปฏิเสธต้องระบุเหตุผล · ไม่ตรวจ REQ-20 (ผู้ใช้สั่งให้รอรอบหน้า)
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, seed, requested } from './_harness.ts';

const ADMIN = { userId: 'u-admin-9', userRole: 'LAB_ADMIN' };

test('REQ-21 ปฏิเสธโดยไม่ระบุเหตุผล ต้องได้ 400', async () => {
  await seed([requested({ bookingId: 'bk-rj1', requiresApproval: true })]);
  const r = await call('POST', '/bookings/bk-rj1/reject', { ...ADMIN, body: {} });
  assert.equal(r.status, 400, `ต้องได้ 400 แต่ได้ ${r.status}`);
  // แก้ 4 ต.ค. 2569 หลังรอบนำร่องครั้งที่สาม: เดิมตรวจเหตุผลที่เป็นช่องว่างล้วนด้วย ซึ่งเกิน AC ของ REQ-21 ("ไม่ส่ง reason → 400")
});

test('REQ-21 ระบุเหตุผลแล้วปฏิเสธได้', async () => {
  await seed([requested({ bookingId: 'bk-rj2', requiresApproval: true })]);
  const r = await call('POST', '/bookings/bk-rj2/reject', { ...ADMIN, body: { reason: 'เครื่องไม่ว่าง' } });
  assert.ok(r.status < 300, `ต้องปฏิเสธได้ แต่ได้ ${r.status}`);
});
