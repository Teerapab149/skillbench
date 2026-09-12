import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { main } from '../src/runner.mjs';
import { runMock } from '../src/adapters/mock.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCK_MODULE = pathToFileURL(path.join(ROOT, 'src', 'fixture-lock.mjs')).href;
const FIXTURE = path.join(ROOT, 'fixtures', 'gpu-booking');

function probe(fixture) {
  const body = `
import { acquireFixtureLock } from ${JSON.stringify(LOCK_MODULE)}
try { const release = acquireFixtureLock(process.argv[1], { owner: 'runner-lifetime-probe' }); release(); console.log('ACQUIRED') }
catch (e) { console.log(e.code === 'FIXTURE_LOCK_BUSY' ? 'BUSY' : 'ERROR ' + e.message) }
`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', body, fixture], {
    cwd: ROOT, encoding: 'utf8', timeout: 5000,
  });
  return `${result.stdout}${result.stderr}`;
}

function initEvent() {
  return {
    type: 'system', subtype: 'init', claude_code_version: 'test-cli', model: 'claude-sonnet-5',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Skill'], skills: [],
    mcp_servers: [], apiKeySource: 'subscription', memory_paths: { auto: null },
  };
}

function args(outDir) {
  return ['node', 'runner.mjs', '--adapter', 'claude-cli', '--arms', 'A0', '--scenarios', 'S01',
    '--reps', '1', '--out', outDir];
}

async function runBounded(t, { fail = false } = {}) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-lock-lifetime-'));
  const entered = path.join(outDir, 'entered');
  const continueFile = path.join(outDir, 'continue');
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));
  const originalArgv = process.argv;
  process.argv = args(outDir);
  const observed = {};
  let calls = 0;
  const fake = async (input) => {
    calls++;
    fs.writeFileSync(entered, String(calls));
    if (!fail) {
      await new Promise((resolve) => setImmediate(resolve));
      while (!fs.existsSync(continueFile)) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
      const artifact = await runMock(input);
      return { ...artifact, adapter: 'claude-cli', simulated: false, rawEvents: [initEvent()],
        control: { memoryStateBefore: 'empty', memoryStateAfter: 'empty' } };
    }
    throw new Error('injected adapter failure');
  };
  try {
    const run = main({ runAgentOverride: fake, cliVersionOverride: 'test-cli', _testHook: (phase) => {
      if (['fixture-locked', 'after-runtime-validation', 'before-final-output'].includes(phase)) {
        observed[phase] = probe(FIXTURE);
      }
    } });
    if (!fail) {
      const deadline = Date.now() + 5000;
      while (!fs.existsSync(entered) && Date.now() < deadline) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
      assert.ok(fs.existsSync(entered), 'fake adapter did not enter');
      assert.match(observed['fixture-locked'], /BUSY/);
      fs.writeFileSync(continueFile, 'go');
    }
    await run;
  } finally {
    process.argv = originalArgv;
  }
  return { observed, calls };
}

test('actual runner keeps fixture lock through validation and final output, then releases it', async (t) => {
  const result = await runBounded(t);
  assert.equal(result.calls, 1);
  assert.match(result.observed['after-runtime-validation'], /BUSY/);
  assert.match(result.observed['before-final-output'], /BUSY/);
  assert.match(probe(FIXTURE), /ACQUIRED/);
});

test('actual runner releases fixture lock after an early adapter error', async (t) => {
  const result = await runBounded(t, { fail: true });
  assert.equal(result.calls, 1);
  assert.match(result.observed['fixture-locked'], /BUSY/);
  assert.match(probe(FIXTURE), /ACQUIRED/);
});

/*
 * เทสด้านล่างอยู่ไฟล์เดียวกับข้างบนโดยเจตนา
 *
 * node --test รันไฟล์เทสขนานกัน และเทสทั้งสองกลุ่มนี้ขับ runner ตัวจริงบน fixture
 * ตัวเดียวกัน ถ้าแยกไฟล์ มันจะแย่ง fixture lock กันแล้วล้มสลับกันแบบสุ่ม:
 * กลุ่มหนึ่ง main() return เงียบ ๆ เพราะยึด lock ไม่ได้ (adapter ไม่เคยถูกเรียก)
 * อีกกลุ่ม assert ว่า lock ถูกปล่อยแล้วแต่เจอว่า BUSY เพราะอีกไฟล์ถืออยู่
 * เกิดขึ้นจริงเมื่อ 12 ก.ย. 2569 ตอนแยกไฟล์ — อยู่ไฟล์เดียวกันแล้วรันเรียงกันเสมอ
 */

/*
 * auth ตายต้องหยุดทั้งชุด — เกิดขึ้นจริงเมื่อ 12 ก.ย. 2569 ตอนเริ่มเก็บ rep 0 ครั้งแรก
 *
 * OAuth หมดอายุระหว่าง probe กับ gate0 · runner เผาครบทั้ง 55 cell ได้ error เดียวกัน
 * ทุกอัน แล้วจบด้วย exit 0 เหมือนรันสำเร็จ
 *
 * Amendment 15 ตัดสินไว้ว่า auth ห้าม retry เพราะไม่ใช่ของชั่วคราว ต้องมีคนไป login
 * แต่ไม่ได้บอกว่าให้หยุด พอไม่ retry มันจึงเดินไป cell ถัดไปเรื่อย ๆ ขณะที่ลิมิตยาว
 * หยุดทั้งชุดอยู่แล้วด้วยเหตุผลเดียวกันเป๊ะ
 */

const AUTH_ERROR = 'Failed to authenticate: OAuth session expired and could not be refreshed';

/** รัน 4 cell โดย adapter คืน error ที่กำหนดทุกครั้ง แล้วนับว่าถูกเรียกกี่ครั้ง */
async function runWithError(t, error) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-auth-halt-'));
  t.after(() => fs.rmSync(outDir, { recursive: true, force: true }));

  const originalArgv = process.argv;
  process.argv = ['node', 'runner.mjs', '--adapter', 'claude-cli',
    '--arms', 'A0,A1', '--scenarios', 'S01,S02', '--reps', '1', '--out', outDir];

  let calls = 0;
  const fake = async (input) => {
    calls++;
    const artifact = await runMock(input);
    return {
      ...artifact, adapter: 'claude-cli', simulated: false, error,
      rawEvents: [initEvent()],
      control: { memoryStateBefore: 'empty', memoryStateAfter: 'empty', resultSubtype: 'success' },
    };
  };

  try {
    await main({ runAgentOverride: fake, cliVersionOverride: 'test-cli' });
  } finally {
    process.argv = originalArgv;
  }

  const latest = path.join(outDir, 'latest.json');
  const rows = fs.existsSync(latest) ? JSON.parse(fs.readFileSync(latest, 'utf8')).graded : [];
  return { calls, rows, outDir };
}

test('auth ตายต้องหยุดทั้งชุดที่ run แรก ไม่ใช่เผาทุก cell', async (t) => {
  const { calls, rows } = await runWithError(t, AUTH_ERROR);

  assert.equal(calls, 1,
    `auth ตายแล้วต้องเรียก adapter ครั้งเดียวแล้วหยุด แต่เรียกไป ${calls} ครั้ง — นี่คือบั๊กที่เผา 55 cell`);
  // run ที่ทำให้หยุดไม่ถูกบันทึกเป็นแถวข้อมูล เหมือนกับตอนชนลิมิตยาว
  // เพราะมันจะถูกรันซ่อมตอน --resume · หลักฐานอยู่ในสมุดบันทึก attempt
  assert.equal(rows.length, 0, 'ห้ามนับ run ที่ล้มเหลวเพราะ auth เป็นข้อมูล');
});

test('ความล้มเหลวที่ไม่ใช่ auth และไม่ใช่ของชั่วคราว ต้องไม่หยุดทั้งชุด', async (t) => {
  // ต้องไม่ตรงทั้ง isAuthFailure, isSessionLimit และ isRetryableInfra
  // มิฉะนั้นเทสจะไปรอ backoff เป็นสิบนาที
  const { calls } = await runWithError(t, 'ข้อผิดพลาดที่ไม่รู้จัก');

  assert.equal(calls, 4,
    'error ทั่วไปต้องเดินต่อจนครบทุก cell — การหยุดต้องสงวนไว้สำหรับ auth กับลิมิตยาวเท่านั้น');
});

test('attempt journal บันทึกเหตุผลที่หยุดไว้ ไม่ใช่หยุดเงียบ', async (t) => {
  const { outDir } = await runWithError(t, AUTH_ERROR);
  const root = path.join(outDir, 'attempt-provenance');
  assert.ok(fs.existsSync(root), 'ต้องมีสมุดบันทึก attempt');

  const found = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const child = path.join(dir, e.name);
      if (e.isDirectory()) walk(child);
      else if (e.name.startsWith('disposition-')) found.push(JSON.parse(fs.readFileSync(child, 'utf8')));
    }
  };
  walk(root);

  const reasons = found.map((d) => d.reason);
  assert.ok(reasons.includes('auth_failure'),
    `ต้องบันทึกเหตุผล auth_failure ไว้ แต่พบ ${reasons.join(', ') || '(ไม่มี)'}`);
  assert.equal(found.find((d) => d.reason === 'auth_failure').state.scheduler, 'stop');
});
