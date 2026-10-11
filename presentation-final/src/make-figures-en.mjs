// English figures for the English deck. Same data and layout as make-figures.mjs.
// Every result number is read from results-study3/numbers.json and sensitivity.json.
// The invoice figure is an illustration: the 20 -> 25 baht rate comes from scenarios/S09-rate-change.json,
// the hours are illustrative.
//
//   node presentation-final/src/make-figures-en.mjs
//
// Writes *-en.svg and *-en.png (2x) to presentation-final/figures/
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
const FONT = 'Segoe UI, Arial, sans-serif';
const C = { A0: '#9aa3ad', A1: '#3b5b92', A2: '#c0392b', A5: '#e0a030', ink: '#1f2937', mute: '#6b7280', band: '#e3f1e3', bandEdge: '#7fb77f', bad: '#c0392b' };
const ARM_LABEL = { A0: 'A0 no rules', A1: 'A1 single file', A2: 'A2 Agent Skills', A5: 'A5 A2 text, always loaded' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const t = (x, y, s, o = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${o.size ?? 32}" fill="${o.fill ?? C.ink}"` +
  ` text-anchor="${o.anchor ?? 'start'}" font-weight="${o.weight ?? 400}">${esc(s)}</text>`;
const svg = (body, h = H) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}">` +
  `<rect width="100%" height="100%" fill="#fff"/>${body}</svg>`;
const pct = (v) => (v * 100).toFixed(1);
const pts = (v) => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1);
const figs = {};

// ── Slide 2: invoice before and after ──
{
  const [, from, to] = s09.prompt.match(/จาก\s*(\d+)\s*บาทเป็น\s*(\d+)/).map(Number);
  const hours = 10;
  const card = (x, title, sub, rate, color, note) => {
    let b = `<rect x="${x}" y="250" width="560" height="440" rx="18" fill="#fff" stroke="${color}" stroke-width="4"/>`;
    b += t(x + 40, 320, title, { size: 38, weight: 700 });
    b += t(x + 40, 365, sub, { size: 26, fill: C.mute });
    b += `<line x1="${x + 40}" y1="395" x2="${x + 520}" y2="395" stroke="#ddd" stroke-width="2"/>`;
    b += t(x + 40, 455, 'V100 machine', { size: 32 });
    b += t(x + 520, 455, `${hours} h`, { size: 32, anchor: 'end' });
    b += t(x + 40, 510, 'Rate', { size: 32 });
    b += t(x + 520, 510, `${rate} THB/h`, { size: 32, anchor: 'end', fill: color, weight: 700 });
    b += `<line x1="${x + 40}" y1="545" x2="${x + 520}" y2="545" stroke="#ddd" stroke-width="2"/>`;
    b += t(x + 40, 610, 'Total', { size: 38, weight: 700 });
    b += t(x + 520, 610, `${hours * rate} THB`, { size: 50, anchor: 'end', fill: color, weight: 700 });
    b += t(x + 280, 665, note, { size: 24, fill: color, anchor: 'middle' });
    return b;
  };
  let b = '';
  b += `<rect x="150" y="60" width="1300" height="110" rx="55" fill="#eef2f8"/>`;
  b += t(800, 130, `“Change the V100 rate from ${from} to ${to} baht per hour, per the new notice.”`, { size: 32, anchor: 'middle' });
  b += card(160, 'Last month’s invoice', 'already sent to the customer', from, C.A1, 'what the customer already paid');
  b += card(880, 'The same invoice', 'after the AI changed the rate', to, C.bad, 'changed silently, nobody was told');
  b += `<path d="M 735 470 L 860 470" stroke="${C.ink}" stroke-width="6" marker-end="url(#ah)"/>`;
  b += `<defs><marker id="ah" markerWidth="10" markerHeight="10" refX="6" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${C.ink}"/></marker></defs>`;
  b += t(800, 770, 'Invoices are recomputed from the current rate, so a correct edit rewrites the past', { size: 32, anchor: 'middle', weight: 700 });
  b += t(800, 830, `Illustration of scenario S09 (prompt translated from Thai). The rate change is from the real task, the hours are illustrative.`, { size: 22, anchor: 'middle', fill: C.mute });
  figs['fig-s2-invoice-en'] = svg(b);
}

// ── Slide 8: primary result, one row ──
{
  const p = n.primary, d = p.decision, margin = d.margin;
  const x0 = 140, x1 = 1460, lo = -0.15, hi = 0.15;
  const X = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  const yRow = 430, ceiling = 1 - p.rateB;
  let b = '';
  b += `<rect x="${X(-margin)}" y="230" width="${X(margin) - X(-margin)}" height="330" fill="${C.band}"/>`;
  b += `<line x1="${X(-margin)}" y1="230" x2="${X(-margin)}" y2="560" stroke="${C.bandEdge}" stroke-width="3"/>`;
  b += `<line x1="${X(margin)}" y1="230" x2="${X(margin)}" y2="560" stroke="${C.bandEdge}" stroke-width="3"/>`;
  b += t(X(0), 210, `Green band = equivalence margin ±${(margin * 100).toFixed(1)} points, declared before data collection`, { size: 28, anchor: 'middle', fill: '#3d7a3d', weight: 700 });
  b += `<line x1="${X(0)}" y1="230" x2="${X(0)}" y2="560" stroke="#888" stroke-width="2" stroke-dasharray="8 8"/>`;
  b += `<line x1="${X(ceiling)}" y1="300" x2="${X(ceiling)}" y2="560" stroke="${C.mute}" stroke-width="3" stroke-dasharray="3 7"/>`;
  b += t(X(ceiling) + 12, 320, `Max possible lead ${pts(ceiling)}`, { size: 22, fill: C.mute });
  b += t(X(ceiling) + 12, 350, `(A1 already at ${pct(p.rateB)}%)`, { size: 22, fill: C.mute });
  b += `<line x1="${X(d.ci95[0])}" y1="${yRow}" x2="${X(d.ci95[1])}" y2="${yRow}" stroke="${C.A1}" stroke-width="5"/>`;
  b += `<line x1="${X(d.ci90[0])}" y1="${yRow}" x2="${X(d.ci90[1])}" y2="${yRow}" stroke="${C.A1}" stroke-width="18"/>`;
  b += `<circle cx="${X(p.diff)}" cy="${yRow}" r="16" fill="${C.A2}"/>`;
  b += t(X(p.diff), yRow - 40, `${pts(p.diff)} points`, { size: 42, anchor: 'middle', weight: 700, fill: C.A2 });
  b += `<rect x="${X(p.diff) - 200}" y="${yRow + 42}" width="400" height="42" rx="8" fill="#fff"/>`;
  b += t(X(p.diff), yRow + 72, `90% CI [${pts(d.ci90[0])}, ${pts(d.ci90[1])}]`, { size: 26, anchor: 'middle', fill: C.A1 });
  for (let v = -15; v <= 15; v += 5) b += t(X(v / 100), 610, v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0', { size: 28, anchor: 'middle', fill: C.mute });
  b += t(X(-0.13), 650, '← single file better', { size: 24, fill: C.mute });
  b += t(X(0.13), 650, 'Agent Skills better →', { size: 24, fill: C.mute, anchor: 'end' });
  b += t(800, 80, `Agent Skills ${pct(p.rateA)}%   Single file ${pct(p.rateB)}%`, { size: 48, anchor: 'middle', weight: 700 });
  b += t(800, 135, 'Difference in RCRc (A2 − A1), percentage points', { size: 28, anchor: 'middle', fill: C.mute });
  b += t(800, 800, `${p.k} scenarios, wins/losses/ties ${p.wins}/${p.losses}/${p.ties}, p = ${p.p.toFixed(3)}`, { size: 24, anchor: 'middle', fill: C.mute });
  figs['fig-s8-primary-en'] = svg(b);
}

// ── Slide 9: rules vs no rules (exploratory) ──
{
  const arms = ['A0', 'A1', 'A2', 'A5'];
  const metrics = [['CRIT', 'Passed every critical rule'], ['SCOPE', 'Edited only in-scope files']];
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
      const v = n.perArm[a][key], x = gx + i * (barW + gap);
      b += `<rect x="${x}" y="${Y(v)}" width="${barW}" height="${bottom - Y(v)}" fill="${C[a]}"/>`;
      b += t(x + barW / 2, Y(v) - 14, pct(v), { size: 34, anchor: 'middle', weight: 700 });
    });
    b += t(gx + (4 * barW + 3 * gap) / 2, bottom + 50, label, { size: 30, anchor: 'middle', weight: 700 });
  });
  arms.forEach((a, i) => {
    const x = 150 + i * 350;
    b += `<rect x="${x}" y="800" width="30" height="30" fill="${C[a]}"/>`;
    b += t(x + 42, 826, ARM_LABEL[a], { size: 24 });
  });
  figs['fig-s9-rules-en'] = svg(b);
}

// ── Backup B1: sensitivity analyses ──
{
  const rows = [['MAIN', 'Planned analysis'], ['SA-1', 'Fixed graders S05, S06 + relaxed S08/S09'], ['SA-2', 'Dropped 4 affected scenarios']];
  const margin = sens.margin, lo = -0.15, hi = 0.15, x0 = 620, x1 = 1540;
  const X = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  const h = 420, top = 60, rowH = 100;
  let b = `<rect x="${X(-margin)}" y="${top - 30}" width="${X(margin) - X(-margin)}" height="${rows.length * rowH + 10}" fill="${C.band}"/>`;
  b += `<line x1="${X(0)}" y1="${top - 30}" x2="${X(0)}" y2="${top + rows.length * rowH - 20}" stroke="#888" stroke-dasharray="8 8" stroke-width="2"/>`;
  rows.forEach(([k, label], i) => {
    const r = sens.results[k].primary_A2_vs_A1, y = top + i * rowH + 20;
    b += t(40, y + 10, `${k}  ${label}`, { size: 28, weight: i ? 400 : 700 });
    b += `<line x1="${X(r.ci95[0])}" y1="${y}" x2="${X(r.ci95[1])}" y2="${y}" stroke="${C.A1}" stroke-width="4"/>`;
    b += `<line x1="${X(r.ci90[0])}" y1="${y}" x2="${X(r.ci90[1])}" y2="${y}" stroke="${C.A1}" stroke-width="14"/>`;
    b += `<circle cx="${X(r.meanDiff)}" cy="${y}" r="12" fill="${C.A2}"/>`;
  });
  for (let v = -15; v <= 15; v += 5) b += t(X(v / 100), h - 40, v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0', { size: 24, anchor: 'middle', fill: C.mute });
  figs['fig-b1-sensitivity-en'] = svg(b, h);
}

const EDGE = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
for (const [name, src] of Object.entries(figs)) {
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
  console.log(fs.existsSync(png) ? `ok ${name}.png` : `missing ${name}.png`);
}
