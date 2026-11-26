# CIRERMS Technical Handbook

The project's technical documents, combined into one book in two forms:

| File | What it is |
|---|---|
| `CIRERMS-Technical-Handbook.pdf` | The book in the CIRERMS printout style: cover, contents with page numbers, each part and each document from a new page |
| `CIRERMS-Technical-Handbook.docx` | The same book as a Word file, with Word's own heading styles, so it can be edited. Word asks to update the fields when it opens the file: choose **Yes**, and the contents fill in with their page numbers |

Both are built from the Markdown by a script. Do not edit them by hand: change the Markdown, then rebuild.

## What is in it

- Introduction: `docs/README.md`
- Part 1, Technical Guide: `docs/development/` (7 files)
- Part 2, Runbooks: `docs/runbooks/` (6 files)
- Part 3, Worked Example: `docs/examples/ratings-flow/` (3 files)

Within a part the README comes first, then the other files in the order the README mentions them. A file added to one of these folders later is picked up by the same rules.

## Rebuild

```bash
npm run docs:book
```

It needs no database and no running server. The PDF is drawn by Chromium: set `PDF_CHROMIUM_PATH` in `.env`, or the browser that ships with `@sparticuz/chromium` is used. The script is `scripts/docs-book/build.js`, the PDF template is `src/templates/printouts/docs-book.hbs` with `docs-book.css`, and the Word file is drawn by the `docx` package. When it finishes, the script lists the files it read and any fault the book showed up in the Markdown.
