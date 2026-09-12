#!/usr/bin/env node
/**
 * check-numbers.mjs — จับตัวเลขที่ drift ออกจากข้อมูล ก่อนที่กรรมการจะจับ
 *
 * สี่ข้อที่ตรวจ และเหตุผลที่ตรวจข้อนั้น:
 *
 *   1. เอกสารที่สร้างอัตโนมัติ ต้องตรงกับสิ่งที่สร้างใหม่จาก numbers.json ปัจจุบัน
 *      จับสองกรณีพร้อมกัน: มีคนแก้ไฟล์ที่สร้างด้วยมือ และลืมสร้างใหม่หลังได้ข้อมูลใหม่
 *
 *   2. hash ของชุดตัวเลขที่ประทับไว้ในเอกสาร ต้องตรงกับ numbers.json ปัจจุบัน
 *      จับกรณีที่เนื้อหาบังเอิญเหมือนกันแต่มาจากคนละชุดข้อมูล
 *
 *   3. ห้ามมีเอกสารไหนอ้าง dataset stamp ที่ไม่ใช่ชุดปัจจุบัน
 *      จับกรณีคลาสสิก: เด็คยังอ้างตัวเลขของ run ก่อนหน้า
 *
 *   4. ถ้าตัวเลขปัจจุบันมาจาก mock adapter เอกสารที่สร้างต้องประทับหัวไว้ว่าห้ามอ้าง
 *      จับกรณีที่อันตรายที่สุด: ตัวเลขปลอมเดินเข้าเล่มโดยไม่มีใครทัน
 *
 * ไม่ได้ตรวจ: เลขที่คนพิมพ์เองในบทอื่น ๆ ซึ่งตรวจอัตโนมัติไม่ได้โดยไม่เดา
 * วิธีเดียวที่กันได้จริงคืออย่าพิมพ์เลขเอง ให้คัดลอกจากไฟล์ที่สร้าง
 *
 *   node scripts/check-numbers.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderResultsDoc, renderSlideNumbers, loadNumbers } from './lib/results-doc.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
const NUMBERS_FILE = path.join(ROOT, 'results', 'numbers.json');

console.log('=== ตัวเลขในเอกสารต้องตรงกับข้อมูล ===\n');

/*
 * ประตูหลักฐาน transcript — เครื่องเตือนแทนคน
 *
 * artifact.json ในสมุด attempt มี rawEvents ของทุก run อยู่แล้ว แต่บทสนทนาดิบ
 * (.jsonl ใน ~/.claude/projects/) ละเอียดกว่านั้นอีกชั้น และอยู่ **นอก repo**
 * ในโฟลเดอร์ที่ถูกลบหรือหมุนทิ้งได้ · scripts/evidence-archive.mjs คัดลอกมาพร้อม
 * ผูก sha256 แต่ต้องสั่งเอง
 *
 * ผู้วิจัยสั่งไว้เมื่อ 12 ก.ย. 2569 ว่าต้องเก็บทุกเฟส ไม่ใช่แค่ตอนจบทั้งหมด
 * การฝากไว้กับความจำของคนที่กำลังรีบตอนใกล้เส้นตายคือวิธีที่จะลืม
 * ข้อนี้จึงเป็นประตูที่ล้มได้ ไม่ใช่คำเตือนที่ข้ามได้
 *
 * ตรวจเฉพาะเมื่อมีข้อมูลจริงแล้ว — ก่อนเก็บข้อมูลยังไม่มีอะไรให้เก็บหลักฐาน
 */
let failedTranscripts = false;
const LATEST = path.join(ROOT, 'results', 'latest.json');
const TRANSCRIPTS = path.join(ROOT, 'evidence', 'transcripts');
if (fs.existsSync(LATEST)) {
  const archived = fs.existsSync(TRANSCRIPTS)
    ? fs.readdirSync(TRANSCRIPTS).filter((f) => f.endsWith('.jsonl')).length
    : 0;
  if (archived === 0) {
    console.log('  ❌ มีข้อมูลจริงใน results/ แล้ว แต่ยังไม่ได้เก็บ transcript ดิบ');
    console.log('      บทสนทนาดิบอยู่นอก repo ในโฟลเดอร์ที่ถูกลบได้ · เก็บด้วย:');
    console.log('        npm run evidence:archive');
    console.log('      ต้องเก็บทุกครั้งที่จบเฟสการเก็บข้อมูล ไม่ใช่แค่ตอนจบทั้งหมด');
    failedTranscripts = true;
  } else {
    console.log(`  ✅ เก็บ transcript ดิบแล้ว ${archived} ไฟล์`);
  }
  console.log('');
}

if (!fs.existsSync(NUMBERS_FILE)) {
  console.log('  ยังไม่มี results/numbers.json — ยังไม่เคยวิเคราะห์ข้อมูลจริง จึงยังไม่มีอะไรให้ตรวจ');
  console.log('  ข้อนี้จะเริ่มตรวจจริงหลัง npm run analyze ครั้งแรก\n');
  process.exit(failedTranscripts ? 1 : 0);
}

const numbers = loadNumbers(NUMBERS_FILE);
let failed = failedTranscripts ? 1 : 0;

const GENERATED = [
  { file: path.join(ROOT, 'report', 'ch5-results.md'), render: renderResultsDoc, cmd: 'npm run results:doc' },
  { file: path.join(ROOT, 'SLIDE-NUMBERS.md'), render: renderSlideNumbers, cmd: 'npm run results:slides' },
];

// ---------- 1 + 2 + 4 ----------
for (const g of GENERATED) {
  if (!fs.existsSync(g.file)) {
    console.log(`  ❌ ${rel(g.file)} ยังไม่ถูกสร้าง — รัน \`${g.cmd}\``);
    failed++;
    continue;
  }
  const onDisk = fs.readFileSync(g.file, 'utf8');
  const fresh = g.render(numbers);

  if (onDisk.split(/\r?\n/).join('\n') !== fresh.split(/\r?\n/).join('\n')) {
    console.log(`  ❌ ${rel(g.file)} ไม่ตรงกับข้อมูลปัจจุบัน — แก้ด้วยมือหรือลืมสร้างใหม่`);
    console.log(`      แก้ด้วย \`${g.cmd}\` · ห้ามแก้ไฟล์ที่สร้างด้วยมือ`);
    failed++;
    continue;
  }

  const stamped = onDisk.match(/<!-- numbers-hash: ([0-9a-f]+) -->/)?.[1];
  if (stamped !== numbers.__hash) {
    console.log(`  ❌ ${rel(g.file)} ประทับ hash ${stamped} แต่ข้อมูลปัจจุบันคือ ${numbers.__hash}`);
    failed++;
    continue;
  }

  if (numbers.simulated && !onDisk.includes('mock adapter')) {
    console.log(`  ❌ ${rel(g.file)} สร้างจากข้อมูลจำลองแต่ไม่ได้ประทับคำเตือนไว้`);
    failed++;
    continue;
  }

  console.log(`  ✅ ${rel(g.file)} ตรงกับ results/numbers.json (${numbers.__hash})`);
}

// ---------- 3 ----------
const currentStamp = numbers.stamp ?? null;
const STAMP_RE = /\b20\d{2}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\b/g;
const docs = [];
for (const dir of [ROOT, path.join(ROOT, 'report')]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.md')) docs.push(path.join(dir, f));
  }
}

const stale = [];
for (const d of docs) {
  const text = fs.readFileSync(d, 'utf8');
  for (const m of text.match(STAMP_RE) ?? []) {
    if (currentStamp && m !== currentStamp) stale.push({ file: rel(d), stamp: m });
  }
}

if (!currentStamp) {
  console.log('  ⚠️  ชุดตัวเลขปัจจุบันไม่มี stamp จึงข้ามการตรวจ stamp เก่า');
} else if (stale.length) {
  console.log(`\n  ⚠️  พบการอ้าง dataset stamp ที่ไม่ใช่ชุดปัจจุบัน (${currentStamp}):`);
  const byFile = new Map();
  for (const x of stale) byFile.set(x.file, new Set([...(byFile.get(x.file) ?? []), x.stamp]));
  for (const [f, stamps] of byFile) console.log(`      ${f}: ${[...stamps].join(', ')}`);
  console.log('      ถ้าเป็นบันทึกประวัติโดยเจตนา ปล่อยไว้ได้ · ถ้าเป็นตัวเลขที่ยังอ้างอยู่ ต้องอัปเดต');
} else {
  console.log(`  ✅ ไม่มีเอกสารไหนอ้าง dataset stamp อื่นนอกจาก ${currentStamp}`);
}

console.log('');
if (failed) {
  console.log(`⛔ ไม่ผ่าน ${failed} ข้อ — เอกสารกับข้อมูลไม่ตรงกัน\n`);
  process.exit(1);
}
console.log('ตัวเลขในเอกสารที่สร้างอัตโนมัติ ตรงกับข้อมูลปัจจุบันทุกไฟล์\n');
