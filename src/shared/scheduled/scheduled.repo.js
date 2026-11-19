'use strict';

/* Scheduled changes: all SQL. Every function takes an optional connection (a transaction's). */
const db = require('../../db');

async function insert(c, conn) {
  const res = await db.query(
    `INSERT INTO scheduled_changes (kind, service_number, effective_date, payload, status, source_table, source_id, scheduled_by, scheduled_at, created_by)
     VALUES (?, ?, ?, ?, 'scheduled', ?, ?, ?, NOW(), ?)`,
    [c.kind, c.serviceNumber, c.effectiveDate, JSON.stringify(c.payload || {}), c.sourceTable || null, c.sourceId || null, c.userId || null, c.userId || null], conn);
  return res.insertId;
}

const parse = (row) => (row ? { ...row, payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {} } : null);

async function find(id, conn = null, lock = false) {
  const rows = await db.query(`SELECT * FROM scheduled_changes WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id], conn);
  return parse(rows[0]);
}

/** The ids of the changes due on or before `today`, oldest first. */
async function dueIds(today, limit = 500, conn = null) {
  const rows = await db.query(
    `SELECT id FROM scheduled_changes WHERE status = 'scheduled' AND effective_date <= ?
      ORDER BY effective_date ASC, id ASC LIMIT ?`, [today, limit], conn);
  return rows.map((r) => r.id);
}

async function forRating(serviceNumber, kind = null, conn = null) {
  const rows = await db.query(
    `SELECT * FROM scheduled_changes WHERE service_number = ? AND status = 'scheduled'${kind ? ' AND kind = ?' : ''}
      ORDER BY effective_date ASC, id ASC`, kind ? [serviceNumber, kind] : [serviceNumber], conn);
  return rows.map(parse);
}

async function finish(id, status, outcome, conn) {
  await db.query(
    "UPDATE scheduled_changes SET status = ?, outcome = ?, applied_at = IF(? = 'applied', NOW(), applied_at) WHERE id = ?",
    [status, outcome ? String(outcome).slice(0, 255) : null, status, id], conn);
}

module.exports = { insert, find, dueIds, forRating, finish, raw: find };
