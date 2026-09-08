import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { gradeRun, triggerMetrics } from '../src/graders.mjs';

const SCORABLE_SKILLS = ['acceptance-first', 'impact-analysis', 'trace-to-requirement'];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('พลาด skill ที่เกี่ยวข้องทั้งหมดต้องได้ F1 = 0 ไม่ใช่ NaN', () => {
  const metrics = triggerMetrics([
    { expectedSkills: ['acceptance-first'], loadedSkills: [] },
  ], SCORABLE_SKILLS);

  assert.equal(metrics['acceptance-first'].tp, 0);
  assert.equal(metrics['acceptance-first'].fn, 1);
  assert.equal(metrics['acceptance-first'].recall, 0);
  assert.equal(metrics['acceptance-first'].f1, 0);
});

test('โจทย์หนึ่งมี skill ที่เกี่ยวข้องได้หลายตัวโดยไม่ถูกนับเป็น false positive', () => {
  const metrics = triggerMetrics([
    {
      expectedSkills: ['acceptance-first', 'trace-to-requirement'],
      loadedSkills: ['acceptance-first', 'trace-to-requirement'],
    },
  ], SCORABLE_SKILLS);

  assert.equal(metrics['acceptance-first'].tp, 1);
  assert.equal(metrics['acceptance-first'].fp, 0);
  assert.equal(metrics['trace-to-requirement'].tp, 1);
  assert.equal(metrics['trace-to-requirement'].fp, 0);
});

test('skill ที่ถูกเรียกทั้งที่ไม่เกี่ยวข้องต้องได้ F1 = 0', () => {
  const metrics = triggerMetrics([
    {
      expectedSkills: ['acceptance-first'],
      loadedSkills: ['impact-analysis'],
    },
  ], SCORABLE_SKILLS);

  assert.equal(metrics['impact-analysis'].fp, 1);
  assert.equal(metrics['impact-analysis'].precision, 0);
  assert.equal(metrics['impact-analysis'].f1, 0);
});

test('รองรับ artifact เก่าที่มี expectedSkill ค่าเดียวโดยไม่เปลี่ยนความหมายย้อนหลัง', () => {
  const metrics = triggerMetrics([
    { expectedSkill: 'impact-analysis', loadedSkills: ['impact-analysis'] },
  ], SCORABLE_SKILLS);

  assert.equal(metrics['impact-analysis'].tp, 1);
  assert.equal(metrics['impact-analysis'].f1, 1);
});

test('gradeRun เก็บ ground truth แบบหลาย label ลง artifact ที่ให้คะแนนแล้ว', () => {
  const graded = gradeRun({
    runId: 'r1', armId: 'A2', repIndex: 0,
    filesChanged: [], toolCalls: [], loadedSkills: [], testsPassed: false,
  }, {
    id: 'S-test', rules: [],
    expectedSkills: ['trace-to-requirement', 'acceptance-first'],
  });

  assert.deepEqual(graded.expectedSkills, ['trace-to-requirement', 'acceptance-first']);
  assert.equal(Object.hasOwn(graded, 'expectedSkill'), false);
});

test('ทั้ง 11 scenario ใช้ multi-label ที่ตรึงไว้และไม่เหลือ expectedSkill ค่าเดียว', () => {
  const files = fs.readdirSync(path.join(ROOT, 'scenarios'))
    .filter((name) => /^S\d+.*\.json$/.test(name))
    .sort();
  const scenarios = files.map((name) => JSON.parse(
    fs.readFileSync(path.join(ROOT, 'scenarios', name), 'utf8')));

  assert.equal(scenarios.length, 11);
  for (const scenario of scenarios) {
    assert.equal(Object.hasOwn(scenario, 'expectedSkill'), false, scenario.id);
    assert.ok(Array.isArray(scenario.expectedSkills) && scenario.expectedSkills.length > 0, scenario.id);
    assert.equal(new Set(scenario.expectedSkills).size, scenario.expectedSkills.length, scenario.id);
    assert.ok(scenario.expectedSkills.every((skill) => SCORABLE_SKILLS.includes(skill)), scenario.id);
    assert.ok(scenario.expectedSkills.includes('trace-to-requirement'), scenario.id);
    assert.ok(scenario.expectedSkills.includes('acceptance-first'), scenario.id);
  }

  const impactScenarios = scenarios
    .filter((scenario) => scenario.expectedSkills.includes('impact-analysis'))
    .map((scenario) => scenario.id);
  assert.deepEqual(impactScenarios, [
    'S06-per-booking-quota',
    'S07-weekly-quota',
    'S08-rounding-change',
    'S09-rate-change',
    'S11-week-boundary',
  ]);
});
