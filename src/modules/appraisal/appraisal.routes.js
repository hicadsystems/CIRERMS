'use strict';

/*
 * /api/appraisal. Screens and actions as in appraisal.module.js.
 *
 *   GET    /options                         grades, periods, ships, rates, branches, today        any appraisal screen
 *   GET    /periods?status&page             the periods (25 a page) with the counts               periods view
 *   GET    /periods/:id                     one period and, while open, the current ratings without an appraisal   periods view
 *   POST   /periods                         Add Period                                             periods add
 *   PUT    /periods/:id                     Edit Period (while open)                               periods edit
 *   POST   /periods/:id/close               Close Period (final)                                   periods edit
 *   GET    /appraisals?...&page             the list (25 a page): q, serviceNumber, periodId, shipId, rateId, gradeId   grading view
 *   GET    /appraisals/:id                  one appraisal with its edits                           grading or report view
 *   POST   /appraisals                      Initiate Appraisal                                     grading add
 *   PUT    /appraisals/:id                  Edit (while the period is open)                        grading edit
 *   POST   /appraisals/:id/cancel           Cancel Appraisal { reason } (while the period is open) grading delete
 *   GET    /rating/:serviceNumber           a rating's rate, branch and ship                       grading add
 *   GET    /rating/:serviceNumber/appraisals  a rating's appraisals (the record's Advancement tab)   grading view
 *   GET    /report?...&page                 the figures, grade counts and list: periodId, shipId, rateId, branchId, gradeId   report view
 *   GET    /report/pdf   /report/excel      Report on Appraisal, from the same filters             report view
 */
const express = require('express');
const service = require('./appraisal.service');
const docs = require('./appraisal.documents');
const { requireAuth } = require('../../middleware/auth');
const { requirePrivilege, requireAnyPrivilege } = require('../../middleware/access');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();
router.use(requireAuth);

const ANY = requireAnyPrivilege([['appraisal.grading', 'view'], ['appraisal.report', 'view'], ['appraisal.periods', 'view']]);
const GRADING_OR_REPORT = requireAnyPrivilege([['appraisal.grading', 'view'], ['appraisal.report', 'view']]);

const id = (v) => Number.parseInt(v, 10) || 0;
const who = (req) => (req.user && (req.user.fullName || req.user.username)) || '';

function send(res, { buffer, fileName, mimeType, attachment = false }) {
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `${attachment ? 'attachment' : 'inline'}; filename="${fileName.replace(/"/g, '')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(buffer);
}

router.get('/options', ANY, asyncHandler(async (req, res) => {
  res.json({ data: await service.options() });
}));

// ---- Appraisal Periods ----
router.get('/periods', requirePrivilege('appraisal.periods', 'view'), asyncHandler(async (req, res) => {
  const r = await service.listPeriods(req.query);
  res.json({ data: r.items, summary: r.summary, meta: r.meta });
}));
router.get('/periods/:id', requirePrivilege('appraisal.periods', 'view'), asyncHandler(async (req, res) => {
  res.json({ data: await service.getPeriod(id(req.params.id)) });
}));
router.post('/periods', requirePrivilege('appraisal.periods', 'add'), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.createPeriod(req.body || {}, req.actor) });
}));
router.put('/periods/:id', requirePrivilege('appraisal.periods', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.updatePeriod(id(req.params.id), req.body || {}, req.actor) });
}));
router.post('/periods/:id/close', requirePrivilege('appraisal.periods', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.closePeriod(id(req.params.id), req.actor) });
}));

// ---- Recommendation and Grading ----
router.get('/appraisals', requirePrivilege('appraisal.grading', 'view'), asyncHandler(async (req, res) => {
  const r = await service.listAppraisals(req.query);
  res.json({ data: r.items, summary: r.summary, meta: r.meta });
}));
router.get('/appraisals/:id', GRADING_OR_REPORT, asyncHandler(async (req, res) => {
  res.json({ data: await service.getAppraisal(id(req.params.id)) });
}));
router.post('/appraisals', requirePrivilege('appraisal.grading', 'add'), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.createAppraisal(req.body || {}, req.actor) });
}));
router.put('/appraisals/:id', requirePrivilege('appraisal.grading', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.updateAppraisal(id(req.params.id), req.body || {}, req.actor) });
}));
router.post('/appraisals/:id/cancel', requirePrivilege('appraisal.grading', 'delete'), asyncHandler(async (req, res) => {
  res.json({ data: await service.cancelAppraisal(id(req.params.id), req.body || {}, req.actor) });
}));
router.get('/rating/:serviceNumber', requirePrivilege('appraisal.grading', 'add'), asyncHandler(async (req, res) => {
  res.json({ data: await service.ratingDetails(req.params.serviceNumber) });
}));
router.get('/rating/:serviceNumber/appraisals', requirePrivilege('appraisal.grading', 'view'), asyncHandler(async (req, res) => {
  res.json({ data: await service.ratingAppraisals(req.params.serviceNumber) });
}));

// ---- Report on Appraisal ----
router.get('/report', requirePrivilege('appraisal.report', 'view'), asyncHandler(async (req, res) => {
  const r = await service.report(req.query);
  res.json({ data: r.items, summary: r.summary, gradeCounts: r.gradeCounts, meta: r.meta });
}));
router.get('/report/pdf', requirePrivilege('appraisal.report', 'view'), asyncHandler(async (req, res) => {
  const r = await service.reportAll(req.query);
  send(res, { buffer: await docs.reportPdf(r, who(req)), fileName: 'Report on Appraisal.pdf', mimeType: 'application/pdf' });
}));
router.get('/report/excel', requirePrivilege('appraisal.report', 'view'), asyncHandler(async (req, res) => {
  const r = await service.reportAll(req.query);
  const file = await docs.reportExcel(r, who(req));
  send(res, { ...file, attachment: true });
}));

module.exports = router;
