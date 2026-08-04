/**
 * stats.mjs — สถิติทั้งหมดที่ใช้ในงานสัมมนา เขียนเองล้วน ไม่พึ่ง library
 *
 * ทุกฟังก์ชันในไฟล์นี้ต้อง "อธิบายได้ในรายงาน" — ถ้าอธิบายไม่ได้ อย่าใช้
 */

// ---------- normal distribution ----------

/** CDF ของ standard normal (Abramowitz & Stegun 7.1.26 ผ่าน erf) */
export function normCdf(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x) {
  const s = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429];
  const p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a[4] * t + a[3]) * t + a[2]) * t + a[1]) * t + a[0]) * t * Math.exp(-x * x);
  return s * y;
}

/** Inverse CDF (probit) — Acklam's rational approximation */
export function normQuantile(p) {
  if (p <= 0 || p >= 1) throw new Error('normQuantile: p must be in (0,1)');
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425, ph = 1 - pl;
  let q, r;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > ph) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5; r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
         (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

// ---------- proportion estimation ----------

/**
 * Wilson score interval — ใช้แทน normal approximation (Wald) เสมอ
 * เหตุผลที่ต้องเขียนในรายงาน: เมื่อ p เข้าใกล้ 0 หรือ 1 (ซึ่งจะเกิดแน่นอนกับ arm ที่มี skill)
 * Wald จะให้ขอบเขตทะลุ [0,1] และ coverage ต่ำกว่าที่อ้าง Wilson ไม่มีปัญหานี้
 */
export function wilson(successes, n, conf = 0.95) {
  if (n === 0) return { p: NaN, lo: NaN, hi: NaN, n: 0 };
  const z = normQuantile(1 - (1 - conf) / 2);
  const p = successes / n;
  const d = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / d;
  const half = (z / d) * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { p, lo: Math.max(0, center - half), hi: Math.min(1, center + half), n };
}

/** Cohen's h — effect size สำหรับผลต่างของสัดส่วน (0.2 เล็ก / 0.5 กลาง / 0.8 ใหญ่) */
export function cohensH(p1, p2) {
  const phi = (p) => 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, p))));
  return phi(p1) - phi(p2);
}

// ---------- paired testing ----------

function logChoose(n, k) {
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}
function logGamma(z) {
  const g = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
             12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  for (let i = 0; i < g.length; i++) x += g[i] / (z + i + 1);
  const t = z + g.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * McNemar exact test สำหรับข้อมูลจับคู่ (paired binary)
 * b = จำนวนเคสที่ arm A ผ่าน แต่ arm B ตก, c = ตรงข้าม
 *
 * ทำไมต้อง paired: เรารัน "โจทย์เดียวกัน seed เดียวกัน" กับทุก arm
 * การใช้ chi-square อิสระจะทิ้งข้อมูลการจับคู่ไป → power ต่ำกว่าที่ควร
 */
export function mcnemarExact(b, c) {
  const n = b + c;
  if (n === 0) return { b, c, p: 1, note: 'no discordant pairs' };
  const k = Math.min(b, c);
  let cdf = 0;
  for (let i = 0; i <= k; i++) cdf += Math.exp(logChoose(n, i) + n * Math.log(0.5));
  return { b, c, n, p: Math.min(1, 2 * cdf) };
}

// ---------- resampling ----------

/** xorshift128 PRNG — เพื่อให้ผล bootstrap reproducible จาก seed */
export function makeRng(seed = 42) {
  let x = seed >>> 0 || 1, y = 362436069, z = 521288629, w = 88675123;
  return function next() {
    const t = x ^ (x << 11);
    x = y; y = z; z = w;
    w = (w ^ (w >>> 19)) ^ (t ^ (t >>> 8));
    return (w >>> 0) / 4294967296;
  };
}

/**
 * Cluster bootstrap — resample "ที่ระดับ scenario" ไม่ใช่ระดับ run
 *
 * เหตุผลสำคัญที่สุดของงานนี้: การรันโจทย์เดิมซ้ำ 20 ครั้งไม่ได้ให้ข้อมูลอิสระ 20 หน่วย
 * ถ้า bootstrap ที่ระดับ run จะได้ CI แคบเกินจริง แล้วสรุปว่า "มีนัยสำคัญ" ทั้งที่ไม่มี
 * ที่ถูกคือ resample scenario (cluster) แล้วเอาทุก run ในนั้นมาด้วย
 */
export function clusterBootstrapDiff(clustersA, clustersB, { iters = 5000, seed = 42, conf = 0.95 } = {}) {
  const keys = Object.keys(clustersA).filter((k) => k in clustersB);
  if (keys.length === 0) return { diff: NaN, lo: NaN, hi: NaN };
  const rnd = makeRng(seed);
  const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const pooled = (ks, src) => mean(ks.flatMap((k) => src[k]));
  const observed = pooled(keys, clustersA) - pooled(keys, clustersB);

  const diffs = [];
  for (let i = 0; i < iters; i++) {
    const sample = [];
    for (let j = 0; j < keys.length; j++) sample.push(keys[Math.floor(rnd() * keys.length)]);
    diffs.push(pooled(sample, clustersA) - pooled(sample, clustersB));
  }
  diffs.sort((a, b) => a - b);
  const a = (1 - conf) / 2;
  return {
    diff: observed,
    lo: diffs[Math.floor(a * iters)],
    hi: diffs[Math.min(iters - 1, Math.floor((1 - a) * iters))],
    clusters: keys.length,
  };
}

// ---------- consistency / stochasticity ----------

/**
 * pass^k ("pass-hat-k") — สัดส่วนของโจทย์ที่ผ่าน "ครบทุก k ครั้ง"
 * ตัวชี้วัดหลักของงานนี้ เพราะโจทย์คือความสุ่ม ไม่ใช่ความเก่ง
 * เอเจนต์ที่ผ่าน 8/10 ครั้ง ใช้งานจริงไม่ได้ ต่อให้ mean สวย
 */
export function passHatK(perScenarioOutcomes) {
  const ids = Object.keys(perScenarioOutcomes);
  const allPass = ids.filter((id) => perScenarioOutcomes[id].every((v) => v === 1 || v === true));
  return { value: ids.length ? allPass.length / ids.length : NaN, passed: allPass.length, total: ids.length };
}

/** Normalized Shannon entropy ของผลลัพธ์เชิงหมวด (เช่น set ของไฟล์ที่ถูกแก้) — 0 = deterministic */
export function normalizedEntropy(labels) {
  if (labels.length <= 1) return 0;
  const counts = new Map();
  for (const l of labels) counts.set(l, (counts.get(l) || 0) + 1);
  if (counts.size === 1) return 0;
  let h = 0;
  for (const c of counts.values()) { const p = c / labels.length; h -= p * Math.log2(p); }
  return h / Math.log2(Math.min(counts.size, labels.length));
}

/** Mean pairwise Jaccard similarity — 1.0 = ทุก run แตะไฟล์ชุดเดียวกันเป๊ะ */
export function meanPairwiseJaccard(sets) {
  if (sets.length < 2) return 1;
  let sum = 0, pairs = 0;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const A = new Set(sets[i]), B = new Set(sets[j]);
      if (A.size === 0 && B.size === 0) { sum += 1; pairs++; continue; }
      let inter = 0;
      for (const v of A) if (B.has(v)) inter++;
      sum += inter / (A.size + B.size - inter);
      pairs++;
    }
  }
  return pairs ? sum / pairs : 1;
}

// ---------- inter-rater agreement (สำหรับตรวจสอบ LLM judge) ----------

/**
 * Cohen's kappa — ใช้ตอนต้องพิสูจน์ว่า "LLM judge เชื่อถือได้"
 * ถ้าจะใช้ LLM ตรวจงาน ต้องสุ่มตัวอย่าง >=50 ชิ้นมาให้คนตรวจคู่กัน แล้วรายงาน kappa
 * kappa < 0.6 = ห้ามใช้ judge นั้นเป็นหลักฐาน
 */
export function cohensKappa(raterA, raterB) {
  const n = raterA.length;
  if (n === 0 || n !== raterB.length) throw new Error('cohensKappa: length mismatch');
  const labels = [...new Set([...raterA, ...raterB])];
  let agree = 0;
  for (let i = 0; i < n; i++) if (raterA[i] === raterB[i]) agree++;
  const po = agree / n;
  let pe = 0;
  for (const l of labels) {
    const a = raterA.filter((v) => v === l).length / n;
    const b = raterB.filter((v) => v === l).length / n;
    pe += a * b;
  }
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}

// ---------- power analysis ----------

/**
 * จำนวน run ต่อ arm ที่ต้องใช้เพื่อจับผลต่าง p1 vs p2 ให้ได้
 * ต้องคำนวณ "ก่อน" เก็บข้อมูล แล้วเขียนลงระเบียบวิธีวิจัย
 * ถ้าไม่ทำ แล้วผลออกมา "ไม่มีนัยสำคัญ" จะแยกไม่ออกว่าเพราะไม่มีผลจริง หรือเพราะ n น้อยเกิน
 */
export function requiredNPerArm(p1, p2, { alpha = 0.05, power = 0.8, designEffect = 1.5 } = {}) {
  const zA = normQuantile(1 - alpha / 2);
  const zB = normQuantile(power);
  const pbar = (p1 + p2) / 2;
  const num = zA * Math.sqrt(2 * pbar * (1 - pbar)) + zB * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  const n = (num * num) / ((p1 - p2) ** 2);
  // designEffect ชดเชยการที่ run ในโจทย์เดียวกันไม่อิสระต่อกัน (intra-cluster correlation)
  return { raw: Math.ceil(n), adjusted: Math.ceil(n * designEffect), designEffect };
}

export function fmtPct(x, d = 1) { return Number.isFinite(x) ? (x * 100).toFixed(d) + '%' : 'n/a'; }
export function fmtP(p) { return p < 0.001 ? '<0.001' : p.toFixed(4); }

// ---------- CLI: node src/stats.mjs --power ----------
if (process.argv[1] && process.argv[1].endsWith('stats.mjs') && process.argv.includes('--power')) {
  console.log('\nตารางขนาดตัวอย่าง (alpha=0.05, power=0.80, design effect=1.5)\n');
  console.log('baseline -> treatment |  n/arm (raw) | n/arm (ปรับ cluster)');
  console.log('----------------------+--------------+---------------------');
  for (const [p1, p2] of [[0.50, 0.80], [0.55, 0.75], [0.60, 0.85], [0.70, 0.90], [0.75, 0.90], [0.80, 0.95]]) {
    const r = requiredNPerArm(p2, p1);
    console.log(`  ${fmtPct(p1, 0).padStart(5)} -> ${fmtPct(p2, 0).padEnd(11)}|${String(r.raw).padStart(13)} |${String(r.adjusted).padStart(20)}`);
  }
  console.log('\nอ่านตารางนี้ว่า: ถ้าคาดว่า skill ดันจาก 60% -> 85% ต้องมีอย่างน้อย ~น run ต่อ arm');
  console.log('n = (จำนวน scenario) x (จำนวน repetition ต่อ scenario)\n');
}
