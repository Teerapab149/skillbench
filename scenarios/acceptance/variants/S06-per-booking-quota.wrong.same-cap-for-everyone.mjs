/**
 * เฉลยผิด ของ S06-per-booking-quota — same-cap-for-everyone
 *
 * ใช้เพดาน 8 ชั่วโมงกับทุกบทบาท — พลาดที่ LECTURER ซึ่งมีเพดานต่ำกว่า
 *
 * ต้อง **ตก** เทสยอมรับ ถ้าผ่านแปลว่าเทสหลวมเกินไป
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/domain/booking.ts",
    "find": "  const clash = existing.find(",
    "replace": "  if (bookedHours(cmd.startAt, cmd.endAt) > 8) {\n    throw new DomainError('QUOTA_EXCEEDED', 'จองได้ครั้งละไม่เกิน 8 ชั่วโมง', 422);\n  }\n\n  const clash = existing.find("
  }
];
