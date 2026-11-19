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
 *   columns    [{ key, label, type, ... }] in the order the dialog shows them. `name` is always first.
 *       type      'text' | 'select' (fixed `options`) | 'number' | 'ref' (a row of another table) | 'multi'
 *       required  the dialog and the API insist on a value
 *       max       text length (the column's length)         min, max   a number's range
 *       unique    no two rows share the value (a name is always unique)
 *       scope     [keys] a unique value only has to be unique among rows with the same scope values
 *                 (a local government's name within its state)
 *       options   a 'select''s fixed values
 *       ref       a 'ref''s ref_ table; `blank` is the empty choice's label ("Any Branch");
 *                 NULL there means "any"
 *       junction  a 'multi''s link table { table, owner, value, ref }: none ticked means all
 *       list      false keeps the column out of the list (it stays in the row's dialog)
 *       hint      a line under the field
 *   usedBy     where a row is referred to: [{ table, column, noun: [one, many] }]. A row any of
 *              these refer to cannot be deleted (it can be made inactive). A package that adds a
 *              table pointing at a static table adds its entry here.
 *   order      ORDER BY (default: sort_order, name)
 */

const text = (key, label, extra = {}) => ({ key, label, type: 'text', ...extra });
const select = (key, label, options, extra = {}) => ({ key, label, type: 'select', options, ...extra });
const ref = (key, label, table, extra = {}) => ({ key, label, type: 'ref', ref: table, ...extra });

const nameColumn = (label, max = 150, extra = {}) => text('name', label, { required: true, max, ...extra });
const one = (noun, plural = `${noun}s`) => [noun, plural];

const TABLES = [
  {
    slug: 'appraisal-ratings',
    tab: 'Appraisal Ratings',
    title: 'Appraisal Ratings',
    item: 'Grade',
    table: 'ref_appraisal_rating',
    columns: [
      nameColumn('Grade', 50),
      text('code', 'Code', { required: true, max: 5, unique: true }),
      text('score_range', 'Score Range', { max: 20, hint: 'For example 90 - 100' }),
    ],
    usedBy: [],
  },
  {
    slug: 'branch',
    tab: 'Branch',
    title: 'Branches',
    item: 'Branch',
    table: 'ref_branch',
    columns: [nameColumn('Branch')],
    usedBy: [
      { table: 'ratings', column: 'branch_id', noun: one('rating') },
      { table: 'ref_training', column: 'branch_id', noun: one('training course') },
    ],
  },
  {
    slug: 'exit-type',
    tab: 'Exit Type',
    title: 'Exit Types',
    item: 'Exit Type',
    table: 'ref_exit_type',
    columns: [nameColumn('Exit Type')],
    usedBy: [{ table: 'ratings', column: 'exit_type_id', noun: one('rating') }],
  },
  {
    slug: 'entry-mode',
    tab: 'Entry Mode',
    title: 'Entry Modes',
    item: 'Entry Mode',
    table: 'ref_entry_mode',
    columns: [nameColumn('Entry Mode')],
    usedBy: [{ table: 'ratings', column: 'entry_mode_id', noun: one('rating') }],
  },
  {
    slug: 'offences',
    tab: 'Offences',
    title: 'Disciplinary Offences',
    item: 'Offence',
    table: 'ref_disciplinary_offence',
    columns: [
      nameColumn('Offence', 100),
      text('code', 'Code', { max: 10, unique: true }),
      select('category', 'Category', ['Conduct', 'Discipline', 'Duty', 'Property']),
    ],
    // WP4 (Disciplinary Action) adds its incident table here
    usedBy: [],
  },
  {
    slug: 'sanctions',
    tab: 'Sanctions',
    title: 'Disciplinary Sanctions',
    item: 'Sanction',
    table: 'ref_disciplinary_sanction',
    columns: [
      nameColumn('Sanction', 100),
      select('severity', 'Severity', ['Minor', 'Major']),
    ],
    // WP4 (Disciplinary Action) adds its incident table here
    usedBy: [],
  },
  {
    slug: 'institution',
    tab: 'Institution',
    title: 'Institutions',
    item: 'Institution',
    table: 'ref_institution',
    columns: [
      nameColumn('Institution', 100),
      text('location', 'Location', { max: 100 }),
      select('type', 'Type', ['Training Centre', 'Training Base', 'College', 'University', 'Polytechnic']),
    ],
    usedBy: [{ table: 'ref_training', column: 'institution_id', noun: one('training course') }],
  },
  {
    slug: 'local-government',
    tab: 'Local Government',
    title: 'Local Governments',
    item: 'Local Government',
    table: 'ref_local_government',
    columns: [
      nameColumn('Local Government', 150, { scope: ['state_id'] }),
      ref('state_id', 'State', 'ref_state', { required: true }),
    ],
    order: 'j_state_id.name ASC, t.sort_order ASC, t.name ASC',
    usedBy: [{ table: 'ratings', column: 'local_government_id', noun: one('rating') }],
  },
  {
    slug: 'languages',
    tab: 'Languages',
    title: 'Languages',
    item: 'Language',
    table: 'ref_language',
    columns: [nameColumn('Language')],
    usedBy: [{ table: 'rating_language', column: 'language_id', noun: one('rating language record') }],
  },
  {
    slug: 'relationship',
    tab: 'Relationship',
    title: 'Relationships',
    item: 'Relationship',
    // the next of kin type table: the old Relationship page (PLAN 9c decision 6)
    table: 'ref_next_of_kin_type',
    columns: [nameColumn('Relationship')],
    usedBy: [{ table: 'rating_next_of_kin', column: 'next_of_kin_type_id', noun: one('next of kin record') }],
  },
  {
    slug: 'staff-branch',
    tab: 'Staff Branch',
    title: 'Staff Branches',
    item: 'Staff Branch',
    table: 'ref_staff_branch',
    columns: [nameColumn('Staff Branch')],
    usedBy: [{ table: 'ratings', column: 'staff_branch_id', noun: one('rating') }],
  },
  {
    slug: 'specialisation',
    tab: 'Specialisation Area',
    title: 'Specialisation Areas',
    item: 'Specialisation',
    table: 'ref_specialisation',
    columns: [nameColumn('Specialisation')],
    usedBy: [
      { table: 'ratings', column: 'specialisation_id', noun: one('rating') },
      { table: 'ref_training', column: 'specialisation_id', noun: one('training course') },
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
      select('type', 'Type', ['Ship', 'Base'], { required: true }),
    ],
    usedBy: [{ table: 'rating_drafting', column: 'ship_id', noun: one('drafting record') }],
  },
  {
    slug: 'states',
    tab: 'States',
    title: 'States',
    item: 'State',
    table: 'ref_state',
    columns: [nameColumn('State')],
    usedBy: [
      { table: 'ratings', column: 'state_id', noun: one('rating') },
      { table: 'ref_local_government', column: 'state_id', noun: one('local government') },
    ],
  },
  {
    slug: 'title',
    tab: 'Title',
    title: 'Titles',
    item: 'Title',
    table: 'ref_title',
    columns: [nameColumn('Title')],
    usedBy: [{ table: 'ratings', column: 'title_id', noun: one('rating') }],
  },
  {
    slug: 'training',
    tab: 'Training',
    title: 'Training Courses',
    item: 'Course',
    table: 'ref_training',
    columns: [
      nameColumn('Course', 100),
      ref('institution_id', 'Institution', 'ref_institution', { required: true }),
      { key: 'weeks', label: 'Weeks', type: 'number', required: true, min: 1, max: 520 },
      ref('branch_id', 'Branch', 'ref_branch', { blank: 'Any Branch', list: false }),
      ref('specialisation_id', 'Specialisation', 'ref_specialisation', { blank: 'Any Specialisation', list: false }),
      {
        key: 'rate_ids',
        label: 'Rates',
        type: 'multi',
        list: false,
        junction: { table: 'ref_training_rate', owner: 'training_id', value: 'rate_id', ref: 'ref_rate' },
        hint: 'Who may attend. None picked means every rate.',
      },
    ],
    // WP6 (Training Drafting) adds its training history table here
    usedBy: [],
  },
];

const BY_SLUG = new Map(TABLES.map((t) => [t.slug, t]));

// "state_id" -> "state", "rate_ids" -> "rate": the alias a column's names are read under ("state_name", "rate_names")
const stem = (key) => key.replace(/_ids?$/, '');

module.exports = {
  TABLES,
  bySlug: (slug) => BY_SLUG.get(slug) || null,
  stem,
};
