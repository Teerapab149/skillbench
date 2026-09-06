/**
 * เฉลยถูกแต่เขียนคนละแบบ ของ S01-history-endpoint — inline-filter-and-sort
 *
 * ไม่ใช้ loadEventsFor และเรียงด้วยตัวเปรียบเทียบคนละแบบ
 *
 * ต้อง **ผ่าน** เทสยอมรับ ถ้าตกแปลว่าเทสผูกกับ implementation
 */
export const kind = 'alt';
export const patches = [
  {
    "file": "src/api/routes.ts",
    "find": "router.add('GET', '/bookings/:bookingId', (ctx) => {\n  return requireBooking(ctx.params.bookingId).state;\n});",
    "replace": "router.add('GET', '/bookings/:bookingId', (ctx) => {\n  return requireBooking(ctx.params.bookingId).state;\n});\n\nrouter.add('GET', '/bookings/:bookingId/history', (ctx) => {\n  const id = ctx.params.bookingId;\n  requireBooking(id);\n  const mine = loadEvents().filter((e) => e.bookingId === id);\n  mine.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());\n  return mine;\n});"
  }
];
