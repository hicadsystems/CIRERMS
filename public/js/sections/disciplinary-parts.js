/*
 * disciplinary-parts: what the four Disciplinary Action screens and the rating's Discipline tab
 * share: the filter bar, the "View Details" row tooltip, the case dialog (facts, corrections and
 * the actions the person may use), the forms (Open Case, Conclude, Cancel, Correct) and the PDF
 * preview. Rules are checked on the server too; a message it sends lands under its field.
 *
 *   caseDialog(c, { readOnly, onChange })      a case's record; readOnly hides Conclude, Cancel and Correct
 *   openCaseForm(rating, { onDone })            Initiate Incident's form
 *   filterBar({ fields, onChange })             { el, values(), bad() }
 *   rowTips(listEl)                             the "View Details" tooltip on a list's rows
 *   disciplinePanel(serviceNumber)                    the Discipline tab's list (read only)
 *   previewPdf(url, title, fileName)            a PDF from the API in a preview dialog
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { formatDisplayDate, parseDisplayDate, wireDateField } from '../core/dates.js';
import { previewBlobModal } from '../core/dom.js';
import { navigate } from '../core/router.js';
import { h, cx } from '../ui/html.js';
import { INPUT, CARD } from '../ui/classes.js';
import { button } from '../ui/button.js';
import { pill } from '../ui/pill.js';
import { facts } from '../ui/facts.js';
import { icon } from '../core/icons.js';
import { openDialog, closeAllDialogs } from '../ui/dialog.js';
import { field, textInput, selectInput, setFieldErrors, clearFieldErrors } from '../ui/field.js';
import { toast } from '../ui/toast.js';
import { listView } from '../ui/list-view.js';

export const fmt = (v) => formatDisplayDate(v) || '';
const BASE = '/api/disciplinary';

/** Dropdown rows: the active ones, and the one a record already holds even when inactive. */
export const choices = (rows, held) => rows
  .filter((r) => r.active || r.id === Number(held))
  .map((r) => ({ value: r.id, label: r.active ? r.name : `${r.name} (Inactive)` }));

export const statusPill = (c) => pill(
  c.status === 'pending' ? 'Pending' : c.status === 'concluded' ? 'Concluded' : 'Cancelled',
  c.status === 'pending' ? 'warning' : c.status === 'concluded' ? 'success' : 'neutral',
);

const textarea = (name, value = '', { rows = 3, max = 250, placeholder = '' } = {}) => {
  const t = h('textarea', { name, rows: String(rows), maxlength: String(max), placeholder, className: INPUT.replace('phone:h-tap', '') });
  t.value = value || '';
  return t;
};
const dateInput = (name, value = '') => wireDateField(textInput({ name, value: fmt(value), placeholder: 'dd/mm/yyyy', inputmode: 'numeric', maxlength: '10' }));
const val = (form, name) => {
  const el = form.querySelector(`[name="${CSS.escape(name)}"]`);
  return el ? String(el.value || '').trim() : '';
};
/** A typed date as YYYY-MM-DD; '' when empty; the typed text itself when it is not a date (the server refuses it). */
const isoOf = (form, name) => {
  const raw = val(form, name);
  const iso = parseDisplayDate(raw);
  return iso === null ? raw : iso;
};
const notice = (tone, iconName, html) => h('div', { className: cx('flex gap-2 rounded-ctl px-3 py-2 text-sm', tone === 'warning' ? 'bg-warning-soft text-warning' : tone === 'error' ? 'bg-error-soft text-error' : 'bg-info-soft text-info') },
  [icon(iconName, 'icon mt-0.5 flex-none'), h('div', { className: 'min-w-0' }, html)]);

// ---- PDF preview -----------------------------------------------------------
export async function previewPdf(url, title, fileName) {
  try {
    const { blob, mimeType, fileName: name } = await api.fetchBlob(url);
    previewBlobModal({ title, blob, mimeType: mimeType || 'application/pdf', fileName: name || fileName });
  } catch (err) {
    toast(err.message || 'Could not make the printout.', 'error');
  }
}

// ---- "View Details" tooltip under the pointer (desktop) ---------------------
let tip = null;
export function rowTips(listEl) {
  const tipEl = () => {
    if (!tip) {
      tip = h('div', { role: 'tooltip', className: 'pointer-events-none fixed z-[60] hidden whitespace-nowrap rounded-ctl bg-foreground px-2 py-1 text-xs font-medium text-background shadow-pop' });
      document.body.appendChild(tip);
    }
    return tip;
  };
  const hide = () => { if (tip) tip.classList.add('hidden'); };
  listEl.addEventListener('pointermove', (e) => {
    const row = e.target.closest && e.target.closest('tbody tr[tabindex]');
    if (!row || e.pointerType === 'touch') { hide(); return; }
    const t = tipEl();
    t.textContent = 'View Details';
    t.classList.remove('hidden');
    t.style.left = `${Math.max(8, Math.min(e.clientX - 6, window.innerWidth - t.offsetWidth - 8))}px`;
    t.style.top = `${Math.min(e.clientY + 20, window.innerHeight - t.offsetHeight - 8)}px`;
  });
  listEl.addEventListener('pointerleave', hide);
  listEl.addEventListener('click', hide);
  return listEl;
}

// ---- filter bar ------------------------------------------------------------
/**
 * fields: [{ name, label, type: 'text' | 'select' | 'date', options, placeholder, span }]
 * Text applies after a short pause, selects and dates when changed. A date typed wrongly or a From
 * after To is reported by bad() and shown above the list; the list does not reload then.
 */
export function filterBar({ fields, onChange }) {
  const values = {};
  fields.forEach((f) => { values[f.name] = ''; });
  let timer = null;
  let syncing = false;
  const iso = (name) => parseDisplayDate(values[name]);
  const labelOf = (name) => (fields.find((f) => f.name === name) || {}).label || name;

  function bad() {
    for (const f of fields.filter((x) => x.type === 'date')) {
      if (values[f.name] && iso(f.name) === null) return `${f.label} is not a date. Use dd/mm/yyyy.`;
    }
    const from = fields.find((f) => f.name === 'from');
    const to = fields.find((f) => f.name === 'to');
    if (from && to && values.from && values.to && iso('from') > iso('to')) return `${labelOf('from')} is after ${labelOf('to')}. Swap the dates.`;
    return '';
  }
  /** What the API takes: dates as YYYY-MM-DD, empty values left out. */
  const query = () => {
    const q = {};
    fields.forEach((f) => {
      if (!values[f.name]) return;
      q[f.name] = f.type === 'date' ? iso(f.name) : values[f.name];
    });
    return q;
  };
  // a change is reported once: Enter, then the field losing focus, are one change
  let last = JSON.stringify(values);
  const emit = () => {
    const now = JSON.stringify(values);
    if (now === last) return;
    last = now;
    onChange({ ...values });
  };

  const controls = fields.map((f) => {
    let control;
    if (f.type === 'select') control = selectInput({ name: f.name, options: f.options || [], value: '', placeholder: f.placeholder || `All ${f.label}s`, 'aria-label': f.label });
    else if (f.type === 'date') control = wireDateField(textInput({ name: f.name, placeholder: 'dd/mm/yyyy', inputmode: 'numeric', maxlength: '10', 'aria-label': f.label }));
    else control = textInput({ name: f.name, type: 'search', placeholder: f.placeholder || '', autocomplete: 'off', 'aria-label': f.label });
    return field({ label: f.label, control, className: f.span || '' });
  });
  const count = h('span', { className: cx('ml-1 rounded-full bg-info-soft px-1.5 text-2xs font-semibold text-info', 'hidden') });
  const panel = h('div', { className: 'grid grid-cols-6 gap-3 p-3 phone:grid-cols-1 phone:hidden' }, controls);
  const toggle = h('button', { type: 'button', 'aria-expanded': 'false', className: 'flex h-tap w-full items-center gap-2 px-3 text-sm font-medium desk:hidden' }, [icon('funnel'), 'Filters', count]);
  toggle.addEventListener('click', () => {
    const open = panel.classList.toggle('phone:hidden') === false;
    toggle.setAttribute('aria-expanded', String(open));
  });
  const el = h('div', { className: cx(CARD, 'mb-3'), dataset: { filters: '' } }, [toggle, panel]);

  const sync = () => {
    const n = fields.filter((f) => values[f.name]).length;
    count.textContent = String(n);
    count.classList.toggle('hidden', !n);
  };
  el.addEventListener('input', (e) => {
    const name = e.target.getAttribute && e.target.getAttribute('name');
    const f = fields.find((x) => x.name === name);
    if (!f || f.type !== 'text') return;
    values[name] = e.target.value.trim();
    clearTimeout(timer);
    timer = setTimeout(() => { sync(); emit(); }, 300);
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches && e.target.matches('input')) { e.preventDefault(); clearTimeout(timer); values[e.target.name] = e.target.value.trim(); sync(); emit(); }
  });
  el.addEventListener('change', (e) => {
    const name = e.target.getAttribute && e.target.getAttribute('name');
    const f = fields.find((x) => x.name === name);
    if (syncing || !f || f.type === 'text') return;
    values[name] = e.target.value.trim();
    sync();
    emit();
  });
  return {
    el,
    values: () => ({ ...values }),
    query,
    bad,
    reset() {
      syncing = true;
      fields.forEach((f) => { values[f.name] = ''; const c = el.querySelector(`[name="${CSS.escape(f.name)}"]`); if (c) c.value = ''; });
      syncing = false;
      sync();
      emit();
    },
  };
}

export const queryString = (obj) => new URLSearchParams(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined)).toString();

// ---- the case dialog ---------------------------------------------------------
export function caseRows(c) {
  const rows = [
    ['Case Number', h('b', { text: c.caseNumber })], ['Status', statusPill(c)],
    ['Official No', c.serviceNumber], ['Name', c.name],
    ['Rate at the Time', c.rate], ['Ship at the Time', c.ship],
    ['Offence', c.offence], ['Incident Date', fmt(c.incidentDate)],
    ['Reported By', c.reportedBy], ['Opened', `${fmt(c.openedAt)}${c.openedBy ? ` by ${c.openedBy}` : ''}`],
    ['What Happened', c.what],
  ];
  if (c.status === 'concluded') rows.push(['Decision Date', fmt(c.decisionDate)], ['Sanction', c.sanction], ['Authority', c.authority], ['Concluded', `${fmt(c.concludedAt)}${c.concludedBy ? ` by ${c.concludedBy}` : ''}`], ['Decision', c.decision]);
  if (c.status === 'cancelled') rows.push(['Cancelled', `${fmt(c.cancelledAt)}${c.cancelledBy ? ` by ${c.cancelledBy}` : ''}`], ['Reason', c.cancelReason]);
  return rows;
}

const LONG = new Set(['Reported By', 'What Happened', 'Decision', 'Reason']);

function correctionsBlock(c) {
  if (!c.corrections || !c.corrections.length) return null;
  return h('div', { className: 'mt-4 border-t border-border pt-3', dataset: { corrections: '' } }, [
    h('div', { className: 'mb-2 text-2xs font-semibold uppercase tracking-wider text-muted-foreground', text: 'Corrections' }),
    h('ol', { className: 'space-y-2' }, c.corrections.map((k) => h('li', { className: 'rounded-card border border-border bg-subtle/60 p-3 text-sm' }, [
      h('div', { className: 'flex flex-wrap items-center gap-2' }, [h('b', { text: fmt(k.at) }), h('span', { className: 'text-xs text-muted-foreground', text: k.by ? `by ${k.by}` : '' })]),
      h('p', { className: 'mt-1 break-words', text: k.reason }),
      h('ul', { className: 'mt-1.5 space-y-0.5 text-xs text-muted-foreground' }, k.changes.map(([f, a, b]) => h('li', { className: 'break-words' }, [h('b', { className: 'font-medium text-foreground', text: `${f}: ` }), `${a || '-'} → ${b || '-'}`]))),
    ]))),
  ]);
}

/** Opens a case's record. The case is read again so its corrections are there. */
export async function caseDialog(row, { readOnly = false, onChange = () => {} } = {}) {
  let c = row;
  try { c = (await api.get(`${BASE}/cases/${row.id}`)).data; } catch (err) { toast(err.message || 'Could not open the case.', 'error'); return null; }
  const finished = (msg) => { closeAllDialogs(); if (msg) toast(msg); onChange(); };
  const body = h('div', {}, [
    c.status === 'concluded' ? h('div', { className: 'mb-4' }, notice('info', 'info', ['A concluded case is final. A mistake is changed with ', h('b', { text: 'Correct' }), ', which needs a reason and is recorded in the audit trail.'])) : null,
    facts(caseRows(c).filter(([k]) => !LONG.has(k)), { columns: 2 }),
    facts(caseRows(c).filter(([k]) => LONG.has(k)), { columns: 1, className: 'mt-3' }),
    correctionsBlock(c),
  ]);
  const dlg = openDialog({ title: `${c.caseNumber} · ${c.serviceNumber}`, size: 'lg', body });
  const acts = [button({ label: 'Close', variant: 'outline', onClick: () => dlg.close() })];
  if (can('ratings.edit', 'view')) acts.push(button({ label: 'Open Record', icon: 'id-card', variant: 'outline', onClick: () => { closeAllDialogs(); navigate(`#ratings/edit/${encodeURIComponent(c.serviceNumber)}`); } }));
  acts.push(button({ label: 'Print Case', icon: 'printer', variant: 'outline', onClick: () => previewPdf(`${BASE}/cases/${c.id}/pdf`, `Case ${c.caseNumber}`, `Case ${c.caseNumber}.pdf`) }));
  if (!readOnly && c.status === 'pending' && can('disciplinary.pending', 'delete')) acts.push(button({ label: 'Cancel Case', icon: 'x', variant: 'outline', className: 'text-destructive', onClick: () => cancelDialog(c, finished) }));
  if (!readOnly && c.status === 'pending' && can('disciplinary.pending', 'approve')) acts.push(button({ label: 'Conclude', icon: 'gavel', variant: 'primary', onClick: () => concludeDialog(c, finished) }));
  if (!readOnly && c.status === 'concluded' && can('disciplinary.concluded', 'edit')) acts.push(button({ label: 'Correct', icon: 'pencil', variant: 'primary', onClick: () => correctDialog(c, finished) }));
  dlg.setFooter(acts);
  return dlg;
}

const strip = (c) => h('div', { className: 'rounded-card border border-border bg-subtle/60 p-3 text-sm' }, [
  h('b', { text: `${c.name}` }), h('span', { className: 'block text-xs text-muted-foreground', text: [c.serviceNumber, c.rate, c.ship].filter(Boolean).join(' · ') }),
]);

/** A dialog with a form; submit(form) returns the API call, errors land under their fields. */
function formDialog({ title, size = 'lg', children, submitLabel, submitIcon = 'check', tone = 'primary', backLabel = 'Cancel', save, done }) {
  const form = h('form', { className: 'grid grid-cols-2 gap-4 phone:grid-cols-1', novalidate: true, autocomplete: 'off' }, children);
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

const span = 'col-span-2 phone:col-span-1';
const wide = (label, control, hint) => field({ label, control, hint, className: span });

let optionCache = null;
export async function loadOptions(force = false) {
  if (!optionCache || force) optionCache = (await api.get(`${BASE}/options`)).data;
  return optionCache;
}

/** Initiate Incident's form for one rating (a row of /ratings). */
export async function openCaseForm(r, { onDone = () => {} } = {}) {
  const o = await loadOptions(true);
  const pend = r.pendingCases ? h('span', { className: 'text-xs text-warning', text: `${r.pendingCases} pending` }) : null;
  formDialog({
    title: 'Initiate Incident', submitLabel: 'Open Case', submitIcon: 'gavel',
    children: [
      h('div', { className: span }, h('div', { className: 'flex items-center gap-3 rounded-card border border-border bg-subtle/60 p-3' }, [
        h('div', { className: 'min-w-0 flex-1' }, [h('b', { className: 'block truncate text-sm', text: r.name }), h('span', { className: 'block truncate text-xs text-muted-foreground', text: [r.serviceNumber, r.rate, r.ship].filter(Boolean).join(' · ') })]), pend])),
      field({ label: 'Incident Date', control: dateInput('incident_date') }),
      field({ label: 'Offence', control: selectInput({ name: 'offence_id', options: choices(o.offences), placeholder: '-- Select Offence --' }) }),
      wide('What Happened', textarea('what_happened', '', { placeholder: 'Describe the incident: where, when and what was done' }), 'Up to 250 characters.'),
      wide('Reported By', textInput({ name: 'reported_by', placeholder: 'e.g. Lt Cdr A. Eze (Divisional Officer)', maxlength: '150' })),
      h('div', { className: span }, notice('info', 'info', ['The case opens as ', h('b', { text: 'Pending' }), '. Concluding it, with the sanction, is a separate step on Pending Cases.'])),
    ],
    save: (form) => api.post(`${BASE}/cases`, { serviceNumber: r.serviceNumber, incident_date: isoOf(form, 'incident_date'), offence_id: val(form, 'offence_id'), what_happened: val(form, 'what_happened'), reported_by: val(form, 'reported_by') }),
    done: (c) => { toast(`Case ${c.caseNumber} opened for ${r.name}.`); onDone(c); },
  });
}

async function concludeDialog(c, finished) {
  const o = await loadOptions(true);
  formDialog({
    title: 'Conclude Case', submitLabel: 'Conclude Case', submitIcon: 'gavel',
    children: [
      h('div', { className: span }, strip(c)),
      h('div', { className: cx(span, 'rounded-card border border-border bg-subtle/60 p-3 text-sm') }, [h('b', { text: c.offence }), ` · incident ${fmt(c.incidentDate)}`, h('span', { className: 'mt-1 block break-words text-muted-foreground', text: c.what })]),
      field({ label: 'Decision Date', control: dateInput('decision_date') }),
      field({ label: 'Sanction', control: selectInput({ name: 'sanction_id', options: choices(o.sanctions), placeholder: '-- Select Sanction --' }) }),
      wide('Decision', textarea('decision', '', { placeholder: 'The finding and what was awarded' }), 'Up to 250 characters.'),
      wide('Authority', textInput({ name: 'authority', placeholder: 'e.g. Commanding Officer', maxlength: '150' })),
      h('div', { className: span }, notice('warning', 'triangle-alert', ['Concluding is final. A later change is made with ', h('b', { text: 'Correct' }), ' on Concluded Cases, which needs a reason and is recorded in the audit trail.'])),
    ],
    save: (form) => api.post(`${BASE}/cases/${c.id}/conclude`, { decision_date: isoOf(form, 'decision_date'), sanction_id: val(form, 'sanction_id'), decision: val(form, 'decision'), authority: val(form, 'authority') }),
    done: (r) => finished(`Case ${r.caseNumber} concluded: ${r.sanction}.`),
  });
}

function cancelDialog(c, finished) {
  formDialog({
    title: 'Cancel Case', size: 'md', submitLabel: 'Cancel Case', submitIcon: 'x', tone: 'danger', backLabel: 'Keep Case',
    children: [
      h('div', { className: span }, strip(c)),
      h('div', { className: cx(span, 'text-sm') }, [h('b', { text: c.caseNumber }), ` · ${c.offence}, incident ${fmt(c.incidentDate)}`]),
      wide('Reason', textarea('reason', '', { max: 200, placeholder: 'Why the case is being cancelled' }), 'Required. It is kept in the audit trail.'),
      h('div', { className: span }, notice('info', 'info', 'Use this for a case opened by mistake. It leaves the lists; nothing is deleted and the audit trail keeps it with this reason.')),
    ],
    save: (form) => api.post(`${BASE}/cases/${c.id}/cancel`, { reason: val(form, 'reason') }),
    done: (r) => finished(`Case ${r.caseNumber} cancelled.`),
  });
}

async function correctDialog(c, finished) {
  const o = await loadOptions(true);
  formDialog({
    title: `Correct ${c.caseNumber}`, size: 'xl', submitLabel: 'Save Correction',
    children: [
      h('div', { className: span }, strip(c)),
      field({ label: 'Offence', control: selectInput({ name: 'offence_id', options: choices(o.offences, c.offenceId), value: c.offenceId, placeholder: '-- Select Offence --' }) }),
      field({ label: 'Incident Date', control: dateInput('incident_date', c.incidentDate) }),
      wide('What Happened', textarea('what_happened', c.what)),
      wide('Reported By', textInput({ name: 'reported_by', value: c.reportedBy, maxlength: '150' })),
      field({ label: 'Decision Date', control: dateInput('decision_date', c.decisionDate) }),
      field({ label: 'Sanction', control: selectInput({ name: 'sanction_id', options: choices(o.sanctions, c.sanctionId), value: c.sanctionId, placeholder: '-- Select Sanction --' }) }),
      wide('Decision', textarea('decision', c.decision)),
      wide('Authority', textInput({ name: 'authority', value: c.authority, maxlength: '150' })),
      wide('Reason for the Correction', textarea('reason', '', { max: 200, placeholder: 'What was wrong and what the record should say' }), 'Required. It is kept with the case and in the audit trail.'),
    ],
    save: (form) => api.post(`${BASE}/cases/${c.id}/correct`, {
      offence_id: val(form, 'offence_id'), incident_date: isoOf(form, 'incident_date'), what_happened: val(form, 'what_happened'), reported_by: val(form, 'reported_by'),
      decision_date: isoOf(form, 'decision_date'), sanction_id: val(form, 'sanction_id'), decision: val(form, 'decision'), authority: val(form, 'authority'), reason: val(form, 'reason'),
    }),
    done: (r) => finished(`Case ${r.caseNumber} corrected: ${r.corrections[r.corrections.length - 1].changes.map((x) => x[0]).join(', ')}.`),
  });
}

// ---- the rating's Discipline tab (read only; a row opens the case) -----------
export function disciplinePanel(serviceNumber, { onLoaded } = {}) {
  const lv = listView({
    columns: [
      { key: 'caseNumber', label: 'Case', render: (c) => c.caseNumber },
      { key: 'offence', label: 'Offence', render: (c) => h('span', {}, [c.offence, h('span', { className: 'block text-xs text-muted-foreground', text: `Incident ${fmt(c.incidentDate)}` })]), className: 'whitespace-normal' },
      { key: 'status', label: 'Status', render: (c) => statusPill(c) },
      { key: 'sanction', label: 'Sanction', render: (c) => (c.status === 'concluded' ? h('span', {}, [c.sanction, h('span', { className: 'block text-xs text-muted-foreground', text: fmt(c.decisionDate) })]) : '-') },
    ],
    load: ({ page }) => api.get(`${BASE}/rating/${encodeURIComponent(serviceNumber)}/cases?page=${page}`),
    onLoaded,
    onPick: (c) => caseDialog(c, { readOnly: true }),
    card: { title: (c) => c.offence, subtitle: (c) => `${c.caseNumber} · incident ${fmt(c.incidentDate)}`, aside: (c) => statusPill(c) },
    empty: { icon: 'gavel', title: 'No Disciplinary Record', text: 'This rating has no pending or concluded case.' },
  });
  return rowTips(lv.el);
}
