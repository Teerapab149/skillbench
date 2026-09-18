#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectReadiness } from '../src/readiness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* --config: ชุดที่ 2 มีนิยามการทดลองคนละไฟล์ preflight ต้องตรวจของชุดที่กำลังจะรัน */
const ci = process.argv.indexOf("--config");
const configFile = ci !== -1 && process.argv[ci + 1] ? process.argv[ci + 1] : null;
const report = collectReadiness({ root, configFile });
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('\nSkillBench read-only preflight (advisory)');
  console.log(`  allocation: ${report.allocation.arms} arms × ${report.allocation.scenarios} scenarios × ${report.allocation.repetitions} reps = ${report.allocation.cells} allocated cells · ${report.allocation.source}`);
  for (const check of report.checks) console.log(`  [${check.state.toUpperCase()}] ${check.name}: ${check.reason}`);
  console.log(`  ENGINEERING READY: ${report.engineeringReady ? 'YES' : 'NO'}`);
  console.log(`  COLLECTION READY: ${report.collectionReady ? 'YES' : 'NO'}`);
  if (report.pendingResearchDecisions.length) {
    console.log('  pending investigator decisions:');
    for (const item of report.pendingResearchDecisions) console.log(`    - ${item}`);
  }
  console.log('  no lock, fixture, Claude invocation, or result write was performed\n');
}
