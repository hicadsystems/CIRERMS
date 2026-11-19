'use strict';

const db = require('../../db');
const accessRepo = require('./access.repo');

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

module.exports = {
  syncCatalogue,
  getCatalogue,
  getRoles,
};
