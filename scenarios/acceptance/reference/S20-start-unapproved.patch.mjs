/** เฉลยอ้างอิงของ S20-start-unapproved — ปะทับสภาพเริ่มต้นของโจทย์ (scenarios/setup/S20-start-unapproved.json) · สร้างโดย scripts/study3/make-new-scenarios.mjs */
export const patches = [
  {
    "file": "src/domain/booking.ts",
    "find": "  if (!state.requiresApproval && !['REQUESTED', 'APPROVED'].includes(state.status)) {",
    "replace": "  if (state.requiresApproval && state.status !== 'APPROVED') {\n    throw new DomainError('APPROVAL_REQUIRED', 'การจองนี้ต้องได้รับอนุมัติก่อนเริ่มใช้งาน', 409);\n  }\n  if (!state.requiresApproval && !['REQUESTED', 'APPROVED'].includes(state.status)) {"
  }
];
