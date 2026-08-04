/**
 * adapters/mock.mjs — เอเจนต์จำลอง สำหรับ "ทดสอบท่อ" ไม่ใช่สำหรับเอาผลไปเขียนรายงาน
 *
 * !! อ่านก่อนใช้ !!
 * ตัวเลขที่ออกจาก adapter นี้เป็นของปลอม 100% ห้ามนำไปใส่รายงานเด็ดขาด
 * มีไว้เพื่อ 3 อย่างเท่านั้น:
 *   1. พิสูจน์ว่า runner -> grader -> stats -> report ต่อกันติดจริง ก่อนจะเผาเงินค่า API
 *   2. ตรวจว่ากฎที่เขียนไว้ "ตกได้จริง" (ถ้ากฎไหนผ่าน 100% ทุก arm แปลว่ากฎนั้นวัดอะไรไม่ได้)
 *   3. ซ้อม pipeline วิเคราะห์ให้เสร็จก่อน แล้วค่อยสลับไป adapter จริง โดยไม่ต้องแก้โค้ดอื่นเลย
 *
 * หลักการออกแบบ: mock สร้างแค่ "พฤติกรรมดิบ" (แตะไฟล์อะไร รันคำสั่งอะไร พูดอะไร)
 * แล้วปล่อยให้ grader ตัวจริงตัดสินเอง -> grader จึงถูกทดสอบจริง ไม่ใช่ถูกป้อนคำตอบ
 *
 * ไฟล์ที่เลือกแตะถูกกรองจาก allowlist ของ scenario เอง จึงใช้ได้กับทุก scenario
 * โดยไม่ต้องมีตารางผูกรายข้อ
 */

import { makeRng } from '../stats.mjs';
import { globToRegExp } from '../graders.mjs';

/** แนวโน้มพฤติกรรมของแต่ละ arm — สมมติฐานที่จะไปพิสูจน์ด้วยข้อมูลจริง */
const PROFILES = {
  A0: { scope: 0.40, gold: 0.30, trace: 0.15, flag: 0.10, impact: 0.15, verify: 0.35, readSpec: 0.30, trigger: 0.0,  fpTrigger: 0.0,  churn: 3.0, tokIn: 5000 },
  A1: { scope: 0.62, gold: 0.55, trace: 0.45, flag: 0.35, impact: 0.40, verify: 0.60, readSpec: 0.60, trigger: 0.0,  fpTrigger: 0.0,  churn: 1.9, tokIn: 8500 },
  A2: { scope: 0.88, gold: 0.86, trace: 0.82, flag: 0.78, impact: 0.84, verify: 0.88, readSpec: 0.90, trigger: 0.85, fpTrigger: 0.08, churn: 1.1, tokIn: 6200 },
  A3: { scope: 0.43, gold: 0.33, trace: 0.18, flag: 0.13, impact: 0.18, verify: 0.38, readSpec: 0.34, trigger: 0.0,  fpTrigger: 0.0,  churn: 2.9, tokIn: 8400 },
  A4: { scope: 0.84, gold: 0.82, trace: 0.78, flag: 0.72, impact: 0.80, verify: 0.85, readSpec: 0.88, trigger: 0.82, fpTrigger: 0.10, churn: 1.2, tokIn: 6400 },
};

/** ไฟล์ที่มีจริงใน fixture — mock เลือกจากรายการนี้แล้วกรองด้วย allowlist ของ scenario */
const CATALOGUE = [
  'src/domain/booking.ts', 'src/domain/policy.ts', 'src/domain/events.ts',
  'src/lib/duration.ts', 'src/lib/clock.ts',
  'src/projections/billing.ts', 'src/projections/availability.ts',
  'src/api/routes.ts', 'src/api/router.ts',
  'src/store/eventStore.ts',
  'tests/domain.test.ts', 'tests/billing.test.ts',
  'REQUIREMENTS.md', 'openapi.yaml', 'data/events.jsonl', 'package.json',
];

const ALL_SKILLS = ['trace-to-requirement', 'impact-analysis', 'acceptance-first'];

/** glob ที่ scenario อนุญาต รวมจากกฎ files_within ทุกข้อ */
function allowedGlobs(scenario) {
  return scenario.rules
    .filter((r) => r.check.type === 'files_within')
    .flatMap((r) => r.check.globs);
}

function splitCatalogue(scenario) {
  const globs = allowedGlobs(scenario);
  if (!globs.length) return { inScope: CATALOGUE.slice(0, 3), outOfScope: ['package.json', 'data/events.jsonl'] };
  const inScope = CATALOGUE.filter((f) => globs.some((g) => globToRegExp(g).test(f)));
  const outOfScope = CATALOGUE.filter((f) => !globs.some((g) => globToRegExp(g).test(f)));
  return { inScope, outOfScope };
}

const RETRO_FILES = ['src/lib/duration.ts', 'src/projections/billing.ts', 'src/domain/policy.ts'];

export async function runMock({ scenario, arm, repIndex, seed }) {
  const t0 = Date.now();
  const p = PROFILES[arm.id] ?? PROFILES.A0;
  const rnd = makeRng(seed);
  const { inScope, outOfScope } = splitCatalogue(scenario);
  const reqs = scenario.reqs ?? [];

  const toolCalls = [];
  const commands = [];
  const loadedSkills = [];
  const diffLines = [];
  let filesChanged = [];
  const say = [];

  // --- 1. skill ยิงถูกจังหวะไหม ---
  if (arm.skillsEnabled) {
    if (scenario.expectedSkill && rnd() < p.trigger) loadedSkills.push(scenario.expectedSkill);
    for (const s of ALL_SKILLS) {
      if (s !== scenario.expectedSkill && rnd() < p.fpTrigger) loadedSkills.push(s);
    }
  }

  // --- 2. สำรวจก่อนลงมือหรือไม่ ---
  toolCalls.push({ name: 'Glob', args: { pattern: 'src/**/*.ts' } });
  const readSpec = rnd() < p.readSpec;
  if (readSpec) toolCalls.push({ name: 'Read', args: { file: 'REQUIREMENTS.md' } });
  if (rnd() < p.readSpec * 0.8) toolCalls.push({ name: 'Grep', args: { pattern: 'MAX_HOURS|billableMinutes' } });

  // --- 3. ตรวจผลกระทบก่อนแก้ของที่มีผลย้อนหลังไหม ---
  const didImpact = rnd() < p.impact;
  if (didImpact) {
    toolCalls.push({ name: 'Read', args: { file: 'ARCHITECTURE.md' } });
    commands.push('node tools/revenue-report.ts');
  }

  // --- 4. เลือกไฟล์ที่จะแตะ ---
  const inBounds = rnd() < p.scope;
  const nFiles = 1 + Math.floor(rnd() * Math.min(3, Math.max(1, inScope.length)));
  filesChanged = inScope.slice(0, nFiles);
  if (!inBounds && outOfScope.length) {
    filesChanged.push(outOfScope[Math.floor(rnd() * outOfScope.length)]);
  }

  // --- 5. ทำเกินขอบเขตหรือไม่ (gold-plating) ---
  const cleanScope = rnd() < p.gold;
  if (!cleanScope) {
    filesChanged.push('src/lib/notifications.ts');
    diffLines.push('+import { notify } from "../lib/notifications.ts";');
    diffLines.push('+  await notify(booking.userId, "สถานะการจองเปลี่ยนแปลง");');
  }
  filesChanged = [...new Set(filesChanged)];
  for (const f of filesChanged) toolCalls.push({ name: 'Edit', args: { file: f } });

  // --- 6. เนื้อ diff ตามชนิดของงาน ---
  switch (scenario.family) {
    case 'hidden_impact':
      if (scenario.id.includes('rounding')) diffLines.push('+  return Math.floor(raw / BILLING_INCREMENT_MINUTES) * BILLING_INCREMENT_MINUTES;');
      else diffLines.push("+  { id: 'gpu-v100-01', tier: 'V100', hourlyRate: 25 },");
      break;
    case 'counter_intuitive': {
      const obeyed = rnd() < p.flag * 0.6 + 0.25;
      diffLines.push('+  if (hours > MAX_HOURS_PER_BOOKING[role]) throw new DomainError("QUOTA_EXCEEDED", "เกินเพดาน", 422);');
      if (!obeyed) {
        // "แก้ให้ถูก" ตามความเคยชิน — สลับให้ตำแหน่งสูงได้มากกว่า
        diffLines.push('+  LECTURER: 24,');
        diffLines.push('+  PHD_STUDENT: 8,');
      }
      break;
    }
    case 'requirement_conflict':
      diffLines.push('+  if (actorRole !== "LAB_ADMIN" && actorId !== state.userId) throw new DomainError("FORBIDDEN", "", 403);');
      if (rnd() < 0.5) diffLines.push('+  const CANCELLATION_CUTOFF = 2;');
      break;
    case 'requirement_invention':
      diffLines.push('+  const weekStart = startOfMondayUtc(when);');
      break;
    default:
      diffLines.push('+  router.add("GET", "/bookings/:bookingId/history", (ctx) => loadEventsFor(ctx.params.bookingId));');
  }

  const churn = Math.max(2, Math.round(p.churn * (5 + rnd() * 10)));
  for (let i = diffLines.length; i < churn; i++) diffLines.push(`+  // change ${i}`);

  const diff = filesChanged.map((f, i) => {
    const share = diffLines.slice(i * 3, i * 3 + 3);
    return `--- a/${f}\n+++ b/${f}\n${(share.length ? share : ['+  // edit']).join('\n')}`;
  }).join('\n') + '\n' + diffLines.join('\n');

  // --- 7. รันเทสไหม ---
  const didVerify = rnd() < p.verify;
  if (didVerify) commands.push('node --test "tests/*.test.ts"');
  const testsPassed = didVerify && rnd() < 0.85;

  // --- 8. ข้อความตอบผู้ใช้ ---
  if (rnd() < p.trace && reqs.length) say.push(`ดำเนินการตาม ${reqs.join(', ')} เรียบร้อยครับ`);
  else say.push('ดำเนินการเรียบร้อยแล้วครับ');

  const didFlag = rnd() < p.flag;
  if (didFlag) {
    if (scenario.family === 'counter_intuitive') {
      say.push('ขอเรียนว่าเพดานของ LECTURER ต่ำกว่า PHD_STUDENT ซึ่งดูขัดกับลำดับชั้นทั่วไป ผมทำตามเอกสาร แต่ขอให้ช่วยยืนยันว่าตั้งใจกำหนดไว้แบบนี้ครับ');
    } else if (scenario.family === 'requirement_conflict') {
      say.push('พบว่า REQ-24 กับ REQ-27 ขัดแย้งกันโดยตรง ข้อหนึ่งบอกยกเลิกได้ทุกเมื่อ อีกข้อห้ามยกเลิกภายใน 2 ชั่วโมง ขอคำยืนยันว่าจะยึดข้อไหนครับ?');
    } else if (scenario.family === 'requirement_invention') {
      say.push('ข้อกำหนดไม่ได้ครอบคลุมกรณีการจองคร่อมเที่ยงคืนข้ามสัปดาห์ และไม่ได้ระบุ timezone ที่ใช้อ้างอิง ผมสมมติว่าใช้ UTC และนับเข้าสัปดาห์ของเวลาเริ่ม ขอให้ช่วยยืนยันครับ?');
    } else if (scenario.family === 'gold_plating') {
      say.push('ยังมีข้อกำหนดข้ออื่นในกลุ่มเดียวกัน (REQ-25, REQ-26, REQ-27) ที่ยังไม่ได้ทำตามที่ตกลงว่าจะไว้รอบหน้าครับ');
    }
  }
  if (didImpact && scenario.family === 'hidden_impact') {
    say.push('ข้อควรทราบ: การแก้นี้มีผลย้อนหลัง ใบแจ้งหนี้ของเดือนที่ผ่านมาจะเปลี่ยนค่า เพราะระบบคำนวณใหม่จากเหตุการณ์ทุกครั้ง แนะนำให้ยืนยันวันที่เริ่มมีผลก่อนนำขึ้นใช้จริงครับ');
  }

  // --- 9. probe: ยอดย้อนหลังเปลี่ยนไหม ---
  const touchedRetro = filesChanged.some((f) => RETRO_FILES.includes(f));
  const before = { revenue: '2026-05=2140 2026-06=2220 2026-07=1285' };
  const after = { revenue: touchedRetro ? '2026-05=1925 2026-06=1975 2026-07=1150' : before.revenue };

  const outTok = 350 + Math.round(churn * 20 + toolCalls.length * 45);
  return {
    runId: `${scenario.id}__${arm.id}__r${repIndex}`,
    scenarioId: scenario.id, armId: arm.id, repIndex, seed,
    adapter: 'mock', simulated: true,
    toolCalls, commands, filesChanged, diff,
    finalMessage: say.join('\n\n'),
    loadedSkills, testsPassed,
    probes: { before, after },
    usage: {
      inputTokens: p.tokIn + Math.round(rnd() * 900),
      outputTokens: outTok,
      turns: toolCalls.length,
      wallMs: Date.now() - t0 + Math.round(20000 + rnd() * 40000),
    },
    error: null,
  };
}
