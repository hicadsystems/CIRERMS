/*
 * facts: a list of label / value pairs (a <dl>) in two columns.
 *
 *   facts(rows, { columns })
 *     rows      [[label, value], ...]; value is text or a node; empty values show "-"
 *     columns   2 (default) or 1 or 3
 *
 * Phones: two columns stay two columns (they are short); three drop to two.
 */
import { cx, h } from './html.js';

const COLS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3 phone:grid-cols-2' };

export function facts(rows = [], { columns = 2, className = '' } = {}) {
  return h(
    'dl',
    { className: cx('grid gap-x-4 gap-y-3 text-sm', COLS[columns] || COLS[2], className) },
    rows.map(([label, value]) =>
      h('div', { className: 'min-w-0' }, [
        h('dt', { className: 'text-2xs font-semibold uppercase tracking-wider text-muted-foreground', text: label }),
        h('dd', { className: 'mt-0.5 break-words' }, value === null || value === undefined || value === '' ? '-' : value),
      ])
    )
  );
}
