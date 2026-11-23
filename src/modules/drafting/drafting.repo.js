'use strict';

/* Drafting: all SQL for the six pages (the batch and approval tables' shared SQL is in cycle.repo.js). */
const db = require('../../db');
const { BATCH_SELECT, whoCols, whoJoins } = require('./cycle.repo');

const like = (q) => `%${String(q).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

// a rating's open posting (the current ship): the newest row with no end date
const CURRENT_POSTING = `JOIN rating_drafting cur ON cur.service_number = r.service_number AND cur.end_date IS NULL
       AND cur.id = (SELECT MAX(x.id) FROM rating_drafting x WHERE x.service_number = r.service_number AND x.end_date IS NULL)`;

// a rating is "in a batch" while a draft for it is not finished: a live row of an open batch, or a row
// of a closed batch that waits for its WEF or is scheduled
const PENDING_DRAFT = `SELECT d.service_number, MIN(b.batch_number) AS batch_number, MIN(b.id) AS batch_id
       FROM draft_rows d JOIN batches b ON b.id = d.batch_id
      WHERE b.flow = 'DOD' AND ((b.status IN ('open','approved') AND d.status = 'proposed') OR d.status IN ('awaiting_wef','scheduled'))
      GROUP BY d.service_number`;

// ---- options ------------------------------------------------------------------
async function options() {
  const [ships, rates, branches, specialisations] = await Promise.all([
    db.query('SELECT id, name, type, is_active FROM ref_ship ORDER BY sort_order, name'),
    db.query('SELECT id, name, code, sort_order FROM ref_rate ORDER BY sort_order, name'),
    db.query('SELECT id, name, code, is_active FROM ref_branch ORDER BY sort_order, name'),
    db.query('SELECT id, name, code, is_active FROM ref_specialisation ORDER BY sort_order, name'),
  ]);
  return { ships, rates, branches, specialisations };
}

async function refRow(table, id, conn = null) {
  const allowed = { ref_ship: 1, ref_rate: 1, ref_branch: 1, ref_specialisation: 1 };
  if (!allowed[table]) throw new Error('Unknown table');
  const rows = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [id], conn);
  return rows[0] || null;
}

// ---- manning requirement ---------------------------------------------------------
// aboard: current ratings whose open posting is the ship, of the rate and specialisation
const ABOARD = `(SELECT COUNT(*) FROM ratings r ${CURRENT_POSTING}
       WHERE r.status = 'current' AND cur.ship_id = m.ship_id AND r.rate_id = m.rate_id AND r.specialisation_id = m.specialisation_id)`;

function manningWhere(f) {
  const sql = [];
  const params = [];
  if (f.shipId) { sql.push('m.ship_id = ?'); params.push(f.shipId); }
  if (f.rateId) { sql.push('m.rate_id = ?'); params.push(f.rateId); }
  if (f.specialisationId) { sql.push('m.specialisation_id = ?'); params.push(f.specialisationId); }
  if (f.commandId) { sql.push('m.ship_id IN (SELECT id FROM ref_ship WHERE command_id = ?)'); params.push(f.commandId); }
  return { sql: sql.length ? `WHERE ${sql.join(' AND ')}` : '', params };
}

const MANNING_SELECT = `SELECT m.id, m.ship_id, s.name AS ship_name, m.rate_id, rt.name AS rate_name, rt.code AS rate_code,
         m.specialisation_id, sp.name AS specialisation_name, m.quantity, ${ABOARD} AS aboard
    FROM manning_requirements m
    JOIN ref_ship s ON s.id = m.ship_id
    JOIN ref_rate rt ON rt.id = m.rate_id
    JOIN ref_specialisation sp ON sp.id = m.specialisation_id`;
const MANNING_ORDER = 'ORDER BY s.name, rt.sort_order, sp.name';

async function listManning(f, { page = 1, pageSize = 25 } = {}) {
  const w = manningWhere(f);
  const [{ total, required }] = await db.query(`SELECT COUNT(*) AS total, COALESCE(SUM(m.quantity), 0) AS required FROM manning_requirements m ${w.sql}`, w.params);
  const [{ aboard }] = await db.query(`SELECT COALESCE(SUM(${ABOARD}), 0) AS aboard FROM manning_requirements m ${w.sql}`, w.params);
  const items = await db.query(`${MANNING_SELECT} ${w.sql} ${MANNING_ORDER} LIMIT ? OFFSET ?`, [...w.params, pageSize, (page - 1) * pageSize]);
  return { items, total: Number(total), required: Number(required), aboard: Number(aboard) };
}

async function allManning(f, limit = 5000) {
  const w = manningWhere(f);
  return db.query(`${MANNING_SELECT} ${w.sql} ${MANNING_ORDER} LIMIT ${Number(limit) || 5000}`, w.params);
}

async function findManning(id, conn = null) {
  const rows = await db.query(`${MANNING_SELECT} WHERE m.id = ?`, [id], conn);
  return rows[0] || null;
}

async function manningRaw(id, conn = null, lock = false) {
  const rows = await db.query(`SELECT * FROM manning_requirements WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id], conn);
  return rows[0] || null;
}

async function manningDuplicate({ shipId, rateId, specialisationId, exceptId = 0 }, conn = null) {
  const rows = await db.query(
    'SELECT id FROM manning_requirements WHERE ship_id = ? AND rate_id = ? AND specialisation_id = ? AND id <> ? LIMIT 1',
    [shipId, rateId, specialisationId, exceptId], conn);
  return rows[0] || null;
}

async function insertManning(m, conn) {
  const res = await db.query(
    'INSERT INTO manning_requirements (ship_id, rate_id, specialisation_id, quantity, created_by) VALUES (?, ?, ?, ?, ?)',
    [m.shipId, m.rateId, m.specialisationId, m.quantity, m.userId || null], conn);
  return res.insertId;
}

async function updateManning(id, m, conn) {
  await db.query('UPDATE manning_requirements SET ship_id = ?, rate_id = ?, specialisation_id = ?, quantity = ? WHERE id = ?',
    [m.shipId, m.rateId, m.specialisationId, m.quantity, id], conn);
}

async function deleteManning(id, conn) {
  await db.query('DELETE FROM manning_requirements WHERE id = ?', [id], conn);
}

/** Required for a ship, rate and specialisation (null when there is no requirement). */
async function requirement(shipId, rateId, specialisationId, conn = null) {
  const rows = await db.query('SELECT quantity FROM manning_requirements WHERE ship_id = ? AND rate_id = ? AND specialisation_id = ?', [shipId, rateId, specialisationId], conn);
  return rows[0] ? rows[0].quantity : null;
}

async function aboardCount(shipId, rateId, specialisationId, conn = null) {
  const rows = await db.query(
    `SELECT COUNT(*) AS n FROM ratings r ${CURRENT_POSTING}
      WHERE r.status = 'current' AND cur.ship_id = ? AND r.rate_id = ? AND r.specialisation_id = ?`, [shipId, rateId, specialisationId], conn);
  return Number(rows[0].n);
}

/** What the open draft batches would bring to (and take from) a ship, for one rate and specialisation. */
async function draftFlows(shipId, rateId, specialisationId, conn = null) {
  const rows = await db.query(
    `SELECT SUM(d.proposed_ship_id = ? AND (d.current_ship_id IS NULL OR d.current_ship_id <> ?)) AS incoming,
            SUM(d.current_ship_id = ? AND d.proposed_ship_id IS NOT NULL AND d.proposed_ship_id <> ?) AS outgoing
       FROM draft_rows d JOIN batches b ON b.id = d.batch_id
      WHERE b.flow = 'DOD' AND b.status IN ('open','approved') AND d.status = 'proposed'
        AND d.rate_id = ? AND d.specialisation_id = ?`,
    [shipId, shipId, shipId, shipId, rateId, specialisationId], conn);
  return { incoming: Number(rows[0].incoming || 0), outgoing: Number(rows[0].outgoing || 0) };
}

// ---- who is due ------------------------------------------------------------------
function dueWhere(f) {
  const sql = ["r.status = 'current'", 'cur.start_date IS NOT NULL', 'TIMESTAMPDIFF(MONTH, cur.start_date, ?) >= ?'];
  const params = [f.today, f.dueMonths];
  if (f.branchId) { sql.push('r.branch_id = ?'); params.push(f.branchId); }
  if (f.specialisationId) { sql.push('r.specialisation_id = ?'); params.push(f.specialisationId); }
  if (f.rateId) { sql.push('r.rate_id = ?'); params.push(f.rateId); }
  return { sql: `WHERE ${sql.join(' AND ')}`, params };
}

const DUE_SELECT = `SELECT r.service_number, r.surname, r.first_name, r.middle_name, r.rate_id, rt.name AS rate_name, rt.code AS rate_code,
         g.name AS gender, r.branch_id, br.name AS branch_name, r.specialisation_id, sp.name AS specialisation_name,
         cur.id AS posting_id, cur.ship_id, s.name AS ship_name, cur.start_date AS joined_on,
         TIMESTAMPDIFF(MONTH, cur.start_date, ?) AS months,
         pend.batch_number AS in_batch, pend.batch_id AS in_batch_id,
         (SELECT ps.name FROM rating_drafting p JOIN ref_ship ps ON ps.id = p.ship_id
           WHERE p.service_number = r.service_number AND p.id <> cur.id ORDER BY p.start_date DESC, p.id DESC LIMIT 1) AS last_ship_1,
         (SELECT ps.name FROM rating_drafting p JOIN ref_ship ps ON ps.id = p.ship_id
           WHERE p.service_number = r.service_number AND p.id <> cur.id ORDER BY p.start_date DESC, p.id DESC LIMIT 1 OFFSET 1) AS last_ship_2,
         (SELECT b2.authority FROM draft_rows d2 JOIN batches b2 ON b2.id = d2.batch_id WHERE d2.posting_id = cur.id LIMIT 1) AS last_authority
    FROM ratings r
    ${CURRENT_POSTING}
    JOIN ref_ship s ON s.id = cur.ship_id
    LEFT JOIN ref_rate rt ON rt.id = r.rate_id
    LEFT JOIN ref_gender g ON g.id = r.gender_id
    LEFT JOIN ref_branch br ON br.id = r.branch_id
    LEFT JOIN ref_specialisation sp ON sp.id = r.specialisation_id
    LEFT JOIN (${PENDING_DRAFT}) pend ON pend.service_number = r.service_number`;

async function listDue(f, { page = 1, pageSize = 25 } = {}) {
  const w = dueWhere(f);
  const [{ total, inBatch }] = await db.query(
    `SELECT COUNT(*) AS total, SUM(pend.service_number IS NOT NULL) AS inBatch FROM ratings r ${CURRENT_POSTING}
       LEFT JOIN (${PENDING_DRAFT}) pend ON pend.service_number = r.service_number ${w.sql}`, w.params);
  const items = await db.query(`${DUE_SELECT} ${w.sql} ORDER BY months DESC, r.surname, r.service_number LIMIT ? OFFSET ?`,
    [f.today, ...w.params, pageSize, (page - 1) * pageSize]);
  return { items, total: Number(total), inBatch: Number(inBatch || 0) };
}

/** Every due rating not already in a batch (making a batch), locked. */
async function dueFresh(f, conn) {
  const w = dueWhere(f);
  return db.query(`${DUE_SELECT} ${w.sql} AND pend.service_number IS NULL ORDER BY months DESC, r.service_number FOR UPDATE`,
    [f.today, ...w.params], conn);
}

/** One current rating with its current posting (Add Personnel). */
async function ratingForDraft(serviceNumber, today, conn = null) {
  const rows = await db.query(`${DUE_SELECT} WHERE r.service_number = ?`, [today, serviceNumber], conn);
  return rows[0] || null;
}

async function ratingBasic(serviceNumber, conn = null) {
  const rows = await db.query(
    `SELECT r.service_number, r.status, r.surname, r.first_name, r.middle_name, r.rate_id, r.specialisation_id, rt.code AS rate_code
       FROM ratings r LEFT JOIN ref_rate rt ON rt.id = r.rate_id WHERE r.service_number = ?`, [serviceNumber], conn);
  return rows[0] || null;
}

async function pendingDraftOf(serviceNumber, conn = null) {
  const rows = await db.query(`SELECT * FROM (${PENDING_DRAFT}) p WHERE p.service_number = ?`, [serviceNumber], conn);
  return rows[0] || null;
}

// ---- batches --------------------------------------------------------------------
/**
 * The draft batches for a page. stage 'open': open and approved; 'wef': closed with an authority and still
 * waiting for a WEF or closed within the last 30 days. specialisationId limits to a department's batches.
 */
async function listBatches({ stage, specialisationId = null, today }) {
  const sql = ["b.flow = 'DOD'"];
  const params = [];
  if (stage === 'open') sql.push("b.status IN ('open','approved')");
  if (stage === 'wef') {
    sql.push("b.status = 'closed' AND b.authority IS NOT NULL");
    sql.push(`(EXISTS (SELECT 1 FROM draft_rows w WHERE w.batch_id = b.id AND w.status IN ('awaiting_wef','scheduled'))
             OR b.close_date >= DATE_SUB(?, INTERVAL 30 DAY))`);
    params.push(today);
  }
  if (specialisationId) { sql.push('b.specialisation_id = ?'); params.push(specialisationId); }
  return db.query(
    `${BATCH_SELECT.replace('FROM batches b', `, (SELECT COUNT(*) FROM draft_rows c WHERE c.batch_id = b.id AND c.status <> 'not_recommended') AS live,
              (SELECT COUNT(*) FROM draft_rows c WHERE c.batch_id = b.id AND c.status <> 'not_recommended' AND c.proposed_ship_id IS NOT NULL) AS with_ship,
              (SELECT COUNT(*) FROM draft_rows c WHERE c.batch_id = b.id AND c.status IN ('scheduled','reported')) AS dated,
              (SELECT COUNT(*) FROM draft_rows c WHERE c.batch_id = b.id AND c.status = 'not_recommended') AS not_recommended
         FROM batches b`)}
      WHERE ${sql.join(' AND ')} ORDER BY ${stage === 'wef' ? 'b.close_date DESC, b.id DESC' : 'b.initiated_at DESC, b.id DESC'} LIMIT 500`, params);
}

const ROW_SELECT = `SELECT d.*, b.batch_number, b.status AS batch_status, b.close_date, b.authority,
         r.surname, r.first_name, r.middle_name, r.status AS rating_status, g.name AS gender,
         rt.name AS rate_name, rt.code AS rate_code, sp.name AS specialisation_name,
         cs.name AS current_ship_name, ps.name AS proposed_ship_name,
         nowp.ship_id AS now_ship_id, nows.name AS now_ship_name,
         TIMESTAMPDIFF(MONTH, d.joined_on, ?) AS months_now,
         a.approver_rank, a.approver_name, a.appointment AS approval_appointment, a.approved_at,
         ${whoCols('nr')}
    FROM draft_rows d
    JOIN batches b ON b.id = d.batch_id
    JOIN ratings r ON r.service_number = d.service_number
    LEFT JOIN ref_gender g ON g.id = r.gender_id
    LEFT JOIN ref_rate rt ON rt.id = d.rate_id
    LEFT JOIN ref_specialisation sp ON sp.id = d.specialisation_id
    LEFT JOIN ref_ship cs ON cs.id = d.current_ship_id
    LEFT JOIN ref_ship ps ON ps.id = d.proposed_ship_id
    LEFT JOIN rating_drafting nowp ON nowp.service_number = d.service_number AND nowp.end_date IS NULL
         AND nowp.id = (SELECT MAX(x.id) FROM rating_drafting x WHERE x.service_number = d.service_number AND x.end_date IS NULL)
    LEFT JOIN ref_ship nows ON nows.id = nowp.ship_id
    LEFT JOIN batch_approvals a ON a.id = d.approval_id
    ${whoJoins('nr', 'd.not_recommended_by')}`;

function rowsWhere(f) {
  const sql = ['d.batch_id = ?'];
  const params = [f.batchId];
  if (f.specialisationId) { sql.push('d.specialisation_id = ?'); params.push(f.specialisationId); }
  if (f.live) sql.push("d.status <> 'not_recommended'");
  if (f.openAll) {
    // every department's live rows across the open batches (Export Excel All Departments)
    sql.length = 0; params.length = 0;
    sql.push("b.flow = 'DOD' AND b.status IN ('open','approved') AND d.status = 'proposed'");
    if (f.specialisationId) { sql.push('d.specialisation_id = ?'); params.push(f.specialisationId); }
  }
  if (f.openDepartment) {
    // a department's live rows across the open batches (Draft Approval)
    sql.length = 0; params.length = 0;
    sql.push("b.flow = 'DOD' AND b.status IN ('open','approved') AND d.status = 'proposed' AND d.specialisation_id = ?");
    params.push(f.openDepartment);
  }
  if (f.q) { const l = like(f.q); sql.push("(d.service_number LIKE ? OR CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) LIKE ?)"); params.push(l, l); }
  return { sql: `WHERE ${sql.join(' AND ')}`, params };
}

const ROW_ORDER = "ORDER BY d.status = 'not_recommended', rt.sort_order DESC, r.surname, d.service_number";

async function listRows(f, { page = 1, pageSize = 25, today }) {
  const w = rowsWhere(f);
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM draft_rows d JOIN batches b ON b.id = d.batch_id JOIN ratings r ON r.service_number = d.service_number LEFT JOIN ref_rate rt ON rt.id = d.rate_id ${w.sql}`, w.params);
  const items = await db.query(`${ROW_SELECT} ${w.sql} ${ROW_ORDER} LIMIT ? OFFSET ?`, [today, ...w.params, pageSize, (page - 1) * pageSize]);
  return { items, total: Number(total) };
}

async function allRows(f, today, conn = null) {
  const w = rowsWhere(f);
  return db.query(`${ROW_SELECT} ${w.sql} ${ROW_ORDER} LIMIT 5000`, [today, ...w.params], conn);
}

async function findRow(id, today, conn = null) {
  const rows = await db.query(`${ROW_SELECT} WHERE d.id = ?`, [today, id], conn);
  return rows[0] || null;
}

async function rowRaw(id, conn = null, lock = false) {
  const rows = await db.query(`SELECT * FROM draft_rows WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id], conn);
  return rows[0] || null;
}

async function rowOfRating(batchId, serviceNumber, conn = null) {
  const rows = await db.query('SELECT * FROM draft_rows WHERE batch_id = ? AND service_number = ? FOR UPDATE', [batchId, serviceNumber], conn);
  return rows[0] || null;
}

async function rowsOfBatch(batchId, conn) {
  return db.query('SELECT * FROM draft_rows WHERE batch_id = ? ORDER BY id FOR UPDATE', [batchId], conn);
}

async function insertRow(x, conn) {
  const res = await db.query(
    `INSERT INTO draft_rows (batch_id, service_number, rate_id, specialisation_id, current_ship_id, joined_on, months_on_ship,
       request, status, added_by, added_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'proposed', ?, NOW(), ?)`,
    [x.batchId, x.serviceNumber, x.rateId || null, x.specialisationId || null, x.currentShipId || null, x.joinedOn || null,
      x.months === null || x.months === undefined ? null : x.months, x.request || null, x.userId || null, x.userId || null], conn);
  return res.insertId;
}

/** A not-recommended row taken back into the batch: a fresh proposal. */
async function resetRow(id, x, conn) {
  await db.query(
    `UPDATE draft_rows SET status = 'proposed', not_recommended_reason = NULL, not_recommended_by = NULL, not_recommended_at = NULL,
            proposed_ship_id = NULL, vice = NULL, remark = NULL, approval_id = NULL, request = ?, rate_id = ?, specialisation_id = ?,
            current_ship_id = ?, joined_on = ?, months_on_ship = ?, added_by = ?, added_at = NOW()
      WHERE id = ?`,
    [x.request || null, x.rateId || null, x.specialisationId || null, x.currentShipId || null, x.joinedOn || null, x.months, x.userId || null, id], conn);
}

async function updatePosting(id, p, conn) {
  await db.query('UPDATE draft_rows SET proposed_ship_id = ?, vice = ?, remark = ? WHERE id = ?', [p.shipId, p.vice || null, p.remark || null, id], conn);
}

async function notRecommend(id, { reason, userId }, conn) {
  await db.query(
    `UPDATE draft_rows SET status = 'not_recommended', not_recommended_reason = ?, not_recommended_by = ?, not_recommended_at = NOW(),
            proposed_ship_id = NULL, approval_id = NULL WHERE id = ?`, [reason, userId || null, id], conn);
}

async function deleteRow(id, conn) {
  await db.query('DELETE FROM draft_rows WHERE id = ?', [id], conn);
}

async function setWef(id, { status, wef, postingId = null, scheduledId = null, userId }, conn) {
  await db.query('UPDATE draft_rows SET status = ?, wef = ?, posting_id = ?, scheduled_change_id = ?, wef_set_by = ?, wef_set_at = NOW() WHERE id = ?',
    [status, wef, postingId, scheduledId, userId || null, id], conn);
}

async function markReported(id, postingId, conn) {
  await db.query("UPDATE draft_rows SET status = 'reported', posting_id = ? WHERE id = ?", [postingId, id], conn);
}

async function markBackToAwaiting(id, conn) {
  await db.query("UPDATE draft_rows SET status = 'awaiting_wef', wef = NULL, scheduled_change_id = NULL WHERE id = ?", [id], conn);
}

/** A closed batch's rows waiting for a WEF that have a proposed ship, in one department or all, locked. */
async function pendingWefRows(batchId, specialisationId, conn) {
  const params = [batchId];
  let extra = '';
  if (specialisationId) { extra = ' AND specialisation_id = ?'; params.push(specialisationId); }
  return db.query(`SELECT * FROM draft_rows WHERE batch_id = ? AND status = 'awaiting_wef' AND proposed_ship_id IS NOT NULL${extra} ORDER BY id FOR UPDATE`, params, conn);
}

/** Per department of a batch: live rows, those waiting for a WEF (with a proposed ship). */
async function batchDepartmentCounts(batchId, conn = null) {
  return db.query(
    `SELECT d.specialisation_id AS id, sp.name, COUNT(*) AS n,
            SUM(d.status = 'awaiting_wef' AND d.proposed_ship_id IS NOT NULL) AS pending
       FROM draft_rows d LEFT JOIN ref_specialisation sp ON sp.id = d.specialisation_id
      WHERE d.batch_id = ? AND d.status <> 'not_recommended'
      GROUP BY d.specialisation_id, sp.name ORDER BY sp.name`, [batchId], conn);
}

module.exports = {
  CURRENT_POSTING,
  options, refRow, listManning, allManning, findManning, manningRaw, manningDuplicate, insertManning, updateManning, deleteManning,
  requirement, aboardCount, draftFlows, listDue, dueFresh, ratingForDraft, ratingBasic, pendingDraftOf,
  listBatches, listRows, allRows, findRow, rowRaw, rowOfRating, rowsOfBatch, insertRow, resetRow, updatePosting, notRecommend,
  deleteRow, setWef, markReported, markBackToAwaiting, pendingWefRows, batchDepartmentCounts,
};
