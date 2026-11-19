'use strict';

/*
 * Static Tables: one engine for the 16 tables (tables.config.js). A privilege per table,
 * screen `tables.<slug>` with view, add, edit and delete; Manage Roles groups them under
 * Static Tables.
 */
const { TABLES } = require('./tables.config');

module.exports = {
  key: 'tables',
  label: 'Static Tables',
  basePath: '/api/tables',
  routes: './tables.routes',
  order: 800,
  privileges: TABLES.map((t) => ({
    screen: `tables.${t.slug}`,
    label: t.tab,
    actions: ['view', 'add', 'edit', 'delete'],
  })),
};
