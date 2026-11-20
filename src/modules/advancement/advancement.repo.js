'use strict';

/*
 * Advancement: all SQL for the seven pages. The batch and approval tables' shared SQL is WP7a's
 * (src/modules/drafting/cycle.repo.js); the rate change itself is in rates.repo.js.
 */
const db = require('../../db');
const { BATCH_SELECT, whoCols, whoJoins } = require('../drafting/cycle.repo');

const like = (q) => `%${String(q).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

// since when a rating holds its current rate: the latest Advancement line of that rate, else the seniority
// date, else the date employed
const RATE_SINCE = (r) => `COALESCE((SELECT MAX(ra.start_date) FROM rating_advancement ra WHERE ra.service_number = ${r}.service_number AND ra.rate_id = ${r}.rate_id),
       ${r}.seniority_date, ${r}.date_employed)`;

// a rating is "in a batch" while its advancement is not finished: a live row of an open batch, or a row of
// a closed batch that waits for its board date or is scheduled
const PENDING_ADV = `SELECT x.service_number, MIN(b.batch_number) AS batch_number, MIN(b.id) AS batch_id
       FROM advancement_rows x JOIN batches b ON b.id = x.batch_id
      WHERE b.flow = 'DOA' AND ((b.status IN ('open','approved') AND x.status = 'proposed') OR x.status IN ('awaiting_board','scheduled'))
      GROUP BY x.service_number`;

const PENDING_CASES = (r) => `(SELECT COUNT(*) FROM discipline_cases dc WHERE dc.service_number = ${r}.service_number AND dc.status = 'pending')`;

// ---- options ------------------------------------------------------------------
async function options() {
  const [rates, branches, specialisations] = await Promise.all([
    db.query('SELECT id, name, code, sort_order, is_active FROM ref_rate ORDER BY sort_order, name'),
    db.query('SELECT id, name, code, is_active FROM ref_branch ORDER BY sort_order, name'),
    db.query('SELECT id, name, code, is_active FROM ref_specialisation ORDER BY sort_order, name'),
  ]);
  return { rates, branches, specialisations };
}

async function refRow(table, id, conn = null) {
  const allowed = { ref_rate: 1, ref_branch: 1, ref_specialisation: 1 };
  if (!allowed[table]) throw new Error('Unknown table');
  const rows = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [id], conn);
  return rows[0] || null;
}

async function rates(conn = null) {
  return db.query('SELECT id, name, code, sort_order, is_active FROM ref_rate ORDER BY sort_order, id', [], conn);
}

// ---- who is due ------------------------------------------------------------------
function dueWhere(f) {
  const sql = [
    "r.status = 'current'",
    `${RATE_SINCE('r')} IS NOT NULL`,
    `TIMESTAMPDIFF(MONTH, ${RATE_SINCE('r')}, ?) >= ?`,
    'EXISTS (SELECT 1 FROM ref_rate nx WHERE nx.sort_order > rt.sort_order AND nx.is_active = 1)',
  ];
  const params = [f.today, f.dueMonths];
  if (f.branchId) { sql.push('r.branch_id = ?'); params.push(f.branchId); }
  if (f.specialisationId) { sql.push('r.specialisation_id = ?'); params.push(f.specialisationId); }
  if (f.rateId) { sql.push('r.rate_id = ?'); params.push(f.rateId); }
  return { sql: `WHERE ${sql.join(' AND ')}`, params };
}

const DUE_SELECT = `SELECT r.service_number, r.surname, r.first_name, r.middle_name, r.rate_id, rt.name AS rate_name, rt.code AS rate_code,
         g.name AS gender, r.date_of_birth, r.date_employed, r.seniority_date, r.branch_id, br.name AS branch_name,
         r.specialisation_id, sp.name AS specialisation_name,
         ${RATE_SINCE('r')} AS rate_since,
         TIMESTAMPDIFF(MONTH, ${RATE_SINCE('r')}, ?) AS months,
         TIMESTAMPDIFF(YEAR, r.date_of_birth, ?) AS age, TIMESTAMPDIFF(YEAR, r.date_employed, ?) AS los,
         pend.batch_number AS in_batch, pend.batch_id AS in_batch_id, ${PENDING_CASES('r')} AS pending_cases
    FROM ratings r
    JOIN ref_rate rt ON rt.id = r.rate_id
    LEFT JOIN ref_gender g ON g.id = r.gender_id
    LEFT JOIN ref_branch br ON br.id = r.branch_id
    LEFT JOIN ref_specialisation sp ON sp.id = r.specialisation_id
    LEFT JOIN (${PENDING_ADV}) pend ON pend.service_number = r.service_number`;

async function listDue(f, { page = 1, pageSize = 25 } = {}) {
  const w = dueWhere(f);
  const [{ total, inBatch }] = await db.query(
    `SELECT COUNT(*) AS total, SUM(pend.service_number IS NOT NULL) AS inBatch FROM ratings r JOIN ref_rate rt ON rt.id = r.rate_id
       LEFT JOIN (${PENDING_ADV}) pend ON pend.service_number = r.service_number ${w.sql}`, w.params);
  const items = await db.query(`${DUE_SELECT} ${w.sql} ORDER BY months DESC, r.surname, r.service_number LIMIT ? OFFSET ?`,
    [f.today, f.today, f.today, ...w.params, pageSize, (page - 1) * pageSize]);
  return { items, total: Number(total), inBatch: Number(inBatch || 0) };
}

/** Every due rating not already in a batch (making a batch), locked. */
async function dueFresh(f, conn) {
  const w = dueWhere(f);
  return db.query(`${DUE_SELECT} ${w.sql} AND pend.service_number IS NULL ORDER BY months DESC, r.service_number FOR UPDATE`,
    [f.today, f.today, f.today, ...w.params], conn);
}

/** One rating with its rate and since when (Add Personnel; any months in rate). */
async function ratingForAdvance(serviceNumber, today, conn = null) {
  const rows = await db.query(`${DUE_SELECT} WHERE r.service_number = ?`, [today, today, today, serviceNumber], conn);
  return rows[0] || null;
}

async function ratingBasic(serviceNumber, conn = null) {
  const rows = await db.query(
    `SELECT r.service_number, r.status, r.surname, r.first_name, r.middle_name, r.rate_id, r.specialisation_id, rt.code AS rate_code, rt.name AS rate_name
       FROM ratings r LEFT JOIN ref_rate rt ON rt.id = r.rate_id WHERE r.service_number = ?`, [serviceNumber], conn);
  return rows[0] || null;
}

async function pendingAdvanceOf(serviceNumber, conn = null) {
  const rows = await db.query(`SELECT * FROM (${PENDING_ADV}) p WHERE p.service_number = ?`, [serviceNumber], conn);
  return rows[0] || null;
}

// ---- batches --------------------------------------------------------------------
const COUNTS = `(SELECT COUNT(*) FROM advancement_rows c WHERE c.batch_id = b.id AND c.status <> 'not_recommended') AS live,
              (SELECT COUNT(*) FROM advancement_rows c WHERE c.batch_id = b.id AND c.status <> 'not_recommended' AND c.new_rate_id IS NOT NULL) AS with_rate,
              (SELECT COUNT(*) FROM advancement_rows c WHERE c.batch_id = b.id AND c.status IN ('scheduled','advanced')) AS dated,
              (SELECT COUNT(*) FROM advancement_rows c WHERE c.batch_id = b.id AND c.status = 'advanced') AS advanced,
              (SELECT COUNT(*) FROM advancement_rows c WHERE c.batch_id = b.id AND c.status = 'scheduled') AS scheduled,
              (SELECT COUNT(*) FROM advancement_rows c WHERE c.batch_id = b.id AND c.status = 'awaiting_board') AS awaiting,
              (SELECT COUNT(*) FROM advancement_rows c WHERE c.batch_id = b.id AND c.status = 'not_recommended') AS not_recommended`;
const BATCH_WITH_COUNTS = BATCH_SELECT.replace('FROM batches b', `, ${COUNTS} FROM batches b`);

/**
 * The advancement batches for a page. stage 'open': open and approved; 'board': closed with an authority and
 * still waiting for a board date (or scheduled), or closed within the last 30 days. specialisationId limits
 * to a department's batches.
 */
async function listBatches({ stage, specialisationId = null, today }) {
  const sql = ["b.flow = 'DOA'"];
  const params = [];
  if (stage === 'open') sql.push("b.status IN ('open','approved')");
  if (stage === 'board') {
    sql.push("b.status = 'closed' AND b.authority IS NOT NULL");
    sql.push(`(EXISTS (SELECT 1 FROM advancement_rows w WHERE w.batch_id = b.id AND w.status IN ('awaiting_board','scheduled'))
             OR b.close_date >= DATE_SUB(?, INTERVAL 30 DAY))`);
    params.push(today);
  }
  if (specialisationId) { sql.push('b.specialisation_id = ?'); params.push(specialisationId); }
  return db.query(`${BATCH_WITH_COUNTS} WHERE ${sql.join(' AND ')}
      ORDER BY ${stage === 'board' ? 'b.close_date DESC, b.id DESC' : 'b.initiated_at DESC, b.id DESC'} LIMIT 500`, params);
}

/** Report on Promoted Rates: every advancement batch matching the filters, 25 a page. */
function reportWhere(f) {
  const sql = ["b.flow = 'DOA'"];
  const params = [];
  if (f.specialisationId) { sql.push('b.specialisation_id = ?'); params.push(f.specialisationId); }
  if (f.branchId) {
    sql.push(`(b.branch_id = ? OR EXISTS (SELECT 1 FROM advancement_rows q JOIN ratings qr ON qr.service_number = q.service_number
               WHERE q.batch_id = b.id AND qr.branch_id = ?))`);
    params.push(f.branchId, f.branchId);
  }
  if (f.rateId) {
    sql.push('(b.rate_id = ? OR EXISTS (SELECT 1 FROM advancement_rows q WHERE q.batch_id = b.id AND (q.rate_id = ? OR q.new_rate_id = ?)))');
    params.push(f.rateId, f.rateId, f.rateId);
  }
  if (f.signal) { sql.push('b.authority LIKE ?'); params.push(like(f.signal)); }
  if (f.batch) { sql.push('b.batch_number LIKE ?'); params.push(like(f.batch)); }
  return { sql: `WHERE ${sql.join(' AND ')}`, params };
}

async function reportBatches(f, { page = 1, pageSize = 25 } = {}) {
  const w = reportWhere(f);
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM batches b ${w.sql}`, w.params);
  const [sums] = await db.query(
    `SELECT COALESCE(SUM(b.status = 'closed'), 0) AS closed, COALESCE(SUM(b.status <> 'closed'), 0) AS open_n,
            (SELECT COUNT(*) FROM advancement_rows c JOIN batches cb ON cb.id = c.batch_id WHERE c.status = 'advanced' AND cb.id IN (SELECT b.id FROM batches b ${w.sql})) AS promoted
       FROM batches b ${w.sql}`, [...w.params, ...w.params]);
  const items = pageSize
    ? await db.query(`${BATCH_WITH_COUNTS} ${w.sql} ORDER BY b.initiated_at DESC, b.id DESC LIMIT ? OFFSET ?`, [...w.params, pageSize, (page - 1) * pageSize])
    : await db.query(`${BATCH_WITH_COUNTS} ${w.sql} ORDER BY b.initiated_at DESC, b.id DESC LIMIT 5000`, w.params);
  return { items, total: Number(total), closed: Number(sums.closed), open: Number(sums.open_n), promoted: Number(sums.promoted) };
}

async function batchWithCounts(id, conn = null) {
  const rows = await db.query(`${BATCH_WITH_COUNTS} WHERE b.id = ?`, [id], conn);
  return rows[0] || null;
}

const ROW_SELECT = `SELECT x.*, b.batch_number, b.status AS batch_status, b.close_date, b.authority,
         r.surname, r.first_name, r.middle_name, r.status AS rating_status, r.rate_id AS now_rate_id, nowrt.code AS now_rate_code, nowrt.name AS now_rate_name,
         g.name AS gender, r.date_of_birth, r.date_employed, br.name AS branch_name,
         rt.name AS rate_name, rt.code AS rate_code, rt.sort_order AS rate_sort, nr.name AS new_rate_name, nr.code AS new_rate_code,
         sp.name AS specialisation_name,
         TIMESTAMPDIFF(MONTH, x.rate_since, ?) AS months_now,
         TIMESTAMPDIFF(YEAR, r.date_of_birth, ?) AS age, TIMESTAMPDIFF(YEAR, r.date_employed, ?) AS los,
         ${PENDING_CASES('r')} AS pending_cases,
         a.approver_rank, a.approver_name, a.appointment AS approval_appointment, a.approved_at,
         ${whoCols('nr')}
    FROM advancement_rows x
    JOIN batches b ON b.id = x.batch_id
    JOIN ratings r ON r.service_number = x.service_number
    LEFT JOIN ref_rate nowrt ON nowrt.id = r.rate_id
    LEFT JOIN ref_gender g ON g.id = r.gender_id
    LEFT JOIN ref_branch br ON br.id = r.branch_id
    LEFT JOIN ref_rate rt ON rt.id = x.rate_id
    LEFT JOIN ref_rate nr ON nr.id = x.new_rate_id
    LEFT JOIN ref_specialisation sp ON sp.id = x.specialisation_id
    LEFT JOIN batch_approvals a ON a.id = x.approval_id
    ${whoJoins('nr', 'x.not_recommended_by')}`;

function rowsWhere(f) {
  const sql = [];
  const params = [];
  if (f.openAll || f.openDepartment) {
    // a department's (or every department's) live rows across the open batches (Approval, its workbooks)
    sql.push("b.flow = 'DOA' AND b.status IN ('open','approved') AND x.status = 'proposed'");
    const dept = f.openDepartment || f.specialisationId;
    if (dept) { sql.push('x.specialisation_id = ?'); params.push(dept); }
  } else {
    sql.push('x.batch_id = ?');
    params.push(f.batchId);
    if (f.specialisationId) { sql.push('x.specialisation_id = ?'); params.push(f.specialisationId); }
    if (f.live) sql.push("x.status <> 'not_recommended'");
  }
  if (f.sn) { sql.push('x.service_number LIKE ?'); params.push(like(f.sn)); }
  if (f.name) { sql.push("CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) LIKE ?"); params.push(like(f.name)); }
  if (f.q) { const l = like(f.q); sql.push("(x.service_number LIKE ? OR CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) LIKE ?)"); params.push(l, l); }
  return { sql: `WHERE ${sql.join(' AND ')}`, params };
}

const ROW_ORDER = "ORDER BY x.status = 'not_recommended', rt.sort_order DESC, r.surname, x.service_number";
const todayParams = (today) => [today, today, today];

async function listRows(f, { page = 1, pageSize = 25, today }) {
  const w = rowsWhere(f);
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM advancement_rows x JOIN batches b ON b.id = x.batch_id JOIN ratings r ON r.service_number = x.service_number ${w.sql}`, w.params);
  const items = await db.query(`${ROW_SELECT} ${w.sql} ${ROW_ORDER} LIMIT ? OFFSET ?`, [...todayParams(today), ...w.params, pageSize, (page - 1) * pageSize]);
  return { items, total: Number(total) };
}

async function allRows(f, today, conn = null) {
  const w = rowsWhere(f);
  return db.query(`${ROW_SELECT} ${w.sql} ${ROW_ORDER} LIMIT 5000`, [...todayParams(today), ...w.params], conn);
}

async function findRow(id, today, conn = null) {
  const rows = await db.query(`${ROW_SELECT} WHERE x.id = ?`, [...todayParams(today), id], conn);
  return rows[0] || null;
}

async function rowRaw(id, conn = null, lock = false) {
  const rows = await db.query(`SELECT * FROM advancement_rows WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id], conn);
  return rows[0] || null;
}

async function rowOfRating(batchId, serviceNumber, conn = null) {
  const rows = await db.query('SELECT * FROM advancement_rows WHERE batch_id = ? AND service_number = ? FOR UPDATE', [batchId, serviceNumber], conn);
  return rows[0] || null;
}

async function rowsOfBatch(batchId, conn) {
  return db.query('SELECT * FROM advancement_rows WHERE batch_id = ? ORDER BY id FOR UPDATE', [batchId], conn);
}

async function insertRow(x, conn) {
  const res = await db.query(
    `INSERT INTO advancement_rows (batch_id, service_number, rate_id, specialisation_id, rate_since, months_in_rate, status, added_by, added_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'proposed', ?, NOW(), ?)`,
    [x.batchId, x.serviceNumber, x.rateId || null, x.specialisationId || null, x.rateSince || null,
      x.months === null || x.months === undefined ? null : x.months, x.userId || null, x.userId || null], conn);
  return res.insertId;
}

/** A not-recommended row taken back into the batch: a fresh proposal. */
async function resetRow(id, x, conn) {
  await db.query(
    `UPDATE advancement_rows SET status = 'proposed', not_recommended_reason = NULL, not_recommended_by = NULL, not_recommended_at = NULL,
            new_rate_id = NULL, remark = NULL, approval_id = NULL, rate_id = ?, specialisation_id = ?, rate_since = ?, months_in_rate = ?,
            added_by = ?, added_at = NOW()
      WHERE id = ?`,
    [x.rateId || null, x.specialisationId || null, x.rateSince || null, x.months, x.userId || null, id], conn);
}

async function setNewRate(id, { newRateId, remark }, conn) {
  await db.query('UPDATE advancement_rows SET new_rate_id = ?, remark = ? WHERE id = ?', [newRateId, remark || null, id], conn);
}

async function notRecommend(id, { reason, userId }, conn) {
  await db.query(
    `UPDATE advancement_rows SET status = 'not_recommended', not_recommended_reason = ?, not_recommended_by = ?, not_recommended_at = NOW(),
            new_rate_id = NULL, approval_id = NULL WHERE id = ?`, [reason, userId || null, id], conn);
}

async function deleteRow(id, conn) {
  await db.query('DELETE FROM advancement_rows WHERE id = ?', [id], conn);
}

async function setBoard(id, { status, date, advancementId = null, scheduledId = null, userId }, conn) {
  await db.query('UPDATE advancement_rows SET status = ?, board_date = ?, advancement_id = ?, scheduled_change_id = ?, board_set_by = ?, board_set_at = NOW() WHERE id = ?',
    [status, date, advancementId, scheduledId, userId || null, id], conn);
}

async function markAdvanced(id, advancementId, conn) {
  await db.query("UPDATE advancement_rows SET status = 'advanced', advancement_id = ? WHERE id = ?", [advancementId, id], conn);
}

async function markBackToAwaiting(id, conn) {
  await db.query("UPDATE advancement_rows SET status = 'awaiting_board', board_date = NULL, scheduled_change_id = NULL WHERE id = ?", [id], conn);
}

/** A closed batch's rows waiting for their board date, locked. */
async function awaitingRows(batchId, conn) {
  return db.query("SELECT * FROM advancement_rows WHERE batch_id = ? AND status = 'awaiting_board' AND new_rate_id IS NOT NULL ORDER BY id FOR UPDATE", [batchId], conn);
}

// ---- upload --------------------------------------------------------------------
async function insertUpload(u, conn) {
  const res = await db.query(
    `INSERT INTO advancement_uploads (service_number, old_rate_id, new_rate_id, effective_date, authority, decoration, remark, file_name, sheet_row,
       advancement_id, uploaded_by, uploaded_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [u.serviceNumber, u.oldRateId, u.newRateId, u.date, u.authority || null, u.decoration || null, u.remark || null, u.fileName || null,
      u.row || null, u.advancementId || null, u.userId || null, u.userId || null], conn);
  return res.insertId;
}

async function uploadRaw(id, conn = null) {
  const rows = await db.query('SELECT * FROM advancement_uploads WHERE id = ?', [id], conn);
  return rows[0] || null;
}

/** The ratings a workbook names, with their rate, since when, and anything unfinished. */
async function ratingsForUpload(serviceNumbers, conn = null) {
  if (!serviceNumbers.length) return [];
  return db.query(
    `SELECT r.service_number, r.status, r.surname, r.first_name, r.middle_name, r.rate_id, rt.code AS rate_code, rt.name AS rate_name, rt.sort_order AS rate_sort,
            ${RATE_SINCE('r')} AS rate_since, pend.batch_number AS in_batch,
            (SELECT MIN(c.effective_date) FROM scheduled_changes c WHERE c.service_number = r.service_number AND c.kind = 'advancement' AND c.status = 'scheduled') AS scheduled_on
       FROM ratings r LEFT JOIN ref_rate rt ON rt.id = r.rate_id
       LEFT JOIN (${PENDING_ADV}) pend ON pend.service_number = r.service_number
      WHERE r.service_number IN (?)`, [serviceNumbers], conn);
}

/** The Advancement lines of the ratings a workbook names (duplicates). */
async function advancementLines(serviceNumbers, conn = null) {
  if (!serviceNumbers.length) return [];
  return db.query('SELECT service_number, rate_id, start_date FROM rating_advancement WHERE service_number IN (?)', [serviceNumbers], conn);
}

module.exports = {
  RATE_SINCE, options, refRow, rates, listDue, dueFresh, ratingForAdvance, ratingBasic, pendingAdvanceOf,
  listBatches, reportBatches, batchWithCounts, listRows, allRows, findRow, rowRaw, rowOfRating, rowsOfBatch, insertRow, resetRow,
  setNewRate, notRecommend, deleteRow, setBoard, markAdvanced, markBackToAwaiting, awaitingRows,
  insertUpload, uploadRaw, ratingsForUpload, advancementLines,
};
