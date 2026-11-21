/*
 * Special Drafting (WP11): the three screens (the page's `view` in core/nav.js).
 *
 *   mountProposal   Special Draft Proposal: the drafts not yet printed; Draft a Rating (find a current rating, see where
 *                   it is, choose the posting type, Drafted To, Authority, WEF, Deployment/Vice, Remark); a row opens
 *                   its record with Draft Letter and Remove (until it is printed)
 *   mountReport     Special Draft Report: a posting type and its waiting drafts; Preview Draft Form; Print and Mark
 *                   Printed (one form, the ratings move on their WEF); the Printed Forms with Reprint Form
 *   mountUpload     Upload Draft: Download Template, Choose File (every row checked), Review and Import
 *
 * Lists are 25 a page from the server; a row opens its record in a dialog (a sheet on a phone) holding its actions.
 * The rules are the server's (special-drafting.service.js); its messages land under the fields.
 */
import { downloadFile } from '../core/api.js';
import { pageHeader } from '../ui/page-header.js';
import { confirmDialog } from '../ui/confirm.js';
import { emptyState } from '../ui/empty-state.js';
import { facts } from '../ui/facts.js';
import { ratingSearch } from '../ui/rating-search.js';
import { filterBar } from './disciplinary-parts.js';
import {
  fmt, plural, qs, two, notice, val, isoOf, dateInput, formDialog, detailsDialog, list, previewPdf, emptyCard, openRecordButton,
  field, textInput, selectInput, button, pill, fullName, h, cx, icon, toast, api, can, CARD,
} from './drafting-parts.js';

const BASE = '/api/special-drafting';
const download = (url, name) => downloadFile(url, name).catch((err) => toast(err.message || 'Could not make the file.', 'error'));
const header = (info, fallback, actions) => pageHeader({ title: info ? info.title : fallback, subtitle: info ? info.subtitle : '', actions });
const loading = () => h('div', { className: cx(CARD, 'flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground') }, [icon('loader-circle', 'icon animate-spin'), 'Loading']);
const failed = (err) => emptyCard(emptyState({ icon: 'circle-alert', title: 'Could Not Load the Page', text: (err && err.message) || '' }));

let optionCache = null;
async function loadOptions(force = false) {
  if (!optionCache || force) optionCache = (await api.get(`${BASE}/options`)).data;
  return optionCache;
}

const STATUS = { unprinted: ['Waiting', 'warning'], scheduled: ['Scheduled', 'info'], moved: ['Moved', 'success'], cancelled: ['Cancelled', 'error'] };
const statusPill = (d) => pill(...(STATUS[d.status] || [d.status, 'neutral']));
const typePill = (d) => pill(d.postingType, 'neutral');
const monthsText = (d) => (d.months === null || d.months === undefined ? '' : `${d.months} mo`);
const typeChoices = (o) => o.postingTypes.map((t) => ({ value: t.code, label: t.label }));
const shipChoices = (o) => o.ships.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }));

/** The panels of one draft's record. */
function draftPanels(d) {
  return [
    { title: 'Rating', rows: [['Official No', d.serviceNumber], ['Name', d.name], ['Rate', d.rate], ['Sex', d.sex]] },
    { title: 'Current Posting', rows: [['Current Ship', d.currentShip || '-'], ['Joined the Ship', d.joinedOn ? fmt(d.joinedOn) : '-'], ['Months There', monthsText(d) || '-']] },
    {
      title: 'Special Draft',
      rows: [
        ['Posting Type', typePill(d)], ['Drafted To', d.draftedTo], ['Authority', d.authority], ['WEF', [fmt(d.wef), d.future ? ' (in the future)' : ''].join('')],
        ['Deployment/Vice', d.vice || '-'], ['Remark', d.remark || '-'],
      ],
    },
    {
      title: 'Status',
      rows: [
        ['Status', statusPill(d)], ['Form', d.formNumber || 'Not printed'], d.cancelledReason ? ['Why Cancelled', d.cancelledReason] : null,
        ['Proposed By', d.createdBy || '-'], ['Proposed On', fmt(d.createdAt)], ['Source', d.source === 'upload' ? 'Upload' : 'Proposal'],
      ].filter(Boolean),
    },
  ];
}

// =====================================================================================================
// 1. Special Draft Proposal
// =====================================================================================================
export async function mountProposal(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(true); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const mayAdd = can('special-drafting.proposal', 'add');
  const bar = filterBar({
    fields: [
      { name: 'q', label: 'Search', type: 'text', placeholder: 'Official number or name' },
      { name: 'postingType', label: 'Posting Type', type: 'select', options: typeChoices(o), placeholder: 'All Posting Types' },
    ],
    onChange: () => lv.reload({ resetPage: true }),
  });
  const count = h('div', { className: 'mb-3 text-sm text-muted-foreground', dataset: { draftCount: '' } });
  const lv = list({
    columns: [
      { key: 'serviceNumber', label: 'Official No', render: (d) => d.serviceNumber },
      { key: 'name', label: 'Name', render: (d) => two(fullName(d), [d.currentShip, monthsText(d)].filter(Boolean).join(' · ')) },
      { key: 'draftedTo', label: 'Drafted To', render: (d) => two(d.draftedTo, d.postingType) },
      { key: 'wef', label: 'WEF', render: (d) => two(fmt(d.wef), d.future ? 'Scheduled when printed' : '') },
    ],
    load: async ({ page }) => {
      const res = await api.get(`${BASE}/drafts?${qs({ ...bar.query(), status: 'waiting', page })}`);
      const s = res.summary;
      count.replaceChildren(h('b', { className: 'text-foreground', text: String(s.total) }), ` ${s.total === 1 ? 'special draft is' : 'special drafts are'} waiting to be printed`);
      return res;
    },
    onPick: (d) => draftRecord(d),
    rowKey: (d) => d.id,
    card: { title: (d) => fullName(d), subtitle: (d) => `${d.serviceNumber} · to ${d.draftedTo} · ${fmt(d.wef)}`, aside: (d) => typePill(d) },
    empty: { icon: 'users', title: 'No Special Drafts Waiting', text: mayAdd ? 'Use Draft a Rating to propose one.' : 'Nothing is waiting to be printed.' },
  });

  function draftRecord(d) {
    const dlg = detailsDialog({
      title: fullName(d), size: 'lg', panels: draftPanels(d),
      actions: [
        can('special-drafting.proposal', 'view') ? button({ label: 'Draft Letter', icon: 'file-text', variant: 'outline', onClick: () => previewPdf(`${BASE}/drafts/${d.id}/letter`, `Draft Letter ${d.serviceNumber}`, `Special Draft Letter ${d.serviceNumber}.pdf`) }) : null,
        openRecordButton(d.serviceNumber),
        can('special-drafting.proposal', 'delete') && d.status === 'unprinted' ? button({ label: 'Remove', icon: 'trash-2', variant: 'danger', onClick: () => removeDraft(d, dlg) }) : null,
      ],
    });
  }

  async function removeDraft(d, dlg) {
    const ok = await confirmDialog({ title: 'Remove Special Draft', message: `Remove the special draft of ${fullName(d)} to ${d.draftedTo}? ${d.name} stays where they are and can be drafted again.`, confirmLabel: 'Remove Draft', danger: true });
    if (!ok) return;
    try {
      await api.del(`${BASE}/drafts/${d.id}`);
      dlg.close();
      toast('Special draft removed.');
      lv.reload();
    } catch (err) { toast(err.message || 'Could not remove the draft.', 'error'); }
  }

  function draftRating() {
    const details = h('div', { dataset: { ratingDetails: '' } });
    let seq = 0;
    const pick = ratingSearch({
      name: 'serviceNumber', status: 'current', ariaLabel: 'Rating', placeholder: 'Official number or name',
      onChange: async (r) => {
        const mine = ++seq;
        if (!r) { details.replaceChildren(); return; }
        try {
          const d = (await api.get(`${BASE}/rating/${encodeURIComponent(r.serviceNumber)}`)).data;
          if (mine !== seq) return;
          details.replaceChildren(
            facts([['Rate', d.rate], ['Branch', d.branch], ['Current Ship', d.currentShip || '-'], ['Joined the Ship', d.joinedOn ? fmt(d.joinedOn) : '-'], ['Months There', d.months === null ? '-' : `${d.months} months`]]),
            d.openDraft ? h('div', { className: 'mt-3' }, notice('warning', 'circle-alert', `${d.name} already has a special draft ${d.openDraft.status === 'scheduled' ? 'whose move is still to come' : 'not yet printed'}, to ${d.openDraft.draftedTo}. A rating cannot be drafted again until it is finished.`)) : null,
          );
        } catch (err) { if (mine === seq) details.replaceChildren(notice('error', 'circle-alert', err.message || 'Could not load the rating.')); }
      },
    });
    formDialog({
      title: 'Draft a Rating', size: 'lg', submitLabel: 'Draft Rating', submitIcon: 'user-plus',
      children: [
        field({ label: 'Rating', control: pick, hint: 'Any current rating, whether or not they are in a batch.' }),
        details,
        field({ label: 'Posting Type', control: selectInput({ name: 'postingType', options: typeChoices(o), placeholder: '-- Select Posting Type --', 'aria-label': 'Posting Type' }) }),
        field({ label: 'Drafted To', control: selectInput({ name: 'shipId', options: shipChoices(o), placeholder: '-- Select Ship or Unit --', 'aria-label': 'Drafted To' }) }),
        field({ label: 'Authority', control: textInput({ name: 'authority', maxlength: '150', placeholder: 'The signal, for example NHQ/NP/SDR/051/2026', 'aria-label': 'Authority' }) }),
        field({ label: 'WEF', control: dateInput('wef'), hint: `The day the rating moves. A date after today is scheduled when the form is printed; no later than ${fmt(o.latestWef)}.` }),
        field({ label: 'Deployment/Vice', optional: true, control: textInput({ name: 'vice', maxlength: '150', 'aria-label': 'Deployment/Vice' }), hint: 'Required when the posting type is Vice.' }),
        field({ label: 'Remark', optional: true, control: textInput({ name: 'remark', maxlength: '250', 'aria-label': 'Remark' }) }),
      ],
      save: (form) => api.post(`${BASE}/drafts`, {
        serviceNumber: pick.value, postingType: val(form, 'postingType'), shipId: val(form, 'shipId'), authority: val(form, 'authority'),
        wef: isoOf(form, 'wef'), vice: val(form, 'vice'), remark: val(form, 'remark'),
      }),
      done: (d) => { toast(`${fullName(d)} drafted to ${d.draftedTo}.`); lv.reload(); },
    });
  }

  outlet.replaceChildren(
    header(info, 'Special Draft Proposal', mayAdd ? [button({ label: 'Draft a Rating', icon: 'user-plus', variant: 'primary', onClick: draftRating })] : []),
    bar.el, count, lv.el,
  );
}

// =====================================================================================================
// 2. Special Draft Report
// =====================================================================================================
export async function mountReport(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(true); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const mayPrint = can('special-drafting.report', 'edit');
  let type = '';
  let state = null; // the server's view of the chosen type: ready, moveNow, scheduled, problems

  // the select is made once (its dropdown is drawn from the options it is made with); the counts are a strip beside it
  const typeHolder = h('div', { className: 'max-w-sm' });
  const counts = h('div', { className: 'mt-3', dataset: { typeCounts: '' } });
  typeHolder.addEventListener('dropdown:change', (e) => {
    const t = (e.detail && e.detail.value) || '';
    if (t !== type) chooseType(t);
  });
  const notices = h('div', { className: 'space-y-3' });
  const previewBtn = button({ label: 'Preview Draft Form', icon: 'eye', variant: 'outline', disabled: true, onClick: () => previewPdf(`${BASE}/report/preview?${qs({ postingType: type })}`, `Special Draft Form (${type})`, `Special Draft Form ${type} (preview).pdf`) });
  const printBtn = mayPrint ? button({ label: 'Print and Mark Printed', icon: 'printer', variant: 'primary', disabled: true, onClick: () => printForm() }) : null;

  const waitingList = list({
    columns: [
      { key: 'serviceNumber', label: 'Official No', render: (d) => d.serviceNumber },
      { key: 'name', label: 'Name', render: (d) => two(fullName(d), [d.currentShip, monthsText(d)].filter(Boolean).join(' · ')) },
      { key: 'draftedTo', label: 'Drafted To', render: (d) => two(d.draftedTo, d.vice) },
      { key: 'wef', label: 'WEF', render: (d) => two(fmt(d.wef), d.future ? 'Scheduled' : '') },
    ],
    load: async ({ page }) => {
      if (!type) return { data: [], meta: { page: 1, pageSize: 25, total: 0, totalPages: 1 } };
      return api.get(`${BASE}/drafts?${qs({ postingType: type, status: 'waiting', page })}`);
    },
    onPick: (d) => detailsDialog({ title: fullName(d), size: 'lg', panels: draftPanels(d), actions: [openRecordButton(d.serviceNumber)] }),
    rowKey: (d) => d.id,
    card: { title: (d) => fullName(d), subtitle: (d) => `${d.serviceNumber} · to ${d.draftedTo} · ${fmt(d.wef)}`, aside: (d) => (d.future ? pill('Scheduled', 'info') : null) },
    empty: { icon: 'file-text', title: 'Nothing Waiting', text: 'There are no drafts of this posting type waiting to be printed.' },
  });

  async function refreshTypes() {
    const r = (await api.get(`${BASE}/report/types?${qs({ postingType: type })}`)).data;
    state = r.postingType ? r : null;
    counts.replaceChildren(h('div', { className: 'grid grid-cols-4 gap-3 phone:grid-cols-2' }, r.types.map((t) => h('div', { className: cx(CARD, 'min-w-0 px-4 py-2 phone:px-2') }, [
      h('div', { className: 'truncate text-2xs font-semibold uppercase tracking-wider text-muted-foreground', text: t.label }),
      h('div', { className: cx('text-xl font-semibold', t.waiting ? 'text-primary-hover' : ''), text: String(t.waiting) }),
    ]))));
    const ready = state ? state.ready : 0;
    const blocked = state ? state.problems.length > 0 : false;
    previewBtn.disabled = !type || !ready;
    if (printBtn) printBtn.disabled = !type || !ready || blocked;
    notices.replaceChildren(...[
      state && ready ? notice('info', 'info', [h('b', { text: plural(ready, 'rating') }), ` on this form: ${state.moveNow} ${state.moveNow === 1 ? 'moves' : 'move'} when it is printed, ${state.scheduled} ${state.scheduled === 1 ? 'is' : 'are'} scheduled for a later WEF.`]) : null,
      blocked ? notice('warning', 'circle-alert', [h('b', { text: `${plural(state.problems.length, 'draft')} cannot be printed. ` }), `${state.problems.slice(0, 3).map((p) => `${p.serviceNumber}: ${p.message}`).join(' ')} Remove ${state.problems.length === 1 ? 'it' : 'them'} on Special Draft Proposal first.`]) : null,
    ].filter(Boolean));
  }

  async function chooseType(t) {
    type = t;
    try { await refreshTypes(); } catch (err) { toast(err.message, 'error'); }
    waitingList.reload({ resetPage: true });
  }
  async function printForm() {
    const ok = await confirmDialog({
      title: 'Print and Mark Printed',
      message: `Make one form of the ${plural(state.ready, `${type} draft`)} and mark ${state.ready === 1 ? 'it' : 'them'} printed? ${state.moveNow} ${state.moveNow === 1 ? 'rating moves' : 'ratings move'} now and ${state.scheduled} ${state.scheduled === 1 ? 'is' : 'are'} scheduled. A printed form cannot be undone.`,
      confirmLabel: 'Print and Mark Printed',
    });
    if (!ok) return;
    try {
      const d = (await api.post(`${BASE}/report/print`, { postingType: type })).data;
      toast(`Form ${d.form.formNumber} printed: ${d.moved} moved, ${d.scheduled} scheduled.`);
      previewPdf(`${BASE}/forms/${d.form.id}/pdf`, `Special Draft Form ${d.form.formNumber}`, `Special Draft Form ${d.form.formNumber}.pdf`);
      await refreshTypes();
      waitingList.reload({ resetPage: true });
      formsList.reload({ resetPage: true });
    } catch (err) { toast(err.message || 'Could not print the form.', 'error'); refreshTypes().catch(() => {}); }
  }

  const formsList = list({
    columns: [
      { key: 'formNumber', label: 'Form No', render: (f) => h('b', { text: f.formNumber }) },
      { key: 'postingType', label: 'Posting Type', render: (f) => pill(f.postingType, 'neutral') },
      { key: 'count', label: 'Ratings', render: (f) => String(f.count) },
      { key: 'printed', label: 'Printed', render: (f) => two(fmt(f.printedAt), f.printedBy) },
    ],
    load: ({ page }) => api.get(`${BASE}/forms?${qs({ page })}`),
    onPick: (f) => formRecord(f),
    rowKey: (f) => f.id,
    card: { title: (f) => f.formNumber, subtitle: (f) => `${f.postingType} · ${plural(f.count, 'rating')} · ${fmt(f.printedAt)}`, aside: (f) => pill(f.postingType, 'neutral') },
    empty: { icon: 'file-text', title: 'No Forms Printed Yet', text: 'A form appears here when you Print and Mark Printed.' },
  });

  async function formRecord(f) {
    let r;
    try { r = (await api.get(`${BASE}/forms/${f.id}`)).data; } catch (err) { toast(err.message, 'error'); return; }
    const rows = r.drafts;
    const inner = list({
      columns: [
        { key: 'serviceNumber', label: 'Official No', render: (d) => d.serviceNumber },
        { key: 'name', label: 'Name', render: (d) => fullName(d) },
        { key: 'draftedTo', label: 'Drafted To', render: (d) => d.draftedTo },
        { key: 'wef', label: 'WEF', render: (d) => fmt(d.wef) },
        { key: 'status', label: 'Status', render: (d) => statusPill(d) },
      ],
      load: async ({ page }) => ({ data: rows.slice((page - 1) * 25, page * 25), meta: { page, pageSize: 25, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / 25)) } }),
      rowKey: (d) => d.id,
      card: { title: (d) => fullName(d), subtitle: (d) => `${d.serviceNumber} · to ${d.draftedTo} · ${fmt(d.wef)}`, aside: (d) => statusPill(d) },
      empty: { icon: 'file-text', title: 'No Ratings' },
    });
    detailsDialog({
      title: `Form ${f.formNumber}`, size: 'xl', panels: [],
      before: h('div', { className: 'space-y-3' }, [
        facts([['Form No', h('b', { text: f.formNumber })], ['Posting Type', f.postingType], ['Ratings', String(f.count)], ['Printed On', fmt(f.printedAt)], ['Printed By', f.printedBy || '-']]),
        h('div', { className: 'text-sm font-semibold text-brand', text: 'Ratings on the Form' }),
        inner.el,
      ]),
      actions: [button({ label: 'Reprint Form', icon: 'printer', variant: 'primary', onClick: () => previewPdf(`${BASE}/forms/${f.id}/pdf`, `Special Draft Form ${f.formNumber}`, `Special Draft Form ${f.formNumber}.pdf`) })],
    });
  }

  const section = (title, ...children) => h('section', { className: 'mt-6' }, [h('h2', { className: 'mb-2 text-sm font-semibold text-brand', text: title }), ...children]);
  outlet.replaceChildren(
    header(info, 'Special Draft Report', [previewBtn, printBtn].filter(Boolean)),
    typeHolder, counts,
    h('div', { className: 'mt-3' }, notices),
    section('Waiting to Be Printed', waitingList.el),
    section('Printed Forms', formsList.el),
  );
  // start on the first posting type that has drafts waiting
  try {
    const r = (await api.get(`${BASE}/report/types`)).data;
    const first = r.types.find((t) => t.waiting > 0);
    type = first ? first.code : '';
    typeHolder.replaceChildren(field({ label: 'Posting Type', control: selectInput({ name: 'postingType', value: type, placeholder: '-- Select Posting Type --', 'aria-label': 'Posting Type', options: r.types.map((t) => ({ value: t.code, label: t.label })) }) }));
    await refreshTypes();
    waitingList.reload({ resetPage: true });
  } catch (err) { outlet.replaceChildren(failed(err)); }
}

// =====================================================================================================
// 3. Upload Draft
// =====================================================================================================
const COLUMNS = ['Official No', 'Drafted To', 'Authority', 'WEF', 'Posting Type', 'Deployment/Vice', 'Remark'];

export function mountUpload(outlet, { info } = {}) {
  const mayImport = can('special-drafting.upload', 'add');
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
      title: 'Import Special Drafts',
      message: `Import ${plural(checked.ready, 'special draft')}? ${checked.skipped} skipped and ${checked.errors} rows with errors are left out. The drafts wait on Special Draft Report; no rating moves until its form is printed.`,
      confirmLabel: `Import ${checked.ready}`,
    });
    if (!ok) return;
    busy = true; draw();
    try {
      imported = (await api.upload(`${BASE}/upload`, form())).data;
      checked = imported;
      toast(`${plural(imported.imported, 'special draft')} imported.`);
    } catch (err) { toast(err.message || 'Could not import.', 'error'); } finally { busy = false; draw(); }
  }

  async function errorRows() {
    try {
      const res = await fetch(`${BASE}/upload/check.xlsx`, { method: 'POST', credentials: 'include', body: form() });
      if (!res.ok) throw new Error('Could not make the file.');
      const url = URL.createObjectURL(await res.blob());
      const a = h('a', { href: url, download: 'Special Draft Rows Not Ready.xlsx' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) { toast(err.message || 'Could not make the file.', 'error'); }
  }

  function stepHead(n, title, state) {
    const done = state === 'done';
    return h('div', { className: 'flex items-center gap-3' }, [
      h('span', { className: cx('flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-semibold', done ? 'bg-primary text-primary-foreground' : state === 'on' ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground') }, done ? icon('check', 'icon') : String(n)),
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
      h('p', { className: 'text-sm text-muted-foreground', text: 'One row for each special draft, keyed by official number. The workbook lists the ships and the posting types.' }),
      h('div', { className: 'flex flex-wrap gap-1.5' }, COLUMNS.map((c) => pill(c, 'neutral'))),
      button({ label: 'Download Template', icon: 'file-spreadsheet', variant: 'blue', onClick: () => download(`${BASE}/upload/template`, 'Special Draft Upload Template.xlsx') }),
    );
    s2.replaceChildren(...[
      stepHead(2, 'Choose File', ok ? 'done' : 'on'),
      h('button', {
        type: 'button', disabled: !mayImport || busy, dataset: { chooseFile: '' },
        className: 'flex w-full flex-col items-center gap-2 rounded-card border-2 border-dashed border-input bg-subtle px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:opacity-60',
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
        label: imported ? 'Imported' : `Import ${checked.ready} Special Drafts`, icon: 'check', variant: 'primary', className: 'w-full',
        disabled: !!imported || busy || !checked.ready || !mayImport, onClick: importNow,
      }) : null,
    ].filter(Boolean));

    const parts = [];
    if (refused) parts.push(h('div', { className: 'mt-4' }, notice('error', 'circle-alert', [h('b', { text: `${file.name} was not read. ` }), refused])));
    if (imported) parts.push(h('div', { className: 'mt-4' }, notice('success', 'circle-check', [h('b', { text: `${plural(imported.imported, 'special draft')} imported. ` }), `${imported.skipped} skipped and ${imported.errors} not imported because of errors. Print them on Special Draft Report.`])));
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
    header(info, 'Upload Draft', []),
    h('div', { className: 'grid grid-cols-3 gap-4 phone:grid-cols-1' }, [s1, s2, s3]),
    report,
  );
  draw();
}
