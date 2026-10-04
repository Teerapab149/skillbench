/**
 * S02 — REQ-04: ระยะเวลาการจองต้องเป็นจำนวนเท่าของ 15 นาที
 * เกณฑ์ในตารางข้อกำหนด: จอง 70 นาที -> 400 · จอง 75 นาที -> 201
 * แดงบน baseline เพราะ createBooking ไม่เคยตรวจเรื่องนี้เลย
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, seed, iso } from './_harness.ts';

test('REQ-04 ระยะเวลาที่ไม่เป็นจำนวนเท่าของ 15 นาที ต้องถูกปฏิเสธ', async () => {
  await seed([]);
  const r = await call('POST', '/bookings', {
    body: { resourceId: 'gpu-v100-01', startAt: iso(1, 10, 0), endAt: iso(1, 11, 10) },  // 70 นาที
  });
  assert.equal(r.status, 400, `จอง 70 นาที ต้องได้ 400 แต่ได้ ${r.status} — ยังไม่มีการตรวจตาม REQ-04`);
});

test('REQ-04 ระยะเวลาที่เป็นจำนวนเท่าของ 15 นาที ต้องผ่าน', async () => {
  await seed([]);
  const r = await call('POST', '/bookings', {
    body: { resourceId: 'gpu-v100-01', startAt: iso(1, 10, 0), endAt: iso(1, 11, 15) },  // 75 นาที
  });
  assert.ok(r.status < 300, `จอง 75 นาที ต้องสำเร็จ แต่ได้ ${r.status} — การตรวจเข้มเกินข้อกำหนด`);
});

test('REQ-04 ต้องไม่เผลอปฏิเสธการจองที่ลงตัวพอดีหลายชั่วโมง', async () => {
  await seed([]);
  const r = await call('POST', '/bookings', {
    body: { resourceId: 'gpu-v100-02', startAt: iso(2, 9, 0), endAt: iso(2, 13, 0) },  // 240 นาที
  });
  assert.ok(r.status < 300, `จอง 4 ชม. ต้องสำเร็จ แต่ได้ ${r.status}`);
});
