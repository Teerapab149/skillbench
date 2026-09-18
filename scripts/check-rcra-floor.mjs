#!/usr/bin/env node
/**
 * ด่านพื้นของ RCRa — เอเจนต์ที่ไม่ทำอะไรเลยต้องได้คะแนนใกล้ศูนย์
 *
 * ประกาศไว้ใน PRE-REGISTRATION-2 หัวข้อ 3.3 ว่าเป็นเงื่อนไขที่ต้องผ่าน
 * ก่อนเก็บข้อมูลชุดที่ 2 แม้แต่ run เดียว ถ้าไม่ผ่าน RCRa ใช้เป็นตัวชี้วัดหลักไม่ได้
 * และต้องกลับไปใช้ CRIT ตามชุดที่ 1
 *
 * ด่านนี้มีไว้เพื่อให้การเปลี่ยนตัวชี้วัด **ล้มได้** ไม่ใช่เพื่อรับรองว่าจะผ่าน
 */
import fs from 'node:fs';
import path from 'node:path';
import { gradeRun } from '../src/graders.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const CEILING = 0.05;

/** เอเจนต์ที่ไม่ทำอะไรเลย: ไม่แก้ไฟล์ ไม่รันคำสั่ง ไม่เรียก tool ไม่ตอบอะไร */
function idleArtifact(scenarioId) {
  return {
    runId: `idle__${scenarioId}`,
    armId: 'IDLE',
    repIndex: 0,
    filesChanged: [],
    diff: '',
    commands: [],
    toolCalls: [],
    finalMessage: '',
    loadedSkills: [],
    agentCommits: [],
    // ชุดเทสของ fixture เขียวอยู่แล้วบน baseline การไม่แตะอะไรจึงไม่ทำให้พัง
    testsPassed: true,
    // เทสยอมรับรันได้แต่ตก เพราะยังไม่มีใครทำงาน
    acceptance: { ran: true, passed: false },
    probes: { before: {}, after: {} },
    costUsd: 0,
    tokens: { input: 0, output: 0 },
  };
}

const scenarios = fs.readdirSync(path.join(ROOT, 'scenarios'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'scenarios', f), 'utf8')))
  .sort((a, b) => a.id.localeCompare(b.id));

console.log('\n  ด่านพื้นของตัวชี้วัด — ป้อนเอเจนต์ที่ไม่ทำอะไรเลยเข้าตัวตรวจทุกโจทย์\n');
console.log('  โจทย์                        RCR เดิม   RCRa   กฎวิกฤตที่เข้าเงื่อนไข');

const rows = [];
for (const sc of scenarios) {
  const g = gradeRun(idleArtifact(sc.id), sc);
  const crit = g.rules.filter((r) => r.severity === 'critical');
  const app = crit.filter((r) => r.applicable);
  rows.push({ id: sc.id, RCR: g.RCR, RCRa: g.RCRa, app: app.length, crit: crit.length, CRIT: g.CRIT });
  const fmt = (v) => (v === null ? '  n/a' : v.toFixed(3));
  console.log(`  ${sc.id.padEnd(26)} ${fmt(g.RCR)}   ${fmt(g.RCRa)}   ${app.length}/${crit.length}`);
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const meanRCR = mean(rows.map((r) => r.RCR));
const scored = rows.filter((r) => r.RCRa !== null);
const meanRCRa = scored.length ? mean(scored.map((r) => r.RCRa)) : null;
const worst = scored.length ? Math.max(...scored.map((r) => r.RCRa)) : null;
const noRules = rows.filter((r) => r.RCRa === null);

console.log(`\n  RCR เดิมเฉลี่ย   ${meanRCR.toFixed(3)}   <- พื้นเชิงโครงสร้างที่เป็นเหตุให้ RCR ถูกปลด`);
console.log(`  RCRa เฉลี่ย      ${meanRCRa === null ? 'n/a' : meanRCRa.toFixed(3)}`);
console.log(`  RCRa สูงสุด      ${worst === null ? 'n/a' : worst.toFixed(3)}   (เพดานที่ประกาศไว้ ${CEILING.toFixed(2)})`);

const problems = [];
if (noRules.length) problems.push(`${noRules.length} โจทย์ไม่มีกฎวิกฤตที่เข้าเงื่อนไขเลย: ${noRules.map((r) => r.id).join(', ')}`);
if (worst !== null && worst > CEILING) {
  problems.push(`มีโจทย์ที่ RCRa เกินเพดาน: ${scored.filter((r) => r.RCRa > CEILING).map((r) => `${r.id}=${r.RCRa.toFixed(3)}`).join(', ')}`);
}

if (problems.length) {
  console.log('\n⛔ ไม่ผ่านด่านพื้น — RCRa ใช้เป็นตัวชี้วัดหลักของชุดที่ 2 ไม่ได้');
  for (const p of problems) console.log(`   · ${p}`);
  console.log('   ตามที่ประกาศไว้ ต้องกลับไปใช้ CRIT หรือซ่อมตัวตรวจให้ผ่านด่านนี้ก่อน\n');
  process.exit(1);
}

console.log('\n✅ ผ่านด่านพื้น — เอเจนต์ที่ไม่ทำอะไรเลยได้คะแนนใกล้ศูนย์ทุกโจทย์\n');
