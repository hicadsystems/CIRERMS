'use strict';

const db = require('../../db');

const SIMPLE_TABLES = Object.freeze({
  genders: 'ref_gender',
  maritalStatuses: 'ref_marital_status',
  religions: 'ref_religion',
  states: 'ref_state',
  tribes: 'ref_tribe',
  rates: 'ref_rate',
  titles: 'ref_title',
  ships: 'ref_ship',
  languages: 'ref_language',
  nextOfKinTypes: 'ref_next_of_kin_type',
  exitTypes: 'ref_exit_type',
  geoPoliticalZones: 'ref_geo_political_zone',
  motherBases: 'ref_mother_base',
  identificationTypes: 'ref_identification_type',
  hairColors: 'ref_hair_color',
  eyeColors: 'ref_eye_color',
  complexions: 'ref_complexion',
  bloodGroups: 'ref_blood_group',
  bloodGenotypes: 'ref_blood_genotype',
  disabilities: 'ref_disability',
  branches: 'ref_branch',
  commands: 'ref_command',
  staffBranches: 'ref_staff_branch',
  entryModes: 'ref_entry_mode',
  specialisations: 'ref_specialisation',
});

// The codes, flags and links each table carries beyond its name, for the forms and the later
// modules: [column, name in the bundle]. Anything not listed is just { id, name }.
const EXTRAS = Object.freeze({
  branches: [['code', 'code']],
  exitTypes: [['code', 'code'], ['keeps_current', 'keepsCurrent'], ['is_death', 'isDeath']],
  entryModes: [['code', 'code']],
  nextOfKinTypes: [['code', 'code']],
  staffBranches: [['code', 'code'], ['command_id', 'commandId'], ['department', 'department'], ['cdr', 'cdr']],
  specialisations: [['code', 'code'], ['second_description', 'secondDescription']],
  ships: [['type', 'type'], ['command_id', 'commandId'], ['description', 'description']],
  states: [['code', 'code'], ['geo_political_zone_id', 'geoPoliticalZoneId']],
  titles: [['description', 'description']],
  rates: [['code', 'code']],
});

// Every row of a table in dropdown order, flagged active or not: the active ones fill the
// dropdowns, the inactive ones are kept apart so a record that still holds one can show it.
async function fetchSimpleLookup(key, tableName) {
  const extra = (EXTRAS[key] || []).map(([col, alias]) => `, ${col} AS ${alias}`).join('');
  const rows = await db.query(
    `SELECT id, name${extra}, is_active AS isActive FROM ${tableName} ORDER BY sort_order ASC, name ASC`
  );
  // a yes/no flag is true or false in the bundle
  return rows.map((r) => (r.keepsCurrent === undefined ? r : { ...r, keepsCurrent: !!r.keepsCurrent, isDeath: !!r.isDeath }));
}

const strip = ({ isActive, ...rest }) => rest;
const activeOf = (rows) => rows.filter((r) => r.isActive).map(strip);
const inactiveOf = (rows) => rows.filter((r) => !r.isActive).map(strip);

// the tables the Static Tables screens added: for the forms and modules that pick from them
async function fetchInstitutions() {
  return db.query(`SELECT id, code, name, location, type, is_active AS isActive FROM ref_institution ORDER BY sort_order ASC, name ASC`);
}

async function fetchTrainingCourses() {
  const rows = await db.query(
    `SELECT t.id, t.code, t.name, t.qualification, t.institution_id AS institutionId, t.weeks,
            t.branch_id AS branchId, t.specialisation_id AS specialisationId, t.is_active AS isActive,
            (SELECT GROUP_CONCAT(l.rate_id ORDER BY l.rate_id) FROM ref_training_rate l WHERE l.training_id = t.id) AS rateIds
       FROM ref_training t ORDER BY t.sort_order ASC, t.name ASC`
  );
  return rows.map((r) => ({ ...r, rateIds: r.rateIds ? String(r.rateIds).split(',').map(Number) : [] }));
}

async function fetchAppraisalRatings() {
  return db.query(`SELECT id, code, name, score_low AS scoreLow, score_high AS scoreHigh, is_active AS isActive FROM ref_appraisal_rating ORDER BY score_high DESC, name ASC`);
}

async function fetchOffences() {
  return db.query(`SELECT id, code, name, category, is_active AS isActive FROM ref_disciplinary_offence ORDER BY sort_order ASC, name ASC`);
}

async function fetchSanctions() {
  return db.query(`SELECT id, name, severity, is_active AS isActive FROM ref_disciplinary_sanction ORDER BY sort_order ASC, name ASC`);
}

async function fetchReligionDenominations(religionId = null) {
  if (religionId) {
    return db.query(
      `SELECT id, religion_id AS religionId, name
         FROM ref_religion_denomination
        WHERE is_active = 1 AND religion_id = ?
        ORDER BY sort_order ASC, name ASC`,
      [religionId]
    );
  }
  return db.query(
    `SELECT id, religion_id AS religionId, name
       FROM ref_religion_denomination
      WHERE is_active = 1
      ORDER BY religion_id ASC, sort_order ASC, name ASC`
  );
}

async function fetchLocalGovernments(stateId = null) {
  if (stateId) {
    return db.query(
      `SELECT id, state_id AS stateId, name, code
         FROM ref_local_government
        WHERE is_active = 1 AND state_id = ?
        ORDER BY sort_order ASC, name ASC`,
      [stateId]
    );
  }
  return db.query(
    `SELECT id, state_id AS stateId, name, code
       FROM ref_local_government
      WHERE is_active = 1
      ORDER BY state_id ASC, sort_order ASC, name ASC`
  );
}

async function fetchInactiveLocalGovernments() {
  return db.query(
    `SELECT id, state_id AS stateId, name FROM ref_local_government WHERE is_active = 0 ORDER BY state_id ASC, sort_order ASC, name ASC`
  );
}

async function fetchDocumentCategories() {
  return db.query(
    `SELECT id, code, name
       FROM ref_document_category
      WHERE is_active = 1
      ORDER BY sort_order ASC, name ASC`
  );
}

async function fetchAllLookups() {
  const entries = Object.entries(SIMPLE_TABLES);
  const results = await Promise.all([
    ...entries.map(([key, table]) => fetchSimpleLookup(key, table)),
    fetchReligionDenominations(),
    fetchLocalGovernments(),
    fetchDocumentCategories(),
    fetchInactiveLocalGovernments(),
    fetchInstitutions(),
    fetchTrainingCourses(),
    fetchAppraisalRatings(),
    fetchOffences(),
    fetchSanctions(),
  ]);

  const bundle = { inactive: {} };
  entries.forEach(([key], idx) => {
    bundle[key] = activeOf(results[idx]);
    const off = inactiveOf(results[idx]);
    if (off.length) bundle.inactive[key] = off;
  });
  bundle.religionDenominations = results[entries.length];
  bundle.localGovernments = results[entries.length + 1];
  bundle.documentCategories = results[entries.length + 2];
  if (results[entries.length + 3].length) bundle.inactive.localGovernments = results[entries.length + 3];
  [['institutions', 4], ['trainingCourses', 5], ['appraisalRatings', 6], ['offences', 7], ['sanctions', 8]].forEach(([key, at]) => {
    const rows = results[entries.length + at - 0];
    bundle[key] = activeOf(rows);
    const off = inactiveOf(rows);
    if (off.length) bundle.inactive[key] = off;
  });

  return bundle;
}

module.exports = {
  fetchAllLookups,
  fetchReligionDenominations,
  fetchLocalGovernments,
  fetchDocumentCategories,
};
