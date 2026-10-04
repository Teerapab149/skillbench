/**
 * S07 — REQ-14 (โควตารายสัปดาห์) และ REQ-16 (การจองที่ยกเลิกไม่นับในโควตา)
 *
 * now = พุธ 4 มี.ค. 2026 · สัปดาห์นี้คือ จ. 2 มี.ค. ถึง อา. 8 มี.ค.
 * STUDENT มีโควตา 24 ชม./สัปดาห์ · เพดานต่อครั้ง 8 ชม.
 *
 * แดงบน baseline เพราะ MAX_HOURS_PER_WEEK ไม่เคยถูกอ่านเลย
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, seed, requested } from './_harness.ts';

/** สามการจอง 8 ชม. ในสัปดาห์เดียวกัน = 24 ชม. เต็มโควตาพอดี */
function fullWeek(status: 'REQUESTED' | 'CANCELLED' = 'REQUESTED') {
  const days = ['2026-03-05', '2026-03-06', '2026-03-07'];
  const events: Record<string, unknown>[] = [];
  days.forEach((d, i) => {
    const id = `bk-w${i}`;
    events.push(requested({
      bookingId: id,
      resourceId: i === 0 ? 'gpu-v100-01' : i === 1 ? 'gpu-v100-02' : 'gpu-a100-01',
      startAt: `${d}T08:00:00.000Z`,
      endAt: `${d}T16:00:00.000Z`,
    }));
    if (status === 'CANCELLED') {
      events.push({
        type: 'BookingCancelled', bookingId: id, occurredAt: '2026-03-04T08:00:00.000Z',
        actorId: 'u-student-1', cancelledBy: 'u-student-1',
      });
    }
  });
  return events;
}

const extra = {
  body: { resourceId: 'gpu-a100-02', startAt: '2026-03-06T08:00:00.000Z', endAt: '2026-03-06T10:00:00.000Z' },
  userId: 'u-student-1', userRole: 'STUDENT',
};

test('REQ-14 ใช้โควตารายสัปดาห์ครบแล้ว จองเพิ่มไม่ได้', async () => {
  await seed(fullWeek());
  const r = await call('POST', '/bookings', extra);
  assert.equal(r.status, 422,
    `ใช้ครบ 24 ชม. แล้วจองเพิ่มต้องได้ 422 แต่ได้ ${r.status} — ยังไม่นับโควตารายสัปดาห์`);
});

test('REQ-14 ยังไม่เต็มโควตา ต้องจองได้ตามปกติ', async () => {
  await seed(fullWeek().slice(0, 2));   // 16 ชม. จาก 24
  const r = await call('POST', '/bookings', extra);
  assert.ok(r.status < 300, `เหลือโควตา 8 ชม. จอง 2 ชม. ต้องผ่าน แต่ได้ ${r.status}`);
});

test('REQ-16 การจองที่ยกเลิกแล้วต้องไม่ถูกนับในโควตา', async () => {
  await seed(fullWeek('CANCELLED'));    // 24 ชม. แต่ยกเลิกหมดแล้ว
  const r = await call('POST', '/bookings', extra);
  assert.ok(r.status < 300,
    `การจองที่ยกเลิกแล้วต้องไม่นับ จึงควรจองได้ แต่ได้ ${r.status}`);
});
