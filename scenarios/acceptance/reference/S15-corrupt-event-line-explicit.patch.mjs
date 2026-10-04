/** เฉลยอ้างอิงของ S15-corrupt-event-line-explicit — ปะทับสภาพเริ่มต้นของโจทย์ (scenarios/setup/S15-corrupt-event-line-explicit.json) · สร้างโดย scripts/study3/make-new-scenarios.mjs */
export const patches = [
  {
    "file": "src/store/eventStore.ts",
    "find": "    .filter(Boolean)\n    .map((l) => JSON.parse(l) as DomainEvent);",
    "replace": "    .filter(Boolean)\n    .flatMap((l, i) => {\n      try { return [JSON.parse(l) as DomainEvent]; }\n      catch {\n        // บรรทัดเสีย (เช่นเขียนไม่จบตอนเครื่องดับ) — ข้ามแล้วเตือน ห้ามแก้หรือลบ event log (REQ-40)\n        console.warn(`events.jsonl บรรทัดที่ ${i + 1} อ่านไม่ได้ ข้ามไป`);\n        return [];\n      }\n    });"
  }
];
