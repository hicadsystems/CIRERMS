/*
 * ratingSearch: the one way a rating is picked, wherever a person must enter a rating's official number.
 * A search select: type 2 or more characters and suggestions appear under the field (fewer: no request,
 * no list). It finds by official number or by any of the rating's names, and every further character
 * narrows the list. The server answers 10 suggestions at a time (GET /api/ratings/search); scrolling to
 * the end of the list, or arrowing to its last rows, loads the next 10.
 *
 *   const pick = ratingSearch({ name: 'serviceNumber', status: 'current', onChange: (rating) => {} });
 *   field({ label: 'Rating', control: pick });
 *
 *   status     'current' | 'former' | 'all' (default)
 *   account    'with' | 'without': only ratings that have / do not have a login account
 *              (each suggestion then also carries `account`)
 *   name       the name of a hidden input holding the chosen official number, so a form reads it
 *   value      a rating to start with ({ serviceNumber, title, names }) or an official number
 *   onChange   called with the chosen rating, or null when it is cleared or edited
 *   disabled, placeholder, ariaLabel, id, className
 *
 * The returned element (a div) has:  .value (the official number, '' when none), .rating (the chosen
 * suggestion or null), .set(ratingOrNumber), .clear(), .focus(), .input (the text field), and fires a
 * bubbling `change` event when the choice changes. Choose with the mouse or a finger, or with Up, Down,
 * Enter and Escape. The list is drawn over everything (inside dialogs and bottom sheets too), with the
 * theme tokens, so it follows light and dark. Typing is debounced, a stale request is cancelled, and
 * answers that arrive late are ignored.
 *
 * Phones: the field is 44 px tall and each suggestion is a 44 px touch row.
 */
import { api } from '../core/api.js';
import { icon } from '../core/icons.js';
import { cx, h } from './html.js';
import { INPUT } from './classes.js';

const MIN_CHARS = 2;
const PAGE = 10;
const DEBOUNCE_MS = 250;

let seq = 0;

/** "B0539 — PO OKONKWO CHUKWUEMEKA IFEANYI": official number, dash, title (or rate), names. */
export function ratingLabel(r) {
  return `${r.serviceNumber} — ${[r.title, r.names].filter(Boolean).join(' ')}`;
}

export function ratingSearch({
  name = '', status = 'all', account = null, value = null, onChange = null,
  disabled = false, placeholder = 'Official number or name', ariaLabel = 'Rating', id = '', className = '',
} = {}) {
  seq += 1;
  const listId = `rating-search-list-${seq}`;
  const hidden = h('input', { type: 'hidden', name: name || undefined, value: '' });
  const input = h('input', {
    type: 'text', id: id || undefined, placeholder, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: 80, disabled,
    className: cx(INPUT, 'pr-9'), role: 'combobox', 'aria-expanded': 'false', 'aria-controls': listId, 'aria-autocomplete': 'list', 'aria-label': ariaLabel,
  });
  const clearBtn = h('button', {
    type: 'button', tabindex: '-1', 'aria-label': 'Clear rating',
    className: 'absolute right-1 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-ctl text-muted-foreground hover:bg-muted hover:text-foreground phone:h-tap phone:w-tap',
    onMousedown: (e) => e.preventDefault(),
    onClick: () => { api_clear(); input.focus(); },
  }, icon('x'));
  const root = h('div', { className: cx('relative', className), dataset: { ratingSearch: '', name } }, [input, clearBtn, hidden]);
  const list = h('ul', {
    id: listId, role: 'listbox', 'aria-label': 'Ratings',
    className: 'fixed z-[60] hidden overflow-y-auto overscroll-contain rounded-card border border-border/70 bg-popover p-1 text-sm text-popover-foreground shadow-pop',
  });

  let chosen = null;
  let items = [];
  let hasMore = false;
  let loading = false;
  let failed = false;
  let term = '';
  let at = -1;
  let timer = null;
  let ctrl = null;
  let token = 0;
  let isOpen = false;
  let watch = null;

  const syncClear = () => clearBtn.classList.toggle('hidden', disabled || !input.value);
  const syncClearFlex = () => { syncClear(); clearBtn.classList.toggle('inline-flex', !clearBtn.classList.contains('hidden')); };

  function setChosen(r, { silent = false } = {}) {
    const was = chosen;
    chosen = r || null;
    hidden.value = chosen ? chosen.serviceNumber : '';
    input.value = chosen ? ratingLabel(chosen) : input.value;
    syncClearFlex();
    const changed = (was ? was.serviceNumber : '') !== (chosen ? chosen.serviceNumber : '');
    if (changed && !silent) {
      if (onChange) onChange(chosen);
      root.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function api_clear() {
    cancel();
    items = []; hasMore = false; term = ''; at = -1;
    input.value = '';
    setChosen(null);
    syncClearFlex();
    close();
  }

  function cancel() {
    clearTimeout(timer);
    token += 1;
    if (ctrl) ctrl.abort();
    ctrl = null;
    loading = false;
  }

  // ---- the list
  function place() {
    if (!isOpen) return;
    if (!root.isConnected) { close(); return; }
    const r = input.getBoundingClientRect();
    const vv = window.visualViewport;
    const viewH = vv ? vv.height : window.innerHeight;
    const viewTop = vv ? vv.offsetTop : 0;
    const below = viewTop + viewH - r.bottom - 8;
    const above = r.top - viewTop - 8;
    const want = 280;
    const flip = below < Math.min(want, 160) && above > below;
    list.style.left = `${Math.max(4, r.left)}px`;
    list.style.width = `${r.width}px`;
    list.style.maxHeight = `${Math.max(120, Math.min(want, flip ? above : below))}px`;
    if (flip) { list.style.top = 'auto'; list.style.bottom = `${window.innerHeight - r.top + 4}px`; }
    else { list.style.bottom = 'auto'; list.style.top = `${r.bottom + 4}px`; }
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    document.body.appendChild(list);
    list.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', place);
    watch = setInterval(place, 400);
    place();
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    list.classList.add('hidden');
    list.remove();
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    if (window.visualViewport) window.visualViewport.removeEventListener('resize', place);
    clearInterval(watch);
  }

  const note = (text, spin = false) => h('li', { role: 'presentation', className: 'flex items-center justify-center gap-2 px-3 py-3 text-sm text-muted-foreground' }, [spin ? icon('loader-circle', 'icon animate-spin') : null, text]);

  function draw() {
    const rows = items.map((r, i) => h('li', {
      id: `${listId}-${i}`, role: 'option', 'aria-selected': String(i === at), dataset: { rating: r.serviceNumber },
      className: cx('cursor-pointer rounded-ctl px-3 py-2 text-sm leading-snug phone:min-h-tap phone:py-2.5', i === at ? 'bg-secondary/10' : 'hover:bg-subtle'),
      onMousedown: (e) => e.preventDefault(),
      onClick: () => choose(r),
    }, [h('span', { className: 'font-semibold', text: r.serviceNumber }), ` — ${[r.title, r.names].filter(Boolean).join(' ')}`]));
    const rest = [];
    if (!items.length && loading) rest.push(note('Searching…', true));
    else if (!items.length && failed) rest.push(note('Could not search. Try again.'));
    else if (!items.length) rest.push(note('No ratings found'));
    else if (loading) rest.push(note('Loading more…', true));
    list.replaceChildren(...rows, ...rest);
    if (at >= 0) input.setAttribute('aria-activedescendant', `${listId}-${at}`); else input.removeAttribute('aria-activedescendant');
  }

  function choose(r) {
    cancel();
    setChosen(r);
    close();
  }

  // ---- requests: the first page of a new term, then the next 10 as the end of the list is reached
  async function fetchPage(offset) {
    const mine = token;
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    loading = true;
    failed = false;
    draw();
    const params = new URLSearchParams({ q: term, offset: String(offset), limit: String(PAGE), status });
    if (account) params.set('account', account);
    try {
      const res = await api.get(`/api/ratings/search?${params}`, { signal: ctrl.signal });
      if (mine !== token) return;
      items = offset === 0 ? res.data || [] : items.concat(res.data || []);
      hasMore = !!(res.meta && res.meta.hasMore);
      if (offset === 0) at = -1;
    } catch (err) {
      if (mine !== token || (err && err.name === 'AbortError')) return;
      if (offset === 0) items = [];
      hasMore = false;
      failed = true;
    }
    loading = false;
    draw();
    place();
    // a short list that does not scroll yet still has more to show
    if (hasMore && list.scrollHeight <= list.clientHeight + 2) loadMore();
  }

  function search() {
    items = []; hasMore = false; at = -1;
    open();
    fetchPage(0);
  }

  function loadMore() {
    if (loading || !hasMore) return;
    fetchPage(items.length);
  }

  list.addEventListener('scroll', () => {
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 24) loadMore();
  });

  // ---- the field
  input.addEventListener('input', () => {
    if (chosen) setChosen(null); // typing over a chosen rating un-chooses it
    syncClearFlex();
    cancel();
    term = input.value.trim();
    if (term.length < MIN_CHARS) { items = []; hasMore = false; at = -1; close(); return; }
    open();
    items = []; hasMore = false; loading = true; failed = false; draw(); place();
    const mine = token;
    timer = setTimeout(() => { if (mine === token) search(); }, DEBOUNCE_MS);
  });

  input.addEventListener('focus', () => {
    if (chosen) input.select();
    else if (term.length >= MIN_CHARS && input.value.trim() === term && (items.length || failed)) { open(); draw(); }
  });
  input.addEventListener('blur', () => { close(); });
  // the text field's own `change` (fired on blur) is not a choice: only the picker's own `change` event, fired when a rating is chosen or cleared, reaches the form
  input.addEventListener('change', (e) => e.stopPropagation());

  input.addEventListener('keydown', (e) => {
    const move = (to) => {
      at = to;
      draw();
      const row = list.children[at];
      if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
      if (at >= items.length - 3) loadMore();
    };
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) { if (items.length && !chosen) { open(); draw(); } return; }
      if (items.length) move(Math.min(items.length - 1, at + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen && items.length) move(Math.max(0, at - 1));
    } else if (e.key === 'Enter') {
      if (isOpen) { e.preventDefault(); if (items[at]) choose(items[at]); else if (items.length === 1) choose(items[0]); }
    } else if (e.key === 'Escape') {
      if (isOpen) { e.preventDefault(); close(); }
    } else if (e.key === 'Tab') {
      close();
    }
  });

  // ---- the element's own API
  Object.defineProperties(root, {
    value: { get: () => (chosen ? chosen.serviceNumber : '') },
    rating: { get: () => chosen },
    input: { value: input },
  });
  root.clear = api_clear;
  root.focus = () => input.focus();
  root.set = async (r) => {
    if (!r) { api_clear(); return; }
    if (typeof r === 'object') { setChosen(r); return; }
    const sn = String(r);
    setChosen({ serviceNumber: sn, title: '', names: '' }, { silent: true });
    try {
      const res = await api.get(`/api/ratings/search?${new URLSearchParams({ q: sn, limit: '1', status: 'all' })}`);
      const hit = (res.data || []).find((x) => x.serviceNumber === sn);
      if (hit && chosen && chosen.serviceNumber === sn) setChosen(hit, { silent: true });
    } catch (_) { /* the official number alone stays */ }
  };

  if (value) root.set(value);
  return root;
}
