#!/usr/bin/env node
/**
 * make-results-doc.mjs — สร้างบทที่ 5 จากตัวเลขที่วิเคราะห์แล้ว ไม่ใช่จากการพิมพ์มือ
 *
 * ทำไมต้องมี: แผน 14 วันเขียน "ล็อกตัวเลขไว้ที่เดียว" (D9) และ "กวาดเลขที่ drift
 * ทั้งเล่มและเด็ค" (D13) ไว้เป็นงานมือ ซึ่งเป็นคำกล่าวอ้างเดียวในโปรเจกต์นี้
 * ที่ไม่มีโค้ดบังคับ และบังเอิญเป็นจุดที่ตัวเลขจะถูกคัดลอกด้วยมือมากที่สุด
 * ตอนใกล้เส้นตายที่สุด
 *
 * ทุกตัวเลขในไฟล์ที่สร้างออกมา มาจาก results/numbers.json ซึ่ง analyze.mjs เขียน
 * พร้อมกับ report.md ตัวเดียวกัน ถ้าอยากได้เลขใหม่ ให้รัน analyze ใหม่ ไม่ใช่แก้ไฟล์นี้
 *
 *   node scripts/make-results-doc.mjs
 *   node scripts/make-results-doc.mjs --in results/numbers.json --out report/ch5-results.md
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderResultsDoc, loadNumbers } from './lib/results-doc.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = (f, d) => { const i = process.argv.indexOf(f); return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };

const IN = path.resolve(ROOT, argv('--in', 'results/numbers.json'));
const OUT = path.resolve(ROOT, argv('--out', 'report/ch5-results.md'));

const numbers = loadNumbers(IN);
const text = renderResultsDoc(numbers);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, text);

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
console.log(`เขียนแล้ว: ${rel(OUT)} (${text.split('\n').length} บรรทัด) จาก ${rel(IN)}`);
if (numbers.simulated) {
  console.log('⚠️  ตัวเลขชุดนี้มาจาก mock adapter — เอกสารถูกประทับหัวไว้แล้วว่าห้ามอ้างเป็นผล');
}
