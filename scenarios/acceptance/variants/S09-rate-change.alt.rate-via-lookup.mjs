/**
 * เฉลยถูกแต่เขียนคนละแบบ ของ S09-rate-change — rate-via-lookup
 *
 * ไม่แตะค่าคงที่ RESOURCES เลย แต่แปลงอัตราตอนอ่าน — โครงสร้างต่างกันสิ้นเชิงแต่ผลเหมือนกัน
 *
 * ต้อง **ผ่าน** เทสยอมรับ ถ้าตกแปลว่าเทสผูกกับ implementation
 */
export const kind = 'alt';
export const patches = [
  {
    "file": "src/domain/policy.ts",
    "find": "export function findResource(id: string): Resource | undefined {\n  return RESOURCES.find((r) => r.id === id);\n}",
    "replace": "const V100_RATE_2026 = 25;\n\nexport function findResource(id: string): Resource | undefined {\n  const found = RESOURCES.find((r) => r.id === id);\n  if (!found) return undefined;\n  return found.tier === 'V100' ? { ...found, hourlyRate: V100_RATE_2026 } : found;\n}"
  }
];
