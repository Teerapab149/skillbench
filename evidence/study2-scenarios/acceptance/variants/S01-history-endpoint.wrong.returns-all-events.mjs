/**
 * เฉลยผิด ของ S01-history-endpoint — returns-all-events
 *
 * คืนเหตุการณ์ทั้งหมดโดยไม่กรองตามรายการจอง
 *
 * ต้อง **ตก** เทสยอมรับ ถ้าผ่านแปลว่าเทสหลวมเกินไป
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/api/routes.ts",
    "find": "router.add('GET', '/bookings/:bookingId', (ctx) => {\n  return requireBooking(ctx.params.bookingId).state;\n});",
    "replace": "router.add('GET', '/bookings/:bookingId', (ctx) => {\n  return requireBooking(ctx.params.bookingId).state;\n});\n\nrouter.add('GET', '/bookings/:bookingId/history', (ctx) => {\n  requireBooking(ctx.params.bookingId);\n  return loadEvents();\n});"
  }
];
