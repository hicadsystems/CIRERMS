'use strict';

/*
 * The Static Tables, one config per table. The engine (tables.repo.js, tables.service.js,
 * tables.routes.js and the screen public/js/sections/static-table.js) is generic: it reads
 * everything it needs from here. To add a table, add an entry below (and its migration, and its
 * page and tab in public/js/core/nav.js); to add a column, add it to `columns` (and its migration).
 *
 *   slug       the route (#tables/<slug>, /api/tables/<slug>) and the privilege screen `tables.<slug>`
 *   tab        the tab's label        title  the page title        item  one row's name ("Add Ship")
 *   table      the ref_ table. Every table has id, name, sort_order and is_active
 *   columns    [{ key, label, type, ... }] in the order the dialog shows them
 *       type      'text' | 'select' (fixed `options`) | 'number' | 'bool' (Yes or No) | 'ref' (a row of
 *                 another table) | 'multi' (several rows, through a link table) | 'virtual' (worked out
 *                 by the service, never stored: shown in the list)
 *       required  the dialog and the API insist on a value
 *       max       text length (the column's length)         min, max   a number's range
 *       upper     text kept trimmed and in upper case (every code)
 *       unique    no two rows share the value (a name is always unique)
 *       scope     [keys] a unique value only has to be unique among rows with the same scope values
 *                 (a local government's name within its state)
 *       options   a 'select''s fixed values
 *       ref       a 'ref''s ref_ table; `blank` is the empty choice's label ("Any Branch");
 *                 NULL there means "any"
 *       junction  a 'multi''s link table { table, owner, value, ref }: none ticked means all
 *       list      true shows the column in the list (the list shows the demo's columns and the code,
 *                 four at most); everything else is in the row's dialog
 *       hint      a line under the field
 *   rule       'score-range': the table's own check (see tables.service.js)
 *   order      ORDER BY (default: sort_order, name)
 *
 * Where a row is used is not configured: it is read from the database's declared foreign keys
 * (information_schema), so a later module's table is covered as soon as it declares its own. A
 * package that adds a link therefore declares a foreign key for it. `NOUNS` only names what the
 * referring table holds, in the message ("5 ratings").
 */

const text = (key, label, extra = {}) => ({ key, label, type: 'text', ...extra });
const code = (max, extra = {}) => text('code', 'Code', { max, upper: true, unique: true, ...extra });
const select = (key, label, options, extra = {}) => ({ key, label, type: 'select', options, ...extra });
const ref = (key, label, table, extra = {}) => ({ key, label, type: 'ref', ref: table, ...extra });

const nameColumn = (label, max = 150, extra = {}) => text('name', label, { required: true, max, list: true, ...extra });

const TABLES = [
  {
    slug: 'appraisal-ratings',
    tab: 'Appraisal Ratings',
    title: 'Appraisal Ratings',
    item: 'Grade',
    table: 'ref_appraisal_rating',
    rule: 'score-range',
    columns: [
      code(5, { required: true, list: true }),
      nameColumn('Grade', 50),
      { key: 'score_low', label: 'Lowest Score', type: 'number', required: true, min: 0, max: 100 },
      { key: 'score_high', label: 'Highest Score', type: 'number', required: true, min: 0, max: 100 },
      { key: 'score_range', label: 'Score Range', type: 'virtual', list: true },
    ],
    order: 't.score_high DESC, t.score_low DESC, t.name ASC',
  },
  {
    slug: 'branch',
    tab: 'Branch',
    title: 'Branches',
    item: 'Branch',
    table: 'ref_branch',
    columns: [nameColumn('Branch'), code(2, { required: true, list: true, hint: 'In the drafting and advancement batch numbers, for example SM' })],
  },
  {
    slug: 'exit-type',
    tab: 'Exit Type',
    title: 'Exit Types',
    item: 'Exit Type',
    table: 'ref_exit_type',
    columns: [
      nameColumn('Exit Type'),
      code(2, { required: true, list: true }),
      { key: 'keeps_current', label: 'Rating Stays Current', type: 'bool', list: true, hint: 'Yes keeps a rating on the Current list (the old codes A, M and C). Discharge offers only exit types that do not.' },
      { key: 'is_death', label: 'Death', type: 'bool', hint: 'Yes for the deceased exit type: Discharge shows the death documents (death certificate, condolence letter, evidence, sworn affidavit) only for it.' },
    ],
  },
  {
    slug: 'entry-mode',
    tab: 'Entry Mode',
    title: 'Entry Modes',
    item: 'Entry Mode',
    table: 'ref_entry_mode',
    columns: [nameColumn('Entry Mode'), code(5, { required: true, list: true })],
  },
  {
    slug: 'offences',
    tab: 'Offences',
    title: 'Disciplinary Offences',
    item: 'Offence',
    table: 'ref_disciplinary_offence',
    columns: [
      nameColumn('Offence', 100),
      code(10, { required: true, list: true }),
      select('category', 'Category', ['Conduct', 'Discipline', 'Duty', 'Property'], { list: true }),
    ],
  },
  {
    slug: 'sanctions',
    tab: 'Sanctions',
    title: 'Disciplinary Sanctions',
    item: 'Sanction',
    table: 'ref_disciplinary_sanction',
    columns: [
      nameColumn('Sanction', 100),
      select('severity', 'Severity', ['Minor', 'Major'], { list: true }),
    ],
  },
  {
    slug: 'institution',
    tab: 'Institution',
    title: 'Institutions',
    item: 'Institution',
    table: 'ref_institution',
    columns: [
      code(30, { list: true, hint: 'For example UNIBEN' }),
      nameColumn('Institution', 100),
      text('location', 'Location', { max: 100, list: true }),
      select('type', 'Type', ['University', 'Polytechnic', 'College', 'Secondary School', 'Training Centre', 'Training Base', 'Other'], { list: true }),
    ],
  },
  {
    slug: 'local-government',
    tab: 'Local Government',
    title: 'Local Governments',
    item: 'Local Government',
    table: 'ref_local_government',
    columns: [
      nameColumn('Local Government', 150, { scope: ['state_id'] }),
      ref('state_id', 'State', 'ref_state', { required: true, list: true }),
      code(10, { list: true }),
    ],
    order: 'j_state_id.name ASC, t.sort_order ASC, t.name ASC',
  },
  {
    slug: 'languages',
    tab: 'Languages',
    title: 'Languages',
    item: 'Language',
    table: 'ref_language',
    columns: [nameColumn('Language')],
  },
  {
    slug: 'relationship',
    tab: 'Relationship',
    title: 'Relationships',
    item: 'Relationship',
    // the next of kin type table: the old Relationship page (PLAN 9c decision 6)
    table: 'ref_next_of_kin_type',
    columns: [nameColumn('Relationship'), code(5, { list: true })],
  },
  {
    slug: 'staff-branch',
    tab: 'Staff Branch',
    title: 'Staff Branches',
    item: 'Staff Branch',
    table: 'ref_staff_branch',
    columns: [
      nameColumn('Staff Branch'),
      code(20, { list: true }),
      ref('command_id', 'Command', 'ref_command', { blank: 'No Command', hint: 'The rating form\'s Staff Branch list follows the chosen Command.' }),
      text('department', 'Department', { max: 20 }),
      text('cdr', 'CDR', { max: 20 }),
    ],
  },
  {
    slug: 'specialisation',
    tab: 'Specialisation Area',
    title: 'Specialisation Areas',
    item: 'Specialisation',
    table: 'ref_specialisation',
    columns: [
      nameColumn('Specialisation'),
      code(15, { required: true, list: true, hint: 'In the batch numbers' }),
      text('second_description', 'Second Description', { max: 20 }),
    ],
  },
  {
    slug: 'ships',
    tab: 'Ships',
    title: 'Ships and Bases',
    item: 'Ship',
    table: 'ref_ship',
    columns: [
      nameColumn('Ship'),
      select('type', 'Type', ['Sea', 'Land', 'Training'], { required: true, list: true, hint: 'Sea for a ship, Land for a base or shore unit, Training for a training establishment' }),
      ref('command_id', 'Command', 'ref_command', { blank: 'No Command', list: true }),
      text('description', 'Description', { max: 150 }),
    ],
  },
  {
    slug: 'states',
    tab: 'States',
    title: 'States',
    item: 'State',
    table: 'ref_state',
    columns: [
      nameColumn('State'),
      code(5, { required: true, list: true }),
      ref('geo_political_zone_id', 'Geo-Political Zone', 'ref_geo_political_zone', { blank: 'No Zone', hint: 'The rating form fills the zone from the chosen state.' }),
    ],
  },
  {
    slug: 'title',
    tab: 'Title',
    title: 'Titles',
    item: 'Title',
    table: 'ref_title',
    columns: [nameColumn('Title'), text('description', 'Description', { max: 50, list: true })],
  },
  {
    slug: 'training',
    tab: 'Training',
    title: 'Training Courses',
    item: 'Course',
    table: 'ref_training',
    columns: [
      code(10, { list: true }),
      nameColumn('Course', 60),
      text('qualification', 'Qualification Awarded', { max: 50 }),
      ref('institution_id', 'Institution', 'ref_institution', { required: true, list: true }),
      { key: 'weeks', label: 'Weeks', type: 'number', required: true, min: 1, max: 104, list: true },
      ref('branch_id', 'Branch', 'ref_branch', { blank: 'Any Branch' }),
      ref('specialisation_id', 'Specialisation', 'ref_specialisation', { blank: 'Any Specialisation' }),
      {
        key: 'rate_ids',
        label: 'Rates',
        type: 'multi',
        junction: { table: 'ref_training_rate', owner: 'training_id', value: 'rate_id', ref: 'ref_rate' },
        hint: 'Who may attend. None picked means every rate.',
      },
    ],
  },
];

// what a table that refers to a static table holds, for "in use (5 ratings)"; any other table is
// named from its own name ("5 rating_x records")
const NOUNS = {
  ratings: ['rating', 'ratings'],
  discipline_cases: ['disciplinary case', 'disciplinary cases'],
  rating_language: ['rating language record', 'rating language records'],
  rating_next_of_kin: ['next of kin record', 'next of kin records'],
  rating_spouse: ['spouse record', 'spouse records'],
  rating_children: ['child record', 'child records'],
  rating_drafting: ['drafting record', 'drafting records'],
  rating_training: ['training record', 'training records'],
  rating_education: ['education record', 'education records'],
  ref_training: ['training course', 'training courses'],
  ref_local_government: ['local government', 'local governments'],
  ref_staff_branch: ['staff branch', 'staff branches'],
  ref_ship: ['ship or base', 'ships and bases'],
  ref_state: ['state', 'states'],
};
const nounFor = (table) => NOUNS[table] || [`${table.replace(/_/g, ' ')} record`, `${table.replace(/_/g, ' ')} records`];

const BY_SLUG = new Map(TABLES.map((t) => [t.slug, t]));

// "state_id" -> "state", "rate_ids" -> "rate": the alias a column's names are read under ("state_name", "rate_names")
const stem = (key) => key.replace(/_ids?$/, '');

module.exports = {
  TABLES,
  nounFor,
  bySlug: (slug) => BY_SLUG.get(slug) || null,
  stem,
};
