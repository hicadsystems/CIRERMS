'use strict';

/*
 * Cutting the guide to one reader. Everything the guide, the Ctrl+H panel, the search, the pictures and the
 * PDF book send is made here, from the person's own privileges, so nobody is ever sent a part they may not
 * use:
 *   - a section about a screen goes only to someone who may open that screen;
 *   - a section, task, step, note, list item or table row with `needs` goes only to someone who holds every one;
 *   - steps are numbered again after the cut;
 *   - a link to a screen the reader may not open, or to a part they do not receive, becomes plain words;
 *   - a task or section with nothing left is dropped, and a chapter with no section left is not listed.
 *
 *   const { cutAll } = require('./guide.cut');
 *   const cut = cutAll(chapters, user);         { chapters: [wire chapter], anchors: Map(slug -> { chapter, section, task }) }
 */
const { can } = require('../../middleware/access');
const nav = require('./guide.nav');

function readerOf(user) {
  const holds = (needs) => needs.every((n) => can(user, n.screen, n.action));
  const opens = (screen) => can(user, screen, nav.openAction(screen));
  const addressOpens = (route) => {
    const page = nav.pageFor(route);
    return !!page && page.screen !== 'soon' && can(user, page.screen, page.action || 'view');
  };
  return { holds, opens, addressOpens };
}

/** One chapter as this reader receives it (the wire shape), or null when nothing is left. */
function cutChapter(chapter, reader) {
  const shots = new Set();
  const see = (figure) => { if (figure) shots.add(figure.shot); return figure; };
  // a link that reaches somewhere the reader may not go becomes plain words (section links are settled after every chapter is cut)
  const plainLinks = (spans) => spans.map((s) => (s.link && s.link.kind === 'screen' && !reader.addressOpens(s.link.to) ? { ...s, link: null } : s));

  const cutBlocks = (blocks) => {
    const out = [];
    blocks.forEach((b) => {
      if (b.kind === 'steps') {
        const items = b.items.filter((s) => reader.holds(s.needs));
        if (items.length) out.push({ kind: 'steps', items: items.map((s, n) => ({ n: n + 1, spans: plainLinks(s.spans), figure: see(s.figure) })) });
      } else if (b.kind === 'bullets') {
        const items = b.items.filter((s) => reader.holds(s.needs));
        if (items.length) out.push({ kind: 'bullets', items: items.map((s) => plainLinks(s.spans)) });
      } else if (b.kind === 'table') {
        const rows = b.rows.filter((r) => reader.holds(r.needs));
        if (rows.length) out.push({ kind: 'table', head: b.head.map(plainLinks), rows: rows.map((r) => r.cells.map(plainLinks)) });
      } else if (!reader.holds(b.needs)) {
        // not for this reader
      } else if (b.kind === 'paragraph') out.push({ kind: 'paragraph', spans: plainLinks(b.spans) });
      else if (b.kind === 'note') out.push({ kind: 'note', tone: b.tone, spans: plainLinks(b.spans) });
      else if (b.kind === 'figure') out.push({ kind: 'figure', figure: see(b.figure) });
    });
    return out;
  };

  const sections = [];
  chapter.sections.forEach((s) => {
    if (s.screen && !reader.opens(s.screen)) return;
    if (!reader.holds(s.needs)) return;
    const tasks = s.tasks
      .filter((t) => reader.holds(t.needs))
      .map((t) => ({ slug: t.slug, title: t.title, blocks: cutBlocks(t.blocks) }))
      .filter((t) => t.blocks.length);
    const blocks = cutBlocks(s.blocks);
    if (!blocks.length && !tasks.length) return;
    sections.push({ slug: s.slug, title: s.title, screen: s.screen, blocks, tasks });
  });
  if (!sections.length) return null;
  const intro = cutBlocks(chapter.intro);
  // only the pictures that remain; each with the devices it was taken for and its marks' legend
  const pictures = {};
  shots.forEach((id) => {
    const spec = chapter.shots[id];
    if (spec) pictures[id] = { devices: spec.devices, legend: spec.marks.map((m) => ({ n: m.n, text: m.text })) };
  });
  return { slug: chapter.slug, title: chapter.title, summary: chapter.summary, module: chapter.module, intro, sections, pictures };
}

function cutAll(chapters, user) {
  const reader = readerOf(user);
  const cut = chapters.map((c) => cutChapter(c, reader)).filter(Boolean);
  const anchors = new Map();
  cut.forEach((chapter) => chapter.sections.forEach((section) => {
    anchors.set(section.slug, { chapter, section, task: null });
    section.tasks.forEach((task) => anchors.set(task.slug, { chapter, section, task }));
  }));
  // a link to a part of the guide this reader does not receive is plain words
  const settle = (spans) => spans.map((s) => (s.link && s.link.kind === 'section' && !anchors.has(s.link.to) ? { ...s, link: null } : s));
  const settleBlocks = (blocks) => blocks.forEach((b) => {
    if (b.kind === 'steps') b.items.forEach((s) => { s.spans = settle(s.spans); });
    else if (b.kind === 'bullets') b.items.forEach((s, i) => { b.items[i] = settle(s); });
    else if (b.kind === 'table') { b.head = b.head.map(settle); b.rows = b.rows.map((r) => r.map(settle)); } else if (b.spans) b.spans = settle(b.spans);
  });
  cut.forEach((chapter) => {
    settleBlocks(chapter.intro);
    chapter.sections.forEach((s) => { settleBlocks(s.blocks); s.tasks.forEach((t) => settleBlocks(t.blocks)); });
  });
  return { chapters: cut, anchors };
}

/** The contents: chapters, sections (with their screen, so the panel can open at the page in view) and tasks. */
function contents(cut) {
  return cut.chapters.map((c) => ({
    slug: c.slug,
    title: c.title,
    summary: c.summary,
    module: c.module,
    sections: c.sections.map((s) => ({ slug: s.slug, title: s.title, screen: s.screen, tasks: s.tasks.map((t) => ({ slug: t.slug, title: t.title })) })),
  }));
}

module.exports = { cutAll, contents, readerOf };
