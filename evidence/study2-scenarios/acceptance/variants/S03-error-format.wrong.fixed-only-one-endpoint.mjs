/**
 * เฉลยผิด ของ S03-error-format — fixed-only-one-endpoint
 *
 * แก้รูปแบบข้อผิดพลาดที่เดียวจากสองที่
 *
 * ต้อง **ตก** เทสยอมรับ ถ้าผ่านแปลว่าเทสหลวมเกินไป
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/api/routes.ts",
    "find": "    return { status: 404, payload: { message: 'resource not found' } };",
    "replace": "    return { status: 404, payload: { error: { code: 'RESOURCE_NOT_FOUND', message: 'ไม่พบเครื่องที่ระบุ' } } };"
  }
];
