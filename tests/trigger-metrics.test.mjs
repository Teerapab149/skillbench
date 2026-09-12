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

/*
 * Amendment 16 (12 ก.ย. 2569) — Trigger F1 มี ground truth สองชุดที่ประกาศไว้ล่วงหน้า
 *
 * ผู้วิจัยอนุมัติ mapping ของ Amendment 11 ไว้ตามเดิม โดยรับทราบว่ามันตัดสิน relevance
 * จากคำบรรยายโจทย์ ไม่ใช่จากชุดกฎ — S06/S07/S11 ถูกจัดว่าต้องใช้ impact-analysis
 * ทั้งที่มีกฎผลกระทบแค่ IM1 เชิงรับ เหมือน S01-S05/S10 ที่ไม่ถูกจัด
 *
 * เงื่อนไขของการอนุมัติคือต้องรายงานชุดที่ตัดสินจากกฎที่วัดจริงคู่กันเสมอ
 * เทสชุดนี้ตรึงทั้งสอง mapping ไว้ไม่ให้เปลี่ยนเงียบ ๆ และตรึงกลไกที่ทำให้เทียบกันได้
 */
const armsConfig = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'arms.json'), 'utf8'));

test('ground truth ชุดหลักใน config ต้องตรงกับ expectedSkills ในไฟล์ scenario จริง', () => {
  const declared = armsConfig.triggerF1?.primary?.impactAnalysisScenarios;
  assert.ok(Array.isArray(declared), 'config ต้องประกาศ ground truth ชุดหลักไว้');

  const dir = path.join(ROOT, 'scenarios');
  const actual = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .filter((sc) => (sc.expectedSkills ?? []).includes('impact-analysis'))
    .map((sc) => sc.id)
    .sort();

  assert.deepEqual([...declared].sort(), actual,
    'รายชื่อใน config กับใน scenario ต้องเป็นชุดเดียวกัน — ถ้าต่างกันแปลว่ามีที่ประกาศสองที่ที่ไม่เช็คกัน');
});

test('ground truth ชุด sensitivity ต้องแคบกว่าชุดหลักเสมอ ไม่ใช่ชุดอื่นที่ไม่เกี่ยวกัน', () => {
  const primary = new Set(armsConfig.triggerF1.primary.impactAnalysisScenarios);
  const sens = armsConfig.triggerF1.sensitivity.impactAnalysisScenarios;
  assert.ok(sens.length > 0, 'ชุด sensitivity ต้องไม่ว่าง');
  assert.ok(sens.length < primary.size, 'ชุด sensitivity ต้องแคบกว่าชุดหลัก');
  for (const id of sens) {
    assert.ok(primary.has(id), `${id} อยู่ในชุด sensitivity แต่ไม่อยู่ในชุดหลัก`);
  }
});

test('โจทย์ที่ชุด sensitivity นับ ต้องเป็นโจทย์ที่มีกฎผลกระทบเชิงรุกจริง', () => {
  const sens = armsConfig.triggerF1.sensitivity.impactAnalysisScenarios;
  const dir = path.join(ROOT, 'scenarios');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const sc = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const im = (sc.rules ?? []).filter((r) => r.id.startsWith('IM'));
    // เชิงรุก = มีกฎผลกระทบมากกว่าข้อเดียว (IM1 เชิงรับมีอยู่ทุกโจทย์)
    const active = im.length > 1;
    assert.equal(sens.includes(sc.id), active,
      `${sc.id}: กฎผลกระทบเชิงรุก=${active} แต่ชุด sensitivity ${sens.includes(sc.id) ? "นับ" : "ไม่นับ"}`);
  }
});

test('expectedFor เปลี่ยน ground truth ได้โดยใช้สูตร F1 ตัวเดียวกัน', () => {
  const rows = [
    { scenarioId: 'S06-per-booking-quota', expectedSkills: ['impact-analysis'], loadedSkills: ['impact-analysis'] },
    { scenarioId: 'S08-rounding-change', expectedSkills: ['impact-analysis'], loadedSkills: ['impact-analysis'] },
  ];
  const skills = ['impact-analysis'];

  const primary = triggerMetrics(rows, skills);
  assert.equal(primary['impact-analysis'].tp, 2, 'ชุดหลักนับทั้งสองโจทย์ว่าเกี่ยวข้อง');
  assert.equal(primary['impact-analysis'].fp, 0);

  // ชุดแคบนับเฉพาะ S08 — การโหลดใน S06 จึงกลายเป็น false positive
  const keep = new Set(['S08-rounding-change']);
  const narrow = triggerMetrics(rows, skills, {
    expectedFor: (g) => (g.expectedSkills ?? []).filter((x) => x !== 'impact-analysis' || keep.has(g.scenarioId)),
  });
  assert.equal(narrow['impact-analysis'].tp, 1);
  assert.equal(narrow['impact-analysis'].fp, 1);
  assert.ok(narrow['impact-analysis'].f1 < primary['impact-analysis'].f1,
    'ground truth ที่แคบกว่าต้องให้ F1 ต่ำกว่าเมื่อเอเจนต์โหลดกว้าง');
});
