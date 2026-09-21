import fs from 'node:fs';
const LF = String.fromCharCode(10);
const R = 'E:/Seminar/skillbench/';
const rd = (p) => JSON.parse(fs.readFileSync(R + p, 'utf8'));

const s1 = rd('results/latest.json').graded.filter((r) => r.rep < 4);
const s2 = rd('results-study2/latest.json').graded;

const SC = ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11'];
const key = (r) => r.scenarioId.split('-')[0];

function grid(rows, arms, reps, valueOf) {
  const m = {};
  for (const r of rows) m[`${r.armId}|${key(r)}|${r.rep}`] = valueOf(r);
  const out = [];
  for (const a of arms) {
    out.push(`<div class="arow"><div class="alab ${a.toLowerCase()}">${a}</div><div class="cells">`);
    for (const s of SC) {
      out.push('<div class="scell">');
      for (let p = 0; p < reps; p++) {
        const v = m[`${a}|${s}|${p}`];
        if (v === undefined) out.push('<i class="c miss"></i>');
        else out.push(`<i class="c" style="background:${color(v)}"></i>`);
      }
      out.push('</div>');
    }
    out.push('</div></div>');
  }
  return out.join('');
}

// เขียวเข้มขึ้นตามคะแนน · ศูนย์เป็นสีเทาเข้ม
function color(v) {
  if (v <= 0) return '#24262b';
  const t = Math.min(1, v);
  const r = Math.round(0x24 + (0x7d - 0x24) * t);
  const g = Math.round(0x26 + (0xd4 - 0x26) * t);
  const b = Math.round(0x2b + (0x87 - 0x2b) * t);
  return `rgb(${r},${g},${b})`;
}

const heads = () =>
  `<div class="arow"><div class="alab"></div><div class="cells">` +
  SC.map((s) => `<div class="scell hd">${s.replace('S0', '').replace('S', '')}</div>`).join('') +
  `</div></div>`;

const sum = (a, f) => a.reduce((x, r) => x + (f(r) || 0), 0);
const stat = (rows) => ({
  n: rows.length,
  hr: (sum(rows, (r) => r.wallMs) / 3.6e6).toFixed(1),
  usd: Math.round(sum(rows, (r) => r.costUsd)),
  tc: sum(rows, (r) => r.toolCalls).toLocaleString('en-US'),
  tok: Math.round(sum(rows, (r) => r.inputTokens) / 1e6),
  ed: sum(rows, (r) => (r.filesChanged || []).length).toLocaleString('en-US'),
});
const a = stat([...s1, ...s2]);

const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { background:#141519; }
  body { width:1600px; font-family:'Leelawadee UI','Segoe UI',Tahoma,sans-serif; color:#e8e9ec; padding:38px 46px 30px; }
  .mono { font-family:'Cascadia Mono',Consolas,monospace; }
  h1 { font-size:35px; font-weight:700; }
  h1 .accent { color:#9ec7f0; }
  .sub { color:#8b919c; font-size:19px; margin-top:7px; }

  .strip { display:grid; grid-template-columns:repeat(6,1fr); gap:14px; margin-top:20px; }
  .stat { background:#1b1d22; border:1px solid #2a2d34; border-radius:10px; padding:12px 16px; }
  .stat .v { font-size:30px; font-weight:700; color:#e8c07d; font-family:'Cascadia Mono',Consolas,monospace; }
  .stat .k { font-size:15px; color:#8b919c; margin-top:2px; }

  .maps { display:grid; grid-template-columns:1fr 1fr; gap:26px; margin-top:22px; }
  .map { background:#1b1d22; border:1px solid #2a2d34; border-radius:12px; padding:15px 20px 16px; }
  .map h2 { font-size:20px; font-weight:700; }
  .map.r1 h2 { color:#e8c07d; } .map.r2 h2 { color:#7dd487; }
  .map .m2 { font-size:15px; color:#8b919c; margin:3px 0 12px; line-height:1.4; }

  .arow { display:grid; grid-template-columns:42px 1fr; align-items:center; height:30px; }
  .alab { font-size:16px; font-weight:700; font-family:'Cascadia Mono',Consolas,monospace; color:#8b919c; }
  .alab.a0{color:#8b919c} .alab.a1{color:#e8c07d} .alab.a2{color:#7dd487}
  .alab.a3{color:#7fc9e0} .alab.a4{color:#f0a0a8} .alab.a5{color:#c6a2ea}
  .cells { display:grid; grid-template-columns:repeat(11,1fr); gap:7px; }
  .scell { display:flex; gap:2px; }
  .scell.hd { font-size:12.5px; color:#5f6570; justify-content:center; font-family:'Cascadia Mono',Consolas,monospace; }
  .c { flex:1; height:19px; border-radius:2px; display:block; }
  .c.miss { background:#16181d; border:1px dashed #2f333a; }

  .lg { display:flex; align-items:center; gap:9px; margin-top:12px; font-size:14px; color:#8b919c; }
  .lg .sw { width:17px; height:15px; border-radius:2px; display:inline-block; }
  .lg .grad { width:110px; height:15px; border-radius:2px; background:linear-gradient(90deg,#24262b,#7dd487); display:inline-block; }

  .foot { margin-top:20px; background:#1b1d22; border-left:3px solid #9ec7f0; border-radius:0 9px 9px 0;
          padding:13px 18px; font-size:19px; line-height:1.5; color:#d2d6dd; }
  .foot b { color:#fff; }
</style></head><body>

<h1>งานที่ลงไปจริง — <span class="accent">396 run</span> ทุกช่องในตารางนี้คือการรัน agent จริง 1 ครั้ง</h1>
<div class="sub">แต่ละแถวคือกลุ่มทดลอง · แต่ละคอลัมน์คือโจทย์ 1 ข้อ · ในแต่ละช่องมี 4 ขีด คือรันซ้ำ 4 รอบ</div>

<div class="strip">
  <div class="stat"><div class="v">${a.n}</div><div class="k">run ที่วิเคราะห์</div></div>
  <div class="stat"><div class="v">${a.hr}</div><div class="k">ชั่วโมงที่ agent ทำงาน</div></div>
  <div class="stat"><div class="v">${a.tc}</div><div class="k">ครั้งที่เรียกใช้เครื่องมือ</div></div>
  <div class="stat"><div class="v">${a.ed}</div><div class="k">ไฟล์ที่ถูกแก้</div></div>
  <div class="stat"><div class="v">${a.tok}M</div><div class="k">token ที่อ่านเข้าไป</div></div>
  <div class="stat"><div class="v">$${a.usd}</div><div class="k">ค่าใช้จ่าย</div></div>
</div>

<div class="maps">

  <div class="map r1">
    <h2>รอบที่ 1 — 220 run · 5 กลุ่ม</h2>
    <div class="m2">ให้สีตามตัวชี้วัดเดิม <span class="mono">CRIT</span> — ผ่านกฎวิกฤต<b style="color:#c2c6cf">ครบทุกข้อ</b>จึงจะได้ 1 พลาดข้อเดียวได้ 0</div>
    ${heads()}
    ${grid(s1, ['A0', 'A1', 'A2', 'A3', 'A4'], 4, (r) => r.CRIT)}
    <div class="lg"><span class="sw" style="background:#7dd487"></span> ผ่านครบ
      <span class="sw" style="background:#24262b;margin-left:10px"></span> ไม่ครบ
      <span style="margin-left:14px;color:#e8838d">→ มีแค่สองค่า ไม่มีระดับกลาง</span></div>
  </div>

  <div class="map r2">
    <h2>รอบที่ 2 — 176 run · 4 กลุ่ม</h2>
    <div class="m2">ให้สีตามตัวชี้วัดใหม่ <span class="mono">RCRc</span> — สัดส่วนกฎที่ทำตามได้ โดยได้ 0 ถ้างานหลักไม่สำเร็จ</div>
    ${heads()}
    ${grid(s2, ['A0', 'A1', 'A2', 'A5'], 4, (r) => r.RCRc)}
    <div class="lg">0 <span class="grad"></span> 1
      <span style="margin-left:14px;color:#7dd487">→ มีเฉดให้เห็น แยกความต่างได้มากกว่าเดิม</span></div>
  </div>

</div>

<div class="foot">
  <b>ดูคอลัมน์ 8 กับ 9</b> — รอบแรก<b>ได้ศูนย์ทุกกลุ่มทุกรัน</b> ทั้งที่ agent ลงแรงไปเต็มที่
  &nbsp;·&nbsp; พอซ่อมตัวชี้วัด สองข้อนี้กลับมาให้ข้อมูล และกลายเป็น <b>2 ใน 3 ข้อที่ skill ชนะ</b>
  &nbsp;·&nbsp; ส่วนคอลัมน์ <b class="mono">7 · 10 · 11</b> ยังศูนย์ทั้งสองรอบ — ยากเกินไปจริง ๆ
</div>

</body></html>`;

fs.writeFileSync(R + 'slides-images/src/25-runs-map.html', html.split(LF).join(LF));
console.log('เขียนแล้ว · รวม', a.n, 'run ·', a.hr, 'ชม. · $' + a.usd);
