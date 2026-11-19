'use strict';

/*
 * Roles and privileges: the privilege catalogue, and the roles with what each may use (Manage
 * Roles: list, add, edit, delete). Screen ids are System Administration's (public/js/core/nav.js).
 */
module.exports = {
  key: 'access',
  label: 'System Administration',
  basePath: '/api/access',
  routes: './access.routes',
  order: 900,
  privileges: [
    { screen: 'admin.roles', label: 'Manage Roles', actions: ['view', 'add', 'edit', 'delete'] },
  ],
};
