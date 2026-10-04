/** เฉลยอ้างอิงของ S03 — ทำให้ข้อผิดพลาดทุกที่อยู่ในรูป { error: { code, message } } ตาม REQ-52 */
export const patches = [
  {
    file: 'src/api/routes.ts',
    find: "    return { status: 404, payload: { message: 'resource not found' } };",
    replace: "    return { status: 404, payload: { error: { code: 'RESOURCE_NOT_FOUND', message: 'ไม่พบเครื่องที่ระบุ' } } };",
  },
  {
    file: 'src/api/routes.ts',
    find: "    return { status: 400, payload: { error: 'userId and month are required' } };",
    replace: "    return { status: 400, payload: { error: { code: 'MISSING_FIELD', message: 'ต้องระบุ userId และ month' } } };",
  },
];
