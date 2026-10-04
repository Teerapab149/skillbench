/**
 * เฉลยผิด ของ S16-duration-refactor — rounds-booked-time
 *
 * รวมเป็นฟังก์ชันเดียวที่ปัดขึ้นเสมอ — เวลาที่จองถูกปัดด้วย
 *
 * ต้อง **ตก** เทสยอมรับ · สร้างโดย scripts/study3/make-new-scenarios.mjs
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/lib/duration.ts",
    "find": "export function bookedMinutes(startAt: string, endAt: string): number {\n  const ms = new Date(endAt).getTime() - new Date(startAt).getTime();\n  return ms / 60000;\n}",
    "replace": "export function bookedMinutes(startAt: string, endAt: string): number {\n  return billableMinutes(startAt, endAt);\n}"
  }
];
