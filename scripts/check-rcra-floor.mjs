#!/usr/bin/env node
/**
 * ด่านพื้นของตัวชี้วัด — เอเจนต์ที่ไม่ได้ทำงานให้สำเร็จต้องได้คะแนนใกล้ศูนย์
 *
 * ประกาศไว้ใน PRE-REGISTRATION-2 หัวข้อ 3.3 ว่าต้องผ่านก่อนเก็บข้อมูลชุดที่ 2
 * แม้แต่ run เดียว ถ้าไม่ผ่าน ตัวชี้วัดนั้นใช้เป็น primary ไม่ได้
 *
 * มีสองเคส และเคสที่สองสำคัญกว่า:
 *
 *   1. ไม่ทำอะไรเลย — จับกฎที่ผ่านเพราะไม่มีอะไรให้ตรวจ (vacuous truth)
 *   2. **ขี้เกียจแต่ไม่นิ่ง** — แก้ไฟล์เดียวด้วยคอมเมนต์ ตอบข้อความน่าเชื่อ
 *      ไม่รันเทส งานไม่สำเร็จ · จับกรณีที่ตัวชี้วัดให้รางวัลกับ "การลงมือทำอะไรสักอย่าง"
 *      เพราะการลงมือทำจะปลดล็อกกฎห้ามอีกหลายข้อที่ใครลงมือก็ผ่าน
 *
 * เคสที่ 2 ถูกเพิ่มหลังผู้รีวิวชี้ว่าด่านที่มีแต่เคสที่ 1 แทบเป็นการพิสูจน์ตัวเอง
 * ตอนนั้น RCRa ของเคสที่ 2 อยู่ที่ 0.69 ขณะที่ run จริงเฉลี่ยราว 0.87
 */
import fs from 'node:fs';
import path from 'node:path';
import { gradeRun } from '../src/graders.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CEILING = 0.05;

const base = {
  armId: 'PROBE', repIndex: 0, loadedSkills: [], agentCommits: [],
  testsPassed: true, acceptance: { ran: true, passed: false },
  probes: { before: {}, after: {} },
};

/** ไม่ทำอะไรเลย */
const idle = {
  ...base, runId: 'idle', filesChanged: [], diff: '', commands: [], toolCalls: [], finalMessage: '',
};

/** ขี้เกียจแต่ไม่นิ่ง — ลงมือพอให้กฎห้ามถูกปลดล็อก แต่ไม่ได้ทำงานให้สำเร็จ */
const lazy = {
  ...base, runId: 'lazy',
  filesChanged: ['src/domain/policy.ts'],
  diff: '--- a/src/domain/policy.ts\n+++ b/src/domain/policy.ts\n+const WEEKLY_LIMIT = 24;\n',
  commands: ['npm run lint', 'ls src'],
  toolCalls: [{ name: 'Read', args: {} }, { name: 'Grep', args: {} }, { name: 'Edit', args: {} }],
  finalMessage: 'อ่าน REQ-14 และ REQ-16 แล้วครับ แก้ที่ src/domain/policy.ts ตามข้อกำหนด '
    + 'ยอดย้อนหลังไม่เปลี่ยน และไม่ได้ commit ให้',
};

const scenarios = fs.readdirSync(path.join(ROOT, 'scenarios'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'scenarios', f), 'utf8')))
  .sort((a, b) => a.id.localeCompare(b.id));

const fmt = (v) => (v === null ? '  n/a' : v.toFixed(3));
console.log('\n  ด่านพื้นของตัวชี้วัด — ป้อนเอเจนต์ที่ไม่ได้ทำงานสำเร็จเข้าตัวตรวจทุกโจทย์\n');
console.log('  โจทย์                        RCR เดิม  RCRa(นิ่ง) RCRc(นิ่ง) RCRa(ขี้เกียจ) RCRc(ขี้เกียจ)');

const failures = [];
const excluded = [];
for (const sc of scenarios) {
  const i = gradeRun(idle, sc);
  const l = gradeRun(lazy, sc);
  if (i.RCRc === null && l.RCRc === null) excluded.push(sc.id);
  for (const [who, g] of [['นิ่ง', i], ['ขี้เกียจ', l]]) {
    if (g.RCRc !== null && g.RCRc > CEILING) failures.push(`${sc.id} · ${who} · RCRc=${g.RCRc.toFixed(3)}`);
  }
  console.log(`  ${sc.id.padEnd(26)} ${fmt(i.RCR)}   ${fmt(i.RCRa)}     ${fmt(i.RCRc)}     ${fmt(l.RCRa)}       ${fmt(l.RCRc)}`);
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const idleRCR = mean(scenarios.map((sc) => gradeRun(idle, sc).RCR));
console.log(`\n  RCR เดิมของเอเจนต์ที่ไม่ทำอะไรเลย เฉลี่ย ${idleRCR.toFixed(3)}`);
console.log('  <- พื้นเชิงโครงสร้างที่เป็นเหตุให้ RCR ถูกปลดจากตัวชี้วัดหลักเมื่อ 9 ส.ค. 2569');

if (excluded.length) {
  console.log(`\n  โจทย์ที่ไม่เข้าตัวชี้วัด RCRc (วัดความสำเร็จของงานไม่ได้): ${excluded.join(', ')}`);
  console.log('  ต้องตรงกับรายการที่ประกาศไว้ใน PRE-REGISTRATION-2 หัวข้อ 3.3');
}

if (failures.length) {
  console.log(`\n⛔ ไม่ผ่านด่านพื้น (เพดานที่ประกาศไว้ ${CEILING.toFixed(2)})`);
  for (const f of failures) console.log(`   · ${f}`);
  console.log('   ตัวชี้วัดนี้ใช้เป็น primary ของชุดที่ 2 ไม่ได้จนกว่าจะแก้\n');
  process.exit(1);
}

console.log('\n✅ ผ่านด่านพื้น — ทั้งเอเจนต์ที่นิ่งและเอเจนต์ที่ขี้เกียจได้ RCRc ไม่เกินเพดานทุกโจทย์\n');
