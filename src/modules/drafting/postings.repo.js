'use strict';

/* The posting move: all SQL (rating_drafting is the rating's postings; the open one is the current ship). */
const db = require('../../db');

async function rating(serviceNumber, conn = null, lock = false) {
  const rows = await db.query(
    `SELECT r.service_number, r.status, r.rate_id, r.branch_id, r.surname, r.first_name, r.middle_name, rt.name AS rate_name
       FROM ratings r LEFT JOIN ref_rate rt ON rt.id = r.rate_id
      WHERE r.service_number = ?${lock ? ' FOR UPDATE' : ''}`, [serviceNumber], conn);
  return rows[0] || null;
}

async function ship(id, conn = null) {
  const rows = await db.query('SELECT id, name, is_active, command_id FROM ref_ship WHERE id = ?', [id], conn);
  return rows[0] || null;
}

/** The open postings (end date empty), newest first, locked inside a transaction. */
async function openPostings(serviceNumber, conn = null, lock = false) {
  return db.query(
    `SELECT d.*, s.name AS ship_name FROM rating_drafting d LEFT JOIN ref_ship s ON s.id = d.ship_id
      WHERE d.service_number = ? AND d.end_date IS NULL ORDER BY d.id DESC${lock ? ' FOR UPDATE' : ''}`, [serviceNumber], conn);
}

async function postingRaw(id, conn = null) {
  const rows = await db.query('SELECT * FROM rating_drafting WHERE id = ?', [id], conn);
  return rows[0] || null;
}

async function endPosting(id, endDate, conn) {
  await db.query('UPDATE rating_drafting SET end_date = ? WHERE id = ?', [endDate, id], conn);
}

async function insertPosting(p, conn) {
  const res = await db.query(
    `INSERT INTO rating_drafting (service_number, ship_id, rate_id, branch_id, start_date, end_date, authority, command_id, exit_type_id, remarks, created_by)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
    [p.serviceNumber, p.shipId, p.rateId || null, p.branchId || null, p.startDate, p.authority || null, p.commandId || null,
      p.exitTypeId || null, p.remarks || null, p.userId || null], conn);
  return res.insertId;
}

/** The exit type a new posting starts with: the one named Active (none when the Static Tables have no such row). */
async function activeExitTypeId(conn = null) {
  const rows = await db.query("SELECT id FROM ref_exit_type WHERE name = 'Active' ORDER BY id LIMIT 1", [], conn);
  return rows[0] ? rows[0].id : null;
}

async function shipNames(ids, conn = null) {
  if (!ids.length) return new Map();
  const rows = await db.query('SELECT id, name FROM ref_ship WHERE id IN (?)', [ids], conn);
  return new Map(rows.map((r) => [r.id, r.name]));
}

module.exports = { rating, ship, openPostings, postingRaw, endPosting, insertPosting, activeExitTypeId, shipNames };
