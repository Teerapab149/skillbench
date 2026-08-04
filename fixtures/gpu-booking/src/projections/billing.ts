/**
 * Projection การคิดค่าบริการ (REQ-33 ถึง REQ-38)
 *
 * ==========================================================================
 * ข้อควรทราบที่สำคัญที่สุดของไฟล์นี้
 *
 * ยอดเงินไม่ได้ถูกเก็บไว้ที่ไหนเลย ทุกครั้งที่มีการเรียกดูใบแจ้งหนี้
 * ระบบจะอ่านเหตุการณ์ทั้งหมดตั้งแต่ต้นแล้วคำนวณใหม่หมด
 *
 * ผลที่ตามมา: การเปลี่ยนตรรกะการคำนวณในไฟล์นี้ หรือในโมดูลที่ไฟล์นี้เรียกใช้
 * จะทำให้ใบแจ้งหนี้ของ "ทุกเดือนย้อนหลัง" เปลี่ยนค่าไปด้วย
 * ทั้งที่ไม่มีข้อมูลใดถูกแก้ไขเลยแม้แต่แถวเดียว
 * ==========================================================================
 */

import type { DomainEvent } from '../domain/events.ts';
import { replayAll, type BookingState } from '../domain/booking.ts';
import { findResource, NO_SHOW_CHARGE_RATIO } from '../domain/policy.ts';
import { billableMinutes, bookedMinutes } from '../lib/duration.ts';

export interface InvoiceLine {
  bookingId: string;
  resourceId: string;
  billableMinutes: number;
  amountBaht: number;
  note?: string;
}

export interface Invoice {
  userId: string;
  month: string;
  totalBaht: number;
  lines: InvoiceLine[];
}

function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

function priceOne(b: BookingState): InvoiceLine | null {
  const resource = findResource(b.resourceId);
  if (!resource) return null;

  // การจองที่ยกเลิกไม่คิดค่าบริการ (REQ-37)
  if (b.status === 'CANCELLED') return null;

  if (b.status === 'COMPLETED' && b.actualStartAt && b.actualEndAt) {
    // คิดตามเวลาที่ใช้จริง (REQ-33) ปัดตามหน่วยที่กำหนด (REQ-35)
    const minutes = billableMinutes(b.actualStartAt, b.actualEndAt);
    return {
      bookingId: b.id,
      resourceId: b.resourceId,
      billableMinutes: minutes,
      amountBaht: round2((minutes / 60) * resource.hourlyRate),
    };
  }

  if (b.status === 'NO_SHOW') {
    // จองแล้วไม่มาใช้ คิดตามสัดส่วนของเวลาที่จองไว้ (REQ-36)
    const minutes = bookedMinutes(b.startAt, b.endAt) * NO_SHOW_CHARGE_RATIO;
    return {
      bookingId: b.id,
      resourceId: b.resourceId,
      billableMinutes: minutes,
      amountBaht: round2((minutes / 60) * resource.hourlyRate),
      note: 'no-show',
    };
  }

  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** เดือนที่นำการจองไปคิดเงิน อ้างตามเวลาเริ่มใช้จริง หรือเวลาที่จองไว้ถ้าไม่มา (REQ-38) */
function billingMonthOf(b: BookingState): string {
  return monthOf(b.actualStartAt ?? b.startAt);
}

export function buildInvoice(events: DomainEvent[], userId: string, month: string): Invoice {
  const lines: InvoiceLine[] = [];
  for (const b of replayAll(events)) {
    if (b.userId !== userId) continue;
    if (billingMonthOf(b) !== month) continue;
    const line = priceOne(b);
    if (line) lines.push(line);
  }
  return {
    userId,
    month,
    totalBaht: round2(lines.reduce((s, l) => s + l.amountBaht, 0)),
    lines,
  };
}

/** ยอดรวมของทั้งระบบในเดือนที่ระบุ — ใช้ตรวจว่าตัวเลขย้อนหลังถูกเปลี่ยนหรือไม่ */
export function totalRevenueForMonth(events: DomainEvent[], month: string): number {
  let total = 0;
  for (const b of replayAll(events)) {
    if (billingMonthOf(b) !== month) continue;
    const line = priceOne(b);
    if (line) total += line.amountBaht;
  }
  return round2(total);
}
