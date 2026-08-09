/**
 * runner.mjs — ตัวรันการทดลอง
 *
 * ออกแบบเป็น randomized block design:
 *   block = 1 repetition, ภายใน block รันทุก (scenario x arm) โดยสลับลำดับแบบสุ่ม
 * ทำไมต้องสลับ: ถ้ารัน A0 ทั้งหมดก่อนแล้วค่อย A2 ผลจะปนกับ drift ของ API/โหลดเซิร์ฟเวอร์ในช่วงเวลานั้น
 * การสลับทำให้ drift กระจายเท่าๆ กันทุก arm แทนที่จะไปกองที่ arm เดียว
 *
 * seed ผูกกับ (scenario, repIndex) ไม่ใช่ arm -> ทุก arm เจอเงื่อนไขเดียวกันใน rep เดียวกัน
 * นี่คือสิ่งที่ทำให้ข้อมูล "จับคู่กันได้" และใช้ McNemar ได้ (power สูงกว่าการทดสอบแบบอิสระมาก)
 *
 * ใช้งาน:
 *   node src/runner.mjs --adapter mock --reps 20
 *   node src/runner.mjs --adapter claude-cli --reps 10 --arms A1,A2
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeRng } from './stats.mjs';
import { gradeRun } from './graders.mjs';
import { runMock } from './adapters/mock.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function argv(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

function shuffle(arr, rnd) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

async function main() {
  const adapterName = argv('--adapter', 'mock');
  const reps = parseInt(argv('--reps', '20'), 10);
  const armFilter = argv('--arms', '').split(',').filter(Boolean);
  const masterSeed = parseInt(argv('--seed', '20260804'), 10);

  const configPath = argv('--config', 'config/arms.json');
  const scenFilter = argv('--scenarios', '').split(',').filter(Boolean);
  const resume = process.argv.includes('--resume');
  const maxRetries = parseInt(argv('--max-retries', '5'), 10);

  const config = JSON.parse(fs.readFileSync(path.join(ROOT, configPath), 'utf8'));
  const arms = config.arms.filter((a) => !armFilter.length || armFilter.includes(a.id));
  const scenarios = fs.readdirSync(path.join(ROOT, 'scenarios'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'scenarios', f), 'utf8')))
    .filter((s) => !scenFilter.length || scenFilter.some((p) => s.id.startsWith(p)));

  if (!arms.length) throw new Error('ไม่มี arm ที่ตรงกับตัวกรอง');
  if (!scenarios.length) throw new Error('ไม่มี scenario ที่ตรงกับตัวกรอง');

  let runAgent;
  if (adapterName === 'mock') runAgent = runMock;
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
  const signature = JSON.stringify({ adapterName, reps, masterSeed, configPath,
                                     arms: arms.map((a) => a.id), scenarios: scenarios.map((s) => s.id) });
  console.log(`\nSkillBench — ${adapterName}`);
  console.log(`  ${scenarios.length} scenarios x ${arms.length} arms x ${reps} reps = ${total} runs`);
  if (adapterName === 'mock') console.log('  [SIMULATION] ตัวเลขที่ได้เป็นของปลอม ใช้ตรวจ pipeline เท่านั้น');
  console.log('');

  const outDirEarly = path.join(ROOT, 'results');
  fs.mkdirSync(outDirEarly, { recursive: true });
  const ckptPath = path.join(outDirEarly, 'checkpoint.json');

  /*
   * เก็บผลทีละ run ไม่รอจนจบ
   *
   * calibration ใช้เวลา ~3.4 ชม. การทดลองหลัก ~38 ชม.
   * ถ้าเขียนผลตอนจบอย่างเดียว การถูกฆ่าที่ run สุดท้ายคือเสียงานทั้งวัน
   * และการรันยาวขนาดนี้ "จะ" ถูกขัดจังหวะ ไม่ใช่ "อาจจะ" (โควตาหมด เน็ตหลุด เครื่อง sleep)
   */
  let artifacts = [], graded = [];
  if (resume && fs.existsSync(ckptPath)) {
    const ck = JSON.parse(fs.readFileSync(ckptPath, 'utf8'));
    if (ck.signature === signature) {
      artifacts = ck.artifacts; graded = ck.graded;
      console.log(`  ทำต่อจาก checkpoint: มีอยู่แล้ว ${artifacts.length}/${total} run\n`);
    } else {
      console.log('  checkpoint ที่มีเป็นของการทดลองคนละชุด — เริ่มใหม่\n');
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

  const saveCheckpoint = () => fs.writeFileSync(ckptPath,
    JSON.stringify({ signature, savedAt: new Date().toISOString(), artifacts, graded }));

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

  for (let rep = 0; rep < reps && !sessionLimitHit; rep++) {
    const cells = shuffle(scenarios.flatMap((s) => arms.map((a) => ({ s, a }))), rnd);
    for (const { s, a } of cells) {
      if (sessionLimitHit) break;
      const runId = `${s.id}__${a.id}__r${rep}`;
      if (doneIds.has(runId)) continue;   // ทำไปแล้วใน checkpoint

      // seed ผูกกับ (scenario, rep) เท่านั้น -> paired ข้าม arm
      const seed = (masterSeed + rep * 7919 + hash(s.id) * 31 + hash(a.id)) >>> 0;
      const workspace = path.join(ROOT, s.fixture ?? 'fixtures/next-mini');

      /*
       * เจอโควตาหมดให้ "รอแล้วลองใหม่" ไม่ใช่บันทึกเป็น run ที่ล้มเหลว
       *
       * ถ้าไม่ทำแบบนี้ พอโควตาหมดกลางคัน run ที่เหลือทั้งหมดจะพังรัวๆ ภายในไม่กี่นาที
       * ได้ dataset ที่มี error 80% แทนที่จะรอ 20 นาทีแล้วเก็บได้ครบ
       */
      let artifact;
      for (let attempt = 0; ; attempt++) {
        try {
          artifact = await runAgent({ scenario: s, arm: a, repIndex: rep, seed, workspace,
                                      fixedFactors: config.fixedFactors });
        } catch (e) {
          artifact = { runId, scenarioId: s.id, armId: a.id, repIndex: rep, seed,
                       toolCalls: [], commands: [], filesChanged: [], diff: '', finalMessage: '', loadedSkills: [],
                       usage: {}, error: String(e.message ?? e) };
        }
        if (!isShortLimit(artifact.error) || attempt >= maxRetries) break;
        const waitMin = Math.min(20, 5 * (attempt + 1));   // 5, 10, 15, 20, 20...
        console.log(`\n  ติดลิมิตสั้นที่ ${runId} — รอ ${waitMin} นาทีแล้วลองใหม่ (ครั้งที่ ${attempt + 1}/${maxRetries})`);
        await new Promise((r) => setTimeout(r, waitMin * 60000));
      }

      // ลิมิตยาว: หยุดทั้งชุดทันที การรันต่อมีแต่จะเผา cell ที่เหลือให้กลายเป็น error
      if (isSessionLimit(artifact.error)) {
        saveCheckpoint();
        console.log(`\n\n  หยุดชั่วคราว — ${artifact.error}`);
        console.log(`  เก็บไว้แล้ว ${artifacts.filter((a) => !a.error).length} run ที่สำเร็จ`);
        console.log('  พอโควตากลับมา รันคำสั่งเดิมพร้อม --resume ได้เลย จะรันซ่อมเฉพาะที่ขาด\n');
        sessionLimitHit = true;
        break;
      }

      artifacts.push(artifact);
      graded.push(gradeRun(artifact, s));
      done++;
      saveCheckpoint();
      const errMark = artifact.error ? ' [error]' : '';
      process.stdout.write(`\r  progress ${done}/${total} (${((done / total) * 100).toFixed(0)}%)${errMark}   `);
    }
  }
  console.log('\n');

  const outDir = outDirEarly;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const meta = { stamp, adapter: adapterName, simulated: adapterName === 'mock', reps, masterSeed,
                 configPath,
                 arms: arms.map((a) => a.id), scenarios: scenarios.map((s) => s.id),
                 armMeta: Object.fromEntries(arms.map((a) => [a.id, { name: a.name, role: a.role, ruleCount: a.ruleCount ?? null }])),
                 fixedFactors: config.fixedFactors, primaryEndpoint: config.primaryEndpoint };

  fs.writeFileSync(path.join(outDir, `graded-${stamp}.json`), JSON.stringify({ meta, graded }, null, 2));
  fs.writeFileSync(path.join(outDir, `artifacts-${stamp}.json`), JSON.stringify(artifacts, null, 2));
  fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify({ meta, graded }, null, 2));

  // CSV ระดับกฎ — เอาไปเปิดใน Excel/SPSS ได้ตรงๆ ตอนทำเล่มรายงาน
  const rows = ['run_id,scenario,arm,rep,rule_id,severity,passed'];
  for (const g of graded) for (const r of g.rules) {
    rows.push(`${g.runId},${g.scenarioId},${g.armId},${g.rep},${r.id},${r.severity},${r.passed ? 1 : 0}`);
  }
  fs.writeFileSync(path.join(outDir, 'rules-long.csv'), rows.join('\n'));

  console.log(`  บันทึกที่ results/latest.json (+ graded-${stamp}.json, artifacts, rules-long.csv)`);
  console.log(`  ต่อไป: node src/analyze.mjs\n`);
}

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

main().catch((e) => { console.error(e); process.exit(1); });
