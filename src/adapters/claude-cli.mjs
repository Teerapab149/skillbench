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
import fs from 'node:fs';
import path from 'node:path';
import { installArm, uninstallArm } from '../install-arm.mjs';
import { resolveClaudeBin, memoryDirState } from '../claude-bin.mjs';
import { fileURLToPath } from 'node:url';

// re-export ไว้เพื่อไม่ให้ call site เดิม (สคริปต์ probe) พัง — นิยามจริงย้ายไป claude-bin.mjs แล้ว
export { resolveClaudeBin };

/**
 * ใส่เครื่องหมายคำพูดให้ argument สำหรับ cmd.exe บน Windows
 *
 * ทำไมต้องมี: บน Windows เราจำเป็นต้องใช้ shell เพราะ claude เป็น .cmd launcher
 * แต่ Node จะ "ต่อ" argument array เข้าด้วยกันดื้อๆ โดยไม่ escape (DEP0190)
 * ผลคือ prompt ที่มีช่องว่างจะขาดที่ช่องว่างแรก -> เอเจนต์ได้รับโจทย์แค่คำเดียว
 * เคสนี้เกิดจริงและอันตรายมาก เพราะ CLI ไม่ error ทุก arm ตอบว่า "โจทย์ไม่ชัด"
 * แล้วถูกให้คะแนนเป็น "เอเจนต์เลือกไม่ทำ" ทั้งที่จริงคือ harness ส่งโจทย์ไม่ครบ
 */
function quoteWin(arg) {
  const s = String(arg);
  if (s === '') return '""';
  // กฎ MSVCRT: backslash ที่อยู่หน้า " ต้อง escape ตัวมันเองด้วย
  const escaped = s.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1');
  return `"${escaped}"`;
}

// resolveClaudeBin ย้ายไป src/claude-bin.mjs แล้ว (กัน circular import กับ runtime-manifest)


function git(cwd, args) {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); }
  catch { return ''; }
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

/**
 * รันเทสยอมรับของ scenario กับ workspace ที่เอเจนต์ทำเสร็จแล้ว
 *
 * ไฟล์เทสอยู่ที่ scenarios/acceptance/<scenarioId>.test.ts ซึ่งอยู่นอก workspace
 * ตลอดเวลาที่เอเจนต์ทำงาน คัดลอกเข้าไปตอนนี้ รันแล้วลบทิ้งทันที
 * เอเจนต์จึงมองไม่เห็นเฉลย และแก้เทสให้ผ่านไม่ได้ — ซึ่งเป็นสิ่งที่กฎห้ามอยู่แล้ว
 * แต่ห้ามด้วยกฎอย่างเดียวไม่พอเมื่อกฎนั้นคือสิ่งที่เรากำลังวัด
 *
 * ทุกความล้มเหลวคืน ran:false และถือว่าไม่ผ่าน (fail-closed)
 */
function runAcceptance(cwd, scenario) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const src = path.join(ROOT, 'scenarios', 'acceptance');
  const file = `${scenario.id}.test.ts`;
  if (!fs.existsSync(path.join(src, file))) {
    return { ran: false, passed: false, reason: `ไม่มีไฟล์เทสยอมรับ ${file}` };
  }
  const destDir = path.join(cwd, '__acceptance__');
  try {
    fs.rmSync(destDir, { recursive: true, force: true });
    /*
     * ห้ามคัดลอกโฟลเดอร์ reference/ เข้าไปเด็ดขาด — ในนั้นคือเฉลยของทุกโจทย์
     *
     * ถึงจะคัดลอกหลัง run จบและลบทิ้งทันที แต่ถ้าโปรเซสตายคาระหว่างนั้น
     * เฉลยจะค้างอยู่ใน workspace ให้ run ถัดไปเห็น ซึ่งทำลายการทดลองทั้งชุดเงียบ ๆ
     * ต้นทุนของการกันคือหนึ่งบรรทัด ต้นทุนของการไม่กันคือข้อมูลที่ใช้ไม่ได้โดยไม่มีใครรู้
     */
    fs.cpSync(src, destDir, {
      recursive: true,
      filter: (s) => !path.relative(src, s).split(/[\\/]/)[0].startsWith('reference'),
    });
    let passed = true, output = '';
    try {
      output = execFileSync(process.execPath, ['--test', `__acceptance__/${file}`], {
        cwd, encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, GPU_BOOKING_NOW: '2026-03-04T09:00:00.000Z' },
      });
    } catch (e) {
      passed = false;
      output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }
    return {
      ran: true,
      passed,
      // เก็บเหตุผลไว้พอให้ตรวจย้อนหลังได้ว่า assertion ไหนล้ม โดยไม่ทำให้ artifact บวม
      output: String(output).slice(-4000),
    };
  } catch (e) {
    return { ran: false, passed: false, reason: String(e.message ?? e).slice(0, 300) };
  } finally {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
}

/**
 * ประกอบรายชื่อ tool ที่เอเจนต์ใช้ได้ ให้ตรงกับ fixedFactors.toolset ใน config
 *
 * ทำไมต้องบังคับ: ตอน smoke test event init เผยว่า CLI เปิด tool ให้ 31 ตัว
 * (Task, WebSearch, Workflow, ...) ทั้งที่รายงานประกาศไว้ 6 ตัว
 * ไม่กระทบการเปรียบเทียบเพราะทุก arm ได้เท่ากัน แต่ทำให้คนอื่นทำซ้ำไม่ได้
 * และตัวเลข token จะปนกับ tool ที่ไม่เกี่ยวข้อง
 *
 * Skill ต้องมีเสมอ "ทุก arm" แม้ arm นั้นจะไม่มีไฟล์ skill:
 *   ถ้าให้เฉพาะ A2/A4 ชุด tool จะกลายเป็นตัวแปรที่ต่างกันอีกตัวหนึ่ง
 *   แล้วเราจะแยกไม่ออกว่าผลมาจาก "โครงสร้างกฎ" หรือ "มี tool มากกว่า"
 *   ตัวแปรต้นต้องเหลือตัวเดียวคือมีโฟลเดอร์ .claude/skills หรือไม่
 */
/** ดึงบล็อก usage จาก result event — เป็นตัวเดียวที่รายงานยอดสะสมทั้ง run */
function resultUsage(events) {
  return events.find((e) => e.type === 'result')?.usage ?? {};
}

function toolList(fixedFactors) {
  const declared = fixedFactors?.toolset ?? ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'];
  return [...new Set([...declared, 'Skill'])].join(',');
}

export async function runClaudeCli({ scenario, arm, repIndex, seed, workspace, fixedFactors,
                                     // 300 วินาทีสั้นเกินไป: smoke test จริง A0=211s A1=161s A2=301s
                                     // A2 ถูกฆ่าคาที่ 301s -> ไม่มี result event -> finalMessage ว่าง
                                     // กฎที่ตรวจจากข้อความตอบเลยตกหมด ทั้งที่เอเจนต์ทำงานถูกต้อง
                                     timeoutMs = 900000, model, memoryAutoPathHint = null }) {
  /*
   * โมเดลต้องอ่านจาก fixedFactors ไม่ใช่ default parameter
   *
   * เดิมบรรทัดนี้เขียน `model = 'claude-opus-5'` เป็น default parameter ซึ่งไม่มี call site
   * ไหนส่ง model เข้ามาเลย — ค่าใน config/arms.json จึงไม่เคยถูกอ่าน (รูปแบบเดียวกับ
   * ข้อบกพร่องที่ 1 และกรณี maxTurns ด้านล่าง) ถ้าใครแก้ config เป็นโมเดลอื่นแล้วรัน
   * จะได้ Opus ต่อไปเงียบๆ แต่ meta ของไฟล์ผลเขียนชื่อโมเดลใหม่ — dataset ที่ metadata
   * โกหกตัวเอง
   */
  model = model ?? fixedFactors?.model ?? 'claude-opus-5';
  const cwd = path.resolve(workspace);

  // ติดตั้ง "สภาพ context" ของ arm — ตัวแปรต้นเดียวของการทดลองทั้งหมดอยู่ตรงนี้
  // installArm รีเซ็ตกลับ baseline ให้เองก่อนติดตั้ง แล้ว commit ทับเพื่อให้ git status สะอาด
  const install = installArm({ workspace: cwd, arm });

  // วัดค่าตั้งต้นหลังติดตั้ง — ต้องเป็นสถานะเดียวกับที่เอเจนต์เห็นตอนเริ่ม
  const probesBefore = runProbes(cwd, scenario.probes);

  const tools = toolList(fixedFactors);
  const claudeBin = resolveClaudeBin();

  /*
   * auto-memory ปิดด้วย flag ไม่ได้โดยไม่ทำอย่างอื่นพัง
   *   --bare ปิดได้ แต่ปิด CLAUDE.md auto-discovery ไปด้วย ซึ่งคือช่องทางส่ง arm เข้าไป
   *          และบังคับ auth เป็น ANTHROPIC_API_KEY = เปลี่ยนจาก subscription ไปจ่ายรายโทเคน
   *   CLAUDE_CONFIG_DIR ย้าย memory ไปที่ชั่วคราวได้จริง แต่ auth พัง — วัดแล้วได้
   *          "Not logged in" cost 0 โดย subtype ยังเป็น success (ล้มเหลวเงียบ)
   * จึงต้องตรวจว่ามันว่างแทนการปิด และตรวจ "ก่อน" run เพื่อกันสถานะจาก run ก่อนหน้าข้ามมา
   */
  const memoryStateBefore = memoryDirState(memoryAutoPathHint);   // 'unknown' เมื่อยังไม่มี manifest

  /*
   * เพดาน turn ต้องอ่านจาก fixedFactors ไม่ใช่ฝังตายไว้ตรงนี้
   *
   * config/arms.json ประกาศ maxTurns ไว้เป็นตัวแปรควบคุมตั้งแต่ต้น แต่ไม่มีโค้ดอ่านไปใช้
   * (รูปแบบเดียวกับข้อบกพร่องที่ 1) ค่าที่บังคับจริงคือเลขที่ฝังอยู่ในบรรทัดล่าง
   * แปลว่าถ้าใครแก้ค่าใน config จะไม่มีอะไรเกิดขึ้นและไม่มีข้อความเตือน
   *
   * และเพดานนี้ไม่ใช่ค่าที่เป็นกลาง — pilot พบว่า A2 ชน error_max_turns 2 ใน 3 run
   * ขณะที่ A1 ชน 2 ใน 55 run เนื่องจาก run ที่ error ถูกตัดออกก่อนวิเคราะห์
   * เพดานจึงเลือกตัดเฉพาะ run ที่ arm ทดลองทำงานละเอียดที่สุด
   */
  const maxTurns = String(fixedFactors?.maxTurns ?? 25);

  const args = [
    '-p', scenario.prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--model', model,
    '--max-turns', maxTurns,
    '--permission-mode', 'bypassPermissions',  // ต้องรันใน sandbox/VM เท่านั้น
    /*
     * ล็อกให้เท่ากันทุก arm: อ่านเฉพาะ setting ของโปรเจกต์ ไม่เอาของผู้ใช้
     *
     * ⚠️ แก้คำอธิบายเดิม 4 ก.ย. 2569 — ของเดิมเขียนว่า flag นี้กัน "skill ส่วนตัวในเครื่อง
     * คนรันไม่ให้รั่วเข้าไปเป็นตัวแปรกวน" ซึ่ง **วัดแล้วพบว่าไม่จริง**
     * probe: --setting-sources project ยังเห็น skill นอกการทดลอง 18 ตัว
     * (บันเดิลมากับ CLI 15 + ของผู้ใช้ 3) ทุก arm รวม A0/A1 ที่นิยามว่าไม่มี skill
     *
     * เอาออกให้เหลือศูนย์ไม่ได้ด้วย flag ใดเลย: --disable-slash-commands ฆ่า skill ของ arm ไปด้วย
     * ส่วน CLAUDE_CONFIG_DIR แยกได้จริงแต่ทำ auth พัง (ได้ "Not logged in", cost 0,
     * แต่ subtype ยังเป็น success — silent failure) จึงรับสภาพและจัดการแบบนี้แทน:
     *   - เรียกชุดที่เหลือว่า baseline set B แล้วบังคับให้ **เท่ากันทุก arm**
     *   - ตัวแปรต้นคือส่วนต่าง (A2/A4 = B + 4 skill ของการทดลอง)
     *   - validateRuntime() บังคับ foreign skill ที่ถูก "เรียกใช้จริง" = 0 ทุก run
     * ข้อมูลเก่าทั้งชุดสอดคล้องกับข้อนี้: ไม่มี arm ใดเรียก skill นอกการทดลองเลยสักครั้ง
     */
    '--setting-sources', 'project',
    /*
     * ตัวที่ปิดรูรั่วจริง — เพิ่ม 4 ก.ย. 2569
     *
     * `--tools` จำกัดได้เฉพาะ tool ในตัว แต่ **tool ของ MCP เล็ดลอดผ่านไปได้**
     * ตรวจย้อนหลังจาก system:init ที่เก็บไว้: 100 จาก 109 run (92%) ได้ MCP tool ติดมาด้วย
     * จำนวน tool ที่ได้จริงแกว่งอยู่ที่ 31 / 39 / 47 ตัว ทั้งที่ประกาศไว้ 7
     * และ mcp_servers รายงาน Canva กับ Google Drive สถานะ connected
     *
     * `--strict-mcp-config` โดยไม่ส่ง `--mcp-config` = ไม่โหลด MCP จากที่ไหนเลย
     * วัดผลแล้ว: tool 52 -> 7 เป๊ะ · mcp tool 45 -> 0 · mcp server 2 -> 0
     * โดย skill ของ arm ยังมาครบ 4 และ apiKeySource ยังเป็น none (subscription)
     */
    '--strict-mcp-config',
    // ล็อกชุด tool ให้ตรงกับที่ประกาศใน config/arms.json -> fixedFactors.toolset
    // ใช้ --tools ไม่ใช่ --allowed-tools เพราะ --allowed-tools คุมแค่การขออนุญาต
    // ซึ่งไม่มีผลอยู่แล้วภายใต้ bypassPermissions ตัวที่จำกัดชุด tool จริงคือ --tools
    '--tools', tools,
  ];

  const t0 = Date.now();
  const events = [];
  let stderr = '';
  let killedByTimeout = false;

  await new Promise((resolve) => {
    // ทางหลัก: spawn ไฟล์ปฏิบัติการตรงๆ ไม่ผ่าน shell -> ไม่มีปัญหาการ quote เลย
    // ทางถอย: ถ้าหา binary ไม่เจอ ใช้ shell พร้อม quoteWin (กัน prompt ขาด แต่ยังกัน %VAR% ไม่ได้)
    const child = claudeBin.mode === 'direct'
      ? spawn(claudeBin.bin, args, { cwd })
      : spawn([claudeBin.bin, ...args.map(quoteWin)].join(' '), { cwd, shell: true });
    let buf = '';
    const timer = setTimeout(() => { killedByTimeout = true; child.kill('SIGKILL'); }, timeoutMs);
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

  /*
   * บัญชี token ฉบับเต็ม — input_tokens อย่างเดียวนับได้ไม่ถึง 1% ของที่ใช้จริง
   *
   * ตัวเลขจริงจาก smoke test ของ A0:
   *   input_tokens 3,258 | cache_creation 41,924 | cache_read 1,558,041
   * ถ้ารายงานแค่ 3,258 จะผิดไป 500 เท่า
   *
   * สำคัญเป็นพิเศษกับงานนี้ เพราะข้อเสนอหลักเรื่อง progressive disclosure
   * คือ "A2 กิน context น้อยกว่า A1 ทั้งที่กฎเท่ากัน" ซึ่งวัดจากฝั่ง input ล้วนๆ
   * และ context ที่ถูกอ่านซ้ำทุก turn จะไปโผล่ที่ cache_read ไม่ใช่ input_tokens
   */
  const u = resultUsage(events);
  const tokens = {
    input: u.input_tokens ?? inputTokens,
    output: u.output_tokens ?? outputTokens,
    cacheCreation: u.cache_creation_input_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
  };
  tokens.totalInput = tokens.input + tokens.cacheCreation + tokens.cacheRead;

  /*
   * ตรวจความล้มเหลวฝั่งโครงสร้างพื้นฐาน แยกออกจาก "เอเจนต์เลือกที่จะไม่ทำ"
   *
   * เคสที่เจอจริงตอน smoke test: OAuth หมดอายุ CLI คืน event ครบปกติ
   * แต่ในนั้นคือข้อความ error ผลลัพธ์คือ 0 tool call 0 token
   * ถ้าไม่ดักไว้ run นั้นจะถูกให้คะแนนเป็น "เอเจนต์ไม่ทำอะไรเลย" = กฎตกเกือบหมด
   * แล้วปนเข้า dataset โดยไม่มีใครรู้ ซึ่งอันตรายกว่า run ที่พังแล้วพังให้เห็น
   *
   * ความต่างนี้สำคัญมากตอนรันยาว 605 runs: token หมด / เน็ตหลุด / session หมดอายุกลางคัน
   * ล้วนให้หน้าตาแบบเดียวกันหมด และล้วนต้องถูกทิ้ง ไม่ใช่นับเป็นข้อมูล
   */
  const resultEv = events.find((e) => e.type === 'result');
  const infraError =
    killedByTimeout ? `timeout เกิน ${Math.round(timeoutMs / 1000)} วินาที — run ถูกฆ่ากลางคัน`
    : resultEv?.is_error === true ? (resultEv.result ?? 'CLI รายงาน is_error')
    : resultEv?.terminal_reason === 'api_error' ? 'api_error'
    : events.some((e) => e.error === 'authentication_failed') ? 'authentication_failed'
    : events.length === 0 ? (stderr.slice(0, 500) || 'no events from CLI')
    // ไม่มี result event = CLI ไม่ได้จบเอง (ถูกฆ่า/โปรเซสตาย) -> finalMessage ว่าง
    // ถ้าไม่ดักไว้ กฎที่ตรวจจากข้อความตอบ (อ้าง REQ-ID, ถามก่อนลงมือ) จะตกทั้งหมด
    // แล้ว arm ที่ทำงานนานกว่าจะถูกลงโทษด้วยเหตุผลที่ไม่เกี่ยวกับพฤติกรรมเลย
    : !resultEv ? 'ไม่มี result event — โปรเซสจบผิดปกติ'
    : null;

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

  /*
   * เทสยอมรับ — ต้องรัน "หลัง" probe เสมอ
   *
   * เทสยอมรับเรียก resetStore() ซึ่งเขียนทับ data/events.jsonl ถ้ารันก่อน probe
   * ค่าที่ probe อ่านได้จะเป็นผลของเทส ไม่ใช่ผลของสิ่งที่เอเจนต์ทำ แล้ว probe_unchanged
   * จะตกทุก run โดยไม่เกี่ยวกับพฤติกรรมเลย
   *
   * คัดลอกเข้าไปตอนนี้ ไม่ใช่ตอนติดตั้ง arm เพราะเอเจนต์ต้องมองไม่เห็นเฉลย
   * และต้องแก้เทสให้ผ่านไม่ได้
   */
  const acceptance = runAcceptance(cwd, scenario);

  // event ตัวเดียวที่บอกสภาพ runtime จริง — ต้องดึงเก็บไว้ให้ครบ ไม่ใช่หยิบเฉพาะบางฟิลด์
  // ของเดิมหยิบแค่ tools กับ apiKeySource ทำให้ MCP ที่ต่ออยู่ไม่เคยถูกมองเห็นเลยทั้งที่มีในนี้
  const initEv = events.find((e) => e.type === 'system' && e.subtype === 'init') ?? null;

  const artifact = {
    runId: `${scenario.id}__${arm.id}__r${repIndex}`,
    scenarioId: scenario.id, armId: arm.id, repIndex, seed,
    adapter: 'claude-cli', simulated: false, model,
    toolCalls, commands, filesChanged, diff, finalMessage, loadedSkills, testsPassed, acceptance,
    // หลักฐานว่า run นี้ได้รับ context ของ arm จริง — ตรวจย้อนหลังได้โดยไม่ต้องเชื่อว่าโค้ดทำงานถูก
    armInstall: install,
    // ตัวแปรควบคุมที่ "บังคับไป" กับที่ "ได้จริง" — เก็บคู่กันไว้เพื่อให้ตรวจย้อนหลังได้ว่าตรงกันไหม
    control: {
      toolsRequested: tools.split(','),
      toolsGranted: events.find((e) => e.type === 'system' && e.subtype === 'init')?.tools ?? null,
      settingSources: 'project',
      maxTurns: Number(maxTurns),
      // subtype ของ event สุดท้าย — error_max_turns คือการชนเพดาน ซึ่งต้องแยกออกจาก
      // ความล้มเหลวชนิดอื่นตอนวิเคราะห์ ไม่ใช่เหมารวมเป็น "run ที่ใช้ไม่ได้"
      resultSubtype: events.find((e) => e.type === 'result')?.subtype ?? null,
      numTurns: events.find((e) => e.type === 'result')?.num_turns ?? null,
      spawnMode: claudeBin.mode,        // direct = ไม่ผ่าน shell, shell = ทางถอย
      promptLength: scenario.prompt.length,   // เทียบกับความยาวจริงใน scenario ได้
      timeoutMs,
      /*
       * แหล่งที่มาของสิทธิ์เรียกใช้ — ต้องบันทึกไว้ 2 เหตุผล
       *
       * 1. เป็นเรื่องเงิน: "none" = login ด้วย subscription ไม่มีการตัดเงินต่อ token
       *    ถ้าเป็นอย่างอื่น (เช่น ANTHROPIC_API_KEY) แปลว่าจ่ายจริงตามที่ total_cost_usd บอก
       *    ที่ ~$1.4/run การรันเต็ม 810 run คือเงินจริงราว $1,100 จึงต้องรู้ก่อนกดรัน
       * 2. เป็นเรื่องการทำซ้ำ: ต้องเขียนลงเล่มว่าเก็บข้อมูลผ่านช่องทางไหน
       */
      apiKeySource: initEv?.apiKeySource ?? null,

      /*
       * สภาพ runtime ที่เหลือ — เพิ่ม 4 ก.ย. 2569 หลังพบว่า MCP กับ skill นอกการทดลอง
       * เข้ามาได้โดยไม่มีอะไรบันทึกหรือเตือน ทุกฟิลด์ต่อจากนี้มีไว้ให้ validateRuntime() ตรวจ
       * และให้ตรวจย้อนหลังได้ว่า run นั้นอยู่ในสภาพที่ประกาศไว้จริง
       */
      strictMcpConfig: true,
      mcpServers: (initEv?.mcp_servers ?? []).map((s) => s.name),
      skillsAvailable: initEv?.skills ?? null,
      claudeCodeVersion: initEv?.claude_code_version ?? null,
      modelReported: initEv?.model ?? null,      // โมเดลที่ CLI บอกว่าใช้จริง เทียบกับที่สั่งไป
      memoryAutoPath: initEv?.memory_paths?.auto ?? null,
      /*
       * เก็บสองค่า เพราะ run แรกยังไม่รู้พาธจนกว่าจะเห็น init
       *   before = ตรวจก่อน spawn ด้วยพาธจาก manifest (run ที่ 2 เป็นต้นไป)
       *   after  = ตรวจหลังจบด้วยพาธที่ init บอก — ใช้เป็นด่านของ run แรก
       * ทั้งคู่เป็น 'empty' | 'nonempty' | 'unreadable' | 'unknown' ไม่ใช่ boolean
       * เพราะ "อ่านไม่ได้" ต้องหยุด ไม่ใช่ถูกกลืนเป็น "ว่าง"
       */
      memoryStateBefore,
      memoryStateAfter: memoryDirState(initEv?.memory_paths?.auto ?? null),
    },
    probes: { before: probesBefore, after: probesAfter },
    usage: {
      // inputTokens/outputTokens เก็บชื่อเดิมไว้เพื่อไม่ให้ grader และ CSV เดิมพัง
      // แต่ inputTokens ตอนนี้เป็นยอดรวมจริง (input + cache_creation + cache_read)
      inputTokens: tokens.totalInput,
      outputTokens: tokens.output,
      tokenBreakdown: tokens,                       // แยกส่วนไว้ให้วิเคราะห์ context overhead
      costUsd: resultEv?.total_cost_usd ?? null,    // ใช้ประมาณงบก่อนรันเต็ม
      turns: resultEv?.num_turns ?? events.filter((e) => e.type === 'assistant').length,
      wallMs: Date.now() - t0,
    },
    error: infraError,
    rawEvents: events,   // เก็บ transcript ดิบไว้ เพื่อให้ตรวจซ้ำย้อนหลังได้
  };

  uninstallArm(cwd);   // ล้าง context ของ arm ออก มิฉะนั้น arm ถัดไปจะปนเปื้อน
  return artifact;
}
