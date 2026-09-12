/** Read-only launch-readiness audit. It never acquires locks, runs Claude, or writes evidence. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { experimentDigest, fixtureBaselineTrees } from './runtime-manifest.mjs';
import { inspectLock, legacyLockPathFor } from './fixture-lock.mjs';
import { resolveClaudeBin } from './claude-bin.mjs';

const status = (name, state, reason, evidence = null) => ({ name, state, reason, evidence });

function jsonFile(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return { __error: e.message }; }
}

export function fingerprint(dir) {
  if (!fs.existsSync(dir)) return { exists: false, files: 0, sha256: null };
  const rows = [];
  const walk = (base, rel = '') => {
    for (const entry of fs.readdirSync(base, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = path.join(base, entry.name);
      const childRel = path.join(rel, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) walk(child, childRel);
      else rows.push([childRel, createHash('sha256').update(fs.readFileSync(child)).digest('hex')]);
    }
  };
  walk(dir);
  return { exists: true, files: rows.length, sha256: createHash('sha256').update(rows.map((r) => r.join(':')).join('\n')).digest('hex') };
}

function gitStatus(dir) {
  try { return execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }).trim(); }
  catch (e) { return `ERROR: ${e.message}`; }
}

/** Audit the append-only journal without opening AttemptStore (open mutates/recovery-writes). */
export function auditAttemptStore(outDir) {
  const root = path.join(outDir, 'attempt-provenance');
  if (!fs.existsSync(root)) return { state: 'unknown', reason: 'ยังไม่มี attempt-provenance', records: 0, orphanStarts: 0, malformed: [] };
  const malformed = [];
  let records = 0;
  let orphanStarts = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith('.json')) {
        records++;
        const value = jsonFile(file);
        if (value.__error || !value.version || !value.stage) malformed.push(path.relative(root, file));
      }
    }
  };
  walk(root);
  const expRoot = path.join(root, 'experiments');
  if (fs.existsSync(expRoot)) {
    const cells = [];
    const collect = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (/^\d{6}-/.test(e.name) && fs.existsSync(path.join(p, 'start.json'))) cells.push(p);
          else collect(p);
        }
      }
    };
    collect(expRoot);
    for (const cell of cells) {
      const entries = fs.readdirSync(cell);
      const hasArtifact = entries.includes('artifact.json');
      const dispositions = entries.filter((f) => f.startsWith('disposition-')).map((f) => jsonFile(path.join(cell, f)));
      const committed = dispositions.some((r) => r?.reason === 'checkpoint_committed');
      const terminal = dispositions.some((r) => ['session_limit_pause', 'runtime_violations',
        'missing_init_before_manifest', 'grader_exception', 'checkpoint_exception'].includes(r?.reason));
      // A start is complete only after the checkpoint projection is durably
      // marked.  An artifact without that marker is recoverable evidence, not
      // a silently selectable run.
      if ((!hasArtifact && dispositions.length === 0) || (hasArtifact && !committed && !terminal)) orphanStarts++;
    }
  }
  return { state: malformed.length ? 'fail' : 'pass', reason: malformed.length ? 'พบ record เสีย/อ่านไม่ได้' : 'อ่าน record แบบไม่เขียนได้', records, orphanStarts, malformed };
}

export function collectReadiness({ root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), resultsDir = null } = {}) {
  root = path.resolve(root);
  resultsDir = path.resolve(resultsDir ?? path.join(root, 'results'));
  const checks = [];
  let config = null;
  try { config = jsonFile(path.join(root, 'config', 'arms.json')); } catch { /* represented below */ }
  const scenariosDir = path.join(root, 'scenarios');
  const scenarios = fs.existsSync(scenariosDir) ? fs.readdirSync(scenariosDir).filter((f) => f.endsWith('.json')).map((f) => jsonFile(path.join(scenariosDir, f))).filter((s) => !s.__error) : [];
  const arms = config?.arms ?? [];
  const fixed = config?.fixedFactors ?? {};
  /*
   * การจัดสรรต้องอ่านจาก config ไม่ใช่เขียนตายไว้ตรงนี้
   *
   * ของเดิม hard-code repetitions: 6 ซึ่งแปลว่า preflight รายงาน "330 cells" ได้
   * แม้ตอนที่ประกาศจริงจะเป็นเลขอื่น — ตัวเลขที่ควรถูกตรวจกลับเป็นตัวเลขที่ตรวจตัวเอง
   * Amendment 14 ย้ายการประกาศไปอยู่ที่ config/arms.json ที่เดียว
   */
  const prereg = config?.preRegisteredAllocation ?? null;
  const allocation = prereg
    ? { arms: prereg.arms.length, scenarios: prereg.scenarios, repetitions: prereg.reps, cells: prereg.cells, source: 'config/arms.json preRegisteredAllocation' }
    : { arms: arms.length, scenarios: scenarios.length, repetitions: null, cells: null, source: 'derived — ไม่มี preRegisteredAllocation ใน config' };
  checks.push(config?.__error ? status('config', 'fail', config.__error) : status('config', 'pass', 'อ่าน config ปัจจุบันแล้ว', { model: fixed.model, maxTurns: fixed.maxTurns, allocation }));

  /*
   * ตัวเลขที่ประกาศต้องตรงกับของจริงที่นับได้จากดิสก์ ไม่ใช่แค่ประกาศแล้วจบ
   * ถ้า config บอก 11 scenario แต่ scenarios/ มี 12 ไฟล์ นั่นคือ allocation ที่ยังไม่ถูกประกาศใหม่
   */
  if (prereg) {
    const mismatch = [];
    if (prereg.arms.length !== arms.length) mismatch.push(`arm ที่ประกาศ ${prereg.arms.length} แต่ config มี ${arms.length}`);
    const armIds = arms.map((a) => a.id ?? a);
    for (const id of prereg.arms) if (!armIds.includes(id)) mismatch.push(`arm ${id} ที่ประกาศไว้ไม่มีใน config`);
    if (prereg.scenarios !== scenarios.length) mismatch.push(`scenario ที่ประกาศ ${prereg.scenarios} แต่ scenarios/ มี ${scenarios.length}`);
    if (prereg.cells !== prereg.arms.length * prereg.scenarios * prereg.reps) mismatch.push(`cells ที่ประกาศ ${prereg.cells} ไม่เท่ากับ ${prereg.arms.length}x${prereg.scenarios}x${prereg.reps}`);
    checks.push(mismatch.length
      ? status('allocation-declared', 'fail', mismatch.join(' · '), { prereg })
      : status('allocation-declared', 'pass', `การจัดสรรที่ประกาศตรงกับของจริง (${prereg.cells} cell) · fallback: ${prereg.fallback?.type ?? 'ไม่มี'}`, { prereg }));
  } else {
    checks.push(status('allocation-declared', 'fail', 'config/arms.json ไม่มี preRegisteredAllocation — ไม่มีตัวเลขที่ประกาศให้ตรวจ'));
  }

  const fixtures = [...new Set(scenarios.map((s) => s.fixture).filter(Boolean))];
  let trees = null;
  try { trees = fixtureBaselineTrees(root, scenarios); checks.push(status('fixture-baseline-tags', 'pass', 'อ่าน baseline tree จาก git tag ได้', trees)); }
  catch (e) { checks.push(status('fixture-baseline-tags', 'fail', e.message)); }
  for (const rel of fixtures) {
    const dir = path.resolve(root, rel);
    const dirty = gitStatus(dir);
    checks.push(status(`fixture-working-tree:${rel}`, dirty ? 'fail' : 'pass', dirty ? 'fixture มี working-tree changes; preflight ไม่ reset/clean' : 'fixture working tree สะอาด'));
    try {
      const holder = inspectLock(dir);
      checks.push(status(`fixture-lock:${rel}`, holder ? 'fail' : 'pass', holder ? holder.reason : 'ไม่มี lock ปัจจุบัน', holder?.lockPath ?? null));
      checks.push(status(`legacy-lock:${rel}`, fs.existsSync(legacyLockPathFor(dir)) ? 'fail' : 'pass', fs.existsSync(legacyLockPathFor(dir)) ? 'ต้อง maintenance window หยุด binary รุ่นเก่า' : 'ไม่พบ v1 lock'));
    } catch (e) { checks.push(status(`fixture-lock:${rel}`, 'unknown', e.message)); }
  }

  const digest = experimentDigest(root);
  const manifests = fs.existsSync(resultsDir) ? fs.readdirSync(resultsDir).filter((f) => /^manifest-[^/]+\.json$/.test(f) && !f.includes('.retired-')) : [];
  checks.push(status('experiment-digest', 'pass', 'คำนวณ digest ได้', digest.combined));
  checks.push(status('runtime-manifest', manifests.length === 1 ? 'pass' : 'unknown', manifests.length === 1 ? 'พบ manifest เดียวสำหรับ advisory comparison' : 'ไม่มี/มีหลาย manifest จึงยังเทียบชุดเดียวไม่ได้', manifests));

  const bin = resolveClaudeBin();
  checks.push(status('claude-cli-static', bin.mode === 'direct' && (bin.bin === 'claude' || fs.existsSync(bin.bin)) ? 'pass' : 'unknown', 'ตรวจ path/mode แบบไม่ execute', { mode: bin.mode, how: bin.how }));
  checks.push(status('auth-presence', process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN ? 'unknown' : 'unknown', 'มี/ไม่มี env credential ไม่ยืนยันสิทธิ์จริง; ต้องใช้ init evidence', { present: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) }));
  const attempt = auditAttemptStore(resultsDir);
  checks.push(status('attempt-provenance', attempt.state, attempt.reason, attempt));
  const resultFp = fingerprint(resultsDir);
  checks.push(status('results-fingerprint', resultFp.exists ? 'pass' : 'unknown', resultFp.exists ? 'บันทึก fingerprint ของผลที่มีอยู่; simulated:false ไม่ทำให้เป็น final' : 'ยังไม่มี results', resultFp));

  const pending = [
    'investigator approval: Amendment 11–13',
  ];
  // Unknown means “cannot be established without a real run” (for example
  // auth validity or an as-yet empty journal), not an offline engineering
  // defect. Only explicit failures block the technical handoff; collection
  // readiness remains stricter and is gated by the pending decisions below.
  const engineeringReady = checks.every((c) => c.state !== 'fail') && attempt.orphanStarts === 0;
  return {
    generatedAt: new Date().toISOString(), advisory: true, allocation, config: { model: fixed.model ?? null, maxTurns: fixed.maxTurns ?? null },
    checks, pendingResearchDecisions: pending, resultsFingerprint: resultFp,
    engineeringReady, collectionReady: engineeringReady && pending.length === 0,
    note: 'point-in-time read-only advisory; runner lock/manifest enforcement remains authoritative',
  };
}
