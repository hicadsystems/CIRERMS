/*
 * pager: "26-50 of 112", Previous and Next, "Page 2 of 5". No page-size picker:
 * every list pages at 25 on the server.
 *
 *   pager({ meta, onPage })
 *     meta    the API's list meta: { page, pageSize, total, totalPages }
 *     onPage  called with the page number to load
 *   Returns the element; el.update(meta) redraws it.
 *
 * Phones: the buttons grow to 44 px and the bar loses its top border (it sits under the cards).
 */
import { h } from './html.js';
import { icon } from '../core/icons.js';

export const PAGE_SIZE = 25;

const NAV = 'inline-flex h-8 w-8 items-center justify-center rounded-ctl border border-input bg-background text-foreground transition-colors hover:bg-subtle disabled:pointer-events-none disabled:opacity-40 phone:h-tap phone:w-tap';

export function pager({ meta = {}, onPage = () => {} } = {}) {
  const range = h('span', { className: 'flex-1' });
  const label = h('span', { className: 'text-xs' });
  const prev = h('button', { type: 'button', className: NAV, 'aria-label': 'Previous Page' }, icon('chevron-left'));
  const next = h('button', { type: 'button', className: NAV, 'aria-label': 'Next Page' }, icon('chevron-right'));
  const bar = h('div', { className: 'flex items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-muted-foreground phone:border-0 phone:px-3' }, [range, prev, label, next]);
  let state = {};
  prev.addEventListener('click', () => { if (state.page > 1) onPage(state.page - 1); });
  next.addEventListener('click', () => { if (state.page < state.pages) onPage(state.page + 1); });

  bar.update = (m = {}) => {
    const total = Number(m.total) || 0;
    const size = Number(m.pageSize) || PAGE_SIZE;
    const pages = Math.max(1, Number(m.totalPages) || Math.ceil(total / size) || 1);
    const page = Math.min(Math.max(1, Number(m.page) || 1), pages);
    state = { page, pages };
    const from = total ? (page - 1) * size + 1 : 0;
    const to = Math.min(page * size, total);
    range.textContent = `${from}-${to} of ${total}`;
    label.textContent = `Page ${page} of ${pages}`;
    prev.disabled = page <= 1;
    next.disabled = page >= pages;
  };
  bar.update(meta);
  return bar;
}
