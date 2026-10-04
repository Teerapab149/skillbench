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
];
