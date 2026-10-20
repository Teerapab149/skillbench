// บทพูดภาษาอังกฤษแบบง่าย (ประโยคสั้น คำพื้นฐาน) สำหรับธีรภาพพูดทั้งชุด ใช้กับสไลด์ deck-en
//   node script-en-simple.mjs <scratch dir ที่มี render-en/s01.png ...>
// ได้ presentation-final/SCRIPT-EN-SIMPLE.md และ <scratch>/script-en-simple.html (พิมพ์เป็น PDF ภายหลัง)
import fs from 'fs';
const P = 'E:/Seminar/skillbench/presentation-final';
const S = process.argv[2];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// [id, เวลา, ย่อหน้าที่พูด, คำยากในหน้านี้ [คำ, คำอ่าน]]
const SLIDES = [
  ['cover', '0:40', [
    'Good afternoon, everyone. We would like to welcome our guests from Malaysia and Indonesia.',
    'My name is Teerapab Boonsri, and this is Teeraphat Chinwuttiwong.',
    'Today, we want to answer one question. How should we write rules for an AI, so that the AI follows them?',
  ], [['Indonesia', 'อินโดนีเซีย']]],
  ['ai-today', '0:35', [
    'Most of us use chat AI, like ChatGPT. We ask a question, the AI answers, and we do the work ourselves.',
    'But now there is a new kind of AI. Tools like Claude Code can open files, change code and run commands by themselves.',
    'This is fast. But if the AI makes a mistake, the mistake goes straight into the real system. Let me show you an example from our study.',
  ], [['ourselves', 'อาวเวอร์เซลฟส์'], ['commands', 'คอมแมนด์ส']]],
  ['problem', '0:45', [
    'A user asked the AI to change the price of a V100 machine, from 20 baht to 25 baht per hour.',
    'The AI did it correctly. The new price is 25 baht.',
    'But this system calculates old bills with the current price. So last month\'s bill, which the customer already paid, changed from 200 baht to 250 baht. And nobody was told.',
    'The AI followed the order, but it did not check the side effects.',
  ], [['calculates', 'แคลคิวเลทส์'], ['side effects', 'ไซด์ อิฟเฟคส์']]],
  ['two-ways', '0:55', [
    'To prevent this, teams write rules for the AI to read before it starts. There are two ways to write them.',
    'Way one: put all the rules in one file. The AI reads the whole file every time. It is like reading the whole handbook.',
    'Way two is called Agent Skills. The rules are split by topic. The AI first sees only a short list, like a table of contents. Then it opens only the topic it needs.',
    'The idea is simple. If the AI does not read rules it does not need, it may follow the important rules better. But as far as we know, nobody has tested this directly.',
  ], [['handbook', 'แฮนด์บุ๊ก'], ['table of contents', 'เทเบิล ออฟ คอนเทนส์']]],
  ['question', '0:45', [
    'So our question is: with the same rules, written in these two ways, does the AI follow them differently?',
    'We used one AI, Claude Sonnet 5, in four groups. One group had no rules. Two groups are our main pair, one file and Agent Skills. Both have the same 47 obligations.',
    'The last group got the exact same text as Skills, but read all of it from the start.',
    'Before we collected any data, we locked our decision rule on GitHub.',
  ], [['obligations', 'ออบลิเกชั่นส์'], ['exact', 'อิกแซคท์']]],
  ['arena', '0:45', [
    'We built a simple booking system for GPU machines, and we wrote 22 tasks. 20 of them hide a trap.',
    'Here are three examples. Changing a price, where old bills change too. A broken report, where the easy fix is to delete data. And two rules that conflict, where a good AI should stop and ask.',
    'Every group did every task three times. That is 264 runs.',
  ], [['conflict', 'คอนฟลิกท์'], ['booking', 'บุ๊คกิ้ง']]],
  ['measure', '0:55', [
    'How did we score? We let the AI finish the task. Then a program checks what it really did: the commands, the changed files, the message to the user, and the bill totals.',
    'This table is a real result for the price task. The AI with no rules did not check the totals, and did not tell the user. It passed 6 of 9 rules. The AI with one file passed 8 of 9. It was the same in all three rounds.',
    'If the task is not finished, the score is zero. And no person, and no other AI, gives the score.',
  ], [['totals', 'โททัลส์']]],
  ['three-studies', '0:45', [
    'To be honest, our measuring tool was not good at first. We ran three studies.',
    'In study one, missing one rule gave zero points, so all groups looked the same.',
    'In study two, an AI that stopped to ask a question was counted as a failure, and three of our checkers were wrong.',
    'In study three, we fixed these problems. We doubled the tasks and tested the tool first. This study gave us an answer.',
  ], [['honest', 'ออเนสท์ (ไม่ออกเสียง h)'], ['measuring', 'เมเชอริ่ง']]],
  ['result', '1:20', [
    'Here is the main result. One file scored 94.5. Agent Skills scored 97.2. The gap is 2.8 points.',
    'Before the study, we set a line. If the gap is within 12.5 points, we call them equivalent. Why 12.5? Each task has about 8 critical rules. Missing one rule loses about 12.5 points. So the line means about one rule per task.',
    'We only had 22 tasks, so the number can move. The 90 percent confidence interval is from minus 0.1 to plus 5.8. The whole range is inside the line, so they are equivalent.',
    'Equivalent does not mean identical. What we can say clearly is this: Skills is not worse than one file. Two other analyses give the same answer.',
  ], [['equivalent', 'อีควิฟวะเลนท์'], ['confidence interval', 'คอนฟิเดนซ์ อินเทอร์วัล'], ['identical', 'ไอเดนทิคัล'], ['analyses', 'อะนาลิซีส']]],
  ['rules-matter', '0:45', [
    'The clearer difference is between having rules and having no rules.',
    'In the two tasks where old bills change, the AI with no rules never told the user. Zero of six. Every group with rules told the user. Six of six.',
    'This is an extra observation, not our main test. And we cannot tell if it comes from the rules themselves, or just from more text.',
  ], [['observation', 'ออบเซอร์เวชั่น'], ['themselves', 'เดมเซลฟส์']]],
  ['limits', '0:45', [
    'Our results have limits. We used one AI model, Thai instructions, one test system, and short rules.',
    'Scores were almost full, so we can only say Skills is not worse. We cannot say it is better.',
    'We did not test whether loading on demand helps, because our plan allowed that test only if the main result found a difference.',
    'And we used Claude to help with our work. To reduce bias, a program does the scoring, the plan was locked, and all our history is public.',
  ], [['whether', 'เว็ทเธอร์'], ['bias', 'ไบแอส']]],
  ['takeaways', '0:35', [
    'So what can teams do? First, always give your AI rules, especially about scope and about checking impact.',
    'Second, one file or Skills both work, so choose the one your team can maintain.',
    'Third, if you use Skills, describe clearly when each skill should be used, and let the AI ask questions.',
  ], [['maintain', 'เมนเทน'], ['impact', 'อิมแพคท์']]],
  ['close', '0:30', [
    'To sum up: one file or Skills gives equivalent results, but you should have rules. The second part is an extra observation.',
    'You can scan this QR code to see everything: the rules, the tasks, the full report and the code.',
    'Thank you very much. We are happy to take your questions.',
  ], []],
];

// ช่วงถามตอบ: ประโยคที่ใช้บ่อย และคำตอบสั้นของคำถามที่น่าจะโดนถามมากที่สุด
const QA_PHRASES = [
  ['Thank you for your question.', 'พูดก่อนตอบทุกครั้ง ได้เวลาคิด'],
  ['Sorry, could you say that again slowly?', 'ถ้าฟังไม่ทัน'],
  ['That is a good point. It is one of our limits, in section 6.4 of our report.', 'ใช้กับคำวิจารณ์ที่เป็นข้อจำกัดจริง'],
  ['May I answer in Thai?', 'ถ้าคำถามยาก ตอบเป็นไทยได้'],
];
const QA_ANSWERS = [
  ['Why 12.5?', 'Each task has about 8 critical rules. Missing one rule loses about 12.5 points. We set this line before the study, not after we saw the results.'],
  ['Why only three rounds?', 'Our plan allowed two to four rounds. We stopped at three because of our usage quota, and because a fourth round would make the result only a little more precise. We decided this before we looked at the results by group, and we reported it as a deviation.'],
  ['You used Claude to test Claude. Is that biased?', 'A program does all the scoring, not an AI. We locked the plan on GitHub before data collection. All our code and data are public, so anyone can check.'],
  ['Is Skills better than one file?', 'We cannot say better. We can only say Skills is not worse. Scores were almost full, so a big advantage could not show.'],
];

const toSec = (t) => { const m = t.match(/(\d+):(\d+)/); return +m[1] * 60 + +m[2]; };
const total = SLIDES.reduce((a, s) => a + toSec(s[1]), 0);
const mm = Math.floor(total / 60), ss = String(total % 60).padStart(2, '0');
const words = SLIDES.flatMap((s) => s[2]).join(' ').split(/\s+/).length;

// markdown
let md = `# English script (simple version)\n\nใช้กับสไลด์ SkillBench-final-EN.pptx ธีรภาพพูดทุกหน้า ประโยคสั้นและคำพื้นฐาน เวลาตามบทราว ${mm}:${ss} นาที (${words} คำ ถ้าพูดช้า ๆ ราว 100 คำต่อนาที)\n\nถ้านำเสนอช่วงเช้า เปลี่ยน "Good afternoon" เป็น "Good morning"\n\n`;
SLIDES.forEach(([id, t, say, vocab], i) => {
  md += `## ${i + 1}. ${id} (${t})\n\n${say.join('\n\n')}\n\n`;
  if (vocab.length) md += `คำอ่าน: ${vocab.map(([w, r]) => `${w} (${r})`).join(', ')}\n\n`;
});
md += `## Q&A\n\n${QA_PHRASES.map(([e, w]) => `- ${e} (${w})`).join('\n')}\n\n`;
md += QA_ANSWERS.map(([q, a]) => `**${q}**\n\n${a}`).join('\n\n') + '\n';
fs.writeFileSync(P + '/SCRIPT-EN-SIMPLE.md', md);

// html สำหรับพิมพ์เป็น PDF ขนาดอ่านบนมือถือ
let pages = '';
SLIDES.forEach(([id, t, say, vocab], i) => {
  const img = `file:///${S}/render-en/s${String(i + 1).padStart(2, '0')}.png`;
  pages += `<section><div class="top"><span class="num">Slide ${i + 1} of ${SLIDES.length}</span><span class="meta">${t}</span></div><img src="${img}">`;
  pages += say.map((p) => `<p>${esc(p)}</p>`).join('');
  if (vocab.length) pages += `<div class="vo">${vocab.map(([w, r]) => `<span><b>${esc(w)}</b> ${esc(r)}</span>`).join('')}</div>`;
  pages += '</section>';
});
pages += `<section><h2>Q&amp;A</h2><div class="lbl">Useful sentences</div><div class="en">${QA_PHRASES.map(([e, w]) => `<p><b>${esc(e)}</b><br><span class="w">${esc(w)}</span></p>`).join('')}</div>`;
pages += `<div class="lbl">Short answers</div>${QA_ANSWERS.map(([q, a]) => `<div class="qa"><div class="qh">${esc(q)}</div><p>${esc(a)}</p></div>`).join('')}</section>`;
const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&family=Anuphan:wght@600&display=swap">
<style>
@page{size:100mm 222mm;margin:7mm 6mm}
body{margin:0;font-family:'Sarabun',Tahoma,sans-serif;font-size:13pt;line-height:1.5;color:#1B1F2A}
section{break-before:page}
.cover{padding-top:26mm}
.cover h1{font-family:'Anuphan',Tahoma,sans-serif;font-size:19pt;line-height:1.3;margin:0 0 6mm}
.cover p{font-size:12pt}
.top{display:flex;justify-content:space-between;font-size:10pt;color:#5A6070;margin-bottom:2mm}
.num{font-weight:700;color:#3B5B92}
img{width:100%;aspect-ratio:16/9;box-sizing:border-box;border:1px solid #ddd;border-radius:2mm;display:block;margin-bottom:3mm}
h2{font-family:'Anuphan',Tahoma,sans-serif;font-size:14pt;margin:0 0 3mm}
p{margin:0 0 3mm}
.vo{margin-top:3mm;padding:2.5mm 3mm;background:#F2F3F6;border-radius:2mm;font-size:10.5pt;line-height:1.5;color:#3A4152}
.vo span{display:block}
.lbl{font-size:10pt;font-weight:700;color:#C0392B;margin:3mm 0 1mm}
.en{border-left:1.2mm solid #C0392B;background:#FBF1EF;padding:2.5mm 3mm;border-radius:1mm}
.en p{margin:0 0 2.5mm}.w{color:#3B5B92;font-size:10pt}
.qa{margin-top:3mm;padding:3mm;background:#F2F3F6;border-radius:2mm;font-size:11.5pt;line-height:1.45}
.qa p{margin:0}.qh{font-weight:700;color:#3B5B92;margin-bottom:1mm}
</style></head><body>
<div class="cover"><h1>English script (simple version)</h1><p>ใช้กับสไลด์ภาษาอังกฤษ ธีรภาพพูดทุกหน้า ประโยคสั้นและคำพื้นฐาน</p><p>เวลาตามบทราว ${mm}:${ss} นาที ${words} คำ ถ้าพูดช้า ๆ ราว 100 คำต่อนาที</p><p>กล่องสีเทาใต้บทคือคำอ่านของคำที่อาจออกเสียงยาก หน้าสุดท้ายเป็นประโยคและคำตอบสั้นสำหรับช่วงถามตอบ</p><p>ถ้านำเสนอช่วงเช้า เปลี่ยน "Good afternoon" เป็น "Good morning"</p><p>ฉบับ 21 ต.ค. 2569</p></div>
${pages}</body></html>`;
fs.writeFileSync(S + '/script-en-simple.html', html);
console.log('total', `${mm}:${ss}`, 'words', words);
