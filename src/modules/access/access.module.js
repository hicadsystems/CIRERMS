'use strict';

/*
 * Roles and privileges, read side: the privilege catalogue and the roles with what each may
 * use (for Manage Roles). Screen ids are System Administration's (WP3 adds its nav lines).
 */
module.exports = {
  key: 'access',
  label: 'System Administration',
  basePath: '/api/access',
  routes: './access.routes',
  order: 900,
  privileges: [
    { screen: 'admin.roles', label: 'Manage Roles', actions: ['view'] },
  ],
};
