/** เฉลยอ้างอิงของ S22-reject-reason-only — ปะทับสภาพเริ่มต้นของโจทย์ (scenarios/setup/S22-reject-reason-only.json) · สร้างโดย scripts/study3/make-new-scenarios.mjs */
export const patches = [
  {
    "file": "src/domain/booking.ts",
    "find": "    throw new DomainError('FORBIDDEN', 'ผู้ปฏิเสธต้องมีบทบาท LAB_ADMIN', 403);\n  }\n",
    "replace": "    throw new DomainError('FORBIDDEN', 'ผู้ปฏิเสธต้องมีบทบาท LAB_ADMIN', 403);\n  }\n  if (!reason || !reason.trim()) {\n    throw new DomainError('MISSING_REASON', 'การปฏิเสธต้องระบุเหตุผล', 400);\n  }\n"
  }
];
