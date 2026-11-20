/*
 * Advancement Processing: the seven screens (the page's `view` in core/nav.js).
 *
 *   mountDue        Rates due for Advancement: who is due (reads only), Create Advancement Batch in a confirming dialog
 *   mountReview     Advancement Review: an open batch's ratings; Set New Rate (the next rate only), Not Recommended,
 *                   Remove, Add Personnel, Print Form (the Advancement Form), Export Excel, Clear Batch
 *   mountApproval   Approval: one row per department with the totals by new rate; its list and Approve Department
 *   mountClose      Close: the open batches with their readiness; Close one batch (final)
 *   mountBoard      Board Returns Update: closed batches; Set Date per rating or for the batch (the new rate applies,
 *                   or is scheduled for a later date)
 *   mountPromoted   Report on Promoted Rates: the batches with total and promoted, Print Batch Summary, Export Excel;
 *                   mountPromotedBatch: a batch's ratings, Print Advancement Report
 *   mountUpload     Upload Advanced Rates: Download Template, Choose File (every row checked), Review and Import
 *
 * Lists are 25 a page from the server with about four key columns; a row opens its full record in a dialog
 * (a sheet on a phone) holding the row's actions. The rules are the server's; its messages land under the
 * fields. The parts shared with Drafting come from drafting-parts.js.
 */
import { downloadFile } from '../core/api.js';
import { pageHeader } from '../ui/page-header.js';
import { confirmDialog } from '../ui/confirm.js';
import { emptyState } from '../ui/empty-state.js';
import { facts } from '../ui/facts.js';
import { LABEL } from '../ui/classes.js';
import { filterBar } from './disciplinary-parts.js';
import { ratingSearch } from '../ui/rating-search.js';
import {
  fmt, plural, qs, monthsPill, batchStatusPill, two, notice, ratingStrip, statStrip, dateInput, val, isoOf, choicesOf,
  formDialog, detailsDialog, list, previewPdf, batchSelect, batchFacts, emptyCard, field, textInput, selectInput, button, pill,
  h, cx, icon, toast, api, can, navigate, CARD,
} from './drafting-parts.js';

const BASE = '/api/advancement';
const download = (url, name) => downloadFile(url, name).catch((err) => toast(err.message || 'Could not make the file.', 'error'));
const header = (info, fallback, actions) => pageHeader({ title: info ? info.title : fallback, subtitle: info ? info.subtitle : '', actions });
const loading = () => h('div', { className: cx(CARD, 'flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground') }, [icon('loader-circle', 'icon animate-spin'), 'Loading']);
const failed = (err) => emptyCard(emptyState({ icon: 'circle-alert', title: 'Could Not Load the Page', text: (err && err.message) || '' }));
const deptLabel = (o) => (o.department ? o.department.name : '');
const rateText = (b) => (b.rate === 'All' ? 'All rates' : b.rate);
const branchText = (b) => (b.branch === 'All' ? 'All branches' : b.branch);

/** "AB OGUNLEYE Tobi James" */
const fullName = (r) => [r.rateCode, r.name].filter(Boolean).join(' ');
const struckName = (r) => h('s', { className: 'text-muted-foreground', text: fullName(r) });
const years = (n) => (n === null || n === undefined ? '' : String(n));

let optionCache = null;
async function loadOptions(force = false) {
  if (!optionCache || force) optionCache = (await api.get(`${BASE}/options`)).data;
  return optionCache;
}
const rateChoices = (o, { top = true } = {}) => o.rates.filter((r) => top || !r.top).map((r) => ({ value: r.id, label: r.name }));

const openRecordButton = (sn) => (can('ratings.edit', 'view')
  ? button({ label: 'Open Record', icon: 'id-card', variant: 'outline', onClick: () => navigate(`#ratings/edit/${encodeURIComponent(sn)}?tab=advancement`) })
  : null);

const casesNotice = (r) => (r.pendingCases
  ? notice('info', 'info', [h('b', { text: plural(r.pendingCases, 'pending disciplinary case') }), '. Shown for information: it does not change who is due.'])
  : null);

const ROW_STATUS = {
  proposed: ['Proposed', 'neutral'], not_recommended: ['Not Recommended', 'error'], awaiting_board: ['Pending', 'warning'],
  scheduled: ['Scheduled', 'info'], advanced: ['Advanced', 'success'],
};
const rowStatusPill = (x) => pill(...(ROW_STATUS[x.status] || [x.status, 'neutral']));

/** The new rate as a list cell: the rate, Not Recommended with the reason, or Not set. */
function newRateCell(x) {
  if (x.notRecommended) return h('span', { className: 'block' }, [pill('Not Recommended', 'error'), h('span', { className: 'block truncate text-xs text-muted-foreground', text: x.notRecommended.reason })]);
  if (!x.newRateCode) return pill('Not set', 'warning');
  return h('b', { className: 'font-medium', text: x.newRateCode });
}

/** When the new rate took effect: the date, Scheduled for a date to come, or Pending. */
function advancedCell(x, { pending = 'Pending' } = {}) {
  if (x.notRecommended) return '-';
  if (x.status === 'advanced') return h('span', { className: 'block' }, [fmt(x.boardDate), ' ', pill('Advanced', 'success')]);
  if (x.status === 'scheduled') return h('span', { className: 'block' }, [pill(pending === 'Pending' ? 'Pending' : 'Scheduled', pending === 'Pending' ? 'warning' : 'info'), h('span', { className: 'block text-xs text-muted-foreground', text: `from ${fmt(x.boardDate)}` })]);
  return pill('Pending', 'warning');
}

// =====================================================================================================
// 1. Rates due for Advancement
// =====================================================================================================
export async function mountDue(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(true); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const dept = o.department;
  const fields = [
    { name: 'branchId', label: 'Branch', type: 'select', options: choicesOf(o.branches), placeholder: 'All Branches' },
    dept ? null : { name: 'specialisationId', label: 'Specialisation', type: 'select', options: choicesOf(o.specialisations), placeholder: 'All Specialisations', span: 'col-span-2 phone:col-span-1' },
    { name: 'rateId', label: 'Current Rate', type: 'select', options: rateChoices(o, { top: false }), placeholder: 'All Rates' },
  ].filter(Boolean);
  const bar = filterBar({ fields, onChange: () => lv.reload({ resetPage: true }) });
  const count = h('div', { className: 'mb-3 text-sm text-muted-foreground', dataset: { dueCount: '' } });
  const create = can('advancement.due', 'add') ? button({ label: 'Create Advancement Batch', icon: 'plus', variant: 'primary', disabled: true, onClick: () => createDialog() }) : null;
  const lv = list({
    columns: [
      { key: 'serviceNumber', label: 'Official No', render: (r) => r.serviceNumber },
      { key: 'name', label: 'Name', render: (r) => two(fullName(r), [r.specialisation, r.inBatch ? `in ${r.inBatch}` : ''].filter(Boolean).join(' · ')) },
      { key: 'rate', label: 'Current Rate', render: (r) => r.rateCode },
      { key: 'months', label: 'Months in Rate', render: (r) => monthsPill(r) },
    ],
    load: async ({ page }) => {
      const res = await api.get(`${BASE}/due?${qs({ ...bar.query(), page })}`);
      const s = res.summary;
      count.replaceChildren(h('b', { className: 'text-foreground', text: String(s.due) }), ` ${s.due === 1 ? 'rating is' : 'ratings are'} due`, s.inBatch ? `, ${s.inBatch} already in an open batch` : '');
      if (create) create.disabled = s.toAdd === 0;
      return res;
    },
    onPick: (r) => dueRecord(r),
    rowKey: (r) => r.serviceNumber,
    card: { title: (r) => fullName(r), subtitle: (r) => `${r.serviceNumber} · ${r.rateCode} since ${fmt(r.rateSince)}${r.inBatch ? ` · in ${r.inBatch}` : ''}`, aside: (r) => monthsPill(r) },
    empty: { icon: 'users', title: 'Nobody Is Due', text: 'No rating matches these filters. Widen the branch, specialisation or rate.' },
  });

  function dueRecord(r) {
    const dlg = detailsDialog({
      title: fullName(r),
      panels: [
        { title: 'Rating', rows: [['Official No', r.serviceNumber], ['Name', r.name], ['Sex', r.sex], ['Branch', r.branch], ['Department', r.specialisation], ['Age (yrs)', years(r.age)], ['LOS (yrs)', years(r.los)]] },
        { title: 'Rate', rows: [['Current Rate', r.rate], ['In Rate Since', fmt(r.rateSince)], ['Months in Rate', monthsPill(r)], ['Batch', r.inBatch]] },
      ],
      after: casesNotice(r),
      actions: [
        r.inBatch && can('advancement.review', 'view') ? button({ label: 'Go to Review', icon: 'list', variant: 'outline', onClick: () => { dlg.close(); navigate(`#advancement/review?batch=${r.inBatchId}`); } }) : null,
        openRecordButton(r.serviceNumber),
      ],
    });
  }

  async function createDialog() {
    let p;
    try { p = (await api.get(`${BASE}/batches/preview?${qs(bar.query())}`)).data; } catch (err) { toast(err.message, 'error'); return; }
    if (!p.toAdd) {
      detailsDialog({
        title: 'Create Advancement Batch', size: 'sm', panels: [],
        before: notice('warning', 'circle-alert', 'Everyone on this list is already in a batch. Review that batch, or change the filters.'),
        actions: [can('advancement.review', 'view') ? button({ label: 'Go to Review', icon: 'list', variant: 'primary', href: '#advancement/review' }) : null],
      });
      return;
    }
    formDialog({
      title: p.existing ? 'Add to Advancement Batch' : 'Create Advancement Batch',
      submitLabel: p.existing ? 'Add to Batch' : 'Create Batch', submitIcon: 'plus',
      children: [
        facts([['Batch Number', h('b', { text: p.batchNumber, dataset: { batchNumber: '' } })], ['Branch', p.labels.branch], ['Specialisation', dept ? deptLabel(o) : p.labels.specialisation], ['Current Rate', p.labels.rate], ['Ratings to Add', h('b', { text: String(p.toAdd) })]]),
        p.existing ? notice('info', 'info', `An open batch for these filters already exists. The ${plural(p.toAdd, 'rating')} not yet in it ${p.toAdd === 1 ? 'is' : 'are'} added to it.`) : null,
        p.leftOut ? notice('warning', 'circle-alert', `${p.leftOut} already in another batch ${p.leftOut === 1 ? 'is' : 'are'} left out.`) : null,
      ].filter(Boolean),
      save: () => api.post(`${BASE}/batches`, bar.query()),
      done: (d) => { toast(`${d.created ? 'Created' : 'Added to'} batch ${d.batch.batchNumber}: ${plural(d.added, 'rating')}.`); navigate(`#advancement/review?batch=${d.batch.id}`); },
    });
  }

  outlet.replaceChildren(...[
    header(info, 'Rates due for Advancement', create ? [create] : []),
    dept ? h('div', { className: 'mb-3' }, notice('info', 'info', ['You propose for your department: ', h('b', { text: deptLabel(o) }), '.'])) : null,
    bar.el, count, lv.el,
  ].filter(Boolean));
}

// =====================================================================================================
// 2. Advancement Review
// =====================================================================================================
let reviewPick = null;

export async function mountReview(outlet, { info, query = {} } = {}) {
  outlet.replaceChildren(loading());
  let batches;
  try {
    [, batches] = await Promise.all([loadOptions(true), api.get(`${BASE}/batches?stage=open`).then((r) => r.data)]);
  } catch (err) { outlet.replaceChildren(failed(err)); return; }
  if (query.batch) reviewPick = Number(query.batch);
  if (!batches.some((b) => b.id === reviewPick)) reviewPick = batches.length ? batches[0].id : null;

  const headSlot = h('div');
  const body = h('div');
  const labelOf = (b) => [b.batchNumber, branchText(b), b.rate === 'All' ? '' : b.rate].filter(Boolean).join(' · ');
  const picker = batches.length ? h('div', { className: 'mb-4 flex flex-wrap items-end gap-3' }, batchSelect({ batches, value: reviewPick, labelOf, onChange: (id) => { reviewPick = id; draw(); } })) : null;

  async function draw() {
    if (!batches.length) {
      headSlot.replaceChildren(header(info, 'Advancement Review', []));
      body.replaceChildren(emptyCard(emptyState({ icon: 'trending-up', title: 'No Open Advancement Batch', text: 'Make a batch from the ratings who are due, then review it here.', action: can('advancement.due', 'view') ? button({ label: 'Rates due for Advancement', icon: 'plus', variant: 'primary', href: '#advancement/due' }) : null })));
      return;
    }
    if (!reviewPick) {
      headSlot.replaceChildren(header(info, 'Advancement Review', []));
      body.replaceChildren(emptyCard(emptyState({ icon: 'list', title: 'Choose a Batch', text: 'Pick an open batch to review its ratings.' })));
      return;
    }
    body.replaceChildren(loading());
    let b;
    try { b = (await api.get(`${BASE}/batches/${reviewPick}`)).data; } catch (err) { body.replaceChildren(failed(err)); return; }
    const r = b.readiness;
    const actions = [
      can('advancement.review', 'add') ? button({ label: 'Add Personnel', icon: 'user-plus', variant: 'primary', onClick: () => addPersonnel(b) }) : null,
      button({ label: 'Print Form', icon: 'printer', variant: 'blue', onClick: () => previewPdf(`${BASE}/batches/${b.id}/form.pdf`, `Advancement Form ${b.batchNumber}`, `Advancement Form ${b.batchNumber}.pdf`) }),
      button({ label: 'Export Excel', icon: 'file-spreadsheet', variant: 'outline', onClick: () => download(`${BASE}/batches/${b.id}/excel`, `Advancement ${b.batchNumber}.xlsx`) }),
      can('advancement.review', 'delete') ? button({ label: 'Clear Batch', icon: 'trash-2', variant: 'outline', className: 'text-destructive', onClick: () => clearBatch(b) }) : null,
    ].filter(Boolean);
    headSlot.replaceChildren(header(info, 'Advancement Review', actions));
    const pct = r.live ? Math.round((r.withTarget / r.live) * 100) : 0;
    const fillBar = h('div', { className: 'cirerms-progress-bar', dataset: { level: r.live && r.withTarget === r.live ? 'high' : r.withTarget ? 'mid' : 'low' } });
    fillBar.style.width = `${pct}%`;
    const progress = h('div', { className: cx(CARD, 'mb-4 flex items-center gap-3 px-4 py-3') }, [
      h('div', { className: 'cirerms-progress-track flex-1' }, fillBar),
      h('span', { className: 'whitespace-nowrap text-xs text-muted-foreground', dataset: { progress: '' } }, [h('b', { className: 'text-foreground', text: String(r.withTarget) }), ` of ${r.live} have a new rate`]),
    ]);
    const lv = list({
      columns: [
        { key: 'serviceNumber', label: 'Official No', render: (x) => x.serviceNumber },
        { key: 'name', label: 'Name', render: (x) => two(x.notRecommended ? struckName(x) : fullName(x), `${x.rateCode} since ${fmt(x.rateSince)}`) },
        { key: 'months', label: 'Months in Rate', render: (x) => monthsPill(x) },
        { key: 'newRate', label: 'New Rate', render: (x) => newRateCell(x) },
      ],
      load: ({ page }) => api.get(`${BASE}/batches/${b.id}/rows?page=${page}`),
      onPick: (x) => rowRecord(b, x),
      card: {
        title: (x) => (x.notRecommended ? struckName(x) : fullName(x)),
        subtitle: (x) => `${x.serviceNumber} · ${x.notRecommended ? x.notRecommended.reason : x.newRateCode ? `to ${x.newRateCode}` : `${x.rateCode} since ${fmt(x.rateSince)}`}`,
        aside: (x) => (x.notRecommended ? pill('Not Recommended', 'error') : x.newRateCode ? monthsPill(x) : pill('Not set', 'warning')),
      },
      empty: { icon: 'users', title: 'This Batch Is Empty', text: 'Add personnel, or make a new batch from the due list.' },
    });
    body.replaceChildren(batchFacts(b, [['New Rates', `${r.withTarget} of ${r.live}`], ['Not Recommended', String(b.notRecommended)]]), progress, lv.el);
  }

  function rowRecord(b, x) {
    const dlg = detailsDialog({
      title: fullName(x),
      before: x.notRecommended ? notice('error', 'triangle-alert', ['Not recommended: ', h('b', { text: x.notRecommended.reason }), x.notRecommended.by ? ` (${x.notRecommended.by}, ${fmt(x.notRecommended.at)})` : '']) : null,
      panels: [
        { title: 'Rating', rows: [['Official No', x.serviceNumber], ['Name', x.name], ['Sex', x.sex], ['Department', x.specialisation], ['Age (yrs)', years(x.age)], ['LOS (yrs)', years(x.los)]] },
        { title: 'Advancement', rows: [
          ['Current Rate', x.rate], ['In Rate Since', fmt(x.rateSince)], ['Months in Rate', monthsPill(x)],
          ['New Rate', x.notRecommended ? pill('Not Recommended', 'error') : x.newRate || pill('Not set', 'warning')],
          ['Remarks', x.remark],
          ['Approval', x.approval ? `${x.approval.rank} ${x.approval.name}, ${fmt(x.approval.approvedAt)}` : ''],
        ] },
      ],
      after: h('div', { className: 'space-y-2' }, [
        x.rateChanged ? notice('warning', 'triangle-alert', `${x.name} is now ${x.nowRateCode}, no longer ${x.rateCode}. Remove the row and add the rating again.`) : null,
        casesNotice(x),
      ]),
      actions: [
        openRecordButton(x.serviceNumber),
        can('advancement.review', 'delete') ? button({ label: 'Remove', icon: 'trash-2', variant: 'outline', className: 'text-destructive', onClick: () => removeRow(b, x, dlg) }) : null,
        !x.notRecommended && can('advancement.review', 'edit') ? button({ label: 'Not Recommended', icon: 'triangle-alert', variant: 'outline', className: 'text-destructive', onClick: () => { dlg.close(); notRecommended(b, x); } }) : null,
        !x.notRecommended && can('advancement.review', 'edit') ? button({ label: 'Set New Rate', icon: 'pencil', variant: 'primary', onClick: () => { dlg.close(); setNewRate(b, x); } }) : null,
      ],
    });
  }

  function setNewRate(b, x) {
    const top = !x.nextRateId;
    formDialog({
      title: 'New Rate', submitLabel: 'Set New Rate', submitIcon: 'check', disabled: top || x.rateChanged,
      children: [
        ratingStrip(fullName(x), `${x.serviceNumber} · ${x.rate} since ${fmt(x.rateSince)}`, monthsPill(x)),
        h('div', { className: 'rounded-card border border-border bg-subtle/60 px-4 py-3', dataset: { nextRate: '' } }, [
          h('span', { className: LABEL, text: 'New Rate' }),
          h('b', { className: 'text-sm', text: top ? 'None: the top rate' : x.nextRate }),
          h('span', { className: 'mt-1 block text-xs text-muted-foreground', text: 'A rating advances one rate at a time. It takes effect on the board date entered in Board Returns Update.' }),
        ]),
        field({ label: 'Remarks', optional: true, control: textInput({ name: 'remark', value: x.remark, maxlength: '250' }) }),
      ],
      save: (form) => api.put(`${BASE}/batches/${b.id}/rows/${x.id}`, { remark: val(form, 'remark') }),
      done: (d) => { toast(d.reapprove ? `New rate ${d.row.newRateCode} set. The department must approve again.` : `New rate ${d.row.newRateCode} set.`); draw(); },
    });
  }

  function notRecommended(b, x) {
    formDialog({
      title: 'Not Recommended', submitLabel: 'Not Recommended', submitIcon: 'triangle-alert', tone: 'danger',
      children: [
        ratingStrip(fullName(x), `${x.serviceNumber} · ${b.batchNumber}`),
        field({ label: 'Reason', control: textInput({ name: 'reason', placeholder: 'Why the rating is not recommended', maxlength: '250' }) }),
        notice('info', 'info', 'The rating is taken out of the batch and shown struck out with this reason, on the Advancement Form too. It returns to the due list next time.'),
      ],
      save: (form) => api.post(`${BASE}/batches/${b.id}/rows/${x.id}/not-recommended`, { reason: val(form, 'reason') }),
      done: () => { toast(`${fullName(x)} is not recommended.`); draw(); },
    });
  }

  async function removeRow(b, x, dlg) {
    const ok = await confirmDialog({ title: 'Remove from Batch', message: `Remove ${fullName(x)} from ${b.batchNumber}? They stay on their rate and can be proposed again later.`, confirmLabel: 'Remove Rating', danger: true });
    if (!ok) return;
    try {
      await api.del(`${BASE}/batches/${b.id}/rows/${x.id}`);
      dlg.close();
      toast('Removed from the batch.');
      draw();
    } catch (err) { toast(err.message || 'Could not remove.', 'error'); }
  }

  async function clearBatch(b) {
    const ok = await confirmDialog({ title: 'Clear Batch', message: `Remove every rating from ${b.batchNumber}? The batch stays open and empty, and every new rate is lost.`, confirmLabel: 'Clear Batch', danger: true });
    if (!ok) return;
    try {
      const res = await api.del(`${BASE}/batches/${b.id}/rows`);
      toast(`Batch cleared: ${plural(res.data.removed, 'rating')} removed.`);
      draw();
    } catch (err) { toast(err.message || 'Could not clear the batch.', 'error'); }
  }

  function addPersonnel(b) {
    const pick = ratingSearch({ name: 'serviceNumber', status: 'current', ariaLabel: 'Rating', placeholder: 'Official number or name' });
    formDialog({
      title: 'Add Personnel', submitLabel: 'Add to Batch', submitIcon: 'user-plus',
      children: [
        field({ label: 'Rating', control: pick, hint: 'Any current rating below the top rate, due or not. A rating already in a batch cannot be added.' }),
      ],
      save: () => api.post(`${BASE}/batches/${b.id}/rows`, { serviceNumber: pick.value }),
      done: (d) => { toast(`${fullName(d.row)} added to ${b.batchNumber}.`); draw(); },
    });
  }

  outlet.replaceChildren(headSlot, picker || h('div'), body);
  draw();
}

// =====================================================================================================
// 3. Approval
// =====================================================================================================
export async function mountApproval(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(true); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const stats = h('div');
  const statusPill = (d) => (d.status === 'approved' ? pill('Approved', 'success') : pill('Waiting', 'warning'));
  const lv = list({
    columns: [
      { key: 'department', label: 'Department', render: (d) => h('b', { className: 'font-medium text-foreground', text: d.department }) },
      { key: 'total', label: 'Total', render: (d) => h('b', { text: String(d.total) }), className: 'text-center', headClassName: 'text-center' },
      { key: 'status', label: 'Status', render: (d) => statusPill(d) },
      { key: 'approval', label: 'Approved By', render: (d) => (d.approval ? two(`${d.approval.rank} ${d.approval.name}`, fmt(d.approval.approvedAt)) : '-') },
    ],
    load: async () => {
      const res = await api.get(`${BASE}/approvals`);
      const s = res.summary;
      stats.replaceChildren(s.departments ? statStrip([['Departments', s.departments], ['Approved', s.approved, 'primary'], ['Waiting', s.waiting, s.waiting ? 'warning' : '']]) : '');
      return { data: res.data, meta: { page: 1, pageSize: 25, total: res.data.length, totalPages: 1 } };
    },
    rowKey: (d) => d.specialisationId,
    onPick: (d) => deptDialog(d),
    card: { title: (d) => d.department, subtitle: (d) => (d.approval ? `${plural(d.total, 'rating')} · ${d.approval.rank} ${d.approval.name}` : `${plural(d.total, 'rating')} · tap to review and approve`), aside: (d) => statusPill(d) },
    empty: { icon: 'shield-check', title: 'No Advancement Waiting', text: 'There are no open batches. Make one from the due list first.' },
  });

  function rateGroups(d) {
    return h('div', { className: 'grid grid-cols-4 gap-2', dataset: { rateGroups: '' } }, d.rateGroups.map((g) => h('div', { className: cx('rounded-ctl border border-border px-2 py-1.5 text-center', g.count ? 'bg-subtle/60' : 'opacity-60') }, [
      h('div', { className: 'text-2xs font-semibold text-muted-foreground', text: g.code }),
      h('div', { className: 'text-sm font-semibold', text: String(g.count) }),
    ])));
  }

  async function deptDialog(d) {
    const rowsBox = h('div', { className: 'space-y-2' }, h('div', { className: 'py-4 text-center text-sm text-muted-foreground', text: 'Loading' }));
    const dlg = detailsDialog({
      title: `Advancement for ${d.department}`, size: 'xl',
      panels: [],
      before: h('div', { className: 'space-y-3' }, [
        facts([['Department', d.department], ['Total', h('b', { text: String(d.total) })], ['Status', statusPill(d)]]),
        h('div', {}, [h('div', { className: 'mb-1.5 text-sm font-semibold text-brand', text: 'By New Rate' }), rateGroups(d)]),
        d.approval ? notice('success', 'circle-check', ['Approved by ', h('b', { text: `${d.approval.rank} ${d.approval.name}` }), `, ${d.approval.appointment}, on ${fmt(d.approval.approvedAt)}.`, d.waiting ? ` ${plural(d.waiting, 'rating was', 'ratings were')} added or changed since.` : '']) : null,
        d.missing ? notice('warning', 'circle-alert', `${plural(d.missing, 'rating has', 'ratings have')} no new rate. Finish the review before approving.`) : null,
        h('div', { className: 'text-sm font-semibold text-brand', text: 'Ratings' }),
        rowsBox,
      ]),
      actions: [
        button({ label: 'Export Excel', icon: 'file-spreadsheet', variant: 'outline', onClick: () => download(`${BASE}/approvals/excel?specialisationId=${d.specialisationId}`, `Advancement ${d.department}.xlsx`) }),
        can('advancement.approval', 'approve') ? button({ label: d.approval ? 'Approve Again' : 'Approve Department', icon: 'shield-check', variant: 'primary', onClick: () => approveForm(d, dlg) }) : null,
      ],
    });
    try {
      const res = await api.get(`${BASE}/approvals/${d.specialisationId}/rows`);
      rowsBox.replaceChildren(...res.data.map((x) => h('div', { className: 'flex items-center gap-3 rounded-card border border-border px-3 py-2', dataset: { deptRow: x.serviceNumber } }, [
        h('div', { className: 'min-w-0 flex-1' }, [
          h('b', { className: 'block truncate text-sm', text: fullName(x) }),
          h('span', { className: 'block truncate text-xs text-muted-foreground', text: `${x.serviceNumber} · ${x.rateCode} to ${x.newRateCode || '?'} · ${x.batchNumber}` }),
        ]),
        x.newRateCode ? (x.approval ? pill('Approved', 'success') : pill('Waiting', 'warning')) : pill('Not set', 'warning'),
      ])), ...(res.meta.total > res.data.length ? [h('p', { className: 'text-xs text-muted-foreground', text: `The first ${res.data.length} of ${res.meta.total}; Export Excel has them all.` })] : []));
    } catch (err) { rowsBox.replaceChildren(notice('error', 'circle-alert', err.message || 'Could not load the ratings.')); }
  }

  function approveForm(d, parent) {
    formDialog({
      title: `Approve ${d.department}`, submitLabel: 'Approve', submitIcon: 'shield-check', disabled: d.missing > 0,
      children: [
        d.missing ? notice('error', 'circle-alert', `${plural(d.missing, 'rating has', 'ratings have')} no new rate. Finish the review first.`) : null,
        d.approval ? notice('warning', 'triangle-alert', `Already approved by ${d.approval.rank} ${d.approval.name} on ${fmt(d.approval.approvedAt)}. Approving again replaces that.`) : null,
        field({ label: 'Approving Rank', control: selectInput({ name: 'rank', options: o.ranks, value: d.approval ? d.approval.rank : '', placeholder: '-- Select Rank --' }) }),
        field({ label: 'Name', control: textInput({ name: 'name', value: d.approval ? d.approval.name : '', placeholder: 'Name of the approving officer', maxlength: '150' }) }),
        field({ label: 'Appointment', control: textInput({ name: 'appointment', value: d.approval ? d.approval.appointment : '', placeholder: 'e.g. Director of Personnel (Navy)', maxlength: '150' }) }),
      ].filter(Boolean),
      save: (form) => api.post(`${BASE}/approvals/${d.specialisationId}`, { rank: val(form, 'rank'), name: val(form, 'name'), appointment: val(form, 'appointment') }),
      done: (r) => { parent.close(); toast(`${d.department} approved by ${r.approval.rank} ${r.approval.name}: ${plural(r.ratings, 'rating')}.`); lv.reload(); },
    });
  }

  const actions = [button({ label: 'Export Excel All Departments', icon: 'file-spreadsheet', variant: 'outline', onClick: () => download(`${BASE}/approvals/excel`, 'Advancement All Departments.xlsx') })];
  outlet.replaceChildren(...[
    header(info, 'Approval', actions),
    o.department ? h('div', { className: 'mb-3' }, notice('info', 'info', ['You see your department only: ', h('b', { text: deptLabel(o) }), '.'])) : null,
    stats, lv.el,
  ].filter(Boolean));
}

// =====================================================================================================
// 4. Close
// =====================================================================================================
export async function mountClose(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  try { await loadOptions(true); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const readyPill = (b) => (b.readiness.ready ? pill('Ready', 'success') : pill('Not ready', 'warning'));
  const lv = list({
    columns: [
      { key: 'batchNumber', label: 'Batch Number', render: (b) => h('b', { className: 'font-medium text-foreground', text: b.batchNumber }) },
      { key: 'branch', label: 'Branch', render: (b) => two(branchText(b), b.rate === 'All' ? '' : b.rate), className: 'font-normal' },
      { key: 'live', label: 'Ratings', render: (b) => String(b.live), className: 'text-center', headClassName: 'text-center' },
      { key: 'ready', label: 'Ready', render: readyPill },
    ],
    load: async () => {
      const res = await api.get(`${BASE}/batches?stage=open`);
      return { data: res.data, meta: { page: 1, pageSize: 25, total: res.data.length, totalPages: 1 } };
    },
    onPick: (b) => batchRecord(b),
    card: { title: (b) => b.batchNumber, subtitle: (b) => `${branchText(b)} · ${plural(b.live, 'rating')}`, aside: readyPill },
    empty: { icon: 'lock', title: 'Nothing to Close', text: 'There are no open advancement batches.' },
  });

  function batchRecord(b) {
    const r = b.readiness;
    const dlg = detailsDialog({
      title: b.batchNumber,
      panels: [
        { title: 'Batch', rows: [['Batch Number', h('b', { text: b.batchNumber })], ['Branch', b.branch], ['Specialisation', b.specialisation], ['Current Rate', b.rate], ['Initiated', `${fmt(b.initiatedAt)} by ${b.initiatedBy}`]] },
        { title: 'Readiness', rows: [['Ratings', String(r.live)], ['New Rate Set', `${r.withTarget} of ${r.live}`], ['Departments Approved', `${r.approvedDepartments} of ${r.departments.length}`], ['Not Recommended', String(b.notRecommended)], ['Ready', readyPill(b)]] },
      ],
      after: r.problems.length ? notice('warning', 'circle-alert', r.problems.join(' ')) : null,
      actions: [can('advancement.close', 'edit') ? button({ label: 'Close Batch', icon: 'lock', variant: 'primary', onClick: () => { dlg.close(); closeForm(b); } }) : null],
    });
  }

  function closeForm(b) {
    const r = b.readiness;
    const today = new Date();
    const todayText = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const dateField = dateInput('closeDate', '');
    dateField.value = todayText;
    formDialog({
      title: `Close ${b.batchNumber}`, submitLabel: 'Close Batch', submitIcon: 'lock', disabled: !r.ready,
      children: [
        facts([['Ratings', String(r.live)], ['Departments', String(r.departments.length)], ['Initiated', fmt(b.initiatedAt)]]),
        r.ready ? null : notice('error', 'circle-alert', [h('b', { text: 'This batch cannot be closed yet. ' }), r.problems.join(' ')]),
        field({ label: 'Authority', control: textInput({ name: 'authority', placeholder: 'e.g. NHQ/NP/DOA/053/2026', maxlength: '100' }), hint: 'The signal that authorises it. Each authority is used once.' }),
        field({ label: 'Close Date', control: dateField, hint: 'dd/mm/yyyy; not in the future, not before the batch began.' }),
        notice('warning', 'triangle-alert', 'A closed batch is final and is never reopened. A correction is made on the rating\'s record, and the audit trail records it.'),
      ].filter(Boolean),
      save: (form) => api.post(`${BASE}/batches/${b.id}/close`, { authority: val(form, 'authority'), closeDate: isoOf(form, 'closeDate') }),
      done: (d) => { toast(`${d.batch.batchNumber} closed under ${d.batch.authority}.`); navigate(can('advancement.board', 'view') ? `#advancement/board?batch=${d.batch.id}` : '#advancement/close'); },
    });
  }

  outlet.replaceChildren(
    header(info, 'Close', [button({ label: 'Export Excel All Departments', icon: 'file-spreadsheet', variant: 'outline', onClick: () => download(`${BASE}/approvals/excel`, 'Advancement All Departments.xlsx') })]),
    lv.el,
  );
}

// =====================================================================================================
// 5. Board Returns Update
// =====================================================================================================
let boardPick = null;

export async function mountBoard(outlet, { info, query = {} } = {}) {
  outlet.replaceChildren(loading());
  let batches;
  try {
    [, batches] = await Promise.all([loadOptions(true), api.get(`${BASE}/batches?stage=board`).then((r) => r.data)]);
  } catch (err) { outlet.replaceChildren(failed(err)); return; }
  if (query.batch) boardPick = Number(query.batch);
  if (!batches.some((b) => b.id === boardPick)) boardPick = batches.length ? batches[0].id : null;

  const headSlot = h('div');
  const pickSlot = h('div');
  const body = h('div');

  async function draw() {
    if (!batches.length) {
      headSlot.replaceChildren(header(info, 'Board Returns Update', []));
      pickSlot.replaceChildren();
      body.replaceChildren(emptyCard(emptyState({ icon: 'calendar', title: 'No Batch Is Waiting for Board Returns', text: 'A batch appears here once it is closed with its authority.', action: can('advancement.close', 'view') ? button({ label: 'Close', icon: 'lock', variant: 'primary', href: '#advancement/close' }) : null })));
      return;
    }
    pickSlot.replaceChildren(h('div', { className: 'mb-4 flex flex-wrap items-end gap-3' },
      batchSelect({ batches, value: boardPick, labelOf: (x) => `${x.batchNumber} · ${x.authority}`, onChange: (id) => { boardPick = id; draw(); } })));
    if (!boardPick) {
      headSlot.replaceChildren(header(info, 'Board Returns Update', []));
      body.replaceChildren(emptyCard(emptyState({ icon: 'list', title: 'Choose a Batch', text: 'Pick a closed batch to enter the board dates.' })));
      return;
    }
    body.replaceChildren(loading());
    let b;
    try { b = (await api.get(`${BASE}/batches/${boardPick}`)).data; } catch (err) { body.replaceChildren(failed(err)); return; }
    const batchBtn = can('advancement.board', 'edit') ? button({ label: 'Set Date for Batch', icon: 'calendar', variant: 'primary', disabled: !b.awaiting, onClick: () => batchForm(b) }) : null;
    headSlot.replaceChildren(header(info, 'Board Returns Update', batchBtn ? [batchBtn] : []));
    const lv = list({
      columns: [
        { key: 'serviceNumber', label: 'Official No', render: (x) => x.serviceNumber },
        { key: 'name', label: 'Name', render: (x) => two(fullName(x), x.specialisation) },
        { key: 'newRate', label: 'New Rate', render: (x) => h('span', { className: 'block' }, [h('b', { className: 'font-medium', text: x.newRateCode }), h('span', { className: 'block text-xs text-muted-foreground', text: `from ${x.rateCode}` })]) },
        { key: 'board', label: 'Board Approval', render: (x) => boardCell(x) },
      ],
      load: ({ page }) => api.get(`${BASE}/batches/${b.id}/rows?page=${page}&live=1`),
      onPick: (x) => rowRecord(b, x),
      card: { title: (x) => fullName(x), subtitle: (x) => `${x.serviceNumber} · ${x.rateCode} to ${x.newRateCode}`, aside: (x) => boardCell(x) },
      empty: { icon: 'users', title: 'This Batch Is Empty', text: 'It has no ratings to advance.' },
    });
    body.replaceChildren(batchFacts(b, [['Authority', b.authority], ['Closed', `${fmt(b.closeDate)}${b.closedBy ? ` by ${b.closedBy}` : ''}`], ['Dated', `${b.dated} of ${b.live}`]]), lv.el);
  }

  function boardCell(x) {
    if (x.status === 'advanced') return h('span', { className: 'block' }, [h('span', { className: 'block', text: fmt(x.boardDate) }), pill('Advanced', 'success')]);
    if (x.status === 'scheduled') return h('span', { className: 'block' }, [h('span', { className: 'block', text: fmt(x.boardDate) }), pill('Scheduled', 'info')]);
    return pill('Pending', 'warning');
  }

  function rowRecord(b, x) {
    const dlg = detailsDialog({
      title: fullName(x),
      panels: [
        { title: 'Rating', rows: [['Official No', x.serviceNumber], ['Name', x.name], ['Department', x.specialisation], ['Age (yrs)', years(x.age)], ['LOS (yrs)', years(x.los)]] },
        { title: 'Advancement', rows: [['Current Rate', x.rate], ['Months in Rate', x.status === 'awaiting_board' ? monthsPill(x) : ''], ['New Rate', x.newRate], ['Authority', b.authority], ['Board Approval Date', fmt(x.boardDate)], ['Status', rowStatusPill(x)]] },
      ],
      after: x.status === 'scheduled' ? notice('info', 'info', `The advancement to ${x.newRate} is scheduled: the rate changes on ${fmt(x.boardDate)}.`) : null,
      actions: [
        openRecordButton(x.serviceNumber),
        x.status === 'awaiting_board' && can('advancement.board', 'edit') ? button({ label: 'Set Date', icon: 'calendar', variant: 'primary', onClick: () => { dlg.close(); rowForm(b, x); } }) : null,
      ],
    });
  }

  function rowForm(b, x) {
    formDialog({
      title: 'Board Approval Date', submitLabel: 'Save Date', submitIcon: 'calendar',
      children: [
        ratingStrip(fullName(x), `${x.rate} to ${x.newRate}`),
        field({ label: 'Board Approval Date', control: dateInput('date'), hint: `Authority ${b.authority}. Not before ${fmt(x.rateSince)}, when the rating joined ${x.rateCode}.` }),
        notice('info', 'info', `Saving makes ${x.newRate} the rating's rate from this date and adds a line to its Advancement tab. A date after today is scheduled: the rate changes on that date.`),
      ],
      save: (form) => api.post(`${BASE}/batches/${b.id}/rows/${x.id}/board`, { date: isoOf(form, 'date') }),
      done: (d) => { toast(d.status === 'scheduled' ? `${fullName(x)} will be ${d.rate} from ${fmt(d.date)}.` : `${x.name} advanced to ${d.rate} from ${fmt(d.date)}.`); refresh(); },
    });
  }

  function batchForm(b) {
    formDialog({
      title: 'Set Date for Batch', submitLabel: 'Save Date', submitIcon: 'calendar',
      children: [
        field({ label: 'Board Approval Date', control: dateInput('date') }),
        notice('warning', 'triangle-alert', [h('b', { text: plural(b.awaiting, 'rating') }), ` in ${b.batchNumber} with no date yet ${b.awaiting === 1 ? 'gets' : 'get'} this date and ${b.awaiting === 1 ? 'moves' : 'move'} to the new rate. Dates already entered stay as they are.`]),
      ],
      save: (form) => api.post(`${BASE}/batches/${b.id}/board`, { date: isoOf(form, 'date') }),
      done: (d) => {
        const parts = [d.advanced ? `${d.advanced} advanced` : '', d.scheduled ? `${d.scheduled} scheduled` : ''].filter(Boolean).join(', ');
        toast(`Date ${fmt(d.date)} saved for ${plural(d.ratings, 'rating')} (${parts}).`);
        refresh();
      },
    });
  }

  async function refresh() {
    try { batches = (await api.get(`${BASE}/batches?stage=board`)).data; } catch (_) { /* keep the list */ }
    if (!batches.some((x) => x.id === boardPick)) boardPick = batches.length ? batches[0].id : null;
    draw();
  }

  outlet.replaceChildren(headSlot, pickSlot, body);
  draw();
}

// =====================================================================================================
// 6. Report on Promoted Rates
// =====================================================================================================
export async function mountPromoted(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(true); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const bar = filterBar({
    fields: [
      { name: 'branchId', label: 'Branch', type: 'select', options: choicesOf(o.branches), placeholder: 'All Branches' },
      { name: 'rateId', label: 'Rate', type: 'select', options: rateChoices(o), placeholder: 'All Rates' },
      { name: 'signal', label: 'Signal Code', type: 'text', placeholder: 'e.g. NHQ/NP/DOA/052/2026', span: 'col-span-2 phone:col-span-1' },
      { name: 'batch', label: 'Batch No', type: 'text', placeholder: 'e.g. DOA-ALL' },
    ],
    onChange: () => lv.reload({ resetPage: true }),
  });
  const stats = h('div');
  const lv = list({
    columns: [
      { key: 'authority', label: 'Signal Code', render: (b) => (b.authority ? h('b', { className: 'font-medium text-foreground', text: b.authority }) : '-') },
      { key: 'batchNumber', label: 'Batch Number', render: (b) => two(b.batchNumber, branchText(b)), className: 'font-normal' },
      { key: 'status', label: 'Status', render: (b) => batchStatusPill(b) },
      { key: 'promoted', label: 'Promoted', render: (b) => `${b.advanced} of ${b.live}`, className: 'text-center', headClassName: 'text-center' },
    ],
    load: async ({ page }) => {
      const res = await api.get(`${BASE}/report?${qs({ ...bar.query(), page })}`);
      const s = res.summary;
      stats.replaceChildren(statStrip([['Batches', s.batches], ['Closed', s.closed], ['Promoted', s.promoted, 'primary']]));
      return res;
    },
    onPick: (b) => batchRecord(b),
    card: { title: (b) => b.batchNumber, subtitle: (b) => `${b.authority || 'No authority yet'} · ${plural(b.live, 'rating')}`, aside: (b) => batchStatusPill(b) },
    empty: { icon: 'search', title: 'Nothing Found', text: 'No batch matches these filters.' },
  });

  function batchRecord(b) {
    const dlg = detailsDialog({
      title: b.batchNumber,
      panels: [
        { title: 'Batch', rows: [['Signal Code', b.authority], ['Batch Number', h('b', { text: b.batchNumber })], ['Status', batchStatusPill(b)], ['Branch', b.branch], ['Current Rate', b.rate], ['Initiated', `${fmt(b.initiatedAt)} by ${b.initiatedBy}`], ['Closed', b.closeDate ? `${fmt(b.closeDate)}${b.closedBy ? ` by ${b.closedBy}` : ''}` : '']] },
        { title: 'Ratings', rows: [['Total', String(b.live)], ['Promoted', String(b.advanced)], ['Not Yet Promoted', String(b.live - b.advanced)], ['Not Recommended', String(b.notRecommended)]] },
      ],
      actions: [button({ label: 'Open Contents', icon: 'list', variant: 'primary', onClick: () => { dlg.close(); navigate(`#advancement/promoted/${b.id}`); } })],
    });
  }

  const actions = [
    button({ label: 'Print Batch Summary', icon: 'printer', variant: 'blue', onClick: () => previewPdf(`${BASE}/report/pdf?${qs(bar.query())}`, 'Batch Summary Report for Advancement', 'Batch Summary Report for Advancement.pdf') }),
    button({ label: 'Export Excel', icon: 'file-spreadsheet', variant: 'outline', onClick: () => download(`${BASE}/report/excel?${qs(bar.query())}`, 'Promoted Rates.xlsx') }),
  ];
  outlet.replaceChildren(header(info, 'Report on Promoted Rates', actions), bar.el, stats, lv.el);
}

export async function mountPromotedBatch(outlet, { params = {} } = {}) {
  outlet.replaceChildren(loading());
  const id = Number(params.batchId);
  const back = h('a', { href: '#advancement/promoted', className: 'mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline' }, [icon('arrow-left'), 'Report on Promoted Rates']);
  let b;
  try { b = (await api.get(`${BASE}/batches/${id}`)).data; } catch (err) {
    outlet.replaceChildren(back, emptyCard(emptyState({ icon: 'search', title: 'Batch Not Found', text: err.message || 'No batch has this number.' })));
    return;
  }
  const bar = filterBar({
    fields: [
      { name: 'sn', label: 'Official No', type: 'text', placeholder: 'e.g. B0539' },
      { name: 'name', label: 'Name', type: 'text', placeholder: 'Surname or first name', span: 'col-span-2 phone:col-span-1' },
    ],
    onChange: () => lv.reload({ resetPage: true }),
  });
  const lv = list({
    columns: [
      { key: 'serviceNumber', label: 'Official No', render: (x) => x.serviceNumber },
      { key: 'name', label: 'Full Name', render: (x) => two(x.notRecommended ? struckName(x) : fullName(x), x.specialisation) },
      { key: 'newRate', label: 'New Rate', render: (x) => (x.notRecommended || !x.newRateCode ? newRateCell(x) : h('span', { className: 'block' }, [h('b', { className: 'font-medium', text: x.newRateCode }), h('span', { className: 'block text-xs text-muted-foreground', text: `from ${x.rateCode}` })])) },
      { key: 'date', label: 'Date Advanced', render: (x) => advancedCell(x) },
    ],
    load: ({ page }) => api.get(`${BASE}/batches/${b.id}/rows?${qs({ ...bar.query(), page })}`),
    onPick: (x) => rowRecord(x),
    card: { title: (x) => (x.notRecommended ? struckName(x) : fullName(x)), subtitle: (x) => `${x.serviceNumber} · ${x.rateCode} to ${x.notRecommended ? 'not recommended' : x.newRateCode || '-'}`, aside: (x) => advancedCell(x) },
    empty: { icon: 'search', title: 'No Ratings Match', text: 'Clear the Official No or name.' },
  });

  function rowRecord(x) {
    detailsDialog({
      title: fullName(x),
      panels: [
        { title: 'Rating', rows: [['Official No', x.serviceNumber], ['Full Name', x.name], ['Department', x.specialisation]] },
        { title: 'Advancement', rows: [['Old Rate', x.rate], ['New Rate', x.newRate], ['Remarks', x.remark], ['Not Recommended', x.notRecommended ? x.notRecommended.reason : ''], ['Date Advanced', advancedCell(x)], ['Batch', b.batchNumber]] },
      ],
      actions: [openRecordButton(x.serviceNumber)],
    });
  }

  const actions = [
    can('advancement.promoted', 'view') ? button({ label: 'Print Advancement Report', icon: 'printer', variant: 'blue', onClick: () => previewPdf(`${BASE}/batches/${b.id}/report.pdf`, `Advancement Report ${b.batchNumber}`, `Advancement Report ${b.batchNumber}.pdf`) }) : null,
    button({ label: 'Export Excel', icon: 'file-spreadsheet', variant: 'outline', onClick: () => download(`${BASE}/batches/${b.id}/excel`, `Advancement ${b.batchNumber}.xlsx`) }),
  ].filter(Boolean);
  const factsCard = h('section', { className: cx(CARD, 'mb-4 p-4'), dataset: { batchFacts: '' } }, facts([
    ['Signal Code', b.authority], ['Status', batchStatusPill(b)], ['Branch', b.branch], ['Current Rate', b.rate],
    ['Initiated', `${fmt(b.initiatedAt)} by ${b.initiatedBy}`], ['Closed', b.closeDate ? `${fmt(b.closeDate)}${b.closedBy ? ` by ${b.closedBy}` : ''}` : ''],
    ['Total', h('b', { text: String(b.live) })], ['Promoted', h('b', { text: String(b.advanced) })],
  ]));
  outlet.replaceChildren(
    back,
    pageHeader({ title: `Batch ${b.batchNumber}`, subtitle: b.authority ? `Authority ${b.authority}` : 'Open: no authority yet', actions }),
    factsCard, bar.el, lv.el,
  );
}

// =====================================================================================================
// 7. Upload Advanced Rates
// =====================================================================================================
const COLUMNS = ['Official No', 'Old Rate', 'New Rate', 'Effective Date', 'Authority', 'Decoration', 'Remark'];

export function mountUpload(outlet, { info } = {}) {
  const mayImport = can('advancement.upload', 'add');
  let file = null;
  let checked = null; // the server's review of the file
  let refused = ''; // why the file was not read
  let imported = null;
  let busy = false;

  const input = h('input', { type: 'file', accept: '.xlsx', className: 'hidden', 'aria-label': 'Workbook', dataset: { uploadInput: '' } });
  input.addEventListener('change', () => {
    const f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    file = f;
    checked = null; refused = ''; imported = null;
    check();
  });

  const s1 = h('section', { className: cx(CARD, 'space-y-3 p-4') });
  const s2 = h('section', { className: cx(CARD, 'space-y-3 p-4') });
  const s3 = h('section', { className: cx(CARD, 'space-y-3 p-4') });
  const report = h('div');

  const form = () => { const fd = new FormData(); fd.append('file', file); return fd; };
  async function check() {
    busy = true; draw();
    try {
      checked = (await api.upload(`${BASE}/upload/check`, form())).data;
      toast('File checked.');
    } catch (err) {
      refused = err.message || 'The file could not be read.';
      toast('The file could not be read.', 'error');
    } finally { busy = false; draw(); }
  }

  async function importNow() {
    const ok = await confirmDialog({
      title: 'Import Advancements',
      message: `Import ${checked.ready} ${checked.ready === 1 ? 'advancement' : 'advancements'}? ${checked.skipped} duplicates and ${checked.errors} rows with errors are left out. This adds a line to each rating's Advancement tab and sets its rate.`,
      confirmLabel: `Import ${checked.ready}`,
    });
    if (!ok) return;
    busy = true; draw();
    try {
      imported = (await api.upload(`${BASE}/upload`, form())).data;
      checked = imported;
      toast(`${plural(imported.imported, 'advancement')} imported.`);
    } catch (err) { toast(err.message || 'Could not import.', 'error'); } finally { busy = false; draw(); }
  }

  async function errorRows() {
    try {
      const res = await fetch(`${BASE}/upload/check.xlsx`, { method: 'POST', credentials: 'include', body: form() });
      if (!res.ok) throw new Error('Could not make the file.');
      const url = URL.createObjectURL(await res.blob());
      const a = h('a', { href: url, download: 'Advancement Rows Not Ready.xlsx' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) { toast(err.message || 'Could not make the file.', 'error'); }
  }

  function stepHead(n, title, state) {
    const done = state === 'done';
    return h('div', { className: 'flex items-center gap-3' }, [
      h('span', { className: cx('flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-semibold', done ? 'bg-primary text-primary-foreground' : state === 'on' ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground') }, done ? icon('check') : String(n)),
      h('h2', { className: 'text-sm font-semibold', text: title }),
    ]);
  }
  const TONE = { success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', error: 'bg-error-soft text-error' };
  const count = (n, label, tone) => h('div', { className: cx('rounded-ctl p-2 text-center', TONE[tone]) }, [h('b', { className: 'block text-lg', text: String(n) }), h('span', { className: 'text-2xs', text: label })]);
  const resultPill = (i) => (i.result === 'error' ? pill('Error', 'error') : pill('Skipped', 'warning'));

  function draw() {
    const ok = !!checked;
    s1.replaceChildren(
      stepHead(1, 'Download Template', file ? 'done' : 'on'),
      h('p', { className: 'text-sm text-muted-foreground', text: 'One row for each advancement, keyed by official number. The workbook lists the rates.' }),
      h('div', { className: 'flex flex-wrap gap-1.5' }, COLUMNS.map((c) => pill(c, 'neutral'))),
      button({ label: 'Download Template', icon: 'file-spreadsheet', variant: 'blue', onClick: () => download(`${BASE}/upload/template`, 'Advancement Upload Template.xlsx') }),
    );
    s2.replaceChildren(...[
      stepHead(2, 'Choose File', ok ? 'done' : 'on'),
      h('button', {
        type: 'button', disabled: !mayImport || busy, dataset: { chooseFile: '' },
        className: 'flex w-full flex-col items-center gap-2 rounded-card border-2 border-dashed border-input bg-subtle px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 disabled:opacity-60',
        onClick: () => input.click(),
      }, [
        icon(busy ? 'loader-circle' : 'file-up', cx('icon h-7 w-7', busy && 'animate-spin')),
        file ? h('b', { className: 'break-all text-foreground', text: file.name }) : 'Choose an .xlsx workbook',
        file ? h('span', { text: refused ? 'Could not be read' : ok ? `${plural(checked.totalRows, 'row')} read` : 'Reading' }) : null,
      ]),
      input,
      mayImport ? null : h('p', { className: 'text-xs text-muted-foreground', text: 'You may download the template; importing needs the add privilege.' }),
    ].filter(Boolean));
    s3.replaceChildren(...[
      stepHead(3, 'Review and Import', imported ? 'done' : ok ? 'on' : 'off'),
      ok
        ? h('div', { className: 'grid grid-cols-3 gap-2', dataset: { uploadCounts: '' } }, [count(imported ? imported.imported : checked.ready, imported ? 'Imported' : 'Ready', 'success'), count(checked.skipped, 'Skipped', 'warning'), count(checked.errors, 'Errors', 'error')])
        : h('p', { className: 'text-sm text-muted-foreground', text: 'Choose a workbook to see what will be imported.' }),
      ok ? button({
        label: imported ? 'Imported' : `Import ${checked.ready} Advancements`, icon: 'check', variant: 'primary', className: 'w-full',
        disabled: !!imported || busy || !checked.ready || !mayImport, onClick: importNow,
      }) : null,
    ].filter(Boolean));

    const parts = [];
    if (refused) parts.push(h('div', { className: 'mt-4' }, notice('error', 'circle-alert', [h('b', { text: `${file.name} was not read. ` }), refused])));
    if (imported) parts.push(h('div', { className: 'mt-4' }, notice('success', 'circle-check', [h('b', { text: `${plural(imported.imported, 'advancement')} imported. ` }), `${imported.skipped} skipped as duplicates and ${imported.errors} not imported because of errors. Each import adds a line to the rating's Advancement tab and sets its rate.`])));
    if (ok && checked.issues.length) {
      const issues = checked.issues;
      const lv = list({
        columns: [
          { key: 'row', label: 'Row', render: (i) => String(i.row) },
          { key: 'serviceNumber', label: 'Official No', render: (i) => i.serviceNumber || '-' },
          { key: 'problem', label: 'Problem', render: (i) => two(h('span', { className: 'whitespace-normal', text: i.problem }), i.field), className: 'whitespace-normal' },
          { key: 'result', label: 'Result', render: resultPill },
        ],
        load: async ({ page }) => ({ data: issues.slice((page - 1) * 25, page * 25), meta: { page, pageSize: 25, total: issues.length, totalPages: Math.max(1, Math.ceil(issues.length / 25)) } }),
        rowKey: (i) => i.row,
        onPick: (i) => detailsDialog({ title: `Row ${i.row}${i.serviceNumber ? ` · ${i.serviceNumber}` : ''}`, size: 'md', panels: [], before: facts([['Row', String(i.row)], ['Official No', i.serviceNumber], ['Field', i.field], ['Result', resultPill(i)], ['Problem', i.problem]]) }),
        card: { title: (i) => `Row ${i.row} · ${i.serviceNumber || '-'}`, subtitle: (i) => i.problem, aside: resultPill },
        empty: { icon: 'circle-check', title: 'Every Row Is Ready' },
      });
      parts.push(h('div', { className: 'mt-4', dataset: { uploadIssues: '' } }, [
        h('div', { className: 'mb-2 flex items-center gap-3' }, [
          h('h2', { className: 'text-sm font-semibold', text: imported ? 'Rows Not Imported' : 'Rows Not Ready' }),
          h('div', { className: 'ml-auto' }, button({ label: 'Download Error Rows', icon: 'download', variant: 'ghost', onClick: errorRows })),
        ]),
        lv.el,
      ]));
    }
    report.replaceChildren(...parts);
  }

  outlet.replaceChildren(
    header(info, 'Upload Advanced Rates', []),
    h('div', { className: 'grid grid-cols-3 gap-4 phone:grid-cols-1' }, [s1, s2, s3]),
    report,
  );
  draw();
}
