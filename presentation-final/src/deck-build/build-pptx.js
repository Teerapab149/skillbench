// สร้าง pptx จากตำแหน่งจริงของสไลด์ (layout.json) ข้อความเป็น text box แก้ได้ใน Canva
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const PF = 'E:/Seminar/skillbench/presentation-final';
const LANG = process.argv.includes('--en') ? 'en' : 'th';
const slides = JSON.parse(fs.readFileSync(path.join(__dirname, 'layout.json'), 'utf8'));
const IN = 13.333 / 1920; // px ต่อนิ้ว
const PT = 0.5; // px เป็น pt (1920px เท่ากับ 13.333 นิ้ว)
const i = (v) => +(v * IN).toFixed(4);

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.title = 'SkillBench นำเสนอ final';
pres.author = 'ธีรภาพ บุญศรี และธีรภัทร์ ชินวุฒิวงศ์';

const notesOf = (id) => {
  const h = fs.readFileSync(path.join(PF, 'deck-' + LANG + '/slides', id + '.html'), 'utf8');
  const m = h.match(/<aside>([\s\S]*?)<\/aside>/);
  return m ? m[1].trim() : '';
};

const runsToText = (runs, base = {}) => {
  const out = [];
  runs.forEach((r, k) => {
    if (r.br) { if (out.length) out[out.length - 1].options.breakLine = true; return; }
    out.push({ text: r.t, options: { bold: r.b, color: r.c || '1B1F2A', fontFace: r.f, fontSize: +(r.s * PT).toFixed(1), ...base } });
  });
  return out;
};

const sections = { cover: 'ปัญหาและคำถาม', arena: 'วิธีทดลอง', result: 'ผล', limits: 'ข้อจำกัดและสรุป', cost: 'สไลด์สำรอง' };
let sec = '';

for (const s of slides) {
  if (sections[s.id]) { sec = sections[s.id]; pres.addSection({ title: sec }); }
  const slide = pres.addSlide({ sectionTitle: sec });
  slide.background = { color: s.bg || 'FFFFFF' };
  for (const it of s.items) {
    if (it.k === 'rect') {
      slide.addShape(it.rad > 0 ? pres.ShapeType.roundRect : pres.ShapeType.rect, {
        x: i(it.x), y: i(it.y), w: i(it.w), h: i(it.h), fill: { color: it.bg }, line: { color: it.bg, width: 0 },
        ...(it.rad > 0 ? { rectRadius: Math.min(0.5, it.rad / Math.min(it.w, it.h)) } : {}),
      });
    } else if (it.k === 'vline') {
      slide.addShape(pres.ShapeType.rect, { x: i(it.x), y: i(it.y), w: i(it.w), h: i(it.h), fill: { color: it.c }, line: { color: it.c, width: 0 } });
    } else if (it.k === 'img') {
      const file = it.src.replace(/^\.\.\/figures\//, PF + '/figures/');
      // object-fit: contain
      const sc = Math.min(it.w / it.nw, it.h / it.nh);
      const dw = it.nw * sc, dh = it.nh * sc;
      const dx = it.x + (it.w - dw) / 2, dy = it.y + (it.h - dh) / 2;
      if (it.bg) slide.addShape(it.rad > 0 ? pres.ShapeType.roundRect : pres.ShapeType.rect, { x: i(it.x), y: i(it.y), w: i(it.w), h: i(it.h), fill: { color: it.bg }, line: { color: it.bg, width: 0 }, ...(it.rad > 0 ? { rectRadius: 0.1 } : {}) });
      slide.addImage({ path: file, x: i(dx), y: i(dy), w: i(dw), h: i(dh) });
    } else if (it.k === 'text') {
      const lh = Number.isFinite(it.lh) ? it.lh : 1.3;
      // เผื่อความกว้างเล็กน้อย เพราะ PowerPoint และ Canva ตัดคำภาษาไทยไม่เหมือนเบราว์เซอร์
      const extra = it.align === 'center' ? 0 : 1920 - 64 - (it.x + it.w);
      slide.addText(runsToText(it.runs), {
        x: i(it.x), y: i(it.y), w: i(it.w + Math.max(0, extra)), h: i(it.h + 6),
        margin: 0, valign: 'top', align: it.align === 'center' ? 'center' : 'left', lineSpacingMultiple: +(lh * 0.92).toFixed(2), isTextBox: true, fit: 'none', wrap: false,
      });
    } else if (it.k === 'table') {
      const rows = it.rows.map((row) => row.cells.map((c) => ({
        // ภาษาอังกฤษ: ให้ PowerPoint ตัดบรรทัดในตารางเอง เพราะความกว้างตัวอักษรต่างจากเบราว์เซอร์ จุดตัดที่วัดมาจึงซ้อนกับการตัดอัตโนมัติ
        text: (() => { const rs = LANG === 'en' ? c.runs.map((r) => (r.br ? { t: ' ', b: false, c: null, f: 'Sarabun', s: it.fs } : r)) : c.runs; const tx = runsToText(rs); return tx.length ? tx : ''; })(),
        options: {
          fill: row.bg ? { color: row.bg } : undefined, valign: 'middle', align: c.align === 'right' ? 'right' : 'left',
          fontFace: 'Sarabun', fontSize: +(it.fs * PT).toFixed(1), color: '1B1F2A', bold: c.th || undefined,
          margin: [0.069, 0.111, 0.069, 0.111],
          border: [{ type: 'none' }, { type: 'none' }, { pt: 0.75, color: 'CCCCCC' }, { type: 'none' }],
        },
      })));
      slide.addTable(rows, { x: i(it.x), y: i(it.y), w: i(it.w), colW: it.rows[0].cells.map((c) => i(c.w)), rowH: it.rows.map((r) => i(r.h)) });
    }
  }
  const n = notesOf(s.id);
  if (n) slide.addNotes(n);
}

const out = path.join(PF, LANG === 'en' ? 'SkillBench-final-EN.pptx' : 'SkillBench-final-TH.pptx');
pres.writeFile({ fileName: out }).then(() => console.log('wrote', out));
