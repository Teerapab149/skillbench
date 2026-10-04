/**
 * เฉลยผิด ของ S02-increment-validation — ten-minute-increment
 *
 * ตรวจเป็นจำนวนเท่าของ 10 นาทีแทน 15
 *
 * ต้อง **ตก** เทสยอมรับ ถ้าผ่านแปลว่าเทสหลวมเกินไป
 */
export const kind = 'wrong';
export const patches = [
  {
    "file": "src/domain/booking.ts",
    "find": "  const clash = existing.find(",
    "replace": "  const mins = (new Date(cmd.endAt).getTime() - new Date(cmd.startAt).getTime()) / 60000;\n  if (mins % 10 !== 0) throw new DomainError('INVALID_INCREMENT', 'ต้องเป็นจำนวนเท่าของ 10 นาที', 400);\n\n  const clash = existing.find("
  }
];
