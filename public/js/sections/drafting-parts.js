/*
 * drafting-parts: what the six Drafting screens share (drafting.js draws them).
 *
 *   loadOptions(force)                  ships, rates, branches, specialisations, ranks, requests, the user's
 *                                       department and the due rule (GET /api/drafting/options)
 *   monthsPill(row)                     months on the ship as a coloured pill (the tone comes from the server's
 *                                       settings; nothing on screen explains the colours)
 *   rowStatusPill(row)                  Proposed / Not Recommended / Awaiting WEF / Scheduled / Reported
 *   formDialog({ ... })                 a dialog with a form: errors from the server land under their fields
 *   list({ ... })                       a server-paged list (25) with the View Details tooltip on desktop
 *   statStrip(items)  notice(...)  ratingStrip(...)  batchFacts(b)  shipOptions(o, exceptId)
 *   batchSelect({ label, batches, value, labelOf, onChange })
 *   previewPdf(url, title, fileName)    the app's own PDF preview
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { formatDisplayDate, parseDisplayDate, wireDateField } from '../core/dates.js';
import { navigate } from '../core/router.js';
import { openPdfPreview } from '../ui/pdf-preview.js';
import { h, cx } from '../ui/html.js';
import { CARD, LABEL } from '../ui/classes.js';
import { button } from '../ui/button.js';
import { pill } from '../ui/pill.js';
import { factPanels } from '../ui/facts.js';
import { icon } from '../core/icons.js';
import { openDialog } from '../ui/dialog.js';
import { field, textInput, selectInput, setFieldErrors, clearFieldErrors } from '../ui/field.js';
import { toast } from '../ui/toast.js';
import { listView } from '../ui/list-view.js';
import { rowTips } from './disciplinary-parts.js';

export const BASE = '/api/drafting';
export const fmt = (v) => formatDisplayDate(v) || '';
export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const qs = (obj) => new URLSearchParams(Object.entries(obj).filter(([, v]) => v !== '' && v !== null && v !== undefined)).toString();

let optionCache = null;
export async function loadOptions(force = false) {
  if (!optionCache || force) optionCache = (await api.get(`${BASE}/options`)).data;
  return optionCache;
}

export const monthsPill = (r) => (r.months === null || r.months === undefined ? '' : pill(`${r.months} mo`, r.band || 'neutral'));

const ROW_STATUS = {
  proposed: ['Proposed', 'neutral'], not_recommended: ['Not Recommended', 'error'], awaiting_wef: ['Pending', 'warning'],
  scheduled: ['Scheduled', 'info'], reported: ['Reported', 'success'],
};
export const rowStatusPill = (r) => pill(...(ROW_STATUS[r.status] || [r.status, 'neutral']));

export const batchStatusPill = (b) => (b.status === 'closed' ? pill('Closed', 'success') : b.status === 'approved' ? pill('Approved', 'info') : pill('Open', 'warning'));

/** "PO ODIGIE Osaro Felix" */
export const fullName = (r) => [r.rateCode, r.name].filter(Boolean).join(' ');
export const two = (a, b) => h('span', { className: 'block min-w-0' }, [h('span', { className: 'block truncate' }, a), b ? h('span', { className: 'block truncate text-xs font-normal text-muted-foreground' }, b) : null]);

export function notice(tone, iconName, content) {
  const c = { info: 'bg-info-soft text-info', warning: 'bg-warning-soft text-warning', error: 'bg-error-soft text-error', success: 'bg-success-soft text-success' }[tone] || 'bg-info-soft text-info';
  return h('div', { className: cx('flex gap-2 rounded-ctl px-3 py-2 text-sm', c), role: tone === 'error' ? 'alert' : undefined }, [icon(iconName, 'icon mt-0.5 flex-none'), h('div', { className: 'min-w-0 break-words' }, content)]);
}

export function ratingStrip(title, sub, aside = null) {
  return h('div', { className: 'flex items-center gap-3 rounded-card border border-border bg-subtle/60 p-3' }, [
    h('div', { className: 'min-w-0 flex-1' }, [h('b', { className: 'block truncate text-sm', text: title }), sub ? h('span', { className: 'block truncate text-xs text-muted-foreground', text: sub }) : null]),
    aside,
  ]);
}

/** A row of small figures (three across, also on a phone). */
export function statStrip(items) {
  return h('div', { className: 'mb-4 grid grid-cols-3 gap-3 phone:gap-2', dataset: { stats: '' } }, items.map(([label, value, tone]) => h('div', { className: cx(CARD, 'min-w-0 px-4 py-3 phone:px-3') }, [
    h('div', { className: 'truncate text-2xs font-semibold uppercase tracking-wider text-muted-foreground', text: label }),
    h('div', { className: cx('mt-0.5 text-2xl font-semibold', tone === 'primary' ? 'text-primary-hover' : tone === 'warning' ? 'text-warning' : ''), text: String(value) }),
  ])));
}

export const dateInput = (name, value = '') => wireDateField(textInput({ name, value: fmt(value), placeholder: 'dd/mm/yyyy', inputmode: 'numeric', maxlength: '10', autocomplete: 'off' }));
export const val = (form, name) => {
  const el = form.querySelector(`[name="${CSS.escape(name)}"]`);
  return el ? String(el.value || '').trim() : '';
};
/** A typed date as YYYY-MM-DD; the text itself when it is not a date (the server refuses it). */
export const isoOf = (form, name) => {
  const raw = val(form, name);
  const iso = parseDisplayDate(raw);
  return iso === null ? raw : iso;
};

export const choicesOf = (rows, held) => (rows || []).filter((r) => r.active !== false || r.id === Number(held)).map((r) => ({ value: r.id, label: r.active === false ? `${r.name} (Inactive)` : r.name }));
export const shipOptions = (o, exceptId = null) => choicesOf(o.ships.filter((s) => s.id !== exceptId));

/**
 * A dialog with a form. save(form) returns the API call; done(data) runs after it closes. Errors from the
 * server land under their fields. `disabled` keeps the main button off (a notice says why).
 */
export function formDialog({ title, size = 'md', children, submitLabel = 'Save', submitIcon = 'check', tone = 'primary', backLabel = 'Cancel', disabled = false, save, done, columns = 1 }) {
  const form = h('form', { className: cx('grid gap-4', columns === 2 && 'grid-cols-2 phone:grid-cols-1'), novalidate: true, autocomplete: 'off' }, children);
  const dlg = openDialog({ title, size, body: form });
  const go = button({ label: submitLabel, icon: submitIcon, variant: tone, disabled, onClick: () => submit() });
  dlg.setFooter([button({ label: backLabel, variant: 'outline', onClick: () => dlg.close() }), go]);
  form.addEventListener('submit', (e) => { e.preventDefault(); if (!go.disabled) submit(); });
  async function submit() {
    clearFieldErrors(form);
    go.disabled = true;
    dlg.setDismissible(false);
    try {
      const res = await save(form);
      dlg.setDismissible(true);
      dlg.close('saved');
      done(res && res.data);
    } catch (err) {
      dlg.setDismissible(true);
      go.disabled = false;
      if (err.fields) setFieldErrors(form, err.fields);
      toast(err.message || 'Could not save.', 'error');
    }
  }
  return { dlg, form };
}

/** A details dialog: label and value rows in panels, then the actions. */
export function detailsDialog({ title, panels, before = null, after = null, actions = [], size = 'lg' }) {
  const dlg = openDialog({ title, size, body: h('div', { className: 'space-y-4' }, [before, factPanels(panels), after]) });
  dlg.setFooter([button({ label: 'Close', variant: 'outline', onClick: () => dlg.close() }), ...actions.filter(Boolean)]);
  return dlg;
}

// the shell closes every dialog when the page changes
export const openRecordButton = (sn) => (can('ratings.edit', 'view')
  ? button({ label: 'Open Record', icon: 'id-card', variant: 'outline', onClick: () => navigate(`#ratings/edit/${encodeURIComponent(sn)}?tab=drafting`) })
  : null);

/** A list from the server, 25 a page, with the View Details tooltip on desktop. */
export function list(opts) {
  const lv = listView(opts);
  rowTips(lv.el);
  return lv;
}

export function previewPdf(url, title, fileName) {
  return openPdfPreview({ url, title, filename: fileName });
}

/** A labelled select of batches (Review, Update WEF). onChange(id). */
export function batchSelect({ label = 'Batch Number', batches, value, labelOf, onChange, placeholder = '-- Select Batch --' }) {
  const sel = selectInput({ name: 'batch', options: batches.map((b) => ({ value: b.id, label: labelOf(b) })), value: value || '', placeholder, 'aria-label': label });
  const wrap = h('div', { className: 'min-w-0 flex-1 phone:w-full' }, [h('span', { className: LABEL, text: label }), sel]);
  wrap.addEventListener('change', (e) => {
    const t = e.target.closest('[name="batch"]') || e.target;
    if (t.getAttribute && t.getAttribute('name') === 'batch') onChange(Number(t.value) || null);
  });
  return wrap;
}

/** The facts of a batch, as two panels. */
export function batchFacts(b, extra = []) {
  return h('section', { className: cx(CARD, 'mb-4 p-4'), dataset: { batchFacts: '' } }, factPanels([
    { title: 'Batch', rows: [['Batch Number', h('b', { text: b.batchNumber })], ['Branch', b.branch], ['Specialisation', b.specialisation], ['Rate', b.rate]] },
    { title: b.status === 'closed' ? 'Authority' : 'Progress', rows: [['Initiated', `${fmt(b.initiatedAt)}${b.initiatedBy ? ` by ${b.initiatedBy}` : ''}`], ['Status', batchStatusPill(b)], ...extra] },
  ]));
}

export const emptyCard = (node) => h('div', { className: CARD }, node);
export { field, textInput, selectInput, button, pill, h, cx, icon, toast, api, can, navigate, CARD };
