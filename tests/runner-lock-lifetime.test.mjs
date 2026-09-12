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
