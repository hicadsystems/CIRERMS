'use strict';

/* Special Drafting: all SQL (special_drafts and special_draft_forms). The rating's postings are WP7a's. */
const db = require('../../db');
const { whoCols, whoJoins } = require('../drafting/cycle.repo');

const like = (q) => `%${String(q).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

// a rating's open posting (the current ship): the newest row with no end date
const CURRENT_POSTING = `LEFT JOIN rating_drafting cur ON cur.service_number = r.service_number AND cur.end_date IS NULL
       AND cur.id = (SELECT MAX(x.id) FROM rating_drafting x WHERE x.service_number = r.service_number AND x.end_date IS NULL)`;

// ---- options ------------------------------------------------------------------
async function ships(conn = null) {
  return db.query('SELECT id, name, is_active FROM ref_ship ORDER BY sort_order, name', [], conn);
}

// ---- ratings -----------------------------------------------------------------
/** A rating with its current rate, branch, ship, the day it joined the ship and the months there. */
async function ratingCard(serviceNumber, today, conn = null, lock = false) {
  const rows = await db.query(
    `SELECT r.service_number, r.status, r.rate_id, r.surname, r.first_name, r.middle_name,
            rt.name AS rate_name, rt.code AS rate_code, g.name AS gender, br.name AS branch_name, sp.name AS specialisation_name,
            cur.id AS posting_id, cur.ship_id AS current_ship_id, cs.name AS current_ship_name, cur.start_date AS joined_on,
            IF(cur.start_date IS NULL, NULL, TIMESTAMPDIFF(MONTH, cur.start_date, ?)) AS months
       FROM ratings r
       LEFT JOIN ref_rate rt ON rt.id = r.rate_id
       LEFT JOIN ref_gender g ON g.id = r.gender_id
       LEFT JOIN ref_branch br ON br.id = r.branch_id
       LEFT JOIN ref_specialisation sp ON sp.id = r.specialisation_id
       ${CURRENT_POSTING}
       LEFT JOIN ref_ship cs ON cs.id = cur.ship_id
      WHERE r.service_number = ?${lock ? ' FOR UPDATE' : ''}`, [today, serviceNumber], conn);
  return rows[0] || null;
}

/** Locks the rating's row, so two drafts for one rating cannot be made at the same time. */
async function lockRating(serviceNumber, conn) {
  const rows = await db.query('SELECT service_number FROM ratings WHERE service_number = ? FOR UPDATE', [serviceNumber], conn);
  return rows[0] || null;
}

/** Locks these ratings' rows, in key order, so two imports (or an import and a proposal) cannot both draft one rating. */
async function lockRatings(serviceNumbers, conn) {
  if (!serviceNumbers.length) return;
  await db.query('SELECT service_number FROM ratings WHERE service_number IN (?) ORDER BY service_number FOR UPDATE', [serviceNumbers], conn);
}

/** For the upload: the ratings of these official numbers with their current ship and when they joined it. */
async function ratingsForUpload(serviceNumbers, today, conn = null) {
  if (!serviceNumbers.length) return [];
  return db.query(
    `SELECT r.service_number, r.status, r.rate_id, r.surname, r.first_name, r.middle_name,
            cur.ship_id AS current_ship_id, cs.name AS current_ship_name, cur.start_date AS joined_on,
            IF(cur.start_date IS NULL, NULL, TIMESTAMPDIFF(MONTH, cur.start_date, ?)) AS months
       FROM ratings r ${CURRENT_POSTING}
       LEFT JOIN ref_ship cs ON cs.id = cur.ship_id
      WHERE r.service_number IN (?)`, [today, serviceNumbers], conn);
}

// ---- drafts ------------------------------------------------------------------
const DRAFT_SELECT = `SELECT d.*, r.status AS rating_status, r.surname, r.first_name, r.middle_name,
         rt.name AS rate_name, rt.code AS rate_code, g.name AS gender,
         cs.name AS current_ship_name, ts.name AS ship_name, f.form_number, f.printed_at,
         IF(d.status = 'unprinted' AND d.joined_on IS NOT NULL, TIMESTAMPDIFF(MONTH, d.joined_on, ?), d.months_on_ship) AS months_now,
         ${whoCols('cre')}
    FROM special_drafts d
    JOIN ratings r ON r.service_number = d.service_number
    LEFT JOIN ref_rate rt ON rt.id = d.rate_id
    LEFT JOIN ref_gender g ON g.id = r.gender_id
    LEFT JOIN ref_ship cs ON cs.id = d.current_ship_id
    LEFT JOIN ref_ship ts ON ts.id = d.ship_id
    LEFT JOIN special_draft_forms f ON f.id = d.form_id
    ${whoJoins('cre', 'd.created_by')}`;

function draftWhere(f) {
  const sql = [];
  const params = [];
  if (f.status === 'waiting') sql.push("d.status = 'unprinted'");
  if (f.formId) { sql.push('d.form_id = ?'); params.push(f.formId); }
  if (f.postingType) { sql.push('d.posting_type = ?'); params.push(f.postingType); }
  if (f.q) {
    sql.push('(d.service_number LIKE ? OR r.surname LIKE ? OR r.first_name LIKE ? OR r.middle_name LIKE ?)');
    const p = like(f.q);
    params.push(p, p, p, p);
  }
  return { sql: sql.length ? `WHERE ${sql.join(' AND ')}` : '', params };
}

async function listDrafts(f, today, { page = 1, pageSize = 25 } = {}) {
  const w = draftWhere(f);
  const total = (await db.query(`SELECT COUNT(*) AS n FROM special_drafts d JOIN ratings r ON r.service_number = d.service_number ${w.sql}`, w.params))[0].n;
  const items = await db.query(`${DRAFT_SELECT} ${w.sql} ORDER BY d.wef, r.surname, d.service_number, d.id LIMIT ? OFFSET ?`,
    [today, ...w.params, pageSize, (page - 1) * pageSize]);
  return { items, total };
}

async function findDraft(id, today, conn = null) {
  const rows = await db.query(`${DRAFT_SELECT} WHERE d.id = ?`, [today, id], conn);
  return rows[0] || null;
}

async function draftRaw(id, conn = null, lock = false) {
  const rows = await db.query(`SELECT * FROM special_drafts WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id], conn);
  return rows[0] || null;
}

/** The unprinted drafts of a posting type, in the order they go on the form (their rows locked when asked). */
async function waitingOfType(postingType, today, conn = null, lock = false) {
  // the lock is taken on the drafts alone, so the joined tables are not locked (portable to MariaDB)
  if (lock) await db.query("SELECT id FROM special_drafts WHERE status = 'unprinted' AND posting_type = ? FOR UPDATE", [postingType], conn);
  return db.query(`${DRAFT_SELECT} WHERE d.status = 'unprinted' AND d.posting_type = ? ORDER BY d.wef, r.surname, d.service_number, d.id`, [today, postingType], conn);
}

/** The drafts a rating has that are not finished: waiting to be printed, or printed with the move still to come. */
async function openDraftsOf(serviceNumbers, conn = null) {
  if (!serviceNumbers.length) return [];
  return db.query("SELECT id, service_number, status FROM special_drafts WHERE service_number IN (?) AND status IN ('unprinted','scheduled')", [serviceNumbers], conn);
}

/** How many unprinted drafts of each posting type. */
async function waitingCounts() {
  return db.query("SELECT posting_type, COUNT(*) AS n FROM special_drafts WHERE status = 'unprinted' GROUP BY posting_type");
}

async function insertDraft(x, conn) {
  const res = await db.query(
    `INSERT INTO special_drafts (service_number, rate_id, current_ship_id, joined_on, months_on_ship, ship_id, authority, wef, posting_type, vice, remark,
                                 status, source, file_name, sheet_row, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unprinted', ?, ?, ?, ?)`,
    [x.serviceNumber, x.rateId || null, x.currentShipId || null, x.joinedOn || null, x.months === undefined ? null : x.months, x.shipId, x.authority, x.wef,
      x.postingType, x.vice || null, x.remark || null, x.source || 'proposal', x.fileName || null, x.sheetRow || null, x.userId || null], conn);
  return res.insertId;
}

async function deleteDraft(id, conn) {
  await db.query('DELETE FROM special_drafts WHERE id = ?', [id], conn);
}

/** The draft as it was when printed: the rating's rate, ship and months, then the form it is on and how the move went. */
async function markPrinted(id, x, conn) {
  await db.query(
    `UPDATE special_drafts SET rate_id = ?, current_ship_id = ?, joined_on = ?, months_on_ship = ?, form_id = ?, status = ?, posting_id = ?, scheduled_change_id = ? WHERE id = ?`,
    [x.rateId || null, x.currentShipId || null, x.joinedOn || null, x.months === undefined ? null : x.months, x.formId, x.status, x.postingId || null, x.scheduledChangeId || null, id], conn);
}

/** A scheduled move was made (applied) or could not be (cancelled). */
async function setOutcome(id, x, conn) {
  await db.query('UPDATE special_drafts SET status = ?, posting_id = ?, cancelled_reason = ? WHERE id = ?', [x.status, x.postingId || null, x.reason || null, id], conn);
}

// ---- forms ------------------------------------------------------------------
const FORM_SELECT = `SELECT f.*, ${whoCols('prt')} FROM special_draft_forms f ${whoJoins('prt', 'f.printed_by')}`;

async function nextFormSeq(year, conn) {
  const rows = await db.query('SELECT COALESCE(MAX(form_seq), 0) + 1 AS n FROM special_draft_forms WHERE form_year = ? FOR UPDATE', [year], conn);
  return rows[0].n;
}

async function insertForm(x, conn) {
  const res = await db.query(
    `INSERT INTO special_draft_forms (form_number, form_year, form_seq, posting_type, draft_count, printed_by, printed_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [x.formNumber, x.year, x.seq, x.postingType, x.count, x.userId || null, x.userId || null], conn);
  return res.insertId;
}

async function findForm(id, conn = null) {
  const rows = await db.query(`${FORM_SELECT} WHERE f.id = ?`, [id], conn);
  return rows[0] || null;
}

async function formRaw(id, conn = null) {
  const rows = await db.query('SELECT * FROM special_draft_forms WHERE id = ?', [id], conn);
  return rows[0] || null;
}

async function listForms(f, { page = 1, pageSize = 25 } = {}) {
  const sql = [];
  const params = [];
  if (f.postingType) { sql.push('f.posting_type = ?'); params.push(f.postingType); }
  if (f.q) { sql.push('f.form_number LIKE ?'); params.push(like(f.q)); }
  const where = sql.length ? `WHERE ${sql.join(' AND ')}` : '';
  const total = (await db.query(`SELECT COUNT(*) AS n FROM special_draft_forms f ${where}`, params))[0].n;
  const items = await db.query(`${FORM_SELECT} ${where} ORDER BY f.printed_at DESC, f.id DESC LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]);
  return { items, total };
}

module.exports = {
  ships, ratingCard, lockRating, lockRatings, ratingsForUpload, listDrafts, findDraft, draftRaw, waitingOfType, openDraftsOf, waitingCounts,
  insertDraft, deleteDraft, markPrinted, setOutcome, nextFormSeq, insertForm, findForm, formRaw, listForms,
};
