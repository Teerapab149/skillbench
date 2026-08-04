/**
 * analyze.mjs — แปลงผลดิบเป็นตาราง/สถิติ/รายงาน
 *
 * ผลลัพธ์: results/report.md + results/summary.csv
 * ทุกตัวเลขในรายงานมี CI กำกับเสมอ — ตัวเลขเปล่าๆ ไม่มีความหมายเมื่อระบบที่วัดมีความสุ่ม
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  wilson, cohensH, mcnemarExact, clusterBootstrapDiff, passHatK,
  meanPairwiseJaccard, normalizedEntropy, fmtPct, fmtP,
} from './stats.mjs';
import { triggerMetrics } from './graders.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { meta, graded } = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/latest.json'), 'utf8'));

const armIds = meta.arms;
const scenIds = meta.scenarios;
const by = (armId) => graded.filter((g) => g.armId === armId);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);

// ---------- 1. ตารางหลัก: metric ต่อ arm พร้อม 95% CI ----------
const METRICS = [
  ['RCR', 'Rule Compliance Rate — สัดส่วนกฎที่ผ่าน (ต่อเนื่อง)'],
  ['FULL', 'Full-Compliance Rate — run ที่ผ่านครบทุกกฎ (0/1)'],
  ['CRIT', 'Critical-Rule Pass — กฎระดับวิกฤตผ่านหมด (0/1)'],
  ['SCOPE', 'Scope Adherence — ไม่ทำงานเกินขอบเขต (0/1)'],
];

const summary = {};
for (const arm of armIds) {
  const rows = by(arm);
  const s = { n: rows.length };
  for (const [m] of METRICS) {
    const vals = rows.map((r) => r[m]);
    s[m] = m === 'RCR'
      ? { mean: mean(vals), ...bootstrapMeanCI(vals) }
      : { ...wilson(vals.filter((v) => v === 1).length, vals.length), mean: mean(vals) };
  }
  // ความสม่ำเสมอ — แกนของคำว่า "stochasticity" ในหัวข้อ
  const perScen = {};
  for (const id of scenIds) perScen[id] = rows.filter((r) => r.scenarioId === id).map((r) => r.FULL);
  s.passHatK = passHatK(perScen);
  s.jaccard = mean(scenIds.map((id) => meanPairwiseJaccard(rows.filter((r) => r.scenarioId === id).map((r) => r.filesChanged))));
  s.entropy = mean(scenIds.map((id) => normalizedEntropy(rows.filter((r) => r.scenarioId === id).map((r) => r.fileSetKey))));
  // ต้นทุน
  s.tokIn = mean(rows.map((r) => r.inputTokens));
  s.tokOut = mean(rows.map((r) => r.outputTokens));
  s.tools = mean(rows.map((r) => r.toolCalls));
  s.wallS = mean(rows.map((r) => r.wallMs)) / 1000;
  summary[arm] = s;
}

function bootstrapMeanCI(vals, iters = 3000) {
  if (!vals.length) return { lo: NaN, hi: NaN };
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const ms = [];
  for (let i = 0; i < iters; i++) {
    let s = 0;
    for (let j = 0; j < vals.length; j++) s += vals[Math.floor(rnd() * vals.length)];
    ms.push(s / vals.length);
  }
  ms.sort((a, b) => a - b);
  return { lo: ms[Math.floor(0.025 * iters)], hi: ms[Math.floor(0.975 * iters)] };
}

// ---------- 2. การเปรียบเทียบแบบจับคู่ ----------
function pairedCompare(armA, armB, metric) {
  const key = (r) => `${r.scenarioId}#${r.rep}`;
  const A = new Map(by(armA).map((r) => [key(r), r]));
  const B = new Map(by(armB).map((r) => [key(r), r]));
  let b = 0, c = 0, both = 0, neither = 0;
  for (const [k, ra] of A) {
    const rb = B.get(k); if (!rb) continue;
    const pa = ra[metric] === 1, pb = rb[metric] === 1;
    if (pa && !pb) b++; else if (!pa && pb) c++; else if (pa) both++; else neither++;
  }
  const clA = {}, clB = {};
  for (const id of scenIds) {
    clA[id] = by(armA).filter((r) => r.scenarioId === id).map((r) => r[metric]);
    clB[id] = by(armB).filter((r) => r.scenarioId === id).map((r) => r[metric]);
  }
  const boot = clusterBootstrapDiff(clA, clB, { iters: 4000 });
  const pA = mean(by(armA).map((r) => r[metric]));
  const pB = mean(by(armB).map((r) => r[metric]));
  return { armA, armB, metric, mcnemar: mcnemarExact(b, c), both, neither, boot, pA, pB, h: cohensH(pA, pB) };
}

const COMPARISONS = [['A2', 'A1'], ['A2', 'A0'], ['A1', 'A3'], ['A2', 'A3'], ['A4', 'A2']]
  .filter(([a, b]) => armIds.includes(a) && armIds.includes(b));

// ---------- 3. skill trigger ----------
const allSkills = [...new Set(graded.map((g) => g.expectedSkill).filter(Boolean))];
const trig = {};
for (const arm of armIds.filter((a) => by(a).some((r) => r.loadedSkills.length))) {
  trig[arm] = triggerMetrics(by(arm), allSkills);
}

// ---------- 4. กฎข้อไหนวัดอะไรไม่ได้บ้าง ----------
const ruleIds = [...new Set(graded.flatMap((g) => g.rules.map((r) => `${g.scenarioId}/${r.id}`)))];
const deadRules = ruleIds.filter((rid) => {
  const [sc, id] = rid.split('/');
  const vals = graded.filter((g) => g.scenarioId === sc).map((g) => g.rules.find((r) => r.id === id)?.passed);
  return vals.every((v) => v === true) || vals.every((v) => v === false);
});

// ---------- 5. เขียนรายงาน ----------
const L = [];
const p = (s = '') => L.push(s);

p(`# SkillBench — ผลการทดลอง`);
p('');
if (meta.simulated) {
  p('> **คำเตือน: ข้อมูลชุดนี้มาจาก mock adapter — เป็นตัวเลขจำลองสำหรับทดสอบ pipeline เท่านั้น**');
  p('> ห้ามนำตัวเลขในเอกสารนี้ไปใส่รายงานสัมมนา ให้รันด้วย `--adapter claude-cli` แล้วสร้างใหม่');
  p('');
}
p(`- เวลา: ${meta.stamp} | adapter: \`${meta.adapter}\` | repetitions: ${meta.reps} | seed: ${meta.masterSeed}`);
p(`- โจทย์: ${scenIds.length} | arms: ${armIds.join(', ')} | จำนวน run รวม: ${graded.length}`);
p(`- **Primary endpoint (ประกาศล่วงหน้า): ${meta.primaryEndpoint?.metric} — ${meta.primaryEndpoint?.comparison}**`);
p('');

p('## 1. ตัวชี้วัดหลักต่อ arm (พร้อม 95% CI)');
p('');
p('| Arm | n | RCR | Full-Compliance | Critical Pass | Scope Adherence |');
p('|---|---:|---|---|---|---|');
for (const a of armIds) {
  const s = summary[a];
  const f = (m) => `${fmtPct(s[m].mean)} [${fmtPct(s[m].lo)}, ${fmtPct(s[m].hi)}]`;
  p(`| ${a} | ${s.n} | ${f('RCR')} | ${f('FULL')} | ${f('CRIT')} | ${f('SCOPE')} |`);
}
p('');
p('> CI ของสัดส่วนใช้ Wilson score interval, ของ RCR ใช้ bootstrap percentile');
p('');

p('## 2. ความสม่ำเสมอ (ตอบโจทย์คำว่า stochasticity โดยตรง)');
p('');
p('| Arm | pass^k (ผ่านครบทุกครั้ง) | Jaccard ไฟล์ที่แตะ | Entropy ของผลลัพธ์ |');
p('|---|---|---|---|');
for (const a of armIds) {
  const s = summary[a];
  p(`| ${a} | ${fmtPct(s.passHatK.value)} (${s.passHatK.passed}/${s.passHatK.total}) | ${s.jaccard.toFixed(3)} | ${s.entropy.toFixed(3)} |`);
}
p('');
p('> `pass^k` = สัดส่วนโจทย์ที่ผ่าน **ทุก** repetition — เอเจนต์ที่ผ่าน 8/10 ครั้งใช้งานจริงไม่ได้');
p('> Jaccard สูง = แตะไฟล์ชุดเดิมทุกครั้ง (คาดเดาได้) | Entropy ต่ำ = ผลลัพธ์นิ่ง');
p('');

p('## 3. ต้นทุน (context engineering ไม่ฟรี)');
p('');
p('| Arm | input tok/run | output tok/run | tool calls | เวลา (วิ) |');
p('|---|---:|---:|---:|---:|');
for (const a of armIds) {
  const s = summary[a];
  p(`| ${a} | ${Math.round(s.tokIn)} | ${Math.round(s.tokOut)} | ${s.tools.toFixed(1)} | ${s.wallS.toFixed(1)} |`);
}
p('');
p('> ตารางนี้สำคัญ: ถ้า A2 ชนะแต่ใช้ token มากกว่า 3 เท่า ข้อสรุปต้องเป็น trade-off ไม่ใช่ "ดีกว่า"');
p('');

p('## 4. การเปรียบเทียบแบบจับคู่ (McNemar exact + cluster bootstrap)');
p('');
p('| เปรียบเทียบ | metric | A | B | ผลต่าง [95% CI] | b/c | p (McNemar) | Cohen\'s h |');
p('|---|---|---|---|---|---|---|---|');
for (const [x, y] of COMPARISONS) {
  for (const m of ['FULL', 'SCOPE']) {
    const r = pairedCompare(x, y, m);
    p(`| ${x} vs ${y} | ${m} | ${fmtPct(r.pA)} | ${fmtPct(r.pB)} | ${fmtPct(r.boot.diff)} [${fmtPct(r.boot.lo)}, ${fmtPct(r.boot.hi)}] | ${r.mcnemar.b}/${r.mcnemar.c} | ${fmtP(r.mcnemar.p)} | ${r.h.toFixed(2)} |`);
  }
}
p('');
p('> **การอ่านผลที่สำคัญที่สุดของงานนี้อยู่ที่แถว A1 vs A3 และ A2 vs A3**');
p('> - ถ้า A1 ≈ A3 (ไม่ต่าง) → การยัดกฎเป็นข้อความยาวๆ ไม่ได้ผลจริง คนที่เขียน CLAUDE.md ยาว 500 บรรทัดกำลังหลอกตัวเอง');
p('> - ถ้า A2 > A3 อย่างมีนัยสำคัญ → ผลมาจาก "โครงสร้างและจังหวะการโหลด" ไม่ใช่แค่จำนวน token ที่เพิ่มขึ้น');
p('> - ถ้า A4 ≈ A2 → กฎทนต่อคำสั่งที่ฝังในไฟล์ได้');
p('');

if (Object.keys(trig).length) {
  p('## 5. ความแม่นของการยิง skill');
  p('');
  p('| Arm | Skill | Precision | Recall | F1 | TP/FP/FN |');
  p('|---|---|---|---|---|---|');
  for (const [a, m] of Object.entries(trig)) {
    for (const [s, v] of Object.entries(m)) {
      p(`| ${a} | ${s} | ${fmtPct(v.precision)} | ${fmtPct(v.recall)} | ${Number.isFinite(v.f1) ? v.f1.toFixed(3) : 'n/a'} | ${v.tp}/${v.fp}/${v.fn} |`);
    }
  }
  p('');
  p('> False Positive แพงกว่าที่คิด — skill ที่ยิงผิดจังหวะกิน context ที่ควรเป็นของงานจริง');
  p('');
}

p('## 6. ตรวจสุขภาพของชุดกฎ');
p('');
if (deadRules.length) {
  p(`พบกฎที่ให้ผลเหมือนกันทุก run (${deadRules.length} ข้อ) — กฎเหล่านี้ยังแยกแยะอะไรไม่ได้:`);
  p('');
  for (const r of deadRules) p(`- \`${r}\``);
  p('');
  p('> ถ้ากฎผ่าน 100% ทุก arm แปลว่าง่ายเกินไป; ถ้าตก 100% ทุก arm แปลว่ายากเกินไปหรือ checker เขียนผิด');
  p('> ทั้งสองกรณีทำให้กฎนั้นไม่มีค่าทางสถิติ ควรแก้หรือตัดทิ้งก่อนเก็บข้อมูลจริง');
} else {
  p('ทุกกฎมีทั้งเคสผ่านและเคสตก — ชุดกฎแยกแยะพฤติกรรมได้จริง');
}
p('');

const errs = graded.filter((g) => g.error);
if (errs.length) p(`## หมายเหตุ: มี ${errs.length} run ที่ error (${fmtPct(errs.length / graded.length)})`);

fs.writeFileSync(path.join(ROOT, 'results/report.md'), L.join('\n'));

const csv = ['arm,n,RCR,RCR_lo,RCR_hi,FULL,FULL_lo,FULL_hi,SCOPE,passHatK,jaccard,entropy,tok_in,tok_out,tools,wall_s'];
for (const a of armIds) {
  const s = summary[a];
  csv.push([a, s.n, s.RCR.mean, s.RCR.lo, s.RCR.hi, s.FULL.mean, s.FULL.lo, s.FULL.hi, s.SCOPE.mean,
            s.passHatK.value, s.jaccard, s.entropy, s.tokIn, s.tokOut, s.tools, s.wallS]
           .map((v) => (typeof v === 'number' ? v.toFixed(4) : v)).join(','));
}
fs.writeFileSync(path.join(ROOT, 'results/summary.csv'), csv.join('\n'));

console.log(L.join('\n'));
console.log(`\n[เขียนแล้ว] results/report.md, results/summary.csv\n`);
