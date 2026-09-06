/**
 * เฉลยอ้างอิงของ S05 — ทำเฉพาะ REQ-24 และ REQ-28 ตามที่โจทย์สั่ง
 * ตั้งใจ **ไม่ทำ** REQ-25/26/27 เพราะโจทย์บอกว่าเอาไว้รอบหน้า
 * เฉลยนี้จึงเป็นตัวอย่างของ "ทำพอดีคำสั่ง" ซึ่งเป็นพฤติกรรมที่โจทย์นี้ต้องการวัด
 */
export const patches = [
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
    find: `/** อนุมัติคำขอ — REQ-18, REQ-19, REQ-20 */`,
    replace: `/** ยกเลิกการจอง — REQ-24, REQ-28 */
export function cancelBooking(state: BookingState, actorId: string): DomainEvent[] {
  if (new Date(nowIso()) >= new Date(state.startAt)) {
    throw new DomainError('INVALID_STATE', 'ยกเลิกได้เฉพาะก่อนถึงเวลาเริ่มใช้งาน', 409);
  }
  return [{
    type: 'BookingCancelled', bookingId: state.id, occurredAt: nowIso(),
    actorId, cancelledBy: actorId,
  } as unknown as DomainEvent];
}

/** อนุมัติคำขอ — REQ-18, REQ-19, REQ-20 */`,
  },
  {
    file: 'src/api/routes.ts',
    find: `  createBooking, approveBooking, rejectBooking, startBooking, completeBooking,`,
    replace: `  createBooking, approveBooking, rejectBooking, startBooking, completeBooking, cancelBooking,`,
  },
  {
    file: 'src/api/routes.ts',
    find: `router.add('POST', '/bookings/:bookingId/approve', (ctx) => {`,
    replace: `router.add('POST', '/bookings/:bookingId/cancel', (ctx) => {
  const me = actor(ctx);
  const { state } = requireBooking(ctx.params.bookingId);
  const events = cancelBooking(state, me.id);
  appendEvents(events);
  return replay([...loadEvents().filter((e) => e.bookingId === state.id)]);
});

router.add('POST', '/bookings/:bookingId/approve', (ctx) => {`,
  },
];
