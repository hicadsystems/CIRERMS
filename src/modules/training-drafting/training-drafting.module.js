'use strict';

/*
 * Training Drafting (WP6). Screen ids as in public/js/core/nav.js.
 *   training.process   Process Training Draft: view (the open batches), add (New Training Batch, Add Ratings)
 *   training.review    Training Review: view, edit (Add Rating, Add by Branch, Remove)
 *   training.history   Update Training History: view, edit (Attended, Change Dates, Confirm Training History)
 *   training.reports   Reports: view (the batch list, a batch's ratings, Print PDF)
 *   training.upload    Excel Upload: view (the template), add (Review and Import)
 */
module.exports = {
  key: 'training-drafting',
  label: 'Training Drafting',
  basePath: '/api/training-drafting',
  routes: './training-drafting.routes',
  order: 150,
  privileges: [
    { screen: 'training.process', label: 'Process Training Draft', actions: ['view', 'add'] },
    { screen: 'training.review', label: 'Training Review', actions: ['view', 'edit'] },
    { screen: 'training.history', label: 'Update Training History', actions: ['view', 'edit'] },
    { screen: 'training.reports', label: 'Training Reports', actions: ['view'] },
    { screen: 'training.upload', label: 'Training Excel Upload', actions: ['view', 'add'] },
  ],
};
