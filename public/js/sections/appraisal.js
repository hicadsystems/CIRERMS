/*
 * Naval Character Assessment (WP12): the three screens (the page's `view` in core/nav.js).
 *
 *   mountGrading   Recommendation and Grading: the appraisals (filters, 25 a page); Initiate Appraisal; a row opens
 *                  the appraisal with Edit and Cancel Appraisal (only while its period is open)
 *   mountReport    Report on Appraisal: filters, three figures, the grade counts, the list; Print PDF, Export Excel
 *   mountPeriods   Appraisal Periods: the periods; Add Period; a row opens it with View Appraisals, Edit, Close Period
 *
 * Also exported for the rating's record (appraisal-record.js): openAppraisalForm, openAppraisalRecord, gradePill.
 * The rules are the server's (appraisal.service.js); its messages land under the fields.
 */
import { downloadFile } from '../core/api.js';
import { pageHeader } from '../ui/page-header.js';
import { confirmDialog } from '../ui/confirm.js';
import { emptyState } from '../ui/empty-state.js';
import { facts } from '../ui/facts.js';
import { ratingSearch } from '../ui/rating-search.js';
import { INPUT } from '../ui/classes.js';
import { filterBar } from './disciplinary-parts.js';
import {
  fmt, plural, qs, two, notice, val, isoOf, dateInput, formDialog, detailsDialog, list, previewPdf, emptyCard, statStrip,
  field, textInput, selectInput, button, pill, h, cx, icon, toast, api, can, navigate, CARD,
} from './drafting-parts.js';

const BASE = '/api/appraisal';
const header = (info, fallback, actions) => pageHeader({ title: info ? info.title : fallback, subtitle: info ? info.subtitle : '', actions });
const loading = () => h('div', { className: cx(CARD, 'flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground') }, [icon('loader-circle', 'icon animate-spin'), 'Loading']);
const failed = (err) => emptyCard(emptyState({ icon: 'circle-alert', title: 'Could Not Load the Page', text: (err && err.message) || '' }));
const download = (url, name) => downloadFile(url, name).catch((err) => toast(err.message || 'Could not make the file.', 'error'));

let optionCache = null;
export async function loadOptions(force = false) {
  if (!optionCache || force) optionCache = (await api.get(`${BASE}/options`)).data;
  return optionCache;
}

// ---- small parts ----------------------------------------------------------------------------------
const PERIOD_PILL = (open) => pill(open ? 'Open' : 'Closed', open ? 'success' : 'neutral');

/** A grade as a pill, coloured by its rank in the Appraisal Ratings table (best first). */
export function gradePill(g, o) {
  const rank = o ? o.grades.findIndex((x) => x.id === g.id) : 0;
  const tone = rank <= 1 ? 'success' : rank === 2 ? 'info' : rank === 3 ? 'warning' : 'error';
  return pill(`${g.code} \u00b7 ${g.name}`, tone);
}
const gradeChoices = (o, held) => o.grades.filter((g) => g.active || g.id === held).map((g) => ({ value: g.id, label: g.label }));
const choices = (rows, label) => rows.filter((r) => r.active !== false).map((r) => ({ value: r.id, label: label ? label(r) : r.name }));
const textarea = (name, value = '', max = 250) => h('textarea', { name, rows: '3', maxlength: String(max), className: INPUT.replace('phone:h-tap', ''), 'aria-label': name }, value);
const ratingTitle = (a) => [a.rateCode, a.name].filter(Boolean).join(' ');

function appraisalPanels(a, o) {
  return [
    { title: 'Rating', rows: [['Official No', a.serviceNumber], ['Name', a.name], ['Rate at the Time', a.rate || '-'], ['Ship at the Time', a.ship || '-'], ['Branch', a.branch || '-']] },
    {
      title: 'Appraisal',
      rows: [
        ['Appraisal No', a.no], ['Period', h('span', { className: 'inline-flex flex-wrap items-center gap-2' }, [a.periodName, PERIOD_PILL(a.periodOpen)])],
        ['Character Grade', h('span', {}, [gradePill(a.character, o), h('span', { className: 'ml-2 text-xs text-muted-foreground', text: `Score ${a.character.scoreLow} - ${a.character.scoreHigh}` })])],
        ['Efficiency Grade', h('span', {}, [gradePill(a.efficiency, o), h('span', { className: 'ml-2 text-xs text-muted-foreground', text: `Score ${a.efficiency.scoreLow} - ${a.efficiency.scoreHigh}` })])],
        ['CO\u2019s Name', a.coName], ['Director\u2019s Name', a.directorName || '-'], ['Director\u2019s Date', a.directorDate ? fmt(a.directorDate) : '-'],
        ['Recorded', `${fmt(a.createdAt)}${a.createdBy ? ` by ${a.createdBy}` : ''}`], ['Remark', a.remark || '-'],
      ],
    },
  ];
}

function editsList(edits) {
  if (!edits || !edits.length) return null;
  return h('div', { className: 'border-t border-border pt-3', dataset: { appraisalEdits: '' } }, [
    h('div', { className: 'mb-2 text-sm font-semibold text-brand', text: 'Changes' }),
    h('ol', { className: 'space-y-2' }, edits.map((e) => h('li', { className: 'rounded-card border border-border bg-subtle/60 p-3 text-sm' }, [
      h('div', { className: 'flex flex-wrap items-center gap-2' }, [h('b', { text: fmt(e.at) }), h('span', { className: 'text-xs text-muted-foreground', text: e.by ? `by ${e.by}` : '' })]),
      h('ul', { className: 'mt-1.5 space-y-0.5 text-xs text-muted-foreground' }, e.changes.map((c) => h('li', {}, [`${c.field}: `, h('s', { text: c.from || '-' }), ' to ', h('b', { className: 'text-foreground', text: c.to || '-' })]))),
    ]))),
  ]);
}

// =====================================================================================================
// the appraisal's record, Initiate / Edit and Cancel (shared with the rating's record)
// =====================================================================================================
/** Opens one appraisal. onChange runs after an edit or a cancel so the caller reloads its list. */
export async function openAppraisalRecord(row, { onChange = () => {}, link = true } = {}) {
  let a; let o;
  try {
    o = await loadOptions();
    a = (await api.get(`${BASE}/appraisals/${row.id}`)).data;
  } catch (err) { toast(err.message || 'Could not open the appraisal.', 'error'); return null; }
  const mayEdit = a.editable && can('appraisal.grading', 'edit');
  const mayCancel = a.editable && can('appraisal.grading', 'delete');
  const dlg = detailsDialog({
    title: `${ratingTitle(a)} \u00b7 ${a.periodName}`, size: 'lg', panels: appraisalPanels(a, o),
    before: a.periodOpen ? null : notice('info', 'lock', [h('b', { text: `${a.periodName} is closed. ` }), 'Its appraisals can be read and reported but not edited or cancelled.']),
    after: editsList(a.edits),
    actions: [
      link && can('ratings.edit', 'view') ? button({ label: 'Open Record', icon: 'id-card', variant: 'outline', onClick: () => navigate(`#ratings/edit/${encodeURIComponent(a.serviceNumber)}?tab=advancement`) }) : null,
      mayCancel ? button({ label: 'Cancel Appraisal', icon: 'x', variant: 'outline', className: 'text-destructive', onClick: () => { dlg.close(); cancelForm(a, o, onChange); } }) : null,
      mayEdit ? button({ label: 'Edit', icon: 'pencil', variant: 'primary', onClick: () => { dlg.close(); openAppraisalForm({ appraisal: a, onDone: onChange }); } }) : null,
    ],
  });
  return dlg;
}

function cancelForm(a, o, onChange) {
  formDialog({
    title: 'Cancel Appraisal', size: 'md', submitLabel: 'Cancel Appraisal', submitIcon: 'x', tone: 'danger', backLabel: 'Keep Appraisal',
    children: [
      h('div', { className: 'text-sm' }, [h('b', { text: a.no }), ` \u00b7 ${a.periodName} \u00b7 ${ratingTitle(a)}`]),
      h('div', { className: 'flex flex-wrap items-center gap-2 text-sm' }, ['Character', gradePill(a.character, o), 'Efficiency', gradePill(a.efficiency, o)]),
      field({ label: 'Reason', control: textarea('reason', '', 250), hint: 'Required. It is kept in the audit trail.' }),
      notice('info', 'info', 'The appraisal leaves the lists and the report; nothing is deleted. The rating can then be appraised again for this period.'),
    ],
    save: (form) => api.post(`${BASE}/appraisals/${a.id}/cancel`, { reason: val(form, 'reason') }),
    done: () => { toast(`Appraisal ${a.no} cancelled.`); onChange(); },
  });
}

/**
 * Initiate Appraisal (no `appraisal`; `rating` is an official number to start with) or Edit (`appraisal`).
 * Shows a notice instead when no period is open.
 */
export async function openAppraisalForm({ appraisal = null, rating = null, onDone = () => {} } = {}) {
  let o;
  try { o = await loadOptions(true); } catch (err) { toast(err.message || 'Could not open the form.', 'error'); return; }
  const editing = !!appraisal;
  const open = o.periods.filter((p) => p.open);
  if (!editing && !open.length) {
    const dlg = detailsDialog({
      title: 'Initiate Appraisal', size: 'md', panels: [], before: notice('error', 'circle-alert', [h('b', { text: 'No period is open. ' }), 'Appraisals can only be recorded in an open period. Add one on Appraisal Periods.']),
      actions: [can('appraisal.periods', 'view') ? button({ label: 'Appraisal Periods', icon: 'calendar', variant: 'outline', onClick: () => { dlg.close(); navigate('#assessment/periods'); } }) : null],
    });
    return;
  }
  const details = h('div', { dataset: { ratingDetails: '' } });
  let pick = null;
  let who = null;
  if (editing) {
    who = h('div', { className: 'grid grid-cols-2 gap-4 phone:grid-cols-1' }, [
      h('div', { className: 'rounded-card border border-border/70 p-3 text-sm' }, [h('span', { className: 'block text-xs font-semibold text-muted-foreground', text: 'Rating' }), h('b', { text: `${appraisal.serviceNumber} \u00b7 ${ratingTitle(appraisal)}` })]),
      h('div', { className: 'rounded-card border border-border/70 p-3 text-sm' }, [h('span', { className: 'block text-xs font-semibold text-muted-foreground', text: 'Period' }), h('b', { text: `${appraisal.periodName} (${appraisal.no})` })]),
    ]);
  } else {
    let seq = 0;
    const showRating = async (sn) => {
      const mine = ++seq;
      if (!sn) { details.replaceChildren(); return; }
      try {
        const d = (await api.get(`${BASE}/rating/${encodeURIComponent(sn)}`)).data;
        if (mine !== seq) return;
        details.replaceChildren(facts([['Rate', d.rate || '-'], ['Branch', d.branch || '-'], ['Current Ship', d.ship || '-']]));
      } catch (err) { if (mine === seq) details.replaceChildren(notice('error', 'circle-alert', err.message || 'Could not load the rating.')); }
    };
    pick = ratingSearch({ name: 'serviceNumber', status: 'current', ariaLabel: 'Rating', placeholder: 'Official number or name', value: rating || undefined, onChange: (r) => showRating(r ? r.serviceNumber : '') });
    if (rating) showRating(rating);
    who = field({ label: 'Rating', control: pick, hint: 'Any current rating.' });
  }
  const a = appraisal;
  const periodSelect = editing ? null : field({ label: 'Period', control: selectInput({ name: 'periodId', options: open.map((p) => ({ value: p.id, label: p.name })), value: open[0].id, placeholder: '-- Select Period --', 'aria-label': 'Period' }), hint: 'Only open periods are listed.' });
  formDialog({
    title: editing ? 'Edit Appraisal' : 'Initiate Appraisal', size: 'lg', submitLabel: editing ? 'Save Changes' : 'Record Appraisal', submitIcon: 'check', columns: 2,
    children: [
      h('div', { className: 'col-span-2 phone:col-span-1 space-y-3' }, [who, details]),
      periodSelect ? h('div', { className: 'col-span-2 phone:col-span-1' }, periodSelect) : null,
      field({ label: 'Character Grade', control: selectInput({ name: 'characterGradeId', options: gradeChoices(o, a && a.character.id), value: a ? a.character.id : '', placeholder: '-- Select Grade --', 'aria-label': 'Character Grade' }) }),
      field({ label: 'Efficiency Grade', control: selectInput({ name: 'efficiencyGradeId', options: gradeChoices(o, a && a.efficiency.id), value: a ? a.efficiency.id : '', placeholder: '-- Select Grade --', 'aria-label': 'Efficiency Grade' }), hint: 'Grades come from Static Tables, Appraisal Ratings.' }),
      h('div', { className: 'col-span-2 phone:col-span-1' }, field({ label: 'Remark', optional: true, control: textarea('remark', a ? a.remark : '', 250) })),
      field({ label: 'CO\u2019s Name', control: textInput({ name: 'coName', maxlength: '100', value: a ? a.coName : '', placeholder: 'e.g. CDR A. DANJUMA', 'aria-label': 'CO\u2019s Name' }) }),
      field({ label: 'Director\u2019s Name', optional: true, control: textInput({ name: 'directorName', maxlength: '100', value: a ? a.directorName : '', 'aria-label': 'Director\u2019s Name' }) }),
      field({ label: 'Director\u2019s Date', optional: true, control: dateInput('directorDate', a ? a.directorDate : ''), hint: 'Enter the director\u2019s name and date together, or neither.' }),
    ].filter(Boolean),
    save: (form) => {
      const body = {
        characterGradeId: val(form, 'characterGradeId'), efficiencyGradeId: val(form, 'efficiencyGradeId'), remark: val(form, 'remark'),
        coName: val(form, 'coName'), directorName: val(form, 'directorName'), directorDate: isoOf(form, 'directorDate'),
      };
      return editing ? api.put(`${BASE}/appraisals/${a.id}`, body) : api.post(`${BASE}/appraisals`, { ...body, serviceNumber: pick.value, periodId: val(form, 'periodId') });
    },
    done: (d) => { toast(editing ? `Appraisal ${d.no} saved.` : `Appraisal ${d.no} recorded for ${ratingTitle(d)} in ${d.periodName}.`); onDone(d); },
  });
}

// =====================================================================================================
// 1. Recommendation and Grading
// =====================================================================================================
export async function mountGrading(outlet, { info, query = {} } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(true); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const mayAdd = can('appraisal.grading', 'add');
  // View Appraisals on a period opens this page for that period
  let forced = Number(query.period) || null;
  const forcedBar = h('div', { className: 'mb-3 hidden' });
  const bar = filterBar({
    fields: [
      { name: 'serviceNumber', label: 'Rating', type: 'rating', span: 'col-span-2' },
      { name: 'periodId', label: 'Period', type: 'select', options: o.periods.map((p) => ({ value: p.id, label: p.name })), placeholder: 'All Periods' },
      { name: 'shipId', label: 'Ship', type: 'select', options: choices(o.ships), placeholder: 'All Ships' },
      { name: 'rateId', label: 'Rate', type: 'select', options: choices(o.rates, (r) => r.code), placeholder: 'All Rates' },
      { name: 'gradeId', label: 'Grade', type: 'select', options: o.grades.map((g) => ({ value: g.id, label: g.label })), placeholder: 'Any Grade' },
    ],
    onChange: () => lv.reload({ resetPage: true }),
  });
  const count = h('div', { className: 'mb-3 text-sm text-muted-foreground', dataset: { appraisalCount: '' } });
  const noPeriod = h('div', { className: 'mb-3 hidden' });
  const lv = list({
    columns: [
      { key: 'serviceNumber', label: 'Official No' },
      { key: 'name', label: 'Name', render: (a) => two(ratingTitle(a), a.ship) },
      { key: 'period', label: 'Period', render: (a) => two(a.periodName, a.periodOpen ? 'Open' : 'Closed') },
      { key: 'grades', label: 'Grades', render: (a) => h('span', { className: 'flex flex-wrap gap-1' }, [gradePill(a.character, o), gradePill(a.efficiency, o)]) },
    ],
    load: async ({ page }) => {
      const res = await api.get(`${BASE}/appraisals?${qs({ ...bar.query(), ...(forced ? { periodId: forced } : {}), page })}`);
      const n = res.summary.total;
      count.replaceChildren(h('b', { className: 'text-foreground', text: String(n) }), ` ${n === 1 ? 'appraisal' : 'appraisals'}`);
      noPeriod.classList.toggle('hidden', res.summary.openPeriods > 0);
      return res;
    },
    onPick: (a) => openAppraisalRecord(a, { onChange: () => lv.reload() }),
    rowKey: (a) => a.id,
    card: { title: (a) => ratingTitle(a), subtitle: (a) => `${a.serviceNumber} \u00b7 ${a.periodName}`, aside: (a) => PERIOD_PILL(a.periodOpen) },
    empty: { icon: 'clipboard-check', title: 'No Appraisals Found', text: 'No appraisal matches these filters, or none has been recorded yet.' },
  });
  noPeriod.replaceChildren(notice('warning', 'triangle-alert', [h('b', { text: 'No period is open. ' }), 'Appraisals can only be recorded in an open period.', can('appraisal.periods', 'view') ? h('a', { href: '#assessment/periods', className: 'ml-1 font-semibold underline', text: 'Open Appraisal Periods' }) : null]));
  function drawForced() {
    const p = forced ? o.periods.find((x) => x.id === forced) : null;
    forcedBar.classList.toggle('hidden', !p);
    if (!p) { forced = null; return; }
    forcedBar.replaceChildren(notice('info', 'info', [`Showing the appraisals of ${p.name}. `, h('button', { type: 'button', className: 'font-semibold underline', text: 'Show all periods', onClick: () => { forced = null; drawForced(); lv.reload({ resetPage: true }); } })]));
  }
  drawForced();
  outlet.replaceChildren(
    header(info, 'Recommendation and Grading', mayAdd ? [button({ label: 'Initiate Appraisal', icon: 'plus', variant: 'primary', onClick: () => openAppraisalForm({ onDone: () => lv.reload({ resetPage: true }) }) })] : []),
    bar.el, forcedBar, noPeriod, count, lv.el,
  );
}

// =====================================================================================================
// 2. Report on Appraisal
// =====================================================================================================
export async function mountReport(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(true); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const bar = filterBar({
    fields: [
      { name: 'periodId', label: 'Period', type: 'select', options: o.periods.map((p) => ({ value: p.id, label: p.name })), placeholder: 'All Periods' },
      { name: 'shipId', label: 'Ship', type: 'select', options: choices(o.ships), placeholder: 'All Ships' },
      { name: 'rateId', label: 'Rate', type: 'select', options: choices(o.rates, (r) => r.code), placeholder: 'All Rates' },
      { name: 'branchId', label: 'Branch', type: 'select', options: choices(o.branches), placeholder: 'All Branches' },
      { name: 'gradeId', label: 'Grade', type: 'select', options: o.grades.map((g) => ({ value: g.id, label: g.label })), placeholder: 'Any Grade' },
    ],
    onChange: () => lv.reload({ resetPage: true }),
  });
  const pdfBtn = button({ label: 'Print PDF', icon: 'printer', variant: 'blue', disabled: true, onClick: () => previewPdf(`${BASE}/report/pdf?${qs(bar.query())}`, 'Report on Appraisal', 'Report on Appraisal.pdf') });
  const xlsBtn = button({ label: 'Export Excel', icon: 'file-spreadsheet', variant: 'outline', disabled: true, onClick: () => download(`${BASE}/report/excel?${qs(bar.query())}`, 'Report on Appraisal.xlsx') });
  const figures = h('div', { dataset: { reportFigures: '' } });
  const grid = h('div', { dataset: { gradeCounts: '' } });
  const pct = (v) => (v === null || v === undefined ? '-' : `${v}%`);
  const lv = list({
    columns: [
      { key: 'serviceNumber', label: 'Official No' },
      { key: 'name', label: 'Name', render: (a) => two(ratingTitle(a), a.ship) },
      { key: 'period', label: 'Period', render: (a) => a.periodName },
      { key: 'grades', label: 'Grades', render: (a) => h('span', { className: 'flex flex-wrap gap-1' }, [gradePill(a.character, o), gradePill(a.efficiency, o)]) },
    ],
    load: async ({ page }) => {
      const res = await api.get(`${BASE}/report?${qs({ ...bar.query(), page })}`);
      const s = res.summary;
      pdfBtn.disabled = !s.appraisals;
      xlsBtn.disabled = !s.appraisals;
      figures.replaceChildren(statStrip([['Appraisals', s.appraisals], ['Character A or B', pct(s.characterTop), 'primary'], ['Efficiency A or B', pct(s.efficiencyTop), 'primary']]));
      grid.replaceChildren(s.appraisals ? h('section', { className: cx(CARD, 'mb-4 overflow-hidden') }, [
        h('div', { className: 'border-b border-border px-4 py-2.5' }, h('h2', { className: 'text-sm font-semibold', text: 'Grade Counts' })),
        h('table', { className: 'w-full text-sm' }, [
          h('thead', {}, h('tr', { className: 'text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground' }, [h('th', { className: 'px-4 py-2', text: 'Grade' }), h('th', { className: 'px-4 py-2 text-right', text: 'Character' }), h('th', { className: 'px-4 py-2 text-right', text: 'Efficiency' })])),
          h('tbody', {}, res.gradeCounts.map((g) => h('tr', { className: 'border-t border-border/70' }, [
            h('td', { className: 'px-4 py-2' }, [gradePill(g, o), h('span', { className: 'ml-2 text-xs text-muted-foreground phone:hidden', text: `Score ${g.scoreLow} - ${g.scoreHigh}` })]),
            h('td', { className: 'px-4 py-2 text-right font-medium', text: String(g.character) }),
            h('td', { className: 'px-4 py-2 text-right font-medium', text: String(g.efficiency) }),
          ]))),
        ]),
      ]) : null);
      return res;
    },
    onPick: (a) => openAppraisalRecord(a, {}),
    rowKey: (a) => a.id,
    card: { title: (a) => ratingTitle(a), subtitle: (a) => `${a.serviceNumber} \u00b7 ${a.periodName}`, aside: (a) => pill(`${a.character.code} \u00b7 ${a.efficiency.code}`, 'neutral') },
    empty: { icon: 'clipboard-check', title: 'No Appraisals in This Report', text: 'No appraisal matches these filters.' },
  });
  outlet.replaceChildren(header(info, 'Report on Appraisal', [pdfBtn, xlsBtn]), bar.el, figures, grid, lv.el);
}

// =====================================================================================================
// 3. Appraisal Periods
// =====================================================================================================
export async function mountPeriods(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  try { await loadOptions(true); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const mayAdd = can('appraisal.periods', 'add');
  const mayEdit = can('appraisal.periods', 'edit');
  const strip = h('div');
  const range = (p) => `${fmt(p.start)} to ${fmt(p.end)}`;
  const reloadAll = () => { loadOptions(true).catch(() => {}); lv.reload(); };
  const lv = list({
    columns: [
      { key: 'name', label: 'Period', render: (p) => h('b', { className: 'font-medium', text: p.name }) },
      { key: 'dates', label: 'Dates', render: (p) => range(p) },
      { key: 'appraisals', label: 'Appraisals', render: (p) => String(p.appraisals) },
      { key: 'status', label: 'Status', render: (p) => PERIOD_PILL(p.open) },
    ],
    load: async ({ page }) => {
      const res = await api.get(`${BASE}/periods?${qs({ page })}`);
      const s = res.summary;
      strip.replaceChildren(statStrip([['Open', s.open, 'primary'], ['Closed', s.closed], ['Appraisals', s.appraisals]]));
      return res;
    },
    onPick: (p) => periodRecord(p),
    rowKey: (p) => p.id,
    card: { title: (p) => p.name, subtitle: (p) => range(p), aside: (p) => PERIOD_PILL(p.open) },
    empty: { icon: 'calendar', title: 'No Appraisal Periods', text: mayAdd ? 'Add the first period to start recording appraisals.' : 'No period has been added yet.' },
  });

  function periodRecord(p) {
    const dlg = detailsDialog({
      title: p.name, size: 'md',
      panels: [{ title: 'Period', rows: [['Period', h('b', { text: p.name })], ['Status', PERIOD_PILL(p.open)], ['Starts', fmt(p.start)], ['Ends', fmt(p.end)], ['Appraisals', String(p.appraisals)], ['Closed', p.open ? '-' : `${fmt(p.closedAt)}${p.closedBy ? ` by ${p.closedBy}` : ''}`]] }],
      before: p.open ? null : notice('info', 'lock', [h('b', { text: 'This period is closed and read-only. ' }), 'Its appraisals can be read and reported but not added, edited or cancelled. A closed period is final.']),
      actions: [
        can('appraisal.grading', 'view') ? button({ label: 'View Appraisals', icon: 'list', variant: 'outline', onClick: () => navigate(`#assessment/grading?period=${p.id}`) }) : null,
        mayEdit && p.open ? button({ label: 'Close Period', icon: 'lock', variant: 'outline', onClick: () => { dlg.close(); closePeriod(p); } }) : null,
        mayEdit && p.open ? button({ label: 'Edit', icon: 'pencil', variant: 'primary', onClick: () => { dlg.close(); periodForm(p); } }) : null,
      ],
    });
  }

  function periodForm(p) {
    formDialog({
      title: p ? 'Edit Period' : 'Add Period', size: 'md', submitLabel: p ? 'Save Period' : 'Add Period', submitIcon: 'check',
      children: [
        field({ label: 'Name', control: textInput({ name: 'name', maxlength: '60', value: p ? p.name : '', placeholder: 'e.g. 2027 First Half', 'aria-label': 'Name' }) }),
        h('div', { className: 'grid grid-cols-2 gap-4 phone:grid-cols-1' }, [
          field({ label: 'Start Date', control: dateInput('start', p ? p.start : '') }),
          field({ label: 'End Date', control: dateInput('end', p ? p.end : '') }),
        ]),
        p && p.appraisals ? notice('info', 'info', `${plural(p.appraisals, 'appraisal')} ${p.appraisals === 1 ? 'is' : 'are'} recorded in this period. Changing its dates does not change them.`)
          : notice('info', 'info', 'A new period opens at once. Close it when its appraisals are complete; a closed period is read-only.'),
      ],
      save: (form) => {
        const body = { name: val(form, 'name'), start: isoOf(form, 'start'), end: isoOf(form, 'end') };
        return p ? api.put(`${BASE}/periods/${p.id}`, body) : api.post(`${BASE}/periods`, body);
      },
      done: (d) => { toast(p ? `${d.name} saved.` : `${d.name} added and open.`); reloadAll(); },
    });
  }

  async function closePeriod(p) {
    let d;
    try { d = (await api.get(`${BASE}/periods/${p.id}`)).data; } catch (err) { toast(err.message, 'error'); return; }
    const missing = d.withoutAppraisal;
    const ok = await confirmDialog({
      title: 'Close Period', confirmLabel: 'Close Period', danger: true,
      message: `Close ${d.name}? It holds ${plural(d.appraisals, 'appraisal')}. ${missing ? `${plural(missing, 'current rating')} ${missing === 1 ? 'has' : 'have'} no appraisal in this period and cannot be added once it is closed. ` : ''}A closed period is final and read-only: its appraisals cannot be added, edited or cancelled.`,
    });
    if (!ok) return;
    try { await api.post(`${BASE}/periods/${p.id}/close`, {}); toast(`${d.name} closed.`); reloadAll(); } catch (err) { toast(err.message || 'Could not close the period.', 'error'); }
  }

  outlet.replaceChildren(
    header(info, 'Appraisal Periods', mayAdd ? [button({ label: 'Add Period', icon: 'plus', variant: 'primary', onClick: () => periodForm(null) })] : []),
    strip, lv.el,
  );
}
