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
];
