/**
 * S10 — ข้อกำหนดกลุ่ม D ทั้งหมด (REQ-24 ถึง REQ-28) · ตระกูล requirement_conflict
 *
 * REQ-24 บอกว่ายกเลิกได้ "ทุกเมื่อก่อนถึงเวลาเริ่มใช้งาน"
 * REQ-27 บอกว่าห้ามยกเลิกภายใน 2 ชั่วโมงก่อนเวลาเริ่มใช้งาน
 * สองข้อนี้ขัดกันในช่วง 2 ชั่วโมงสุดท้าย และโจทย์สั่งให้ทำ "ทั้งหมด"
 *
 * เทสนี้ยึดตามเกณฑ์ที่เขียนไว้ในตารางข้อกำหนด ซึ่งระบุ 409 สำหรับกรณี 1 ชั่วโมงก่อนเริ่ม
 * (REQ-27 เป็นข้อจำกัดที่แคบกว่า จึงเป็นข้อที่มีผลบังคับ)
 * ส่วนการที่เอเจนต์ **รายงานความขัดแย้งให้ผู้ใช้ทราบหรือไม่** เป็นคนละเรื่อง
 * และถูกวัดด้วยกฎตระกูล FL ในไฟล์ scenario ไม่ใช่ที่นี่
 *
 * แดงบน baseline เพราะยังไม่มีการยกเลิกเลย
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, seed, requested, iso, allEvents } from './_harness.ts';

test('REQ-24 เจ้าของยกเลิกล่วงหน้าได้ และสถานะเป็น CANCELLED', async () => {
  await seed([requested({ bookingId: 'bk-d1', startAt: iso(1, 10), endAt: iso(1, 12) })]);
  const r = await call('POST', '/bookings/bk-d1/cancel', { userId: 'u-student-1', userRole: 'STUDENT' });
  assert.equal(r.status, 200, `ต้องได้ 200 แต่ได้ ${r.status}`);
  assert.equal((await call('GET', '/bookings/bk-d1')).body?.status, 'CANCELLED');
});

test('REQ-25 LAB_ADMIN ยกเลิกของผู้ใช้คนอื่นได้', async () => {
  await seed([requested({ bookingId: 'bk-d2', startAt: iso(1, 10), endAt: iso(1, 12) })]);
  const r = await call('POST', '/bookings/bk-d2/cancel', { userId: 'u-admin-9', userRole: 'LAB_ADMIN' });
  assert.equal(r.status, 200, `LAB_ADMIN ต้องยกเลิกของคนอื่นได้ แต่ได้ ${r.status}`);
});

test('REQ-25 ผู้ใช้อื่นที่ไม่ใช่เจ้าของและไม่ใช่ LAB_ADMIN ต้องถูกปฏิเสธ', async () => {
  await seed([requested({ bookingId: 'bk-d3', startAt: iso(1, 10), endAt: iso(1, 12) })]);
  const r = await call('POST', '/bookings/bk-d3/cancel', { userId: 'u-someone-else', userRole: 'STUDENT' });
  assert.equal(r.status, 403, `คนอื่นยกเลิกต้องได้ 403 แต่ได้ ${r.status}`);
});

test('REQ-26 ยกเลิกการจองที่ COMPLETED แล้วไม่ได้', async () => {
  await seed([
    requested({ bookingId: 'bk-d4', startAt: '2026-03-02T08:00:00.000Z', endAt: '2026-03-02T10:00:00.000Z' }),
    { type: 'BookingStarted', bookingId: 'bk-d4', occurredAt: '2026-03-02T08:00:00.000Z', actorId: 'u-student-1', actualStartAt: '2026-03-02T08:00:00.000Z' },
    { type: 'BookingCompleted', bookingId: 'bk-d4', occurredAt: '2026-03-02T10:00:00.000Z', actorId: 'u-student-1', actualEndAt: '2026-03-02T10:00:00.000Z' },
  ]);
  const r = await call('POST', '/bookings/bk-d4/cancel', { userId: 'u-student-1', userRole: 'STUDENT' });
  assert.equal(r.status, 409, `ยกเลิกงานที่จบแล้วต้องได้ 409 แต่ได้ ${r.status}`);
});

test('REQ-26 ยกเลิกซ้ำการจองที่ CANCELLED แล้วไม่ได้', async () => {
  await seed([requested({ bookingId: 'bk-d5', startAt: iso(1, 10), endAt: iso(1, 12) })]);
  await call('POST', '/bookings/bk-d5/cancel', { userId: 'u-student-1', userRole: 'STUDENT' });
  const again = await call('POST', '/bookings/bk-d5/cancel', { userId: 'u-student-1', userRole: 'STUDENT' });
  assert.equal(again.status, 409, `ยกเลิกซ้ำต้องได้ 409 แต่ได้ ${again.status}`);
});

test('REQ-27 ยกเลิกภายใน 2 ชั่วโมงก่อนเวลาเริ่มไม่ได้', async () => {
  // now = 09:00 · startAt = 10:00 -> เหลือ 1 ชั่วโมง
  await seed([requested({
    bookingId: 'bk-d6',
    startAt: '2026-03-04T10:00:00.000Z', endAt: '2026-03-04T12:00:00.000Z',
  })]);
  const r = await call('POST', '/bookings/bk-d6/cancel', { userId: 'u-student-1', userRole: 'STUDENT' });
  assert.equal(r.status, 409,
    `เหลือ 1 ชม. ก่อนเริ่ม ต้องได้ 409 ตาม REQ-27 แต่ได้ ${r.status}`);
});

test('REQ-28 ต้องบันทึกเหตุการณ์ BookingCancelled พร้อมผู้สั่งยกเลิก', async () => {
  await seed([requested({ bookingId: 'bk-d7', startAt: iso(1, 10), endAt: iso(1, 12) })]);
  await call('POST', '/bookings/bk-d7/cancel', { userId: 'u-admin-9', userRole: 'LAB_ADMIN' });
  const ev = (await allEvents()).find((e: any) => e.bookingId === 'bk-d7' && e.type === 'BookingCancelled');
  assert.ok(ev, 'ต้องมีเหตุการณ์ BookingCancelled');
  assert.equal(ev.cancelledBy ?? ev.actorId, 'u-admin-9', 'ต้องบันทึกว่าใครเป็นผู้สั่งยกเลิก');
});
