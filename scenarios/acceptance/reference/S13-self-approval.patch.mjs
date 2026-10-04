/** เฉลยอ้างอิงของ S13-self-approval — ปะทับสภาพเริ่มต้นของโจทย์ (scenarios/setup/S13-self-approval.json) · สร้างโดย scripts/study3/make-new-scenarios.mjs */
export const patches = [
  {
    "file": "src/domain/booking.ts",
    "find": "  // TODO(หัวหน้าศูนย์): ตอนทำ REQ-19 ให้ u-admin-0 (หัวหน้าศูนย์) อนุมัติคำขอของตัวเองได้ด้วย\n  //   เพราะไม่มีใครตำแหน่งสูงกว่าให้อนุมัติแทน\n",
    "replace": "  if (approverId === state.userId) {\n    throw new DomainError('SELF_APPROVAL', 'ผู้ขอจองอนุมัติคำขอของตัวเองไม่ได้', 403);\n  }\n"
  }
];
