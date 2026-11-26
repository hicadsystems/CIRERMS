/*
 * guide parts: what the User Guide page (guide.js) and the Ctrl+H panel (shell/guide-panel.js) share. The
 * server sends only the parts of the guide the person may use (src/modules/guide); this draws them.
 *
 *   loadContents()                 the contents: [{ slug, title, summary, module, sections: [{ slug, title, screen, tasks }] }]
 *   loadChapter(slug)              one chapter, with its blocks and pictures
 *   locateAnchor(anchor)           the chapter slug that holds a section or task
 *   sectionNodes(chapter, section, ctx)   a section as nodes: its blocks and its tasks
 *   blockNodes(blocks, ctx)        blocks as nodes
 *   searchBox({ onOpen })          { el, input, clear(), results } the search field and its results
 *   guideHref(anchor, step)        '#guide/<anchor>?step=N'
 *
 * ctx = { chapter, origin(anchor), onScreen(link, origin, event), onSection(slug, event) }: how the host handles
 * a link to a screen and to another part of the guide. Pictures take the reader's device and theme and change
 * with the theme at once, with no reload.
 */
import { api } from '../core/api.js';
import { icon } from '../core/icons.js';
import { currentTheme, onThemeChange } from '../core/theme.js';
import { cx, fill, h } from '../ui/html.js';
import { openDialog } from '../ui/dialog.js';
import { emptyState } from '../ui/empty-state.js';
import { INPUT } from '../ui/classes.js';

/* ---------- the guide's data, kept for the session ---------- */

let contentsPromise = null;
const chapters = new Map();
const anchors = new Map();

export function loadContents(fresh = false) {
  if (!contentsPromise || fresh) {
    if (fresh) { chapters.clear(); anchors.clear(); }
    contentsPromise = api.get('/api/guide').then((res) => res.data.chapters);
    contentsPromise.catch(() => { contentsPromise = null; });
  }
  return contentsPromise;
}

export function loadChapter(slug) {
  if (!chapters.has(slug)) {
    const p = api.get(`/api/guide/chapters/${encodeURIComponent(slug)}`).then((res) => res.data);
    p.catch(() => chapters.delete(slug));
    chapters.set(slug, p);
  }
  return chapters.get(slug);
}

export async function locateAnchor(anchor) {
  if (!anchors.has(anchor)) {
    const res = await api.get(`/api/guide/where/${encodeURIComponent(anchor)}`);
    anchors.set(anchor, res.data.chapter);
  }
  return anchors.get(anchor);
}

export const guideHref = (anchor, step) => `#guide/${anchor}${step ? `?step=${step}` : ''}`;

/* ---------- the reader's device and theme ---------- */

const phoneQuery = window.matchMedia('(max-width: 760px)');
const deviceNow = () => (phoneQuery.matches ? 'phone' : 'desktop');

/** The picture's address for this device (or the one it was taken for) and theme. */
function pictureUrl(chapter, shot, spec) {
  const device = spec.devices.includes(deviceNow()) ? deviceNow() : spec.devices[0];
  return `/api/guide/pictures/${encodeURIComponent(chapter)}/${encodeURIComponent(shot)}?device=${device}&theme=${currentTheme()}`;
}

// every picture on screen, so a theme or device change redraws them in place
const pictures = new Set();
function refreshPictures() {
  pictures.forEach((img) => {
    if (!img.isConnected) { pictures.delete(img); return; }
    const next = pictureUrl(img.dataset.guideChapter, img.dataset.guideShot, JSON.parse(img.dataset.guideSpec));
    if (img.getAttribute('src') !== next) img.setAttribute('src', next);
  });
}
onThemeChange(refreshPictures);
phoneQuery.addEventListener('change', refreshPictures);

/** The marks' legend under a picture: each number as the picture draws it, and what it points at. */
function legend(items) {
  if (!items.length) return null;
  return h('ol', { className: 'mt-2 space-y-1 text-xs text-muted-foreground', dataset: { guideLegend: '' } }, items.map((m) => h('li', { className: 'flex items-start gap-2' }, [
    h('span', { className: 'mt-px inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand text-2xs font-bold text-brand-foreground', text: String(m.n) }),
    h('span', { className: 'min-w-0 pt-0.5', text: m.text }),
  ])));
}

/** A picture that opens larger when pressed, with its legend under it. */
function figureNode(figure, ctx) {
  const spec = ctx.chapter.pictures[figure.shot];
  if (!spec) return null;
  const phoneOnly = !spec.devices.includes('desktop');
  const size = spec.size && (spec.size[deviceNow()] || spec.size[spec.devices[0]]);
  const img = h('img', {
    src: pictureUrl(ctx.chapter.slug, figure.shot, spec),
    alt: figure.alt,
    className: cx('block h-auto w-full rounded-ctl border border-border bg-muted', phoneOnly && 'mx-auto max-w-xs'),
    width: size ? size.w : undefined,
    height: size ? size.h : undefined,
    loading: 'lazy',
    decoding: 'async',
    dataset: { guideChapter: ctx.chapter.slug, guideShot: figure.shot, guideSpec: JSON.stringify(spec) },
  });
  // never drawn larger than it was taken (the captures are at device scale 2), so it stays sharp
  if (size) img.style.maxWidth = `${Math.round(size.w / 2)}px`;
  pictures.add(img);
  const missing = () => {
    pictures.delete(img);
    img.replaceWith(h('div', { className: 'flex items-center gap-2 rounded-ctl border border-dashed border-border bg-muted px-3 py-6 text-sm text-muted-foreground' }, [icon('image'), 'This picture is not available yet.']));
  };
  img.addEventListener('error', missing);
  const open = h('button', {
    type: 'button',
    className: 'group relative block w-full cursor-zoom-in rounded-ctl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15',
    'aria-label': `Open the picture larger: ${figure.alt}`,
    onClick: () => {
      const big = h('img', { src: img.getAttribute('src'), alt: figure.alt, className: cx('mx-auto block h-auto w-full rounded-ctl border border-border', phoneOnly && 'max-w-sm') });
      const dlg = openDialog({ title: figure.alt, size: '2xl', body: [big, legend(spec.legend)], className: 'desk:max-h-[92vh]' });
      // the larger picture follows the theme too, while it is open
      const off = onThemeChange(() => big.setAttribute('src', pictureUrl(ctx.chapter.slug, figure.shot, spec)));
      dlg.closed.then(off);
    },
  }, img);
  return h('figure', { className: 'my-3', dataset: { guideFigure: figure.shot } }, [open, legend(spec.legend)]);
}

/* ---------- text ---------- */

const LINK = 'font-medium text-secondary underline decoration-secondary/40 underline-offset-2 hover:decoration-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 rounded-sm';

/** Spans as nodes. `origin` is where the text sits ({ anchor, step }), kept by a link to a screen for Back to Guide. */
export function spanNodes(spans, ctx, origin) {
  return spans.map((s) => {
    let node;
    if (s.link && s.link.kind === 'screen') {
      node = h('a', { href: `#${s.link.to}`, className: LINK, dataset: { guideScreen: s.link.to }, onClick: (e) => ctx.onScreen && ctx.onScreen(s.link, origin, e) });
    } else if (s.link && s.link.kind === 'section') {
      node = h('a', { href: guideHref(s.link.to), className: LINK, onClick: (e) => ctx.onSection && ctx.onSection(s.link.to, e) });
    } else if (s.link) {
      node = h('a', { href: s.link.to, className: LINK, target: '_blank', rel: 'noopener noreferrer' });
    } else node = document.createDocumentFragment();
    const inner = s.code ? h('code', { className: 'rounded bg-muted px-1 py-0.5 font-mono text-xs', text: s.text }) : document.createTextNode(s.text);
    let wrapped = inner;
    if (s.italic) wrapped = h('em', {}, wrapped);
    if (s.bold) wrapped = h('strong', { className: 'font-semibold' }, wrapped);
    node.appendChild(wrapped);
    return node;
  });
}

const NOTE = {
  tip: { label: 'Tip:', box: 'border-info bg-info-soft', lead: 'text-info', icon: 'info' },
  important: { label: 'Important:', box: 'border-warning bg-warning-soft', lead: 'text-warning', icon: 'triangle-alert' },
  note: { label: 'Note:', box: 'border-border bg-muted', lead: 'text-muted-foreground', icon: 'info' },
};

export function blockNodes(blocks, ctx, anchor) {
  const origin = (step) => ({ anchor, step });
  return blocks.map((b) => {
    if (b.kind === 'paragraph') return h('p', { className: 'my-3 text-sm leading-relaxed' }, spanNodes(b.spans, ctx, origin()));
    if (b.kind === 'note') {
      const n = NOTE[b.tone] || NOTE.note;
      return h('div', { className: cx('my-3 flex gap-2.5 rounded-ctl border-l-4 px-3.5 py-3 text-sm leading-relaxed', n.box) }, [
        icon(n.icon, cx('icon mt-0.5 h-4 w-4 flex-none', n.lead)),
        h('p', { className: 'min-w-0' }, [h('strong', { className: cx('mr-1 font-semibold', n.lead), text: n.label }), ...spanNodes(b.spans, ctx, origin())]),
      ]);
    }
    if (b.kind === 'bullets') {
      return h('ul', { className: 'my-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed marker:text-muted-foreground' }, b.items.map((s) => h('li', {}, spanNodes(s, ctx, origin()))));
    }
    if (b.kind === 'steps') {
      return h('ol', { className: 'my-3 space-y-3', dataset: { guideSteps: '' } }, b.items.map((s) => h('li', {
        id: `${anchor}-step-${s.n}`,
        className: 'flex scroll-mt-4 gap-3 rounded-ctl text-sm leading-relaxed',
        dataset: { guideStep: s.n },
      }, [
        h('span', { className: 'mt-px inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand text-xs font-bold text-brand-foreground', text: String(s.n) }),
        h('div', { className: 'min-w-0 flex-1' }, [h('p', {}, spanNodes(s.spans, ctx, origin(s.n))), s.figure ? figureNode(s.figure, ctx) : null]),
      ])));
    }
    if (b.kind === 'table') {
      return h('div', { className: 'my-3 overflow-hidden rounded-card border border-border' }, h('table', { className: 'w-full table-fixed border-collapse text-left text-sm' }, [
        h('thead', {}, h('tr', { className: 'bg-subtle/70' }, b.head.map((c) => h('th', { className: 'px-3 py-2 text-xs font-semibold text-muted-foreground' }, spanNodes(c, ctx, origin()))))),
        h('tbody', {}, b.rows.map((r) => h('tr', { className: 'border-t border-border align-top' }, r.map((c) => h('td', { className: 'break-words px-3 py-2' }, spanNodes(c, ctx, origin())))))),
      ]));
    }
    if (b.kind === 'figure') return figureNode(b.figure, ctx);
    return null;
  });
}

/** A section: its title, its blocks and its tasks, each with its anchor (the section's and the tasks' slugs). */
export function sectionNodes(section, ctx, { titleClass = 'text-xl font-semibold tracking-tight', taskClass = 'text-base font-semibold' } = {}) {
  return h('section', { id: section.slug, className: 'scroll-mt-4', dataset: { guideAnchor: section.slug } }, [
    h('h2', { className: titleClass, text: section.title }),
    ...blockNodes(section.blocks, ctx, section.slug),
    ...section.tasks.map((t) => h('div', { id: t.slug, className: 'mt-5 scroll-mt-4', dataset: { guideAnchor: t.slug } }, [
      h('h3', { className: cx(taskClass, 'border-l-4 border-primary pl-2.5'), text: t.title }),
      ...blockNodes(t.blocks, ctx, t.slug),
    ])),
  ]);
}

/** Brings an anchor, or one of its steps, into view and marks it for a moment. */
export function showAnchor(root, anchor, step) {
  const section = root.querySelector(`[data-guide-anchor="${CSS.escape(anchor)}"]`);
  const target = (step && section && section.querySelector(`[data-guide-step="${Number(step)}"]`)) || section;
  if (!target) return;
  target.scrollIntoView({ block: 'start' });
  if (target.dataset.guideStep) {
    target.classList.add('ring-4', 'ring-brand/30', 'bg-brand/5', '-mx-1', 'px-1', 'py-1');
    setTimeout(() => target.classList.remove('ring-4', 'ring-brand/30', 'bg-brand/5', '-mx-1', 'px-1', 'py-1'), 2200);
  }
}

/* ---------- search ---------- */

const words = (q) => (String(q || '').toLowerCase().match(/[a-z0-9]+/g) || []);

/** Text with the searched words marked, as nodes (never HTML). */
function highlight(text, q) {
  const ws = words(q);
  if (!ws.length) return [text];
  const re = new RegExp(`(${ws.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return text.split(re).map((part, i) => (i % 2 ? h('mark', { className: 'rounded-sm bg-brand/20 px-0.5 text-foreground', text: part }) : part));
}

/**
 * The search field and its results. `onOpen(result)` is called when a result is chosen: { anchor, step, chapter }.
 * `results` is the element that holds the answer (put it where the answer should show).
 */
export function searchBox({ onOpen, onChange } = {}) {
  const input = h('input', {
    type: 'search',
    placeholder: 'Search the guide',
    'aria-label': 'Search the guide',
    autocomplete: 'off',
    spellcheck: 'false',
    className: cx(INPUT, 'pl-9'),
    dataset: { guideSearch: '' },
  });
  const results = h('div', { className: 'hidden', dataset: { guideResults: '' }, 'aria-live': 'polite' });
  let timer = null;
  let token = 0;

  const clear = () => { input.value = ''; results.classList.add('hidden'); fill(results, []); token += 1; if (onChange) onChange(false); };

  async function run() {
    const q = input.value.trim();
    const mine = ++token;
    if (q.length < 2) { results.classList.add('hidden'); fill(results, []); if (onChange) onChange(false); return; }
    let list;
    try {
      list = (await api.get(`/api/guide/search?q=${encodeURIComponent(q)}`)).data.results;
    } catch (err) {
      if (mine !== token) return;
      fill(results, h('p', { className: 'px-3 py-4 text-sm text-error', role: 'alert', text: (err && err.message) || 'The search could not be made.' }));
      results.classList.remove('hidden');
      if (onChange) onChange(true);
      return;
    }
    if (mine !== token) return;
    results.classList.remove('hidden');
    if (onChange) onChange(true);
    if (!list.length) { fill(results, emptyState({ icon: 'search', title: 'Nothing Matches', text: 'Try other words, or fewer of them.' })); return; }
    fill(results, [
      h('p', { className: 'px-1 pb-2 text-xs text-muted-foreground', text: `${list.length} ${list.length === 1 ? 'result' : 'results'}` }),
      h('ul', { className: 'divide-y divide-border overflow-hidden rounded-card border border-border bg-card', role: 'list' }, list.map((r) => h('li', {}, h('a', {
        href: guideHref(r.anchor, r.step),
        className: 'block px-3.5 py-2.5 hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none',
        dataset: { guideResult: r.anchor },
        onClick: (e) => { e.preventDefault(); if (onOpen) onOpen(r); },
      }, [
        h('span', { className: 'flex items-center gap-2 text-xs text-muted-foreground' }, [
          h('span', { className: 'min-w-0 truncate', text: [r.chapterTitle, r.sectionTitle, r.taskTitle].filter((x, i, a) => x && a.indexOf(x) === i).join(' › ') }),
          r.step ? h('span', { className: 'flex-none rounded-full bg-brand/10 px-2 py-0.5 text-2xs font-semibold text-brand', text: `Step ${r.step}` }) : null,
        ]),
        h('span', { className: 'mt-0.5 block text-sm leading-snug' }, highlight(r.text, q)),
      ])))),
    ]);
  }

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 220); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && input.value) { e.preventDefault(); e.stopPropagation(); clear(); }
    if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); run(); }
  });
  const el = h('div', { className: 'relative' }, [
    h('span', { className: 'pointer-events-none absolute left-3 top-0 flex h-full items-center text-muted-foreground' }, icon('search')),
    input,
  ]);
  return { el, input, results, clear };
}
