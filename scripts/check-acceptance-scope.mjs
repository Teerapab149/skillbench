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
const clean = () => { try { git(['checkout', '--', '.']); git(['clean', '-fd']); } catch { /* ปล่อย */ } };

/** กฎที่ตัดสินได้จากไฟล์และ diff ล้วน — ไม่ต้องมีข้อความตอบ คำสั่ง หรือ probe */
const STRUCTURAL = new Set(['files_within', 'files_not_touch', 'max_files_changed',
  'diff_not_matches', 'no_unrequested_feature']);

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

  // 2. เฉลยต้องผ่านกฎขอบเขตเชิงโครงสร้าง
  const mod = await import(pathToFileURL(join(REF, `${id}.patch.mjs`)).href);
  const { error } = applyPatches(FIXTURE, mod.patches);
  if (error) problems.push(`ปะเฉลยไม่ได้: ${error}`);
  else {
    git(['add', '-A', '-N']);
    const filesChanged = git(['diff', '--name-only']).split('\n').map((s) => s.trim()).filter(Boolean)
      .filter((f) => !f.startsWith(`${DEST_NAME}/`));
    const diff = git(['diff']);
    const rules = scenario.rules.filter((r) => /^(SC|GP)/.test(r.id) && STRUCTURAL.has(r.check?.type));
    const graded = gradeRun({ runId: id, armId: 'reference', repIndex: 0, toolCalls: [], commands: [],
      filesChanged, diff, finalMessage: '' }, { ...scenario, rules });
    for (const r of graded.rules.filter((x) => !x.passed)) problems.push(`เฉลยตกกฎ ${r.id} — ${r.desc}`);
  }

  if (problems.length) {
    failed++;
    console.log(`  ❌ ${id}`);
    for (const p of problems) console.log(`       ${p}`);
  } else console.log(`  ✅ ${id}  เฉลยอยู่ในขอบเขต · event ที่เทสใช้มีอยู่จริง`);
}

clean();
rmSync(DEST, { recursive: true, force: true });
console.log('');
console.log(`ผ่าน ${refs.length - failed} จาก ${refs.length} โจทย์`);
console.log('');
process.exit(failed ? 2 : 0);
