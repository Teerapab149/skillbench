import fs from 'fs';
import { execFileSync } from 'child_process';
const D='E:/Seminar/skillbench/presentation-final';
const R='C:/Users/MARU/AppData/Local/Temp/claude/E--Seminar/75354cfb-9955-487c-aacd-7d920e5827e1/scratchpad/pptx-build/render';
const S=process.argv[2];
const j=JSON.parse(fs.readFileSync(D+'/deck-th/deck.json','utf8'));
const strip=s=>s.replace(/<br\s*\/?>/g,' ').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
let total=0; const toSec=t=>{const m=t.match(/(\d+):(\d+)/);return m?(+m[1])*60+(+m[2]):0};
let pages='';
j.order.forEach((id,i)=>{
  const h=fs.readFileSync(`${D}/deck-th/slides/${id}.html`,'utf8');
  const title=strip((h.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/)||['',''])[1]);
  const aside=(h.match(/<aside>([\s\S]*?)<\/aside>/)||['',''])[1].trim();
  const head=aside.match(/^\[([^\]]+)\]\s*/); const meta=head?head[1]:'ใช้ตอนถูกถาม';
  const body=head?aside.slice(head[0].length):aside;
  const paras=body.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
  const say=paras.filter(p=>!/^(ถ้าถูกถาม|ห้ามพูด)/.test(p)), qa=paras.filter(p=>/^(ถ้าถูกถาม|ห้ามพูด)/.test(p));
  const backup=id.startsWith('b'); if(!backup) total+=toSec(meta);
  const num=backup?'สำรอง '+id.split('-')[0].toUpperCase():`หน้า ${i+1} จาก 14`;
  const img=`file:///${R}/s${String(i+1).padStart(2,'0')}.png`;
  pages+=`<section><div class="top"><span class="num">${num}</span><span class="meta">${esc(meta)}</span></div>
<img src="${img}"><h2>${esc(title)}</h2>
${say.map(p=>`<p>${esc(p)}</p>`).join('')}
${qa.length?`<div class="qa"><div class="qh">เตรียมไว้ตอบ ไม่ต้องพูด</div>${qa.map(p=>`<p>${esc(p)}</p>`).join('')}</div>`:''}</section>`;
});
const mm=Math.floor(total/60), ss=String(total%60).padStart(2,'0');
const html=`<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&family=Anuphan:wght@600&display=swap">
<style>
@page{size:100mm 178mm;margin:7mm 6mm}
body{margin:0;font-family:'Sarabun',Tahoma,sans-serif;font-size:12pt;line-height:1.55;color:#1B1F2A}
section{break-before:page}
section:first-of-type{break-before:auto}
.cover{break-after:page;padding-top:30mm}
.cover h1{font-family:'Anuphan',Tahoma,sans-serif;font-size:20pt;line-height:1.3;margin:0 0 6mm}
.top{display:flex;justify-content:space-between;font-size:10pt;color:#5A6070;margin-bottom:2mm}
.num{font-weight:700;color:#3B5B92}
img{width:100%;aspect-ratio:16/9;box-sizing:border-box;border:1px solid #ddd;border-radius:2mm;display:block}
h2{font-family:'Anuphan',Tahoma,sans-serif;font-size:12.5pt;line-height:1.35;margin:3mm 0 2mm}
p{margin:0 0 3mm;orphans:3;widows:3}
.qa p{break-inside:avoid}.qa{margin-top:4mm;padding:3mm;background:#F2F3F6;border-radius:2mm;font-size:11pt;line-height:1.55;color:#3A4152}
.qh{font-weight:700;font-size:10pt;color:#5A6070;margin-bottom:2mm}
</style></head><body>
<div class="cover"><h1>บทพูด SkillBench</h1><p>หน้าละหนึ่งสไลด์ ภาพด้านบนคือสไลด์ ตัวหนังสือคือบทที่ต้องพูด กล่องสีเทาคือคำตอบเตรียมไว้เผื่อถูกถาม</p><p>เวลารวมตามบทราว ${mm}:${ss} นาที คนที่ 1 พูดหน้า 1 ถึง 8 คนที่ 2 พูดหน้า 9 ถึง 14</p><p>ฉบับ 19 ต.ค. 2569</p></div>
${pages}</body></html>`;
fs.writeFileSync(S+'/script-print.html',html);
const EDGE='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const out=D+'/SCRIPT-TH.pdf'; if(fs.existsSync(out)) fs.rmSync(out);
execFileSync(EDGE,['--headless','--disable-gpu','--no-pdf-header-footer','--virtual-time-budget=8000',`--print-to-pdf=${out}`,'file:///'+S+'/script-print.html'],{stdio:'ignore'});
for(let k=0;k<60&&!fs.existsSync(out);k++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,250);
console.log(fs.existsSync(out)?'ok '+fs.statSync(out).size:'missing');
