'use strict';

/*
 * The batch cycle's SQL (batches, batch_approvals and a flow's rows table), shared by Drafting (DOD) and
 * Advancement (DOA, WP8). The rows table and its target column come from the flow registered in
 * cycle.service.js (checked there against a strict pattern), never from a request.
 */
const db = require('../../db');

const ident = (name) => {
  if (!/^[a-z][a-z0-9_]*$/.test(String(name))) throw new Error(`Bad SQL identifier "${name}".`);
  return name;
};

const LIVE_OPEN = (t) => `${t}.status = 'proposed' AND b.status IN ('open','approved')`;

// who did it: the account's rating name (rate, surname, first name), as src/shared/rating-name writes it
const whoCols = (alias, user) => `${alias}_r.surname AS ${alias}_surname, ${alias}_r.first_name AS ${alias}_first_name,
       ${alias}_r.middle_name AS ${alias}_middle_name, ${alias}_rt.name AS ${alias}_rate_name, ${alias}_u.username AS ${alias}_username`;
const whoJoins = (alias, col) => `LEFT JOIN users ${alias}_u ON ${alias}_u.id = ${col}
       LEFT JOIN ratings ${alias}_r ON ${alias}_r.service_number = ${alias}_u.service_number
       LEFT JOIN ref_rate ${alias}_rt ON ${alias}_rt.id = ${alias}_r.rate_id`;

const BATCH_SELECT = `
  SELECT b.*, br.name AS branch_name, br.code AS branch_code, sp.name AS specialisation_name, sp.code AS specialisation_code,
         rt.name AS rate_name, rt.code AS rate_code,
         ${whoCols('ini')}, ${whoCols('clo')}
    FROM batches b
    LEFT JOIN ref_branch br ON br.id = b.branch_id
    LEFT JOIN ref_specialisation sp ON sp.id = b.specialisation_id
    LEFT JOIN ref_rate rt ON rt.id = b.rate_id
    ${whoJoins('ini', 'b.initiated_by')}
    ${whoJoins('clo', 'b.closed_by')}`;

async function findBatch(id, conn = null) {
  const rows = await db.query(`${BATCH_SELECT} WHERE b.id = ?`, [id], conn);
  return rows[0] || null;
}

async function batchRaw(id, conn = null, lock = false) {
  const rows = await db.query(`SELECT * FROM batches WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id], conn);
  return rows[0] || null;
}

/** The open (or approved) batch of a flow for a code, locked. */
async function openBatchForCode(flow, code, conn) {
  const rows = await db.query(
    "SELECT * FROM batches WHERE flow = ? AND batch_code = ? AND status IN ('open','approved') ORDER BY id DESC LIMIT 1 FOR UPDATE",
    [flow, code], conn);
  return rows[0] || null;
}

/** The next counter for a code (every batch of the code, open or closed), with the code's rows locked. */
async function nextSequence(code, conn) {
  const rows = await db.query('SELECT COALESCE(MAX(sequence), 0) AS n FROM batches WHERE batch_code = ? FOR UPDATE', [code], conn);
  return rows[0].n + 1;
}

async function peekSequence(code, conn = null) {
  const rows = await db.query('SELECT COALESCE(MAX(sequence), 0) AS n FROM batches WHERE batch_code = ?', [code], conn);
  return rows[0].n + 1;
}

async function peekOpenBatch(flow, code, conn = null) {
  const rows = await db.query(
    "SELECT * FROM batches WHERE flow = ? AND batch_code = ? AND status IN ('open','approved') ORDER BY id DESC LIMIT 1",
    [flow, code], conn);
  return rows[0] || null;
}

async function insertBatch(b, conn) {
  const res = await db.query(
    `INSERT INTO batches (flow, batch_number, batch_code, sequence, branch_id, specialisation_id, rate_id, status, initiated_by, initiated_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, NOW(), ?)`,
    [b.flow, b.batchNumber, b.code, b.sequence, b.branchId || null, b.specialisationId || null, b.rateId || null, b.userId || null, b.userId || null], conn);
  return res.insertId;
}

async function setBatchStatus(id, status, conn) {
  await db.query("UPDATE batches SET status = ? WHERE id = ? AND status <> 'closed'", [status, id], conn);
}

/** Live rows of a batch, those without their target, and those without an approval. */
async function batchCounts(flow, id, conn = null) {
  const t = ident(flow.rowsTable);
  const target = ident(flow.target);
  const rows = await db.query(
    `SELECT COUNT(*) AS live, SUM(x.${target} IS NULL) AS missing, SUM(x.approval_id IS NULL) AS unapproved
       FROM ${t} x WHERE x.batch_id = ? AND x.status <> 'not_recommended'`, [id], conn);
  const r = rows[0] || {};
  return { live: Number(r.live || 0), missing: Number(r.missing || 0), unapproved: Number(r.unapproved || 0) };
}

/** The departments (specialisations) of a batch's live rows, with whether each row of it is approved. */
async function batchDepartments(flow, id, conn = null) {
  const t = ident(flow.rowsTable);
  return db.query(
    `SELECT x.specialisation_id AS id, sp.name, COUNT(*) AS n, SUM(x.approval_id IS NULL) AS waiting
       FROM ${t} x LEFT JOIN ref_specialisation sp ON sp.id = x.specialisation_id
      WHERE x.batch_id = ? AND x.status <> 'not_recommended'
      GROUP BY x.specialisation_id, sp.name ORDER BY sp.name`, [id], conn);
}

/** One row per department with live rows in the flow's open batches: totals, missing targets, approval. */
async function departments(flow, { specialisationId = null } = {}, conn = null) {
  const t = ident(flow.rowsTable);
  const target = ident(flow.target);
  const params = [];
  let extra = '';
  if (specialisationId) { extra = ' AND x.specialisation_id = ?'; params.push(specialisationId); }
  return db.query(
    `SELECT x.specialisation_id AS id, sp.name, sp.code, COUNT(*) AS total,
            SUM(x.${target} IS NULL) AS missing, SUM(x.approval_id IS NULL) AS waiting,
            MAX(x.approval_id) AS approval_id
       FROM ${t} x JOIN batches b ON b.id = x.batch_id
       LEFT JOIN ref_specialisation sp ON sp.id = x.specialisation_id
      WHERE ${LIVE_OPEN('x')} AND b.flow = ?${extra}
      GROUP BY x.specialisation_id, sp.name, sp.code
      ORDER BY sp.name`, [flow.key, ...params], conn);
}

/** Counts by rate (in rank order) per department, over the same live rows. */
async function departmentRateCounts(flow, { specialisationId = null } = {}, conn = null) {
  const t = ident(flow.rowsTable);
  const rateCol = ident(flow.rateColumn || 'rate_id');
  const params = [flow.key];
  let extra = '';
  if (specialisationId) { extra = ' AND x.specialisation_id = ?'; params.push(specialisationId); }
  return db.query(
    `SELECT x.specialisation_id AS id, rt.id AS rate_id, rt.code, rt.name, rt.sort_order, COUNT(*) AS n
       FROM ${t} x JOIN batches b ON b.id = x.batch_id
       JOIN ref_rate rt ON rt.id = x.${rateCol}
      WHERE ${LIVE_OPEN('x')} AND b.flow = ?${extra}
      GROUP BY x.specialisation_id, rt.id, rt.code, rt.name, rt.sort_order
      ORDER BY rt.sort_order, rt.name`, params, conn);
}

async function rates(conn = null) {
  return db.query('SELECT id, name, code, sort_order FROM ref_rate ORDER BY sort_order, name', [], conn);
}

const APPROVAL_SELECT = `SELECT a.*, sp.name AS specialisation_name, ${whoCols('apr')}
    FROM batch_approvals a
    LEFT JOIN ref_specialisation sp ON sp.id = a.specialisation_id
    ${whoJoins('apr', 'a.approved_by')}`;

async function findApproval(id, conn = null) {
  const rows = await db.query(`${APPROVAL_SELECT} WHERE a.id = ?`, [id], conn);
  return rows[0] || null;
}

async function approvalRaw(id, conn = null) {
  const rows = await db.query('SELECT * FROM batch_approvals WHERE id = ?', [id], conn);
  return rows[0] || null;
}

/** The live rows of one department in the flow's open batches, locked (approve). */
async function departmentRowsForUpdate(flow, specialisationId, conn) {
  const t = ident(flow.rowsTable);
  return db.query(
    `SELECT x.* FROM ${t} x JOIN batches b ON b.id = x.batch_id
      WHERE ${LIVE_OPEN('x')} AND b.flow = ? AND x.specialisation_id = ? FOR UPDATE`,
    [flow.key, specialisationId], conn);
}

async function insertApproval(a, conn) {
  const res = await db.query(
    `INSERT INTO batch_approvals (flow, specialisation_id, approver_rank, approver_name, appointment, approved_by, approved_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
    [a.flow, a.specialisationId, a.rank, a.name, a.appointment, a.userId || null, a.userId || null], conn);
  return res.insertId;
}

async function rowRaw(flow, id, conn = null, lock = false) {
  const t = ident(flow.rowsTable);
  const rows = await db.query(`SELECT * FROM ${t} WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id], conn);
  return rows[0] || null;
}

async function setRowApproval(flow, id, approvalId, conn) {
  const t = ident(flow.rowsTable);
  await db.query(`UPDATE ${t} SET approval_id = ? WHERE id = ?`, [approvalId, id], conn);
}

/** The live rows of a batch, locked (close). */
async function liveRowsForUpdate(flow, batchId, conn) {
  const t = ident(flow.rowsTable);
  return db.query(`SELECT * FROM ${t} WHERE batch_id = ? AND status <> 'not_recommended' FOR UPDATE`, [batchId], conn);
}

async function setRowStatus(flow, id, status, conn) {
  const t = ident(flow.rowsTable);
  await db.query(`UPDATE ${t} SET status = ? WHERE id = ?`, [status, id], conn);
}

async function batchUsingAuthority(authority, conn = null) {
  const rows = await db.query('SELECT id, batch_number FROM batches WHERE LOWER(authority) = LOWER(?) LIMIT 1', [authority], conn);
  return rows[0] || null;
}

async function closeBatch(id, { authority, closeDate, userId }, conn) {
  await db.query(
    "UPDATE batches SET status = 'closed', authority = ?, close_date = ?, closed_by = ?, closed_at = NOW() WHERE id = ?",
    [authority, closeDate, userId || null, id], conn);
}

/** The ids of the open batches that hold a department's live rows (to work their status out again). */
async function openBatchIdsOfDepartment(flow, specialisationId, conn) {
  const t = ident(flow.rowsTable);
  const rows = await db.query(
    `SELECT DISTINCT b.id FROM ${t} x JOIN batches b ON b.id = x.batch_id
      WHERE ${LIVE_OPEN('x')} AND b.flow = ? AND x.specialisation_id = ?`, [flow.key, specialisationId], conn);
  return rows.map((r) => r.id);
}

module.exports = {
  findBatch, batchRaw, openBatchForCode, nextSequence, peekSequence, peekOpenBatch, insertBatch, setBatchStatus,
  batchCounts, batchDepartments, departments, departmentRateCounts, rates, findApproval, approvalRaw,
  departmentRowsForUpdate, insertApproval, rowRaw, setRowApproval, liveRowsForUpdate, setRowStatus,
  batchUsingAuthority, closeBatch, openBatchIdsOfDepartment, BATCH_SELECT, whoCols, whoJoins,
};
