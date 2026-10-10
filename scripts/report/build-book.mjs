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

// รูปที่ 3: ร่องรอยรอบแรกของ run จริง S10 × A2 × รอบ 1 จาก artifacts ชุดสุดท้าย (ไม่แต่งข้อความ ตัดเฉพาะความยาว)
{
  const RUN = 'S10-cancel-conflict__A2__r0';
  const artFile = fs.readdirSync(path.join(ROOT, 'results-study3')).filter((f) => /^artifacts-.*\.json$/.test(f)).sort().at(-1);
  const r = JSON.parse(fs.readFileSync(path.join(ROOT, 'results-study3', artFile), 'utf8')).find((x) => x.runId === RUN);
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const n1 = r.firstTurn?.toolCallCount ?? 16;
  const short = (p) => String(p).split(/[\\/]/).pop();
  const lines = r.toolCalls.slice(0, n1).map((t) => {
    if (t.name === 'Skill') return `<span class="k">● Skill</span> ${esc(t.args.skill)}`;
    if (t.name === 'Read') return `<span class="r">● Read</span> ${esc(short(t.args.file_path))}`;
    if (t.name === 'Bash') return `<span class="b">● Bash</span> ${esc(String(t.args.command).replace(/^cd "[^"]+" && /, '').slice(0, 90))}`;
    return `<span class="r">● ${esc(t.name)}</span>`;
  });
  const msg = String(r.firstMessage).split('\n').filter((l) => l.trim()).slice(0, 5)
    .map((l) => esc(l.replace(/[*`]/g, '').slice(0, 260)) + (l.length > 260 ? ' …' : ''));
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#fff;font-family:Tahoma,'TH SarabunPSK',sans-serif}
    .w{width:900px;background:#1e1f24;color:#e6e6e6;border-radius:10px;padding:16px 20px 18px;box-sizing:border-box}
    .h{color:#9aa0a6;font-size:13px;margin-bottom:10px;border-bottom:1px solid #3a3b40;padding-bottom:8px}
    .t{font-family:Consolas,monospace;font-size:13.5px;line-height:1.55}
    .k{color:#e0a030}.r{color:#7fb3ff}.b{color:#8bd48b}
    .m{margin-top:12px;border-left:3px solid #e0a030;padding:6px 0 2px 12px;font-size:14px;line-height:1.6}
    .m p{margin:0 0 6px}
  </style></head><body><div class="w">
    <div class="h">Claude Code · โจทย์ S10 (ข้อกำหนดขัดกัน) · กลุ่ม A2 Agent Skills · รอบแรก · run ${RUN}</div>
    <div class="t">${lines.join('<br>')}</div>
    <div class="m">${msg.map((x) => `<p>${x}</p>`).join('')}</div>
  </div></body></html>`;
  fs.writeFileSync(path.join(FIG, 'fig-transcript.html'), html);
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
/*
 * ภาคผนวก ง: ทุกอย่างที่เอเจนต์ได้รับในแต่ละโจทย์ — คำสั่ง (ตรงตัวอักษร) · สภาพเริ่มต้นเฉพาะโจทย์ที่ฝังกับดัก ·
 * กฎที่ใช้ให้คะแนน · และหมายเหตุของผู้ออกแบบ (เอเจนต์ไม่เห็น) · อ่านจาก scenarios/*.json และ scenarios/setup/*.json
 */
const famTh = { ordinary: 'ธรรมดา', gold_plating: 'ทำเกินสั่ง', counter_intuitive: 'ขัดกับสามัญสำนึก', hidden_impact: 'ผลกระทบซ่อนเร้น',
  requirement_conflict: 'ข้อกำหนดขัดกัน', requirement_invention: 'เติมข้อกำหนดเอง', embedded_instruction: 'คำสั่งฝังในโค้ด', destructive_action: 'คำสั่งทำลายข้อมูล' };
const addedLines = (find, replace) => {
  const old = new Set(String(find).split('\n'));
  return String(replace).split('\n').filter((l) => !old.has(l)).join('\n');
};
let scenMd = '';
scen.forEach((s, idx) => {
  scenMd += `### ง.${idx + 1} ${s.id}\n\n**ตระกูลกับดัก:** ${famTh[s.family] ?? s.family} · **ข้อกำหนดที่เกี่ยวข้อง:** ${(s.reqs ?? []).join(', ') || '—'}\n\n`;
  scenMd += `**คำสั่งที่เอเจนต์ได้รับ (ตรงตัวอักษร)**\n\n${fence(s.prompt)}\n\n`;
  const setupFile = path.join(ROOT, 'scenarios/setup', `${s.id}.json`);
  if (fs.existsSync(setupFile)) {
    const patches = JSON.parse(fs.readFileSync(setupFile, 'utf8'));
    scenMd += '**สภาพเริ่มต้นเฉพาะโจทย์นี้** (ปะลงระบบก่อนเอเจนต์เริ่ม และ commit ให้ดูเหมือนสภาพเดิมของระบบ) — บรรทัดที่เพิ่มหรือเปลี่ยน:\n\n';
    for (const p of patches) {
      const body = p.create != null ? String(p.create) : addedLines(p.find, p.replace);
      const shown = body.length > 1500 ? body.slice(0, 1500) + '\n… (ตัดเหลือ 1,500 ตัวอักษร · ฉบับเต็มอยู่ใน scenarios/setup/)' : body;
      scenMd += `ไฟล์ \`${p.file}\`${p.create != null ? ' (สร้างใหม่)' : ''}\n\n${fence(shown || '(ลบบรรทัดออกเท่านั้น)')}\n\n`;
    }
  } else {
    scenMd += '**สภาพเริ่มต้น:** ระบบตามสภาพมาตรฐาน (`skillbench-baseline`) ไม่มีการแก้เฉพาะโจทย์\n\n';
  }
  scenMd += '**กฎที่ใช้ให้คะแนน** (critical นับในตัวชี้วัดหลัก · major รายงานประกอบ)\n\n'
    + '| กฎ | ระดับ | ตรวจอะไร |\n|---|---|---|\n' + s.rules.map((r) => `| ${r.id} | ${r.severity} | ${String(r.desc).replace(/\|/g, '/')} |`).join('\n') + '\n\n';
  if (s._designNote) scenMd += `**หมายเหตุของผู้ออกแบบ** (เอเจนต์ไม่เห็น): ${String(s._designNote).replace(/\n+/g, ' ')}\n\n`;
});
const skills = fs.readdirSync(path.join(ROOT, 'arms/A2/skills')).sort();
const skillDesc = (k) => (rd(`arms/A2/skills/${k}/SKILL.md`).match(/^description:\s*(.+)$/m) ?? [, ''])[1];
const cfg3 = JSON.parse(rd('config/arms-study3.json'));
const armsAppendix = [
  '## ภาคผนวก ค สิ่งที่ส่งให้เอเจนต์แต่ละกลุ่ม (ข้อความจริงทั้งหมด)',
  'ภาคผนวกนี้แสดงข้อความทุกตัวอักษรที่ถูกวางลงในโฟลเดอร์งานก่อนเอเจนต์เริ่มทำงาน คัดจากไฟล์ใน `arms/` ที่ใช้รันจริง ณ git tag `study3-prereg` ไม่ได้ย่อหรือแก้ เอเจนต์ทุกกลุ่มได้รับคำสั่งของโจทย์ (ภาคผนวก ง) ระบบจำลองและเอกสารข้อกำหนด (ภาคผนวก ซ) และข้อความรอบตอบกลับเหมือนกันทุกประการ ความต่างระหว่างกลุ่มมีเฉพาะไฟล์ในภาคผนวกนี้',
  '| กลุ่ม | ไฟล์ที่วางลงโฟลเดอร์งาน | เอเจนต์เห็นเมื่อใด |\n|---|---|---|\n'
    + '| A0 | ไม่มีไฟล์ใด | — |\n'
    + '| A1 | `CLAUDE.md` (ค.2) | ทุกครั้งที่เริ่มงาน ตลอดการทำงาน |\n'
    + '| A2 | `CLAUDE.md` สั้น (ค.3) + skill 4 ตัวใน `.claude/skills/` (ค.4–ค.7) | `CLAUDE.md` และ *ชื่อกับคำอธิบาย* ของ skill เห็นตลอด · *เนื้อความ* ของ skill เห็นเมื่อเอเจนต์เลือกโหลด |\n'
    + '| A5 | `CLAUDE.md` ที่รวมเนื้อความ skill ทั้ง 4 ตัว (ค.8) | ทุกครั้งที่เริ่มงาน ตลอดการทำงาน |',
  '### ค.1 ข้อความรอบตอบกลับ (ส่งให้ทุกกลุ่มหลังรอบแรก)', fence(cfg3.fixedFactors.followUp.text),
  '### ค.2 A1 — ไฟล์กฎไฟล์เดียว `CLAUDE.md`', fence(rd('arms/A1/CLAUDE.md')),
  '### ค.3 A2 — `CLAUDE.md` (โหลดตลอด)', fence(rd('arms/A2/CLAUDE.md')),
  ...skills.map((k, i) => `### ค.${i + 4} A2 — skill \`${k}\` (โหลดเมื่อเอเจนต์เลือก)\n\n**ส่วนที่เอเจนต์เห็นตลอดเวลา (คำอธิบาย):** ${skillDesc(k)}\n\n**เนื้อความเต็มที่โหลดเมื่อเลือกใช้:**\n\n${fence(rd(`arms/A2/skills/${k}/SKILL.md`))}`),
  '### ค.8 A5 — `CLAUDE.md` ที่รวมข้อความของ skill ทั้งสี่ตัว (โหลดตลอด)', fence(rd('arms/A5/CLAUDE.md')),
].join('\n\n');
const appendix = [
  '# ภาคผนวก {.unnumbered}',
  '## ภาคผนวก ก แผนการวิเคราะห์ที่ประกาศล่วงหน้า (PRE-REGISTRATION-3)',
  '> คัดจาก `PRE-REGISTRATION-3.md` ณ git tag `study3-prereg` (commit 7fb3d1a) ตรงตามต้นฉบับ',
  demote(stripComments(rd('PRE-REGISTRATION-3.md')).replace(/^# .*\n/, '').replace(/^## ภาคผนวก ก — /m, '## ภาคผนวกของแผน — '), 1),
  '## ภาคผนวก ข บันทึกส่วนเบี่ยงเบนจากแผน (DEVIATIONS-3)',
  demote(stripComments(rd('DEVIATIONS-3.md')).replace(/^# .*\n/, ''), 1),
  armsAppendix,
  '## ภาคผนวก ง โจทย์ทั้ง 22 ข้อ: คำสั่ง สภาพเริ่มต้น และกฎ',
  'แต่ละโจทย์แสดงคำสั่งที่เอเจนต์ได้รับตรงตัวอักษร สภาพเริ่มต้นเฉพาะโจทย์ซึ่งเป็นที่ฝังกับดัก (ถ้ามี) และกฎทุกข้อที่ใช้ให้คะแนน คัดจาก `scenarios/` ณ git tag `study3-prereg` ส่วนเทสยอมรับที่ใช้ตัดสินว่างานสำเร็จอยู่ใน `scenarios/acceptance/` ของ repository',
  scenMd,
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
  '## ภาคผนวก ซ เอกสารข้อกำหนดของระบบจำลอง (REQUIREMENTS.md)',
  'เอกสารข้อกำหนด 43 ข้อที่เอเจนต์ทุกกลุ่มอ่านได้เหมือนกัน ตามสภาพมาตรฐาน `skillbench-baseline` บางโจทย์แก้เอกสารนี้ในสภาพเริ่มต้นเฉพาะโจทย์ (ดูภาคผนวก ง) เอกสารอื่นของระบบ ได้แก่ `ARCHITECTURE.md` และ `openapi.yaml` อยู่ใน `fixtures/gpu-booking/` ของ repository',
  fence(execFileSync('git', ['-C', path.join(ROOT, 'fixtures/gpu-booking'), 'show', 'skillbench-baseline:REQUIREMENTS.md'], { encoding: 'utf8' })),
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

/*
 * caption จริงของ Word: ป้าย "ตารางที่"/"รูปที่" + ฟิลด์ SEQ ที่ Word เรียงเลขเอง
 * สารบัญตาราง/รูปในส่วนหน้าเป็นฟิลด์ TOC \c ที่ดึงจาก SEQ นี้ — ผู้วิจัยใช้ Insert Caption เพิ่มรายการเองได้
 * แล้วกด Update Field เลขจะเรียงใหม่ทั้งเล่ม (การอ้างถึงในเนื้อความยังเป็นข้อความธรรมดา)
 */
const segTh = new Intl.Segmenter('th', { granularity: 'word' });
const thSeg = (t) => t.replace(/[฀-๿]{2,}/g, (run) => [...segTh.segment(run)].map((x) => x.segment).join('​'));
const xml = (t) => thSeg(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function caption(label, n, text, jc) {
  return '```{=openxml}\n'
    + `<w:p><w:pPr><w:pStyle w:val="Caption"/>${jc === 'center' ? '<w:keepNext w:val="0"/>' : '<w:keepNext/>'}<w:jc w:val="${jc}"/></w:pPr>`
    + `<w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t xml:space="preserve">${label} </w:t></w:r>`
    + `<w:fldSimple w:instr=" SEQ ${label} \\* ARABIC "><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:t>${n}</w:t></w:r></w:fldSimple>`
    + `<w:r><w:t xml:space="preserve"> ${xml(text)}</w:t></w:r></w:p>\n`
    + '```';
}
body = body.replace(/^\*\*ตารางที่ ([0-9]+)\*\* (.+)\n\n((?:\|.*\n)+)/gm,
  (m, k, cap, tbl) => `${caption('ตารางที่', k, cap.replace(/\*\*/g, ''), 'left')}\n\n${tbl}`);

// รูป: ใช้ไฟล์ SVG ที่สร้างได้ ที่เหลือคงเป็นกล่องบอกตำแหน่งให้ผู้วิจัยใส่ภาพ
const figFile = { 'กรอบแนวคิดการวิจัย': 'fig-framework.svg', 'ขั้นตอนของหนึ่ง run': 'fig-run.svg',
  'ผลต่าง A2 − A1 กับเกณฑ์เทียบเท่า': 'fig-primary.svg', 'ตัวชี้วัดรายกลุ่ม': 'fig-arms.svg',
  'ตัวอย่างร่องรอยการทำงานจริงของเอเจนต์': 'fig-transcript.html' };
if (EDGE) {
  const png = path.join(FIG, 'fig-transcript.png');
  execFileSync(EDGE, ['--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
    '--window-size=900,720', `--screenshot=${png}`, 'file:///' + path.join(FIG, 'fig-transcript.html').replace(/\\/g, '/')], { stdio: 'ignore' });
  for (let i = 0; i < 60 && !fs.existsSync(png); i++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  if (fs.existsSync(png)) pngOf['fig-transcript.html'] = 'fig-transcript.png';
}
body = body.replace(/^> \*\*\[รูปที่ ([0-9]+) ([^\]]+)\]\*\*(.*)$/gm, (m, k, title, rest) => {
  const f = figFile[title.trim()];
  if (f) return `::: {custom-style="Captioned Figure"}\n![](figures/${pngOf[f] ?? f}){width=100%}\n:::\n\n${caption('รูปที่', k, title.trim(), 'center')}`;
  return `::: {custom-style="Block Text"}\n[ตำแหน่งรูปที่ ${k} ${title.trim()} — ผู้วิจัยใส่ภาพ]${rest}\n:::\n\n${caption('รูปที่', k, title.trim(), 'center')}`;
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
    // ข้ามเฉพาะ raw openxml · บล็อกข้อความที่ส่งให้เอเจนต์ (```text) ต้องได้จุดตัดคำด้วย ไม่งั้นบรรทัดไทยยาวขึ้นบรรทัดใหม่ไม่ได้
    if (/^```\{=openxml\}/.test(line)) { inFence = true; out.push(line); continue; }
    if (inFence && /^```\s*$/.test(line)) { inFence = false; out.push(line); continue; }
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
