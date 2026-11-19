'use strict';

/*
 * /api/disciplinary. Screens and actions as in disciplinary.module.js.
 *
 *   GET  /options                  the dropdown rows (offences, sanctions, ships, rates)   any disciplinary screen
 *   GET  /ratings?q=&page=         current ratings found (Initiate Incident)               initiate add
 *   POST /cases                    open a case                                             initiate add
 *   GET  /cases/pending            ?q=&offenceId=&page=   25 a page                        pending view
 *   GET  /cases/pending/pdf        the Pending Cases printout, same filters                pending view
 *   GET  /cases/concluded          ?q=&offenceId=&sanctionId=&from=&to=&page=              concluded view
 *   GET  /cases/:id                a case with its corrections                             see below
 *   GET  /cases/:id/pdf            the Case Sheet                                          see below
 *   POST /cases/:id/conclude       decision date, sanction, decision, authority            pending approve
 *   POST /cases/:id/cancel         a reason                                                pending delete
 *   POST /cases/:id/correct        every field but the rating, and a reason                concluded edit
 *   GET  /report                   the filtered concluded cases and the summary            report view
 *   GET  /report/pdf, /report/excel  the same filters                                      report view
 *   GET  /rating/:serviceNumber/cases  pending and concluded cases (the Discipline tab)    concluded view
 *
 * A single case may be read by whoever may view the list it is on: a pending or cancelled case by
 * Pending Cases (or Concluded Cases, the Discipline tab shows both); a concluded case by Concluded
 * Cases or the Disciplinary Report.
 */
const express = require('express');
const service = require('./disciplinary.service');
const { requireAuth } = require('../../middleware/auth');
const { requirePrivilege, requireAnyPrivilege } = require('../../middleware/access');
const { asyncHandler, forbidden } = require('../../shared/errors');

const router = express.Router();
router.use(requireAuth);

const ANY_VIEW = requireAnyPrivilege([
  ['disciplinary.initiate', 'add'], ['disciplinary.pending', 'view'], ['disciplinary.concluded', 'view'], ['disciplinary.report', 'view'],
]);
const READ_CASE = requireAnyPrivilege([
  ['disciplinary.pending', 'view'], ['disciplinary.concluded', 'view'], ['disciplinary.report', 'view'],
]);

function sendFile(res, out) {
  res.setHeader('Content-Type', out.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${out.fileName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(out.buffer);
}

/** A case is read by whoever may view the list it is on. */
function mayRead(req, c) {
  if (c.status === 'concluded') return req.can('disciplinary.concluded', 'view') || req.can('disciplinary.report', 'view');
  return req.can('disciplinary.pending', 'view') || req.can('disciplinary.concluded', 'view');
}

const idOf = (req) => Number.parseInt(req.params.id, 10) || 0;

router.get('/options', ANY_VIEW, asyncHandler(async (_req, res) => {
  res.json({ data: await service.getOptions() });
}));

router.get('/ratings', requirePrivilege('disciplinary.initiate', 'add'), asyncHandler(async (req, res) => {
  const r = await service.findRatings(req.query);
  res.json({ data: r.items, meta: { ...r.meta, former: r.former } });
}));

router.post('/cases', requirePrivilege('disciplinary.initiate', 'add'), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.openCase(req.body || {}, req.actor) });
}));

// the fixed paths before /cases/:id
router.get('/cases/pending', requirePrivilege('disciplinary.pending', 'view'), asyncHandler(async (req, res) => {
  const r = await service.listPending(req.query);
  res.json({ data: r.items, meta: r.meta });
}));

router.get('/cases/pending/pdf', requirePrivilege('disciplinary.pending', 'view'), asyncHandler(async (req, res) => {
  sendFile(res, await service.pendingPdf(req.query, req.actor));
}));

router.get('/cases/concluded', requirePrivilege('disciplinary.concluded', 'view'), asyncHandler(async (req, res) => {
  const r = await service.listConcluded(req.query);
  res.json({ data: r.items, meta: r.meta });
}));

router.get('/cases/:id', READ_CASE, asyncHandler(async (req, res) => {
  const c = await service.getCase(idOf(req));
  if (!mayRead(req, c)) throw forbidden('You do not have permission to open this case.');
  res.json({ data: c });
}));

router.get('/cases/:id/pdf', READ_CASE, asyncHandler(async (req, res) => {
  const c = await service.getCase(idOf(req));
  if (!mayRead(req, c)) throw forbidden('You do not have permission to open this case.');
  sendFile(res, await service.casePdf(idOf(req), req.actor));
}));

router.post('/cases/:id/conclude', requirePrivilege('disciplinary.pending', 'approve'), asyncHandler(async (req, res) => {
  res.json({ data: await service.conclude(idOf(req), req.body || {}, req.actor) });
}));

router.post('/cases/:id/cancel', requirePrivilege('disciplinary.pending', 'delete'), asyncHandler(async (req, res) => {
  res.json({ data: await service.cancel(idOf(req), req.body || {}, req.actor) });
}));

router.post('/cases/:id/correct', requirePrivilege('disciplinary.concluded', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.correct(idOf(req), req.body || {}, req.actor) });
}));

router.get('/report', requirePrivilege('disciplinary.report', 'view'), asyncHandler(async (req, res) => {
  const r = await service.report(req.query);
  res.json({ data: r.items, summary: r.summary, meta: r.meta });
}));

router.get('/report/pdf', requirePrivilege('disciplinary.report', 'view'), asyncHandler(async (req, res) => {
  sendFile(res, await service.reportPdf(req.query, req.actor));
}));

router.get('/report/excel', requirePrivilege('disciplinary.report', 'view'), asyncHandler(async (req, res) => {
  const out = await service.reportExcel(req.query, req.actor);
  res.setHeader('Content-Type', out.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(out.buffer);
}));

router.get('/rating/:serviceNumber/cases', requirePrivilege('disciplinary.concluded', 'view'), asyncHandler(async (req, res) => {
  const r = await service.casesOfRating(String(req.params.serviceNumber), req.query);
  res.json({ data: r.items, meta: r.meta });
}));

module.exports = router;
