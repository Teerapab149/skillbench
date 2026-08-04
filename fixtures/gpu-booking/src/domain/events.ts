/**
 * นิยามเหตุการณ์ทั้งหมดของโดเมน
 *
 * เหตุการณ์คือสิ่งที่ "เกิดขึ้นแล้ว" จึงตั้งชื่อเป็นอดีตกาลเสมอ
 * เมื่อบันทึกแล้วห้ามแก้ไขหรือลบ (REQ-40) การเปลี่ยนแปลงทำได้เฉพาะการเพิ่มเหตุการณ์ใหม่ต่อท้าย
 */

export type BookingStatus =
  | 'REQUESTED' | 'APPROVED' | 'REJECTED'
  | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export type Role = 'STUDENT' | 'PHD_STUDENT' | 'LECTURER' | 'LAB_ADMIN';

interface EventBase {
  bookingId: string;
  /** เวลาที่เหตุการณ์เกิดขึ้น (REQ-39) */
  occurredAt: string;
  /** ผู้ที่ทำให้เหตุการณ์นี้เกิด (REQ-39) */
  actorId: string;
}

export interface BookingRequested extends EventBase {
  type: 'BookingRequested';
  userId: string;
  userRole: Role;
  resourceId: string;
  startAt: string;
  endAt: string;
  requiresApproval: boolean;
}

export interface BookingApproved extends EventBase {
  type: 'BookingApproved';
}

export interface BookingRejected extends EventBase {
  type: 'BookingRejected';
  reason: string;
}

export interface BookingStarted extends EventBase {
  type: 'BookingStarted';
  actualStartAt: string;
}

export interface BookingCompleted extends EventBase {
  type: 'BookingCompleted';
  actualEndAt: string;
}

export type DomainEvent =
  | BookingRequested
  | BookingApproved
  | BookingRejected
  | BookingStarted
  | BookingCompleted;

export type EventType = DomainEvent['type'];
