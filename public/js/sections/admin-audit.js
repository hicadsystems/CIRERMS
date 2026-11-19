/*
 * admin-audit (admin.audit): the Audit Trail. Filters (dates, who did it, action, table, official
 * number), a list of 25 a page from the server, newest first; a row opens the entry in a dialog (a
 * bottom sheet on a phone) with what changed, before and after. Read only: nothing here edits or
 * deletes an audit row, and no password or one-time password is ever in one.
 *
 *   mountAdminAudit(outlet, { info })      (the page's `view` in core/nav.js)
 */
import { api } from '../core/api.js';
import { parseDisplayDate, wireDateField } from '../core/dates.js';
import { h, cx } from '../ui/html.js';
import { pageHeader } from '../ui/page-header.js';
import { card } from '../ui/card.js';
import { listView } from '../ui/list-view.js';
import { button } from '../ui/button.js';
import { pill } from '../ui/pill.js';
import { facts } from '../ui/facts.js';
import { field, textInput, selectInput, setFieldError, clearFieldErrors } from '../ui/field.js';
import { ratingSearch } from '../ui/rating-search.js';
import { openDialog } from '../ui/dialog.js';
import { emptyState } from '../ui/empty-state.js';
import { toast } from '../ui/toast.js';
import { rowTooltip, stamp } from './admin-common.js';

const TONE = { INSERT: 'success', UPDATE: 'info', DELETE: 'error', 'SIGN IN': 'neutral', 'SIGN OUT': 'neutral', LOCK: 'warning', UNLOCK: 'warning' };
const actionPill = (a) => pill(a, TONE[a] || 'neutral');

export async function mountAdminAudit(outlet, { info } = {}) {
  const options = (await api.get('/api/audit/filters')).data;
  let applied = {};

  const recordPick = ratingSearch({ name: 'record', placeholder: 'Official number or name', ariaLabel: 'Official No' });
  const date = (name, label) => field({ label, control: wireDateField(textInput({ name, placeholder: 'dd/mm/yyyy', maxlength: 10, inputmode: 'numeric', autocomplete: 'off' })) });
  const filters = h('form', { id: 'audit-filters', className: 'grid grid-cols-6 gap-3 phone:grid-cols-2 [&>*]:min-w-0', novalidate: true, autocomplete: 'off' }, [
    field({ label: 'Action', control: selectInput({ name: 'action', options: options.actions, placeholder: 'All Actions' }) }),
    field({ label: 'Table', control: selectInput({ name: 'table', options: options.tables, placeholder: 'All Tables' }) }),
    field({ label: 'Performed By', control: textInput({ name: 'user', placeholder: 'User name', maxlength: 50 }) }),
    field({ label: 'Official No', control: recordPick }),
    date('from', 'From'),
    date('to', 'To'),
  ]);
  const count = h('span', { className: 'ml-auto text-sm text-muted-foreground', dataset: { count: '' } });
  const searchBtn = button({ label: 'Search', icon: 'search', variant: 'primary', type: 'submit', attrs: { form: 'audit-filters' } });
  const resetBtn = button({ label: 'Reset', icon: 'rotate-ccw', variant: 'outline', onClick: reset });
  const panel = card({
    className: 'mb-4',
    body: [
      h('div', { className: 'mb-3 text-2xs font-semibold uppercase tracking-widest text-muted-foreground', text: 'Filters' }),
      filters,
      h('div', { className: 'mt-4 flex flex-wrap items-center gap-2' }, [searchBtn, resetBtn, count]),
    ],
  });

  const lv = listView({
    columns: [
      { key: 'time', label: 'Time', render: (e) => stamp(e.time), className: 'text-muted-foreground' },
      { key: 'action', label: 'Action', render: (e) => actionPill(e.action) },
      { key: 'table', label: 'Table', render: (e) => (e.table ? h('span', { className: 'font-mono text-xs', text: e.table }) : '-') },
      { key: 'recordId', label: 'Record', render: (e) => e.recordId || '-', className: 'font-semibold text-foreground' },
      { key: 'username', label: 'By' },
    ],
    load: ({ page }) => {
      const qs = new URLSearchParams({ page: String(page), ...applied });
      return api.get(`/api/audit?${qs}`);
    },
    onPick: (e) => openEntry(e),
    card: {
      title: (e) => `${e.recordId || e.table || e.action}${e.table ? ` · ${e.table}` : ''}`,
      subtitle: (e) => `${stamp(e.time)} · ${e.username}`,
      aside: (e) => actionPill(e.action),
    },
    empty: { icon: 'history', title: 'No Records Match', text: 'Change the filters.' },
    onLoaded: ({ meta }) => { count.textContent = `${Number(meta.total).toLocaleString()} ${meta.total === 1 ? 'record' : 'records'}`; },
  });
  rowTooltip(lv.el);
  outlet.replaceChildren(pageHeader({ title: info ? info.title : 'Audit Trail', subtitle: info ? info.subtitle : '' }), panel, lv.el);

  const val = (name) => (filters.querySelector(`[name="${name}"]`) || {}).value || '';

  filters.addEventListener('submit', (e) => { e.preventDefault(); search(); });

  function search() {
    clearFieldErrors(filters);
    const from = parseDisplayDate(val('from'));
    const to = parseDisplayDate(val('to'));
    let bad = false;
    if (from === null) { setFieldError(filters, 'from', 'Use dd/mm/yyyy.'); bad = true; }
    if (to === null) { setFieldError(filters, 'to', 'Use dd/mm/yyyy.'); bad = true; }
    if (!bad && from && to && from > to) { setFieldError(filters, 'to', 'To must be on or after From.'); bad = true; }
    if (bad) return;
    applied = {};
    if (val('action')) applied.action = val('action');
    if (val('table')) applied.table = val('table');
    if (val('user').trim()) applied.user = val('user').trim();
    if (val('record').trim()) applied.record = val('record').trim();
    if (from) applied.from = from;
    if (to) applied.to = to;
    lv.reload({ resetPage: true });
  }

  function reset() {
    clearFieldErrors(filters);
    filters.querySelectorAll('input').forEach((i) => { i.value = ''; });
    recordPick.clear();
    filters.querySelectorAll('select').forEach((s) => { s.value = ''; });
    applied = {};
    lv.reload({ resetPage: true });
  }

  // ---- one entry, with what changed
  async function openEntry(row) {
    let entry;
    try {
      entry = (await api.get(`/api/audit/${row.id}`)).data;
    } catch (err) {
      toast(err.message || 'Could not open the entry.', 'error');
      return;
    }
    const changes = entry.changes || [];
    const value = (v) => (v === null || v === undefined ? h('span', { className: 'text-muted-foreground', text: '-' }) : String(v));
    const list = changes.length
      ? h('div', { className: 'overflow-hidden rounded-card border border-border/70', dataset: { changes: '' } }, [
        h('div', { className: 'grid grid-cols-3 bg-subtle/70 phone:hidden' }, ['Field', 'Before', 'After'].map((t) => h('div', { className: 'px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground', text: t }))),
        ...changes.map((c) => h('div', { className: 'grid grid-cols-3 gap-x-3 border-t border-border/70 first:border-t-0 phone:grid-cols-1 phone:gap-y-1 phone:py-2' }, [
          h('div', { className: 'break-words px-3 py-2 text-sm font-medium phone:py-0', text: c.field }),
          h('div', { className: 'break-words px-3 py-2 text-sm phone:py-0' }, [h('span', { className: 'mr-1 text-2xs font-semibold uppercase text-muted-foreground desk:hidden', text: 'Before ' }), value(c.from)]),
          h('div', { className: 'break-words px-3 py-2 text-sm font-medium phone:py-0' }, [h('span', { className: 'mr-1 text-2xs font-semibold uppercase text-muted-foreground desk:hidden', text: 'After ' }), value(c.to)]),
        ])),
      ])
      : card({ padded: false, body: emptyState({ icon: 'history', title: 'No Field Changes', text: 'This entry records an event, not a change to a record.' }) });
    const body = h('div', { className: 'space-y-4' }, [
      h('div', { className: 'flex flex-wrap items-center gap-2' }, [actionPill(entry.action), h('span', { className: 'text-sm text-muted-foreground', text: stamp(entry.time) })]),
      facts([
        ['Performed By', entry.fullName ? `${entry.username} · ${entry.fullName}` : entry.username],
        ['Table', entry.table],
        ['Record', entry.recordId],
        ['IP Address', entry.ip],
        ['Browser', h('span', { className: cx('break-words text-xs'), text: entry.userAgent || 'N/A' })],
      ]),
      h('h3', { className: 'text-2xs font-semibold uppercase tracking-widest text-muted-foreground', text: 'What Changed' }),
      list,
    ]);
    const dlg = openDialog({ title: 'Audit Entry', size: 'lg', body });
    dlg.setFooter([button({ label: 'Close', variant: 'outline', onClick: () => dlg.close() })]);
  }
}
