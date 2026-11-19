'use strict';

const db = require('../../db');
const { NAME_COLUMNS, NAME_JOINS } = require('../../shared/rating-name');

const USER_COLUMNS = `u.id, u.username, u.password_hash, u.service_number, u.is_active, u.last_login_at,
       u.role_id, u.must_change_password, r.name AS role_name, r.full_access,
       ${NAME_COLUMNS}`;

async function findByUsername(username, conn = null) {
  const rows = await db.query(
    `SELECT ${USER_COLUMNS}
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ${NAME_JOINS}
      WHERE u.username = ?
      LIMIT 1`,
    [username],
    conn
  );
  return rows[0] || null;
}

async function findById(id, conn = null) {
  const rows = await db.query(
    `SELECT ${USER_COLUMNS}
       FROM users u
       JOIN roles r ON r.id = u.role_id
       ${NAME_JOINS}
      WHERE u.id = ?
      LIMIT 1`,
    [id],
    conn
  );
  return rows[0] || null;
}

/** A new password the person chose: the hash, and no more forced change. */
async function setPassword(id, passwordHash, conn = null) {
  await db.query(
    'UPDATE users SET password_hash = ?, must_change_password = 0, password_changed_at = NOW() WHERE id = ?',
    [passwordHash, id],
    conn
  );
}

/** Ends the user's sessions other than `exceptSessionId`; how many ended. */
async function endOtherSessions(userId, exceptSessionId, conn = null) {
  const res = await db.query(
    'UPDATE user_sessions SET ended_at = NOW() WHERE user_id = ? AND id <> ? AND ended_at IS NULL',
    [userId, exceptSessionId],
    conn
  );
  return res.affectedRows || 0;
}

async function touchLastLogin(id, conn = null) {
  await db.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [id], conn);
}

// ---- sessions ----

async function insertSession({ id, userId, ip, userAgent }, conn = null) {
  await db.query(
    'INSERT INTO user_sessions (id, user_id, ip_address, user_agent) VALUES (?, ?, ?, ?)',
    [id, userId, ip, userAgent],
    conn
  );
}

/** The session with its user and role, and how long it has been idle (seconds, by the database clock). */
async function findSession(sessionId, conn = null) {
  const rows = await db.query(
    `SELECT s.id AS session_id, s.user_id, s.locked_at, s.lock_reason, s.ended_at,
            TIMESTAMPDIFF(SECOND, s.last_seen_at, NOW()) AS idle_seconds,
            ${USER_COLUMNS}
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       JOIN roles r ON r.id = u.role_id
       ${NAME_JOINS}
      WHERE s.id = ?
      LIMIT 1`,
    [sessionId],
    conn
  );
  return rows[0] || null;
}

async function touchSession(sessionId, conn = null) {
  await db.query(
    'UPDATE user_sessions SET last_seen_at = NOW() WHERE id = ? AND ended_at IS NULL AND locked_at IS NULL',
    [sessionId],
    conn
  );
}

/** Locks an open session; false when it was already locked or has ended. */
async function lockSession(sessionId, reason, conn = null) {
  const res = await db.query(
    `UPDATE user_sessions SET locked_at = NOW(), lock_reason = ?
      WHERE id = ? AND locked_at IS NULL AND ended_at IS NULL`,
    [reason, sessionId],
    conn
  );
  return res.affectedRows > 0;
}

async function unlockSession(sessionId, conn = null) {
  const res = await db.query(
    `UPDATE user_sessions SET locked_at = NULL, lock_reason = NULL, last_seen_at = NOW()
      WHERE id = ? AND locked_at IS NOT NULL AND ended_at IS NULL`,
    [sessionId],
    conn
  );
  return res.affectedRows > 0;
}

async function endSession(sessionId, conn = null) {
  const res = await db.query(
    'UPDATE user_sessions SET ended_at = NOW() WHERE id = ? AND ended_at IS NULL',
    [sessionId],
    conn
  );
  return res.affectedRows > 0;
}

// ---- privileges ----

async function listRolePrivileges(roleId, conn = null) {
  return db.query(
    `SELECT p.screen, p.action
       FROM role_privileges rp
       JOIN privileges p ON p.id = rp.privilege_id
      WHERE rp.role_id = ?
      ORDER BY p.sort_order, p.screen, p.action`,
    [roleId],
    conn
  );
}

module.exports = {
  findByUsername,
  findById,
  touchLastLogin,
  setPassword,
  endOtherSessions,
  insertSession,
  findSession,
  touchSession,
  lockSession,
  unlockSession,
  endSession,
  listRolePrivileges,
};
