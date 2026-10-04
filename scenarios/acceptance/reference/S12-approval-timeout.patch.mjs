/** เฉลยอ้างอิงของ S12-approval-timeout — ปะทับสภาพเริ่มต้นของโจทย์ (scenarios/setup/S12-approval-timeout.json) · สร้างโดย scripts/study3/make-new-scenarios.mjs */
export const patches = [
  {
    "file": "src/domain/booking.ts",
    "find": "/** เริ่มใช้งานจริง —",
    "replace": "/**\n * ปฏิเสธคำขอที่ยังไม่ได้รับอนุมัติเมื่อถึงเวลาเริ่มใช้งาน — REQ-22\n * ผู้กระทำของการปฏิเสธอัตโนมัติคือ \"system\" (ข้อสมมติ — ข้อกำหนดไม่ได้ระบุ)\n */\nexport function expireApprovals(states: BookingState[], nowAt: string): DomainEvent[] {\n  const now = new Date(nowAt);\n  return states\n    .filter((s) => s.status === 'REQUESTED' && s.requiresApproval && new Date(s.startAt) <= now)\n    .map((s) => ({ type: 'BookingRejected', bookingId: s.id, occurredAt: nowAt, actorId: 'system', reason: 'approval timeout' }) as DomainEvent);\n}\n\n/** เริ่มใช้งานจริง —"
  },
  {
    "file": "src/api/routes.ts",
    "find": "  createBooking, approveBooking, rejectBooking, startBooking, completeBooking,",
    "replace": "  createBooking, approveBooking, rejectBooking, startBooking, completeBooking, expireApprovals,"
  },
  {
    "file": "src/api/routes.ts",
    "find": "router.add('POST', '/jobs/expire-approvals', () => {\n  return { expired: 0 };\n});",
    "replace": "router.add('POST', '/jobs/expire-approvals', () => {\n  const events = expireApprovals(replayAll(loadEvents()), nowIso());\n  appendEvents(events);\n  return { expired: events.length };\n});"
  }
];
