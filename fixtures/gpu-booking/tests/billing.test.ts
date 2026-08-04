import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildInvoice, totalRevenueForMonth } from '../src/projections/billing.ts';
import { billableMinutes, rawMinutesBetween } from '../src/lib/duration.ts';
import type { DomainEvent } from '../src/domain/events.ts';

function completedBooking(opts: {
  id: string; user?: string; resourceId?: string;
  startAt: string; endAt: string; actualStartAt: string; actualEndAt: string;
}): DomainEvent[] {
  const user = opts.user ?? 'u-pat';
  return [
    {
      type: 'BookingRequested', bookingId: opts.id, occurredAt: opts.startAt, actorId: user,
      userId: user, userRole: 'STUDENT', resourceId: opts.resourceId ?? 'gpu-a100-01',
      startAt: opts.startAt, endAt: opts.endAt, requiresApproval: false,
    },
    { type: 'BookingStarted', bookingId: opts.id, occurredAt: opts.actualStartAt, actorId: user, actualStartAt: opts.actualStartAt },
    { type: 'BookingCompleted', bookingId: opts.id, occurredAt: opts.actualEndAt, actorId: user, actualEndAt: opts.actualEndAt },
  ] as DomainEvent[];
}

describe('การปัดเวลาเพื่อคิดค่าบริการ', () => {
  test('REQ-35 ปัดขึ้นเป็นจำนวนเท่าของ 15 นาที', () => {
    // ใช้จริง 2 ชม. 3 นาที -> 2 ชม. 15 นาที
    assert.equal(billableMinutes('2026-05-01T09:00:00.000Z', '2026-05-01T11:03:00.000Z'), 135);
  });

  test('REQ-35 ลงตัวพอดีแล้วไม่ปัดเพิ่ม', () => {
    assert.equal(billableMinutes('2026-05-01T09:00:00.000Z', '2026-05-01T11:00:00.000Z'), 120);
  });

  test('ใช้จริง 1 นาที ยังคิดขั้นต่ำ 15 นาที', () => {
    assert.equal(billableMinutes('2026-05-01T09:00:00.000Z', '2026-05-01T09:01:00.000Z'), 15);
  });

  test('ช่วงเวลาติดลบหรือเป็นศูนย์ คิดเป็น 0', () => {
    assert.equal(billableMinutes('2026-05-01T09:00:00.000Z', '2026-05-01T09:00:00.000Z'), 0);
  });

  test('นาทีดิบไม่ถูกปัด', () => {
    assert.equal(rawMinutesBetween('2026-05-01T09:00:00.000Z', '2026-05-01T11:03:00.000Z'), 123);
  });
});

describe('ใบแจ้งหนี้', () => {
  test('REQ-34 A100 คิด 40 บาทต่อชั่วโมง', () => {
    const events = completedBooking({
      id: 'b1', startAt: '2026-05-10T09:00:00.000Z', endAt: '2026-05-10T12:00:00.000Z',
      actualStartAt: '2026-05-10T09:00:00.000Z', actualEndAt: '2026-05-10T12:00:00.000Z',
    });
    assert.equal(buildInvoice(events, 'u-pat', '2026-05').totalBaht, 120);
  });

  test('REQ-34 V100 คิด 20 บาทต่อชั่วโมง', () => {
    const events = completedBooking({
      id: 'b2', resourceId: 'gpu-v100-01',
      startAt: '2026-05-10T09:00:00.000Z', endAt: '2026-05-10T12:00:00.000Z',
      actualStartAt: '2026-05-10T09:00:00.000Z', actualEndAt: '2026-05-10T12:00:00.000Z',
    });
    assert.equal(buildInvoice(events, 'u-pat', '2026-05').totalBaht, 60);
  });

  test('REQ-33 คิดตามเวลาที่ใช้จริง ไม่ใช่เวลาที่จอง', () => {
    const events = completedBooking({
      id: 'b3', startAt: '2026-05-10T09:00:00.000Z', endAt: '2026-05-10T17:00:00.000Z',
      actualStartAt: '2026-05-10T09:00:00.000Z', actualEndAt: '2026-05-10T11:00:00.000Z',
    });
    assert.equal(buildInvoice(events, 'u-pat', '2026-05').totalBaht, 80);   // 2 ชม. ไม่ใช่ 8
  });

  test('REQ-35 เศษนาทีถูกปัดขึ้นก่อนคิดเงิน', () => {
    const events = completedBooking({
      id: 'b4', startAt: '2026-05-10T09:00:00.000Z', endAt: '2026-05-10T12:00:00.000Z',
      actualStartAt: '2026-05-10T09:00:00.000Z', actualEndAt: '2026-05-10T11:03:00.000Z',
    });
    const inv = buildInvoice(events, 'u-pat', '2026-05');
    assert.equal(inv.lines[0].billableMinutes, 135);
    assert.equal(inv.totalBaht, 90);   // 135/60 * 40
  });

  test('REQ-38 นับเฉพาะเดือนที่ระบุ', () => {
    const events = [
      ...completedBooking({ id: 'b5', startAt: '2026-05-10T09:00:00.000Z', endAt: '2026-05-10T10:00:00.000Z', actualStartAt: '2026-05-10T09:00:00.000Z', actualEndAt: '2026-05-10T10:00:00.000Z' }),
      ...completedBooking({ id: 'b6', startAt: '2026-06-10T09:00:00.000Z', endAt: '2026-06-10T10:00:00.000Z', actualStartAt: '2026-06-10T09:00:00.000Z', actualEndAt: '2026-06-10T10:00:00.000Z' }),
    ];
    assert.equal(buildInvoice(events, 'u-pat', '2026-05').lines.length, 1);
    assert.equal(buildInvoice(events, 'u-pat', '2026-06').lines.length, 1);
  });

  test('การจองของผู้ใช้อื่นไม่ปรากฏในใบแจ้งหนี้', () => {
    const events = completedBooking({
      id: 'b7', user: 'u-ming',
      startAt: '2026-05-10T09:00:00.000Z', endAt: '2026-05-10T10:00:00.000Z',
      actualStartAt: '2026-05-10T09:00:00.000Z', actualEndAt: '2026-05-10T10:00:00.000Z',
    });
    assert.equal(buildInvoice(events, 'u-pat', '2026-05').lines.length, 0);
  });

  test('การจองที่ยังไม่จบไม่ถูกคิดเงิน', () => {
    const events: DomainEvent[] = [
      {
        type: 'BookingRequested', bookingId: 'b8', occurredAt: '2026-05-10T08:00:00.000Z', actorId: 'u-pat',
        userId: 'u-pat', userRole: 'STUDENT', resourceId: 'gpu-a100-01',
        startAt: '2026-05-10T09:00:00.000Z', endAt: '2026-05-10T10:00:00.000Z', requiresApproval: false,
      },
    ];
    assert.equal(buildInvoice(events, 'u-pat', '2026-05').totalBaht, 0);
  });

  test('ยอดรวมทั้งระบบเท่ากับผลบวกของทุกผู้ใช้', () => {
    const events = [
      ...completedBooking({ id: 'b9', user: 'u-pat', startAt: '2026-05-10T09:00:00.000Z', endAt: '2026-05-10T10:00:00.000Z', actualStartAt: '2026-05-10T09:00:00.000Z', actualEndAt: '2026-05-10T10:00:00.000Z' }),
      ...completedBooking({ id: 'b10', user: 'u-ming', startAt: '2026-05-11T09:00:00.000Z', endAt: '2026-05-11T10:00:00.000Z', actualStartAt: '2026-05-11T09:00:00.000Z', actualEndAt: '2026-05-11T10:00:00.000Z' }),
    ];
    const total = totalRevenueForMonth(events, '2026-05');
    const sum = buildInvoice(events, 'u-pat', '2026-05').totalBaht + buildInvoice(events, 'u-ming', '2026-05').totalBaht;
    assert.equal(total, sum);
  });
});
