#!/usr/bin/env node
/**
 * ครึ่งที่สองของ known-answer test — เทสยอมรับต้อง "เขียวได้" เมื่อทำถูก
 *
 * check-acceptance.mjs พิสูจน์ว่าทุกไฟล์ตกบน baseline
 * แต่เทสที่พังจนไม่มีวันผ่าน ก็ตกบน baseline เหมือนกันเป๊ะ แล้วจะตกต่อไป
 * แม้เอเจนต์ทำงานถูกทุกอย่าง กลายเป็นตัวตรวจที่ปฏิเสธทุกคน
 * ซึ่งพังคนละทิศแต่ร้ายแรงพอกันกับตัวตรวจที่ผ่านทุกคน
 *
 * สคริปต์นี้ใช้เฉลยอ้างอิงที่เขียนไว้เอง ปะลงบน baseline แล้วยืนยันว่าเทสเขียว
 * เฉลยอ้างอิงไม่ใช่ "วิธีเดียวที่ถูก" — เป็นเพียงหลักฐานว่ามีทางทำให้ผ่านอยู่จริง
 *
 *   node scripts/check-acceptance-green.mjs
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, rmSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { refuseIfCollecting } from './collection-guard.mjs';
import { applyPatches } from './patch-fixture.mjs';
import { lockFixtureForProcess } from '../src/fixture-lock.mjs';
import { FIXTURE_NOW } from '../src/adapters/claude-cli.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
refuseIfCollecting(ROOT, 'check-acceptance-green');

const SRC = join(ROOT, 'scenarios', 'acceptance');
const REF = join(SRC, 'reference');
const FIXTURE = join(ROOT, 'fixtures', 'gpu-booking');

// สคริปต์นี้ปะเฉลยลง fixture แล้ว clean ทิ้งทุกรอบ — ห้ามให้ใครแตะ fixture ระหว่างนั้น
lockFixtureForProcess(FIXTURE, 'check-acceptance-green');
const DEST_NAME = '__acceptance__';
const DEST = join(FIXTURE, DEST_NAME);

const git = (args) => execFileSync('git', args, { cwd: FIXTURE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const clean = () => { try { git(['checkout', '--', '.']); git(['clean', '-fd']); } catch { /* ปล่อย */ } };

const allTests = readdirSync(SRC).filter((f) => f.endsWith('.test.ts')).map((f) => f.replace(/\.test\.ts$/, ''));
const refs = existsSync(REF)
  ? readdirSync(REF).filter((f) => f.endsWith('.patch.mjs')).map((f) => f.replace(/\.patch\.mjs$/, '')).sort()
  : [];

console.log('=== เทสยอมรับต้องเขียวได้เมื่อปะเฉลยอ้างอิง ===\n');

let failed = 0;
const failedIds = [];
for (const id of refs) {
  clean();
  rmSync(DEST, { recursive: true, force: true });
  // ห้ามคัดลอก reference/ เข้า fixture — ในนั้นคือเฉลยของทุกโจทย์
  cpSync(SRC, DEST, { recursive: true, filter: (s) => !relative(SRC, s).split(/[\\/]/)[0].startsWith('reference') });

  const mod = await import(pathToFileURL(join(REF, `${id}.patch.mjs`)).href);
  const { error: applyError } = applyPatches(FIXTURE, mod.patches);

  if (applyError) {
    console.log(`  ❌ ${id}  ปะเฉลยไม่ได้: ${applyError}`);
    failed++;
    failedIds.push(id);
    continue;
  }

  let passed = true, out = '';
  try {
    execFileSync(process.execPath, ['--test', `${DEST_NAME}/${id}.test.ts`], {
      cwd: FIXTURE, encoding: 'utf8', stdio: 'pipe', timeout: 120000,
      env: { ...process.env, GPU_BOOKING_NOW: FIXTURE_NOW },
    });
  } catch (e) {
    passed = false;
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }

  if (passed) console.log(`  ✅ ${id}  เขียวเมื่อทำถูก`);
  else {
    failed++;
    failedIds.push(id);
    const first = (out.match(/AssertionError.*|Error.*/) ?? ['(ไม่ทราบสาเหตุ)'])[0].slice(0, 160);
    console.log(`  ❌ ${id}  ปะเฉลยแล้วยังไม่เขียว — ${first}`);
  }
}

clean();
rmSync(DEST, { recursive: true, force: true });

const unproven = allTests.filter((id) => !refs.includes(id));
console.log('');
console.log(`พิสูจน์แล้วว่าเขียวได้ ${refs.length - failed} จาก ${allTests.length} โจทย์`);
if (failedIds.length) console.log(`เฉลยอ้างอิงที่ยังไม่ผ่าน ${failedIds.length} โจทย์: ${failedIds.join(', ')}`);
if (unproven.length) {
  console.log(`ยังไม่มีเฉลยอ้างอิง ${unproven.length} โจทย์: ${unproven.join(', ')}`);
  console.log('  โจทย์เหล่านี้พิสูจน์แล้วแค่ว่า "ตกบน baseline" ยังไม่ได้พิสูจน์ว่า "ผ่านได้เมื่อทำถูก"');
  console.log('  ต้องเขียนไว้ในเล่มตามตรง ไม่ใช่ปล่อยให้เข้าใจว่าตรวจครบแล้ว');
}
console.log('');
process.exit(failed ? 2 : 0);
