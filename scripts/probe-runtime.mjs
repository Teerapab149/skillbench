/**
 * probe-runtime.mjs — หา flag ที่ทำให้ runtime สะอาดจริง "ก่อน" เผาโควตากับข้อมูลหลัก
 *
 * ที่ต้องมีสคริปต์นี้เพราะ config ประกาศตัวแปรควบคุมไว้ แต่ไม่มีอะไรพิสูจน์ว่าบังคับได้จริง
 * ตรวจย้อนหลังใน artifact ที่เก็บไว้แล้วพบว่า `--tools` ไม่ได้จำกัดชุด tool
 * (ได้ 31–47 ตัว รวม MCP ของ Canva/Google Drive) และ skill ส่วนตัวของเครื่องคนรัน
 * ปรากฏใน available set ของทุก arm รวม A0/A1 ที่นิยามว่าไม่มี skill
 *
 * สคริปต์นี้ยิง prompt สั้นที่สุดเท่าที่จะทำได้ต่อหนึ่ง combo แล้วอ่าน system:init กลับมา
 * ไม่ใช่ข้อมูลหลัก ไม่เข้า checkpoint ไม่เข้า results/
 *
 *   node scripts/probe-runtime.mjs
 *   node scripts/probe-runtime.mjs --arm A2      # ตรวจว่า skill ของ arm ยังมาถึงไหม
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { installArm, uninstallArm } from '../src/install-arm.mjs';
import { resolveClaudeBin } from '../src/adapters/claude-cli.mjs';
import { lockFixtureForProcess } from '../src/fixture-lock.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/arms.json'), 'utf8'));
const CWD = path.join(ROOT, 'fixtures/gpu-booking');

// --arm ติดตั้ง arm ลง fixture จริง และ probe ยิง CLI จริงหลายรอบ ระหว่างนั้นห้ามใครแตะ
lockFixtureForProcess(CWD, 'probe-runtime');

const argv = (flag, dflt = '') => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};

const DECLARED = [...new Set([...(config.fixedFactors?.toolset ?? []), 'Skill'])];
const ARM_SKILLS = ['acceptance-first', 'impact-analysis', 'safe-shell', 'trace-to-requirement'];

/** combo ที่จะลอง — เรียงจากของที่ใช้อยู่จริง ไปหาของที่รัดกุมขึ้นทีละชั้น */
const COMBOS = [
  { id: 'current', desc: 'ที่ใช้อยู่ตอนนี้', args: ['--setting-sources', 'project'] },
  { id: 'strictmcp', desc: '+ --strict-mcp-config', args: ['--setting-sources', 'project', '--strict-mcp-config'] },
  { id: 'nosrc', desc: 'ไม่ระบุ setting-sources เลย + strict mcp', args: ['--strict-mcp-config'] },
  { id: 'emptycfg', desc: '+ CLAUDE_CONFIG_DIR ชี้ไปโฟลเดอร์ว่าง', args: ['--setting-sources', 'project', '--strict-mcp-config'], isolateConfigDir: true },
];

// ใช้ตัวเดียวกับ adapter จริง — บน Windows การ spawn .cmd โดยไม่ผ่าน shell จะได้ EINVAL
const CLAUDE = resolveClaudeBin();
const quoteWin = (a) => (/[\s"%&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

function runOnce(extraArgs, env) {
  return new Promise((resolve) => {
    const args = [
      '-p', 'reply with the single word: ok',
      '--output-format', 'stream-json', '--verbose',
      '--model', config.fixedFactors?.model ?? 'claude-sonnet-5',
      '--max-turns', '1',
      '--permission-mode', 'bypassPermissions',
      ...extraArgs,
      '--tools', DECLARED.join(','),
    ];
    const spawnEnv = { ...process.env, ...env };
    const child = CLAUDE.mode === 'direct'
      ? spawn(CLAUDE.bin, args, { cwd: CWD, env: spawnEnv })
      : spawn([CLAUDE.bin, ...args.map(quoteWin)].join(' '), { cwd: CWD, shell: true, env: spawnEnv });
    let buf = '', init = null, stderr = '';
    const timer = setTimeout(() => child.kill(), 120000);
    child.stdout.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n'); buf = lines.pop() ?? '';
      for (const l of lines) {
        if (!l.trim()) continue;
        try {
          const e = JSON.parse(l);
          if (e.type === 'system' && e.subtype === 'init') init = e;
        } catch { /* ไม่ใช่ json ข้ามไป */ }
      }
    });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => { stderr += e.message; clearTimeout(timer); resolve({ init, stderr }); });
    child.on('close', () => { clearTimeout(timer); resolve({ init, stderr }); });
  });
}

const arm = argv('--arm', '');
if (arm) {
  const a = config.arms.find((x) => x.id === arm);
  if (!a) { console.error(`ไม่รู้จัก arm ${arm}`); process.exit(1); }
  installArm({ workspace: CWD, arm: a });
  // ถ้าสคริปต์ตายกลางคันแล้วไม่ถอน ไฟล์ของ arm จะค้างใน fixture
  // แล้วถูกนับเป็นผลงานของเอเจนต์ใน run ถัดไป — เคยเป็นข้อบกพร่องมาแล้ว
  process.on('exit', () => { try { uninstallArm(CWD); } catch { /* ปิดเงียบตอน exit */ } });
  console.log(`ติดตั้ง arm ${arm} ลง workspace แล้ว\n`);
}

console.log('probe runtime — ยิง prompt สั้นที่สุดต่อ combo แล้วอ่าน system:init\n');
console.log(`  claude bin: ${CLAUDE.bin}  (mode=${CLAUDE.mode}, how=${CLAUDE.how})`);
console.log(`tool ที่ประกาศไว้ (${DECLARED.length}): ${DECLARED.join(',')}\n`);

const rows = [];
for (const c of COMBOS) {
  const env = {};
  let tmp = null;
  if (c.isolateConfigDir) {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfg-'));
    env.CLAUDE_CONFIG_DIR = tmp;
  }
  process.stdout.write(`  ${c.id.padEnd(10)} ${c.desc} ... `);
  const { init, stderr } = await runOnce(c.args, env);
  if (!init) {
    console.log(`ไม่มี init event — ${(stderr || 'ไม่ทราบสาเหตุ').split('\n')[0].slice(0, 90)}`);
    rows.push({ ...c, ok: false, note: 'no init' });
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    continue;
  }
  const tools = init.tools ?? [];
  const skills = init.skills ?? [];
  const r = {
    id: c.id,
    tools: tools.length,
    mcpTools: tools.filter((t) => String(t).startsWith('mcp__')).length,
    mcpServers: (init.mcp_servers ?? []).length,
    armSkills: skills.filter((s) => ARM_SKILLS.includes(s)).length,
    foreignSkills: skills.filter((s) => !ARM_SKILLS.includes(s)).length,
    slash: (init.slash_commands ?? []).length,
    auth: init.apiKeySource ?? '?',
    memory: init.memory_paths?.auto ? 'มี' : 'ไม่มี',
    version: init.claude_code_version ?? '?',
  };
  rows.push(r);
  console.log('เสร็จ');
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
}

if (arm) uninstallArm(CWD);

console.log('\n| combo | tools | mcp tool | mcp srv | arm skills | foreign skills | slash | auth | auto-memory |');
console.log('|---|---:|---:|---:|---:|---:|---:|---|---|');
for (const r of rows) {
  if (r.ok === false) { console.log(`| ${r.id} | — | — | — | — | — | — | ${r.note} | — |`); continue; }
  console.log(`| ${r.id} | ${r.tools} | ${r.mcpTools} | ${r.mcpServers} | ${r.armSkills} | ${r.foreignSkills} | ${r.slash} | ${r.auth} | ${r.memory} |`);
}

console.log('\nสิ่งที่ต้องได้จึงจะเรียกว่าสะอาด:');
console.log(`  tools = ${DECLARED.length} เป๊ะ · mcp tool = 0 · mcp srv = 0 · foreign skills = 0`);
console.log(`  auth ต้องยังเป็น "none" (= subscription) ถ้าเปลี่ยนไปเป็น ANTHROPIC_API_KEY แปลว่าเริ่มจ่ายรายโทเคนจริง`);
if (arm === 'A2' || arm === 'A4') console.log('  และ arm skills ต้อง = 4 มิฉะนั้น flag นั้นฆ่าตัวแปรต้นทิ้ง');
