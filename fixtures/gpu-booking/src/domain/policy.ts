/**
 * นโยบายและกฎธุรกิจ
 *
 * แยกออกจาก aggregate เพื่อให้แก้นโยบายได้โดยไม่ต้องแตะตรรกะการเปลี่ยนสถานะ
 */

import type { Role } from './events.ts';

export interface Resource {
  id: string;
  tier: 'A100' | 'V100';
  /** บาทต่อชั่วโมง (REQ-34) */
  hourlyRate: number;
}

export const RESOURCES: Resource[] = [
  { id: 'gpu-a100-01', tier: 'A100', hourlyRate: 40 },
  { id: 'gpu-a100-02', tier: 'A100', hourlyRate: 40 },
  { id: 'gpu-v100-01', tier: 'V100', hourlyRate: 20 },
  { id: 'gpu-v100-02', tier: 'V100', hourlyRate: 20 },
];

export function findResource(id: string): Resource | undefined {
  return RESOURCES.find((r) => r.id === id);
}

/**
 * ระยะเวลาที่เกินเกณฑ์นี้ต้องผ่านการอนุมัติก่อนจึงเริ่มใช้งานได้ (REQ-17)
 */
export const APPROVAL_THRESHOLD_HOURS = 8;

export function requiresApproval(bookedHours: number): boolean {
  return bookedHours > APPROVAL_THRESHOLD_HOURS;
}

/**
 * เพดานระยะเวลาต่อการจองหนึ่งครั้ง แยกตามบทบาท (REQ-10 ถึง REQ-13)
 *
 * ยังไม่ได้นำมาบังคับใช้ในขั้นตอนการสร้างคำขอ — ดู booking.ts
 */
export const MAX_HOURS_PER_BOOKING: Record<Role, number> = {
  STUDENT: 8,
  PHD_STUDENT: 24,
  LECTURER: 4,
  LAB_ADMIN: 12,
};

/**
 * เพดานรายสัปดาห์ (REQ-14) — null คือไม่จำกัด
 *
 * ยังไม่ได้นำมาบังคับใช้
 */
export const MAX_HOURS_PER_WEEK: Record<Role, number | null> = {
  STUDENT: 24,
  PHD_STUDENT: 96,
  LECTURER: 16,
  LAB_ADMIN: null,
};

/** สัดส่วนที่คิดค่าบริการเมื่อจองแล้วไม่มาใช้ (REQ-36) */
export const NO_SHOW_CHARGE_RATIO = 0.5;

/** ไม่มาใช้ภายในกี่นาทีหลังเวลาเริ่ม ถือเป็นไม่มาใช้ (REQ-30) */
export const NO_SHOW_GRACE_MINUTES = 30;

/** สิ้นสุดการใช้งานช้ากว่าเวลาที่จองได้ไม่เกินกี่นาที (REQ-32) */
export const OVERRUN_ALLOWANCE_MINUTES = 15;

/** ห้ามยกเลิกภายในกี่ชั่วโมงก่อนเวลาเริ่มใช้งาน (REQ-27) */
export const CANCELLATION_CUTOFF_HOURS = 2;
