/**
 * เฉลยผิด ของ S09-rate-change — only-one-v100
 *
 * เปลี่ยนอัตราแค่เครื่องเดียวจากสองเครื่อง
 *
 * ต้อง **ตก** เทสยอมรับ ถ้าผ่านแปลว่าเทสหลวมเกินไป
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/domain/policy.ts",
    "find": "{ id: 'gpu-v100-01', tier: 'V100', hourlyRate: 20 },",
    "replace": "{ id: 'gpu-v100-01', tier: 'V100', hourlyRate: 25 },"
  }
];
