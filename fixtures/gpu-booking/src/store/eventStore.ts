/**
 * Event store แบบต่อท้ายอย่างเดียว (append-only)
 *
 * เก็บเป็นไฟล์ JSON Lines หนึ่งบรรทัดต่อหนึ่งเหตุการณ์
 * ไม่มีคำสั่งแก้ไขหรือลบ — ตามข้อกำหนด REQ-40
 *
 * ผลที่ตามมาซึ่งสำคัญต่อระบบทั้งหมด:
 *   สถานะปัจจุบันและตัวเลขทุกตัวที่ระบบรายงาน ไม่ได้ถูกเก็บไว้ที่ไหน
 *   แต่ถูก "คำนวณใหม่จากเหตุการณ์ทั้งหมด" ทุกครั้งที่มีการเรียกดู
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DomainEvent } from '../domain/events.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DATA_DIR = path.join(ROOT, 'data');
const LOG_PATH = path.join(DATA_DIR, 'events.jsonl');

export function eventLogPath(): string {
  return LOG_PATH;
}

/** อ่านเหตุการณ์ทั้งหมดตามลำดับที่บันทึก */
export function loadEvents(): DomainEvent[] {
  if (!fs.existsSync(LOG_PATH)) return [];
  return fs
    .readFileSync(LOG_PATH, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as DomainEvent);
}

/** เหตุการณ์ทั้งหมดของการจองหนึ่งรายการ เรียงตามเวลา (REQ-41) */
export function loadEventsFor(bookingId: string): DomainEvent[] {
  return loadEvents().filter((e) => e.bookingId === bookingId);
}

/** บันทึกเหตุการณ์ใหม่ต่อท้าย — ไม่มีทางแก้หรือลบของเดิม */
export function appendEvent(event: DomainEvent): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.appendFileSync(LOG_PATH, JSON.stringify(event) + '\n', 'utf8');
}

export function appendEvents(events: DomainEvent[]): void {
  for (const e of events) appendEvent(e);
}

/** ใช้เฉพาะตอน seed ข้อมูลตั้งต้นและในเทสเท่านั้น ไม่ใช่ส่วนหนึ่งของ API */
export function resetStore(events: DomainEvent[] = []): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(LOG_PATH, events.map((e) => JSON.stringify(e)).join('\n') + (events.length ? '\n' : ''), 'utf8');
}
