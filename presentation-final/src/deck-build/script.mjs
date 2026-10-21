import fs from 'fs';
const D='E:/Seminar/skillbench/presentation-final';
const j=JSON.parse(fs.readFileSync(D+'/deck-th/deck.json','utf8'));
const strip=s=>s.replace(/<br\s*\/?>/g,' ').replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
let out='# บทพูด SkillBench (ฉบับ 21 ต.ค. 2569)\n\nรวมจากบทพูดในสไลด์ deck-th/slides ถ้าแก้บทพูด ให้แก้ในไฟล์สไลด์แล้วสร้างไฟล์นี้ใหม่\n\n';
let mainSec=0, total=0;
const toSec=t=>{const m=t.match(/(\d+):(\d+)/);return m?(+m[1])*60+(+m[2]):0};
const EXTRA=['cost'];const isB=id=>id.startsWith('b')||EXTRA.includes(id);
const main=j.order.filter(id=>!isB(id));
// สไลด์สำรองถูกตัดออกจากเด็คแล้ว แต่ยังเก็บคำตอบไว้ในบทพูดสำหรับตอบด้วยปาก
const BK=['cost','b1-sensitivity','b2-decompose','b3-deviations','b4-claude','b5-trigger','b6-oneshot'];
const all=j.order.concat(BK.filter(id=>!j.order.includes(id)));
const rows=[];
all.forEach((id,i)=>{
  const h=fs.readFileSync(`${D}/deck-th/slides/${id}.html`,'utf8');
  const title=strip((h.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/)||['',''])[1]);
  const aside=(h.match(/<aside>([\s\S]*?)<\/aside>/)||['',''])[1].trim();
  const backup=isB(id);
  if(i===main.length) out+='\n---\n\n# คำตอบเตรียมไว้ (ไม่มีสไลด์ ตอบด้วยปากแล้วบอกเลขตารางในเล่ม)\n\n';
  const head=aside.match(/^\[([^\]]+)\]\s*/);
  const meta=head?head[1]:'';
  const body=head?aside.slice(head[0].length):aside;
  const paras=body.split(/\n\s*\n/).map(p=>p.trim()).filter(Boolean);
  const say=paras.filter(p=>!/^(ถ้าถูกถาม|ห้ามพูด)/.test(p));
  const qa=paras.filter(p=>/^(ถ้าถูกถาม|ห้ามพูด)/.test(p));
  const num=backup?(EXTRA.includes(id)?id:id.split('-')[0].toUpperCase()):String(i+1);
  out+=`## ${backup?'คำถามเรื่อง ':'หน้า '+num+' '}${title}\n\n`;
  if(meta) out+=`${meta}\n\n`;
  if(!backup){ rows.push([num,meta]); total+=toSec(meta); }
  out+=say.map(p=>p).join('\n\n')+'\n\n';
  if(qa.length) out+='เตรียมไว้ตอบ\n\n'+qa.map(p=>'- '+p).join('\n')+'\n\n';
});
const mm=Math.floor(total/60), ss=String(total%60).padStart(2,'0');
out=out.replace('\n\n## หน้า 1', `\n\nเวลารวมตามบทราว ${mm}:${ss} นาที ธีรภาพพูดทุกหน้าและตอบคำถาม ธีรภัทร์เลื่อนสไลด์ที่คอม\n\n## หน้า 1`);
fs.writeFileSync(D+'/SCRIPT-TH.md',out);
console.log('total',mm+':'+ss, out.length);
