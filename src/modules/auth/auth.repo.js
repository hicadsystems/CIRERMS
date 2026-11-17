'use strict';

const db = require('../../db');

async function findByUsername(username) {
  const rows = await db.query(
    `SELECT id, username, password_hash, full_name, role, service_number, is_active, last_login_at
       FROM users
      WHERE username = ?
      LIMIT 1`,
    [username]
  );
  return rows[0] || null;
}

async function findById(id) {
  const rows = await db.query(
    `SELECT id, username, full_name, role, service_number, is_active, last_login_at
       FROM users
      WHERE id = ?
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function touchLastLogin(id) {
  await db.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
}

module.exports = {
  findByUsername,
  findById,
  touchLastLogin,
};
