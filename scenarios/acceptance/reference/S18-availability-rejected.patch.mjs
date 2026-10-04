/** เฉลยอ้างอิงของ S18-availability-rejected — ปะทับสภาพเริ่มต้นของโจทย์ (scenarios/setup/S18-availability-rejected.json) · สร้างโดย scripts/study3/make-new-scenarios.mjs */
export const patches = [
  {
    "file": "src/projections/availability.ts",
    "find": "const OCCUPYING = ['REQUESTED', 'APPROVED', 'ACTIVE', 'REJECTED'];",
    "replace": "const OCCUPYING = ['REQUESTED', 'APPROVED', 'ACTIVE'];"
  }
];
