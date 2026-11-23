'use strict';

/*
 * Reports (WP9): six read-only pages. Screen ids as in public/js/core/nav.js; each needs view only.
 *   reports.ship-history        Ship History Report: a ship and a period, the ratings posted to it (workbook)
 *   reports.all-personnel       All Personnel: the Ratings Report with its filters (screen, PDF, workbook)
 *   reports.disposition         Disposition Report: where the current ratings serve, by ship or unit and rate
 *   reports.nominal-roll        Nominal Roll: the ratings serving on a ship or unit, or on every ship of a command
 *   reports.manning-state       Manning State: every ship's manning requirement against who is aboard
 *   reports.retirement-forecast Retirement Forecast: who becomes due for discharge in the next 6, 12 or 24 months
 */
module.exports = {
  key: 'reports',
  label: 'Reports',
  basePath: '/api/reports',
  routes: './reports.routes',
  order: 160,
  privileges: [
    { screen: 'reports.ship-history', label: 'Ship History Report', actions: ['view'] },
    { screen: 'reports.all-personnel', label: 'All Personnel', actions: ['view'] },
    { screen: 'reports.disposition', label: 'Disposition Report', actions: ['view'] },
    { screen: 'reports.nominal-roll', label: 'Nominal Roll', actions: ['view'] },
    { screen: 'reports.manning-state', label: 'Manning State', actions: ['view'] },
    { screen: 'reports.retirement-forecast', label: 'Retirement Forecast', actions: ['view'] },
  ],
};
