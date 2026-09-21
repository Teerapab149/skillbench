/* สร้าง fig-runs-map.html และ fig-effort.html จากข้อมูลจริง
   ห้ามแก้ไฟล์ .html ที่สคริปต์นี้เขียนด้วยมือ · รันใหม่ด้วย
     node slides-images/src/fig-runs.gen.mjs                                      */
import fs from 'node:fs';
const LF = String.fromCharCode(10);
const R = 'E:/Seminar/skillbench/';
const rd = (p) => JSON.parse(fs.readFileSync(R + p, 'utf8'));

const s1 = rd('results/latest.json').graded.filter((r) => r.rep < 4);
const s2 = rd('results-study2/latest.json').graded;

const SC = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11'];
const key = (r) => r.scenarioId.split('-')[0];

// ขาว = 0 · เขียวเข้มขึ้นตามคะแนน (ให้อ่านออกบนสไลด์พื้นขาว)
function color(v) {
  if (v <= 0) return '#e4e7ec';
  const t = Math.min(1, v);
  const r = Math.round(0xd6 + (0x2a - 0xd6) * t);
  const g = Math.round(0xe8 + (0x7a - 0xe8) * t);
  const b = Math.round(0xd9 + (0x38 - 0xd9) * t);
  return `rgb(${r},${g},${b})`;
}

function grid(rows, arms, reps, valueOf) {
  const m = {};
  for (const r of rows) m[`${r.armId}|${key(r)}|${r.rep}`] = valueOf(r);
  const out = [
    '<div class="arow"><div class="alab"></div><div class="cells">',
    SC.map((s) => `<div class="scell hd">${Number(s.slice(1))}</div>`).join(''),
    '</div></div>',
  ];
  for (const a of arms) {
    out.push(`<div class="arow"><div class="alab ${a.toLowerCase()}">${a}</div><div class="cells">`);
    for (const s of SC) {
      out.push('<div class="scell">');
      for (let p = 0; p < reps; p++) {
        const v = m[`${a}|${s}|${p}`];
        out.push(v === undefined ? '<i class="c miss"></i>' : `<i class="c" style="background:${color(v)}"></i>`);
      }
      out.push('</div>');
    }
    out.push('</div></div>');
  }
  return out.join('');
}

const sum = (a, f) => a.reduce((x, r) => x + (f(r) || 0), 0);
const all = [...s1, ...s2];
const stat = {
  n: all.length,
  hr: (sum(all, (r) => r.wallMs) / 3.6e6).toFixed(1),
  usd: Math.round(sum(all, (r) => r.costUsd)),
  tc: sum(all, (r) => r.toolCalls).toLocaleString('en-US'),
  tok: Math.round(sum(all, (r) => r.inputTokens) / 1e6),
  ed: sum(all, (r) => (r.filesChanged || []).length).toLocaleString('en-US'),
};

const head = (w) => `<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<link rel="stylesheet" href="_fig.css">
<style>
  body { width: ${w}px; padding: 10px; }`;

// ---------------------------------------------------------------- แผนที่ run
const mapHtml = `${head(1400)}
  .maps { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .map { border: 1.5px solid var(--line); border-radius: 12px; overflow: hidden; }
  .mh { padding: 11px 18px; background: var(--panel); border-bottom: 1px solid var(--line); }
  .mh .t { font-size: 18px; font-weight: 700; }
  .r1 .mh .t { color: var(--amber); } .r2 .mh .t { color: var(--green); }
  .mh .s { font-size: 14px; color: var(--mut); margin-top: 2px; line-height: 1.4; }
  .mb { padding: 12px 18px 14px; }

  .arow { display: grid; grid-template-columns: 38px 1fr; align-items: center; height: 29px; }
  .alab { font-size: 15.5px; font-weight: 700; font-family: 'Cascadia Mono', Consolas, monospace; color: var(--mut); }
  .alab.a0{color:var(--ink2)} .alab.a1{color:var(--amber)} .alab.a2{color:var(--green)}
  .alab.a3{color:var(--blue)} .alab.a4{color:var(--red)} .alab.a5{color:var(--purple)}
  .cells { display: grid; grid-template-columns: repeat(11, 1fr); gap: 7px; }
  .scell { display: flex; gap: 2px; }
  .scell.hd { font-size: 12px; color: var(--faint); justify-content: center;
              font-family: 'Cascadia Mono', Consolas, monospace; }
  .c { flex: 1; height: 18px; border-radius: 2px; display: block; }
  .c.miss { background: transparent; border: 1px dashed var(--line); }

  .lg { display: flex; align-items: center; gap: 8px; margin-top: 11px; font-size: 14px; color: var(--mut); }
  .lg i { width: 16px; height: 14px; border-radius: 3px; display: inline-block; }
  .lg .grad { width: 104px; height: 14px; border-radius: 3px;
              background: linear-gradient(90deg,#e4e7ec,#2a7a38); display: inline-block; }
</style></head><body>

<div class="maps">
  <div class="map r1">
    <div class="mh"><div class="t">รอบที่ 1 — 220 run · 5 กลุ่ม</div>
      <div class="s">ให้สีตามตัวชี้วัดเดิม <span class="mono">CRIT</span> — ผ่านกฎวิกฤตครบทุกข้อจึงได้ 1 พลาดข้อเดียวได้ 0</div></div>
    <div class="mb">
      ${grid(s1, ['A0', 'A1', 'A2', 'A3', 'A4'], 4, (r) => r.CRIT)}
      <div class="lg"><i style="background:#2a7a38"></i> ผ่านครบ
        <i style="background:#e4e7ec;margin-left:8px"></i> ไม่ครบ
        <span style="margin-left:12px;color:var(--red)">มีแค่สองค่า ไม่มีระดับกลาง</span></div>
    </div>
  </div>

  <div class="map r2">
    <div class="mh"><div class="t">รอบที่ 2 — 176 run · 4 กลุ่ม</div>
      <div class="s">ให้สีตามตัวชี้วัดใหม่ <span class="mono">RCRc</span> — สัดส่วนกฎที่ทำตามได้ โดยได้ 0 ถ้างานหลักไม่สำเร็จ</div></div>
    <div class="mb">
      ${grid(s2, ['A0', 'A1', 'A2', 'A5'], 4, (r) => r.RCRc)}
      <div class="lg">0 <span class="grad"></span> 1
        <span style="margin-left:12px;color:var(--green)">มีเฉดให้เห็น แยกความต่างได้มากกว่าเดิม</span></div>
    </div>
  </div>
</div>

<div style="margin-top:12px;font-size:14.5px;color:var(--mut)">
  แต่ละแถวคือกลุ่มทดลอง · แต่ละคอลัมน์คือโจทย์ 1 ข้อ · ในแต่ละช่องมี 4 ขีด คือรันซ้ำ 4 รอบ
</div>

</body></html>`;

// ---------------------------------------------------------------- ต้นทุนที่ลงไป
const effortHtml = `${head(1320)}
  .strip { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; }
  .stat { border: 1.5px solid var(--line); border-radius: 12px; padding: 16px 18px; text-align: center; }
  .stat .v { font-size: 38px; font-weight: 700; color: var(--amber);
             font-family: 'Cascadia Mono', Consolas, monospace; line-height: 1; }
  .stat .k { font-size: 15px; color: var(--mut); margin-top: 8px; line-height: 1.3; }
</style></head><body>

<div class="strip">
  <div class="stat"><div class="v">${stat.n}</div><div class="k">run ที่วิเคราะห์</div></div>
  <div class="stat"><div class="v">${stat.hr}</div><div class="k">ชั่วโมงที่ agent ทำงาน</div></div>
  <div class="stat"><div class="v">${stat.tc}</div><div class="k">ครั้งที่เรียกใช้เครื่องมือ</div></div>
  <div class="stat"><div class="v">${stat.ed}</div><div class="k">ไฟล์ที่ถูกแก้</div></div>
  <div class="stat"><div class="v">${stat.tok}M</div><div class="k">token ที่อ่านเข้าไป</div></div>
  <div class="stat"><div class="v">$${stat.usd}</div><div class="k">ค่าใช้จ่าย</div></div>
</div>

</body></html>`;

fs.writeFileSync(R + 'slides-images/src/fig-runs-map.html', mapHtml.split(LF).join(LF));
fs.writeFileSync(R + 'slides-images/src/fig-effort.html', effortHtml.split(LF).join(LF));
console.log('เขียนแล้ว · fig-runs-map.html + fig-effort.html ·', stat.n, 'run ·', stat.hr, 'ชม. · $' + stat.usd);
