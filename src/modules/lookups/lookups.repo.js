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

// Every row of a table in dropdown order, flagged active or not: the active ones fill the
// dropdowns, the inactive ones are kept apart so a record that still holds one can show it.
async function fetchSimpleLookup(tableName) {
  return db.query(
    `SELECT id, name, is_active AS isActive FROM ${tableName} ORDER BY sort_order ASC, name ASC`
  );
}

const activeOf = (rows) => rows.filter((r) => r.isActive).map((r) => ({ id: r.id, name: r.name }));
const inactiveOf = (rows) => rows.filter((r) => !r.isActive).map((r) => ({ id: r.id, name: r.name }));

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
      `SELECT id, state_id AS stateId, name
         FROM ref_local_government
        WHERE is_active = 1 AND state_id = ?
        ORDER BY sort_order ASC, name ASC`,
      [stateId]
    );
  }
  return db.query(
    `SELECT id, state_id AS stateId, name
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
    ...entries.map(([, table]) => fetchSimpleLookup(table)),
    fetchReligionDenominations(),
    fetchLocalGovernments(),
    fetchDocumentCategories(),
    fetchInactiveLocalGovernments(),
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

  return bundle;
}

module.exports = {
  fetchAllLookups,
  fetchReligionDenominations,
  fetchLocalGovernments,
  fetchDocumentCategories,
};
