/*
 * facts: a details sheet. One row per field: the label on the left (about 40%),
 * the value on the right, a thin divider under every row.
 *
 *   facts(rows, { columns, className })
 *     rows      [[label, value], ...]; value is text or a node; empty values show "N/A"
 *     columns   kept so old calls still work; the rows are always one column.
 *               For two panels side by side use factPanels().
 *
 *   factPanels([{ title, rows, actions }, ...])
 *     panels side by side on a wide page (title in the brand colour, optional action buttons beside it, then its rows);
 *     they stack on a phone. Each row stays label left, value right.
 */
import { cx, h } from './html.js';

const empty = (v) => v === null || v === undefined || v === '';

export function facts(rows = [], { className = '' } = {}) {
  return h(
    'dl',
    { className: cx('text-sm', className) },
    rows.map(([label, value]) =>
      h('div', { className: 'grid grid-cols-[2fr_3fr] gap-x-3 border-b border-border py-2' }, [
        h('dt', { className: 'min-w-0 break-words font-medium text-foreground', text: label }),
        h('dd', { className: 'min-w-0 break-words' }, empty(value) ? 'N/A' : value),
      ])
    )
  );
}

export function factPanels(panels = [], { className = '' } = {}) {
  return h(
    'div',
    { className: cx('grid grid-cols-2 gap-x-8 gap-y-6 phone:grid-cols-1', className) },
    panels.map((p) =>
      h('section', { className: 'min-w-0' }, [
        h('div', { className: 'flex min-h-9 items-center justify-between gap-2 border-b border-border pb-1' }, [
          h('h3', { className: 'text-sm font-semibold text-brand', text: p.title }),
          p.actions ? h('div', { className: 'flex items-center gap-1' }, p.actions) : null,
        ]),
        facts(p.rows),
      ])
    )
  );
}
