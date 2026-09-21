/*
 * สร้าง progress2/explorer/data.js จากข้อมูลจริงในโปรเจกต์
 *
 * หน้า explorer ห้ามมีตัวเลขที่พิมพ์ด้วยมือแม้แต่ตัวเดียว ทุกอย่างต้องมาจาก
 *   results/numbers.json · results-study2/numbers.json   — ตัวเลขสรุป
 *   results/latest.json  · results-study2/latest.json    — run รายตัวและผลตรวจกฎ
 *   arms/**                                               — ข้อความกฎที่ส่งให้เอเจนต์จริง
 *   scenarios/*.json                                      — โจทย์และกฎของแต่ละข้อ
 *
 * รันด้วย  node slides-images/src/make-explorer-data.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const R = process.cwd();
const rd = (p) => fs.readFileSync(path.join(R, p), 'utf8');
const rj = (p) => JSON.parse(rd(p));

/* ---------- run รายตัว · ตัดฟิลด์หนักที่หน้าเว็บไม่ได้ใช้ออก ---------- */
const slimRun = (g) => ({
  id: g.runId,
  sc: g.scenarioId,
  arm: g.armId,
  rep: g.rep,
  rcrc: g.RCRc,
  crit: g.CRIT,
  done: g.taskDone,
  skills: g.loadedSkills ?? [],
  files: g.filesChanged ?? [],
  tools: Array.isArray(g.toolCalls) ? g.toolCalls.length : null,
  ms: g.wallMs ?? null,
  usd: g.costUsd ?? null,
  rules: (g.rules ?? []).map((r) => ({
    id: r.id, sev: r.severity, desc: r.desc, ok: r.passed, app: r.applicable,
  })),
});

const study = (dir) => {
  const latest = rj(dir + '/latest.json');
  const nums = rj(dir + '/numbers.json');
  return {
    stamp: nums.stamp,
    arms: latest.meta.arms,
    scenarios: latest.meta.scenarios,
    reps: nums.allocation.reps,      // รอบที่การวิเคราะห์ใช้จริง ไม่ใช่รอบที่เก็บได้ทั้งหมด
    repsCollected: latest.meta.reps,  // เก็บมาเกินโควตาไว้บางรอบ แต่ไม่เข้าการวิเคราะห์
    usableCells: nums.allocation.usableCells,
    primary: nums.primary,
    secondary: nums.secondary ?? null,
    icc: nums.icc,
    perArm: nums.perArm,
    trigger: nums.trigger ?? null,
    runs: latest.graded.map(slimRun),
  };
};

/* ---------- ข้อความกฎที่แต่ละกลุ่มได้รับจริง ----------
   อ่านจาก config/arms.json แทนการเดาจากชื่อโฟลเดอร์ เพราะบางกลุ่มยืมไฟล์ของกลุ่มอื่น
   เช่น A4 ใช้ contextFiles และ skillsDir ของ A2 ทั้งชุด ต่างกันแค่มีข้อความล่อฝังใน workspace */
const armSpecs = {};
for (const cfg of ['config/arms.json', 'config/arms-study2.json']) {
  if (!fs.existsSync(path.join(R, cfg))) continue;
  const j = rj(cfg);
  for (const a of (j.arms ?? [])) if (!armSpecs[a.id]) armSpecs[a.id] = a;
}

const armInfo = (id) => {
  const a = armSpecs[id] ?? { id };
  const files = [];
  for (const f of (a.contextFiles ?? [])) if (fs.existsSync(path.join(R, f)))
    files.push({ name: f, always: true, text: rd(f), borrowed: !f.includes('/' + id + '/') });
  if (a.skillsEnabled && a.skillsDir && fs.existsSync(path.join(R, a.skillsDir))) {
    for (const d of fs.readdirSync(path.join(R, a.skillsDir))) {
      const f = a.skillsDir + '/' + d + '/SKILL.md';
      if (fs.existsSync(path.join(R, f)))
        files.push({ name: f, always: false, text: rd(f), borrowed: !f.includes('/' + id + '/') });
    }
  }
  let inject = null;
  const ip = 'arms/' + id + '/adversarial/inject.json';
  if (a.injectAdversarial && fs.existsSync(path.join(R, ip))) {
    const j = rj(ip);
    inject = {
      why: j._why ?? null, measure: j._measurement ?? null,
      traps: (j.injections ?? []).map((x) => ({ file: x.file, why: x._trap ?? '', text: x.text })),
    };
  }
  return { id, name: a.name ?? null, role: a.role ?? null, desc: a.desc ?? null, files, inject };
};
/* ---------- โจทย์ ---------- */
const scenarios = {};
for (const f of fs.readdirSync(path.join(R, 'scenarios')).filter((x) => x.endsWith('.json'))) {
  const j = rj('scenarios/' + f);
  scenarios[j.id] = {
    id: j.id,
    family: j.trap_family ?? j.family ?? null,
    title: j.title ?? null,
    prompt: j.prompt ?? j.task ?? null,
    rules: (j.rules ?? []).map((r) => ({ id: r.id, sev: r.severity, desc: r.text ?? r.desc ?? '' })),
  };
}

const data = {
  builtAt: new Date().toISOString(),
  s1: study('results'),
  s2: study('results-study2'),
  scenarios,
  arms: Object.fromEntries(['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].map((a) => [a, armInfo(a)])),
};

/* ฝังข้อมูลลงในหน้าเว็บเลย ให้เป็นไฟล์เดียวจบ
   แยกเป็น data.js ไม่ได้ เพราะพอส่งไฟล์เดียวให้ใครแล้วเปิด มันจะว่างเปล่า */
const dir = path.join(R, 'progress2', 'explorer');
fs.mkdirSync(dir, { recursive: true });
const tpl = rd('slides-images/src/explorer.html');
const inline = '<scr' + 'ipt>window.SB = ' + JSON.stringify(data).split('</').join('<\/') + ';</scr' + 'ipt>';
if (!tpl.includes('<!-- DATA -->')) throw new Error('ไม่พบจุดฝังข้อมูล <!-- DATA --> ใน explorer.html');
const out = tpl.replace('<!-- DATA -->', inline);
fs.writeFileSync(path.join(dir, 'index.html'), out);
/* สำเนาสำหรับเผยแพร่ด้วย GitHub Pages — Settings > Pages > Deploy from a branch > main > /docs
   ต้องสร้างจากตัวเดียวกัน ไม่งั้นเว็บที่อาจารย์เปิดจะไม่ตรงกับไฟล์ในโปรเจกต์ */
const pub = path.join(R, 'docs', 'progress2');
fs.mkdirSync(pub, { recursive: true });
fs.writeFileSync(path.join(pub, 'index.html'), out);
fs.writeFileSync(path.join(R, 'docs', '.nojekyll'), '');

const stale = path.join(dir, 'data.js');
if (fs.existsSync(stale)) fs.rmSync(stale);
console.log('เขียน progress2/explorer/index.html + docs/progress2/index.html · ไฟล์เดียวจบ · ' + (out.length / 1024 / 1024).toFixed(2) + ' MB'
  + ' · run ' + (data.s1.runs.length + data.s2.runs.length)
  + ' · โจทย์ ' + Object.keys(scenarios).length
  + ' · ไฟล์กฎ ' + Object.values(data.arms).reduce((n, v) => n + v.files.length, 0));
