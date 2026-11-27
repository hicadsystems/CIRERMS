/*
 * the record's list tabs: Next of Kin, Spouse, Children, Advancement,
 * Drafting, Training, Education and Language. Each is a list with Add and Edit
 * in a dialog (a bottom sheet on a phone) and Delete after a confirm. Next of
 * Kin shows as cards with the next of kin's photograph; Drafting as a timeline
 * with the current posting marked; the rest as tables.
 *
 *   CHILD_TABS                         [{ key, label, bundleKey, ... }] in tab order
 *   childPanel({ serviceNumber, tab, rows, rating, readOnly, lookups, onChange, canAdd, canEdit, canDelete })
 *     canAdd / canEdit / canDelete   which row actions show (default: all unless readOnly)
 *     onChange({ items, currentShipName, rating })   after a save or delete
 */
import { api } from '../core/api.js';
import { icon } from '../core/icons.js';
import { formatDisplayDate, durationSince, yearsBetween } from '../core/dates.js';
import { previewBlobModal, populateSelect } from '../core/dom.js';
import { h, cx, fill } from '../ui/html.js';
import { CARD, TH } from '../ui/classes.js';
import { button } from '../ui/button.js';
import { pill } from '../ui/pill.js';
import { facts } from '../ui/facts.js';
import { emptyState } from '../ui/empty-state.js';
import { openDialog } from '../ui/dialog.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';
import { field, textInput, selectInput, setFieldErrors, clearFieldErrors } from '../ui/field.js';
import { optionsWithHeld, filterLgas } from '../core/lookups.js';
import { rowTip } from '../ui/row-tip.js';
import { readForm, dateField } from './rating-fields.js';
import { scheduledMoves } from './drafting-record.js';
import { scheduledAdvancements } from './advancement-record.js';

const YES_NO = [{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }];
const opts = (list = []) => list.map((x) => ({ value: x.id, label: x.name }));
// an entry recorded before the institutions were a table still holds its name as text
const heldText = (row) => (row && row.institution && !row.institution_id ? `Recorded as "${row.institution}": pick it from the list to link it` : undefined);
const d = (v) => formatDisplayDate(v);
const tick = (v) => (Number(v) ? h('span', { className: 'text-success', 'aria-label': 'Yes' }, icon('check')) : h('span', { className: 'text-muted-foreground', 'aria-label': 'No', text: '-' }));

const KIN_TYPES = [{ value: 'Main', label: 'Main' }, { value: 'Alternate', label: 'Alternate' }];
const sel = (name, label, lookup, L, extra = {}) => ({ name, label, type: 'select', lookup, options: opts(L[lookup]), ...extra });
const ageOf = (iso) => { const n = iso ? yearsBetween(iso) : null; return n === null || n === undefined ? '' : String(n); };
const born = (r) => (r.date_of_birth ? `${d(r.date_of_birth)}${ageOf(r.date_of_birth) ? ` (${ageOf(r.date_of_birth)})` : ''}` : '');

// the address a spouse and a child carry
const addressFields = (L) => [
  { name: 'street', label: 'Street' },
  { name: 'town', label: 'Town' },
  sel('state_id', 'State', 'states', L),
  { name: 'local_government_id', label: 'Local Government', type: 'select', lookup: 'localGovernments', cascade: 'state' },
  { name: 'po_box', label: 'P.O. Box' },
];
const addressFacts = (r) => [['Street', r.street], ['Town', r.town], ['State', r.state_name], ['Local Government', r.local_government_name], ['P.O. Box', r.po_box]];

export const CHILD_TABS = [
  {
    key: 'next-of-kin', label: 'Next of Kin', bundleKey: 'nextOfKin', noun: 'Next of Kin', addLabel: 'Add Next of Kin', icon: 'users', look: 'cards',
    fields: (L, row, rows = []) => [
      { name: 'first_name', label: 'First Name', required: true },
      { name: 'last_name', label: 'Last Name', required: true },
      { name: 'kin_type', label: 'Next of Kin Type', type: 'select', options: KIN_TYPES, placeholder: null, fallback: rows.length ? 'Alternate' : 'Main' },
      sel('next_of_kin_type_id', 'Relationship', 'nextOfKinTypes', L, { required: true }),
      { name: 'mobile_number', label: 'Mobile Number', type: 'tel', required: true },
      { name: 'home_number', label: 'Home Number', type: 'tel' },
      { name: 'email_address', label: 'Email Address', type: 'email', required: true },
      { name: 'place_of_work', label: 'Place of Work' },
      { name: 'full_address', label: 'Full Address', required: true, span: 'full' },
    ],
    details: (r) => [
      ['Full Name', [r.first_name, r.last_name].filter(Boolean).join(' ')], ['Next of Kin Type', r.kin_type], ['Relationship', r.next_of_kin_type_name],
      ['Full Address', r.full_address], ['Mobile Number', r.mobile_number], ['Home Number', r.home_number], ['Email Address', r.email_address], ['Place of Work', r.place_of_work],
    ],
  },
  {
    key: 'spouse', label: 'Spouse', bundleKey: 'spouse', noun: 'Spouse', addLabel: 'Add Spouse', icon: 'heart',
    fields: (L) => [
      { name: 'name', label: 'Full Name', required: true, span: 'full' },
      { name: 'phone_number', label: 'Phone Number', type: 'tel' },
      { name: 'email_address', label: 'Email Address', type: 'email' },
      ...addressFields(L),
    ],
    columns: [['Name', (r) => r.name], ['Phone', (r) => r.phone_number], ['Email', (r) => r.email_address], ['State', (r) => r.state_name]],
    details: (r) => [['Full Name', r.name], ['Phone Number', r.phone_number], ['Email Address', r.email_address], ...addressFacts(r)],
  },
  {
    key: 'children', label: 'Children', bundleKey: 'children', noun: 'Child', addLabel: 'Add Child', icon: 'baby',
    fields: (L) => [
      { name: 'name', label: 'Full Name', required: true },
      sel('gender_id', 'Sex', 'genders', L),
      { name: 'date_of_birth', label: 'Date of Birth', type: 'date' },
      { name: 'phone_number', label: 'Phone Number', type: 'tel' },
      { name: 'email_address', label: 'Email Address', type: 'email' },
      ...addressFields(L),
      { name: 'school', label: 'School' },
      { name: 'occupation', label: 'Occupation' },
      { name: 'office_address', label: 'Office Address', span: 'full' },
    ],
    columns: [['Name', (r) => r.name], ['Age', (r) => ageOf(r.date_of_birth)], ['Phone', (r) => r.phone_number], ['Email', (r) => r.email_address]],
    details: (r) => [
      ['Full Name', r.name], ['Sex', r.gender_name], ['Date of Birth', born(r)], ['Phone Number', r.phone_number], ['Email Address', r.email_address],
      ...addressFacts(r), ['School', r.school], ['Occupation', r.occupation], ['Office Address', r.office_address],
    ],
  },
  {
    key: 'advancement', label: 'Advancement', bundleKey: 'advancement', noun: 'Advancement', addLabel: 'Add Advancement', icon: 'trending-up', pdf: true,
    fields: (L) => [
      { name: 'rate_id', label: 'Rate', type: 'select', lookup: 'rates', options: opts(L.rates), required: true },
      { name: 'start_date', label: 'Start Date', type: 'date' },
      { name: 'end_date', label: 'End Date', type: 'date' },
      { name: 'decoration', label: 'Decoration' },
      { name: 'authority', label: 'Authority' },
      { name: 'gcbno', label: 'GCB No' },
    ],
    columns: [['Rate', (r) => r.rate_name], ['Start', (r) => d(r.start_date)], ['End', (r) => (r.end_date ? d(r.end_date) : 'Present')], ['Decoration', (r) => r.decoration], ['Authority', (r) => r.authority], ['GCB No', (r) => r.gcbno]],
  },
  {
    key: 'drafting', label: 'Drafting', bundleKey: 'drafting', noun: 'Posting', addLabel: 'Add Posting', icon: 'ship', pdf: true, look: 'timeline',
    fields: (L, row, rows, rating = {}) => [
      sel('ship_id', 'Ship or Unit', 'ships', L, { required: true }),
      sel('command_id', 'Command', 'commands', L, { fallback: '' }),
      sel('branch_id', 'Branch', 'branches', L, { fallback: rating.branch_id || '' }),
      sel('rate_id', 'Rate at Posting', 'rates', L),
      { name: 'start_date', label: 'From', type: 'date' },
      { name: 'end_date', label: 'To', type: 'date', hint: 'Leave empty for the current posting' },
      { name: 'authority', label: 'Authority', hint: 'The signal' },
      { name: 'decoration', label: 'Decoration/Award' },
      sel('exit_type_id', 'Status', 'exitTypes', L, { fallback: ((L.exitTypes || []).find((x) => x.name === 'Active') || {}).id || '' }),
      { name: 'remarks', label: 'Remarks', span: 'full' },
    ],
    details: (r) => [
      ['Ship or Unit', r.ship_name], ['Command', r.command_name], ['Branch', r.branch_name], ['Rate at Posting', r.rate_name],
      ['From', d(r.start_date)], ['To', r.end_date ? d(r.end_date) : 'Present'], ['Authority', r.authority], ['Decoration/Award', r.decoration],
      ['Status', r.status_name], ['Remarks', r.remarks],
    ],
  },
  {
    key: 'training', label: 'Training', bundleKey: 'training', noun: 'Course', addLabel: 'Add Course', icon: 'graduation-cap', pdf: true,
    fields: (L, row) => [
      { name: 'training_course_id', label: 'Course', type: 'select', lookup: 'trainingCourses', options: opts(L.trainingCourses), hint: 'Picked from the Training table; its institution is used when none is picked' },
      { name: 'institution_id', label: 'Institution', type: 'select', lookup: 'institutions', options: opts(L.institutions), hint: heldText(row) },
      { name: 'classification', label: 'Result or Class' },
      { name: 'start_date', label: 'From', type: 'date' },
      { name: 'end_date', label: 'To', type: 'date' },
    ],
    columns: [['Course', (r) => r.qualification], ['Institution', (r) => r.institution], ['From', (r) => d(r.start_date)], ['To', (r) => d(r.end_date)], ['Result', (r) => (r.classification ? pill(r.classification, 'success') : '')]],
  },
  {
    key: 'education', label: 'Education', bundleKey: 'education', noun: 'Qualification', addLabel: 'Add Qualification', icon: 'book-open', pdf: true,
    fields: (L, row) => [
      { name: 'qualification', label: 'Qualification' },
      { name: 'institution_id', label: 'Institution', type: 'select', lookup: 'institutions', options: opts(L.institutions), hint: heldText(row) },
      { name: 'classification', label: 'Class or Grade' },
      { name: 'start_date', label: 'From', type: 'date' },
      { name: 'end_date', label: 'To', type: 'date' },
    ],
    columns: [['Qualification', (r) => r.qualification], ['Institution', (r) => r.institution], ['Class', (r) => r.classification], ['From', (r) => d(r.start_date)], ['To', (r) => d(r.end_date)]],
  },
  {
    key: 'language', label: 'Language', bundleKey: 'language', noun: 'Language', addLabel: 'Add Language', icon: 'languages',
    fields: (L) => [
      { name: 'language_id', label: 'Language', type: 'select', lookup: 'languages', options: opts(L.languages), required: true },
      { name: 'can_read', label: 'Can Read', type: 'yesno' },
      { name: 'can_write', label: 'Can Write', type: 'yesno' },
      { name: 'can_speak', label: 'Can Speak', type: 'yesno' },
    ],
    columns: [['Language', (r) => r.language_name], ['Read', (r) => tick(r.can_read)], ['Write', (r) => tick(r.can_write)], ['Speak', (r) => tick(r.can_speak)]],
  },
];

export const childTab = (key) => CHILD_TABS.find((t) => t.key === key) || null;

function control(f, row, lookups) {
  // a new row takes the field's own starting value (the first next of kin is Main, a posting is Active)
  const raw = row ? row[f.name] : f.fallback;
  // a select of a lookup also offers the value this row holds when it has since been made inactive
  if (f.type === 'select') {
    if (f.cascade === 'state') {
      const stateId = row ? row.state_id : '';
      return selectInput({ name: f.name, options: optionsWithHeld(lookups, f.lookup, raw, filterLgas(lookups, stateId)), value: raw ?? '', placeholder: stateId ? '-- Select Local Government --' : '-- Select State First --' });
    }
    return selectInput({ name: f.name, options: f.lookup ? optionsWithHeld(lookups, f.lookup, raw) : f.options || [], value: raw ?? '', ...(f.placeholder === null ? { placeholder: null } : {}) });
  }
  if (f.type === 'yesno') return selectInput({ name: f.name, options: YES_NO, value: row ? String(Number(raw) ? 1 : 0) : '1', placeholder: null });
  if (f.type === 'date') return dateField(f.name, raw);
  return textInput({ name: f.name, type: f.type || 'text', value: raw == null ? '' : String(raw), required: !!f.required });
}

export function childPanel({ serviceNumber, tab, rows = [], rating = {}, readOnly = false, lookups = {}, onChange, canAdd = !readOnly, canEdit = !readOnly, canDelete = !readOnly } = {}) {
  const base = `/api/ratings/${encodeURIComponent(serviceNumber)}/records/${tab.key}`;

  function openForm(row = null) {
    const fields = tab.fields(lookups, row, rows, rating);
    const form = h('form', { className: 'grid grid-cols-2 gap-4 phone:grid-cols-1', novalidate: true, autocomplete: 'off' },
      fields.map((f) => field({ label: f.required ? `${f.label} *` : f.label, control: control(f, row, lookups), hint: f.hint, className: f.span === 'full' ? 'col-span-2 phone:col-span-1' : '' })));
    // the local government list follows the State; a posting's Command follows the ship picked (and can be changed)
    form.addEventListener('change', (e) => {
      const name = e.target && e.target.getAttribute && e.target.getAttribute('name');
      if (name === 'state_id') {
        const id = e.target.value;
        populateSelect(form.querySelector('[name="local_government_id"]'), filterLgas(lookups, id), { placeholder: id ? '-- Select Local Government --' : '-- Select State First --' });
      } else if (name === 'ship_id') {
        const ship = (lookups.ships || []).find((x) => String(x.id) === String(e.target.value));
        const command = form.querySelector('[name="command_id"]');
        if (ship && command) command.value = ship.commandId ? String(ship.commandId) : '';
      }
    });
    const dlg = openDialog({ title: row ? `Edit ${tab.noun}` : tab.addLabel, size: 'lg', body: form, initialFocus: 'input:not([type="hidden"]), [name]' });
    const saveBtn = button({ label: 'Save', icon: 'check', variant: 'primary', onClick: () => save() });
    dlg.setFooter([button({ label: 'Cancel', variant: 'outline', onClick: () => dlg.close() }), saveBtn]);
    form.addEventListener('submit', (e) => { e.preventDefault(); save(); });

    async function save() {
      clearFieldErrors(form);
      saveBtn.disabled = true;
      dlg.setDismissible(false);
      try {
        const payload = readForm(form);
        // an entry still held as text keeps it until an institution is picked
        if (row && row.institution && !payload.institution_id) payload.institution = row.institution;
        const res = row ? await api.put(`${base}/${row.id}`, payload) : await api.post(base, payload);
        dlg.setDismissible(true);
        dlg.close('saved');
        toast(row ? `${tab.noun} updated.` : `${tab.noun} added.`);
        onChange(res.data);
      } catch (err) {
        dlg.setDismissible(true);
        saveBtn.disabled = false;
        if (err.fields) setFieldErrors(form, err.fields);
        toast(err.message || 'Could not save.', 'error');
      }
    }
  }

  // View Details: the whole record in label and value rows, with the row's actions in the footer
  function openDetails(row, what) {
    const dlg = openDialog({ title: `${tab.noun} Details`, size: 'lg', body: facts(tab.details(row)) });
    dlg.setFooter([
      button({ label: 'Close', variant: 'outline', onClick: () => dlg.close() }),
      canEdit ? button({ label: 'Edit', icon: 'pencil', variant: 'outline', onClick: () => { dlg.close(); openForm(row); } }) : null,
      canDelete ? button({ label: 'Delete', icon: 'trash-2', variant: 'danger', onClick: () => { dlg.close(); remove(row, what); } }) : null,
    ].filter(Boolean));
  }
  // a row (or card) opens its details by click or Enter, unless the click was on one of its own buttons
  const opens = (row, what) => ({
    tabindex: '0',
    'aria-label': `View Details of ${what}`,
    className: 'cursor-pointer',
    'data-view-details': '',
    onClick: (e) => { if (!e.target.closest('button')) openDetails(row, what); },
    onKeydown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); openDetails(row, what); } },
  });

  async function remove(row, what) {
    const ok = await confirmDialog({ title: `Delete ${tab.noun}`, message: `Delete ${what}? This cannot be undone.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      const res = await api.del(`${base}/${row.id}`);
      toast(`${tab.noun} deleted.`);
      onChange(res.data);
    } catch (err) {
      toast(err.message || 'Could not delete.', 'error');
    }
  }

  const ICON_BTN = 'inline-flex h-8 w-8 items-center justify-center rounded-ctl text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 phone:h-tap phone:w-tap';
  const rowActions = (row, what) => (!canEdit && !canDelete ? null : h('span', { className: 'inline-flex flex-none gap-1' }, [
    canEdit ? h('button', { type: 'button', className: ICON_BTN, 'aria-label': `Edit ${what}`, onClick: () => openForm(row) }, icon('pencil')) : null,
    canDelete ? h('button', { type: 'button', className: cx(ICON_BTN, 'hover:bg-error-soft hover:text-destructive'), 'aria-label': `Delete ${what}`, onClick: () => remove(row, what) }, icon('trash-2')) : null,
  ]));

  const addBtn = () => (!canAdd ? null : button({ label: tab.addLabel, icon: 'plus', variant: 'outline', onClick: () => openForm() }));
  const printBtn = () => (tab.pdf && rows.length ? button({ label: 'Print', icon: 'printer', variant: 'ghost', onClick: () => printTab() }) : null);

  async function printTab() {
    try {
      const { blob, mimeType, fileName } = await api.fetchBlob(`/api/ratings/${encodeURIComponent(serviceNumber)}/tabs/${tab.key}/pdf`);
      previewBlobModal({ title: `${tab.label}: ${serviceNumber}`, blob, mimeType, fileName: fileName || `${serviceNumber}_${tab.label}.pdf` });
    } catch (err) {
      toast(err.message || 'Could not make the report.', 'error');
    }
  }

  if (!rows.length) {
    return h('div', { className: cx(CARD, tab.key === 'advancement' && 'overflow-hidden') }, [
      tab.key === 'advancement' ? scheduledAdvancements(serviceNumber) : null, // a rate change still to come (WP8)
      emptyState({ icon: tab.icon, title: `No ${tab.label} Recorded`, action: addBtn() }),
    ]);
  }

  const band = (!canAdd && !tab.pdf) ? null : h('div', { className: 'flex items-center justify-end gap-2 border-b border-border px-4 py-2.5' }, [printBtn(), addBtn()]);

  if (tab.look === 'cards') {
    const photo = nokPhoto({ serviceNumber, rating, readOnly: !canEdit });
    return h('div', { className: 'space-y-4' }, [
      rowTip(h('div', { className: 'grid grid-cols-2 gap-4 phone:grid-cols-1' }, rows.map((r) => {
        const name = [r.first_name, r.last_name].filter(Boolean).join(' ');
        const o = opens(r, name);
        return h('section', { ...o, className: cx(CARD, 'p-4 transition-colors hover:bg-subtle', o.className) }, [
          h('div', { className: 'mb-3 flex items-center gap-2' }, [
            h('b', { className: 'min-w-0 flex-1 truncate text-sm', text: name }),
            r.kin_type ? pill(r.kin_type, r.kin_type === 'Main' ? 'success' : 'neutral') : null,
            rowActions(r, name),
          ]),
          facts([['Relationship', r.next_of_kin_type_name], ['Mobile Number', r.mobile_number], ['Email Address', r.email_address]]),
        ]);
      }))),
      addBtn(),
      photo,
    ]);
  }

  if (tab.look === 'timeline') {
    return h('div', { className: CARD }, [
      band,
      // Drafting: a move still to come (a WEF after today) shows first, as scheduled
      rowTip(h('ol', { className: 'relative mx-4 my-4 ml-6 border-l-2 border-border' }, [tab.key === 'drafting' ? scheduledMoves(serviceNumber) : null, ...rows.map((p) => {
        const current = !p.end_date;
        const what = p.ship_name || 'posting';
        const o = opens(p, what);
        return h('li', { ...o, className: cx('relative pb-5 pl-5 last:pb-0', o.className) }, [
          h('span', { className: cx('absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-background', current ? 'bg-primary' : 'bg-border'), 'aria-hidden': 'true' }),
          h('div', { className: 'flex items-start gap-2' }, [
            h('div', { className: 'min-w-0 flex-1' }, [
              h('div', { className: 'flex flex-wrap items-center gap-2' }, [h('b', { className: 'text-sm', text: p.ship_name || '-' }), current ? pill('Current', 'success') : null, p.rate_name ? h('span', { className: 'text-xs text-muted-foreground', text: p.rate_name }) : null]),
              h('div', { className: 'text-xs text-muted-foreground', text: `${d(p.start_date) || '-'} to ${current ? 'date' : d(p.end_date)}${p.start_date ? ` · ${durationSince(p.start_date)}${current ? ' so far' : ''}` : ''}` }),
              [p.command_name, p.branch_name, p.status_name].some(Boolean) ? h('div', { className: 'text-xs text-muted-foreground', text: [p.command_name, p.branch_name, p.status_name].filter(Boolean).join(' · ') }) : null,
              p.remarks ? h('div', { className: 'mt-0.5 text-xs', text: p.remarks }) : null,
            ]),
            rowActions(p, what),
          ]),
        ]);
      })])),
    ]);
  }

  const cols = tab.columns;
  const value = (v) => (v === null || v === undefined || v === '' ? '-' : v);
  const whatOf = (r) => String(cols[0][1](r) || tab.noun);
  const table = h('table', { className: cx('w-full text-sm', tab.details && 'phone:hidden') }, [
    h('thead', { className: 'bg-subtle' }, h('tr', {}, [...cols.map(([label]) => h('th', { className: TH, scope: 'col', text: label })), !canEdit && !canDelete ? null : h('th', { className: TH, scope: 'col' }, h('span', { className: 'sr-only', text: 'Actions' }))])),
    h('tbody', {}, rows.map((r) => {
      const o = tab.details ? opens(r, whatOf(r)) : {};
      return h('tr', { ...o, className: cx('border-t border-border', tab.details && 'transition-colors hover:bg-subtle', o.className) }, [
        ...cols.map(([, get], i) => h('td', { className: cx('whitespace-nowrap px-4 py-2.5', i === 0 && 'font-medium') }, value(get(r)))),
        !canEdit && !canDelete ? null : h('td', { className: 'w-px whitespace-nowrap px-2 py-1 text-right' }, rowActions(r, whatOf(r))),
      ]);
    })),
  ]);
  // a phone shows the rows as cards (the first two columns), a card opens the record like a row does
  const cardList = !tab.details ? null : h('div', { className: 'hidden space-y-2 p-3 phone:block' }, rows.map((r) => h('section', { ...opens(r, whatOf(r)), className: cx('rounded-ctl border border-border p-3', 'cursor-pointer') }, [
    h('div', { className: 'flex items-center gap-2' }, [h('b', { className: 'min-w-0 flex-1 truncate text-sm', text: whatOf(r) }), rowActions(r, whatOf(r))]),
    ...cols.slice(1, 3).map(([label, get]) => h('div', { className: 'text-xs text-muted-foreground', text: `${label}: ${value(get(r))}` })),
  ])));
  return h('div', { className: cx(CARD, 'overflow-hidden') }, [
    band,
    tab.key === 'advancement' ? scheduledAdvancements(serviceNumber) : null, // a rate change still to come (WP8)
    rowTip(h('div', { className: tab.details ? '' : 'overflow-x-auto' }, [table, cardList])),
  ]);
}

/** The next of kin's photograph, on the Next of Kin tab. */
function nokPhoto({ serviceNumber, rating, readOnly }) {
  const frame = h('span', { className: 'flex h-20 w-16 flex-none items-center justify-center overflow-hidden rounded-ctl border border-border bg-subtle text-muted-foreground' }, icon('image', 'icon h-6 w-6'));
  const load = (url) => {
    if (!url) return;
    api.fetchBlob(url).then(({ blob }) => {
      const src = URL.createObjectURL(blob);
      fill(frame, h('img', { src, alt: 'Next of kin photograph', className: 'h-full w-full object-cover' }));
    }).catch(() => {});
  };
  load(rating.next_of_kin_photo_url);
  const input = h('input', { type: 'file', accept: '.jpg,.jpeg,.png,.webp', className: 'hidden', 'aria-label': 'Next of kin photograph' });
  input.addEventListener('change', async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('photo', f);
    try {
      const res = await api.upload(`/api/ratings/${encodeURIComponent(serviceNumber)}/photo/next-of-kin`, fd);
      load(res.data.rating.next_of_kin_photo_url);
      toast('Next of kin photograph saved.');
    } catch (err) {
      toast(err.message || 'Could not save the photograph.', 'error');
    } finally {
      input.value = '';
    }
  });
  return h('section', { className: cx(CARD, 'flex items-center gap-4 p-4') }, [
    frame,
    h('div', { className: 'min-w-0 flex-1' }, [
      h('b', { className: 'block text-sm', text: 'Next of Kin Photograph' }),
      h('span', { className: 'block text-xs text-muted-foreground', text: rating.next_of_kin_photo_url ? 'On file' : 'None on file' }),
    ]),
    readOnly ? null : button({ label: rating.next_of_kin_photo_url ? 'Change' : 'Upload', icon: 'upload', variant: 'outline', onClick: () => input.click() }),
    input,
  ]);
}
