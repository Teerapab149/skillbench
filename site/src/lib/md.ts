// แปลง markdown ของเอกสารจริง (ไฟล์กฎ แผนล่วงหน้า) เป็น HTML โดยลดระดับหัวข้อลงสองขั้น
// ให้หน้ามี h1 เดียวและลำดับหัวข้อถูกต้องสำหรับโปรแกรมอ่านหน้าจอ หน้าตาคงเดิมด้วย class md-h1 ถึง md-h3
import { marked } from 'marked';

export const renderDoc = (md: string): string =>
  (marked.parse(md, { async: false }) as string).replace(/<(\/?)h([1-6])([^>]*)>/g, (_, close: string, d: string, rest: string) => {
    const level = Math.min(6, Number(d) + 2);
    return close ? `</h${level}>` : `<h${level} class="md-h${d}"${rest}>`;
  });
