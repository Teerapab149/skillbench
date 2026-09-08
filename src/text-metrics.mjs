/** ทำให้การอ่านไฟล์ให้ผลเดียวกันไม่ว่า Git checkout เป็น LF หรือ CRLF */
export function normalizeLineEndings (text) {
  return String(text).replace(/\r\n?/g, '\n');
}

/** ประมาณ token แบบเดียวกับเอกสารเดิม โดยไม่นับ CR ของ Windows เป็นเนื้อหาเพิ่ม */
export function estimateTokens (text) {
  const normalized = normalizeLineEndings(text);
  const thai = (normalized.match(/[฀-๿]/g) ?? []).length;
  return Math.round(thai / 2 + (normalized.length - thai) / 4);
}

/** คืนเฉพาะ frontmatter ที่ Claude เห็นตลอดเวลา หรือ null เมื่อไฟล์ไม่มี frontmatter */
export function frontmatterBody (text) {
  const normalized = normalizeLineEndings(text);
  return normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/)?.[1] ?? null;
}
