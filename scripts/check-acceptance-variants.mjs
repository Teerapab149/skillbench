#!/usr/bin/env node
/**
 * ตรวจเทสยอมรับด้วย "เฉลยหลายแบบ" — ครึ่งที่สามของ known-answer test
 *
 * check-acceptance.mjs        : ทุกไฟล์ต้องตกบน baseline (ไม่งั้นวัดอะไรไม่ได้)
 * check-acceptance-green.mjs  : ทุกไฟล์ต้องเขียวเมื่อปะเฉลยอ้างอิง (ไม่งั้นปฏิเสธทุกคน)
 * ไฟล์นี้                     : เฉลยที่ผิดต้องตก · เฉลยที่ถูกคนละแบบต้องผ่าน
 *
 * ทำไมสองอันแรกยังไม่พอ — ผู้รีวิวภายนอกชี้ตรงจุด:
 * เทสยอมรับกับเฉลยอ้างอิงเขียนโดยคนเดียวกัน สมมติฐานที่ผิดร่วมกันจะไม่ถูกจับ
 * เฉลยอ้างอิงผ่าน ไม่ได้แปลว่าเทสวัดข้อกำหนด อาจแปลว่าเทสวัด "เขียนเหมือนเฉลย"
 *
 *   variants/<ID>.wrong.<ชื่อ>.mjs  ->  ต้อง **ตก** (ถ้าผ่าน = เทสหลวมเกินไป)
 *   variants/<ID>.alt.<ชื่อ>.mjs    ->  ต้อง **ผ่าน** (ถ้าตก = เทสผูกกับ implementation)
 *
 * เฉลยแบบ alt คือหลักฐานที่ตรงที่สุดว่าเทสวัดพฤติกรรม ไม่ได้วัดรูปแบบการเขียน
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, existsSync, rmSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { refuseIfCollecting } from './collection-guard.mjs';
import { applyPatches } from './patch-fixture.mjs';
import { lockFixtureForProcess } from '../src/fixture-lock.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
refuseIfCollecting(ROOT, 'check-acceptance-variants');

const SRC = join(ROOT, 'scenarios', 'acceptance');
const VAR = join(SRC, 'variants');
const FIXTURE = join(ROOT, 'fixtures', 'gpu-booking');

// ปะเฉลยผิด/เฉลยคนละแบบลง fixture ทีละตัวแล้ว clean — ต้องถือ fixture ไว้คนเดียวตลอด
lockFixtureForProcess(FIXTURE, 'check-acceptance-variants');
const DEST_NAME = '__acceptance__';
const DEST = join(FIXTURE, DEST_NAME);

const git = (args) => execFileSync('git', args, { cwd: FIXTURE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const clean = () => { try { git(['checkout', '--', '.']); git(['clean', '-fd']); } catch { /* ปล่อย */ } };

if (!existsSync(VAR)) {
  console.log('ยังไม่มีโฟลเดอร์ variants/ — ข้ามการตรวจนี้');
  process.exit(0);
}

// ชื่อไฟล์: <scenarioId>.<kind>.<ชื่อ>.mjs
const files = readdirSync(VAR).filter((f) => f.endsWith('.mjs')).sort();
console.log('=== เฉลยผิดต้องตก · เฉลยถูกคนละแบบต้องผ่าน ===\n');

let failed = 0;
const seen = new Map();

for (const f of files) {
  const m = f.match(/^(S\d{2}-[a-z-]+)\.(wrong|alt)\.(.+)\.mjs$/);
  if (!m) { console.log(`  ⚠️  ข้ามไฟล์ที่ตั้งชื่อไม่ตรงรูปแบบ: ${f}`); continue; }
  const [, id, kind, name] = m;

  const testFile = join(SRC, `${id}.test.ts`);
  if (!existsSync(testFile)) { console.log(`  ⚠️  ${f}: ไม่มีเทสของ ${id}`); failed++; continue; }

  clean();
  rmSync(DEST, { recursive: true, force: true });
  cpSync(SRC, DEST, {
    recursive: true,
    filter: (s) => {
      const top = relative(SRC, s).split(/[\\/]/)[0];
      return !top.startsWith('reference') && !top.startsWith('variants');
    },
  });

  const mod = await import(pathToFileURL(join(VAR, f)).href);
  const { error: applyError } = applyPatches(FIXTURE, mod.patches);

  if (applyError) {
    console.log(`  ❌ ${f}  ปะไม่ได้: ${applyError}`);
    failed++;
    continue;
  }

  let passed = true, out = '';
  try {
    execFileSync(process.execPath, ['--test', `${DEST_NAME}/${id}.test.ts`], {
      cwd: FIXTURE, encoding: 'utf8', stdio: 'pipe', timeout: 120000,
      env: { ...process.env, GPU_BOOKING_NOW: '2026-03-04T09:00:00.000Z' },
    });
  } catch (e) {
    passed = false;
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }

  const want = kind === 'alt';
  const ok = passed === want;
  if (!ok) failed++;

  const list = seen.get(id) ?? { wrong: 0, alt: 0 };
  list[kind]++;
  seen.set(id, list);

  if (kind === 'wrong') {
    console.log(ok
      ? `  ✅ ${id} · ผิดแบบ "${name}" → ตกตามที่ควร`
      : `  ❌ ${id} · ผิดแบบ "${name}" → **ผ่าน** ทั้งที่ควรตก · เทสหลวมเกินไป`);
  } else {
    const why = ok ? '' : ` · ${(out.match(/AssertionError.*|Error.*/) ?? [''])[0].slice(0, 140)}`;
    console.log(ok
      ? `  ✅ ${id} · เขียนคนละแบบ "${name}" → ผ่านตามที่ควร`
      : `  ❌ ${id} · เขียนคนละแบบ "${name}" → **ตก** ทั้งที่ถูกต้อง · เทสผูกกับ implementation${why}`);
  }
}

clean();
rmSync(DEST, { recursive: true, force: true });

/*
 * นับเฉพาะโจทย์ที่ "ผูกเทสยอมรับกับ CRIT จริง"
 *
 * S10 มีไฟล์เทสอยู่แต่ไม่มีกฎ acceptance_test โดยตั้งใจ (Amendment 9)
 * เพราะพฤติกรรมที่ถูกของมันคือหยุดถาม ไม่ใช่ implement
 * การทวงเฉลย variant ของโจทย์ที่ไม่ได้ใช้ให้คะแนน เป็นการทวงงานที่ไม่ต้องทำ
 */
const scenarioDir = join(ROOT, 'scenarios');
const wired = readdirSync(scenarioDir).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(scenarioDir, f), 'utf8')))
  .filter((s) => s.rules.some((r) => r.check?.type === 'acceptance_test'))
  .map((s) => s.id);
const allTests = wired;
const noWrong = allTests.filter((id) => !(seen.get(id)?.wrong));
const noAlt = allTests.filter((id) => !(seen.get(id)?.alt));

console.log('');
console.log(`โจทย์ที่มีเฉลยผิดให้ทดสอบแล้ว: ${allTests.length - noWrong.length}/${allTests.length}`);
console.log(`โจทย์ที่มีเฉลยถูกคนละแบบแล้ว: ${allTests.length - noAlt.length}/${allTests.length}`);
if (noWrong.length) console.log(`  ยังไม่มีเฉลยผิด: ${noWrong.join(', ')}`);
if (noAlt.length) console.log(`  ยังไม่มีเฉลยคนละแบบ: ${noAlt.join(', ')}`);
console.log('');
process.exit(failed ? 2 : 0);
