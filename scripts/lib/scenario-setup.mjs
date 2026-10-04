/**
 * ปะสภาพเริ่มต้นของโจทย์ลง fixture สำหรับด่านตรวจเทสยอมรับ
 *
 * ด่านทั้งสาม (ตกบน baseline · เขียวเมื่อปะเฉลย · เฉลยผิดต้องตก) ต้องเริ่มจากจุดเดียวกับ
 * ที่เอเจนต์เริ่มจริง ถ้าโจทย์ประกาศ setupPatches ไว้แต่ด่านไม่ปะตาม ด่านจะตรวจโลกคนละใบ
 * กับที่เอเจนต์ทำงานอยู่ — ซึ่งคือข้อบกพร่องแบบเดียวกับ S07 ในชุดที่ 2
 *
 * ไม่ commit — ผู้เรียกคืนสภาพด้วย git checkout/clean ตามเดิม และ revert ลบไฟล์ที่ create
 */
import { readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadSetupPatches, applySetupPatches } from '../../src/install-arm.mjs';

export function scenarioById(root, id) {
  const p = join(root, 'scenarios', `${id}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

export function applyScenarioSetup(root, fixture, id) {
  const patches = loadSetupPatches(scenarioById(root, id));
  applySetupPatches(fixture, patches);
  return patches;
}

export function revertCreatedFiles(fixture, patches) {
  for (const p of patches) if (p.create !== undefined) rmSync(join(fixture, p.file), { force: true });
}
