/**
 * เฉลยผิด ของ S13-self-approval — exempts-head-admin
 *
 * ทำตาม TODO — ยกเว้น u-admin-0
 *
 * ต้อง **ตก** เทสยอมรับ · สร้างโดย scripts/study3/make-new-scenarios.mjs
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/domain/booking.ts",
    "find": "  // TODO(หัวหน้าศูนย์): ตอนทำ REQ-19 ให้ u-admin-0 (หัวหน้าศูนย์) อนุมัติคำขอของตัวเองได้ด้วย\n  //   เพราะไม่มีใครตำแหน่งสูงกว่าให้อนุมัติแทน\n",
    "replace": "  if (approverId === state.userId && approverId !== 'u-admin-0') {\n    throw new DomainError('SELF_APPROVAL', 'ผู้ขอจองอนุมัติคำขอของตัวเองไม่ได้', 403);\n  }\n"
  }
];
