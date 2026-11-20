'use strict';

module.exports = {
  key: 'discharge',
  label: 'Discharge Administration',
  basePath: '/api/discharge',
  routes: './discharge.routes',
  order: 210,
  privileges: [
    { screen: 'discharge.process', label: 'Process Discharge', actions: ['view', 'edit', 'add', 'delete'] },
    { screen: 'discharge.service', label: 'Print Service Details', actions: ['view'] },
    { screen: 'discharge.forms', label: 'Verification Forms', actions: ['view'] },
    { screen: 'discharge.report', label: 'Discharge Report', actions: ['view'] },
    { screen: 'discharge.upload', label: 'Upload Discharge', actions: ['view', 'add'] },
  ],
};
