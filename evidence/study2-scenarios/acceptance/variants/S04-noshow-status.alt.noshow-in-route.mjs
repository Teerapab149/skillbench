/**
 * เฉลยถูกแต่เขียนคนละแบบ ของ S04-noshow-status — noshow-in-route
 *
 * อนุมานสถานะไม่มาใช้งานที่ชั้น route ตอนอ่านรายละเอียด แทนที่จะทำใน replay
 *
 * ต้อง **ผ่าน** เทสยอมรับ ถ้าตกแปลว่าเทสผูกกับ implementation
 */
export const kind = 'alt';
export const patches = [
  {
    "file": "src/api/routes.ts",
    "find": "import { nowIso } from '../lib/clock.ts';",
    "replace": "import { nowIso } from '../lib/clock.ts';\nimport { NO_SHOW_GRACE_MINUTES } from '../domain/policy.ts';"
  },
  {
    "file": "src/api/routes.ts",
    "find": "router.add('GET', '/bookings/:bookingId', (ctx) => {\n  return requireBooking(ctx.params.bookingId).state;\n});",
    "replace": "router.add('GET', '/bookings/:bookingId', (ctx) => {\n  const s = requireBooking(ctx.params.bookingId).state;\n  if (!s.actualStartAt && (s.status === 'REQUESTED' || s.status === 'APPROVED')) {\n    const deadline = new Date(new Date(s.startAt).getTime() + NO_SHOW_GRACE_MINUTES * 60000);\n    if (new Date(nowIso()) > deadline) return { ...s, status: 'NO_SHOW' };\n  }\n  return s;\n});"
  }
];
