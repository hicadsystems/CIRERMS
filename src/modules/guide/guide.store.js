'use strict';

/*
 * The chapters on disk, read once and kept: docs/manual/*.md (README.md is the writers' page and is not a
 * chapter; a file that does not open with front matter is not in the guide yet). In development the
 * folder is looked at on every request and read again when a file changed; in production it is read at
 * start. Every mistake the parser or the checks across chapters find is kept as a line in `problems`
 * and logged once when the chapters are read.
 *
 *   store.get()          { chapters, problems, byAnchor, version }   chapters in guide order
 *   store.dir / store.imgDir
 */
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { parseChapter, isChapter, eachSpan } = require('./guide.format');
const nav = require('./guide.nav');

const dir = path.join(config.rootDir, 'docs', 'manual');
const imgDir = path.join(dir, 'img');

let loaded = null;
let signature = null;

const files = () => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').sort() : []);

/** The folder's state: each file's name, size and time. */
function signatureOf() {
  return files().map((f) => {
    const s = fs.statSync(path.join(dir, f));
    return `${f}:${s.size}:${s.mtimeMs}`;
  }).join('|');
}

/** What only the whole guide can show: slugs used twice, links to nowhere, screens and privileges that do not exist. */
function checkAcross(chapters, problems) {
  const known = nav.screens();
  const byAnchor = new Map();
  const note = (slug, where, line, kind) => {
    if (!slug) return;
    if (byAnchor.has(slug)) problems.push(`${where.file}:${line + 1}: the slug "${slug}" is used twice (also in ${byAnchor.get(slug).chapter.file})`);
    else byAnchor.set(slug, { ...where, kind });
  };
  chapters.forEach((chapter) => {
    chapter.sections.forEach((section) => {
      note(section.slug, { chapter, section, task: null }, section.line, 'section');
      section.tasks.forEach((task) => note(task.slug, { chapter, section, task }, task.line, 'task'));
    });
  });
  const needCheck = (needs, where) => needs.forEach((n) => {
    if (!known.has(n.screen)) problems.push(`${where}: needs names ${n.screen}, which is no screen in public/js/core/nav.js`);
  });
  chapters.forEach((chapter) => {
    chapter.sections.forEach((section) => {
      const at = `${chapter.file}:${section.line + 1}`;
      if (section.screen && !known.has(section.screen)) problems.push(`${at}: screen ${section.screen} is no screen in public/js/core/nav.js`);
      needCheck(section.needs, at);
      section.tasks.forEach((t) => needCheck(t.needs, `${chapter.file}:${t.line + 1}`));
    });
    eachSpan(chapter, (spans, line) => spans.forEach((s) => {
      if (!s.link) return;
      const where = `${chapter.file}:${line + 1}`;
      if (s.link.kind === 'section' && !byAnchor.has(s.link.to)) problems.push(`${where}: the link to #${s.link.to} names no section or task of the guide`);
      if (s.link.kind === 'screen' && !nav.pageFor(s.link.to)) problems.push(`${where}: the link to #${s.link.to} opens no screen (public/js/core/nav.js)`);
    }));
    Object.values(chapter.shots).forEach((spec) => {
      if (spec.as !== 'guest' && !/^[a-z][a-z0-9-]*$/.test(spec.as)) problems.push(`${chapter.file}: picture ${spec.id}: as is a demo account's short name (admin, records, clerk ...)`);
      if (spec.open && spec.open.startsWith('#') && !nav.pageFor(spec.open)) problems.push(`${chapter.file}: picture ${spec.id}: open ${spec.open} opens no screen`);
    });
  });
  return byAnchor;
}

function read() {
  const chapters = [];
  const problems = [];
  files().forEach((file) => {
    const text = fs.readFileSync(path.join(dir, file), 'utf8');
    if (!text.trim() || !isChapter(text)) return;
    const r = parseChapter(text, file);
    problems.push(...r.problems);
    chapters.push(r.chapter);
  });
  chapters.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  const byAnchor = checkAcross(chapters, problems);
  const version = signatureOf();
  if (problems.length) console.warn(`[guide] ${problems.length} problem(s) in the chapters:\n  ${problems.join('\n  ')}`);
  return { chapters, problems, byAnchor, version };
}

function get() {
  if (!loaded || (!config.isProduction && signatureOf() !== signature)) {
    loaded = read();
    signature = loaded.version;
  }
  return loaded;
}

module.exports = { get, dir, imgDir };
