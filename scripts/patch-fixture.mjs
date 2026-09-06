/**
 * ปะเฉลยลง fixture แบบไม่ขึ้นกับตัวจบบรรทัด
 *
 * ทำไมต้องมี: git บน Windows แปลง LF เป็น CRLF ตอน checkout เฉพาะไฟล์ที่มันต้องเขียนใหม่
 * ผลคือ **ตัวจบบรรทัดในfixture ไม่สม่ำเสมอและขึ้นกับว่ารันอะไรมาก่อน**
 * เฉลยที่ค้นหลายบรรทัดจึงปะติดบ้างไม่ติดบ้างโดยไม่มีรูปแบบ
 *
 * เจอตอนเขียนตัวตรวจ variant: S09 ปะไม่ติดขณะที่เฉลยอ้างอิงอีก 11 ตัวปะติดหมด
 * ต่างกันแค่ว่าไฟล์นั้นเพิ่งถูก git เขียนทับไปหรือยัง
 *
 * ตัวตรวจที่ผ่านหรือตกตามลำดับการรัน ไม่ใช่ตามความถูกต้องของสิ่งที่ตรวจ
 * คือตัวตรวจที่เชื่อไม่ได้ — เป็นโรคเดียวกับที่โปรเจกต์นี้ไล่แก้มาตลอด
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const lf = (s) => String(s).replace(/\r\n/g, '\n');

/**
 * ปะทุก patch ตามลำดับ · คืน { ok, error }
 * เทียบแบบ normalize LF ทั้งสองฝั่ง แล้วเขียนกลับด้วยตัวจบบรรทัดแบบ LF
 */
export function applyPatches(fixtureRoot, patches) {
  for (const p of patches) {
    const abs = join(fixtureRoot, p.file);
    const before = lf(readFileSync(abs, 'utf8'));
    const find = lf(p.find);
    if (!before.includes(find)) {
      return { ok: false, error: `หาข้อความที่จะแทนไม่เจอใน ${p.file}` };
    }
    writeFileSync(abs, before.replace(find, lf(p.replace)), 'utf8');
  }
  return { ok: true, error: null };
}
