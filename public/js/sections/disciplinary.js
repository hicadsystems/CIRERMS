/*
 * Disciplinary Action: the four screens (the page's `view` in core/nav.js).
 *
 *   mountInitiate     find a current rating (Official No or name), a row opens the rating with Open Case
 *   mountPending      the cases waiting for a decision; a row opens the case (Conclude, Cancel Case)
 *   mountConcluded    the cases with a decision; a row opens the case (Correct)
 *   mountReport       the Disciplinary Report: filters, three figures, Print PDF, Export Excel
 *
 * Every list is 25 a page from the server with four key columns; a row opens the full case in a
 * dialog (a sheet on a phone) with a View Details tooltip on desktop. The shared parts
 * (filters, the case dialog and its forms) are in disciplinary-parts.js.
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { navigate } from '../core/router.js';
import { h, cx } from '../ui/html.js';
import { CARD, INPUT } from '../ui/classes.js';
import { button } from '../ui/button.js';
import { pill } from '../ui/pill.js';
import { pageHeader } from '../ui/page-header.js';
import { listView } from '../ui/list-view.js';
import { statTile } from '../ui/stat-tile.js';
import { openDialog } from '../ui/dialog.js';
import { facts } from '../ui/facts.js';
import { emptyState } from '../ui/empty-state.js';
import { icon } from '../core/icons.js';
import { toast } from '../ui/toast.js';
import {
  fmt, choices, filterBar, queryString, caseDialog, openCaseForm, previewPdf, rowTips, loadOptions,
} from './disciplinary-parts.js';

const BASE = '/api/disciplinary';
const two = (a, b) => h('span', {}, [a, b ? h('span', { className: 'block text-xs font-normal text-muted-foreground', text: b }) : null]);
const short = (rate) => String(rate || '').replace(/^.*\(([^)]+)\)$/, '$1') || rate || '';
const nameCell = (c) => two(c.name, `${short(c.rate)} · ${c.caseNumber}`);

function boundNotice(text) {
  return text ? h('div', { className: 'mb-3 flex gap-2 rounded-ctl bg-error-soft px-3 py-2 text-sm text-error', role: 'alert' }, [icon('circle-alert', 'icon mt-0.5 flex-none'), text]) : null;
}

/**
 * A list of cases under a filter bar. `url` is the endpoint; the bar's query string is added.
 * Returns { nodes, reload, total, query }.
 */
function caseList({ url, fields, columns, card, empty, onPick, bar: barOpts = {}, summary }) {
  const bar = filterBar({ fields, onChange: () => { redraw(); lv.reload({ resetPage: true }); } });
  const warn = h('div');
  const count = h('div', { className: 'mb-3 text-sm text-muted-foreground' });
  let total = 0;
  const redraw = () => { warn.replaceChildren(...[boundNotice(bar.bad())].filter(Boolean)); };
  const lv = listView({
    columns,
    load: async ({ page }) => {
      if (bar.bad()) return { data: [], meta: { page: 1, pageSize: 25, total: 0, totalPages: 1 } };
      const res = await api.get(`${url}?${queryString({ ...bar.query(), page })}`);
      if (summary) summary(res);
      return res;
    },
    onPick,
    card,
    empty: bar.bad() ? { icon: 'circle-alert', title: 'Check the Dates', text: 'Fix the dates above to see the cases.' } : empty,
    onLoaded: ({ meta }) => {
      total = meta.total;
      count.textContent = barOpts.count ? barOpts.count(total) : `${total.toLocaleString()} ${total === 1 ? 'case' : 'cases'}`;
      if (barOpts.onTotal) barOpts.onTotal(total);
    },
  });
  rowTips(lv.el);
  return { nodes: [bar.el, warn, count, lv.el], reload: () => lv.reload(), query: () => ({ ...bar.query() }), total: () => total, bar };
}

// ---- 1. Initiate Incident ----------------------------------------------------
export async function mountInitiate(outlet, { info } = {}) {
  const o = await loadOptions(true);
  void o;
  const input = h('input', { type: 'search', name: 'q', placeholder: 'e.g. B0539 or Okonkwo', autocomplete: 'off', className: cx(INPUT, 'desk:w-80'), 'aria-label': 'Official No or Name' });
  const search = button({ label: 'Search', icon: 'search', variant: 'primary', onClick: () => run() });
  const result = h('div');
  const bar = h('div', { className: 'mb-4 flex flex-wrap items-end gap-3 phone:flex-col phone:items-stretch' }, [
    h('label', { className: 'min-w-0' }, [h('span', { className: 'mb-1 block text-xs font-semibold text-muted-foreground', text: 'Official No or Name' }), input]), search,
  ]);
  const empty = (iconName, title, text) => h('div', { className: CARD }, emptyState({ icon: iconName, title, text }));
  result.replaceChildren(empty('gavel', 'Find a Rating', 'Enter an Official Number or a name above. A case can only be opened for a current rating.'));

  function ratingDialog(r) {
    const dlg = openDialog({
      title: r.name, size: 'md',
      body: h('div', {}, [
        r.pendingCases ? h('div', { className: 'mb-4 flex gap-2 rounded-ctl bg-warning-soft px-3 py-2 text-sm text-warning' }, [icon('triangle-alert', 'icon mt-0.5 flex-none'), `${r.name} already has ${r.pendingCases === 1 ? 'a pending case' : `${r.pendingCases} pending cases`}. A new incident opens a separate case.`]) : null,
        facts([['Official No', r.serviceNumber], ['Rate', r.rate], ['Branch', r.branch], ['Current Ship', r.ship], ['Command', r.command], ['Date Enlisted', fmt(r.dateEmployed)], ['Cases on File', String(r.cases)]], { columns: 2, className: 'phone:grid-cols-1' }),
      ]),
    });
    const acts = [button({ label: 'Close', variant: 'outline', onClick: () => dlg.close() })];
    if (can('ratings.edit', 'view')) acts.push(button({ label: 'Open Record', icon: 'id-card', variant: 'outline', onClick: () => { dlg.close(); navigate(`#ratings/edit/${encodeURIComponent(r.serviceNumber)}`); } }));
    acts.push(button({ label: 'Open Case', icon: 'gavel', variant: 'primary', onClick: () => { dlg.close(); openCaseForm(r, { onDone: () => { if (can('disciplinary.pending', 'view')) navigate('#disciplinary/pending'); else run(); } }); } }));
    dlg.setFooter(acts);
  }

  async function run() {
    const q = input.value.trim();
    if (!q) { result.replaceChildren(empty('gavel', 'Find a Rating', 'Enter an Official Number or a name above. A case can only be opened for a current rating.')); return; }
    const first = await api.get(`${BASE}/ratings?${queryString({ q, page: 1 })}`).catch((err) => { toast(err.message, 'error'); return null; });
    if (!first) return;
    if (!first.data.length) {
      const left = first.meta.former;
      result.replaceChildren(empty('circle-alert', 'No Current Rating Found', left ? `${left} matching ${left === 1 ? 'rating has' : 'ratings have'} left the service. A case can only be opened for a current rating.` : 'Check the Official Number or the spelling, then search again.'));
      return;
    }
    const lv = listView({
      columns: [
        { key: 'serviceNumber', label: 'Official No' },
        { key: 'name', label: 'Name', render: (r) => two(r.name, short(r.rate)) },
        { key: 'ship', label: 'Current Ship' },
        { key: 'pendingCases', label: 'Cases', render: (r) => (r.pendingCases ? pill('Pending case', 'warning') : '-') },
      ],
      load: ({ page }) => (page === 1 ? Promise.resolve(first) : api.get(`${BASE}/ratings?${queryString({ q, page })}`)),
      onPick: ratingDialog,
      card: { title: (r) => r.name, subtitle: (r) => `${r.serviceNumber} · ${r.ship || ''}`, aside: (r) => (r.pendingCases ? pill('Pending case', 'warning') : null) },
    });
    rowTips(lv.el);
    result.replaceChildren(
      h('div', { className: 'mb-3 text-sm text-muted-foreground', dataset: { found: '' } }, [h('b', { className: 'text-foreground', text: String(first.meta.total) }), ` current ${first.meta.total === 1 ? 'rating' : 'ratings'} found. Choose one to open a case.`]),
      lv.el,
    );
  }
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
  outlet.replaceChildren(pageHeader({ title: info ? info.title : 'Initiate Incident', subtitle: 'Open a disciplinary case against a current rating' }), bar, result);
  input.focus();
}

// ---- 2. Pending Cases ----------------------------------------------------------
export async function mountPending(outlet, { info } = {}) {
  const o = await loadOptions(true);
  const print = button({ label: 'Print List', icon: 'printer', variant: 'blue', disabled: true, onClick: () => previewPdf(`${BASE}/cases/pending/pdf?${queryString(list.query())}`, 'Pending Disciplinary Cases', 'Pending Disciplinary Cases.pdf') });
  const list = caseList({
    url: `${BASE}/cases/pending`,
    fields: [
      { name: 'q', label: 'Official No or Name', type: 'text', placeholder: 'e.g. B0539 or Okonkwo', span: 'col-span-2 phone:col-span-1' },
      { name: 'offenceId', label: 'Offence', type: 'select', options: choices(o.offences), placeholder: 'All Offences', span: 'col-span-2 phone:col-span-1' },
    ],
    columns: [
      { key: 'serviceNumber', label: 'Official No' },
      { key: 'name', label: 'Name', render: nameCell },
      { key: 'offence', label: 'Offence', className: 'whitespace-normal' },
      { key: 'incidentDate', label: 'Incident', render: (c) => fmt(c.incidentDate) },
    ],
    card: { title: (c) => c.name, subtitle: (c) => `${c.serviceNumber} · ${c.caseNumber}`, aside: () => pill('Pending', 'warning') },
    empty: { icon: 'gavel', title: 'No Pending Cases', text: 'Every case has a decision, or none matches these filters.' },
    onPick: (c) => caseDialog(c, { onChange: () => list.reload() }),
    bar: { count: (n) => `${n.toLocaleString()} ${n === 1 ? 'case is' : 'cases are'} waiting for a decision`, onTotal: (n) => { print.disabled = !n; } },
  });
  outlet.replaceChildren(pageHeader({ title: info ? info.title : 'Pending Cases', subtitle: 'Incidents waiting for a decision', actions: [print] }), ...list.nodes);
}

// ---- 3. Concluded Cases ---------------------------------------------------------
const decidedColumns = [
  { key: 'serviceNumber', label: 'Official No' },
  { key: 'name', label: 'Name', render: nameCell },
  { key: 'offence', label: 'Offence', className: 'whitespace-normal', render: (c) => two(c.offence, c.sanction) },
  { key: 'decisionDate', label: 'Decided', render: (c) => fmt(c.decisionDate) },
];
const decidedCard = { title: (c) => c.name, subtitle: (c) => `${c.serviceNumber} · ${c.caseNumber}`, aside: (c) => pill(fmt(c.decisionDate), 'success') };
const dateFields = [
  { name: 'from', label: 'Decided From', type: 'date' },
  { name: 'to', label: 'Decided To', type: 'date' },
];

export async function mountConcluded(outlet, { info } = {}) {
  const o = await loadOptions(true);
  const list = caseList({
    url: `${BASE}/cases/concluded`,
    fields: [
      { name: 'q', label: 'Official No or Name', type: 'text', placeholder: 'e.g. B0539 or Okonkwo', span: 'col-span-2 phone:col-span-1' },
      { name: 'offenceId', label: 'Offence', type: 'select', options: choices(o.offences), placeholder: 'All Offences' },
      { name: 'sanctionId', label: 'Sanction', type: 'select', options: choices(o.sanctions), placeholder: 'All Sanctions' },
      ...dateFields,
    ],
    columns: decidedColumns,
    card: decidedCard,
    empty: { icon: 'gavel', title: 'No Concluded Cases', text: 'No case matches these filters.' },
    onPick: (c) => caseDialog(c, { onChange: () => list.reload() }),
    bar: { count: (n) => `${n.toLocaleString()} concluded ${n === 1 ? 'case' : 'cases'}` },
  });
  outlet.replaceChildren(pageHeader({ title: info ? info.title : 'Concluded Cases', subtitle: 'Cases with a decision; a mistake is changed with Correct' }), ...list.nodes);
}

// ---- 4. Disciplinary Report ------------------------------------------------------
export async function mountReport(outlet, { info } = {}) {
  const o = await loadOptions(true);
  const tiles = { cases: statTile({ label: 'Cases', value: '-', icon: 'gavel', tone: 'brand' }), offence: statTile({ label: 'Most Common Offence', value: '-', icon: 'triangle-alert', tone: 'destructive' }), sanction: statTile({ label: 'Most Common Sanction', value: '-', icon: 'check', tone: 'primary' }) };
  [tiles.offence, tiles.sanction].forEach((t) => t.querySelector('.text-3xl').classList.replace('text-3xl', 'text-lg'));
  const figures = h('div', { className: 'mb-3 grid grid-cols-3 gap-3 phone:grid-cols-1', dataset: { figures: '' } }, Object.values(tiles));
  const pdf = button({ label: 'Print PDF', icon: 'printer', variant: 'blue', disabled: true, onClick: () => previewPdf(`${BASE}/report/pdf?${queryString(list.query())}`, 'Disciplinary Report', 'Disciplinary Report.pdf') });
  const xl = button({ label: 'Export Excel', icon: 'file-spreadsheet', variant: 'outline', disabled: true, onClick: async () => {
    try { await api.downloadFile(`${BASE}/report/excel?${queryString(list.query())}`, 'Disciplinary Report.xlsx'); } catch (err) { toast(err.message || 'Could not export.', 'error'); }
  } });
  const list = caseList({
    url: `${BASE}/report`,
    fields: [
      { name: 'from', label: 'Decided From', type: 'date' }, { name: 'to', label: 'Decided To', type: 'date' },
      { name: 'offenceId', label: 'Offence', type: 'select', options: choices(o.offences), placeholder: 'All Offences' },
      { name: 'sanctionId', label: 'Sanction', type: 'select', options: choices(o.sanctions), placeholder: 'All Sanctions' },
      { name: 'shipId', label: 'Ship', type: 'select', options: choices(o.ships), placeholder: 'All Ships' },
      { name: 'rateId', label: 'Rate', type: 'select', options: choices(o.rates), placeholder: 'All Rates' },
    ],
    columns: decidedColumns,
    card: decidedCard,
    empty: { icon: 'file-text', title: 'No Cases in This Report', text: 'No concluded case matches these filters. Widen the dates or the offence.' },
    onPick: (c) => caseDialog(c, { readOnly: true }),
    summary: (res) => {
      const s = res.summary || {};
      tiles.cases.setValue(s.cases ?? 0);
      tiles.offence.setValue(s.topOffence || '-');
      tiles.sanction.setValue(s.topSanction || '-');
    },
    bar: { count: (n) => `${n.toLocaleString()} ${n === 1 ? 'case' : 'cases'} in this report`, onTotal: (n) => { pdf.disabled = !n; xl.disabled = !n; } },
  });
  outlet.replaceChildren(
    pageHeader({ title: info ? info.title : 'Disciplinary Report', subtitle: 'Concluded cases by period, offence, sanction, ship and rate', actions: [pdf, xl] }),
    list.nodes[0], list.nodes[1], figures, list.nodes[2], list.nodes[3],
  );
}
