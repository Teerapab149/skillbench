const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='E:/Seminar/skillbench/presentation-final';
const OUT='C:/Users/MARU/AppData/Local/Temp/claude/E--Seminar/75354cfb-9955-487c-aacd-7d920e5827e1/scratchpad/pptx-build/layout.json';
const T={'.html':'text/html; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
http.createServer((q,r)=>{
 if(q.method==='POST'){let b='';q.on('data',c=>b+=c);q.on('end',()=>{fs.writeFileSync(OUT,b);r.end('saved '+b.length)});return}
 const p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);return r.end('nf')}r.writeHead(200,{'Content-Type':T[path.extname(p)]||'application/octet-stream'});r.end(b)})}).listen(4390);
