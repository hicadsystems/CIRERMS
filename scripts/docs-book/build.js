'use strict';

/*
 * npm run docs:book: the Technical Handbook, one PDF and one Word file, built from the project's Markdown.
 *
 *   docs/handbook/CIRERMS-Technical-Handbook.pdf    (by renderPdf from src/templates/printouts/docs-book.hbs)
 *   docs/handbook/CIRERMS-Technical-Handbook.docx   (by the `docx` package)
 *   docs/handbook/README.md                         (what they are and how to rebuild them)
 *
 * It needs no database and no web server. The browser for the PDF is PDF_CHROMIUM_PATH in .env, or the one that
 * ships with @sparticuz/chromium. What it read is listed when it finishes, with any fault the book showed up in
 * the Markdown (a link to a missing file, for example); the Markdown itself is never changed.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildModel, ROOT } = require('./model');
const { bookData } = require('./html');
const { buildWord } = require('./word');

const OUT_DIR = path.join(ROOT, 'docs', 'handbook');
const PDF = path.join(OUT_DIR, 'CIRERMS-Technical-Handbook.pdf');
const DOCX = path.join(OUT_DIR, 'CIRERMS-Technical-Handbook.docx');

/** The short id of the master commit the book is built from (the branch's fork point when built elsewhere). */
function masterCommit() {
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  for (const ref of ['origin/master', 'master']) {
    try { return git('rev-parse', '--short', git('merge-base', 'HEAD', ref)); } catch (e) { /* try the next */ }
  }
  try { return git('rev-parse', '--short', 'HEAD'); } catch (e) { return 'unknown'; }
}

/** The page (1 is the cover) each heading landed on, read from the links of the contents. */
async function headingPages(pdfBuffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer), isEvalSupported: false, useSystemFonts: false }).promise;
  const pages = new Map();
  try {
    for (let n = 1; n <= pdf.numPages; n += 1) {
      const page = await pdf.getPage(n);
      const links = (await page.getAnnotations()).filter((a) => a.subtype === 'Link' && typeof a.dest === 'string');
      for (const link of links) {
        if (pages.has(link.dest)) continue;
        const dest = await pdf.getDestination(link.dest);
        if (dest) pages.set(link.dest, (await pdf.getPageIndex(dest[0])) + 1);
      }
    }
    return { pages, total: pdf.numPages };
  } finally {
    await pdf.destroy();
  }
}

const readmeText = (model) => `# CIRERMS Technical Handbook

The project's technical documents, combined into one book in two forms:

| File | What it is |
|---|---|
| \`CIRERMS-Technical-Handbook.pdf\` | The book in the CIRERMS printout style: cover, contents with page numbers, each part and each document from a new page |
| \`CIRERMS-Technical-Handbook.docx\` | The same book as a Word file, with Word's own heading styles, so it can be edited. Word asks to update the fields when it opens the file: choose **Yes**, and the contents fill in with their page numbers |

Both are built from the Markdown by a script. Do not edit them by hand: change the Markdown, then rebuild.

## What is in it

${[`- Introduction: \`${model.intro.path}\``, ...model.parts.map((p) => `- Part ${p.n}, ${p.title}: \`${p.dir}/\` (${p.files.length} files)`)].join('\n')}

Within a part the README comes first, then the other files in the order the README mentions them. A file added to one of these folders later is picked up by the same rules.

## Rebuild

\`\`\`bash
npm run docs:book
\`\`\`

It needs no database and no running server. The PDF is drawn by Chromium: set \`PDF_CHROMIUM_PATH\` in \`.env\`, or the browser that ships with \`@sparticuz/chromium\` is used. The script is \`scripts/docs-book/build.js\`, the PDF template is \`src/templates/printouts/docs-book.hbs\` with \`docs-book.css\`, and the Word file is drawn by the \`docx\` package. When it finishes, the script lists the files it read and any fault the book showed up in the Markdown.
`;

async function main() {
  require('dotenv').config({ path: path.join(ROOT, '.env') });
  const { renderPdf, today, close } = require('../../src/shared/printouts');
  const model = buildModel();
  const info = { date: today(), commit: masterCommit() };
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const data = bookData(model, info);
  data.title = 'Technical Handbook';
  const options = { maxHtmlMb: 60 };
  try {
    const first = await renderPdf('docs-book', data, options);
    const { pages } = await headingPages(first);
    data.toc.forEach((e) => { e.page = pages.get(e.id) || ''; });
    const final = await renderPdf('docs-book', data, options);
    const check = await headingPages(final);
    const moved = data.toc.filter((e) => check.pages.get(e.id) !== e.page);
    if (moved.length) throw new Error(`The contents' page numbers moved on the second pass (${moved.length} headings); build again.`);
    fs.writeFileSync(PDF, final);
    console.log(`PDF   ${path.relative(ROOT, PDF)}  ${check.total} pages  ${(final.length / 1024).toFixed(0)} KB`);
  } finally {
    await close();
  }

  const word = await buildWord(model, info, path.join(ROOT, 'public', 'assets', 'navy-logo.png'));
  fs.writeFileSync(DOCX, word);
  console.log(`Word  ${path.relative(ROOT, DOCX)}  ${(word.length / 1024).toFixed(0)} KB`);

  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), readmeText(model));

  console.log(`\nFiles read (${model.read.length}):`);
  model.read.forEach((f) => console.log(`  ${f}`));
  console.log(model.faults.length ? `\nFaults the book showed up (the Markdown is unchanged):\n${model.faults.map((f) => `  - ${f}`).join('\n')}` : '\nNo faults found in the Markdown.');
}

main().catch((e) => { console.error(e); process.exit(1); });
