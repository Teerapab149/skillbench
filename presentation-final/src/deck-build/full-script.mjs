// สคริปต์นำเสนอฉบับเต็ม: พูดไทยตามบทในสไลด์ไทย ใช้สไลด์อังกฤษ และมีประโยคอังกฤษตอนเปิด ปิด และถามตอบ
//   node full-script.mjs <scratch dir ที่มี render-en/s01.png ...>
// ได้ presentation-final/SCRIPT-FULL.md และ SCRIPT-FULL.pdf (PDF ไม่เข้า git)
import fs from 'fs';
import { execFileSync } from 'child_process';
const P = 'E:/Seminar/skillbench/presentation-final';
const S = process.argv[2];
const deck = JSON.parse(fs.readFileSync(P + '/deck-th/deck.json', 'utf8'));
const strip = (s) => s.replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const toSec = (t) => { const m = t.match(/(\d+):(\d+)/); return m ? +m[1] * 60 + +m[2] : 0; };

// ประโยคอังกฤษ [ประโยค, คำอ่าน]
const OPEN = [
  ['Good afternoon, everyone.', 'กู๊ด อาฟเตอร์นูน, เอฟวรีวัน'],
  ['Welcome to our guests from Malaysia.', 'เวลคัม ทู อาวเวอร์ เกสต์ส ฟรอม มาเลเชีย'],
  ['Our study has many technical details.', 'อาวเวอร์ สตัดดี้ แฮส เมนี่ เทคนิคอล ดีเทลส์'],
  ['To explain them clearly, we will speak in Thai.', 'ทู เอ็กซ์เพลน เดม เคลียร์ลี่, วี วิล สปีค อิน ไท'],
  ['The slides are in English, so you can follow along.', 'เดอะ สไลด์ส อาร์ อิน อิงลิช, โซ ยู แคน ฟอลโล อะลอง'],
];
const CLOSE = [
  ['Thank you very much.', 'แธงค์ ยู เวรี่ มัช'],
  ['Questions in English are welcome.', 'เควสชั่นส์ อิน อิงลิช อาร์ เวลคัม'],
];
const QA_EN = [
  ['Thank you for your question.', 'แธงค์ ยู ฟอร์ ยัวร์ เควสชั่น', 'พูดก่อนตอบทุกครั้ง ได้เวลาคิดเพิ่ม'],
  ['Sorry, could you say that again slowly?', 'ซอรี่, คูด ยู เซย์ แดท อะเกน สโลลี่', 'ถ้าฟังไม่ทัน'],
  ['May I answer in Thai?', 'เมย์ ไอ แอนเซอร์ อิน ไท', 'แล้วตอบเป็นไทย อาจารย์หรือเพื่อนช่วยสรุปเป็นอังกฤษได้'],
];
// คำถามที่น่าจะโดนถาม กับสไลด์สำรองที่เปิดตอบ
const BACKUP = [
  ['เจอตัวตรวจผิดหลังล็อกแผน เชื่อผลได้ไหม', 'B1'],
  ['ส่วนต่าง 2.8 มาจากไหน', 'B2'],
  ['ทำไมหยุดที่ 3 รอบ', 'B3'],
  ['ใช้ Claude ทำวิจัยที่ทดลอง Claude ลำเอียงไหม', 'B4'],
  ['AI เลือกเปิด skill ถูกไหม', 'B5'],
  ['ทำไมต้องมีข้อความตอบกลับหลังรอบแรก', 'B6'],
];

const main = deck.order.filter((id) => !id.startsWith('b'));
let total = 0;
const slides = main.map((id, i) => {
  const th = fs.readFileSync(`${P}/deck-th/slides/${id}.html`, 'utf8');
  const en = fs.readFileSync(`${P}/deck-en/slides/${id}.html`, 'utf8');
  const title = strip((en.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/) || ['', ''])[1]);
  const aside = (th.match(/<aside>([\s\S]*?)<\/aside>/) || ['', ''])[1].trim();
  const head = aside.match(/^\[([^\]]+)\]\s*/);
  const meta = head ? head[1] : '';
  total += toSec(meta);
  const paras = (head ? aside.slice(head[0].length) : aside).split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return { n: i + 1, id, title, meta, say: paras.filter((p) => !/^(ถ้าถูกถาม|ห้ามพูด)/.test(p)), qa: paras.filter((p) => /^(ถ้าถูกถาม|ห้ามพูด)/.test(p)) };
});
const mm = Math.floor(total / 60), ss = String(total % 60).padStart(2, '0');

// markdown
const enMd = (rows) => rows.map(([e, r]) => `> **${e}**  \n> ${r}`).join('\n>\n');
let md = `# สคริปต์นำเสนอฉบับเต็ม (พูดไทย ใช้สไลด์อังกฤษ)\n\nวันที่ 22 ต.ค. 2569 ช่วงบ่าย ใช้ไฟล์ SkillBench-final-EN.pptx\n\n`;
md += `เวลาพูดรวมราว ${mm}:${ss} นาที บวกประโยคอังกฤษตอนเปิดและปิดราว 30 วินาที คนที่ 1 พูดหน้า 1 ถึง 8 คนที่ 2 พูดหน้า 9 ถึง 14\n\n`;
md += `วิธีอ่าน: บล็อกที่มีเส้นด้านซ้ายคือประโยคภาษาอังกฤษพร้อมคำอ่าน ข้อความปกติคือบทพูดภาษาไทย "เตรียมไว้ตอบ" ไม่ต้องพูด ใช้ตอนถูกถาม\n\n---\n\n`;
for (const s of slides) {
  md += `## หน้า ${s.n} ${s.title}\n\n${s.meta}\n\n`;
  if (s.id === 'cover') md += `พูดภาษาอังกฤษก่อน\n\n${enMd(OPEN)}\n\nแล้วต่อด้วยภาษาไทย\n\n`;
  md += s.say.join('\n\n') + '\n\n';
  if (s.id === 'close') md += `ปิดด้วยภาษาอังกฤษ\n\n${enMd(CLOSE)}\n\n`;
  if (s.qa.length) md += 'เตรียมไว้ตอบ\n\n' + s.qa.map((p) => '- ' + p).join('\n') + '\n\n';
}
md += `---\n\n## ช่วงถามตอบ\n\nถ้าถูกถามเป็นภาษาอังกฤษ\n\n` + QA_EN.map(([e, r, w]) => `> **${e}**  \n> ${r}  \n> (${w})`).join('\n>\n') + '\n\n';
md += `สไลด์สำรองที่เปิดตอบได้ทันที\n\n` + BACKUP.map(([q, b]) => `- ${q}: เปิด ${b}`).join('\n') + '\n\n';
md += `คำที่ห้ามหลุด: "เหมือนกัน" (ใช้ "เทียบเท่า"), "Skills ดีกว่า" (ใช้ "ไม่ด้อยกว่า"), "การเปิดอ่านทีละชุดไม่มีผล" (ใช้ "ยังไม่ได้ทดสอบ")\n`;
fs.writeFileSync(P + '/SCRIPT-FULL.md', md);

// PDF ขนาดอ่านบนมือถือ
const enHtml = (rows, cls = '') => `<div class="en ${cls}">${rows.map(([e, r, w]) => `<p><b>${esc(e)}</b><br><span class="rd">${esc(r)}</span>${w ? `<br><span class="w">${esc(w)}</span>` : ''}</p>`).join('')}</div>`;
let pages = '';
for (const s of slides) {
  const img = `file:///${S}/render-en/s${String(s.n).padStart(2, '0')}.png`;
  pages += `<section><div class="top"><span class="num">หน้า ${s.n} จาก 14</span><span class="meta">${esc(s.meta)}</span></div><img src="${img}">${s.id === 'cover' ? '' : `<h2>${esc(s.title)}</h2>`}`;
  if (s.id === 'cover') pages += `<div class="lbl">พูดภาษาอังกฤษก่อน</div>${enHtml(OPEN)}<div class="lbl">แล้วต่อด้วยภาษาไทย</div>`;
  pages += s.say.map((p) => `<p>${esc(p)}</p>`).join('');
  if (s.id === 'close') pages += `<div class="lbl">ปิดด้วยภาษาอังกฤษ</div>${enHtml(CLOSE)}`;
  if (s.qa.length) pages += `<div class="qa"><div class="qh">เตรียมไว้ตอบ ไม่ต้องพูด</div>${s.qa.map((p) => `<p>${esc(p)}</p>`).join('')}</div>`;
  pages += '</section>';
}
pages += `<section><h2>ช่วงถามตอบ</h2><div class="lbl">ถ้าถูกถามเป็นภาษาอังกฤษ</div>${enHtml(QA_EN)}<div class="lbl">สไลด์สำรองที่เปิดตอบได้ทันที</div>${BACKUP.map(([q, b]) => `<p>${esc(q)}: <b>${b}</b></p>`).join('')}<div class="qa"><div class="qh">คำที่ห้ามหลุด</div><p>"เหมือนกัน" ใช้ "เทียบเท่า"</p><p>"Skills ดีกว่า" ใช้ "ไม่ด้อยกว่า"</p><p>"การเปิดอ่านทีละชุดไม่มีผล" ใช้ "ยังไม่ได้ทดสอบ"</p></div></section>`;
const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&family=Anuphan:wght@600&display=swap">
<style>
@page{size:100mm 222mm;margin:7mm 6mm}
body{margin:0;font-family:'Sarabun',Tahoma,sans-serif;font-size:12pt;line-height:1.55;color:#1B1F2A}
section{break-before:page}
.cover{padding-top:26mm}
.cover h1{font-family:'Anuphan',Tahoma,sans-serif;font-size:19pt;line-height:1.3;margin:0 0 6mm}
.top{display:flex;justify-content:space-between;font-size:10pt;color:#5A6070;margin-bottom:2mm}
.num{font-weight:700;color:#3B5B92}
img{width:100%;aspect-ratio:16/9;box-sizing:border-box;border:1px solid #ddd;border-radius:2mm;display:block}
h2{font-family:'Anuphan',Tahoma,sans-serif;font-size:12pt;line-height:1.35;margin:3mm 0 2mm;color:#3A4152}
p{margin:0 0 3mm}
.lbl{font-size:9.5pt;font-weight:700;color:#C0392B;margin:3mm 0 1mm}
.en{border-left:1.2mm solid #C0392B;background:#FBF1EF;padding:2.5mm 3mm;border-radius:1mm}
.en p{margin:0 0 2.5mm;break-inside:avoid}.en b{font-size:12.5pt}
.rd{color:#5A6070;font-size:11pt}.w{color:#3B5B92;font-size:10pt}
.qa{margin-top:4mm;padding:3mm;background:#F2F3F6;border-radius:2mm;font-size:10.5pt;line-height:1.5;color:#3A4152}
.qa p{break-inside:avoid}
.qh{font-weight:700;font-size:10pt;color:#5A6070;margin-bottom:2mm}
</style></head><body>
<div class="cover"><h1>สคริปต์นำเสนอฉบับเต็ม</h1><p>พูดภาษาไทย ใช้สไลด์ภาษาอังกฤษ (SkillBench-final-EN.pptx)</p><p>หน้าละหนึ่งสไลด์ กรอบสีแดงคือประโยคภาษาอังกฤษพร้อมคำอ่าน ข้อความปกติคือบทพูดภาษาไทย กล่องสีเทาคือคำตอบเตรียมไว้</p><p>เวลาพูดรวมราว ${mm}:${ss} นาที บวกประโยคอังกฤษราว 30 วินาที คนที่ 1 พูดหน้า 1 ถึง 8 คนที่ 2 พูดหน้า 9 ถึง 14</p><p>ฉบับ 19 ต.ค. 2569</p></div>
${pages}</body></html>`;
fs.writeFileSync(S + '/script-full.html', html);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const out = P + '/SCRIPT-FULL.pdf';
if (fs.existsSync(out)) fs.rmSync(out);
execFileSync(EDGE, ['--headless', '--disable-gpu', '--no-pdf-header-footer', '--virtual-time-budget=8000', `--print-to-pdf=${out}`, 'file:///' + S + '/script-full.html'], { stdio: 'ignore' });
for (let k = 0; k < 60 && !fs.existsSync(out); k++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
console.log('total', `${mm}:${ss}`, fs.existsSync(out) ? 'pdf ' + fs.statSync(out).size : 'pdf missing');
