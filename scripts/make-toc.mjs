/*
 * สร้าง report/front/สารบัญ.md จากหัวข้อจริงในไฟล์บททั้งแปด
 * ห้ามพิมพ์สารบัญด้วยมือ · แก้หัวข้อในบทไหนแล้วให้รันใหม่
 *
 *   npm run toc
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const LF = String.fromCharCode(10);
const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') + '/';

const chapters = [
  ['ch1-introduction.md', 'บทที่ 1 — บทนำ'],
  ['ch2-related-work.md', 'บทที่ 2 — ทฤษฎีและงานวิจัยที่เกี่ยวข้อง'],
  ['ch3-methodology.md', 'บทที่ 3 — ระเบียบวิธีวิจัย'],
  ['ch4-measurement-system.md', 'บทที่ 4 — การออกแบบและพัฒนาระบบวัดผล'],
  ['ch5-results.md', 'บทที่ 5ก — ผลการทดลอง ชุดที่ 1'],
  ['ch5b-results-study2.md', 'บทที่ 5ข — ผลการทดลอง ชุดที่ 2'],
  ['ch6-limitations-draft.md', 'บทที่ 6 — อภิปรายผลและข้อจำกัด'],
  ['ch7-conclusion.md', 'บทที่ 7 — สรุปผลและข้อเสนอแนะ'],
];

const clean = (t) => t.replace(/[*`]/g, '').replace(/\s+—\s+$/, '').trim();
const out = [];
out.push('# สารบัญ');
out.push('');
const TH_MONTH = [1,2,3,4,5,6,7,8,9,10,11,12];
const MN = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const now = new Date();
const stamp = now.getDate() + ' ' + MN[now.getMonth()] + ' ' + (now.getFullYear() + 543);
out.push('> สร้างจากหัวข้อจริงในไฟล์บททั้งแปดด้วย `npm run toc` เมื่อ ' + stamp);
out.push('> **เลขหน้าเว้นไว้** ให้ Word ใส่เองด้วยฟิลด์สารบัญอัตโนมัติหลังประกอบเล่ม');
out.push('> ถ้าแก้หัวข้อในบทใด ต้องสร้างไฟล์นี้ใหม่ ไม่ใช่แก้ด้วยมือ');
out.push('');
out.push('## ส่วนหน้า');
out.push('');
for (const x of ['ปกนอก', 'ปกใน', 'บทคัดย่อภาษาไทย', 'Abstract', 'กิตติกรรมประกาศ',
  'สารบัญ', 'สารบัญตาราง', 'สารบัญภาพ']) out.push(`- ${x}`);
out.push('');
out.push('## เนื้อเรื่อง');
out.push('');

let tables = 0;
for (const [file, title] of chapters) {
  const s = fs.readFileSync(R + 'report/' + file, 'utf8').split(String.fromCharCode(13) + LF).join(LF);
  const lines = s.split(LF);
  out.push(`### ${title}`);
  out.push('');
  for (const l of lines) {
    if (/^\|[\s-]*\|/.test(l)) tables++;          // แถวเส้นคั่นหัวตาราง = หนึ่งตาราง
    if (!/^#{2,3} /.test(l)) continue;
    const depth = l.startsWith('### ') ? 1 : 0;
    out.push(`${'  '.repeat(depth)}- ${clean(l.replace(/^#{2,3} /, ''))}`);
  }
  out.push('');
}

out.push('## ส่วนท้าย');
out.push('');
for (const x of ['เอกสารอ้างอิง', 'ภาคผนวก ก — ประกาศแผนวิเคราะห์ล่วงหน้า ชุดที่ 1 และ 2',
  'ภาคผนวก ข — บริบทและ skill ที่แต่ละกลุ่มได้รับ',
  'ภาคผนวก ค — บันทึกการเก็บข้อมูลและเหตุการณ์ที่พบ']) out.push(`- ${x}`);
out.push('');
out.push('---');
out.push('');
out.push(`**จำนวนตารางในเนื้อเรื่องทั้งหมด ${tables} ตาราง** — สารบัญตารางต้องสร้างหลังประกอบเล่ม`);
out.push('เพราะต้องมีคำบรรยายและเลขที่ตารางซึ่งยังไม่ได้ใส่ในไฟล์ markdown');
out.push('');
out.push('**สารบัญภาพ:** เล่มนี้ยังไม่มีภาพประกอบ ถ้าเพิ่มภายหลังต้องเพิ่มสารบัญภาพด้วย');

fs.writeFileSync(R + 'report/front/สารบัญ.md', out.join(LF) + LF);
console.log('เขียนสารบัญแล้ว · ตาราง', tables, 'ตาราง ·', out.length, 'บรรทัด');
