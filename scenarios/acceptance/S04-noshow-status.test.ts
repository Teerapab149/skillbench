/**
 * S04 — REQ-30: ไม่เริ่มใช้ภายใน 30 นาทีหลัง startAt ให้สถานะเป็น NO_SHOW
 * เกณฑ์ในตาราง: เลย startAt ไป 31 นาทีโดยไม่ start -> status: "NO_SHOW"
 * แดงบน baseline เพราะ replay ไม่รู้จักการไม่มาใช้งานเลย สถานะยังเป็น REQUESTED
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, seed, requested } from './_harness.ts';

test('REQ-30 เลยเวลาเริ่มเกิน 30 นาทีโดยไม่เริ่มใช้ ต้องเป็น NO_SHOW', async () => {
  // now = 09:00 · startAt = 08:00 -> ผ่านมา 60 นาที
  await seed([requested({
    bookingId: 'bk-noshow',
    startAt: '2026-03-04T08:00:00.000Z',
    endAt: '2026-03-04T10:00:00.000Z',
  })]);

  const r = await call('GET', '/bookings/bk-noshow');
  assert.equal(r.status, 200);
  assert.equal(r.body?.status, 'NO_SHOW',
    `ต้องเป็น NO_SHOW แต่ได้ ${r.body?.status} — ยังไม่ได้ทำ REQ-30`);
});

test('REQ-30 ยังอยู่ในช่วงผ่อนผัน 30 นาที ต้องยังไม่เป็น NO_SHOW', async () => {
  // now = 09:00 · startAt = 08:45 -> ผ่านมา 15 นาที ยังไม่ถึงเกณฑ์
  await seed([requested({
    bookingId: 'bk-grace',
    startAt: '2026-03-04T08:45:00.000Z',
    endAt: '2026-03-04T10:45:00.000Z',
  })]);

  const r = await call('GET', '/bookings/bk-grace');
  assert.equal(r.status, 200);
  assert.notEqual(r.body?.status, 'NO_SHOW', 'ยังไม่ครบ 30 นาที ต้องไม่ถูกตัดเป็น NO_SHOW');
});

test('REQ-30 การจองที่เริ่มใช้แล้ว ต้องไม่กลายเป็น NO_SHOW', async () => {
  await seed([
    requested({
      bookingId: 'bk-started',
      startAt: '2026-03-04T08:00:00.000Z',
      endAt: '2026-03-04T10:00:00.000Z',
    }),
    {
      type: 'BookingStarted', bookingId: 'bk-started', occurredAt: '2026-03-04T08:05:00.000Z',
      actorId: 'u-student-1', actualStartAt: '2026-03-04T08:05:00.000Z',
    },
  ]);

  const r = await call('GET', '/bookings/bk-started');
  assert.equal(r.status, 200);
  assert.equal(r.body?.status, 'ACTIVE', 'เริ่มใช้แล้วต้องเป็น ACTIVE ไม่ใช่ NO_SHOW');
});
