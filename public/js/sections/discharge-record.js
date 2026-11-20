/*
 * discharge-record: the record's header shows what the Discharge pages decided about a current rating (Discharge
 * Administration, WP5): "Leaves dd/mm/yyyy" when a closed discharge has a later exit date (it is Scheduled), and
 * "Re-engaged to dd/mm/yyyy" while a re-engagement runs.
 *
 *   dischargePills(serviceNumber)   a span to put among the header's pills; it fills itself in
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { formatDisplayDate } from '../core/dates.js';
import { h } from '../ui/html.js';
import { pill } from '../ui/pill.js';

export function dischargePills(serviceNumber) {
  const slot = h('span', { className: 'contents', dataset: { dischargePills: '' } });
  if (!can('ratings.edit', 'view') && !can('ratings.my-details', 'view')) return slot;
  api.get(`/api/discharge/rating/${encodeURIComponent(serviceNumber)}/status`).then((res) => {
    const s = (res && res.data) || {};
    slot.replaceChildren(
      ...[s.leavesOn ? pill(`Leaves ${formatDisplayDate(s.leavesOn)}`, 'warning') : null,
        s.reengagedUntil ? pill(`Re-engaged to ${formatDisplayDate(s.reengagedUntil)}`, 'info') : null].filter(Boolean),
    );
  }).catch(() => {});
  return slot;
}
