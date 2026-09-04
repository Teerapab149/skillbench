/**
 * gate-rep0.mjs — ประตูตรวจสภาพหลังเก็บ rep 0 เสร็จ (assay sanity gate)
 *
 * ประกาศเกณฑ์ไว้ล่วงหน้าใน PRE-REGISTRATION.md §10 ก่อนเห็นข้อมูลแม้แต่ run เดียว
 *
 * ⚠️ นี่ไม่ใช่การวิเคราะห์ระหว่างทาง และต้องไม่ใช่
 *
 * สคริปต์นี้ **จงใจไม่คำนวณคะแนนแยก arm และไม่คำนวณผลต่าง A2 − A1 เลย**
 * ไม่ใช่เพราะสัญญาว่าจะไม่ดู แต่เพราะโค้ดไม่มีทางพิมพ์มันออกมาได้
 * ถ้าดูผลเปรียบเทียบตอน rep 0 แล้วตัดสินใจอะไรต่อ นั่นคือ interim analysis
 * ซึ่งทำให้ alpha พองโดยที่ไม่มีใครเห็น และแก้ทีหลังไม่ได้
 *
 * สิ่งที่ประตูนี้ตรวจมี 3 อย่างเท่านั้น:
 *   1. ความครบของ cell     — 55/55 หลังรันซ่อมแล้ว
 *   2. สภาพ runtime        — ทุก run ผ่าน validateRuntime()
 *   3. ช่วงการวัด          — โจทย์ยังแยกแยะได้ไหม (รวมทุก arm เข้าด้วยกัน)
 *
 * ข้อจำกัดที่ต้องเขียนกำกับทุกครั้ง: ที่ n = 5 ต่อโจทย์ ประตูนี้จับได้เฉพาะความพังระดับหายนะ
 * **ไม่ได้รับรองว่า assay ดี** ห้ามอ้างภายหลังว่า "ผ่าน gate แล้ว" เป็นหลักฐานคุณภาพ
 *
 *   node scripts/gate-rep0.mjs
 *   node scripts/gate-rep0.mjs --in results/latest.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, validateRuntime, manifestPath, experimentDigest } from '../src/runtime-manifest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};

/** เกณฑ์ที่ประกาศไว้ล่วงหน้า — ห้ามแก้หลังเห็นข้อมูล ถ้าจะแก้ต้องประกาศ amendment ก่อน */
export const CRITERIA = {
  degenerateScenarioMax: 8,   // NO-GO ถ้าโจทย์ที่ได้ 5/5 หรือ 0/5 รวมกัน >= 9 จาก 11
  pooledFloor: 0.10,
  pooledCeiling: 0.95,
};

/**
 * แผนที่ความยาก — รวมทุก arm เข้าด้วยกันเป็นก้อนเดียว
 *
 * การรวมทุก arm ไม่ใช่ความมักง่าย แต่เป็นสิ่งที่ทำให้ประตูนี้ไม่ใช่ interim analysis
 * ตัวเลขที่ได้ตอบได้แค่ "โจทย์นี้มีที่ให้ใครชนะไหม" ไม่ได้ตอบว่า "ใครชนะ"
 */
export function difficultyMap(graded, scenIds) {
  const out = [];
  for (const id of scenIds) {
    const rows = graded.filter((g) => g.scenarioId === id);
    const pass = rows.filter((g) => g.CRIT === 1).length;
    out.push({ id, n: rows.length, pass, rate: rows.length ? pass / rows.length : NaN });
  }
  return out;
}

export function evaluateGate({ graded, scenIds, armIds, reps = 1 }) {
  const checks = [];
  const expected = scenIds.length * armIds.length * reps;

  // --- 1. ความครบของ cell ---
  const seen = new Map();
  for (const g of graded) {
    const k = `${g.scenarioId}|${g.armId}|${g.rep}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  const missing = [], dupes = [];
  for (const s of scenIds) for (const a of armIds) for (let r = 0; r < reps; r++) {
    const n = seen.get(`${s}|${a}|${r}`) ?? 0;
    if (n === 0) missing.push(`${s}|${a}|r${r}`);
    else if (n > 1) dupes.push(`${s}|${a}|r${r} x${n}`);
  }
  checks.push({
    name: 'ความครบของ cell',
    ok: missing.length === 0 && dupes.length === 0,
    detail: `${expected - missing.length}/${expected} cell`
      + (missing.length ? ` · ขาด ${missing.length}: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ' …' : ''}` : '')
      + (dupes.length ? ` · ซ้ำ ${dupes.length}` : ''),
    note: 'transient error ระหว่างทางไม่นับ ถ้ารันซ่อมจนครบแล้ว',
  });

  // --- 2. ช่วงการวัด (รวมทุก arm) ---
  const dm = difficultyMap(graded, scenIds);
  const degenerate = dm.filter((d) => d.n > 0 && (d.rate === 1 || d.rate === 0));
  const pooledPass = graded.filter((g) => g.CRIT === 1).length;
  const pooled = graded.length ? pooledPass / graded.length : NaN;

  checks.push({
    name: 'จำนวนโจทย์ที่ยังแยกแยะได้',
    ok: degenerate.length <= CRITERIA.degenerateScenarioMax,
    detail: `โจทย์ที่ได้เต็มหรือศูนย์ทั้งหมด ${degenerate.length} จาก ${scenIds.length}`
      + (degenerate.length ? ` (${degenerate.map((d) => `${d.id.slice(0, 3)}=${d.pass}/${d.n}`).join(', ')})` : ''),
    note: `NO-GO เมื่อ >= ${CRITERIA.degenerateScenarioMax + 1}`,
  });
  checks.push({
    name: 'อัตราผ่านรวมทุก arm',
    ok: Number.isFinite(pooled) && pooled > CRITERIA.pooledFloor && pooled < CRITERIA.pooledCeiling,
    detail: Number.isFinite(pooled) ? `${(pooled * 100).toFixed(1)}%` : 'ไม่มีข้อมูล',
    note: `ต้องอยู่ระหว่าง ${CRITERIA.pooledFloor * 100}% ถึง ${CRITERIA.pooledCeiling * 100}%`,
  });

  return { checks, difficulty: dm, pooled, degenerate: degenerate.length, missing, dupes };
}

// ---------------------------------------------------------------- CLI

if (path.resolve(process.argv[1] ?? '') === path.resolve(fileURLToPath(import.meta.url))) {
  const inFile = path.resolve(ROOT, argv('--in', 'results/latest.json'));
  if (!fs.existsSync(inFile)) {
    console.error(`\n⛔ ไม่พบ ${path.relative(ROOT, inFile)} — ยังไม่มีข้อมูล rep 0 ให้ตรวจ\n`);
    process.exit(2);
  }
  const raw = JSON.parse(fs.readFileSync(inFile, 'utf8'));
  const meta = raw.meta;
  const graded = raw.graded.filter((g) => !g.error && g.rep === 0);

  console.log('\n=== ประตูตรวจสภาพหลัง rep 0 (assay sanity gate) ===\n');
  console.log(`  ข้อมูล: ${path.relative(ROOT, inFile)} · adapter ${meta.adapter} · โมเดล ${meta.fixedFactors?.model ?? '?'}`);
  console.log(`  เกณฑ์ประกาศไว้ล่วงหน้าใน PRE-REGISTRATION.md §10 — ห้ามแก้หลังเห็นข้อมูล\n`);

  if (meta.simulated) {
    console.log('  ⚠️  ข้อมูลชุดนี้มาจาก mock adapter — ใช้ตรวจว่าประตูทำงานได้เท่านั้น\n');
  }

  const res = evaluateGate({ graded, scenIds: meta.scenarios, armIds: meta.arms, reps: 1 });

  // --- สภาพ runtime ---
  let runtimeOk = true, runtimeDetail = 'ไม่มี manifest ให้เทียบ (ข้อมูล mock หรือชุดเก่า)';
  const sigHash = raw.meta?.sigHash;
  const mfCandidates = fs.existsSync(path.join(ROOT, 'results'))
    ? fs.readdirSync(path.join(ROOT, 'results')).filter((f) => f.startsWith('manifest-') && !f.includes('retired'))
    : [];
  const mfFile = sigHash ? manifestPath(path.join(ROOT, 'results'), sigHash)
    : (mfCandidates.length === 1 ? path.join(ROOT, 'results', mfCandidates[0]) : null);
  const manifest = mfFile && fs.existsSync(mfFile) ? loadManifest(mfFile) : null;

  if (manifest) {
    const digest = experimentDigest(ROOT);
    const bad = [];
    for (const g of graded) {
      // artifact เต็มไม่ได้อยู่ใน graded — ตรวจเท่าที่ graded พกมาได้ ส่วนที่เหลือ runner assert ไปแล้วราย run
      if (g.apiKeySource && manifest.apiKeySource && g.apiKeySource !== manifest.apiKeySource) {
        bad.push(`${g.runId}: apiKeySource ${g.apiKeySource}`);
      }
    }
    if (digest.combined !== manifest.experimentDigest) {
      bad.push(`ไฟล์การทดลองเปลี่ยนหลังแช่แข็ง (${digest.combined} != ${manifest.experimentDigest})`);
    }
    runtimeOk = bad.length === 0;
    runtimeDetail = bad.length ? bad.slice(0, 4).join(' · ') : `ตรงกับ manifest ที่ตรึงไว้ (CLI ${manifest.cliVersion})`;
  }
  res.checks.push({
    name: 'สภาพ runtime ตรงกับ manifest',
    ok: runtimeOk,
    detail: runtimeDetail,
    note: 'ทุก run ถูก assert ตอนเก็บอยู่แล้ว — ข้อนี้ตรวจซ้ำที่ระดับชุด',
  });

  for (const c of res.checks) {
    console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.name}`);
    console.log(`        ${c.detail}`);
    if (c.note) console.log(`        (${c.note})`);
  }

  console.log('\n  แผนที่ความยาก — รวมทุก arm เข้าด้วยกัน ไม่แยกกลุ่ม');
  for (const d of res.difficulty) {
    const bar = Number.isFinite(d.rate) ? '#'.repeat(Math.round(d.rate * 20)).padEnd(20, '·') : '?'.repeat(20);
    console.log(`    ${d.id.padEnd(24)} ${bar} ${d.pass}/${d.n}`);
  }

  const go = res.checks.every((c) => c.ok);
  console.log('');
  console.log(go
    ? '  ✅ GO — เดินหน้า rep 1–5 ต่อได้ ด้วยคำสั่งเดิมพร้อม --resume (ไม่ต้องแก้ --reps)'
    : '  ⛔ NO-GO — หยุด แก้สาเหตุก่อน');
  if (!go) {
    console.log('     ⚠️ ถ้าการแก้แตะโมเดล / arm / scenario / grader ต้อง **ทิ้ง rep 0 ทั้งชุด**');
    console.log('        แล้วเริ่ม dataset ใหม่ ห้ามเอามารวมกับข้อมูลหลัก');
  }
  console.log('');
  console.log('  ข้อจำกัดที่ต้องเขียนกำกับเสมอ: ที่ n = 5 ต่อโจทย์ ประตูนี้จับได้เฉพาะความพังระดับหายนะ');
  console.log('  **ไม่ได้รับรองว่า assay ดี** และห้ามอ้างภายหลังว่า "ผ่าน gate แล้ว" เป็นหลักฐานคุณภาพ');
  console.log('  ประตูนี้ไม่คำนวณคะแนนแยก arm และไม่คำนวณผลต่างระหว่างกลุ่มเลย โดยเจตนา\n');

  process.exit(go ? 0 : 1);
}
