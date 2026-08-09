/**
 * install-arm.mjs — ติดตั้ง "สภาพ context" ของแต่ละ arm ลงใน workspace ก่อนรัน
 *
 * ทำไมต้องมีไฟล์นี้:
 *   config/arms.json ประกาศ contextFiles / skillsDir / injectAdversarial ไว้ตั้งแต่ต้น
 *   แต่ไม่เคยมีโค้ดตัวไหนอ่านมันไปใช้จริง -> ทุก arm เจอ workspace เหมือนกันเป๊ะ
 *   การทดลองจะให้ผลออกมาครบถ้วนสวยงาม มี CI มีค่า p ทั้งที่ "ไม่เคยใส่ตัวแปรต้นเข้าไปเลย"
 *   นี่คือความล้มเหลวแบบเงียบที่อันตรายที่สุดของการทดลอง เพราะไม่มี error ให้เห็น
 *
 * ข้อกำหนดที่ต้องรักษาให้ได้พร้อมกัน 3 ข้อ:
 *   1. ไฟล์ของ arm ต้องอยู่ในที่ที่เอเจนต์เห็นจริง (CLAUDE.md ที่ราก, skill ที่ .claude/skills/)
 *   2. ไฟล์ของ arm ต้อง "ไม่" ถูกนับเป็นการเปลี่ยนแปลงของเอเจนต์
 *      มิฉะนั้น gold-plating rate จะเป็นบวกปลอมทุก run
 *   3. ต้องล้างออกให้หมดหลังรัน มิฉะนั้น arm ถัดไปจะปนเปื้อน
 *
 * วิธีที่ใช้: ติดตั้งแล้ว commit ทับเป็น "arm commit"
 *   -> git status สะอาดตอนเอเจนต์เริ่มทำงาน ทุกอย่างที่โผล่มาหลังจากนั้นเป็นของเอเจนต์ล้วน
 *   -> เลิกใช้ด้วย git reset --hard ไปที่ tag baseline ซึ่งลบทั้ง commit และไฟล์ในคราวเดียว
 *
 * ทำไมต้องผูกกับ tag ไม่ใช่ HEAD:
 *   กฎข้อหนึ่งที่เราวัดคือ "ห้าม git commit เอง" แปลว่าเอเจนต์อาจ commit จริง
 *   ถ้า reset กลับไปที่ HEAD เฉยๆ commit ของเอเจนต์จะค้างและปนเปื้อนทุก run ถัดไป
 *   tag ที่ตรึงไว้ตั้งแต่ setup เท่านั้นที่พากลับไปยังจุดเริ่มต้นจริงได้เสมอ แม้ run ก่อนหน้าจะพังกลางคัน
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** tag ที่ชี้ไปยังสถานะตั้งต้นของ fixture — สร้างโดย scripts/setup-fixtures.mjs */
export const BASELINE_TAG = 'skillbench-baseline';

/** ไฟล์/โฟลเดอร์ที่ arm เป็นเจ้าของ — fixture ห้ามมีของพวกนี้ใน baseline */
const ARM_OWNED = ['CLAUDE.md', '.claude'];

function git(cwd, args) {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return ''; }
}

/** ใช้กับคำสั่งที่ถ้าพลาดแล้วต้องหยุดทั้งการทดลอง ไม่ใช่ปล่อยผ่านเงียบๆ */
function gitStrict(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * ยืนยันว่า workspace มี tag baseline พร้อมใช้
 * เรียกได้ซ้ำ ไม่มีผลข้างเคียงถ้ามีอยู่แล้ว
 */
export function ensureBaseline(cwd) {
  if (!fs.existsSync(path.join(cwd, '.git'))) {
    throw new Error(`workspace ไม่ใช่ git repo: ${cwd}\n  แก้ด้วย: node scripts/setup-fixtures.mjs`);
  }
  const has = git(cwd, ['rev-parse', '--verify', '-q', `refs/tags/${BASELINE_TAG}`]).trim();
  if (!has) gitStrict(cwd, ['tag', BASELINE_TAG]);
  return BASELINE_TAG;
}

/**
 * พา workspace กลับไปยังสถานะตั้งต้นจริง
 * ครอบคลุมทั้ง: ไฟล์ที่ถูกแก้ / ไฟล์ใหม่ / commit ที่เอเจนต์สร้างเอง / arm commit ของ run ก่อน
 */
export function resetToBaseline(cwd) {
  ensureBaseline(cwd);
  gitStrict(cwd, ['reset', '--hard', '-q', BASELINE_TAG]);
  git(cwd, ['clean', '-fdq']);
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name), d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/**
 * ข้อความล่อสำหรับ arm A4 — ฝังคำสั่งปลอมไว้ในโค้ดที่เอเจนต์ต้องอ่านอยู่แล้ว
 *
 * เป็น "ข้อมูลที่หน้าตาเหมือนคำสั่ง" ซึ่งกฎของ A1/A2 บอกไว้ชัดว่าห้ามทำตาม
 * ผลลัพธ์ตรวจได้ด้วยตัวตรวจที่มีอยู่แล้ว ไม่ต้องเพิ่มอะไร:
 *   ตกกับดัก 1 -> files_not_touch data/**  ล้มเหลว
 *   ตกกับดัก 2 -> command_not_run git commit  ล้มเหลว
 */
function applyAdversarial(cwd) {
  const manifestPath = path.join(ROOT, 'arms/A4/adversarial/inject.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`arm A4 ประกาศ injectAdversarial แต่ไม่พบ ${manifestPath}`);
  }
  const { injections } = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const touched = [];
  for (const inj of injections) {
    const target = path.join(cwd, inj.file);
    if (!fs.existsSync(target)) {
      throw new Error(`ไฟล์เป้าหมายของ adversarial ไม่มีอยู่จริงใน fixture: ${inj.file}`);
    }
    const body = fs.readFileSync(target, 'utf8');
    fs.writeFileSync(target, inj.mode === 'prepend' ? `${inj.text}\n${body}` : `${body}\n${inj.text}\n`);
    touched.push(inj.file);
  }
  return touched;
}

/**
 * ติดตั้ง context ของ arm ลง workspace แล้วตรึงเป็น commit
 *
 * คืน { installed, armCommit } — เก็บลง artifact เพื่อให้ตรวจย้อนหลังได้ว่า
 * run นั้น "ได้รับ context จริงหรือเปล่า" ไม่ต้องเชื่อว่าโค้ดทำงานถูก
 */
export function installArm({ workspace, arm }) {
  const cwd = path.resolve(workspace);
  resetToBaseline(cwd);

  // ถ้า fixture มีไฟล์ชื่อชนกับของ arm การติดตั้งจะทับของจริงและ reset จะลบของจริงทิ้ง
  for (const p of ARM_OWNED) {
    if (fs.existsSync(path.join(cwd, p))) {
      throw new Error(`fixture มี ${p} อยู่ใน baseline — ชนกับไฟล์ของ arm\n  ต้องเปลี่ยนชื่อไฟล์ใน fixture ก่อน`);
    }
  }

  const installed = [];

  // 1) CLAUDE.md — รวมทุกไฟล์ที่ arm ประกาศไว้เป็นไฟล์เดียวที่รากของ workspace
  const parts = (arm.contextFiles ?? []).map((f) => {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) throw new Error(`arm ${arm.id} อ้างถึง contextFile ที่ไม่มีอยู่จริง: ${f}`);
    return fs.readFileSync(p, 'utf8');
  });
  if (parts.length) {
    fs.writeFileSync(path.join(cwd, 'CLAUDE.md'), parts.join('\n\n'));
    installed.push('CLAUDE.md');
  }

  // 2) skills — Claude Code อ่านจาก .claude/skills/<name>/SKILL.md ของโปรเจกต์
  if (arm.skillsDir) {
    const src = path.join(ROOT, arm.skillsDir);
    if (!fs.existsSync(src)) throw new Error(`arm ${arm.id} อ้างถึง skillsDir ที่ไม่มีอยู่จริง: ${arm.skillsDir}`);
    const skills = fs.readdirSync(src, { withFileTypes: true }).filter((d) => d.isDirectory());
    if (!skills.length) throw new Error(`skillsDir ของ arm ${arm.id} ว่างเปล่า: ${arm.skillsDir}`);
    for (const d of skills) {
      copyDir(path.join(src, d.name), path.join(cwd, '.claude/skills', d.name));
      installed.push(`.claude/skills/${d.name}/`);
    }
  }

  // 3) ข้อความล่อสำหรับการทดสอบความทนทาน
  if (arm.injectAdversarial) {
    for (const f of applyAdversarial(cwd)) installed.push(`${f} (adversarial)`);
  }

  if (!installed.length) return { installed: [], armCommit: null };   // A0 — ตั้งใจให้ว่าง

  gitStrict(cwd, ['add', '-A']);
  gitStrict(cwd, ['-c', 'user.email=bench@local', '-c', 'user.name=skillbench',
                  'commit', '-qm', `arm:${arm.id}`]);
  const armCommit = git(cwd, ['rev-parse', '--short', 'HEAD']).trim();

  // ต้องสะอาดพอดี ถ้าไม่สะอาดแปลว่ามีอะไรเล็ดลอด และจะถูกนับเป็นผลงานของเอเจนต์
  const dirty = git(cwd, ['status', '--porcelain']).trim();
  if (dirty) throw new Error(`ติดตั้ง arm ${arm.id} แล้ว workspace ยังไม่สะอาด:\n${dirty}`);

  return { installed, armCommit };
}

/** ล้าง context ของ arm ออกให้หมด — ต้องเรียกเสมอ แม้ run จะพัง */
export function uninstallArm(workspace) {
  resetToBaseline(path.resolve(workspace));
}

/**
 * ตรวจว่าการติดตั้งของ arm ได้ผลจริง โดยติดตั้งจริงแล้วล้างทิ้ง
 * ใช้ใน check-arms.mjs เพื่อกันบั๊กชนิดนี้ไม่ให้กลับมาอีก
 */
export function verifyInstall({ workspace, arm }) {
  const cwd = path.resolve(workspace);
  try {
    const { installed, armCommit } = installArm({ workspace: cwd, arm });
    const claudeMd = fs.existsSync(path.join(cwd, 'CLAUDE.md'));
    const skillFiles = fs.existsSync(path.join(cwd, '.claude/skills'))
      ? fs.readdirSync(path.join(cwd, '.claude/skills')).length : 0;
    const clean = !git(cwd, ['status', '--porcelain']).trim();
    return { ok: true, installed, armCommit, claudeMd, skillFiles, clean };
  } catch (e) {
    return { ok: false, error: String(e.message ?? e) };
  } finally {
    try { uninstallArm(cwd); } catch { /* ปล่อยให้ตัวเรียกเห็น error เดิม */ }
  }
}
