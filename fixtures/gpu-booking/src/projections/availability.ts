/**
 * Projection ตารางการใช้งานเครื่อง (REQ-05)
 *
 * ตอบคำถามว่าเครื่องหนึ่งถูกจองไว้ช่วงไหนบ้าง สร้างจากการเล่นเหตุการณ์ซ้ำ
 */

import type { DomainEvent } from '../domain/events.ts';
import { replayAll, type BookingState } from '../domain/booking.ts';

export interface OccupiedSlot {
  bookingId: string;
  startAt: string;
  endAt: string;
  status: string;
}

const OCCUPYING = ['REQUESTED', 'APPROVED', 'ACTIVE'];

export function occupiedSlots(
  events: DomainEvent[],
  resourceId: string,
  from: string,
  to: string,
): OccupiedSlot[] {
  return replayAll(events)
    .filter((b: BookingState) =>
      b.resourceId === resourceId &&
      OCCUPYING.includes(b.status) &&
      new Date(b.startAt) < new Date(to) &&
      new Date(from) < new Date(b.endAt))
    .map((b) => ({ bookingId: b.id, startAt: b.startAt, endAt: b.endAt, status: b.status }))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
}
