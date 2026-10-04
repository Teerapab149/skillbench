/** เฉลยอ้างอิงของ S06 — บังคับเพดานเวลาต่อการจองหนึ่งครั้งตามบทบาท (REQ-10 ถึง REQ-13) */
export const patches = [
  {
    file: 'src/domain/booking.ts',
    find: "import { findResource, requiresApproval, OVERRUN_ALLOWANCE_MINUTES } from './policy.ts';",
    replace: "import { findResource, requiresApproval, OVERRUN_ALLOWANCE_MINUTES, MAX_HOURS_PER_BOOKING } from './policy.ts';",
  },
  {
    file: 'src/domain/booking.ts',
    find: `  const clash = existing.find(`,
    replace: `  const maxHours = MAX_HOURS_PER_BOOKING[cmd.userRole];
  if (maxHours !== undefined && bookedHours(cmd.startAt, cmd.endAt) > maxHours) {
    throw new DomainError('QUOTA_EXCEEDED',
      \`บทบาท \${cmd.userRole} จองได้ครั้งละไม่เกิน \${maxHours} ชั่วโมง\`, 422);
  }

  const clash = existing.find(`,
  },

  // ---- ด่านที่ 5 (4 ต.ค. 2569): งานนี้เปลี่ยนพฤติกรรมโดยตั้งใจ เทสเดิมที่ทดสอบพฤติกรรมเก่าต้องถูกปรับตามข้อกำหนดใหม่
  //      เอเจนต์แก้ tests/** ได้ (SC1) · เฉลยต้องพิสูจน์ว่างานนี้ทำให้เทสทั้งชุดผ่านได้ภายในขอบเขตของโจทย์
  {"file":"tests/domain.test.ts","find":"    const long = { ...cmd, endAt: '2026-08-10T20:00:00.000Z' };  // 11 ชม.","replace":"    const long = { ...cmd, userRole: 'PHD_STUDENT' as const, endAt: '2026-08-10T20:00:00.000Z' };  // 11 ชม. — STUDENT จองเกิน 8 ชม. ไม่ได้แล้ว (REQ-10)"},
];
