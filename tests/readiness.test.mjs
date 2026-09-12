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
  assert.deepEqual(report.allocation, { arms: 5, scenarios: 11, repetitions: 6, cells: 330 });
  assert.equal(report.collectionReady, false);
  assert.ok(report.pendingResearchDecisions.length >= 3);
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
