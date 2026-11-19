'use strict';

/*
 * Advancement Processing (WP8). Screen ids as in public/js/core/nav.js.
 *   advancement.due        Rates due for Advancement: view (who is due), add (Create Advancement Batch)
 *   advancement.review     Advancement Review: view (rows, Advancement Form, Excel), add (Add Personnel),
 *                          edit (Set New Rate, Not Recommended), delete (Remove, Clear Batch)
 *   advancement.approval   Approval: view, approve (Approve Department)
 *   advancement.close      Close: view, edit (Close)
 *   advancement.board      Board Returns Update: view, edit (Set Date, Set Date for Batch: the new rate applies)
 *   advancement.promoted   Report on Promoted Rates: view (the batches, Batch Summary, a batch's Advancement Report)
 *   advancement.upload     Upload Advanced Rates: view (the template), add (check and import a workbook)
 */
module.exports = {
  key: 'advancement',
  label: 'Advancement Processing',
  basePath: '/api/advancement',
  routes: './advancement.routes',
  order: 170,
  privileges: [
    { screen: 'advancement.due', label: 'Rates due for Advancement', actions: ['view', 'add'] },
    { screen: 'advancement.review', label: 'Advancement Review', actions: ['view', 'add', 'edit', 'delete'] },
    { screen: 'advancement.approval', label: 'Approval', actions: ['view', 'approve'] },
    { screen: 'advancement.close', label: 'Close', actions: ['view', 'edit'] },
    { screen: 'advancement.board', label: 'Board Returns Update', actions: ['view', 'edit'] },
    { screen: 'advancement.promoted', label: 'Report on Promoted Rates', actions: ['view'] },
    { screen: 'advancement.upload', label: 'Upload Advanced Rates', actions: ['view', 'add'] },
  ],
};
