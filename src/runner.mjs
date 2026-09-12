/**
 * runner.mjs — ตัวรันการทดลอง
 *
 * ออกแบบเป็น randomized block design:
 *   block = 1 repetition, ภายใน block รันทุก (scenario x arm) โดยสลับลำดับแบบสุ่ม
 * ทำไมต้องสลับ: ถ้ารัน A0 ทั้งหมดก่อนแล้วค่อย A2 ผลจะปนกับ drift ของ API/โหลดเซิร์ฟเวอร์ในช่วงเวลานั้น
 * การสลับทำให้ drift กระจายเท่าๆ กันทุก arm แทนที่จะไปกองที่ arm เดียว
 *
 * run identity ผูกกับ (scenario, arm, repIndex); seed เป็นเพียงป้ายกำกับและจงใจต่างกันราย arm
 * การจับคู่ทางสถิติใช้คีย์ scenarioId#rep (ไม่ใช้ seed) เพื่อไม่อ้างความเท่าเทียมของ RNG ที่ไม่มี
 *
 * ใช้งาน:
 *   node src/runner.mjs --adapter mock --reps 20
 *   node src/runner.mjs --adapter claude-cli --reps 10 --arms A1,A2
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { makeRng } from './stats.mjs';
import { gradeRun } from './graders.mjs';
import { runMock } from './adapters/mock.mjs';
import {
  queryCliVersion, manifestPath, freezeManifest, loadManifest, validateRuntime,
  experimentDigest, fixtureBaselineTrees, fixtureTreeViolations,
} from './runtime-manifest.mjs';
import { acquireFixtureLock, EXIT_LOCK_BUSY } from './fixture-lock.mjs';
import { AttemptStore, classifyArtifact, writeProjectionJson } from './attempt-store.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function argv(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

/*
 * ไฟล์นี้ต้องรันเมื่อถูกเรียกเป็นสคริปต์เท่านั้น ห้ามรันเพราะถูก import
 *
 * เพิ่มหลังเจอของจริง 4 ก.ย. 2569: การ import เพื่อตรวจว่าโมดูลโหลดผ่านไหม
 * ไปเรียก main() เข้า แล้วมันรัน mock 1100 run จนจบ ทับ results/latest.json
 * กับ rules-long.csv ด้วยข้อมูลปลอม (กู้คืนจาก graded-*.json ที่เก็บไว้แล้ว)
 *
 * ตระกูลเดียวกับข้อบกพร่องที่ 23 เป๊ะ — เครื่องมือเขียนทับข้อมูลของตัวเองโดยไม่มีใครสั่ง
 */
const RUN_AS_SCRIPT = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

function shuffle(arr, rnd) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function canonicalForContainment(target) {
  const abs = path.resolve(target);
  const suffix = [];
  let probe = abs;
  while (!fs.existsSync(probe)) {
    const parent = path.dirname(probe);
    if (parent === probe) return abs;
    suffix.unshift(path.basename(probe));
    probe = parent;
  }
  const real = (fs.realpathSync.native ?? fs.realpathSync)(probe);
  return path.join(real, ...suffix);
}

function isProductionResultsPath(target) {
  const production = canonicalForContainment(path.join(ROOT, 'results'));
  const candidate = canonicalForContainment(target);
  const norm = (p) => process.platform === 'win32' ? p.toLowerCase() : p;
  const base = norm(path.resolve(production));
  const value = norm(path.resolve(candidate));
  return value === base || value.startsWith(`${base}${path.sep}`);
}

export async function main ({ runAgentOverride = null, cliVersionOverride = null, _testHook = null } = {}) {
  const adapterName = argv('--adapter', 'mock');
  const reps = parseInt(argv('--reps', '20'), 10);
  const armFilter = argv('--arms', '').split(',').filter(Boolean);
  const masterSeed = parseInt(argv('--seed', '20260804'), 10);

  const configPath = argv('--config', 'config/arms.json');
  const scenFilter = argv('--scenarios', '').split(',').filter(Boolean);
  const resume = process.argv.includes('--resume');
  const requestedNewExperiment = process.argv.includes('--new-experiment');
  const maxRetries = parseInt(argv('--max-retries', '5'), 10);
  const maxTurnsOverride = argv('--max-turns', '');
  const modelOverride = argv('--model', '');

  /*
   * --stop-after-rep: หยุดหลังทำครบรอบที่ระบุ โดย "เป้าหมาย" ยังเป็น reps เต็มเหมือนเดิม
   *
   * มีไว้สำหรับประตูตรวจสภาพที่ rep 0 โดยเฉพาะ ถ้าใช้ `--reps 1` แล้วค่อยเปลี่ยนเป็น
   * `--reps 6` ทีหลัง signature จะไม่ตรงกัน (reps อยู่ใน signature) -> checkpoint คนละไฟล์
   * -> rep 0 กลายเป็นข้อมูลกำพร้าและต้องเก็บใหม่ทั้ง 55 run
   * flag นี้จึงไม่แตะ signature เลย แค่ break ออกจากลูปเมื่อทำถึงรอบที่กำหนด
   */
  const stopAfterRep = argv('--stop-after-rep', '') === '' ? null : parseInt(argv('--stop-after-rep', ''), 10);

  const config = JSON.parse(fs.readFileSync(path.join(ROOT, configPath), 'utf8'));
  // เพดาน turn เป็นตัวแปรควบคุม การเปลี่ยนค่าทำให้ข้อมูลเทียบกับชุดเดิมไม่ได้
  // จึงต้องเข้าไปอยู่ใน signature ของ checkpoint ด้วย ไม่งั้นจะรันต่อข้ามค่าที่ต่างกันโดยเงียบ
  if (maxTurnsOverride) config.fixedFactors = { ...config.fixedFactors, maxTurns: parseInt(maxTurnsOverride, 10) };
  // โมเดลก็เป็นตัวแปรควบคุมด้วยเหตุผลเดียวกันเป๊ะ — override ได้เพื่อรัน calibration
  // ข้ามโมเดลโดยไม่ต้องแก้ config แต่ค่าที่ใช้จริงต้องเข้า signature เสมอ
  if (modelOverride) config.fixedFactors = { ...config.fixedFactors, model: modelOverride };
  const arms = config.arms.filter((a) => !armFilter.length || armFilter.includes(a.id));
  const scenarios = fs.readdirSync(path.join(ROOT, 'scenarios'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'scenarios', f), 'utf8')))
    .filter((s) => !scenFilter.length || scenFilter.some((p) => s.id.startsWith(p)));

  if (!arms.length) throw new Error('ไม่มี arm ที่ตรงกับตัวกรอง');
  if (!scenarios.length) throw new Error('ไม่มี scenario ที่ตรงกับตัวกรอง');

  let runAgent;
  if (runAgentOverride) runAgent = runAgentOverride;
  else if (adapterName === 'mock') runAgent = runMock;
  else if (adapterName === 'claude-cli') ({ runClaudeCli: runAgent } = await import('./adapters/claude-cli.mjs'));
  else throw new Error(`unknown adapter: ${adapterName}`);

  /*
   * เตือนเรื่องเงินก่อนเริ่ม — ไม่ใช่ความสวยงาม แต่กันความผิดพลาดที่แก้ทีหลังไม่ได้
   *
   * login ด้วย subscription: total_cost_usd เป็นแค่ราคาเทียบเท่า ไม่มีการตัดเงิน
   * ตั้ง ANTHROPIC_API_KEY ไว้: จ่ายจริงทุก token ที่ ~$1.4/run การรันเต็มคือเงินจริงหลักหมื่นบาท
   * ความต่างนี้มองไม่เห็นจากหน้าจอเลยถ้าไม่บอก
   */
  if (adapterName === 'claude-cli' && (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)) {
    console.log('\n  ⚠  พบ ANTHROPIC_API_KEY/AUTH_TOKEN ในสภาพแวดล้อม');
    console.log('     การรันนี้จะ "เสียเงินจริง" ตามจำนวน token (ราว $1.4 ต่อ run)');
    console.log('     ถ้าตั้งใจใช้ subscription ให้ลบตัวแปรนี้ออกก่อน แล้วรันใหม่');
    console.log('     รอ 10 วินาที กด Ctrl+C เพื่อยกเลิก...\n');
    await new Promise((r) => setTimeout(r, 10000));
  }

  const total = reps * scenarios.length * arms.length;
  // ลายเซ็นของการทดลอง — ใช้กัน checkpoint ของคนละชุดมาปนกัน
  const cliVersion = adapterName === 'claude-cli' ? (cliVersionOverride ?? queryCliVersion()) : 'mock';

  /*
   * signature กับ manifest ทำหน้าที่คนละอย่าง และการสลับที่กันคือกับดัก
   *
   *   signature = "ปุ่มที่คนตั้งใจหมุนเอง"     -> เปลี่ยนแล้วต้องได้ dataset ใหม่ (แยก checkpoint)
   *   manifest  = "สิ่งที่ drift ใต้เท้าเราได้"  -> เปลี่ยนแล้วต้อง **หยุดตาย** ไม่ใช่แยก dataset
   *
   * ⚠️ แก้เมื่อ 4 ก.ย. 2569 (รอบสอง) — ก่อนหน้านี้เอา cliVersion ใส่ signature ซึ่ง
   * **ทำตรงข้ามกับที่ตั้งใจ**: พอ CLI อัปเดตตัวเองตอนตีสาม sigHash เปลี่ยน ->
   * ckptPath/mfPath เปลี่ยนชื่อ -> loadManifest คืน null -> แช่แข็ง manifest ใหม่ ->
   * validateRuntime ผ่านฉลุย แล้ว **เริ่มเก็บ dataset ชุดใหม่เงียบๆ** ตื่นมาเจอสองก้อนคนละครึ่ง
   * ด่านตรวจ CLI version ที่เขียนไว้จึงไม่มีทางได้ทำงานเลยแม้แต่ครั้งเดียว
   *
   * เวอร์ชัน CLI จึงย้ายไปอยู่ใน manifest อย่างเดียว และหลักการเดียวกันใช้กับ
   * digest ของไฟล์ arm/scenario/กฎ/grader ด้วย — ถ้าใส่ใน signature การแก้ไฟล์ระหว่างทาง
   * จะกลายเป็น "เริ่มชุดใหม่เงียบๆ" แบบเดียวกัน
   */
  const signature = JSON.stringify({ adapterName, reps, masterSeed, configPath,
                                     maxTurns: config.fixedFactors?.maxTurns ?? 25,
                                     // โมเดลต้องอยู่ใน signature — ไม่งั้น resume ข้ามโมเดลจะนับ
                                     // run ของคนละโมเดลรวมเป็นชุดเดียวกันโดยเงียบ (ตระกูลเดียวกับข้อบกพร่องที่ 23)
                                     model: config.fixedFactors?.model ?? 'claude-opus-5',
                                     arms: arms.map((a) => a.id), scenarios: scenarios.map((s) => s.id) });
  console.log(`\nSkillBench — ${adapterName}`);
  console.log(`  ${scenarios.length} scenarios x ${arms.length} arms x ${reps} reps = ${total} runs`);
  if (adapterName === 'mock') console.log('  [SIMULATION] ตัวเลขที่ได้เป็นของปลอม ใช้ตรวจ pipeline เท่านั้น');
  console.log('');

  /*
   * --out: เขียนผลลงที่อื่นแทน results/
   *
   * เพิ่มหลังเกิดของจริง 4 ก.ย. 2569 — การรัน mock เพื่อตรวจ pipeline เขียนทับ
   * results/latest.json กับ rules-long.csv ด้วยข้อมูลปลอม (กู้คืนจาก graded-*.json ได้)
   * การตรวจ pipeline ต้องไม่แตะโฟลเดอร์เดียวกับข้อมูลจริงตั้งแต่แรก
  */
  const outDirEarly = path.resolve(ROOT, argv('--out', 'results'));
  if (adapterName === 'mock' && isProductionResultsPath(outDirEarly)) {
    throw new Error('mock ห้ามเขียนลง results/ หรือโฟลเดอร์ย่อยของข้อมูลจริง — ใช้ --out tmp/mock แทน');
  }
  fs.mkdirSync(outDirEarly, { recursive: true });

  /*
   * ชื่อไฟล์ checkpoint ต้องผูกกับ signature — ข้อบกพร่องที่ 23
   *
   * เดิมใช้พาธเดียวตายตัว `results/checkpoint.json` ทุกการทดลอง ผลคือเมื่อรันชุดใหม่
   * ที่ signature ไม่ตรง โค้ดจะพิมพ์ว่า "เริ่มใหม่" แล้ว *เขียนทับ* checkpoint ของชุดเดิมทิ้ง
   * ซึ่งกินหลักฐานของ run ที่ถูกขัดจังหวะไปทั้งชุด
   *
   * เกิดขึ้นจริงแล้วหนึ่งครั้ง: pilot A2 ที่เพดาน 25 ชน error_max_turns 2 ใน 3 run
   * ซึ่งเป็นจุดตั้งต้นของ Amendment 1 — พอรันชุดที่เพดาน 50 ทับ หลักฐานนั้นหายทั้งหมด
   * ตอนนี้ไม่มี run ที่ชนเพดานของ A2 เหลือในชุดข้อมูลเลย และตัวเลขนั้นยืนยันซ้ำไม่ได้อีก
   *
   * checkpoint ถูกออกแบบมาเพื่อ "รันต่อได้เมื่อถูกขัดจังหวะ" แต่ถูกใช้เป็น
   * "หลักฐานของการรันที่ถูกขัดจังหวะ" ด้วย — สองอย่างนี้ต้องการอายุของไฟล์คนละแบบ
   */
  const sigHash = crypto.createHash('sha256').update(signature).digest('hex').slice(0, 12);
  const ckptPath = path.join(outDirEarly, `checkpoint-${sigHash}.json`);
  const mfPath = manifestPath(outDirEarly, sigHash);
  const legacyPath = path.join(outDirEarly, 'checkpoint.json');
  /*
   * ยึดทุก fixture ก่อนอ่าน baseline tree และถือต่อเนื่องจนเขียนผลเสร็จ
   *
   * ถ้ายึดเฉพาะใน adapter จะยังมีช่องระหว่าง run และถ้ายึดหลัง snapshot
   * เครื่องมืออื่นอาจย้าย baseline tag ระหว่างที่เราอ่านค่ากับเริ่ม run ได้อีก
   * เรียง path ให้คงที่เพื่อไม่ให้ runner สองตัวที่ใช้หลาย fixture รอกันคนละลำดับ
   */
  const fixtureReleases = [];
  if (adapterName === 'claude-cli') {
    const fixtureDirs = [...new Set(scenarios.map((s) =>
      path.resolve(ROOT, s.fixture ?? 'fixtures/next-mini')))].sort((a, b) => a.localeCompare(b));
    try {
      for (const fixtureDir of fixtureDirs) {
        fixtureReleases.push(acquireFixtureLock(fixtureDir, {
          owner: `collection ${adapterName} reps=${reps}`,
        }));
      }
    } catch (e) {
      for (const release of fixtureReleases.reverse()) release();
      if (e.code !== 'FIXTURE_LOCK_BUSY') throw e;
      console.error('\n  ⛔ เริ่มเก็บข้อมูลไม่ได้ — มีเครื่องมืออื่นถือ fixture อยู่\n');
      console.error(e.message);
      console.error('\n  ดูด้วย npm run lock · แกะล็อกค้างด้วย npm run lock:break\n');
      process.exitCode = EXIT_LOCK_BUSY;
      return;
    }
  }

  try {
  if (_testHook) _testHook('fixture-locked', { fixtureReleases });
  // digest ของไฟล์ที่นิยามการทดลอง — เทียบกับ manifest ทุก run เพื่อจับการแก้ไฟล์ระหว่างทาง
  const expDigest = experimentDigest(ROOT);
  // snapshot ก่อนเอเจนต์ตัวแรกเริ่ม — ถ้าเอเจนต์ย้าย baseline tag ใน run แรก
  // manifest ต้องยังตรึงค่าเดิมและ validator หลัง run ต้องจับความต่างได้
  const fixtureTreesAtStart = adapterName === 'claude-cli'
    ? fixtureBaselineTrees(ROOT, scenarios)
    : null;
  let startedNewExperiment = requestedNewExperiment;
  if (requestedNewExperiment) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    if (fs.existsSync(mfPath)) fs.renameSync(mfPath, mfPath.replace(/\.json$/, `.retired-${stamp}.json`));
    if (fs.existsSync(ckptPath)) fs.renameSync(ckptPath, ckptPath.replace(/\.json$/, `.retired-${stamp}.json`));
    console.error('  --new-experiment: สร้าง experimentId ใหม่และไม่อ่าน checkpoint ชุดเดิม\n');
  }
  let manifest = requestedNewExperiment ? null : loadManifest(mfPath);
  if (manifest) {
    console.log(`  manifest ที่ตรึงไว้: CLI ${manifest.cliVersion} · tool ${manifest.toolset.length} ตัว · baseline skill ${manifest.baselineSkills.length} ตัว`);

    /*
     * pre-flight — สิ่งที่รู้ได้ "ก่อน" ยิง run แรก ต้องหยุดตั้งแต่ตรงนี้
     *
     * validateRuntime ตรวจหลัง run จบ ซึ่งแปลว่าถ้า CLI อัปเดตตัวเองข้ามคืน
     * เราจะเสีย run ไปหนึ่งตัว (และเงิน/โควตาของมัน) ก่อนจะรู้ตัว
     * เวอร์ชัน CLI กับ digest ของไฟล์การทดลอง รู้ได้ก่อนทั้งคู่ จึงตรวจตรงนี้เลย
     */
    const preflight = [];
    if (manifest.cliVersion && manifest.cliVersion !== cliVersion) {
      preflight.push(`เวอร์ชัน CLI เปลี่ยนไปจากที่ตรึงไว้: ${cliVersion} != ${manifest.cliVersion}`);
    }
    if (manifest.experimentDigest && manifest.experimentDigest !== expDigest.combined) {
      const changed = Object.keys(expDigest.files)
        .filter((f) => manifest.experimentFiles?.[f] !== expDigest.files[f]);
      preflight.push(`ไฟล์ที่นิยามการทดลองถูกแก้หลังเริ่มเก็บข้อมูล — เปลี่ยน ${changed.length} ไฟล์: ${changed.slice(0, 6).join(', ')}${changed.length > 6 ? ' …' : ''}`);
    }
    preflight.push(...fixtureTreeViolations(manifest, fixtureTreesAtStart));
    if (preflight.length) {
      console.error('\n  ⛔ สภาพไม่ตรงกับ manifest ที่ตรึงไว้ — หยุดก่อนเริ่ม run แม้แต่ตัวเดียว\n');
      for (const x of preflight) console.error(`     - ${x}`);
      console.error('\n  ทางเลือกมีสองทาง และทั้งคู่ต้องเป็นการตัดสินใจของคน ไม่ใช่ของสคริปต์:');
      console.error('    1) ทำให้สภาพกลับไปตรงกับ manifest (ปักหมุดเวอร์ชัน CLI เดิม / คืนไฟล์ที่แก้)');
      console.error('    2) ประกาศว่านี่คือการทดลองชุดใหม่ แล้วเริ่ม dataset ใหม่ด้วย --new-experiment');
      console.error('       (ชุดเดิมยังอยู่ครบ ไม่ถูกเขียนทับ — แต่ห้ามเอาสองชุดมารวมกันวิเคราะห์)\n');
      process.exitCode = 1;
      return;
    }
  }

  const attemptStore = AttemptStore.open({
    outDir: outDirEarly,
    signatureHash: sigHash,
    signature,
    newExperiment: requestedNewExperiment,
    legacyProjectionPaths: requestedNewExperiment ? [] : [ckptPath, legacyPath],
  });
  console.log(`  experimentId: ${attemptStore.experimentId}`);
  const blockedRuns = attemptStore.incompleteTerminalRunIds();
  if (blockedRuns.length) {
    throw new Error(`attempt provenance มี terminal attempt ที่ checkpoint ไม่ commit — ห้าม rerun เงียบๆ: ${blockedRuns.join(', ')}; ใช้ --new-experiment หลังตรวจหลักฐาน`);
  }

  /*
   * checkpoint รูปแบบเก่า (พาธเดียวตายตัว) — อ่านต่อได้ แต่ห้ามชุบชีวิตข้ามการทดลอง
   *
   * ⚠️ ช่องโหว่ที่ปิดเมื่อ 4 ก.ย. 2569 (รอบสาม): `--new-experiment` เปลี่ยนชื่อ checkpoint
   * ที่ผูกกับ signature ไปแล้ว แต่โค้ดยัง fallback ไป `results/checkpoint.json`
   * ซึ่ง **มีอยู่จริงในเครื่องนี้** (1.9 MB ลงวันที่ 10 ส.ค.)
   * ผลคือคำสั่งที่แปลว่า "เริ่มชุดใหม่" จะไปดูด run ของการทดลองเก่ากลับเข้ามาแทน
   * — ตรงข้ามกับเจตนาของ flag ทุกประการ
   *
   * เมื่อประกาศเริ่มชุดใหม่ ต้องเริ่มจากศูนย์จริง ๆ ไม่มีข้อยกเว้น
   */
  let readFrom = null;
  if (startedNewExperiment) {
    console.log('  เริ่มการทดลองชุดใหม่ — ไม่อ่าน checkpoint ใด ๆ ทั้ง hashed และรูปแบบเก่า');
  } else {
    readFrom = fs.existsSync(ckptPath) ? ckptPath
      : (fs.existsSync(legacyPath) ? legacyPath : null);
    if (resume && readFrom === legacyPath) {
      console.log('  พบ checkpoint.json รูปแบบเก่า — จะอ่านต่อแต่บันทึกลงไฟล์ใหม่ตาม signature');
    }
  }

  /*
   * เก็บผลทีละ run ไม่รอจนจบ
   *
   * calibration ใช้เวลา ~3.4 ชม. การทดลองหลัก ~38 ชม.
   * ถ้าเขียนผลตอนจบอย่างเดียว การถูกฆ่าที่ run สุดท้ายคือเสียงานทั้งวัน
   * และการรันยาวขนาดนี้ "จะ" ถูกขัดจังหวะ ไม่ใช่ "อาจจะ" (โควตาหมด เน็ตหลุด เครื่อง sleep)
   */
  let artifacts = [], graded = [];
  if (resume && readFrom) {
    const ck = JSON.parse(fs.readFileSync(readFrom, 'utf8'));
    if (ck.signature === signature) {
      artifacts = ck.artifacts; graded = ck.graded;
      console.log(`  ทำต่อจาก checkpoint: มีอยู่แล้ว ${artifacts.length}/${total} run\n`);
    } else {
      // ไม่ใช่ชุดเดียวกัน — ของเดิมยังอยู่ครบ เพราะเราจะเขียนลงไฟล์คนละชื่อ
      console.log(`  checkpoint ที่พบเป็นของการทดลองคนละชุด — เริ่มใหม่ (ของเดิมเก็บไว้ที่ ${path.basename(readFrom)})\n`);
    }
  }
  /*
   * ข้ามเฉพาะ run ที่ "สำเร็จ" เท่านั้น
   *
   * เดิมข้ามตาม runId ทั้งหมดที่มีใน checkpoint ซึ่งรวม run ที่ล้มเหลวเชิงโครงสร้างด้วย
   * ผลคือพอโควตาหมดกลางคันแล้วมา resume มันจะข้ามครบทุก cell แล้วจบทันที
   * โดยไม่รันอะไรเลย และไม่มีอะไรบอกว่าไม่ได้ทำงาน
   */
  const failed = artifacts.filter((a) => a.error);
  if (failed.length) {
    console.log(`  ใน checkpoint มี ${failed.length} run ที่ล้มเหลวเชิงโครงสร้าง — จะรันซ่อมให้`);
    const keep = new Set(artifacts.filter((a) => !a.error).map((a) => a.runId));
    artifacts = artifacts.filter((a) => keep.has(a.runId));
    graded = graded.filter((g) => keep.has(g.runId));
  }
  const doneIds = new Set(artifacts.map((a) => a.runId));

  const saveCheckpoint = ({ attempt = null, state = null, scheduler = 'continue', reason = 'checkpoint_projection' } = {}) =>
    saveCheckpointWithProvenance({
      file: ckptPath,
      projection: {
        signature,
        experimentId: attemptStore.experimentId,
        savedAt: new Date().toISOString(),
        artifacts,
        graded,
      },
      attemptStore, attempt, state, scheduler, reason,
    });

  /*
   * แยกลิมิต 2 ชนิด เพราะวิธีรับมือต่างกันคนละเรื่อง
   *
   * ลิมิตสั้น (rate limit / overloaded): รอไม่กี่นาทีก็ผ่าน -> รอแล้วลองใหม่ที่ run เดิม
   * ลิมิตยาว (session limit): รีเซ็ตอีกหลายชั่วโมง -> รอไม่คุ้ม ต้องหยุดทั้งชุดแล้วบอกให้มา resume
   *
   * ของเดิมจับแค่ /rate.?limit|usage limit/ ซึ่งพลาดข้อความจริงที่ CLI ส่งมาคือ
   *   "You've hit your session limit · resets 6:40am (Asia/Bangkok)"
   * ผลคือไม่รอ ไม่หยุด ไล่รันต่อจนพังรวด 33 run ภายในสองนาที
   */
  const isShortLimit = (err) => err && /rate.?limit|429|overloaded|too many requests|try again/i.test(String(err));
  const isSessionLimit = (err) => err && /session limit|usage limit|weekly limit|hit your limit|limit.*reset/i.test(String(err));

  const rnd = makeRng(masterSeed);
  let done = artifacts.length;
  let sessionLimitHit = false;
  let lastAttempt = null;
  let lastState = null;

  for (let rep = 0; rep < reps && !sessionLimitHit; rep++) {
    const cells = shuffle(scenarios.flatMap((s) => arms.map((a) => ({ s, a }))), rnd);
    for (const { s, a } of cells) {
      if (sessionLimitHit) break;
      const runId = `${s.id}__${a.id}__r${rep}`;
      if (doneIds.has(runId)) continue;   // ทำไปแล้วใน checkpoint

      /*
       * seed นี้เป็น "ป้ายกำกับ" ไม่ใช่ตัวคุมความสุ่มของเอเจนต์
       * (claude-cli ไม่รับ seed — ดู adapters/claude-cli.mjs ที่เก็บลง artifact เฉยๆ)
       *
       * การจับคู่ข้าม arm ทำที่ analyze.mjs ด้วยคีย์ scenarioId#rep ไม่ใช่ค่า seed
       * จึงจงใจใส่ hash(a.id) ให้ค่าต่างกันรายก arm เพื่อไม่ให้ใครเผลอเอา seed ไปใช้จับคู่
       */
      const seed = (masterSeed + rep * 7919 + hash(s.id) * 31 + hash(a.id)) >>> 0;
      const workspace = path.join(ROOT, s.fixture ?? 'fixtures/next-mini');

      /*
       * เจอโควตาหมดให้ "รอแล้วลองใหม่" ไม่ใช่บันทึกเป็น run ที่ล้มเหลว
       *
       * ถ้าไม่ทำแบบนี้ พอโควตาหมดกลางคัน run ที่เหลือทั้งหมดจะพังรัวๆ ภายในไม่กี่นาที
       * ได้ dataset ที่มี error 80% แทนที่จะรอ 20 นาทีแล้วเก็บได้ครบ
       */
      let artifact;
      let attemptRef;
      let attemptState;
      for (let attempt = 0; ; attempt++) {
        attemptRef = attemptStore.beginAttempt({
          runId, scenarioId: s.id, armId: a.id, repIndex: rep, seed,
        });
        lastAttempt = attemptRef;
        attemptStore.recordDisposition(attemptRef, {
          execution: 'interrupted_unknown', termination: 'unknown', measurement: 'unknown',
          runtime: 'not_checked', grading: 'not_attempted', scheduler: 'selected',
          reason: 'before_adapter_invocation',
        });
        let adapterException = false;
        try {
          artifact = await runAgent({ scenario: s, arm: a, repIndex: rep, seed, workspace,
                                      fixedFactors: config.fixedFactors,
                                      // ตรวจ auto-memory ว่าง "ก่อน" run โดยใช้พาธที่ manifest ตรึงไว้
                                      memoryAutoPathHint: manifest?.memoryAutoPath ?? null });
        } catch (e) {
          adapterException = true;
          artifact = { runId, scenarioId: s.id, armId: a.id, repIndex: rep, seed,
                       toolCalls: [], commands: [], filesChanged: [], diff: '', finalMessage: '', loadedSkills: [],
                       usage: {}, error: String(e.message ?? e) };
        }
        attemptState = {
          ...classifyArtifact(artifact, { adapterException }), runtime: 'not_checked', grading: 'not_attempted',
        };
        lastState = attemptState;
        // Must be the first durable action after the adapter settles, including a thrown adapter.
        attemptStore.recordArtifact(attemptRef, { artifact, ...attemptState });
        if (!isShortLimit(artifact.error) || attempt >= maxRetries) break;
        attemptStore.recordDisposition(attemptRef, {
          ...attemptState, scheduler: 'retry', reason: 'short_limit_retry',
          details: { retryNumber: attempt + 1, maxRetries },
        });
        const waitMin = Math.min(20, 5 * (attempt + 1));   // 5, 10, 15, 20, 20...
        console.log(`\n  ติดลิมิตสั้นที่ ${runId} — รอ ${waitMin} นาทีแล้วลองใหม่ (ครั้งที่ ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, waitMin * 60000));
      }

      // ลิมิตยาว: หยุดทั้งชุดทันที การรันต่อมีแต่จะเผา cell ที่เหลือให้กลายเป็น error
      if (isSessionLimit(artifact.error)) {
        attemptStore.recordDisposition(attemptRef, {
          ...attemptState, scheduler: 'pause', reason: 'session_limit_pause',
        });
        saveCheckpoint({ attempt: attemptRef, state: attemptState, scheduler: 'pause', reason: 'checkpoint_projection' });
        console.log(`\n\n  หยุดชั่วคราว — ${artifact.error}`);
        console.log(`  เก็บไว้แล้ว ${artifacts.filter((a) => !a.error).length} run ที่สำเร็จ`);
        console.log('  พอโควตากลับมา รันคำสั่งเดิมพร้อม --resume ได้เลย จะรันซ่อมเฉพาะที่ขาด\n');
        sessionLimitHit = true;
        break;
      }

      /*
       * ตรวจสภาพ runtime แบบ fail-closed — run แรกแช่แข็ง manifest ที่เหลือต้องตรงกับมัน
       *
       * นี่คือสิ่งที่ขาดไปตลอดและทำให้ตัวแปรควบคุมสามตัวหลุดโดยไม่มีใครรู้
       * (model ไม่เคยถูกอ่าน / temperature ไม่เคยถูกส่ง / MCP เล็ดลอดผ่าน --tools)
       * ข้อมูลหลักฐานเคยถูกบันทึกไว้ครบใน artifact อยู่แล้ว แต่ไม่มีใคร assert
       *
       * หยุดทั้งชุดเมื่อไม่ผ่าน ไม่ใช่บันทึกแล้วรันต่อ เพราะ run ที่เก็บภายใต้สภาพที่ต่างกัน
       * เอามารวมเป็น dataset เดียวไม่ได้ และการรู้ทีหลังตอนวิเคราะห์ = เก็บใหม่ทั้งหมด
       */
      if (adapterName === 'claude-cli' && !artifact.error) {
        if (_testHook) _testHook('before-runtime-validation', { runId, workspace });
        const initEv = (artifact.rawEvents ?? []).find((e) => e.type === 'system' && e.subtype === 'init');
        if (!manifest) {
          if (!initEv) {
            attemptState = { ...attemptState, runtime: 'violations' };
            lastState = attemptState;
            attemptStore.recordDisposition(attemptRef, {
              ...attemptState, scheduler: 'stop', reason: 'missing_init_before_manifest',
            });
            console.log(`\n\n  ⛔ run แรก (${runId}) ไม่มี system:init — ตรึงสภาพ runtime ไม่ได้ หยุดก่อน\n`);
            saveCheckpoint({ attempt: attemptRef, state: attemptState, scheduler: 'stop', reason: 'checkpoint_projection' });
            process.exitCode = 1;
            return;
          }
          manifest = freezeManifest({
            file: mfPath, init: initEv, cliVersion, digest: expDigest,
            fixtureTrees: fixtureTreesAtStart,
            declared: { model: config.fixedFactors?.model, maxTurns: config.fixedFactors?.maxTurns,
                        toolset: [...new Set([...(config.fixedFactors?.toolset ?? []), 'Skill'])] },
          });
          console.log(`\n  แช่แข็ง manifest จาก run แรก -> ${path.basename(mfPath)}`);
          console.log(`    CLI ${manifest.cliVersion} · tool ${manifest.toolset.length} · baseline skill ${manifest.baselineSkills.length} · auth ${manifest.apiKeySource}`);
          console.log(`    digest ของไฟล์การทดลอง ${manifest.experimentDigest}`);
        }
        const violations = validateRuntime({
          init: initEv, toolCalls: artifact.toolCalls, arm: a, manifest,
          // คำนวณ digest ใหม่ "ทุก run" ไม่ใช่ครั้งเดียวก่อนลูป — การทดลองหลักกินเวลา ~38 ชม.
          // ถ้าคำนวณครั้งเดียว การแก้ไฟล์ arm ระหว่างทางจะไม่ถูกจับจนกว่าจะ restart
          digest: experimentDigest(ROOT),
          fixtureTrees: fixtureBaselineTrees(ROOT, scenarios),
          memoryStateBefore: artifact.control?.memoryStateBefore,
          memoryStateAfter: artifact.control?.memoryStateAfter,
        });
        if (violations.length) {
          attemptState = { ...attemptState, runtime: 'violations' };
          lastState = attemptState;
          attemptStore.recordDisposition(attemptRef, {
            ...attemptState, scheduler: 'stop', reason: 'runtime_violations', details: violations,
          });
          saveCheckpoint({ attempt: attemptRef, state: attemptState, scheduler: 'stop', reason: 'checkpoint_projection' });
          console.log(`\n\n  ⛔ สภาพ runtime ของ ${runId} ไม่ตรงกับ manifest ที่ตรึงไว้ — หยุดทั้งชุด`);
          for (const x of violations) console.log(`     - ${x}`);
          console.log(`\n  run นี้ไม่ถูกบันทึกลง dataset · เก็บสำเร็จไปแล้ว ${artifacts.filter((x) => !x.error).length} run`);
          console.log('  แก้สาเหตุก่อน แล้วค่อย --resume · ถ้าสาเหตุคือ CLI อัปเดตตัวเอง ต้องตัดสินใจว่าจะ');
          console.log('  ปักหมุดเวอร์ชันเดิมกลับ หรือประกาศเริ่มการทดลองชุดใหม่ — ห้ามรันต่อเฉยๆ\n');
          process.exitCode = 1;
          return;
        }
        if (_testHook) _testHook('after-runtime-validation', { runId, workspace });
      }

      artifacts.push(artifact);
      if (adapterName === 'claude-cli' && !artifact.error) attemptState = { ...attemptState, runtime: 'valid' };
      try {
        if (_testHook) _testHook('before-grading', { runId, workspace });
        const result = gradeWithProvenance({ attemptStore, attempt: attemptRef, state: attemptState,
          artifact, scenario: s });
        graded.push(result.graded);
        attemptState = result.state;
        lastState = attemptState;
      } catch (e) {
        attemptState = { ...attemptState, grading: 'failed' };
        lastState = attemptState;
        throw e;
      }
      done++;
      saveCheckpoint({ attempt: attemptRef, state: attemptState, scheduler: 'continue', reason: 'checkpoint_projection' });
      const errMark = artifact.error ? ' [error]' : '';
      process.stdout.write(`\r  progress ${done}/${total} (${((done / total) * 100).toFixed(0)}%)${errMark}   `);
    }

    // ประตูตรวจสภาพ: หยุดหลังครบรอบที่กำหนด โดยไม่แตะ signature (ดูคอมเมนต์ที่ --stop-after-rep)
    if (stopAfterRep !== null && rep >= stopAfterRep && !sessionLimitHit) {
      if (lastAttempt && lastState) {
        attemptStore.recordDisposition(lastAttempt, {
          ...lastState, scheduler: 'stop', reason: 'stop_after_rep', details: { stopAfterRep },
        });
      }
      console.log(`\n\n  หยุดตาม --stop-after-rep ${stopAfterRep} (เป้าหมายเต็มยังเป็น ${reps} รอบ)`);
      console.log('  checkpoint เดิมใช้ต่อได้ — สั่งคำสั่งเดิมพร้อม --resume โดยไม่ต้องแก้ --reps\n');
      break;
    }
  }
  console.log('\n');

  const outDir = outDirEarly;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const meta = { stamp, adapter: adapterName, simulated: adapterName === 'mock', reps, masterSeed,
                 configPath, experimentId: attemptStore.experimentId,
                 arms: arms.map((a) => a.id), scenarios: scenarios.map((s) => s.id),
                 armMeta: Object.fromEntries(arms.map((a) => [a.id, { name: a.name, role: a.role, ruleCount: a.ruleCount ?? null }])),
                 fixedFactors: config.fixedFactors, primaryEndpoint: config.primaryEndpoint };

  if (_testHook) _testHook('before-final-output', { outDir });
  fs.writeFileSync(path.join(outDir, `graded-${stamp}.json`), JSON.stringify({ meta, graded }, null, 2));
  fs.writeFileSync(path.join(outDir, `artifacts-${stamp}.json`), JSON.stringify(artifacts, null, 2));
  fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify({ meta, graded }, null, 2));

  // CSV ระดับกฎ — เอาไปเปิดใน Excel/SPSS ได้ตรงๆ ตอนทำเล่มรายงาน
  const rows = ['run_id,scenario,arm,rep,rule_id,severity,passed'];
  for (const g of graded) for (const r of g.rules) {
    rows.push(`${g.runId},${g.scenarioId},${g.armId},${g.rep},${r.id},${r.severity},${r.passed ? 1 : 0}`);
  }
  fs.writeFileSync(path.join(outDir, 'rules-long.csv'), rows.join('\n'));

  console.log(`  บันทึกที่ ${path.relative(ROOT, outDir) || "."}/latest.json (+ graded-${stamp}.json, artifacts, rules-long.csv)`);
  console.log(`  ต่อไป: node src/analyze.mjs\n`);
  } finally {
    for (const release of fixtureReleases.reverse()) release();
  }
}

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

export function gradeWithProvenance({ attemptStore, attempt, state, artifact, scenario, grader = gradeRun }) {
  attemptStore.recordDisposition(attempt, {
    ...state, scheduler: 'selected', reason: 'before_grading',
  });
  try {
    return { graded: grader(artifact, scenario), state: { ...state, grading: 'graded' } };
  } catch (e) {
    const failed = { ...state, grading: 'failed' };
    attemptStore.recordDisposition(attempt, {
      ...failed, scheduler: 'stop', reason: 'grader_exception', details: String(e.message ?? e),
    });
    throw e;
  }
}

export function saveCheckpointWithProvenance({ file, projection, attemptStore, attempt = null, state = null,
  scheduler = 'continue', reason = 'checkpoint_projection', writer = writeProjectionJson }) {
  if (attempt && state) {
    attemptStore.recordDisposition(attempt, { ...state, scheduler, reason: `before_${reason}` });
  }
  try {
    writer(file, projection);
    if (attempt && state) {
      attemptStore.recordDisposition(attempt, { ...state, scheduler, reason: 'checkpoint_committed' });
    }
  } catch (e) {
    if (attempt && state) {
      attemptStore.recordDisposition(attempt, {
        ...state, scheduler: 'stop', reason: 'checkpoint_exception', details: String(e.message ?? e),
      });
    }
    throw e;
  }
}

if (RUN_AS_SCRIPT) main().catch((e) => { console.error(e); process.exit(1); });
