#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectReadiness } from '../src/readiness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const report = collectReadiness({ root });
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log('\nSkillBench read-only preflight (advisory)');
  console.log(`  allocation: ${report.allocation.arms} arms × ${report.allocation.scenarios} scenarios × 6 reps = ${report.allocation.cells} allocated cells`);
  for (const check of report.checks) console.log(`  [${check.state.toUpperCase()}] ${check.name}: ${check.reason}`);
  console.log(`  ENGINEERING READY: ${report.engineeringReady ? 'YES' : 'NO'}`);
  console.log(`  COLLECTION READY: ${report.collectionReady ? 'YES' : 'NO'}`);
  if (report.pendingResearchDecisions.length) {
    console.log('  pending investigator decisions:');
    for (const item of report.pendingResearchDecisions) console.log(`    - ${item}`);
  }
  console.log('  no lock, fixture, Claude invocation, or result write was performed\n');
}
