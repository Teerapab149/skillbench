#!/usr/bin/env node
/*
 * รับ attempt ที่ตัวป้องกัน runtime หยุดไว้ เข้าชุดข้อมูล ตามนโยบายที่ประกาศไว้ล่วงหน้า — DEVIATIONS-3 D5
 *
 * ใช้ได้เฉพาะกรณีเดียว: violation ข้อเดียวคือ "เรียก skill นอกการทดลอง" ที่ชื่อเป็นชื่อ skill ของการทดลอง
 * ที่พิมพ์เพี้ยน (เช่น "trace-to-requirement... ") และไม่มี skill ใดโหลดเข้าบริบท (loadedSkills ว่าง)
 * PRE-REGISTRATION-2 §7.1: เรียกแล้วไม่เจอ = ไม่ปนเปื้อน = เก็บ run นั้นแล้วเดินต่อ
 *
 * ไม่แก้โค้ด harness (digest ของการทดลองไม่เปลี่ยน) · ให้คะแนนด้วย gradeRun ตัวเดิม
 * ใช้: node scripts/study3/admit-attempt.mjs <runId>
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { AttemptStore, writeProjectionJson } from '../../src/attempt-store.mjs';
import { gradeRun } from '../../src/graders.mjs';
import { EXPERIMENT_SKILLS } from '../../src/runtime-manifest.mjs';

const OUT = 'results-study3';
const runId = process.argv[2];
if (!runId) throw new Error('ต้องระบุ runId');

const ckptFile = fs.readdirSync(OUT).find((f) => /^checkpoint-[0-9a-f]{12}\.json$/.test(f));
const ckptPath = path.join(OUT, ckptFile);
const ckpt = JSON.parse(fs.readFileSync(ckptPath, 'utf8'));
const sigHash = crypto.createHash('sha256').update(ckpt.signature).digest('hex').slice(0, 12);
if (`checkpoint-${sigHash}.json` !== ckptFile) throw new Error('signature ไม่ตรงกับชื่อ checkpoint');
if (ckpt.artifacts.some((a) => a.runId === runId)) throw new Error(`${runId} อยู่ใน checkpoint แล้ว`);

const store = AttemptStore.open({ outDir: OUT, signatureHash: sigHash, signature: ckpt.signature });
if (store.experimentId !== ckpt.experimentId) throw new Error('experimentId ไม่ตรงกัน');
const attempts = store.attemptsFor(runId);
if (attempts.length !== 1) throw new Error(`คาดว่ามี 1 attempt แต่มี ${attempts.length}`);
const attempt = attempts[0];
const files = fs.readdirSync(attempt.dir);
const disp = files.filter((f) => f.startsWith('disposition-')).map((f) => JSON.parse(fs.readFileSync(path.join(attempt.dir, f), 'utf8')));
const viol = disp.find((d) => d.reason === 'runtime_violations');
if (!viol) throw new Error('ไม่มี runtime_violations');
// ตัวคุมบันทึก checkpoint_committed (scheduler: stop) ตอนหยุดอยู่แล้ว แต่ artifact ไม่ได้อยู่ใน checkpoint — เช็กจาก checkpoint ข้างบนแทน

// เงื่อนไขที่รับได้ — ข้ออื่นใดก็ตามห้ามรับ
const m = viol.details.length === 1 && /^เรียก skill นอกการทดลอง: (.+)$/.exec(viol.details[0]);
if (!m) throw new Error(`violation ไม่ใช่กรณีที่รับได้: ${JSON.stringify(viol.details)}`);
const names = m[1].split(', ');
const norm = (s) => s.trim().replace(/[.\s…]+$/, '');
if (!names.every((n) => EXPERIMENT_SKILLS.includes(norm(n)))) throw new Error(`ชื่อ skill ไม่ใช่ชื่อของการทดลองที่พิมพ์เพี้ยน: ${names}`);
const { artifact, state } = JSON.parse(fs.readFileSync(path.join(attempt.dir, 'artifact.json'), 'utf8'));
if (artifact.error) throw new Error('artifact มี error');
if ((artifact.loadedSkills ?? []).length) throw new Error(`มี skill โหลดเข้าบริบท: ${artifact.loadedSkills}`);
if (state.execution !== 'returned' || state.termination !== 'completed' || state.measurement !== 'valid') {
  throw new Error(`สถานะ artifact ไม่ปกติ: ${JSON.stringify(state)}`);
}

const scenario = JSON.parse(fs.readFileSync(path.join('scenarios', `${artifact.scenarioId}.json`), 'utf8'));
const graded = gradeRun(artifact, scenario);

fs.copyFileSync(ckptPath, `${ckptPath}.before-admit-${runId}.bak`);
const base = { execution: 'returned', termination: 'completed', measurement: 'valid', runtime: 'violations', grading: 'graded' };
store.recordDisposition(attempt, { ...base, scheduler: 'continue', reason: 'admitted_by_researcher',
  details: [`DEVIATIONS-3 D5 · PRE-REGISTRATION-2 §7.1: failed call to misspelled experiment skill ${JSON.stringify(names)}, loadedSkills empty = not contamination`] });
writeProjectionJson(ckptPath, { ...ckpt, savedAt: new Date().toISOString(),
  artifacts: [...ckpt.artifacts, artifact], graded: [...ckpt.graded, graded] });
store.recordDisposition(attempt, { ...base, scheduler: 'continue', reason: 'checkpoint_committed' });
console.log(`รับ ${runId} แล้ว · checkpoint ${ckpt.artifacts.length} -> ${ckpt.artifacts.length + 1}`);
