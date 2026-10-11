// คัดลอก site/dist ไปที่ docs/ ของ repo (GitHub Pages เสิร์ฟ main:/docs)
// ไม่แตะ docs/progress2/ และ docs/.nojekyll ที่มีอยู่แล้ว
import fs from 'node:fs';
import path from 'node:path';

const site = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const dist = path.join(site, 'dist');
const docs = path.resolve(site, '..', 'docs');
const KEEP = new Set(['progress2', '.nojekyll', 'study3-scenario-review.md']);

for (const name of fs.readdirSync(docs)) {
  if (KEEP.has(name)) continue;
  fs.rmSync(path.join(docs, name), { recursive: true, force: true });
}
fs.cpSync(dist, docs, { recursive: true });
if (!fs.existsSync(path.join(docs, '.nojekyll'))) fs.writeFileSync(path.join(docs, '.nojekyll'), '');
console.log(`คัดลอก ${dist} → ${docs} (เก็บ ${[...KEEP].join(', ')} ไว้)`);
