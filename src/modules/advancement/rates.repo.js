'use strict';

/* The rate change's SQL: the rating, its Advancement lines (rating_advancement) and its rate. */
const db = require('../../db');
const { RATE_SINCE } = require('./advancement.repo');

async function rating(serviceNumber, conn = null, lock = false) {
  const rows = await db.query(
    `SELECT r.service_number, r.status, r.surname, r.first_name, r.middle_name, r.rate_id, rt.code AS rate_code, rt.name AS rate_name,
            ${RATE_SINCE('r')} AS rate_since
       FROM ratings r LEFT JOIN ref_rate rt ON rt.id = r.rate_id WHERE r.service_number = ?${lock ? ' FOR UPDATE' : ''}`, [serviceNumber], conn);
  return rows[0] || null;
}

async function ratingRaw(serviceNumber, conn = null) {
  const rows = await db.query('SELECT * FROM ratings WHERE service_number = ?', [serviceNumber], conn);
  return rows[0] || null;
}

async function rate(id, conn = null) {
  const rows = await db.query('SELECT id, name, code, sort_order, is_active FROM ref_rate WHERE id = ?', [id], conn);
  return rows[0] || null;
}

async function rates(conn = null) {
  return db.query('SELECT id, name, code, sort_order FROM ref_rate ORDER BY sort_order, id', [], conn);
}

/** The rating's Advancement lines with no end date (normally one: the current rate). */
async function openLines(serviceNumber, conn = null, lock = false) {
  return db.query(`SELECT * FROM rating_advancement WHERE service_number = ? AND end_date IS NULL ORDER BY start_date${lock ? ' FOR UPDATE' : ''}`, [serviceNumber], conn);
}

async function lineRaw(id, conn = null) {
  const rows = await db.query('SELECT * FROM rating_advancement WHERE id = ?', [id], conn);
  return rows[0] || null;
}

async function endLine(id, endDate, conn) {
  await db.query('UPDATE rating_advancement SET end_date = ? WHERE id = ?', [endDate, id], conn);
}

async function insertLine(l, conn) {
  const res = await db.query(
    'INSERT INTO rating_advancement (service_number, start_date, end_date, rate_id, decoration, authority, created_by) VALUES (?, ?, NULL, ?, ?, ?, ?)',
    [l.serviceNumber, l.startDate, l.rateId, l.decoration || null, l.authority || null, l.userId || null], conn);
  return res.insertId;
}

async function setRate(serviceNumber, rateId, userId, conn) {
  await db.query('UPDATE ratings SET rate_id = ? WHERE service_number = ?', [rateId, serviceNumber], conn);
}

module.exports = { rating, ratingRaw, rate, rates, openLines, lineRaw, endLine, insertLine, setRate };
