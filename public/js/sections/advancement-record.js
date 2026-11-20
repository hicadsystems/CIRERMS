/*
 * advancement-record: the record's Advancement tab shows a rate change still to come (Advancement Processing,
 * WP8: a board date after today): "Advanced to LS wef dd/mm/yyyy" with a Scheduled pill, above the lines.
 * The line itself is added by the server on that date.
 *
 *   scheduledAdvancements(serviceNumber)   a slot that replaces itself with one notice per change (or stays empty)
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { formatDisplayDate } from '../core/dates.js';
import { icon } from '../core/icons.js';
import { h } from '../ui/html.js';
import { pill } from '../ui/pill.js';

export function scheduledAdvancements(serviceNumber) {
  const slot = h('div', { className: 'hidden', 'aria-hidden': 'true' });
  if (!can('ratings.edit', 'view') && !can('ratings.my-details', 'view')) return slot;
  api.get(`/api/advancement/rating/${encodeURIComponent(serviceNumber)}/scheduled`).then((res) => {
    const list = (res && res.data) || [];
    if (!list.length || !slot.isConnected) return;
    slot.replaceWith(...list.map((c) => h('div', { className: 'flex items-start gap-2 border-b border-border bg-info-soft px-4 py-2.5', dataset: { scheduledAdvancement: '' } }, [
      icon('calendar', 'icon mt-0.5 flex-none text-info'),
      h('div', { className: 'min-w-0 flex-1' }, [
        h('div', { className: 'flex flex-wrap items-center gap-2' }, [h('b', { className: 'text-sm', text: `Advanced to ${c.rateCode} wef ${formatDisplayDate(c.date)}` }), pill('Scheduled', 'info')]),
        h('div', { className: 'text-xs text-muted-foreground', text: `The rate changes to ${c.rate} on ${formatDisplayDate(c.date)}${c.authority ? ` · ${c.authority}` : ''}` }),
      ]),
    ])));
  }).catch(() => {});
  return slot;
}
