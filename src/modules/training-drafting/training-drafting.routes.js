'use strict';

/*
 * /api/training-drafting. Screens and actions as in training-drafting.module.js.
 *
 *   GET    /options                              courses, institutions, branches, specialisations, rates     any page
 *   GET    /eligible?courseId=&branch_id=&...    how many ratings the course is open to (and match)           process add, review edit
 *   GET    /batches                              ?status=&courseId=&month=&year=&batchNumber=&page=, 25 a page  any page
 *   GET    /batches/:id                          a batch with its ratings                                       any page
 *   POST   /batches                              make a batch with the eligible ratings                         process add
 *   POST   /batches/:id/ratings/filter           Add Ratings / Add by Branch: the eligible ratings that match   process add, review edit
 *   POST   /batches/:id/ratings                  Add Rating: one rating                                         review edit
 *   DELETE /batches/:id/ratings/:serviceNumber   Remove                                                         review edit
 *   PUT    /batches/:id/ratings/:serviceNumber   Attended, and the rating's own dates                           history edit
 *   POST   /batches/:id/confirm                  Confirm Training History (closes the batch)                    history edit
 *   GET    /batches/:id/pdf                      the Training Draft Report                                      reports view
 *   GET    /upload/template                      the Excel template                                             upload view
 *   POST   /upload/review                        read every row, write nothing                                  upload add
 *   POST   /upload/import                        add the rows that are right, in one transaction                upload add
 */
const express = require('express');
const service = require('./training-drafting.service');
const { requireAuth } = require('../../middleware/auth');
const { requirePrivilege, requireAnyPrivilege } = require('../../middleware/access');
const { parseValidatedExcel } = require('../../middleware/upload');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();
router.use(requireAuth);

const ANY_PAGE = requireAnyPrivilege([
  ['training.process', 'view'], ['training.review', 'view'], ['training.history', 'view'], ['training.reports', 'view'],
]);
const ADD_TO_BATCH = requireAnyPrivilege([['training.process', 'add'], ['training.review', 'edit']]);

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const printedBy = (req) => ({ ...req.actor, fullName: req.user && req.user.fullName });
const idOf = (req) => Number.parseInt(req.params.id, 10) || 0;

router.get('/options', requireAnyPrivilege([
  ['training.process', 'view'], ['training.review', 'view'], ['training.history', 'view'], ['training.reports', 'view'], ['training.upload', 'view'],
]), asyncHandler(async (_req, res) => {
  res.json({ data: await service.getOptions() });
}));

router.get('/eligible', ADD_TO_BATCH, asyncHandler(async (req, res) => {
  res.json({ data: await service.eligibleCount(req.query) });
}));

router.get('/batches', ANY_PAGE, asyncHandler(async (req, res) => {
  const r = await service.listBatches(req.query);
  res.json({ data: r.items, meta: r.meta });
}));

router.post('/batches', requirePrivilege('training.process', 'add'), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.createBatch(req.body || {}, req.actor) });
}));

router.get('/batches/:id', ANY_PAGE, asyncHandler(async (req, res) => {
  res.json({ data: await service.getBatch(idOf(req)) });
}));

router.get('/batches/:id/pdf', requirePrivilege('training.reports', 'view'), asyncHandler(async (req, res) => {
  const out = await service.batchPdf(idOf(req), printedBy(req));
  res.setHeader('Content-Type', out.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${out.fileName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(out.buffer);
}));

router.post('/batches/:id/ratings/filter', ADD_TO_BATCH, asyncHandler(async (req, res) => {
  res.json({ data: await service.addRatings(idOf(req), req.body || {}, req.actor) });
}));

router.post('/batches/:id/ratings', requirePrivilege('training.review', 'edit'), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.addRating(idOf(req), req.body || {}, req.actor) });
}));

router.delete('/batches/:id/ratings/:serviceNumber', requirePrivilege('training.review', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.removeRating(idOf(req), req.params.serviceNumber, req.actor) });
}));

router.put('/batches/:id/ratings/:serviceNumber', requirePrivilege('training.history', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.updateRating(idOf(req), req.params.serviceNumber, req.body || {}, req.actor) });
}));

router.post('/batches/:id/confirm', requirePrivilege('training.history', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.confirm(idOf(req), req.body || {}, req.actor) });
}));

router.get('/upload/template', requirePrivilege('training.upload', 'view'), asyncHandler(async (_req, res) => {
  const out = await service.uploadTemplate();
  res.setHeader('Content-Type', XLSX);
  res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(out.buffer);
}));

router.post('/upload/review', requirePrivilege('training.upload', 'add'), parseValidatedExcel, asyncHandler(async (req, res) => {
  res.json({ data: await service.reviewUpload(req.file.buffer) });
}));

router.post('/upload/import', requirePrivilege('training.upload', 'add'), parseValidatedExcel, asyncHandler(async (req, res) => {
  res.json({ data: await service.importUpload(req.file.buffer, req.actor) });
}));

module.exports = router;
