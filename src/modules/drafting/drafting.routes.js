'use strict';

/*
 * /api/drafting. Screens and actions as in drafting.module.js. A user tied to a specialisation (their
 * department) is held to it by the service.
 *
 *   GET    /options                                ships, rates, branches, specialisations, ranks, requests,
 *                                                  the user's department, the due rule      any drafting screen
 *   GET    /manning?shipId&rateId&specialisationId&page       manning list                manning view
 *   POST   /manning  PUT /manning/:id  DELETE /manning/:id    add, edit, delete            manning add / edit / delete
 *   GET    /manning/pdf?shipId                     Manning Requirement Report                manning view
 *   GET    /due?branchId&specialisationId&rateId&page          who is due (reads only)     proposal view
 *   GET    /batches/preview?branchId&...           what Create Draft Batch would do          proposal add
 *   POST   /batches                                make (or add to) the batch               proposal add
 *   GET    /batches?stage=open|wef                 the open batches (with readiness), or the batches waiting for a WEF
 *                                                                                           review, close or wef view
 *   GET    /batches/:id   /batches/:id/rows?page&specialisationId&q                          review, close or wef view
 *   GET    /batches/:id/pdf   /batches/:id/excel   the Draft Form, the workbook              review view
 *   POST   /batches/:id/rows                       Add Personnel                            review add
 *   PUT    /batches/:id/rows/:rowId                Edit Posting                             review edit
 *   POST   /batches/:id/rows/:rowId/not-recommended                                         review edit
 *   DELETE /batches/:id/rows/:rowId   DELETE /batches/:id/rows (Clear Draft)                review delete
 *   GET    /approvals   /approvals/:specialisationId/rows?page                              approval view
 *   GET    /approvals/excel?specialisationId       the open batches' ratings by department  approval or close view
 *   POST   /approvals/:specialisationId           Approve Department                       approval approve
 *   POST   /batches/:id/close                      Close                                    close edit
 *   POST   /batches/:id/rows/:rowId/wef   POST /batches/:id/wef (Set WEF for Department)    wef edit
 *   GET    /rating/:serviceNumber/scheduled        the moves still to come (the record's Drafting tab)
 *                                                  ratings.edit view, or the rating's own record
 */
const express = require('express');
const service = require('./drafting.service');
const docs = require('./drafting.documents');
const { requireAuth } = require('../../middleware/auth');
const { requirePrivilege, requireAnyPrivilege } = require('../../middleware/access');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();
router.use(requireAuth);

const ANY = requireAnyPrivilege([
  ['drafting.manning', 'view'], ['drafting.proposal', 'view'], ['drafting.review', 'view'],
  ['drafting.approval', 'view'], ['drafting.close', 'view'], ['drafting.wef', 'view'],
]);
const BATCH_VIEW = requireAnyPrivilege([['drafting.review', 'view'], ['drafting.close', 'view'], ['drafting.wef', 'view']]);
const ownRecord = (req) => req.can('ratings.my-details', 'view')
  && !!req.user.serviceNumber
  && String(req.params.serviceNumber || '').trim().toUpperCase() === String(req.user.serviceNumber).toUpperCase();

const id = (v) => Number.parseInt(v, 10) || 0;
const who = (req) => (req.user && (req.user.fullName || req.user.username)) || '';

function send(res, { buffer, fileName, mimeType, attachment = false }) {
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `${attachment ? 'attachment' : 'inline'}; filename="${fileName.replace(/"/g, '')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(buffer);
}
const PDF = 'application/pdf';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

router.get('/options', ANY, asyncHandler(async (req, res) => {
  res.json({ data: await service.options(req.user) });
}));

// ---- manning ----
router.get('/manning', requirePrivilege('drafting.manning', 'view'), asyncHandler(async (req, res) => {
  const r = await service.listManning(req.query);
  res.json({ data: r.items, summary: r.summary, meta: r.meta });
}));
router.get('/manning/pdf', requirePrivilege('drafting.manning', 'view'), asyncHandler(async (req, res) => {
  const p = await service.manningForPrint(req.query);
  send(res, { buffer: await docs.manningPdf({ ...p, generatedBy: who(req) }), fileName: 'Manning Requirement.pdf', mimeType: PDF });
}));
router.post('/manning', requirePrivilege('drafting.manning', 'add'), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.addManning(req.body || {}, req.actor) });
}));
router.put('/manning/:id', requirePrivilege('drafting.manning', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.editManning(id(req.params.id), req.body || {}, req.actor) });
}));
router.delete('/manning/:id', requirePrivilege('drafting.manning', 'delete'), asyncHandler(async (req, res) => {
  res.json({ data: await service.deleteManning(id(req.params.id), req.actor) });
}));

// ---- proposal ----
router.get('/due', requirePrivilege('drafting.proposal', 'view'), asyncHandler(async (req, res) => {
  const r = await service.listDue(req.query, req.user);
  res.json({ data: r.items, summary: r.summary, meta: r.meta });
}));
router.get('/batches/preview', requirePrivilege('drafting.proposal', 'add'), asyncHandler(async (req, res) => {
  res.json({ data: await service.previewBatch(req.query, req.user) });
}));
router.post('/batches', requirePrivilege('drafting.proposal', 'add'), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.createBatch(req.body || {}, req.user, req.actor) });
}));

// ---- batches ----
router.get('/batches', BATCH_VIEW, asyncHandler(async (req, res) => {
  res.json({ data: (await service.listBatches(req.query, req.user)).items });
}));
router.get('/batches/:id', BATCH_VIEW, asyncHandler(async (req, res) => {
  res.json({ data: await service.getBatch(id(req.params.id), req.user) });
}));
router.get('/batches/:id/rows', BATCH_VIEW, asyncHandler(async (req, res) => {
  const r = await service.listRows(id(req.params.id), req.query, req.user);
  res.json({ data: r.items, meta: r.meta });
}));
router.get('/batches/:id/pdf', requirePrivilege('drafting.review', 'view'), asyncHandler(async (req, res) => {
  const p = await service.batchForPrint(id(req.params.id), req.user);
  send(res, { buffer: await docs.draftFormPdf({ ...p, generatedBy: who(req) }), fileName: `Draft ${p.b.batchNumber}.pdf`, mimeType: PDF });
}));
router.get('/batches/:id/excel', requirePrivilege('drafting.review', 'view'), asyncHandler(async (req, res) => {
  const p = await service.batchForPrint(id(req.params.id), req.user);
  send(res, { buffer: await docs.batchWorkbook({ ...p, generatedBy: who(req) }), fileName: `Draft ${p.b.batchNumber}.xlsx`, mimeType: XLSX, attachment: true });
}));
router.post('/batches/:id/rows', requirePrivilege('drafting.review', 'add'), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.addPersonnel(id(req.params.id), req.body || {}, req.user, req.actor) });
}));
router.put('/batches/:id/rows/:rowId', requirePrivilege('drafting.review', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.editPosting(id(req.params.id), id(req.params.rowId), req.body || {}, req.user, req.actor) });
}));
router.post('/batches/:id/rows/:rowId/not-recommended', requirePrivilege('drafting.review', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.notRecommend(id(req.params.id), id(req.params.rowId), req.body || {}, req.user, req.actor) });
}));
router.delete('/batches/:id/rows/:rowId', requirePrivilege('drafting.review', 'delete'), asyncHandler(async (req, res) => {
  res.json({ data: await service.removeRow(id(req.params.id), id(req.params.rowId), req.user, req.actor) });
}));
router.delete('/batches/:id/rows', requirePrivilege('drafting.review', 'delete'), asyncHandler(async (req, res) => {
  res.json({ data: await service.clearBatch(id(req.params.id), req.user, req.actor) });
}));

// ---- approval ----
router.get('/approvals', requirePrivilege('drafting.approval', 'view'), asyncHandler(async (req, res) => {
  const r = await service.approvals(req.user);
  res.json({ data: r.items, summary: r.summary });
}));
router.get('/approvals/excel', requireAnyPrivilege([['drafting.approval', 'view'], ['drafting.close', 'view']]), asyncHandler(async (req, res) => {
  const p = await service.openRowsForExport(req.query, req.user);
  send(res, { buffer: await docs.departmentsWorkbook({ ...p, generatedBy: who(req) }), fileName: `Draft ${p.department}.xlsx`, mimeType: XLSX, attachment: true });
}));
router.get('/approvals/:specialisationId/rows', requirePrivilege('drafting.approval', 'view'), asyncHandler(async (req, res) => {
  const r = await service.approvalRows(id(req.params.specialisationId), req.query, req.user);
  res.json({ data: r.items, meta: r.meta });
}));
router.post('/approvals/:specialisationId', requirePrivilege('drafting.approval', 'approve'), asyncHandler(async (req, res) => {
  res.json({ data: await service.approve(id(req.params.specialisationId), req.body || {}, req.user, req.actor) });
}));

// ---- close ----
router.post('/batches/:id/close', requirePrivilege('drafting.close', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.closeBatch(id(req.params.id), req.body || {}, req.user, req.actor) });
}));

// ---- WEF ----
router.post('/batches/:id/rows/:rowId/wef', requirePrivilege('drafting.wef', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.setRowWef(id(req.params.id), id(req.params.rowId), req.body || {}, req.user, req.actor) });
}));
router.post('/batches/:id/wef', requirePrivilege('drafting.wef', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.setDepartmentWef(id(req.params.id), req.body || {}, req.user, req.actor) });
}));

// ---- the record's Drafting tab ----
router.get('/rating/:serviceNumber/scheduled', requirePrivilege('ratings.edit', 'view', { own: ownRecord }), asyncHandler(async (req, res) => {
  res.json({ data: await service.scheduledFor(String(req.params.serviceNumber).trim()) });
}));

module.exports = router;
