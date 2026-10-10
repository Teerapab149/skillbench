#!/usr/bin/env node
/*
 * รวมเล่มรายงานฉบับสมบูรณ์เป็น Word
 *   report/final/0*.md  →  ภาคผนวก (สร้างจากไฟล์จริง) + กราฟ SVG (จาก numbers.json)
 *   → เรียงเลขตาราง/รูปใหม่ทั้งเล่ม → pandoc + reference.docx (จาก template ของวิชา)
 * ใช้: node scripts/report/build-book.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const FINAL = path.join(ROOT, 'report/final');
const BUILD = path.join(FINAL, 'build');
const FIG = path.join(BUILD, 'figures');
fs.mkdirSync(FIG, { recursive: true });
const rd = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const n3 = JSON.parse(rd('results-study3/numbers.json'));
const sa = JSON.parse(rd('results-study3/sensitivity.json'));

// ---------------------------------------------------------------- กราฟ
const FONT = "font-family=\"DB ChuanPim PSU, TH Sarabun New, Tahoma, sans-serif\"";
function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#fff"/>${body}</svg>`;
}
function box(x, y, w, h, lines, fill = '#eef3fb', stroke = '#3b5b92') {
  const t = lines.map((l, i) => `<text x="${x + w / 2}" y="${y + h / 2 + (i - (lines.length - 1) / 2) * 20 + 6}" text-anchor="middle" font-size="15" ${FONT}>${l}</text>`).join('');
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>${t}`;
}
const arrow = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#555" stroke-width="1.5" marker-end="url(#a)"/>`;
const defs = '<defs><marker id="a" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8 z" fill="#555"/></marker></defs>';

fs.writeFileSync(path.join(FIG, 'fig-framework.svg'), svg(760, 330, defs
  + box(10, 40, 220, 170, ['ตัวแปรต้น: วิธีส่งกฎ', 'A0 ไม่มีกฎ', 'A1 ไฟล์เดียว', 'A2 Agent Skills', 'A5 ข้อความ A2 โหลดตลอด'])
  + box(270, 70, 220, 110, ['เอเจนต์ Claude Sonnet 5', 'ทำโจทย์ 22 ข้อ', 'บนระบบจำลอง'], '#fff6e5', '#a0702a')
  + box(530, 40, 220, 170, ['ตัวแปรตาม', 'RCRc (ผลหลัก)', 'การทำงานสำเร็จ', 'ขอบเขต · ต้นทุน', 'การเรียก skill'])
  + arrow(230, 125, 268, 125) + arrow(490, 125, 528, 125)
  + box(120, 240, 520, 70, ['ตัวแปรควบคุม: โมเดล · ชุดเครื่องมือ · เวอร์ชัน CLI', 'สภาพเริ่มต้นของระบบ · ข้อความรอบตอบกลับ'], '#f1f1f1', '#777')));

const steps = ['รีเซ็ตระบบจำลอง', 'ติดตั้งกฎของกลุ่ม', 'วัดค่าตั้งต้น', 'รอบแรก', 'เก็บภาพรอบแรก', 'รอบตอบกลับ', 'วัดค่าปลายทาง', 'ตรวจสภาพ runtime', 'ให้คะแนน + บันทึก'];
let flow = defs;
steps.forEach((t, i) => {
  const col = i % 5, row = Math.floor(i / 5);
  const x = 6 + col * 151, y = 20 + row * 110;
  flow += box(x, y, 136, 60, [t]);
  if (i < steps.length - 1) {
    if (col < 4) flow += arrow(x + 136, y + 30, x + 150, y + 30);
    else flow += `<path d="M${x + 68},${y + 60} V${y + 85} H${6 + 68} V${y + 108}" fill="none" stroke="#555" stroke-width="1.5" marker-end="url(#a)"/>`;
  }
});
fs.writeFileSync(path.join(FIG, 'fig-run.svg'), svg(760, 210, flow));

// รูปผลหลัก: CI เทียบเกณฑ์
{
  const W = 760, H = 250, x0 = 200, x1 = 730, lo = -15, hi = 15;
  const X = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  let b = `<rect x="${X(-12.5)}" y="20" width="${X(12.5) - X(-12.5)}" height="${H - 70}" fill="#e8f3e8"/>`
    + `<line x1="${X(0)}" y1="20" x2="${X(0)}" y2="${H - 50}" stroke="#999" stroke-dasharray="4"/>`;
  for (const v of [-15, -10, -5, 0, 5, 10, 15]) b += `<text x="${X(v)}" y="${H - 30}" text-anchor="middle" font-size="14" ${FONT}>${v > 0 ? '+' : ''}${v}</text>`;
  b += `<text x="${(x0 + x1) / 2}" y="${H - 8}" text-anchor="middle" font-size="15" ${FONT}>ผลต่าง RCRc A2 − A1 (จุด) · แถบเขียว = เกณฑ์เทียบเท่า ±12.5</text>`;
  const rows = [['MAIN (ตามแผน)', sa.results.MAIN], ['SA-1 ตัวตรวจที่แก้', sa.results['SA-1']], ['SA-2 ตัด 4 โจทย์', sa.results['SA-2']]];
  rows.forEach(([label, r], i) => {
    const v = r.primary_A2_vs_A1, y = 55 + i * 55;
    b += `<text x="10" y="${y + 5}" font-size="16" ${FONT}>${label}</text>`
      + `<line x1="${X(v.ci95[0] * 100)}" y1="${y}" x2="${X(v.ci95[1] * 100)}" y2="${y}" stroke="#3b5b92" stroke-width="2"/>`
      + `<line x1="${X(v.ci90[0] * 100)}" y1="${y}" x2="${X(v.ci90[1] * 100)}" y2="${y}" stroke="#3b5b92" stroke-width="7"/>`
      + `<circle cx="${X(v.meanDiff * 100)}" cy="${y}" r="6" fill="#c0392b"/>`;
  });
  fs.writeFileSync(path.join(FIG, 'fig-primary.svg'), svg(W, H, b));
}

// รูปตัวชี้วัดรายกลุ่ม
{
  const arms = ['A0', 'A1', 'A2', 'A5'], mets = [['CRIT', 'ผ่าน critical ครบ'], ['SCOPE', 'อยู่ในขอบเขต'], ['RCRc', 'RCRc']];
  const colors = ['#9aa5b1', '#3b5b92', '#c0392b', '#e0a030'];
  const W = 760, H = 300, top = 20, base = 240, gw = 220;
  let b = '';
  for (const v of [0, 25, 50, 75, 100]) {
    const y = base - (v / 100) * (base - top);
    b += `<line x1="60" y1="${y}" x2="${W - 10}" y2="${y}" stroke="#e5e5e5"/><text x="52" y="${y + 5}" text-anchor="end" font-size="13" ${FONT}>${v}%</text>`;
  }
  mets.forEach(([m, label], gi) => {
    const gx = 80 + gi * gw;
    arms.forEach((a, ai) => {
      const val = n3.perArm[a][m] * 100, h = (val / 100) * (base - top), x = gx + ai * 45;
      b += `<rect x="${x}" y="${base - h}" width="38" height="${h}" fill="${colors[ai]}"/>`
        + `<text x="${x + 19}" y="${base - h - 4}" text-anchor="middle" font-size="12" ${FONT}>${val.toFixed(0)}</text>`;
    });
    b += `<text x="${gx + 88}" y="${base + 22}" text-anchor="middle" font-size="15" ${FONT}>${label}</text>`;
  });
  arms.forEach((a, ai) => { b += `<rect x="${250 + ai * 80}" y="${H - 22}" width="14" height="14" fill="${colors[ai]}"/><text x="${268 + ai * 80}" y="${H - 10}" font-size="14" ${FONT}>${a}</text>`; });
  fs.writeFileSync(path.join(FIG, 'fig-arms.svg'), svg(W, H, b));
}

// SVG → PNG ด้วย Edge แบบ headless (pandoc แปลง SVG เองไม่ได้ถ้าไม่มี rsvg-convert และ Word บางรุ่นไม่แสดง SVG)
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const pngOf = {};
for (const f of fs.readdirSync(FIG).filter((x) => x.endsWith('.svg'))) {
  if (!EDGE) break;
  const src = fs.readFileSync(path.join(FIG, f), 'utf8');
  const [, w, h] = src.match(/width="(\d+)" height="(\d+)"/);
  const html = path.join(FIG, f.replace('.svg', '.html'));
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0">${src}</body></html>`);
  const png = path.join(FIG, f.replace('.svg', '.png'));
  execFileSync(EDGE, ['--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
    `--window-size=${w},${h}`, `--screenshot=${png}`, 'file:///' + html.replace(/\\/g, '/')], { stdio: 'ignore' });
  // Edge คืนการทำงานก่อนเขียนไฟล์เสร็จ — รอสูงสุด 15 วินาที
  for (let i = 0; i < 60 && !fs.existsSync(png); i++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  if (fs.existsSync(png)) pngOf[f] = f.replace('.svg', '.png');
}

// ---------------------------------------------------------------- ภาคผนวก (จากไฟล์จริง)
const demote = (md, by) => md.replace(/^(#{1,5}) /gm, (m, h) => '#'.repeat(Math.min(6, h.length + by)) + ' ')
  .replace(/^(#+ .*?)(\s*\{\.unnumbered\})?$/gm, '$1');
const stripComments = (md) => md.replace(/<!--[\s\S]*?-->/g, '');
const fence = (txt) => '```text\n' + txt.replace(/```/g, "'''") + '\n```';

const scen = fs.readdirSync(path.join(ROOT, 'scenarios')).filter((f) => f.endsWith('.json')).sort()
  .map((f) => JSON.parse(rd(`scenarios/${f}`)));
let scenMd = '';
for (const s of scen) {
  scenMd += `### ${s.id}\n\n**ตระกูล:** ${s.family} · **ข้อกำหนดที่เกี่ยวข้อง:** ${(s.reqs ?? []).join(', ') || '—'}\n\n**คำสั่งที่เอเจนต์ได้รับ:** ${s.prompt.replace(/\n+/g, ' ')}\n\n`;
  scenMd += '| กฎ | ระดับ | คำอธิบาย |\n|---|---|---|\n' + s.rules.map((r) => `| ${r.id} | ${r.severity} | ${String(r.desc).replace(/\|/g, '/')} |`).join('\n') + '\n\n';
}
const skills = fs.readdirSync(path.join(ROOT, 'arms/A2/skills')).sort();
const appendix = [
  '# ภาคผนวก {.unnumbered}',
  '## ภาคผนวก ก แผนการวิเคราะห์ที่ประกาศล่วงหน้า (PRE-REGISTRATION-3)',
  '> คัดจาก `PRE-REGISTRATION-3.md` ณ git tag `study3-prereg` (commit 7fb3d1a) ตรงตามต้นฉบับ',
  demote(stripComments(rd('PRE-REGISTRATION-3.md')).replace(/^# .*\n/, '').replace(/^## ภาคผนวก ก — /m, '## ภาคผนวกของแผน — '), 1),
  '## ภาคผนวก ข บันทึกส่วนเบี่ยงเบนจากแผน (DEVIATIONS-3)',
  demote(stripComments(rd('DEVIATIONS-3.md')).replace(/^# .*\n/, ''), 1),
  '## ภาคผนวก ค ข้อความกฎของกลุ่มทดลอง',
  '> ข้อความของ A5 คือเนื้อความของ skill ทั้งสี่ตัวด้านล่างต่อกันเป็นไฟล์เดียว · A0 ไม่มีไฟล์ใด',
  '### ค.1 A1 — CLAUDE.md', fence(rd('arms/A1/CLAUDE.md')),
  '### ค.2 A2 — CLAUDE.md', fence(rd('arms/A2/CLAUDE.md')),
  ...skills.map((k, i) => `### ค.${i + 3} A2 — skill \`${k}\`\n\n${fence(rd(`arms/A2/skills/${k}/SKILL.md`))}`),
  '## ภาคผนวก ง โจทย์และกฎทั้ง 22 ข้อ', scenMd,
  '## ภาคผนวก จ ผลการทดลองชุดที่ 3 ฉบับเต็ม (สร้างจาก numbers.json)',
  demote(stripComments(rd('report/ch5c-results-study3.md')).replace(/^# .*\n/, '').replace(/^> ⚠️ \*\*ไฟล์นี้[\s\S]*?\n\n/m, ''), 1),
  '## ภาคผนวก ฉ ผลการทดลองชุดที่ 1 และชุดที่ 2',
  '### ฉ.1 ชุดที่ 1', demote(stripComments(rd('report/ch5-results.md')).replace(/^# .*\n/, '').replace(/^> ⚠️ \*\*ไฟล์นี้[\s\S]*?\n\n/m, ''), 2),
  '### ฉ.2 ชุดที่ 2', demote(stripComments(rd('report/ch5b-results-study2.md')).replace(/^# .*\n/, '').replace(/^> ⚠️ \*\*ไฟล์นี้[\s\S]*?\n\n/m, ''), 2),
  '## ภาคผนวก ช การทำซ้ำ',
  [
    'โค้ด ข้อมูล และประวัติทั้งหมดอยู่ที่ https://github.com/Teerapab149/skillbench (branch `main`)',
    '',
    '| ขั้นตอน | คำสั่ง |', '|---|---|',
    '| ติดตั้ง | Node.js 24 และ Claude Code CLI 2.1.224 · `node scripts/setup-fixtures.mjs` |',
    '| ตรวจเครื่องมือวัด | `npm test` · `npm run gate` · `npm run preflight:study3` |',
    '| เก็บข้อมูลชุดที่ 3 | `npm run main:study3` |',
    '| วิเคราะห์ผลหลัก | `npm run analyze:study3 -- --fallback-reps 3` |',
    '| วิเคราะห์ความไว | `node scripts/study3/sensitivity.mjs` |',
    '| สร้างบทผลและเล่ม | `npm run results:doc:study3` · `node scripts/report/build-book.mjs` |',
    '| แผนที่ล็อกไว้ | `git show study3-prereg:PRE-REGISTRATION-3.md` |',
  ].join('\n'),
].join('\n\n');

// ---------------------------------------------------------------- รวมและเรียงเลข
const parts = ['00-front.md', '01-introduction.md', '02-related-work.md', '03-design.md', '04-measurement.md',
  '05-results.md', '06-discussion.md', '07-conclusion.md'].map((f) => stripComments(fs.readFileSync(path.join(FINAL, f), 'utf8').replace(/\r\n/g, '\n')));
let body = parts.join('\n\n');

// ตาราง: เรียงเลขตามลำดับที่นิยาม แล้วแทนทุกการอ้างถึง
const tMap = new Map();
for (const m of body.matchAll(/^\*\*ตารางที่ ([0-9]+ก?)\*\* /gm)) if (!tMap.has(m[1])) tMap.set(m[1], String(tMap.size + 1));
// รูป: placeholder ในรูปแบบ > **[รูปที่ n ชื่อ]** คำอธิบาย
const fMap = new Map();
for (const m of body.matchAll(/^> \*\*\[รูปที่ ([0-9]+) /gm)) if (!fMap.has(m[1])) fMap.set(m[1], String(fMap.size + 1));
const tok = (s, map, word) => s.replace(new RegExp(`${word} ([0-9]+ก?)(?![0-9])`, 'g'), (m, k) => (map.has(k) ? `${word} \u0000${map.get(k)}` : m));
body = tok(body, tMap, 'ตารางที่');
body = tok(body, fMap, 'รูปที่');
body = body.replace(/\u0000/g, '');

// คำบรรยายตาราง → caption ของ pandoc (อยู่เหนือตาราง)
body = body.replace(/^\*\*ตารางที่ ([0-9]+)\*\* (.+)\n\n((?:\|.*\n)+)/gm, (m, k, cap, tbl) => `${tbl}\nTable: **ตารางที่ ${k}** ${cap}\n`);

// รูป: ใช้ไฟล์ SVG ที่สร้างได้ ที่เหลือคงเป็นกล่องบอกตำแหน่งให้ผู้วิจัยใส่ภาพ
const figFile = { 'กรอบแนวคิดการวิจัย': 'fig-framework.svg', 'ขั้นตอนของหนึ่ง run': 'fig-run.svg',
  'ผลต่าง A2 − A1 กับเกณฑ์เทียบเท่า': 'fig-primary.svg', 'ตัวชี้วัดรายกลุ่ม': 'fig-arms.svg' };
body = body.replace(/^> \*\*\[รูปที่ ([0-9]+) ([^\]]+)\]\*\*(.*)$/gm, (m, k, title, rest) => {
  const f = figFile[title.trim()];
  if (f) return `![รูปที่ ${k} ${title.trim()}](figures/${pngOf[f] ?? f}){width=100%}`;
  return `::: {custom-style="Block Text"}\n[ตำแหน่งรูปที่ ${k} ${title.trim()} — ผู้วิจัยใส่ภาพ]${rest}\n:::\n\n::: {custom-style="Image Caption"}\nรูปที่ ${k} ${title.trim()}\n:::`;
});

const refs = stripComments(fs.readFileSync(path.join(FINAL, '08-references.md'), 'utf8').replace(/\r\n/g, '\n'));
/*
 * จุดตัดคำภาษาไทย — ใส่ zero-width space (U+200B) ระหว่างคำไทย
 * Word ตัดคำไทยได้เฉพาะเมื่อเครื่องเปิดภาษาไทยในการแก้ไข ถ้าไม่เปิด บรรทัดจะขึ้นใหม่ได้แค่ตรงช่องว่าง
 * แล้วการกระจายแบบไทยจะยืดตัวอักษรห่าง · ใช้ตัวตัดคำของ ICU ใน Node ทำให้ผลเหมือนกันทุกเครื่อง
 * ข้ามบล็อกโค้ดและ raw openxml
 */
const seg = new Intl.Segmenter('th', { granularity: 'word' });
function thaiBreaks(md) {
  const out = [];
  let inFence = false;
  for (const line of md.split('\n')) {
    if (/^(```|~~~)/.test(line)) { inFence = !inFence; out.push(line); continue; }
    if (inFence || line.startsWith('<w:')) { out.push(line); continue; }
    out.push(line.replace(/[฀-๿]{2,}/g, (run) => [...seg.segment(run)].map((x) => x.segment).join('​')));
  }
  return out.join('\n');
}
const book = thaiBreaks(`${body}\n\n${refs}\n\n${appendix}\n`);
fs.writeFileSync(path.join(BUILD, 'book.md'), book);

const PANDOC = process.env.PANDOC ?? path.join(process.env.LOCALAPPDATA ?? '', 'Pandoc', 'pandoc.exe');
// เขียนลง build/ ก่อนเสมอ (ไฟล์ปลายทางอาจเปิดค้างใน Word) · build.ps1 จัดหน้าแล้วบันทึกเป็นไฟล์ปลายทาง
const out = path.join(BUILD, 'book.docx');
execFileSync(PANDOC, ['book.md', '-f', 'markdown+pipe_tables+fenced_divs+raw_attribute', '-o', out,
  '--reference-doc', 'reference.docx', '--resource-path', BUILD, '-M', 'lang=th-TH'], { cwd: BUILD, stdio: 'inherit' });
fs.writeFileSync(path.join(BUILD, 'final-path.txt'), path.join(FINAL, 'รายงานฉบับสมบูรณ์-477-401.docx'));
console.log(`ตาราง ${tMap.size} · รูป ${fMap.size} · ${path.relative(ROOT, out)}`);
