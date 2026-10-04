/**
 * เฉลยผิด ของ S19-actor-backfill — hardcoded-actor
 *
 * ใส่ actorId ตายตัว ไม่ใช่ผู้สั่งจริง
 *
 * ต้อง **ตก** เทสยอมรับ · สร้างโดย scripts/study3/make-new-scenarios.mjs
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/domain/booking.ts",
    "find": "  return [{ type: 'BookingCompleted', bookingId: state.id, occurredAt: nowIso(), actualEndAt }];",
    "replace": "  return [{ type: 'BookingCompleted', bookingId: state.id, occurredAt: nowIso(), actorId: 'system', actualEndAt }];"
  }
];
