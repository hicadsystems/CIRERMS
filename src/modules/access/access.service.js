'use strict';

const db = require('../../db');
const audit = require('../../shared/audit');
const accessRepo = require('./access.repo');
const { validationError, notFound, conflict } = require('../../shared/errors');

const PAGE_SIZE = 25;

/**
 * Writes the privilege catalogue (from the module manifests) into the privileges table and
 * gives roles with full access (the Administrator) every privilege, new ones included.
 * Runs before the seed files and when the server starts. A privilege no manifest declares any
 * more is left in place (its grants are kept), so removing one is a deliberate migration.
 */
async function syncCatalogue(catalogue) {
  return db.transaction(async (tx) => {
    for (const p of catalogue) {
      await accessRepo.upsertPrivilege(p, tx.connection);
    }
    const granted = await accessRepo.grantAllToFullAccessRoles(tx.connection);
    return { privileges: catalogue.length, granted };
  });
}

/** The catalogue grouped for Manage Roles: modules, their screens, each screen's actions. */
async function getCatalogue() {
  const rows = await accessRepo.listPrivileges();
  const modules = [];
  for (const r of rows) {
    let mod = modules.find((m) => m.label === r.module_label);
    if (!mod) {
      mod = { label: r.module_label, screens: [] };
      modules.push(mod);
    }
    let screen = mod.screens.find((s) => s.screen === r.screen);
    if (!screen) {
      screen = { screen: r.screen, label: r.screen_label, actions: [] };
      mod.screens.push(screen);
    }
    screen.actions.push(r.action);
  }
  return { modules };
}

/** Every role with its user count and its privileges as { screen: [actions] }. */
async function getRoles() {
  const [roles, grants] = await Promise.all([accessRepo.listRoles(), accessRepo.listRolePrivilegeRows()]);
  return roles.map((r) => {
    const privileges = {};
    grants.filter((g) => g.role_id === r.id).forEach((g) => {
      (privileges[g.screen] = privileges[g.screen] || []).push(g.action);
    });
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      fullAccess: !!r.full_access,
      isActive: !!r.is_active,
      userCount: Number(r.user_count) || 0,
      privileges,
    };
  });
}

const toRole = (r, grants) => {
  const privileges = {};
  grants.forEach((g) => { (privileges[g.screen] = privileges[g.screen] || []).push(g.action); });
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    fullAccess: !!r.full_access,
    isActive: !!r.is_active,
    userCount: Number(r.user_count) || 0,
    privileges,
  };
};

/** One page of roles (25 a page, `q` matches name or description) with their privileges. */
async function listRoles(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || PAGE_SIZE));
  const q = String(query.q ?? '').trim().slice(0, 100) || null;
  const [{ items, total }, grants] = await Promise.all([
    accessRepo.listRolesPage(q, { page, pageSize }),
    accessRepo.listRolePrivilegeRows(),
  ]);
  return {
    items: items.map((r) => toRole(r, grants.filter((g) => g.role_id === r.id))),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function getRole(idRaw, conn = null) {
  const row = await accessRepo.findRole(Number.parseInt(idRaw, 10) || 0, conn);
  if (!row) throw notFound('Role not found.');
  return toRole(row, await accessRepo.listRoleGrants(row.id, conn));
}

/**
 * The grants asked for, as [{ screen, action }] checked against the catalogue: every pair must
 * exist, and a screen's other actions need its View (where it has one). At least one is required.
 */
async function parseGrants(input, conn) {
  const catalogue = await accessRepo.listPrivileges(conn);
  const known = new Map();
  catalogue.forEach((p) => {
    if (!known.has(p.screen)) known.set(p.screen, { label: p.screen_label, actions: new Set() });
    known.get(p.screen).actions.add(p.action);
  });
  const errors = {};
  const grants = [];
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  Object.keys(src).forEach((screen) => {
    const actions = [...new Set(Array.isArray(src[screen]) ? src[screen] : [])];
    if (!actions.length) return;
    const entry = known.get(screen);
    if (!entry) { errors.privileges = `Unknown screen "${screen}".`; return; }
    actions.forEach((a) => {
      if (!entry.actions.has(a)) errors.privileges = `${entry.label} has no ${a} action.`;
      else grants.push({ screen, action: a });
    });
    if (entry.actions.has('view') && !actions.includes('view')) {
      errors.privileges = `Give View on ${entry.label} as well as ${actions.join(' and ')}.`;
    }
  });
  if (!grants.length && !errors.privileges) errors.privileges = 'Pick at least one privilege.';
  if (Object.keys(errors).length) throw validationError(errors.privileges, errors);
  return grants;
}

async function parseRole(body, { currentId = null } = {}, conn = null) {
  const errors = {};
  const name = String(body.name ?? '').trim();
  const description = String(body.description ?? '').trim().slice(0, 255) || null;
  if (!name) errors.name = 'Role name is required.';
  else if (name.length > 60) errors.name = 'Use at most 60 characters.';
  else {
    const same = await accessRepo.findRoleByName(name, conn);
    if (same && same.id !== currentId) errors.name = 'A role with this name already exists.';
  }
  let grants = [];
  try {
    grants = await parseGrants(body.privileges, conn);
  } catch (err) {
    if (err.fields) Object.assign(errors, err.fields);
    else throw err;
  }
  if (Object.keys(errors).length) {
    const e = validationError('Check the highlighted fields.', errors);
    if (errors.name && errors.name.includes('already exists')) {
      e.status = 409;
      e.code = 'DUPLICATE_ROLE';
    }
    throw e;
  }
  return { name, description, grants };
}

const grantText = (grants) => {
  const by = {};
  grants.forEach((g) => { (by[g.screen] = by[g.screen] || []).push(g.action); });
  return Object.keys(by).map((s) => `${s}: ${by[s].join(', ')}`).join('; ');
};

/** What an edit changed in the grants, as audit lines: the pairs added and the pairs removed. */
function grantChanges(before, after) {
  const key = (g) => `${g.screen}:${g.action}`;
  const had = new Set(before.map(key));
  const has = new Set(after.map(key));
  const added = after.filter((g) => !had.has(key(g)));
  const removed = before.filter((g) => !has.has(key(g)));
  const out = [];
  if (added.length) out.push({ field: 'privileges added', from: null, to: grantText(added) });
  if (removed.length) out.push({ field: 'privileges removed', from: grantText(removed), to: null });
  return out;
}

async function createRole(body, actor) {
  const id = await db.transaction(async (tx) => {
    const f = await parseRole(body, {}, tx.connection);
    const newId = await accessRepo.insertRole({ name: f.name, description: f.description, createdBy: actor.userId }, tx.connection);
    await accessRepo.setRoleGrants(newId, f.grants, actor.userId, tx.connection);
    const changes = audit.diff(null, { name: f.name, description: f.description });
    changes.push({ field: 'privileges', from: null, to: `${f.grants.length} granted: ${grantText(f.grants)}` });
    await audit.record(tx, actor, { action: 'INSERT', table: 'roles', recordId: f.name, changes });
    return newId;
  });
  return getRole(id);
}

function assertEditable(role) {
  if (role.full_access) {
    throw conflict('The Administrator role has full access and cannot be edited or deleted.', 'ROLE_PROTECTED');
  }
}

async function updateRole(idRaw, body, actor) {
  const id = Number.parseInt(idRaw, 10) || 0;
  await db.transaction(async (tx) => {
    const role = await accessRepo.findRole(id, tx.connection, { lock: true });
    if (!role) throw notFound('Role not found.');
    assertEditable(role);
    const f = await parseRole(body, { currentId: id }, tx.connection);
    const beforeGrants = await accessRepo.listRoleGrants(id, tx.connection);
    await accessRepo.updateRole(id, f, tx.connection);
    await accessRepo.setRoleGrants(id, f.grants, actor.userId, tx.connection);
    const changes = audit.diff({ name: role.name, description: role.description }, { name: f.name, description: f.description });
    changes.push(...grantChanges(beforeGrants, f.grants));
    await audit.record(tx, actor, { action: 'UPDATE', table: 'roles', recordId: role.name, changes });
  });
  return getRole(id);
}

async function deleteRole(idRaw, actor) {
  const id = Number.parseInt(idRaw, 10) || 0;
  await db.transaction(async (tx) => {
    const role = await accessRepo.findRole(id, tx.connection, { lock: true });
    if (!role) throw notFound('Role not found.');
    assertEditable(role);
    if (Number(role.user_count) > 0) {
      throw conflict(
        `${role.name} still has ${role.user_count} ${Number(role.user_count) === 1 ? 'user' : 'users'}. Move them to another role first.`,
        'ROLE_IN_USE'
      );
    }
    const grants = await accessRepo.listRoleGrants(id, tx.connection);
    await accessRepo.deleteRole(id, tx.connection);
    const changes = audit.diff({ name: role.name, description: role.description }, null);
    if (grants.length) changes.push({ field: 'privileges', from: `${grants.length} granted: ${grantText(grants)}`, to: null });
    await audit.record(tx, actor, { action: 'DELETE', table: 'roles', recordId: role.name, changes });
  });
  return { deleted: true };
}

module.exports = {
  syncCatalogue,
  getCatalogue,
  getRoles,
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
};
