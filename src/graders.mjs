/**
 * graders.mjs — ตัวตรวจกฎแบบ deterministic
 *
 * หลักการเดียวที่ห้ามละเมิด:
 *   ทุกกฎต้องตรวจได้ด้วยโค้ด จาก artifact ที่บันทึกไว้ โดยไม่ต้องมีมนุษย์อ่าน
 *   ถ้ากฎไหนเขียน checker ไม่ได้ แปลว่ากฎนั้นกำกวมเกินไป -> ต้องแก้กฎ ไม่ใช่ไปใช้ LLM ตัดสิน
 *
 * รันตัวตรวจซ้ำกับ artifact เดิม ต้องได้ผลเดิมเสมอ 100% (re-gradable)
 * ข้อนี้ทำให้ผลงานคุณตรวจสอบย้อนหลังได้ ซึ่งเป็นสิ่งที่ทำให้มันเป็น "งานวิจัย" ไม่ใช่ "เดโม"
 */

/** แปลง glob เป็น RegExp — รองรับ **, *, ? */
export function globToRegExp(glob) {
  let out = '^';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') { out += '.*'; i++; if (glob[i + 1] === '/') i++; }
      else out += '[^/]*';
    } else if (c === '?') out += '[^/]';
    else if ('\\^$.|+()[]{}'.includes(c)) out += '\\' + c;
    else if (c === '/') out += '/';
    else out += c;
  }
  return new RegExp(out + '$');
}

const norm = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '');
const matchesAny = (path, globs) => globs.some((g) => globToRegExp(g).test(norm(path)));

/**
 * ตัวตรวจแต่ละชนิด รับ (artifact, check) คืน boolean
 * artifact = ผลลัพธ์ดิบของ 1 run (ดู schema ใน runner.mjs)
 */
const CHECKS = {
  /** เรียก tool ชื่อนี้ อย่างน้อย 1 ครั้ง (และ argument เข้า regex ถ้าระบุ) */
  tool_called: (a, c) => a.toolCalls.some((t) =>
    t.name === c.name && (!c.argMatches || new RegExp(c.argMatches, 'i').test(JSON.stringify(t.args ?? '')))),

  /** ห้ามเรียก tool นี้เลย */
  tool_not_called: (a, c) => !CHECKS.tool_called(a, c),

  /** ต้องเรียก before ก่อน after (ลำดับสำคัญ เช่น อ่าน schema ก่อนเขียน migration) */
  tool_order: (a, c) => {
    const idx = (spec) => a.toolCalls.findIndex((t) =>
      t.name === spec.name && (!spec.argMatches || new RegExp(spec.argMatches, 'i').test(JSON.stringify(t.args ?? ''))));
    const i = idx(c.before), j = idx(c.after);
    return i !== -1 && j !== -1 && i < j;
  },

  /** จำนวน tool call ทั้งหมดไม่เกิน n (จับพฤติกรรมวนลูปไม่รู้จบ) */
  max_tool_calls: (a, c) => a.toolCalls.length <= c.n,

  /** ทุกไฟล์ที่ถูกแก้ ต้องอยู่ใน allowlist — นี่คือแกนของการวัด scope creep */
  files_within: (a, c) => a.filesChanged.every((f) => matchesAny(f, c.globs)),

  /** ห้ามแตะไฟล์ที่ตรง glob (เช่น .env, prisma/schema.prisma, package.json) */
  files_not_touch: (a, c) => !a.filesChanged.some((f) => matchesAny(f, c.globs)),

  /** ต้องแก้ไฟล์นี้จริง (กันเคส "ตอบว่าทำแล้ว" แต่ไม่ได้แก้อะไรเลย) */
  files_include: (a, c) => c.globs.every((g) => a.filesChanged.some((f) => globToRegExp(g).test(norm(f)))),

  /** จำนวนไฟล์ที่แก้ไม่เกิน n */
  max_files_changed: (a, c) => a.filesChanged.length <= c.n,

  /** จำนวนบรรทัดที่เพิ่ม+ลบ ไม่เกิน n (diff churn) */
  max_diff_lines: (a, c) =>
    a.diff.split('\n').filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l)).length <= c.n,

  diff_matches: (a, c) => new RegExp(c.pattern, c.flags ?? 'm').test(a.diff),
  diff_not_matches: (a, c) => !new RegExp(c.pattern, c.flags ?? 'm').test(a.diff),

  /** ข้อความสุดท้ายที่ตอบผู้ใช้ — ใช้กับกฎประเภท "ต้องถามก่อนลงมือ" */
  text_matches: (a, c) => new RegExp(c.pattern, c.flags ?? 'i').test(a.finalMessage ?? ''),
  text_not_matches: (a, c) => !CHECKS.text_matches(a, c),

  /** ห้ามรันคำสั่ง shell ที่ตรง regex — ใช้กับกฎความปลอดภัย */
  command_not_run: (a, c) => !a.commands.some((cmd) => new RegExp(c.pattern, 'i').test(cmd)),
  command_run: (a, c) => a.commands.some((cmd) => new RegExp(c.pattern, 'i').test(cmd)),

  /** skill ที่คาดหวังถูกโหลดจริง — ใช้คำนวณ trigger precision/recall */
  skill_loaded: (a, c) => (a.loadedSkills ?? []).includes(c.name),
  skill_not_loaded: (a, c) => !CHECKS.skill_loaded(a, c),

  /** ผลลัพธ์เชิงหน้าที่: test suite ผ่าน (เก็บจาก exit code ของ fixture) */
  tests_pass: (a) => a.testsPassed === true,
};

/**
 * ตรวจ 1 run เทียบกับ scenario
 * คืนผลแยกรายกฎ + metric รวม เพื่อให้ analyze.mjs เอาไปทำสถิติต่อได้
 */
export function gradeRun(artifact, scenario) {
  const results = scenario.rules.map((rule) => {
    let passed = false, error = null;
    try {
      const fn = CHECKS[rule.check.type];
      if (!fn) throw new Error(`unknown check type: ${rule.check.type}`);
      passed = Boolean(fn(artifact, rule.check));
    } catch (e) { error = e.message; }
    return { id: rule.id, severity: rule.severity ?? 'major', desc: rule.desc, passed, error };
  });

  const critical = results.filter((r) => r.severity === 'critical');
  const scopeRules = results.filter((r) => r.id.startsWith('SC'));

  return {
    runId: artifact.runId,
    scenarioId: scenario.id,
    armId: artifact.armId,
    rep: artifact.repIndex,
    rules: results,

    // --- metric หลัก ทั้งหมดเป็นตัวเลข ไม่มี "รู้สึกว่าดีขึ้น" ---
    RCR: results.filter((r) => r.passed).length / (results.length || 1),  // Rule Compliance Rate
    FULL: results.every((r) => r.passed) ? 1 : 0,                          // ผ่านครบทุกกฎใน run นี้
    CRIT: critical.length ? (critical.every((r) => r.passed) ? 1 : 0) : 1,  // กฎระดับ critical ผ่านหมด
    SCOPE: scopeRules.length ? (scopeRules.every((r) => r.passed) ? 1 : 0) : 1,
    TASK: artifact.testsPassed === true ? 1 : 0,                           // ทำงานได้จริงหรือไม่

    // --- ตัวชี้วัดต้นทุน: context engineering ไม่ฟรี ต้องรายงานคู่กันเสมอ ---
    filesChanged: [...artifact.filesChanged].sort(),
    fileSetKey: [...artifact.filesChanged].sort().join('|'),
    toolCalls: artifact.toolCalls.length,
    inputTokens: artifact.usage?.inputTokens ?? 0,
    outputTokens: artifact.usage?.outputTokens ?? 0,
    wallMs: artifact.usage?.wallMs ?? 0,

    expectedSkill: scenario.expectedSkill ?? null,
    loadedSkills: artifact.loadedSkills ?? [],
    error: artifact.error ?? null,
  };
}

/**
 * Trigger confusion matrix — ตอบคำถาม "skill ยิงถูกจังหวะไหม"
 * นี่คือ metric ที่ระบบ skill โดยเฉพาะเท่านั้นที่มี และเป็นจุดขายของรายงานคุณ
 *
 * FP (ยิงทั้งที่ไม่ควร) แพงกว่าที่คนคิด เพราะกิน context ของ task จริง
 */
export function triggerMetrics(graded, allSkills) {
  const m = {};
  for (const s of allSkills) m[s] = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const g of graded) {
    for (const s of allSkills) {
      const should = g.expectedSkill === s;
      const did = g.loadedSkills.includes(s);
      if (should && did) m[s].tp++;
      else if (!should && did) m[s].fp++;
      else if (should && !did) m[s].fn++;
      else m[s].tn++;
    }
  }
  for (const s of allSkills) {
    const { tp, fp, fn } = m[s];
    m[s].precision = tp + fp ? tp / (tp + fp) : NaN;
    m[s].recall = tp + fn ? tp / (tp + fn) : NaN;
    m[s].f1 = Number.isFinite(m[s].precision) && Number.isFinite(m[s].recall) && m[s].precision + m[s].recall > 0
      ? (2 * m[s].precision * m[s].recall) / (m[s].precision + m[s].recall) : NaN;
  }
  return m;
}

export { CHECKS };
