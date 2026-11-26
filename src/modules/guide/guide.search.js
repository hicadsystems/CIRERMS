'use strict';

/*
 * The guide's search: words only (no meaning search), over the chapters as this reader receives them, so it can
 * never find a part the reader would not be sent, and the step it names is the step as they read it. At least 2
 * characters; every word typed must appear (a word may begin or sit inside a longer one); the best 25.
 * Each result names the section or task to open and, for a step, its number.
 */
const { textOf } = require('./guide.format');

const MAX = 25;
const WEIGHT = { title: 12, task: 9, step: 5, picture: 3, text: 2 };

const plain = (spans) => textOf(spans);

/** Every part of a cut chapter a search can land on: { kind, text, chapter, section, task, step }. */
function passages(chapter) {
  const out = [];
  chapter.sections.forEach((section) => {
    const base = { chapter: chapter.slug, chapterTitle: chapter.title, section: section.slug, sectionTitle: section.title };
    out.push({ ...base, kind: 'title', text: section.title, anchor: section.slug, taskTitle: null, step: null });
    const walk = (blocks, anchor, taskTitle) => blocks.forEach((b) => {
      const at = { ...base, anchor, taskTitle };
      if (b.kind === 'steps') b.items.forEach((s) => out.push({ ...at, kind: 'step', text: plain(s.spans), step: s.n }));
      else if (b.kind === 'bullets') b.items.forEach((s) => out.push({ ...at, kind: 'text', text: plain(s), step: null }));
      else if (b.kind === 'table') {
        const head = b.head.map(plain);
        b.rows.forEach((r) => out.push({ ...at, kind: 'text', text: r.map((c, i) => (head[i] ? `${head[i]}: ${plain(c)}` : plain(c))).join('; '), step: null }));
      } else if (b.kind === 'figure') {
        const spec = chapter.pictures[b.figure.shot];
        const marks = spec ? spec.legend.map((m) => m.text).join('. ') : '';
        out.push({ ...at, kind: 'picture', text: [b.figure.alt, marks].filter(Boolean).join('. '), step: null });
      } else out.push({ ...at, kind: 'text', text: plain(b.spans), step: null });
      if (b.kind === 'steps') b.items.forEach((s) => { if (s.figure) out.push({ ...at, kind: 'picture', text: s.figure.alt, step: s.n }); });
    });
    walk(section.blocks, section.slug, null);
    section.tasks.forEach((task) => {
      out.push({ ...base, kind: 'task', text: task.title, anchor: task.slug, taskTitle: task.title, step: null });
      walk(task.blocks, task.slug, task.title);
    });
  });
  return out.filter((p) => p.text);
}

/** The words of a query: letters and digits only, lower case. */
const wordsOf = (q) => (String(q || '').toLowerCase().match(/[a-z0-9]+/g) || []);

/** A long passage is cut to about 180 characters around the first word found. */
function snippet(text, words) {
  if (text.length <= 180) return text;
  const at = Math.max(0, text.toLowerCase().indexOf(words[0]));
  const from = Math.max(0, Math.min(at - 50, text.length - 180));
  return `${from > 0 ? '...' : ''}${text.slice(from, from + 180).trim()}${from + 180 < text.length ? '...' : ''}`;
}

function search(cut, query) {
  const words = wordsOf(query);
  if (String(query || '').trim().length < 2 || !words.length) return [];
  const scored = [];
  cut.chapters.forEach((chapter) => {
    passages(chapter).forEach((p) => {
      const hay = p.text.toLowerCase();
      let score = WEIGHT[p.kind];
      for (const w of words) {
        const at = hay.indexOf(w);
        if (at < 0) return;
        // a word that begins a word of the text counts for more than one inside a word
        score += at === 0 || !/[a-z0-9]/.test(hay[at - 1]) ? 3 : 1;
      }
      scored.push({ ...p, score: score - Math.min(p.text.length, 400) / 400 });
    });
  });
  scored.sort((a, b) => b.score - a.score);
  // one result for each place a reader would land: a step, a task or a section
  const seen = new Set();
  const results = [];
  for (const p of scored) {
    const key = `${p.anchor}#${p.step || 0}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      chapter: p.chapter,
      chapterTitle: p.chapterTitle,
      section: p.section,
      sectionTitle: p.sectionTitle,
      anchor: p.anchor,
      taskTitle: p.taskTitle,
      step: p.step,
      kind: p.kind,
      text: snippet(p.text, words),
    });
    if (results.length === MAX) break;
  }
  return results;
}

module.exports = { search, wordsOf, MAX };
