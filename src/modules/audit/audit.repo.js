'use strict';

const db = require('../../db');

const escapeLike = (s) => String(s).replace(/[\\%_]/g, (c) => `\\${c}`);

function whereClause({ from, to, userId, user, action, table, record }) {
  const where = [];
  const params = [];
  if (from) { where.push('a.created_at >= ?'); params.push(`${from} 00:00:00`); }
  if (to) { where.push('a.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(to); }
  if (userId) { where.push('a.user_id = ?'); params.push(userId); }
  if (user) { where.push("a.username LIKE CONCAT('%', ?, '%')"); params.push(escapeLike(user)); }
  if (action) { where.push('a.action = ?'); params.push(action); }
  if (table) { where.push('a.table_name = ?'); params.push(table); }
  if (record) { where.push("a.record_id LIKE CONCAT('%', ?, '%')"); params.push(escapeLike(record)); }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

async function listEntries(filters, { page, pageSize }) {
  const { sql, params } = whereClause(filters);
  const [countRow] = await db.query(`SELECT COUNT(*) AS total FROM audit_trail a ${sql}`, params);
  const items = await db.query(
    `SELECT a.id, a.created_at, a.user_id, a.username, u.full_name, a.action, a.table_name, a.record_id,
            a.ip_address, JSON_LENGTH(a.changes) AS change_count
       FROM audit_trail a
       LEFT JOIN users u ON u.id = a.user_id
       ${sql}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  return { items, total: Number(countRow.total) || 0 };
}

async function findEntry(id) {
  const rows = await db.query(
    `SELECT a.*, u.full_name
       FROM audit_trail a
       LEFT JOIN users u ON u.id = a.user_id
      WHERE a.id = ?
      LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function listTables() {
  const rows = await db.query(
    'SELECT DISTINCT table_name FROM audit_trail WHERE table_name IS NOT NULL ORDER BY table_name'
  );
  return rows.map((r) => r.table_name);
}

async function listUsers() {
  return db.query(
    `SELECT u.id, u.username, u.full_name
       FROM users u
      WHERE EXISTS (SELECT 1 FROM audit_trail a WHERE a.user_id = u.id)
      ORDER BY u.username`
  );
}

module.exports = {
  listEntries,
  findEntry,
  listTables,
  listUsers,
};
