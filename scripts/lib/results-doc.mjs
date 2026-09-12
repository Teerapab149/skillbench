/**
 * results-doc.mjs — ตัวสร้างเอกสารจาก numbers.json
 *
 * แยกออกมาเป็นโมดูลเพราะสามสคริปต์ใช้ร่วมกัน:
 *   make-results-doc.mjs    เขียนบทที่ 5
 *   make-slide-numbers.mjs  เขียนบล็อกตัวเลขของเด็ค
 *   check-numbers.mjs       สร้างใหม่ในหน่วยความจำแล้วเทียบกับไฟล์บนดิสก์
 *
 * ตัวตรวจต้องเรียกโค้ดชุดเดียวกับตัวสร้าง มิฉะนั้นมันจะตรวจว่า "ตัวสร้างสองตัวตรงกันไหม"
 * ไม่ใช่ "ไฟล์บนดิสก์ตรงกับข้อมูลไหม" ซึ่งเป็นคนละคำถาม
 */

import fs from 'node:fs';
import { createHash } from 'node:crypto';

export function loadNumbers(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`ไม่พบ ${file} — ต้องรัน npm run analyze ก่อน`);
  }
  const raw = fs.readFileSync(file, 'utf8');
  const numbers = JSON.parse(raw);
  // ผูก hash ของเนื้อหาไว้กับเอกสารที่สร้าง เพื่อให้ตรวจย้อนได้ว่ามาจากชุดตัวเลขไหน
  // ไม่ใช้ generatedAt เพราะมันเปลี่ยนทุกครั้งที่รัน analyze แม้ข้อมูลจะเหมือนเดิม
  const { generatedAt, ...stable } = numbers;
  numbers.__hash = createHash('sha256').update(JSON.stringify(stable)).digest('hex').slice(0, 16);
  return numbers;
}

const pct = (v, digits = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(digits)}%` : 'n/a');
const num = (v, digits = 3) => (Number.isFinite(v) ? v.toFixed(digits) : 'n/a');
const pval = (v) => (Number.isFinite(v) ? (v < 0.001 ? '< 0.001' : v.toFixed(3)) : 'n/a');

/** หัวข้อประทับที่ทุกเอกสารที่สร้างจากตัวเลขต้องมี — ใช้ตรวจ provenance ย้อนหลัง */
export function provenanceBlock(n) {
  return [
    `<!-- generated-from: ${n.source} -->`,
    `<!-- numbers-hash: ${n.__hash} -->`,
    `<!-- dataset-stamp: ${n.stamp ?? 'unknown'} -->`,
    '',
    '> ⚠️ **ไฟล์นี้ถูกสร้างด้วยสคริปต์ ห้ามแก้ด้วยมือ**',
    '> ทุกตัวเลขมาจาก `results/numbers.json` ที่ `npm run analyze` เขียนไว้',
    '> ถ้าตัวเลขไม่ถูก ให้แก้ที่ข้อมูลหรือที่ `analyze.mjs` แล้วสร้างใหม่ด้วย `npm run results:doc`',
    '> `npm run check:numbers` จะล้มถ้าไฟล์นี้ไม่ตรงกับข้อมูลปัจจุบัน',
  ].join('\n');
}

function simulatedWarning(n) {
  if (!n.simulated) return [];
  return [
    '',
    '> ⛔ **ตัวเลขทั้งหมดในเอกสารนี้มาจาก mock adapter — เป็นของปลอมสำหรับทดสอบท่อเท่านั้น**',
    '> **ห้ามนำไปใส่เล่มหรือขึ้นเด็คเด็ดขาด** ให้เก็บข้อมูลจริงด้วย `npm run main` แล้วสร้างใหม่',
  ];
}

export function renderResultsDoc(n) {
  const L = [];
  const p = (line = '') => L.push(line);

  p('# บทที่ 5 — ผลการทดลอง');
  p('');
  p(provenanceBlock(n));
  simulatedWarning(n).forEach(p);
  p('');
  p('---');
  p('');

  // ---------- 5.1 ชุดข้อมูล ----------
  const a = n.allocation ?? {};
  p('## 5.1 ชุดข้อมูลที่ใช้');
  p('');
  p('| รายการ | ค่า |');
  p('|---|---|');
  p(`| โมเดล | \`${n.model ?? 'n/a'}\` |`);
  p(`| เพดาน turn | ${n.maxTurns ?? 'n/a'} |`);
  p(`| กลุ่มทดลอง | ${(a.arms ?? []).join(', ')} |`);
  p(`| โจทย์ | ${a.scenarios ?? 'n/a'} |`);
  p(`| รอบต่อโจทย์ | ${a.reps ?? 'n/a'} |`);
  p(`| cell ที่ประกาศไว้ | ${a.declaredCells ?? 'n/a'} |`);
  p(`| cell ที่เก็บได้ | ${(a.declaredCells ?? 0) - (a.missingCells ?? 0)} (${pct(a.completeness)}) |`);
  p(`| run ที่ตัดออกเพราะล้มเหลวเชิงโครงสร้าง | ${a.structurallyExcluded ?? 0} |`);
  p('');

  if (a.fallbackUsed) {
    p(`> ⚠️ ชุดนี้ใช้กฎสำรองของ Amendment 14 — ตัดรอบจาก ${a.fallbackUsed.from} เหลือ ${a.fallbackUsed.to} เท่ากันทุก arm`);
    p('> ทุก arm และทุกโจทย์ยังอยู่ครบ · ทริกเกอร์เป็นเวลาหรือโควตา ไม่ใช่ผลเปรียบเทียบ');
    p('');
  }

  // ---------- 5.2 ผลหลัก ----------
  const pr = n.primary;
  p('## 5.2 ผลหลัก (primary endpoint)');
  p('');
  if (!pr) {
    p('ชุดข้อมูลนี้ไม่มีทั้งสอง arm ที่ประกาศเป็น primary จึงไม่มีผลหลักให้รายงาน');
    p('');
  } else {
    p(`ตัวชี้วัด **${pr.metric}** เทียบ **${pr.armA}** กับ **${pr.armB}**`);
    p('หน่วยข้อมูลคือ scenario ไม่ใช่ run · ทดสอบด้วย exact paired sign-flip ที่ระดับ scenario');
    p('');
    p(`| ${pr.armA} | ${pr.armB} | ผลต่างเฉลี่ยรายโจทย์ | 95% CI | ชนะ/แพ้/เสมอ | k | p |`);
    p('|---|---|---|---|---|---:|---|');
    p(`| ${pct(pr.rateA)} | ${pct(pr.rateB)} | ${pct(pr.diff)} | [${pct(pr.ciLo)}, ${pct(pr.ciHi)}] |`
      + ` ${pr.wins}/${pr.losses}/${pr.ties} | ${pr.k} | **${pval(pr.p)}** |`);
    p('');

    const significant = Number.isFinite(pr.p) && pr.p < 0.05;
    if (significant) {
      p(`ที่ระดับนัยสำคัญ 0.05 ผลต่างนี้ **มีนัยสำคัญ** (p = ${pval(pr.p)})`);
      p('');
      p('> ข้อควรระวังในการตีความ: นัยสำคัญที่ k = ' + pr.k + ' โจทย์ ไม่ได้แปลว่าขนาดของผล');
      p('> จะคงเดิมกับชุดโจทย์อื่น · ช่วงความเชื่อมั่นข้างบนคือสิ่งที่ต้องรายงานคู่กันเสมอ');
    } else {
      p(`ที่ระดับนัยสำคัญ 0.05 ผลต่างนี้ **ยังไม่ถึงนัยสำคัญ** (p = ${pval(pr.p)})`);
      p('');
      p('> ⚠️ **ต้องรายงานว่า “สรุปไม่ได้” ไม่ใช่ “ไม่ต่างกัน”**');
      p('> เพราะการออกแบบถูกจำกัดด้วยจำนวนโจทย์ k = ' + pr.k + ' ซึ่งเป็นเพดานของ power ตั้งแต่ต้น');
      p('> ผล null ภายใต้ k เท่านี้ เข้ากันได้กับทั้ง “ไม่มีผล” และ “มีผลแต่ตรวจไม่พบ”');
    }
    p('');
  }

  // ---------- 5.3 sensitivity ----------
  const ps = n.primarySensitivity;
  const be = n.budgetExhausted ?? { total: 0, byArm: {} };
  p('## 5.3 ความไวของผลหลักต่อเกณฑ์ที่เลือก');
  p('');
  p('### 5.3.1 run ที่ชนเพดานงบ turn (Amendment 15)');
  p('');
  p(`run ที่ใช้ turn จนหมดงบถูก**นับในผลหลัก** เพราะเป็นพฤติกรรมของเอเจนต์ ไม่ใช่ความล้มเหลวของเครื่องมือวัด`);
  p('');
  p('| arm | run ทั้งหมด | ชนเพดาน | อัตรา |');
  p('|---|---:|---:|---:|');
  for (const [arm, v] of Object.entries(be.byArm ?? {})) {
    p(`| ${arm} | ${v.runs} | ${v.hit} | ${pct(v.rate)} |`);
  }
  p('');

  const overCap = Object.entries(be.byArm ?? {}).filter(([, v]) => v.rate > 0.05).map(([k]) => k);
  if (overCap.length) {
    p(`> ⛔ **arm ที่ชนเพดานเกิน 5%: ${overCap.join(', ')}**`);
    p('> ตามกฎที่ประกาศไว้เองใน `PRE-REGISTRATION.md` §8 ข้อ 3 ให้ถือว่าเพดาน turn ยัง binding');
    p('> และต้องขึ้นเพดานอีก **ผลชุดนี้จึงยังตีความเป็นผลสุดท้ายไม่ได้**');
    p('');
  }

  if (ps) {
    p('เทียบผลหลักกับชุดที่ตัด run เหล่านั้นออก (เกณฑ์เดิมก่อน Amendment 15):');
    p('');
    p('| ชุด | ผลต่างเฉลี่ยรายโจทย์ | 95% CI | k | p |');
    p('|---|---|---|---:|---|');
    p(`| **primary — นับ** | ${pct(pr.diff)} | [${pct(pr.ciLo)}, ${pct(pr.ciHi)}] | ${pr.k} | ${pval(pr.p)} |`);
    p(`| sensitivity — ตัดออก | ${pct(ps.diff)} | [${pct(ps.ciLo)}, ${pct(ps.ciHi)}] | ${ps.k} | ${pval(ps.p)} |`);
    p('');
    const sameSide = Number.isFinite(pr.diff) && Number.isFinite(ps.diff) && Math.sign(pr.diff) === Math.sign(ps.diff);
    const sameVerdict = (pr.p < 0.05) === (ps.p < 0.05);
    if (sameSide && sameVerdict) {
      p('> สองชุดชี้ทางเดียวกันและให้ข้อสรุปเดียวกัน ข้อสรุปจึงไม่ได้ขึ้นกับการเลือกเกณฑ์ข้อนี้');
    } else {
      p('> ⚠️ **สองชุดให้ข้อสรุปไม่ตรงกัน** ข้อสรุปเรื่องผลหลักต้องอ่อนลงตามที่ประกาศไว้ใน Amendment 15');
      p('> ห้ามเลือกรายงานชุดที่ให้ผลดีกว่า');
    }
  } else {
    p('ไม่มี run ที่ชนเพดานในชุดนี้ — sensitivity ให้ผลเหมือน primary ทุกประการ');
  }
  p('');

  // ---------- 5.4 ICC ----------
  const icc = n.icc;
  p('### 5.3.2 ICC ที่วัดได้จริง เทียบกับค่าที่ใช้วางแผน');
  p('');
  if (!icc) {
    p('ยังไม่มีค่า ICC ในชุดตัวเลขนี้');
  } else {
    p('| สิ่งที่วัด | ICC |');
    p('|---|---:|');
    p(`| ค่าที่ใช้วางแผน (จาก \`claude-opus-5\`) | ${num(icc.planning)} |`);
    for (const [arm, v] of Object.entries(icc.byArm ?? {})) {
      p(`| ภายใน ${arm} | ${num(v)} |`);
    }
    p(`| **ผลต่างรายโจทย์ (ตัวที่กำหนด design effect)** | **${num(icc.ofDifference)}** |`);
    p('');
    p('> ค่าที่ใช้วางแผนวัดจากโมเดลคนละตัว จึงห้ามนำไปอ้างเป็น power ของชุดนี้');
    p('> `PRE-REGISTRATION.md` §10 ผูกมัดไว้ว่าต้องวัดใหม่และรายงานทั้งสองค่า — ตารางนี้คือการทำตามข้อนั้น');
  }
  p('');

  // ---------- 5.5 ต่อ arm ----------
  p('## 5.4 ตัวชี้วัดรายกลุ่มทดลอง');
  p('');
  p('| arm | n | CRIT | RCR | FULL | SCOPE | TASK | pass^k | Jaccard | Entropy |');
  p('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const [arm, v] of Object.entries(n.perArm ?? {})) {
    p(`| ${arm} | ${v.n} | ${pct(v.CRIT)} | ${pct(v.RCR)} | ${pct(v.FULL)} | ${pct(v.SCOPE)} |`
      + ` ${pct(v.TASK)} | ${pct(v.passHatK)} | ${num(v.jaccard)} | ${num(v.entropy)} |`);
  }
  p('');
  p('> `pass^k` = สัดส่วนโจทย์ที่ผ่านครบ **ทุก** รอบ · เป็นตัวเลขที่ตอบคำว่า “ความสม่ำเสมอ” โดยตรง');
  p('> Jaccard และ Entropy วัดว่าเอเจนต์ตัดสินใจเหมือนเดิมแค่ไหน ไม่ได้วัดว่าตัดสินใจถูก');
  p('');

  // ---------- 5.6 Trigger F1 ----------
  const tf = n.triggerF1 ?? {};
  if (Object.keys(tf.primary ?? {}).length) {
    p('## 5.5 ความแม่นของการยิง skill (Trigger F1)');
    p('');
    p('รายงานสอง ground truth คู่กันตามเงื่อนไขการอนุมัติใน Amendment 16');
    p('');
    p('| arm | skill | F1 (ชุดหลัก) | F1 (rule-derived) |');
    p('|---|---|---:|---:|');
    for (const [arm, skills] of Object.entries(tf.primary)) {
      for (const [skill, f1] of Object.entries(skills)) {
        const alt = tf.sensitivity?.[arm]?.[skill];
        p(`| ${arm} | ${skill} | ${num(f1)} | ${num(alt)} |`);
      }
    }
    p('');
    p('> ชุดหลักตัดสิน relevance จากคำบรรยายโจทย์ · ชุด rule-derived ตัดสินจากกฎผลกระทบเชิงรุก');
    p('> ถ้าสองชุดชี้คนละทาง ข้อสรุปเรื่องการยิง skill ต้องอ่อนลง ไม่ใช่เลือกชุดที่ค่าดีกว่า');
    p('> ทั้งสองชุดยังเป็นการตัดสินของผู้วิจัยจาก description ที่ผู้วิจัยเขียนเอง');
    p('');
  }

  p('---');
  p('');
  p('*เอกสารนี้สร้างอัตโนมัติ · ข้อความตีความที่ต้องใช้วิจารณญาณอยู่ในบทที่ 6*');
  p('');

  return L.join('\n');
}

export function renderSlideNumbers(n) {
  const L = [];
  const p = (line = '') => L.push(line);
  const pr = n.primary;

  p('# ตัวเลขสำหรับเด็ค');
  p('');
  p(provenanceBlock(n));
  simulatedWarning(n).forEach(p);
  p('');
  p('คัดลอกจากที่นี่เท่านั้น ห้ามพิมพ์เลขลงสไลด์เอง — `npm run check:numbers` จะจับได้');
  p('');

  p('## สไลด์ผลหลัก');
  p('');
  if (pr) {
    p(`- **${pr.armA} ${pct(pr.rateA)} · ${pr.armB} ${pct(pr.rateB)}** (ตัวชี้วัด ${pr.metric})`);
    p(`- ผลต่างเฉลี่ยรายโจทย์ **${pct(pr.diff)}** · 95% CI **[${pct(pr.ciLo)}, ${pct(pr.ciHi)}]**`);
    p(`- ชนะ/แพ้/เสมอ **${pr.wins}/${pr.losses}/${pr.ties}** จาก k = **${pr.k}** โจทย์`);
    p(`- p (exact sign-flip) = **${pval(pr.p)}**`);
    p('');
    p(Number.isFinite(pr.p) && pr.p < 0.05
      ? '- ประโยคที่พูดได้: “ต่างกันอย่างมีนัยสำคัญที่ระดับโจทย์ ภายใต้ 11 โจทย์นี้”'
      : '- ประโยคที่พูดได้: “**สรุปไม่ได้**” — ห้ามพูดว่า “ไม่ต่างกัน” เพราะ k จำกัด power ตั้งแต่ต้น');
  } else {
    p('- ยังไม่มีผลหลักในชุดตัวเลขนี้');
  }
  p('');

  p('## สไลด์ชุดข้อมูล');
  p('');
  const a = n.allocation ?? {};
  p(`- \`${n.model ?? 'n/a'}\` · เพดาน ${n.maxTurns ?? 'n/a'} turn`);
  p(`- ${(a.arms ?? []).length} arm × ${a.scenarios ?? '?'} โจทย์ × ${a.reps ?? '?'} รอบ = **${a.declaredCells ?? '?'} cell**`);
  p(`- เก็บได้ **${pct(a.completeness)}** · ตัดออกเพราะล้มเหลวเชิงโครงสร้าง ${a.structurallyExcluded ?? 0} run`);
  p('');

  p('## สไลด์ความสม่ำเสมอ');
  p('');
  for (const [arm, v] of Object.entries(n.perArm ?? {})) {
    p(`- ${arm}: CRIT ${pct(v.CRIT)} · pass^k ${pct(v.passHatK)}`);
  }
  p('');

  p('## ตัวเลขที่ห้ามลืมพูด');
  p('');
  const be = n.budgetExhausted ?? { total: 0, byArm: {} };
  p(`- run ที่ชนเพดาน turn และถูกนับในผลหลัก: **${be.total}**`);
  if (n.icc) p(`- ICC ที่วัดได้จริง **${num(n.icc.ofDifference)}** เทียบค่าที่ใช้วางแผน ${num(n.icc.planning)}`);
  p('- k = 11 โจทย์คือเพดานของ power — ผล null แปลว่า “สรุปไม่ได้”');
  p('');

  return L.join('\n');
}
