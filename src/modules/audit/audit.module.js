'use strict';

/*
 * The audit trail, read side (for System Administration > Audit Trail). Rows are written by
 * src/shared/audit.js inside each service's transaction.
 */
module.exports = {
  key: 'audit',
  label: 'System Administration',
  basePath: '/api/audit',
  routes: './audit.routes',
  order: 910,
  privileges: [
    { screen: 'admin.audit', label: 'Audit Trail', actions: ['view'] },
  ],
};
