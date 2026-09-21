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

/* ---------- ข้อความกฎที่แต่ละกลุ่มได้รับจริง ---------- */
const armFiles = (arm) => {
  const out = [];
  const base = path.join(R, 'arms', arm);
  const md = path.join(base, 'CLAUDE.md');
  if (fs.existsSync(md)) out.push({ name: 'CLAUDE.md', always: true, text: fs.readFileSync(md, 'utf8') });
  const sk = path.join(base, 'skills');
  if (fs.existsSync(sk)) {
    for (const d of fs.readdirSync(sk)) {
      const f = path.join(sk, d, 'SKILL.md');
      if (fs.existsSync(f)) out.push({ name: 'skills/' + d + '/SKILL.md', always: false, text: fs.readFileSync(f, 'utf8') });
    }
  }
  return out;
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
  arms: Object.fromEntries(['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].map((a) => [a, armFiles(a)])),
};

const dir = path.join(R, 'progress2', 'explorer');
fs.mkdirSync(dir, { recursive: true });
const js = 'window.SB = ' + JSON.stringify(data) + ';';
fs.writeFileSync(path.join(dir, 'data.js'), js);
console.log('เขียน progress2/explorer/data.js · ' + (js.length / 1024).toFixed(0) + ' KB'
  + ' · run ' + (data.s1.runs.length + data.s2.runs.length)
  + ' · โจทย์ ' + Object.keys(scenarios).length
  + ' · ไฟล์กฎ ' + Object.values(data.arms).reduce((n, v) => n + v.length, 0));
