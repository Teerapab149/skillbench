import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import fs, {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  acquireFixtureLock, withFixtureLock, isFixtureLockHeld, assertFixtureLockHeld,
  inspectLock, breakLock, lockPathFor, EXIT_LOCK_BUSY,
} from '../src/fixture-lock.mjs'

/**
 * ล็อกนี้มีอยู่เพราะการชนกันเกิดขึ้นจริง ไม่ใช่เพราะกลัวว่าจะเกิด
 *
 * เทสแรกของไฟล์นี้จำลองการชนแบบไม่มีล็อก แล้วยืนยันว่างานหายไปเงียบ ๆ จริง
 * เทสถัดมายืนยันว่าพอมีล็อกแล้ว ตัวที่สองถูกปฏิเสธและงานของตัวแรกรอด
 *
 * ถ้าเทสแรกเลิกล้มเหลวเมื่อไร แปลว่าสมมติฐานที่ทำให้ต้องมีโมดูลนี้เปลี่ยนไปแล้ว
 * และต้องอ่านใหม่ทั้งไฟล์ ไม่ใช่ลบเทสทิ้ง
 */

const LOCK_MODULE = pathToFileURL(resolve(fileURLToPath(new URL('.', import.meta.url)), '..', 'src', 'fixture-lock.mjs')).href

const dirs = []
const disposableLockPaths = new Set()
function scratchFixture () {
  const dir = mkdtempSync(join(tmpdir(), 'fxlock-'))
  dirs.push(dir)
  const g = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  writeFileSync(join(dir, 'src.ts'), 'export const rate = 1\n')
  g('init', '-q', '.')
  g('config', 'core.autocrlf', 'false')
  g('add', '-A')
  g('-c', 'user.email=b@l', '-c', 'user.name=b', 'commit', '-qm', 'base')
  g('tag', 'skillbench-baseline')
  disposableLockPaths.add(lockPathFor(dir))
  return dir
}

process.on('exit', () => {
  for (const lockPath of disposableLockPaths) {
    try {
      for (const name of readdirSync(dirname(lockPath))) {
        if (name === basename(lockPath) || name.startsWith(`${basename(lockPath)}.`)) {
          rmSync(join(dirname(lockPath), name), { recursive: true, force: true })
        }
      }
    } catch { /* ปล่อย */ }
  }
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }) } catch { /* ปล่อย */ } }
})

/** เขียนสคริปต์ชั่วคราวแล้วรัน — ใช้จำลอง "อีกโปรเซสหนึ่ง" ของจริง */
function childScript (body) {
  const f = join(mkdtempSync(join(tmpdir(), 'fxlock-s-')), 'child.mjs')
  dirs.push(join(f, '..'))
  writeFileSync(f, body)
  return f
}

function childProcess (body, args) {
  const child = spawn(process.execPath, [childScript(body), ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
  child.output = ''
  child.errors = ''
  child.stdout.on('data', (d) => { child.output += d })
  child.stderr.on('data', (d) => { child.errors += d })
  return child
}

function waitForOutput (child, pattern, timeoutMs = 3000) {
  return new Promise((resolvePromise, reject) => {
    const timeout = setTimeout(() => reject(new Error(
      `รอ output ${pattern} ไม่ทัน; stdout=${child.output}; stderr=${child.errors}`)), timeoutMs)
    const check = () => {
      if (!pattern.test(child.output)) return
      clearTimeout(timeout)
      child.stdout.off('data', check)
      resolvePromise()
    }
    child.stdout.on('data', check)
    check()
  })
}

function waitForClose (child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode })
  }
  return new Promise((resolvePromise) => child.once('close', (code, signal) => resolvePromise({ code, signal })))
}

async function leaveDeadOwner (fx, owner = 'dead-owner') {
  const child = childProcess(`
import { acquireFixtureLock } from ${JSON.stringify(LOCK_MODULE)}
acquireFixtureLock(process.argv[2], { owner: process.argv[3] })
console.log('LOCKED')
setInterval(() => {}, 1000)
`, [fx, owner])
  await waitForOutput(child, /LOCKED/)
  const closed = waitForClose(child)
  child.kill('SIGKILL')
  await closed
  // Windows may immediately reuse a just-reaped PID for the next test child;
  // keep this synthetic stale record unambiguously dead so race tests exercise
  // retirement, not an incidental PID-reuse decision.
  const lockPath = lockPathFor(fx)
  const ownerPath = join(lockPath, 'owner.json')
  const record = JSON.parse(readFileSync(ownerPath, 'utf8'))
  record.pid = 2147483647
  writeFileSync(ownerPath, JSON.stringify(record, null, 2))
  return record.pid
}

const RUNNER_BODY = (locked) => `
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
${locked ? `import { acquireFixtureLock } from ${JSON.stringify(LOCK_MODULE)}` : ''}
const FX = process.argv[2]
const g = (a) => execFileSync('git', a, { cwd: FX, encoding: 'utf8', stdio: 'pipe' })
${locked ? "const release = acquireFixtureLock(FX, { owner: 'runner-under-test' })" : ''}
g(['reset', '--hard', '-q', 'skillbench-baseline']); g(['clean', '-fdq'])
fs.writeFileSync(FX + '/agent-work.ts', 'export const done = true\\n')
await new Promise((r) => setTimeout(r, 1200))
console.log(JSON.stringify({ role: 'runner', survived: fs.existsSync(FX + '/agent-work.ts') }))
${locked ? 'release()' : ''}
`

const CHECKER_BODY = (locked) => `
import { execFileSync } from 'node:child_process'
${locked ? `import { lockFixtureForProcess } from ${JSON.stringify(LOCK_MODULE)}` : ''}
const FX = process.argv[2]
${locked ? "lockFixtureForProcess(FX, 'checker-under-test')" : ''}
const g = (a) => execFileSync('git', a, { cwd: FX, encoding: 'utf8', stdio: 'pipe' })
g(['checkout', '--', '.']); g(['clean', '-fd'])
console.log(JSON.stringify({ role: 'checker', cleaned: true }))
`

/** ยิง runner แล้วยิง checker ตามหลัง — คืนผลของทั้งคู่ */
async function race (locked) {
  const fx = scratchFixture()
  const runner = childScript(RUNNER_BODY(locked))
  const checker = childScript(CHECKER_BODY(locked))

  let runnerOut = '', checkerOut = '', checkerErr = ''
  const runnerDone = new Promise((res) => {
    const p = spawn(process.execPath, [runner, fx], { stdio: ['ignore', 'pipe', 'pipe'] })
    p.stdout.on('data', (d) => { runnerOut += d })
    p.on('close', (code) => res(code))
  })
  await new Promise((r) => setTimeout(r, 400))
  const checkerDone = new Promise((res) => {
    const p = spawn(process.execPath, [checker, fx], { stdio: ['ignore', 'pipe', 'pipe'] })
    p.stdout.on('data', (d) => { checkerOut += d })
    p.stderr.on('data', (d) => { checkerErr += d })
    p.on('close', (code) => res(code))
  })
  const [, checkerCode] = await Promise.all([runnerDone, checkerDone])
  return { fx, runner: JSON.parse(runnerOut.trim() || '{}'), checkerCode, checkerOut, checkerErr }
}

test('ไม่มีล็อก: เครื่องมือตัวที่สองลบงานของ run ที่กำลังเดินอยู่ทิ้ง โดยไม่มี error', async (t) => {
  t.diagnostic('นี่คือพฤติกรรมของ git ล้วน ๆ ไม่ใช่บั๊กของโค้ดเรา — และเป็นเหตุผลที่ต้องมีล็อก')
  const r = await race(false)
  assert.equal(r.runner.survived, false, 'ถ้างานยังอยู่ แปลว่าจำลองการชนไม่สำเร็จ')
  assert.equal(r.checkerCode, 0, 'ตัวที่สองทำงานจนจบอย่างสงบ ไม่มีอะไรเตือน')
})

test('มีล็อก: ตัวที่สองถูกปฏิเสธ และงานของตัวแรกรอด', async () => {
  const r = await race(true)
  assert.equal(r.runner.survived, true, 'งานของ run ที่ถือล็อกอยู่ต้องไม่ถูกลบ')
  assert.equal(r.checkerCode, EXIT_LOCK_BUSY, `ตัวที่สองต้องออกด้วย ${EXIT_LOCK_BUSY} แต่ได้ ${r.checkerCode}`)
  assert.match(r.checkerErr, /runner-under-test/, 'ต้องบอกว่าใครถืออยู่')
  assert.match(r.checkerErr, /pid \d+/, 'ต้องบอก pid ของเจ้าของ')
  assert.match(r.checkerErr, /นาทีที่แล้ว/, 'ต้องบอกว่าถือมานานเท่าไร')
})

test('ยึดไม่ได้ต้องล้มทันที ห้ามรอเงียบ ๆ', async () => {
  /*
   * ต้องวัดข้ามโปรเซส ไม่ใช่ในโปรเซสเดียว
   *
   * เขียนครั้งแรกเป็นการยึดสองครั้งในโปรเซสเดียวแล้วคาดว่าจะโยน error — มันไม่โยน
   * เพราะการยึดซ้อนในโปรเซสเดียวกันเป็นสิ่งที่ตั้งใจให้ทำได้ (runner ถือคลุมทั้งรอบ
   * ส่วน adapter ยึดซ้ำรอบ run แต่ละอัน) เทสที่เขียนผิดแบบนั้นจะบังคับให้แก้ดีไซน์
   * ไปในทางที่ทำให้ runner ฟ้องว่าตัวเองชนกับตัวเอง
   *
   * ข้อจำกัดที่ตามมาและต้องรู้ไว้: การยึดซ้อนแยกไม่ออกจาก "โค้ดสองส่วนในโปรเซส
   * เดียวกันใช้ fixture พร้อมกัน" ล็อกนี้จึงกันได้เฉพาะข้ามโปรเซส และตั้งอยู่บน
   * ข้อเท็จจริงที่ว่า runner รันทีละ run เท่านั้น ถ้าวันหนึ่งมันรันขนานในโปรเซสเดียว
   * ล็อกนี้จะไม่กันให้ และต้องเปลี่ยนวิธีนับชั้น
   */
  const fx = scratchFixture()
  const release = acquireFixtureLock(fx, { owner: 'ตัวแรก' })
  const probe = childScript(`
import { acquireFixtureLock } from ${JSON.stringify(LOCK_MODULE)}
const t0 = Date.now()
try { acquireFixtureLock(process.argv[2], { owner: 'ตัวสอง' }); console.log('ACQUIRED') }
catch (e) { console.log(JSON.stringify({ code: e.code, ms: Date.now() - t0 })) }
`)
  const out = execFileSync(process.execPath, [probe, fx], { encoding: 'utf8' }).trim()
  release()
  const r = JSON.parse(out)
  assert.equal(r.code, 'FIXTURE_LOCK_BUSY')
  assert.ok(r.ms < 1000, `ต้องล้มทันที ไม่ใช่รอเงียบ ๆ แต่ใช้เวลา ${r.ms}ms`)
})

test('การยึดซ้อนในโปรเซสเดียวกันเป็นสิ่งที่ตั้งใจ ไม่ใช่ช่องโหว่ที่ลืมปิด', () => {
  const fx = scratchFixture()
  const outer = acquireFixtureLock(fx, { owner: 'runner ทั้งรอบ' })
  assert.doesNotThrow(() => acquireFixtureLock(fx, { owner: 'run เดี่ยว' })(),
    'ถ้าข้อนี้เริ่มโยน error แปลว่า runner จะฟ้องว่าตัวเองชนกับตัวเอง')
  outer()
})

test('ไฟล์ล็อกต้องอยู่นอก fixture — ไม่งั้น git clean ของเจ้าของจะลบล็อกตัวเองทิ้ง', () => {
  const fx = scratchFixture()
  const inside = resolve(lockPathFor(fx)).toLowerCase()
    .startsWith(resolve(fx).toLowerCase() + sep)
  assert.equal(inside, false, `ล็อกต้องไม่อยู่ใน fixture แต่ได้ ${lockPathFor(fx)}`)
})

test('ล็อกค้างจากโปรเซสที่ตายแล้ว ต้องแกะได้', async () => {
  const fx = scratchFixture()
  const lockPath = lockPathFor(fx)
  const deadPid = await leaveDeadOwner(fx, 'run ที่ตายไปแล้ว')

  const holder = inspectLock(fx)
  assert.equal(holder.info.pid, deadPid)
  assert.equal(holder.alive, false)
  assert.equal(holder.stale, true)

  const release = acquireFixtureLock(fx, { owner: 'ตัวใหม่' })
  assert.equal(inspectLock(fx).info.owner, 'ตัวใหม่')
  release()
  assert.ok(!existsSync(lockPath))
})

for (const crashPhase of ['before-retire', 'after-retire']) {
  test(`reclaimer ถูกฆ่าที่ ${crashPhase} ต้องไม่ทิ้ง coordinator ที่กู้ต่อไม่ได้`, async () => {
    const fx = scratchFixture()
    await leaveDeadOwner(fx, `stale for ${crashPhase}`)
    const child = childProcess(`
import { acquireFixtureLock } from ${JSON.stringify(LOCK_MODULE)}
acquireFixtureLock(process.argv[2], {
  owner: 'reclaimer-to-kill',
  _testHook (phase) {
    if (phase !== process.argv[3]) return
    console.log('CRASH-POINT ' + phase)
    while (true) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000)
  },
})
`, [fx, crashPhase])
    await waitForOutput(child, new RegExp(`CRASH-POINT ${crashPhase}`))
    const closed = waitForClose(child)
    child.kill('SIGKILL')
    await closed

    if (crashPhase === 'before-retire') assert.equal(inspectLock(fx).stale, true)
    else assert.equal(inspectLock(fx), null)
    const release = acquireFixtureLock(fx, { owner: `recovered after ${crashPhase}` })
    assert.match(inspectLock(fx).info.owner, /recovered after/)
    release()
  })
}

test('หลายโปรเซส reclaim ล็อกค้างพร้อมกัน ต้องเหลือเจ้าของใหม่ที่ยังอยู่เพียงรายเดียว', async () => {
  const fx = scratchFixture()
  await leaveDeadOwner(fx, 'stale-race-source')
  const go = join(fx, 'go.signal')
  const body = `
import fs from 'node:fs'
import { acquireFixtureLock } from ${JSON.stringify(LOCK_MODULE)}
console.log('READY')
while (!fs.existsSync(process.argv[3])) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
try {
  const release = acquireFixtureLock(process.argv[2], { owner: 'reclaimer-' + process.pid })
  console.log('ACQUIRED ' + process.pid)
  await new Promise((r) => setTimeout(r, 800))
  release()
} catch (e) { console.log(e.code === 'FIXTURE_LOCK_BUSY' ? 'BUSY ' + e.message : 'ERR ' + e.message) }
`
  const children = [0, 1, 2, 3].map(() => childProcess(body, [fx, go]))
  await Promise.all(children.map((child) => waitForOutput(child, /READY/)))
  writeFileSync(go, 'go')
  await Promise.all(children.map(waitForClose))
  const outputs = children.map((child) => child.output)
  assert.equal(outputs.filter((out) => /ACQUIRED/.test(out)).length, 1, JSON.stringify(outputs))
  assert.equal(outputs.filter((out) => /BUSY/.test(out)).length, 3, JSON.stringify(outputs))
})

test('manual break ที่ช้ากว่า ห้ามย้ายเจ้าของใหม่ที่มาแทน stale owner', async () => {
  const fx = scratchFixture()
  await leaveDeadOwner(fx, 'manual-break-target')
  const resume = join(fx, 'resume-break.signal')
const lagging = childProcess(`
import fs from 'node:fs'
import { breakLock } from ${JSON.stringify(LOCK_MODULE)}
const result = breakLock(process.argv[2], { _testHook (phase) {
  if (phase !== 'before-retire-rename') return
  console.log('PAUSED')
  while (!fs.existsSync(process.argv[3])) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
} })
console.log(JSON.stringify(result))
`, [fx, resume])
  await waitForOutput(lagging, /PAUSED/)

  assert.equal(breakLock(fx).broken, true)
  const release = acquireFixtureLock(fx, { owner: 'replacement-after-manual-break' })
  writeFileSync(resume, 'continue')
  await waitForClose(lagging)
  assert.match(lagging.output, /"broken":false/)
  assert.match(lagging.output, /fail closed/)
  assert.equal(inspectLock(fx).info.owner, 'replacement-after-manual-break')
  release()
})

test('force break ที่ช้ากว่า ห้ามย้ายเจ้าของใหม่ แม้ข้ามการตรวจ liveness', async () => {
  const fx = scratchFixture()
  const live = childProcess(`
import { acquireFixtureLock } from ${JSON.stringify(LOCK_MODULE)}
acquireFixtureLock(process.argv[2], { owner: 'live-force-target' })
console.log('LOCKED')
setInterval(() => {}, 1000)
`, [fx])
  await waitForOutput(live, /LOCKED/)
  const resume = join(fx, 'resume-force.signal')
const lagging = childProcess(`
import fs from 'node:fs'
import { breakLock } from ${JSON.stringify(LOCK_MODULE)}
const result = breakLock(process.argv[2], { force: true, _testHook (phase) {
  if (phase !== 'before-retire-rename') return
  console.log('PAUSED')
  while (!fs.existsSync(process.argv[3])) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10)
} })
console.log(JSON.stringify(result))
`, [fx, resume])
  try {
    await waitForOutput(lagging, /PAUSED/)
    assert.equal(breakLock(fx, { force: true }).broken, true)
    const release = acquireFixtureLock(fx, { owner: 'replacement-after-force' })
    writeFileSync(resume, 'continue')
    await waitForClose(lagging)
    assert.match(lagging.output, /"broken":false/)
    assert.match(lagging.output, /fail closed/)
    assert.equal(inspectLock(fx).info.owner, 'replacement-after-force')
    release()
  } finally {
    live.kill('SIGKILL')
    lagging.kill('SIGKILL')
  }
})

test('module คนละ copy และ path spelling คนละแบบต้องชี้ lock เดียวกัน', async () => {
  const fx = scratchFixture()
  const copyDir = mkdtempSync(join(tmpdir(), 'fxlock-module-copy-'))
  dirs.push(copyDir)
  const moduleCopy = join(copyDir, 'fixture-lock-copy.mjs')
  copyFileSync(fileURLToPath(new URL('../src/fixture-lock.mjs', import.meta.url)), moduleCopy)
  const copied = await import(`${pathToFileURL(moduleCopy).href}?copy=${Date.now()}`)
  assert.equal(copied.lockPathFor(join(fx, '.')), lockPathFor(fx))

  const release = acquireFixtureLock(fx, { owner: 'main-module-owner' })
  assert.throws(() => copied.acquireFixtureLock(join(fx, '.'), { owner: 'copied-module-owner' }),
    /FIXTURE_LOCK_BUSY|ถูกใช้งานอยู่/)
  release()
})

test('ล็อกไฟล์ schema เก่าจาก checkout เดียวกันต้อง block v2 แม้ pid ยังอยู่จริง', async () => {
  const fx = scratchFixture()
  const checkout = mkdtempSync(join(tmpdir(), 'fxlock-old-checkout-'))
  dirs.push(checkout)
  const srcDir = join(checkout, 'src')
  mkdirSync(srcDir)
  const moduleCopy = join(srcDir, 'fixture-lock.mjs')
  copyFileSync(fileURLToPath(new URL('../src/fixture-lock.mjs', import.meta.url)), moduleCopy)
  const copied = await import(`${pathToFileURL(moduleCopy).href}?legacy=${Date.now()}`)
  const oldPath = copied.legacyLockPathFor(fx)
  mkdirSync(dirname(oldPath), { recursive: true })
  writeFileSync(oldPath, JSON.stringify({
    token: 'legacy-token', owner: 'old-live-process', pid: process.pid,
    hostname: (await import('node:os')).hostname(), startedAt: new Date().toISOString(),
  }))

  assert.throws(() => copied.acquireFixtureLock(fx, { owner: 'v2-process' }), (error) => {
    assert.equal(error.code, 'FIXTURE_LOCK_BUSY')
    assert.match(error.message, /schema ก่อน v2/)
    assert.match(error.message, /maintenance window/)
    return true
  })
  assert.equal(existsSync(copied.lockPathFor(fx)), false, 'พบ legacy แล้วต้องไม่ publish v2 lock')
})

test('canonical lock directory ว่าง/เสียต้อง block และห้ามถูก rename ทับ', () => {
  const fx = scratchFixture()
  const lockPath = lockPathFor(fx)
  mkdirSync(lockPath, { recursive: true })
  assert.throws(() => acquireFixtureLock(fx, { owner: 'must-not-overwrite-empty' }), (e) => {
    assert.equal(e.code, 'FIXTURE_LOCK_BUSY')
    return true
  })
  assert.equal(existsSync(lockPath), true)
  assert.deepEqual(readdirSync(lockPath), [])
})

test('lstat error ที่ไม่ใช่ ENOENT ต้อง fail closed ไม่ถูกตีความว่า unlocked', () => {
  const fx = scratchFixture()
  const denied = new Proxy(fs, {
    get (target, property) {
      if (property === 'lstatSync') return () => { const e = new Error('access denied by test'); e.code = 'EACCES'; throw e }
      return Reflect.get(target, property)
    },
  })
  assert.throws(() => inspectLock(fx, { _lockFs: denied }), /อ่านสถานะ fixture lock ไม่ได้.*access denied by test/)
})

test('ห้ามแกะล็อกของโปรเซสที่ยังทำงานอยู่ แม้ล็อกจะเก่ามาก', async () => {
  const fx = scratchFixture()
  const child = childProcess(`
import { acquireFixtureLock } from ${JSON.stringify(LOCK_MODULE)}
acquireFixtureLock(process.argv[2], { owner: 'การเก็บข้อมูลที่ยังเดินอยู่' })
console.log('LOCKED')
setInterval(() => {}, 1000)
`, [fx])
  try {
    await waitForOutput(child, /LOCKED/)
    const ownerFile = join(lockPathFor(fx), 'owner.json')
    const record = JSON.parse(readFileSync(ownerFile, 'utf8'))
    record.startedAt = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
    writeFileSync(ownerFile, JSON.stringify(record))
    const holder = inspectLock(fx)
    assert.equal(holder.alive, true)
    assert.equal(holder.stale, false, 'pid ยังอยู่ = ห้ามแกะ ไม่ว่าจะเก่าแค่ไหน')
    assert.throws(() => acquireFixtureLock(fx, { owner: 'ตัวใหม่' }), /FIXTURE_LOCK_BUSY|ถูกใช้งานอยู่/)
    assert.equal(breakLock(fx).broken, false, 'แกะด้วยมือก็ต้องไม่ยอม')
    assert.equal(breakLock(fx, { force: true }).broken, true, 'ยกเว้นเมื่อคนสั่ง force เอง')
  } finally {
    child.kill('SIGKILL')
  }
})

test('หน่วยความจำในโปรเซสไม่พอ ต้องตรวจ token เจ้าของจริงบนดิสก์', () => {
  const fx = scratchFixture()
  const release = acquireFixtureLock(fx, { owner: 'ของเรา' })
  const lockPath = lockPathFor(fx)
  const ownerFile = join(lockPath, 'owner.json')
  const stolen = { ...JSON.parse(readFileSync(ownerFile, 'utf8')), token: 'ของคนอื่น', owner: 'คนอื่น' }
  writeFileSync(ownerFile, JSON.stringify(stolen))
  const malformed = inspectLock(fx)
  assert.equal(malformed.stale, false, 'token ที่ไม่ใช่ UUID ห้ามถูก auto-reclaim')
  assert.equal(malformed.alive, null)
  assert.equal(isFixtureLockHeld(fx), false, 'held map อย่างเดียวห้ามนับว่าเป็นเจ้าของ')
  assert.throws(() => assertFixtureLockHeld(fx), /ต้องถือล็อก fixture ก่อน/)
  release()
  assert.ok(existsSync(lockPath), 'token ไม่ตรงแล้วยังย้าย = ไปปลดล็อกของคนอื่น')
  assert.equal(JSON.parse(readFileSync(ownerFile, 'utf8')).owner, 'คนอื่น')
  rmSync(lockPath, { recursive: true })
})

test('token ที่ copy มาไม่พอ ต้องเป็น ownership object เดิมบนดิสก์ด้วย', () => {
  const fx = scratchFixture()
  const release = acquireFixtureLock(fx, { owner: 'original-object' })
  const lockPath = lockPathFor(fx)
  const original = JSON.parse(readFileSync(join(lockPath, 'owner.json'), 'utf8'))
  const displaced = `${lockPath}.test-displaced`
  renameSync(lockPath, displaced)
  mkdirSync(lockPath)
  writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ ...original, owner: 'copied-token-object' }))

  assert.equal(isFixtureLockHeld(fx), false, 'token ที่เหมือนกันใน directory คนละ inode ห้ามผ่าน')
  release()
  assert.equal(inspectLock(fx).info.owner, 'copied-token-object', 'release เก่าห้ามย้าย ownership object ใหม่')
  rmSync(lockPath, { recursive: true })
  rmSync(displaced, { recursive: true })
})

test('ยึดซ้อนในโปรเซสเดียวกันได้ และปลดชั้นในต้องไม่ปล่อยของจริง', async () => {
  const fx = scratchFixture()
  const outer = acquireFixtureLock(fx, { owner: 'runner ทั้งรอบเก็บข้อมูล' })
  const inner = acquireFixtureLock(fx, { owner: 'run เดี่ยว' })
  inner()
  assert.ok(isFixtureLockHeld(fx), 'ปลดชั้นในแล้วต้องยังถืออยู่ ไม่งั้นเครื่องมืออื่นแทรกกลางรอบได้')
  assert.ok(existsSync(lockPathFor(fx)))
  outer()
  assert.ok(!isFixtureLockHeld(fx))
  assert.ok(!existsSync(lockPathFor(fx)))
})

test('ยึดซ้อนแล้วปลดผิดลำดับต้องไม่ทิ้งไฟล์ล็อกค้าง', () => {
  const fx = scratchFixture()
  const releaseOuter = acquireFixtureLock(fx, { owner: 'ชั้นนอก' })
  const releaseInner = acquireFixtureLock(fx, { owner: 'ชั้นใน' })

  releaseOuter()
  assert.ok(existsSync(lockPathFor(fx)), 'ยังมีผู้ถือชั้นในอยู่ ล็อกจริงต้องยังอยู่')
  releaseInner()
  assert.ok(!existsSync(lockPathFor(fx)), 'ผู้ถือคนสุดท้ายปล่อยแล้ว ต้องลบล็อกจริงไม่ว่าลำดับใด')
})

test('withFixtureLock ปลดล็อกแม้งานข้างในจะโยน error', async () => {
  const fx = scratchFixture()
  await assert.rejects(withFixtureLock(fx, 'พัง', async () => { throw new Error('พังกลางคัน') }), /พังกลางคัน/)
  assert.ok(!existsSync(lockPathFor(fx)), 'ล็อกต้องไม่ค้างเมื่องานล้ม')
})

test('assertFixtureLockHeld ต้องล้มเมื่อยังไม่ได้ยึด และผ่านเมื่อยึดแล้ว', () => {
  const fx = scratchFixture()
  assert.throws(() => assertFixtureLockHeld(fx), /ต้องถือล็อก fixture ก่อน/)
  const release = acquireFixtureLock(fx, { owner: 'x' })
  assert.doesNotThrow(() => assertFixtureLockHeld(fx))
  release()
})

test('resetToBaseline ต้องปฏิเสธเมื่อไม่มีใครถือล็อก — ด่านฟังก์ชันล่างสุด', async () => {
  const { resetToBaseline } = await import('../src/install-arm.mjs')
  const fx = scratchFixture()
  writeFileSync(join(fx, 'งานของเอเจนต์.ts'), 'x\n')
  assert.throws(() => resetToBaseline(fx), /ต้องถือล็อก fixture ก่อน/)
  assert.ok(existsSync(join(fx, 'งานของเอเจนต์.ts')), 'ปฏิเสธแล้วต้องไม่ได้ลบอะไรไปก่อน')
  await withFixtureLock(fx, 'test', () => { resetToBaseline(fx) })
  assert.ok(!existsSync(join(fx, 'งานของเอเจนต์.ts')), 'ยึดล็อกแล้วต้องทำงานตามปกติ')
})

test('สองโปรเซสยึดพร้อมกัน ต้องสำเร็จแค่ตัวเดียว', async () => {
  const fx = scratchFixture()
  const body = `
import { acquireFixtureLock } from ${JSON.stringify(LOCK_MODULE)}
try {
  const release = acquireFixtureLock(process.argv[2], { owner: 'พร้อมกัน ' + process.pid })
  await new Promise((r) => setTimeout(r, 700))
  console.log('ACQUIRED')
  release()
} catch (e) { console.log(e.code === 'FIXTURE_LOCK_BUSY' ? 'BUSY' : 'ERR ' + e.message) }
`
  const s = childScript(body)
  const runs = await Promise.all([0, 1, 2].map(() => new Promise((res) => {
    let out = ''
    const p = spawn(process.execPath, [s, fx], { stdio: ['ignore', 'pipe', 'inherit'] })
    p.stdout.on('data', (d) => { out += d })
    p.on('close', () => res(out.trim()))
  })))
  const won = runs.filter((r) => r === 'ACQUIRED')
  assert.equal(won.length, 1, `ต้องมีผู้ชนะรายเดียว แต่ได้ ${JSON.stringify(runs)}`)
  assert.equal(runs.filter((r) => r === 'BUSY').length, 2)
})
