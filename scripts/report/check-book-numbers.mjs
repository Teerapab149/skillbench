// ตรวจว่าตัวเลขสำคัญในเล่ม (report/final/*.md) ตรงกับไฟล์ผลของทั้งสามชุด
//   node scripts/report/check-book-numbers.mjs
// สร้างข้อความที่ควรปรากฏจากข้อมูล แล้วค้นในเล่ม ข้อที่ไม่พบคือจุดที่ต้องตรวจด้วยตา
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', '..');
const rj = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const book = fs.readdirSync(path.join(ROOT, 'report/final')).filter((f) => /^0\d.*\.md$/.test(f))
  .map((f) => fs.readFileSync(path.join(ROOT, 'report/final', f), 'utf8')).join('\n')
  .replace(/​/g, '').replace(/−/g, '-');
const p1 = (v) => (v * 100).toFixed(1);
const s1 = rj('results/numbers.json'), s2 = rj('results-study2/numbers.json'), s3 = rj('results-study3/numbers.json');
const sens = rj('results-study3/sensitivity.json');
const d = s3.primary.decision;

const expect = [
  // ชุดที่ 3 ผลหลัก
  ['A2 RCRc ชุด 3', p1(s3.primary.rateA) + '%'],
  ['A1 RCRc ชุด 3', p1(s3.primary.rateB) + '%'],
  ['ผลต่างหลัก', '+' + p1(s3.primary.diff)],
  ['CI 90% ล่าง', p1(d.ci90[0])],
  ['CI 90% บน', '+' + p1(d.ci90[1])],
  ['CI 95% ล่าง', p1(d.ci95[0])],
  ['CI 95% บน', '+' + p1(d.ci95[1])],
  ['p ชุด 3', s3.primary.p.toFixed(3)],
  ['ชนะแพ้เสมอ ชุด 3', `${s3.primary.wins}/${s3.primary.losses}/${s3.primary.ties}`],
  // การวิเคราะห์ความไว
  ...['SA-1', 'SA-2'].map((k) => [`${k} ผลต่าง`, '+' + p1(sens.results[k].primary_A2_vs_A1.meanDiff)]),
  ...['SA-1', 'SA-2'].map((k) => [`${k} p`, sens.results[k].primary_A2_vs_A1.p.toFixed(3)]),
  // A2 vs A5
  ['A5 RCRc', p1(s3.study3.keySecondary.rateB) + '%'],
  ['A2−A5', '+' + p1(s3.study3.keySecondary.rateA - s3.study3.keySecondary.rateB)],
  // รายกลุ่มชุด 3
  ...Object.entries(s3.perArm).flatMap(([a, m]) => [
    [`${a} CRIT`, p1(m.CRIT) + '%'], [`${a} SCOPE`, p1(m.SCOPE) + '%'], [`${a} RCRc`, p1(m.RCRc) + '%'],
    [`${a} ทำงานสำเร็จ`, p1(m.taskDoneRate) + '%'], [`${a} pass^k`, p1(m.passHatK) + '%'], [`${a} RCRc เมื่อสำเร็จ`, m.RCRcGivenDone.toFixed(3)],
  ]),
  // รอบแรก
  ['RCRc1 A2', p1(s3.study3.oneShot.rateA) + '%'], ['RCRc1 A1', p1(s3.study3.oneShot.rateB) + '%'],
  ['RCRc1 ผลต่าง', '+' + p1(s3.study3.oneShot.diff)], ['RCRc1 p', s3.study3.oneShot.p.toFixed(3)],
  // trigger F1
  ...Object.entries(s3.triggerF1.primary.A2).map(([k, v]) => [`F1 ${k}`, v.toFixed(3)]),
  ['skill ต่อ run', s3.manipulation.A2.skillsLoadedPerRun.toFixed(2)],
  // ชุด 1 และ 2
  ['ชุด 1 A2', p1(s1.primary.rateA) + '%'], ['ชุด 1 A1', p1(s1.primary.rateB) + '%'], ['ชุด 1 ผลต่าง', '+' + p1(s1.primary.diff)],
  ['ชุด 2 A2', p1(s2.primary.rateA) + '%'], ['ชุด 2 A1', p1(s2.primary.rateB) + '%'], ['ชุด 2 ผลต่าง', '+' + p1(s2.primary.diff)],
  ['ชุด 1 ชนะแพ้เสมอ', `${s1.primary.wins}/${s1.primary.losses}/${s1.primary.ties}`],
  ['ชุด 2 ชนะแพ้เสมอ', `${s2.primary.wins}/${s2.primary.losses}/${s2.primary.ties}`],
];

let miss = 0;
for (const [label, s] of expect) {
  const found = book.includes(s);
  if (!found) { miss++; console.log(`ไม่พบ  ${label}: "${s}"`); }
}
console.log(`\nตรวจ ${expect.length} ค่า ไม่พบในเล่ม ${miss} ค่า`);
process.exit(miss ? 1 : 0);
