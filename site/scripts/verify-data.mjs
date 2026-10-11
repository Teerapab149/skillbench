// ตรวจว่าข้อมูลที่เว็บใช้ตรงกับไฟล์ผลวิเคราะห์ของแต่ละชุด ทุกรอบ ทุก run
//   node site/scripts/verify-data.mjs
// ล้มด้วย exit 1 ถ้ามีข้อใดไม่ตรง
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', '..');
const rj = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const close = (a, b, eps = 1e-9) => (a == null && b == null) || Math.abs(a - b) < eps;
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗ ' + msg); } return cond; };

const STUDIES = [
  { n: 1, dir: 'results', scDir: 'evidence/study1-scenarios', metric: 'CRIT' },
  { n: 2, dir: 'results-study2', scDir: 'evidence/study2-scenarios', metric: 'RCRc' },
  { n: 3, dir: 'results-study3', scDir: 'scenarios', metric: 'RCRc' },
];

for (const st of STUDIES) {
  const nums = rj(`${st.dir}/numbers.json`);
  const latest = rj(`${st.dir}/latest.json`);
  const reps = nums.allocation.reps;
  const arms = latest.meta.arms;
  const scs = latest.meta.scenarios;
  console.log(`\n== ชุดที่ ${st.n} (${st.dir}) stamp ${nums.stamp}`);
  ok(latest.meta.stamp === nums.stamp, `stamp ของ latest.json (${latest.meta.stamp}) ไม่ตรง numbers.json (${nums.stamp})`);

  const all = latest.graded;
  const used = all.filter((g) => g.rep < reps);
  const extra = all.filter((g) => g.rep >= reps);
  console.log(`  run ทั้งหมดในไฟล์ ${all.length} · ใช้วิเคราะห์ ${used.length} (rep 0–${reps - 1}) · เกินโควตาไม่นับ ${extra.length}`);
  ok(used.length === nums.allocation.usableCells, `จำนวน run ที่ใช้ ${used.length} ≠ usableCells ${nums.allocation.usableCells}`);
  ok(used.length === arms.length * scs.length * reps, `จำนวน run ${used.length} ≠ กลุ่ม×โจทย์×รอบ ${arms.length * scs.length * reps}`);

  // ทุกช่อง (โจทย์ × กลุ่ม × รอบ) มีครบหนึ่ง run พอดี
  const key = (g) => `${g.scenarioId}|${g.armId}|${g.rep}`;
  const seen = new Map();
  for (const g of used) seen.set(key(g), (seen.get(key(g)) ?? 0) + 1);
  let missing = 0, dup = 0;
  for (const s of scs) for (const a of arms) for (let r = 0; r < reps; r++) {
    const c = seen.get(`${s}|${a}|${r}`) ?? 0;
    if (c === 0) missing++; if (c > 1) dup++;
  }
  ok(missing === 0, `ช่องที่ไม่มี run ${missing}`);
  ok(dup === 0, `ช่องที่มี run ซ้ำ ${dup}`);
  ok(new Set(used.map((g) => g.runId)).size === used.length, 'runId ซ้ำ');
  ok(used.every((g) => g.runId === `${g.scenarioId}__${g.armId}__r${g.rep}`), 'runId ไม่ตรงกับ โจทย์__กลุ่ม__รอบ');
  ok(used.every((g) => !g.error), `มี run ที่มี error ${used.filter((g) => g.error).length}`);

  // จำนวน run ต่อรอบ ต่อกลุ่ม
  for (let r = 0; r < reps; r++) {
    const perArm = arms.map((a) => used.filter((g) => g.rep === r && g.armId === a).length);
    ok(perArm.every((c) => c === scs.length), `รอบ ${r + 1}: จำนวน run ต่อกลุ่ม ${perArm.join('/')} ไม่ครบ ${scs.length}`);
  }
  console.log(`  ทุกรอบ ทุกกลุ่ม มีครบ ${scs.length} โจทย์`);

  // ค่าเฉลี่ยรายกลุ่มที่คำนวณจาก run ตรงกับ numbers.json
  for (const a of arms) {
    const ar = used.filter((g) => g.armId === a);
    const pa = nums.perArm[a];
    ok(pa.n === ar.length, `${a}: n ${ar.length} ≠ ${pa.n}`);
    for (const m of ['CRIT', 'SCOPE', 'RCRc']) {
      if (pa[m] == null) continue;
      ok(close(mean(ar.map((g) => g[m])), pa[m]), `${a} ${m}: คำนวณได้ ${mean(ar.map((g) => g[m]))} ≠ ${pa[m]}`);
    }
    if (pa.taskDoneRate != null) ok(close(mean(ar.map((g) => (g.taskDone ? 1 : 0))), pa.taskDoneRate), `${a} taskDoneRate ไม่ตรง`);
  }
  console.log(`  ค่าเฉลี่ยรายกลุ่ม (CRIT SCOPE RCRc ทำงานสำเร็จ) ตรงกับ numbers.json`);

  // ผลหลัก: เฉลี่ยรายโจทย์ แล้วจับคู่ A2 − A1
  const p = nums.primary;
  const m = p.metric;
  const sm = (a, s) => mean(used.filter((g) => g.armId === a && g.scenarioId === s).map((g) => g[m]));
  const diffs = scs.map((s) => sm(p.armA, s) - sm(p.armB, s));
  const w = diffs.filter((d) => d > 1e-12).length, l = diffs.filter((d) => d < -1e-12).length, t = diffs.length - w - l;
  ok(close(mean(diffs), p.diff), `ผลต่างหลัก ${mean(diffs)} ≠ ${p.diff}`);
  ok(w === p.wins && l === p.losses && t === p.ties, `ชนะ/แพ้/เสมอ ${w}/${l}/${t} ≠ ${p.wins}/${p.losses}/${p.ties}`);
  ok(close(mean(used.filter((g) => g.armId === p.armA).map((g) => g[m])), p.rateA), `rateA ไม่ตรง`);
  ok(close(mean(used.filter((g) => g.armId === p.armB).map((g) => g[m])), p.rateB), `rateB ไม่ตรง`);
  // p ของ exact sign-flip สองด้าน คำนวณใหม่จากผลต่างรายโจทย์
  const nz = diffs.filter((d) => Math.abs(d) > 1e-12);
  const obs = Math.abs(diffs.reduce((a, b) => a + b, 0));
  let ext = 0;
  for (let mask = 0; mask < 1 << nz.length; mask++) {
    let s = 0; for (let i = 0; i < nz.length; i++) s += (mask >> i) & 1 ? -nz[i] : nz[i];
    if (Math.abs(s) >= obs - 1e-12) ext++;
  }
  const pRe = ext / (1 << nz.length);
  ok(close(pRe, p.p, 1e-9), `p คำนวณใหม่ ${pRe} ≠ ${p.p}`);
  console.log(`  ผลหลัก ${m} ${p.armA}−${p.armB} = ${(p.diff * 100).toFixed(2)} จุด · ${w}/${l}/${t} · p = ${p.p} (คำนวณซ้ำได้ ${pRe})`);

  // นิยามโจทย์ที่เว็บใช้แสดง ตรงกับกฎที่ตัวตรวจใช้จริงใน run
  let ruleMismatch = 0;
  for (const s of scs) {
    const def = JSON.parse(fs.readFileSync(path.join(ROOT, st.scDir, `${s}.json`), 'utf8'));
    const defIds = new Set(def.rules.map((r) => r.id));
    const runIds = new Set(used.find((g) => g.scenarioId === s).rules.map((r) => r.id));
    const same = defIds.size === runIds.size && [...defIds].every((x) => runIds.has(x));
    if (!same) { ruleMismatch++; console.log(`    ${s}: นิยาม [${[...defIds]}] vs run [${[...runIds]}]`); }
  }
  ok(ruleMismatch === 0, `โจทย์ที่ชุดกฎในนิยามไม่ตรงกับใน run: ${ruleMismatch}`);
  if (!ruleMismatch) console.log(`  ชุดกฎของโจทย์ทั้ง ${scs.length} ข้อ ตรงกับที่ตัวตรวจใช้ใน run`);
}

console.log(fails ? `\nไม่ผ่าน ${fails} ข้อ` : '\nผ่านทุกข้อ');
process.exit(fails ? 1 : 0);
