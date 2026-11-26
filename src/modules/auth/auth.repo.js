'use strict';

const db = require('../../db');
const { NAME_COLUMNS, NAME_JOINS } = require('../../shared/rating-name');

const USER_COLUMNS = `u.id, u.username, u.password_hash, u.service_number, u.is_active, u.last_login_at,
       u.role_id, u.must_change_password, u.specialisation_id, r.name AS role_name, r.full_access,
       rg.passport_photo_path AS passport_photo_path, ${NAME_COLUMNS}`;

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

/** Ends every open session of the user (a reset by e-mailed code); how many ended. */
async function endAllSessions(userId, conn = null) {
  const res = await db.query(
    'UPDATE user_sessions SET ended_at = NOW() WHERE user_id = ? AND ended_at IS NULL',
    [userId],
    conn
  );
  return res.affectedRows || 0;
}

async function touchLastLogin(id, conn = null) {
  await db.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [id], conn);
}

// ---- Forgot Password: the e-mailed codes (password_reset_codes) ----

/** The account for a reset: its id, user name, e-mail and whether it is active. */
async function findForReset(username, conn = null) {
  const rows = await db.query(
    'SELECT id, username, email, is_active FROM users WHERE username = ? LIMIT 1',
    [username],
    conn
  );
  return rows[0] || null;
}

/** Locks the account's row for the rest of the transaction, so two requests for one account queue. */
async function lockUser(userId, conn) {
  await db.query('SELECT id FROM users WHERE id = ? FOR UPDATE', [userId], conn);
}

/** Codes made for the account in the last hour (replaced and dead ones included). */
async function countRecentCodes(userId, conn) {
  const rows = await db.query(
    'SELECT COUNT(*) AS n FROM password_reset_codes WHERE user_id = ? AND created_at > NOW() - INTERVAL 1 HOUR',
    [userId],
    conn
  );
  return Number(rows[0].n);
}

/** A new code replaces every earlier one: their hashes are cleared (the rows stay for the hourly count). */
async function replaceCodes(userId, codeHash, minutes, conn) {
  await db.query('UPDATE password_reset_codes SET code_hash = NULL WHERE user_id = ? AND code_hash IS NOT NULL', [userId], conn);
  await db.query(
    'INSERT INTO password_reset_codes (user_id, code_hash, expires_at) VALUES (?, ?, NOW() + INTERVAL ? MINUTE)',
    [userId, codeHash, minutes],
    conn
  );
}

/** Rows older than an hour no longer count for anything. */
async function pruneCodes(conn) {
  await db.query('DELETE FROM password_reset_codes WHERE created_at < NOW() - INTERVAL 1 HOUR', [], conn);
}

/** The account's live code (hash still set), locked; expired is true once its time is up. */
async function findLiveCode(userId, conn) {
  const rows = await db.query(
    `SELECT id, code_hash, wrong_tries, expires_at <= NOW() AS expired
       FROM password_reset_codes
      WHERE user_id = ? AND code_hash IS NOT NULL
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE`,
    [userId],
    conn
  );
  return rows[0] || null;
}

/** One wrong try; the code is dead (hash cleared) at `maxTries`. */
async function countWrongTry(codeId, maxTries, conn) {
  await db.query(
    `UPDATE password_reset_codes
        SET wrong_tries = wrong_tries + 1,
            code_hash = IF(wrong_tries + 1 >= ?, NULL, code_hash)
      WHERE id = ?`,
    [maxTries, codeId],
    conn
  );
}

async function killCode(codeId, conn) {
  await db.query('UPDATE password_reset_codes SET code_hash = NULL WHERE id = ?', [codeId], conn);
}

async function deleteCode(codeId, conn) {
  await db.query('DELETE FROM password_reset_codes WHERE id = ?', [codeId], conn);
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
  endAllSessions,
  findForReset,
  lockUser,
  countRecentCodes,
  replaceCodes,
  pruneCodes,
  findLiveCode,
  countWrongTry,
  killCode,
  deleteCode,
  insertSession,
  findSession,
  touchSession,
  lockSession,
  unlockSession,
  endSession,
  listRolePrivileges,
};
