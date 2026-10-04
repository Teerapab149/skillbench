/**
 * S06 — REQ-10 ถึง REQ-13: เพดานระยะเวลาต่อการจองหนึ่งครั้ง แยกตามบทบาท
 * เกณฑ์ในตาราง: ที่เพดานพอดี -> สำเร็จ · เกินเพดาน 15 นาที -> 422
 *
 * MAX_HOURS_PER_BOOKING มีอยู่ใน policy.ts แล้วแต่ยังไม่ถูกนำมาบังคับใช้
 * แดงบน baseline เพราะ createBooking ไม่เคยอ่านค่านั้นเลย
 *
 * หมายเหตุตระกูล counter_intuitive: LECTURER มีเพดานต่ำกว่า STUDENT (4 < 8)
 * ซึ่งขัดสามัญสำนึก เทสจึงต้องตรวจ LECTURER ด้วย ไม่ใช่ตรวจแค่ STUDENT
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, seed, iso } from './_harness.ts';

async function book(role: string, hours: number, minutes = 0, resource = 'gpu-v100-01', day = 1) {
  await seed([]);
  const start = iso(day, 8, 0);
  const end = new Date(new Date(start).getTime() + (hours * 60 + minutes) * 60000).toISOString();
  return call('POST', '/bookings', {
    body: { resourceId: resource, startAt: start, endAt: end },
    userId: `u-${role.toLowerCase()}`, userRole: role,
  });
}

test('REQ-10 STUDENT จอง 8 ชม. ได้ แต่ 8 ชม. 15 นาที ไม่ได้', async () => {
  assert.ok((await book('STUDENT', 8)).status < 300, 'STUDENT 8 ชม. ต้องผ่าน');
  assert.equal((await book('STUDENT', 8, 15)).status, 422,
    'STUDENT 8 ชม. 15 นาที ต้องได้ 422 — ยังไม่บังคับเพดานต่อการจอง');
});

test('REQ-12 LECTURER เพดานต่ำกว่า STUDENT — 4 ชม. ได้ 4 ชม. 15 นาที ไม่ได้', async () => {
  assert.ok((await book('LECTURER', 4)).status < 300, 'LECTURER 4 ชม. ต้องผ่าน');
  assert.equal((await book('LECTURER', 4, 15)).status, 422,
    'LECTURER 4 ชม. 15 นาที ต้องได้ 422 — เพดานของ LECTURER คือ 4 ไม่ใช่ 8');
});

test('REQ-11 PHD_STUDENT จองได้ถึง 24 ชม.', async () => {
  assert.ok((await book('PHD_STUDENT', 24)).status < 300, 'PHD_STUDENT 24 ชม. ต้องผ่าน');
  assert.equal((await book('PHD_STUDENT', 24, 15)).status, 422, 'PHD_STUDENT เกิน 24 ชม. ต้องได้ 422');
});

test('REQ-13 LAB_ADMIN เพดาน 12 ชม.', async () => {
  assert.ok((await book('LAB_ADMIN', 12)).status < 300, 'LAB_ADMIN 12 ชม. ต้องผ่าน');
  assert.equal((await book('LAB_ADMIN', 12, 15)).status, 422, 'LAB_ADMIN เกิน 12 ชม. ต้องได้ 422');
});
