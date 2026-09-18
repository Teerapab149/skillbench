/**
 * tests/runtime-manifest.test.mjs — ตรวจว่าประตู fail-closed จับของจริงได้
 *
 * ทุกเคสในไฟล์นี้สร้างจากสิ่งที่ "เกิดขึ้นแล้วจริง" ในข้อมูลชุดก่อน ไม่ใช่กรณีสมมติ:
 *   - MCP ของ Canva/Google Drive ต่ออยู่ใน 100 จาก 109 run (92%)
 *   - จำนวน tool ที่ได้จริงแกว่ง 31 / 39 / 47 ทั้งที่ประกาศไว้ 7
 *   - CLI สองเวอร์ชัน (2.1.220, 2.1.224) ปนกันในชุดเดียว
 *   - arm ที่ประกาศว่าไม่มี skill กลับเห็น skill นอกการทดลอง
 *
 * ถ้าเทสพวกนี้ผ่านแต่ของจริงยังหลุด แปลว่าเทสเขียนผิด ไม่ใช่ระบบปลอดภัย
 *
 *   node --test tests/runtime-manifest.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import {
  validateRuntime as validateRuntimeRaw,
  EXPERIMENT_SKILLS,
  experimentDigest,
  fixtureBaselineTrees,
} from '../src/runtime-manifest.mjs';

const BASELINE = ['dataviz', 'code-review', 'artifact-design'];
const FIXTURE_TREES = { 'fixtures/gpu-booking': 'fixture-tree-a' };

const manifest = {
  cliVersion: '2.1.224',
  model: 'claude-sonnet-5',
  maxTurns: 50,
  toolset: ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Skill', 'Write'],
  apiKeySource: 'none',
  baselineSkills: [...BASELINE].sort(),
  memoryAutoPath: 'C:/tmp/memory',
  fixtureBaselineTrees: FIXTURE_TREES,
};

const validateRuntime = (args) => validateRuntimeRaw({ fixtureTrees: FIXTURE_TREES, ...args });

const cleanInit = (over = {}) => ({
  tools: ['Bash', 'Edit', 'Glob', 'Grep', 'Read', 'Skill', 'Write'],
  mcp_servers: [],
  skills: [...BASELINE],
  claude_code_version: '2.1.224',
  model: 'claude-sonnet-5',
  apiKeySource: 'none',
  ...over,
});

const armNoSkills = { id: 'A1', skillsEnabled: false };
const armSkills = { id: 'A2', skillsEnabled: true };

test('สภาพสะอาด arm ที่ไม่มี skill ต้องผ่าน', () => {
  const v = validateRuntime({ init: cleanInit(), toolCalls: [], arm: armNoSkills, manifest, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.deepEqual(v, []);
});

test('สภาพสะอาด arm ที่มี skill ต้องผ่าน', () => {
  const init = cleanInit({ skills: [...BASELINE, ...EXPERIMENT_SKILLS] });
  const calls = [{ name: 'Skill', args: { skill: 'trace-to-requirement' } }];
  const v = validateRuntime({ init, toolCalls: calls, arm: armSkills, manifest, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.deepEqual(v, []);
});

test('ไม่มี init event = ตรวจไม่ได้ ต้องถือว่าไม่ผ่าน', () => {
  const v = validateRuntime({ init: null, toolCalls: [], arm: armNoSkills, manifest, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.equal(v.length, 1);
});

test('MCP server ต่ออยู่ ต้องจับได้', () => {
  const init = cleanInit({ mcp_servers: [{ name: 'claude.ai Canva', status: 'connected' }] });
  const v = validateRuntime({ init, toolCalls: [], arm: armNoSkills, manifest, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('MCP server')), v.join(' | '));
});

test('tool ของ MCP หลุดเข้ามา ต้องจับได้ทั้งเรื่องจำนวนและเรื่อง mcp__', () => {
  const init = cleanInit({ tools: [...cleanInit().tools, 'mcp__claude_ai_Canva__help'] });
  const v = validateRuntime({ init, toolCalls: [], arm: armNoSkills, manifest, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('ชุด tool ไม่ตรง')), v.join(' | '));
  assert.ok(v.some((x) => x.includes('MCP หลุดเข้ามา')), v.join(' | '));
});

test('tool ขาดไปจากที่ประกาศ ต้องจับได้', () => {
  const init = cleanInit({ tools: ['Bash', 'Read'] });
  const v = validateRuntime({ init, toolCalls: [], arm: armNoSkills, manifest, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('ขาด')), v.join(' | '));
});

test('CLI อัปเดตตัวเองกลางการทดลอง ต้องหยุด ไม่ใช่แตก checkpoint เงียบ', () => {
  const init = cleanInit({ claude_code_version: '2.1.225' });
  const v = validateRuntime({ init, toolCalls: [], arm: armNoSkills, manifest, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('เวอร์ชัน CLI')), v.join(' | '));
});

test('โมเดลที่ CLI ใช้จริงไม่ตรงกับที่ประกาศ ต้องจับได้', () => {
  const init = cleanInit({ model: 'claude-opus-5' });
  const v = validateRuntime({ init, toolCalls: [], arm: armNoSkills, manifest, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('โมเดลไม่ตรง')), v.join(' | '));
});

test('auth เปลี่ยนจาก subscription ไปเป็น API key ต้องจับได้ (เรื่องค่าใช้จ่ายจริง)', () => {
  const init = cleanInit({ apiKeySource: 'ANTHROPIC_API_KEY' });
  const v = validateRuntime({ init, toolCalls: [], arm: armNoSkills, manifest, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('แหล่งสิทธิ์เรียกใช้')), v.join(' | '));
});

test('arm ที่ปิด skill แต่เห็น skill ของการทดลอง ต้องจับได้ — นี่คือตัวแปรต้นรั่ว', () => {
  const init = cleanInit({ skills: [...BASELINE, 'acceptance-first'] });
  const v = validateRuntime({ init, toolCalls: [], arm: armNoSkills, manifest, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('skill ของการทดลอง')), v.join(' | '));
});

test('arm ที่เปิด skill แต่ได้ไม่ครบ 4 ตัว ต้องจับได้', () => {
  const init = cleanInit({ skills: [...BASELINE, 'acceptance-first', 'safe-shell'] });
  const v = validateRuntime({ init, toolCalls: [], arm: armSkills, manifest, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('skill ของการทดลอง')), v.join(' | '));
});

test('baseline skill set เปลี่ยนกลางทาง (เช่นติดตั้ง skill ใหม่ตอนตีสาม) ต้องจับได้', () => {
  const init = cleanInit({ skills: [...BASELINE, 'skill-ใหม่ที่เพิ่งลง'] });
  const v = validateRuntime({ init, toolCalls: [], arm: armNoSkills, manifest, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('baseline skill set')), v.join(' | '));
});

test('เรียก skill นอกการทดลอง ต้องจับได้', () => {
  const init = cleanInit({ skills: [...BASELINE, ...EXPERIMENT_SKILLS] });
  const calls = [{ name: 'Skill', args: { skill: 'code-review' } }];
  const v = validateRuntime({ init, toolCalls: calls, arm: armSkills, manifest, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('นอกการทดลอง')), v.join(' | '));
});

/*
 * การปนเปื้อนคือ skill เข้าบริบทจริง ไม่ใช่การพยายามเรียกแล้วไม่เจอ
 *
 * เดิมเทสนี้ยืนยันว่า "เรียกก็ผิดแล้ว" ซึ่งทำให้ A5 (ไม่มี skill ติดตั้ง แต่ข้อความ
 * มีวลีชวนให้ไปอ่าน skill) หยุดการทดลองทั้งชุดเพราะได้ Unknown skill กลับมา
 * นโยบายที่ประกาศไว้ล่วงหน้าใน PRE-REGISTRATION-2 §7.1 บอกไว้ตรงข้าม
 */
test('arm ที่ปิด skill แล้วเรียก Skill ไม่สำเร็จ ต้องไม่นับเป็นการปนเปื้อน', () => {
  const calls = [{ name: 'Skill', args: { skill: 'trace-to-requirement' } }];
  const v = validateRuntime({ init: cleanInit(), toolCalls: calls, loadedSkills: [], arm: armNoSkills, manifest, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.deepEqual(v, [], 'เรียกแล้วไม่เจอ = ไม่มีอะไรเข้าบริบท');
});

test('arm ที่ปิด skill แต่มี skill เข้าบริบทจริง ต้องจับได้', () => {
  const calls = [{ name: 'Skill', args: { skill: 'trace-to-requirement' } }];
  const v = validateRuntime({ init: cleanInit(), toolCalls: calls, loadedSkills: ['trace-to-requirement'], arm: armNoSkills, manifest, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('ไม่ควรมี skill เข้าบริบทได้เลย')), v.join(' | '));
});

test('skill นอกการทดลองยังจับที่การเรียก ไม่ต้องรอให้โหลดสำเร็จ', () => {
  const calls = [{ name: 'Skill', args: { skill: 'dataviz' } }];
  const v = validateRuntime({ init: cleanInit(), toolCalls: calls, loadedSkills: [], arm: armNoSkills, manifest, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('นอกการทดลอง')), v.join(' | '));
});

test('auto-memory ไม่ว่างตอนเริ่ม run ต้องจับได้', () => {
  const v = validateRuntime({ init: cleanInit(), toolCalls: [], arm: armNoSkills, manifest, memoryStateBefore: 'nonempty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('auto-memory')), v.join(' | '));
});

test('memoryDirEmpty เป็น null (run แรก ยังไม่มีพาธให้ตรวจ) ต้องไม่ถือว่าผิด', () => {
  const v = validateRuntime({ init: cleanInit(), toolCalls: [], arm: armNoSkills, manifest, memoryStateBefore: 'unknown', memoryStateAfter: 'empty' });
  assert.deepEqual(v, []);
});

// ---------- เคสที่เพิ่มหลังรีวิวรอบสอง (4 ก.ย. 2569) ----------

test('auto-memory อ่านไม่ได้ ต้องถือว่าไม่ผ่าน ไม่ใช่กลืนเป็น "ว่าง"', () => {
  // ของเดิม catch แล้ว return true = fail-open ในด่านที่ตั้งใจให้ fail-closed
  const v = validateRuntime({ init: cleanInit(), toolCalls: [], arm: armNoSkills, manifest,
                              memoryStateBefore: 'unreadable', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('อ่านไม่ได้')), v.join(' | '));
});

test('run แรก (before ไม่รู้) ต้องตกมาใช้ after เป็นด่านแทน ไม่ใช่ผ่านฟรี', () => {
  const v = validateRuntime({ init: cleanInit(), toolCalls: [], arm: armNoSkills, manifest,
                              memoryStateBefore: 'unknown', memoryStateAfter: 'nonempty' });
  assert.ok(v.some((x) => x.includes('auto-memory ไม่ว่าง')), v.join(' | '));
});

test('ตรวจ auto-memory ไม่ได้เลยทั้งก่อนและหลัง ต้องไม่ผ่าน', () => {
  const v = validateRuntime({ init: cleanInit(), toolCalls: [], arm: armNoSkills, manifest,
                              memoryStateBefore: 'unknown', memoryStateAfter: 'unknown' });
  assert.ok(v.some((x) => x.includes('ไม่ได้เลยทั้งก่อนและหลัง')), v.join(' | '));
});

test('แก้ไฟล์ที่นิยามการทดลองระหว่างเก็บข้อมูล ต้องจับได้', () => {
  const frozen = { ...manifest, experimentDigest: 'aaaaaaaaaaaaaaaa',
                   experimentFiles: { 'arms/A1/CLAUDE.md': 'old0000000000000' } };
  const now = { combined: 'bbbbbbbbbbbbbbbb', files: { 'arms/A1/CLAUDE.md': 'new0000000000000' } };
  const v = validateRuntime({ init: cleanInit(), toolCalls: [], arm: armNoSkills, manifest: frozen,
                              digest: now, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('ไฟล์ที่นิยามการทดลองถูกแก้')), v.join(' | '));
  assert.ok(v.some((x) => x.includes('arms/A1/CLAUDE.md')), v.join(' | '));
});

test('digest เท่าเดิม ต้องผ่าน', () => {
  const d = { combined: 'aaaaaaaaaaaaaaaa', files: { 'arms/A1/CLAUDE.md': 'x' } };
  const frozen = { ...manifest, experimentDigest: d.combined, experimentFiles: d.files };
  const v = validateRuntime({ init: cleanInit(), toolCalls: [], arm: armNoSkills, manifest: frozen,
                              digest: d, memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.deepEqual(v, []);
});

test('experimentDigest ของจริงต้องคำนวณได้และเปลี่ยนเมื่อไฟล์เปลี่ยน', () => {
  const a = experimentDigest(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  assert.ok(/^[0-9a-f]{16}$/.test(a.combined), `ได้ ${a.combined}`);
  assert.ok(Object.keys(a.files).some((f) => f.startsWith('arms/')), 'ต้องครอบคลุมไฟล์ arm');
  assert.ok(Object.keys(a.files).some((f) => f.startsWith('scenarios/')), 'ต้องครอบคลุม scenario');
  assert.ok('config/rules-canonical.json' in a.files, 'ต้องครอบคลุมกฎฉบับกลาง');
  assert.ok('src/graders.mjs' in a.files, 'ต้องครอบคลุม grader');
});

// ---------- เคสจากรีวิวรอบสาม (4 ก.ย. 2569) ----------

test('auth: manifest แช่แข็งเป็น unknown ต้องไม่ผ่าน ไม่ใช่ข้ามการตรวจ', () => {
  // ของเดิมแช่แข็ง null แล้ว validator เขียน `!== null` จึงข้ามทั้งข้อ = fail-open
  // ในด่านที่ผูกกับ "จ่ายเงินจริงหรือไม่" ซึ่งผิดแล้วรู้ทีหลังไม่ได้
  const mf = { ...manifest, apiKeySource: 'unknown' };
  const v = validateRuntime({ init: cleanInit(), toolCalls: [], arm: armNoSkills, manifest: mf,
                              memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('ระบุแหล่งสิทธิ์เรียกใช้ไม่ได้')), v.join(' | '));
});

test('auth: run ที่ไม่มีค่า apiKeySource ต้องไม่ผ่าน', () => {
  const init = cleanInit(); delete init.apiKeySource;
  const v = validateRuntime({ init, toolCalls: [], arm: armNoSkills, manifest,
                              memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('ระบุแหล่งสิทธิ์เรียกใช้ไม่ได้')), v.join(' | '));
});

test('digest ต้องครอบคลุมไฟล์ harness ที่เปลี่ยน fixed factor ได้ ไม่ใช่แค่ไฟล์เนื้อหา', () => {
  const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const d = experimentDigest(root);
  // adapter เปลี่ยน flag ที่ส่งให้ CLI ได้ · runner เปลี่ยนลำดับสุ่มและเกณฑ์ validate ได้
  for (const f of ['src/adapters/claude-cli.mjs', 'src/runner.mjs', 'src/runtime-manifest.mjs',
                   'src/stats.mjs', 'src/graders.mjs', 'src/claude-bin.mjs',
                   'src/fixture-lock.mjs']) {
    assert.ok(f in d.files, `digest ต้องครอบคลุม ${f}`);
  }
});

test('fixture baseline tree เปลี่ยนกลางการทดลองต้องหยุดแบบ fail-closed', () => {
  const v = validateRuntime({ init: cleanInit(), toolCalls: [], arm: armNoSkills, manifest,
                              fixtureTrees: { 'fixtures/gpu-booking': 'fixture-tree-b' },
                              memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('fixture baseline tree เปลี่ยน')), v.join(' | '));
});

test('manifest ที่ไม่มี fixture baseline tree ต้องไม่ผ่าน', () => {
  const oldManifest = { ...manifest }; delete oldManifest.fixtureBaselineTrees;
  const v = validateRuntime({ init: cleanInit(), toolCalls: [], arm: armNoSkills,
                              manifest: oldManifest,
                              memoryStateBefore: 'empty', memoryStateAfter: 'empty' });
  assert.ok(v.some((x) => x.includes('manifest ไม่มี fixture baseline tree')), v.join(' | '));
});

test('อ่าน tree hash ของ baseline tag จาก fixture จริง ไม่ใช่จาก working tree', () => {
  const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const trees = fixtureBaselineTrees(root, [{ fixture: 'fixtures/gpu-booking' }]);
  const expected = execFileSync('git', ['rev-parse', 'skillbench-baseline^{tree}'], {
    cwd: `${root}/fixtures/gpu-booking`, encoding: 'utf8',
  }).trim();
  assert.deepEqual(trees, { 'fixtures/gpu-booking': expected });
});

test('runner ต้อง snapshot fixture tree ก่อน run แรก และตรวจค่าปัจจุบันใหม่หลังทุก run', () => {
  const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const source = fs.readFileSync(`${root}/src/runner.mjs`, 'utf8');
  const lockAt = source.indexOf('fixtureReleases.push(acquireFixtureLock');
  const snapshotAt = source.indexOf('const fixtureTreesAtStart');
  const runLoopAt = source.indexOf('for (let rep = 0;');

  assert.ok(lockAt >= 0 && lockAt < snapshotAt,
    'ต้องยึด fixture ก่อน snapshot baseline tree เพื่อปิดช่อง TOCTOU ก่อน run แรก');
  assert.ok(snapshotAt >= 0 && snapshotAt < runLoopAt,
    'ต้อง snapshot baseline tree ก่อนเอเจนต์ตัวแรกมีโอกาสแก้ tag');
  assert.match(source, /fixtureTrees:\s*fixtureTreesAtStart/,
    'manifest แรกต้องแช่แข็ง snapshot ก่อน run ไม่ใช่อ่านใหม่หลังเอเจนต์จบ');
  assert.match(source, /fixtureTrees:\s*fixtureBaselineTrees\(ROOT, scenarios\)/,
    'validator ต้องอ่าน tree ปัจจุบันใหม่หลังทุก run เพื่อจับ drift');
  assert.match(source, /finally\s*\{\s*for \(const release of fixtureReleases\.reverse\(\)\) release\(\);/,
    'runner ต้องปลด session lock ใน finally แม้หยุดกลางชุดหรือโยน error');
});
