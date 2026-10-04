/**
 * เฉลยผิด ของ S08-rounding-change — round-not-floor
 *
 * ใช้ปัดใกล้สุดแทนปัดลง — ต่างกันเฉพาะบางค่า จึงเป็นเคสที่เทสชุดเดิมจับไม่ได้
 *
 * ต้อง **ตก** เทสยอมรับ ถ้าผ่านแปลว่าเทสหลวมเกินไป
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/lib/duration.ts",
    "find": "  return Math.ceil(raw / BILLING_INCREMENT_MINUTES) * BILLING_INCREMENT_MINUTES;",
    "replace": "  return Math.round(raw / BILLING_INCREMENT_MINUTES) * BILLING_INCREMENT_MINUTES;"
  }
];
