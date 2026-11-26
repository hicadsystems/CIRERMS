'use strict';

/*
 * The handbook as a Word file (the `docx` package): the same cover and parts as the PDF, headings in Word's own
 * heading styles (so the navigation pane and the contents field work), a real contents field that Word fills in
 * when the file is opened, tables, code in a monospace style, lists, and the footer with RESTRICTED and the page
 * number. Nothing is copied from a Word template.
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  AlignmentType, HeadingLevel, Footer, PageNumber, TabStopType, TableOfContents, Bookmark, InternalHyperlink,
  LevelFormat, LineRuleType, TableLayoutType, VerticalAlign, convertMillimetersToTwip,
} = require('docx');
const { levelOf } = require('./html');

const NAVY = '0074A8';
const TEAL = '1CAF9A';
const INK = '1D2939';
const MUTED = '556070';
const STRIPE = 'F5F7F9';
const BORDER = 'D3D7DB';
const BODY = 'Arial';
const HEAD = 'Georgia';
const MONO = 'Courier New';
const MARGIN = 1134; // 2 cm
const TEXT_W = 11906 - 2 * MARGIN; // A4 text width, in twentieths of a point

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5];

function headingStyle(n, size, opts = {}) {
  return {
    id: `Heading${n}`, name: `Heading ${n}`, basedOn: 'Normal', next: 'Normal', quickFormat: true,
    run: { font: opts.font || HEAD, size, bold: true, color: opts.color || NAVY },
    paragraph: { spacing: { before: opts.before, after: opts.after }, keepNext: true, keepLines: true, outlineLevel: n - 1, ...(opts.border ? { border: opts.border } : {}) },
  };
}

const bookmarkId = (id) => id.replace(/[^A-Za-z0-9_]/g, '_');

/** Inline pieces as runs; a link inside the book is a Word internal link, any other is its text. */
function runs(nodes, st = {}) {
  const out = [];
  for (const n of nodes) {
    if (n.t === 'text') out.push(new TextRun({ text: n.v, ...st }));
    else if (n.t === 'code') out.push(new TextRun({ text: n.v, font: MONO, size: 18, shading: { type: ShadingType.CLEAR, fill: STRIPE, color: 'auto' }, ...st }));
    else if (n.t === 'strong') out.push(...runs(n.c, { ...st, bold: true }));
    else if (n.t === 'em') out.push(...runs(n.c, { ...st, italics: true }));
    else if (n.t === 'br') out.push(new TextRun({ break: 1 }));
    else if (n.t === 'link') {
      if (n.to.kind === 'internal') out.push(new InternalHyperlink({ anchor: bookmarkId(n.to.id), children: runs(n.c, { ...st, color: NAVY, underline: {} }) }));
      else if (n.to.kind === 'external') out.push(...runs(n.c, st), new TextRun({ text: ` (${n.to.url})`, color: MUTED, size: 18 }));
      else out.push(...runs(n.c, st));
    }
  }
  return out;
}

const noBorder = { style: BorderStyle.NONE, size: 0, color: 'auto' };

function codeParagraphs(b) {
  const lines = b.text.replace(/\t/g, '  ').split('\n');
  return lines.map((line, i) => new Paragraph({
    style: 'Code',
    keepLines: true,
    keepNext: lines.length <= 22 && i < lines.length - 1,
    spacing: { before: i === 0 ? 80 : 0, after: i === lines.length - 1 ? 160 : 0, line: 250, lineRule: LineRuleType.AUTO },
    children: [new TextRun({ text: line })],
  }));
}

function tableFor(b) {
  const cols = b.head.length;
  // column widths follow how much each column holds, within limits, so a narrow key column stays narrow
  const len = (nodes) => nodes.reduce((n, x) => n + (x.v ? x.v.length : x.c ? len(x.c) : 0), 0);
  const weight = b.head.map((h, i) => Math.max(6, Math.min(60, Math.max(len(h), ...b.rows.map((r) => len(r[i] || []))))));
  const sum = weight.reduce((a, c) => a + c, 0);
  const widths = weight.map((w) => Math.round((w / sum) * TEXT_W));
  widths[widths.length - 1] += TEXT_W - widths.reduce((a, c) => a + c, 0);
  const size = cols >= 5 ? 16 : cols >= 4 ? 17 : 18;
  const cell = (nodes, i, head, even) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA },
    verticalAlign: head ? VerticalAlign.BOTTOM : VerticalAlign.TOP,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
    shading: !head && even ? { type: ShadingType.CLEAR, fill: STRIPE, color: 'auto' } : undefined,
    borders: head
      ? { top: noBorder, left: noBorder, right: noBorder, bottom: { style: BorderStyle.SINGLE, size: 8, color: NAVY } }
      : { top: noBorder, left: noBorder, right: noBorder, bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER } },
    children: [new Paragraph({
      alignment: ({ center: AlignmentType.CENTER, right: AlignmentType.RIGHT }[b.align[i]]) || AlignmentType.LEFT,
      spacing: { before: 0, after: 0 },
      children: runs(nodes, { size, ...(head ? { bold: true, color: NAVY } : {}) }),
    })],
  });
  return new Table({
    width: { size: TEXT_W, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: b.head.map((h, i) => cell(h, i, true, false)) }),
      ...b.rows.map((r, ri) => new TableRow({ cantSplit: true, children: b.head.map((_, i) => cell(r[i] || [], i, false, ri % 2 === 1)) })),
    ],
  });
}

function blockNodes(file, bs, ctx, ind = { level: 0, left: 0, note: false }) {
  const out = [];
  for (const b of bs) {
    const indent = ind.left ? { left: ind.left } : undefined;
    if (b.k === 'h') {
      const l = levelOf(file, b.level);
      out.push(new Paragraph({
        heading: HEADINGS[l - 1], pageBreakBefore: false,
        children: [new Bookmark({ id: bookmarkId(b.id), children: [new TextRun(b.text)] })],
      }));
    } else if (b.k === 'p') {
      out.push(new Paragraph({ children: runs(b.c), indent, spacing: { after: 120 }, ...(ind.number ? { numbering: ind.number } : {}) }));
      ind = { ...ind, number: undefined };
    } else if (b.k === 'hr') {
      out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 1 } }, spacing: { after: 120 } }));
    } else if (b.k === 'code') {
      out.push(...codeParagraphs(b).map((p) => p));
    } else if (b.k === 'note') {
      // a note: its paragraphs with a teal bar and a tint
      for (const inner of blockNodes(file, b.b, ctx, ind)) {
        if (inner instanceof Paragraph) out.push(inner);
        else out.push(inner);
      }
    } else if (b.k === 'list') {
      const ref = b.ordered ? `ol${ctx.ol += 1}` : 'bullets';
      if (b.ordered) ctx.orderedRefs.push({ ref, start: b.start });
      b.items.forEach((item) => {
        const lvl = Math.min(ind.level, 4);
        const number = { reference: ref, level: lvl };
        const first = item.findIndex((x) => x.k === 'p');
        item.forEach((x, i) => {
          if (x.k === 'list') out.push(...blockNodes(file, [x], ctx, { level: ind.level + 1, left: 0 }));
          else if (i === first) out.push(...blockNodes(file, [x], ctx, { level: lvl, left: 0, number }));
          else out.push(...blockNodes(file, [x], ctx, { level: lvl, left: 360 * (lvl + 1) }));
        });
      });
    } else if (b.k === 'table') {
      out.push(tableFor(b), new Paragraph({ spacing: { after: 120 }, children: [] }));
    }
  }
  return out;
}

/** Notes need a bar: draw them by wrapping the paragraphs' look in a one-cell table. */
function noteTable(file, b, ctx) {
  return new Table({
    width: { size: TEXT_W, type: WidthType.DXA },
    columnWidths: [TEXT_W],
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: TEXT_W, type: WidthType.DXA },
      margins: { top: 80, bottom: 40, left: 160, right: 120 },
      shading: { type: ShadingType.CLEAR, fill: 'E8F7F4', color: 'auto' },
      borders: { top: noBorder, bottom: noBorder, right: noBorder, left: { style: BorderStyle.SINGLE, size: 24, color: TEAL } },
      children: blockNodes(file, b.b, ctx),
    })] })],
  });
}

function flatten(file, bs, ctx) {
  // notes become one-cell tables; everything else is drawn by blockNodes
  const out = [];
  let run = [];
  const flush = () => { if (run.length) { out.push(...blockNodes(file, run, ctx)); run = []; } };
  for (const b of bs) {
    if (b.k === 'note') { flush(); out.push(noteTable(file, b, ctx), new Paragraph({ spacing: { after: 120 }, children: [] })); } else run.push(b);
  }
  flush();
  return out;
}

const heading = (level, text, id, pageBreak) => new Paragraph({
  heading: HEADINGS[level - 1], pageBreakBefore: pageBreak,
  children: id ? [new Bookmark({ id: bookmarkId(id), children: [new TextRun(text)] })] : [new TextRun(text)],
});

function cover(model, info, crest) {
  const centre = (children, after = 0, before = 0) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before, after, line: 240, lineRule: LineRuleType.AUTO }, children });
  return [
    centre([new ImageRun({ type: 'png', data: crest, transformation: { width: 150, height: 150 } })], 360, 1700),
    centre([new TextRun({ text: 'NIGERIAN NAVY', font: BODY, size: 28, bold: true, color: INK, characterSpacing: 60 })], 120),
    centre([new TextRun({ text: 'CIRERMS', font: HEAD, size: 84, bold: true, color: NAVY, characterSpacing: 40 })], 60),
    centre([new TextRun({ text: 'Centralised Integrated Ratings Electronic Records Management System', size: 19, color: MUTED })], 360),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: TEAL, space: 1 } }, indent: { left: 3400, right: 3400 }, children: [] }),
    centre([new TextRun({ text: 'Technical Handbook', font: HEAD, size: 46, bold: true, color: INK })], 60),
    centre([new TextRun({ text: 'Technical Guide · Runbooks · Worked Example', size: 22, color: MUTED })], 480),
    centre([new TextRun({ text: 'Date: ', size: 22, color: MUTED }), new TextRun({ text: info.date, size: 22, bold: true })], 60),
    centre([new TextRun({ text: 'Built from: ', size: 22, color: MUTED }), new TextRun({ text: `master ${info.commit}`, size: 22, bold: true })], 0),
  ];
}

async function buildWord(model, info, crestFile) {
  const ctx = { ol: 0, orderedRefs: [] };
  const crest = fs.readFileSync(crestFile);
  const body = [];
  body.push(new Paragraph({ children: [new TextRun({ text: 'Contents', font: HEAD, size: 40, bold: true, color: NAVY })], spacing: { after: 240 } }));
  body.push(new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-3' }));

  // the introduction
  body.push(heading(1, model.intro.title, 'intro', true), ...flatten(model.intro, model.intro.blocks, ctx));
  for (const part of model.parts) {
    body.push(heading(1, `Part ${part.n}: ${part.title}`, part.id, true));
    body.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: part.blurb, color: MUTED })] }));
    for (const file of part.files) {
      body.push(heading(2, file.title, file.id, true), ...flatten(file, file.blocks, ctx));
    }
  }

  const bullet = (level) => ({ level, format: LevelFormat.BULLET, text: ['•', '–', '•', '–', '•'][level], alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540 + level * 360, hanging: 270 } } } });
  const decimal = (level, start) => ({ level, format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN, LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER][level], text: `%${level + 1}.`, alignment: AlignmentType.LEFT, start: level === 0 ? start : 1, style: { paragraph: { indent: { left: 540 + level * 360, hanging: 360 } } } });
  const config = [{ reference: 'bullets', levels: [0, 1, 2, 3, 4].map(bullet) }];
  ctx.orderedRefs.forEach(({ ref, start }) => config.push({ reference: ref, levels: [0, 1, 2, 3, 4].map((l) => decimal(l, start)) }));

  const footer = new Footer({
    children: [new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: TEXT_W }],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER, space: 4 } },
      children: [
        new TextRun({ text: `RESTRICTED — Nigerian Navy CIRERMS | Technical Handbook | ${info.date}`, size: 15, color: MUTED }),
        new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 15, color: MUTED }),
      ],
    })],
  });

  const page = { page: { size: { width: 11906, height: 16838 }, margin: { top: MARGIN, bottom: 1300, left: MARGIN, right: MARGIN, footer: 560 } } };
  const doc = new Document({
    creator: 'CIRERMS',
    title: 'CIRERMS Technical Handbook',
    description: 'Technical Guide, Runbooks and Worked Example',
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: BODY, size: 20, color: INK }, paragraph: { spacing: { line: 300, lineRule: LineRuleType.AUTO } } } },
      paragraphStyles: [
        headingStyle(1, 44, { before: 0, after: 200, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL, space: 4 } } }),
        headingStyle(2, 34, { before: 0, after: 200, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 3 } } }),
        headingStyle(3, 26, { before: 360, after: 120 }),
        headingStyle(4, 22, { before: 280, after: 100, color: INK }),
        headingStyle(5, 20, { before: 200, after: 80, color: INK, font: BODY }),
        {
          id: 'Code', name: 'Code', basedOn: 'Normal', quickFormat: true,
          run: { font: MONO, size: 16 },
          paragraph: { shading: { type: ShadingType.CLEAR, fill: STRIPE, color: 'auto' }, indent: { left: 120, right: 120 }, spacing: { line: 250, lineRule: LineRuleType.AUTO }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: NAVY, space: 6 } } },
        },
        { id: 'TOC1', name: 'toc 1', basedOn: 'Normal', next: 'Normal', run: { bold: true, size: 21 }, paragraph: { spacing: { before: 120, after: 20 } } },
        { id: 'TOC2', name: 'toc 2', basedOn: 'Normal', next: 'Normal', run: { bold: true, size: 19 }, paragraph: { indent: { left: 240 }, spacing: { before: 0, after: 0 } } },
        { id: 'TOC3', name: 'toc 3', basedOn: 'Normal', next: 'Normal', run: { size: 17, color: MUTED }, paragraph: { indent: { left: 480 }, spacing: { before: 0, after: 0 } } },
      ],
    },
    numbering: { config },
    sections: [
      { properties: { ...page, titlePage: false }, footers: { default: new Footer({ children: [new Paragraph({ children: [] })] }) }, children: cover(model, info, crest) },
      { properties: { ...page, type: 'nextPage' }, footers: { default: footer }, children: body },
    ],
  });
  return Packer.toBuffer(doc);
}

module.exports = { buildWord };
