/*
 * rating fields: the rating's own fields in their four sections (Basic
 * Details, Contact, Health, Official), shared by the New Rating dialog, the
 * record's Edit dialogs and its read-only cards.
 *
 *   SECTIONS                          [{ key, title, icon, fields }]
 *   sectionFields(section, lookups, values)   a grid of the section's fields, filled from `values`
 *   wireCascades(scope, lookups)      Religion > Denomination and State > Local Government
 *   readForm(form)                    the form's values, trimmed, for the API
 *   displayRows(section, rating)      [[label, value]] for facts()
 *
 * Only Official Number, Surname and First Name are required (the API checks them too).
 */
import { h, cx } from '../ui/html.js';
import { field, textInput, selectInput } from '../ui/field.js';
import { INPUT } from '../ui/classes.js';
import { populateSelect } from '../core/dom.js';
import { filterDenominations, filterLgas, optionsWithHeld } from '../core/lookups.js';
import { formatDisplayDate, yearsBetween, durationSince, parseDisplayDate, wireDateField } from '../core/dates.js';

const sel = (name, label, lookup, extra = {}) => ({ name, label, type: 'select', lookup, ...extra });
const txt = (name, label, extra = {}) => ({ name, label, type: 'text', ...extra });
const date = (name, label, extra = {}) => ({ name, label, type: 'date', ...extra });

const STATUS_OPTIONS = [{ value: 'current', label: 'Current' }, { value: 'former', label: 'Former' }];
const YES_NO = [{ value: '0', label: 'No' }, { value: '1', label: 'Yes' }];

export const SECTIONS = [
  {
    key: 'basic',
    title: 'Basic Details',
    fields: [
      sel('rate_id', 'Rate', 'rates'),
      sel('title_id', 'Title', 'titles'),
      txt('service_number', 'Official Number', { required: true, placeholder: 'e.g. B0539', upper: true }),
      txt('surname', 'Surname', { required: true, upper: true }),
      txt('first_name', 'First Name', { required: true, upper: true }),
      txt('middle_name', 'Middle Name', { upper: true }),
      txt('maiden_name', 'Maiden Name', { upper: true }),
      date('date_of_birth', 'Date of Birth', { show: (r) => withAge(r.date_of_birth) }),
      sel('gender_id', 'Gender', 'genders'),
      sel('marital_status_id', 'Marital Status', 'maritalStatuses'),
      txt('married_to_military_personnel', 'Married to Military Personnel', { placeholder: 'No, or their Official No' }),
      sel('religion_id', 'Religion', 'religions'),
      sel('religion_denomination_id', 'Denomination', null, { cascade: 'religion' }),
      sel('tribe_id', 'Tribe', 'tribes'),
    ],
  },
  {
    key: 'contact',
    title: 'Contact',
    fields: [
      { name: 'phone', label: 'Phone Number', type: 'tel', placeholder: '0803 000 0000' },
      { name: 'email_address', label: 'Email Address', type: 'email' },
      sel('state_id', 'State of Origin', 'states'),
      sel('local_government_id', 'Local Government', null, { cascade: 'state' }),
      sel('geo_political_zone_id', 'Geopolitical Zone', 'geoPoliticalZones'),
      txt('place_of_birth', 'Place of Birth'),
      sel('mother_base_id', 'Mother Base', 'motherBases'),
      sel('identification_type_id', 'Identification Type', 'identificationTypes'),
      txt('identity_number', 'Identity Number'),
      txt('driver_license_number', 'Driver Licence Number'),
      date('driver_license_expiry_date', 'Driver Licence Expiry'),
      { name: 'home_address', label: 'Home Address', type: 'textarea', span: 'full' },
    ],
  },
  {
    key: 'health',
    title: 'Health',
    fields: [
      sel('blood_group_id', 'Blood Group', 'bloodGroups'),
      sel('blood_genotype_id', 'Genotype', 'bloodGenotypes'),
      { name: 'height_m', label: 'Height (m)', type: 'number', placeholder: 'e.g. 1.78', attrs: { step: '0.01', min: '0.5', max: '2.6' }, show: (r) => (r.height_m ? `${Number(r.height_m)} m` : '') },
      { name: 'weight_kg', label: 'Weight (kg)', type: 'number', placeholder: 'e.g. 78.5', attrs: { step: '0.01', min: '20', max: '350' }, show: (r) => (r.weight_kg ? `${Number(r.weight_kg)} kg` : '') },
      { name: 'chest_cm', label: 'Chest (cm)', type: 'number', placeholder: 'e.g. 98', attrs: { step: '0.1', min: '30', max: '250' }, show: (r) => (r.chest_cm ? `${Number(r.chest_cm)} cm` : '') },
      sel('complexion_id', 'Complexion', 'complexions'),
      sel('hair_color_id', 'Hair Colour', 'hairColors'),
      sel('eye_color_id', 'Eye Colour', 'eyeColors'),
      { name: 'tribal_mark', label: 'Tribal Mark', type: 'select', options: YES_NO, placeholder: null, show: (r) => (Number(r.tribal_mark) ? 'Yes' : 'No') },
      sel('disability_id', 'Disability', 'disabilities'),
      txt('disability_comment', 'Disability Comment', { span: 'full' }),
    ],
  },
  {
    key: 'official',
    title: 'Official',
    fields: [
      sel('branch_id', 'Branch', 'branches'),
      sel('command_id', 'Command', 'commands'),
      sel('staff_branch_id', 'Staff Branch', 'staffBranches'),
      sel('specialisation_id', 'Specialisation', 'specialisations'),
      sel('entry_mode_id', 'Entry Mode', 'entryModes'),
      date('date_employed', 'Date Enlisted'),
      date('seniority_date', 'Seniority Date'),
      txt('hobbies', 'Hobbies'),
      { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS, placeholder: null, show: (r) => (r.status === 'former' ? 'Former' : 'Current') },
      sel('exit_type_id', 'Exit Type', 'exitTypes'),
      date('exit_date', 'Exit Date'),
      txt('exit_reason', 'Exit Reason'),
    ],
  },
];

export const sectionByKey = (key) => SECTIONS.find((s) => s.key === key) || null;

function withAge(dob) {
  const d = formatDisplayDate(dob);
  if (!d) return '';
  const age = yearsBetween(dob);
  return age === null ? d : `${d} (${age})`;
}

const asOptions = (list = []) => list.map((x) => ({ value: x.id, label: x.name }));

// a record that holds a value since made inactive (Static Tables) still offers it
function optionsFor(f, lookups, values) {
  if (f.options) return f.options;
  if (f.cascade === 'religion') return asOptions(filterDenominations(lookups, values.religion_id));
  if (f.cascade === 'state') return optionsWithHeld(lookups, 'localGovernments', values[f.name], filterLgas(lookups, values.state_id));
  return optionsWithHeld(lookups, f.lookup, values[f.name]);
}

function cascadePlaceholder(f, values) {
  if (f.cascade === 'religion') return values.religion_id ? '-- Select Denomination --' : '-- Select Religion First --';
  if (f.cascade === 'state') return values.state_id ? '-- Select Local Government --' : '-- Select State First --';
  return undefined;
}

function controlFor(f, lookups, values) {
  const raw = values[f.name];
  if (f.type === 'select') {
    const value = f.name === 'tribal_mark' ? String(Number(raw) ? 1 : 0) : raw;
    const placeholder = f.placeholder === null ? null : cascadePlaceholder(f, values) || '-- Select --';
    return selectInput({ name: f.name, options: optionsFor(f, lookups, values), value: value ?? '', placeholder });
  }
  if (f.type === 'textarea') {
    const t = h('textarea', { name: f.name, rows: '2', className: cx(INPUT, 'phone:h-auto') });
    t.value = raw == null ? '' : String(raw);
    return t;
  }
  if (f.type === 'date') return dateField(f.name, raw);
  return textInput({
    name: f.name,
    type: f.type,
    value: raw == null ? '' : String(raw),
    placeholder: f.placeholder || '',
    required: !!f.required,
    className: f.upper ? 'uppercase placeholder:normal-case' : '',
    ...(f.attrs || {}),
  });
}

/** A date field shown and typed as dd/mm/yyyy; readForm sends it as YYYY-MM-DD. */
export function dateField(name, value) {
  return wireDateField(textInput({ name, value: formatDisplayDate(value), placeholder: 'dd/mm/yyyy', inputmode: 'numeric', maxlength: '10', dataset: { date: '' } }));
}

/** The section's fields in a three-column grid (one column on a phone). */
export function sectionFields(section, lookups, values = {}) {
  return h('div', { className: 'grid grid-cols-3 gap-4 phone:grid-cols-1' }, section.fields.map((f) =>
    field({
      label: f.required ? `${f.label} *` : f.label,
      control: controlFor(f, lookups, values),
      className: f.span === 'full' ? 'col-span-3 phone:col-span-1' : '',
    })
  ));
}

/**
 * Religion > Denomination and State > Local Government. Call once the form is
 * on the page (the selects are searchable dropdowns by then); `change` fires on
 * their wrappers, so this listens on the scope.
 */
export function wireCascades(scope, lookups) {
  scope.addEventListener('change', (e) => {
    const name = e.target && e.target.getAttribute && e.target.getAttribute('name');
    if (name === 'religion_id') {
      const id = e.target.value;
      populateSelect(scope.querySelector('[name="religion_denomination_id"]'), filterDenominations(lookups, id), {
        placeholder: id ? '-- Select Denomination --' : '-- Select Religion First --',
      });
    } else if (name === 'state_id') {
      const id = e.target.value;
      populateSelect(scope.querySelector('[name="local_government_id"]'), filterLgas(lookups, id), {
        placeholder: id ? '-- Select Local Government --' : '-- Select State First --',
      });
    }
  });
}

/**
 * The form's values for the API: strings trimmed (empty ones become NULL on the
 * server) and dd/mm/yyyy dates as YYYY-MM-DD. A date that is not real throws
 * { message, fields } like an API error, so callers show it the same way.
 */
export function readForm(form) {
  const out = {};
  const fields = {};
  const dates = new Set(Array.from(form.querySelectorAll('input[data-date]')).map((i) => i.name));
  for (const [k, v] of new FormData(form).entries()) {
    if (v instanceof File) continue;
    const text = typeof v === 'string' ? v.trim() : v;
    if (dates.has(k)) {
      const iso = parseDisplayDate(text);
      if (iso === null) fields[k] = 'Use dd/mm/yyyy, for example 18/04/1991.';
      out[k] = iso || '';
    } else {
      out[k] = text;
    }
  }
  if (Object.keys(fields).length) throw Object.assign(new Error('Please correct the highlighted dates.'), { fields });
  return out;
}

/** Label / value pairs for the read-only card. Lookups show their names; dates show dd/mm/yyyy. */
export function displayRows(section, r) {
  return section.fields.map((f) => {
    if (f.show) return [f.label, f.show(r)];
    if (f.type === 'date') return [f.label, formatDisplayDate(r[f.name])];
    if (f.type === 'select') return [f.label, r[f.name.replace(/_id$/, '_name')] || ''];
    return [f.label, r[f.name] == null ? '' : String(r[f.name])];
  });
}

/** "On ship for" for the current posting. */
export const onShipFor = (startDate) => durationSince(startDate);
