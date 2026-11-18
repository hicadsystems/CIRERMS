/*
 * list view: a server-paged list. A table on desktop, cards on a phone, and
 * the pager under both. Pages are fixed at 25 and come from the API's `meta`.
 *
 *   const list = listView({ columns, load, card, onPick, rowKey, empty, onLoaded, autoLoad })
 *     columns   [{ key, label, render(row) -> text | node, className, muted }]
 *               (render defaults to row[key]; the first column is muted, the second bold, as in the demo)
 *     load      async ({ page, pageSize }) => the API response { data: rows, meta }
 *     card      { title(row), subtitle(row), avatar(row) -> name for initials | null, aside(row) -> node }
 *               (defaults: the second column as title, the first as subtitle)
 *     onPick(row)   a row or card was clicked or Enter was pressed on it; omit for a read-only list
 *     rowKey(row)   a row's id (default row.id), used to mark the picked row
 *     empty     { icon, title, text } when there are no rows
 *     onLoaded({ rows, meta })   after each page arrives (set the toolbar count here)
 *     autoLoad  fetch page 1 straight away (default true); false waits for list.reload()
 *   list.el  list.reload({ resetPage })  list.setPage(n)  list.rows()  list.meta()  list.setPicked(key)
 *
 * Phones: each row is a card (avatar, title, subtitle, chevron); the pager sits under the cards.
 */
import { cx, h } from './html.js';
import { icon } from '../core/icons.js';
import { CARD, TH } from './classes.js';
import { avatar } from './avatar.js';
import { emptyState } from './empty-state.js';
import { pager, PAGE_SIZE } from './pager.js';
import { toast } from './toast.js';

const text = (v) => (v === null || v === undefined || v === '' ? '-' : v);

export function listView({ columns = [], load, card = {}, onPick = null, rowKey = (r) => r.id, empty = {}, onLoaded, autoLoad = true } = {}) {
  let page = 1;
  let rows = [];
  let meta = { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 };
  let picked = null;
  let token = 0;

  const cell = (col, row) => (typeof col.render === 'function' ? col.render(row) : row[col.key]);
  const title = card.title || ((r) => cell(columns[1] || columns[0], r));
  const subtitle = card.subtitle || ((r) => (columns[1] ? cell(columns[0], r) : ''));

  const tbody = h('tbody');
  const table = h('table', { className: 'w-full text-sm' }, [
    h('thead', { className: 'bg-subtle' }, h('tr', {}, columns.map((c) => h('th', { className: cx(TH, c.headClassName), scope: 'col', text: c.label })))),
    tbody,
  ]);
  const deskPager = pager({ onPage: (n) => setPage(n) });
  const phonePager = pager({ onPage: (n) => setPage(n) });
  const cards = h('div', { className: 'space-y-2' });
  const status = h('div', { className: 'sr-only', 'aria-live': 'polite' });

  const el = h('div', { className: 'min-w-0' }, [
    status,
    h('div', { className: cx(CARD, 'overflow-hidden phone:hidden') }, [h('div', { className: 'overflow-x-auto' }, table), deskPager]),
    h('div', { className: 'space-y-2 desk:hidden' }, [cards, h('div', { className: CARD }, phonePager)]),
  ]);

  const emptyNode = () => emptyState({ icon: empty.icon || 'search', title: empty.title || 'Nothing Found', text: empty.text || '' });

  function draw() {
    tbody.replaceChildren();
    cards.replaceChildren();
    if (!rows.length) {
      tbody.appendChild(h('tr', {}, h('td', { colspan: String(columns.length || 1) }, emptyNode())));
      cards.appendChild(h('div', { className: CARD }, emptyNode()));
    }
    rows.forEach((row) => {
      const key = rowKey(row);
      const on = picked !== null && key === picked;
      const tr = h('tr', {
        className: cx('border-t border-border transition-colors', onPick && 'cursor-pointer', on ? 'bg-secondary/10 shadow-[inset_3px_0_0_0_rgb(var(--secondary))]' : 'hover:bg-subtle'),
        tabindex: onPick ? '0' : undefined,
        'aria-selected': onPick ? String(on) : undefined,
      }, columns.map((c, i) => h('td', { className: cx('whitespace-nowrap px-4 py-2.5', i === 0 && 'text-muted-foreground', i === 1 && 'font-medium', c.className) }, text(cell(c, row)))));
      if (onPick) {
        tr.addEventListener('click', (e) => { if (!e.target.closest('a,button')) onPick(row); });
        tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') onPick(row); });
      }
      tbody.appendChild(tr);

      const who = card.avatar ? card.avatar(row) : null;
      const inner = [
        who ? avatar({ name: who, size: 'md' }) : null,
        h('span', { className: 'min-w-0 flex-1' }, [
          h('b', { className: 'block truncate text-sm font-semibold' }, text(title(row))),
          h('span', { className: 'block truncate text-xs text-muted-foreground' }, subtitle(row) || ''),
        ]),
        card.aside ? card.aside(row) : null,
        onPick ? icon('chevron-right', 'icon text-muted-foreground') : null,
      ];
      cards.appendChild(onPick
        ? h('button', { type: 'button', className: cx(CARD, 'flex w-full items-center gap-3 p-3 text-left transition-all hover:shadow-card-hover active:bg-subtle'), onClick: () => onPick(row) }, inner)
        : h('div', { className: cx(CARD, 'flex w-full items-center gap-3 p-3') }, inner));
    });
    deskPager.update(meta);
    phonePager.update(meta);
  }

  function loading() {
    const row = h('div', { className: 'flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground' }, [icon('loader-circle', 'icon animate-spin'), 'Loading']);
    tbody.replaceChildren(h('tr', {}, h('td', { colspan: String(columns.length || 1) }, row)));
    cards.replaceChildren(h('div', { className: CARD }, row.cloneNode(true)));
    status.textContent = 'Loading';
  }

  async function fetchPage() {
    const mine = ++token;
    loading();
    try {
      const res = await load({ page, pageSize: PAGE_SIZE });
      if (mine !== token) return;
      rows = Array.isArray(res && res.data) ? res.data : [];
      meta = { page, pageSize: PAGE_SIZE, total: rows.length, totalPages: 1, ...((res && res.meta) || {}) };
      page = Number(meta.page) || page;
      status.textContent = `${meta.total} found`;
      draw();
      if (typeof onLoaded === 'function') onLoaded({ rows, meta });
    } catch (err) {
      if (mine !== token) return;
      rows = [];
      meta = { page: 1, pageSize: PAGE_SIZE, total: 0, totalPages: 1 };
      draw();
      toast((err && err.message) || 'Could not load the list.', 'error');
      if (typeof onLoaded === 'function') onLoaded({ rows, meta, error: err });
    }
  }

  function setPage(n) {
    page = Math.max(1, n);
    fetchPage();
  }

  if (autoLoad) queueMicrotask(fetchPage);

  return {
    el,
    reload({ resetPage = false } = {}) {
      if (resetPage) page = 1;
      return fetchPage();
    },
    setPage,
    rows: () => rows.slice(),
    meta: () => ({ ...meta }),
    setPicked(key) {
      picked = key === undefined ? null : key;
      draw();
    },
  };
}
