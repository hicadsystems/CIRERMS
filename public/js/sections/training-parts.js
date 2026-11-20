/*
 * training-parts: what the five Training Drafting screens share: the dropdown rows, a form dialog
 * with errors under their fields, the two-step New Training Batch dialog, Add Ratings (by branch,
 * specialisation and rate), the open-batch picker and the batch's facts. Rules are checked on the
 * server too: a message it sends lands under its field.
 */
import { api } from '../core/api.js';
import { formatDisplayDate, parseDisplayDate, wireDateField } from '../core/dates.js';
import { navigate } from '../core/router.js';
import { can } from '../core/access.js';
import { h, cx } from '../ui/html.js';
import { button } from '../ui/button.js';
import { pill } from '../ui/pill.js';
import { facts } from '../ui/facts.js';
import { icon } from '../core/icons.js';
import { stepper } from '../ui/stepper.js';
import { openDialog } from '../ui/dialog.js';
import { field, textInput, selectInput, setFieldErrors, clearFieldErrors } from '../ui/field.js';
import { toast } from '../ui/toast.js';

export { filterBar, queryString, rowTips, previewPdf } from './disciplinary-parts.js';

export const BASE = '/api/training-drafting';
export const fmt = (v) => formatDisplayDate(v) || '';
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthOptions = () => MONTHS.map((m, i) => ({ value: i + 1, label: m }));
export const RESULTS = ['Distinction', 'Credit', 'Pass', 'Fail'];

let optionCache = null;
/** Courses, institutions, branches, specialisations and rates (the active ones). */
export async function loadOptions(force = false) {
  if (!optionCache || force) optionCache = (await api.get(`${BASE}/options`)).data;
  return optionCache;
}
export const opts = (rows) => rows.map((r) => ({ value: r.id, label: r.name }));
export const courseOpts = (rows) => rows.map((c) => ({ value: c.id, label: c.code ? `${c.name} (${c.code})` : c.name }));

export const statusPill = (b) => pill(b.status === 'open' ? 'Open' : 'Closed', b.status === 'open' ? 'warning' : 'success');

export const notice = (tone, iconName, content) => h('div', { className: cx('flex gap-2 rounded-ctl px-3 py-2 text-sm', tone === 'warning' ? 'bg-warning-soft text-warning' : tone === 'error' ? 'bg-error-soft text-error' : 'bg-info-soft text-info') },
  [icon(iconName, 'icon mt-0.5 flex-none'), h('div', { className: 'min-w-0' }, content)]);

export const dateInput = (name, value = '') => wireDateField(textInput({ name, value: fmt(value), placeholder: 'dd/mm/yyyy', inputmode: 'numeric', maxlength: '10' }));
export const val = (form, name) => {
  const el = form.querySelector(`[name="${CSS.escape(name)}"]`);
  return el ? String(el.value || '').trim() : '';
};
/** A typed date as YYYY-MM-DD; '' when empty; the typed text itself when it is not a date (the server refuses it). */
export const isoOf = (form, name) => {
  const raw = val(form, name);
  const iso = parseDisplayDate(raw);
  return iso === null ? raw : iso;
};

const span = 'col-span-2 phone:col-span-1';
export const wide = (label, control, hint) => field({ label, control, hint, className: span });
export { span };

/** A field's message goes as soon as the person changes the field. */
export function clearOnChange(form) {
  const clear = (e) => {
    const wrap = e.target && e.target.closest ? e.target.closest('[data-field]') : null;
    if (wrap) clearFieldErrors(wrap);
  };
  form.addEventListener('change', clear);
  form.addEventListener('input', clear);
}

/** A dialog with a form; save(form) makes the API call, errors land under their fields. */
export function formDialog({ title, size = 'lg', children, submitLabel, submitIcon = 'check', tone = 'primary', backLabel = 'Cancel', save, done }) {
  const form = h('form', { className: 'grid grid-cols-2 gap-4 phone:grid-cols-1', novalidate: true, autocomplete: 'off' }, children);
  clearOnChange(form);
  const dlg = openDialog({ title, size, body: form });
  const go = button({ label: submitLabel, icon: submitIcon, variant: tone, onClick: () => submit() });
  dlg.setFooter([button({ label: backLabel, variant: 'outline', onClick: () => dlg.close() }), go]);
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  async function submit() {
    clearFieldErrors(form);
    go.disabled = true;
    dlg.setDismissible(false);
    try {
      const res = await save(form);
      dlg.setDismissible(true);
      dlg.close('saved');
      done(res.data);
    } catch (err) {
      dlg.setDismissible(true);
      go.disabled = false;
      if (err.fields) setFieldErrors(form, err.fields);
      toast(err.message || 'Could not save.', 'error');
    }
  }
  return { dlg, form };
}

/** What a course is open to, in a sentence (decision 6). */
export function openTo(course, o) {
  const name = (rows, id) => (rows.find((r) => r.id === id) || {}).name || '';
  const parts = [];
  if (course.branchId) parts.push(`the ${name(o.branches, course.branchId)} branch`);
  if (course.specialisationId) parts.push(`the ${name(o.specialisations, course.specialisationId)} specialisation`);
  const who = parts.length ? parts.join(' and ') : 'every branch and specialisation';
  const rates = course.rateIds && course.rateIds.length ? ` Rates: ${course.rateIds.map((id) => name(o.rates, id)).filter(Boolean).join(', ')}.` : ' Every rate.';
  return `Open to current ratings in ${who}.${rates} A rating already in an open batch for this course is left out.`;
}

/** The Branch, Specialisation and Rate selects of a dialog, and the live count of eligible ratings that match. */
function filterPanel(o, getCourseId) {
  const sel = (name, label, rows, all) => field({ label, control: selectInput({ name, options: opts(rows), placeholder: all }) });
  const count = h('p', { className: 'text-sm font-medium', role: 'status', 'aria-live': 'polite' });
  const panel = h('div', { className: 'grid grid-cols-2 gap-4 phone:grid-cols-1' }, [
    sel('branch_id', 'Branch', o.branches, 'All Branches'),
    sel('specialisation_id', 'Specialisation', o.specialisations, 'All Specialisations'),
    h('div', { className: span }, sel('rate_id', 'Rate', o.rates, 'All Rates')),
    h('div', { className: span }, count),
  ]);
  let seq = 0;
  let matching = 0;
  async function refresh() {
    seq += 1;
    const mine = seq;
    const q = new URLSearchParams({ courseId: String(getCourseId()) });
    for (const n of ['branch_id', 'specialisation_id', 'rate_id']) {
      const el = panel.querySelector(`[name="${n}"]`);
      if (el && el.value) q.set(n, el.value);
    }
    count.textContent = 'Counting the ratings...';
    try {
      const res = (await api.get(`${BASE}/eligible?${q}`)).data;
      if (mine !== seq) return;
      matching = res.count;
      count.className = cx('text-sm font-medium', res.count ? 'text-success' : 'text-error');
      count.textContent = res.count
        ? `${res.count.toLocaleString()} of ${res.total.toLocaleString()} eligible ${res.total === 1 ? 'rating matches' : 'ratings match'}.`
        : res.total ? 'No eligible rating matches these filters.' : 'No rating is eligible: everyone this course is open to is already in an open batch for it.';
    } catch (err) {
      if (mine !== seq) return;
      matching = 0;
      count.className = 'text-sm font-medium text-error';
      count.textContent = err.message || 'Could not count the ratings.';
    }
  }
  panel.addEventListener('change', refresh);
  return { panel, refresh, matching: () => matching, values: (form) => ({ branch_id: val(form, 'branch_id'), specialisation_id: val(form, 'specialisation_id'), rate_id: val(form, 'rate_id') }) };
}

/** A button's label is its text node. */
const setLabel = (btn, text) => { const t = [...btn.childNodes].find((c) => c.nodeType === 3); if (t) t.textContent = text; };

/** New Training Batch: step 1 the course and the period, step 2 the ratings by branch, specialisation and rate. */
export async function newBatchDialog({ onDone } = {}) {
  const o = await loadOptions(true);
  const now = new Date();
  const steps = stepper({ steps: ['Course and Period', 'Select Ratings'], current: 1, onStep: (n) => go(n) });
  const courseSel = selectInput({ name: 'course_id', options: courseOpts(o.courses), placeholder: '-- Select Course --' });
  const rule = h('div', { className: 'hidden' });
  const one = h('div', { className: 'grid grid-cols-2 gap-4 phone:grid-cols-1', dataset: { step: '1' } }, [
    h('div', { className: span }, field({ label: 'Course', control: courseSel })),
    field({ label: 'Month', control: selectInput({ name: 'month', options: monthOptions(), value: now.getMonth() + 1, placeholder: '-- Select Month --' }) }),
    field({ label: 'Year', control: textInput({ name: 'year', value: String(now.getFullYear()), inputmode: 'numeric', maxlength: '4' }) }),
    h('div', { className: span }, rule),
  ]);
  const courseId = () => val(form, 'course_id');
  const filters = filterPanel(o, () => Number(courseId()));
  const two = h('div', { className: 'hidden', dataset: { step: '2' } }, [
    h('p', { className: 'mb-3 text-sm text-muted-foreground', text: 'Every eligible rating that matches is put in the batch. More can be added or removed in Training Review.' }),
    filters.panel,
  ]);
  const form = h('form', { novalidate: true, autocomplete: 'off' }, [steps.el, one, two]);
  clearOnChange(form);
  // the select is replaced by the dropdown component when the dialog opens: read it through the form
  form.addEventListener('change', (e) => {
    const t = e.target;
    if (!t || !t.getAttribute || t.getAttribute('name') !== 'course_id') return;
    const c = o.courses.find((x) => String(x.id) === courseId());
    rule.classList.toggle('hidden', !c);
    rule.replaceChildren(...(c ? [notice('info', 'info', openTo(c, o))] : []));
  });
  const dlg = openDialog({ title: 'New Training Batch', size: 'lg', body: form });
  const back = button({ label: 'Cancel', variant: 'outline', onClick: () => (step === 2 ? go(1) : dlg.close()) });
  const next = button({ label: 'Next', iconAfter: 'chevron-right', variant: 'blue', onClick: () => go(2) });
  const make = button({ label: 'Create Batch', icon: 'check', variant: 'primary', onClick: () => create() });
  dlg.setFooter([back, next]);
  let step = 1;

  async function go(n) {
    if (n === 2) {
      clearFieldErrors(form);
      const errs = {};
      if (!courseId()) errs.course_id = 'Choose the course.';
      if (!val(form, 'month')) errs.month = 'Choose the month.';
      if (!/^\d{4}$/.test(val(form, 'year'))) errs.year = 'Enter the four-digit year.';
      if (Object.keys(errs).length) { setFieldErrors(form, errs); return; }
    }
    step = n;
    steps.set(n);
    one.classList.toggle('hidden', n !== 1);
    two.classList.toggle('hidden', n !== 2);
    setLabel(back, n === 2 ? 'Back' : 'Cancel');
    dlg.setFooter([back, n === 2 ? make : next]);
    setNext();
    if (n === 2) { await filters.refresh(); setNext(); }
  }
  function setNext() {
    make.disabled = step === 2 && !filters.matching();
  }
  filters.panel.addEventListener('change', () => setTimeout(setNext, 400));

  async function create() {
    clearFieldErrors(form);
    make.disabled = true;
    dlg.setDismissible(false);
    try {
      const res = await api.post(`${BASE}/batches`, { course_id: courseId(), month: val(form, 'month'), year: val(form, 'year'), ...filters.values(form) });
      dlg.setDismissible(true);
      dlg.close('saved');
      toast(`Batch ${res.data.batchNumber} made with ${res.data.ratings} ${res.data.ratings === 1 ? 'rating' : 'ratings'}.`);
      onDone(res.data);
    } catch (err) {
      dlg.setDismissible(true);
      make.disabled = false;
      if (err.fields && (err.fields.month || err.fields.year || err.fields.course_id)) {
        await go(1);
        setFieldErrors(form, err.fields);
      } else if (err.fields) setFieldErrors(form, err.fields);
      toast(err.message || 'Could not make the batch.', 'error');
    }
  }
  return dlg;
}

/** Add Ratings / Add by Branch on an open batch: the eligible ratings that match the filters. */
export async function addByFilterDialog(batch, { onDone } = {}) {
  const o = await loadOptions(true);
  const course = o.courses.find((c) => c.id === batch.courseId);
  const filters = filterPanel(o, () => batch.courseId);
  const { dlg, form } = formDialog({
    title: `Add Ratings to ${batch.batchNumber}`, size: 'md', submitLabel: 'Add Ratings', submitIcon: 'plus', tone: 'blue',
    children: [
      h('div', { className: span }, notice('info', 'info', course ? openTo(course, o) : 'Only the ratings the course is open to can be added.')),
      h('div', { className: span }, filters.panel),
    ],
    save: () => api.post(`${BASE}/batches/${batch.id}/ratings/filter`, filters.values(form)),
    done: (r) => { toast(`${r.added} ${r.added === 1 ? 'rating' : 'ratings'} added to ${batch.batchNumber}.`); onDone(r); },
  });
  filters.refresh();
  return dlg;
}

/** Every open batch (the picker's list), however many pages there are. */
export async function allOpenBatches() {
  const out = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await api.get(`${BASE}/batches?status=open&page=${page}`);
    out.push(...res.data);
    if (page >= res.meta.totalPages) break;
  }
  return out;
}

/** The select of open batches; calls onPick(batchId | null). The dropdown component replaces the select, so the change is read from the wrapper. */
export function batchPicker(batches, { value = '', onPick }) {
  const sel = selectInput({
    name: 'batch', ariaLabel: 'Open Batch', placeholder: batches.length ? '-- Select an Open Batch --' : 'No open batches',
    options: batches.map((b) => ({ value: b.id, label: `${b.batchNumber} · ${b.course}` })), value,
  });
  const wrap = h('div', {}, sel);
  wrap.addEventListener('change', (e) => {
    const t = e.target;
    if (t && t.getAttribute && t.getAttribute('name') === 'batch') onPick(Number(t.value) || null);
  });
  wrap.startValue = value;
  return wrap;
}

export const batchRows = (b) => [
  ['Batch Number', h('b', { text: b.batchNumber })], ['Status', statusPill(b)],
  ['Training', b.course], ['Qualification', b.qualification],
  ['Period', b.period], ['Institution', b.institution],
  ['Duration', b.weeks ? `${b.weeks} ${b.weeks === 1 ? 'week' : 'weeks'}` : ''],
  ['Dates', b.startDate ? `${fmt(b.startDate)} to ${fmt(b.endDate)}` : ''],
  ['Ratings', b.status === 'closed' ? `${b.attending} attended of ${b.ratings}` : String(b.ratings)],
  ['Opened', `${fmt(b.openedAt)}${b.openedBy ? ` by ${b.openedBy}` : ''}`],
  ...(b.status === 'closed' ? [['Closed', `${fmt(b.closedAt)}${b.closedBy ? ` by ${b.closedBy}` : ''}`]] : []),
];

export const openRecord = (sn) => navigate(`#ratings/edit/${encodeURIComponent(sn)}`);
export { can };
