/**
 * claude-bin.mjs — การหาไฟล์ปฏิบัติการของ claude และตัวช่วยเล็กๆ ที่หลายโมดูลใช้ร่วมกัน
 *
 * แยกออกมาจาก adapters/claude-cli.mjs เมื่อ 4 ก.ย. 2569 เพราะ runtime-manifest.mjs
 * ต้องใช้ resolveClaudeBin ด้วย ถ้า import ข้ามกันไปมาจะกลายเป็น circular import
 * (adapter -> manifest -> adapter) ซึ่ง ESM ยอมให้ทำได้แต่ลำดับการ evaluate จะเปราะ
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * หาไฟล์ปฏิบัติการของ claude เพื่อ spawn ตรงโดย "ไม่ผ่าน shell"
 *
 * ทำไมสำคัญ: quoteWin แก้ปัญหาการตัดคำได้ แต่แก้ปัญหา cmd.exe ไม่ได้ทั้งหมด
 * cmd ขยาย %VAR% ให้ก่อนโปรแกรมจะได้รับ argument ซึ่งไม่มีการ quote แบบไหนกันได้
 * ทดสอบแล้ว: prompt ที่มี "%PATH%" กลายเป็น PATH จริงยาวเหยียดส่งเข้าไปแทน
 * โจทย์ในโดเมนนี้มีโอกาสมี % สูง (เช่น "ปัดขึ้น 100%") จึงเป็นระเบิดเวลา
 *
 * ทางออก: claude ที่ติดตั้งผ่าน npm มาพร้อม bin/claude.exe ซึ่งเป็น native binary
 * spawn ตรงด้วย shell:false ได้เลย Node จะ escape ให้ถูกต้องตามกฎ CreateProcess
 * ไม่มี cmd.exe อยู่ในเส้นทาง -> ไม่มีการขยายตัวแปร ไม่มีอักขระพิเศษ
 */
export function resolveClaudeBin() {
  if (process.env.SKILLBENCH_CLAUDE_BIN) {
    return { bin: process.env.SKILLBENCH_CLAUDE_BIN, mode: 'direct', how: 'env' };
  }
  if (process.platform !== 'win32') return { bin: 'claude', mode: 'direct', how: 'PATH' };

  for (const dir of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
    for (const rel of ['claude.exe', 'node_modules/@anthropic-ai/claude-code/bin/claude.exe']) {
      const p = path.join(dir, rel);
      if (fs.existsSync(p)) return { bin: p, mode: 'direct', how: 'PATH scan' };
    }
  }
  // หาไม่เจอ — ยอมถอยไปใช้ shell แต่ต้องบันทึกไว้ใน artifact ว่าใช้โหมดไหน
  // การถอยแบบเงียบๆ คือบั๊กชนิดเดียวกับที่เพิ่งแก้ไป จึงต้องเตือนให้เห็น
  return { bin: 'claude', mode: 'shell', how: 'fallback' };
}

/**
 * auto-memory ปิดด้วย flag ไม่ได้โดยไม่ทำ auth หรือการส่ง CLAUDE.md พัง จึงต้องตรวจว่ามันว่างแทน
 *
 * คืน `'empty'` | `'nonempty'` | `'unreadable'` | `'unknown'` — ไม่ใช่ boolean
 *
 * ⚠️ แก้เมื่อ 4 ก.ย. 2569 (รอบสอง) — ของเดิมเป็น boolean แล้ว `catch { return true }`
 * แปลว่า **อ่านโฟลเดอร์ไม่ได้ = รายงานว่าว่าง** ซึ่งเป็น fail-open ในด่านที่ตั้งใจให้ fail-closed
 * กรณีที่เกิดได้จริง: สิทธิ์ไม่พอ, พาธถูกล็อกโดยโปรเซสอื่น, ไดรฟ์ไม่พร้อม
 * ทั้งสามกรณีต้องหยุด ไม่ใช่ผ่าน
 *
 * `'unknown'` = ยังไม่รู้พาธ (run แรกที่ยังไม่มี manifest) ผู้เรียกต้องจัดการเองว่าจะยอมหรือไม่
 */
export function memoryDirState(memoryAutoPath) {
  if (!memoryAutoPath) return 'unknown';
  try {
    if (!fs.existsSync(memoryAutoPath)) return 'empty';
    return fs.readdirSync(memoryAutoPath).length === 0 ? 'empty' : 'nonempty';
  } catch { return 'unreadable'; }
}
