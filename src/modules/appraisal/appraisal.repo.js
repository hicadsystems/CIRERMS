'use strict';

/* Naval Character Assessment: all SQL (appraisal_periods and appraisals). The grades are ref_appraisal_rating's. */
const db = require('../../db');
const { whoCols, whoJoins } = require('../drafting/cycle.repo');
const { NAME_COLUMNS, NAME_JOINS } = require('../../shared/rating-name');

const like = (q) => `%${String(q).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

// a rating's open posting (the current ship): the newest row with no end date
const CURRENT_POSTING = `LEFT JOIN rating_drafting cur ON cur.service_number = r.service_number AND cur.end_date IS NULL
       AND cur.id = (SELECT MAX(x.id) FROM rating_drafting x WHERE x.service_number = r.service_number AND x.end_date IS NULL)`;

// ---- options -----------------------------------------------------------------------------------
const ships = (conn = null) => db.query('SELECT id, name, is_active FROM ref_ship ORDER BY sort_order, name', [], conn);
const rates = (conn = null) => db.query('SELECT id, name, code, is_active FROM ref_rate ORDER BY sort_order, name', [], conn);
const branches = (conn = null) => db.query('SELECT id, name, is_active FROM ref_branch ORDER BY sort_order, name', [], conn);
const grades = (conn = null) => db.query('SELECT id, code, name, score_low, score_high, is_active FROM ref_appraisal_rating ORDER BY score_high DESC, name ASC', [], conn);

// ---- periods -----------------------------------------------------------------------------------
const PERIOD_SELECT = `SELECT p.*,
         (SELECT COUNT(*) FROM appraisals a WHERE a.period_id = p.id AND a.status = 'active') AS appraisal_count,
         ${whoCols('clo')}
    FROM appraisal_periods p
    ${whoJoins('clo', 'p.closed_by')}`;

async function listPeriods({ status = '' } = {}, { page = 1, pageSize = 25 } = {}) {
  const where = status === 'open' || status === 'closed' ? 'WHERE p.status = ?' : '';
  const params = where ? [status] : [];
  const total = (await db.query(`SELECT COUNT(*) AS n FROM appraisal_periods p ${where}`, params))[0].n;
  const items = await db.query(`${PERIOD_SELECT} ${where} ORDER BY p.start_date DESC, p.id DESC LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]);
  return { items, total: Number(total) };
}

async function allPeriods(conn = null) {
  return db.query(`${PERIOD_SELECT} ORDER BY p.start_date DESC, p.id DESC`, [], conn);
}

/** The counts on the Appraisal Periods page: open, closed and the active appraisals in all of them. */
async function periodCounts() {
  const rows = await db.query(`SELECT
      (SELECT COUNT(*) FROM appraisal_periods WHERE status = 'open') AS open_n,
      (SELECT COUNT(*) FROM appraisal_periods WHERE status = 'closed') AS closed_n,
      (SELECT COUNT(*) FROM appraisals WHERE status = 'active') AS appraisal_n`);
  return { open: Number(rows[0].open_n), closed: Number(rows[0].closed_n), appraisals: Number(rows[0].appraisal_n) };
}

async function findPeriod(id, conn = null) {
  const rows = await db.query(`${PERIOD_SELECT} WHERE p.id = ?`, [id], conn);
  return rows[0] || null;
}

/** The raw row; `lock` is 'update' (FOR UPDATE) or 'share' (LOCK IN SHARE MODE, which MariaDB also has). */
async function periodRaw(id, conn = null, lock = '') {
  const suffix = lock === 'update' ? ' FOR UPDATE' : lock === 'share' ? ' LOCK IN SHARE MODE' : '';
  const rows = await db.query(`SELECT * FROM appraisal_periods WHERE id = ?${suffix}`, [id], conn);
  return rows[0] || null;
}

async function periodByName(name, exceptId, conn = null) {
  const rows = await db.query('SELECT id, name FROM appraisal_periods WHERE name = ? AND id <> ? LIMIT 1', [name, exceptId || 0], conn);
  return rows[0] || null;
}

/** A period (other than exceptId) whose dates meet [start, end]. */
async function overlappingPeriod(start, end, exceptId, conn = null) {
  const rows = await db.query('SELECT id, name, start_date, end_date FROM appraisal_periods WHERE start_date <= ? AND end_date >= ? AND id <> ? ORDER BY start_date LIMIT 1', [end, start, exceptId || 0], conn);
  return rows[0] || null;
}

async function insertPeriod({ name, start, end, userId }, conn) {
  const r = await db.query('INSERT INTO appraisal_periods (name, start_date, end_date, status, created_by) VALUES (?, ?, ?, \'open\', ?)', [name, start, end, userId || null], conn);
  return r.insertId;
}

const updatePeriod = (id, { name, start, end }, conn) => db.query('UPDATE appraisal_periods SET name = ?, start_date = ?, end_date = ? WHERE id = ?', [name, start, end, id], conn);
const closePeriod = (id, userId, conn) => db.query('UPDATE appraisal_periods SET status = \'closed\', closed_at = NOW(), closed_by = ? WHERE id = ?', [userId || null, id], conn);

/** The earliest director's date among a period's active appraisals (a new start may not pass it). */
async function earliestDirectorDate(periodId, conn = null) {
  const rows = await db.query('SELECT MIN(director_date) AS d FROM appraisals WHERE period_id = ? AND status = \'active\' AND director_date IS NOT NULL', [periodId], conn);
  return rows[0] ? rows[0].d : null;
}

/** Current ratings with no active appraisal in the period (Close Period warns with this). */
async function missingCount(periodId, conn = null) {
  const rows = await db.query(`SELECT COUNT(*) AS n FROM ratings r WHERE r.status = 'current'
      AND NOT EXISTS (SELECT 1 FROM appraisals a WHERE a.period_id = ? AND a.service_number = r.service_number AND a.status = 'active')`, [periodId], conn);
  return Number(rows[0].n);
}

// ---- ratings -----------------------------------------------------------------------------------
async function ratingCard(serviceNumber, conn = null) {
  const rows = await db.query(
    `SELECT r.service_number, r.status, r.rate_id, r.surname, r.first_name, r.middle_name,
            rt.name AS rate_name, rt.code AS rate_code, br.name AS branch_name,
            cur.ship_id AS current_ship_id, cs.name AS current_ship_name
       FROM ratings r
       LEFT JOIN ref_rate rt ON rt.id = r.rate_id
       LEFT JOIN ref_branch br ON br.id = r.branch_id
       ${CURRENT_POSTING}
       LEFT JOIN ref_ship cs ON cs.id = cur.ship_id
      WHERE r.service_number = ?`, [serviceNumber], conn);
  return rows[0] || null;
}

/** Locks the rating's row, so two appraisals for one rating and period cannot be made at the same time. */
async function lockRating(serviceNumber, conn) {
  const rows = await db.query('SELECT service_number FROM ratings WHERE service_number = ? FOR UPDATE', [serviceNumber], conn);
  return rows[0] || null;
}

// ---- appraisals --------------------------------------------------------------------------------
const APPRAISAL_SELECT = `SELECT a.*, p.name AS period_name, p.start_date AS period_start, p.end_date AS period_end, p.status AS period_status,
         r.status AS rating_status, r.surname, r.first_name, r.middle_name, br.name AS branch_name,
         rt.name AS rate_name, rt.code AS rate_code, sh.name AS ship_name,
         cg.code AS char_code, cg.name AS char_name, cg.score_low AS char_low, cg.score_high AS char_high,
         eg.code AS eff_code, eg.name AS eff_name, eg.score_low AS eff_low, eg.score_high AS eff_high,
         ${whoCols('cre')}, ${whoCols('can')}
    FROM appraisals a
    JOIN appraisal_periods p ON p.id = a.period_id
    JOIN ratings r ON r.service_number = a.service_number
    LEFT JOIN ref_branch br ON br.id = r.branch_id
    LEFT JOIN ref_rate rt ON rt.id = a.rate_id
    LEFT JOIN ref_ship sh ON sh.id = a.ship_id
    JOIN ref_appraisal_rating cg ON cg.id = a.character_grade_id
    JOIN ref_appraisal_rating eg ON eg.id = a.efficiency_grade_id
    ${whoJoins('cre', 'a.created_by')}
    ${whoJoins('can', 'a.cancelled_by')}`;

const JOIN_FOR_COUNT = 'FROM appraisals a JOIN ratings r ON r.service_number = a.service_number';

/**
 * Filters (the lists and the report share them): status ('all' keeps cancelled appraisals; the default is active
 * ones only), serviceNumber, periodId, shipId and rateId (as they were at the time), branchId (the rating's own),
 * gradeId (either grade).
 */
function where(f = {}) {
  const sql = [];
  const params = [];
  if (f.status !== 'all') sql.push("a.status = 'active'");
  if (f.serviceNumber) { sql.push('a.service_number = ?'); params.push(f.serviceNumber); }
  if (f.periodId) { sql.push('a.period_id = ?'); params.push(f.periodId); }
  if (f.shipId) { sql.push('a.ship_id = ?'); params.push(f.shipId); }
  if (f.rateId) { sql.push('a.rate_id = ?'); params.push(f.rateId); }
  if (f.branchId) { sql.push('r.branch_id = ?'); params.push(f.branchId); }
  if (f.gradeId) { sql.push('(a.character_grade_id = ? OR a.efficiency_grade_id = ?)'); params.push(f.gradeId, f.gradeId); }
  if (f.q) {
    sql.push('(a.service_number LIKE ? OR r.surname LIKE ? OR r.first_name LIKE ? OR r.middle_name LIKE ?)');
    const p = like(f.q);
    params.push(p, p, p, p);
  }
  return { sql: sql.length ? `WHERE ${sql.join(' AND ')}` : '', params };
}

const ORDER = 'ORDER BY p.start_date DESC, r.surname, a.service_number, a.id';

async function listAppraisals(f, { page = 1, pageSize = 25 } = {}) {
  const w = where(f);
  const total = (await db.query(`SELECT COUNT(*) AS n ${JOIN_FOR_COUNT} ${w.sql}`, w.params))[0].n;
  const items = await db.query(`${APPRAISAL_SELECT} ${w.sql} ${ORDER} LIMIT ? OFFSET ?`, [...w.params, pageSize, (page - 1) * pageSize]);
  return { items, total: Number(total) };
}

/** Every row of a filter, for the PDF and the Excel workbook (the same query as the list, without the paging). */
async function reportRows(f, limit = 5000) {
  const w = where(f);
  return db.query(`${APPRAISAL_SELECT} ${w.sql} ${ORDER} LIMIT ?`, [...w.params, limit]);
}

/** How many appraisals hold each grade, as Character and as Efficiency: { character: Map(id -> n), efficiency: Map }. */
async function gradeCounts(f) {
  const w = where(f);
  const one = async (col) => {
    const rows = await db.query(`SELECT a.${col} AS gid, COUNT(*) AS n ${JOIN_FOR_COUNT} ${w.sql} GROUP BY a.${col}`, w.params);
    return new Map(rows.map((r) => [r.gid, Number(r.n)]));
  };
  return { character: await one('character_grade_id'), efficiency: await one('efficiency_grade_id') };
}

async function findAppraisal(id, conn = null) {
  const rows = await db.query(`${APPRAISAL_SELECT} WHERE a.id = ?`, [id], conn);
  return rows[0] || null;
}

async function appraisalRaw(id, conn = null, lock = false) {
  const rows = await db.query(`SELECT * FROM appraisals WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id], conn);
  return rows[0] || null;
}

/** The active appraisal of a rating in a period (the one that stops a second), or null. */
async function activeFor(serviceNumber, periodId, conn = null) {
  const rows = await db.query(`${APPRAISAL_SELECT} WHERE a.service_number = ? AND a.period_id = ? AND a.status = 'active'`, [serviceNumber, periodId], conn);
  return rows[0] || null;
}

async function ofRating(serviceNumber) {
  return db.query(`${APPRAISAL_SELECT} WHERE a.service_number = ? AND a.status = 'active' ORDER BY p.start_date DESC, a.id DESC`, [serviceNumber]);
}

async function insertAppraisal(x, conn) {
  const r = await db.query(
    `INSERT INTO appraisals (period_id, service_number, rate_id, ship_id, character_grade_id, efficiency_grade_id, remark, co_name,
                             director_name, director_date, status, active_slot, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?)`,
    [x.periodId, x.serviceNumber, x.rateId, x.shipId, x.characterGradeId, x.efficiencyGradeId, x.remark || null, x.coName,
      x.directorName || null, x.directorDate || null, x.userId || null], conn);
  return r.insertId;
}

const updateAppraisal = (id, x, conn) => db.query(
  `UPDATE appraisals SET character_grade_id = ?, efficiency_grade_id = ?, remark = ?, co_name = ?, director_name = ?, director_date = ? WHERE id = ?`,
  [x.characterGradeId, x.efficiencyGradeId, x.remark || null, x.coName, x.directorName || null, x.directorDate || null, id], conn);

const cancelAppraisal = (id, { reason, userId }, conn) => db.query(
  `UPDATE appraisals SET status = 'cancelled', active_slot = NULL, cancelled_reason = ?, cancelled_at = NOW(), cancelled_by = ? WHERE id = ?`,
  [reason, userId || null, id], conn);

/** The edits of an appraisal, as the audit trail holds them (oldest first). */
async function history(id, serviceNumber) {
  return db.query(
    `SELECT a.id, a.created_at, a.username, a.changes, ${NAME_COLUMNS}
       FROM audit_trail a
       LEFT JOIN users u ON u.id = a.user_id
       ${NAME_JOINS}
      WHERE a.table_name = 'appraisals' AND a.record_id = ? AND a.action = 'UPDATE'
      ORDER BY a.id`, [`${serviceNumber}:${id}`]);
}

// ---- the dashboard's tile ----------------------------------------------------------------------
async function dashboardCounts() {
  const rows = await db.query(`SELECT
      (SELECT COUNT(*) FROM appraisals WHERE status = 'active'
          AND created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND created_at < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)) AS month_n,
      (SELECT COUNT(*) FROM appraisal_periods WHERE status = 'open') AS open_n`);
  return { month: Number(rows[0].month_n), openPeriods: Number(rows[0].open_n) };
}

module.exports = {
  ships, rates, branches, grades,
  listPeriods, allPeriods, periodCounts, findPeriod, periodRaw, periodByName, overlappingPeriod, insertPeriod, updatePeriod, closePeriod,
  earliestDirectorDate, missingCount,
  ratingCard, lockRating,
  listAppraisals, reportRows, gradeCounts, findAppraisal, appraisalRaw, activeFor, ofRating, insertAppraisal, updateAppraisal, cancelAppraisal, history,
  dashboardCounts,
};
