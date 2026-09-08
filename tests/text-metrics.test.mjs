import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateTokens, frontmatterBody, normalizeLineEndings } from '../src/text-metrics.mjs';

const lf = '---\nname: impact-analysis\ndescription: วิเคราะห์ผลกระทบ\n---\n# Body\nข้อความ';
const crlf = lf.replace(/\n/g, '\r\n');

test('token estimate ต้องไม่เปลี่ยนตาม line ending ของ checkout', () => {
  assert.equal(estimateTokens(crlf), estimateTokens(lf));
});

test('frontmatter ต้องอ่านได้เหมือนกันทั้ง LF และ CRLF', () => {
  assert.equal(frontmatterBody(crlf), frontmatterBody(lf));
  assert.equal(frontmatterBody(lf), 'name: impact-analysis\ndescription: วิเคราะห์ผลกระทบ');
});

test('normalize line ending รองรับ CRLF และ CR เดี่ยว', () => {
  assert.equal(normalizeLineEndings('a\r\nb\rc\n'), 'a\nb\nc\n');
});
