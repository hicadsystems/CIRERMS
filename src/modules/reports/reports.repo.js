'use strict';

/*
 * Reports (WP9): the SQL behind the six pages. Reads only. Plain parameterised SQL.
 * One filtered query feeds each page, its PDF and its Excel file: a page asks for 25 rows, the PDF and the
 * workbook ask for every row (up to MAX_ROWS).
 *
 * Two parts are borrowed, never copied:
 *   - who is aboard a ship, in Manning State: Drafting's own manning query (drafting.repo.allManning), so Update
 *     Manning Requirement and Manning State never disagree;
 *   - who is due for discharge, in Retirement Forecast: Discharge's due rule and exclusions (discharge.repo).
 */
const db = require('../../db');
const drafting = require('../drafting/drafting.repo');
const discharge = require('../discharge/discharge.repo');

const MAX_ROWS = 50000;

// a rating's open posting (its current ship), kept even when it has none (Drafting's own definition, as a LEFT JOIN)
const CUR_LEFT = drafting.CURRENT_POSTING.replace(/^\s*JOIN rating_drafting/, 'LEFT JOIN rating_drafting');
const CUR_INNER = drafting.CURRENT_POSTING;

const REF_TABLES = new Set([
  'ref_ship', 'ref_command', 'ref_branch', 'ref_rate', 'ref_specialisation', 'ref_mother_base', 'ref_staff_branch',
  'ref_entry_mode', 'ref_state', 'ref_geo_political_zone',
]);

const paged = (sql, params, { page, pageSize }) => (pageSize
  ? db.query(`${sql} LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize])
  : db.query(`${sql} LIMIT ${MAX_ROWS}`, params));

// ---- options -----------------------------------------------------------------------------------

async function options() {
  const [ships, commands, branches, rates, specialisations, areas, staffBranches, entryModes, states, zones] = await Promise.all([
    db.query('SELECT id, name, type, command_id, is_active FROM ref_ship ORDER BY sort_order, name'),
    db.query('SELECT id, name, is_active FROM ref_command ORDER BY sort_order, name'),
    db.query('SELECT id, name, code, is_active FROM ref_branch ORDER BY sort_order, name'),
    db.query('SELECT id, name, code, sort_order FROM ref_rate ORDER BY sort_order, name'),
    db.query('SELECT id, name, code, is_active FROM ref_specialisation ORDER BY sort_order, name'),
    db.query('SELECT id, name, is_active FROM ref_mother_base ORDER BY sort_order, name'),
    db.query('SELECT id, name, is_active FROM ref_staff_branch ORDER BY sort_order, name'),
    db.query('SELECT id, name, is_active FROM ref_entry_mode ORDER BY sort_order, name'),
    db.query('SELECT id, name, is_active FROM ref_state ORDER BY sort_order, name'),
    db.query('SELECT id, name, is_active FROM ref_geo_political_zone ORDER BY sort_order, name'),
  ]);
  return { ships, commands, branches, rates, specialisations, areas, staffBranches, entryModes, states, zones };
}

async function refName(table, id) {
  if (!REF_TABLES.has(table)) throw new Error('Unknown table');
  const rows = await db.query(`SELECT name FROM ${table} WHERE id = ?`, [id]);
  return rows[0] ? rows[0].name : '';
}

async function allRates() {
  return db.query('SELECT id, name, code, sort_order FROM ref_rate ORDER BY sort_order, name');
}

// ---- 1. Ship History ---------------------------------------------------------------------------

const SHIP_FROM = `FROM rating_drafting p
    JOIN ratings r ON r.service_number = p.service_number
    LEFT JOIN ref_rate pr ON pr.id = p.rate_id
    LEFT JOIN ref_rate cr ON cr.id = r.rate_id
    LEFT JOIN ref_specialisation sp ON sp.id = r.specialisation_id`;

/** The postings to the ship that overlap the period (a posting with no end is still on). */
function shipWhere(f) {
  const sql = ['p.ship_id = ?'];
  const params = [f.shipId];
  if (f.from) { sql.push("COALESCE(p.end_date, '9999-12-31') >= ?"); params.push(f.from); }
  if (f.to) { sql.push("COALESCE(p.start_date, '1900-01-01') <= ?"); params.push(f.to); }
  return { sql: `WHERE ${sql.join(' AND ')}`, params };
}

async function shipHistory(f, { page = 1, pageSize = 25 } = {}) {
  const w = shipWhere(f);
  const [t] = await db.query(
    `SELECT COUNT(*) AS postings, COALESCE(SUM(p.end_date IS NULL AND r.status = 'current'), 0) AS aboard,
            AVG(TIMESTAMPDIFF(MONTH, p.start_date, COALESCE(p.end_date, ?))) AS avg_months
       ${SHIP_FROM} ${w.sql}`, [f.today, ...w.params]);
  const sql = `SELECT p.id, p.service_number, p.start_date, p.end_date, p.remarks, r.status, r.surname, r.first_name, r.middle_name,
         COALESCE(pr.code, cr.code) AS rate_code, COALESCE(pr.name, cr.name) AS rate_name, sp.name AS specialisation_name,
         TIMESTAMPDIFF(MONTH, p.start_date, COALESCE(p.end_date, ?)) AS months
    ${SHIP_FROM} ${w.sql}
    ORDER BY p.start_date IS NULL, p.start_date DESC, r.surname, r.first_name, p.id DESC`;
  const items = await paged(sql, [f.today, ...w.params], { page, pageSize });
  return {
    items,
    total: Number(t.postings),
    aboard: Number(t.aboard),
    avgMonths: t.avg_months === null || t.avg_months === undefined ? null : Number(t.avg_months),
  };
}

// ---- 2. All Personnel --------------------------------------------------------------------------

const PERSON_FROM = `FROM ratings r
    LEFT JOIN ref_rate rt ON rt.id = r.rate_id
    LEFT JOIN ref_branch br ON br.id = r.branch_id
    LEFT JOIN ref_command cm ON cm.id = r.command_id
    LEFT JOIN ref_staff_branch sb ON sb.id = r.staff_branch_id
    LEFT JOIN ref_specialisation sp ON sp.id = r.specialisation_id
    LEFT JOIN ref_entry_mode em ON em.id = r.entry_mode_id
    LEFT JOIN ref_state st ON st.id = r.state_id
    LEFT JOIN ref_geo_political_zone gz ON gz.id = r.geo_political_zone_id
    LEFT JOIN ref_mother_base mb ON mb.id = r.mother_base_id
    LEFT JOIN ref_gender g ON g.id = r.gender_id
    ${CUR_LEFT}
    LEFT JOIN ref_ship sh ON sh.id = cur.ship_id`;

/** The sorts, by name: the columns come from this list only. */
const PERSON_SORTS = {
  number: 'r.service_number',
  name: 'r.surname, r.first_name, r.middle_name',
  dob: 'r.date_of_birth IS NULL, r.date_of_birth',
  branch: 'br.name IS NULL, br.name',
  ship: 'sh.name IS NULL, sh.name',
  specialisation: 'sp.name IS NULL, sp.name',
  rate: 'rt.sort_order IS NULL, rt.sort_order DESC',
  seniority: 'r.seniority_date IS NULL, r.seniority_date',
  state: 'st.name IS NULL, st.name',
};
const PERSON_SORT_KEYS = Object.keys(PERSON_SORTS);

function personWhere(f) {
  const sql = [];
  const params = [];
  if (f.status === 'current' || f.status === 'former') { sql.push('r.status = ?'); params.push(f.status); }
  const eq = (col, v) => { if (v) { sql.push(`${col} = ?`); params.push(v); } };
  eq('r.rate_id', f.rateId);
  eq('r.branch_id', f.branchId);
  eq('r.command_id', f.commandId);
  eq('r.staff_branch_id', f.staffBranchId);
  eq('r.specialisation_id', f.specialisationId);
  eq('r.entry_mode_id', f.entryModeId);
  eq('r.state_id', f.stateId);
  eq('r.geo_political_zone_id', f.zoneId);
  eq('cur.ship_id', f.shipId);
  return { sql: sql.length ? `WHERE ${sql.join(' AND ')}` : '', params };
}

async function personnel(f, { page = 1, pageSize = 25 } = {}) {
  const w = personWhere(f);
  const [t] = await db.query(
    `SELECT COUNT(*) AS total, COALESCE(SUM(r.status = 'current'), 0) AS current_n, COALESCE(SUM(r.status = 'former'), 0) AS former_n
       ${PERSON_FROM} ${w.sql}`, w.params);
  const order = `${PERSON_SORTS[f.sort] || PERSON_SORTS.number}, r.service_number`;
  const sql = `SELECT r.service_number, r.status, r.surname, r.first_name, r.middle_name, r.date_of_birth, r.seniority_date,
         r.date_employed, r.exit_date, rt.name AS rate_name, rt.code AS rate_code, br.name AS branch_name, cm.name AS command_name,
         sb.name AS staff_branch_name, sp.name AS specialisation_name, em.name AS entry_mode_name, st.name AS state_name,
         gz.name AS zone_name, mb.name AS area_name, g.name AS gender,
         CASE WHEN r.status = 'current' THEN sh.name END AS ship_name
    ${PERSON_FROM} ${w.sql}
    ORDER BY ${order}`;
  const items = await paged(sql, w.params, { page, pageSize });
  return { items, total: Number(t.total), current: Number(t.current_n), former: Number(t.former_n) };
}

// ---- 3. Disposition ----------------------------------------------------------------------------

function dispositionWhere(f) {
  const sql = ["r.status = 'current'"];
  const params = [];
  if (f.commandId) { sql.push('r.command_id = ?'); params.push(f.commandId); }
  if (f.areaId) { sql.push('r.mother_base_id = ?'); params.push(f.areaId); }
  if (f.specialisationId) { sql.push('r.specialisation_id = ?'); params.push(f.specialisationId); }
  return { sql: `WHERE ${sql.join(' AND ')}`, params };
}

/** The current ratings by ship (or none) and rate: the counts behind the list, the strip and each row's dialog. */
async function dispositionCounts(f) {
  const w = dispositionWhere(f);
  return db.query(
    `SELECT cur.ship_id, sh.name AS ship_name, sh.type AS ship_type, r.rate_id, COUNT(*) AS n
       FROM ratings r ${CUR_LEFT}
       LEFT JOIN ref_ship sh ON sh.id = cur.ship_id
       ${w.sql}
      GROUP BY cur.ship_id, sh.name, sh.type, r.rate_id
      ORDER BY sh.name IS NULL, sh.name`, w.params);
}

/** Every current rating of the selection with its ship, for the printout: grouped by ship, highest rate first. */
async function dispositionRows(f) {
  const w = dispositionWhere(f);
  return db.query(
    `SELECT r.service_number, r.surname, r.first_name, r.middle_name, rt.code AS rate_code, rt.name AS rate_name, g.name AS gender,
            sp.name AS specialisation_name, sh.name AS ship_name, mb.name AS area_name, cm.name AS command_name, cur.start_date AS wef
       FROM ratings r ${CUR_LEFT}
       LEFT JOIN ref_ship sh ON sh.id = cur.ship_id
       LEFT JOIN ref_rate rt ON rt.id = r.rate_id
       LEFT JOIN ref_gender g ON g.id = r.gender_id
       LEFT JOIN ref_specialisation sp ON sp.id = r.specialisation_id
       LEFT JOIN ref_mother_base mb ON mb.id = r.mother_base_id
       LEFT JOIN ref_command cm ON cm.id = r.command_id
       ${w.sql}
      ORDER BY sh.name IS NULL, sh.name, rt.sort_order DESC, r.seniority_date IS NULL, r.seniority_date, r.surname, r.service_number
      LIMIT ${MAX_ROWS}`, w.params);
}

// ---- 4. Nominal Roll ---------------------------------------------------------------------------

const ROLL_FROM = `FROM ratings r ${CUR_INNER}
    JOIN ref_ship sh ON sh.id = cur.ship_id
    LEFT JOIN ref_command cm ON cm.id = sh.command_id
    LEFT JOIN ref_rate rt ON rt.id = r.rate_id
    LEFT JOIN ref_branch br ON br.id = r.branch_id
    LEFT JOIN ref_gender g ON g.id = r.gender_id
    LEFT JOIN ref_specialisation sp ON sp.id = r.specialisation_id`;

/** The ratings serving now on a ship, or on every ship of a command. */
function rollWhere(f) {
  const sql = ["r.status = 'current'"];
  const params = [];
  if (f.shipId) { sql.push('cur.ship_id = ?'); params.push(f.shipId); }
  if (f.commandId) { sql.push('sh.command_id = ?'); params.push(f.commandId); }
  if (f.branchId) { sql.push('r.branch_id = ?'); params.push(f.branchId); }
  if (f.rateId) { sql.push('r.rate_id = ?'); params.push(f.rateId); }
  return { sql: `WHERE ${sql.join(' AND ')}`, params };
}

/** Highest rate first, then seniority date, then official number; across ships (a command) the ship comes first. */
const rollOrder = (f) => `ORDER BY ${f.shipId ? '' : 'sh.name, '}rt.sort_order IS NULL, rt.sort_order DESC, r.seniority_date IS NULL, r.seniority_date, r.service_number`;

async function nominalRoll(f, { page = 1, pageSize = 25 } = {}) {
  const w = rollWhere(f);
  const byRate = await db.query(
    `SELECT r.rate_id, COUNT(*) AS n ${ROLL_FROM} ${w.sql} GROUP BY r.rate_id`, w.params);
  const sql = `SELECT r.service_number, r.surname, r.first_name, r.middle_name, r.seniority_date, rt.name AS rate_name, rt.code AS rate_code,
         br.name AS branch_name, g.name AS gender, sp.name AS specialisation_name, sh.id AS ship_id, sh.name AS ship_name,
         cm.name AS command_name, cur.start_date AS joined_on, TIMESTAMPDIFF(MONTH, cur.start_date, ?) AS months
    ${ROLL_FROM} ${w.sql} ${rollOrder(f)}`;
  const items = await paged(sql, [f.today, ...w.params], { page, pageSize });
  const total = byRate.reduce((a, x) => a + Number(x.n), 0);
  return { items, total, byRate };
}

// ---- 5. Manning State --------------------------------------------------------------------------

/** Every manning line (ship, rate, specialisation, required, aboard) of the filters: Drafting's own query. */
function manningLines(f) {
  return drafting.allManning({ shipId: f.shipId, rateId: f.rateId, specialisationId: f.specialisationId, commandId: f.commandId }, MAX_ROWS);
}

// ---- 6. Retirement Forecast --------------------------------------------------------------------

// the dates a rating reaches the age and the years of service of Discharge's rule (the setting values are
// whole numbers, read through settings.numbers): the soonest is the date it becomes due
const DUE_COLUMNS = `DATE_ADD(r.date_of_birth, INTERVAL ? YEAR) AS age_due_on, DATE_ADD(r.date_employed, INTERVAL ? YEAR) AS service_due_on`;
const DUE_ON = 'LEAST(COALESCE(x.age_due_on, x.service_due_on), COALESCE(x.service_due_on, x.age_due_on))';
const PENDING_PROPOSAL = "NOT EXISTS (SELECT 1 FROM discharge_rows d WHERE d.service_number = r.service_number AND d.status = 'pending')";

/**
 * The inner list: current ratings Discharge does not yet call due, that no re-engagement, closed or scheduled
 * discharge, or waiting proposal already covers; the outer keeps the ones whose date falls on or before the horizon.
 */
function forecastQuery(f) {
  const inner = ["r.status = 'current'", `COALESCE(${discharge.DUE_RULE}, 0) = 0`, ...discharge.DUE_EXCLUSIONS, PENDING_PROPOSAL];
  const params = [f.ageDue, f.serviceDue, ...discharge.dueRuleParams(f), ...discharge.dueExclusionParams(f)];
  if (f.branchId) { inner.push('r.branch_id = ?'); params.push(f.branchId); }
  if (f.rateId) { inner.push('r.rate_id = ?'); params.push(f.rateId); }
  if (f.shipId) { inner.push('cur.ship_id = ?'); params.push(f.shipId); }
  const from = `FROM (
      SELECT r.service_number, r.surname, r.first_name, r.middle_name, r.date_of_birth, r.date_employed, rt.name AS rate_name,
             rt.code AS rate_code, rt.sort_order AS rate_order, sh.name AS ship_name, ${DUE_COLUMNS}
        FROM ratings r ${CUR_LEFT}
        LEFT JOIN ref_ship sh ON sh.id = cur.ship_id
        LEFT JOIN ref_rate rt ON rt.id = r.rate_id
       WHERE ${inner.join(' AND ')}) x
     WHERE (x.age_due_on IS NOT NULL OR x.service_due_on IS NOT NULL) AND ${DUE_ON} <= DATE_ADD(?, INTERVAL ? MONTH)`;
  return { from, params: [...params, f.today, f.months] };
}

async function forecast(f, { page = 1, pageSize = 25 } = {}) {
  const q = forecastQuery(f);
  const quarters = Math.ceil(f.months / 3);
  const quarterSql = [];
  const quarterParams = [];
  for (let i = 1; i <= quarters; i += 1) {
    quarterSql.push(`COALESCE(SUM(${DUE_ON} <= DATE_ADD(?, INTERVAL ? MONTH)${i > 1 ? ` AND ${DUE_ON} > DATE_ADD(?, INTERVAL ? MONTH)` : ''}), 0) AS q${i}`);
    quarterParams.push(f.today, i * 3);
    if (i > 1) quarterParams.push(f.today, (i - 1) * 3);
  }
  // the quarters' SUMs come first in the statement, so their parameters come first
  const [t] = await db.query(`SELECT COUNT(*) AS total, ${quarterSql.join(', ')} ${q.from}`, [...quarterParams, ...q.params]);
  const sql = `SELECT x.*, ${DUE_ON} AS due_on ${q.from} ORDER BY ${DUE_ON}, x.service_number`;
  const items = await paged(sql, q.params, { page, pageSize });
  return { items, total: Number(t.total), quarters: Array.from({ length: quarters }, (_, i) => Number(t[`q${i + 1}`])) };
}

/** How many ratings Process Discharge already lists as due today (the same rule and filters). */
async function dueToday(f) {
  const w = discharge.dueWhere({ today: f.today, ageDue: f.ageDue, serviceDue: f.serviceDue, branchId: f.branchId, rateId: f.rateId });
  const ship = f.shipId ? ' AND cur.ship_id = ?' : '';
  const [t] = await db.query(`SELECT COUNT(*) AS n FROM ratings r ${CUR_LEFT} ${w.sql}${ship}`, [...w.params, ...(f.shipId ? [f.shipId] : [])]);
  return Number(t.n);
}

module.exports = {
  MAX_ROWS, PERSON_SORT_KEYS,
  options, refName, allRates,
  shipHistory, personnel, dispositionCounts, dispositionRows, nominalRoll, manningLines, forecast, dueToday,
};
