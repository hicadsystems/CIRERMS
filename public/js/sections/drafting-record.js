/*
 * drafting-record: the record's Drafting tab shows a move that is still to come (Drafting, WP7a; Special
 * Drafting, WP11, uses the same posting move): "Drafted to X wef dd/mm/yyyy" with a Scheduled pill, above the
 * postings. The posting itself is made by the server on that date.
 *
 *   scheduledMoves(serviceNumber)   an <li> for the timeline; it replaces itself with one line per move
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { formatDisplayDate } from '../core/dates.js';
import { h } from '../ui/html.js';
import { pill } from '../ui/pill.js';

export function scheduledMoves(serviceNumber) {
  const slot = h('li', { className: 'hidden', 'aria-hidden': 'true' });
  if (!can('ratings.edit', 'view') && !can('ratings.my-details', 'view')) return slot;
  api.get(`/api/drafting/rating/${encodeURIComponent(serviceNumber)}/scheduled`).then((res) => {
    const moves = (res && res.data) || [];
    if (!moves.length || !slot.isConnected) return;
    slot.replaceWith(...moves.map((m) => h('li', { className: 'relative pb-5 pl-5', dataset: { scheduledMove: '' } }, [
      h('span', { className: 'absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-background bg-warning', 'aria-hidden': 'true' }),
      h('div', { className: 'flex flex-wrap items-center gap-2' }, [h('b', { className: 'text-sm', text: `Drafted to ${m.ship} wef ${formatDisplayDate(m.wef)}` }), pill('Scheduled', 'info')]),
      h('div', { className: 'text-xs text-muted-foreground', text: `The ship changes on ${formatDisplayDate(m.wef)}${m.authority ? ` · ${m.authority}` : ''}` }),
    ])));
  }).catch(() => {});
  return slot;
}
