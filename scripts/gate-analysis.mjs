/**
 * gate-analysis.mjs — ประตูขั้นต่ำที่ต้องผ่านก่อนเริ่มเก็บข้อมูลจริง
 *
 * ตรวจว่า "ท่อวิเคราะห์ทั้งเส้นเดินจนจบได้" ก่อนจะเผาโควตากับ 330 run
 * ไม่ใช่ตรวจว่าผลถูกหรือผิด — ตัวเลขจาก mock เป็นของปลอมทั้งหมด
 *
 * เหตุผลที่ต้องมี: บทเรียนของโปรเจกต์นี้เองคือเครื่องมือที่พังให้ตัวเลขหน้าตาปกติ
 * (regex ที่ compile ไม่ผ่านทำให้ทั้งโจทย์ตกหมดแล้วอ่านออกมาเป็น "โจทย์ยากเกินไป")
 * ถ้าท่อวิเคราะห์พังหลังเก็บข้อมูลเสร็จ = เก็บใหม่ ซึ่งในกรอบเวลานี้แปลว่าไม่มีผล
 *
 *   node scripts/gate-analysis.mjs
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fail = 0;
const step = (name, fn) => {
  process.stdout.write(`  ${name} ... `);
  try { const note = fn(); console.log(`PASS${note ? ` — ${note}` : ''}`); }
  catch (e) { fail++; console.log(`FAIL\n      ${String(e.message ?? e).split('\n').slice(0, 4).join('\n      ')}`); }
};

console.log('\n=== ประตูขั้นต่ำก่อนเก็บข้อมูลจริง ===\n');

// 1. known-answer tests ของสถิติและของประตู runtime
step('known-answer tests (stats + runtime manifest)', () => {
  // ใช้รูปแบบ glob ไม่ใช่ชื่อโฟลเดอร์ — `node --test tests/` บนเครื่องนี้ตีความเป็นไฟล์เทสเดียว
  const out = execFileSync(process.execPath, ['--test', 'tests/*.test.mjs'], { cwd: ROOT, encoding: 'utf8' });
  const m = out.match(/# pass (\d+)/) ?? out.match(/pass (\d+)/);
  const f = out.match(/# fail (\d+)/) ?? out.match(/fail (\d+)/);
  if (f && Number(f[1]) > 0) throw new Error(`มีเทสไม่ผ่าน ${f[1]} ข้อ`);
  return `ผ่าน ${m ? m[1] : '?'} ข้อ`;
});

// 2. mock dataset ต้องวิ่งผ่านท่อทั้งเส้นได้จนจบ โดยไม่แตะ results/
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sbgate-'));
step('mock dataset วิ่งผ่าน runner จนจบ (ไม่แตะ results/)', () => {
  execFileSync(process.execPath, ['src/runner.mjs', '--adapter', 'mock', '--reps', '2', '--out', tmp],
    { cwd: ROOT, encoding: 'utf8', timeout: 300000 });
  const latest = path.join(tmp, 'latest.json');
  if (!fs.existsSync(latest)) throw new Error('runner ไม่ได้เขียน latest.json');
  const d = JSON.parse(fs.readFileSync(latest, 'utf8'));
  if (!d.graded?.length) throw new Error('ไม่มีผลที่ให้คะแนนแล้ว');
  if (d.meta.simulated !== true) throw new Error('meta.simulated ต้องเป็น true สำหรับ mock');
  return `${d.graded.length} run จำลอง`;
});

/*
 * ข้อนี้ตรวจสิ่งที่เคยพังเงียบที่สุด: การ resume ข้ามเงื่อนไขที่เปลี่ยนไป
 * ต้อง exit non-zero **ก่อนยิง run แม้แต่ตัวเดียว** ไม่ใช่รู้ตัวหลังเสีย run ไปแล้ว
 */
step('resume เมื่อไฟล์การทดลองถูกแก้ ต้องหยุดก่อนเริ่ม run', () => {
  const ck = fs.readdirSync(tmp).find((f) => f.startsWith('checkpoint-'));
  if (!ck) throw new Error('ไม่พบ checkpoint จากขั้นตอนก่อนหน้า');
  const sigHash = ck.replace(/^checkpoint-|\.json$/g, '');
  const mf = path.join(tmp, `manifest-${sigHash}.json`);
  // manifest ที่ตรึง digest ไว้คนละค่ากับของจริง = จำลองว่ามีคนแก้ไฟล์ arm ระหว่างทาง
  fs.writeFileSync(mf, JSON.stringify({
    frozenAt: new Date().toISOString(), cliVersion: 'mock',
    experimentDigest: 'deadbeefdeadbeef', experimentFiles: { 'arms/A1/CLAUDE.md': 'old' },
    model: 'mock', maxTurns: 50, toolset: [], baselineSkills: [], apiKeySource: null,
  }, null, 2));

  let code = 0, out = '';
  try {
    out = execFileSync(process.execPath,
      ['src/runner.mjs', '--adapter', 'mock', '--reps', '2', '--out', tmp, '--resume'],
      { cwd: ROOT, encoding: 'utf8', timeout: 120000, stdio: 'pipe' });
  } catch (e) { code = e.status ?? 1; out = String(e.stdout ?? '') + String(e.stderr ?? ''); }
  if (code === 0) throw new Error('แก้ไฟล์การทดลองแล้ว resume ยังเดินต่อได้ — ด่านนี้ไม่ทำงาน');
  if (!/หยุดก่อนเริ่ม run/.test(out)) throw new Error(`หยุดจริงแต่ข้อความไม่ตรง: ${out.slice(-200)}`);
  fs.rmSync(mf, { force: true });
  return `exit ${code} ก่อนยิง run`;
});

/*
 * ⚠️ ช่องโหว่ที่เกือบหลุด: `--new-experiment` เปลี่ยนชื่อ checkpoint ที่ผูกกับ signature
 * แต่โค้ดเดิมยัง fallback ไป `checkpoint.json` รูปแบบเก่า ซึ่งมีอยู่จริงใน results/
 * ผลคือคำสั่งที่แปลว่า "เริ่มชุดใหม่" จะไปดูด run ของการทดลองเก่ากลับเข้ามาแทน
 */
step('--new-experiment ต้องไม่ชุบชีวิต checkpoint รูปแบบเก่า', () => {
  const ck = fs.readdirSync(tmp).find((f) => f.startsWith('checkpoint-') && !f.includes('retired'));
  if (!ck) throw new Error('ไม่พบ checkpoint จากขั้นตอนก่อนหน้า');
  const sigHash = ck.replace(/^checkpoint-|\.json$/g, '');
  const mf = path.join(tmp, `manifest-${sigHash}.json`);

  // วาง checkpoint.json รูปแบบเก่าที่ signature ตรงกัน = กับดักที่รอให้ fallback ไปเจอ
  const real = JSON.parse(fs.readFileSync(path.join(tmp, ck), 'utf8'));
  fs.writeFileSync(path.join(tmp, 'checkpoint.json'), JSON.stringify(real));

  fs.writeFileSync(mf, JSON.stringify({
    frozenAt: new Date().toISOString(), cliVersion: 'mock',
    experimentDigest: 'deadbeefdeadbeef', experimentFiles: {},
    model: 'mock', maxTurns: 50, toolset: [], baselineSkills: [], apiKeySource: 'none',
  }, null, 2));

  let out = '';
  try {
    out = execFileSync(process.execPath,
      ['src/runner.mjs', '--adapter', 'mock', '--reps', '2', '--out', tmp, '--resume', '--new-experiment'],
      { cwd: ROOT, encoding: 'utf8', timeout: 180000, stdio: 'pipe' });
  } catch (e) { out = String(e.stdout ?? '') + String(e.stderr ?? ''); }

  if (!/ไม่อ่าน checkpoint ใด ๆ/.test(out)) {
    throw new Error(`ไม่พบข้อความยืนยันว่าเริ่มจากศูนย์ · ท้ายผลลัพธ์: ${out.slice(-250)}`);
  }
  // ต้องจับ "ร่องรอยการอ่าน checkpoint" เท่านั้น ห้ามใช้คำว่า "รูปแบบเก่า" ลอย ๆ
  // เพราะข้อความ *สำเร็จ* ก็มีคำนั้น ("ไม่อ่าน checkpoint ใด ๆ ทั้ง hashed และรูปแบบเก่า")
  if (/ทำต่อจาก checkpoint|พบ checkpoint\.json รูปแบบเก่า/.test(out)) {
    throw new Error('เริ่มชุดใหม่แล้วแต่ยังไปอ่าน checkpoint เก่ากลับมา');
  }
  // ยืนยันด้วยผลจริง ไม่ใช่แค่ข้อความ: ต้องรันครบ 110 run ใหม่ ไม่ใช่ 0 เพราะข้ามหมด
  const fresh = JSON.parse(fs.readFileSync(path.join(tmp, 'latest.json'), 'utf8'));
  if (fresh.graded.length !== 110) throw new Error(`ควรเก็บใหม่ครบ 110 run แต่ได้ ${fresh.graded.length}`);
  fs.rmSync(path.join(tmp, 'checkpoint.json'), { force: true });
  return 'เริ่มจากศูนย์จริง เก็บใหม่ 110 run ไม่แตะ checkpoint.json';
});

step('results/ ไม่ถูกแตะระหว่างการตรวจ', () => {
  const latest = path.join(ROOT, 'results/latest.json');
  if (!fs.existsSync(latest)) return 'ไม่มี results/latest.json ให้ตรวจ';
  const d = JSON.parse(fs.readFileSync(latest, 'utf8'));
  if (d.meta?.simulated === true) throw new Error('results/latest.json เป็นข้อมูลจำลอง — ปนแล้ว');
  return `ยังเป็นข้อมูลจริง (${d.meta?.adapter}, ${d.graded?.length} run)`;
});

// 3. analyze ต้องอ่าน mock dataset แล้วออกรายงานได้จนจบ
/*
 * ⚠️ ด่านนี้เคยเป็น false green — ของเดิมตรวจแค่ว่า report.md ยาวเกิน 500 ตัวอักษร
 * ซึ่งผ่านได้แม้ analyzer จะยังรายงาน McNemar เป็นผลหลักขัดกับ pre-registration
 * ตอนนี้ต้อง assert เนื้อหาว่าตรงกับแผนที่ประกาศไว้จริง
 */
step('analyze วิ่งจนจบ และรายงานตรงกับแผนที่ประกาศไว้', () => {
  const out = execFileSync(process.execPath, ['src/analyze.mjs', '--in', path.join(tmp, 'latest.json'), '--out', tmp],
    { cwd: ROOT, encoding: 'utf8', timeout: 300000 });
  const report = path.join(tmp, 'report.md');
  if (!fs.existsSync(report)) throw new Error(`ไม่มี report.md · stdout: ${out.slice(-300)}`);
  const txt = fs.readFileSync(report, 'utf8');
  const must = [
    ['หัวข้อ PRIMARY เป็น sign-flip ระดับ scenario', /PRIMARY.*sign-flip.*scenario/s],
    ['PRIMARY ระบุว่าเป็น CRIT ของ A2 เทียบ A1', /PRIMARY —.*CRIT.*A2 เทียบ A1/s],
    ['มีคอลัมน์ p ของ sign-flip', /p \(sign-flip\)/],
    ['มีหัวข้อ SECONDARY / EXPLORATORY แยกต่างหาก', /### 6\.2 SECONDARY \/ EXPLORATORY/],
    ['SECONDARY ระบุว่าไม่มีการคุม alpha', /ไม่มีการคุม alpha/],
    ['McNemar ถูกระบุเป็น SENSITIVITY', /SENSITIVITY.*McNemar/s],
    ['ระบุชัดว่า McNemar ไม่ใช่ผลหลัก', /ไม่ใช่ผลหลัก/],
    ['ระบุความครบของข้อมูลระดับ cell', /ทุก \(scenario, arm, rep\) มีหนึ่งรายการพอดี/],
    ['มี TOST A1 vs A3 พร้อม margin ที่ประกาศไว้', /### 6\.4 TOST[\s\S]*±0\.1 CRIT/],
    ['TOST เตือนว่าไม่มีนัยสำคัญ != เท่ากัน', /"ไม่มีนัยสำคัญ" ไม่เท่ากับ "เท่ากัน"/],
    ['มี H4 แบบ cluster-aware', /### 6\.5 H4[\s\S]*ระดับ scenario/],
    ['H4 ระบุว่ารายงานไม่ว่าผลออกทางไหน', /reportRegardlessOfOutcome/],
    ['มี A4 แยก exposed / not exposed', /### 6\.6 A4[\s\S]*not exposed/],
  ];
  const missing = must.filter(([, re]) => !re.test(txt)).map(([n]) => n);
  if (missing.length) throw new Error(`รายงานไม่ตรงกับแผน: ${missing.join(' · ')}`);

  /*
   * ตารางของ 6.1 ต้องมี "แถวข้อมูลเดียว" — ถ้าเผลอกลับไปพิมพ์ทุกคู่ลงตาราง primary
   * ความกำกวมเรื่อง multiplicity จะกลับมาทันทีโดยที่ข้อความข้างบนยังดูถูกต้องอยู่
   */
  const sec61 = txt.split('### 6.2')[0].split('### 6.1')[1] ?? '';
  const dataRows = sec61.split('\n').filter((l) => /^\|/.test(l) && !/^\|\s*-+/.test(l) && !/เปรียบเทียบ \| metric/.test(l));
  if (dataRows.length !== 1) throw new Error(`ตาราง PRIMARY ต้องมีแถวข้อมูลเดียว แต่มี ${dataRows.length}`);
  return `report.md ${txt.length} ตัวอักษร · assert เนื้อหา ${must.length} ข้อ · PRIMARY มีแถวเดียว`;
});

/*
 * cell ซ้ำหนึ่งตัว + ขาดหนึ่งตัว ให้ยอดรวมเท่าเดิมเป๊ะ — ด่านที่นับแต่ยอดรวมจึงมองไม่เห็น
 * และ pairedCompare จะจับคู่ผิดเงียบ ๆ เพราะ Map ทับกันที่คีย์ scenario#rep
 */
step('analyze ปฏิเสธเมทริกซ์ผิดรูป (cell ซ้ำ) แม้ใส่ --partial', () => {
  const full = JSON.parse(fs.readFileSync(path.join(tmp, 'latest.json'), 'utf8'));
  const g = [...full.graded];
  const victim = g.findIndex((x) => x.runId !== g[0].runId);
  g[victim] = { ...g[0] };                       // ทำให้ cell แรกซ้ำ และ cell ของ victim หายไป
  const f = path.join(tmp, 'dupe.json');
  fs.writeFileSync(f, JSON.stringify({ meta: full.meta, graded: g }));
  if (g.length !== full.graded.length) throw new Error('เตรียมข้อมูลผิด — ยอดรวมต้องเท่าเดิม');

  for (const extra of [[], ['--partial']]) {
    let rejected = false;
    try {
      execFileSync(process.execPath, ['src/analyze.mjs', '--in', f, '--out', path.join(tmp, 'dupe-out'), ...extra],
        { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
    } catch { rejected = true; }
    if (!rejected) throw new Error(`เมทริกซ์ซ้ำแต่ analyze ยังออกรายงาน (${extra.join(' ') || 'ไม่มี flag'})`);
  }
  return 'ปฏิเสธทั้งแบบมีและไม่มี --partial';
});

step('analyze ปฏิเสธข้อมูลไม่ครบ เว้นแต่ระบุ --partial', () => {
  // ตัด graded ให้เหลือครึ่งเดียวโดย meta.reps ยังเท่าเดิม = จำลองการหยุดกลางคัน
  const full = JSON.parse(fs.readFileSync(path.join(tmp, 'latest.json'), 'utf8'));
  const partialFile = path.join(tmp, 'partial.json');
  fs.writeFileSync(partialFile, JSON.stringify({ meta: full.meta, graded: full.graded.slice(0, 10) }));
  const outDir = path.join(tmp, 'partial-out');

  let rejected = false;
  try {
    execFileSync(process.execPath, ['src/analyze.mjs', '--in', partialFile, '--out', outDir],
      { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  } catch { rejected = true; }
  if (!rejected) throw new Error('ข้อมูลไม่ครบแต่ analyze ยังออกรายงานให้ — ด่านนี้ไม่ทำงาน');

  execFileSync(process.execPath, ['src/analyze.mjs', '--in', partialFile, '--out', outDir, '--partial'],
    { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  const txt = fs.readFileSync(path.join(outDir, 'report.md'), 'utf8');
  if (!/รายงานฉบับไม่ครบ/.test(txt)) throw new Error('โหมด --partial ไม่ได้ประทับหัวรายงานว่าไม่ครบ');
  return 'ปฏิเสธเมื่อไม่ครบ · ประทับหัวเมื่อใส่ --partial';
});

// 4. artifact ต้องมีฟิลด์ที่การวิเคราะห์ปลายทางต้องใช้ ครบตั้งแต่ก่อนเก็บข้อมูล
//    ถ้าขาด จะรู้ตอนวิเคราะห์ = ต้องเก็บใหม่ทั้งหมด
/*
 * ใช้ golden artifact ที่ commit ไว้ ไม่ใช่ results/ ในเครื่อง
 *
 * results/ ถูก git ignore — ถ้าด่านนี้พึ่งมัน จะเกิดสองปัญหาพร้อมกัน:
 *   1. fresh clone รันประตูไม่ผ่านเลยทั้งที่โค้ดถูกต้อง
 *   2. artifact เก่าค้างเครื่องอาจทำให้ผ่านทั้งที่ schema ปัจจุบันเปลี่ยนไปแล้ว
 * golden artifact สะท้อน schema ที่ต้องการ และเป็นส่วนหนึ่งของรีโป จึงตรวจซ้ำได้ทุกเครื่อง
 */
const GOLDEN = path.join(ROOT, 'tests/fixtures/golden-artifacts.json');

step('artifact เก็บฟิลด์ที่ H4 / TOST / A4 exposure ต้องใช้ ครบ (golden artifact)', () => {
  const a = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  const r = a[0];
  const need = {
    'H4 (token)': () => r.usage?.tokenBreakdown && Number.isFinite(r.usage.inputTokens),
    'TOST (CRIT รายโจทย์)': () => r.scenarioId && r.armId && Number.isInteger(r.repIndex),
    'A4 exposure (อ่านไฟล์ไหนบ้าง)': () => Array.isArray(r.toolCalls) && Array.isArray(r.rawEvents),
    'ตัวแปรควบคุมที่ได้จริง': () => r.control && 'toolsGranted' in r.control,
  };
  const missing = Object.entries(need).filter(([, f]) => !f()).map(([k]) => k);
  if (missing.length) throw new Error(`ขาดข้อมูลสำหรับ: ${missing.join(', ')}`);
  return 'ครบทุกด้าน';
});

// 5. A4 exposure ต้องคำนวณย้อนหลังได้จริง ไม่ใช่แค่ "มีฟิลด์"
step('A4 exposure คำนวณย้อนหลังจาก artifact ได้จริง', () => {
  const inject = JSON.parse(fs.readFileSync(path.join(ROOT, 'arms/A4/adversarial/inject.json'), 'utf8'));
  const targets = inject.injections.map((i) => i.file);
  if (!targets.length) throw new Error('ไม่มีไฟล์เป้าหมายใน inject.json');
  const a = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  // นับว่า "สัมผัสไฟล์ที่ถูกฝังข้อความ" ถ้ามีร่องรอยชื่อไฟล์นั้นใน tool call ใดก็ตาม
  const isExposed = (r) => {
    const blob = JSON.stringify(r.toolCalls ?? []) + (r.diff ?? '');
    return targets.some((t) => blob.includes(t) || blob.includes(t.replace(/\//g, '\\\\')));
  };
  const exposed = a.filter(isExposed).length;
  // golden ถูกสร้างให้มี run ที่สัมผัส 1 ตัว และไม่สัมผัส 1 ตัว — ถ้าตัวนับพัง ตัวเลขจะไม่ใช่ 1
  if (exposed !== 1) throw new Error(`golden ควรได้ exposed = 1 แต่ได้ ${exposed} — ตัวนับ exposure เพี้ยน`);
  return `แยก exposed/not-exposed ได้ถูกต้อง (1/${a.length})`;
});

fs.rmSync(tmp, { recursive: true, force: true });

console.log(fail === 0
  ? '\nประตูผ่านครบ — ท่อวิเคราะห์เดินจนจบได้ก่อนเก็บข้อมูลจริง\n'
  : `\n⛔ ไม่ผ่าน ${fail} ข้อ — ห้ามเริ่มเก็บข้อมูลจริง\n`);
process.exit(fail === 0 ? 0 : 1);
