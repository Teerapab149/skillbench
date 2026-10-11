// ภาพสำหรับสไลด์ final · ขนาด 16:9 ตัวอักษรใหญ่สำหรับฉายจอ
// ตัวเลขทุกตัวอ่านจาก results-study3/numbers.json — ไม่มีตัวเลขผลการทดลองที่พิมพ์ด้วยมือ
// ยกเว้นภาพประกอบสไลด์ 2 ซึ่งเป็นภาพอธิบายแนวคิด (อัตรา 20→25 บาทมาจาก scenarios/S09-rate-change.json)
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
const s09 = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenarios/S09-rate-change.json'), 'utf8'));

const W = 1600, H = 900;
const FONT = 'DB ChuanPim PSU, TH Sarabun New, Tahoma, sans-serif';
const C = { A0: '#9aa3ad', A1: '#3b5b92', A2: '#c0392b', A5: '#e0a030', ink: '#1f2937', mute: '#6b7280', band: '#e3f1e3', bandEdge: '#7fb77f', bad: '#c0392b' };
const ARM_LABEL = { A0: 'A0 ไม่มีกฎ', A1: 'A1 ไฟล์เดียว', A2: 'A2 Agent Skills', A5: 'A5 ข้อความ A2 โหลดตลอด' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, o = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${o.size ?? 32}" fill="${o.fill ?? C.ink}"` +
  ` text-anchor="${o.anchor ?? 'start'}" font-weight="${o.weight ?? 400}">${esc(s)}</text>`;
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
  `<rect width="100%" height="100%" fill="#fff"/>${body}</svg>`;
const pct = (v) => (v * 100).toFixed(1);
const pts = (v) => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1);

const figs = {};

// ── สไลด์ 2 · ใบแจ้งหนี้ก่อน/หลัง ────────────────────────────────────────────
{
  const [, from, to] = s09.prompt.match(/จาก\s*(\d+)\s*บาทเป็น\s*(\d+)/).map(Number);
  const hours = 10; // สมมติเพื่ออธิบาย — ไม่ใช่ข้อมูลจาก fixture
  const card = (x, title, sub, rate, color, note) => {
    let b = `<rect x="${x}" y="250" width="560" height="440" rx="18" fill="#fff" stroke="${color}" stroke-width="4"/>`;
    b += t(x + 40, 320, title, { size: 40, weight: 700 });
    b += t(x + 40, 365, sub, { size: 28, fill: C.mute });
    b += `<line x1="${x + 40}" y1="395" x2="${x + 520}" y2="395" stroke="#ddd" stroke-width="2"/>`;
    b += t(x + 40, 455, 'เครื่อง V100', { size: 34 });
    b += t(x + 520, 455, `${hours} ชม.`, { size: 34, anchor: 'end' });
    b += t(x + 40, 510, 'อัตรา', { size: 34 });
    b += t(x + 520, 510, `${rate} บาท/ชม.`, { size: 34, anchor: 'end', fill: color, weight: 700 });
    b += `<line x1="${x + 40}" y1="545" x2="${x + 520}" y2="545" stroke="#ddd" stroke-width="2"/>`;
    b += t(x + 40, 610, 'ยอดรวม', { size: 40, weight: 700 });
    b += t(x + 520, 610, `${hours * rate} บาท`, { size: 52, anchor: 'end', fill: color, weight: 700 });
    b += t(x + 280, 665, note, { size: 26, fill: color, anchor: 'middle' });
    return b;
  };
  let b = '';
  b += `<rect x="100" y="60" width="1400" height="110" rx="55" fill="#eef2f8"/>`;
  b += t(800, 130, `“${s09.prompt}”`, { size: 34, anchor: 'middle' });
  b += card(160, 'ใบแจ้งหนี้เดือนที่แล้ว', 'ออกให้ลูกค้าไปแล้ว', from, C.A1, 'ยอดที่ลูกค้าจ่ายไปแล้ว');
  b += card(880, 'ใบแจ้งหนี้ใบเดิม', 'หลัง AI แก้อัตรา', to, C.bad, 'เปลี่ยนเอง · AI ไม่ได้บอกใคร');
  b += `<path d="M 735 470 L 860 470" stroke="${C.ink}" stroke-width="6" marker-end="url(#ah)"/>`;
  b += `<defs><marker id="ah" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${C.ink}"/></marker></defs>`;
  b += t(800, 770, 'ระบบคำนวณใบแจ้งหนี้จากอัตราปัจจุบัน — แก้อัตราถูก แต่ยอดย้อนหลังเปลี่ยนตาม', { size: 34, anchor: 'middle', weight: 700 });
  b += t(800, 830, `ภาพอธิบายจากโจทย์ S09 · อัตรา ${from}→${to} บาทจากโจทย์จริง · จำนวนชั่วโมงสมมติ`, { size: 24, anchor: 'middle', fill: C.mute });
  figs['fig-s2-invoice'] = svg(b);
}

// ── สไลด์ 8 · ผลหลักแถวเดียว ──────────────────────────────────────────────
{
  const p = n.primary, d = p.decision;
  const margin = d.margin;
  const x0 = 140, x1 = 1460, lo = -0.15, hi = 0.15;
  const X = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  const yRow = 430;
  const ceiling = 1 - p.rateB; // A2 นำ A1 ได้มากสุดเท่านี้
  let b = '';
  b += `<rect x="${X(-margin)}" y="230" width="${X(margin) - X(-margin)}" height="330" fill="${C.band}"/>`;
  b += `<line x1="${X(-margin)}" y1="230" x2="${X(-margin)}" y2="560" stroke="${C.bandEdge}" stroke-width="3"/>`;
  b += `<line x1="${X(margin)}" y1="230" x2="${X(margin)}" y2="560" stroke="${C.bandEdge}" stroke-width="3"/>`;
  b += t(X(0), 210, `แถบเขียว = เกณฑ์เทียบเท่า ±${(margin * 100).toFixed(1)} จุด (ประกาศไว้ก่อนเก็บข้อมูล)`, { size: 30, anchor: 'middle', fill: '#3d7a3d', weight: 700 });
  b += `<line x1="${X(0)}" y1="230" x2="${X(0)}" y2="560" stroke="#888" stroke-width="2" stroke-dasharray="8 8"/>`;
  // เพดาน
  b += `<line x1="${X(ceiling)}" y1="300" x2="${X(ceiling)}" y2="560" stroke="${C.mute}" stroke-width="3" stroke-dasharray="3 7"/>`;
  b += t(X(ceiling) + 12, 320, `นำได้มากสุด ${pts(ceiling)}`, { size: 24, fill: C.mute });
  b += t(X(ceiling) + 12, 350, `(A1 ได้ ${pct(p.rateB)}% แล้ว)`, { size: 24, fill: C.mute });
  // CI
  b += `<line x1="${X(d.ci95[0])}" y1="${yRow}" x2="${X(d.ci95[1])}" y2="${yRow}" stroke="${C.A1}" stroke-width="5"/>`;
  b += `<line x1="${X(d.ci90[0])}" y1="${yRow}" x2="${X(d.ci90[1])}" y2="${yRow}" stroke="${C.A1}" stroke-width="18" stroke-linecap="butt"/>`;
  b += `<circle cx="${X(p.diff)}" cy="${yRow}" r="16" fill="${C.A2}"/>`;
  b += t(X(p.diff), yRow - 40, `${pts(p.diff)} จุด`, { size: 44, anchor: 'middle', weight: 700, fill: C.A2 });
  b += `<rect x="${X(p.diff) - 250}" y="${yRow + 42}" width="500" height="42" rx="8" fill="#fff"/>`;
  b += t(X(p.diff), yRow + 72, `ช่วงความเชื่อมั่น 90% [${pts(d.ci90[0])}, ${pts(d.ci90[1])}]`, { size: 26, anchor: 'middle', fill: C.A1 });
  // แกน
  for (let v = -15; v <= 15; v += 5) b += t(X(v / 100), 610, v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0', { size: 28, anchor: 'middle', fill: C.mute });
  b += t(X(-0.13), 650, '← ไฟล์เดียวดีกว่า', { size: 26, fill: C.mute });
  b += t(X(0.13), 650, 'Agent Skills ดีกว่า →', { size: 26, fill: C.mute, anchor: 'end' });
  // หัว
  b += t(800, 80, `Agent Skills ${pct(p.rateA)}%  ·  ไฟล์เดียว ${pct(p.rateB)}%`, { size: 50, anchor: 'middle', weight: 700 });
  b += t(800, 135, 'ผลต่าง RCRc (A2 − A1) เป็นจุด', { size: 30, anchor: 'middle', fill: C.mute });
  // ข้อสรุปอยู่ที่หัวสไลด์แล้ว ไม่พิมพ์ซ้ำในภาพ
  b += t(800, 800, `${p.k} โจทย์ · ชนะ/แพ้/เสมอ ${p.wins}/${p.losses}/${p.ties} · p = ${p.p.toFixed(3)}`, { size: 26, anchor: 'middle', fill: C.mute });
  figs['fig-s8-primary'] = svg(b);
}

// ── สไลด์ 9 · มีกฎ vs ไม่มีกฎ (เชิงสำรวจ) ──────────────────────────────────
{
  const arms = ['A0', 'A1', 'A2', 'A5'];
  const metrics = [['CRIT', 'ผ่านกฎสำคัญครบทุกข้อ'], ['SCOPE', 'แก้ไฟล์อยู่ในขอบเขตงาน']];
  const top = 170, bottom = 690, Y = (v) => bottom - v * (bottom - top);
  const groupW = 620, barW = 120, gap = 22, gx0 = 170;
  let b = '';
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    b += `<line x1="140" y1="${Y(v)}" x2="1500" y2="${Y(v)}" stroke="#e5e7eb" stroke-width="2"/>`;
    b += t(125, Y(v) + 10, `${v * 100}%`, { size: 26, anchor: 'end', fill: C.mute });
  }
  metrics.forEach(([key, label], gi) => {
    const gx = gx0 + gi * (groupW + 120);
    arms.forEach((a, i) => {
      const v = n.perArm[a][key];
      const x = gx + i * (barW + gap);
      b += `<rect x="${x}" y="${Y(v)}" width="${barW}" height="${bottom - Y(v)}" fill="${C[a]}"/>`;
      b += t(x + barW / 2, Y(v) - 14, pct(v), { size: 34, anchor: 'middle', weight: 700 });
    });
    b += t(gx + (4 * barW + 3 * gap) / 2, bottom + 50, label, { size: 32, anchor: 'middle', weight: 700 });
  });
  arms.forEach((a, i) => {
    const x = 170 + i * 340;
    b += `<rect x="${x}" y="800" width="30" height="30" fill="${C[a]}"/>`;
    b += t(x + 42, 826, ARM_LABEL[a], { size: 26 });
  });
  // หัวเรื่องและป้าย "เชิงสำรวจ" อยู่ที่หัวสไลด์แล้ว ไม่พิมพ์ซ้ำในภาพ
  figs['fig-s9-rules'] = svg(b);
}

// ── เขียนไฟล์ + PNG ด้วย Edge headless (วิธีเดียวกับ scripts/report/build-book.mjs) ──
const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
for (const [name, src] of Object.entries(figs)) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), src);
  if (!EDGE) continue;
  const html = path.join(OUT, `${name}.html`);
  const png = path.join(OUT, `${name}.png`);
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0">${src}</body></html>`);
  if (fs.existsSync(png)) fs.rmSync(png);
  execFileSync(EDGE, ['--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
    `--window-size=${W},${H}`, `--screenshot=${png}`, 'file:///' + html.replace(/\\/g, '/')], { stdio: 'ignore' });
  for (let i = 0; i < 60 && !fs.existsSync(png); i++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  fs.rmSync(html);
  console.log(fs.existsSync(png) ? `✓ ${name}.png` : `✗ ${name}.png (Edge ไม่ได้เขียนไฟล์)`);
}
if (!EDGE) console.log('ไม่พบ Edge — ได้แค่ .svg');
