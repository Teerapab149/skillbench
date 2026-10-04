/**
 * เฉลยอ้างอิงของ S11 — แก้การนับสัปดาห์ของโควตาที่มีอยู่แล้ว ให้เริ่มวันจันทร์ 00:00 (REQ-15)
 *
 * ปะทับสภาพเริ่มต้นของโจทย์ (scenarios/setup/S11-week-boundary.json) ซึ่งนับย้อนหลัง 7 วัน
 */
export const patches = [
  {
    file: 'src/domain/booking.ts',
    find: `export interface CreateBookingCommand {`,
    replace: `/**
 * ต้นสัปดาห์ของเวลาที่ระบุ — สัปดาห์เริ่มวันจันทร์ 00:00 (REQ-15)
 *
 * getUTCDay() ให้อาทิตย์ = 0 จึงต้องหมุนให้จันทร์ = 0 ก่อน
 */
function weekStartUtc(iso: string): number {
  const d = new Date(iso);
  const dow = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow);
}

export interface CreateBookingCommand {`,
  },
  {
    file: 'src/domain/booking.ts',
    find: "    const from = new Date(cmd.startAt).getTime() - 7 * 86400000;\n    const to = new Date(cmd.startAt).getTime();\n    const used = existing\n      .filter((b) => b.userId === cmd.userId && b.status !== 'CANCELLED' && b.status !== 'REJECTED')\n      .filter((b) => { const t = new Date(b.startAt).getTime(); return t >= from && t <= to; })",
    replace: `    const wk = weekStartUtc(cmd.startAt);
    const used = existing
      .filter((b) => b.userId === cmd.userId && b.status !== 'CANCELLED' && b.status !== 'REJECTED')
      .filter((b) => weekStartUtc(b.startAt) === wk)`,
  },
];
