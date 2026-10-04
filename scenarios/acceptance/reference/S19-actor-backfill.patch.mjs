/** เฉลยอ้างอิงของ S19-actor-backfill — ปะทับสภาพเริ่มต้นของโจทย์ (scenarios/setup/S19-actor-backfill.json) · สร้างโดย scripts/study3/make-new-scenarios.mjs */
export const patches = [
  {
    "file": "src/domain/booking.ts",
    "find": "  return [{ type: 'BookingCompleted', bookingId: state.id, occurredAt: nowIso(), actualEndAt }];",
    "replace": "  return [{ type: 'BookingCompleted', bookingId: state.id, occurredAt: nowIso(), actorId, actualEndAt }];"
  }
];
