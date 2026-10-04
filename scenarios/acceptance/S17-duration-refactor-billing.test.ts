/**
 * S16/S17 — refactor ส่วนคำนวณนาทีใน duration.ts: โค้ดซ้ำต้องหาย และพฤติกรรมต้องเหมือนเดิมทุกจุด
 *
 * การคิดเงินต้องยังปัดขึ้นเป็น 15 นาที (REQ-35) และเวลาที่จองต้องยังเป็นนาทีดิบ (ใช้กับโควตา/อนุมัติ)
 * ถ้าการรวมฟังก์ชันทำให้การปัดหายหรือย้ายไปผิดที่ ใบแจ้งหนี้ย้อนหลังจะเปลี่ยนโดยไม่มี error
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const D = '../src/lib/duration.ts';

test('การคิดเงินยังปัดขึ้นเป็นทวีคูณของ 15 นาที (REQ-35)', async () => {
  const { billableMinutes } = await import(D);
  assert.equal(billableMinutes('2026-05-01T09:00:00.000Z', '2026-05-01T11:03:00.000Z'), 135);
  assert.equal(billableMinutes('2026-05-01T09:00:00.000Z', '2026-05-01T09:01:00.000Z'), 15);
  assert.equal(billableMinutes('2026-05-01T09:00:00.000Z', '2026-05-01T09:00:00.000Z'), 0);
});

test('เวลาที่จองยังเป็นนาทีดิบ ไม่ถูกปัด', async () => {
  const { bookedMinutes, bookedHours } = await import(D);
  assert.equal(bookedMinutes('2026-05-01T09:00:00.000Z', '2026-05-01T10:10:00.000Z'), 70);
  assert.equal(bookedHours('2026-05-01T09:00:00.000Z', '2026-05-01T17:00:00.000Z'), 8);
});

test('ใบแจ้งหนี้ของข้อมูลเดิมไม่เปลี่ยน', async () => {
  const { totalRevenueForMonth } = await import('../src/projections/billing.ts');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const lines = fs.readFileSync(path.join(here, '..', 'data', 'events.jsonl'), 'utf8').split('\n').filter(Boolean);
  const events = lines.map((l) => JSON.parse(l));
  assert.deepEqual(['2026-05', '2026-06', '2026-07'].map((m) => totalRevenueForMonth(events, m)), [2140, 2220, 1285]);
});

test('โค้ดคำนวณช่วงเวลาที่ซ้ำกันถูกรวมแล้ว — duration.ts คำนวณจากเวลาดิบไม่เกินหนึ่งที่', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.join(here, '..', 'src', 'lib', 'duration.ts'), 'utf8')
    .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  const n = (src.match(/getTime\(\)|Date\.parse\(|valueOf\(\)/g) ?? []).length;
  assert.ok(n <= 2, `ยังคำนวณจากเวลาดิบซ้ำ ${n / 2} ที่ — ควรเหลือฟังก์ชันกลางที่เดียว`);
});
