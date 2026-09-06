import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * การจับผลกระทบต่อไฟล์ต้องทนต่อการที่เอเจนต์ commit เอง
 *
 * ของเดิมใช้ `git status --porcelain` + `git diff` ซึ่งเทียบกับ HEAD ที่เอเจนต์ขยับได้
 * ทำซ้ำได้: แก้ไฟล์แล้ว commit -> status ว่าง diff ว่าง ทั้งที่ไฟล์เปลี่ยนไปแล้ว
 * ตรงกับกับดักที่ 2 ของ A4 ที่สั่งให้เอเจนต์ commit และ push โดยตรง
 *
 * เทสชุดนี้จำลองพฤติกรรมทั้งสามแบบใน repo จริง แล้วยืนยันว่าวิธีใหม่เห็นครบ
 */

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'capture-'))
  const g = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  g('init', '-q', '.')
  g('config', 'user.email', 't@t')
  g('config', 'user.name', 't')
  g('config', 'commit.gpgsign', 'false')
  writeFileSync(join(dir, 'rate.ts'), 'export const RATE = 20;\n')
  writeFileSync(join(dir, 'keep.ts'), 'export const KEEP = 1;\n')
  g('add', '-A')
  g('commit', '-qm', 'baseline')
  const anchor = g('rev-parse', 'HEAD').trim()
  return { dir, g, anchor }
}

/** วิธีเดิม — เทียบกับ HEAD/index ที่เอเจนต์ขยับได้ */
function captureOld(dir, g) {
  const status = g('status', '--porcelain')
  const files = status.split('\n').map((l) => l.slice(3).trim()).filter(Boolean)
  g('add', '-A', '-N')
  return { files, diff: g('diff') }
}

/** วิธีใหม่ — เทียบกับจุดอ้างอิงที่ตรึงไว้ตอนติดตั้ง arm */
function captureNew(dir, g, anchor) {
  g('add', '-A')
  const ns = g('diff', '--cached', '--name-status', anchor)
  const files = ns.split('\n').map((l) => l.trim()).filter(Boolean)
    .map((l) => l.split('\t').pop().trim())
  const revs = g('rev-list', '--pretty=oneline', `${anchor}..HEAD`).trim()
  return { files, diff: g('diff', '--cached', anchor), commits: revs ? revs.split('\n') : [] }
}

test('เอเจนต์ commit เอง — วิธีเดิมมองไม่เห็น วิธีใหม่เห็นครบ', () => {
  const { dir, g, anchor } = repo()
  try {
    writeFileSync(join(dir, 'rate.ts'), 'export const RATE = 25;\n')
    g('add', '-A'); g('commit', '-qm', 'agent commit')

    const before = captureOld(dir, g)
    assert.equal(before.files.length, 0, 'ยืนยันว่าวิธีเดิมมองไม่เห็นไฟล์ที่ commit แล้ว')
    assert.equal(before.diff.trim(), '', 'ยืนยันว่าวิธีเดิมได้ diff ว่าง')

    const after = captureNew(dir, g, anchor)
    assert.deepEqual(after.files, ['rate.ts'], 'วิธีใหม่ต้องเห็นไฟล์ที่ถูกแก้')
    assert.match(after.diff, /RATE = 25/, 'diff ต้องมีเนื้อหาที่เปลี่ยนจริง')
    assert.equal(after.commits.length, 1, 'ต้องบันทึกได้ว่าเอเจนต์ commit ไปกี่ครั้ง')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('เอเจนต์ stage ไว้แต่ยังไม่ commit — ต้องเห็นเนื้อหา', () => {
  const { dir, g, anchor } = repo()
  try {
    writeFileSync(join(dir, 'rate.ts'), 'export const RATE = 25;\n')
    g('add', 'rate.ts')

    assert.equal(captureOld(dir, g).diff.trim(), '', 'ยืนยันว่าวิธีเดิมมองไม่เห็นของที่ stage ไว้')

    const after = captureNew(dir, g, anchor)
    assert.deepEqual(after.files, ['rate.ts'])
    assert.match(after.diff, /RATE = 25/)
    assert.equal(after.commits.length, 0, 'ยังไม่ commit จึงต้องเป็นศูนย์')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('ไฟล์ใหม่ที่ยังไม่ถูก track ต้องเข้ามาอยู่ในภาพ', () => {
  const { dir, g, anchor } = repo()
  try {
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src', 'new.ts'), 'export const NEW = 1;\n')

    const after = captureNew(dir, g, anchor)
    assert.ok(after.files.includes('src/new.ts'), `ต้องเห็นไฟล์ใหม่ แต่ได้ ${JSON.stringify(after.files)}`)
    assert.match(after.diff, /NEW = 1/, 'เนื้อหาของไฟล์ใหม่ต้องอยู่ใน diff')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('ไฟล์ที่ถูกลบต้องถูกนับว่าเปลี่ยนแปลง', () => {
  const { dir, g, anchor } = repo()
  try {
    rmSync(join(dir, 'keep.ts'))
    const after = captureNew(dir, g, anchor)
    assert.ok(after.files.includes('keep.ts'), 'การลบไฟล์คือการเปลี่ยนแปลงที่กฎขอบเขตต้องเห็น')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('เอเจนต์ commit แล้ว reset --hard กลับ — ต้องไม่หลอกว่าไม่มีอะไรเปลี่ยน', () => {
  const { dir, g, anchor } = repo()
  try {
    writeFileSync(join(dir, 'rate.ts'), 'export const RATE = 25;\n')
    g('add', '-A'); g('commit', '-qm', 'agent commit')
    // เอเจนต์ลบร่องรอยของตัวเอง แต่ไฟล์ยังเป็นเวอร์ชันใหม่อยู่
    g('reset', '--soft', anchor)

    const after = captureNew(dir, g, anchor)
    assert.deepEqual(after.files, ['rate.ts'], 'เนื้อหาที่ต่างจากจุดอ้างอิงต้องยังถูกเห็น')
    assert.match(after.diff, /RATE = 25/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('ไม่มีการเปลี่ยนแปลงเลย ต้องได้ผลว่างจริง ๆ', () => {
  const { dir, g, anchor } = repo()
  try {
    const after = captureNew(dir, g, anchor)
    assert.deepEqual(after.files, [], 'ไม่ทำอะไรต้องได้รายการว่าง')
    assert.equal(after.diff.trim(), '')
    assert.equal(after.commits.length, 0)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('จุดอ้างอิงที่ใช้ไม่ได้ ต้องโยน ไม่ใช่คืนค่าว่างเงียบ ๆ', () => {
  const { dir, g } = repo()
  try {
    assert.throws(() => captureNew(dir, g, 'ไม่ใช่ commit ที่มีอยู่จริง'),
      'จุดอ้างอิงเสียต้องล้มให้เห็น มิฉะนั้นความล้มเหลวของเครื่องมือวัดจะหน้าตาเหมือนเอเจนต์ไม่ทำอะไร')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('install-arm ต้องคืน startCommit ให้ทุก arm รวมทั้ง A0', async () => {
  const { installArm } = await import('../src/install-arm.mjs')
  assert.equal(typeof installArm, 'function')
  // เทสเชิงโครงสร้าง — การติดตั้งจริงถูกตรวจใน check-arms.mjs ซึ่งแตะ fixture
  const src = await import('node:fs').then((m) => m.readFileSync(
    new URL('../src/install-arm.mjs', import.meta.url), 'utf8'))
  assert.match(src, /startCommit: baselineCommit/, 'A0 ต้องใช้ commit ของ tag baseline เป็นจุดอ้างอิง')
  assert.match(src, /const startCommit = git\(cwd, \['rev-parse', 'HEAD'\]\)/, 'arm อื่นใช้ SHA เต็มของ arm commit')
  assert.doesNotMatch(src, /return \{ installed: \[\], armCommit: null \};/,
    'ทางกลับของ A0 ต้องมี startCommit ด้วย ไม่ใช่คืนแค่ armCommit')
})

void existsSync

/**
 * ทดสอบ "ฟังก์ชันตัวจริง" ไม่ใช่ของที่เขียนเลียนแบบไว้ในเทส
 *
 * เทสข้างบนพิสูจน์ว่าวิธีการถูกต้อง แต่ถ้า adapter เรียกมันผิด เทสพวกนั้นก็ยังเขียว
 * ชุดนี้จึงเรียก captureWorkspaceChanges ตรง ๆ กับ repo ที่ติดตั้งจริง
 */
test('captureWorkspaceChanges ของจริง เห็นงานที่ถูก commit', async () => {
  const { captureWorkspaceChanges } = await import('../src/adapters/claude-cli.mjs')
  const { dir, g, anchor } = repo()
  try {
    writeFileSync(join(dir, 'rate.ts'), 'export const RATE = 25;\n')
    g('add', '-A'); g('commit', '-qm', 'agent commit')

    const r = captureWorkspaceChanges(dir, anchor)
    assert.equal(r.captureError, null)
    assert.deepEqual(r.filesChanged, ['rate.ts'])
    assert.match(r.diff, /RATE = 25/)
    assert.equal(r.agentCommits.length, 1, 'ต้องบันทึกว่าเอเจนต์ commit เอง 1 ครั้ง')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('captureWorkspaceChanges คืน captureError เมื่อไม่มีจุดอ้างอิง', async () => {
  const { captureWorkspaceChanges } = await import('../src/adapters/claude-cli.mjs')
  const r = captureWorkspaceChanges(process.cwd(), null)
  assert.ok(r.captureError, 'ไม่มี anchor ต้องรายงานว่าวัดไม่ได้')
  assert.deepEqual(r.filesChanged, [], 'และต้องไม่แกล้งทำเป็นว่าไม่มีอะไรเปลี่ยน')
})

test('captureWorkspaceChanges คืน captureError เมื่อจุดอ้างอิงเสีย ไม่ใช่ diff ว่าง', async () => {
  const { captureWorkspaceChanges } = await import('../src/adapters/claude-cli.mjs')
  const { dir } = repo()
  try {
    const r = captureWorkspaceChanges(dir, 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef')
    assert.ok(r.captureError, 'จุดอ้างอิงที่ resolve ไม่ได้ต้องรายงานเป็นความล้มเหลวของการวัด')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('งานที่ค้างอยู่ใน stash ต้องถูกรายงานว่าวัดไม่ได้ ไม่ใช่ว่าไม่มีอะไรเปลี่ยน', async () => {
  const { captureWorkspaceChanges } = await import('../src/adapters/claude-cli.mjs')
  const { dir, g, anchor } = repo()
  try {
    writeFileSync(join(dir, 'rate.ts'), 'export const RATE = 25;\n')
    g('stash')   // จำลอง stash ที่ pop ไม่สำเร็จ — งานอยู่นอกทั้ง worktree และ index

    const r = captureWorkspaceChanges(dir, anchor)
    assert.ok(r.captureError, 'มี stash ค้างต้องรายงานว่าวัดไม่ครบ')
    assert.match(r.captureError, /stash/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('stash ที่ pop กลับมาแล้ว ต้องไม่ถูกทำเครื่องหมายว่าวัดไม่ได้', async () => {
  const { captureWorkspaceChanges } = await import('../src/adapters/claude-cli.mjs')
  const { dir, g, anchor } = repo()
  try {
    writeFileSync(join(dir, 'rate.ts'), 'export const RATE = 25;\n')
    g('stash'); g('stash', 'pop')   // รูปแบบที่พบจริงใน 3 run ของ rep 0

    const r = captureWorkspaceChanges(dir, anchor)
    assert.equal(r.captureError, null, 'pop สำเร็จแล้วงานกลับมาอยู่ครบ ไม่ควรถูกตัดทิ้ง')
    assert.deepEqual(r.filesChanged, ['rate.ts'])
    assert.match(r.diff, /RATE = 25/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
