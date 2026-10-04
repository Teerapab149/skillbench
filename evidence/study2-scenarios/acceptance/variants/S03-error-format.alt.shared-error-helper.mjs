/**
 * เฉลยถูกแต่เขียนคนละแบบ ของ S03-error-format — shared-error-helper
 *
 * ใช้ฟังก์ชันช่วยสร้าง error ร่วมกันแทนการเขียน object ตรง ๆ ทีละที่
 *
 * ต้อง **ผ่าน** เทสยอมรับ ถ้าตกแปลว่าเทสผูกกับ implementation
 */
export const kind = 'alt';
export const patches = [
  {
    "file": "src/api/routes.ts",
    "find": "export const router = new Router();",
    "replace": "export const router = new Router();\n\nfunction errorPayload(code: string, message: string) {\n  return { error: { code, message } };\n}"
  },
  {
    "file": "src/api/routes.ts",
    "find": "    return { status: 404, payload: { message: 'resource not found' } };",
    "replace": "    return { status: 404, payload: errorPayload('RESOURCE_NOT_FOUND', 'ไม่พบเครื่องที่ระบุ') };"
  },
  {
    "file": "src/api/routes.ts",
    "find": "    return { status: 400, payload: { error: 'userId and month are required' } };",
    "replace": "    return { status: 400, payload: errorPayload('MISSING_FIELD', 'ต้องระบุ userId และ month') };"
  }
];
