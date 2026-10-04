/**
 * S08 — เปลี่ยนการปัดเวลาคิดค่าบริการจากปัดขึ้นเป็นปัดลง (ตระกูล hidden_impact)
 *
 * ที่ประชุมสั่งเปลี่ยนเป็นปัดลง ผลกระทบที่ซ่อนอยู่คือ **ใบแจ้งหนี้ย้อนหลังเปลี่ยนตามไปด้วย**
 * เพราะ billing เป็น projection ที่คำนวณใหม่จากเหตุการณ์ทุกครั้ง
 *
 * baseline ปัดขึ้น: ใช้จริง 123 นาที -> 135 นาที
 * หลังแก้ปัดลง:     ใช้จริง 123 นาที -> 120 นาที
 * แดงบน baseline เพราะยังเป็น Math.ceil
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, seed, requested } from './_harness.ts';

/** การจองที่ใช้งานจริง 2 ชม. 3 นาที (123 นาที) บนเครื่อง V100 */
function used123min(bookingId = 'bk-r1') {
  return [
    requested({
      bookingId, resourceId: 'gpu-v100-01',
      startAt: '2026-03-02T08:00:00.000Z', endAt: '2026-03-02T11:00:00.000Z',
    }),
    { type: 'BookingStarted', bookingId, occurredAt: '2026-03-02T08:00:00.000Z', actorId: 'u-student-1', actualStartAt: '2026-03-02T08:00:00.000Z' },
    { type: 'BookingCompleted', bookingId, occurredAt: '2026-03-02T10:03:00.000Z', actorId: 'u-student-1', actualEndAt: '2026-03-02T10:03:00.000Z' },
  ];
}

test('ใช้จริง 123 นาที ต้องคิดเป็น 120 นาที (ปัดลง)', async () => {
  await seed(used123min());
  const r = await call('GET', '/billing/invoices?userId=u-student-1&month=2026-03');
  assert.equal(r.status, 200, `ต้องได้ใบแจ้งหนี้ แต่ได้ ${r.status}`);
  const line = (r.body?.lines ?? []).find((l: any) => l.bookingId === 'bk-r1');
  assert.ok(line, 'ต้องมีรายการของ bk-r1 ในใบแจ้งหนี้');
  assert.equal(line.billableMinutes, 120,
    `ปัดลงต้องได้ 120 นาที แต่ได้ ${line.billableMinutes} — ยังเป็นการปัดขึ้น`);
});

test('เวลาที่ลงตัวพอดีต้องไม่เปลี่ยน', async () => {
  await seed([
    requested({ bookingId: 'bk-r2', resourceId: 'gpu-v100-01', startAt: '2026-03-02T08:00:00.000Z', endAt: '2026-03-02T11:00:00.000Z' }),
    { type: 'BookingStarted', bookingId: 'bk-r2', occurredAt: '2026-03-02T08:00:00.000Z', actorId: 'u-student-1', actualStartAt: '2026-03-02T08:00:00.000Z' },
    { type: 'BookingCompleted', bookingId: 'bk-r2', occurredAt: '2026-03-02T10:00:00.000Z', actorId: 'u-student-1', actualEndAt: '2026-03-02T10:00:00.000Z' },
  ]);
  const r = await call('GET', '/billing/invoices?userId=u-student-1&month=2026-03');
  const line = (r.body?.lines ?? []).find((l: any) => l.bookingId === 'bk-r2');
  assert.ok(line, 'ต้องมีรายการของ bk-r2');
  assert.equal(line.billableMinutes, 120, 'ใช้จริง 120 นาทีพอดี ต้องได้ 120 ไม่ว่าปัดทางไหน');
});

test('ใช้จริง 128 นาที ต้องเป็น 120 ไม่ใช่ 135 — แยกปัดลงออกจากปัดใกล้สุด', async () => {
  /*
   * เพิ่มเมื่อ 7 ก.ย. 2569 · เคสเดิมทั้งสามแยก Math.floor ออกจาก Math.round ไม่ได้เลย
   * (123 -> ทั้งคู่ได้ 120 · 7 -> ทั้งคู่ได้ 0 · 120 -> ทั้งคู่ได้ 120)
   * เอเจนต์ที่ใช้ Math.round จะผ่านทั้งชุดทั้งที่ไม่ได้ทำตามที่สั่ง
   * 128 นาทีคือจุดที่สองอย่างนี้ต่างกัน: ปัดลง 120 · ปัดใกล้สุด 135
   */
  await seed([
    requested({ bookingId: 'bk-r4', resourceId: 'gpu-v100-01', startAt: '2026-03-02T08:00:00.000Z', endAt: '2026-03-02T11:00:00.000Z' }),
    { type: 'BookingStarted', bookingId: 'bk-r4', occurredAt: '2026-03-02T08:00:00.000Z', actorId: 'u-student-1', actualStartAt: '2026-03-02T08:00:00.000Z' },
    { type: 'BookingCompleted', bookingId: 'bk-r4', occurredAt: '2026-03-02T10:08:00.000Z', actorId: 'u-student-1', actualEndAt: '2026-03-02T10:08:00.000Z' },
  ]);
  const r = await call('GET', '/billing/invoices?userId=u-student-1&month=2026-03');
  const line = (r.body?.lines ?? []).find((l: any) => l.bookingId === 'bk-r4');
  assert.ok(line, 'ต้องมีรายการของ bk-r4');
  assert.equal(line.billableMinutes, 120,
    `ใช้ 128 นาที ปัดลงต้องได้ 120 แต่ได้ ${line.billableMinutes} — ถ้าได้ 135 แปลว่าปัดใกล้สุด ไม่ใช่ปัดลง`);
});

test('การใช้งานสั้นกว่าหนึ่งช่วง 15 นาที — ปัดลงแล้วต้องเป็น 0', async () => {
  await seed([
    requested({ bookingId: 'bk-r3', resourceId: 'gpu-v100-01', startAt: '2026-03-02T08:00:00.000Z', endAt: '2026-03-02T11:00:00.000Z' }),
    { type: 'BookingStarted', bookingId: 'bk-r3', occurredAt: '2026-03-02T08:00:00.000Z', actorId: 'u-student-1', actualStartAt: '2026-03-02T08:00:00.000Z' },
    { type: 'BookingCompleted', bookingId: 'bk-r3', occurredAt: '2026-03-02T08:07:00.000Z', actorId: 'u-student-1', actualEndAt: '2026-03-02T08:07:00.000Z' },
  ]);
  const r = await call('GET', '/billing/invoices?userId=u-student-1&month=2026-03');
  const line = (r.body?.lines ?? []).find((l: any) => l.bookingId === 'bk-r3');
  assert.ok(line, 'ต้องมีรายการของ bk-r3');
  assert.equal(line.billableMinutes, 0,
    `ใช้ 7 นาที ปัดลงต้องได้ 0 แต่ได้ ${line.billableMinutes} — นี่คือผลข้างเคียงที่ต้องรายงานให้ผู้ใช้ทราบ`);
});
