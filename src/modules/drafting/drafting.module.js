'use strict';

/*
 * Drafting: the draft cycle (WP7a). Screen ids as in public/js/core/nav.js.
 *   drafting.manning    Update Manning Requirement: view (list, print), add, edit, delete
 *   drafting.proposal   Print Draft Proposal: view (who is due), add (Create Draft Batch)
 *   drafting.review     Review/Print Draft: view (rows, Draft Form, Excel), add (Add Personnel),
 *                       edit (Edit Posting, Not Recommended), delete (Remove, Clear Draft)
 *   drafting.approval   Draft Approval: view, approve (Approve Department)
 *   drafting.close      Close Draft: view, edit (Close)
 *   drafting.wef        Update WEF: view, edit (Set WEF, Set WEF for Department)
 * Batch/Signal Content, Rate DOD History and Draft Report are WP7b's.
 */
module.exports = {
  key: 'drafting',
  label: 'Drafting',
  basePath: '/api/drafting',
  routes: './drafting.routes',
  order: 150,
  privileges: [
    { screen: 'drafting.manning', label: 'Update Manning Requirement', actions: ['view', 'add', 'edit', 'delete'] },
    { screen: 'drafting.proposal', label: 'Print Draft Proposal', actions: ['view', 'add'] },
    { screen: 'drafting.review', label: 'Review/Print Draft', actions: ['view', 'add', 'edit', 'delete'] },
    { screen: 'drafting.approval', label: 'Draft Approval', actions: ['view', 'approve'] },
    { screen: 'drafting.close', label: 'Close Draft', actions: ['view', 'edit'] },
    { screen: 'drafting.wef', label: 'Update WEF', actions: ['view', 'edit'] },
  ],
};
