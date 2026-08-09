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
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/latest.json'), 'utf8'));
const meta = raw.meta;

/*
 * ตัด run ที่ล้มเหลวเพราะโครงสร้างพื้นฐานออกก่อนคำนวณทุกตัวเลข
 *
 * run พวกนี้ (auth หมดอายุ / เน็ตหลุด / timeout / token หมดกลางคัน) หน้าตาเหมือน
 * "เอเจนต์เลือกที่จะไม่ทำอะไรเลย" ทุกประการ คือ 0 tool call แล้วกฎตกเกือบหมด
 * ถ้าปล่อยให้ปนเข้าไป มันจะดึงค่าเฉลี่ยของ arm ที่ซวยลงโดยไม่เกี่ยวกับ context เลย
 * และเนื่องจากเรารันแบบสลับลำดับ ความซวยจะไม่กระจายเท่ากันเสมอไปในกลุ่มตัวอย่างเล็ก
 *
 * ต้องรายงานจำนวนที่ตัดทิ้งเสมอ — การตัดข้อมูลโดยไม่บอกคือสิ่งที่กรรมการควรจับได้
 */
const excluded = raw.graded.filter((g) => g.error);
const graded = raw.graded.filter((g) => !g.error);
if (excluded.length) {
  console.log(`  ตัด ${excluded.length} run ที่ล้มเหลวเชิงโครงสร้างออกจากการวิเคราะห์ (เหลือ ${graded.length})`);
}
if (!graded.length) {
  console.error('\n  ไม่เหลือ run ที่ใช้ได้เลย — ทุก run ล้มเหลวเชิงโครงสร้าง');
  console.error(`  สาเหตุแรกที่พบ: ${excluded[0]?.error}\n`);
  process.exit(1);
}

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
  // ใช้ CRIT (กฎวิกฤตผ่านหมด) ไม่ใช่ FULL เพราะ FULL รวมกฎระดับ minor ด้วย
  // แล้วความน่าจะเป็นจะทบกันจนตกพื้น ทำให้ตัวชี้วัดแยกแยะอะไรไม่ได้
  const perScen = {};
  for (const id of scenIds) perScen[id] = rows.filter((r) => r.scenarioId === id).map((r) => r.CRIT);
  s.passHatK = passHatK(perScen);

  // ตัวชี้วัดภาษา BA/PM — null หมายถึง scenario นั้นไม่ได้วัดด้านนี้ จึงตัดออกจากค่าเฉลี่ย
  for (const m of ['NO_GOLD_PLATING', 'TRACEABLE', 'AC_MET', 'NO_RETRO_IMPACT', 'FLAGGED']) {
    const vals = rows.map((r) => r[m]).filter((v) => v !== null && v !== undefined);
    s[m] = vals.length ? { ...wilson(vals.filter((v) => v === 1).length, vals.length), mean: mean(vals) } : null;
  }
  s.jaccard = mean(scenIds.map((id) => meanPairwiseJaccard(rows.filter((r) => r.scenarioId === id).map((r) => r.filesChanged))));
  s.entropy = mean(scenIds.map((id) => normalizedEntropy(rows.filter((r) => r.scenarioId === id).map((r) => r.fileSetKey))));
  // ต้นทุน
  s.tokIn = mean(rows.map((r) => r.inputTokens));
  s.tokOut = mean(rows.map((r) => r.outputTokens));
  s.tools = mean(rows.map((r) => r.toolCalls));
  s.wallS = mean(rows.map((r) => r.wallMs)) / 1000;
  // ต้นทุนเป็นเงิน — หน่วยที่อ่านแล้วเข้าใจทันทีว่าแพงแค่ไหน ต่างจากตัวเลข token
  const costs = rows.map((r) => r.costUsd).filter((v) => typeof v === 'number');
  s.costUsd = costs.length ? mean(costs) : null;
  s.costTotal = costs.length ? costs.reduce((a, b) => a + b, 0) : null;
  s.tokCacheRead = mean(rows.map((r) => r.tokCacheRead ?? 0));
  s.tokFresh = mean(rows.map((r) => r.tokFreshInput ?? 0));
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

p('### ทำไม pass^k ถึงต่ำกว่าที่คาดมาก — ความน่าเชื่อถือทบกัน');
p('');
{
  const critCounts = scenIds.map((id) => {
    const g = graded.find((x) => x.scenarioId === id);
    return g ? g.rules.filter((r) => r.severity === 'critical').length : 0;
  });
  const avgCrit = mean(critCounts);
  const a2 = summary.A2 ?? summary[armIds[armIds.length - 1]];
  const perRule = a2 ? a2.RCR.mean : NaN;
  p(`แต่ละโจทย์มีกฎระดับวิกฤตเฉลี่ย **${avgCrit.toFixed(1)} ข้อ** และทุกข้อต้องผ่านพร้อมกัน`);
  p('');
  p(`ถ้าเอเจนต์ทำตามกฎแต่ละข้อได้ ${fmtPct(perRule)} โอกาสที่จะผ่านครบทุกข้อในหนึ่ง run คือ`);
  p(`\`${fmtPct(perRule)}^${avgCrit.toFixed(0)} ≈ ${fmtPct(Math.pow(perRule, avgCrit))}\` — และ pass^k ต้องผ่านครบแบบนั้น **ทุกรอบ** อีกชั้นหนึ่ง`);
  p('');
  p('> **นี่ไม่ใช่ข้อบกพร่องของการวัด แต่คือข้อค้นพบ**');
  p('> อัตราการทำตามกฎรายข้อที่ดูดี (80–90%) แปลงเป็นความน่าเชื่อถือระดับงานที่ต่ำมาก');
  p('> เพราะงานจริงหนึ่งชิ้นต้องผ่านข้อจำกัดหลายข้อพร้อมกัน — ประโยคนี้ควรอยู่ในบทสรุปของรายงาน');
}
p('');

p('## 3. ตัวชี้วัดภาษา BA/PM (จาก RTM)');
p('');
p('| Arm | ไม่ทำเกินข้อกำหนด | อ้าง REQ-ID ได้ | ทำตาม AC ครบ | ไม่กระทบข้อมูลย้อนหลัง | แจ้งสิ่งผิดปกติ |');
p('|---|---|---|---|---|---|');
for (const a of armIds) {
  const s = summary[a];
  const f = (m) => (s[m] ? `${fmtPct(s[m].mean)} [${fmtPct(s[m].lo)}, ${fmtPct(s[m].hi)}]` : 'n/a');
  p(`| ${a} | ${f('NO_GOLD_PLATING')} | ${f('TRACEABLE')} | ${f('AC_MET')} | ${f('NO_RETRO_IMPACT')} | ${f('FLAGGED')} |`);
}
p('');
p('> **ไม่ทำเกินข้อกำหนด** = 1 − Gold-Plating Rate (ศัพท์ PMBOK) | **อ้าง REQ-ID ได้** = Traceability');
p('> **แจ้งสิ่งผิดปกติ** คือแกนตั้งของตาราง 2×2 ในกับดักกฎขัดสามัญสำนึก');
p('');

p('## 4. โจทย์ธรรมดา vs โจทย์ที่มีกับดัก — เงื่อนไขขอบเขต');
p('');
{
  const famOf = {};
  for (const g of graded) if (!famOf[g.scenarioId]) famOf[g.scenarioId] = g.family ?? 'unknown';
  const ordinary = (r) => famOf[r.scenarioId] === 'ordinary';
  p('| Arm | โจทย์ธรรมดา (CRIT) | โจทย์กับดัก (CRIT) | ส่วนต่าง |');
  p('|---|---|---|---|');
  for (const a of armIds) {
    const rows = by(a);
    const o = mean(rows.filter(ordinary).map((r) => r.CRIT));
    const t = mean(rows.filter((r) => !ordinary(r)).map((r) => r.CRIT));
    p(`| ${a} | ${fmtPct(o)} | ${fmtPct(t)} | ${fmtPct(o - t)} |`);
  }
  p('');
  p('> **ตารางนี้คือข้อค้นพบที่นำไปใช้ตัดสินใจได้จริงที่สุดในงาน**');
  p('> ถ้าโจทย์ธรรมดาไม่ต่างกันระหว่าง arm แต่โจทย์กับดักต่างกันมาก');
  p('> ข้อสรุปคือ context engineering คุ้มเมื่องานมีความกำกวมหรือข้อกำหนดขัดกัน ไม่ใช่ทุกงาน');
}
p('');

p('## 5. ต้นทุน (context engineering ไม่ฟรี)');
p('');
p('| Arm | $ / run | input รวม tok/run | ในนั้นเป็น cache read | output tok/run | tool calls | เวลา (วิ) |');
p('|---|---:|---:|---:|---:|---:|---:|');
for (const a of armIds) {
  const s = summary[a];
  const cost = s.costUsd === null ? '—' : `$${s.costUsd.toFixed(2)}`;
  p(`| ${a} | ${cost} | ${Math.round(s.tokIn).toLocaleString()} | ${Math.round(s.tokCacheRead).toLocaleString()} | ${Math.round(s.tokOut).toLocaleString()} | ${s.tools.toFixed(1)} | ${s.wallS.toFixed(1)} |`);
}
p('');
p('> ตารางนี้สำคัญ: ถ้า A2 ชนะแต่ใช้ token มากกว่า 3 เท่า ข้อสรุปต้องเป็น trade-off ไม่ใช่ "ดีกว่า"');
p('');
p('**อ่านคอลัมน์ token ยังไง** — `input รวม` = fresh input + cache creation + cache read');
p('ส่วนที่ใหญ่ที่สุดคือ **cache read** ซึ่งคือ context ที่ถูกอ่านซ้ำทุก turn');
p('นี่คือคอลัมน์ที่ผลของ progressive disclosure จะโผล่ ไม่ใช่ `input_tokens` ซึ่งเล็กจนไม่มีความหมาย');
p('');

// ต้นทุนรวมของชุดข้อมูลนี้ — ใช้ประเมินว่าจะเก็บต่อได้อีกแค่ไหน
const grandTotal = armIds.map((a) => summary[a].costTotal).filter((v) => typeof v === 'number');
if (grandTotal.length) {
  const total = grandTotal.reduce((x, y) => x + y, 0);
  const perRun = total / graded.length;
  p(`**ต้นทุนของชุดข้อมูลนี้: $${total.toFixed(2)} จาก ${graded.length} run (เฉลี่ย $${perRun.toFixed(2)}/run)**`);
  p('');
  p('| ถ้าจะเก็บต่อ | runs | ประมาณการ |');
  p('|---|---:|---:|');
  for (const [name, n] of [['calibration (A1 x 11 โจทย์ x 5)', 55], ['การทดลองหลัก (11 x 5 arm x 11)', 605], ['dilution (5 ระดับ x 2 โจทย์ x 15)', 150]]) {
    p(`| ${name} | ${n} | $${(perRun * n).toFixed(0)} |`);
  }
  p('');
  // ระบุให้ชัดว่าตัวเลขนี้เป็นเงินจริงหรือแค่ราคาอ้างอิง — ต่างกันคนละเรื่อง
  const keySources = [...new Set(raw.graded.map((g) => g.apiKeySource).filter(Boolean))];
  const onSubscription = keySources.length === 0 || keySources.every((k) => k === 'none');
  p(onSubscription
    ? '> **ตัวเลขนี้ไม่ใช่เงินที่ถูกตัดจริง** — เก็บข้อมูลผ่านการ login ด้วย subscription (`apiKeySource: none`)'
    : `> **⚠ ตัวเลขนี้คือเงินจริง** — เก็บข้อมูลผ่าน API key (\`${keySources.join(', ')}\`)`);
  p('> `total_cost_usd` คือราคาเทียบเท่าถ้าจ่ายตามอัตรา API ใช้ประเมินขนาดของงานได้ทั้งสองกรณี');
  p(onSubscription
    ? '> ข้อจำกัดจริงของแผนนี้คือ **โควตาการใช้งานและเวลารัน** ไม่ใช่งบประมาณ'
    : '> ควรตรวจงบก่อนรันชุดถัดไป');
  p('');
}

p('## 6. การเปรียบเทียบแบบจับคู่ (McNemar exact + cluster bootstrap)');
p('');
p('| เปรียบเทียบ | metric | A | B | ผลต่าง [95% CI] | b/c | p (McNemar) | Cohen\'s h |');
p('|---|---|---|---|---|---|---|---|');
for (const [x, y] of COMPARISONS) {
  for (const m of ['CRIT', 'SCOPE']) {
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

// ---------- Requirement Drift: เลือกข้างเดิมทุกรอบไหม ----------
p('## 7. Requirement Drift — ความสม่ำเสมอของการตัดสินใจ');
p('');
p('เมื่อข้อกำหนดขัดกันเอง เอเจนต์ต้องเลือกข้าง คำถามคือ **เลือกข้างเดิมทุกรอบไหม**');
p('การสลับไปมาระหว่างรอบ ทั้งที่โจทย์เดิมเป๊ะ คือความสุ่มในรูปแบบที่กระทบธุรกิจโดยตรง');
p('');
p('| Arm | scenario | ผลลัพธ์ที่ต่างกันข้ามรอบ | Entropy | ตีความ |');
p('|---|---|---|---|---|');
{
  const driftScens = [...new Set(graded.filter((g) => g.family === 'requirement_conflict' || g.family === 'requirement_invention').map((g) => g.scenarioId))];
  for (const a of armIds) {
    for (const sid of driftScens) {
      const rows = by(a).filter((r) => r.scenarioId === sid);
      if (!rows.length) continue;
      const keys = rows.map((r) => r.fileSetKey);
      const distinct = new Set(keys).size;
      const H = normalizedEntropy(keys);
      const verdict = distinct === 1 ? 'คงเส้นคงวา' : distinct <= 2 ? 'สลับบ้าง' : 'ไม่คงเส้นคงวา';
      p(`| ${a} | ${sid} | ${distinct} แบบ จาก ${rows.length} รอบ | ${H.toFixed(3)} | ${verdict} |`);
    }
  }
}
p('');
p('> ค่าที่ดีคือ 1 แบบจากทุกรอบ (entropy = 0) — ตัดสินใจเหมือนเดิมเสมอ');
p('> ไม่ได้แปลว่าตัดสินใจถูก แต่แปลว่า**คาดเดาได้** ซึ่งเป็นคนละเรื่องและสำคัญไม่แพ้กัน');
p('');

if (Object.keys(trig).length) {
  p('## 8. ความแม่นของการยิง skill');
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

// ---------- อัตราการผ่านรายกฎ: กฎข้อไหนยากที่สุด ----------
p('## 9. อัตราการผ่านรายกฎ (10 ข้อที่ยากที่สุด)');
p('');
{
  const stat = new Map();
  for (const g of graded) {
    for (const r of g.rules) {
      const key = `${g.scenarioId} / ${r.id}`;
      if (!stat.has(key)) stat.set(key, { pass: 0, n: 0, desc: r.desc, sev: r.severity });
      const s = stat.get(key);
      s.n++; if (r.passed) s.pass++;
    }
  }
  const rows = [...stat.entries()].map(([k, v]) => ({ key: k, rate: v.pass / v.n, ...v }))
    .sort((a, b) => a.rate - b.rate).slice(0, 10);
  p('| กฎ | ระดับ | อัตราผ่าน | คำอธิบาย |');
  p('|---|---|---|---|');
  for (const r of rows) p(`| \`${r.key}\` | ${r.sev} | ${fmtPct(r.rate)} | ${r.desc} |`);
  p('');
  p('> ใช้ตอน calibration — กฎที่ผ่านต่ำกว่า 15% ทุก arm อาจเขียน checker ผิด ไม่ใช่โจทย์ยาก');
  p('> ตรวจด้วยมือก่อนสรุปเสมอ');
}
p('');

p('## 10. ตรวจสุขภาพของชุดกฎ');
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

// รายงานการตัดข้อมูลอย่างละเอียด — ต้องมีในเล่ม ไม่ใช่ซ่อนไว้
if (excluded.length) {
  const total = excluded.length + graded.length;
  p(`## run ที่ถูกตัดออก: ${excluded.length}/${total} (${fmtPct(excluded.length / total)})`);
  p('');
  p('ล้มเหลวเชิงโครงสร้าง ไม่ใช่พฤติกรรมของเอเจนต์ จึงไม่นำมาคำนวณ');
  p('');
  const byReason = {};
  for (const g of excluded) {
    const key = String(g.error).slice(0, 60);
    byReason[key] ??= {};
    byReason[key][g.armId] = (byReason[key][g.armId] ?? 0) + 1;
  }
  p('| สาเหตุ | จำนวน | กระจายตาม arm |');
  p('|---|---|---|');
  for (const [reason, arms] of Object.entries(byReason)) {
    const n = Object.values(arms).reduce((s, v) => s + v, 0);
    p(`| ${reason} | ${n} | ${Object.entries(arms).map(([a, c]) => `${a}:${c}`).join(' ')} |`);
  }
  p('');
  p('> ถ้าการตัดทิ้งกองอยู่ที่ arm ใด arm หนึ่งผิดสัดส่วน อย่าเพิ่งเชื่อผลของ arm นั้น');
  p('> ให้รันซ่อมเฉพาะ cell ที่หายไปก่อน แล้ววิเคราะห์ใหม่');
  p('');
}

fs.writeFileSync(path.join(ROOT, 'results/report.md'), L.join('\n'));

const csv = ['arm,n,RCR,RCR_lo,RCR_hi,FULL,FULL_lo,FULL_hi,SCOPE,passHatK,jaccard,entropy,tok_in,tok_cache_read,tok_out,cost_usd,tools,wall_s'];
for (const a of armIds) {
  const s = summary[a];
  csv.push([a, s.n, s.RCR.mean, s.RCR.lo, s.RCR.hi, s.FULL.mean, s.FULL.lo, s.FULL.hi, s.SCOPE.mean,
            s.passHatK.value, s.jaccard, s.entropy, s.tokIn, s.tokCacheRead, s.tokOut,
            s.costUsd ?? '', s.tools, s.wallS]
           .map((v) => (typeof v === 'number' ? v.toFixed(4) : v)).join(','));
}
fs.writeFileSync(path.join(ROOT, 'results/summary.csv'), csv.join('\n'));

console.log(L.join('\n'));
console.log(`\n[เขียนแล้ว] results/report.md, results/summary.csv\n`);
