/**
 * เฉลยถูกแต่เขียนคนละแบบ ของ S07-weekly-quota — quota-from-event-log
 *
 * เฉลยอ้างอิงบังคับโควตาในชั้นโดเมน โดยอ่านสถานะที่ replay แล้ว และรู้จัก CANCELLED
 * ได้เพราะเพิ่ม case ลงใน replay ก่อน
 *
 * ฉบับนี้ทำคนละทาง: บังคับที่ชั้น route และนับจาก **event log ดิบ** โดยไม่ต้องแตะ replay เลย
 * การจองที่มีเหตุการณ์ BookingCancelled หรือ BookingRejected จะถูกถอดออกจากตะกร้าทันที
 * ซึ่งให้ผลตาม REQ-16 เหมือนกันโดยไม่ต้องรู้จักสถานะ CANCELLED ในชั้นโดเมน
 *
 * ถ้าเทสตกกับไฟล์นี้ แปลว่ามันวัด "เขียนโควตาไว้ที่ไหนและรู้สถานะยังไง"
 * ไม่ได้วัด "ใช้ครบโควตาแล้วจองเพิ่มไม่ได้" ซึ่งเป็นข้อกำหนดจริง
 *
 * ต้อง **ผ่าน** เทสยอมรับ ถ้าตกแปลว่าเทสผูกกับ implementation
 */
export const kind = 'alt';
export const patches = [
  {
    file: 'src/api/routes.ts',
    find: `import { RESOURCES } from '../domain/policy.ts';`,
    replace: `import { RESOURCES, MAX_HOURS_PER_WEEK } from '../domain/policy.ts';`,
  },
  {
    file: 'src/api/routes.ts',
    find: `router.add('POST', '/bookings', (ctx) => {
  const me = actor(ctx);
  const body = ctx.body ?? {};
  const events = loadEvents();
`,
    replace: `/**
 * ต้นสัปดาห์แบบคีย์ข้อความ — สัปดาห์เริ่มวันจันทร์ 00:00 UTC (REQ-15)
 * getUTCDay() ให้อาทิตย์ = 0 จึงหมุนให้จันทร์ = 0 ก่อน
 */
function weekKey(iso: string): string {
  const d = new Date(iso);
  const dow = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow))
    .toISOString().slice(0, 10);
}

/**
 * ชั่วโมงที่ผู้ใช้จองไปแล้วในสัปดาห์เดียวกัน อ่านจาก event log ดิบ (REQ-14, REQ-16)
 *
 * ไม่ต้องพึ่งสถานะที่ replay แล้ว — การจองที่ถูกยกเลิกหรือถูกปฏิเสธจะถูกถอดออกจากแผนที่
 * ตอนเจอเหตุการณ์นั้น จึงไม่ถูกนับ ซึ่งคือผลลัพธ์เดียวกับที่ REQ-16 ต้องการ
 */
function hoursUsedInWeek(events: ReturnType<typeof loadEvents>, userId: string, week: string): number {
  const live = new Map<string, number>();
  for (const raw of events) {
    const e = raw as Record<string, string>;
    if (e.type === 'BookingRequested') {
      if (e.userId !== userId || weekKey(e.startAt) !== week) continue;
      live.set(e.bookingId, (new Date(e.endAt).getTime() - new Date(e.startAt).getTime()) / 3600000);
    } else if (e.type === 'BookingCancelled' || e.type === 'BookingRejected') {
      live.delete(e.bookingId);
    }
  }
  let sum = 0;
  for (const h of live.values()) sum += h;
  return sum;
}

router.add('POST', '/bookings', (ctx) => {
  const me = actor(ctx);
  const body = ctx.body ?? {};
  const events = loadEvents();

  const weekCap = (MAX_HOURS_PER_WEEK as Record<string, number | null>)[me.role];
  if (weekCap !== null && weekCap !== undefined && body.startAt && body.endAt) {
    const week = weekKey(body.startAt);
    const used = hoursUsedInWeek(events, me.id, week);
    const want = (new Date(body.endAt).getTime() - new Date(body.startAt).getTime()) / 3600000;
    if (used + want > weekCap) {
      return {
        status: 422,
        payload: {
          error: {
            code: 'WEEKLY_QUOTA_EXCEEDED',
            message: \`เกินโควตารายสัปดาห์ของบทบาท \${me.role} (\${weekCap} ชั่วโมง)\`,
          },
        },
      };
    }
  }
`,
  },
];
