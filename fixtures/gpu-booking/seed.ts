/**
 * สร้างข้อมูลตั้งต้น — ประวัติการใช้งานย้อนหลัง 3 เดือน (พฤษภาคม–กรกฎาคม 2026)
 *
 * ใช้ตัวสุ่มที่กำหนด seed ไว้ จึงได้ข้อมูลชุดเดิมทุกครั้งที่รัน
 * ข้อมูลนี้คือ "ใบแจ้งหนี้ที่ออกไปแล้ว" ของเดือนที่ผ่านมา
 *
 *   node seed.ts
 */

import type { DomainEvent, Role } from './src/domain/events.ts';
import { resetStore, eventLogPath } from './src/store/eventStore.ts';
import { totalRevenueForMonth } from './src/projections/billing.ts';
import { loadEvents } from './src/store/eventStore.ts';

function makeRng(seed: number) {
  let x = seed >>> 0 || 1, y = 362436069, z = 521288629, w = 88675123;
  return () => {
    const t = x ^ (x << 11);
    x = y; y = z; z = w;
    w = (w ^ (w >>> 19)) ^ (t ^ (t >>> 8));
    return (w >>> 0) / 4294967296;
  };
}

const USERS: { id: string; role: Role }[] = [
  { id: 'u-somchai', role: 'PHD_STUDENT' },
  { id: 'u-nadia', role: 'PHD_STUDENT' },
  { id: 'u-pat', role: 'STUDENT' },
  { id: 'u-ming', role: 'STUDENT' },
  { id: 'u-arun', role: 'LECTURER' },
  { id: 'u-kanya', role: 'LECTURER' },
  { id: 'u-admin', role: 'LAB_ADMIN' },
];

const RESOURCE_IDS = ['gpu-a100-01', 'gpu-a100-02', 'gpu-v100-01', 'gpu-v100-02'];

const iso = (d: Date) => d.toISOString();
const addMin = (d: Date, m: number) => new Date(d.getTime() + m * 60000);

function build(): DomainEvent[] {
  const rnd = makeRng(20260804);
  const events: DomainEvent[] = [];
  let n = 0;

  // ไล่ทีละวันตั้งแต่ 1 พ.ค. ถึง 31 ก.ค. 2026
  const start = new Date('2026-05-01T00:00:00.000Z');
  const days = 92;

  for (let d = 0; d < days; d++) {
    const bookingsToday = rnd() < 0.35 ? 0 : 1 + Math.floor(rnd() * 2);
    for (let k = 0; k < bookingsToday; k++) {
      n += 1;
      const user = USERS[Math.floor(rnd() * (USERS.length - 1))]; // ไม่รวม admin
      const resourceId = RESOURCE_IDS[Math.floor(rnd() * RESOURCE_IDS.length)];
      const bookingId = `bk-seed-${String(n).padStart(3, '0')}`;

      const dayStart = new Date(start.getTime() + d * 86400000);
      const startHour = 8 + Math.floor(rnd() * 9);
      const startAt = new Date(dayStart);
      startAt.setUTCHours(startHour, k * 15, 0, 0);

      // ระยะเวลาที่จอง เป็นจำนวนเท่าของ 15 นาที ตาม REQ-04
      const blocks = 4 + Math.floor(rnd() * 12);          // 1 ถึง 4 ชม.
      const endAt = addMin(startAt, blocks * 15);
      const bookedHours = (blocks * 15) / 60;
      const requiresApproval = bookedHours > 8;

      const requestedAt = addMin(startAt, -(60 + Math.floor(rnd() * 2880)));
      events.push({
        type: 'BookingRequested', bookingId, occurredAt: iso(requestedAt), actorId: user.id,
        userId: user.id, userRole: user.role, resourceId,
        startAt: iso(startAt), endAt: iso(endAt), requiresApproval,
      });

      if (requiresApproval) {
        events.push({ type: 'BookingApproved', bookingId, occurredAt: iso(addMin(requestedAt, 30)), actorId: 'u-admin' });
      }

      const roll = rnd();

      if (roll < 0.12) {
        // จองแล้วไม่มาใช้ — ยังไม่มีเหตุการณ์ NoShow ในระบบ จึงค้างสถานะไว้
        continue;
      }

      // เริ่มใช้งานช้ากว่าเวลาที่จองเล็กน้อย
      const actualStartAt = addMin(startAt, Math.floor(rnd() * 12));
      events.push({
        type: 'BookingStarted', bookingId, occurredAt: iso(actualStartAt),
        actorId: user.id, actualStartAt: iso(actualStartAt),
      });

      if (roll < 0.2) continue;   // ค้างสถานะกำลังใช้งาน (ยังไม่ complete)

      // เลิกใช้ก่อนเวลาเล็กน้อย และ "จงใจให้ไม่ลงตัว 15 นาที"
      // เพื่อให้การปัดขึ้นกับปัดลงให้ผลต่างกันจริง
      const usedMinutes = blocks * 15 - (1 + Math.floor(rnd() * 20));
      const actualEndAt = addMin(actualStartAt, Math.max(5, usedMinutes));
      events.push({
        type: 'BookingCompleted', bookingId, occurredAt: iso(actualEndAt),
        actorId: user.id, actualEndAt: iso(actualEndAt),
      });
    }
  }

  return events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

const events = build();
resetStore(events);

const stored = loadEvents();
console.log(`\nสร้างข้อมูลตั้งต้นแล้ว: ${stored.length} เหตุการณ์`);
console.log(`  ไฟล์: ${eventLogPath()}`);
console.log('\nรายได้รวมรายเดือน (คำนวณจากเหตุการณ์ ไม่ได้เก็บไว้):');
for (const m of ['2026-05', '2026-06', '2026-07']) {
  console.log(`  ${m}  ${totalRevenueForMonth(stored, m).toLocaleString('th-TH')} บาท`);
}
console.log('');
