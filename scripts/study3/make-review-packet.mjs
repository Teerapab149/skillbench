#!/usr/bin/env node
/**
 * เอกสารสำหรับผู้วิจัยตรวจโจทย์ชุดที่ 3 ทีละข้อ — สร้างจากไฟล์โจทย์และเทสจริง ไม่ได้พิมพ์มือ
 *
 *   node scripts/study3/make-review-packet.mjs   → docs/study3-scenario-review.md
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dir = path.join(ROOT, 'scenarios');
const ids = fs.readdirSync(dir).filter((f) => /^S\d+.*\.json$/.test(f)).sort();
const L = [];
const p = (s = '') => L.push(s);

p('# ตรวจโจทย์ชุดที่ 3 — ทีละข้อ');
p('');
p('> สร้างอัตโนมัติจาก `scenarios/*.json` และ `scenarios/acceptance/*.test.ts` ด้วย `scripts/study3/make-review-packet.mjs`');
p('> ทุกข้อผ่านด่านทั้งสี่แล้ว (`npm run check:acceptance`) — สิ่งที่ด่านตรวจไม่ได้คือ **ความหมาย** ซึ่งเป็นสิ่งที่ขอให้ผู้วิจัยตรวจ');
p('');
p('**คำถามที่ขอให้ถามกับทุกข้อ**');
p('1. คำสั่งชัดพอไหม · คนทำงานจริงจะเข้าใจตรงกันไหมว่าต้องทำอะไร');
p('2. "พฤติกรรมที่ถูก" มีคำตอบเดียวจริงไหม — ถ้าเถียงได้ (แบบ S10 ในชุดที่ 2) ต้องแก้หรือตัด');
p('3. กฎ critical ตกคำตอบที่ถูกได้ไหม หรือปล่อยคำตอบที่ผิดผ่านได้ไหม');
p('4. เทสยอมรับตรวจเฉพาะสิ่งที่ข้อกำหนดบอกชัดหรือเปล่า');
p('');
p('| โจทย์ | ตระกูล | คู่ | ทิศที่ทำนาย |');
p('|---|---|---|---|');
const all = ids.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
for (const s of all) p(`| ${s.id} | ${s.family} | ${s.pair ? `${s.pair.id} · ${s.pair.triggerWords === 'absent' ? 'ไม่มีคำกระตุ้น' : 'มีคำกระตุ้น'}` : ''} | ${({ neutral: 'กลาง' })[s.predictedDirection] ?? s.predictedDirection ?? 'กลาง'} |`);
p('');

for (const s of all) {
  p('---');
  p('');
  p(`## ${s.id}`);
  p('');
  p(`**ตระกูล:** ${s.family} · **ความยาก:** ${s.difficulty ?? '-'} · **ข้อกำหนด:** ${(s.reqs ?? []).join(', ')}${s.setupPatches ? ` · **สภาพเริ่มต้น:** \`${s.setupPatches}\`` : ''}`);
  p('');
  p('**คำสั่งที่เอเจนต์ได้รับ**');
  p('');
  p(`> ${s.prompt}`);
  p('');
  p(`**กับดักและพฤติกรรมที่ถูก:** ${s._designNote ?? '-'}`);
  p('');
  if (s._study3Change) { p(`**เปลี่ยนจากชุดที่ 2:** ${s._study3Change}`); p(''); }
  p('| กฎ | ระดับ | รอบ | วัดอะไร | ตัวตรวจ |');
  p('|---|---|---|---|---|');
  for (const r of s.rules) {
    const chk = r.check.type === 'all_of' || r.check.type === 'any_of'
      ? `${r.check.type}(${r.check.checks.map((c) => c.type).join(', ')})`
      : r.check.type;
    p(`| ${r.id} | ${r.severity ?? 'major'} | ${r.turn} | ${String(r.desc).replace(/\|/g, '/')} | \`${chk}\` |`);
  }
  p('');
  const testFile = path.join(dir, 'acceptance', `${s.id}.test.ts`);
  if (fs.existsSync(testFile)) {
    const names = [...fs.readFileSync(testFile, 'utf8').matchAll(/test\('([^']+)'/g)].map((m) => m[1]);
    p('**เทสยอมรับ (เอเจนต์มองไม่เห็น):**');
    for (const n of names) p(`- ${n}`);
    p('');
  }
}
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs', 'study3-scenario-review.md'), L.join('\n') + '\n');
console.log(`docs/study3-scenario-review.md — ${all.length} โจทย์`);
