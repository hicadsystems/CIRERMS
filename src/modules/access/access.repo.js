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

async function listRoles(conn = null) {
  return db.query(
    `SELECT r.id, r.name, r.description, r.full_access, r.is_active, r.created_at, r.updated_at,
            (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count
       FROM roles r
      ORDER BY r.full_access DESC, r.name`,
    [],
    conn
  );
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
  listRolePrivilegeRows,
};
