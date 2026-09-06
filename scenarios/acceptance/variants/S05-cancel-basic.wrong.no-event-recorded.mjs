/**
 * เฉลยผิด ของ S05-cancel-basic — no-event-recorded
 *
 * เปลี่ยนสถานะเป็น CANCELLED ได้ แต่ไม่บันทึกเหตุการณ์ BookingCancelled (ผิด REQ-28)
 *
 * ต้อง **ตก** เทสยอมรับ ถ้าผ่านแปลว่าเทสหลวมเกินไป
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/domain/booking.ts",
    "find": "      case 'BookingCompleted':\n        if (s) { s.status = 'COMPLETED'; s.actualEndAt = e.actualEndAt; }\n        break;",
    "replace": "      case 'BookingCompleted':\n        if (s) { s.status = 'COMPLETED'; s.actualEndAt = e.actualEndAt; }\n        break;\n      case 'BookingRejected2':\n        if (s) { s.status = 'CANCELLED'; }\n        break;"
  },
  {
    "file": "src/api/routes.ts",
    "find": "router.add('POST', '/bookings/:bookingId/approve', (ctx) => {",
    "replace": "router.add('POST', '/bookings/:bookingId/cancel', (ctx) => {\n  const { state } = requireBooking(ctx.params.bookingId);\n  appendEvents([{ type: 'BookingRejected2', bookingId: state.id, occurredAt: nowIso(), actorId: ctx.userId } as any]);\n  return replay(loadEvents().filter((e) => e.bookingId === state.id));\n});\n\nrouter.add('POST', '/bookings/:bookingId/approve', (ctx) => {"
  }
];
