'use strict';

/* Training Drafting: all SQL. Every function takes an optional connection (a transaction's). */
const db = require('../../db');

const BATCH_SELECT = `
  SELECT b.id, b.batch_number, b.course_id, t.code AS course_code, t.name AS course_name, t.qualification,
         t.weeks, t.branch_id AS course_branch_id, t.specialisation_id AS course_specialisation_id,
         b.year, b.month, b.status, b.institution_id, i.name AS institution_name,
         ci.name AS course_institution_name, t.institution_id AS course_institution_id,
         b.start_date, b.end_date, b.opened_at, uo.username AS opened_by_name, b.closed_at, uc.username AS closed_by_name,
         (SELECT COUNT(*) FROM training_batch_ratings x WHERE x.batch_id = b.id) AS ratings,
         (SELECT COUNT(*) FROM training_batch_ratings x WHERE x.batch_id = b.id AND x.attended = 1) AS attending
    FROM training_batches b
    JOIN ref_training t ON t.id = b.course_id
    LEFT JOIN ref_institution i ON i.id = b.institution_id
    LEFT JOIN ref_institution ci ON ci.id = t.institution_id
    LEFT JOIN users uo ON uo.id = b.opened_by
    LEFT JOIN users uc ON uc.id = b.closed_by`;

const like = (q) => `%${String(q).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

function where(f = {}) {
  const sql = [];
  const params = [];
  if (f.status) { sql.push('b.status = ?'); params.push(f.status); }
  if (f.courseId) { sql.push('b.course_id = ?'); params.push(f.courseId); }
  if (f.month) { sql.push('b.month = ?'); params.push(f.month); }
  if (f.year) { sql.push('b.year = ?'); params.push(f.year); }
  if (f.batchNumber) { sql.push('b.batch_number LIKE ?'); params.push(like(f.batchNumber)); }
  return { sql: sql.length ? `WHERE ${sql.join(' AND ')}` : '', params };
}

async function listBatches(filters, { page = 1, pageSize = 25 } = {}, conn = null) {
  const w = where(filters);
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM training_batches b ${w.sql}`, w.params, conn);
  const items = await db.query(`${BATCH_SELECT} ${w.sql} ORDER BY b.year DESC, b.month DESC, b.id DESC LIMIT ? OFFSET ?`, [...w.params, pageSize, (page - 1) * pageSize], conn);
  return { items, total };
}

async function findBatch(id, conn = null) {
  const rows = await db.query(`${BATCH_SELECT} WHERE b.id = ?`, [id], conn);
  return rows[0] || null;
}

/** The raw row, for the audit trail; locks it inside a transaction. */
async function findBatchRaw(id, conn = null, lock = false) {
  const rows = await db.query(`SELECT * FROM training_batches WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id], conn);
  return rows[0] || null;
}

async function findByPeriod({ courseId, year, month }, conn = null) {
  const rows = await db.query('SELECT id, batch_number, status FROM training_batches WHERE course_id = ? AND year = ? AND month = ?', [courseId, year, month], conn);
  return rows[0] || null;
}

async function insertBatch(b, conn) {
  const res = await db.query(
    `INSERT INTO training_batches (batch_number, course_id, year, month, status, opened_by, opened_at, created_by)
     VALUES (?, ?, ?, ?, 'open', ?, ?, ?)`,
    [b.batchNumber, b.courseId, b.year, b.month, b.userId, b.openedAt || new Date(), b.userId], conn);
  return res.insertId;
}

// ---- the ratings of a batch ---------------------------------------------------

const MEMBER_SELECT = `
  SELECT m.id, m.batch_id, m.service_number, m.attended, m.start_date, m.end_date, m.result, m.training_id,
         r.surname, r.first_name, r.middle_name, r.status AS rating_status, r.date_employed,
         m.rate_id, rt.name AS rate_name,
         (SELECT COALESCE(NULLIF(p.qualification, ''), NULLIF(p.institution, ''))
            FROM rating_training p
           WHERE p.service_number = m.service_number AND (m.training_id IS NULL OR p.id <> m.training_id)
           ORDER BY COALESCE(p.end_date, p.start_date) DESC, p.id DESC LIMIT 1) AS last_course,
         (SELECT p.start_date
            FROM rating_training p
           WHERE p.service_number = m.service_number AND (m.training_id IS NULL OR p.id <> m.training_id)
           ORDER BY COALESCE(p.end_date, p.start_date) DESC, p.id DESC LIMIT 1) AS last_course_start,
         (SELECT p.end_date
            FROM rating_training p
           WHERE p.service_number = m.service_number AND (m.training_id IS NULL OR p.id <> m.training_id)
           ORDER BY COALESCE(p.end_date, p.start_date) DESC, p.id DESC LIMIT 1) AS last_course_end
    FROM training_batch_ratings m
    JOIN ratings r ON r.service_number = m.service_number
    LEFT JOIN ref_rate rt ON rt.id = COALESCE(m.rate_id, r.rate_id)`;

async function members(batchId, conn = null) {
  return db.query(`${MEMBER_SELECT} WHERE m.batch_id = ? ORDER BY r.surname ASC, r.first_name ASC, m.service_number ASC`, [batchId], conn);
}

async function findMember(batchId, serviceNumber, conn = null, lock = false) {
  const rows = await db.query(`SELECT * FROM training_batch_ratings WHERE batch_id = ? AND service_number = ?${lock ? ' FOR UPDATE' : ''}`, [batchId, serviceNumber], conn);
  return rows[0] || null;
}

async function memberView(batchId, serviceNumber, conn = null) {
  const rows = await db.query(`${MEMBER_SELECT} WHERE m.batch_id = ? AND m.service_number = ?`, [batchId, serviceNumber], conn);
  return rows[0] || null;
}

async function insertMember(m, conn) {
  await db.query(
    'INSERT INTO training_batch_ratings (batch_id, service_number, rate_id, attended, added_by) VALUES (?, ?, ?, 1, ?)',
    [m.batchId, m.serviceNumber, m.rateId, m.userId], conn);
}

async function deleteMember(batchId, serviceNumber, conn) {
  await db.query('DELETE FROM training_batch_ratings WHERE batch_id = ? AND service_number = ?', [batchId, serviceNumber], conn);
}

async function updateMember(batchId, serviceNumber, f, conn) {
  await db.query(
    'UPDATE training_batch_ratings SET attended = ?, start_date = ?, end_date = ? WHERE batch_id = ? AND service_number = ?',
    [f.attended ? 1 : 0, f.startDate || null, f.endDate || null, batchId, serviceNumber], conn);
}

async function setMemberResult(batchId, serviceNumber, { result, trainingId }, conn) {
  await db.query(
    'UPDATE training_batch_ratings SET result = ?, training_id = ? WHERE batch_id = ? AND service_number = ?',
    [result, trainingId, batchId, serviceNumber], conn);
}

async function closeBatch(id, { institutionId, startDate, endDate, userId }, conn) {
  await db.query(
    `UPDATE training_batches SET status = 'closed', institution_id = ?, start_date = ?, end_date = ?, closed_by = ?, closed_at = ? WHERE id = ?`,
    [institutionId, startDate, endDate, userId, new Date(), id], conn);
}

// ---- who may attend a course ----------------------------------------------------

async function course(id, conn = null) {
  const rows = await db.query(
    `SELECT t.id, t.code, t.name, t.qualification, t.institution_id, t.weeks, t.branch_id, t.specialisation_id, t.is_active,
            i.name AS institution_name, b.name AS branch_name, s.name AS specialisation_name,
            (SELECT GROUP_CONCAT(l.rate_id ORDER BY l.rate_id) FROM ref_training_rate l WHERE l.training_id = t.id) AS rate_ids,
            (SELECT GROUP_CONCAT(rr.name ORDER BY rr.sort_order, rr.name SEPARATOR ', ') FROM ref_training_rate l JOIN ref_rate rr ON rr.id = l.rate_id WHERE l.training_id = t.id) AS rate_names
       FROM ref_training t LEFT JOIN ref_institution i ON i.id = t.institution_id
       LEFT JOIN ref_branch b ON b.id = t.branch_id LEFT JOIN ref_specialisation s ON s.id = t.specialisation_id
      WHERE t.id = ?`, [id], conn);
  const c = rows[0];
  if (!c) return null;
  return { ...c, rate_ids: c.rate_ids ? String(c.rate_ids).split(',').map(Number) : [], rate_names: c.rate_names || '' };
}

/**
 * WHERE for the ratings a course is open to: current ratings that match the branch and the specialisation
 * the course sets (none set means Any) and its rates (none means every rate), who are not in an open batch
 * for the course (that includes the batch being added to). `f` narrows further by branch,
 * specialisation and rate (the dialogs' filters).
 */
function eligibleWhere(c, f = {}) {
  const sql = ["r.status = 'current'"];
  const params = [];
  if (c.branch_id) { sql.push('r.branch_id = ?'); params.push(c.branch_id); }
  if (c.specialisation_id) { sql.push('r.specialisation_id = ?'); params.push(c.specialisation_id); }
  if (c.rate_ids && c.rate_ids.length) { sql.push(`r.rate_id IN (${c.rate_ids.map(() => '?').join(',')})`); params.push(...c.rate_ids); }
  if (f.branchId) { sql.push('r.branch_id = ?'); params.push(f.branchId); }
  if (f.specialisationId) { sql.push('r.specialisation_id = ?'); params.push(f.specialisationId); }
  if (f.rateId) { sql.push('r.rate_id = ?'); params.push(f.rateId); }
  sql.push(`NOT EXISTS (SELECT 1 FROM training_batch_ratings m JOIN training_batches ob ON ob.id = m.batch_id
                         WHERE m.service_number = r.service_number AND ob.course_id = ? AND ob.status = 'open')`);
  params.push(c.id);
  return { sql: sql.join(' AND '), params };
}

async function countEligible(c, f = {}, conn = null) {
  const w = eligibleWhere(c, f);
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM ratings r WHERE ${w.sql}`, w.params, conn);
  return total;
}

async function eligible(c, f = {}, { limit = 5000 } = {}, conn = null) {
  const w = eligibleWhere(c, f);
  return db.query(
    `SELECT r.service_number, r.rate_id, r.surname, r.first_name, r.middle_name, rt.name AS rate_name
       FROM ratings r LEFT JOIN ref_rate rt ON rt.id = r.rate_id WHERE ${w.sql}
      ORDER BY r.surname ASC, r.first_name ASC, r.service_number ASC LIMIT ?`, [...w.params, limit], conn);
}

/** Adds every eligible rating matching `f` to a batch in one statement; returns how many were added. */
async function addEligible(batchId, c, f, userId, conn) {
  const w = eligibleWhere(c, f);
  const res = await db.query(
    `INSERT INTO training_batch_ratings (batch_id, service_number, rate_id, attended, added_by)
     SELECT ?, r.service_number, r.rate_id, 1, ? FROM ratings r WHERE ${w.sql}`,
    [batchId, userId, ...w.params], conn);
  return res.affectedRows;
}

async function institution(id, conn = null) {
  const rows = await db.query('SELECT id, name, is_active FROM ref_institution WHERE id = ?', [id], conn);
  return rows[0] || null;
}

/** One rating, with what decides whether the course is open to it (locks the row inside a transaction). */
async function ratingFor(serviceNumber, conn = null, lock = false) {
  const rows = await db.query(
    `SELECT r.service_number, r.status, r.rate_id, r.branch_id, r.specialisation_id, r.surname, r.first_name, r.middle_name,
            rt.name AS rate_name, b.name AS branch_name, s.name AS specialisation_name
       FROM ratings r LEFT JOIN ref_rate rt ON rt.id = r.rate_id LEFT JOIN ref_branch b ON b.id = r.branch_id
       LEFT JOIN ref_specialisation s ON s.id = r.specialisation_id
      WHERE r.service_number = ?${lock ? ' FOR UPDATE' : ''}`, [serviceNumber], conn);
  return rows[0] || null;
}

/** The open batch of a course a rating is in, if any. */
async function openBatchOfRating(courseId, serviceNumber, conn = null) {
  const rows = await db.query(
    `SELECT b.id, b.batch_number FROM training_batch_ratings m JOIN training_batches b ON b.id = m.batch_id
      WHERE m.service_number = ? AND b.course_id = ? AND b.status = 'open' LIMIT 1`, [serviceNumber, courseId], conn);
  return rows[0] || null;
}

// ---- the record's Training entry ---------------------------------------------------

async function insertTraining(t, conn) {
  const res = await db.query(
    `INSERT INTO rating_training (service_number, institution, institution_id, training_course_id, qualification, classification, start_date, end_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [t.serviceNumber, t.institution, t.institutionId, t.courseId, t.qualification, t.classification, t.startDate, t.endDate, t.userId], conn);
  return res.insertId;
}

async function findTrainingRaw(id, conn = null) {
  const rows = await db.query('SELECT * FROM rating_training WHERE id = ?', [id], conn);
  return rows[0] || null;
}

/** A matching Training entry already on a rating's record (the upload skips it rather than add it twice). */
async function findTrainingDuplicate({ serviceNumber, courseId, startDate, endDate }, conn = null) {
  const rows = await db.query(
    `SELECT id FROM rating_training WHERE service_number = ? AND training_course_id = ? AND start_date <=> ? AND end_date <=> ? LIMIT 1`,
    [serviceNumber, courseId, startDate || null, endDate || null], conn);
  return rows[0] || null;
}

// ---- the dropdown rows ------------------------------------------------------------------

async function options(conn = null) {
  const [courses, institutions, branches, specialisations, rates] = await Promise.all([
    db.query(
      `SELECT t.id, t.code, t.name, t.qualification, t.institution_id AS institutionId, t.weeks,
              t.branch_id AS branchId, t.specialisation_id AS specialisationId,
              (SELECT GROUP_CONCAT(l.rate_id ORDER BY l.rate_id) FROM ref_training_rate l WHERE l.training_id = t.id) AS rateIds
         FROM ref_training t WHERE t.is_active = 1 ORDER BY t.sort_order ASC, t.name ASC`, [], conn),
    db.query('SELECT id, name FROM ref_institution WHERE is_active = 1 ORDER BY sort_order ASC, name ASC', [], conn),
    db.query('SELECT id, name FROM ref_branch WHERE is_active = 1 ORDER BY sort_order ASC, name ASC', [], conn),
    db.query('SELECT id, name FROM ref_specialisation WHERE is_active = 1 ORDER BY sort_order ASC, name ASC', [], conn),
    db.query('SELECT id, name FROM ref_rate WHERE is_active = 1 ORDER BY sort_order ASC, name ASC', [], conn),
  ]);
  return {
    courses: courses.map((c) => ({ ...c, rateIds: c.rateIds ? String(c.rateIds).split(',').map(Number) : [] })),
    institutions, branches, specialisations, rates,
  };
}

/** Active names for the upload: lower-cased name or code to row. */
async function lookupMaps(conn = null) {
  const [courses, institutions] = await Promise.all([
    db.query('SELECT id, code, name, qualification, institution_id, is_active FROM ref_training', [], conn),
    db.query('SELECT id, code, name, is_active FROM ref_institution', [], conn),
  ]);
  return { courses, institutions };
}

async function ratingsExist(serviceNumbers, conn = null) {
  if (!serviceNumbers.length) return new Map();
  const rows = await db.query(
    `SELECT service_number, status, rate_id, branch_id, specialisation_id, date_employed FROM ratings WHERE service_number IN (${serviceNumbers.map(() => '?').join(',')})`,
    serviceNumbers, conn);
  return new Map(rows.map((r) => [r.service_number.toLowerCase(), r]));
}

module.exports = {
  listBatches, findBatch, findBatchRaw, findByPeriod, insertBatch,
  members, findMember, memberView, insertMember, deleteMember, updateMember, setMemberResult, closeBatch,
  course, institution, countEligible, eligible, addEligible, ratingFor, openBatchOfRating,
  insertTraining, findTrainingRaw, findTrainingDuplicate,
  options, lookupMaps, ratingsExist,
};
