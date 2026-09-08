/**
 * runtime-manifest.mjs — บันทึกสภาพ runtime ที่ตกลงกันไว้ แล้วบังคับทุก run ให้ตรง แบบ fail-closed
 *
 * ทำไมต้องมี — และทำไมต้องเป็น fail-closed ไม่ใช่แค่ "บันทึกไว้ดูทีหลัง":
 *
 * `config/arms.json` ประกาศตัวแปรควบคุมไว้ครบมาตลอด แต่ไม่มีอะไรตรวจว่ามันถูกบังคับจริง
 * ผลคือมีตัวแปรที่ "ประกาศแล้วไม่เคยมีผล" หลุดมาแล้วสามครั้ง:
 *
 *   1. `model`        ไม่เคยถูกโค้ดอ่านเลย (adapter ฝัง default เอง) — เจอ 12 ส.ค. 2569
 *   2. `temperature`  ไม่เคยถูกส่งไปที่ CLI เลย                        — เจอ 4 ก.ย. 2569
 *   3. `toolset`      `--tools` จำกัดได้แค่ tool ในตัว MCP เล็ดลอดผ่าน — เจอ 4 ก.ย. 2569
 *                     100 จาก 109 run (92%) ได้ MCP tool ติดมาด้วย
 *
 * ทั้งสามครั้ง pipeline ยังผลิตตัวเลขพร้อม CI ออกมาสวยงามโดยไม่มีอะไรเตือน
 * หลักฐานของข้อ 3 นอนอยู่ใน `control.toolsGranted` ของทุก artifact ตั้งแต่ต้น — แค่ไม่มีใคร assert
 *
 * manifest นี้จึงถูก "แช่แข็ง" ตอน run แรกของการทดลอง แล้ว run ถัดไปทุกตัวต้องตรงกับมัน
 * ไม่ตรง = หยุดทั้งชุด ไม่ใช่บันทึกแล้วรันต่อ
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolveClaudeBin, memoryDirState } from './claude-bin.mjs';
import { BASELINE_TAG } from './install-arm.mjs';

export { memoryDirState };

/**
 * digest ของทุกไฟล์ที่นิยาม "การทดลองนี้คืออะไร"
 *
 * ต้องอยู่ใน manifest ไม่ใช่ใน signature — ด้วยเหตุผลเดียวกับเวอร์ชัน CLI
 * ถ้าอยู่ใน signature การแก้ไฟล์ arm ระหว่างเก็บข้อมูลจะทำให้ checkpoint เปลี่ยนชื่อ
 * แล้ว "เริ่มชุดใหม่" เงียบๆ ซึ่งคือสิ่งที่พยายามป้องกันพอดี
 * อยู่ใน manifest แล้ว validate = แก้ไฟล์ระหว่างทางเมื่อไหร่ การรันหยุดทันที
 */
export function experimentDigest(root) {
  const files = [];
  const add = (rel) => {
    const p = path.join(root, rel);
    if (!fs.existsSync(p)) return;
    if (fs.statSync(p).isDirectory()) {
      for (const e of fs.readdirSync(p).sort()) add(path.join(rel, e));
    } else {
      files.push([rel.replace(/\\/g, '/'), createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16)]);
    }
  };
  /*
   * ต้องครอบคลุม "ทุกไฟล์ที่เปลี่ยนพฤติกรรมของการทดลองได้" ไม่ใช่แค่ไฟล์เนื้อหา
   *
   * adapter / runner / runtime-manifest แก้ fixed factor ได้โดยตรง (flag ที่ส่งให้ CLI,
   * ลำดับการสุ่ม, เกณฑ์ validate) การแก้ไฟล์พวกนี้ระหว่างเก็บข้อมูลจึงเท่ากับเปลี่ยนการทดลอง
   * เหมือนกับการแก้ไฟล์ arm ทุกประการ · stats/graders กระทบการให้คะแนน
   *
   * ผลข้างเคียงที่ตั้งใจ: แก้บั๊กใน harness ระหว่างเก็บข้อมูลจะทำให้ต้องประกาศชุดใหม่
   * ซึ่งถูกต้องแล้ว — ข้อมูลก่อนและหลังแก้ไม่ได้มาจากเครื่องมือตัวเดียวกัน
   */
  for (const rel of ['arms', 'scenarios', 'config/arms.json', 'config/rules-canonical.json',
                     'src/graders.mjs', 'src/install-arm.mjs', 'src/stats.mjs',
                     'src/runner.mjs', 'src/runtime-manifest.mjs', 'src/claude-bin.mjs',
                     'src/adapters/claude-cli.mjs', 'src/fixture-lock.mjs']) add(rel);
  const combined = createHash('sha256').update(files.map((f) => f.join(':')).join('\n')).digest('hex').slice(0, 16);
  return { combined, files: Object.fromEntries(files) };
}

/** skill ที่เป็นตัวแปรต้นของการทดลอง — ทุกตัวนอกเหนือจากนี้คือ baseline set B */
export const EXPERIMENT_SKILLS = ['acceptance-first', 'impact-analysis', 'safe-shell', 'trace-to-requirement'];

/**
 * อ่าน tree object ของ baseline tag ในทุก fixture ที่ชุดทดลองใช้
 *
 * tree hash ผูกกับเนื้อหาและ path ที่ commit ไว้ แต่ไม่ขึ้นกับ working-tree line ending,
 * timestamp หรือ commit message จึงวัด "โจทย์ตั้งต้นเหมือนเดิมไหม" ได้ตรงกว่า git status
 */
export function fixtureBaselineTrees(root, scenarios) {
  const fixtures = [...new Set((scenarios ?? []).map((s) => s.fixture).filter(Boolean))].sort();
  if (!fixtures.length) throw new Error('ไม่มี fixture ให้ตรึง baseline tree');

  const trees = {};
  for (const rel of fixtures) {
    const normalized = String(rel).replace(/\\/g, '/');
    const cwd = path.resolve(root, rel);
    if (!fs.existsSync(path.join(cwd, '.git'))) {
      throw new Error(`fixture ไม่ใช่ git repo จึงตรึง baseline tree ไม่ได้: ${normalized}`);
    }
    let tree;
    try {
      tree = execFileSync('git', ['rev-parse', `${BASELINE_TAG}^{tree}`], {
        cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    } catch (e) {
      throw new Error(`อ่าน tree ของ tag ${BASELINE_TAG} ไม่สำเร็จใน ${normalized}: ${e.message}`);
    }
    if (!/^[0-9a-f]{40,64}$/i.test(tree)) {
      throw new Error(`tree hash ของ ${normalized} ไม่ถูกต้อง: ${tree || '(ว่าง)'}`);
    }
    trees[normalized] = tree;
  }
  return trees;
}

/**
 * ถาม CLI ว่าเวอร์ชันอะไร "ก่อน" เริ่มรัน แล้วตรึงค่าไว้
 *
 * ต้องถามก่อน ไม่ใช่อ่านย้อนหลังจาก init event เพราะ CLI อัปเดตตัวเองระหว่างการเก็บข้อมูลได้
 * และเคยเกิดแล้วจริง: ข้อมูลชุดปัจจุบันมีสองเวอร์ชันปนกัน (2.1.220 และ 2.1.224)
 */
export function queryCliVersion() {
  const bin = resolveClaudeBin();
  try {
    const out = execFileSync(bin.bin, ['--version'], { encoding: 'utf8', timeout: 30000 });
    const m = out.match(/(\d+\.\d+\.\d+)/);
    return m ? m[1] : out.trim();
  } catch (e) {
    throw new Error(`ถามเวอร์ชันของ claude CLI ไม่สำเร็จ จึงตรึงตัวแปรควบคุมไม่ได้: ${e.message}`);
  }
}

export function manifestPath(resultsDir, sigHash) {
  return path.join(resultsDir, `manifest-${sigHash}.json`);
}

/**
 * สร้าง manifest จาก run แรก แล้วห้ามแก้อีก
 *
 * baseline set B ต้องมาจากการวัด ไม่ใช่การประกาศ เพราะมันขึ้นกับ skill ที่บันเดิลมากับ CLI
 * และ skill ส่วนตัวในเครื่องคนรัน ซึ่งเอาออกให้เหลือศูนย์ไม่ได้ (ดูคอมเมนต์ใน adapter)
 * สิ่งที่ทำได้และจำเป็นคือ **ตรึงให้มันเท่ากันทุก run ทุก arm** แล้วให้ตัวแปรต้นเป็นส่วนต่าง
 */
export function freezeManifest({ file, init, declared, cliVersion, digest, fixtureTrees }) {
  const available = init.skills ?? [];
  if (!fixtureTrees || !Object.keys(fixtureTrees).length) {
    throw new Error('ไม่มี fixture baseline tree จึงแช่แข็ง manifest แบบ fail-closed ไม่ได้');
  }
  const manifest = {
    frozenAt: new Date().toISOString(),
    _note: 'แช่แข็งจาก run แรกของการทดลองชุดนี้ ห้ามแก้ด้วยมือ — ถ้าต้องเปลี่ยน ให้เริ่มการทดลองชุดใหม่',
    _why: 'ทุกฟิลด์ในนี้คือสิ่งที่ drift ใต้เท้าเราได้โดยไม่มีใครสั่ง (CLI อัปเดตตัวเอง / แก้ไฟล์ arm ระหว่างทาง / ติดตั้ง skill ใหม่) จึงต้องอยู่ที่นี่แล้วให้ validateRuntime หยุดตาย ไม่ใช่อยู่ใน signature ซึ่งจะกลายเป็นการแตก dataset เป็นชุดใหม่เงียบๆ',
    cliVersion,
    experimentDigest: digest?.combined ?? null,
    experimentFiles: digest?.files ?? null,
    fixtureBaselineTrees: { ...fixtureTrees },
    model: declared.model,
    maxTurns: declared.maxTurns,
    toolset: [...declared.toolset].sort(),
    settingSources: 'project',
    strictMcpConfig: true,
    /*
     * ห้ามแช่แข็งเป็น null เมื่อฟิลด์หาย — null ทำให้ validator ข้ามการตรวจทั้งข้อ = fail-open
     * ในด่านที่ผูกกับ "เงินจริงหรือไม่" ซึ่งเป็นเรื่องที่ผิดแล้วรู้ทีหลังไม่ได้
     * ใช้ 'unknown' แทน แล้วให้ validator ถือว่าไม่ผ่าน
     */
    apiKeySource: init.apiKeySource ?? 'unknown',
    baselineSkills: available.filter((s) => !EXPERIMENT_SKILLS.includes(s)).sort(),
    experimentSkills: [...EXPERIMENT_SKILLS].sort(),
    memoryAutoPath: init.memory_paths?.auto ?? null,
  };
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  return manifest;
}

export function loadManifest(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}

const sameSet = (a, b) => {
  const x = [...(a ?? [])].sort(), y = [...(b ?? [])].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/** เปรียบเทียบ fixture tree ใช้ร่วมกันทั้ง preflight และ validation หลัง run */
export function fixtureTreeViolations(manifest, fixtureTrees) {
  const v = [];
  if (!manifest.fixtureBaselineTrees || !Object.keys(manifest.fixtureBaselineTrees).length) {
    v.push('manifest ไม่มี fixture baseline tree — ยืนยันไม่ได้ว่าโจทย์ตั้งต้นตรงกัน จึงถือว่าไม่ผ่าน');
  } else if (!fixtureTrees || !Object.keys(fixtureTrees).length) {
    v.push('อ่าน fixture baseline tree ของ run นี้ไม่ได้ — ยืนยัน baseline ไม่ได้ จึงถือว่าไม่ผ่าน');
  } else if (!sameSet(Object.keys(fixtureTrees), Object.keys(manifest.fixtureBaselineTrees))) {
    v.push('รายการ fixture ไม่ตรงกับ manifest ที่ตรึงไว้');
  } else {
    for (const [fixture, tree] of Object.entries(fixtureTrees)) {
      if (tree !== manifest.fixtureBaselineTrees[fixture]) {
        v.push(`fixture baseline tree เปลี่ยน: ${fixture} (${tree} != ${manifest.fixtureBaselineTrees[fixture]})`);
      }
    }
  }
  return v;
}

/**
 * ตรวจ run เดียวเทียบกับ manifest — คืนรายการที่ผิด (ว่าง = ผ่าน)
 *
 * `arm.skillsEnabled` เป็นตัวแปรต้น: arm ที่เปิดต้องเห็น skill ของการทดลองครบ 4
 * arm ที่ปิดต้องไม่เห็นเลยสักตัว ส่วน baseline set ต้องเท่ากันทั้งสองฝั่ง
 */
export function validateRuntime({ init, toolCalls, arm, manifest, memoryStateBefore, memoryStateAfter, digest, fixtureTrees }) {
  const v = [];
  if (!init) return ['ไม่มี system:init event — ตรวจสภาพ runtime ไม่ได้เลย'];

  if (digest && manifest.experimentDigest && digest.combined !== manifest.experimentDigest) {
    const changed = Object.keys(digest.files)
      .filter((f) => manifest.experimentFiles?.[f] !== digest.files[f]);
    const added = changed.filter((f) => !(f in (manifest.experimentFiles ?? {})));
    v.push(`ไฟล์ที่นิยามการทดลองถูกแก้ระหว่างเก็บข้อมูล (${digest.combined} != ${manifest.experimentDigest})`
      + ` · เปลี่ยน ${changed.length} ไฟล์: ${changed.slice(0, 5).join(', ')}${changed.length > 5 ? ' …' : ''}`
      + (added.length ? ` · เพิ่มใหม่ ${added.length}` : ''));
  }

  v.push(...fixtureTreeViolations(manifest, fixtureTrees));

  const tools = init.tools ?? [];
  if (!sameSet(tools, manifest.toolset)) {
    const extra = tools.filter((t) => !manifest.toolset.includes(t));
    const missing = manifest.toolset.filter((t) => !tools.includes(t));
    v.push(`ชุด tool ไม่ตรง manifest (ได้ ${tools.length} ตัว ต้องการ ${manifest.toolset.length})`
      + (extra.length ? ` · เกินมา: ${extra.slice(0, 6).join(',')}${extra.length > 6 ? ` …อีก ${extra.length - 6}` : ''}` : '')
      + (missing.length ? ` · ขาด: ${missing.join(',')}` : ''));
  }
  if (tools.some((t) => String(t).startsWith('mcp__'))) v.push('มี tool ของ MCP หลุดเข้ามา');
  if ((init.mcp_servers ?? []).length) {
    v.push(`มี MCP server ต่ออยู่ ${(init.mcp_servers ?? []).map((s) => s.name).join(', ')}`);
  }

  if (init.claude_code_version !== manifest.cliVersion) {
    v.push(`เวอร์ชัน CLI เปลี่ยนกลางการทดลอง: ${init.claude_code_version} != ${manifest.cliVersion} ที่ตรึงไว้`);
  }
  if (init.model !== manifest.model) v.push(`โมเดลไม่ตรง manifest: ${init.model} != ${manifest.model}`);
  // แหล่งสิทธิ์เรียกใช้ = "จ่ายเงินจริงหรือไม่" จึงต้อง fail-closed ทั้งตอนไม่ตรงและตอนไม่รู้
  const initAuth = init.apiKeySource ?? null;
  if (manifest.apiKeySource === 'unknown' || initAuth === null) {
    v.push(`ระบุแหล่งสิทธิ์เรียกใช้ไม่ได้ (manifest=${manifest.apiKeySource} · run=${initAuth ?? 'ไม่มีค่า'})`
      + ' — ยืนยันไม่ได้ว่ารันบน subscription หรือจ่ายรายโทเคน จึงถือว่าไม่ผ่าน');
  } else if (initAuth !== manifest.apiKeySource) {
    v.push(`แหล่งสิทธิ์เรียกใช้เปลี่ยน: ${initAuth} != ${manifest.apiKeySource} (กระทบเรื่องค่าใช้จ่ายจริง)`);
  }

  const available = init.skills ?? [];
  const baseline = available.filter((s) => !EXPERIMENT_SKILLS.includes(s));
  const armSkills = available.filter((s) => EXPERIMENT_SKILLS.includes(s));
  if (!sameSet(baseline, manifest.baselineSkills)) {
    v.push(`baseline skill set เปลี่ยนไปจากตอนแช่แข็ง (${baseline.length} vs ${manifest.baselineSkills.length})`);
  }
  const wantArmSkills = arm.skillsEnabled ? EXPERIMENT_SKILLS.length : 0;
  if (armSkills.length !== wantArmSkills) {
    v.push(`arm ${arm.id} ควรเห็น skill ของการทดลอง ${wantArmSkills} ตัว แต่เห็น ${armSkills.length}`);
  }

  // ตัวแปรต้นวัดที่ "เรียกใช้จริง" ไม่ใช่ "มีให้เรียก" — foreign ที่ถูกเรียกต้องเป็นศูนย์เสมอ
  const invoked = (toolCalls ?? [])
    .filter((t) => t.name === 'Skill')
    .map((t) => t.args?.skill ?? t.args?.name)
    .filter(Boolean);
  const foreignInvoked = invoked.filter((s) => !EXPERIMENT_SKILLS.includes(s));
  if (foreignInvoked.length) v.push(`เรียก skill นอกการทดลอง: ${[...new Set(foreignInvoked)].join(', ')}`);
  if (!arm.skillsEnabled && invoked.length) {
    v.push(`arm ${arm.id} ไม่ควรเรียก skill ได้เลย แต่เรียกไป ${invoked.length} ครั้ง`);
  }

  /*
   * auto-memory — fail-closed
   *
   * before ตรวจก่อน spawn ด้วยพาธจาก manifest · after ตรวจหลังจบด้วยพาธจาก init
   * run แรกยังไม่รู้พาธ (before = 'unknown') จึงต้องตกมาใช้ after เป็นด่านแทน
   * ห้ามปล่อยผ่านเพราะ 'unknown' เฉยๆ ไม่งั้นด่านนี้จะไม่เคยทำงานใน run แรกเลย
   *
   * 'unreadable' ต้องถือว่าไม่ผ่าน — ของเดิมกลืนเป็น "ว่าง" ซึ่งเป็น fail-open
   */
  const memStates = [['ก่อน run', memoryStateBefore], ['หลัง run', memoryStateAfter]];
  for (const [label, st] of memStates) {
    if (st === 'nonempty') v.push(`auto-memory ไม่ว่าง (${label}) — สถานะจาก run ก่อนหน้าจะข้ามมาปนได้`);
    if (st === 'unreadable') v.push(`auto-memory อ่านไม่ได้ (${label}) — ยืนยันไม่ได้ว่าว่าง จึงถือว่าไม่ผ่าน`);
  }
  if (memoryStateBefore === 'unknown' && (memoryStateAfter === undefined || memoryStateAfter === 'unknown')) {
    v.push('ตรวจสภาพ auto-memory ไม่ได้เลยทั้งก่อนและหลัง run');
  }
  return v;
}
