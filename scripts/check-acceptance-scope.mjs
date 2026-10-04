#!/usr/bin/env node
/**
 * ด่านที่สี่ของเทสยอมรับ — เฉลยอ้างอิงต้อง "ทำถูกตามโจทย์" ไม่ใช่แค่ทำให้เทสเขียว
 *
 * check-acceptance-green.mjs พิสูจน์ว่ามีทางทำให้เทสผ่าน แต่ไม่ได้ถามว่าทางนั้นอยู่ในขอบเขต
 * ที่โจทย์อนุญาตหรือเปล่า ชุดที่ 2 พังตรงนี้: เทสของ S07 ยัด event `BookingCancelled`
 * ที่ fixture ยังไม่รู้จัก เฉลยอ้างอิงจึงต้องสร้างการยกเลิกขึ้นมาเอง (ซึ่งเป็นงานของ S10)
 * เทสเขียวได้จริง แต่ไม่มีเอเจนต์คนไหนผ่านได้โดยไม่ทำเกินโจทย์ · AC_IMPL ของ S07 จึงได้ 0% ทุกกลุ่ม
 *
 * ตรวจสองข้อ:
 *   1. event ทุกชนิดที่เทสยอมรับยัดลงข้อมูล ต้องมีอยู่ใน src/domain/events.ts ของสภาพเริ่มต้น
 *      เว้นแต่โจทย์ประกาศไว้ใน `introducesEvents` ว่าการสร้าง event นั้นคืองานของโจทย์
 *   2. เฉลยอ้างอิงต้องผ่านกฎขอบเขต (SC*) และกฎห้ามทำเกิน (GP*) ที่ตรวจจากไฟล์/diff ได้
 *
 *   node scripts/check-acceptance-scope.mjs
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, rmSync, cpSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { refuseIfCollecting } from './collection-guard.mjs';
import { applyPatches } from './patch-fixture.mjs';
import { lockFixtureForProcess } from '../src/fixture-lock.mjs';
import { applyScenarioSetup, scenarioById } from './lib/scenario-setup.mjs';
import { gradeRun } from '../src/graders.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
refuseIfCollecting(ROOT, 'check-acceptance-scope');

const SRC = join(ROOT, 'scenarios', 'acceptance');
const REF = join(SRC, 'reference');
const FIXTURE = join(ROOT, 'fixtures', 'gpu-booking');
lockFixtureForProcess(FIXTURE, 'check-acceptance-scope');
const DEST_NAME = '__acceptance__';
const DEST = join(FIXTURE, DEST_NAME);

const git = (args) => execFileSync('git', args, { cwd: FIXTURE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
// reset ก่อน — สภาพเริ่มต้นของโจทย์ถูก stage ไว้ด้านล่าง checkout เปล่า ๆ จะคืนไปที่ index ไม่ใช่ HEAD
const clean = () => { try { git(['reset', '-q']); git(['checkout', '--', '.']); git(['clean', '-fd']); } catch { /* ปล่อย */ } };

/** กฎที่ตัดสินได้จากไฟล์และ diff ล้วน — ไม่ต้องมีข้อความตอบ คำสั่ง หรือ probe */
const STRUCTURAL = new Set(['files_within', 'files_not_touch', 'max_files_changed', 'max_diff_lines',
  'diff_not_matches', 'no_unrequested_feature']);

/**
 * กฎที่คำตอบที่ถูกทุกแบบต้องผ่าน: กฎเชิงโครงสร้างที่เป็น critical ทุกข้อ + SC/GP เชิงโครงสร้างทุกข้อ
 * (ผู้รีวิว C5) — เดิมตรวจแค่ SC/GP กับเฉลยตัวเดียว จึงไม่เห็นกรณีอย่าง S06 AC1/AC3 ที่ยิงใส่
 * บรรทัด "+  LECTURER: 16" ซึ่งโผล่ได้เมื่อคำตอบที่ถูกเขียนบล็อก MAX_HOURS_PER_WEEK ใหม่
 * ไม่รวม diff_matches/files_include เพราะเป็นข้อเรียกร้องเชิงบวกที่เฉลยไม่จำเป็นต้องทำ (เช่น เพิ่มเทส)
 */
const mustPass = (r) => STRUCTURAL.has(r.check?.type) && ((r.severity ?? 'major') === 'critical' || /^(SC|GP)/.test(r.id));
const VAR = join(SRC, 'variants');

/** ปะคำตอบหนึ่งแบบลงสภาพเริ่มต้น แล้วคืนรายการกฎที่มันตก */
async function structuralFailures(scenario, patchPath, label) {
  clean();
  applyScenarioSetup(ROOT, FIXTURE, scenario.id);
  git(['add', '-A']);
  const mod = await import(pathToFileURL(patchPath).href);
  const { error } = applyPatches(FIXTURE, mod.patches);
  if (error) return [`${label}: ปะไม่ได้ — ${error}`];
  git(['add', '-A', '-N']);
  const filesChanged = git(['diff', '--name-only']).split('\n').map((x) => x.trim()).filter(Boolean)
    .filter((f) => !f.startsWith(`${DEST_NAME}/`));
  const diff = git(['diff']);
  const rules = scenario.rules.filter(mustPass);
  const graded = gradeRun({ runId: scenario.id, armId: 'reference', repIndex: 0, toolCalls: [], commands: [],
    filesChanged, diff, finalMessage: '' }, { ...scenario, rules });
  return graded.rules.filter((x) => !x.passed).map((r) => `${label} ตกกฎ ${r.id} — ${r.desc}`);
}

const refs = existsSync(REF)
  ? readdirSync(REF).filter((f) => f.endsWith('.patch.mjs')).map((f) => f.replace(/\.patch\.mjs$/, '')).sort()
  : [];

console.log('=== เฉลยอ้างอิงต้องอยู่ในขอบเขตของโจทย์ ===\n');

let failed = 0;
for (const id of refs) {
  const scenario = scenarioById(ROOT, id);
  if (!scenario) { console.log(`  ⚠️  ${id}  ไม่มีไฟล์โจทย์ — ข้าม`); continue; }
  clean();
  rmSync(DEST, { recursive: true, force: true });
  applyScenarioSetup(ROOT, FIXTURE, id);
  // stage สภาพเริ่มต้นไว้ diff ข้างล่างจึงเห็นเฉพาะสิ่งที่เฉลยแก้ — ตรงกับที่เอเจนต์ถูกวัดจาก startCommit
  git(['add', '-A']);

  const problems = [];

  // 1. event ที่เทสยัดลงข้อมูลต้องมีอยู่จริงในสภาพเริ่มต้น
  const testSrc = readFileSync(join(SRC, `${id}.test.ts`), 'utf8');
  const eventsSrc = readFileSync(join(FIXTURE, 'src/domain/events.ts'), 'utf8');
  const seeded = [...new Set([...testSrc.matchAll(/type:\s*'([A-Z][A-Za-z]+)'/g)].map((m) => m[1]))];
  const allowed = new Set(scenario.introducesEvents ?? []);
  for (const ev of seeded) {
    if (!eventsSrc.includes(`'${ev}'`) && !allowed.has(ev)) {
      problems.push(`เทสยัด event '${ev}' ที่สภาพเริ่มต้นไม่รู้จัก และโจทย์ไม่ได้ประกาศว่าเป็นงานของโจทย์ (introducesEvents)`);
    }
  }

  // 2. คำตอบที่ถูกทุกแบบ (เฉลย + alt.*) ต้องผ่านกฎเชิงโครงสร้างที่ critical และ SC/GP
  problems.push(...await structuralFailures(scenario, join(REF, `${id}.patch.mjs`), 'เฉลย'));

  /*
   * 3. ด่านที่ 5 — เฉลยต้องทำให้เทสเดิมของ fixture ผ่านครบ (เพิ่มหลังรอบนำร่อง 4 ต.ค. 2569)
   *
   * S22 เอา REQ-20 ออกในสภาพเริ่มต้นแต่เทส REQ-20 เดิมยังอยู่ กฎ AC2 (เทสทั้งชุดผ่าน, critical) จึงผ่านไม่ได้
   * ถ้าไม่ทำ REQ-20 ซึ่ง GP1 (critical) ห้าม — คำตอบที่ถูกตามโจทย์ไม่มีทางได้คะแนนเต็ม
   * เฉลยอยู่ในสภาพที่ structuralFailures ปะไว้ล่าสุด จึงรันเทสต่อได้ทันที
   */
  try {
    execFileSync(process.execPath, ['--test', 'tests/*.test.ts'], { cwd: FIXTURE, encoding: 'utf8', stdio: 'pipe', timeout: 120000 });
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    const failing = [...out.matchAll(/^\s*✖ (.+?) \(/gm)].map((m) => m[1]).filter((t) => !t.startsWith('failing tests')).slice(0, 3);
    problems.push(`เฉลยทำให้เทสเดิมของ fixture ตก: ${failing.join(' · ') || 'ดู node --test'}`);
  }
  try { git(['checkout', '--', 'data']); } catch { /* เทสเขียนทับ data */ }
  const alts = existsSync(VAR) ? readdirSync(VAR).filter((f) => f.startsWith(`${id}.alt.`) && f.endsWith('.mjs')) : [];
  let checkedAlts = 0;
  for (const f of alts) {
    const mod = await import(pathToFileURL(join(VAR, f)).href);
    if (mod.ruleCompliant === false) continue;   // ถูกเชิงหน้าที่แต่ผิดกฎขอบเขตโดยเจตนา
    checkedAlts++;
    problems.push(...await structuralFailures(scenario, join(VAR, f), f.replace(/\.mjs$/, '')));
  }

  if (problems.length) {
    failed++;
    console.log(`  ❌ ${id}`);
    for (const p of problems) console.log(`       ${p}`);
  } else console.log(`  ✅ ${id}  เฉลยและคำตอบถูกแบบอื่น ${checkedAlts} แบบผ่านกฎเชิงโครงสร้าง · event ที่เทสใช้มีอยู่จริง`);
}

clean();
rmSync(DEST, { recursive: true, force: true });
console.log('');
console.log(`ผ่าน ${refs.length - failed} จาก ${refs.length} โจทย์`);
console.log('');
process.exit(failed ? 2 : 0);
