/**
 * เฉลยผิด ของ S07-weekly-quota — counts-cancelled
 *
 * นับการจองที่ยกเลิกแล้วรวมในโควตาด้วย (ผิด REQ-16)
 *
 * ต้อง **ตก** เทสยอมรับ ถ้าผ่านแปลว่าเทสหลวมเกินไป
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/domain/booking.ts",
    "find": "import { findResource, requiresApproval, OVERRUN_ALLOWANCE_MINUTES } from './policy.ts';",
    "replace": "import { findResource, requiresApproval, OVERRUN_ALLOWANCE_MINUTES, MAX_HOURS_PER_WEEK } from './policy.ts';"
  },
  {
    "file": "src/domain/booking.ts",
    "find": "      case 'BookingCompleted':\n        if (s) { s.status = 'COMPLETED'; s.actualEndAt = e.actualEndAt; }\n        break;",
    "replace": "      case 'BookingCompleted':\n        if (s) { s.status = 'COMPLETED'; s.actualEndAt = e.actualEndAt; }\n        break;\n      case 'BookingCancelled':\n        if (s) { s.status = 'CANCELLED'; }\n        break;"
  },
  {
    "file": "src/domain/booking.ts",
    "find": "export interface CreateBookingCommand {",
    "replace": "function weekStartUtc(iso: string): number {\n  const d = new Date(iso);\n  const dow = (d.getUTCDay() + 6) % 7;\n  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);\n}\n\nexport interface CreateBookingCommand {"
  },
  {
    "file": "src/domain/booking.ts",
    "find": "  const clash = existing.find(",
    "replace": "  const weekCap = MAX_HOURS_PER_WEEK[cmd.userRole];\n  if (weekCap !== null && weekCap !== undefined) {\n    const wk = weekStartUtc(cmd.startAt);\n    const used = existing\n      .filter((b) => b.userId === cmd.userId && weekStartUtc(b.startAt) === wk)\n      .reduce((sum, b) => sum + bookedHours(b.startAt, b.endAt), 0);\n    if (used + bookedHours(cmd.startAt, cmd.endAt) > weekCap) {\n      throw new DomainError('WEEKLY_QUOTA_EXCEEDED', 'เกินโควตารายสัปดาห์', 422);\n    }\n  }\n\n  const clash = existing.find("
  }
];
