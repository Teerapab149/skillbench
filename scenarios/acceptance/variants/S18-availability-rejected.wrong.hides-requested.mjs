/**
 * เฉลยผิด ของ S18-availability-rejected — hides-requested
 *
 * แก้เกิน — ตัด REQUESTED ออกไปด้วย
 *
 * ต้อง **ตก** เทสยอมรับ · สร้างโดย scripts/study3/make-new-scenarios.mjs
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/projections/availability.ts",
    "find": "const OCCUPYING = ['REQUESTED', 'APPROVED', 'ACTIVE', 'REJECTED'];",
    "replace": "const OCCUPYING = ['APPROVED', 'ACTIVE'];"
  }
];
