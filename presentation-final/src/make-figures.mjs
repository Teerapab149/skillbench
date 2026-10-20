// ภาพสำหรับสไลด์ final ขนาด 16:9 ตัวอักษรใหญ่สำหรับฉายจอ
// ตัวเลขทุกตัวอ่านจาก results-study3/numbers.json และ sensitivity.json ไม่มีตัวเลขผลการทดลองที่พิมพ์ด้วยมือ
// ยกเว้นภาพประกอบหน้า problem ซึ่งเป็นภาพอธิบายแนวคิด (อัตรา 20 และ 25 บาทมาจาก scenarios/S09-rate-change.json)
// สไลด์ย่อภาพลงราว 0.65 เท่า ป้ายทุกตัวจึงใช้ขนาดไม่ต่ำกว่า 38 เพื่อให้ได้ราว 25px บนจอ
//
//   node presentation-final/src/make-figures.mjs
//
// ได้ไฟล์ .svg และ .png (2 เท่า) ใน presentation-final/figures/
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '../..');
const OUT = path.join(ROOT, 'presentation-final/figures');
fs.mkdirSync(OUT, { recursive: true });

const n = JSON.parse(fs.readFileSync(path.join(ROOT, 'results-study3/numbers.json'), 'utf8'));
const sens = JSON.parse(fs.readFileSync(path.join(ROOT, 'results-study3/sensitivity.json'), 'utf8'));
const s09 = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenarios/S09-rate-change.json'), 'utf8'));

const W = 1600, H = 900;
const FONT = 'DB ChuanPim PSU, TH Sarabun New, Tahoma, sans-serif';
const C = { A0: '#9aa3ad', A1: '#3b5b92', A2: '#c0392b', A5: '#e0a030', ink: '#1f2937', mute: '#5a6070', band: '#e3f1e3', bandEdge: '#7fb77f', bad: '#c0392b' };
// ชื่อกลุ่มบนภาพใช้ชื่อเดียวกับสไลด์ question
const ARM_LABEL_TH = { A0: 'ไม่มีกฎ', A1: 'ไฟล์เดียว', A2: 'Agent Skills', A5: 'Skills แบบอ่านทุกครั้ง' };
const ARM_LABEL_EN = { A0: 'No rules', A1: 'One file', A2: 'Agent Skills', A5: 'Skills, always loaded' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, o = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${o.size ?? 40}" fill="${o.fill ?? C.ink}"` +
  ` text-anchor="${o.anchor ?? 'start'}" font-weight="${o.weight ?? 400}">${esc(s)}</text>`;
const svg = (body, h = H) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">` +
  `<rect width="100%" height="100%" fill="#fff"/>${body}</svg>`;
const pct = (v) => (v * 100).toFixed(1);
const pts = (v) => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1);
const tick = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');

// node make-figures.mjs --en ได้ภาพภาษาอังกฤษ ชื่อไฟล์ลงท้าย -en
const EN = process.argv.includes('--en');
const L = (th, en) => (EN ? en : th);
const figs = {};

// หน้า problem: ใบแจ้งหนี้ก่อนและหลัง
{
  const [, from, to] = s09.prompt.match(/จาก\s*(\d+)\s*บาทเป็น\s*(\d+)/).map(Number);
  const hours = 10; // สมมติเพื่ออธิบาย ไม่ใช่ข้อมูลจาก fixture (บอกไว้ใน footer ของสไลด์)
  const card = (x, title, sub, rate, color, note) => {
    let b = `<rect x="${x}" y="250" width="560" height="440" rx="18" fill="#fff" stroke="${color}" stroke-width="4"/>`;
    b += t(x + 40, 320, title, { size: 40, weight: 700 });
    b += t(x + 40, 368, sub, { size: 32, fill: C.mute });
    b += `<line x1="${x + 40}" y1="395" x2="${x + 520}" y2="395" stroke="#ddd" stroke-width="2"/>`;
    b += t(x + 40, 455, L('เครื่อง V100', 'V100 machine'), { size: 36 });
    b += t(x + 520, 455, L(`${hours} ชม.`, `${hours} hours`), { size: 36, anchor: 'end' });
    b += t(x + 40, 510, L('อัตรา', 'Rate'), { size: 36 });
    b += t(x + 520, 510, L(`${rate} บาท/ชม.`, `${rate} baht/hour`), { size: 36, anchor: 'end', fill: color, weight: 700 });
    b += `<line x1="${x + 40}" y1="545" x2="${x + 520}" y2="545" stroke="#ddd" stroke-width="2"/>`;
    b += t(x + 40, 610, L('ยอดรวม', 'Total'), { size: 40, weight: 700 });
    b += t(x + 520, 610, L(`${hours * rate} บาท`, `${hours * rate} baht`), { size: 52, anchor: 'end', fill: color, weight: 700 });
    b += t(x + 280, 668, note, { size: 30, fill: color, anchor: 'middle' });
    return b;
  };
  let b = '';
  b += `<rect x="100" y="60" width="1400" height="110" rx="55" fill="#eef2f8"/>`;
  b += t(800, 130, L(`“${s09.prompt}”`, `“Please change the V100 rate from ${from} baht to ${to} baht per hour, as announced.”`), { size: 34, anchor: 'middle' });
  b += card(160, L('ใบแจ้งหนี้เดือนที่แล้ว', 'Last month invoice'), L('ออกให้ลูกค้าไปแล้ว', 'Already sent to the customer'), from, C.A1, L('ยอดที่ลูกค้าจ่ายไปแล้ว', 'What the customer already paid'));
  b += card(880, L('ใบแจ้งหนี้ใบเดิม', 'The same invoice'), L('หลัง AI แก้อัตรา', 'After the AI changed the rate'), to, C.bad, L('เปลี่ยนเอง และไม่มีใครบอก', 'Changed, and nobody was told'));
  b += `<path d="M 735 470 L 860 470" stroke="${C.ink}" stroke-width="6" marker-end="url(#ah)"/>`;
  b += `<defs><marker id="ah" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${C.ink}"/></marker></defs>`;
  b += t(800, 790, L('ระบบคำนวณใบแจ้งหนี้จากอัตราปัจจุบัน แก้อัตราถูก แต่ยอดย้อนหลังเปลี่ยนตาม', 'Invoices use the current rate, so old totals change too'), { size: 38, anchor: 'middle', weight: 700 });
  figs['fig-s2-invoice'] = svg(b);
}

// หน้า result: ผลหลักแถวเดียว
{
  const p = n.primary, d = p.decision;
  const margin = d.margin;
  const x0 = 120, x1 = 1480, lo = -0.15, hi = 0.15;
  const X = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  const yRow = 420, bandTop = 250, bandBot = 600;
  const ceiling = 1 - p.rateB; // Skills นำไฟล์เดียวได้มากสุดเท่านี้
  let b = '';
  b += t(800, 78, L(`Agent Skills ${pct(p.rateA)}%   ไฟล์เดียว ${pct(p.rateB)}%`, `Agent Skills ${pct(p.rateA)}%   One file ${pct(p.rateB)}%`), { size: 56, anchor: 'middle', weight: 700 });
  b += t(800, 140, L('ผลต่างคะแนนทำตามกฎ Agent Skills ลบไฟล์เดียว (จุด)', 'Rule-following score, Agent Skills minus one file (points)'), { size: 40, anchor: 'middle', fill: C.mute });
  b += `<rect x="${X(-margin)}" y="${bandTop}" width="${X(margin) - X(-margin)}" height="${bandBot - bandTop}" fill="${C.band}"/>`;
  b += `<line x1="${X(-margin)}" y1="${bandTop}" x2="${X(-margin)}" y2="${bandBot}" stroke="${C.bandEdge}" stroke-width="3"/>`;
  b += `<line x1="${X(margin)}" y1="${bandTop}" x2="${X(margin)}" y2="${bandBot}" stroke="${C.bandEdge}" stroke-width="3"/>`;
  b += t(X(0), 225, L(`แถบเขียว คือเกณฑ์เทียบเท่า ±${(margin * 100).toFixed(1)} จุด ที่ตั้งไว้ก่อนเก็บข้อมูล`, `Green band: equivalence margin ±${(margin * 100).toFixed(1)} points, set in advance`), { size: 40, anchor: 'middle', fill: '#2f6b3a', weight: 700 });
  b += `<line x1="${X(0)}" y1="${bandTop}" x2="${X(0)}" y2="${bandBot}" stroke="#888" stroke-width="2" stroke-dasharray="8 8"/>`;
  // เพดาน
  b += `<line x1="${X(ceiling)}" y1="${bandTop}" x2="${X(ceiling)}" y2="${bandBot}" stroke="${C.mute}" stroke-width="3" stroke-dasharray="3 7"/>`;
  b += t(X(ceiling) + 16, 300, L(`นำได้มากสุด ${pts(ceiling)}`, `Max possible lead ${pts(ceiling)}`), { size: 38, fill: C.mute });
  // ช่วงความเชื่อมั่น: แถบหนา 90% ใช้ตัดสิน เส้นบาง 95%
  b += `<line x1="${X(d.ci95[0])}" y1="${yRow}" x2="${X(d.ci95[1])}" y2="${yRow}" stroke="${C.ink}" stroke-width="5"/>`;
  b += `<line x1="${X(d.ci90[0])}" y1="${yRow}" x2="${X(d.ci90[1])}" y2="${yRow}" stroke="${C.ink}" stroke-width="20" stroke-linecap="butt"/>`;
  b += `<circle cx="${X(p.diff)}" cy="${yRow}" r="18" fill="#fff" stroke="${C.ink}" stroke-width="6"/>`;
  b += t(X(p.diff), yRow - 44, L(`${pts(p.diff)} จุด`, `${pts(p.diff)} points`), { size: 52, anchor: 'middle', weight: 700 });
  b += `<rect x="${X(0) - 380}" y="${yRow + 40}" width="760" height="110" rx="8" fill="#fff" fill-opacity="0.9"/>`;
  b += t(X(0), yRow + 86, L(`แถบหนา ช่วง 90% [${pts(d.ci90[0])}, ${pts(d.ci90[1])}] ใช้ตัดสิน`, `Thick bar: 90% CI [${pts(d.ci90[0])}, ${pts(d.ci90[1])}], used to decide`), { size: 38, anchor: 'middle', weight: 700 });
  b += t(X(0), yRow + 134, L(`เส้นบาง ช่วง 95% [${pts(d.ci95[0])}, ${pts(d.ci95[1])}]`, `Thin line: 95% CI [${pts(d.ci95[0])}, ${pts(d.ci95[1])}]`), { size: 38, anchor: 'middle', fill: C.mute });
  // แกน
  for (let v = -15; v <= 15; v += 5) b += t(X(v / 100), 650, tick(v), { size: 38, anchor: 'middle', fill: C.mute });
  b += t(x0, 712, L('ไฟล์เดียวดีกว่า', 'One file better'), { size: 40, fill: C.mute });
  b += t(x1, 712, L('Agent Skills ดีกว่า', 'Agent Skills better'), { size: 40, fill: C.mute, anchor: 'end' });
  b += t(800, 830, L(`${p.k} โจทย์ Skills ได้มากกว่า ${p.wins} ข้อ น้อยกว่า ${p.losses} ข้อ เท่ากัน ${p.ties} ข้อ (p = ${p.p.toFixed(3)})`, `${p.k} tasks: Skills higher on ${p.wins}, lower on ${p.losses}, tied on ${p.ties} (p = ${p.p.toFixed(3)})`), { size: 40, anchor: 'middle', fill: C.ink });
  figs['fig-s8-primary'] = svg(b);
}

// หน้า rules-matter: มีกฎกับไม่มีกฎ (ข้อสังเกตเพิ่ม)
{
  const arms = ['A0', 'A1', 'A2', 'A5'];
  const metrics = [['CRIT', L('ผ่านกฎสำคัญครบทุกข้อ', 'Passed every critical rule')], ['SCOPE', L('แก้ไฟล์อยู่ในขอบเขตงาน', 'Edited only in-scope files')]];
  const top = 110, bottom = 640, Y = (v) => bottom - v * (bottom - top);
  const barW = 136, gap = 18, groupW = 4 * barW + 3 * gap, gx0 = 170, groupGap = 140;
  let b = '';
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    b += `<line x1="150" y1="${Y(v)}" x2="1560" y2="${Y(v)}" stroke="#e5e7eb" stroke-width="2"/>`;
    b += t(135, Y(v) + 13, `${v * 100}%`, { size: 36, anchor: 'end', fill: C.mute });
  }
  metrics.forEach(([key, label], gi) => {
    const gx = gx0 + gi * (groupW + groupGap);
    arms.forEach((a, i) => {
      const v = n.perArm[a][key];
      const x = gx + i * (barW + gap);
      b += `<rect x="${x}" y="${Y(v)}" width="${barW}" height="${bottom - Y(v)}" fill="${C[a]}"/>`;
      b += t(x + barW / 2, Y(v) - 16, pct(v), { size: 44, anchor: 'middle', weight: 700 });
    });
    b += t(gx + groupW / 2, bottom + 64, label, { size: 44, anchor: 'middle', weight: 700 });
  });
  const legendX = [150, 420, 730, 1080];
  arms.forEach((a, i) => {
    b += `<rect x="${legendX[i]}" y="800" width="36" height="36" fill="${C[a]}"/>`;
    b += t(legendX[i] + 50, 832, (EN ? ARM_LABEL_EN : ARM_LABEL_TH)[a], { size: 40 });
  });
  // หัวเรื่องและป้าย "ข้อสังเกตเพิ่ม" อยู่ที่หัวสไลด์แล้ว ไม่พิมพ์ซ้ำในภาพ
  figs['fig-s9-rules'] = svg(b);
}

// สำรอง B1: นับใหม่สองแบบ
{
  const rows = [['MAIN', L('ตามแผน', 'As planned')], ['SA-1', L('แก้ตัวตรวจและผ่อนเกณฑ์', 'Fixed checkers, relaxed rule')], ['SA-2', L('ตัดโจทย์ที่มีปัญหา 4 ข้อ', 'Dropped 4 affected tasks')]];
  const margin = sens.margin, lo = -0.15, hi = 0.15, x0 = 640, x1 = 1540;
  const X = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  const h = 420, top = 60, rowH = 100;
  let b = `<rect x="${X(-margin)}" y="${top - 30}" width="${X(margin) - X(-margin)}" height="${rows.length * rowH + 10}" fill="${C.band}"/>`;
  b += `<line x1="${X(0)}" y1="${top - 30}" x2="${X(0)}" y2="${top + rows.length * rowH - 20}" stroke="#888" stroke-dasharray="8 8" stroke-width="2"/>`;
  rows.forEach(([k, label], i) => {
    const r = sens.results[k].primary_A2_vs_A1, y = top + i * rowH + 20;
    b += t(40, y + 12, `${k} ${label}`, { size: 36, weight: i ? 400 : 700 });
    b += `<line x1="${X(r.ci95[0])}" y1="${y}" x2="${X(r.ci95[1])}" y2="${y}" stroke="${C.ink}" stroke-width="4"/>`;
    b += `<line x1="${X(r.ci90[0])}" y1="${y}" x2="${X(r.ci90[1])}" y2="${y}" stroke="${C.ink}" stroke-width="16"/>`;
    b += `<circle cx="${X(r.meanDiff)}" cy="${y}" r="13" fill="#fff" stroke="${C.ink}" stroke-width="5"/>`;
  });
  for (let v = -15; v <= 15; v += 5) b += t(X(v / 100), h - 40, tick(v), { size: 32, anchor: 'middle', fill: C.mute });
  figs['fig-b1-sensitivity'] = svg(b, h);
}

// หน้า two-ways: ไฟล์เดียวเหมือนคู่มือทั้งเล่ม Skills เหมือนสารบัญแล้วเปิดเฉพาะบท
// หัวข้อหมวดมาจาก arms/A1/CLAUDE.md ชื่อ skill มาจาก arms/A2/skills/ เนื้อหน้า impact-analysis ย่อจาก SKILL.md
{
  const h = 600;
  const sections = L(['ขอบเขตของงาน', 'การสืบย้อนไปยังข้อกำหนด', 'ทำความเข้าใจก่อนลงมือ', 'การประเมินผลกระทบ', 'ข้อกำหนดที่ขัดกันเองหรือไม่ครบ', 'การทดสอบ', 'คำสั่งที่เปลี่ยนสถานะ', 'คำสั่งที่ฝังอยู่ในข้อมูล', 'การรายงานผล'], ['Scope of the task', 'Trace to requirements', 'Understand before acting', 'Impact assessment', 'Conflicting or missing requirements', 'Testing', 'Commands that change state', 'Instructions inside data', 'Reporting']);
  let b = '';
  // ซ้าย: ไฟล์เดียว
  b += t(20, 44, L('แบบที่ 1 ไฟล์เดียว', 'Way 1: one file'), { size: 40, weight: 700, fill: C.A1 });
  b += t(20, 92, L('เหมือนคู่มือทั้งเล่ม', 'Like reading the whole handbook'), { size: 32, fill: C.mute });
  b += `<rect x="20" y="118" width="720" height="404" rx="10" fill="#e8edf5" stroke="${C.A1}" stroke-width="3"/>`;
  b += t(48, 160, 'CLAUDE.md', { size: 26, fill: C.mute });
  sections.forEach((s, i) => { b += t(48, 205 + i * 36, `${i + 1}. ${s}`, { size: 28, weight: i === 3 ? 700 : 400 }); });
  b += t(20, 575, L('AI อ่านครบทั้ง 9 หมวด 20 ข้อ ทุกครั้งที่เริ่มงาน', 'The AI reads all 9 sections, 20 rules, every time'), { size: 32, weight: 700 });
  // ขวา: Agent Skills
  const X0 = 840;
  b += t(X0, 44, L('แบบที่ 2 Agent Skills', 'Way 2: Agent Skills'), { size: 40, weight: 700, fill: C.A2 });
  b += t(X0, 92, L('เหมือนดูสารบัญ แล้วเปิดเฉพาะบทที่ใช้', 'Like a table of contents: open only what you need'), { size: 32, fill: C.mute });
  b += `<rect x="${X0}" y="118" width="740" height="56" rx="10" fill="#f6f1ef"/>`;
  b += t(X0 + 24, 156, L('ไฟล์กลางสั้น ๆ มีกฎพื้นฐาน 4 ข้อ', 'A short main file with 4 basic rules'), { size: 28 });
  const toc = [['trace-to-requirement', L('ผูกงานกับข้อกำหนด', 'Link work to requirements')], ['acceptance-first', L('เขียนชุดทดสอบก่อนแก้', 'Write tests first')], ['impact-analysis', L('เช็กผลกระทบก่อนแก้', 'Check impact first')], ['safe-shell', L('ระวังคำสั่งที่เปลี่ยนระบบ', 'Careful with risky commands')]];
  toc.forEach(([name, desc], i) => {
    const y = 190 + i * 84, open = name === 'impact-analysis';
    b += `<rect x="${X0}" y="${y}" width="350" height="72" rx="8" fill="${open ? '#f3e3df' : '#f4f4f4'}" stroke="${open ? C.A2 : '#dddddd'}" stroke-width="${open ? 3 : 2}"/>`;
    b += `<text x="${X0 + 18}" y="${y + 30}" font-family="IBM Plex Mono, Consolas, monospace" font-size="22" fill="${open ? C.ink : C.mute}">${name}</text>`;
    b += t(X0 + 18, y + 60, desc, { size: 24, fill: open ? C.ink : C.mute });
  });
  // หน้าที่เปิดอ่าน
  const px = X0 + 380, py = 190;
  b += `<line x1="${X0 + 350}" y1="${190 + 2 * 84 + 36}" x2="${px}" y2="${190 + 2 * 84 + 36}" stroke="${C.A2}" stroke-width="3"/>`;
  b += `<rect x="${px}" y="${py}" width="360" height="324" rx="10" fill="#fff" stroke="${C.A2}" stroke-width="3"/>`;
  const page = L([['ประเมินผลกระทบก่อนแก้', 700], ['รันรายงานรายได้ก่อนและหลัง', 400], ['ถ้าตัวเลขเปลี่ยน ต้องบอก', 400], ['ตัวเลขก่อนและหลัง', 400], ['ใบแจ้งหนี้เก่าเปลี่ยน', 400], ['ทางที่ไม่กระทบข้อมูลเดิม', 400]], [['Assess impact first', 700], ['Run revenue report twice', 400], ['If numbers change, say:', 400], ['before and after values', 400], ['old invoices changed', 400], ['a safer option', 400]]);
  page.forEach(([s, w], i) => { b += t(px + 22, py + 46 + i * 48, (i >= 3 ? '- ' : '') + s, { size: 25, weight: w }); });
  b += t(X0, 575, L('อ่านสารบัญทุกงาน แล้วเปิดเต็มเฉพาะชุดที่เกี่ยว', 'Opens only the topic the task needs'), { size: 32, weight: 700 });
  figs['fig-two-ways'] = svg(b, h);
}

// หน้า result แบบง่ายสำหรับคนทั่วไป: ไม้บรรทัดแถบเดียว ไม่มีช่วง 95% และค่า p (อยู่ในบทพูดและสไลด์สำรอง)
{
  const p = n.primary, d = p.decision, margin = d.margin;
  const h = 640, x0 = 110, x1 = 1490, lo = -0.15, hi = 0.15;
  const X = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  let b = '';
  // คะแนนสองกลุ่ม
  b += t(560, 80, L('ไฟล์เดียว', 'One file'), { size: 40, anchor: 'middle', fill: C.A1, weight: 700 });
  b += t(560, 160, `${pct(p.rateB)}`, { size: 84, anchor: 'middle', fill: C.A1, weight: 700 });
  b += t(1040, 80, 'Agent Skills', { size: 40, anchor: 'middle', fill: C.A2, weight: 700 });
  b += t(1040, 160, `${pct(p.rateA)}`, { size: 84, anchor: 'middle', fill: C.A2, weight: 700 });
  b += t(800, 218, L('คะแนนทำตามกฎเต็ม 100', 'Rule-following score out of 100'), { size: 32, anchor: 'middle', fill: C.mute });
  // ไม้บรรทัด
  const top = 290, bot = 450, mid = 380;
  b += `<rect x="${X(lo)}" y="${top}" width="${X(-margin) - X(lo)}" height="${bot - top}" fill="#f1f1f1"/>`;
  b += `<rect x="${X(margin)}" y="${top}" width="${X(hi) - X(margin)}" height="${bot - top}" fill="#f1f1f1"/>`;
  b += `<rect x="${X(-margin)}" y="${top}" width="${X(margin) - X(-margin)}" height="${bot - top}" fill="${C.band}" stroke="${C.bandEdge}" stroke-width="3"/>`;
  b += t(X(0), top + 42, L(`โซนพอ ๆ กัน (ต่างไม่เกิน ${(margin * 100).toFixed(1)}) ตั้งไว้ก่อนเริ่ม`, `Equivalence zone (within ${(margin * 100).toFixed(1)}), set before the study`), { size: 34, anchor: 'middle', fill: '#2f6b3a', weight: 700 });
  b += `<line x1="${X(0)}" y1="${top + 60}" x2="${X(0)}" y2="${bot}" stroke="#888" stroke-width="2" stroke-dasharray="8 8"/>`;
  b += `<line x1="${X(d.ci90[0])}" y1="${mid + 20}" x2="${X(d.ci90[1])}" y2="${mid + 20}" stroke="${C.ink}" stroke-width="18"/>`;
  b += `<circle cx="${X(p.diff)}" cy="${mid + 20}" r="17" fill="#fff" stroke="${C.ink}" stroke-width="6"/>`;
  // แกน
  for (const v of [-10, -5, 0, 5, 10]) b += t(X(v / 100), bot + 46, tick(v), { size: 34, anchor: 'middle', fill: C.mute });
  b += t(X(lo) + 10, bot + 100, L('ไฟล์เดียวดีกว่าชัด', 'One file clearly better'), { size: 34, fill: C.mute });
  b += t(X(hi) - 10, bot + 100, L('Skills ดีกว่าชัด', 'Skills clearly better'), { size: 34, fill: C.mute, anchor: 'end' });
  b += t(800, bot + 160, L(`Skills ได้มากกว่า ${(p.diff*100).toFixed(1)} คะแนน ช่วงความเชื่อมั่น 90% ${pts(d.ci90[0])} ถึง ${pts(d.ci90[1])}`, `Skills scored ${(p.diff*100).toFixed(1)} points higher. 90% confidence interval: ${pts(d.ci90[0])} to ${pts(d.ci90[1])}`), { size: 34, anchor: 'middle', weight: 700 });
  figs['fig-result-simple'] = svg(b, h);
}

// เขียนไฟล์ และทำ PNG ด้วย Edge headless (วิธีเดียวกับ scripts/report/build-book.mjs)
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
for (let [name, src] of Object.entries(figs)) {
  if (EN) name += '-en';
  fs.writeFileSync(path.join(OUT, `${name}.svg`), src);
  if (!EDGE) continue;
  const h = Number(src.match(/height="(\d+)"/)[1]);
  const html = path.join(OUT, `${name}.html`);
  const png = path.join(OUT, `${name}.png`);
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0">${src}</body></html>`);
  if (fs.existsSync(png)) fs.rmSync(png);
  execFileSync(EDGE, ['--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
    `--window-size=${W},${h}`, `--screenshot=${png}`, 'file:///' + html.replace(/\\/g, '/')], { stdio: 'ignore' });
  for (let i = 0; i < 60 && !fs.existsSync(png); i++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  fs.rmSync(html);
  console.log(fs.existsSync(png) ? `ok ${name}.png` : `missing ${name}.png (Edge ไม่ได้เขียนไฟล์)`);
}
if (!EDGE) console.log('ไม่พบ Edge จึงได้แค่ .svg');
