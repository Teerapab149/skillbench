#!/usr/bin/env node
/**
 * แผนที่ความครอบคลุม — ข้อกำหนดข้อไหนถูกวัดจริง ข้อไหนไม่เคยถูกวัด
 *
 * ผู้รีวิวภายนอกจัดให้เป็นงานอันดับแรกของการตรวจสอบเทสยอมรับ เหตุผลตรงไปตรงมา:
 * เรารู้ว่าเทสที่มี "ผ่าน" หรือ "ตก" แต่ไม่เคยรู้ว่ามันครอบคลุมข้อกำหนดกี่ข้อ
 * และช่องว่างที่ไม่มีใครรู้ว่ามีอยู่ คือช่องว่างที่กรรมการจะเป็นคนชี้ให้
 *
 * เอกสารนี้ไม่ตัดสินว่าดีหรือไม่ดี — มันแค่บอกความจริงว่าอะไรถูกวัดและอะไรไม่
 * ข้อกำหนดที่ไม่ถูกวัด **ไม่ใช่ข้อบกพร่องเสมอไป** หลายข้อไม่มีโจทย์ไหนแตะเลยโดยตั้งใจ
 * สิ่งที่เป็นข้อบกพร่องคือการไม่รู้ว่าข้อไหนอยู่กลุ่มไหน
 *
 *   node scripts/make-coverage-map.mjs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const FIXTURE = join(ROOT, 'fixtures', 'gpu-booking');
const ACC = join(ROOT, 'scenarios', 'acceptance');

// ---------- 1. ข้อกำหนดทั้งหมดจากตารางใน REQUIREMENTS.md ----------
const reqDoc = readFileSync(join(FIXTURE, 'REQUIREMENTS.md'), 'utf8');
const reqs = [];
for (const line of reqDoc.split('\n')) {
  const m = line.match(/^\|\s*\*\*(REQ-\d+)\*\*\s*\|\s*([^|]+)\|/);
  if (m) reqs.push({ id: m[1], text: m[2].trim().replace(/\s+/g, ' ').slice(0, 90) });
}

// ---------- 2. โจทย์อ้างถึงข้อไหน ----------
const scenarios = readdirSync(join(ROOT, 'scenarios')).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(ROOT, 'scenarios', f), 'utf8')));

// ---------- 3. เทสยอมรับอ้างถึงข้อไหน (จากชื่อเทสและคอมเมนต์) ----------
const acceptanceReqs = new Map();   // REQ -> Set<scenarioId>
for (const f of readdirSync(ACC).filter((x) => x.endsWith('.test.ts'))) {
  const id = f.replace(/\.test\.ts$/, '');
  const body = readFileSync(join(ACC, f), 'utf8');
  for (const m of body.matchAll(/REQ-\d+/g)) {
    if (!acceptanceReqs.has(m[0])) acceptanceReqs.set(m[0], new Set());
    acceptanceReqs.get(m[0]).add(id);
  }
}

// ---------- 4. โจทย์ไหนมีกฎ acceptance_test ผูกกับ CRIT ----------
const wired = new Set(scenarios.filter((s) => s.rules.some((r) => r.check?.type === 'acceptance_test'))
  .map((s) => s.id));

// ---------- 5. เฉลยผิด / เฉลยคนละแบบ ----------
const variants = existsSync(join(ACC, 'variants'))
  ? readdirSync(join(ACC, 'variants')).filter((f) => f.endsWith('.mjs'))
  : [];
const variantsFor = (id) => {
  const mine = variants.filter((f) => f.startsWith(id + '.'));
  return {
    wrong: mine.filter((f) => f.includes('.wrong.')).length,
    alt: mine.filter((f) => f.includes('.alt.')).length,
  };
};

// ---------- ประกอบเอกสาร ----------
const L = [];
const p = (s = '') => L.push(s);

p('# แผนที่ความครอบคลุม — ข้อกำหนดข้อไหนถูกวัดจริง');
p('');
p('> **สร้างอัตโนมัติด้วย `node scripts/make-coverage-map.mjs` — ห้ามแก้ด้วยมือ**');
p('>');
p('> เอกสารนี้ตอบคำถามเดียว: ข้อกำหนดแต่ละข้อ **ถูกวัดโดยอะไร**');
p('> ข้อที่ไม่ถูกวัดไม่ใช่ข้อบกพร่องเสมอไป — หลายข้อไม่มีโจทย์ไหนแตะโดยตั้งใจ');
p('> สิ่งที่เป็นข้อบกพร่องคือการไม่รู้ว่าข้อไหนอยู่กลุ่มไหน');
p('');

p('## 1. สรุปตามโจทย์');
p('');
p('| โจทย์ | ตระกูล | อ้างถึงข้อกำหนด | เทสยอมรับผูกกับ CRIT | เฉลยผิดที่ทดสอบแล้ว | เฉลยคนละแบบ |');
p('|---|---|---|---|---:|---:|');
for (const s of scenarios) {
  const v = variantsFor(s.id);
  p(`| ${s.id} | ${s.family ?? '?'} | ${(s.reqs ?? []).join(', ') || '—'} | ${wired.has(s.id) ? 'ใช่' : '**ไม่**'} | ${v.wrong} | ${v.alt} |`);
}
p('');
{
  const notWired = scenarios.filter((s) => !wired.has(s.id));
  for (const s of notWired) {
    p(`> **${s.id} ไม่ผูกเทสยอมรับกับ CRIT โดยตั้งใจ** — ${(s._acceptanceNote ?? 'ไม่มีบันทึกเหตุผล ⚠️').slice(0, 300)}`);
    p('');
  }
}

p('## 2. ข้อกำหนดที่โจทย์อ้างถึง และการวัด');
p('');
p('| ข้อกำหนด | เนื้อความ | โจทย์ที่อ้างถึง | มีเทสยอมรับกล่าวถึง |');
p('|---|---|---|---|');
let measured = 0, mentionedOnly = 0;
for (const r of reqs) {
  const inScen = scenarios.filter((s) => (s.reqs ?? []).includes(r.id)).map((s) => s.id);
  const inAcc = [...(acceptanceReqs.get(r.id) ?? [])];
  if (!inScen.length && !inAcc.length) continue;
  if (inAcc.length) measured++; else mentionedOnly++;
  p(`| ${r.id} | ${r.text} | ${inScen.join(', ') || '—'} | ${inAcc.join(', ') || '**ไม่มี**'} |`);
}
p('');

const untouched = reqs.filter((r) => !scenarios.some((s) => (s.reqs ?? []).includes(r.id))
  && !acceptanceReqs.has(r.id));
p('## 3. ข้อกำหนดที่ไม่มีโจทย์ใดแตะเลย');
p('');
p(`มี **${untouched.length} จาก ${reqs.length} ข้อ** ที่ไม่มีโจทย์ใดอ้างถึงและไม่มีเทสยอมรับกล่าวถึง`);
p('');
p('ข้อเหล่านี้อยู่นอกขอบเขตของการทดลอง ไม่ใช่ช่องโหว่ของการวัด');
p('แต่ต้องเขียนไว้ในเล่มว่า **การทดลองครอบคลุมข้อกำหนดเพียงบางส่วน** ไม่ใช่ทั้งระบบ');
p('');
p(untouched.map((r) => `\`${r.id}\``).join(' · ') || '(ไม่มี)');
p('');

p('## 4. สิ่งที่แผนที่นี้ยังบอกไม่ได้');
p('');
p('- การที่เทสยอมรับ **กล่าวถึง** ข้อกำหนดข้อหนึ่ง ไม่ได้แปลว่าวัดครบทุกแง่ของข้อนั้น');
p('  ตารางนี้อ่านจากการอ้างอิงในชื่อเทสและคอมเมนต์ ซึ่งเป็นตัวแทนที่หยาบ');
p('- ข้อกำหนดที่ถูกวัดโดยกฎอื่นที่ไม่ใช่เทสยอมรับ (เช่น `files_not_touch`, `text_matches`)');
p('  ไม่ปรากฏในคอลัมน์สุดท้าย จึงต้องอ่านคู่กับไฟล์ scenario เอง');
p('- ความถูกต้องของเทสยอมรับเองถูกตรวจแยกด้วยสามด่าน:');
p('  ตกบน baseline · เขียวเมื่อปะเฉลยอ้างอิง · เฉลยผิดต้องตกและเฉลยคนละแบบต้องผ่าน');
p('');

const out = join(ROOT, 'COVERAGE-MAP.md');
writeFileSync(out, L.join('\n') + '\n', 'utf8');
console.log(`เขียนแล้ว: COVERAGE-MAP.md`);
console.log(`  ข้อกำหนดในตาราง ${reqs.length} ข้อ · มีเทสยอมรับกล่าวถึง ${measured} · โจทย์อ้างแต่เทสไม่กล่าวถึง ${mentionedOnly} · ไม่มีใครแตะ ${untouched.length}`);
console.log(`  โจทย์ที่ผูกเทสยอมรับกับ CRIT: ${wired.size}/${scenarios.length}`);
console.log(`  variant ทั้งหมด ${variants.length} ไฟล์`);
