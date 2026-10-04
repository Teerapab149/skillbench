/**
 * S12 — REQ-22: คำขอที่ยังไม่ได้รับอนุมัติเมื่อถึง startAt ต้องเป็น REJECTED พร้อมเหตุผล "approval timeout"
 *
 * ตรวจเฉพาะสิ่งที่ข้อกำหนดบอกชัด — ไม่ตรวจค่า actorId (ข้อกำหนดไม่ได้บอก นั่นคือกับดัก)
 * และไม่ตรวจการจองที่ไม่ต้องอนุมัติ (ข้อกำหนดไม่ได้พูดถึง)
 * now = พุธ 4 มี.ค. 2026 09:00Z
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, seed, allEvents, requested, iso } from './_harness.ts';

const ADMIN = { userId: 'u-admin-9', userRole: 'LAB_ADMIN' };

test('REQ-22 เลยเวลาเริ่มแล้วยังไม่ได้รับอนุมัติ ต้องเป็น REJECTED เหตุผล approval timeout', async () => {
  await seed([requested({ bookingId: 'bk-to1', requiresApproval: true, startAt: iso(0, 8), endAt: iso(0, 20) })]);
  await call('POST', '/jobs/expire-approvals', ADMIN);
  const r = await call('GET', '/bookings/bk-to1');
  assert.equal(r.body?.status, 'REJECTED', `สถานะต้องเป็น REJECTED แต่ได้ ${r.body?.status}`);
  assert.equal(r.body?.rejectionReason, 'approval timeout', `เหตุผลต้องเป็น "approval timeout" แต่ได้ ${r.body?.rejectionReason}`);
});

test('REQ-22 ยังไม่ถึงเวลาเริ่ม ต้องยังรออนุมัติอยู่', async () => {
  await seed([requested({ bookingId: 'bk-to2', requiresApproval: true, startAt: iso(1, 8), endAt: iso(1, 20) })]);
  await call('POST', '/jobs/expire-approvals', ADMIN);
  const r = await call('GET', '/bookings/bk-to2');
  assert.equal(r.body?.status, 'REQUESTED', `ยังไม่ถึงเวลา ต้องเป็น REQUESTED แต่ได้ ${r.body?.status}`);
});

test('REQ-22 + REQ-39 การปฏิเสธอัตโนมัติต้องถูกบันทึกเป็นเหตุการณ์', async () => {
  await seed([requested({ bookingId: 'bk-to3', requiresApproval: true, startAt: iso(0, 7), endAt: iso(0, 19) })]);
  await call('POST', '/jobs/expire-approvals', ADMIN);
  const ev = (await allEvents()).find((e: any) => e.bookingId === 'bk-to3' && e.type === 'BookingRejected');
  assert.ok(ev, 'ต้องมีเหตุการณ์ BookingRejected ใน event log ไม่ใช่แค่คำนวณสถานะตอนอ่าน');
  assert.equal(ev.reason, 'approval timeout');
  assert.ok(ev.occurredAt, 'เหตุการณ์ต้องมี occurredAt ตาม REQ-39');
});
