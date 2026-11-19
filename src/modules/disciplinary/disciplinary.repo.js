'use strict';

/* Disciplinary Action: all SQL. Every function takes an optional connection (a transaction's). */
const db = require('../../db');

const CASE_SELECT = `
  SELECT c.id, c.case_number, c.service_number, c.status,
         c.incident_date, c.offence_id, o.name AS offence_name, c.what_happened, c.reported_by,
         c.decision_date, c.sanction_id, s.name AS sanction_name, c.decision, c.authority, c.cancel_reason,
         c.rate_id, rt.name AS rate_name, c.ship_id, sh.name AS ship_name,
         c.opened_at, uo.username AS opened_by_name,
         c.concluded_at, uc.username AS concluded_by_name,
         c.cancelled_at, ux.username AS cancelled_by_name,
         r.surname, r.first_name, r.middle_name, r.status AS rating_status
    FROM discipline_cases c
    JOIN ratings r ON r.service_number = c.service_number
    JOIN ref_disciplinary_offence o ON o.id = c.offence_id
    LEFT JOIN ref_disciplinary_sanction s ON s.id = c.sanction_id
    LEFT JOIN ref_rate rt ON rt.id = c.rate_id
    LEFT JOIN ref_ship sh ON sh.id = c.ship_id
    LEFT JOIN users uo ON uo.id = c.opened_by
    LEFT JOIN users uc ON uc.id = c.concluded_by
    LEFT JOIN users ux ON ux.id = c.cancelled_by`;

// the name search: an Official No or any part of the name (partial, any case)
const NAME_SQL = "(c.service_number LIKE ? OR CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) LIKE ? OR CONCAT_WS(' ', r.first_name, r.middle_name, r.surname) LIKE ?)";
const like = (q) => `%${String(q).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

/** WHERE for the case lists and the report; every value a placeholder. */
function where(f = {}) {
  const sql = [];
  const params = [];
  if (f.status) { sql.push('c.status = ?'); params.push(f.status); }
  if (f.notCancelled) sql.push("c.status <> 'cancelled'");
  if (f.serviceNumber) { sql.push('c.service_number = ?'); params.push(f.serviceNumber); }
  if (f.q) { const l = like(f.q); sql.push(NAME_SQL); params.push(l, l, l); }
  if (f.offenceId) { sql.push('c.offence_id = ?'); params.push(f.offenceId); }
  if (f.sanctionId) { sql.push('c.sanction_id = ?'); params.push(f.sanctionId); }
  if (f.shipId) { sql.push('c.ship_id = ?'); params.push(f.shipId); }
  if (f.rateId) { sql.push('c.rate_id = ?'); params.push(f.rateId); }
  if (f.from) { sql.push('c.decision_date >= ?'); params.push(f.from); }
  if (f.to) { sql.push('c.decision_date <= ?'); params.push(f.to); }
  return { sql: sql.length ? `WHERE ${sql.join(' AND ')}` : '', params };
}

const ORDER = {
  pending: 'ORDER BY c.opened_at DESC, c.id DESC',
  decided: 'ORDER BY c.decision_date DESC, c.id DESC',
  rating: "ORDER BY FIELD(c.status, 'pending', 'concluded') , c.incident_date DESC, c.id DESC",
};

async function listCases(filters, { order = 'decided', page = 1, pageSize = 25 } = {}, conn = null) {
  const w = where(filters);
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM discipline_cases c JOIN ratings r ON r.service_number = c.service_number ${w.sql}`, w.params, conn);
  const items = await db.query(`${CASE_SELECT} ${w.sql} ${ORDER[order] || ORDER.decided} LIMIT ? OFFSET ?`, [...w.params, pageSize, (page - 1) * pageSize], conn);
  return { items, total };
}

/** Every case matching the filters (a printout or workbook), capped. */
async function allCases(filters, { order = 'decided', limit = 5000 } = {}, conn = null) {
  const w = where(filters);
  return db.query(`${CASE_SELECT} ${w.sql} ${ORDER[order] || ORDER.decided} LIMIT ?`, [...w.params, limit], conn);
}

/** The count and the most common offence and sanction of the filtered cases. */
async function summary(filters, conn = null) {
  const w = where(filters);
  const join = 'FROM discipline_cases c JOIN ratings r ON r.service_number = c.service_number JOIN ref_disciplinary_offence o ON o.id = c.offence_id LEFT JOIN ref_disciplinary_sanction s ON s.id = c.sanction_id';
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total ${join} ${w.sql}`, w.params, conn);
  const [offence] = await db.query(`SELECT o.name AS name, COUNT(*) AS n ${join} ${w.sql} GROUP BY o.id, o.name ORDER BY n DESC, o.name ASC LIMIT 1`, w.params, conn);
  const withSanction = `${w.sql ? `${w.sql} AND` : 'WHERE'} s.id IS NOT NULL`;
  const [sanction] = await db.query(`SELECT s.name AS name, COUNT(*) AS n ${join} ${withSanction} GROUP BY s.id, s.name ORDER BY n DESC, s.name ASC LIMIT 1`, w.params, conn);
  return { total, topOffence: offence ? offence.name : null, topSanction: sanction ? sanction.name : null };
}

async function findCase(id, conn = null) {
  const rows = await db.query(`${CASE_SELECT} WHERE c.id = ?`, [id], conn);
  return rows[0] || null;
}

/** The raw table row, for the audit trail; locks it inside a transaction. */
async function findRaw(id, conn = null, lock = false) {
  const rows = await db.query(`SELECT * FROM discipline_cases WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id], conn);
  return rows[0] || null;
}

async function corrections(caseId, conn = null) {
  const rows = await db.query(
    `SELECT k.id, k.corrected_at, k.reason, k.changes, u.username AS corrected_by_name
       FROM discipline_case_corrections k LEFT JOIN users u ON u.id = k.corrected_by
      WHERE k.case_id = ? ORDER BY k.id ASC`, [caseId], conn);
  return rows.map((k) => ({ ...k, changes: typeof k.changes === 'string' ? JSON.parse(k.changes) : k.changes }));
}

async function correctionRaw(id, conn = null) {
  const rows = await db.query('SELECT * FROM discipline_case_corrections WHERE id = ?', [id], conn);
  return rows[0] || null;
}

async function nextCaseNumber(year, conn) {
  const prefix = `DC-${year}-`;
  const rows = await db.query(
    'SELECT COALESCE(MAX(CAST(SUBSTRING(case_number, 9) AS UNSIGNED)), 0) AS n FROM discipline_cases WHERE case_number LIKE ? FOR UPDATE',
    [`${prefix}%`], conn);
  return `${prefix}${String(rows[0].n + 1).padStart(4, '0')}`;
}

async function insertCase(c, conn) {
  const res = await db.query(
    `INSERT INTO discipline_cases
       (case_number, service_number, rate_id, ship_id, incident_date, offence_id, what_happened, reported_by,
        status, opened_by, opened_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [c.caseNumber, c.serviceNumber, c.rateId, c.shipId, c.incidentDate, c.offenceId, c.what, c.reportedBy, c.userId, c.openedAt || new Date(), c.userId], conn);
  return res.insertId;
}

async function conclude(id, c, conn) {
  await db.query(
    `UPDATE discipline_cases SET status = 'concluded', decision_date = ?, sanction_id = ?, decision = ?, authority = ?,
            concluded_by = ?, concluded_at = ? WHERE id = ?`,
    [c.decisionDate, c.sanctionId, c.decision, c.authority, c.userId, c.concludedAt || new Date(), id], conn);
}

async function cancel(id, c, conn) {
  await db.query(
    "UPDATE discipline_cases SET status = 'cancelled', cancel_reason = ?, cancelled_by = ?, cancelled_at = ? WHERE id = ?",
    [c.reason, c.userId, c.cancelledAt || new Date(), id], conn);
}

async function correct(id, c, conn) {
  await db.query(
    `UPDATE discipline_cases SET offence_id = ?, incident_date = ?, what_happened = ?, reported_by = ?,
            decision_date = ?, sanction_id = ?, decision = ?, authority = ? WHERE id = ?`,
    [c.offenceId, c.incidentDate, c.what, c.reportedBy, c.decisionDate, c.sanctionId, c.decision, c.authority, id], conn);
}

async function insertCorrection(caseId, k, conn) {
  const res = await db.query(
    'INSERT INTO discipline_case_corrections (case_id, corrected_by, corrected_at, reason, changes) VALUES (?, ?, ?, ?, ?)',
    [caseId, k.userId, k.at || new Date(), k.reason, JSON.stringify(k.changes)], conn);
  return res.insertId;
}

/** Another case (not cancelled, not `exceptId`) for the same rating, offence and incident date. */
async function findDuplicate({ serviceNumber, offenceId, incidentDate, exceptId = 0 }, conn = null) {
  const rows = await db.query(
    "SELECT case_number FROM discipline_cases WHERE service_number = ? AND offence_id = ? AND incident_date = ? AND status <> 'cancelled' AND id <> ? LIMIT 1",
    [serviceNumber, offenceId, incidentDate, exceptId], conn);
  return rows[0] || null;
}

/** A rating with what a case keeps: rate, the open posting's ship, when it joined. */
async function ratingForCase(serviceNumber, conn = null, lock = false) {
  const rows = await db.query(
    `SELECT r.service_number, r.status, r.rate_id, r.surname, r.first_name, r.middle_name, r.date_employed,
            (SELECT d.ship_id FROM rating_drafting d WHERE d.service_number = r.service_number AND d.end_date IS NULL ORDER BY d.id DESC LIMIT 1) AS ship_id
       FROM ratings r WHERE r.service_number = ?${lock ? ' FOR UPDATE' : ''}`, [serviceNumber], conn);
  return rows[0] || null;
}

/** Ratings found by Official No or name (partial), with what the Initiate page shows. */
async function findRatings({ q, status = 'current', page = 1, pageSize = 25 }, conn = null) {
  const l = like(q);
  const nameSql = "(r.service_number LIKE ? OR CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) LIKE ? OR CONCAT_WS(' ', r.first_name, r.middle_name, r.surname) LIKE ?)";
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM ratings r WHERE r.status = ? AND ${nameSql}`, [status, l, l, l], conn);
  const items = await db.query(
    `SELECT r.service_number, r.surname, r.first_name, r.middle_name, r.date_employed,
            rt.name AS rate_name, b.name AS branch_name, cmd.name AS command_name,
            (SELECT sh.name FROM rating_drafting d JOIN ref_ship sh ON sh.id = d.ship_id
              WHERE d.service_number = r.service_number AND d.end_date IS NULL ORDER BY d.id DESC LIMIT 1) AS current_ship_name,
            (SELECT COUNT(*) FROM discipline_cases c WHERE c.service_number = r.service_number AND c.status = 'pending') AS pending_cases,
            (SELECT COUNT(*) FROM discipline_cases c WHERE c.service_number = r.service_number AND c.status <> 'cancelled') AS cases
       FROM ratings r
       LEFT JOIN ref_rate rt ON rt.id = r.rate_id
       LEFT JOIN ref_branch b ON b.id = r.branch_id
       LEFT JOIN ref_command cmd ON cmd.id = r.command_id
      WHERE r.status = ? AND ${nameSql}
      ORDER BY r.surname, r.first_name, r.service_number LIMIT ? OFFSET ?`,
    [status, l, l, l, pageSize, (page - 1) * pageSize], conn);
  return { items, total };
}

async function countRatings({ q, status }, conn = null) {
  const l = like(q);
  const [{ total }] = await db.query(
    `SELECT COUNT(*) AS total FROM ratings r WHERE r.status = ? AND (r.service_number LIKE ? OR CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) LIKE ? OR CONCAT_WS(' ', r.first_name, r.middle_name, r.surname) LIKE ?)`,
    [status, l, l, l], conn);
  return total;
}

/** The dropdown rows the screens need: their own source, gated by the disciplinary screens. */
async function options(conn = null) {
  const [offences, sanctions, ships, rates] = await Promise.all([
    db.query('SELECT id, name, is_active AS active FROM ref_disciplinary_offence ORDER BY sort_order, name', [], conn),
    db.query('SELECT id, name, is_active AS active FROM ref_disciplinary_sanction ORDER BY sort_order, name', [], conn),
    db.query('SELECT id, name, is_active AS active FROM ref_ship ORDER BY sort_order, name', [], conn),
    db.query('SELECT id, name, is_active AS active FROM ref_rate ORDER BY sort_order, name', [], conn),
  ]);
  return { offences, sanctions, ships, rates };
}

async function offenceExists(id, conn = null) {
  const r = await db.query('SELECT id, is_active FROM ref_disciplinary_offence WHERE id = ?', [id], conn);
  return r[0] || null;
}
async function sanctionExists(id, conn = null) {
  const r = await db.query('SELECT id, is_active FROM ref_disciplinary_sanction WHERE id = ?', [id], conn);
  return r[0] || null;
}

module.exports = {
  listCases, allCases, summary, findCase, findRaw, corrections, correctionRaw, nextCaseNumber, insertCase, conclude, cancel,
  correct, insertCorrection, findDuplicate, ratingForCase, findRatings, countRatings, options, offenceExists, sanctionExists,
};
