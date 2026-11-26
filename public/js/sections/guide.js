/*
 * User Guide page: #guide (the first chapter) and #guide/<section or task> (that part, and with ?step=N that step).
 * The contents sit beside the text on a desktop and above it, as a picker, on a phone. Each reader receives only the
 * parts their role uses (the server cuts the guide), so there is nothing here to hide. Download PDF asks which pictures
 * (desktop or mobile, light or dark) and opens the guide as a book in the PDF preview.
 *
 *   mountGuide(outlet, { params, query })
 */
import { navigate } from '../core/router.js';
import { icon } from '../core/icons.js';
import { cx, fill, h } from '../ui/html.js';
import { pageHeader } from '../ui/page-header.js';
import { button } from '../ui/button.js';
import { card } from '../ui/card.js';
import { emptyState } from '../ui/empty-state.js';
import { selectInput } from '../ui/field.js';
import { openBookChoice } from './guide-book.js';
import { keepGuidePlace } from '../shell/guide-back.js';
import { blockNodes, guideHref, loadChapter, loadContents, locateAnchor, searchBox, sectionNodes, showAnchor } from './guide-parts.js';

const downloadPdf = () => openBookChoice();

function header() {
  return pageHeader({
    title: 'User Guide',
    subtitle: 'How to use CIRERMS, with only the parts your role uses. Press Ctrl+H on any page to open it beside your work.',
    actions: [button({ label: 'Download PDF', icon: 'download', variant: 'primary', onClick: downloadPdf })],
  });
}

export async function mountGuide(outlet, { params = {}, query = {} } = {}) {
  const chapters = await loadContents();
  if (!chapters.length) {
    fill(outlet, [header(), card({ body: emptyState({ icon: 'book-open', title: 'Nothing in the Guide Yet', text: 'No part of the guide is written for your role yet.' }), padded: false })]);
    return null;
  }

  // which chapter, and which part of it
  let anchor = params.section || '';
  let slug = chapters[0].slug;
  let missing = false;
  if (anchor) {
    try { slug = await locateAnchor(anchor); } catch (_) { missing = true; anchor = ''; }
  }
  const chapter = await loadChapter(slug);
  const entry = chapters.find((c) => c.slug === slug);

  const ctx = {
    chapter,
    // a step's link to a screen opens it and leaves Back to Guide, which returns to the same step
    onScreen: (_link, origin) => keepGuidePlace({ run: () => navigate(guideHref(origin.anchor, origin.step)) }),
    onSection: (to, e) => { e.preventDefault(); navigate(guideHref(to)); },
  };

  // ---- the text
  const article = h('article', { className: 'min-w-0', dataset: { guideArticle: '' } }, [
    h('h2', { className: 'text-2xl font-semibold tracking-tight', text: chapter.title }),
    chapter.summary ? h('p', { className: 'mt-1 text-sm text-muted-foreground', text: chapter.summary }) : null,
    ...blockNodes(chapter.intro, ctx, `${chapter.slug}-intro`),
    ...chapter.sections.map((s) => h('div', { className: 'mt-6 border-t border-border pt-5' }, sectionNodes(s, ctx))),
  ]);

  // ---- the contents beside it (desktop)
  const links = new Map();
  const contents = h('nav', { 'aria-label': 'Guide contents', className: 'space-y-0.5 text-sm' }, chapters.map((c) => {
    const here = c.slug === slug;
    const head = h('a', {
      href: guideHref(c.sections[0].slug),
      'aria-current': here ? 'true' : undefined,
      className: cx('flex items-center gap-2 rounded-ctl px-2.5 py-2 font-medium focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15', here ? 'bg-brand/10 text-brand' : 'text-foreground hover:bg-subtle'),
    }, [h('span', { className: 'min-w-0 flex-1 leading-snug', text: c.title }), icon(here ? 'chevron-down' : 'chevron-right', 'icon h-4 w-4 flex-none text-muted-foreground')]);
    if (!here) return head;
    return h('div', {}, [head, h('ul', { className: 'mb-1 ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2' }, c.sections.map((s) => {
      const a = h('a', {
        href: guideHref(s.slug),
        className: 'block rounded-ctl px-2.5 py-1.5 leading-snug text-muted-foreground hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 aria-[current=true]:font-semibold aria-[current=true]:text-brand',
        text: s.title,
      });
      links.set(s.slug, a);
      return h('li', {}, a);
    }))]);
  }));

  // ---- the picker above it (phone): a chapter and a section, never sideways scrolling
  const chapterPick = selectInput({ name: 'guide-chapter', options: chapters.map((c) => ({ value: c.slug, label: c.title })), value: slug, placeholder: null, 'aria-label': 'Chapter', 'data-native': '' });
  const sectionPick = selectInput({ name: 'guide-section', options: entry.sections.map((s) => ({ value: s.slug, label: s.title })), value: '', placeholder: 'Jump to a section', 'aria-label': 'Section', 'data-native': '' });
  chapterPick.addEventListener('change', () => {
    const next = chapters.find((c) => c.slug === chapterPick.value);
    if (next && next.slug !== slug) navigate(guideHref(next.sections[0].slug));
  });
  sectionPick.addEventListener('change', () => { if (sectionPick.value) navigate(guideHref(sectionPick.value)); });
  const picker = h('div', { className: 'mb-4 grid gap-2 desk:hidden' }, [chapterPick, sectionPick]);

  // ---- the search over the guide
  const body = h('div', { className: 'desk:grid desk:grid-cols-[16rem_minmax(0,1fr)] desk:items-start desk:gap-8' }, [
    h('aside', { className: 'phone:hidden desk:sticky desk:top-0 desk:max-h-[calc(100dvh-9rem)] desk:overflow-y-auto desk:pr-1' }, contents),
    h('div', { className: 'min-w-0' }, [picker, article]),
  ]);
  const search = searchBox({
    onOpen: (r) => { search.clear(); navigate(guideHref(r.anchor, r.step)); },
    onChange: (showing) => { body.classList.toggle('hidden', showing); },
  });
  const searchRow = h('div', { className: 'mb-4 max-w-xl' }, [search.el]);

  fill(outlet, [
    header(),
    missing ? h('p', { className: 'mb-4 rounded-ctl border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning', role: 'status', text: 'That part is not in the guide for your role. Here is the start of the guide.' }) : null,
    searchRow,
    h('div', { className: 'mb-4 empty:hidden' }, search.results),
    body,
  ]);

  // the part asked for, and the step in it
  const target = anchor || query.step ? anchor : '';
  requestAnimationFrame(() => {
    if (target) showAnchor(article, target, query.step);
    else document.getElementById('page')?.scrollTo({ top: 0 });
  });

  // the contents mark the section being read
  const scroller = document.getElementById('page');
  let frame = 0;
  const spy = () => {
    frame = 0;
    const top = scroller.getBoundingClientRect().top + 90;
    let current = null;
    for (const s of chapter.sections) {
      const node = article.querySelector(`[data-guide-anchor="${CSS.escape(s.slug)}"]`);
      if (node && node.getBoundingClientRect().top <= top) current = s.slug;
    }
    links.forEach((a, key) => { if (key === current) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  };
  const onScroll = () => { if (!frame) frame = requestAnimationFrame(spy); };
  scroller.addEventListener('scroll', onScroll, { passive: true });
  spy();
  return () => { scroller.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); };
}
