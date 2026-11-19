'use strict';

/*
 * Disciplinary Action (WP4). Screen ids as in public/js/core/nav.js.
 *   disciplinary.initiate   Initiate Incident: add (find a current rating, open a case)
 *   disciplinary.pending    Pending Cases: view (list, print), approve (Conclude), delete (Cancel Case)
 *   disciplinary.concluded  Concluded Cases: view (list, and the Discipline tab on a rating's record),
 *                           edit (Correct, with a reason)
 *   disciplinary.report     Disciplinary Report: view (screen, PDF, Excel)
 */
module.exports = {
  key: 'disciplinary',
  label: 'Disciplinary Action',
  basePath: '/api/disciplinary',
  routes: './disciplinary.routes',
  order: 200,
  privileges: [
    { screen: 'disciplinary.initiate', label: 'Initiate Incident', actions: ['add'] },
    { screen: 'disciplinary.pending', label: 'Pending Cases', actions: ['view', 'approve', 'delete'] },
    { screen: 'disciplinary.concluded', label: 'Concluded Cases', actions: ['view', 'edit'] },
    { screen: 'disciplinary.report', label: 'Disciplinary Report', actions: ['view'] },
  ],
};
