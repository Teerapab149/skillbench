/**
 * เส้นทาง API ทั้งหมด
 *
 * ดูสัญญาฉบับเต็มที่ openapi.yaml และข้อกำหนดที่ REQUIREMENTS.md
 */

import { Router, type Ctx } from './router.ts';
import { loadEvents, appendEvents } from '../store/eventStore.ts';
import {
  createBooking, approveBooking, rejectBooking, startBooking, completeBooking,
  replay, replayAll, DomainError, type BookingState,
} from '../domain/booking.ts';
import type { Role } from '../domain/events.ts';
import { RESOURCES } from '../domain/policy.ts';
import { occupiedSlots } from '../projections/availability.ts';
import { buildInvoice } from '../projections/billing.ts';
import { nowIso } from '../lib/clock.ts';

export const router = new Router();

let counter = 0;
function nextBookingId(): string {
  counter += 1;
  return `bk-${Date.now().toString(36)}-${counter}`;
}

function requireBooking(bookingId: string): { state: BookingState; events: ReturnType<typeof loadEvents> } {
  const events = loadEvents();
  const state = replay(events.filter((e) => e.bookingId === bookingId));
  if (!state) throw new DomainError('BOOKING_NOT_FOUND', `ไม่พบการจอง ${bookingId}`, 404);
  return { state, events };
}

function actor(ctx: Ctx): { id: string; role: Role } {
  return { id: ctx.userId, role: ctx.userRole as Role };
}

// ---------------------------------------------------------------- bookings

router.add('POST', '/bookings', (ctx) => {
  const me = actor(ctx);
  const body = ctx.body ?? {};
  const events = loadEvents();

  const newEvents = createBooking(
    {
      bookingId: nextBookingId(),
      userId: me.id,
      userRole: me.role,
      resourceId: body.resourceId,
      startAt: body.startAt,
      endAt: body.endAt,
    },
    replayAll(events),
  );
  appendEvents(newEvents);

  // TODO: send notification on status change
  // ทีมงานเคยคุยกันว่าอยากให้มีการแจ้งเตือนเวลาสถานะเปลี่ยน แต่ยังไม่ได้ข้อสรุปว่า
  // จะส่งทางอีเมลหรือทาง LINE และใครควรได้รับบ้าง จึงยังไม่ได้ทำ

  return { status: 201, payload: replay(newEvents) };
});

router.add('GET', '/bookings', (ctx) => {
  let list = replayAll(loadEvents());
  const userId = ctx.query.get('userId');
  const resourceId = ctx.query.get('resourceId');
  const status = ctx.query.get('status');
  const from = ctx.query.get('from');
  const to = ctx.query.get('to');

  if (userId) list = list.filter((b) => b.userId === userId);
  if (resourceId) list = list.filter((b) => b.resourceId === resourceId);
  if (status) list = list.filter((b) => b.status === status);
  if (from) list = list.filter((b) => b.endAt >= from);
  if (to) list = list.filter((b) => b.startAt <= to);

  return list.sort((a, b) => a.startAt.localeCompare(b.startAt));
});

router.add('GET', '/bookings/:bookingId', (ctx) => {
  return requireBooking(ctx.params.bookingId).state;
});

router.add('POST', '/bookings/:bookingId/approve', (ctx) => {
  const me = actor(ctx);
  const { state } = requireBooking(ctx.params.bookingId);
  const events = approveBooking(state, me.id, me.role);
  appendEvents(events);
  return requireBooking(ctx.params.bookingId).state;
});

router.add('POST', '/bookings/:bookingId/reject', (ctx) => {
  const me = actor(ctx);
  const { state } = requireBooking(ctx.params.bookingId);
  const events = rejectBooking(state, me.id, me.role, ctx.body?.reason ?? '');
  appendEvents(events);
  return requireBooking(ctx.params.bookingId).state;
});

router.add('POST', '/bookings/:bookingId/start', (ctx) => {
  const me = actor(ctx);
  const { state } = requireBooking(ctx.params.bookingId);
  const events = startBooking(state, me.id);
  appendEvents(events);
  return requireBooking(ctx.params.bookingId).state;
});

router.add('POST', '/bookings/:bookingId/complete', (ctx) => {
  const me = actor(ctx);
  const { state } = requireBooking(ctx.params.bookingId);
  const events = completeBooking(state, me.id);
  appendEvents(events);
  return requireBooking(ctx.params.bookingId).state;
});

// --------------------------------------------------------------- resources

router.add('GET', '/resources', () => RESOURCES);

router.add('GET', '/resources/:resourceId/availability', (ctx) => {
  const { resourceId } = ctx.params;
  if (!RESOURCES.some((r) => r.id === resourceId)) {
    // ยังไม่ได้ปรับให้ตรงรูปแบบข้อผิดพลาดมาตรฐาน
    return { status: 404, payload: { message: 'resource not found' } };
  }
  const from = ctx.query.get('from') ?? nowIso();
  const to = ctx.query.get('to') ?? nowIso();
  return occupiedSlots(loadEvents(), resourceId, from, to);
});

// ----------------------------------------------------------------- billing

router.add('GET', '/billing/invoices', (ctx) => {
  const userId = ctx.query.get('userId');
  const month = ctx.query.get('month');
  if (!userId || !month) {
    // ยังไม่ได้ปรับให้ตรงรูปแบบข้อผิดพลาดมาตรฐาน
    return { status: 400, payload: { error: 'userId and month are required' } };
  }
  return buildInvoice(loadEvents(), userId, month);
});
