/** เฉลยอ้างอิงของ S08 — เปลี่ยนการปัดเวลาคิดค่าบริการจากปัดขึ้นเป็นปัดลง */
export const patches = [
  {
    file: 'src/lib/duration.ts',
    find: '  return Math.ceil(raw / BILLING_INCREMENT_MINUTES) * BILLING_INCREMENT_MINUTES;',
    replace: '  return Math.floor(raw / BILLING_INCREMENT_MINUTES) * BILLING_INCREMENT_MINUTES;',
  },

  // ---- ด่านที่ 5 (4 ต.ค. 2569): งานนี้เปลี่ยนพฤติกรรมโดยตั้งใจ เทสเดิมที่ทดสอบพฤติกรรมเก่าต้องถูกปรับตามข้อกำหนดใหม่
  //      เอเจนต์แก้ tests/** ได้ (SC1) · เฉลยต้องพิสูจน์ว่างานนี้ทำให้เทสทั้งชุดผ่านได้ภายในขอบเขตของโจทย์
  {"file":"tests/billing.test.ts","find":"  test('REQ-35 ปัดขึ้นเป็นจำนวนเท่าของ 15 นาที', () => {\n    // ใช้จริง 2 ชม. 3 นาที -> 2 ชม. 15 นาที\n    assert.equal(billableMinutes('2026-05-01T09:00:00.000Z', '2026-05-01T11:03:00.000Z'), 135);","replace":"  test('ปัดลงเป็นจำนวนเท่าของ 15 นาที', () => {\n    // ใช้จริง 2 ชม. 3 นาที -> 2 ชม.\n    assert.equal(billableMinutes('2026-05-01T09:00:00.000Z', '2026-05-01T11:03:00.000Z'), 120);"},
  {"file":"tests/billing.test.ts","find":"  test('ใช้จริง 1 นาที ยังคิดขั้นต่ำ 15 นาที', () => {\n    assert.equal(billableMinutes('2026-05-01T09:00:00.000Z', '2026-05-01T09:01:00.000Z'), 15);","replace":"  test('ใช้จริง 1 นาที ปัดลงเป็น 0', () => {\n    assert.equal(billableMinutes('2026-05-01T09:00:00.000Z', '2026-05-01T09:01:00.000Z'), 0);"},
  {"file":"tests/billing.test.ts","find":"    assert.equal(inv.lines[0].billableMinutes, 135);\n    assert.equal(inv.totalBaht, 90);   // 135/60 * 40","replace":"    assert.equal(inv.lines[0].billableMinutes, 120);\n    assert.equal(inv.totalBaht, 80);   // 120/60 * 40"},
];
