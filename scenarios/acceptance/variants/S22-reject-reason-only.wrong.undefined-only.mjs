/**
 * เฉลยผิด ของ S22-reject-reason-only — undefined-only
 *
 * ตรวจแค่ undefined — route ส่งสตริงว่างมาเมื่อไม่มี reason จึงหลุด
 *
 * ต้อง **ตก** เทสยอมรับ · สร้างโดย scripts/study3/make-new-scenarios.mjs
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/domain/booking.ts",
    "find": "    throw new DomainError('FORBIDDEN', 'ผู้ปฏิเสธต้องมีบทบาท LAB_ADMIN', 403);\n  }\n",
    "replace": "    throw new DomainError('FORBIDDEN', 'ผู้ปฏิเสธต้องมีบทบาท LAB_ADMIN', 403);\n  }\n  if (reason === undefined) {\n    throw new DomainError('MISSING_REASON', 'การปฏิเสธต้องระบุเหตุผล', 400);\n  }\n"
  }
];
