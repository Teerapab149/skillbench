/**
 * การคำนวณระยะเวลา
 *
 * โมดูลนี้เป็นแหล่งความจริงเดียวของการแปลง "ช่วงเวลา" เป็น "จำนวนนาทีที่นับ"
 * ใช้ทั้งในการคิดค่าบริการ (REQ-33, REQ-35) และการนับโควตาการใช้งาน (REQ-14)
 */

export const BILLING_INCREMENT_MINUTES = 15;

/** จำนวนนาทีดิบระหว่างสองเวลา (ไม่ปัด) */
export function rawMinutesBetween(startIso: string, endIso: string): number {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return ms / 60000;
}

/**
 * จำนวนนาทีที่นำไปคิดค่าบริการ — ปัดขึ้นเป็นจำนวนเท่าของ 15 นาที (REQ-35)
 *
 * ตัวอย่าง: ใช้จริง 2 ชม. 3 นาที (123 นาที) -> 135 นาที (2 ชม. 15 นาที)
 */
export function billableMinutes(startIso: string, endIso: string): number {
  const raw = rawMinutesBetween(startIso, endIso);
  if (raw <= 0) return 0;
  return Math.ceil(raw / BILLING_INCREMENT_MINUTES) * BILLING_INCREMENT_MINUTES;
}

/** ระยะเวลาที่จองไว้ (ตามที่ขอ ไม่ใช่ที่ใช้จริง) เป็นนาที */
export function bookedMinutes(startAt: string, endAt: string): number {
  return rawMinutesBetween(startAt, endAt);
}

/** ระยะเวลาที่จองไว้เป็นชั่วโมง ใช้ตรวจเพดานต่อครั้ง (REQ-10 ถึง REQ-13) */
export function bookedHours(startAt: string, endAt: string): number {
  return bookedMinutes(startAt, endAt) / 60;
}
