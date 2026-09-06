/**
 * เฉลยถูกแต่เขียนคนละแบบ ของ S02-increment-validation — validate-in-route
 *
 * ตรวจที่ชั้น route แทนชั้นโดเมน — ถ้าเทสตกแปลว่ามันวัดตำแหน่งของโค้ด ไม่ใช่พฤติกรรม
 *
 * ต้อง **ผ่าน** เทสยอมรับ ถ้าตกแปลว่าเทสผูกกับ implementation
 */
export const kind = 'alt';
export const patches = [
  {
    "file": "src/api/routes.ts",
    "find": "  const me = actor(ctx);\n  const body = ctx.body ?? {};\n  const events = loadEvents();",
    "replace": "  const me = actor(ctx);\n  const body = ctx.body ?? {};\n  if (body.startAt && body.endAt) {\n    const mins = (new Date(body.endAt).getTime() - new Date(body.startAt).getTime()) / 60000;\n    if (mins > 0 && mins % 15 !== 0) {\n      return { status: 400, payload: { error: { code: 'INVALID_INCREMENT', message: 'ระยะเวลาต้องเป็นจำนวนเท่าของ 15 นาที' } } };\n    }\n  }\n  const events = loadEvents();"
  }
];
