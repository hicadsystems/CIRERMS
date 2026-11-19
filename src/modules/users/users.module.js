'use strict';

/*
 * Manage Users and Manage Password (System Administration): login accounts, their one-time
 * passwords, deactivation and the administrator's password reset. A password reset is the
 * edit action on Manage Password; the Reset button in an account's dialog needs it too.
 */
module.exports = {
  key: 'users',
  label: 'System Administration',
  basePath: '/api/users',
  routes: './users.routes',
  order: 905,
  privileges: [
    { screen: 'admin.users', label: 'Manage Users', actions: ['view', 'add', 'edit'] },
    { screen: 'admin.password', label: 'Manage Password', actions: ['view', 'edit'] },
  ],
};
