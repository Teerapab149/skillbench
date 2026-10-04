/**
 * สภาพเริ่มต้นรายโจทย์ (setupPatches) — ต้องอยู่ก่อน startCommit เสมอ
 *
 * ถ้ามันหลุดเข้าไปอยู่ใน diff ของเอเจนต์ กฎขอบเขตจะนับไฟล์ที่เราแก้เองเป็นความผิดของเอเจนต์
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { installArm, applySetupPatches, BASELINE_TAG } from '../src/install-arm.mjs';
import { acquireFixtureLock } from '../src/fixture-lock.mjs';

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' });

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-setup-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'core.autocrlf', 'false']);
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src/a.ts'), 'export const x = 1;\n');
  git(dir, ['add', '-A']);
  git(dir, ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base']);
  git(dir, ['tag', BASELINE_TAG]);
  return dir;
}

test('setupPatches ถูก commit ก่อน startCommit — diff ของเอเจนต์ไม่รวมมัน', () => {
  const dir = repo();
  const patchFile = path.join(dir, '..', `${path.basename(dir)}-setup.json`);
  fs.writeFileSync(patchFile, JSON.stringify([
    { file: 'src/a.ts', find: 'x = 1', replace: 'x = 2' },
    { file: 'src/new.ts', create: 'export const y = 3;\n' },
  ]));
  const release = acquireFixtureLock(dir, { owner: 'test' });
  try {
    const scenario = { id: 'T', setupPatches: path.relative(path.resolve('.'), patchFile) };
    const r = installArm({ workspace: dir, arm: { id: 'A0' }, scenario });
    assert.equal(fs.readFileSync(path.join(dir, 'src/a.ts'), 'utf8'), 'export const x = 2;\n');
    assert.ok(fs.existsSync(path.join(dir, 'src/new.ts')));
    assert.equal(git(dir, ['rev-parse', 'HEAD']).trim(), r.startCommit);
    assert.equal(git(dir, ['diff', '--name-only', r.startCommit]).trim(), '');
    assert.ok(r.setupCommit);
  } finally {
    release();
    fs.rmSync(patchFile, { force: true });
  }
});

test('ไม่มี setupPatches = พฤติกรรมเดิม (startCommit คือ baseline)', () => {
  const dir = repo();
  const release = acquireFixtureLock(dir, { owner: 'test' });
  try {
    const r = installArm({ workspace: dir, arm: { id: 'A0' } });
    assert.equal(r.startCommit, git(dir, ['rev-parse', `${BASELINE_TAG}^{commit}`]).trim());
    assert.equal(r.setupCommit, null);
  } finally { release(); }
});

test('find ที่หาไม่เจอต้องล้มดัง ๆ ไม่ใช่เริ่ม run จากสภาพผิด', () => {
  const dir = repo();
  assert.throws(() => applySetupPatches(dir, [{ file: 'src/a.ts', find: 'nope', replace: 'x' }]), /หาข้อความ/);
});
