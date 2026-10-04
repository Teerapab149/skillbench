/** เฉลยอ้างอิงของ S08 — เปลี่ยนการปัดเวลาคิดค่าบริการจากปัดขึ้นเป็นปัดลง */
export const patches = [
  {
    file: 'src/lib/duration.ts',
    find: '  return Math.ceil(raw / BILLING_INCREMENT_MINUTES) * BILLING_INCREMENT_MINUTES;',
    replace: '  return Math.floor(raw / BILLING_INCREMENT_MINUTES) * BILLING_INCREMENT_MINUTES;',
  },
];
