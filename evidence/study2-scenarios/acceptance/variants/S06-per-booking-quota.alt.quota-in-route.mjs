/**
 * เฉลยถูกแต่เขียนคนละแบบ ของ S06-per-booking-quota — quota-in-route
 *
 * บังคับเพดานที่ชั้น route แทนชั้นโดเมน
 *
 * ต้อง **ผ่าน** เทสยอมรับ ถ้าตกแปลว่าเทสผูกกับ implementation
 */
export const kind = 'alt';
export const patches = [
  {
    "file": "src/api/routes.ts",
    "find": "import { RESOURCES } from '../domain/policy.ts';",
    "replace": "import { RESOURCES, MAX_HOURS_PER_BOOKING } from '../domain/policy.ts';"
  },
  {
    "file": "src/api/routes.ts",
    "find": "  const me = actor(ctx);\n  const body = ctx.body ?? {};\n  const events = loadEvents();",
    "replace": "  const me = actor(ctx);\n  const body = ctx.body ?? {};\n  const cap = (MAX_HOURS_PER_BOOKING as Record<string, number>)[me.role];\n  if (cap !== undefined && body.startAt && body.endAt) {\n    const hrs = (new Date(body.endAt).getTime() - new Date(body.startAt).getTime()) / 3600000;\n    if (hrs > cap) {\n      return { status: 422, payload: { error: { code: 'QUOTA_EXCEEDED', message: `เกินเพดาน ${cap} ชั่วโมง` } } };\n    }\n  }\n  const events = loadEvents();"
  }
];
