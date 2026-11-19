'use strict';

/* Settings: all SQL. Every function takes an optional connection (a transaction's). */
const db = require('../../db');

async function all(prefix = '', conn = null) {
  return db.query(
    `SELECT setting_key, value, description, updated_at, updated_by FROM settings
      WHERE setting_key LIKE ? ORDER BY setting_key`,
    [`${String(prefix).replace(/[\\%_]/g, (m) => `\\${m}`)}%`], conn);
}

async function find(key, conn = null, lock = false) {
  const rows = await db.query(`SELECT * FROM settings WHERE setting_key = ?${lock ? ' FOR UPDATE' : ''}`, [key], conn);
  return rows[0] || null;
}

async function update(key, value, userId, conn) {
  await db.query('UPDATE settings SET value = ?, updated_by = ? WHERE setting_key = ?', [value, userId || null, key], conn);
}

module.exports = { all, find, update };
