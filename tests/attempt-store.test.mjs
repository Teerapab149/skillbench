import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { AttemptStore, classifyArtifact } from '../src/attempt-store.mjs';
import { gradeWithProvenance, saveCheckpointWithProvenance } from '../src/runner.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function scratch(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillbench-attempts-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function open(outDir, options = {}) {
  return AttemptStore.open({ outDir, signatureHash: 'abc123', signature: '{"same":true}', ...options });
}

function begin(store, runId = 'S01__A2__r0') {
  return store.beginAttempt({ runId, scenarioId: 'S01', armId: 'A2', repIndex: 0, seed: 7 });
}

function records(attempt, prefix = '') {
  return fs.readdirSync(attempt.dir).filter((f) => f.startsWith(prefix)).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(attempt.dir, f), 'utf8')));
}

test('same signature resumes the experiment, while --new-experiment always gets a distinct UUID', (t) => {
  const dir = scratch(t);
  const first = open(dir);
  const resumed = open(dir);
  const fresh = open(dir, { newExperiment: true });
  assert.equal(resumed.experimentId, first.experimentId);
  assert.notEqual(fresh.experimentId, first.experimentId);
  assert.match(first.experimentId, /^[0-9a-f-]{36}$/i);
});

test('retry attempts have stable runId, unique UUIDs, monotonic indexes, and immutable stages', (t) => {
  const store = open(scratch(t));
  const a0 = begin(store);
  store.recordArtifact(a0, { artifact: { runId: a0.runId, error: '429 rate limit' },
    ...classifyArtifact({ error: '429 rate limit' }) });
  store.recordDisposition(a0, {
    ...classifyArtifact({ error: '429 rate limit' }), runtime: 'not_checked', grading: 'not_attempted',
    scheduler: 'retry', reason: 'short_limit_retry',
  });
  const a1 = begin(store);
  assert.equal(a1.runId, a0.runId);
  assert.equal(a1.attemptIndex, 1);
  assert.notEqual(a1.attemptId, a0.attemptId);
  assert.throws(() => store.recordArtifact(a0, { artifact: {}, ...classifyArtifact({}) }), /EEXIST/);
});

test('budget exhaustion and capture failure coexist as independent dimensions', () => {
  const state = classifyArtifact({
    error: 'capture failed', captureError: 'git diff unavailable', control: { resultSubtype: 'error_max_turns' },
  });
  assert.deepEqual(state, { execution: 'returned', termination: 'budget_exhausted', measurement: 'failed' });
});

test('session limit, adapter exception, and runtime violation remain durable', (t) => {
  const store = open(scratch(t));
  const session = begin(store, 'S01__A1__r0');
  const sessionState = classifyArtifact({ error: "You've hit your session limit; resets later" });
  store.recordArtifact(session, { artifact: { error: 'session limit' }, ...sessionState });
  store.recordDisposition(session, { ...sessionState, runtime: 'not_checked', grading: 'not_attempted', scheduler: 'pause', reason: 'session_limit_pause' });

  const thrown = begin(store, 'S01__A2__r0');
  const thrownState = classifyArtifact({ error: 'spawn broke' }, { adapterException: true });
  store.recordArtifact(thrown, { artifact: { error: 'spawn broke' }, ...thrownState });

  const noInit = begin(store, 'S01__A3__r0');
  store.recordArtifact(noInit, { artifact: { rawEvents: [] }, ...classifyArtifact({ rawEvents: [] }) });
  store.recordDisposition(noInit, { ...classifyArtifact({ rawEvents: [] }), runtime: 'violations', grading: 'not_attempted', scheduler: 'stop', reason: 'missing_init_before_manifest' });

  assert.equal(records(session, 'artifact')[0].state.termination, 'session_limit');
  assert.equal(records(thrown, 'artifact')[0].state.execution, 'adapter_exception');
  assert.equal(records(noInit, 'disposition-').at(-1).state.runtime, 'violations');
});

test('a crash after start is recovered as interrupted_unknown and next attempt advances', (t) => {
  const dir = scratch(t);
  const store = open(dir);
  const crashed = begin(store);
  const resumed = open(dir);
  const recovery = records(crashed, 'disposition-').find((r) => r.reason === 'recovered_after_interruption');
  assert.equal(recovery.state.execution, 'interrupted_unknown');
  assert.equal(recovery.state.scheduler, 'retry');
  assert.equal(begin(resumed).attemptIndex, 1);
});

test('an artifact without a committed checkpoint is recovered explicitly, never silently selected', (t) => {
  const dir = scratch(t);
  const store = open(dir);
  const crashed = begin(store);
  const state = classifyArtifact({ rawEvents: [] });
  store.recordArtifact(crashed, { artifact: { rawEvents: [] }, ...state });
  const resumed = open(dir);
  const recovery = records(crashed, 'disposition-').find((r) => r.reason === 'recovered_after_interruption');
  assert.equal(recovery.state.scheduler, 'retry');
  assert.equal(begin(resumed).attemptIndex, 1);
});

test('a terminal disposition without a committed checkpoint blocks resume instead of rerunning', (t) => {
  const dir = scratch(t);
  const store = open(dir);
  const attempt = begin(store);
  const state = { ...classifyArtifact({ error: 'runtime drift' }), runtime: 'violations', grading: 'not_attempted' };
  store.recordArtifact(attempt, { artifact: { error: 'runtime drift' }, ...state });
  store.recordDisposition(attempt, { ...state, scheduler: 'stop', reason: 'runtime_violations' });
  assert.deepEqual(store.incompleteTerminalRunIds(), [attempt.runId]);
  assert.deepEqual(open(dir).incompleteTerminalRunIds(), [attempt.runId]);
});

test('grader and checkpoint exceptions are recorded before legacy behavior rethrows', (t) => {
  const store = open(scratch(t));
  const attempt = begin(store);
  const state = { ...classifyArtifact({}), runtime: 'valid', grading: 'not_attempted' };
  store.recordArtifact(attempt, { artifact: {}, ...state });
  assert.throws(() => gradeWithProvenance({ attemptStore: store, attempt, state, artifact: {}, scenario: {},
    grader: () => { throw new Error('grader broke'); } }), /grader broke/);
  assert.throws(() => saveCheckpointWithProvenance({ file: 'unused', projection: {}, attemptStore: store,
    attempt, state, writer: () => { throw new Error('disk broke'); } }), /disk broke/);
  const reasons = records(attempt, 'disposition-').map((r) => r.reason);
  assert.ok(reasons.includes('before_grading'));
  assert.ok(reasons.includes('grader_exception'));
  assert.ok(reasons.includes('before_checkpoint_projection'));
  assert.ok(reasons.includes('checkpoint_exception'));
});

test('legacy checkpoint gets an explicit non-reconstructive migration; corrupt pointer fails closed', (t) => {
  const dir = scratch(t);
  const legacy = path.join(dir, 'checkpoint.json');
  fs.writeFileSync(legacy, '{}');
  const migrated = open(dir, { legacyProjectionPaths: [legacy] });
  assert.equal(migrated.meta.migration.kind, 'legacy_projection_without_attempt_provenance');

  const bad = scratch(t);
  const pointerDir = path.join(bad, 'attempt-provenance', 'by-signature', 'abc123');
  fs.mkdirSync(pointerDir, { recursive: true });
  fs.writeFileSync(path.join(pointerDir, '000000000001-bad.json'), '{broken');
  assert.throws(() => open(bad), (e) => e.code === 'ATTEMPT_STORE_CORRUPT');
});

test('runner mock integration persists provenance and a distinct new experiment without API calls', (t) => {
  const dir = scratch(t);
  const args = ['src/runner.mjs', '--adapter', 'mock', '--arms', 'A0', '--scenarios', 'S01', '--reps', '1', '--out', dir];
  const first = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const pointerRoot = path.join(dir, 'attempt-provenance', 'by-signature');
  const sigDir = path.join(pointerRoot, fs.readdirSync(pointerRoot)[0]);
  const refs1 = fs.readdirSync(sigDir).sort();
  const exp1 = JSON.parse(fs.readFileSync(path.join(sigDir, refs1.at(-1)), 'utf8')).experimentId;

  const second = spawnSync(process.execPath, [...args, '--new-experiment'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(second.status, 0, second.stderr || second.stdout);
  const refs2 = fs.readdirSync(sigDir).sort();
  const exp2 = JSON.parse(fs.readFileSync(path.join(sigDir, refs2.at(-1)), 'utf8')).experimentId;
  assert.equal(refs2.length, refs1.length + 1);
  assert.notEqual(exp2, exp1);

  const cells = path.join(dir, 'attempt-provenance', 'experiments', exp2, 'cells');
  const attemptDir = path.join(cells, fs.readdirSync(cells)[0], fs.readdirSync(path.join(cells, fs.readdirSync(cells)[0]))[0]);
  assert.ok(fs.existsSync(path.join(attemptDir, 'start.json')));
  assert.ok(fs.existsSync(path.join(attemptDir, 'artifact.json')));
  const checkpoint = fs.readdirSync(dir).find((f) => /^checkpoint-.+\.json$/.test(f));
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, checkpoint), 'utf8')).experimentId, exp2);
});
