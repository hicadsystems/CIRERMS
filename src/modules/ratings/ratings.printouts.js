'use strict';

/*
 * The ratings module's printouts, made from the templates in src/templates/printouts:
 *   personnel-dossier (the whole record), rating-report (one tab), ratings-list (the nominal roll).
 * Each function shapes the module's data for its template and returns the PDF as a Buffer.
 */
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { renderPdf, todayIso } = require('../../shared/printouts');

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

const fullName = (r) => [r.surname, r.first_name, r.middle_name].filter(Boolean).join(' ');
const upperStatus = (r) => String(r.status || 'current').toUpperCase();
const yesNo = (v) => (v ? 'Yes' : 'No');
const f = (label, value, kind) => (kind ? { label, value, kind } : { label, value });

/** The passport photo as a data URI (the page is loaded without access to the app's files), or ''. */
function photoUri(rating) {
  if (!rating.passport_photo_path) return '';
  const file = path.join(config.uploads.photosDir, path.basename(rating.passport_photo_path));
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!mime || !fs.existsSync(file)) return '';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

const table = (no, heading, columns, rows) => ({ no, heading, columns, rows });

async function dossierPdf({ rating, children, generatedBy }) {
  const r = rating;
  const data = {
    title: `PERSONNEL DOSSIER — ${r.service_number}`,
    generatedBy,
    ref: r.service_number,
    subtitle: `${fullName(r)}  |  Status: ${upperStatus(r)}`,
    photo: photoUri(r),
    identity: [
      f('Official Number', r.service_number, 'code'), f('Rate', r.rate_name), f('Name', fullName(r)),
      f('Status', r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : 'Current'), f('Current Ship', r.current_ship_name), f('Command', r.command_name),
    ],
    basic: [
      f('Official Number', r.service_number, 'code'), f('Rate', r.rate_name), f('Title', r.title_name),
      f('Status', r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : 'Current'),
      f('Surname', r.surname), f('First Name', r.first_name), f('Middle Name', r.middle_name), f('Maiden Name', r.maiden_name),
      f('Gender', r.gender_name), f('Date of Birth', r.date_of_birth, 'date'), f('Marital Status', r.marital_status_name),
      f('Married to Military', r.married_to_military_personnel), f('Religion', r.religion_name), f('Denomination', r.religion_denomination_name),
      f('Tribe', r.tribe_name), f('Current Ship', r.current_ship_name),
    ],
    contact: [
      f('State of Origin', r.state_name), f('Local Government', r.local_government_name), f('Geo-Political Zone', r.geo_political_zone_name),
      f('Place of Birth', r.place_of_birth), f('Mother Base', r.mother_base_name), f('Phone', r.phone), f('Email Address', r.email_address),
      f('Home Address', r.home_address), f('ID Type', r.identification_type_name), f('Identity Number', r.identity_number),
      f('Driver License No.', r.driver_license_number), f('License Expiry', r.driver_license_expiry_date, 'date'),
    ],
    health: [
      f('Weight (kg)', r.weight_kg), f('Height (m)', r.height_m), f('Chest (cm)', r.chest_cm), f('Blood Group', r.blood_group_name),
      f('Genotype', r.blood_genotype_name), f('Hair Color', r.hair_color_name), f('Eye Color', r.eye_color_name), f('Complexion', r.complexion_name),
      f('Tribal Mark', yesNo(r.tribal_mark)), f('Disability', r.disability_name), f('Disability Comment', r.disability_comment), f('Hobbies', r.hobbies),
    ],
    service: [
      f('Branch', r.branch_name), f('Command', r.command_name), f('Staff Branch', r.staff_branch_name), f('Specialisation', r.specialisation_name),
      f('Entry Mode', r.entry_mode_name), f('Date Employed', r.date_employed, 'date'), f('Seniority Date', r.seniority_date, 'date'),
      f('Exit Type', r.exit_type_name), f('Exit Date', r.exit_date, 'date'), f('Exit Reason', r.exit_reason),
    ],
    nextOfKin: table(5, 'Next of Kin', [
      { label: 'First Name', key: 'first_name', w: '26%' }, { label: 'Last Name', key: 'last_name', w: '26%' },
      { label: 'Mobile Number', key: 'mobile_number', kind: 'code', w: '24%' }, { label: 'Next of Kin Type', key: 'next_of_kin_type_name' },
    ], children.nextOfKin || []),
    family: table(6, 'Spouse & Children', [
      { label: 'Relation', key: 'relation', w: '14%' }, { label: 'Name', key: 'name', w: '34%' },
      { label: 'Phone Number', key: 'phone_number', kind: 'code', w: '22%' }, { label: 'Email Address', key: 'email_address' },
    ], [
      ...(children.spouse || []).map((s) => ({ relation: 'Spouse', ...s })),
      ...(children.children || []).map((c) => ({ relation: 'Child', ...c })),
    ]),
    advancement: table(7, 'Advancement History', [
      { label: 'Rate', key: 'rate_name', w: '16%' }, { label: 'Start Date', key: 'start_date', kind: 'date', w: '13%' },
      { label: 'End Date', key: 'end_date', kind: 'date', w: '13%' }, { label: 'Decoration', key: 'decoration', w: '20%' },
      { label: 'Authority', key: 'authority', kind: 'code', w: '22%' }, { label: 'GCB No.', key: 'gcbno', kind: 'code' },
    ], children.advancement || []),
    drafting: table(8, 'Drafting History', [
      { label: 'Ship / Unit', key: 'ship_name', kind: 'name', w: '24%' }, { label: 'Rate', key: 'rate_name', w: '14%' },
      { label: 'Start Date', key: 'start_date', kind: 'date', w: '14%' }, { label: 'End Date', key: 'end_date', kind: 'date', w: '14%' },
      { label: 'Remarks', key: 'remarks' },
    ], (children.drafting || []).map((d) => ({ ...d, end_date: d.end_date || 'Present' }))),
    training: table(9, 'Training & Education', [
      { label: 'Type', key: 'kind', w: '11%' }, { label: 'Institution', key: 'institution', w: '30%' }, { label: 'Qualification', key: 'qualification', w: '24%' },
      { label: 'Class', key: 'classification', w: '14%' }, { label: 'Period', key: 'period' },
    ], [
      ...(children.training || []).map((t) => ({ kind: 'Training', ...t })),
      ...(children.education || []).map((e) => ({ kind: 'Education', ...e })),
    ].map((x) => ({ ...x, period: periodOf(x) }))),
    languages: table(10, 'Languages', [
      { label: 'Language', key: 'language_name', w: '40%' }, { label: 'Read', key: 'read', kind: 'ctr', w: '20%' },
      { label: 'Write', key: 'write', kind: 'ctr', w: '20%' }, { label: 'Speak', key: 'speak', kind: 'ctr' },
    ], (children.language || []).map((l) => ({ ...l, read: yesNo(l.can_read), write: yesNo(l.can_write), speak: yesNo(l.can_speak) }))),
  };
  return renderPdf('personnel-dossier', data);
}

const dmy = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const periodOf = (x) => `${dmy(x.start_date) || '?'} – ${dmy(x.end_date) || 'Present'}`;

/** One tab of the rating's record: columns are { label, key, kind, w }, rows as the repo gives them. */
async function tabPdf({ rating, title, columns, rows, generatedBy }) {
  const r = rating;
  const data = {
    title: `${title.toUpperCase()} RECORD`,
    generatedBy,
    ref: r.service_number,
    subtitle: `${r.service_number} — ${fullName(r)} (${r.rate_name || 'Unrated'})`,
    facts: [
      f('Official No', r.service_number, 'code'), f('Name', fullName(r)), f('Rate', r.rate_name), f('Branch', r.branch_name),
      f('Date Employed', r.date_employed, 'date'), f('Status', r.status ? r.status.charAt(0).toUpperCase() + r.status.slice(1) : 'Current'),
    ],
    table: { columns, rows },
  };
  return renderPdf('rating-report', data);
}

/** The nominal roll of current or former ratings, one row per rating, landscape. */
async function listPdf({ status, rows, filter, generatedBy }) {
  const former = status === 'former';
  const columns = former
    ? [
      { label: 'S/N', kind: 'index', w: '6%' }, { label: 'Official No.', key: 'service_number', kind: 'code', w: '10%' },
      { label: 'Full Name', key: 'full_name', kind: 'name', w: '25%' }, { label: 'Rate', key: 'rate_name', w: '16%' },
      { label: 'Exit Type', key: 'exit_type_name', w: '15%' }, { label: 'Exit Date', key: 'exit_date', kind: 'date', w: '12%' }, { label: 'Branch', key: 'branch_name' },
    ]
    : [
      { label: 'S/N', kind: 'index', w: '6%' }, { label: 'Official No.', key: 'service_number', kind: 'code', w: '10%' },
      { label: 'Full Name', key: 'full_name', kind: 'name', w: '25%' }, { label: 'Rate', key: 'rate_name', w: '16%' },
      { label: 'Current Ship', key: 'current_ship_name', w: '15%' }, { label: 'Branch', key: 'branch_name', w: '14%' }, { label: 'Command', key: 'command_name' },
    ];
  const data = {
    title: former ? 'FORMER RATINGS NOMINAL ROLL' : 'CURRENT RATINGS NOMINAL ROLL',
    generatedBy,
    subtitle: filter ? `Total matching records: ${rows.length} | Filter: "${filter}"` : `Total records: ${rows.length}`,
    summary: [{ label: 'Ratings', value: rows.length }],
    facts: [f('Status', former ? 'Former' : 'Current'), f('Filter', filter), f('Printed', todayIso(), 'date')],
    table: { columns, rows },
  };
  return renderPdf('ratings-list', data);
}

module.exports = { dossierPdf, tabPdf, listPdf };
