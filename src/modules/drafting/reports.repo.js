'use strict';

/*
 * Drafting reports (WP7b): the SQL behind Batch/Signal Content, Rate DOD History and Draft Report.
 * Reads only: batches (flow DOD), draft_rows, ratings and the lookups. Plain parameterised SQL.
 * One filtered query feeds each screen, its PDF and its Excel file: the screen asks for a page of 25,
 * the PDF and the workbook ask for every row (up to MAX_ROWS).
 */
const db = require('../../db');
const { BATCH_SELECT } = require('./cycle.repo');

const MAX_ROWS = 5000;
const like = (q) => `%${String(q).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

// ---- Batch/Signal Content: the batch list -----------------------------------------------------------

/**
 * Filters: branch (the batch's branch, or the branch of a rating inside it), rate (the batch's rate, or the
 * rate of a rating inside it), signal code (the authority, contains), batch number (contains). A user tied to
 * a department sees only the batches made for that department.
 */
function batchWhere(f) {
  const sql = ["b.flow = 'DOD'"];
  const params = [];
  if (f.specialisationId) { sql.push('b.specialisation_id = ?'); params.push(f.specialisationId); }
  if (f.branchId) {
    sql.push(`(b.branch_id = ? OR EXISTS (SELECT 1 FROM draft_rows x JOIN ratings xr ON xr.service_number = x.service_number
              WHERE x.batch_id = b.id AND xr.branch_id = ?))`);
    params.push(f.branchId, f.branchId);
  }
  if (f.rateId) {
    sql.push('(b.rate_id = ? OR EXISTS (SELECT 1 FROM draft_rows x WHERE x.batch_id = b.id AND x.rate_id = ?))');
    params.push(f.rateId, f.rateId);
  }
  if (f.signal) { sql.push('b.authority LIKE ?'); params.push(like(f.signal)); }
  if (f.batchNo) { sql.push('b.batch_number LIKE ?'); params.push(like(f.batchNo)); }
  return { sql: `WHERE ${sql.join(' AND ')}`, params };
}

const COUNTS = `, (SELECT COUNT(*) FROM draft_rows c WHERE c.batch_id = b.id AND c.status <> 'not_recommended') AS total,
       (SELECT COUNT(*) FROM draft_rows c WHERE c.batch_id = b.id AND c.status = 'reported') AS reported,
       (SELECT COUNT(*) FROM draft_rows c WHERE c.batch_id = b.id AND c.status = 'scheduled') AS scheduled,
       (SELECT COUNT(*) FROM draft_rows c WHERE c.batch_id = b.id AND c.status = 'not_recommended') AS not_recommended
  FROM batches b`;
const BATCH_COUNTED = BATCH_SELECT.replace('FROM batches b', COUNTS);
const BATCH_ORDER = 'ORDER BY b.initiated_at DESC, b.id DESC';

/** One page of batches (page, pageSize), or every one when pageSize is 0. */
async function listBatches(f, { page = 1, pageSize = 25 } = {}) {
  const w = batchWhere(f);
  const [{ n }] = await db.query(`SELECT COUNT(*) AS n FROM batches b ${w.sql}`, w.params);
  const sql = `${BATCH_COUNTED} ${w.sql} ${BATCH_ORDER}`;
  const items = pageSize
    ? await db.query(`${sql} LIMIT ? OFFSET ?`, [...w.params, pageSize, (page - 1) * pageSize])
    : await db.query(`${sql} LIMIT ${MAX_ROWS}`, w.params);
  return { items, total: Number(n) };
}

/** How many of the filtered batches are open (open or approved) and how many closed. */
async function batchTotals(f) {
  const w = batchWhere(f);
  const rows = await db.query(
    `SELECT SUM(b.status <> 'closed') AS open_n, SUM(b.status = 'closed') AS closed_n FROM batches b ${w.sql}`, w.params);
  return { open: Number(rows[0].open_n || 0), closed: Number(rows[0].closed_n || 0) };
}

async function findBatch(id) {
  const rows = await db.query(`${BATCH_COUNTED} WHERE b.id = ? AND b.flow = 'DOD'`, [id]);
  return rows[0] || null;
}

// ---- Batch/Signal Content: one batch's ratings ---------------------------------------------------

const BATCH_ROW_SELECT = `SELECT d.id, d.service_number, d.status, d.wef, d.vice, d.remark, d.request, d.joined_on, d.not_recommended_reason,
         r.surname, r.first_name, r.middle_name, g.name AS gender, rt.code AS rate_code, rt.name AS rate_name,
         sp.name AS specialisation_name, cs.name AS current_ship_name, ps.name AS proposed_ship_name
    FROM draft_rows d
    JOIN ratings r ON r.service_number = d.service_number
    LEFT JOIN ref_gender g ON g.id = r.gender_id
    LEFT JOIN ref_rate rt ON rt.id = d.rate_id
    LEFT JOIN ref_specialisation sp ON sp.id = d.specialisation_id
    LEFT JOIN ref_ship cs ON cs.id = d.current_ship_id
    LEFT JOIN ref_ship ps ON ps.id = d.proposed_ship_id`;

function batchRowsWhere(f) {
  const sql = ['d.batch_id = ?'];
  const params = [f.batchId];
  if (f.serviceNumber) { sql.push('d.service_number = ?'); params.push(f.serviceNumber); }
  if (f.name) { sql.push("CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) LIKE ?"); params.push(like(f.name)); }
  return { sql: `WHERE ${sql.join(' AND ')}`, params };
}
const BATCH_ROW_ORDER = 'ORDER BY r.surname, r.first_name, d.service_number';

async function batchRows(f, { page = 1, pageSize = 25 } = {}) {
  const w = batchRowsWhere(f);
  const [{ n }] = await db.query(`SELECT COUNT(*) AS n FROM draft_rows d JOIN ratings r ON r.service_number = d.service_number ${w.sql}`, w.params);
  const sql = `${BATCH_ROW_SELECT} ${w.sql} ${BATCH_ROW_ORDER}`;
  const items = pageSize
    ? await db.query(`${sql} LIMIT ? OFFSET ?`, [...w.params, pageSize, (page - 1) * pageSize])
    : await db.query(`${sql} LIMIT ${MAX_ROWS}`, w.params);
  return { items, total: Number(n) };
}

// ---- Rate DOD History -------------------------------------------------------------------------------------

async function findRating(serviceNumber) {
  const rows = await db.query(
    `SELECT r.service_number, r.status, r.surname, r.first_name, r.middle_name, g.name AS gender, rt.name AS rate_name, rt.code AS rate_code,
            sp.name AS specialisation_name, s.name AS ship_name
       FROM ratings r
       LEFT JOIN ref_gender g ON g.id = r.gender_id
       LEFT JOIN ref_rate rt ON rt.id = r.rate_id
       LEFT JOIN ref_specialisation sp ON sp.id = r.specialisation_id
       LEFT JOIN rating_drafting cur ON cur.service_number = r.service_number AND cur.end_date IS NULL
            AND cur.id = (SELECT MAX(x.id) FROM rating_drafting x WHERE x.service_number = r.service_number AND x.end_date IS NULL)
       LEFT JOIN ref_ship s ON s.id = cur.ship_id
      WHERE r.service_number = ?`, [serviceNumber]);
  return rows[0] || null;
}

/** Every draft the rating has been through (every DOD batch holding a row for it), newest first. */
async function history({ serviceNumber, specialisationId = null, today }) {
  const sql = ['d.service_number = ?'];
  const params = [serviceNumber];
  if (specialisationId) { sql.push('d.specialisation_id = ?'); params.push(specialisationId); }
  return db.query(
    `SELECT d.id, d.status, d.wef, d.vice, d.not_recommended_reason, d.batch_id,
            b.batch_number, b.status AS batch_status, b.authority, b.close_date,
            cs.name AS current_ship_name, ps.name AS proposed_ship_name
       FROM draft_rows d
       JOIN batches b ON b.id = d.batch_id AND b.flow = 'DOD'
       LEFT JOIN ref_ship cs ON cs.id = d.current_ship_id
       LEFT JOIN ref_ship ps ON ps.id = d.proposed_ship_id
      WHERE ${sql.join(' AND ')}
      ORDER BY COALESCE(d.wef, ?) DESC, b.id DESC LIMIT ${MAX_ROWS}`, [...params, today]);
}

// ---- Draft Report: every posting that has reported ----------------------------------------------------

function postingWhere(f) {
  const sql = ["d.status = 'reported'"];
  const params = [];
  if (f.specialisationId) { sql.push('d.specialisation_id = ?'); params.push(f.specialisationId); }
  if (f.authority) { sql.push('b.authority LIKE ?'); params.push(like(f.authority)); }
  if (f.from) { sql.push('d.wef >= ?'); params.push(f.from); }
  if (f.to) { sql.push('d.wef <= ?'); params.push(f.to); }
  return { sql: `WHERE ${sql.join(' AND ')}`, params };
}

const POSTING_FROM = `FROM draft_rows d
    JOIN batches b ON b.id = d.batch_id AND b.flow = 'DOD'
    JOIN ratings r ON r.service_number = d.service_number`;

async function postings(f, { page = 1, pageSize = 25 } = {}) {
  const w = postingWhere(f);
  const [{ n }] = await db.query(`SELECT COUNT(*) AS n ${POSTING_FROM} ${w.sql}`, w.params);
  const sql = `SELECT d.id, d.service_number, d.wef, d.vice, d.joined_on, d.batch_id, b.batch_number, b.authority,
         r.surname, r.first_name, r.middle_name, g.name AS gender, rt.code AS rate_code, rt.name AS rate_name,
         sp.name AS specialisation_name, cs.name AS current_ship_name, ps.name AS proposed_ship_name
    ${POSTING_FROM}
    LEFT JOIN ref_gender g ON g.id = r.gender_id
    LEFT JOIN ref_rate rt ON rt.id = d.rate_id
    LEFT JOIN ref_specialisation sp ON sp.id = d.specialisation_id
    LEFT JOIN ref_ship cs ON cs.id = d.current_ship_id
    LEFT JOIN ref_ship ps ON ps.id = d.proposed_ship_id
    ${w.sql}
    ORDER BY d.wef DESC, r.surname, r.first_name, d.service_number`;
  const items = pageSize
    ? await db.query(`${sql} LIMIT ? OFFSET ?`, [...w.params, pageSize, (page - 1) * pageSize])
    : await db.query(`${sql} LIMIT ${MAX_ROWS}`, w.params);
  return { items, total: Number(n) };
}

async function specialisationName(id) {
  const rows = await db.query('SELECT name FROM ref_specialisation WHERE id = ?', [id]);
  return rows[0] ? rows[0].name : '';
}

module.exports = { MAX_ROWS, listBatches, batchTotals, findBatch, batchRows, findRating, history, postings, specialisationName };
