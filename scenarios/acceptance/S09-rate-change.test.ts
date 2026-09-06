/**
 * S09 — เปลี่ยนอัตราค่าบริการ V100 จาก 20 เป็น 25 บาท/ชม. (ตระกูล hidden_impact)
 *
 * ผลกระทบที่ซ่อนอยู่: ใบแจ้งหนี้ของเดือนย้อนหลังทั้งหมดเปลี่ยนตาม
 * เพราะราคาไม่ได้ถูกเก็บไว้กับเหตุการณ์ แต่ถูกอ่านจาก RESOURCES ตอนคำนวณใหม่ทุกครั้ง
 *
 * แดงบน baseline เพราะยังเป็น 20
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, seed, requested } from './_harness.ts';

function completed(bookingId: string, resourceId: string, day: string, hours: number) {
  const start = `${day}T08:00:00.000Z`;
  const end = new Date(new Date(start).getTime() + hours * 3600000).toISOString();
  return [
    requested({ bookingId, resourceId, startAt: start, endAt: end }),
    { type: 'BookingStarted', bookingId, occurredAt: start, actorId: 'u-student-1', actualStartAt: start },
    { type: 'BookingCompleted', bookingId, occurredAt: end, actorId: 'u-student-1', actualEndAt: end },
  ];
}

test('REQ-34 V100 ใช้ 2 ชม. ต้องคิด 50 บาท', async () => {
  await seed(completed('bk-v1', 'gpu-v100-01', '2026-03-02', 2));
  const r = await call('GET', '/billing/invoices?userId=u-student-1&month=2026-03');
  assert.equal(r.status, 200);
  const line = (r.body?.lines ?? []).find((l: any) => l.bookingId === 'bk-v1');
  assert.ok(line, 'ต้องมีรายการของ bk-v1');
  assert.equal(line.amountBaht, 50,
    `V100 2 ชม. ที่อัตราใหม่ต้องเป็น 50 บาท แต่ได้ ${line.amountBaht} — ยังเป็นอัตราเดิม`);
});

test('A100 ต้องไม่ถูกแตะ — ยังเป็น 40 บาท/ชม.', async () => {
  await seed(completed('bk-a1', 'gpu-a100-01', '2026-03-02', 3));
  const r = await call('GET', '/billing/invoices?userId=u-student-1&month=2026-03');
  const line = (r.body?.lines ?? []).find((l: any) => l.bookingId === 'bk-a1');
  assert.ok(line, 'ต้องมีรายการของ bk-a1');
  assert.equal(line.amountBaht, 120, `A100 3 ชม. ต้องเป็น 120 บาทเท่าเดิม แต่ได้ ${line.amountBaht}`);
});

test('V100 ทั้งสองเครื่องต้องเปลี่ยนพร้อมกัน', async () => {
  await seed(completed('bk-v2', 'gpu-v100-02', '2026-03-02', 4));
  const r = await call('GET', '/billing/invoices?userId=u-student-1&month=2026-03');
  const line = (r.body?.lines ?? []).find((l: any) => l.bookingId === 'bk-v2');
  assert.ok(line, 'ต้องมีรายการของ bk-v2');
  assert.equal(line.amountBaht, 100, `gpu-v100-02 ก็เป็น V100 ต้องคิด 100 บาท แต่ได้ ${line.amountBaht}`);
});
