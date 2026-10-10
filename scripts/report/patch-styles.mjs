#!/usr/bin/env node
/*
 * สร้าง styles.xml ของ reference.docx จาก template ของวิชา (report template/technical_report_template.docx)
 * template ใส่ฟอนต์แบบ direct formatting ในเนื้อเอกสาร ไม่ได้ใส่ใน style — pandoc อ่านแค่ style
 * จึงต้องเติมฟอนต์ DB ChuanPim PSU ขนาด 16 pt และการจัดชิดแบบไทยลงใน style ที่ pandoc ใช้
 * ใช้: node scripts/report/patch-styles.mjs <styles.xml>
 */
import fs from 'node:fs';

const file = process.argv[2];
let s = fs.readFileSync(file, 'utf8');
const F = 'DBCHUANPIMPSU-RUGULAR';
const FB = 'DB ChuanPim PSU Bold';
const rpr = (font, sz, bold = false) =>
  `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/>${bold ? '<w:b/><w:bCs/>' : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr>`;
const para = (id, name, { based = 'Normal', next = 'Normal', jc = null, before = 0, after = 0, outline = null, sz = 32, font = F, bold = false, ind = null, keep = false } = {}) =>
  `<w:style w:type="paragraph" w:customStyle="1" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="${based}"/><w:next w:val="${next}"/><w:qFormat/>`
  + `<w:pPr>${keep ? '<w:keepNext/>' : ''}<w:spacing w:before="${before}" w:after="${after}"/>${ind ?? ''}${jc ? `<w:jc w:val="${jc}"/>` : ''}${outline !== null ? `<w:outlineLvl w:val="${outline}"/>` : ''}</w:pPr>`
  + `${rpr(font, sz, bold)}</w:style>`;

// ลบ style ที่จะเขียนใหม่ (ถ้ามี) แล้วเติมชุดใหม่
const ids = ['Normal', 'Heading1', 'Heading2', 'Heading3', 'Heading4', 'Title', 'Subtitle', 'Cover', 'BodyText', 'FirstParagraph',
  'Compact', 'TableCaption', 'ImageCaption', 'CaptionedFigure', 'Bibliography', 'BlockText', 'SourceCode', 'TOCHeading', 'Table'];
for (const id of ids) s = s.replace(new RegExp(`<w:style [^>]*w:styleId="${id}"[^>]*>[\\s\\S]*?</w:style>`), '');

const defs = [
  `<w:style w:type="table" w:customStyle="1" w:styleId="Table"><w:name w:val="Table"/><w:basedOn w:val="TableNormal"/><w:pPr><w:jc w:val="left"/></w:pPr>${rpr(F, 28)}<w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:left w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:right w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="808080"/></w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblStylePr w:type="firstRow"><w:rPr><w:b/><w:bCs/></w:rPr><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E7ECF5"/></w:tcPr></w:tblStylePr></w:style>`,
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>${rpr(F, 32)}</w:style>`,
  para('BodyText', 'Body Text', { ind: '<w:ind w:firstLine="720"/>', jc: 'left' }),
  para('FirstParagraph', 'First Paragraph', { based: 'BodyText', next: 'BodyText', ind: '<w:ind w:firstLine="720"/>', jc: 'left' }),
  para('Compact', 'Compact', { based: 'BodyText', jc: 'left', ind: '<w:ind w:firstLine="0"/>' }),
  para('Heading1', 'heading 1', { next: 'BodyText', before: 240, after: 120, outline: 0, sz: 36, font: FB, bold: true, jc: 'left', keep: true }),
  para('Heading2', 'heading 2', { next: 'BodyText', before: 180, after: 60, outline: 1, sz: 32, font: FB, bold: true, jc: 'left', keep: true }),
  para('Heading3', 'heading 3', { next: 'BodyText', before: 120, after: 0, outline: 2, sz: 32, font: FB, bold: true, jc: 'left', keep: true }),
  para('Heading4', 'heading 4', { next: 'BodyText', before: 120, after: 0, outline: 3, sz: 32, font: FB, bold: true, jc: 'left', keep: true }),
  para('Title', 'Title', { next: 'Subtitle', jc: 'center', before: 1200, after: 120, sz: 40, font: FB, bold: true }),
  para('Subtitle', 'Subtitle', { next: 'Cover', jc: 'center', after: 600, sz: 36, font: FB, bold: true }),
  para('Cover', 'Cover', { jc: 'center', after: 120 }),
  para('TableCaption', 'Table Caption', { jc: 'left', before: 120, after: 60, keep: true }),
  para('ImageCaption', 'Image Caption', { jc: 'center', before: 60, after: 180 }),
  para('CaptionedFigure', 'Captioned Figure', { jc: 'center', keep: true }),
  para('Bibliography', 'Bibliography', { jc: 'left', after: 120, ind: '<w:ind w:left="720" w:hanging="720"/>' }),
  para('BlockText', 'Block Text', { jc: 'left', ind: '<w:ind w:left="567" w:right="567"/>', sz: 28 }),
  para('SourceCode', 'Source Code', { jc: 'left', sz: 20, font: 'Consolas' }),
  para('TOCHeading', 'TOC Heading', { based: 'Heading1', next: 'Normal', sz: 36, font: FB, bold: true, jc: 'center' }),
];
s = s.replace('</w:styles>', defs.join('') + '</w:styles>');
fs.writeFileSync(file, s);
console.log('patched', file);
