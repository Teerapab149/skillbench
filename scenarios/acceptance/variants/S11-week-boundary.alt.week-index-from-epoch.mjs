/**
 * เฉลยถูกแต่เขียนคนละแบบ ของ S11-week-boundary — week-index-from-epoch
 *
 * เฉลยอ้างอิงหาต้นสัปดาห์ด้วย getUTCDay() แล้วหมุนให้จันทร์ = 0
 * ฉบับนี้ไม่ถามวันในสัปดาห์เลย แต่หารเวลาด้วยความยาวสัปดาห์จากหมุดที่เป็นวันจันทร์:
 * 5 ม.ค. 1970 เป็นวันจันทร์ ดังนั้น floor((t - หมุด) / 7 วัน) คือดัชนีสัปดาห์
 *
 * ทั้งสองวิธีให้ขอบเขตเดียวกันเป๊ะคือเที่ยงคืนวันจันทร์ UTC แต่คนละเลขคนละรูปแบบ
 * (อันหนึ่งได้ epoch ของต้นสัปดาห์ อีกอันได้ดัชนีสัปดาห์) ถ้าเทสตกกับไฟล์นี้
 * แปลว่ามันวัดวิธีคำนวณ ไม่ได้วัดว่าขอบเขตสัปดาห์อยู่ตรงไหน ซึ่งคือ REQ-15
 *
 * การกรองการจองที่ไม่นับก็เขียนคนละแบบ: ใช้รายการสถานะที่ "ยังนับ" แทนการไล่ปฏิเสธทีละสถานะ
 *
 * ต้อง **ผ่าน** เทสยอมรับ ถ้าตกแปลว่าเทสผูกกับ implementation
 */
export const kind = 'alt';
export const patches = [
  {
    file: 'src/domain/booking.ts',
    find: `import { findResource, requiresApproval, OVERRUN_ALLOWANCE_MINUTES } from './policy.ts';`,
    replace: `import { findResource, requiresApproval, OVERRUN_ALLOWANCE_MINUTES, MAX_HOURS_PER_WEEK } from './policy.ts';`,
  },
  {
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
    replace: `/** 5 ม.ค. 1970 เป็นวันจันทร์ — ใช้เป็นหมุดของการหารสัปดาห์ */
const MONDAY_EPOCH_MS = Date.UTC(1970, 0, 5);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * ดัชนีสัปดาห์ของเวลาที่ระบุ — สัปดาห์เริ่มวันจันทร์ 00:00 UTC (REQ-15)
 *
 * เวลาสองจุดอยู่สัปดาห์เดียวกันก็ต่อเมื่อได้ดัชนีเท่ากัน
 * ขอบเขตจึงตกที่เที่ยงคืนวันจันทร์เสมอ ไม่ใช่ "ย้อนหลัง 7 วันจากวันนี้"
 * ซึ่งเป็นคนละความหมายและผิดตามข้อกำหนด
 */
function weekIndex(iso: string): number {
  return Math.floor((new Date(iso).getTime() - MONDAY_EPOCH_MS) / WEEK_MS);
}

/** สถานะที่ยังกินโควตารายสัปดาห์ — ที่ยกเลิกหรือถูกปฏิเสธไม่อยู่ในนี้ (REQ-16) */
const COUNTS_TOWARD_QUOTA: BookingStatus[] = ['REQUESTED', 'APPROVED', 'ACTIVE', 'COMPLETED'];

export interface CreateBookingCommand {`,
  },
  {
    file: 'src/domain/booking.ts',
    find: `  const clash = existing.find(`,
    replace: `  const weekCap = MAX_HOURS_PER_WEEK[cmd.userRole];
  if (weekCap !== null && weekCap !== undefined) {
    const wk = weekIndex(cmd.startAt);
    let used = 0;
    for (const b of existing) {
      if (b.userId !== cmd.userId) continue;
      if (!COUNTS_TOWARD_QUOTA.includes(b.status)) continue;
      if (weekIndex(b.startAt) !== wk) continue;
      used += bookedHours(b.startAt, b.endAt);
    }
    if (used + bookedHours(cmd.startAt, cmd.endAt) > weekCap) {
      throw new DomainError('WEEKLY_QUOTA_EXCEEDED',
        \`เกินโควตารายสัปดาห์ของบทบาท \${cmd.userRole} (\${weekCap} ชั่วโมง)\`, 422);
    }
  }

  const clash = existing.find(`,
  },
];
