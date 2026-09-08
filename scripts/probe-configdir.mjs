/**
 * probe-configdir.mjs — ตรวจว่าการแยก CLAUDE_CONFIG_DIR ใช้ได้จริงหรือพังเงียบ
 *
 * ต้องรู้ 3 อย่างก่อนจะเอาไปใช้กับข้อมูลหลัก:
 *   1. request วิ่งจนจบจริงไหม (ไม่ใช่แค่มี init event แล้วตายตอน auth)
 *   2. auth ยังเป็น subscription อยู่ไหม (ถ้าเด้งไป ANTHROPIC_API_KEY = เริ่มจ่ายรายโทเคน)
 *   3. auto-memory ย้ายตามไปอยู่ในโฟลเดอร์ชั่วคราวไหม (= แยกได้จริง ว่างทุก run)
 *
 *   node scripts/probe-configdir.mjs
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolveClaudeBin } from '../src/adapters/claude-cli.mjs';
import { lockFixtureForProcess } from '../src/fixture-lock.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/arms.json'), 'utf8'));
const CWD = path.join(ROOT, 'fixtures/gpu-booking');

/*
 * สคริปต์นี้ไม่ได้สั่ง git เอง แต่ยิง CLI จริงโดยใช้ fixture เป็น cwd ด้วย bypassPermissions
 * เอเจนต์จึงเขียนไฟล์ลงไปได้ และไฟล์นั้นจะถูกนับเป็นผลงานของ run ที่กำลังเดินอยู่
 * เป็นการแตะ fixture คนละแบบกับตัวอื่น แต่ปนเปื้อนข้อมูลได้เหมือนกัน
 */
lockFixtureForProcess(CWD, 'probe-configdir');
const CLAUDE = resolveClaudeBin();
const DECLARED = [...new Set([...(config.fixedFactors?.toolset ?? []), 'Skill'])];
const quoteWin = (a) => (/[\s"%&|<>^]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);

function run(extraArgs, env, label) {
  return new Promise((resolve) => {
    const args = [
      '-p', 'reply with the single word: ok',
      '--output-format', 'stream-json', '--verbose',
      '--model', config.fixedFactors?.model ?? 'claude-sonnet-5',
      '--max-turns', '1', '--permission-mode', 'bypassPermissions',
      ...extraArgs, '--tools', DECLARED.join(','),
    ];
    const spawnEnv = { ...process.env, ...env };
    const child = CLAUDE.mode === 'direct'
      ? spawn(CLAUDE.bin, args, { cwd: CWD, env: spawnEnv })
      : spawn([CLAUDE.bin, ...args.map(quoteWin)].join(' '), { cwd: CWD, shell: true, env: spawnEnv });
    let buf = '', stderr = '';
    const events = [];
    const timer = setTimeout(() => child.kill(), 120000);
    child.stdout.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n'); buf = lines.pop() ?? '';
      for (const l of lines) { if (l.trim()) { try { events.push(JSON.parse(l)); } catch { /* ข้าม */ } } }
    });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (e) => { stderr += e.message; clearTimeout(timer); resolve({ events, stderr, label }); });
    child.on('close', () => { clearTimeout(timer); resolve({ events, stderr, label }); });
  });
}

function report({ events, stderr, label }, tmp) {
  const init = events.find((e) => e.type === 'system' && e.subtype === 'init');
  const res = events.find((e) => e.type === 'result');
  console.log(`\n--- ${label} ---`);
  if (!init) { console.log(`  ไม่มี init event · stderr: ${(stderr || '?').split('\n')[0].slice(0, 120)}`); return; }
  const tools = init.tools ?? [];
  console.log(`  tools           ${tools.length}  (mcp ${tools.filter((t) => String(t).startsWith('mcp__')).length})`);
  console.log(`  mcp_servers     ${(init.mcp_servers ?? []).length}`);
  console.log(`  skills          ${(init.skills ?? []).length}`);
  console.log(`  apiKeySource    ${init.apiKeySource}`);
  console.log(`  cli version     ${init.claude_code_version}`);
  console.log(`  memory auto     ${init.memory_paths?.auto ?? '(ไม่มี)'}`);
  if (tmp) console.log(`  memory อยู่ใน tmp?  ${String(init.memory_paths?.auto ?? '').startsWith(tmp) ? 'ใช่ — แยกได้จริง' : 'ไม่ใช่ — ยังชี้กลับที่เดิม'}`);
  console.log(`  result subtype  ${res?.subtype ?? '(ไม่มี result event)'}`);
  console.log(`  is_error        ${res?.is_error}`);
  console.log(`  ข้อความตอบกลับ   ${JSON.stringify(String(res?.result ?? '').slice(0, 60))}`);
  console.log(`  turns / cost    ${res?.num_turns} / ${res?.total_cost_usd}`);
}

const baseArgs = ['--setting-sources', 'project', '--strict-mcp-config'];

report(await run(baseArgs, {}, 'A. setting-sources project + strict-mcp (ไม่แตะ config dir)'), null);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccfg-'));
report(await run(baseArgs, { CLAUDE_CONFIG_DIR: tmp }, `B. + CLAUDE_CONFIG_DIR=${tmp}`), tmp);
console.log(`\n  ไฟล์ที่ถูกสร้างใน config dir ชั่วคราว: ${fs.existsSync(tmp) ? fs.readdirSync(tmp).join(', ') || '(ว่าง)' : '(หายไป)'}`);
fs.rmSync(tmp, { recursive: true, force: true });
