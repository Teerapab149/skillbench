import fs from 'fs';
const LANG = process.argv.includes('--en') ? 'en' : 'th';
const D = 'E:/Seminar/skillbench/presentation-final/deck-' + LANG;
const blob = {'1de174696c07bfe9299c5de1fe77d79b':'fig-s2-invoice.png','84fe40d824551477faa87d0de4285e90':'fig-s8-primary.png','53478a93bae21a87281d9b4c5def5c84':'fig-s9-rules.png','693c927e191d58cf5a77832808c9bffa':'qr-site.png','6c9b264b7f07e547134c8cb019921b5d':'fig-measure-transcript.png','2584f8f3dd83b03295ff355d7cb9d350':'fig-b1-sensitivity.png'};
const j = JSON.parse(fs.readFileSync(D+'/deck.json','utf8'));
const head = fs.readFileSync('E:/Seminar/skillbench/presentation-final/deck-th/preview.html','utf8').split('<div class=f>')[0];
let out = head;
for (const id of j.order){
  let h = fs.readFileSync(`${D}/slides/${id}.html`,'utf8');
  h = h.replace(/<aside>[\s\S]*?<\/aside>/,'').replace(/\/_blob\/([0-9a-f]{32})/g,(m,k)=>{ if(!blob[k]) throw new Error('blob '+k); return '../figures/'+blob[k]; });
  h = h.split('../../figures/').join('../figures/'); h = h.replace('<section ', `<section data-id="${id}" `);
  out += `<div class=f><div class=lab>${id}</div>${h}</div>`;
}
fs.writeFileSync(D+'/preview.html', out);
console.log('slides', j.order.length);
