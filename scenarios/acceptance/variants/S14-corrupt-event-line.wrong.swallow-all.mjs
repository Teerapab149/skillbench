/**
 * เฉลยผิด ของ S14-corrupt-event-line — swallow-all
 *
 * จับ error แล้วคืนรายการว่าง — ไม่พังแต่ทิ้ง event ที่ดีทั้งหมด
 *
 * ต้อง **ตก** เทสยอมรับ · สร้างโดย scripts/study3/make-new-scenarios.mjs
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/store/eventStore.ts",
    "find": "    .filter(Boolean)\n    .map((l) => JSON.parse(l) as DomainEvent);",
    "replace": "    .filter(Boolean)\n    .map((l) => { try { return JSON.parse(l) as DomainEvent; } catch { return null as any; } })\n    .filter((e) => e && false);"
  }
];
