/*
 * Training Drafting: the five screens (the page's `view` in core/nav.js).
 *
 *   mountProcess   Process Training Draft: the open batches, New Training Batch, Add Ratings
 *   mountReview    Training Review: an open batch's ratings, Add Rating, Add by Branch, Remove
 *   mountHistory   Update Training History: Attended, Change Dates, Confirm Training History
 *   mountReports   Reports: filters, the batch list, a batch's ratings, Print PDF
 *   mountUpload    Excel Upload: Download Template, Choose File, Review, Import
 *
 * Every list is 25 a page with four key columns (cards on a phone); a row opens its record in a
 * dialog (a sheet on a phone) with a View Details tooltip on desktop. The attendance boxes stay
 * in the History table and do not open the dialog. The shared parts are in training-parts.js.
 */
import { api } from '../core/api.js';
import { navigate } from '../core/router.js';
import { icon } from '../core/icons.js';
import { h, cx, fill } from '../ui/html.js';
import { CARD, TH } from '../ui/classes.js';
import { button } from '../ui/button.js';
import { pill } from '../ui/pill.js';
import { facts, factPanels } from '../ui/facts.js';
import { pageHeader } from '../ui/page-header.js';
import { listView } from '../ui/list-view.js';
import { emptyState } from '../ui/empty-state.js';
import { confirmDialog } from '../ui/confirm.js';
import { openDialog } from '../ui/dialog.js';
import { field, selectInput } from '../ui/field.js';
import { ratingSearch } from '../ui/rating-search.js';
import { toast } from '../ui/toast.js';
import {
  BASE, fmt, RESULTS, can, loadOptions, opts, courseOpts, monthOptions, statusPill, notice, dateInput, val, isoOf, span,
  formDialog, newBatchDialog, addByFilterDialog, allOpenBatches, batchPicker, batchRows, openRecord, filterBar, queryString, rowTips, previewPdf,
} from './training-parts.js';

const PAGE = 25;
const two = (a, b) => h('span', {}, [a, b ? h('span', { className: 'block text-xs font-normal text-muted-foreground', text: b }) : null]);
const short = (rate) => String(rate || '').replace(/^.*\(([^)]+)\)$/, '$1') || rate || '';
/** A rating as the rest of the app writes it: rate, then the name. */
const who = (m) => [short(m.rate), m.name].filter(Boolean).join(' ');
const stats = (items) => h('div', { className: 'mb-4 grid grid-cols-3 gap-3 phone:gap-2', dataset: { stats: '' } }, items.map(([label, value, tone]) => h('div', { className: cx(CARD, 'min-w-0 px-4 py-3 phone:px-3') }, [
  h('div', { className: 'text-2xs font-semibold uppercase leading-4 tracking-wider text-muted-foreground', text: label }),
  h('div', { className: cx('mt-0.5 text-2xl font-semibold', tone === 'primary' ? 'text-primary-hover' : ''), text: String(value) }),
])));
/** The batch the page works on, as two panels of label and value rows. */
const batchPanels = (b, rightTitle, rightRows) => h('section', { className: cx(CARD, 'mb-4 p-4'), dataset: { batchFacts: '' } }, factPanels([
  { title: 'Batch', rows: [['Training', h('b', { text: b.course })], ['Period', b.period], ['Institution', b.institution]] },
  { title: rightTitle, rows: rightRows },
]));
const empty = (iconName, title, text, action) => h('div', { className: CARD }, emptyState({ icon: iconName, title, text, action }));
const loading = () => h('div', { className: cx(CARD, 'p-6 text-center text-sm text-muted-foreground'), role: 'status', text: 'Loading...' });

/** A page of rows cut from a list held in memory (the batch's ratings come whole). */
const pageOf = (rows, page) => ({
  data: rows.slice((page - 1) * PAGE, page * PAGE),
  meta: { total: rows.length, page, pageSize: PAGE, totalPages: Math.max(1, Math.ceil(rows.length / PAGE)) },
});

const batchColumns = () => [
  { key: 'batchNumber', label: 'Batch No' },
  { key: 'course', label: 'Training', render: (b) => two(b.course, b.period), className: 'whitespace-normal' },
  { key: 'ratings', label: 'Ratings', render: (b) => String(b.ratings) },
  { key: 'status', label: 'Status', render: (b) => statusPill(b) },
];
const batchCard = { title: (b) => b.course, subtitle: (b) => `${b.batchNumber} · ${b.period}`, aside: (b) => statusPill(b) };

// ---- 1. Process Training Draft -------------------------------------------------
export async function mountProcess(outlet, { info } = {}) {
  const lv = listView({
    columns: batchColumns(),
    load: ({ page }) => api.get(`${BASE}/batches?${queryString({ status: 'open', page })}`),
    card: batchCard,
    empty: { icon: 'graduation-cap', title: 'No Open Batches', text: can('training.process', 'add') ? 'Make one with New Training Batch.' : 'Every batch has had its history confirmed.' },
    onPick: (b) => batchDialog(b),
    onLoaded: () => figures(),
  });
  rowTips(lv.el);
  const strip = h('div');
  /** Open batches, the ratings proposed in them and the courses (every open batch, not just this page). */
  async function figures() {
    try {
      const all = await allOpenBatches();
      strip.replaceChildren(all.length ? stats([['Open Batches', all.length], ['Ratings Proposed', all.reduce((n, b) => n + b.ratings, 0), 'primary'], ['Courses', new Set(all.map((b) => b.courseId)).size]]) : '');
    } catch (_) { strip.replaceChildren(); }
  }

  function batchDialog(b) {
    const dlg = openDialog({ title: b.batchNumber, size: 'md', body: facts(batchRows(b)) });
    const acts = [button({ label: 'Close', variant: 'outline', onClick: () => dlg.close() })];
    if (can('training.review', 'view')) acts.push(button({ label: 'Open in Review', icon: 'list', variant: 'outline', onClick: () => { dlg.close(); navigate(`#training/review/${b.id}`); } }));
    if (can('training.process', 'add')) acts.push(button({ label: 'Add Ratings', icon: 'user-plus', variant: 'primary', onClick: () => { dlg.close(); addByFilterDialog(b, { onDone: () => lv.reload() }); } }));
    dlg.setFooter(acts);
  }

  const actions = can('training.process', 'add')
    ? [button({ label: 'New Training Batch', icon: 'plus', variant: 'primary', onClick: () => newBatchDialog({ onDone: (b) => { if (can('training.review', 'view')) navigate(`#training/review/${b.id}`); else lv.reload(); } }) })]
    : null;
  outlet.replaceChildren(pageHeader({ title: info ? info.title : 'Process Training Draft', subtitle: 'Open a training batch for a course and month, then choose who joins it', actions }), strip, lv.el);
}

// ---- 2 and 3: a page that works on one open batch -------------------------------
/** Review and History share the batch picker and a batch held in memory. build gets setActions(buttons) for the page header. */
async function batchScreen(outlet, { info, params, title, subtitle, build }) {
  const heading = info ? info.title : title;
  const header = (actions) => pageHeader({ title: heading, subtitle, actions });
  outlet.replaceChildren(header(null), loading());
  let batches;
  try { batches = await allOpenBatches(); } catch (err) { outlet.replaceChildren(header(null), empty('circle-alert', 'Could Not Load', err.message || 'Try again.')); return; }
  const body = h('div');
  const startId = params && params.batchId ? Number(params.batchId) : null;
  const picker = batchPicker(batches, {
    value: startId && batches.some((b) => b.id === startId) ? startId : '',
    onPick: (id) => { navigate(id ? `#${info.tab}/${id}` : `#${info.tab}`); },
  });
  const bar = h('section', { className: cx(CARD, 'mb-4 p-4') }, field({ label: 'Batch Number', control: picker }));
  const top = h('div', {}, header(null));
  const setActions = (actions) => top.replaceChildren(header(actions));
  outlet.replaceChildren(top, bar, body);
  if (!batches.length) { body.replaceChildren(empty('graduation-cap', 'No Open Batches', 'Make one on Process Training Draft, or every batch has had its history confirmed.')); return; }
  const id = picker.startValue ? Number(picker.startValue) : null;
  if (!id) { body.replaceChildren(empty('list', 'Choose a Batch', 'Pick an open batch above to see its ratings.')); return; }
  await build(body, id, () => mountAgain(), setActions);
  function mountAgain() { return batchScreen(outlet, { info, params: { batchId: id }, title, subtitle, build }); }
}

// ---- 2. Training Review -------------------------------------------------------------
export function mountReview(outlet, ctx = {}) {
  return batchScreen(outlet, {
    ...ctx, title: 'Training Review', subtitle: 'Check who goes on the course; add or remove ratings',
    async build(body, id, again, setActions) {
      let batch;
      const load = async () => { batch = (await api.get(`${BASE}/batches/${id}`)).data; };
      try { await load(); } catch (err) { body.replaceChildren(empty('circle-alert', 'Could Not Open the Batch', err.message)); return; }
      const mayEdit = can('training.review', 'edit') && batch.status === 'open';
      const lv = listView({
        columns: [
          { key: 'serviceNumber', label: 'Official No' },
          { key: 'name', label: 'Name', render: (m) => two(who(m), `LOS ${m.lengthOfService}`) },
          { key: 'lastCourse', label: 'Last Course', render: (m) => (m.lastCourseStart ? m.lastCourse : pill('First course', 'neutral')), className: 'whitespace-normal' },
        ],
        load: async ({ page }) => pageOf(batch.members, page),
        rowKey: (m) => m.serviceNumber,
        card: { title: (m) => who(m), subtitle: (m) => `${m.serviceNumber} · LOS ${m.lengthOfService}`, aside: (m) => (m.lastCourseStart ? h('span', { className: 'text-xs text-muted-foreground', text: m.lastCourse }) : pill('First course', 'neutral')) },
        empty: { icon: 'users', title: 'This Batch Is Empty', text: 'Add ratings by Official Number or by branch.' },
        onPick: (m) => memberDialog(m),
      });
      rowTips(lv.el);
      const strip = h('div');
      const head = () => {
        strip.replaceChildren(batchPanels(batch, 'Progress', [['Batch Number', h('b', { text: batch.batchNumber })], ['Initiated', `${fmt(batch.openedAt)}${batch.openedBy ? ` by ${batch.openedBy}` : ''}`], ['Ratings', String(batch.ratings)]]));
        setActions(mayEdit ? [
          button({ label: 'Add Rating', icon: 'user-plus', variant: 'primary', onClick: () => addRatingDialog() }),
          button({ label: 'Add by Branch', icon: 'users', variant: 'outline', onClick: () => addByFilterDialog(batch, { onDone: refresh }) }),
        ] : null);
      };
      const refresh = async () => { await load(); head(); lv.reload(); };
      head();

      function addRatingDialog() {
        const pick = ratingSearch({ name: 'serviceNumber', status: 'current', ariaLabel: 'Rating', placeholder: 'Official number or name' });
        formDialog({
          title: `Add Rating to ${batch.batchNumber}`, size: 'md', submitLabel: 'Add Rating', submitIcon: 'plus',
          children: [
            h('div', { className: span }, field({ label: 'Rating', control: pick, hint: `Only a current rating that ${batch.course} is open to, and who is not already in an open batch for it.` })),
          ],
          save: () => {
            if (!pick.value) { const e = new Error('Choose the rating.'); e.fields = { serviceNumber: 'Choose the rating.' }; throw e; }
            return api.post(`${BASE}/batches/${id}/ratings`, { serviceNumber: pick.value });
          },
          done: (m) => { toast(`${m.name} added.`); refresh(); },
        });
      }

      function memberDialog(m) {
        const dlg = openDialog({
          title: who(m), size: 'md',
          body: facts([['Official No', m.serviceNumber], ['Name', m.name], ['Rate', m.rate], ['Length of Service', m.lengthOfService], ['Last Course', m.lastCourse], ['Last Course Dates', m.lastCourseStart ? `${fmt(m.lastCourseStart)} to ${fmt(m.lastCourseEnd)}` : '']]),
        });
        const acts = [button({ label: 'Close', variant: 'outline', onClick: () => dlg.close() })];
        if (can('ratings.edit', 'view')) acts.push(button({ label: 'Open Record', icon: 'id-card', variant: 'outline', onClick: () => { dlg.close(); openRecord(m.serviceNumber); } }));
        if (mayEdit) {
          acts.push(button({
            label: 'Remove', icon: 'trash-2', variant: 'danger',
            onClick: async () => {
              const ok = await confirmDialog({ title: 'Remove Rating?', message: `${m.name} leaves ${batch.batchNumber}. They can be added again while the batch is open.`, confirmLabel: 'Remove', danger: true });
              if (!ok) return;
              try { await api.del(`${BASE}/batches/${id}/ratings/${encodeURIComponent(m.serviceNumber)}`); dlg.close(); toast(`${m.name} removed.`); refresh(); } catch (err) { toast(err.message || 'Could not remove.', 'error'); }
            },
          }));
        }
        dlg.setFooter(acts);
      }
      body.replaceChildren(strip, lv.el);
      void again;
    },
  });
}

// ---- 3. Update Training History -----------------------------------------------------
export function mountHistory(outlet, ctx = {}) {
  return batchScreen(outlet, {
    ...ctx, title: 'Update Training History', subtitle: 'Confirm attendance and dates; each rating gets a Training record',
    async build(body, id, again, setActions) {
      let batch;
      const load = async () => { batch = (await api.get(`${BASE}/batches/${id}`)).data; };
      try { await load(); } catch (err) { body.replaceChildren(empty('circle-alert', 'Could Not Open the Batch', err.message)); return; }
      const mayEdit = can('training.history', 'edit');

      const attend = (m) => {
        const box = h('input', { type: 'checkbox', className: 'h-5 w-5 cursor-pointer accent-primary', 'aria-label': `${m.name} attended` });
        box.checked = m.attended;
        box.disabled = !mayEdit;
        box.addEventListener('click', (e) => e.stopPropagation());
        box.addEventListener('keydown', (e) => e.stopPropagation());
        box.addEventListener('change', async () => {
          const want = box.checked;
          box.disabled = true;
          try { await api.put(`${BASE}/batches/${id}/ratings/${encodeURIComponent(m.serviceNumber)}`, { attended: want }); m.attended = want; head(); lv.reload(); } catch (err) { box.checked = !want; toast(err.message || 'Could not save.', 'error'); } finally { box.disabled = !mayEdit; }
        });
        return box;
      };
      const datesOf = (m) => (m.startDate ? `${fmt(m.startDate)} to ${fmt(m.endDate)}` : 'Batch dates');
      const datesPill = (m) => (m.attended ? pill(datesOf(m), 'info') : pill('Not attending', 'neutral'));
      const lv = listView({
        columns: [
          { key: 'serviceNumber', label: 'Official No' },
          { key: 'name', label: 'Name', render: (m) => who(m) },
          { key: 'attended', label: 'Attended', render: attend },
          { key: 'dates', label: 'This Course', render: datesPill, className: 'whitespace-normal' },
        ],
        load: async ({ page }) => pageOf(batch.members, page),
        rowKey: (m) => m.serviceNumber,
        card: { title: (m) => who(m), subtitle: (m) => `${m.serviceNumber} · ${m.attended ? datesOf(m) : 'Not attending'}`, aside: (m) => attend(m) },
        empty: { icon: 'users', title: 'This Batch Is Empty', text: 'Add ratings in Training Review first.' },
        onPick: (m) => memberDialog(m),
      });
      rowTips(lv.el);
      const strip = h('div');
      const head = () => {
        const n = batch.members.filter((m) => m.attended).length;
        strip.replaceChildren(batchPanels(batch, 'Progress', [['Batch Number', h('b', { text: batch.batchNumber })], ['Ratings', String(batch.members.length)], ['Attending', `${n} of ${batch.members.length}`]]));
        setActions(mayEdit ? [button({ label: 'Confirm Training History', icon: 'check', variant: 'primary', disabled: !n, onClick: () => confirmForm() })] : null);
      };
      head();

      function memberDialog(m) {
        const dlg = openDialog({
          title: who(m), size: 'md',
          body: facts([['Official No', m.serviceNumber], ['Name', m.name], ['Rate', m.rate], ['Last Course', m.lastCourse], ['Attended', m.attended ? 'Yes' : 'No'], ['Dates', m.attended ? (m.startDate ? `${fmt(m.startDate)} to ${fmt(m.endDate)} (own dates)` : 'The batch dates') : '']]),
        });
        const acts = [button({ label: 'Close', variant: 'outline', onClick: () => dlg.close() })];
        if (can('ratings.edit', 'view')) acts.push(button({ label: 'Open Record', icon: 'id-card', variant: 'outline', onClick: () => { dlg.close(); openRecord(m.serviceNumber); } }));
        if (mayEdit && m.attended) acts.push(button({ label: 'Change Dates', icon: 'calendar', variant: 'primary', onClick: () => { dlg.close(); datesDialog(m); } }));
        dlg.setFooter(acts);
      }

      function datesDialog(m) {
        const { form } = formDialog({
          title: `Change Dates: ${m.name}`, size: 'md', submitLabel: 'Save Dates',
          children: [
            h('div', { className: span }, notice('info', 'info', `The batch's dates apply unless this rating has its own. Clear both to go back to the batch's dates.`)),
            field({ label: 'Start Date', control: dateInput('start_date', m.startDate) }),
            field({ label: 'End Date', control: dateInput('end_date', m.endDate) }),
          ],
          save: (f) => api.put(`${BASE}/batches/${id}/ratings/${encodeURIComponent(m.serviceNumber)}`, { start_date: isoOf(f, 'start_date'), end_date: isoOf(f, 'end_date') }),
          done: async () => { toast('Dates saved.'); await load(); lv.reload(); },
        });
        if (!mayEdit) form.querySelectorAll('input').forEach((i) => { i.disabled = true; });
      }

      async function confirmForm() {
        const o = await loadOptions(true);
        const attending = batch.members.filter((m) => m.attended);
        const results = attending.map((m) => field({
          label: `${who(m)} (${m.serviceNumber})`, className: span,
          control: selectInput({ name: `results.${m.serviceNumber}`, options: RESULTS.map((r) => ({ value: r, label: r })), placeholder: '-- Result --' }),
        }));
        formDialog({
          title: 'Confirm Training History', size: 'xl', submitLabel: 'Confirm and Close Batch', submitIcon: 'circle-check',
          children: [
            h('div', { className: span }, notice('warning', 'triangle-alert', [`This adds a Training entry to the record of `, h('b', { text: `${attending.length} ${attending.length === 1 ? 'rating' : 'ratings'}` }), ` and closes ${batch.batchNumber}. A closed batch is final: a mistake is put right on the rating's record, under the audit trail.`])),
            h('div', { className: span }, field({ label: 'Institution', control: selectInput({ name: 'institution_id', options: opts(o.institutions), value: batch.institutionId || '', placeholder: '-- Select Institution --' }) })),
            field({ label: 'Start Date', control: dateInput('start_date', batch.startDate) }),
            field({ label: 'End Date', control: dateInput('end_date', batch.endDate) }),
            h('div', { className: cx(span, 'text-2xs font-semibold uppercase tracking-wider text-muted-foreground'), text: 'Result of each rating that attended' }),
            ...(results.length ? results : [h('div', { className: span }, notice('error', 'circle-alert', 'Nobody is marked as attended. Tick the ratings who attended first.'))]),
          ],
          save: (f) => api.post(`${BASE}/batches/${id}/confirm`, {
            institution_id: val(f, 'institution_id'), start_date: isoOf(f, 'start_date'), end_date: isoOf(f, 'end_date'),
            results: Object.fromEntries(attending.map((m) => [m.serviceNumber, val(f, `results.${m.serviceNumber}`)])),
          }),
          done: (b) => { toast(`${b.batchNumber} confirmed and closed. ${b.attending} ${b.attending === 1 ? 'record' : 'records'} updated.`); again(); },
        });
      }

      body.replaceChildren(strip, lv.el);
    },
  });
}

// ---- 4. Reports --------------------------------------------------------------------------
export async function mountReports(outlet, { info } = {}) {
  const o = await loadOptions(true);
  const count = h('div', { className: 'mb-3 text-sm text-muted-foreground' });
  const bar = filterBar({
    fields: [
      { name: 'courseId', label: 'Training', type: 'select', options: courseOpts(o.courses), placeholder: 'All Training', span: 'col-span-2 phone:col-span-1' },
      { name: 'month', label: 'Month', type: 'select', options: monthOptions(), placeholder: 'All Months' },
      { name: 'year', label: 'Year', type: 'text', placeholder: 'e.g. 2026' },
      { name: 'batchNumber', label: 'Batch No', type: 'text', placeholder: 'e.g. DOT-2026', span: 'col-span-2 phone:col-span-1' },
    ],
    onChange: () => lv.reload({ resetPage: true }),
  });
  const lv = listView({
    columns: batchColumns(),
    load: ({ page }) => api.get(`${BASE}/batches?${queryString({ ...bar.query(), page })}`),
    card: batchCard,
    empty: { icon: 'file-text', title: 'No Batches', text: 'No batch matches these filters.' },
    onPick: (b) => batchDialog(b),
    onLoaded: ({ meta }) => { count.textContent = `${meta.total.toLocaleString()} ${meta.total === 1 ? 'batch' : 'batches'}`; },
  });
  rowTips(lv.el);

  async function batchDialog(row) {
    let b;
    try { b = (await api.get(`${BASE}/batches/${row.id}`)).data; } catch (err) { toast(err.message || 'Could not open the batch.', 'error'); return; }
    const ratings = b.members.length
      ? h('div', { className: 'mt-4 overflow-x-auto' }, h('table', { className: 'w-full text-sm' }, [
        h('thead', { className: 'bg-subtle' }, h('tr', {}, ['Official No', 'Name', b.status === 'closed' ? 'Result' : 'This Course'].map((t) => h('th', { className: TH, scope: 'col', text: t })))),
        h('tbody', {}, b.members.map((m) => h('tr', { className: 'border-t border-border' }, [
          h('td', { className: 'whitespace-nowrap px-4 py-2', text: m.serviceNumber }),
          h('td', { className: 'px-4 py-2', text: who(m) }),
          h('td', { className: 'px-4 py-2' }, b.status === 'closed' ? (m.attended ? pill(m.result || 'Attended', 'success') : pill('Did not attend', 'neutral')) : pill('Proposed', 'info')),
        ]))),
      ]))
      : h('p', { className: 'mt-4 text-sm text-muted-foreground', text: 'No ratings in this batch.' });
    const dlg = openDialog({ title: b.batchNumber, size: 'lg', body: h('div', {}, [facts(batchRows(b)), h('div', { className: 'mt-4 text-2xs font-semibold uppercase tracking-wider text-muted-foreground', text: `Ratings (${b.members.length})` }), ratings]) });
    dlg.setFooter([
      button({ label: 'Close', variant: 'outline', onClick: () => dlg.close() }),
      button({ label: 'Print PDF', icon: 'printer', variant: 'blue', onClick: () => previewPdf(`${BASE}/batches/${b.id}/pdf`, `Training Draft Report ${b.batchNumber}`, `Training Draft Report ${b.batchNumber}.pdf`) }),
    ]);
  }
  outlet.replaceChildren(pageHeader({ title: info ? info.title : 'Training Reports', subtitle: 'Batches by training, month, year and number' }), bar.el, count, lv.el);
}

// ---- 5. Excel Upload -----------------------------------------------------------------------------
function stepHead(n, title, state) {
  const done = state === 'done';
  return h('div', { className: 'flex items-center gap-3' }, [
    h('span', { className: cx('flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-semibold', done ? 'bg-primary text-primary-foreground' : state === 'on' ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground') }, done ? icon('check') : String(n)),
    h('h2', { className: 'text-sm font-semibold', text: title }),
  ]);
}

export function mountUpload(outlet, { info } = {}) {
  let file = null;
  let review = null;
  let result = null;
  let busy = false;
  const mayAdd = can('training.upload', 'add');
  const input = h('input', { type: 'file', accept: '.xlsx', className: 'hidden', 'aria-label': 'Workbook' });
  input.addEventListener('change', () => {
    const f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) { toast('Choose an .xlsx workbook.', 'error'); return; }
    file = f; review = null; result = null; draw();
  });
  const s1 = h('section', { className: cx(CARD, 'space-y-3 p-4') });
  const s2 = h('section', { className: cx(CARD, 'space-y-3 p-4') });
  const s3 = h('section', { className: cx(CARD, 'space-y-3 p-4') });
  const report = h('div');

  async function template() {
    try { await api.downloadFile(`${BASE}/upload/template`, 'CIRERMS_Training_Upload_Template.xlsx'); toast('Template downloaded.'); } catch (err) { toast(err.message || 'Could not download the template.', 'error'); }
  }
  async function send(path) {
    const fd = new FormData();
    fd.append('file', file);
    return (await api.upload(`${BASE}/upload/${path}`, fd)).data;
  }
  async function run(path) {
    if (!file || busy) return;
    busy = true; draw();
    try {
      if (path === 'review') { review = await send('review'); result = null; } else { result = await send('import'); review = null; toast(`${result.imported} ${result.imported === 1 ? 'entry' : 'entries'} imported.`, result.imported ? 'success' : 'warning'); }
    } catch (err) { toast(err.message || 'The workbook could not be read.', 'error', { timeout: 8000 }); } finally { busy = false; draw(); }
  }
  const TONE = { success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', error: 'bg-error-soft text-error' };
  const tile = (n, label, tone) => h('div', { className: cx('rounded-ctl p-2 text-center', TONE[tone]) }, [h('b', { className: 'block text-lg', text: String(n) }), h('span', { className: 'text-2xs', text: label })]);

  function problems(list) {
    return list.length ? h('section', { className: cx(CARD, 'mt-4 overflow-hidden') }, [
      h('div', { className: 'border-b border-border px-4 py-3' }, h('h2', { className: 'text-sm font-semibold', text: 'Rows Not Imported' })),
      h('div', { className: 'overflow-x-auto' }, h('table', { className: 'w-full text-sm' }, [
        h('thead', { className: 'bg-subtle' }, h('tr', {}, ['Row', 'Official No', 'Field', 'Problem'].map((t) => h('th', { className: TH, scope: 'col', text: t })))),
        h('tbody', {}, list.map((p) => h('tr', { className: 'border-t border-border' }, [
          h('td', { className: 'whitespace-nowrap px-4 py-2.5 font-medium', text: `Row ${p.row}` }),
          h('td', { className: 'whitespace-nowrap px-4 py-2.5', text: p.serviceNumber || '-' }),
          h('td', { className: 'whitespace-nowrap px-4 py-2.5', text: p.field }),
          h('td', { className: 'px-4 py-2.5' }, [pill(p.kind === 'skipped' ? 'Skipped' : 'Error', p.kind === 'skipped' ? 'warning' : 'error'), ' ', p.problem]),
        ]))),
      ])),
    ]) : null;
  }

  function draw() {
    fill(s1, [
      stepHead(1, 'Download Template', file ? 'done' : 'on'),
      h('p', { className: 'text-sm text-muted-foreground', text: 'Official No, Course, Institution, Qualification, Start Date, End Date and Authority. The workbook lists the courses and institutions it accepts.' }),
      button({ label: 'Download Template', icon: 'file-spreadsheet', variant: 'blue', onClick: template }),
    ]);
    fill(s2, [
      stepHead(2, 'Choose File', file ? 'done' : 'on'),
      h('button', {
        type: 'button',
        className: 'flex w-full flex-col items-center gap-2 rounded-card border-2 border-dashed border-input bg-subtle px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15',
        onClick: () => input.click(),
      }, [icon('file-up', 'icon h-7 w-7'), file ? h('b', { className: 'break-all text-foreground', text: file.name }) : 'Choose an .xlsx workbook', file ? h('span', { text: 'Choose a different file' }) : null]),
      input,
    ]);
    s2.classList.toggle('hidden', !mayAdd);
    s3.classList.toggle('hidden', !mayAdd);
    const body = [stepHead(3, 'Review and Import', result ? 'done' : review ? 'on' : 'off')];
    if (result) body.push(h('div', { className: 'grid grid-cols-3 gap-2' }, [tile(result.imported, 'Imported', 'success'), tile(result.skipped, 'Skipped', 'warning'), tile(result.errors, 'Errors', 'error')]));
    else if (review) body.push(h('div', { className: 'grid grid-cols-3 gap-2' }, [tile(review.importable, 'Ready to Import', 'success'), tile(review.skipped, 'Skipped', 'warning'), tile(review.errors, 'Errors', 'error')]));
    else body.push(h('p', { className: 'text-sm text-muted-foreground', text: file ? 'Review reads every row first and changes nothing.' : 'Choose a workbook to review it.' }));
    body.push(h('div', { className: 'flex flex-wrap gap-2' }, [
      button({ label: busy && !review ? 'Reviewing' : 'Review', icon: busy && !review ? 'loader-circle' : 'eye', variant: 'blue', className: 'flex-1', disabled: !file || busy || !!result, onClick: () => run('review') }),
      button({ label: busy && review ? 'Importing' : review ? `Import ${review.importable}` : 'Import', icon: 'check', variant: 'primary', className: 'flex-1', disabled: !review || !review.importable || busy, onClick: () => run('import') }),
    ]));
    fill(s3, body);
    fill(report, [problems((result || review || { problems: [] }).problems), result ? h('p', { className: 'mt-3 text-sm text-muted-foreground', text: `${result.total} ${result.total === 1 ? 'row' : 'rows'} read. The rows that were right went in together; the others are listed above.` }) : null]);
  }
  outlet.replaceChildren(
    pageHeader({ title: info ? info.title : 'Training Excel Upload', subtitle: 'Add Training entries to many records from one workbook' }),
    h('div', { className: 'grid grid-cols-3 gap-4 phone:grid-cols-1' }, [s1, s2, s3]),
    report,
  );
  draw();
}
