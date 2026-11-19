'use strict';

const db = require('../../db');

/** Adds a privilege to the catalogue, or refreshes its labels and order. */
async function upsertPrivilege({ screen, action, moduleLabel, screenLabel, sortOrder }, conn = null) {
  await db.query(
    `INSERT INTO privileges (screen, action, module_label, screen_label, sort_order)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE module_label = VALUES(module_label), screen_label = VALUES(screen_label),
                             sort_order = VALUES(sort_order)`,
    [screen, action, moduleLabel, screenLabel, sortOrder],
    conn
  );
}

/** Gives every privilege to every role with full access; the number of grants added. */
async function grantAllToFullAccessRoles(conn = null) {
  const res = await db.query(
    `INSERT IGNORE INTO role_privileges (role_id, privilege_id)
     SELECT r.id, p.id FROM roles r CROSS JOIN privileges p WHERE r.full_access = 1`,
    [],
    conn
  );
  return res.affectedRows || 0;
}

async function listPrivileges(conn = null) {
  return db.query(
    `SELECT id, screen, action, module_label, screen_label, sort_order
       FROM privileges
      ORDER BY sort_order, screen, action`,
    [],
    conn
  );
}

const roleSelect = `r.id, r.name, r.description, r.full_access, r.is_active, r.created_at, r.updated_at,
            (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count`;

async function listRoles(conn = null) {
  return db.query(`SELECT ${roleSelect} FROM roles r ORDER BY r.full_access DESC, r.name`, [], conn);
}

const escapeLike = (s) => String(s).replace(/[\\%_]/g, (c) => `\\${c}`);

/** One page of roles, matching `q` in the name or description. */
async function listRolesPage(q, { page, pageSize }, conn = null) {
  const where = q ? "WHERE r.name LIKE CONCAT('%', ?, '%') OR r.description LIKE CONCAT('%', ?, '%')" : '';
  const params = q ? [escapeLike(q), escapeLike(q)] : [];
  const [count] = await db.query(`SELECT COUNT(*) AS total FROM roles r ${where}`, params, conn);
  const items = await db.query(
    `SELECT ${roleSelect} FROM roles r ${where} ORDER BY r.full_access DESC, r.name LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
    conn
  );
  return { items, total: Number(count.total) || 0 };
}

async function findRole(id, conn = null, { lock = false } = {}) {
  const rows = await db.query(`SELECT ${roleSelect} FROM roles r WHERE r.id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`, [id], conn);
  return rows[0] || null;
}

async function findRoleByName(name, conn = null) {
  const rows = await db.query('SELECT id FROM roles WHERE name = ? LIMIT 1', [name], conn);
  return rows[0] || null;
}

async function insertRole({ name, description, createdBy }, conn) {
  const res = await db.query('INSERT INTO roles (name, description, full_access, created_by) VALUES (?, ?, 0, ?)', [name, description, createdBy], conn);
  return res.insertId;
}

async function updateRole(id, { name, description }, conn) {
  await db.query('UPDATE roles SET name = ?, description = ? WHERE id = ?', [name, description, id], conn);
}

async function deleteRole(id, conn) {
  await db.query('DELETE FROM roles WHERE id = ?', [id], conn);
}

async function listRoleGrants(roleId, conn = null) {
  return db.query(
    `SELECT p.screen, p.action FROM role_privileges rp JOIN privileges p ON p.id = rp.privilege_id
      WHERE rp.role_id = ? ORDER BY p.sort_order`,
    [roleId],
    conn
  );
}

/** Replaces the role's grants with `grants` ([{ screen, action }]); only the differences are written. */
async function setRoleGrants(roleId, grants, createdBy, conn) {
  await db.query(
    `DELETE rp FROM role_privileges rp JOIN privileges p ON p.id = rp.privilege_id
      WHERE rp.role_id = ? AND CONCAT(p.screen, ':', p.action) NOT IN (${grants.length ? grants.map(() => '?').join(',') : "''"})`,
    [roleId, ...grants.map((g) => `${g.screen}:${g.action}`)],
    conn
  );
  for (const g of grants) {
    await db.query(
      `INSERT IGNORE INTO role_privileges (role_id, privilege_id, created_by)
       SELECT ?, p.id, ? FROM privileges p WHERE p.screen = ? AND p.action = ?`,
      [roleId, createdBy, g.screen, g.action],
      conn
    );
  }
}

async function listRolePrivilegeRows(conn = null) {
  return db.query(
    `SELECT rp.role_id, p.screen, p.action
       FROM role_privileges rp
       JOIN privileges p ON p.id = rp.privilege_id
      ORDER BY p.sort_order`,
    [],
    conn
  );
}

module.exports = {
  upsertPrivilege,
  grantAllToFullAccessRoles,
  listPrivileges,
  listRoles,
  listRolesPage,
  findRole,
  findRoleByName,
  insertRole,
  updateRole,
  deleteRole,
  listRoleGrants,
  setRoleGrants,
  listRolePrivilegeRows,
};
