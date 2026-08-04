/**
 * รายงานยอดรายได้รวมรายเดือน
 *
 *   node tools/revenue-report.ts
 *
 * ใช้ตรวจว่าการแก้โค้ดกระทบตัวเลขของเดือนที่ผ่านมาแล้วหรือไม่
 * เพราะยอดเงินไม่ได้ถูกเก็บไว้ แต่คำนวณใหม่จากเหตุการณ์ทุกครั้ง (ดู ARCHITECTURE.md หัวข้อ 4)
 *
 * วิธีใช้: รันก่อนแก้ จดตัวเลขไว้ แล้วรันอีกครั้งหลังแก้ ตัวเลขต้องเท่าเดิม
 * ถ้าเปลี่ยน แปลว่าใบแจ้งหนี้ที่ออกไปแล้วถูกแก้ย้อนหลัง ต้องแจ้งผู้เกี่ยวข้องก่อนนำขึ้นใช้จริง
 */

import { loadEvents } from '../src/store/eventStore.ts';
import { totalRevenueForMonth } from '../src/projections/billing.ts';

const MONTHS = ['2026-05', '2026-06', '2026-07'];
const events = loadEvents();

console.log(MONTHS.map((m) => `${m}=${totalRevenueForMonth(events, m)}`).join(' '));
