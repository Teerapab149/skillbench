#!/usr/bin/env node
/**
 * ตัวคุมการเก็บข้อมูล — ยิง runner ซ้ำจนครบ หรือจนเจอเหตุที่ "ห้ามยิงต่อ"
 *
 * เหตุผลที่ต้องมี: การเก็บข้อมูลถูกยุติกลางคันโดยไม่มีข้อความมาแล้วสี่ครั้ง
 * ที่ 62, 38, 30 และ 77 นาที ทั้งแบบยิงผ่าน background task และแบบ detached
 * สาเหตุยังไม่ทราบ แต่ทุกครั้ง `--resume` เก็บซ่อมได้ครบโดยข้อมูลไม่เสีย
 * ตัวคุมนี้จึงทำสิ่งที่คนทำอยู่แล้วให้เป็นอัตโนมัติ: แกะ lock ที่เจ้าของตายแล้ว
 * แล้วยิงใหม่ · รอโควตาเมื่อชนลิมิตยาว · และ **หยุดทันที** เมื่อเจอเหตุ fail-closed
 *
 * สิ่งที่ตัวคุมนี้ไม่ทำ: ไม่แตะข้อมูล ไม่แกะ lock ที่ยังมีเจ้าของ ไม่ยิงต่อเมื่อ
 * สภาพ runtime ไม่ตรงกับที่ตรึงไว้ หรือเมื่อการยืนยันตัวตนหมดอายุ — สองอย่างนั้น
 * ต้องให้คนตัดสินใจ
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
/*
 * รับพารามิเตอร์ของชุดการทดลอง — เดิมเขียนตายไว้เป็นชุดที่ 1
 *
 * ข้อบกพร่องที่เจอตอนจะเริ่มชุดที่ 2: ตัวคุมยิง runner ด้วย config และ out ของชุดที่ 1
 * แล้วไปหยุดที่การตรวจ manifest ซึ่งถูกต้องตามกลไก แต่แปลว่าถ้ากลไกนั้นไม่มี
 * มันจะเก็บข้อมูลลงชุดที่ผิดเงียบ ๆ
 */
const arg = (flag, dflt) => { const i = process.argv.indexOf(flag); return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt; };
const CONFIG = arg('--config', 'config/arms.json');
const OUT = arg('--out', 'results');
const REPS = arg('--reps', '6');
const LABEL = arg('--label', 'supervised');
const LOG = path.join(ROOT, `evidence/collection-log/${LABEL}.log`);
const TOTAL = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, CONFIG), 'utf8')).preRegisteredAllocation.cells; }
  catch { return 330; }
})();
const MAX_ROUNDS = 60;

const now = () => new Date().toLocaleString('sv-SE');
const out = fs.createWriteStream(LOG, { flags: 'a' });
const say = (s) => { const line = `[ตัวคุม ${now()}] ${s}\n`; out.write(line); process.stdout.write(line); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** พาธหน่วยความจำอัตโนมัติที่ตรึงไว้ใน manifest ของชุดนี้ */
function manifestMemoryPath() {
  try {
    const dir = path.join(ROOT, OUT);
    const f = fs.readdirSync(dir).find((x) => x.startsWith('manifest-'));
    if (!f) return null;
    return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).memoryAutoPath ?? null;
  } catch { return null; }
}

function collected() {
  const dir = path.join(ROOT, OUT);
  if (!fs.existsSync(dir)) return 0;
  const f = fs.readdirSync(dir).find((x) => x.startsWith('checkpoint-'));
  if (!f) return 0;
  try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).graded.length; }
  catch { return 0; }
}

function lockOwnerDead() {
  try {
    const s = execFileSync('node', ['scripts/fixture-lock.mjs', '--status'], { cwd: ROOT, encoding: 'utf8' });
    return /ตายไปแล้ว/.test(s);
  } catch { return false; }
}

/** "resets 4:10am (Asia/Bangkok)" -> ms จนถึงเวลานั้น (+ 5 นาทีเผื่อ) */
function msUntilReset(text) {
  const m = text.match(/resets\s+(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toLowerCase() === 'pm') h += 12;
  const t = new Date();
  t.setHours(h, Number(m[2]) + 5, 0, 0);
  if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1);
  return t.getTime() - Date.now();
}

function runOnce() {
  return new Promise((resolve) => {
    let tail = '';
    const child = spawn('node', ['src/runner.mjs', '--adapter', 'claude-cli', '--config', CONFIG,
      '--out', OUT, '--reps', REPS, '--resume'],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const grab = (buf) => {
      const s = buf.toString('utf8');
      out.write(s);
      tail = (tail + s).slice(-8000);
    };
    child.stdout.on('data', grab);
    child.stderr.on('data', grab);
    child.on('close', (code) => resolve({ code, tail }));
    child.on('error', (e) => resolve({ code: -1, tail: tail + String(e) }));
  });
}

for (let round = 1; round <= MAX_ROUNDS; round += 1) {
  const before = collected();
  if (before >= TOTAL) { say(`ครบ ${before}/${TOTAL} แล้ว — จบ`); break; }

  if (lockOwnerDead()) {
    execFileSync('node', ['scripts/fixture-lock.mjs', '--break'], { cwd: ROOT, encoding: 'utf8' });
    say('แกะ fixture lock ที่เจ้าของตายไปแล้ว');
  }

  if (round === 1) say(`ชุดการทดลอง: ${CONFIG} → ${OUT} · ${REPS} รอบ · เป้าหมาย ${TOTAL} cell`);
  /*
   * ล้างหน่วยความจำอัตโนมัติก่อนเริ่มทุกรอบ
   *
   * 19 ก.ย. 2569: เอเจนต์ในกลุ่ม A1 ใช้ Write เขียนไฟล์หน่วยความจำถาวรออกไป
   * นอก workspace — ไฟล์หนึ่งสรุปกฎของ A1 อีกไฟล์บอกว่า REQ ใดถูกทำไปแล้ว
   * ถ้า run ถัดไปอ่าน จะเท่ากับยกกฎของ A1 ไปให้กลุ่มอื่น และให้เฉลยของ S07
   *
   * ด่านตรวจของ runner จับได้และหยุดทั้งชุดถูกต้องแล้ว แต่ปล่อยไว้แบบนั้นแปลว่า
   * ทุกครั้งที่เกิดต้องมีคนมาล้างเอง การล้างก่อนเริ่มรอบทำให้สถานะก่อน run
   * สะอาดเสมอ โดยไม่ต้องแตะ runner ซึ่งอยู่ใน digest ของการทดลอง
   */
  const memDir = manifestMemoryPath();
  if (memDir && fs.existsSync(memDir)) {
    const left = fs.readdirSync(memDir);
    if (left.length) {
      const stamp = new Date().toISOString().slice(0, 10);
      const keep = path.join(ROOT, `evidence/memory-contamination-${stamp}`);
      fs.mkdirSync(keep, { recursive: true });
      for (const f of left) {
        fs.copyFileSync(path.join(memDir, f), path.join(keep, f));
        fs.rmSync(path.join(memDir, f), { recursive: true, force: true });
      }
      say(`ล้างหน่วยความจำอัตโนมัติ ${left.length} ไฟล์ · สำเนาอยู่ที่ ${path.relative(ROOT, keep)}`);
    }
  }
  say(`รอบที่ ${round} — เริ่มจาก ${before}/${TOTAL}`);
  const { code, tail } = await runOnce();
  const after = collected();
  say(`รอบที่ ${round} จบ · exit ${code} · ${before} -> ${after}/${TOTAL}`);

  if (after >= TOTAL) { say('เก็บครบแล้ว — จบ'); break; }

  if (/สภาพ runtime|ไม่ตรงกับ manifest|baseline skill set/.test(tail)) {
    say('หยุด — สภาพ runtime ไม่ตรงกับที่ตรึงไว้ ต้องให้คนตัดสินใจก่อนยิงต่อ'); process.exit(2);
  }
  if (/oauth|authenticate|not logged in|unauthorized|invalid api key|credential/i.test(tail)) {
    say('หยุด — การยืนยันตัวตนมีปัญหา ต้อง login ก่อน'); process.exit(3);
  }
  if (/session limit/i.test(tail)) {
    const ms = msUntilReset(tail) ?? 20 * 60 * 1000;
    say(`ชนลิมิตยาว — รอ ${Math.round(ms / 60000)} นาทีแล้วยิงต่อ`);
    await sleep(ms);
    continue;
  }
  if (after === before) {
    say('รอบนี้ไม่ได้เพิ่มสักรัน — รอ 5 นาทีกันวนเปล่า');
    await sleep(5 * 60 * 1000);
    continue;
  }
  say('ถูกยุติโดยไม่มีข้อความ (สาเหตุยังไม่ทราบ) — ยิงต่อใน 30 วินาที');
  await sleep(30 * 1000);
}

say('ตัวคุมจบการทำงาน');
out.end();
