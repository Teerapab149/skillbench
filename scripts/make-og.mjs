// สร้างภาพตัวอย่างลิงก์ (Open Graph 1200×630) ของเว็บ จากตัวเลขในไฟล์ผล แล้วถ่ายภาพด้วย Edge แบบ headless
// ใช้: node scripts/make-og.mjs  ได้ site/public/og.png
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const s1 = read('results/numbers.json');
const s2 = read('results-study2/numbers.json');
const s3 = read('results-study3/numbers.json');
const runs = [s1, s2, s3].reduce((n, s) => n + s.allocation.usableCells, 0);
const p = s3.primary;
const pct = (v) => (v * 100).toFixed(1);
const pts = (v) => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1);

const font = (pkg, file) => pathToFileURL(path.join(root, 'site/node_modules/@fontsource', pkg, 'files', file)).href;
const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>
@font-face{font-family:'NST';font-weight:700;src:url(${font('noto-serif-thai', 'noto-serif-thai-thai-700-normal.woff2')})}
@font-face{font-family:'NSL';font-weight:700;src:url(${font('noto-serif-thai', 'noto-serif-thai-latin-700-normal.woff2')})}
@font-face{font-family:'SB';font-weight:400;src:url(${font('sarabun', 'sarabun-thai-400-normal.woff2')})}
@font-face{font-family:'SBL';font-weight:400;src:url(${font('sarabun', 'sarabun-latin-400-normal.woff2')})}
@font-face{font-family:'SB';font-weight:600;src:url(${font('sarabun', 'sarabun-thai-600-normal.woff2')})}
@font-face{font-family:'SBL';font-weight:600;src:url(${font('sarabun', 'sarabun-latin-600-normal.woff2')})}
html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{background:#fdfdfb;color:#161b26;font-family:'SBL','SB',sans-serif;display:flex;flex-direction:column;justify-content:space-between;padding:64px 72px 56px;box-sizing:border-box;border-top:14px solid #0b6e69}
.k{font-size:26px;color:#6a7180;letter-spacing:.02em}
h1{font-family:'NSL','NST',serif;font-weight:700;font-size:76px;line-height:1.22;margin:0}
.a{font-size:34px;line-height:1.45;color:#3f4756;margin:0}
.a b{color:#0b6e69;font-weight:600}
.row{display:flex;justify-content:space-between;align-items:flex-end}
.n{font-size:26px;color:#3f4756}
.u{font-size:24px;color:#6a7180}
</style></head><body>
<div class="k">SkillBench งานวิจัย 477-401 มหาวิทยาลัยสงขลานครินทร์</div>
<div><h1>เขียนกฎให้ AI แบบไหน<br>AI ถึงจะทำตาม</h1></div>
<p class="a">Agent Skills ${pct(p.rateA)}% กับไฟล์เดียว ${pct(p.rateB)}% ต่างกัน ${pts(p.diff)} จุด<br><b>เทียบเท่ากันตามเกณฑ์ ±${(p.decision.margin * 100).toFixed(1)} จุดที่ประกาศไว้ก่อน</b></p>
<div class="row"><span class="n">การทดลอง 3 ชุด รวม ${runs} run ให้คะแนนด้วยโปรแกรม</span><span class="u">teerapab149.github.io/skillbench</span></div>
</body></html>`;

const tmp = path.join(root, 'site', '.og-card.html');
fs.writeFileSync(tmp, html);
const out = path.join(root, 'site', 'public', 'og.png');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
execFileSync(edge, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1200,630', '--virtual-time-budget=4000', `--screenshot=${out}`, pathToFileURL(tmp).href], { stdio: 'inherit' });
fs.unlinkSync(tmp);
console.log('wrote', path.relative(root, out), runs, 'runs');
