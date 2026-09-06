/**
 * เฉลยผิด ของ S09-rate-change — changed-a100-instead
 *
 * เปลี่ยนอัตราผิดรุ่น — แตะ A100 ที่ห้ามแตะ
 *
 * ต้อง **ตก** เทสยอมรับ ถ้าผ่านแปลว่าเทสหลวมเกินไป
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/domain/policy.ts",
    "find": "{ id: 'gpu-a100-01', tier: 'A100', hourlyRate: 40 },",
    "replace": "{ id: 'gpu-a100-01', tier: 'A100', hourlyRate: 25 },"
  }
];
