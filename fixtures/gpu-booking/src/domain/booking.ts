/**
 * Aggregate ของการจอง
 *
 * รับคำสั่ง -> ตรวจกฎ -> คายเหตุการณ์ออกมา
 * ไม่มีการเก็บสถานะไว้ที่ไหน สถานะได้จากการเล่นเหตุการณ์ซ้ำเสมอ (replay)
 */

import type { BookingStatus, DomainEvent, Role } from './events.ts';
import { findResource, requiresApproval, OVERRUN_ALLOWANCE_MINUTES } from './policy.ts';
import { bookedHours } from '../lib/duration.ts';
import { nowIso } from '../lib/clock.ts';

export class DomainError extends Error {
  code: string;
  httpStatus: number;

  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface BookingState {
  id: string;
  userId: string;
  userRole: Role;
  resourceId: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  requiresApproval: boolean;
  approvedBy: string | null;
  rejectionReason: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
}

/**
 * สร้างสถานะปัจจุบันจากเหตุการณ์ — หัวใจของ event sourcing
 * เหตุการณ์เดิม + ตรรกะที่เปลี่ยนไป = สถานะที่ต่างไป แม้ข้อมูลจะไม่ถูกแตะเลย
 */
export function replay(events: DomainEvent[]): BookingState | null {
  let s: BookingState | null = null;
  for (const e of events) {
    switch (e.type) {
      case 'BookingRequested':
        s = {
          id: e.bookingId, userId: e.userId, userRole: e.userRole, resourceId: e.resourceId,
          startAt: e.startAt, endAt: e.endAt, status: 'REQUESTED',
          requiresApproval: e.requiresApproval, approvedBy: null, rejectionReason: null,
          actualStartAt: null, actualEndAt: null,
        };
        break;
      case 'BookingApproved':
        if (s) { s.status = 'APPROVED'; s.approvedBy = e.actorId; }
        break;
      case 'BookingRejected':
        if (s) { s.status = 'REJECTED'; s.rejectionReason = e.reason; }
        break;
      case 'BookingStarted':
        if (s) { s.status = 'ACTIVE'; s.actualStartAt = e.actualStartAt; }
        break;
      case 'BookingCompleted':
        if (s) { s.status = 'COMPLETED'; s.actualEndAt = e.actualEndAt; }
        break;
    }
  }
  return s;
}

/** จัดกลุ่มเหตุการณ์ตามรายการจอง แล้ว replay ทีละรายการ */
export function replayAll(events: DomainEvent[]): BookingState[] {
  const byId = new Map<string, DomainEvent[]>();
  for (const e of events) {
    if (!byId.has(e.bookingId)) byId.set(e.bookingId, []);
    byId.get(e.bookingId)!.push(e);
  }
  return [...byId.values()].map(replay).filter((s): s is BookingState => s !== null);
}

/** สถานะที่ยังจับจองทรัพยากรอยู่ ใช้ตรวจการซ้อนทับ (REQ-05) */
const OCCUPYING: BookingStatus[] = ['REQUESTED', 'APPROVED', 'ACTIVE'];

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

export interface CreateBookingCommand {
  bookingId: string;
  userId: string;
  userRole: Role;
  resourceId: string;
  startAt: string;
  endAt: string;
}

/**
 * สร้างคำขอจอง
 *
 * บังคับใช้แล้ว: REQ-01, REQ-02, REQ-03, REQ-05, REQ-06, REQ-07, REQ-08, REQ-17
 */
export function createBooking(cmd: CreateBookingCommand, existing: BookingState[]): DomainEvent[] {
  if (!cmd.resourceId || !cmd.startAt || !cmd.endAt) {
    throw new DomainError('MISSING_FIELD', 'ต้องระบุ resourceId, startAt และ endAt', 400);
  }
  if (!findResource(cmd.resourceId)) {
    throw new DomainError('RESOURCE_NOT_FOUND', `ไม่พบเครื่อง ${cmd.resourceId}`, 404);
  }
  const now = new Date(nowIso());
  if (new Date(cmd.startAt) <= now) {
    throw new DomainError('START_IN_PAST', 'startAt ต้องเป็นเวลาในอนาคต', 400);
  }
  if (new Date(cmd.endAt) <= new Date(cmd.startAt)) {
    throw new DomainError('INVALID_RANGE', 'endAt ต้องอยู่หลัง startAt', 400);
  }

  const clash = existing.find(
    (b) => b.resourceId === cmd.resourceId && OCCUPYING.includes(b.status) &&
           overlaps(cmd.startAt, cmd.endAt, b.startAt, b.endAt),
  );
  if (clash) {
    throw new DomainError('OVERLAPPING_BOOKING', `ช่วงเวลาซ้อนทับกับการจอง ${clash.id}`, 409);
  }

  return [{
    type: 'BookingRequested',
    bookingId: cmd.bookingId,
    occurredAt: nowIso(),
    actorId: cmd.userId,
    userId: cmd.userId,
    userRole: cmd.userRole,
    resourceId: cmd.resourceId,
    startAt: cmd.startAt,
    endAt: cmd.endAt,
    requiresApproval: requiresApproval(bookedHours(cmd.startAt, cmd.endAt)),
  }];
}

/** อนุมัติคำขอ — REQ-18, REQ-19, REQ-20 */
export function approveBooking(state: BookingState, approverId: string, approverRole: Role): DomainEvent[] {
  if (approverRole !== 'LAB_ADMIN') {
    throw new DomainError('FORBIDDEN', 'ผู้อนุมัติต้องมีบทบาท LAB_ADMIN', 403);
  }
  if (approverId === state.userId) {
    throw new DomainError('SELF_APPROVAL', 'ผู้ขอจองอนุมัติคำขอของตัวเองไม่ได้', 403);
  }
  if (state.status !== 'REQUESTED') {
    throw new DomainError('INVALID_STATE', `อนุมัติไม่ได้เมื่อสถานะเป็น ${state.status}`, 409);
  }
  return [{ type: 'BookingApproved', bookingId: state.id, occurredAt: nowIso(), actorId: approverId }];
}

/** ปฏิเสธคำขอ — REQ-18, REQ-21 */
export function rejectBooking(state: BookingState, actorId: string, actorRole: Role, reason: string): DomainEvent[] {
  if (actorRole !== 'LAB_ADMIN') {
    throw new DomainError('FORBIDDEN', 'ผู้ปฏิเสธต้องมีบทบาท LAB_ADMIN', 403);
  }
  if (!reason || !reason.trim()) {
    throw new DomainError('MISSING_REASON', 'การปฏิเสธต้องระบุเหตุผล', 400);
  }
  if (state.status !== 'REQUESTED') {
    throw new DomainError('INVALID_STATE', `ปฏิเสธไม่ได้เมื่อสถานะเป็น ${state.status}`, 409);
  }
  return [{ type: 'BookingRejected', bookingId: state.id, occurredAt: nowIso(), actorId, reason }];
}

/** เริ่มใช้งานจริง — REQ-23, REQ-29 (การจองเกินเกณฑ์ต้องผ่านการอนุมัติก่อน ตาม REQ-17) */
export function startBooking(state: BookingState, actorId: string): DomainEvent[] {
  if (state.requiresApproval && state.status !== 'APPROVED') {
    throw new DomainError('APPROVAL_REQUIRED', 'การจองนี้ต้องได้รับอนุมัติก่อนเริ่มใช้งาน', 409);
  }
  if (!state.requiresApproval && !['REQUESTED', 'APPROVED'].includes(state.status)) {
    throw new DomainError('INVALID_STATE', `เริ่มใช้งานไม่ได้เมื่อสถานะเป็น ${state.status}`, 409);
  }
  if (state.status === 'ACTIVE') {
    throw new DomainError('INVALID_STATE', 'เริ่มใช้งานไปแล้ว', 409);
  }
  return [{ type: 'BookingStarted', bookingId: state.id, occurredAt: nowIso(), actorId, actualStartAt: nowIso() }];
}

/** สิ้นสุดการใช้งาน — REQ-31, REQ-32 */
export function completeBooking(state: BookingState, actorId: string): DomainEvent[] {
  if (state.status !== 'ACTIVE') {
    throw new DomainError('INVALID_STATE', `สิ้นสุดการใช้งานไม่ได้เมื่อสถานะเป็น ${state.status}`, 409);
  }
  const limit = new Date(new Date(state.endAt).getTime() + OVERRUN_ALLOWANCE_MINUTES * 60000);
  const actual = new Date(nowIso());
  const actualEndAt = (actual > limit ? limit : actual).toISOString();
  return [{ type: 'BookingCompleted', bookingId: state.id, occurredAt: nowIso(), actorId, actualEndAt }];
}
