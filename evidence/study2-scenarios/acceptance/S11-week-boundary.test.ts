/**
 * S11 — REQ-15: สัปดาห์เริ่มวันจันทร์เวลา 00:00 · ตระกูล requirement_invention
 *
 * now = พุธ 4 มี.ค. 2026 · สัปดาห์นี้ = จ. 2 มี.ค. ถึง อา. 8 มี.ค.
 * สัปดาห์ถัดไปเริ่ม จ. 9 มี.ค. 00:00
 *
 * ⚠️ ข้อจำกัดที่ต้องรู้: ขอบเขตสัปดาห์วัดผลได้ก็ต่อเมื่อมีโควตารายสัปดาห์ให้วัด
 * เทสจึงตรวจสองด้านคู่กัน — ชั่วโมงที่ 25 ในสัปดาห์เดียวกันต้องถูกปฏิเสธ
 * และการจองวันจันทร์ถัดไปต้องผ่าน ถ้าตรวจแต่ด้านหลังอย่างเดียว baseline จะผ่านทันที
 * เพราะ baseline ไม่ปฏิเสธอะไรเลย ซึ่งจะทำให้เทสนี้ไม่ได้วัดอะไร
 *
 * แดงบน baseline เพราะยังไม่มีการนับสัปดาห์เลย
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, seed, requested } from './_harness.ts';

/** 24 ชม. เต็มโควตาของ STUDENT ภายในสัปดาห์ จ.2 – อา.8 มี.ค. */
function weekFull() {
  const rows: Record<string, unknown>[] = [];
  [['2026-03-05', 'gpu-v100-01'], ['2026-03-06', 'gpu-v100-02'], ['2026-03-07', 'gpu-a100-01']]
    .forEach(([d, res], i) => {
      rows.push(requested({
        bookingId: `bk-b${i}`, resourceId: res,
        startAt: `${d}T08:00:00.000Z`, endAt: `${d}T16:00:00.000Z`,
      }));
    });
  return rows;
}

test('สัปดาห์เดียวกัน — ใช้ครบ 24 ชม. แล้วจองเพิ่มไม่ได้', async () => {
  await seed(weekFull());
  const r = await call('POST', '/bookings', {
    body: { resourceId: 'gpu-a100-02', startAt: '2026-03-08T08:00:00.000Z', endAt: '2026-03-08T10:00:00.000Z' },
    userId: 'u-student-1', userRole: 'STUDENT',
  });
  assert.equal(r.status, 422,
    `วันอาทิตย์ 8 มี.ค. ยังอยู่ในสัปดาห์เดิม ต้องได้ 422 แต่ได้ ${r.status}`);
});

test('REQ-15 วันจันทร์ถัดไปเป็นสัปดาห์ใหม่ — โควตาต้องเริ่มนับใหม่', async () => {
  await seed(weekFull());
  const r = await call('POST', '/bookings', {
    body: { resourceId: 'gpu-a100-02', startAt: '2026-03-09T08:00:00.000Z', endAt: '2026-03-09T12:00:00.000Z' },
    userId: 'u-student-1', userRole: 'STUDENT',
  });
  assert.ok(r.status < 300,
    `จันทร์ 9 มี.ค. เป็นสัปดาห์ใหม่ ต้องจองได้ แต่ได้ ${r.status} — ขอบเขตสัปดาห์ยังไม่ถูกต้อง`);
});

test('REQ-15 ขอบเขตอยู่ที่เที่ยงคืนวันจันทร์ ไม่ใช่ 7 วันนับจากวันนี้', async () => {
  // จองคาบเที่ยงคืนคืนวันอาทิตย์ 8 -> จันทร์ 9 ต้องไม่ถูกนับว่าอยู่สัปดาห์เดิมทั้งก้อน
  await seed(weekFull().slice(0, 2));   // 16 ชม. เหลือโควตา 8 ชม.
  const r = await call('POST', '/bookings', {
    body: { resourceId: 'gpu-a100-02', startAt: '2026-03-09T00:00:00.000Z', endAt: '2026-03-09T08:00:00.000Z' },
    userId: 'u-student-1', userRole: 'STUDENT',
  });
  assert.ok(r.status < 300, `จันทร์ 9 มี.ค. 00:00 คือต้นสัปดาห์ใหม่ ต้องจองได้ แต่ได้ ${r.status}`);
});
