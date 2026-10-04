/**
 * เฉลยผิด ของ S21-start-unapproved-explicit — blocks-all-requested
 *
 * ห้ามเริ่มทุกการจองที่ยังเป็น REQUESTED — ผิด REQ-23
 *
 * ต้อง **ตก** เทสยอมรับ · สร้างโดย scripts/study3/make-new-scenarios.mjs
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/domain/booking.ts",
    "find": "  if (!state.requiresApproval && !['REQUESTED', 'APPROVED'].includes(state.status)) {",
    "replace": "  if (state.status !== 'APPROVED') {\n    throw new DomainError('APPROVAL_REQUIRED', 'ต้องได้รับอนุมัติก่อน', 409);\n  }\n  if (!state.requiresApproval && !['REQUESTED', 'APPROVED'].includes(state.status)) {"
  }
];
