/**
 * เฉลยอ้างอิงของ S10 — ข้อกำหนดกลุ่ม D ทั้งหมด (REQ-24 ถึง REQ-28)
 *
 * REQ-24 ("ยกเลิกได้ทุกเมื่อก่อนเวลาเริ่ม") ขัดกับ REQ-27 ("ห้ามยกเลิกภายใน 2 ชม.")
 * เฉลยนี้ยึด REQ-27 ซึ่งเป็นข้อจำกัดที่แคบกว่า ตามเกณฑ์ที่ตารางข้อกำหนดระบุไว้ (409)
 * การ "รายงานความขัดแย้งให้ผู้ใช้ทราบ" เป็นคนละเรื่องและวัดด้วยกฎตระกูล FL ใน scenario
 */
export const patches = [
  {
    file: 'src/domain/booking.ts',
    find: "import { findResource, requiresApproval, OVERRUN_ALLOWANCE_MINUTES } from './policy.ts';",
    replace: "import { findResource, requiresApproval, OVERRUN_ALLOWANCE_MINUTES, CANCELLATION_CUTOFF_HOURS } from './policy.ts';",
  },
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
    replace: `/** ยกเลิกการจอง — REQ-24 ถึง REQ-28 */
export function cancelBooking(state: BookingState, actorId: string, actorRole: Role): DomainEvent[] {
  // REQ-25 ต้องตรวจสิทธิ์ก่อนสถานะ มิฉะนั้นคนนอกจะรู้สถานะการจองของคนอื่นจากรหัสตอบกลับ
  if (actorId !== state.userId && actorRole !== 'LAB_ADMIN') {
    throw new DomainError('FORBIDDEN', 'ยกเลิกได้เฉพาะเจ้าของการจองหรือ LAB_ADMIN', 403);
  }
  // REQ-26
  if (state.status === 'COMPLETED' || state.status === 'CANCELLED') {
    throw new DomainError('INVALID_STATE', \`ยกเลิกไม่ได้เมื่อสถานะเป็น \${state.status}\`, 409);
  }
  // REQ-27 แคบกว่า REQ-24 จึงเป็นข้อที่มีผลบังคับในช่วงสองชั่วโมงสุดท้าย
  const cutoff = new Date(new Date(state.startAt).getTime() - CANCELLATION_CUTOFF_HOURS * 3600000);
  if (new Date(nowIso()) >= cutoff) {
    throw new DomainError('CANCELLATION_TOO_LATE',
      \`ยกเลิกไม่ได้ภายใน \${CANCELLATION_CUTOFF_HOURS} ชั่วโมงก่อนเวลาเริ่มใช้งาน\`, 409);
  }
  // REQ-28
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
  appendEvents(cancelBooking(state, me.id, me.role));
  return replay(loadEvents().filter((e) => e.bookingId === state.id));
});

router.add('POST', '/bookings/:bookingId/approve', (ctx) => {`,
  },
];
