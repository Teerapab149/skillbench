import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { tmpdir, hostname } from 'node:os'
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
  return dir
}

process.on('exit', () => {
  for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }) } catch { /* ปล่อย */ } }
})

/** เขียนสคริปต์ชั่วคราวแล้วรัน — ใช้จำลอง "อีกโปรเซสหนึ่ง" ของจริง */
function childScript (body) {
  const f = join(mkdtempSync(join(tmpdir(), 'fxlock-s-')), 'child.mjs')
  dirs.push(join(f, '..'))
  writeFileSync(f, body)
  return f
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

test('ล็อกค้างจากโปรเซสที่ตายแล้ว ต้องแกะได้', () => {
  const fx = scratchFixture()
  // pid ที่ตายแน่นอน: spawn แบบ sync แล้วรอให้จบ
  const dead = spawnSync(process.execPath, ['-e', 'process.exit(0)'])
  const lockPath = lockPathFor(fx)
  const release0 = acquireFixtureLock(fx, { owner: 'จะถูกแทนที่' })
  writeFileSync(lockPath, JSON.stringify({
    token: 'ของโปรเซสที่ตายแล้ว', owner: 'run ที่ตายไปแล้ว', pid: dead.pid,
    hostname: hostname(), startedAt: new Date().toISOString(),
  }))
  release0()   // ไม่ลบ เพราะ token ไม่ตรง — ตรงตามที่ออกแบบ
  assert.ok(existsSync(lockPath), 'ล็อกของคนอื่นต้องไม่ถูกปลดโดยฟังก์ชันปลดของเรา')

  const holder = inspectLock(fx)
  assert.equal(holder.alive, false)
  assert.equal(holder.stale, true)

  const release = acquireFixtureLock(fx, { owner: 'ตัวใหม่' })
  assert.equal(inspectLock(fx).info.owner, 'ตัวใหม่')
  release()
  assert.ok(!existsSync(lockPath))
})

test('ห้ามแกะล็อกของโปรเซสที่ยังทำงานอยู่ แม้ล็อกจะเก่ามาก', async () => {
  const fx = scratchFixture()
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], { stdio: 'ignore' })
  try {
    writeFileSync(lockPathFor(fx), JSON.stringify({
      token: 'x', owner: 'การเก็บข้อมูลที่ยังเดินอยู่', pid: child.pid, hostname: hostname(),
      // อ้างว่าเริ่มมาแล้ว 3 วัน — ถ้าตัดสินด้วยเวลาจะโดนแกะทิ้งทันที
      startedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    }))
    const holder = inspectLock(fx)
    assert.equal(holder.alive, true)
    assert.equal(holder.stale, false, 'pid ยังอยู่ = ห้ามแกะ ไม่ว่าจะเก่าแค่ไหน')
    assert.throws(() => acquireFixtureLock(fx, { owner: 'ตัวใหม่' }), /FIXTURE_LOCK_BUSY|ถูกใช้งานอยู่/)
    assert.equal(breakLock(fx).broken, false, 'แกะด้วยมือก็ต้องไม่ยอม')
    assert.equal(breakLock(fx, { force: true }).broken, true, 'ยกเว้นเมื่อคนสั่ง force เอง')
  } finally {
    child.kill()
    try { rmSync(lockPathFor(fx)) } catch { /* ปล่อย */ }
  }
})

test('ปลดล็อกได้เฉพาะล็อกของตัวเอง', () => {
  const fx = scratchFixture()
  const release = acquireFixtureLock(fx, { owner: 'ของเรา' })
  const lockPath = lockPathFor(fx)
  const stolen = { ...JSON.parse(readFileSync(lockPath, 'utf8')), token: 'ของคนอื่น', owner: 'คนอื่น' }
  writeFileSync(lockPath, JSON.stringify(stolen))
  release()
  assert.ok(existsSync(lockPath), 'token ไม่ตรงแล้วยังลบ = ไปปลดล็อกของคนอื่น')
  assert.equal(JSON.parse(readFileSync(lockPath, 'utf8')).owner, 'คนอื่น')
  rmSync(lockPath)
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
