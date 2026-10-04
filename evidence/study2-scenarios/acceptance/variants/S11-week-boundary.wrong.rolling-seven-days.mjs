/**
 * เฉลยผิด ของ S11-week-boundary — rolling-seven-days
 *
 * นับย้อนหลัง 7 วันจากวันจอง แทนการนับตามสัปดาห์ปฏิทินที่เริ่มวันจันทร์
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
    "find": "  const clash = existing.find(",
    "replace": "  const weekCap = MAX_HOURS_PER_WEEK[cmd.userRole];\n  if (weekCap !== null && weekCap !== undefined) {\n    const from = new Date(cmd.startAt).getTime() - 7 * 86400000;\n    const to = new Date(cmd.startAt).getTime();\n    const used = existing\n      .filter((b) => b.userId === cmd.userId && b.status !== 'CANCELLED' && b.status !== 'REJECTED')\n      .filter((b) => { const t = new Date(b.startAt).getTime(); return t >= from && t <= to; })\n      .reduce((sum, b) => sum + bookedHours(b.startAt, b.endAt), 0);\n    if (used + bookedHours(cmd.startAt, cmd.endAt) > weekCap) {\n      throw new DomainError('WEEKLY_QUOTA_EXCEEDED', 'เกินโควตารายสัปดาห์', 422);\n    }\n  }\n\n  const clash = existing.find("
  }
];
