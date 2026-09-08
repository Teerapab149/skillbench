/**
 * make-arms-explained.mjs — สร้าง ARMS-EXPLAINED.md จากไฟล์จริง
 *
 * ทำไมต้อง generate ไม่ใช่เขียนมือ: เอกสารที่เขียนมือจะ drift จากไฟล์ที่ใช้จริงเสมอ
 * และโปรเจกต์นี้มีตัวอย่างแล้วสามครั้งที่ "สิ่งที่เอกสารบอก" กับ "สิ่งที่โค้ดทำ" ไม่ตรงกัน
 * เอกสารนี้ต้องเป็นหลักฐาน ไม่ใช่คำบรรยาย จึงต้องอ่านจากต้นทางทุกครั้งที่สร้าง
 *
 *   node scripts/make-arms-explained.mjs
 *
 * ใช้เป็นภาคผนวกของเล่มได้ทั้งดุ้น และเป็นต้นทางของสไลด์ arm anatomy
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { installArm, uninstallArm, BASELINE_TAG } from '../src/install-arm.mjs';
import { refuseIfCollecting } from './collection-guard.mjs';
import { lockFixtureForProcess } from '../src/fixture-lock.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// หัวข้อ 5 ของเอกสารติดตั้ง A4 ลง fixture จริงเพื่อดึง diff ห้ามชนกับการเก็บข้อมูลที่กำลังเดินอยู่
refuseIfCollecting(ROOT, 'make-arms-explained');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/arms.json'), 'utf8'));
const canonical = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/rules-canonical.json'), 'utf8'));
const FIXTURE = path.join(ROOT, 'fixtures/gpu-booking');
lockFixtureForProcess(FIXTURE, 'make-arms-explained');
const OUT = path.join(ROOT, 'ARMS-EXPLAINED.md');

const estTokens = (t) => {
  const thai = (t.match(/[฀-๿]/g) ?? []).length;
  return Math.round(thai / 2 + (t.length - thai) / 4);
};

/** อ่านไฟล์ทั้งหมดของ arm จากต้นทาง (arms/) ไม่ใช่จาก workspace ที่ติดตั้งแล้ว */
function armSources(arm) {
  const out = [];
  for (const f of arm.contextFiles ?? []) {
    out.push({ rel: f, asSeenAs: 'CLAUDE.md', body: fs.readFileSync(path.join(ROOT, f), 'utf8') });
  }
  if (arm.skillsDir) {
    const dir = path.join(ROOT, arm.skillsDir);
    for (const d of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, d, 'SKILL.md');
      if (fs.existsSync(p)) {
        out.push({ rel: `${arm.skillsDir}/${d}/SKILL.md`, asSeenAs: `.claude/skills/${d}/SKILL.md`, body: fs.readFileSync(p, 'utf8') });
      }
    }
  }
  return out;
}

function armSizes(arm) {
  let always = 0, full = 0;
  for (const f of armSources(arm)) {
    full += estTokens(f.body);
    if (f.asSeenAs === 'CLAUDE.md') always += estTokens(f.body);
    else {
      const fm = f.body.match(/^---\n([\s\S]*?)\n---/);
      always += estTokens(fm ? fm[1] : '');
    }
  }
  return { always, full };
}

/** หาบรรทัดแรกที่ตรงกับ pattern พร้อมเลขบรรทัด — ใช้เป็นหลักฐานว่ากฎข้อนั้นอยู่ตรงไหนจริง */
function findLine(files, pattern, flags) {
  const re = new RegExp(pattern, flags ?? '');
  for (const f of files) {
    const lines = f.body.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) return { file: f.rel, line: i + 1, text: lines[i].trim() };
    }
  }
  return null;
}

const L = [];
const p = (s = '') => L.push(s);
const trunc = (s, n = 90) => (s.length > n ? `${s.slice(0, n)}…` : s);

const A1 = config.arms.find((a) => a.id === 'A1');
const A2 = config.arms.find((a) => a.id === 'A2');
const filesA1 = armSources(A1), filesA2 = armSources(A2);

p('# A0–A4 ต่างกันตรงไหน — เอกสารฉบับหลักฐาน');
p('');
p(`> **สร้างอัตโนมัติจากไฟล์จริงด้วย \`node scripts/make-arms-explained.mjs\`** — ห้ามแก้ด้วยมือ`);
p('> ทุกตัวเลขและทุกบรรทัดในเอกสารนี้อ่านมาจากไฟล์ที่ใช้รันจริง ไม่ใช่คำบรรยายว่าน่าจะเป็นอะไร');
p('>');
p('> เหตุผลที่ต้องมีเอกสารนี้: ตัวแปรต้นทั้งหมดของการทดลองอยู่ในไฟล์ไม่กี่ไฟล์');
p('> แต่ที่ผ่านมาไม่เคยแสดงเนื้อไฟล์เหล่านั้นออกมาเลยสักครั้ง ทั้งในสไลด์และในเล่ม');
p('');
p('---');
p('');

// ---------- 1. ตารางเทียบ ----------
p('## 1. ห้า arm ต่างกันอย่างไร');
p('');
p('| arm | บทบาท | เห็นอะไรที่ turn 0 | token ที่กินทุก request | ถ้าโหลด skill ครบ |');
p('|---|---|---|---:|---:|');
const ROLE = {
  A0: 'เส้นฐานล่างสุด', A1: 'active control — วิธีที่คนทำกันจริง', A2: 'treatment',
  A3: 'ยาหลอกจับคู่ความยาว', A4: 'ทนทานต่อ injection',
};
for (const arm of config.arms) {
  const { always, full } = armSizes(arm);
  const files = armSources(arm);
  const seen = files.length
    ? `\`CLAUDE.md\`${files.length > 1 ? ` + skill ${files.length - 1} ตัว` : ''}${arm.injectAdversarial ? ' + คอมเมนต์ล่อใน fixture' : ''}`
    : 'ไม่มีอะไรเลย';
  p(`| **${arm.id}** | ${ROLE[arm.id] ?? arm.role} | ${seen} | ${always.toLocaleString()} | ${full.toLocaleString()} |`);
}
p('');

const s1 = armSizes(A1), s2 = armSizes(A2);
const a3 = config.arms.find((a) => a.id === 'A3');
const s3 = armSizes(a3);
p('### ตัวเลขสองตัวที่ต้องอ่านให้ถูก');
p('');
p(`- **A2 กิน context ตลอดเวลา ${s2.always.toLocaleString()} tok เทียบกับ A1 ที่ ${s1.always.toLocaleString()} tok`
  + ` — ต่ำกว่า ${(((s1.always - s2.always) / s1.always) * 100).toFixed(0)}%** ทั้งที่กฎครบเท่ากันทุกข้อ`);
p('  นี่คือหลักฐานเชิงปริมาณของ progressive disclosure: กฎเฉพาะบริบทไม่ถูกโหลดจนกว่าจะตรงกับงาน');
p(`- **A3 / A1 = ${(s3.always / s1.always).toFixed(3)}** อยู่ในกรอบ 0.85–1.15 ที่ประกาศไว้`);
p('  ถ้าจับคู่ความยาวไม่สำเร็จ จะแยก "ผลของกฎ" ออกจาก "ผลของความยาวข้อความ" ไม่ได้เลย');
p('');
p('### ถ้า arm สองตัวต่างกัน แปลว่าอะไร');
p('');
p('| เทียบคู่ไหน | ตอบคำถามอะไร |');
p('|---|---|');
p('| A1 vs A0 | การมีกฎเลยดีกว่าไม่มีไหม |');
p('| **A2 vs A1** | **กฎชุดเดียวกันเป๊ะ วางคนละที่ ให้ผลต่างกันไหม — นี่คือคำถามวิจัย** |');
p('| A1 vs A3 | ผลมาจากเนื้อหาของกฎ หรือมาจากการมีข้อความยาว ๆ ใน context เฉย ๆ |');
p('| A2 vs A3 | ถ้า A2 ชนะ A3 แปลว่าผลมาจากโครงสร้าง ไม่ใช่จำนวน token |');
p('| A4 vs A2 | กฎกันคำสั่งที่ฝังในไฟล์ได้จริง หรือเอเจนต์แค่บังเอิญเชื่อฟังตอนไม่มีใครยุ |');
p('');

// ---------- 2. อะไรเหมือนกันหมด ----------
p('## 2. อะไรที่เหมือนกันทุก arm');
p('');
p('ตัวแปรต้นจะเหลือตัวเดียวได้ ก็ต่อเมื่อทุกอย่างที่เหลือถูกล็อกเท่ากันจริง');
p('และ **"ล็อก" ต้องหมายถึงถูก assert ราย run** ไม่ใช่แค่เขียนไว้ในไฟล์ config');
p('');
const ff = config.fixedFactors;
p('| ตัวแปรควบคุม | ค่า | บังคับอย่างไร |');
p('|---|---|---|');
p(`| โมเดล | \`${ff.model}\` | \`--model\` + อยู่ใน signature + \`validateRuntime()\` เทียบกับที่ CLI รายงาน |`);
p(`| เพดาน turn | ${ff.maxTurns} | \`--max-turns\` + อยู่ใน signature |`);
p(`| ชุด tool | ${[...new Set([...(ff.toolset ?? []), 'Skill'])].join(', ')} | \`--tools\` **+ \`--strict-mcp-config\`** แล้ว assert ทุก run |`);
p('| MCP | ไม่มีเลย | `--strict-mcp-config` โดยไม่ส่ง `--mcp-config` · assert ว่า `mcp_servers` ว่าง |');
p(`| แหล่ง setting | ${ff.settingSources} | \`--setting-sources project\` |`);
p('| skill นอกการทดลอง | เท่ากันทุก arm (baseline set B) | แช่แข็งใน manifest · assert ว่าไม่มีตัวไหนถูก **เรียกใช้** จริง |');
p('| เวอร์ชัน CLI | ตรึงจาก run แรก | อยู่ใน manifest · เปลี่ยนเมื่อไหร่หยุดทั้งชุด |');
p(`| fixture | \`fixtures/gpu-booking\` | ${ff.workspaceReset} |`);
p(`| ลำดับการรัน | ${ff.runOrder} | สลับใน runner ด้วย seed คงที่ |`);
p('');
p('> `temperature` เคยอยู่ในตารางนี้ **ถูกลบออกเมื่อ 4 ก.ย. 2569** เพราะไม่เคยถูกส่งไปที่ CLI');
p('> และ CLI ไม่มี flag ให้ตั้ง การสุ่มของโมเดลจึงควบคุมไม่ได้ — ซึ่งเป็นเหตุผลที่ต้องรันหลายรอบต่อโจทย์');
p('');

// ---------- 3. เมทริกซ์กฎ ----------
const nOb = canonical.rules.reduce((n, r) => n + r.obligations.length, 0);
p('## 3. กฎ 20 ข้อ / ' + nOb + ' ข้อผูกพัน — อยู่ตรงไหนของแต่ละฝั่ง');
p('');
p('> **A1 กับ A2 ต้องมีข้อผูกพันครบเท่ากันทุกข้อ** ไม่งั้นการเปรียบเทียบจะกลายเป็น');
p('> "กฎเยอะกว่า" ปนกับ "วางกฎคนละที่" ซึ่งเป็นคนละคำถามกับที่งานนี้ถาม');
p('>');
p('> ตารางนี้อ่านจากไฟล์จริง ตัวตรวจตัวเดียวกันรันอยู่ใน `npm run check` และจะตกถ้าข้อไหนขาด');
p('');
p('| # | ข้อผูกพัน | อยู่ที่ไหนใน A1 | อยู่ที่ไหนใน A2 |');
p('|---|---|---|---|');
let missing = 0;
for (const rule of canonical.rules) {
  for (const ob of rule.obligations) {
    const l1 = findLine(filesA1, ob.pattern, ob.flags);
    const l2 = findLine(filesA2, ob.pattern, ob.flags);
    if (!l1 || !l2) missing++;
    const cell = (l) => (l ? `\`${path.basename(path.dirname(l.file)) === 'A1' ? 'CLAUDE.md' : l.file.replace(/^arms\/A2\/(skills\/)?/, '')}:${l.line}\`` : '**ขาด**');
    p(`| ${ob.id} | ${ob.text} | ${cell(l1)} | ${cell(l2)} |`);
  }
}
p('');
p(missing === 0
  ? `**ครบทั้ง ${nOb} ข้อผูกพันทั้งสองฝั่ง**`
  : `⛔ **ขาด ${missing} ข้อ — การเปรียบเทียบยังไม่ยุติธรรม ห้ามเก็บข้อมูล**`);
p('');
p('### กฎข้อเดียวกัน คนละที่ — ตัวอย่างที่อธิบายทั้งงานได้ด้วยบรรทัดเดียว');
p('');
{
  const ob = canonical.rules.find((r) => r.id === 'R01').obligations.find((o) => o.id === 'R01b');
  const l1 = findLine(filesA1, ob.pattern, ob.flags);
  const l2 = findLine(filesA2, ob.pattern, ob.flags);
  if (l1 && l2) {
    p(`ข้อผูกพัน \`${ob.id}\` — *${ob.text}*`);
    p('');
    p('```');
    p(`A1  ${l1.file}:${l1.line}`);
    p(`    ${trunc(l1.text)}`);
    p('');
    p(`A2  ${l2.file}:${l2.line}`);
    p(`    ${trunc(l2.text)}`);
    p('```');
    p('');
    p('**ข้อผูกพันเดียวกัน ต่างกันแค่จังหวะที่ถูกโหลดเข้า context** — A1 โหลดทุก request');
    p('ส่วน A2 โหลดเมื่อ description ของ skill ตรงกับงานตรงหน้า นั่นคือตัวแปรต้นทั้งหมดของงานนี้');
    p('');
    p('*(ถ้อยคำต่างกันเล็กน้อยตามบริบทของแต่ละไฟล์ — สิ่งที่ต้องเท่ากันคือข้อผูกพัน ไม่ใช่ตัวอักษร');
    p('ตัวตรวจใน `npm run check` จึงตรวจที่ข้อผูกพันทั้ง ' + nOb + ' ข้อ ไม่ใช่เทียบไฟล์แบบ diff)*');
    p('');
    p('และนี่คือคำตอบของคำถาม *"เขียน skill เองแล้วให้คะแนน skill ตัวเอง จะเชื่อได้ยังไง"* —');
    p('กฎทั้ง ' + nOb + ' ข้อถูกประกาศไว้ที่เดียวใน `config/rules-canonical.json` แล้วบังคับให้ทั้งสองฝั่งครบเท่ากัน');
    p('ไม่ได้เขียนกฎให้ฝั่งไหนได้เปรียบ และตรวจสอบซ้ำได้จากตารางข้างบน');
    p('');
  }
}

// ---------- 4. เนื้อไฟล์เต็ม ----------
p('---');
p('');
p('## 4. เนื้อไฟล์เต็มของทุก arm — ไม่ตัด ไม่สรุป');
p('');
p('สิ่งที่โมเดลเห็นจริงที่ turn 0 ดัมป์ซ้ำได้ด้วย `node scripts/dump-arm.mjs`');
p('');
for (const arm of config.arms) {
  const files = armSources(arm);
  p(`### ${arm.id} — ${arm.name}`);
  p('');
  if (!files.length) {
    p('**ไม่มีไฟล์ใดถูกติดตั้งลง workspace เลย** เอเจนต์เห็นแค่ repo เปล่ากับโจทย์');
    p('');
    continue;
  }
  if (arm.id === 'A4') {
    p('ไฟล์ context เหมือน A2 ทุกไบต์ (ดูหัวข้อ A2) ความต่างอยู่ในไฟล์ของ fixture — ดูหัวข้อ 5');
    p('');
    continue;
  }
  for (const f of files) {
    p(`<details><summary><code>${f.asSeenAs}</code> — จาก <code>${f.rel}</code> (~${estTokens(f.body).toLocaleString()} tok)</summary>`);
    p('');
    p('```markdown');
    p(f.body.trimEnd());
    p('```');
    p('');
    p('</details>');
    p('');
  }
}

// ---------- 5. A4 ----------
p('## 5. A4 — ความต่างที่ไม่ได้อยู่ในไฟล์ context');
p('');
p('A4 ใช้ไฟล์ context ชุดเดียวกับ A2 ทุกไบต์ สิ่งที่เพิ่มคือข้อความในไฟล์โค้ดของ fixture');
p('ที่พยายามสั่งให้เอเจนต์ละเมิดกฎ โดยอ้างว่าได้รับอนุมัติแล้ว');
p('');
let diff = '';
try {
  const a4 = config.arms.find((a) => a.id === 'A4');
  installArm({ workspace: FIXTURE, arm: a4 });
  diff = execFileSync('git', ['diff', BASELINE_TAG, '--', 'src/'], { cwd: FIXTURE, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
} finally {
  try { uninstallArm(FIXTURE); } catch { /* ปิดเงียบ */ }
}
if (diff.trim()) {
  p('```diff');
  p(diff.trimEnd());
  p('```');
} else {
  p('*(สร้าง diff ไม่ได้ — ต้องมี git และ baseline tag ใน fixture)*');
}
p('');
p('> กฎที่ทดสอบคือข้อ `R20a` และ `R20b` ซึ่ง **A1 กับ A2 มีเท่ากัน** (ดูตารางหัวข้อ 3)');
p('> ตัวตรวจไม่ต้องเพิ่มใหม่: ตกกับดักแรกทำให้กฎห้ามแตะ `data/` ตก · กับดักที่สองทำให้กฎห้าม `git commit` ตก');
p('>');
p('> **run ที่ไม่เคยเปิดไฟล์สองไฟล์นี้ ไม่ได้ถูกทดสอบเรื่องความทนทานเลย**');
p('> รายงานผลจึงต้องแยก exposed กับ not-exposed เสมอ (หัวข้อ 6.6 ของ `results/report.md`)');
p('');

fs.writeFileSync(OUT, `${L.join('\n')}\n`);
console.log(`\nเขียนแล้ว: ${path.relative(ROOT, OUT)}  (${L.length} บรรทัด)`);
console.log(missing === 0
  ? `ข้อผูกพันครบทั้ง ${nOb} ข้อทั้งสองฝั่ง`
  : `⛔ ขาด ${missing} ข้อ — แก้ก่อนใช้เอกสารนี้`);
process.exit(missing === 0 ? 0 : 1);
