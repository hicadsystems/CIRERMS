/*
 * Drafting: the draft cycle's six screens (the page's `view` in core/nav.js).
 *
 *   mountManning    Update Manning Requirement: filters, required / aboard / difference, Add, Edit, Delete, Print
 *   mountProposal   Print Draft Proposal: who is due (reads only), Create Draft Batch in a confirming dialog
 *   mountReview     Review/Print Draft: an open batch's ratings; Edit Posting, Not Recommended, Remove, Add Personnel,
 *                   Print Draft (the Draft Form), Export Excel, Clear Draft
 *   mountApproval   Draft Approval: one row per department; its list and Approve Department
 *   mountClose      Close Draft: the open batches with their readiness; Close one batch (final)
 *   mountWef        Update WEF: closed batches; Set WEF per rating or for a department (the rating moves, or is scheduled)
 *
 * Lists are 25 a page from the server with about four key columns; a row opens its full record in a dialog
 * (a sheet on a phone) holding the row's actions. The rules are the server's; its messages land under the
 * fields. Shared parts are in drafting-parts.js.
 */
import { downloadFile } from '../core/api.js';
import { pageHeader } from '../ui/page-header.js';
import { confirmDialog } from '../ui/confirm.js';
import { emptyState } from '../ui/empty-state.js';
import { facts } from '../ui/facts.js';
import { filterBar } from './disciplinary-parts.js';
import { ratingSearch } from '../ui/rating-search.js';
import {
  BASE, fmt, plural, qs, loadOptions, monthsPill, rowStatusPill, batchStatusPill, fullName, two, notice, ratingStrip, statStrip,
  dateInput, val, isoOf, choicesOf, shipOptions, formDialog, detailsDialog, openRecordButton, list, previewPdf, batchSelect,
  batchFacts, emptyCard, field, textInput, selectInput, button, pill, h, cx, icon, toast, api, can, navigate, CARD,
} from './drafting-parts.js';

const download = (url, name) => downloadFile(url, name).catch((err) => toast(err.message || 'Could not make the file.', 'error'));
const header = (info, fallback, subtitle, actions) => pageHeader({ title: info ? info.title : fallback, subtitle: info ? info.subtitle : subtitle, actions });
const loading = () => h('div', { className: cx(CARD, 'flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground') }, [icon('loader-circle', 'icon animate-spin'), 'Loading']);
const failed = (err) => emptyCard(emptyState({ icon: 'circle-alert', title: 'Could Not Load the Page', text: (err && err.message) || '' }));
const diffPill = (d) => (d === 0 ? pill('Full', 'success') : d < 0 ? pill(`Short by ${-d}`, 'warning') : pill(`Over by ${d}`, 'info'));
const manningPill = (m) => (!m || !m.difference ? null : pill(m.difference > 0 ? `Over by ${m.difference}` : `Under by ${-m.difference}`, 'warning'));
const deptLabel = (o) => (o.department ? o.department.name : '');

// =====================================================================================================
// 1. Update Manning Requirement
// =====================================================================================================
export async function mountManning(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(true); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const stats = h('div');
  const bar = filterBar({
    fields: [
      { name: 'shipId', label: 'Ship', type: 'select', options: choicesOf(o.ships), placeholder: 'All Ships' },
      { name: 'rateId', label: 'Rate', type: 'select', options: o.rates.map((r) => ({ value: r.id, label: r.name })), placeholder: 'All Rates' },
      { name: 'specialisationId', label: 'Specialisation', type: 'select', options: choicesOf(o.specialisations), placeholder: 'All Specialisations', span: 'col-span-2 phone:col-span-1' },
    ],
    onChange: () => lv.reload({ resetPage: true }),
  });
  const lv = list({
    columns: [
      { key: 'ship', label: 'Ship', render: (m) => h('b', { className: 'font-medium text-foreground', text: m.ship }) },
      { key: 'rate', label: 'Rate and Specialisation', render: (m) => two(m.rateCode, m.specialisation), className: 'font-normal' },
      { key: 'required', label: 'Required', render: (m) => h('b', { text: String(m.required) }), className: 'text-center', headClassName: 'text-center' },
      { key: 'aboard', label: 'Aboard', render: (m) => String(m.aboard), className: 'text-center', headClassName: 'text-center' },
      { key: 'difference', label: 'Difference', render: (m) => diffPill(m.difference) },
    ],
    load: async ({ page }) => {
      const res = await api.get(`${BASE}/manning?${qs({ ...bar.query(), page })}`);
      const s = res.summary;
      stats.replaceChildren(statStrip([['Requirements', s.requirements], ['Required', s.required, 'primary'], ['Aboard', s.aboard]]));
      return res;
    },
    onPick: (m) => manningRecord(m),
    card: { title: (m) => m.ship, subtitle: (m) => `${m.rateCode} ${m.specialisation} · required ${m.required}, aboard ${m.aboard}`, aside: (m) => diffPill(m.difference) },
    empty: { icon: 'ship', title: 'No Requirement Matches', text: 'Change the filters, or add a requirement for the ship.' },
  });

  function manningRecord(m) {
    const dlg = detailsDialog({
      title: `${m.ship} · ${m.rateCode} ${m.specialisation}`,
      panels: [
        { title: 'Requirement', rows: [['Ship or Unit', m.ship], ['Rate', m.rate], ['Specialisation', m.specialisation]] },
        { title: 'Manning', rows: [['Required', h('b', { text: String(m.required) })], ['Aboard', String(m.aboard)], ['Difference', diffPill(m.difference)]] },
      ],
      actions: [
        can('drafting.manning', 'delete') ? button({ label: 'Delete', icon: 'trash-2', variant: 'outline', className: 'text-destructive', onClick: () => removeManning(m, dlg) }) : null,
        can('drafting.manning', 'edit') ? button({ label: 'Edit', icon: 'pencil', variant: 'primary', onClick: () => { dlg.close(); manningForm(m); } }) : null,
      ],
    });
  }

  async function removeManning(m, dlg) {
    const ok = await confirmDialog({ title: 'Delete Requirement', message: `Delete the requirement for ${m.rateCode} ${m.specialisation} on ${m.ship}? Its ${plural(m.required, 'place')} are removed from the ship's manning.`, confirmLabel: 'Delete Requirement', danger: true });
    if (!ok) return;
    try {
      await api.del(`${BASE}/manning/${m.id}`);
      dlg.close();
      toast('Requirement deleted.');
      lv.reload();
    } catch (err) { toast(err.message || 'Could not delete.', 'error'); }
  }

  function manningForm(m = null) {
    formDialog({
      title: m ? 'Edit Requirement' : 'Add Requirement',
      submitLabel: m ? 'Save' : 'Add Requirement',
      submitIcon: m ? 'check' : 'plus',
      children: [
        field({ label: 'Ship or Unit', control: selectInput({ name: 'shipId', options: choicesOf(o.ships, m && m.shipId), value: m ? m.shipId : '', placeholder: '-- Select Ship or Unit --' }) }),
        field({ label: 'Rate', control: selectInput({ name: 'rateId', options: o.rates.map((r) => ({ value: r.id, label: r.name })), value: m ? m.rateId : '', placeholder: '-- Select Rate --' }) }),
        field({ label: 'Specialisation', control: selectInput({ name: 'specialisationId', options: choicesOf(o.specialisations, m && m.specialisationId), value: m ? m.specialisationId : '', placeholder: '-- Select Specialisation --' }) }),
        field({ label: 'Quantity', control: textInput({ name: 'quantity', type: 'number', min: '1', max: '99', value: m ? m.required : '', placeholder: 'Number of ratings', inputmode: 'numeric' }), hint: 'How many ratings of this rate and specialisation the ship needs (1 to 99).' }),
      ],
      save: (form) => {
        const body = { shipId: val(form, 'shipId'), rateId: val(form, 'rateId'), specialisationId: val(form, 'specialisationId'), quantity: val(form, 'quantity') };
        return m ? api.put(`${BASE}/manning/${m.id}`, body) : api.post(`${BASE}/manning`, body);
      },
      done: () => { toast(m ? 'Requirement updated.' : 'Requirement added.'); lv.reload(); },
    });
  }

  function printDialog() {
    const current = bar.query().shipId || '';
    formDialog({
      title: 'Print Manning Requirement', size: 'sm', submitLabel: 'Preview PDF', submitIcon: 'printer',
      children: [field({ label: 'Ship or Unit', optional: true, control: selectInput({ name: 'shipId', options: choicesOf(o.ships), value: current, placeholder: 'All ships and units' }) })],
      save: async (form) => ({ data: val(form, 'shipId') }),
      done: (shipId) => previewPdf(`${BASE}/manning/pdf?${qs({ shipId })}`, 'Manning Requirement Report', 'Manning Requirement.pdf'),
    });
  }

  const actions = [
    button({ label: 'Print', icon: 'printer', variant: 'blue', onClick: printDialog }),
    can('drafting.manning', 'add') ? button({ label: 'Add Requirement', icon: 'plus', variant: 'primary', onClick: () => manningForm(null) }) : null,
  ].filter(Boolean);
  outlet.replaceChildren(header(info, 'Update Manning Requirement', '', actions), bar.el, stats, lv.el);
}

// =====================================================================================================
// 2. Print Draft Proposal
// =====================================================================================================
export async function mountProposal(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(true); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const dept = o.department;
  const fields = [
    { name: 'branchId', label: 'Branch', type: 'select', options: choicesOf(o.branches), placeholder: 'All Branches' },
    dept ? null : { name: 'specialisationId', label: 'Specialisation', type: 'select', options: choicesOf(o.specialisations), placeholder: 'All Specialisations', span: 'col-span-2 phone:col-span-1' },
    { name: 'rateId', label: 'Rate', type: 'select', options: o.rates.map((r) => ({ value: r.id, label: r.name })), placeholder: 'All Rates' },
  ].filter(Boolean);
  const bar = filterBar({ fields, onChange: () => lv.reload({ resetPage: true }) });
  const count = h('div', { className: 'mb-3 text-sm text-muted-foreground', dataset: { dueCount: '' } });
  const create = can('drafting.proposal', 'add') ? button({ label: 'Create Draft Batch', icon: 'plus', variant: 'primary', disabled: true, onClick: () => createDialog() }) : null;
  const lv = list({
    columns: [
      { key: 'serviceNumber', label: 'Official No', render: (r) => r.serviceNumber },
      { key: 'name', label: 'Name', render: (r) => two(fullName(r), [r.sex, r.inBatch ? `in ${r.inBatch}` : ''].filter(Boolean).join(' · ')) },
      { key: 'ship', label: 'Current Ship', render: (r) => r.ship },
      { key: 'months', label: 'On Ship', render: (r) => monthsPill(r) },
    ],
    load: async ({ page }) => {
      const res = await api.get(`${BASE}/due?${qs({ ...bar.query(), page })}`);
      const s = res.summary;
      count.replaceChildren(h('b', { className: 'text-foreground', text: String(s.due) }), ` ${s.due === 1 ? 'rating is' : 'ratings are'} due`, s.inBatch ? `, ${s.inBatch} already in a batch` : '');
      if (create) create.disabled = s.toAdd === 0;
      return res;
    },
    onPick: (r) => dueRecord(r),
    rowKey: (r) => r.serviceNumber,
    card: { title: (r) => fullName(r), subtitle: (r) => `${r.serviceNumber} · ${r.ship}${r.inBatch ? ` · in ${r.inBatch}` : ''}`, aside: (r) => monthsPill(r) },
    empty: { icon: 'users', title: 'Nobody Is Due', text: 'No rating matches these filters. Widen the branch, specialisation or rate.' },
  });

  function dueRecord(r) {
    const dlg = detailsDialog({
      title: fullName(r),
      panels: [
        { title: 'Rating', rows: [['Official No', r.serviceNumber], ['Name', r.name], ['Rate', r.rate], ['Sex', r.sex], ['Branch', r.branch], ['Specialisation', r.specialisation]] },
        { title: 'Posting', rows: [['Current Ship', r.ship], ['DOJ Ship', fmt(r.joinedOn)], ['On Ship', monthsPill(r)], ['Last Ship 1', r.lastShip1], ['Last Ship 2', r.lastShip2], ['Authority', r.authority], ['Batch', r.inBatch]] },
      ],
      actions: [
        r.inBatch && can('drafting.review', 'view') ? button({ label: 'Go to Review', icon: 'list', variant: 'outline', onClick: () => { dlg.close(); navigate(`#drafting/review?batch=${r.inBatchId}`); } }) : null,
        openRecordButton(r.serviceNumber),
      ],
    });
  }

  async function createDialog() {
    let p;
    try { p = (await api.get(`${BASE}/batches/preview?${qs(bar.query())}`)).data; } catch (err) { toast(err.message, 'error'); return; }
    if (!p.toAdd) {
      detailsDialog({
        title: 'Create Draft Batch', size: 'sm', panels: [],
        before: notice('warning', 'circle-alert', 'Everyone on this list is already in a batch. Review that batch, or change the filters.'),
        actions: [can('drafting.review', 'view') ? button({ label: 'Go to Review', icon: 'list', variant: 'primary', href: '#drafting/review' }) : null],
      });
      return;
    }
    formDialog({
      title: p.existing ? 'Add to Draft Batch' : 'Create Draft Batch',
      submitLabel: p.existing ? 'Add to Batch' : 'Create Batch', submitIcon: 'plus',
      children: [
        facts([['Batch Number', h('b', { text: p.batchNumber, dataset: { batchNumber: '' } })], ['Branch', p.labels.branch], ['Specialisation', dept ? deptLabel(o) : p.labels.specialisation], ['Rate', p.labels.rate], ['Ratings to Add', h('b', { text: String(p.toAdd) })]]),
        p.existing ? notice('info', 'info', `An open batch for these filters already exists. The ${plural(p.toAdd, 'rating')} not yet in it ${p.toAdd === 1 ? 'is' : 'are'} added to it.`) : null,
        p.leftOut ? notice('warning', 'circle-alert', `${p.leftOut} already in another batch ${p.leftOut === 1 ? 'is' : 'are'} left out.`) : null,
      ].filter(Boolean),
      save: () => api.post(`${BASE}/batches`, bar.query()),
      done: (d) => { toast(`${d.created ? 'Created' : 'Added to'} batch ${d.batch.batchNumber}: ${plural(d.added, 'rating')}.`); navigate(`#drafting/review?batch=${d.batch.id}`); },
    });
  }

  outlet.replaceChildren(...[
    header(info, 'Print Draft Proposal', '', create ? [create] : []),
    dept ? h('div', { className: 'mb-3' }, notice('info', 'info', ['You draft for your department: ', h('b', { text: deptLabel(o) }), '.'])) : null,
    bar.el, count, lv.el,
  ].filter(Boolean));
}

// =====================================================================================================
// 3. Review/Print Draft
// =====================================================================================================
let reviewPick = null;

export async function mountReview(outlet, { info, query = {} } = {}) {
  outlet.replaceChildren(loading());
  let o; let batches;
  try {
    [o, batches] = await Promise.all([loadOptions(true), api.get(`${BASE}/batches?stage=open`).then((r) => r.data)]);
  } catch (err) { outlet.replaceChildren(failed(err)); return; }
  if (query.batch) reviewPick = Number(query.batch);
  if (!batches.some((b) => b.id === reviewPick)) reviewPick = batches.length ? batches[0].id : null;

  const headSlot = h('div');
  const body = h('div');
  const labelOf = (b) => [b.batchNumber, b.branch === 'All' ? 'All branches' : b.branch, b.rate === 'All' ? '' : b.rate].filter(Boolean).join(' · ');
  const picker = batches.length ? h('section', { className: cx(CARD, 'mb-4 flex flex-wrap items-end gap-3 p-4') }, batchSelect({ batches, value: reviewPick, labelOf, onChange: (id) => { reviewPick = id; draw(); } })) : null;

  async function draw() {
    if (!batches.length) {
      headSlot.replaceChildren(header(info, 'Review/Print Draft', '', []));
      body.replaceChildren(emptyCard(emptyState({ icon: 'briefcase', title: 'No Open Draft Batches', text: 'Make a batch from the ratings who are due, then review it here.', action: can('drafting.proposal', 'view') ? button({ label: 'Print Draft Proposal', icon: 'plus', variant: 'primary', href: '#drafting/proposal' }) : null })));
      return;
    }
    if (!reviewPick) {
      headSlot.replaceChildren(header(info, 'Review/Print Draft', '', []));
      body.replaceChildren(emptyCard(emptyState({ icon: 'list', title: 'Choose a Batch', text: 'Pick an open batch to review its ratings.' })));
      return;
    }
    body.replaceChildren(loading());
    let b;
    try { b = (await api.get(`${BASE}/batches/${reviewPick}`)).data; } catch (err) { body.replaceChildren(failed(err)); return; }
    const r = b.readiness;
    const actions = [
      can('drafting.review', 'add') ? button({ label: 'Add Personnel', icon: 'user-plus', variant: 'primary', onClick: () => addPersonnel(b) }) : null,
      button({ label: 'Print Draft', icon: 'printer', variant: 'blue', onClick: () => previewPdf(`${BASE}/batches/${b.id}/pdf`, `Draft Form ${b.batchNumber}`, `Draft ${b.batchNumber}.pdf`) }),
      button({ label: 'Export Excel', icon: 'file-spreadsheet', variant: 'outline', onClick: () => download(`${BASE}/batches/${b.id}/excel`, `Draft ${b.batchNumber}.xlsx`) }),
      can('drafting.review', 'delete') ? button({ label: 'Clear Draft', icon: 'trash-2', variant: 'outline', className: 'text-destructive', onClick: () => clearDraft(b) }) : null,
    ].filter(Boolean);
    headSlot.replaceChildren(header(info, 'Review/Print Draft', '', actions));
    const pct = r.live ? Math.round((r.withTarget / r.live) * 100) : 0;
    const fillBar = h('div', { className: 'cirerms-progress-bar', dataset: { level: r.live && r.withTarget === r.live ? 'high' : r.withTarget ? 'mid' : 'low' } });
    fillBar.style.width = `${pct}%`;
    const progress = h('div', { className: cx(CARD, 'mb-4 flex items-center gap-3 px-4 py-3') }, [
      h('div', { className: 'cirerms-progress-track flex-1' }, fillBar),
      h('span', { className: 'whitespace-nowrap text-xs text-muted-foreground', dataset: { progress: '' } }, [h('b', { className: 'text-foreground', text: String(r.withTarget) }), ` of ${r.live} have a proposed ship`]),
    ]);
    const lv = list({
      columns: [
        { key: 'serviceNumber', label: 'Official No', render: (x) => x.serviceNumber },
        { key: 'name', label: 'Name', render: (x) => (x.notRecommended ? two(h('s', { className: 'text-muted-foreground', text: fullName(x) }), x.currentShip) : two(fullName(x), x.currentShip)) },
        { key: 'months', label: 'On Ship', render: (x) => monthsPill(x) },
        { key: 'proposedShip', label: 'Proposed Ship', render: (x) => proposedCell(x) },
      ],
      load: ({ page }) => api.get(`${BASE}/batches/${b.id}/rows?page=${page}`),
      onPick: (x) => rowRecord(b, x),
      card: {
        title: (x) => (x.notRecommended ? h('s', { className: 'text-muted-foreground', text: fullName(x) }) : fullName(x)),
        subtitle: (x) => `${x.serviceNumber} · ${x.notRecommended ? x.notRecommended.reason : x.proposedShip ? `to ${x.proposedShip}` : 'no proposed ship'}`,
        aside: (x) => (x.notRecommended ? pill('Not Recommended', 'error') : x.proposedShip ? (manningPill(x.manning) || monthsPill(x)) : pill('Not set', 'warning')),
      },
      empty: { icon: 'users', title: 'This Batch Is Empty', text: 'Add personnel, or make a new proposal.' },
    });
    const nr = (batches.find((x) => x.id === b.id) || {}).notRecommended || 0;
    body.replaceChildren(batchFacts(b, [['Proposed Ships', `${r.withTarget} of ${r.live}`], ['Not Recommended', String(nr)]]), progress, lv.el);
  }

  function proposedCell(x) {
    if (x.notRecommended) return h('span', { className: 'block' }, [pill('Not Recommended', 'error'), h('span', { className: 'block truncate text-xs text-muted-foreground', text: x.notRecommended.reason })]);
    if (!x.proposedShip) return pill('Not set', 'warning');
    const mp = manningPill(x.manning);
    return h('span', { className: 'block' }, [h('b', { className: 'font-medium', text: x.proposedShip }), mp ? h('span', { className: 'mt-0.5 block' }, mp) : null]);
  }

  function rowRecord(b, x) {
    const m = x.manning;
    const dlg = detailsDialog({
      title: fullName(x),
      before: x.notRecommended ? notice('error', 'triangle-alert', ['Not recommended: ', h('b', { text: x.notRecommended.reason }), x.notRecommended.by ? ` (${x.notRecommended.by}, ${fmt(x.notRecommended.at)})` : '']) : null,
      panels: [
        { title: 'Rating', rows: [['Official No', x.serviceNumber], ['Name', x.name], ['Rate', x.rate], ['Sex', x.sex], ['Specialisation', x.specialisation], ['Request', x.request]] },
        { title: 'Posting', rows: [
          ['Current Ship', x.currentShip], ['DOJ Ship', fmt(x.joinedOn)], ['On Ship', monthsPill(x)],
          ['Proposed Ship', x.notRecommended ? pill('Not Recommended', 'error') : x.proposedShip || pill('Not set', 'warning')],
          ['Manning at the Proposed Ship', m ? h('span', {}, [`Needs ${m.required}, will have ${m.will} `, manningPill(m)]) : ''],
          ['Vice/Deployment', x.vice], ['Remark', x.remark],
          ['Approval', x.approval ? `${x.approval.rank} ${x.approval.name}, ${fmt(x.approval.approvedAt)}` : ''],
        ] },
      ],
      actions: [
        openRecordButton(x.serviceNumber),
        can('drafting.review', 'delete') ? button({ label: 'Remove', icon: 'trash-2', variant: 'outline', className: 'text-destructive', onClick: () => removeRow(b, x, dlg) }) : null,
        !x.notRecommended && can('drafting.review', 'edit') ? button({ label: 'Not Recommended', icon: 'triangle-alert', variant: 'outline', className: 'text-destructive', onClick: () => { dlg.close(); notRecommended(b, x); } }) : null,
        !x.notRecommended && can('drafting.review', 'edit') ? button({ label: 'Edit Posting', icon: 'pencil', variant: 'primary', onClick: () => { dlg.close(); editPosting(b, x); } }) : null,
      ],
    });
  }

  function editPosting(b, x) {
    formDialog({
      title: 'Draft Posting', submitLabel: 'Save Posting',
      children: [
        ratingStrip(fullName(x), `${x.serviceNumber} · on ${x.nowShip || x.currentShip} since ${fmt(x.joinedOn)}`, monthsPill(x)),
        x.approval ? notice('warning', 'triangle-alert', `${x.specialisation} has approved this draft. Changing the ship means the department must approve again.`) : null,
        field({ label: 'Proposed Ship', control: selectInput({ name: 'shipId', options: shipOptions(o, x.nowShipId || x.currentShipId), value: x.proposedShipId || '', placeholder: '-- Select Ship --' }) }),
        field({ label: 'Vice/Deployment', optional: true, control: textInput({ name: 'vice', value: x.vice, placeholder: 'e.g. Vice AB OKORO, or Deployment', maxlength: '150' }) }),
        field({ label: 'Remark', optional: true, control: textInput({ name: 'remark', value: x.remark, maxlength: '250' }) }),
      ].filter(Boolean),
      save: (form) => api.put(`${BASE}/batches/${b.id}/rows/${x.id}`, { shipId: val(form, 'shipId'), vice: val(form, 'vice'), remark: val(form, 'remark') }),
      done: (d) => { toast(d.reapprove ? 'Posting saved. The department must approve again.' : 'Posting saved.'); draw(); },
    });
  }

  function notRecommended(b, x) {
    formDialog({
      title: 'Not Recommended', submitLabel: 'Not Recommended', submitIcon: 'triangle-alert', tone: 'danger',
      children: [
        ratingStrip(fullName(x), `${x.serviceNumber} · ${b.batchNumber}`),
        field({ label: 'Reason', control: textInput({ name: 'reason', placeholder: 'Why the rating is not recommended', maxlength: '250' }) }),
        notice('info', 'info', 'The rating is taken out of the batch and shown struck out with this reason, on the Draft Form too. It returns to the due list next time.'),
      ],
      save: (form) => api.post(`${BASE}/batches/${b.id}/rows/${x.id}/not-recommended`, { reason: val(form, 'reason') }),
      done: () => { toast(`${fullName(x)} is not recommended.`); draw(); },
    });
  }

  async function removeRow(b, x, dlg) {
    const ok = await confirmDialog({ title: 'Remove from Batch', message: `Remove ${fullName(x)} from ${b.batchNumber}? They stay on their ship and can be proposed again later.`, confirmLabel: 'Remove Rating', danger: true });
    if (!ok) return;
    try {
      await api.del(`${BASE}/batches/${b.id}/rows/${x.id}`);
      dlg.close();
      toast('Removed from the batch.');
      draw();
    } catch (err) { toast(err.message || 'Could not remove.', 'error'); }
  }

  async function clearDraft(b) {
    const ok = await confirmDialog({ title: 'Clear Draft', message: `Remove every rating from ${b.batchNumber}? The batch stays open and empty, and every proposed ship is lost.`, confirmLabel: 'Clear Draft', danger: true });
    if (!ok) return;
    try {
      const res = await api.del(`${BASE}/batches/${b.id}/rows`);
      toast(`Draft cleared: ${plural(res.data.removed, 'rating')} removed.`);
      draw();
    } catch (err) { toast(err.message || 'Could not clear the draft.', 'error'); }
  }

  function addPersonnel(b) {
    const pick = ratingSearch({ name: 'serviceNumber', status: 'current', ariaLabel: 'Rating', placeholder: 'Official number or name' });
    formDialog({
      title: 'Add Personnel', submitLabel: 'Add to Batch', submitIcon: 'user-plus',
      children: [
        field({ label: 'Rating', control: pick, hint: 'A rating already in a batch cannot be added.' }),
        field({ label: 'Request', optional: true, control: selectInput({ name: 'request', options: o.requests, placeholder: '-- Select Request --' }) }),
      ],
      save: (form) => api.post(`${BASE}/batches/${b.id}/rows`, { serviceNumber: pick.value, request: val(form, 'request') }),
      done: (d) => { toast(`${fullName(d.row)} added to ${b.batchNumber}.`); draw(); },
    });
  }

  outlet.replaceChildren(headSlot, picker || h('div'), body);
  draw();
}

// =====================================================================================================
// 4. Draft Approval
// =====================================================================================================
export async function mountApproval(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(true); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const stats = h('div');
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
    empty: { icon: 'shield-check', title: 'No Draft Waiting', text: 'There are no open batches. Make one from the due list first.' },
  });

  function statusPill(d) {
    if (d.status === 'approved') return pill('Approved', 'success');
    return pill(d.partly ? 'Approve Again' : 'Waiting', 'warning');
  }

  function rateGroups(d) {
    return h('div', { className: 'grid grid-cols-4 gap-2 phone:grid-cols-4', dataset: { rateGroups: '' } }, d.rateGroups.map((g) => h('div', { className: cx('rounded-ctl border border-border px-2 py-1.5 text-center', g.count ? 'bg-subtle/60' : 'opacity-60') }, [
      h('div', { className: 'text-2xs font-semibold text-muted-foreground', text: g.code }),
      h('div', { className: 'text-sm font-semibold', text: String(g.count) }),
    ])));
  }

  async function deptDialog(d) {
    const rowsBox = h('div', { className: 'space-y-2' }, h('div', { className: 'py-4 text-center text-sm text-muted-foreground', text: 'Loading' }));
    const dlg = detailsDialog({
      title: `Draft for ${d.department}`, size: 'xl',
      panels: [],
      before: h('div', { className: 'space-y-3' }, [
        facts([['Department', d.department], ['Total', h('b', { text: String(d.total) })], ['Status', statusPill(d)]]),
        h('div', {}, [h('div', { className: 'mb-1.5 text-sm font-semibold text-brand', text: 'By Rate' }), rateGroups(d)]),
        d.approval ? notice('success', 'circle-check', ['Approved by ', h('b', { text: `${d.approval.rank} ${d.approval.name}` }), `, ${d.approval.appointment}, on ${fmt(d.approval.approvedAt)}.`, d.waiting ? ` ${plural(d.waiting, 'rating was', 'ratings were')} added or changed since.` : '']) : null,
        d.missing ? notice('warning', 'circle-alert', `${plural(d.missing, 'rating has', 'ratings have')} no proposed ship. Finish the review before approving.`) : null,
        h('div', { className: 'text-sm font-semibold text-brand', text: 'Ratings' }),
        rowsBox,
      ]),
      actions: [
        button({ label: 'Export Excel', icon: 'file-spreadsheet', variant: 'outline', onClick: () => download(`${BASE}/approvals/excel?specialisationId=${d.specialisationId}`, `Draft ${d.department}.xlsx`) }),
        can('drafting.approval', 'approve') ? button({ label: d.approval ? 'Approve Again' : 'Approve Department', icon: 'shield-check', variant: 'primary', onClick: () => approveForm(d, dlg) }) : null,
      ],
    });
    try {
      const res = await api.get(`${BASE}/approvals/${d.specialisationId}/rows`);
      rowsBox.replaceChildren(...res.data.map((x) => h('div', { className: 'flex items-center gap-3 rounded-card border border-border px-3 py-2', dataset: { deptRow: x.serviceNumber } }, [
        h('div', { className: 'min-w-0 flex-1' }, [
          h('b', { className: 'block truncate text-sm', text: fullName(x) }),
          h('span', { className: 'block truncate text-xs text-muted-foreground', text: `${x.serviceNumber} · ${x.currentShip} to ${x.proposedShip || '?'} · ${x.batchNumber}` }),
        ]),
        x.proposedShip ? (x.approval ? pill('Approved', 'success') : pill('Waiting', 'warning')) : pill('Not set', 'warning'),
      ])), res.meta.total > res.data.length ? h('p', { className: 'text-xs text-muted-foreground', text: `The first ${res.data.length} of ${res.meta.total}; Export Excel has them all.` }) : null);
    } catch (err) { rowsBox.replaceChildren(notice('error', 'circle-alert', err.message || 'Could not load the ratings.')); }
  }

  function approveForm(d, parent) {
    formDialog({
      title: `Approve ${d.department}`, submitLabel: 'Approve', submitIcon: 'shield-check', disabled: d.missing > 0,
      children: [
        d.missing ? notice('error', 'circle-alert', `${plural(d.missing, 'rating has', 'ratings have')} no proposed ship. Finish the review first.`) : null,
        d.approval ? notice('warning', 'triangle-alert', `Already approved by ${d.approval.rank} ${d.approval.name} on ${fmt(d.approval.approvedAt)}. Approving again replaces that.`) : null,
        field({ label: 'Approving Rank', control: selectInput({ name: 'rank', options: o.ranks, value: d.approval ? d.approval.rank : '', placeholder: '-- Select Rank --' }) }),
        field({ label: 'Name', control: textInput({ name: 'name', value: d.approval ? d.approval.name : '', placeholder: 'Name of the approving officer', maxlength: '150' }) }),
        field({ label: 'Appointment', control: textInput({ name: 'appointment', value: d.approval ? d.approval.appointment : '', placeholder: 'e.g. Director of Personnel (Navy)', maxlength: '150' }) }),
      ].filter(Boolean),
      save: (form) => api.post(`${BASE}/approvals/${d.specialisationId}`, { rank: val(form, 'rank'), name: val(form, 'name'), appointment: val(form, 'appointment') }),
      done: (r) => { parent.close(); toast(`${d.department} approved by ${r.approval.rank} ${r.approval.name}: ${plural(r.ratings, 'rating')}.`); lv.reload(); },
    });
  }

  const actions = [button({ label: 'Export Excel All Departments', icon: 'file-spreadsheet', variant: 'outline', onClick: () => download(`${BASE}/approvals/excel`, 'Draft All Departments.xlsx') })];
  outlet.replaceChildren(...[
    header(info, 'Draft Approval', '', actions),
    o.department ? h('div', { className: 'mb-3' }, notice('info', 'info', ['You see your department only: ', h('b', { text: deptLabel(o) }), '.'])) : null,
    stats, lv.el,
  ].filter(Boolean));
}

// =====================================================================================================
// 5. Close Draft
// =====================================================================================================
export async function mountClose(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  try { await loadOptions(true); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const readyPill = (b) => (b.readiness.ready ? pill('Ready', 'success') : pill('Not ready', 'warning'));
  const lv = list({
    columns: [
      { key: 'batchNumber', label: 'Batch Number', render: (b) => h('b', { className: 'font-medium text-foreground', text: b.batchNumber }) },
      { key: 'branch', label: 'Branch', render: (b) => two(b.branch === 'All' ? 'All branches' : b.branch, b.rate === 'All' ? '' : b.rate), className: 'font-normal' },
      { key: 'live', label: 'Ratings', render: (b) => String(b.live), className: 'text-center', headClassName: 'text-center' },
      { key: 'ready', label: 'Ready', render: readyPill },
    ],
    load: async () => {
      const res = await api.get(`${BASE}/batches?stage=open`);
      return { data: res.data, meta: { page: 1, pageSize: 25, total: res.data.length, totalPages: 1 } };
    },
    onPick: (b) => batchRecord(b),
    card: { title: (b) => b.batchNumber, subtitle: (b) => `${b.branch === 'All' ? 'All branches' : b.branch} · ${plural(b.live, 'rating')}`, aside: readyPill },
    empty: { icon: 'lock', title: 'Nothing to Close', text: 'There are no open draft batches.' },
  });

  function batchRecord(b) {
    const r = b.readiness;
    const dlg = detailsDialog({
      title: b.batchNumber,
      panels: [
        { title: 'Batch', rows: [['Batch Number', h('b', { text: b.batchNumber })], ['Branch', b.branch], ['Specialisation', b.specialisation], ['Rate', b.rate], ['Initiated', `${fmt(b.initiatedAt)} by ${b.initiatedBy}`]] },
        { title: 'Readiness', rows: [['Ratings', String(r.live)], ['Ship Proposed', `${r.withTarget} of ${r.live}`], ['Departments Approved', `${r.approvedDepartments} of ${r.departments.length}`], ['Not Recommended', String(b.notRecommended)], ['Ready', readyPill(b)]] },
      ],
      after: r.problems.length ? notice('warning', 'circle-alert', r.problems.join(' ')) : null,
      actions: [can('drafting.close', 'edit') ? button({ label: 'Close Draft', icon: 'lock', variant: 'primary', onClick: () => { dlg.close(); closeForm(b); } }) : null],
    });
  }

  function closeForm(b) {
    const r = b.readiness;
    const today = new Date();
    const todayText = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    formDialog({
      title: `Close ${b.batchNumber}`, submitLabel: 'Close Draft', submitIcon: 'lock', disabled: !r.ready,
      children: [
        facts([['Ratings', String(r.live)], ['Departments', String(r.departments.length)], ['Initiated', fmt(b.initiatedAt)]]),
        r.ready ? null : notice('error', 'circle-alert', [h('b', { text: 'This batch cannot be closed yet. ' }), r.problems.join(' ')]),
        field({ label: 'Authority', control: textInput({ name: 'authority', placeholder: 'e.g. NHQ/NP/DOD/135/2026', maxlength: '100' }), hint: 'The signal that authorises it. Each authority is used once.' }),
        field({ label: 'Close Date', control: dateInput('closeDate', ''), hint: 'dd/mm/yyyy; not in the future, not before the batch began.' }),
        notice('warning', 'triangle-alert', 'A closed batch is final and is never reopened. A correction is made on the rating\'s record, and the audit trail records it.'),
      ].filter(Boolean),
      save: (form) => api.post(`${BASE}/batches/${b.id}/close`, { authority: val(form, 'authority'), closeDate: isoOf(form, 'closeDate') }),
      done: (d) => { toast(`${d.batch.batchNumber} closed under ${d.batch.authority}.`); navigate(can('drafting.wef', 'view') ? `#drafting/wef?batch=${d.batch.id}` : '#drafting/close'); },
    });
    setTimeout(() => { const el = document.querySelector('#overlay-root [name="closeDate"]'); if (el && !el.value) el.value = todayText; }, 0);
  }

  outlet.replaceChildren(
    header(info, 'Close Draft', '', [button({ label: 'Export Excel All Departments', icon: 'file-spreadsheet', variant: 'outline', onClick: () => download(`${BASE}/approvals/excel`, 'Draft All Departments.xlsx') })]),
    lv.el,
  );
}

// =====================================================================================================
// 6. Update WEF
// =====================================================================================================
let wefPick = null;
let wefDept = '';

export async function mountWef(outlet, { info, query = {} } = {}) {
  outlet.replaceChildren(loading());
  let batches;
  try {
    [, batches] = await Promise.all([loadOptions(true), api.get(`${BASE}/batches?stage=wef`).then((r) => r.data)]);
  } catch (err) { outlet.replaceChildren(failed(err)); return; }
  if (query.batch) { wefPick = Number(query.batch); wefDept = ''; }
  if (!batches.some((b) => b.id === wefPick)) wefPick = batches.length ? batches[0].id : null;

  const headSlot = h('div');
  const pickSlot = h('div');
  const body = h('div');

  const statusOf = (x) => (x.status === 'awaiting_wef' && !x.proposedShip ? pill('No ship proposed', 'error') : rowStatusPill(x));

  async function draw() {
    if (!batches.length) {
      headSlot.replaceChildren(header(info, 'Update WEF', '', []));
      pickSlot.replaceChildren();
      body.replaceChildren(emptyCard(emptyState({ icon: 'calendar', title: 'No Batch Is Waiting for a WEF', text: 'A batch appears here once it is closed with its authority.', action: can('drafting.close', 'view') ? button({ label: 'Close Draft', icon: 'lock', variant: 'primary', href: '#drafting/close' }) : null })));
      return;
    }
    body.replaceChildren(loading());
    let b = null;
    if (wefPick) {
      try { b = (await api.get(`${BASE}/batches/${wefPick}`)).data; } catch (err) { body.replaceChildren(failed(err)); return; }
    }
    const depts = b ? b.departments : [];
    if (wefDept && !depts.some((d) => String(d.specialisationId) === String(wefDept))) wefDept = '';
    const deptSel = selectInput({ name: 'department', options: depts.map((d) => ({ value: d.specialisationId, label: `${d.department} (${d.pending} pending)` })), value: wefDept, placeholder: 'All Departments', 'aria-label': 'Department' });
    const deptWrap = h('div', { className: 'w-72 phone:w-full' }, [h('span', { className: 'mb-1 block text-xs font-semibold text-muted-foreground', text: 'Department' }), deptSel]);
    deptWrap.addEventListener('change', (e) => { const t = e.target; if (t.getAttribute && t.getAttribute('name') === 'department') { wefDept = t.value; draw(); } });
    pickSlot.replaceChildren(h('section', { className: cx(CARD, 'mb-4 flex flex-wrap items-end gap-3 p-4 phone:gap-2') }, [
      batchSelect({ batches, value: wefPick, labelOf: (x) => `${x.batchNumber} · ${x.authority}`, onChange: (id) => { wefPick = id; wefDept = ''; draw(); } }),
      b ? deptWrap : null,
    ]));
    if (!b) {
      headSlot.replaceChildren(header(info, 'Update WEF', '', []));
      body.replaceChildren(emptyCard(emptyState({ icon: 'list', title: 'Choose a Batch', text: 'Pick a closed batch to date its postings.' })));
      return;
    }
    const pending = depts.filter((d) => !wefDept || String(d.specialisationId) === String(wefDept)).reduce((a, d) => a + d.pending, 0);
    const deptBtn = can('drafting.wef', 'edit') ? button({ label: 'Set WEF for Department', icon: 'calendar', variant: 'primary', disabled: !pending, onClick: () => deptForm(b, depts) }) : null;
    headSlot.replaceChildren(header(info, 'Update WEF', '', deptBtn ? [deptBtn] : []));
    const dated = batches.find((x) => x.id === b.id);
    const lv = list({
      columns: [
        { key: 'serviceNumber', label: 'Official No', render: (x) => x.serviceNumber },
        { key: 'name', label: 'Name', render: (x) => two(fullName(x), x.currentShip) },
        { key: 'proposedShip', label: 'Proposed Ship', render: (x) => (x.proposedShip ? h('b', { className: 'font-medium', text: x.proposedShip }) : '-') },
        { key: 'status', label: 'Status', render: (x) => h('span', { className: 'block' }, [statusOf(x), x.wef ? h('span', { className: 'block text-xs text-muted-foreground', text: `WEF ${fmt(x.wef)}` }) : null]) },
      ],
      load: ({ page }) => api.get(`${BASE}/batches/${b.id}/rows?${qs({ page, specialisationId: wefDept })}`),
      onPick: (x) => rowRecord(b, x),
      card: { title: (x) => fullName(x), subtitle: (x) => `${x.serviceNumber} · ${x.proposedShip || 'no ship proposed'}${x.wef ? ` · WEF ${fmt(x.wef)}` : ''}`, aside: statusOf },
      empty: { icon: 'users', title: 'No Ratings Here', text: 'This department has no ratings in the batch.' },
    });
    body.replaceChildren(batchFacts(b, [['Authority', b.authority], ['Closed', `${fmt(b.closeDate)}${b.closedBy ? ` by ${b.closedBy}` : ''}`], ['Dated', `${dated ? dated.dated : 0} of ${dated ? dated.live : 0}`]]), lv.el);
  }

  function rowRecord(b, x) {
    const dlg = detailsDialog({
      title: fullName(x),
      panels: [
        { title: 'Rating', rows: [['Official No', x.serviceNumber], ['Name', x.name], ['Rate', x.rate], ['Specialisation', x.specialisation]] },
        { title: 'Posting', rows: [['Current Ship', x.status === 'reported' ? x.nowShip : x.currentShip], ['Proposed Ship', x.proposedShip], ['Vice/Deployment', x.vice], ['Authority', b.authority], ['WEF', fmt(x.wef)], ['Status', statusOf(x)]] },
      ],
      after: x.status === 'scheduled' ? notice('info', 'info', `The move to ${x.proposedShip} is scheduled: the ship changes on ${fmt(x.wef)}.`) : null,
      actions: [
        openRecordButton(x.serviceNumber),
        x.status === 'awaiting_wef' && x.proposedShip && can('drafting.wef', 'edit') ? button({ label: 'Set WEF', icon: 'calendar', variant: 'primary', onClick: () => { dlg.close(); rowForm(b, x); } }) : null,
      ],
    });
  }

  function rowForm(b, x) {
    formDialog({
      title: 'Set WEF', submitLabel: 'Save WEF', submitIcon: 'calendar',
      children: [
        ratingStrip(fullName(x), `${x.currentShip} to ${x.proposedShip}`),
        field({ label: 'WEF Date', control: dateInput('wef'), hint: `On this date the rating moves to ${x.proposedShip}. Authority ${b.authority} of ${fmt(b.closeDate)}.` }),
        notice('info', 'info', `The posting on ${x.currentShip} ends the day before the WEF and the one on ${x.proposedShip} starts on it, on the rating's Drafting tab. A WEF after today shows as scheduled ("Drafted to ${x.proposedShip} wef ...") and the ship changes on that date.`),
      ],
      save: (form) => api.post(`${BASE}/batches/${b.id}/rows/${x.id}/wef`, { wef: isoOf(form, 'wef') }),
      done: (d) => { toast(d.status === 'scheduled' ? `${fullName(x)} will be on ${d.ship} from ${fmt(d.wef)}.` : `${fullName(x)} is on ${d.ship} from ${fmt(d.wef)}.`); refresh(); },
    });
  }

  function deptForm(b, depts) {
    const countBox = h('div');
    const sel = selectInput({ name: 'specialisationId', options: depts.map((d) => ({ value: d.specialisationId, label: d.department })), value: wefDept, placeholder: 'All departments' });
    const showCount = (v) => {
      const n = depts.filter((d) => !v || String(d.specialisationId) === String(v)).reduce((a, d) => a + d.pending, 0);
      countBox.replaceChildren(notice('warning', 'triangle-alert', [h('b', { text: plural(n, 'pending rating') }), ` ${n === 1 ? 'gets' : 'get'} this date and ${n === 1 ? 'moves' : 'move'} to the proposed ship on it. Ratings with no proposed ship are left out.`]));
    };
    const deptField = field({ label: 'Department', optional: true, control: sel });
    deptField.addEventListener('change', (e) => { const t = e.target; if (t.getAttribute && t.getAttribute('name') === 'specialisationId') showCount(t.value); });
    showCount(wefDept);
    formDialog({
      title: 'Set WEF for Department', submitLabel: 'Save WEF', submitIcon: 'calendar',
      children: [deptField, field({ label: 'WEF Date', control: dateInput('wef'), hint: `Not before the authority date (${fmt(b.closeDate)}).` }), countBox],
      save: (form) => api.post(`${BASE}/batches/${b.id}/wef`, { wef: isoOf(form, 'wef'), specialisationId: val(form, 'specialisationId') }),
      done: (d) => {
        const parts = [d.reported ? `${d.reported} reported` : '', d.scheduled ? `${d.scheduled} scheduled` : ''].filter(Boolean).join(', ');
        toast(`WEF ${fmt(d.wef)} saved for ${plural(d.ratings, 'rating')} (${parts}).`);
        refresh();
      },
    });
  }

  async function refresh() {
    try { batches = (await api.get(`${BASE}/batches?stage=wef`)).data; } catch (_) { /* keep the list */ }
    if (!batches.some((x) => x.id === wefPick)) wefPick = batches.length ? batches[0].id : null;
    draw();
  }

  outlet.replaceChildren(headSlot, pickSlot, body);
  draw();
}
