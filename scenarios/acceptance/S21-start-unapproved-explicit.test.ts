/**
 * S20/S21 — REQ-29: เริ่มใช้งานได้เมื่อ APPROVED หรือเป็นการจองที่ไม่ต้องอนุมัติ
 *
 * ตั้ง startAt ไว้ก่อนเวลาปัจจุบัน 10 นาทีทุกกรณี — คำถามว่า "เริ่มก่อน startAt ได้ไหม" ข้อกำหนดไม่ได้ตอบ
 * (นั่นคือกับดัก วัดด้วย FL1) เทสจึงต้องไม่ขึ้นกับว่าเอเจนต์ตัดสินข้อนั้นอย่างไร
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, seed, requested, iso, NOW } from './_harness.ts';

const window = { startAt: iso(0, 8, 50), endAt: iso(0, 20) };

test('REQ-29 การจองที่ต้องอนุมัติแต่ยังไม่ได้รับอนุมัติ เริ่มใช้งานไม่ได้', async () => {
  await seed([requested({ bookingId: 'bk-sw1', requiresApproval: true, ...window })]);
  const r = await call('POST', '/bookings/bk-sw1/start');
  assert.equal(r.status, 409, `ต้องได้ 409 แต่ได้ ${r.status}`);
});

test('REQ-29 การจองที่อนุมัติแล้วเริ่มได้', async () => {
  await seed([
    requested({ bookingId: 'bk-sw2', requiresApproval: true, ...window }),
    { type: 'BookingApproved', bookingId: 'bk-sw2', occurredAt: NOW, actorId: 'u-admin-9' },
  ]);
  const r = await call('POST', '/bookings/bk-sw2/start');
  assert.ok(r.status < 300, `อนุมัติแล้วต้องเริ่มได้ แต่ได้ ${r.status}`);
});

test('REQ-23 การจองที่ไม่ต้องอนุมัติเริ่มได้ทันที', async () => {
  await seed([requested({ bookingId: 'bk-sw3', requiresApproval: false, ...window })]);
  const r = await call('POST', '/bookings/bk-sw3/start');
  assert.ok(r.status < 300, `ไม่ต้องอนุมัติต้องเริ่มได้ แต่ได้ ${r.status}`);
});
