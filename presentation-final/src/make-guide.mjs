// สร้างคู่มือผู้พูดจากไฟล์สไลด์จริง (deck-th และ deck-en) เพื่อไม่ให้คู่มือกับสไลด์เพี้ยนจากกัน
// ใช้: node presentation-final/src/make-guide.mjs
// ส่วนหัวและท้าย (คำที่ห้ามพูด ถ้าเวลาน้อย เตรียมตอบคำถาม) อยู่ใน guide-th.md และ guide-en.md ข้างไฟล์นี้
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const decode = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

function visibleLines(html) {
  const body = html.replace(/<aside>[\s\S]*?<\/aside>/, '');
  const rows = [];
  // ตารางเป็นแถวละบรรทัด
  const withRows = body.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/g, (_, r) =>
    '\n' + r.replace(/<\/t[hd]>\s*<t[hd][^>]*>/g, ' | ').replace(/<[^>]+>/g, '') + '\n');
  const text = withRows
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/(p|h1|h2|h3|li|div|table)>/g, '\n')
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, '\n[ภาพ: $1]\n')
    .replace(/<[^>]+>/g, '');
  for (const line of decode(text).split('\n')) {
    const t = line.replace(/\s+/g, ' ').trim();
    if (t) rows.push(t);
  }
  return rows;
}

function slideParts(html) {
  const title = decode((html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/) || [, ''])[1].replace(/<br\s*\/?>/g, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  const notes = decode((html.match(/<aside>([\s\S]*?)<\/aside>/) || [, ''])[1]).trim();
  const lines = visibleLines(html).filter((l) => l !== title);
  return { title, notes, lines };
}

function build(lang) {
  const deckDir = path.join(root, `deck-${lang}`);
  const deck = JSON.parse(fs.readFileSync(path.join(deckDir, 'deck.json'), 'utf8'));
  const [head, tail] = fs.readFileSync(path.join(here, `guide-${lang}.md`), 'utf8').split('<!-- SLIDES -->');
  const L = lang === 'th'
    ? { slide: 'สไลด์', backup: 'สำรอง', screen: 'ขึ้นจอ', notes: 'บทพูด', none: '(ไม่มีบทพูด เปิดเมื่อถูกถาม)' }
    : { slide: 'Slide', backup: 'Backup', screen: 'On screen', notes: 'Speaker notes', none: '(no notes, open only when asked)' };
  let n = 0;
  const parts = deck.order.map((id) => {
    const { title, notes, lines } = slideParts(fs.readFileSync(path.join(deckDir, 'slides', id + '.html'), 'utf8'));
    const isBackup = id.startsWith('b');
    const label = isBackup ? `${L.backup} ${id.slice(0, 2).toUpperCase()}` : `${L.slide} ${++n}`;
    const quoted = notes ? notes.split(/\n+/).map((p) => '> ' + p.trim()).join('\n>\n') : L.none;
    return `## ${label}: ${title}\n\n**${L.screen}**\n\n${lines.map((l) => '- ' + l).join('\n')}\n\n**${L.notes}**\n\n${quoted}\n`;
  });
  const out = head.trimEnd() + '\n\n' + parts.join('\n---\n\n') + '\n---\n\n' + tail.trimStart();
  const file = path.join(root, lang === 'th' ? 'SLIDES-FINAL.md' : 'SLIDES-FINAL-EN.md');
  fs.writeFileSync(file, out);
  console.log('wrote', path.relative(process.cwd(), file), deck.order.length, 'slides');
}

build('th');
build('en');
