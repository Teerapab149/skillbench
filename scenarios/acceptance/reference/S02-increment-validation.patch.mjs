/** เฉลยอ้างอิงของ S02 — บังคับ REQ-04 ระยะเวลาต้องเป็นจำนวนเท่าของ 15 นาที */
export const patches = [
  {
    file: 'src/domain/booking.ts',
    find: "import { bookedHours } from '../lib/duration.ts';",
    replace: "import { bookedHours, bookedMinutes, BILLING_INCREMENT_MINUTES } from '../lib/duration.ts';",
  },
  {
    file: 'src/domain/booking.ts',
    find: `  if (new Date(cmd.endAt) <= new Date(cmd.startAt)) {
    throw new DomainError('INVALID_RANGE', 'endAt ต้องอยู่หลัง startAt', 400);
  }`,
    replace: `  if (new Date(cmd.endAt) <= new Date(cmd.startAt)) {
    throw new DomainError('INVALID_RANGE', 'endAt ต้องอยู่หลัง startAt', 400);
  }
  if (bookedMinutes(cmd.startAt, cmd.endAt) % BILLING_INCREMENT_MINUTES !== 0) {
    throw new DomainError('INVALID_INCREMENT', 'ระยะเวลาการจองต้องเป็นจำนวนเท่าของ 15 นาที (REQ-04)', 400);
  }`,
  },
];
