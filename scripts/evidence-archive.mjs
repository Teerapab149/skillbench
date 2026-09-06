#!/usr/bin/env node
/**
 * ถ่ายสำเนาบทสนทนาดิบออกจาก ~/.claude/projects/ แล้วผูก sha256 ไว้
 *
 * ทำไมต้องมี: ไฟล์ .jsonl พวกนั้นคือหลักฐานที่ละเอียดที่สุดที่มี — prompt ทุกอัน
 * tool call ทุกครั้ง ผลลัพธ์ทุกอัน — แต่มันอยู่นอก repo ในโฟลเดอร์ที่ถูกลบหรือหมุนทิ้งได้
 * และ hash ที่บันทึกไว้ทำให้แก้ย้อนหลังแล้วยังอ้างว่าเป็นตัวเดิมไม่ได้
 *
 *   node scripts/evidence-archive.mjs            → รายงานว่ามีอะไรบ้าง ยังไม่คัดลอก
 *   node scripts/evidence-archive.mjs --copy     → คัดลอกจริง + เขียน INDEX.md
 */

import { readdirSync, statSync, existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const DEST = join(ROOT, 'evidence', 'transcripts')
const COPY = process.argv.includes('--copy')

// ชื่อโฟลเดอร์ของ Claude Code = path ของโปรเจกต์ที่แทน separator ด้วย -
const candidates = [
  join(homedir(), '.claude', 'projects', 'E--Seminar-skillbench'),
  join(homedir(), '.claude', 'projects', 'E--Seminar-skillbench-fixtures-gpu-booking'),
]

const found = []
for (const dir of candidates) {
  if (!existsSync(dir)) continue
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.jsonl')) continue
    const abs = join(dir, name)
    const st = statSync(abs)
    found.push({ abs, name, dir, bytes: st.size, mtime: st.mtime.toISOString() })
  }
}
found.sort((a, b) => a.mtime.localeCompare(b.mtime))

if (!found.length) {
  console.log('ไม่พบบทสนทนาใน ~/.claude/projects/ — ตรวจชื่อโฟลเดอร์ใน candidates')
  process.exit(1)
}

const totalMb = found.reduce((s, f) => s + f.bytes, 0) / 1024 / 1024
console.log(`พบบทสนทนา ${found.length} ไฟล์ · รวม ${totalMb.toFixed(1)} MB`)
console.log(`ช่วงเวลา ${found[0].mtime.slice(0, 10)} ถึง ${found[found.length - 1].mtime.slice(0, 10)}`)

if (!COPY) {
  console.log('\n(ยังไม่คัดลอก — สั่ง --copy เพื่อคัดลอกจริง)')
  for (const f of found) console.log(`  ${f.mtime.slice(0, 16).replace('T', ' ')}  ${(f.bytes / 1024 / 1024).toFixed(2).padStart(6)} MB  ${f.name}`)
  process.exit(0)
}

mkdirSync(DEST, { recursive: true })
const rows = []
for (const f of found) {
  const buf = readFileSync(f.abs)
  const sha = createHash('sha256').update(buf).digest('hex')
  const out = join(DEST, f.name)
  copyFileSync(f.abs, out)
  // นับ turn ของผู้ใช้แบบหยาบ ๆ เพื่อให้ index บอกได้ว่าไฟล์ไหนคือช่วงงานหนัก
  let userTurns = 0
  for (const line of buf.toString('utf8').split('\n')) {
    if (line.includes('"role":"user"') || line.includes('"type":"user"')) userTurns++
  }
  rows.push({ ...f, sha, userTurns })
  console.log(`  คัดลอก ${f.name}  sha256 ${sha.slice(0, 16)}…`)
}

const index = [
  '# บทสนทนาดิบ — สำเนาที่ผูก hash ไว้',
  '',
  `คัดลอกเมื่อ ${new Date().toISOString()} ด้วย \`node scripts/evidence-archive.mjs --copy\``,
  '',
  'ไฟล์เหล่านี้คือบันทึกทุกตัวอักษรของการทำงานร่วมกับผู้ช่วย AI — prompt ที่พิมพ์จริง',
  'tool call ทุกครั้ง และผลลัพธ์ที่ได้กลับมา เก็บไว้เพื่อให้ตรวจสอบย้อนหลังได้ว่า',
  '**ใครเป็นคนกำหนดทิศทางและใครเป็นคนตัดสินใจ**',
  '',
  '> sha256 ในตารางนี้ทำให้แก้ไฟล์ย้อนหลังแล้วยังอ้างว่าเป็นตัวเดิมไม่ได้',
  '> แต่ hash ที่เก็บในไฟล์เดียวกับข้อมูลไม่ใช่ notarization — สิ่งที่ใกล้เคียงที่สุดคือ',
  '> เวลาของ commit ที่ push ขึ้น remote แล้ว',
  '',
  '| แก้ไขล่าสุด | ขนาด | turn ของผู้ใช้ (ประมาณ) | ไฟล์ | sha256 |',
  '|---|---:|---:|---|---|',
  ...rows.map((r) => `| ${r.mtime.slice(0, 16).replace('T', ' ')} | ${(r.bytes / 1024 / 1024).toFixed(2)} MB | ${r.userTurns} | \`${r.name}\` | \`${r.sha}\` |`),
  '',
  `รวม ${rows.length} ไฟล์ · ${totalMb.toFixed(1)} MB`,
].join('\n')

writeFileSync(join(DEST, 'INDEX.md'), index + '\n', 'utf8')
console.log(`\nเขียน evidence/transcripts/INDEX.md แล้ว (${rows.length} ไฟล์)`)
console.log('⚠️  ไฟล์เหล่านี้มีเนื้อหาการสนทนาทั้งหมด ตรวจก่อนว่าจะ commit หรือเก็บไว้นอก repo')
