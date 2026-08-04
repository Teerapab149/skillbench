/**
 * adapters/claude-cli.mjs — adapter ตัวจริง เรียก Claude Code CLI แบบ headless
 *
 * เหตุผลที่แยกเป็น adapter: หัวข้อสัมมนาคุณเคลมว่า "นำไปใช้กับเครื่องมือพัฒนาใดก็ได้"
 * การเคลมนั้นจะน่าเชื่อก็ต่อเมื่อ harness เปลี่ยน adapter ได้โดยไม่แตะ scenario/grader/stats เลย
 * ถ้าทำ adapter ตัวที่สองได้จริง (เช่น Cursor CLI, Codex CLI, Gemini CLI) นั่นคือหลักฐานของการเคลมนั้น
 *
 * ข้อมูลที่ต้องเก็บให้ครบ ไม่งั้น grader ตรวจไม่ได้:
 *   toolCalls (ชื่อ + argument) / commands (bash) / filesChanged + diff (จาก git) / finalMessage / usage
 */

import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

function git(cwd, args) {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch { return ''; }
}

/** รีเซ็ต workspace ให้สะอาดก่อนทุก run — ถ้าไม่ทำ run ที่ n จะปนเปื้อนจาก run ที่ n-1 */
export function resetWorkspace(cwd) {
  git(cwd, ['checkout', '--', '.']);
  git(cwd, ['clean', '-fdq']);
}

/**
 * รันคำสั่ง probe แล้วเก็บผลไว้เทียบก่อน-หลัง
 *
 * ใช้วัดผลกระทบที่มองไม่เห็นจาก diff เช่น ยอดใบแจ้งหนี้ย้อนหลังเปลี่ยนไหม
 * ต้องรันทั้งก่อนและหลังการทำงานของเอเจนต์ ด้วยคำสั่งเดียวกันเป๊ะ
 */
function runProbes(cwd, probes) {
  const out = {};
  for (const probe of probes ?? []) {
    try {
      out[probe.id] = execFileSync(probe.command, {
        cwd, shell: true, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch (e) {
      out[probe.id] = `PROBE_FAILED: ${String(e.message ?? e).slice(0, 200)}`;
    }
  }
  return out;
}

export async function runClaudeCli({ scenario, arm, repIndex, seed, workspace, timeoutMs = 300000, model = 'claude-opus-5' }) {
  const cwd = path.resolve(workspace);
  resetWorkspace(cwd);

  // วัดค่าตั้งต้นก่อนเอเจนต์เริ่มทำงาน — ต้องอยู่หลัง reset เพื่อให้เป็นสถานะสะอาดเสมอ
  const probesBefore = runProbes(cwd, scenario.probes);

  const args = [
    '-p', scenario.prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--model', model,
    '--max-turns', '25',
    '--permission-mode', 'bypassPermissions',  // ต้องรันใน sandbox/VM เท่านั้น
  ];
  if (!arm.skillsEnabled) args.push('--setting-sources', 'project');

  const t0 = Date.now();
  const events = [];
  let stderr = '';

  await new Promise((resolve) => {
    const child = spawn('claude', args, { cwd, shell: process.platform === 'win32' });
    let buf = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (line) { try { events.push(JSON.parse(line)); } catch { /* ข้ามบรรทัดที่ไม่ใช่ json */ } }
      }
    });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', () => { clearTimeout(timer); resolve(); });
    child.on('error', (e) => { stderr += e.message; clearTimeout(timer); resolve(); });
  });

  // --- แกะ tool call ออกจาก stream ---
  const toolCalls = [], commands = [], loadedSkills = [];
  let finalMessage = '', inputTokens = 0, outputTokens = 0;

  for (const ev of events) {
    if (ev.type === 'assistant' && ev.message?.content) {
      for (const block of ev.message.content) {
        if (block.type === 'tool_use') {
          toolCalls.push({ name: block.name, args: block.input });
          if (block.name === 'Bash' && block.input?.command) commands.push(block.input.command);
          if (block.name === 'Skill' && block.input?.skill) loadedSkills.push(block.input.skill);
        }
      }
      inputTokens += ev.message?.usage?.input_tokens ?? 0;
      outputTokens += ev.message?.usage?.output_tokens ?? 0;
    }
    if (ev.type === 'result') {
      finalMessage = ev.result ?? finalMessage;
      inputTokens = ev.usage?.input_tokens ?? inputTokens;
      outputTokens = ev.usage?.output_tokens ?? outputTokens;
    }
  }

  // --- อ่านผลกระทบต่อไฟล์จาก git (ground truth ไม่ใช่คำบอกเล่าของเอเจนต์) ---
  const status = git(cwd, ['status', '--porcelain']);
  const filesChanged = status.split('\n').map((l) => l.slice(3).trim()).filter(Boolean)
    .map((s) => (s.includes(' -> ') ? s.split(' -> ')[1] : s));
  git(cwd, ['add', '-A', '-N']);
  const diff = git(cwd, ['diff']);

  let testsPassed = null;
  if (scenario.verifyCommand) {
    try { execFileSync(scenario.verifyCommand, { cwd, shell: true, stdio: 'ignore' }); testsPassed = true; }
    catch { testsPassed = false; }
  }

  const probesAfter = runProbes(cwd, scenario.probes);

  const artifact = {
    runId: `${scenario.id}__${arm.id}__r${repIndex}`,
    scenarioId: scenario.id, armId: arm.id, repIndex, seed,
    adapter: 'claude-cli', simulated: false, model,
    toolCalls, commands, filesChanged, diff, finalMessage, loadedSkills, testsPassed,
    probes: { before: probesBefore, after: probesAfter },
    usage: { inputTokens, outputTokens, turns: events.filter((e) => e.type === 'assistant').length, wallMs: Date.now() - t0 },
    error: events.length === 0 ? (stderr.slice(0, 500) || 'no events from CLI') : null,
    rawEvents: events,   // เก็บ transcript ดิบไว้ เพื่อให้ตรวจซ้ำย้อนหลังได้
  };

  resetWorkspace(cwd);
  return artifact;
}
