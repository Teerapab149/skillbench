import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  createBooking, approveBooking, rejectBooking, startBooking, completeBooking,
  replay, replayAll, DomainError,
} from '../src/domain/booking.ts';
import type { DomainEvent } from '../src/domain/events.ts';

process.env.GPU_BOOKING_NOW = '2026-08-04T00:00:00.000Z';

function requested(over: Partial<any> = {}): DomainEvent {
  return {
    type: 'BookingRequested',
    bookingId: 'bk-1',
    occurredAt: '2026-08-03T00:00:00.000Z',
    actorId: 'u-pat',
    userId: 'u-pat',
    userRole: 'STUDENT',
    resourceId: 'gpu-a100-01',
    startAt: '2026-08-05T09:00:00.000Z',
    endAt: '2026-08-05T13:00:00.000Z',
    requiresApproval: false,
    ...over,
  } as DomainEvent;
}

describe('การสร้างคำขอจอง', () => {
  const cmd = {
    bookingId: 'bk-new', userId: 'u-pat', userRole: 'STUDENT' as const,
    resourceId: 'gpu-a100-01',
    startAt: '2026-08-10T09:00:00.000Z', endAt: '2026-08-10T13:00:00.000Z',
  };

  test('REQ-07 คำขอใหม่มีสถานะ REQUESTED', () => {
    const state = replay(createBooking(cmd, []));
    assert.equal(state?.status, 'REQUESTED');
  });

  test('REQ-08 บันทึกเหตุการณ์ BookingRequested', () => {
    const events = createBooking(cmd, []);
    assert.equal(events[0].type, 'BookingRequested');
  });

  test('REQ-01 ขาดฟิลด์ที่จำเป็น -> 400', () => {
    assert.throws(
      () => createBooking({ ...cmd, resourceId: '' }, []),
      (e: DomainError) => e.httpStatus === 400,
    );
  });

  test('REQ-06 ไม่พบเครื่อง -> 404', () => {
    assert.throws(
      () => createBooking({ ...cmd, resourceId: 'gpu-h100-99' }, []),
      (e: DomainError) => e.httpStatus === 404,
    );
  });

  test('REQ-02 เวลาเริ่มอยู่ในอดีต -> 400', () => {
    assert.throws(
      () => createBooking({ ...cmd, startAt: '2026-01-01T09:00:00.000Z', endAt: '2026-01-01T13:00:00.000Z' }, []),
      (e: DomainError) => e.httpStatus === 400,
    );
  });

  test('REQ-03 endAt ไม่หลัง startAt -> 400', () => {
    assert.throws(
      () => createBooking({ ...cmd, endAt: cmd.startAt }, []),
      (e: DomainError) => e.httpStatus === 400,
    );
  });

  test('REQ-05 ช่วงเวลาซ้อนทับบนเครื่องเดียวกัน -> 409', () => {
    const existing = replayAll([requested({
      bookingId: 'bk-old',
      startAt: '2026-08-10T11:00:00.000Z', endAt: '2026-08-10T15:00:00.000Z',
    })]);
    assert.throws(() => createBooking(cmd, existing), (e: DomainError) => e.httpStatus === 409);
  });

  test('REQ-05 คนละเครื่อง ช่วงเวลาเดียวกัน จองได้', () => {
    const existing = replayAll([requested({
      bookingId: 'bk-old', resourceId: 'gpu-v100-01',
      startAt: '2026-08-10T11:00:00.000Z', endAt: '2026-08-10T15:00:00.000Z',
    })]);
    assert.equal(replay(createBooking(cmd, existing))?.status, 'REQUESTED');
  });

  test('REQ-17 จองเกิน 8 ชม. ถูกทำเครื่องหมายว่าต้องอนุมัติ', () => {
    const long = { ...cmd, endAt: '2026-08-10T20:00:00.000Z' };  // 11 ชม.
    assert.equal(replay(createBooking(long, []))?.requiresApproval, true);
  });

  test('REQ-23 จองไม่เกิน 8 ชม. ไม่ต้องอนุมัติ', () => {
    assert.equal(replay(createBooking(cmd, []))?.requiresApproval, false);
  });
});

describe('การอนุมัติ', () => {
  const state = replay([requested({ requiresApproval: true })])!;

  test('REQ-18 บทบาทอื่นอนุมัติไม่ได้ -> 403', () => {
    assert.throws(
      () => approveBooking(state, 'u-arun', 'LECTURER'),
      (e: DomainError) => e.httpStatus === 403,
    );
  });

  test('REQ-19 ผู้ขอจองอนุมัติของตัวเองไม่ได้ แม้เป็น LAB_ADMIN -> 403', () => {
    const own = replay([requested({ userId: 'u-admin', actorId: 'u-admin', requiresApproval: true })])!;
    assert.throws(
      () => approveBooking(own, 'u-admin', 'LAB_ADMIN'),
      (e: DomainError) => e.code === 'SELF_APPROVAL',
    );
  });

  test('REQ-20 อนุมัติได้เฉพาะสถานะ REQUESTED -> 409', () => {
    const rejected = replay([requested(), { type: 'BookingRejected', bookingId: 'bk-1', occurredAt: 'x', actorId: 'u-admin', reason: 'ไม่ว่าง' } as DomainEvent])!;
    assert.throws(
      () => approveBooking(rejected, 'u-admin', 'LAB_ADMIN'),
      (e: DomainError) => e.httpStatus === 409,
    );
  });

  test('อนุมัติสำเร็จ สถานะเปลี่ยนเป็น APPROVED และบันทึกผู้อนุมัติ', () => {
    const after = replay([requested({ requiresApproval: true }), ...approveBooking(state, 'u-admin', 'LAB_ADMIN')])!;
    assert.equal(after.status, 'APPROVED');
    assert.equal(after.approvedBy, 'u-admin');
  });

  test('REQ-21 ปฏิเสธโดยไม่ระบุเหตุผล -> 400', () => {
    assert.throws(
      () => rejectBooking(state, 'u-admin', 'LAB_ADMIN', '  '),
      (e: DomainError) => e.httpStatus === 400,
    );
  });
});

describe('การเริ่มและสิ้นสุดการใช้งาน', () => {
  test('REQ-17 การจองที่ต้องอนุมัติ เริ่มใช้งานก่อนได้รับอนุมัติไม่ได้ -> 409', () => {
    const state = replay([requested({ requiresApproval: true })])!;
    assert.throws(
      () => startBooking(state, 'u-pat'),
      (e: DomainError) => e.code === 'APPROVAL_REQUIRED',
    );
  });

  test('REQ-23 การจองที่ไม่ต้องอนุมัติ เริ่มใช้งานได้ทันที', () => {
    const state = replay([requested()])!;
    const after = replay([requested(), ...startBooking(state, 'u-pat')])!;
    assert.equal(after.status, 'ACTIVE');
  });

  test('REQ-31 สิ้นสุดการใช้งาน สถานะเป็น COMPLETED', () => {
    process.env.GPU_BOOKING_NOW = '2026-08-05T12:00:00.000Z';
    const evts = [requested()];
    const started = replay(evts)!;
    evts.push(...startBooking(started, 'u-pat'));
    const active = replay(evts)!;
    evts.push(...completeBooking(active, 'u-pat'));
    const done = replay(evts)!;
    assert.equal(done.status, 'COMPLETED');
    assert.equal(done.actualEndAt, '2026-08-05T12:00:00.000Z');
    process.env.GPU_BOOKING_NOW = '2026-08-04T00:00:00.000Z';
  });

  test('REQ-32 สิ้นสุดช้ากว่ากำหนดเกิน 15 นาที ระบบตัดจบที่ endAt + 15 นาที', () => {
    process.env.GPU_BOOKING_NOW = '2026-08-05T09:00:00.000Z';
    const evts = [requested()];
    evts.push(...startBooking(replay(evts)!, 'u-pat'));
    process.env.GPU_BOOKING_NOW = '2026-08-05T14:00:00.000Z';  // ช้ากว่า endAt 1 ชม.
    evts.push(...completeBooking(replay(evts)!, 'u-pat'));
    assert.equal(replay(evts)!.actualEndAt, '2026-08-05T13:15:00.000Z');
    process.env.GPU_BOOKING_NOW = '2026-08-04T00:00:00.000Z';
  });
});

describe('การเล่นเหตุการณ์ซ้ำ', () => {
  test('ไม่มีเหตุการณ์ -> ไม่มีสถานะ', () => {
    assert.equal(replay([]), null);
  });

  test('replayAll แยกตามรายการจองได้ถูกต้อง', () => {
    const all = replayAll([requested({ bookingId: 'a' }), requested({ bookingId: 'b' })]);
    assert.equal(all.length, 2);
    assert.deepEqual(all.map((s) => s.id).sort(), ['a', 'b']);
  });
});
