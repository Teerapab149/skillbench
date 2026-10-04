/** เฉลยอ้างอิงของ S17-duration-refactor-billing — ปะทับสภาพเริ่มต้นของโจทย์ (scenarios/setup/S17-duration-refactor-billing.json) · สร้างโดย scripts/study3/make-new-scenarios.mjs */
export const patches = [
  {
    "file": "src/lib/duration.ts",
    "find": "export function billableMinutes(startIso: string, endIso: string): number {\n  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();\n  const raw = ms / 60000;\n  if (raw <= 0) return 0;\n  return Math.ceil(raw / BILLING_INCREMENT_MINUTES) * BILLING_INCREMENT_MINUTES;\n}",
    "replace": "export function billableMinutes(startIso: string, endIso: string): number {\n  const raw = rawMinutesBetween(startIso, endIso);\n  if (raw <= 0) return 0;\n  return Math.ceil(raw / BILLING_INCREMENT_MINUTES) * BILLING_INCREMENT_MINUTES;\n}"
  },
  {
    "file": "src/lib/duration.ts",
    "find": "export function bookedMinutes(startAt: string, endAt: string): number {\n  const ms = new Date(endAt).getTime() - new Date(startAt).getTime();\n  return ms / 60000;\n}",
    "replace": "export function bookedMinutes(startAt: string, endAt: string): number {\n  return rawMinutesBetween(startAt, endAt);\n}"
  }
];
