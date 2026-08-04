/**
 * นาฬิกาของระบบ
 *
 * แยกออกมาเป็นโมดูลเดียวเพื่อให้ทดสอบได้ — ตั้ง GPU_BOOKING_NOW เพื่อตรึงเวลา
 * ห้ามเรียก new Date() หรือ Date.now() ตรงๆ ที่อื่นในระบบ
 */

export function now(): Date {
  const override = process.env.GPU_BOOKING_NOW;
  return override ? new Date(override) : new Date();
}

export function nowIso(): string {
  return now().toISOString();
}
