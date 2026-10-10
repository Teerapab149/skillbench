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
const F = 'TH SarabunPSK';
const FB = 'TH SarabunPSK';
const rpr = (font, sz, bold = false) =>
  `<w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:eastAsia="${font}" w:cs="${font}"/>${bold ? '<w:b/><w:bCs/>' : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/><w:lang w:val="en-US" w:eastAsia="en-US" w:bidi="th-TH"/></w:rPr>`;
const para = (id, name, { based = 'Normal', next = 'Normal', jc = null, before = 0, after = 0, outline = null, sz = 32, font = F, bold = false, ind = null, keep = false, pageBreak = false } = {}) =>
  `<w:style w:type="paragraph"${/^(Heading\d|Title|Subtitle|BodyText|BlockText|Bibliography|Caption|TableofFigures|TOCHeading)$/.test(id) ? '' : ' w:customStyle="1"'} w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="${based}"/><w:next w:val="${next}"/><w:qFormat/>`
  + `<w:pPr>${keep ? '<w:keepNext/>' : ''}${pageBreak ? '<w:pageBreakBefore/>' : ''}<w:spacing w:before="${before}" w:after="${after}"/>${ind ?? ''}${jc ? `<w:jc w:val="${jc}"/>` : ''}${outline !== null ? `<w:outlineLvl w:val="${outline}"/>` : ''}</w:pPr>`
  + `${rpr(font, sz, bold)}</w:style>`;

// ลบ style ที่จะเขียนใหม่ (ถ้ามี) แล้วเติมชุดใหม่
const ids = ['Normal', 'Heading1', 'Heading2', 'Heading3', 'Heading4', 'Title', 'Subtitle', 'Cover', 'BodyText', 'FirstParagraph',
  'Compact', 'TableCaption', 'ImageCaption', 'CaptionedFigure', 'Bibliography', 'BlockText', 'SourceCode', 'TOCHeading', 'Table', 'FrontHeading', 'Signature', 'TOC1', 'TOC2', 'TOC3', 'Caption', 'TableofFigures', 'VerbatimChar'];
for (const id of ids) s = s.replace(new RegExp(`<w:style [^>]*w:styleId="${id}"[^>]*>[\\s\\S]*?</w:style>`), '');

const defs = [
  `<w:style w:type="table" w:customStyle="1" w:styleId="Table"><w:name w:val="Table"/><w:basedOn w:val="TableNormal"/><w:pPr><w:jc w:val="left"/></w:pPr>${rpr(F, 32)}<w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:left w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:right w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="808080"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="808080"/></w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblStylePr w:type="firstRow"><w:rPr><w:b/><w:bCs/></w:rPr><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="E7ECF5"/></w:tcPr></w:tblStylePr></w:style>`,
  `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>${rpr(F, 32)}</w:style>`,
  para('BodyText', 'Body Text', { ind: '<w:ind w:firstLine="720"/>', jc: 'thaiDistribute' }),
  para('FirstParagraph', 'First Paragraph', { based: 'BodyText', next: 'BodyText', ind: '<w:ind w:firstLine="720"/>', jc: 'thaiDistribute' }),
  para('Compact', 'Compact', { based: 'BodyText', jc: 'left', ind: '<w:ind w:firstLine="0"/>' }),
  para('Heading1', 'heading 1', { next: 'BodyText', before: 0, after: 120, outline: 0, sz: 36, font: FB, bold: true, jc: 'left', keep: true, pageBreak: true }),
  para('Heading2', 'heading 2', { next: 'BodyText', before: 180, after: 60, outline: 1, sz: 32, font: FB, bold: true, jc: 'left', keep: true }),
  para('Heading3', 'heading 3', { next: 'BodyText', before: 120, after: 0, outline: 2, sz: 32, font: FB, bold: true, jc: 'left', keep: true }),
  para('Heading4', 'heading 4', { next: 'BodyText', before: 120, after: 0, outline: 3, sz: 32, font: FB, bold: true, jc: 'left', keep: true }),
  para('Title', 'Title', { next: 'Subtitle', jc: 'center', before: 480, after: 120, sz: 36, font: FB, bold: true }),
  para('Subtitle', 'Subtitle', { next: 'Cover', jc: 'center', after: 360, sz: 36, font: FB, bold: true }),
  para('Cover', 'Cover', { jc: 'center', after: 120 }),
  para('TableCaption', 'Table Caption', { jc: 'left', before: 120, after: 60, keep: true }),
  para('ImageCaption', 'Image Caption', { jc: 'center', before: 60, after: 180 }),
  para('CaptionedFigure', 'Captioned Figure', { jc: 'center', keep: true }),
  para('Bibliography', 'Bibliography', { jc: 'left', after: 120, ind: '<w:ind w:left="720" w:hanging="720"/>' }),
  para('BlockText', 'Block Text', { jc: 'left', ind: '<w:ind w:left="567" w:right="567"/>', sz: 32 }),
  // ข้อความที่ส่งให้เอเจนต์ (ภาคผนวก ค ง ซ): กล่องพื้นเทา ฟอนต์เดียวกับเนื้อหา ขนาด 14 อ่านภาษาไทยได้
  `<w:style w:type="paragraph" w:customStyle="1" w:styleId="SourceCode"><w:name w:val="Source Code"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:top w:val="single" w:sz="4" w:space="4" w:color="BFBFBF"/><w:left w:val="single" w:sz="4" w:space="4" w:color="BFBFBF"/><w:bottom w:val="single" w:sz="4" w:space="4" w:color="BFBFBF"/><w:right w:val="single" w:sz="4" w:space="4" w:color="BFBFBF"/></w:pBdr><w:shd w:val="clear" w:color="auto" w:fill="F4F5F7"/><w:spacing w:before="60" w:after="120"/><w:ind w:left="113" w:right="113"/><w:jc w:val="left"/></w:pPr>${rpr(F, 28)}</w:style>`,
  `<w:style w:type="character" w:customStyle="1" w:styleId="VerbatimChar"><w:name w:val="Verbatim Char"/>${rpr(F, 28)}</w:style>`,
  para('FrontHeading', 'Front Heading', { jc: 'center', after: 240, sz: 36, font: FB, bold: true, pageBreak: true }),
  para('Signature', 'Signature', { jc: 'right' }),
  `<w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9350"/></w:tabs><w:spacing w:before="60"/><w:jc w:val="left"/></w:pPr>${rpr(FB, 32, true)}</w:style>`,
  `<w:style w:type="paragraph" w:styleId="TOC2"><w:name w:val="toc 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9350"/></w:tabs><w:ind w:left="440"/><w:jc w:val="left"/></w:pPr>${rpr(F, 32)}</w:style>`,
  `<w:style w:type="paragraph" w:styleId="TOC3"><w:name w:val="toc 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9350"/></w:tabs><w:jc w:val="left"/></w:pPr>${rpr(F, 32)}</w:style>`,
  para('Caption', 'caption', { jc: 'left', before: 120, after: 60 }),
  `<w:style w:type="paragraph" w:styleId="TableofFigures"><w:name w:val="table of figures"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="99"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9350"/></w:tabs><w:jc w:val="left"/></w:pPr>${rpr(F, 32)}</w:style>`,
  para('TOCHeading', 'TOC Heading', { based: 'Normal', next: 'Normal', sz: 36, font: FB, bold: true, jc: 'center', after: 240, outline: 9, pageBreak: true }),
];
s = s.replace('</w:styles>', defs.join('') + '</w:styles>');
fs.writeFileSync(file, s);
console.log('patched', file);
