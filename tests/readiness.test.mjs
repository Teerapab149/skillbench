import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collectReadiness } from '../src/readiness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESULTS = path.join(ROOT, 'results');

function digest(dir) {
  const rows = [];
  const walk = (base, rel = '') => {
    for (const e of fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(base, e.name), r = path.join(rel, e.name);
      if (e.isDirectory()) walk(p, r); else rows.push([r, fs.readFileSync(p)]);
    }
  };
  walk(dir);
  return rows.map(([r, b]) => `${r}:${b.toString('base64')}`).join('\n');
}

test('read-only preflight reports advisory engineering/collection states and does not write results', () => {
  const before = digest(RESULTS);
  const report = collectReadiness({ root: ROOT });
  const after = digest(RESULTS);
  assert.equal(after, before);
  assert.equal(report.advisory, true);
  assert.deepEqual(report.allocation, { arms: 5, scenarios: 11, repetitions: 6, cells: 330, source: 'config/arms.json preRegisteredAllocation' });
  assert.equal(report.collectionReady, false);
  assert.ok(report.pendingResearchDecisions.length >= 2);
});

// Amendment 14: the declared allocation lives in config/arms.json only. Preflight must
// read it there and check it against what is actually on disk, not restate a literal.
test('preflight checks the declared allocation against the arms and scenarios on disk', () => {
  const report = collectReadiness({ root: ROOT });
  const check = report.checks.find((c) => c.name === 'allocation-declared');
  assert.ok(check, "allocation-declared check must exist");
  assert.equal(check.state, 'pass');
  assert.equal(check.evidence.prereg.cells, 330);
  assert.equal(check.evidence.prereg.fallback.type, 'uniform-rep-truncation');
  assert.equal(check.evidence.prereg.surplusRule.status, 'void');
  assert.equal(report.allocation.repetitions, check.evidence.prereg.reps);
});

test('a declared allocation that disagrees with the real arm count fails the check', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'skillbench-alloc-'));
  try {
    fs.mkdirSync(path.join(tmp, 'config'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'scenarios'), { recursive: true });
    const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'arms.json'), 'utf8'));
    real.preRegisteredAllocation.arms = [...real.preRegisteredAllocation.arms, "A9"];
    fs.writeFileSync(path.join(tmp, 'config', 'arms.json'), JSON.stringify(real));
    const report = collectReadiness({ root: tmp, resultsDir: path.join(tmp, "results") });
    const check = report.checks.find((c) => c.name === 'allocation-declared');
    assert.equal(check.state, 'fail');
    assert.equal(report.engineeringReady, false);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('mock runner refuses production results before creating output', () => {
  const before = digest(RESULTS);
  const run = spawnSync(process.execPath, ['src/runner.mjs', '--adapter', 'mock', '--arms', 'A0', '--scenarios', 'S01', '--reps', '1'], {
    cwd: ROOT, encoding: 'utf8',
  });
  assert.notEqual(run.status, 0);
  assert.match(`${run.stdout}${run.stderr}`, /mock.*ห้ามเขียนลง results/i);
  assert.equal(digest(RESULTS), before);
});

test('mock runner can still write to a disposable output directory', (t) => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'skillbench-preflight-mock-'));
  t.after(() => fs.rmSync(out, { recursive: true, force: true }));
  const run = spawnSync(process.execPath, ['src/runner.mjs', '--adapter', 'mock', '--arms', 'A0', '--scenarios', 'S01', '--reps', '1', '--out', out], {
    cwd: ROOT, encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.equal(fs.existsSync(path.join(out, 'latest.json')), true);
});
