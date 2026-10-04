/**
 * ภาพหลังรอบแรก (C1) — ต้องเห็นงานของรอบแรกครบ และต้องไม่แตะสิ่งที่เอเจนต์เห็นในรอบสอง
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { snapshotWorkspace } from '../src/adapters/claude-cli.mjs';

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' });

test('เห็นไฟล์ที่แก้และไฟล์ใหม่ โดย index และไฟล์ของเอเจนต์ไม่เปลี่ยน', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-snap-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'core.autocrlf', 'false']);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'one\n');
  git(dir, ['add', '-A']);
  git(dir, ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base']);
  const anchor = git(dir, ['rev-parse', 'HEAD']).trim();

  fs.writeFileSync(path.join(dir, 'a.txt'), 'two\n');
  fs.writeFileSync(path.join(dir, 'b.txt'), 'new\n');
  const statusBefore = git(dir, ['status', '--porcelain']);

  const snap = snapshotWorkspace(dir, anchor, { id: 'NOPE', probes: [] });
  assert.equal(snap.error, null);
  assert.deepEqual([...snap.filesChanged].sort(), ['a.txt', 'b.txt']);
  assert.match(snap.diff, /\+two/);
  assert.equal(snap.acceptance.ran, false);   // ไม่มีเทสยอมรับของโจทย์สมมตินี้

  assert.equal(git(dir, ['status', '--porcelain']), statusBefore);   // b.txt ยัง untracked ไม่ถูก stage
  assert.equal(fs.readFileSync(path.join(dir, 'a.txt'), 'utf8'), 'two\n');
});
