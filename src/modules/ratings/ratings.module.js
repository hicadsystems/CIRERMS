'use strict';

/*
 * Ratings Management. Screen ids as in public/js/core/nav.js.
 *   ratings.list        the Current and Former lists, their exports and search
 *   ratings.new         New Rating
 *   ratings.edit        the rating's record: view (open, print), add / edit / delete a row on
 *                       its tabs, edit its details and photos, delete the rating
 *   ratings.upload      Batch Upload: view (the page, the template), add (commit the workbook)
 *   ratings.documents   Documents: view (list, preview, download), add (upload), delete
 *   ratings.my-details  View My Details: the signed-in rating's own record, read-only
 */
module.exports = {
  key: 'ratings',
  label: 'Ratings Management',
  basePath: '/api/ratings',
  routes: './ratings.routes',
  privileges: [
    { screen: 'ratings.list', label: 'Current and Former Ratings', actions: ['view'] },
    { screen: 'ratings.new', label: 'New Rating', actions: ['add'] },
    { screen: 'ratings.edit', label: 'Rating Record', actions: ['view', 'add', 'edit', 'delete'] },
    { screen: 'ratings.upload', label: 'Batch Upload', actions: ['view', 'add'] },
    { screen: 'ratings.documents', label: 'Documents', actions: ['view', 'add', 'delete'] },
    { screen: 'ratings.my-details', label: 'View My Details', actions: ['view'] },
  ],
};
