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

  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/arms.json'), 'utf8'));
  const arms = config.arms.filter((a) => !armFilter.length || armFilter.includes(a.id));
  const scenarios = fs.readdirSync(path.join(ROOT, 'scenarios'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'scenarios', f), 'utf8')));

  let runAgent;
  if (adapterName === 'mock') runAgent = runMock;
  else if (adapterName === 'claude-cli') ({ runClaudeCli: runAgent } = await import('./adapters/claude-cli.mjs'));
  else throw new Error(`unknown adapter: ${adapterName}`);

  const total = reps * scenarios.length * arms.length;
  console.log(`\nSkillBench — ${adapterName}`);
  console.log(`  ${scenarios.length} scenarios x ${arms.length} arms x ${reps} reps = ${total} runs`);
  if (adapterName === 'mock') console.log('  [SIMULATION] ตัวเลขที่ได้เป็นของปลอม ใช้ตรวจ pipeline เท่านั้น');
  console.log('');

  const artifacts = [], graded = [];
  const rnd = makeRng(masterSeed);
  let done = 0;

  for (let rep = 0; rep < reps; rep++) {
    const cells = shuffle(scenarios.flatMap((s) => arms.map((a) => ({ s, a }))), rnd);
    for (const { s, a } of cells) {
      // seed ผูกกับ (scenario, rep) เท่านั้น -> paired ข้าม arm
      const seed = (masterSeed + rep * 7919 + hash(s.id) * 31 + hash(a.id)) >>> 0;
      const workspace = path.join(ROOT, s.fixture ?? 'fixtures/next-mini');
      let artifact;
      try {
        artifact = await runAgent({ scenario: s, arm: a, repIndex: rep, seed, workspace });
      } catch (e) {
        artifact = { runId: `${s.id}__${a.id}__r${rep}`, scenarioId: s.id, armId: a.id, repIndex: rep, seed,
                     toolCalls: [], commands: [], filesChanged: [], diff: '', finalMessage: '', loadedSkills: [],
                     usage: {}, error: String(e.message ?? e) };
      }
      artifacts.push(artifact);
      graded.push(gradeRun(artifact, s));
      done++;
      process.stdout.write(`\r  progress ${done}/${total} (${((done / total) * 100).toFixed(0)}%)   `);
    }
  }
  console.log('\n');

  const outDir = path.join(ROOT, 'results');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const meta = { stamp, adapter: adapterName, simulated: adapterName === 'mock', reps, masterSeed,
                 arms: arms.map((a) => a.id), scenarios: scenarios.map((s) => s.id),
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
