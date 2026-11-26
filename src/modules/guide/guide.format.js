'use strict';

/*
 * The chapter format: one Markdown file per chapter in docs/manual (docs/manual/README.md says how to
 * write one). This file reads a chapter into a plain model and reports every mistake in it as a line
 * of text, so a writer is told where, in the writer's own words. It knows nothing of readers: cutting
 * a chapter to a person's privileges is guide.cut.js.
 *
 *   const { parseChapter } = require('./guide.format');
 *   const { chapter, problems } = parseChapter(markdownText, 'getting-started.md');
 *
 * The model:
 *   chapter  { slug, file, title, summary, order, module, intro: [block], sections: [section], shots: { id: spec } }
 *   section  { slug, title, screen, needs: [need], line, blocks: [block], tasks: [task] }
 *   task     { slug, title, needs, line, blocks }
 *   need     { screen, action }                       (the reader must hold every one)
 *   block    { kind: 'paragraph' | 'note' | 'bullets' | 'steps' | 'table' | 'figure', needs, ... }
 *   span     { text, bold, italic, code, link }       link: { kind: 'screen' | 'section' | 'web', to } or null
 */
const { ACTIONS } = require('../../middleware/access');

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;      // a section or task: at least two words, so #dashboard stays an address
const SHOT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SCREEN_ID = /^[a-z0-9-]+\.[a-z0-9.-]+$/;
const FRONT_KEYS = ['title', 'summary', 'order', 'module'];
const DEVICES = ['desktop', 'phone'];
const THEMES = ['light', 'dark'];
const TONES = { 'Tip:': 'tip', 'Important:': 'important' };

/* ---------- needs: who receives a part ---------- */

/** `ratings.list add, admin.users edit` as [{ screen, action }]; every one must be held. */
function parseNeeds(text) {
  const needs = [];
  const problems = [];
  for (const raw of String(text || '').split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const m = /^(\S+)\s+(\S+)$/.exec(part);
    if (!m || !SCREEN_ID.test(m[1]) || !ACTIONS.includes(m[2])) {
      problems.push(`needs "${part}" reads "<screen> <action>" (for example ratings.list add), the action one of ${ACTIONS.join(', ')}`);
    } else needs.push({ screen: m[1], action: m[2] });
  }
  return { needs, problems };
}

/** A line that begins {needs="..."}: its needs and the rest. */
function takeNeeds(text) {
  const m = /^\{needs="([^"]*)"\}\s*/.exec(text);
  if (!m) return { text, needs: [], problems: [] };
  const { needs, problems } = parseNeeds(m[1]);
  return { text: text.slice(m[0].length), needs, problems };
}

/* ---------- inline text ---------- */

const span = (text, extra = {}) => ({ text, bold: false, italic: false, code: false, link: null, ...extra });

function linkOf(href) {
  if (/^https:\/\/\S+$/.test(href)) return { kind: 'web', to: href };
  const hash = /^#(.+)$/.exec(href);
  if (!hash) return null;
  // `#slug` (two words or more) is a part of the guide; anything else after # is a screen's address
  return SLUG.test(hash[1]) ? { kind: 'section', to: hash[1] } : { kind: 'screen', to: hash[1] };
}

const INLINE = /!\[([^\]]*)\]\(shot:([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|`([^`]+)`/g;

/** Inline Markdown as spans, with the pictures it names taken out. */
function parseInline(text) {
  const spans = [];
  const shots = [];
  const problems = [];
  let last = 0;
  const plain = (to) => { if (to > last) spans.push(span(text.slice(last, to))); };
  for (const m of text.matchAll(INLINE)) {
    plain(m.index);
    last = m.index + m[0].length;
    if (m[2] !== undefined) {
      if (!SHOT_ID.test(m[2])) problems.push(`picture "${m[2]}" is not a shot id (lower-case words and hyphens)`);
      if (!m[1].trim()) problems.push(`picture "${m[2]}" needs its words: ![What it shows](shot:${m[2]})`);
      shots.push({ id: m[2], alt: m[1].trim() });
    } else if (m[4] !== undefined) {
      const link = linkOf(m[4]);
      if (!link) problems.push(`link "${m[4]}" is a screen (#disciplinary/pending), a part of the guide (#chapter-section) or an https address`);
      const bold = /^\*\*(.+)\*\*$/.exec(m[3]);
      spans.push(span(bold ? bold[1] : m[3], { bold: !!bold, link }));
    } else if (m[5] !== undefined) spans.push(span(m[5], { bold: true }));
    else if (m[6] !== undefined) spans.push(span(m[6], { italic: true }));
    else spans.push(span(m[7], { code: true }));
  }
  plain(text.length);
  // pictures taken out of a line leave spaces at its edges
  if (spans.length) {
    if (!spans[0].bold && !spans[0].link) spans[0].text = spans[0].text.replace(/^\s+/, '');
    const end = spans[spans.length - 1];
    if (!end.bold && !end.link) end.text = end.text.replace(/\s+$/, '');
  }
  return { spans: spans.filter((s) => s.text !== ''), shots, problems };
}

/** The words of spans, as plain text. */
const textOf = (spans) => spans.map((s) => s.text).join('').replace(/\s+/g, ' ').trim();

/* ---------- headings: Title {#slug screen=x needs="..."} ---------- */

function splitHeading(text) {
  const m = /^(.*?)\s*\{([^}]*)\}\s*$/.exec(text);
  if (!m) return { title: text.trim(), slug: null, values: {}, leftover: '' };
  const values = {};
  let slug = null;
  const rest = m[2].replace(/#([a-z0-9-]+)|([a-z]+)=(?:"([^"]*)"|([^\s}]+))/g, (_all, s, k, quoted, bare) => {
    if (s) slug = s;
    else values[k] = quoted !== undefined ? quoted : bare;
    return '';
  });
  return { title: m[1].trim(), slug, values, leftover: rest.trim() };
}

/* ---------- the picture specs ---------- */

const TARGET_KINDS = ['button', 'link', 'tab', 'menuitem', 'label', 'text', 'heading', 'searchbox', 'row', 'css', 'role'];

/** `button "Save"`, `label "Rate"`, `row 2`, `searchbox`, `css #x`, `role dialog "Title"` as an object, or null. */
function parseTarget(text) {
  const m = /^([a-z]+)\b\s*(.*)$/.exec(text.trim());
  if (!m || !TARGET_KINDS.includes(m[1])) return null;
  const [, kind, rest] = m;
  if (kind === 'searchbox') return rest ? null : { kind };
  if (kind === 'css') return rest ? { kind, selector: rest } : null;
  if (kind === 'row') return /^\d+$/.test(rest) ? { kind, index: Number(rest) } : null;
  if (kind === 'role') {
    const r = /^([a-z]+)\s+"([^"]+)"$/.exec(rest);
    return r ? { kind, role: r[1], name: r[2] } : null;
  }
  const q = /^"([^"]+)"$/.exec(rest);
  return q ? { kind, name: q[1] } : null;
}

const STEP = /^(?:(desktop|phone) )?(click|fill|select|press|wait|scroll):\s*(.+)$/;

function parseShot(id, lines, firstLine) {
  const problems = [];
  const spec = { id, open: null, as: 'admin', devices: [...DEVICES], crop: 'page', session: 'shared', do: [], marks: [], sources: [], line: firstLine };
  let list = null;
  lines.forEach((raw, n) => {
    const at = `picture ${id}, line ${firstLine + n + 1}`;
    if (!raw.trim()) return;
    const item = /^\s+(?:- )?(.+)$/.exec(raw);
    if (item && list) {
      const body = item[1].trim();
      if (list === 'do') {
        const m = STEP.exec(body);
        if (!m) { problems.push(`${at}: a step reads "click: <target>", "fill: <target> = <words>", "select: <target> = <option>", "press: <key>", "wait: <target>" or "scroll: <target>", after "phone " or "desktop " for one device`); return; }
        const [, only, action, arg] = m;
        let step = null;
        if (action === 'press') step = { action, key: arg.trim() };
        else if (action === 'fill' || action === 'select') {
          const f = /^(.+?)\s+=\s+(.*)$/.exec(arg);
          const target = f && parseTarget(f[1]);
          if (!target) problems.push(`${at}: ${action} reads "${action}: <target> = <${action === 'fill' ? 'words' : 'option'}>"`);
          else step = { action, target, value: f[2] };
        } else {
          const target = parseTarget(arg);
          if (!target) problems.push(`${at}: "${arg}" is not a target (button "X", link "X", label "X", text "X", heading "X", row 1, css ...)`);
          else step = { action, target };
        }
        if (step) spec.do.push(only ? { ...step, device: only } : step);
      } else if (list === 'marks') {
        const m = /^(\d+):\s*(.+?)\s*\|\s*(.+)$/.exec(body);
        const target = m && parseTarget(m[2]);
        if (!m || !target) problems.push(`${at}: a mark reads "<number>: <target> | <what it is>"`);
        else spec.marks.push({ n: Number(m[1]), target, text: m[3].trim() });
      } else spec.sources.push(body);
      return;
    }
    const kv = /^([a-z]+):\s*(.*)$/.exec(raw.trim());
    if (!kv) { problems.push(`${at}: "${raw.trim()}" is not "key: value"`); return; }
    const [, key, value] = kv;
    list = null;
    if (key === 'open') spec.open = value;
    else if (key === 'as') spec.as = value;
    else if (key === 'crop') {
      spec.crop = value;
      if (/^css\b/.test(value)) problems.push(`${at}: crop is page, viewport, modal or a CSS selector written as it is (crop: #lock-card), without "css"`);
    }
    else if (key === 'device') {
      if (value === 'both') spec.devices = [...DEVICES];
      else if (DEVICES.includes(value)) spec.devices = [value];
      else problems.push(`${at}: device is both, desktop or phone`);
    } else if (key === 'session') {
      if (value === 'own') spec.session = 'own';
      else problems.push(`${at}: session is own (a picture that locks or ends the session signs in on its own)`);
    } else if (key === 'do' || key === 'marks' || key === 'sources') {
      list = key;
      if (value) problems.push(`${at}: the ${key} go on the lines under it`);
    } else problems.push(`${at}: unknown key "${key}"`);
  });
  if (!spec.open || !/^(#[a-z0-9/:_.?=&%-]*|\/[A-Za-z0-9./_-]*)$/i.test(spec.open)) problems.push(`picture ${id}: open is a screen's address (#ratings/current) or, signed out, a page (/)`);
  if (spec.marks.some((m, i) => m.n !== i + 1)) problems.push(`picture ${id}: the marks are numbered 1, 2, 3 in order`);
  return { spec, problems };
}

/* ---------- the chapter ---------- */

function parseFront(lines) {
  const front = {};
  const problems = [];
  if (lines[0] !== '---') return { front, body: 0, problems: ['a chapter opens with its front matter between --- lines'] };
  let end = 1;
  for (; end < lines.length && lines[end] !== '---'; end += 1) {
    const m = /^([a-z]+):\s*(.*)$/.exec(lines[end]);
    if (!m) problems.push(`front matter line ${end + 1} is not "key: value"`);
    else if (!FRONT_KEYS.includes(m[1])) problems.push(`front matter: unknown key "${m[1]}" (${FRONT_KEYS.join(', ')})`);
    else front[m[1]] = m[2].trim();
  }
  if (end >= lines.length) problems.push('front matter is not closed with ---');
  return { front, body: end + 1, problems };
}

/** A file that does not start with front matter is not in the guide yet. */
const isChapter = (text) => /^---\r?\n/.test(text);

function parseChapter(text, file) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const problems = [];
  const at = (n) => `${file}:${n + 1}`;
  const front = parseFront(lines);
  problems.push(...front.problems.map((p) => `${file}: ${p}`));
  const meta = front.front;
  if (!meta.title) problems.push(`${file}: the front matter needs a title`);
  if (!meta.summary) problems.push(`${file}: the front matter needs a summary`);
  if (meta.order !== undefined && !Number.isFinite(Number(meta.order))) problems.push(`${file}: order is a number`);

  const chapter = {
    slug: file.replace(/\.md$/, ''),
    file,
    title: meta.title || '',
    summary: meta.summary || '',
    order: meta.order !== undefined && Number.isFinite(Number(meta.order)) ? Number(meta.order) : 1000,
    module: meta.module || null,
    intro: [],
    sections: [],
    shots: {},
  };
  let section = null;
  let task = null;
  const target = () => (task ? task.blocks : section ? section.blocks : chapter.intro);
  const refs = [];

  const inline = (raw, n) => {
    const r = parseInline(raw);
    problems.push(...r.problems.map((p) => `${at(n)}: ${p}`));
    r.shots.forEach((s) => refs.push({ ...s, line: n }));
    return r;
  };
  const figureOf = (shots, n) => {
    if (shots.length > 1) problems.push(`${at(n)}: one picture to a line or a step`);
    return shots[0] ? { shot: shots[0].id, alt: shots[0].alt } : null;
  };
  const reportNeeds = (own, n) => problems.push(...own.problems.map((p) => `${at(n)}: ${p}`));

  let i = front.body;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    // ```shot <id> ... ```
    const fence = /^```(\S*)\s*(\S*)\s*$/.exec(line);
    if (fence) {
      let end = i + 1;
      while (end < lines.length && !/^```\s*$/.test(lines[end])) end += 1;
      if (end >= lines.length) problems.push(`${at(i)}: a fenced block is not closed`);
      if (fence[1] !== 'shot') problems.push(`${at(i)}: the only fenced block is a picture spec: \`\`\`shot <id>`);
      else if (!SHOT_ID.test(fence[2])) problems.push(`${at(i)}: \`\`\`shot needs the picture's id`);
      else if (chapter.shots[fence[2]]) problems.push(`${at(i)}: the picture ${fence[2]} has two specs`);
      else {
        const r = parseShot(fence[2], lines.slice(i + 1, end), i + 1);
        problems.push(...r.problems.map((p) => `${file}: ${p}`));
        chapter.shots[fence[2]] = r.spec;
      }
      i = end + 1;
      continue;
    }

    if (/^# /.test(line)) { problems.push(`${at(i)}: the chapter's title is in its front matter; start the sections with ##`); i += 1; continue; }
    if (/^#{4,} /.test(line)) { problems.push(`${at(i)}: headings go no deeper than ### (a task)`); i += 1; continue; }

    const head = /^(#{2,3}) (.+)$/.exec(line);
    if (head) {
      const isSection = head[1] === '##';
      const h = splitHeading(head[2]);
      if (!h.slug) problems.push(`${at(i)}: give the heading its slug: ${head[1]} ${h.title} {#chapter-words}`);
      else if (!SLUG.test(h.slug)) problems.push(`${at(i)}: the slug "${h.slug}" is two or more lower-case words joined by hyphens`);
      if (h.leftover) problems.push(`${at(i)}: "${h.leftover}" is not an attribute`);
      const allowed = isSection ? ['screen', 'needs'] : ['needs'];
      Object.keys(h.values).filter((k) => !allowed.includes(k)).forEach((k) => problems.push(`${at(i)}: ${head[1]} takes ${allowed.join(' and ')}, not ${k}`));
      const nd = parseNeeds(h.values.needs || '');
      problems.push(...nd.problems.map((p) => `${at(i)}: ${p}`));
      if (isSection) {
        if (h.values.screen && !SCREEN_ID.test(h.values.screen)) problems.push(`${at(i)}: screen is a screen id, like ratings.list`);
        section = { slug: h.slug || '', title: h.title, screen: h.values.screen || null, needs: nd.needs, line: i, blocks: [], tasks: [] };
        task = null;
        chapter.sections.push(section);
      } else {
        if (!section) problems.push(`${at(i)}: a ### task sits inside a ## section`);
        task = { slug: h.slug || '', title: h.title, needs: nd.needs, line: i, blocks: [] };
        if (section) section.tasks.push(task);
      }
      i += 1;
      continue;
    }

    // numbered steps; indented lines carry on the step above
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && (/^\d+\. /.test(lines[i]) || (/^ {2,}\S/.test(lines[i]) && items.length))) {
        if (/^\d+\. /.test(lines[i])) items.push({ raw: lines[i].replace(/^\d+\. /, ''), line: i });
        else items[items.length - 1].raw += ` ${lines[i].trim()}`;
        i += 1;
      }
      target().push({
        kind: 'steps',
        needs: [],
        items: items.map(({ raw, line: n }) => {
          const own = takeNeeds(raw);
          reportNeeds(own, n);
          const r = inline(own.text, n);
          return { spans: r.spans, figure: figureOf(r.shots, n), needs: own.needs, line: n };
        }),
      });
      continue;
    }

    if (/^- /.test(line)) {
      const items = [];
      while (i < lines.length && (/^- /.test(lines[i]) || (/^ {2,}\S/.test(lines[i]) && items.length))) {
        if (/^- /.test(lines[i])) items.push({ raw: lines[i].slice(2), line: i });
        else items[items.length - 1].raw += ` ${lines[i].trim()}`;
        i += 1;
      }
      target().push({
        kind: 'bullets',
        needs: [],
        items: items.map(({ raw, line: n }) => {
          const own = takeNeeds(raw);
          reportNeeds(own, n);
          const r = inline(own.text, n);
          if (r.shots.length) problems.push(`${at(n)}: a picture sits on its own line or on a step, not in a list`);
          return { spans: r.spans, needs: own.needs };
        }),
      });
      continue;
    }

    if (/^>( |$)/.test(line)) {
      const start = i;
      let raw = '';
      while (i < lines.length && /^>( |$)/.test(lines[i])) { raw += ` ${lines[i].replace(/^>\s?/, '')}`; i += 1; }
      const own = takeNeeds(raw.trim());
      reportNeeds(own, start);
      let tone = 'note';
      let said = own.text;
      for (const [lead, t] of Object.entries(TONES)) {
        if (said.startsWith(`**${lead}**`)) { tone = t; said = said.slice(lead.length + 4).trim(); }
      }
      const r = inline(said, start);
      if (r.shots.length) problems.push(`${at(start)}: a picture sits on its own line or on a step, not in a note`);
      target().push({ kind: 'note', tone, spans: r.spans, needs: own.needs });
      continue;
    }

    if (/^\|/.test(line)) {
      const start = i;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push({ raw: lines[i], line: i }); i += 1; }
      const cells = (raw) => raw.replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
      if (rows.length < 3 || !/^\|(\s*:?-+:?\s*\|)+\s*$/.test(rows[1].raw)) {
        problems.push(`${at(start)}: a table has a header row, a --- row and at least one row`);
        continue;
      }
      const header = cells(rows[0].raw).map((c) => inline(c, start).spans);
      target().push({
        kind: 'table',
        needs: [],
        head: header,
        rows: rows.slice(2).map(({ raw, line: n }) => {
          const all = cells(raw);
          const own = takeNeeds(all[0] || '');
          reportNeeds(own, n);
          all[0] = own.text;
          if (all.length !== header.length) problems.push(`${at(n)}: this row has ${all.length} cells, the header ${header.length}`);
          return { cells: all.map((c) => inline(c, n).spans), needs: own.needs };
        }),
      });
      continue;
    }

    if (/^ {2,}\S/.test(line) || /^\t/.test(line)) { problems.push(`${at(i)}: an indented line belongs under a step or a list item`); i += 1; continue; }

    // a paragraph, or a picture on a line of its own
    const start = i;
    let raw = '';
    while (i < lines.length && lines[i].trim() && !/^(#{1,6} |\d+\. |- |>( |$)|\||```)/.test(lines[i])) { raw += ` ${lines[i].trim()}`; i += 1; }
    const own = takeNeeds(raw.trim());
    reportNeeds(own, start);
    const r = inline(own.text, start);
    if (r.shots.length && r.spans.length) problems.push(`${at(start)}: a picture sits on a line of its own`);
    if (r.shots.length) target().push({ kind: 'figure', figure: figureOf(r.shots, start), needs: own.needs });
    else target().push({ kind: 'paragraph', spans: r.spans, needs: own.needs });
  }

  refs.forEach((r) => { if (!chapter.shots[r.id]) problems.push(`${at(r.line)}: the picture ${r.id} has no \`\`\`shot ${r.id} spec in this file`); });
  Object.keys(chapter.shots).forEach((id) => { if (!refs.some((r) => r.id === id)) problems.push(`${file}: the spec of picture ${id} is not shown anywhere`); });
  if (!chapter.sections.length) problems.push(`${file}: a chapter has at least one ## section`);
  chapter.sections.forEach((s) => { if (!s.blocks.length && !s.tasks.length) problems.push(`${at(s.line)}: the section "${s.title}" is empty`); });
  return { chapter, problems };
}

/** Every span of a chapter, with the line of the part that holds it (for checks across the guide). */
function eachSpan(chapter, fn) {
  const walk = (blocks, line) => {
    blocks.forEach((b) => {
      if (b.kind === 'steps') b.items.forEach((s) => fn(s.spans, s.line));
      else if (b.kind === 'bullets') b.items.forEach((s) => fn(s.spans, line));
      else if (b.kind === 'table') { b.head.forEach((c) => fn(c, line)); b.rows.forEach((r) => r.cells.forEach((c) => fn(c, line))); } else if (b.spans) fn(b.spans, line);
    });
  };
  walk(chapter.intro, 0);
  chapter.sections.forEach((s) => { walk(s.blocks, s.line); s.tasks.forEach((t) => walk(t.blocks, t.line)); });
}

module.exports = { parseChapter, parseNeeds, parseInline, isChapter, textOf, eachSpan, SLUG, DEVICES, THEMES };
