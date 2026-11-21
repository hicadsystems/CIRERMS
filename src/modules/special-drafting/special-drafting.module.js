'use strict';

/*
 * Special Drafting (WP11). Screen ids as in public/js/core/nav.js.
 *   special-drafting.proposal   Special Draft Proposal: view (the drafts not yet printed, Draft Letter),
 *                               add (Draft Rating), delete (Remove, before printing)
 *   special-drafting.report     Special Draft Report: view (the posting types, their drafts, Preview Draft Form,
 *                               Printed Forms, Reprint Form), edit (Print and Mark Printed: writes the postings)
 *   special-drafting.upload     Upload Draft: view (the template), add (check and import a workbook)
 */
module.exports = {
  key: 'special-drafting',
  label: 'Special Drafting',
  basePath: '/api/special-drafting',
  routes: './special-drafting.routes',
  order: 160,
  privileges: [
    { screen: 'special-drafting.proposal', label: 'Special Draft Proposal', actions: ['view', 'add', 'delete'] },
    { screen: 'special-drafting.report', label: 'Special Draft Report', actions: ['view', 'edit'] },
    { screen: 'special-drafting.upload', label: 'Upload Draft', actions: ['view', 'add'] },
  ],
};
