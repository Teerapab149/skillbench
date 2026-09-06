/**
 * เฉลยอ้างอิงร่วมของ S07 และ S11 — โควตารายสัปดาห์ (REQ-14, REQ-16) และขอบเขตสัปดาห์ (REQ-15)
 *
 * สองโจทย์ใช้เฉลยชุดเดียวกันเพราะขอบเขตสัปดาห์วัดผลได้ก็ต่อเมื่อมีโควตาให้วัด
 * ถ้าไม่มีโควตา การจองวันจันทร์ถัดไปก็ผ่านอยู่แล้วบน baseline และเทสจะไม่ได้วัดอะไร
 */
export const patches = [
  {
    file: 'src/domain/booking.ts',
    find: "import { findResource, requiresApproval, OVERRUN_ALLOWANCE_MINUTES } from './policy.ts';",
    replace: "import { findResource, requiresApproval, OVERRUN_ALLOWANCE_MINUTES, MAX_HOURS_PER_WEEK } from './policy.ts';",
  },
  {
    // REQ-16 — การจองที่ยกเลิกต้องไม่ถูกนับ ซึ่งต้องรู้จักสถานะ CANCELLED ก่อน
    file: 'src/domain/booking.ts',
    find: `      case 'BookingCompleted':
        if (s) { s.status = 'COMPLETED'; s.actualEndAt = e.actualEndAt; }
        break;`,
    replace: `      case 'BookingCompleted':
        if (s) { s.status = 'COMPLETED'; s.actualEndAt = e.actualEndAt; }
        break;
      case 'BookingCancelled':
        if (s) { s.status = 'CANCELLED'; }
        break;`,
  },
  {
    file: 'src/domain/booking.ts',
    find: `export interface CreateBookingCommand {`,
    replace: `/**
 * ต้นสัปดาห์ของเวลาที่ระบุ — สัปดาห์เริ่มวันจันทร์ 00:00 (REQ-15)
 *
 * getUTCDay() ให้อาทิตย์ = 0 จึงต้องหมุนให้จันทร์ = 0 ก่อน
 * การนับแบบ "ย้อนหลัง 7 วันจากวันนี้" เป็นคนละความหมายและผิดตามข้อกำหนด
 */
function weekStartUtc(iso: string): number {
  const d = new Date(iso);
  const dow = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);
}

export interface CreateBookingCommand {`,
  },
  {
    file: 'src/domain/booking.ts',
    find: `  const clash = existing.find(`,
    replace: `  const weekCap = MAX_HOURS_PER_WEEK[cmd.userRole];
  if (weekCap !== null && weekCap !== undefined) {
    const wk = weekStartUtc(cmd.startAt);
    const used = existing
      .filter((b) => b.userId === cmd.userId && weekStartUtc(b.startAt) === wk
                     && b.status !== 'CANCELLED' && b.status !== 'REJECTED')
      .reduce((sum, b) => sum + bookedHours(b.startAt, b.endAt), 0);
    if (used + bookedHours(cmd.startAt, cmd.endAt) > weekCap) {
      throw new DomainError('WEEKLY_QUOTA_EXCEEDED',
        \`เกินโควตารายสัปดาห์ของบทบาท \${cmd.userRole} (\${weekCap} ชั่วโมง)\`, 422);
    }
  }

  const clash = existing.find(`,
  },
];
