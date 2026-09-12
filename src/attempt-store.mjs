/**
 * Append-only attempt provenance.
 *
 * The checkpoint remains a resumability projection.  Evidence lives here as one
 * immutable JSON file per stage, made visible atomically only after it is complete.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ATTEMPT_STORE_VERSION = 1;

const EXECUTION = new Set(['returned', 'adapter_exception', 'interrupted_unknown']);
const TERMINATION = new Set(['completed', 'budget_exhausted', 'timeout', 'auth', 'session_limit', 'rate_limit', 'api_error', 'process_error', 'unknown']);
const MEASUREMENT = new Set(['valid', 'failed', 'unknown']);
const RUNTIME = new Set(['valid', 'violations', 'not_checked']);
const GRADING = new Set(['graded', 'failed', 'not_attempted']);
const SCHEDULER = new Set(['retry', 'pause', 'stop', 'selected', 'continue']);

function assertEnum(name, value, allowed) {
  if (!allowed.has(value)) throw new Error(`attempt provenance: ${name} ไม่ถูกต้อง: ${value}`);
}

function json(value) {
  return `${JSON.stringify(value, (_key, item) => {
    if (typeof item === 'bigint') return { $bigint: String(item) };
    if (item instanceof Error) return { name: item.name, message: item.message, stack: item.stack };
    return item;
  }, 2)}\n`;
}

/** Write a complete temporary file, then atomically link it into its immutable name. */
export function writeImmutableJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  let fd;
  try {
    fd = fs.openSync(tmp, 'wx', 0o600);
    fs.writeFileSync(fd, json(value), 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    // link is atomic and fails on collision; unlike rename it never replaces evidence.
    fs.linkSync(tmp, file);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try { fs.unlinkSync(tmp); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return file;
}

/** Mutable pointers/checkpoints are projections and may be atomically replaced. */
export function writeProjectionJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(tmp, json(value), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  fs.renameSync(tmp, file);
}

function readJsonStrict(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    const err = new Error(`attempt provenance ${label} เสียหรืออ่านไม่ได้: ${file}: ${e.message}`);
    err.code = 'ATTEMPT_STORE_CORRUPT';
    throw err;
  }
}

function safeRunDir(runId) {
  return encodeURIComponent(runId).replace(/%/g, '_');
}

function stagePath(attempt, stage) {
  return path.join(attempt.dir, `${stage}.json`);
}

function validateExperiment(record, { signatureHash, signature }) {
  if (record?.version !== ATTEMPT_STORE_VERSION || !record.experimentId || !record.createdAt) {
    throw Object.assign(new Error('attempt provenance experiment metadata เป็น legacy/corrupt และไม่มี migration ที่รองรับ'), { code: 'ATTEMPT_STORE_CORRUPT' });
  }
  if (record.signatureHash !== signatureHash || record.signature !== signature) {
    throw Object.assign(new Error('attempt provenance pointer ชี้การทดลองที่ signature ไม่ตรง — หยุดแบบ fail-closed'), { code: 'ATTEMPT_STORE_SIGNATURE_MISMATCH' });
  }
}

export class AttemptStore {
  static open({ outDir, signatureHash, signature, newExperiment = false, legacyProjectionPaths = [], now = () => new Date(), uuid = () => crypto.randomUUID() }) {
    const root = path.join(outDir, 'attempt-provenance');
    const pointers = path.join(root, 'by-signature');
    const experiments = path.join(root, 'experiments');
    const legacyPointerPath = path.join(pointers, `${signatureHash}.json`);
    const pointerDir = path.join(pointers, signatureHash);
    fs.mkdirSync(pointers, { recursive: true });
    fs.mkdirSync(experiments, { recursive: true });
    if (fs.existsSync(legacyPointerPath)) {
      throw Object.assign(new Error('attempt provenance pointer รูปแบบ legacy/corrupt — ใช้ migration ที่ประกาศชัดเจน'), { code: 'ATTEMPT_STORE_CORRUPT' });
    }
    fs.mkdirSync(pointerDir, { recursive: true });
    const pointerEntries = fs.readdirSync(pointerDir).filter((f) => f.endsWith('.json'));
    const refs = pointerEntries.filter((f) => /^\d{12}-.+\.json$/.test(f)).sort();
    if (refs.length !== pointerEntries.length) {
      throw Object.assign(new Error('attempt provenance pointer directory มี record รูปแบบ legacy/corrupt'), { code: 'ATTEMPT_STORE_CORRUPT' });
    }

    if (!newExperiment && refs.length) {
      const pointerPath = path.join(pointerDir, refs.at(-1));
      const pointer = readJsonStrict(pointerPath, 'pointer');
      if (pointer?.version !== ATTEMPT_STORE_VERSION || !pointer.experimentId) {
        throw Object.assign(new Error('attempt provenance pointer เป็น legacy/corrupt — ใช้ --new-experiment หรือ migration ที่ประกาศชัดเจน'), { code: 'ATTEMPT_STORE_CORRUPT' });
      }
      const metaPath = path.join(experiments, pointer.experimentId, 'experiment.json');
      const meta = readJsonStrict(metaPath, 'experiment metadata');
      validateExperiment(meta, { signatureHash, signature });
      const store = new AttemptStore({ root, pointerPath, meta, now, uuid });
      store.recoverInterruptedAttempts();
      return store;
    }

    const experimentId = uuid();
    const createdAt = now().toISOString();
    const legacySources = legacyProjectionPaths.filter((p) => fs.existsSync(p)).map((p) => path.resolve(p));
    const meta = {
      version: ATTEMPT_STORE_VERSION,
      experimentId,
      signatureHash,
      signature,
      createdAt,
      migration: legacySources.length ? {
        kind: 'legacy_projection_without_attempt_provenance',
        sources: legacySources,
        note: 'Existing projections are preserved for compatibility; missing historical attempts were not reconstructed.',
      } : null,
    };
    const metaPath = path.join(experiments, experimentId, 'experiment.json');
    writeImmutableJson(metaPath, meta);
    if (meta.migration) {
      writeImmutableJson(path.join(experiments, experimentId, 'migration.json'), {
        ...meta.migration, experimentId, recordedAt: createdAt,
      });
    }
    const generation = refs.length ? Number(refs.at(-1).slice(0, 12)) + 1 : 1;
    const refName = `${String(generation).padStart(12, '0')}-${experimentId}.json`;
    const pointerPath = path.join(pointerDir, refName);
    writeImmutableJson(pointerPath, { version: ATTEMPT_STORE_VERSION, experimentId, generation, updatedAt: createdAt });
    return new AttemptStore({ root, pointerPath, meta, now, uuid });
  }

  constructor({ root, pointerPath, meta, now, uuid }) {
    this.root = root;
    this.pointerPath = pointerPath;
    this.meta = meta;
    this.experimentId = meta.experimentId;
    this.experimentDir = path.join(root, 'experiments', meta.experimentId);
    this.now = now;
    this.uuid = uuid;
  }

  attemptsFor(runId) {
    const cellDir = path.join(this.experimentDir, 'cells', safeRunDir(runId));
    if (!fs.existsSync(cellDir)) return [];
    return fs.readdirSync(cellDir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && /^\d{6}-/.test(e.name))
      .map((e) => {
        const dir = path.join(cellDir, e.name);
        const start = readJsonStrict(path.join(dir, 'start.json'), 'attempt start');
        return { ...start, dir };
      })
      .sort((a, b) => a.attemptIndex - b.attemptIndex);
  }

  /** Terminally disposed cells whose checkpoint projection never committed. */
  incompleteTerminalRunIds() {
    const cellsRoot = path.join(this.experimentDir, 'cells');
    if (!fs.existsSync(cellsRoot)) return [];
    const terminalReasons = new Set(['session_limit_pause', 'runtime_violations',
      'missing_init_before_manifest', 'grader_exception', 'checkpoint_exception']);
    const blocked = [];
    for (const cell of fs.readdirSync(cellsRoot, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const cellDir = path.join(cellsRoot, cell.name);
      for (const entry of fs.readdirSync(cellDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
        const dir = path.join(cellDir, entry.name);
        const start = readJsonStrict(path.join(dir, 'start.json'), 'attempt start');
        const dispositions = fs.readdirSync(dir).filter((f) => f.startsWith('disposition-'))
          .map((f) => readJsonStrict(path.join(dir, f), 'disposition'));
        if (dispositions.some((r) => r.reason === 'checkpoint_committed')) continue;
        if (dispositions.some((r) => terminalReasons.has(r.reason))) blocked.push(start.runId);
      }
    }
    return [...new Set(blocked)].sort();
  }

  beginAttempt({ runId, scenarioId, armId, repIndex, seed }) {
    const prior = this.attemptsFor(runId);
    const attemptIndex = prior.length ? prior.at(-1).attemptIndex + 1 : 0;
    const attemptId = this.uuid();
    const dir = path.join(this.experimentDir, 'cells', safeRunDir(runId), `${String(attemptIndex).padStart(6, '0')}-${attemptId}`);
    const start = {
      version: ATTEMPT_STORE_VERSION,
      stage: 'start',
      recordedAt: this.now().toISOString(),
      experimentId: this.experimentId,
      runId, attemptId, attemptIndex, scenarioId, armId, repIndex, seed,
      state: { execution: 'interrupted_unknown', termination: 'unknown', measurement: 'unknown', runtime: 'not_checked', grading: 'not_attempted', scheduler: 'selected' },
    };
    writeImmutableJson(stagePath({ dir }, 'start'), start);
    return { ...start, dir };
  }

  recordArtifact(attempt, { artifact, execution, termination, measurement }) {
    assertEnum('execution', execution, EXECUTION);
    assertEnum('termination', termination, TERMINATION);
    assertEnum('measurement', measurement, MEASUREMENT);
    return writeImmutableJson(stagePath(attempt, 'artifact'), {
      version: ATTEMPT_STORE_VERSION,
      stage: 'artifact',
      recordedAt: this.now().toISOString(),
      experimentId: this.experimentId,
      runId: attempt.runId,
      attemptId: attempt.attemptId,
      attemptIndex: attempt.attemptIndex,
      state: { execution, termination, measurement, runtime: 'not_checked', grading: 'not_attempted', scheduler: 'continue' },
      artifact,
    });
  }

  recordDisposition(attempt, { execution, termination, measurement, runtime, grading, scheduler, reason, details = null }) {
    assertEnum('execution', execution, EXECUTION);
    assertEnum('termination', termination, TERMINATION);
    assertEnum('measurement', measurement, MEASUREMENT);
    assertEnum('runtime', runtime, RUNTIME);
    assertEnum('grading', grading, GRADING);
    assertEnum('scheduler', scheduler, SCHEDULER);
    const recordId = this.uuid();
    return writeImmutableJson(path.join(attempt.dir, `disposition-${this.now().getTime()}-${recordId}.json`), {
      version: ATTEMPT_STORE_VERSION,
      stage: 'disposition',
      recordId,
      recordedAt: this.now().toISOString(),
      experimentId: this.experimentId,
      runId: attempt.runId,
      attemptId: attempt.attemptId,
      attemptIndex: attempt.attemptIndex,
      state: { execution, termination, measurement, runtime, grading, scheduler },
      reason,
      details,
    });
  }

  recoverInterruptedAttempts() {
    const cells = path.join(this.experimentDir, 'cells');
    if (!fs.existsSync(cells)) return [];
    const recovered = [];
    for (const cell of fs.readdirSync(cells, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const cellDir = path.join(cells, cell.name);
      for (const entry of fs.readdirSync(cellDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
        const dir = path.join(cellDir, entry.name);
        const startPath = path.join(dir, 'start.json');
        const artifactPath = path.join(dir, 'artifact.json');
        if (!fs.existsSync(startPath)) continue;
        const attempt = { ...readJsonStrict(startPath, 'attempt start'), dir };
        const dispositions = fs.readdirSync(dir).filter((f) => f.startsWith('disposition-'))
          .map((f) => readJsonStrict(path.join(dir, f), 'disposition'));
        const already = dispositions.some((r) => r?.reason === 'recovered_after_interruption');
        if (already) continue;
        const committed = dispositions.some((r) => r?.reason === 'checkpoint_committed');
        const terminal = dispositions.some((r) => ['session_limit_pause', 'runtime_violations',
          'missing_init_before_manifest', 'grader_exception', 'checkpoint_exception'].includes(r?.reason));
        // A complete attempt has an immutable post-projection marker.  If an
        // artifact exists but that marker does not, the process may have died
        // between adapter/grader/checkpoint; leave the checkpoint projection
        // untouched and make the retry explicit in the journal.
        if (fs.existsSync(artifactPath) && (committed || terminal)) continue;
        this.recordDisposition(attempt, {
          execution: 'interrupted_unknown', termination: 'unknown', measurement: 'unknown',
          runtime: 'not_checked', grading: 'not_attempted', scheduler: 'retry',
          reason: 'recovered_after_interruption',
        });
        recovered.push(attempt);
      }
    }
    return recovered;
  }
}

export function classifyArtifact(artifact, { adapterException = false } = {}) {
  const err = String(artifact?.error ?? '');
  const subtype = String(artifact?.control?.resultSubtype ?? '');
  let termination = 'completed';
  if (/error_max_turns/i.test(subtype) || /max.?turn|turn.?limit/i.test(err)) termination = 'budget_exhausted';
  else if (/session limit|usage limit|weekly limit|hit your limit|limit.*reset/i.test(err)) termination = 'session_limit';
  else if (/rate.?limit|429|overloaded|too many requests|try again/i.test(err)) termination = 'rate_limit';
  else if (/auth|not logged in|authentication/i.test(err)) termination = 'auth';
  else if (/timed?\s*out|timeout/i.test(err)) termination = 'timeout';
  else if (/api_error/i.test(err) || subtype === 'api_error') termination = 'api_error';
  else if (err) termination = adapterException ? 'process_error' : 'unknown';
  return {
    execution: adapterException ? 'adapter_exception' : 'returned',
    termination,
    measurement: adapterException ? 'unknown' : (artifact?.captureError ? 'failed' : (artifact ? 'valid' : 'unknown')),
  };
}
