/**
 * เฉลยผิด ของ S04-noshow-status — no-grace-period
 *
 * ตัดเป็น NO_SHOW ทันทีที่เลยเวลาเริ่ม โดยไม่รอ 30 นาที
 *
 * ต้อง **ตก** เทสยอมรับ ถ้าผ่านแปลว่าเทสหลวมเกินไป
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/domain/booking.ts",
    "find": "      case 'BookingCompleted':\n        if (s) { s.status = 'COMPLETED'; s.actualEndAt = e.actualEndAt; }\n        break;\n    }\n  }\n  return s;\n}",
    "replace": "      case 'BookingCompleted':\n        if (s) { s.status = 'COMPLETED'; s.actualEndAt = e.actualEndAt; }\n        break;\n    }\n  }\n  if (s && !s.actualStartAt && (s.status === 'REQUESTED' || s.status === 'APPROVED')) {\n    if (new Date(nowIso()) > new Date(s.startAt)) s.status = 'NO_SHOW';\n  }\n  return s;\n}"
  }
];
