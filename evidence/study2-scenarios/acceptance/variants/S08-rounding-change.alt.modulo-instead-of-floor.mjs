/**
 * เฉลยถูกแต่เขียนคนละแบบ ของ S08-rounding-change — modulo-instead-of-floor
 *
 * ใช้ลบเศษแทน Math.floor — ได้ผลเดียวกันทุกกรณี
 *
 * ต้อง **ผ่าน** เทสยอมรับ ถ้าตกแปลว่าเทสผูกกับ implementation
 */
export const kind = 'alt';
export const patches = [
  {
    "file": "src/lib/duration.ts",
    "find": "  return Math.ceil(raw / BILLING_INCREMENT_MINUTES) * BILLING_INCREMENT_MINUTES;",
    "replace": "  return raw - (raw % BILLING_INCREMENT_MINUTES);"
  }
];
