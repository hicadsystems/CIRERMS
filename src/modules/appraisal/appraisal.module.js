'use strict';

/*
 * Naval Character Assessment (WP12). Screen ids as in public/js/core/nav.js.
 *   appraisal.grading   Recommendation and Grading: view (the list, an appraisal's record), add (Initiate
 *                       Appraisal), edit (Edit, while the period is open), delete (Cancel Appraisal, with a reason).
 *                       Whoever may view it also sees a rating's appraisals under the record's Advancement tab.
 *   appraisal.report    Report on Appraisal: view (the filters, the grade counts, the list, Print PDF, Export Excel)
 *   appraisal.periods   Appraisal Periods: view, add (Add Period), edit (Edit Period, Close Period)
 */
module.exports = {
  key: 'appraisal',
  label: 'Naval Character Assessment',
  basePath: '/api/appraisal',
  routes: './appraisal.routes',
  order: 170,
  privileges: [
    { screen: 'appraisal.periods', label: 'Appraisal Periods', actions: ['view', 'add', 'edit'] },
    { screen: 'appraisal.grading', label: 'Recommendation and Grading', actions: ['view', 'add', 'edit', 'delete'] },
    { screen: 'appraisal.report', label: 'Report on Appraisal', actions: ['view'] },
  ],
};
