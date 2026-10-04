/**
 * ตัวช่วยเรียก API ของ fixture โดยไม่ต้องเปิด server จริง
 *
 * ทำไมต้องเรียกผ่าน router ไม่ใช่เรียกฟังก์ชันโดเมนตรง ๆ:
 * เทสยอมรับต้องวัด "ระบบทำตามข้อกำหนดหรือยัง" ไม่ใช่ "เขียนโค้ดตรงที่เราคิดไว้หรือเปล่า"
 * เอเจนต์อาจใส่การตรวจไว้ที่ชั้น route หรือชั้นโดเมนก็ได้ ทั้งสองแบบถูกต้องเท่ากัน
 * ถ้าเทสผูกกับตำแหน่ง มันจะกลายเป็นการวัดความเหมือนของ implementation
 * ซึ่งลงโทษเอเจนต์ที่ทำถูกด้วยวิธีอื่น
 *
 * ไฟล์นี้อยู่นอก workspace ของเอเจนต์ ถูกคัดลอกเข้าไปหลัง run จบแล้วเท่านั้น
 */

import { Readable } from 'node:stream';

export interface CallResult {
  status: number;
  body: any;
}

/** เรียก endpoint หนึ่งครั้ง — คืน status กับ body ที่ parse แล้ว */
export async function call(
  method: string,
  path: string,
  opts: { body?: unknown; userId?: string; userRole?: string } = {},
): Promise<CallResult> {
  // import แบบ dynamic เพื่อให้ไฟล์ที่หายไปกลายเป็น "เทสตก" ไม่ใช่ "ทั้งชุดพังตอน import"
  const { router } = await import('../src/api/routes.ts');

  const payload = opts.body === undefined ? '' : JSON.stringify(opts.body);
  const req: any = Readable.from(payload ? [Buffer.from(payload, 'utf8')] : []);
  req.method = method;
  req.url = path;
  req.headers = {
    'x-user-id': opts.userId ?? 'u-student-1',
    'x-user-role': opts.userRole ?? 'STUDENT',
    'content-type': 'application/json',
  };

  let status = 0;
  let raw = '';
  const res: any = {
    writeHead(s: number) { status = s; },
    end(t?: string) { raw = t ?? ''; },
    setHeader() { /* ไม่ใช้ */ },
  };

  await router.handle(req, res);
  let body: any = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
  return { status, body };
}

/** ล้าง event log แล้วใส่เหตุการณ์ตั้งต้นที่ควบคุมได้ */
export async function seed(events: unknown[] = []): Promise<void> {
  const { resetStore } = await import('../src/store/eventStore.ts');
  resetStore(events as any);
}

export async function allEvents(): Promise<any[]> {
  const { loadEvents } = await import('../src/store/eventStore.ts');
  return loadEvents() as any[];
}

/** เวลาที่ตรึงไว้ — ทุกเทสใช้ค่าเดียวกันเพื่อให้ผลไม่ขึ้นกับวันที่รัน */
export const NOW = '2026-03-04T09:00:00.000Z';   // วันพุธ
export function iso(daysFromNow: number, hour: number, minute = 0): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** เหตุการณ์ขอจองหนึ่งรายการ สำหรับ seed */
export function requested(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'BookingRequested',
    bookingId: 'bk-seed-1',
    occurredAt: NOW,
    actorId: 'u-student-1',
    userId: 'u-student-1',
    userRole: 'STUDENT',
    resourceId: 'gpu-v100-01',
    startAt: iso(1, 10),
    endAt: iso(1, 12),
    requiresApproval: false,
    ...over,
  };
}
