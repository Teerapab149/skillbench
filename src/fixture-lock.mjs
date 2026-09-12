/**
 * fixture-lock.mjs — cross-process ownership for destructive fixture users.
 *
 * The lock is a directory, not a file. A prospective owner writes owner.json in
 * a private staging directory and publishes the complete directory with one
 * atomic rename. Removing an owner is also a rename, always to the same
 * owner-token-derived retirement path. The retired directory is deliberately
 * retained as an immutable tombstone.
 *
 * That tombstone is the compare-and-remove operation Node does not otherwise
 * provide portably: if a lagging reclaimer observes owner A, another process
 * retires A, and owner B is published, the lagging rename still targets A's
 * already non-empty tombstone. It fails instead of moving B. There is no
 * breaker mutex to be stranded when a reclaimer is killed.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

/** Distinguishes fixture contention from other failures for calling scripts. */
export const EXIT_LOCK_BUSY = 4;

const LOCK_ROOT = path.join(os.tmpdir(), 'skillbench-fixture-locks-v2');
const OWNER_FILE = 'owner.json';
const LOCK_SCHEMA = 2;
const MODULE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class FixtureLockBusyError extends Error {
  constructor (message, holder) {
    super(message);
    this.name = 'FixtureLockBusyError';
    this.code = 'FIXTURE_LOCK_BUSY';
    this.holder = holder;
  }
}

function sha256 (value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalFixtureIdentity (fixtureDir) {
  const requested = path.resolve(fixtureDir);
  const real = (fs.realpathSync.native ?? fs.realpathSync)(requested);
  const stat = fs.statSync(real, { bigint: true });
  const canonicalPath = process.platform === 'win32' ? real.toLowerCase() : real;
  return {
    requested,
    realPath: real,
    canonicalPath,
    dev: String(stat.dev),
    ino: String(stat.ino),
  };
}

function sameFixtureIdentity (a, b) {
  return Boolean(a && b &&
    a.canonicalPath === b.canonicalPath &&
    String(a.dev) === String(b.dev) &&
    String(a.ino) === String(b.ino));
}

/**
 * Derive the lock from the fixture's real disk identity, not from this module's
 * checkout. Imports from two SkillBench worktrees therefore coordinate when
 * they are handed the same fixture (including through a symlink/junction).
 */
export function lockPathFor (fixtureDir) {
  const identity = canonicalFixtureIdentity(fixtureDir);
  const slug = path.basename(identity.realPath).replace(/[^A-Za-z0-9._-]/g, '_');
  const key = sha256(`${identity.canonicalPath}\0${identity.dev}\0${identity.ino}`).slice(0, 24);
  return path.join(LOCK_ROOT, `${slug}-${key}.lock`);
}

/** Exact lock path used before schema v2, relative to this module checkout. */
export function legacyLockPathFor (fixtureDir) {
  const abs = path.resolve(fixtureDir);
  const slug = path.basename(abs).replace(/[^A-Za-z0-9._-]/g, '_');
  const key = sha256(abs.toLowerCase()).slice(0, 8);
  return path.join(MODULE_ROOT, '.locks', `${slug}-${key}.lock`);
}

function pidAlive (pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (e) { return e.code === 'EPERM'; }
}

function readPublishedLock (lockPath, io = fs) {
  let lockStat;
  try { lockStat = io.lstatSync(lockPath, { bigint: true }); }
  catch (e) {
    if (e.code === 'ENOENT') return null;
    throw new Error(`อ่านสถานะ fixture lock ไม่ได้: ${lockPath}: ${e.message}`, { cause: e });
  }

  if (!lockStat.isDirectory()) {
    let raw = '';
    try { raw = io.readFileSync(lockPath, 'utf8'); } catch { /* report below */ }
    let info = null;
    try { info = JSON.parse(raw); } catch { /* legacy/corrupt */ }
    return {
      format: 'legacy-file', info, raw,
      ownerKey: sha256(`legacy\0${raw}\0${lockStat.dev}\0${lockStat.ino}`),
      diskKey: `${lockStat.dev}:${lockStat.ino}:${lockStat.birthtimeNs}`,
      mtimeMs: Number(lockStat.mtimeMs),
    };
  }

  let raw = '';
  try { raw = io.readFileSync(path.join(lockPath, OWNER_FILE), 'utf8'); } catch { /* malformed */ }
  let info = null;
  try { info = JSON.parse(raw); } catch { /* malformed */ }
  const validToken = typeof info?.token === 'string' && UUID_RE.test(info.token);
  return {
    format: 'directory', info, raw,
    ownerKey: validToken
      ? sha256(`owner-token\0${info.token}`)
      : sha256(`malformed\0${raw}\0${lockStat.dev}\0${lockStat.ino}\0${lockStat.birthtimeNs}`),
    diskKey: `${lockStat.dev}:${lockStat.ino}:${lockStat.birthtimeNs}`,
    mtimeMs: Number(lockStat.mtimeMs),
  };
}

function snapshotMatches (current, expected) {
  return Boolean(current && expected &&
    current.format === expected.format &&
    current.ownerKey === expected.ownerKey &&
    current.diskKey === expected.diskKey);
}

/** Return the current disk owner, or null when the fixture is unlocked. */
export function inspectLock (fixtureDir, { _lockFs = fs } = {}) {
  const fixtureIdentity = canonicalFixtureIdentity(fixtureDir);
  const legacyPath = legacyLockPathFor(fixtureDir);
  const legacy = readPublishedLock(legacyPath, _lockFs);
  if (legacy) {
    const parsedStart = Date.parse(legacy.info?.startedAt ?? '');
    const ageMs = Date.now() - (Number.isFinite(parsedStart) ? parsedStart : legacy.mtimeMs);
    return {
      lockPath: legacyPath,
      fixtureIdentity,
      ...legacy,
      format: 'legacy-file',
      legacyLocation: true,
      ageMs,
      identityValid: false,
      alive: null,
      stale: false,
      reason: 'พบล็อก schema ก่อน v2 — ต้องหยุด SkillBench รุ่นเก่าทุก process แล้วเอาล็อกเก่าออกใน maintenance window',
    };
  }
  const lockPath = lockPathFor(fixtureDir);
  const cur = readPublishedLock(lockPath, _lockFs);
  if (!cur) return null;

  const info = cur.info;
  const parsedStart = Date.parse(info?.startedAt ?? '');
  const ageMs = Date.now() - (Number.isFinite(parsedStart) ? parsedStart : cur.mtimeMs);
  const identityValid = info?.schema === LOCK_SCHEMA && sameFixtureIdentity(info.fixtureIdentity, fixtureIdentity);
  const base = { lockPath, fixtureIdentity, ...cur, ageMs, identityValid };

  if (cur.format !== 'directory') {
    return { ...base, alive: null, stale: false,
      reason: 'พบล็อกไฟล์รูปแบบเก่า — ปฏิเสธแบบ fail-closed เพราะย้ายแบบตรวจเจ้าของไม่ได้อย่าง atomic' };
  }
  if (!identityValid || !Number.isInteger(info?.pid) || typeof info?.token !== 'string' || !UUID_RE.test(info.token)) {
    return { ...base, alive: null, stale: false,
      reason: 'ข้อมูลเจ้าของ/identity บนดิสก์ไม่สมบูรณ์ — ปฏิเสธแบบ fail-closed' };
  }
  if (info.hostname !== os.hostname()) {
    return { ...base, alive: null, stale: false,
      reason: `ล็อกมาจากเครื่อง ${info.hostname} ตรวจ pid ข้ามเครื่องไม่ได้` };
  }
  const alive = pidAlive(info.pid);
  return { ...base, alive, stale: !alive,
    reason: alive ? `pid ${info.pid} ยังทำงานอยู่` : `pid ${info.pid} ตายไปแล้ว` };
}

function describeHolder (h) {
  const started = h.info?.startedAt ?? '(ไม่ทราบ)';
  const mins = Number.isFinite(h.ageMs) ? (h.ageMs / 60000).toFixed(1) : '?';
  return [
    `   ถือโดย : ${h.info?.owner ?? '(ไม่ทราบ)'}  pid ${h.info?.pid ?? '?'} บนเครื่อง ${h.info?.hostname ?? '?'}`,
    `   เริ่ม  : ${started}  (${mins} นาทีที่แล้ว)`,
    h.info?.command ? `   คำสั่ง : ${h.info.command}` : null,
    `   สถานะ : ${h.reason}`,
  ].filter(Boolean).join('\n');
}

function retirementPathFor (lockPath, snapshot) {
  return `${lockPath}.retired-${snapshot.ownerKey.slice(0, 32)}`;
}

function invokeHook (hook, phase, details = {}) {
  if (hook) hook(phase, details);
}

/** Atomically retire exactly the owner represented by snapshot. */
function retireObservedOwner (snapshot, { hook = null, allowMalformed = false } = {}) {
  if (snapshot.format !== 'directory') {
    return { retired: false, reason: 'ล็อกไฟล์รูปแบบเก่าแกะอย่างปลอดภัยอัตโนมัติไม่ได้' };
  }

  const lockPath = snapshot.lockPath;
  let current = readPublishedLock(lockPath);
  if (!snapshotMatches(current, snapshot)) {
    return { retired: false, reason: 'เจ้าของเปลี่ยนไประหว่างตรวจ — fail closed และไม่แตะล็อกปัจจุบัน' };
  }

  // A force-break may retire a malformed/empty directory. Add a deterministic
  // non-empty anchor so its tombstone cannot be replaced by a lagging rename.
  if (!snapshot.identityValid && allowMalformed) {
    const anchor = path.join(lockPath, `.retirement-anchor-${snapshot.ownerKey.slice(0, 16)}`);
    try { fs.writeFileSync(anchor, snapshot.ownerKey, { flag: 'wx' }); }
    catch (e) {
      if (e.code !== 'EEXIST') return { retired: false, reason: `สร้าง retirement anchor ไม่ได้: ${e.message}` };
    }
  }

  invokeHook(hook, 'before-retire', { lockPath, ownerKey: snapshot.ownerKey });
  current = readPublishedLock(lockPath);
  if (!snapshotMatches(current, snapshot)) {
    return { retired: false, reason: 'เจ้าของเปลี่ยนไประหว่างตรวจ — fail closed และไม่แตะล็อกปัจจุบัน' };
  }

  const retiredPath = retirementPathFor(lockPath, snapshot);
  invokeHook(hook, 'before-retire-rename', { lockPath, retiredPath, ownerKey: snapshot.ownerKey });
  try {
    fs.renameSync(lockPath, retiredPath);
  } catch (e) {
    // Error codes differ across Windows/POSIX and do not prove which object is
    // currently published. Observe both paths and stop; this invocation never
    // retries the snapshot that just failed.
    const observedCurrent = readPublishedLock(lockPath);
    const observedTombstone = readPublishedLock(retiredPath);
    const state = observedCurrent
      ? (snapshotMatches(observedCurrent, snapshot) ? 'เจ้าของเดิมยังอยู่' : 'มีเจ้าของอื่นมาแทนแล้ว')
      : (observedTombstone && snapshotMatches(observedTombstone, snapshot)
          ? 'เจ้าของเดิมอยู่ใน tombstone แล้ว'
          : 'ยืนยันตำแหน่งเจ้าของเดิมไม่ได้');
    return {
      retired: false,
      observedCurrent,
      observedTombstone,
      reason: `rename retirement ไม่สำเร็จ (${e.code ?? e.message}); ${state} — fail closed และไม่แตะต่อ`,
    };
  }
  invokeHook(hook, 'after-retire', { lockPath, retiredPath, ownerKey: snapshot.ownerKey });
  return { retired: true, retiredPath };
}

function tryPublish (lockPath, payload, hook) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  // Never ask rename to decide whether an ownership object exists. On POSIX,
  // a rename onto an existing empty directory may replace it, which would turn
  // malformed/corrupt state into an apparently successful acquisition.
  const observed = readPublishedLock(lockPath);
  if (observed) {
    return { published: false, observedCurrent: observed, reason: 'มี ownership object อยู่ก่อน publish' };
  }
  const staging = `${lockPath}.pending-${payload.token}`;
  fs.mkdirSync(staging);
  try {
    fs.writeFileSync(path.join(staging, OWNER_FILE), JSON.stringify(payload, null, 2), { flag: 'wx' });
    invokeHook(hook, 'after-stage', { lockPath, staging });
    try { fs.renameSync(staging, lockPath); }
    catch (e) {
      const observedCurrent = readPublishedLock(lockPath);
      if (!observedCurrent) {
        throw new Error(
          `publish fixture lock ไม่สำเร็จ (${e.code ?? e.message}) และตรวจไม่พบ owner ปัจจุบัน — fail closed`,
          { cause: e });
      }
      return { published: false, observedCurrent, reason: `มี ownership object อยู่ (${e.code ?? e.message})` };
    }
    invokeHook(hook, 'after-publish', { lockPath });
    return { published: true };
  } finally {
    // Only our UUID staging path is removed; a killed process leaves it harmless.
    try { fs.rmSync(staging, { recursive: true }); } catch { /* published or already absent */ }
  }
}

/* Same-process nesting: runner owns the outer level, adapter owns inner runs. */
const held = new Map(); // lockPath -> { depth, token, snapshot }

function diskStillOwned (entry) {
  const current = readPublishedLock(entry.snapshot.lockPath);
  return snapshotMatches(current, entry.snapshot) &&
    current?.info?.schema === LOCK_SCHEMA &&
    UUID_RE.test(current.info.token) &&
    current.info.token === entry.token &&
    sameFixtureIdentity(current.info.fixtureIdentity, entry.snapshot.info.fixtureIdentity);
}

function releaseHeldLock (lockPath, token) {
  const entry = held.get(lockPath);
  if (!entry || entry.token !== token) return;
  if (--entry.depth > 0) return;
  held.delete(lockPath);
  if (diskStillOwned(entry)) retireObservedOwner(entry.snapshot);
}

let exitHookInstalled = false;
function installExitHook () {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.on('exit', () => {
    for (const [lockPath, entry] of held) {
      if (diskStillOwned(entry)) retireObservedOwner(entry.snapshot);
      held.delete(lockPath);
    }
  });
}

/**
 * Acquire a fixture and return an idempotent release function.
 * `_testHook` is a narrow failure-injection seam for subprocess crash tests.
 */
export function acquireFixtureLock (fixtureDir, { owner = 'unknown', command = null, _testHook = null } = {}) {
  const fixtureIdentity = canonicalFixtureIdentity(fixtureDir);
  const lockPath = lockPathFor(fixtureDir);

  const rejectLegacyLock = () => {
    if (!readPublishedLock(legacyLockPathFor(fixtureDir))) return;
    const holder = inspectLock(fixtureDir);
    throw new FixtureLockBusyError(
      `fixture มีล็อก schema ก่อน v2: ${fixtureIdentity.realPath}\n`
      + (holder ? describeHolder(holder) : '   ล็อกเก่าเปลี่ยนไประหว่างตรวจ — fail closed'),
      holder);
  };
  rejectLegacyLock();

  const mine = held.get(lockPath);
  if (mine && diskStillOwned(mine)) {
    mine.depth++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      releaseHeldLock(lockPath, mine.token);
    };
  }
  if (mine) held.delete(lockPath);

  const token = crypto.randomUUID();
  const payload = {
    schema: LOCK_SCHEMA,
    token,
    owner,
    pid: process.pid,
    hostname: os.hostname(),
    startedAt: new Date().toISOString(),
    fixture: fixtureIdentity.realPath,
    fixtureIdentity,
    command: command ?? process.argv.slice(1).join(' '),
  };

  for (let attempt = 0; attempt < 8; attempt++) {
    // This closes the normal rolling-upgrade window for a legacy lock already
    // present. Old code cannot see v2, so starting old code later remains an
    // explicit offline-upgrade boundary documented in FIXTURE-LOCK.md.
    rejectLegacyLock();
    const publish = tryPublish(lockPath, payload, _testHook);
    if (publish.published) {
      const snapshot = { lockPath, ...readPublishedLock(lockPath), identityValid: true };
      if (snapshot.info?.token !== token) continue;
      installExitHook();
      held.set(lockPath, { depth: 1, token, snapshot });
      let released = false;
      return () => {
        if (released) return;
        released = true;
        releaseHeldLock(lockPath, token);
      };
    }

    const holder = inspectLock(fixtureDir);
    if (!holder) {
      throw new FixtureLockBusyError(
        `สถานะ fixture เปลี่ยนหลัง publish ล้ม — fail closed และไม่ลอง snapshot เดิมซ้ำ: ${fixtureIdentity.realPath}`,
        null);
    }
    if (!holder.stale) {
      throw new FixtureLockBusyError(
        `fixture ถูกใช้งานอยู่: ${fixtureIdentity.realPath}\n${describeHolder(holder)}`, holder);
    }
    const retired = retireObservedOwner(holder, { hook: _testHook });
    if (!retired.retired) {
      // Another reclaimer may have won the conditional rename. Re-enter the
      // acquire loop and observe the current disk state; never retry the old
      // snapshot or report a transient race as a live-owner contention.
      // Windows can report EPERM while a competing process is finishing its
      // directory operation; a short process-local jitter prevents all
      // reclaimers from retrying in lockstep while retaining the fail-closed
      // observation rule above.
      const delay = 5 + ((process.pid + attempt * 17) % 23);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
      continue;
    }
  }

  const holder = inspectLock(fixtureDir);
  throw new FixtureLockBusyError(
    `ยึดล็อก fixture ไม่สำเร็จหลังพยายาม 8 ครั้ง: ${fixtureIdentity.realPath}`
    + (holder ? `\n${describeHolder(holder)}` : ''), holder);
}

/** Hold the fixture across a synchronous or asynchronous callback. */
export async function withFixtureLock (fixtureDir, owner, fn) {
  const release = acquireFixtureLock(fixtureDir, { owner });
  try { return await fn(); } finally { release(); }
}

/** True only when this process still owns the matching token on disk. */
export function isFixtureLockHeld (fixtureDir) {
  const lockPath = lockPathFor(fixtureDir);
  const entry = held.get(lockPath);
  return Boolean(entry && entry.depth > 0 && diskStillOwned(entry));
}

/** Fail closed before code mutates a fixture without real disk ownership. */
export function assertFixtureLockHeld (fixtureDir, what = 'การแก้ fixture') {
  if (isFixtureLockHeld(fixtureDir)) return;
  const holder = inspectLock(fixtureDir);
  throw new Error(
    `${what} ต้องถือล็อก fixture ก่อน: ${canonicalFixtureIdentity(fixtureDir).realPath}\n`
    + (holder ? `${describeHolder(holder)}\n` : '   ตอนนี้ยังไม่มีใครถือ\n')
    + '   แก้ด้วยการครอบด้วย withFixtureLock(fixtureDir, ชื่อเครื่องมือ, ...) จาก src/fixture-lock.mjs');
}

/** Acquire for a whole CLI process, reporting contention with exit code 4. */
export function lockFixtureForProcess (fixtureDir, owner) {
  try {
    const release = acquireFixtureLock(fixtureDir, { owner });
    process.on('exit', release);
    return release;
  } catch (e) {
    if (e.code !== 'FIXTURE_LOCK_BUSY') throw e;
    console.error(`\n⛔ ${owner} ถูกปฏิเสธ — มีเครื่องมืออื่นกำลังใช้ fixture อยู่\n`);
    console.error(e.message.split('\n').slice(1).join('\n'));
    console.error('');
    console.error('   เครื่องมือนี้สั่ง git reset/checkout/clean ลง fixture ถ้ารันทับกัน');
    console.error('   งานของอีกฝั่งจะถูกลบทิ้งกลางคัน แล้ว run นั้นจะถูกให้คะแนนว่า "ไม่ทำอะไรเลย"');
    console.error('');
    console.error('   รอให้ตัวที่ถืออยู่ทำงานจบก่อน');
    console.error('   ถ้าแน่ใจว่ามันตายไปแล้ว: node scripts/fixture-lock.mjs --break');
    console.error('');
    process.exit(EXIT_LOCK_BUSY);
  }
}

/**
 * Manual break uses the same owner-bound retirement as automatic stale
 * recovery. Force bypasses liveness, never the token/identity race check.
 */
export function breakLock (fixtureDir, { force = false, _testHook = null } = {}) {
  const holder = inspectLock(fixtureDir);
  if (!holder) return { broken: false, reason: 'ไม่มีล็อกอยู่', holder: null };
  if (!holder.stale && !force) return { broken: false, reason: holder.reason, holder };
  if (holder.format !== 'directory') return { broken: false, reason: holder.reason, holder };
  const result = retireObservedOwner(holder, { hook: _testHook, allowMalformed: force });
  return {
    broken: result.retired,
    reason: result.retired ? holder.reason : result.reason,
    holder,
    retiredPath: result.retiredPath,
  };
}
