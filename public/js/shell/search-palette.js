/*
 * search palette (Ctrl K, Cmd K on a Mac; the top bar's and the phone
 * header's search buttons). Finds screens (from core/nav.js, Soon modules
 * included, and the New Rating action) and ratings by Official No or name (the
 * server's top matches, as you type). Arrow keys move, Enter opens, Esc closes.
 *
 * Desktop: a dialog near the top of the window. Phones: full screen.
 *
 *   openPalette()   (registered with core/search.js setSearchHandler by the shell)
 */
import { api } from '../core/api.js';
import { AREAS } from '../core/nav.js';
import { icon } from '../core/icons.js';
import { navigate } from '../core/router.js';
import { h, cx, fill } from '../ui/html.js';
import { avatar } from '../ui/avatar.js';
import { emptyState } from '../ui/empty-state.js';
import { pillClass } from '../ui/pill.js';
import { openNewRating } from '../sections/rating-new.js';
import { ratingName, personName } from '../sections/rating-names.js';

function screens() {
  const out = [];
  AREAS.forEach((area) => area.modules.forEach((m) => {
    if (m.tabs && m.tabs.length) {
      m.tabs.forEach((t) => out.push({ label: `${m.short} · ${t.label}`, words: `${m.label} ${t.label}`, href: t.route, icon: t.icon || m.icon }));
    } else {
      out.push({ label: m.label, words: `${m.label} ${m.short}`, href: m.href || `soon/${m.key}`, icon: m.icon, soon: !!m.soon });
    }
  }));
  out.splice(1, 0, { label: 'New Rating', words: 'new rating add create enlist', icon: 'user-plus', run: () => openNewRating() });
  return out;
}

let open = null;

export function openPalette() {
  if (open) { open.input.focus(); return; }
  const all = screens();
  let items = [];
  let ratings = [];
  let at = 0;
  let timer = null;
  let token = 0;
  const lastFocus = document.activeElement;

  const input = h('input', {
    type: 'text',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'Search ratings and screens',
    'aria-label': 'Search ratings and screens',
    role: 'combobox',
    'aria-expanded': 'true',
    'aria-controls': 'palette-results',
    className: 'h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground',
  });
  const results = h('div', { id: 'palette-results', role: 'listbox', className: 'min-h-0 flex-1 overflow-y-auto p-2' });
  const closeBtn = h('button', { type: 'button', className: 'inline-flex h-tap w-tap items-center justify-center text-muted-foreground desk:hidden', 'aria-label': 'Close' }, icon('x', 'icon h-5 w-5'));
  const panel = h('div', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': 'Search',
    className: 'pointer-events-auto flex max-h-full w-full flex-col overflow-hidden bg-popover text-popover-foreground shadow-pop desk:max-w-xl desk:rounded-dialog phone:h-full',
  }, [
    h('div', { className: 'flex flex-none items-center gap-2 border-b border-border px-4' }, [
      icon('search', 'icon h-5 w-5 text-muted-foreground'),
      input,
      closeBtn,
      h('kbd', { className: 'rounded border border-border px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground phone:hidden', text: 'Esc' }),
    ]),
    results,
  ]);
  const scrim = h('div', { className: 'absolute inset-0 bg-scrim backdrop-blur-sm' });
  const overlay = h('div', { className: 'fixed inset-0 z-[60]' }, [
    scrim,
    h('div', { className: 'pointer-events-none absolute inset-0 flex justify-center desk:items-start desk:p-6 desk:pt-24' }, panel),
  ]);

  function close() {
    if (!open) return;
    open = null;
    clearTimeout(timer);
    overlay.remove();
    document.querySelectorAll('[data-shell]').forEach((n) => { n.inert = false; });
    document.removeEventListener('keydown', onKey, true);
    if (lastFocus && lastFocus.isConnected) lastFocus.focus();
  }

  function activate(item) {
    if (!item) return;
    close();
    if (item.run) item.run();
    else navigate(`#${item.href}`);
  }

  function draw() {
    const q = input.value.trim().toLowerCase();
    const found = all.filter((s) => !q || `${s.label} ${s.words}`.toLowerCase().includes(q)).slice(0, q ? 8 : 6);
    const people = ratings.map((r) => ({ label: ratingName(r), sub: `${r.service_number} · ${r.status === 'former' ? 'Former' : r.current_ship_name || 'Current'}`, href: `ratings/edit/${encodeURIComponent(r.service_number)}`, rating: r }));
    const groups = [['Screens', found], ['Ratings', people]].filter(([, list]) => list.length);
    items = groups.flatMap(([, list]) => list);
    at = Math.max(0, Math.min(at, items.length - 1));
    if (!items.length) {
      fill(results, emptyState({ icon: 'search', title: 'Nothing Matches', text: 'Try an Official No, a surname or a screen.' }));
      input.removeAttribute('aria-activedescendant');
      return;
    }
    let n = -1;
    fill(results, groups.map(([label, list]) => h('div', { role: 'group', 'aria-label': label }, [
      h('div', { className: 'px-2 pb-1 pt-2 text-2xs font-semibold uppercase tracking-widest text-muted-foreground', text: label }),
      ...list.map((it) => {
        n += 1;
        const i = n;
        const on = i === at;
        return h('a', {
          id: `palette-item-${i}`,
          href: it.href ? `#${it.href}` : '#',
          role: 'option',
          'aria-selected': String(on),
          className: cx('flex items-center gap-3 rounded-ctl px-2 py-2 text-sm', on ? 'bg-secondary/10' : 'hover:bg-subtle'),
          onClick: (e) => { e.preventDefault(); activate(it); },
          onMousemove: () => { if (at !== i) { at = i; paintActive(); } },
        }, [
          it.rating ? avatar({ name: personName(it.rating), size: 'xs' }) : h('span', { className: 'flex h-8 w-8 flex-none items-center justify-center rounded-ctl bg-muted text-muted-foreground' }, icon(it.icon)),
          h('span', { className: 'min-w-0 flex-1' }, [
            h('b', { className: 'block truncate font-medium', text: it.label }),
            it.sub ? h('span', { className: 'block truncate text-xs text-muted-foreground', text: it.sub }) : null,
          ]),
          it.soon ? h('span', { className: pillClass('neutral'), text: 'Soon' }) : null,
          h('span', { className: cx('text-muted-foreground', !on && 'invisible'), dataset: { arrow: '' } }, icon('chevron-right')),
        ]);
      }),
    ])));
    paintActive();
  }

  function paintActive() {
    results.querySelectorAll('[role="option"]').forEach((a, i) => {
      const on = i === at;
      a.setAttribute('aria-selected', String(on));
      a.classList.toggle('bg-secondary/10', on);
      a.classList.toggle('hover:bg-subtle', !on);
      const arrow = a.querySelector('[data-arrow]');
      if (arrow) arrow.classList.toggle('invisible', !on);
      if (on) { a.scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', a.id); }
    });
  }

  async function findRatings() {
    const q = input.value.trim();
    const mine = ++token;
    try {
      const res = await api.get(`/api/ratings?${new URLSearchParams({ status: 'all', q, page: '1', pageSize: q ? '6' : '4', sortBy: q ? 'surname' : 'service_number' })}`);
      if (mine !== token || !open) return;
      ratings = res.data || [];
      draw();
    } catch (_) {
      if (mine === token) { ratings = []; draw(); }
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) { at = (at + 1) % items.length; paintActive(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) { at = (at - 1 + items.length) % items.length; paintActive(); } }
    else if (e.key === 'Enter' && document.activeElement === input) { e.preventDefault(); activate(items[at]); }
    else if (e.key === 'Tab') { e.preventDefault(); input.focus(); }
  }

  input.addEventListener('input', () => {
    at = 0;
    draw();
    clearTimeout(timer);
    timer = setTimeout(findRatings, 200);
  });
  scrim.addEventListener('click', close);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', onKey, true);

  document.body.appendChild(overlay);
  document.querySelectorAll('[data-shell]').forEach((n) => { n.inert = true; });
  open = { input, close };
  // focus at once, so keys typed straight after Ctrl K land in the box
  input.focus();
  draw();
  findRatings();
}

export function closePalette() {
  if (open) open.close();
}
