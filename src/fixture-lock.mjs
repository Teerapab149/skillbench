/**
 * fixture-lock.mjs — ล็อกข้ามโปรเซสสำหรับ workspace ที่ใช้รันจริง
 *
 * ปัญหาที่แก้ (reproduce ได้ ไม่ใช่ความกังวลลอย ๆ):
 *   เครื่องมือหลายตัวใช้ `fixtures/gpu-booking` โฟลเดอร์เดียวกัน และทุกตัว "ล้าง"
 *   มันด้วย git reset --hard / checkout -- . / clean -fd ก่อนเริ่มงานของตัวเอง
 *   รันพร้อมกันสองตัวเมื่อไร ตัวหลังจะลบงานของตัวแรกทิ้งกลางคัน
 *
 *   วัดจริงด้วยสคริปต์สองตัวยิงพร้อมกันบน repo ทดลอง:
 *     runner เขียนไฟล์ลง workspace -> checker สั่ง clean -> runner อ่านกลับมาได้ศูนย์ไฟล์
 *     git status ว่างเปล่า ไม่มี error ไม่มี exit code ที่ผิด
 *   run นั้นจะถูกให้คะแนนว่า "เอเจนต์เลือกที่จะไม่ทำอะไรเลย" โดยไม่มีใครรู้ว่าเพราะอะไร
 *   ซึ่งเป็นข้อมูลที่ผิดแบบเงียบ — อันตรายกว่าการรันพังเสียอีก
 *
 * ทำไม collection-guard.mjs ยังไม่พอ:
 *   มันอ่าน mtime ของ checkpoint แล้ว "เดา" ว่ามีการเก็บข้อมูลเดินอยู่ไหม
 *   เป็นการตรวจสถานะ ไม่ใช่การกันชน — มีช่องว่างระหว่างตรวจกับลงมือเสมอ
 *   และมันไม่เห็นเครื่องมือด้วยกันเองเลย (check กับ check:acceptance ชนกันได้เต็ม ๆ
 *   เพราะไม่มีตัวไหนเขียน checkpoint) ไฟล์นี้จึงกันด้วยการยึดจริง ไม่ใช่การเดา
 *
 * หลักการที่ยึด:
 *   1. ยึดได้ทีละหนึ่งเท่านั้น ใช้การสร้างไฟล์แบบ exclusive (wx) ซึ่ง atomic ทั้ง
 *      Windows และ POSIX — ไม่ใช่ "อ่านแล้วค่อยเขียน" ที่มีช่องว่างตรงกลาง
 *   2. ยึดไม่ได้ = ล้มทันทีพร้อมบอกว่าใครถือ ห้ามรอเงียบ ๆ
 *      การรอทำให้คนสั่งเข้าใจว่างานค้าง แล้วไปกด Ctrl-C ตัวที่กำลังเก็บข้อมูลอยู่
 *   3. ล็อกค้างจากโปรเซสที่ตายแล้ว ต้องแกะได้ แต่ **ห้ามแตะล็อกของโปรเซสที่ยังอยู่**
 *      ตรวจด้วย pid จริง ไม่ใช่ด้วยเวลา เพราะการเก็บข้อมูลจริงกินเวลาหลายชั่วโมง
 *      timeout อะไรก็ตามที่เดาไว้ จะกลายเป็นตัวลบล็อกของ run ที่ยังทำงานอยู่
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** exit code เฉพาะของ "ยึดไม่ได้เพราะมีคนถืออยู่" — แยกจาก error อื่นเพื่อให้สคริปต์ภายนอกแยกออก */
export const EXIT_LOCK_BUSY = 4;

/**
 * ล็อกที่หาเจ้าของไม่ได้ (ไฟล์เสีย/มาจากเครื่องอื่น) ถือว่าค้างได้เมื่อเก่ากว่านี้
 * ใช้เฉพาะกรณีที่ตรวจ pid ไม่ได้จริง ๆ เท่านั้น — เส้นทางปกติตัดสินด้วย pid
 */
const UNVERIFIABLE_STALE_MS = 12 * 60 * 60 * 1000;

export class FixtureLockBusyError extends Error {
  constructor (message, holder) {
    super(message);
    this.name = 'FixtureLockBusyError';
    this.code = 'FIXTURE_LOCK_BUSY';
    this.holder = holder;
  }
}

/** ล็อกอยู่นอก fixture เสมอ — ถ้าวางไว้ข้างใน `git clean -fd` ของตัวที่ถืออยู่จะลบล็อกตัวเองทิ้ง */
export function lockPathFor (fixtureDir) {
  const abs = path.resolve(fixtureDir);
  const slug = path.basename(abs).replace(/[^A-Za-z0-9._-]/g, '_');
  const hash = crypto.createHash('sha256').update(abs.toLowerCase()).digest('hex').slice(0, 8);
  return path.join(ROOT, '.locks', `${slug}-${hash}.lock`);
}

function pidAlive (pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (e) { return e.code === 'EPERM'; }   // มีอยู่แต่เราไม่มีสิทธิ์ส่งสัญญาณ = ยังอยู่
}

function readLockFile (lockPath) {
  let raw, stat;
  try { raw = fs.readFileSync(lockPath, 'utf8'); stat = fs.statSync(lockPath); }
  catch { return null; }
  let info = null;
  try { info = JSON.parse(raw); } catch { /* เขียนค้างกลางทาง หรือไฟล์เสีย */ }
  return { info, mtimeMs: stat.mtimeMs, raw };
}

/**
 * ใครถืออยู่ตอนนี้ — คืน null ถ้าว่าง
 * `stale` = แกะทิ้งได้ · `reason` = เหตุผลที่ตัดสินอย่างนั้น (เอาไปพิมพ์ให้คนอ่าน)
 */
export function inspectLock (fixtureDir) {
  const lockPath = lockPathFor(fixtureDir);
  const cur = readLockFile(lockPath);
  if (!cur) return null;

  const info = cur.info;
  const ageMs = Date.now() - (info?.startedAt ? Date.parse(info.startedAt) : cur.mtimeMs);

  if (!info || !Number.isInteger(info.pid)) {
    return { lockPath, info, ageMs, alive: null, stale: ageMs > UNVERIFIABLE_STALE_MS,
             reason: 'ไฟล์ล็อกอ่านไม่ได้ ตรวจ pid ไม่ได้' };
  }
  if (info.hostname !== os.hostname()) {
    // pid ของเครื่องอื่นเช็คไม่ได้ และการเดาแทนคือการลบล็อกของงานที่อาจยังเดินอยู่
    return { lockPath, info, ageMs, alive: null, stale: false,
             reason: `ล็อกมาจากเครื่อง ${info.hostname} ตรวจ pid ข้ามเครื่องไม่ได้` };
  }
  const alive = pidAlive(info.pid);
  return { lockPath, info, ageMs, alive, stale: !alive,
           reason: alive ? `pid ${info.pid} ยังทำงานอยู่` : `pid ${info.pid} ตายไปแล้ว` };
}

function describeHolder (h) {
  const started = h.info?.startedAt ?? '(ไม่ทราบ)';
  const mins = (h.ageMs / 60000).toFixed(1);
  return [
    `   ถือโดย : ${h.info?.owner ?? '(ไม่ทราบ)'}  pid ${h.info?.pid ?? '?'} บนเครื่อง ${h.info?.hostname ?? '?'}`,
    `   เริ่ม  : ${started}  (${mins} นาทีที่แล้ว)`,
    h.info?.command ? `   คำสั่ง : ${h.info.command}` : null,
    `   สถานะ : ${h.reason}`,
  ].filter(Boolean).join('\n');
}

/*
 * นับชั้นการยึดซ้ำในโปรเซสเดียวกัน
 *
 * จำเป็นเพราะ runner ตั้งใจให้ถือล็อกคลุมทั้งรอบการเก็บข้อมูล ขณะที่ adapter
 * ยึดซ้ำอีกชั้นรอบ run แต่ละอัน ถ้าไม่นับชั้น adapter จะฟ้องว่าตัวเองชนกับตัวเอง
 * และถ้า release ชั้นในไปปลดล็อกจริง จะเปิดช่องให้เครื่องมืออื่นแทรกกลางรอบเก็บข้อมูล
 */
const held = new Map();   // lockPath -> { depth, token }

let exitHookInstalled = false;
function installExitHook () {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.on('exit', () => {
    for (const [lockPath, entry] of held) {
      try {
        const cur = readLockFile(lockPath);
        if (cur?.info?.token === entry.token) fs.unlinkSync(lockPath);
      } catch { /* ปิดเงียบตอน exit */ }
    }
    held.clear();
  });
}

function tryCreate (lockPath, payload) {
  let fd;
  try { fd = fs.openSync(lockPath, 'wx'); }
  catch (e) { if (e.code === 'EEXIST') return false; throw e; }
  try { fs.writeFileSync(fd, JSON.stringify(payload, null, 2)); } finally { fs.closeSync(fd); }
  return true;
}

/**
 * ยึดล็อกของ fixture — คืนฟังก์ชันปลดล็อก
 * ยึดไม่ได้ => โยน FixtureLockBusyError ทันที ไม่มีการรอ
 */
export function acquireFixtureLock (fixtureDir, { owner = 'unknown', command = null } = {}) {
  const lockPath = lockPathFor(fixtureDir);

  const mine = held.get(lockPath);
  if (mine) {
    mine.depth++;
    let released = false;
    return () => { if (released) return; released = true; mine.depth--; };
  }

  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const token = crypto.randomUUID();
  const payload = {
    token,
    owner,
    pid: process.pid,
    hostname: os.hostname(),
    startedAt: new Date().toISOString(),
    fixture: path.resolve(fixtureDir),
    command: command ?? process.argv.slice(1).join(' '),
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    if (tryCreate(lockPath, payload)) {
      installExitHook();
      held.set(lockPath, { depth: 1, token });
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const entry = held.get(lockPath);
        if (!entry) return;
        if (--entry.depth > 0) return;
        held.delete(lockPath);
        // ปลดเฉพาะล็อกของเราเอง — ถ้า token ไม่ตรงแปลว่าโดนแกะไปแล้วและมีคนอื่นถืออยู่
        try {
          const cur = readLockFile(lockPath);
          if (cur?.info?.token === token) fs.unlinkSync(lockPath);
        } catch { /* ไฟล์หายไปแล้วก็ถือว่าปลดแล้ว */ }
      };
    }

    const holder = inspectLock(fixtureDir);
    if (!holder) continue;                    // เจ้าของเพิ่งปล่อยพอดี ลองใหม่
    if (!holder.stale) {
      throw new FixtureLockBusyError(
        `fixture ถูกใช้งานอยู่: ${path.resolve(fixtureDir)}\n${describeHolder(holder)}`, holder);
    }

    /*
     * แกะล็อกค้างด้วยการ "เปลี่ยนชื่อ" ไม่ใช่ลบตรง ๆ
     * rename สำเร็จได้แค่รายเดียวเมื่อหลายโปรเซสแกะพร้อมกัน ตัวที่แพ้จะได้ ENOENT
     * แล้ววนไปสร้างใหม่ตามปกติ — ไม่มีทางที่สองตัวจะคิดว่าตัวเองยึดได้พร้อมกัน
     */
    const parked = `${lockPath}.stale-${token}`;
    try { fs.renameSync(lockPath, parked); fs.unlinkSync(parked); }
    catch { /* คนอื่นแกะไปก่อน วนไปลองสร้างใหม่ */ }
  }

  const holder = inspectLock(fixtureDir);
  throw new FixtureLockBusyError(
    `ยึดล็อก fixture ไม่สำเร็จหลังพยายาม 3 ครั้ง: ${path.resolve(fixtureDir)}`
    + (holder ? `\n${describeHolder(holder)}` : ''), holder);
}

/** ทำงานโดยถือล็อกไว้ตลอด แล้วปลดใน finally เสมอ — รองรับทั้ง sync และ async */
export async function withFixtureLock (fixtureDir, owner, fn) {
  const release = acquireFixtureLock(fixtureDir, { owner });
  try { return await fn(); } finally { release(); }
}

/** โปรเซสนี้ถือล็อกของ fixture นี้อยู่หรือไม่ */
export function isFixtureLockHeld (fixtureDir) {
  const entry = held.get(lockPathFor(fixtureDir));
  return Boolean(entry && entry.depth > 0);
}

/**
 * ด่านสำหรับโค้ดที่กำลังจะแก้ fixture — ไม่ถือล็อกให้หยุด
 *
 * ตั้งใจให้ล้มแรง ไม่ใช่เตือนแล้วทำต่อ: ทางเรียกที่ลืมยึดล็อกคือทางที่จะไปลบงาน
 * ของ run ที่กำลังเดินอยู่ ซึ่งเป็นความเสียหายที่มองไม่เห็นตอนเกิด
 */
export function assertFixtureLockHeld (fixtureDir, what = 'การแก้ fixture') {
  if (isFixtureLockHeld(fixtureDir)) return;
  const holder = inspectLock(fixtureDir);
  throw new Error(
    `${what} ต้องถือล็อก fixture ก่อน: ${path.resolve(fixtureDir)}\n`
    + (holder ? `${describeHolder(holder)}\n` : '   ตอนนี้ยังไม่มีใครถือ\n')
    + '   แก้ด้วยการครอบด้วย withFixtureLock(fixtureDir, ชื่อเครื่องมือ, ...) จาก src/fixture-lock.mjs');
}

/**
 * ใช้ที่ต้นสคริปต์ที่แตะ fixture — ยึดล็อกคลุมทั้งโปรเซส
 * ยึดไม่ได้ให้พิมพ์ว่าใครถือแล้วออกด้วย EXIT_LOCK_BUSY ทันที
 */
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
 * แกะล็อกด้วยมือ — ใช้เมื่อรู้ตัวว่าเจ้าของตายไปแล้วเท่านั้น
 * ปฏิเสธถ้า pid ยังทำงานอยู่ เว้นแต่สั่ง force ซึ่งต้องเป็นการตัดสินใจของคน
 */
export function breakLock (fixtureDir, { force = false } = {}) {
  const holder = inspectLock(fixtureDir);
  if (!holder) return { broken: false, reason: 'ไม่มีล็อกอยู่', holder: null };
  if (!holder.stale && !force) return { broken: false, reason: holder.reason, holder };
  fs.unlinkSync(holder.lockPath);
  return { broken: true, reason: holder.reason, holder };
}
