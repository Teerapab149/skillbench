#!/usr/bin/env node
/**
 * make-slide-numbers.mjs — บล็อกตัวเลขสำหรับเด็ค สร้างจากข้อมูลชุดเดียวกับเล่ม
 *
 * เด็คกับเล่มขัดกันเองเป็นความผิดพลาดที่กรรมการจับได้ง่ายที่สุด และเกิดง่ายที่สุด
 * เพราะสองไฟล์ถูกแก้คนละเวลา ไฟล์นี้ตัดต้นเหตุออก: เด็คไม่มีเลขเป็นของตัวเอง
 * มีแต่เลขที่คัดลอกมาจากบล็อกที่สร้างจาก results/numbers.json
 *
 *   node scripts/make-slide-numbers.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSlideNumbers, loadNumbers } from './lib/results-doc.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = (f, d) => { const i = process.argv.indexOf(f); return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };

const IN = path.resolve(ROOT, argv('--in', 'results/numbers.json'));
const OUT = path.resolve(ROOT, argv('--out', 'SLIDE-NUMBERS.md'));

const numbers = loadNumbers(IN);
const text = renderSlideNumbers(numbers);
fs.writeFileSync(OUT, text);

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
console.log(`เขียนแล้ว: ${rel(OUT)} (${text.split('\n').length} บรรทัด) จาก ${rel(IN)}`);
