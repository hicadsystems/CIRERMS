/*
 * The guide's mini panel: Ctrl+H on a desktop slides the User Guide in from the right, about 440 px wide, over any
 * page. It opens at the section for the page in view, or at the contents when there is none, with the same search
 * and Open in Page. Esc, its close button or Ctrl+H again closes it. Focus stays inside while it is open and goes
 * back to where it was when it closes. It does not open on a phone (no keyboard); the account menu serves there.
 *
 *   openGuidePanel({ screen, anchor, step })   screen: the screen id of the page in view
 *   closeGuidePanel()
 *   toggleGuidePanel({ screen })
 *   guidePanelOpen()
 */
import { navigate } from '../core/router.js';
import { icon } from '../core/icons.js';
import { cx, fill, h } from '../ui/html.js';
import { button } from '../ui/button.js';
import { emptyState } from '../ui/empty-state.js';
import { guideHref, loadChapter, loadContents, locateAnchor, searchBox, sectionNodes, showAnchor } from '../sections/guide-parts.js';
import { keepGuidePlace } from './guide-back.js';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let current = null;

export const guidePanelOpen = () => !!current;

export function closeGuidePanel() {
  if (current) current.close();
}

export function toggleGuidePanel(where = {}) {
  if (current) current.close();
  else openGuidePanel(where);
}

const visible = (n) => !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length);

export async function openGuidePanel({ screen, anchor, step } = {}) {
  if (current) { current.go({ anchor, step }); return; }
  const lastFocus = document.activeElement;
  let chapters = [];

  const title = h('h2', { id: 'guide-panel-title', className: 'min-w-0 flex-1 truncate text-base font-semibold', text: 'User Guide' });
  const closeBtn = h('button', { type: 'button', className: 'inline-flex h-9 w-9 flex-none items-center justify-center rounded-ctl text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15', 'aria-label': 'Close the guide' }, icon('x', 'icon h-5 w-5'));
  const openInPage = h('a', { href: '#guide', className: cx('inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-ctl px-2.5 text-sm font-medium text-secondary hover:bg-secondary/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15'), dataset: { guideOpenInPage: '' } }, ['Open in Page', icon('chevron-right', 'icon h-4 w-4')]);
  const bodyEl = h('div', { className: 'min-h-0 flex-1 overflow-y-auto px-4 py-4', dataset: { guidePanelBody: '' } });
  const search = searchBox({
    onOpen: (r) => { search.clear(); go({ anchor: r.anchor, step: r.step }); },
    onChange: (showing) => { bodyEl.classList.toggle('hidden', showing); resultsWrap.classList.toggle('hidden', !showing); },
  });
  const resultsWrap = h('div', { className: 'hidden min-h-0 flex-1 overflow-y-auto px-4 py-4' }, search.results);
  const panel = h('aside', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'guide-panel-title',
    className: 'pointer-events-auto absolute inset-y-0 right-0 flex w-[440px] max-w-full flex-col border-l border-border bg-popover text-popover-foreground shadow-pop',
    dataset: { guidePanel: '' },
  }, [
    h('div', { className: 'flex flex-none items-center gap-2 border-b border-border px-4 py-3' }, [icon('book-open', 'icon h-5 w-5 text-brand'), title, openInPage, closeBtn]),
    h('div', { className: 'flex-none border-b border-border px-4 py-3' }, search.el),
    bodyEl,
    resultsWrap,
  ]);
  const scrim = h('div', { className: 'absolute inset-0 bg-scrim' });
  const overlay = h('div', { className: 'fixed inset-0 z-[55]', dataset: { guidePanelRoot: '' } }, [scrim, panel]);

  // the page behind, and any dialog, stand still while the panel is open (what was inert before stays so after)
  const behind = [...document.querySelectorAll('[data-shell], #overlay-root')].map((n) => [n, n.inert]);
  behind.forEach(([n]) => { n.inert = true; });

  function close() {
    if (!current) return;
    current = null;
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('hashchange', close);
    overlay.remove();
    behind.forEach(([n, was]) => { n.inert = was; });
    if (lastFocus && lastFocus.isConnected && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...panel.querySelectorAll(FOCUSABLE)].filter(visible);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ---- what the body shows
  const ctxFor = (chapter, at) => ({
    chapter,
    // a link to a screen closes the panel, opens the screen and leaves Back to Guide, which opens the panel again at this step
    onScreen: (_link, origin) => {
      keepGuidePlace({ run: () => openGuidePanel({ anchor: origin.anchor, step: origin.step }) });
      close();
    },
    onSection: (to, e) => { e.preventDefault(); go({ anchor: to }); },
    at,
  });

  function drawContents() {
    openInPage.setAttribute('href', '#guide');
    title.textContent = 'User Guide';
    if (!chapters.length) { fill(bodyEl, emptyState({ icon: 'book-open', title: 'Nothing in the Guide Yet', text: 'No part of the guide is written for your role yet.' })); return; }
    fill(bodyEl, h('nav', { 'aria-label': 'Guide contents', className: 'space-y-4' }, chapters.map((c) => h('div', {}, [
      h('p', { className: 'px-1 text-2xs font-semibold uppercase tracking-widest text-muted-foreground', text: c.title }),
      h('ul', { className: 'mt-1 space-y-0.5' }, c.sections.map((s) => h('li', {}, h('a', {
        href: guideHref(s.slug),
        className: 'flex items-center gap-2 rounded-ctl px-2.5 py-2 text-sm hover:bg-subtle focus-visible:bg-subtle focus-visible:outline-none',
        onClick: (e) => { e.preventDefault(); go({ anchor: s.slug }); },
      }, [h('span', { className: 'min-w-0 flex-1', text: s.title }), icon('chevron-right', 'icon h-4 w-4 flex-none text-muted-foreground')])))),
    ]))));
    bodyEl.scrollTop = 0;
  }

  async function drawSection(slug, at, stepNo) {
    const chapter = await loadChapter(slug);
    if (current !== handle) return;
    const section = chapter.sections.find((s) => s.slug === at || s.tasks.some((t) => t.slug === at));
    if (!section) { drawContents(); return; }
    openInPage.setAttribute('href', guideHref(at, stepNo));
    title.textContent = chapter.title;
    const back = h('button', { type: 'button', className: 'mb-3 inline-flex h-8 items-center gap-1.5 rounded-ctl px-2 text-sm font-medium text-secondary hover:bg-secondary/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15', onClick: () => go({}) }, [icon('arrow-left', 'icon h-4 w-4'), 'Contents']);
    const ctx = ctxFor(chapter, at);
    fill(bodyEl, [back, sectionNodes(section, ctx, { titleClass: 'text-lg font-semibold tracking-tight', taskClass: 'text-sm font-semibold' })]);
    requestAnimationFrame(() => showAnchor(bodyEl, at, stepNo));
    if (at === section.slug && !stepNo) bodyEl.scrollTop = 0;
  }

  async function go({ anchor: at, step: stepNo } = {}) {
    search.clear();
    try {
      if (at) await drawSection(await locateAnchor(at), at, stepNo);
      else drawContents();
    } catch (err) {
      fill(bodyEl, h('p', { className: 'text-sm text-error', role: 'alert', text: (err && err.message) || 'The guide could not be opened.' }));
    }
  }

  const handle = { close, go };
  current = handle;
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('hashchange', close);
  closeBtn.addEventListener('click', close);
  scrim.addEventListener('click', close);
  document.body.appendChild(overlay);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    panel.animate([{ transform: 'translateX(100%)' }, { transform: 'none' }], { duration: 220, easing: 'ease-out' });
  }
  search.input.focus();

  try {
    chapters = await loadContents();
    if (current !== handle) return;
    // at the section for the page in view; the contents when the page has none
    let at = anchor;
    if (!at && screen) {
      const hit = chapters.flatMap((c) => c.sections).find((s) => s.screen === screen);
      if (hit) at = hit.slug;
    }
    await go({ anchor: at, step });
  } catch (err) {
    fill(bodyEl, h('p', { className: 'text-sm text-error', role: 'alert', text: (err && err.message) || 'The guide could not be opened.' }));
  }
}
