'use strict';

const db = require('../../db');

const escapeLike = (s) => String(s).replace(/[\\%_]/g, (c) => `\\${c}`);

// never the hash
const COLUMNS = `u.id, u.username, u.full_name, u.role_id, r.name AS role_name, r.full_access,
       u.service_number, u.email, u.phone, u.specialisation_id, s.name AS specialisation_name,
       u.is_active, u.must_change_password, u.last_login_at, u.password_changed_at,
       u.created_at, u.updated_at`;
const FROM = `FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN ref_specialisation s ON s.id = u.specialisation_id`;

function whereClause({ q, roleId, active }) {
  const where = [];
  const params = [];
  if (q) {
    const like = escapeLike(q);
    where.push(`(u.username LIKE CONCAT('%', ?, '%') OR u.full_name LIKE CONCAT('%', ?, '%')
                 OR u.service_number LIKE CONCAT('%', ?, '%') OR u.email LIKE CONCAT('%', ?, '%'))`);
    params.push(like, like, like, like);
  }
  if (roleId) { where.push('u.role_id = ?'); params.push(roleId); }
  if (active !== null && active !== undefined) { where.push('u.is_active = ?'); params.push(active ? 1 : 0); }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

async function list(filters, { page, pageSize }, conn = null) {
  const { sql, params } = whereClause(filters);
  const [count] = await db.query(`SELECT COUNT(*) AS total FROM users u ${sql}`, params, conn);
  const items = await db.query(
    `SELECT ${COLUMNS} ${FROM} ${sql} ORDER BY u.full_name, u.username LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
    conn
  );
  return { items, total: Number(count.total) || 0 };
}

async function findById(id, conn = null, { lock = false } = {}) {
  const rows = await db.query(`SELECT ${COLUMNS} ${FROM} WHERE u.id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [id], conn);
  return rows[0] || null;
}

/** One account by user name or official number (exact, either one). */
async function findByLogin(term, conn = null) {
  const rows = await db.query(
    `SELECT ${COLUMNS} ${FROM} WHERE u.username = ? OR u.service_number = ? ORDER BY (u.username = ?) DESC LIMIT 1`,
    [term, term, term],
    conn
  );
  return rows[0] || null;
}

async function findByUsername(username, conn = null) {
  const rows = await db.query('SELECT id FROM users WHERE username = ? LIMIT 1', [username], conn);
  return rows[0] || null;
}

async function findByServiceNumber(serviceNumber, conn = null) {
  const rows = await db.query('SELECT id, username FROM users WHERE service_number = ? LIMIT 1', [serviceNumber], conn);
  return rows[0] || null;
}

async function findRating(serviceNumber, conn = null) {
  const rows = await db.query('SELECT service_number FROM ratings WHERE service_number = ? LIMIT 1', [serviceNumber], conn);
  return rows[0] || null;
}

async function findRole(id, conn = null) {
  const rows = await db.query('SELECT id, name, full_access FROM roles WHERE id = ? LIMIT 1', [id], conn);
  return rows[0] || null;
}

async function findSpecialisation(id, conn = null) {
  const rows = await db.query('SELECT id, name, is_active FROM ref_specialisation WHERE id = ? LIMIT 1', [id], conn);
  return rows[0] || null;
}

async function listRoles(conn = null) {
  return db.query('SELECT id, name, full_access FROM roles ORDER BY full_access DESC, name', [], conn);
}

async function listSpecialisations(conn = null) {
  return db.query('SELECT id, name, is_active FROM ref_specialisation ORDER BY sort_order, name', [], conn);
}

async function insert(f, conn) {
  const res = await db.query(
    `INSERT INTO users (username, password_hash, full_name, role_id, service_number, email, phone,
                        specialisation_id, is_active, must_change_password, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`,
    [f.username, f.passwordHash, f.fullName, f.roleId, f.serviceNumber, f.email, f.phone, f.specialisationId, f.createdBy],
    conn
  );
  return res.insertId;
}

async function update(id, f, conn) {
  await db.query(
    `UPDATE users SET full_name = ?, role_id = ?, service_number = ?, email = ?, phone = ?, specialisation_id = ?
      WHERE id = ?`,
    [f.fullName, f.roleId, f.serviceNumber, f.email, f.phone, f.specialisationId, id],
    conn
  );
}

async function setActive(id, active, conn) {
  await db.query('UPDATE users SET is_active = ? WHERE id = ?', [active ? 1 : 0, id], conn);
}

/** A reset: the new hash, and the person must choose their own at next sign-in. */
async function setOneTimePassword(id, passwordHash, conn) {
  await db.query('UPDATE users SET password_hash = ?, must_change_password = 1, password_changed_at = NULL WHERE id = ?', [passwordHash, id], conn);
}

/** Ends every open or locked session of the account (all of them, or all but `exceptSessionId`). */
async function endSessions(userId, conn, exceptSessionId = null) {
  const res = await db.query(
    `UPDATE user_sessions SET ended_at = NOW()
      WHERE user_id = ? AND ended_at IS NULL${exceptSessionId ? ' AND id <> ?' : ''}`,
    exceptSessionId ? [userId, exceptSessionId] : [userId],
    conn
  );
  return res.affectedRows || 0;
}

/** Active accounts of full-access roles other than `exceptUserId`, locked for the rest of the transaction. */
async function countOtherActiveAdministrators(exceptUserId, conn) {
  const rows = await db.query(
    `SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
      WHERE r.full_access = 1 AND u.is_active = 1 AND u.id <> ? FOR UPDATE`,
    [exceptUserId],
    conn
  );
  return rows.length;
}

module.exports = {
  list,
  findById,
  findByLogin,
  findByUsername,
  findByServiceNumber,
  findRating,
  findRole,
  findSpecialisation,
  listRoles,
  listSpecialisations,
  insert,
  update,
  setActive,
  setOneTimePassword,
  endSessions,
  countOtherActiveAdministrators,
};
