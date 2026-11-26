'use strict';

/*
 * The handbook's model: which Markdown files make the book, in which order, and each one as a small tree of
 * blocks and inline pieces that both the PDF (html.js) and the Word file (word.js) are drawn from.
 *
 *   Introduction   docs/README.md
 *   Part 1         docs/development/   (README first, then the order its README gives)
 *   Part 2         docs/runbooks/      (the same rule)
 *   Part 3         docs/examples/ratings-flow/  (README, then the scripts as code listings)
 *
 * A file that a set gains later is picked up by the same rules. Links between the book's own files become links
 * inside the book; a link to a file that is not in the book is shown as plain text; a link whose file or heading
 * does not exist is listed as a fault in the build's report (the Markdown is never changed).
 */
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..', '..');

const INTRO = { path: 'docs/README.md', title: 'Introduction' };
const PARTS = [
  { key: 'guide', title: 'Technical Guide', dir: 'docs/development', blurb: 'How CIRERMS is built, how to run it on your own machine, and how to add to it: architecture, modules, the browser side, the database and testing.' },
  { key: 'runbooks', title: 'Runbooks', dir: 'docs/runbooks', blurb: 'What to do when you look after a running system: deployment, migrations, recovery, uploads and storage, and what to check when something breaks.' },
  { key: 'example', title: 'Worked Example', dir: 'docs/examples/ratings-flow', blurb: 'A copy-and-paste check of the Ratings module from the API to the browser, with its two scripts printed in full.' },
];
const CODE_LANG = { '.js': 'js', '.mjs': 'js', '.json': 'json', '.sql': 'sql', '.sh': 'bash', '.ps1': 'powershell', '.html': 'html', '.css': 'css', '.yml': 'yaml', '.yaml': 'yaml' };

const rel = (p) => p.split(path.sep).join('/');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

/** GitHub's heading ids: lower case, punctuation dropped, spaces to hyphens, repeats numbered. */
function slugger() {
  const seen = new Map();
  return (text) => {
    const base = text.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').trim().replace(/\s/g, '-');
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };
}

const plain = (tokens) => (tokens || []).map((t) => (t.tokens ? plain(t.tokens) : t.text || '')).join('');

/** Which files make a set, in book order: README, then the order the README mentions the others, then A to Z. */
function orderedFiles(dir) {
  const all = fs.readdirSync(path.join(ROOT, dir)).filter((f) => fs.statSync(path.join(ROOT, dir, f)).isFile());
  const readme = all.find((f) => f.toLowerCase() === 'readme.md');
  const text = readme ? read(`${dir}/${readme}`) : '';
  const others = all.filter((f) => f !== readme && (f.endsWith('.md') || CODE_LANG[path.extname(f)]));
  const pos = (f) => { const i = text.indexOf(f); return i < 0 ? Infinity : i; };
  others.sort((a, b) => (pos(a) - pos(b) || 0) || a.localeCompare(b));
  // the Markdown pages come before the scripts in a set that has both
  const md = others.filter((f) => f.endsWith('.md'));
  const code = others.filter((f) => !f.endsWith('.md'));
  return [...(readme ? [readme] : []), ...md, ...code].map((f) => `${dir}/${f}`);
}

function inline(tokens, ctx) {
  const out = [];
  for (const t of tokens || []) {
    if (t.type === 'text' || t.type === 'escape') out.push({ t: 'text', v: t.text });
    else if (t.type === 'codespan') out.push({ t: 'code', v: t.text });
    else if (t.type === 'strong') out.push({ t: 'strong', c: inline(t.tokens, ctx) });
    else if (t.type === 'em') out.push({ t: 'em', c: inline(t.tokens, ctx) });
    else if (t.type === 'del') out.push({ t: 'em', c: inline(t.tokens, ctx) });
    else if (t.type === 'br') out.push({ t: 'br' });
    else if (t.type === 'link') out.push({ t: 'link', href: t.href, from: ctx.file.path, c: inline(t.tokens, ctx) });
    else if (t.type === 'image') out.push({ t: 'text', v: t.text || '' });
    else if (t.type === 'html') out.push({ t: 'text', v: t.text });
    else out.push({ t: 'text', v: t.raw || t.text || '' });
  }
  return out;
}

function blocks(tokens, ctx, top) {
  const out = [];
  for (const t of tokens) {
    if (t.type === 'space' || t.type === 'def') continue;
    if (t.type === 'heading') {
      const text = plain(t.tokens);
      if (top && t.depth === 1 && !ctx.file.titleFromH1) { ctx.file.titleFromH1 = text; ctx.slug(text); continue; }
      const slug = ctx.slug(text);
      const id = `${ctx.file.id}_h${ctx.file.headings.length + 1}`;
      ctx.file.headings.push({ slug, id });
      out.push({ k: 'h', level: t.depth, id, c: inline(t.tokens, ctx), text });
    } else if (t.type === 'paragraph') out.push({ k: 'p', c: inline(t.tokens, ctx) });
    else if (t.type === 'text') out.push({ k: 'p', c: t.tokens ? inline(t.tokens, ctx) : [{ t: 'text', v: t.text }] });
    else if (t.type === 'code') out.push({ k: 'code', lang: t.lang || '', text: t.text });
    else if (t.type === 'hr') out.push({ k: 'hr' });
    else if (t.type === 'html') out.push({ k: 'p', c: [{ t: 'text', v: t.text.trim() }] });
    else if (t.type === 'blockquote') out.push({ k: 'note', b: blocks(t.tokens, ctx, false) });
    else if (t.type === 'list') {
      out.push({ k: 'list', ordered: t.ordered, start: Number(t.start) || 1, items: t.items.map((i) => blocks(i.tokens, ctx, false)) });
    } else if (t.type === 'table') {
      out.push({ k: 'table', align: t.align, head: t.header.map((c) => inline(c.tokens, ctx)), rows: t.rows.map((r) => r.map((c) => inline(c.tokens, ctx))) });
    } else out.push({ k: 'p', c: [{ t: 'text', v: t.raw }] });
  }
  return out;
}

function loadMarkdown(file, partIndex, fileIndex) {
  const f = { path: file.path, id: file.id, headings: [], titleFromH1: '' };
  const ctx = { file: f, slug: slugger() };
  f.blocks = blocks(marked.lexer(read(file.path)), ctx, true);
  f.title = file.title || f.titleFromH1 || path.basename(file.path, '.md');
  return f;
}

function loadCode(file) {
  const ext = path.extname(file.path);
  const f = { path: file.path, id: file.id, headings: [], title: path.basename(file.path) };
  f.blocks = [
    { k: 'p', c: [{ t: 'text', v: 'Source file: ' }, { t: 'code', v: file.path }] },
    { k: 'code', lang: CODE_LANG[ext] || '', text: read(file.path).replace(/\n+$/, '') },
  ];
  return f;
}

/** The book: { intro, parts: [{ id, n, title, blurb, files: [...] }], read: [paths], faults: [] } */
function buildModel() {
  const readPaths = [];
  const intro = loadMarkdown({ path: INTRO.path, id: 'intro', title: INTRO.title });
  intro.isIntro = true;
  readPaths.push(INTRO.path);
  const parts = PARTS.map((p, pi) => {
    const files = orderedFiles(p.dir).map((fp, fi) => {
      readPaths.push(fp);
      const file = { path: fp, id: `p${pi + 1}_f${fi + 1}` };
      return fp.endsWith('.md') ? loadMarkdown(file) : loadCode(file);
    });
    return { id: `p${pi + 1}`, n: pi + 1, title: p.title, blurb: p.blurb, dir: p.dir, files };
  });
  const model = { intro, parts, read: readPaths, faults: [] };
  const all = [intro, ...parts.flatMap((p) => p.files)];
  const byPath = new Map(all.map((f) => [f.path, f]));

  // links: inside the book, plain text, or a fault
  const seenFault = new Set();
  const fault = (msg) => { if (!seenFault.has(msg)) { seenFault.add(msg); model.faults.push(msg); } };
  model.resolve = (href, from) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return { kind: 'external', url: href };
    const [rawPath, frag] = href.split('#');
    const target = rawPath ? rel(path.posix.normalize(path.posix.join(path.posix.dirname(from), decodeURIComponent(rawPath)))) : from;
    const file = byPath.get(target);
    if (!file) {
      if (!fs.existsSync(path.join(ROOT, target))) fault(`${from}: link to a file that does not exist: ${href}`);
      return { kind: 'text' };
    }
    if (!frag) return { kind: 'internal', id: file.id };
    const h = file.headings.find((x) => x.slug === frag);
    if (!h) { fault(`${from}: link to a heading that does not exist: ${href}`); return { kind: 'internal', id: file.id }; }
    return { kind: 'internal', id: h.id };
  };
  // resolve every link now, so faults are known before anything is drawn
  const walkInline = (nodes) => nodes.forEach((n) => { if (n.t === 'link') { n.to = model.resolve(n.href, n.from); } if (n.c) walkInline(n.c); });
  const walkBlocks = (bs) => bs.forEach((b) => {
    if (b.c) walkInline(b.c);
    if (b.b) walkBlocks(b.b);
    if (b.items) b.items.forEach(walkBlocks);
    if (b.head) { b.head.forEach(walkInline); b.rows.forEach((r) => r.forEach(walkInline)); }
  });
  all.forEach((f) => walkBlocks(f.blocks));
  return model;
}

module.exports = { buildModel, ROOT };
