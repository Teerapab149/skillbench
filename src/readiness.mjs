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
        /*
         * ไม่ใช่ทุกไฟล์ในสมุดบันทึกเป็น "ระเบียนความพยายาม"
         *
         * มีอีกสองชนิดที่ถูกต้องแต่ไม่มีฟิลด์ stage โดยธรรมชาติ:
         *   by-signature/<sig>/<seq>-<expId>.json  = ดัชนีชี้ไปยังการทดลอง
         *   experiments/<expId>/experiment.json    = หัวเรื่องของการทดลอง
         *
         * เดิมบังคับ stage กับทุกไฟล์ ทำให้สองชนิดนี้ขึ้นเป็น malformed ตลอด
         * ผลคือ ENGINEERING READY = NO ค้างมาตั้งแต่ชุดที่ 1 ด้วยเหตุผลที่ไม่จริง
         * ซึ่งอันตรายกว่าที่เห็น เพราะทำให้คนเลิกเชื่อสัญญาณของด่านนี้ทั้งด่าน
         */
        const rel = path.relative(root, file).split(path.sep).join("/");
        const isIndex = rel.startsWith("by-signature/") || rel.endsWith("/experiment.json");
        const bad = value.__error || !value.version || (!isIndex && !value.stage);
        if (bad) malformed.push(rel);
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

export function collectReadiness({ root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), resultsDir = null, configFile = null } = {}) {
  root = path.resolve(root);
  resultsDir = path.resolve(resultsDir ?? path.join(root, 'results'));
  const checks = [];
  let config = null;
  /*
   * ชุดที่ 2 มีนิยามการทดลองอยู่คนละไฟล์ ถ้าอ่านตายตัวที่ config/arms.json
   * preflight ก่อนเก็บชุดที่ 2 จะเอาการจัดสรรของชุดที่ 1 ไปตรวจ ซึ่งเป็น
   * การตรวจที่มีไว้จับ allocation drift โดยเฉพาะ แล้วมองไม่เห็น drift ที่สำคัญที่สุด
   */
  const configPath = configFile ? path.resolve(root, configFile) : path.join(root, 'config', 'arms.json');
  const configRel = path.relative(root, configPath).split(path.sep).join('/');
  try { config = jsonFile(configPath); } catch { /* represented below */ }
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
    ? { arms: prereg.arms.length, scenarios: prereg.scenarios, repetitions: prereg.reps, cells: prereg.cells, source: configRel + String.fromCharCode(32) + String.fromCharCode(112,114,101,82,101,103,105,115,116,101,114,101,100,65,108,108,111,99,97,116,105,111,110) }
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
    checks.push(status('allocation-declared', 'fail', configRel + ' ไม่มี preRegisteredAllocation — ไม่มีตัวเลขที่ประกาศให้ตรวจ'));
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

  /*
   * manifest ที่แช่แข็งไว้ต้องเป็นของนิยามการทดลองปัจจุบัน ไม่ใช่แค่ "มีไฟล์อยู่"
   *
   * ของเดิมนับว่าผ่านเมื่อมี manifest หนึ่งไฟล์ ซึ่งผ่านได้แม้ manifest นั้นถูกแช่แข็งไว้
   * ตอนที่ arm หรือ grader ยังเป็นอีกเวอร์ชันหนึ่ง — คือกรณีที่เป็นจริงอยู่ตอนนี้
   * manifest ใน results/ เป็นของชุด rep 0 เมื่อ 5 ก.ย. ซึ่ง digest ไม่ตรงกับปัจจุบันแล้ว
   *
   * manifest ที่ตรง digest คือหลักฐานเดียวที่พิสูจน์ว่า CLI จริงเคยรันภายใต้นิยามชุดนี้สำเร็จ
   * จึงใช้มันเป็นหลักฐาน auth ด้วย — การมี env credential ไม่เคยพิสูจน์สิทธิ์จริง
   */
  let manifestDigest = null;
  if (manifests.length === 1) {
    try { manifestDigest = jsonFile(path.join(resultsDir, manifests[0]))?.experimentDigest ?? null; } catch { manifestDigest = null; }
  }
  const manifestMatches = manifests.length === 1 && manifestDigest === digest.combined;
  checks.push(status(
    'runtime-manifest',
    manifestMatches ? 'pass' : 'unknown',
    manifests.length !== 1
      ? 'ไม่มี/มีหลาย manifest จึงยังเทียบชุดเดียวไม่ได้'
      : manifestMatches
        ? 'manifest ที่แช่แข็งไว้ตรงกับ digest ปัจจุบัน'
        : `manifest ถูกแช่แข็งไว้กับนิยามการทดลองคนละชุด (${manifestDigest} != ${digest.combined}) — ชุดเก็บข้อมูลใหม่จะแช่แข็ง manifest ของตัวเอง`,
    { manifests, manifestDigest, current: digest.combined },
  ));

  const bin = resolveClaudeBin();
  checks.push(status('claude-cli-static', bin.mode === 'direct' && (bin.bin === 'claude' || fs.existsSync(bin.bin)) ? 'pass' : 'unknown', 'ตรวจ path/mode แบบไม่ execute', { mode: bin.mode, how: bin.how }));
  checks.push(status(
    'auth-presence',
    manifestMatches ? 'pass' : 'unknown',
    manifestMatches
      ? 'มี init evidence จาก CLI จริงภายใต้นิยามการทดลองชุดนี้'
      : 'มี/ไม่มี env credential ไม่ยืนยันสิทธิ์จริง; ต้องรัน CLI จริงหนึ่งครั้งเพื่อให้ได้ init evidence',
    { envPresent: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN), fromManifest: manifestMatches },
  ));
  const attempt = auditAttemptStore(resultsDir);
  checks.push(status('attempt-provenance', attempt.state, attempt.reason, attempt));
  const resultFp = fingerprint(resultsDir);
  checks.push(status('results-fingerprint', resultFp.exists ? 'pass' : 'unknown', resultFp.exists ? 'บันทึก fingerprint ของผลที่มีอยู่; simulated:false ไม่ทำให้เป็น final' : 'ยังไม่มี results', resultFp));

  // Amendments 11–13 were approved by the investigator on 2026-09-12 (PRE-REGISTRATION.md §23),
  // which empties this list. It stays in the shape it had so the field keeps its meaning.
  const pending = [];

  /*
   * Unknown means “cannot be established without a real run” (for example auth validity
   * or an as-yet empty journal), not an offline engineering defect. Only explicit failures
   * block the technical handoff.
   *
   * Collection readiness is stricter and must not become true merely because the research
   * decisions are recorded. Before this change it was `pending.length === 0`, so approving
   * the last amendment would have flipped COLLECTION READY to true while no real CLI run
   * had ever been made — the one blocker that software cannot settle on its own.
   */
  const engineeringReady = checks.every((c) => c.state !== 'fail') && attempt.orphanStarts === 0;
  const collectionBlockers = [...pending];
  if (!manifestMatches) {
    collectionBlockers.push(manifests.length === 1 && manifestDigest !== digest.combined
      ? `runtime preflight: manifest ที่มีอยู่เป็นของนิยามการทดลองชุดก่อน (${manifestDigest}) — ต้องรัน CLI จริงหนึ่งครั้งเพื่อแช่แข็ง manifest ของชุดนี้และยืนยัน auth`
      : 'runtime preflight: ยังไม่มี init evidence จาก CLI จริงภายใต้นิยามการทดลองชุดนี้ — ต้องรันหนึ่งครั้งก่อนเก็บข้อมูล');
  }
  return {
    generatedAt: new Date().toISOString(), advisory: true, allocation, config: { model: fixed.model ?? null, maxTurns: fixed.maxTurns ?? null },
    checks, pendingResearchDecisions: pending, collectionBlockers, resultsFingerprint: resultFp,
    engineeringReady, collectionReady: engineeringReady && collectionBlockers.length === 0,
    note: 'point-in-time read-only advisory; runner lock/manifest enforcement remains authoritative',
  };
}
