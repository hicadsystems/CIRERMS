'use strict';

/*
 * The PDF book: the person's own cut of the guide, made by renderPdf from the user-guide-book template, in the
 * house printout style (crest, watermark, fonts, header, and the footer with RESTRICTED and Page X of Y).
 *   - a cover: the crest, CIRERMS, User Guide, the date and who it was made for (their name and role);
 *   - a table of contents with the real page of every chapter and section: the book is made once, the page each
 *     heading landed on is read from the PDF's own links (pdfjs-dist), and it is made again with those numbers;
 *   - each chapter starts a new page; pictures are those of the set the reader chose (device and theme; a picture
 *     taken for one device only falls back to the other device's capture, in the chosen theme), each drawn at the
 *     size it was taken, a phone's centred, as data URIs so nothing is fetched while rendering, never cut across a
 *     page, each with its legend. The paper stays light in every set: only the pictures change.
 */
const fs = require('fs');
const path = require('path');
const { renderPdf, today } = require('../../shared/printouts');
const store = require('./guide.store');
const service = require('./guide.service');
const { badRequest } = require('../../shared/errors');

// a book carries its pictures: it may be far larger than a list's printout
const MAX_HTML_MB = 400;

const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline spans as HTML (every word escaped). A link to another part of the guide is a link inside the book. */
function spansHtml(spans, ids) {
  return spans.map((s) => {
    let html = esc(s.text);
    if (s.code) html = `<code>${html}</code>`;
    if (s.italic) html = `<i>${html}</i>`;
    if (s.bold) html = `<b>${html}</b>`;
    if (s.link && s.link.kind === 'section' && ids.has(s.link.to)) html = `<a class="sec-link" href="#${esc(ids.get(s.link.to))}">${html}</a>`;
    return html;
  }).join('');
}

const NOTE_LABEL = { tip: 'Tip:', important: 'Important:', note: 'Note:' };

const SETS = { desktop: 'Desktop', phone: 'Mobile', light: 'Light Mode', dark: 'Dark Mode' };

function pictureFor(chapter, figure, images, set) {
  const spec = chapter.pictures[figure.shot];
  if (!spec) return null;
  // the chosen device's picture; one taken for the other device only is used as it is, in the chosen theme
  const device = spec.devices.includes(set.device) ? set.device : spec.devices[0];
  const file = path.join(store.imgDir, chapter.slug, `${figure.shot}.${device}.${set.theme}.png`);
  if (!images.has(file)) images.set(file, fs.existsSync(file) ? `data:image/png;base64,${fs.readFileSync(file).toString('base64')}` : null);
  const src = images.get(file);
  if (!src) return null;
  // drawn at the size it was taken (its pixels over the device scale, 2), as CSS pixels: sharp, never enlarged; the page caps it at the text width
  const size = service.pngSize(file);
  return { src, alt: figure.alt, width: size ? Math.round(size.w / 2) : null, centre: device === 'phone', legend: spec.legend };
}

function blocksFor(chapter, blocks, ids, images, set) {
  return blocks.map((b) => {
    if (b.kind === 'paragraph') return { kind: b.kind, html: spansHtml(b.spans, ids) };
    if (b.kind === 'note') return { kind: b.kind, tone: b.tone, label: NOTE_LABEL[b.tone], html: spansHtml(b.spans, ids) };
    if (b.kind === 'bullets') return { kind: b.kind, items: b.items.map((s) => ({ html: spansHtml(s, ids) })) };
    if (b.kind === 'steps') return { kind: b.kind, items: b.items.map((s) => ({ n: s.n, html: spansHtml(s.spans, ids), figure: s.figure ? pictureFor(chapter, s.figure, images, set) : null })) };
    if (b.kind === 'table') return { kind: b.kind, head: b.head.map((c) => ({ html: spansHtml(c, ids) })), rows: b.rows.map((r) => ({ cells: r.map((c) => ({ html: spansHtml(c, ids) })) })) };
    return { kind: 'figure', figure: pictureFor(chapter, b.figure, images, set) || { src: null } };
  });
}

/** What the template reads. Headings get ids (c1, c1-s2, c1-s2-t1), which the contents link to. */
function bookData(user, cut, set) {
  const ids = new Map(); // a section's or task's slug -> its id in the book
  cut.chapters.forEach((c, ci) => c.sections.forEach((s, si) => {
    ids.set(s.slug, `c${ci + 1}-s${si + 1}`);
    s.tasks.forEach((t, ti) => ids.set(t.slug, `c${ci + 1}-s${si + 1}-t${ti + 1}`));
  }));
  const images = new Map();
  const toc = [];
  const chapters = cut.chapters.map((c, ci) => {
    const n = ci + 1;
    toc.push({ id: `c${n}`, n, title: c.title, page: 0, sections: c.sections.map((s, si) => ({ id: `c${n}-s${si + 1}`, n: `${n}.${si + 1}`, title: s.title, page: 0 })) });
    return {
      id: `c${n}`,
      n,
      title: c.title,
      summary: c.summary,
      intro: blocksFor(c, c.intro, ids, images, set),
      sections: c.sections.map((s, si) => ({
        id: `c${n}-s${si + 1}`,
        n: `${n}.${si + 1}`,
        title: s.title,
        blocks: blocksFor(c, s.blocks, ids, images, set),
        tasks: s.tasks.map((t, ti) => ({ id: `c${n}-s${si + 1}-t${ti + 1}`, title: t.title, blocks: blocksFor(c, t.blocks, ids, images, set) })),
      })),
    };
  });
  return {
    title: 'User Guide',
    generatedBy: user.fullName || user.username,
    cover: { set: `${SETS[set.device]} · ${SETS[set.theme]}`, name: user.fullName || user.username, role: user.role || 'User', date: today() },
    toc,
    chapters,
  };
}

/** The page (1 is the cover) each heading landed on, read from the links of the contents. */
async function headingPages(pdfBuffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer), isEvalSupported: false, useSystemFonts: false }).promise;
  const pages = new Map();
  try {
    for (let n = 1; n <= pdf.numPages; n += 1) {
      // eslint-disable-next-line no-await-in-loop
      const page = await pdf.getPage(n);
      // eslint-disable-next-line no-await-in-loop
      const links = (await page.getAnnotations()).filter((a) => a.subtype === 'Link' && typeof a.dest === 'string');
      for (const link of links) {
        if (pages.has(link.dest)) continue;
        // eslint-disable-next-line no-await-in-loop
        const dest = await pdf.getDestination(link.dest);
        // eslint-disable-next-line no-await-in-loop
        if (dest) pages.set(link.dest, (await pdf.getPageIndex(dest[0])) + 1);
      }
    }
  } finally {
    await pdf.destroy();
  }
  return pages;
}

async function buildBook(user, set = { device: 'desktop', theme: 'light' }) {
  const cut = service.cutFor(user);
  if (!cut.chapters.length) throw badRequest('There is no part of the guide for your role yet.', 'GUIDE_EMPTY');
  const data = bookData(user, cut, set);
  const options = { maxHtmlMb: MAX_HTML_MB };
  const first = await renderPdf('user-guide-book', data, options);
  const pages = await headingPages(first);
  data.toc.forEach((c) => {
    c.page = pages.get(c.id) || '';
    c.sections.forEach((s) => { s.page = pages.get(s.id) || ''; });
  });
  return renderPdf('user-guide-book', data, options);
}

module.exports = { buildBook, bookData };
