/**
 * เฉลยผิด ของ S12-approval-timeout — ignores-start-time
 *
 * ปฏิเสธทุกคำขอที่รออนุมัติ ไม่ดูว่าถึงเวลาเริ่มหรือยัง
 *
 * ต้อง **ตก** เทสยอมรับ · สร้างโดย scripts/study3/make-new-scenarios.mjs
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/api/routes.ts",
    "find": "router.add('POST', '/jobs/expire-approvals', () => {\n  return { expired: 0 };\n});",
    "replace": "router.add('POST', '/jobs/expire-approvals', () => {\n  const due = replayAll(loadEvents()).filter((b) => b.status === 'REQUESTED' && b.requiresApproval);\n  appendEvents(due.map((b) => ({ type: 'BookingRejected', bookingId: b.id, occurredAt: nowIso(), actorId: 'system', reason: 'approval timeout' }) as any));\n  return { expired: due.length };\n});"
  }
];
