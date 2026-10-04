/**
 * S03 — REQ-52: ข้อผิดพลาดต้องอยู่ในรูป { error: { code, message } } ทุกกรณี
 *
 * แดงบน baseline เพราะมีสองที่ที่ยังไม่ตรงรูปแบบ:
 *   routes.ts — availability คืน { message: 'resource not found' }
 *   routes.ts — invoices คืน { error: 'userId and month are required' } (error เป็น string)
 */
process.env.GPU_BOOKING_NOW ??= '2026-03-04T09:00:00.000Z';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { call, seed } from './_harness.ts';

function assertStandardError(r: { status: number; body: any }, where: string) {
  assert.ok(r.status >= 400, `${where}: ต้องเป็นสถานะข้อผิดพลาด แต่ได้ ${r.status}`);
  assert.ok(r.body && typeof r.body === 'object', `${where}: body ต้องเป็น object`);
  assert.ok(r.body.error && typeof r.body.error === 'object',
    `${where}: ต้องมีฟิลด์ error เป็น object ตาม REQ-52 แต่ได้ ${JSON.stringify(r.body)}`);
  assert.equal(typeof r.body.error.code, 'string', `${where}: error.code ต้องเป็น string`);
  assert.ok(r.body.error.code.length > 0, `${where}: error.code ต้องไม่ว่าง`);
  assert.equal(typeof r.body.error.message, 'string', `${where}: error.message ต้องเป็น string`);
  assert.ok(r.body.error.message.length > 0, `${where}: error.message ต้องไม่ว่าง`);
}

test('REQ-52 availability ของเครื่องที่ไม่มีอยู่ ต้องตอบรูปแบบมาตรฐาน', async () => {
  await seed([]);
  assertStandardError(await call('GET', '/resources/gpu-ไม่มีจริง/availability'), 'availability 404');
});

test('REQ-52 invoices ที่ขาดพารามิเตอร์ ต้องตอบรูปแบบมาตรฐาน', async () => {
  await seed([]);
  assertStandardError(await call('GET', '/billing/invoices'), 'invoices 400');
});

test('REQ-52 เส้นทางที่ไม่มีอยู่ ต้องตอบรูปแบบมาตรฐาน (เดิมถูกอยู่แล้ว ห้ามทำพัง)', async () => {
  await seed([]);
  assertStandardError(await call('GET', '/ไม่มีเส้นทางนี้'), 'router 404');
});

test('REQ-52 ข้อผิดพลาดจากโดเมนยังต้องอยู่ในรูปแบบเดิม (ห้ามทำพัง)', async () => {
  await seed([]);
  assertStandardError(await call('GET', '/bookings/bk-ไม่มีจริง'), 'booking 404');
});
