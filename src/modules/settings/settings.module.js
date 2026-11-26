'use strict';

/*
 * Settings (System Administration > Settings): the numbers behind the due rules, shown and changed
 * on one page. Values live in the `settings` table (src/shared/settings); this module only reads
 * and changes them, with the rules in settings.groups.js.
 */
module.exports = {
  key: 'settings',
  label: 'System Administration',
  basePath: '/api/settings',
  routes: './settings.routes',
  order: 920,
  privileges: [
    { screen: 'admin.settings', label: 'Settings', actions: ['view', 'edit'] },
  ],
};
