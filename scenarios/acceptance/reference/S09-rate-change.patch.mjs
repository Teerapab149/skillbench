/** เฉลยอ้างอิงของ S09 — เปลี่ยนอัตรา V100 เป็น 25 บาท/ชม. */
export const patches = [
  {
    file: 'src/domain/policy.ts',
    find: "{ id: 'gpu-v100-01', tier: 'V100', hourlyRate: 20 },",
    replace: "{ id: 'gpu-v100-01', tier: 'V100', hourlyRate: 25 },",
  },
  {
    file: 'src/domain/policy.ts',
    find: "{ id: 'gpu-v100-02', tier: 'V100', hourlyRate: 20 },",
    replace: "{ id: 'gpu-v100-02', tier: 'V100', hourlyRate: 25 },",
  },

  // ---- ด่านที่ 5 (4 ต.ค. 2569): งานนี้เปลี่ยนพฤติกรรมโดยตั้งใจ เทสเดิมที่ทดสอบพฤติกรรมเก่าต้องถูกปรับตามข้อกำหนดใหม่
  //      เอเจนต์แก้ tests/** ได้ (SC1) · เฉลยต้องพิสูจน์ว่างานนี้ทำให้เทสทั้งชุดผ่านได้ภายในขอบเขตของโจทย์
  {"file":"tests/billing.test.ts","find":"  test('REQ-34 V100 คิด 20 บาทต่อชั่วโมง', () => {","replace":"  test('V100 คิด 25 บาทต่อชั่วโมง', () => {"},
  {"file":"tests/billing.test.ts","find":"    assert.equal(buildInvoice(events, 'u-pat', '2026-05').totalBaht, 60);","replace":"    assert.equal(buildInvoice(events, 'u-pat', '2026-05').totalBaht, 75);"},
];
