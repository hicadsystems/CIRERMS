'use strict';

/*
 * /api/advancement. Screens and actions as in advancement.module.js. A user tied to a specialisation (their
 * department) is held to it by the service.
 *
 *   GET    /options                                rates, branches, specialisations, ranks, the user's department,
 *                                                  the due rule                                   any advancement screen
 *   GET    /due?branchId&specialisationId&rateId&page          who is due (reads only)          due view
 *   GET    /batches/preview?branchId&...           what Create Advancement Batch would do         due add
 *   POST   /batches                                make (or add to) the batch                     due add
 *   GET    /batches?stage=open|board               the open batches (with readiness), or the closed batches waiting
 *                                                  for board dates                                 review, close or board view
 *   GET    /batches/:id   /batches/:id/rows?page&specialisationId&q    review, close, board or promoted view
 *   GET    /batches/:id/form.pdf                   the Advancement Form                           review view
 *   GET    /batches/:id/report.pdf                 the Advancement Report                         promoted view
 *   GET    /batches/:id/excel                      the batch's workbook                           review or promoted view
 *   POST   /batches/:id/rows                       Add Personnel                                  review add
 *   PUT    /batches/:id/rows/:rowId                Set New Rate (the next rate; remarks)          review edit
 *   POST   /batches/:id/rows/:rowId/not-recommended                                               review edit
 *   DELETE /batches/:id/rows/:rowId   DELETE /batches/:id/rows (Clear Batch)                      review delete
 *   GET    /approvals   /approvals/:specialisationId/rows?page                                    approval view
 *   GET    /approvals/excel?specialisationId       the open batches' ratings by department         approval or close view
 *   POST   /approvals/:specialisationId           Approve Department                             approval approve
 *   POST   /batches/:id/close                      Close                                          close edit
 *   POST   /batches/:id/rows/:rowId/board   POST /batches/:id/board (Set Date for Batch)          board edit
 *   GET    /report?branchId&rateId&signal&batch&page   the batches with total and promoted        promoted view
 *   GET    /report/pdf   /report/excel             Batch Summary Report, the workbook             promoted view
 *   GET    /upload/template                        the workbook to fill in                        upload view
 *   POST   /upload/check   /upload/check.xlsx      every row checked, nothing written; the rows not ready as a workbook
 *   POST   /upload                                 import the ready rows (one transaction)        upload add
 *   GET    /rating/:serviceNumber/scheduled        the rate changes still to come (the record's Advancement tab)
 *                                                  ratings.edit view, or the rating's own record
 */
const express = require('express');
const service = require('./advancement.service');
const upload = require('./advancement.upload');
const docs = require('./advancement.documents');
const { requireAuth } = require('../../middleware/auth');
const { requirePrivilege, requireAnyPrivilege } = require('../../middleware/access');
const { parseValidatedExcel } = require('../../middleware/upload');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();
router.use(requireAuth);

const ANY = requireAnyPrivilege([
  ['advancement.due', 'view'], ['advancement.review', 'view'], ['advancement.approval', 'view'], ['advancement.close', 'view'],
  ['advancement.board', 'view'], ['advancement.promoted', 'view'], ['advancement.upload', 'view'],
]);
const BATCH_VIEW = requireAnyPrivilege([['advancement.review', 'view'], ['advancement.close', 'view'], ['advancement.board', 'view'], ['advancement.promoted', 'view']]);
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

// ---- Rates due for Advancement ----
router.get('/due', requirePrivilege('advancement.due', 'view'), asyncHandler(async (req, res) => {
  const r = await service.listDue(req.query, req.user);
  res.json({ data: r.items, summary: r.summary, meta: r.meta });
}));
router.get('/batches/preview', requirePrivilege('advancement.due', 'add'), asyncHandler(async (req, res) => {
  res.json({ data: await service.previewBatch(req.query, req.user) });
}));
router.post('/batches', requirePrivilege('advancement.due', 'add'), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.createBatch(req.body || {}, req.user, req.actor) });
}));

// ---- batches ----
router.get('/batches', requireAnyPrivilege([['advancement.review', 'view'], ['advancement.close', 'view'], ['advancement.board', 'view']]), asyncHandler(async (req, res) => {
  res.json({ data: (await service.listBatches(req.query, req.user)).items });
}));
router.get('/batches/:id', BATCH_VIEW, asyncHandler(async (req, res) => {
  res.json({ data: await service.getBatch(id(req.params.id), req.user) });
}));
router.get('/batches/:id/rows', BATCH_VIEW, asyncHandler(async (req, res) => {
  const r = await service.listRows(id(req.params.id), req.query, req.user);
  res.json({ data: r.items, meta: r.meta });
}));
router.get('/batches/:id/form.pdf', requirePrivilege('advancement.review', 'view'), asyncHandler(async (req, res) => {
  const p = await service.batchForPrint(id(req.params.id), req.user);
  send(res, { buffer: await docs.formPdf({ ...p, generatedBy: who(req) }), fileName: `Advancement Form ${p.b.batchNumber}.pdf`, mimeType: PDF });
}));
router.get('/batches/:id/report.pdf', requirePrivilege('advancement.promoted', 'view'), asyncHandler(async (req, res) => {
  const p = await service.batchForPrint(id(req.params.id), req.user);
  send(res, { buffer: await docs.reportPdf({ ...p, generatedBy: who(req) }), fileName: `Advancement Report ${p.b.batchNumber}.pdf`, mimeType: PDF });
}));
router.get('/batches/:id/excel', requireAnyPrivilege([['advancement.review', 'view'], ['advancement.promoted', 'view']]), asyncHandler(async (req, res) => {
  const p = await service.batchForPrint(id(req.params.id), req.user);
  send(res, { buffer: await docs.batchWorkbook({ ...p, generatedBy: who(req) }), fileName: `Advancement ${p.b.batchNumber}.xlsx`, mimeType: XLSX, attachment: true });
}));
router.post('/batches/:id/rows', requirePrivilege('advancement.review', 'add'), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.addPersonnel(id(req.params.id), req.body || {}, req.user, req.actor) });
}));
router.put('/batches/:id/rows/:rowId', requirePrivilege('advancement.review', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.setNewRate(id(req.params.id), id(req.params.rowId), req.body || {}, req.user, req.actor) });
}));
router.post('/batches/:id/rows/:rowId/not-recommended', requirePrivilege('advancement.review', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.notRecommend(id(req.params.id), id(req.params.rowId), req.body || {}, req.user, req.actor) });
}));
router.delete('/batches/:id/rows/:rowId', requirePrivilege('advancement.review', 'delete'), asyncHandler(async (req, res) => {
  res.json({ data: await service.removeRow(id(req.params.id), id(req.params.rowId), req.user, req.actor) });
}));
router.delete('/batches/:id/rows', requirePrivilege('advancement.review', 'delete'), asyncHandler(async (req, res) => {
  res.json({ data: await service.clearBatch(id(req.params.id), req.user, req.actor) });
}));

// ---- approval ----
router.get('/approvals', requirePrivilege('advancement.approval', 'view'), asyncHandler(async (req, res) => {
  const r = await service.approvals(req.user);
  res.json({ data: r.items, summary: r.summary });
}));
router.get('/approvals/excel', requireAnyPrivilege([['advancement.approval', 'view'], ['advancement.close', 'view']]), asyncHandler(async (req, res) => {
  const p = await service.openRowsForExport(req.query, req.user);
  send(res, { buffer: await docs.departmentsWorkbook({ ...p, generatedBy: who(req) }), fileName: `Advancement ${p.department}.xlsx`, mimeType: XLSX, attachment: true });
}));
router.get('/approvals/:specialisationId/rows', requirePrivilege('advancement.approval', 'view'), asyncHandler(async (req, res) => {
  const r = await service.approvalRows(id(req.params.specialisationId), req.query, req.user);
  res.json({ data: r.items, meta: r.meta });
}));
router.post('/approvals/:specialisationId', requirePrivilege('advancement.approval', 'approve'), asyncHandler(async (req, res) => {
  res.json({ data: await service.approve(id(req.params.specialisationId), req.body || {}, req.user, req.actor) });
}));

// ---- close ----
router.post('/batches/:id/close', requirePrivilege('advancement.close', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.closeBatch(id(req.params.id), req.body || {}, req.user, req.actor) });
}));

// ---- board returns ----
router.post('/batches/:id/rows/:rowId/board', requirePrivilege('advancement.board', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.setRowBoard(id(req.params.id), id(req.params.rowId), req.body || {}, req.user, req.actor) });
}));
router.post('/batches/:id/board', requirePrivilege('advancement.board', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.setBatchBoard(id(req.params.id), req.body || {}, req.user, req.actor) });
}));

// ---- report on promoted rates ----
const filterText = (q) => [q.signal && `signal ${q.signal}`, q.batch && `batch ${q.batch}`].filter(Boolean).join(', ');
router.get('/report', requirePrivilege('advancement.promoted', 'view'), asyncHandler(async (req, res) => {
  const r = await service.report(req.query, req.user);
  res.json({ data: r.items, summary: r.summary, meta: r.meta });
}));
router.get('/report/pdf', requirePrivilege('advancement.promoted', 'view'), asyncHandler(async (req, res) => {
  const p = await service.reportForPrint(req.query, req.user);
  send(res, { buffer: await docs.batchSummaryPdf({ ...p, filters: filterText(req.query), generatedBy: who(req) }), fileName: 'Batch Summary Report for Advancement.pdf', mimeType: PDF });
}));
router.get('/report/excel', requirePrivilege('advancement.promoted', 'view'), asyncHandler(async (req, res) => {
  const p = await service.reportForPrint(req.query, req.user);
  send(res, { buffer: await docs.reportWorkbook({ ...p, generatedBy: who(req) }), fileName: 'Promoted Rates.xlsx', mimeType: XLSX, attachment: true });
}));

// ---- upload advanced rates ----
router.get('/upload/template', requirePrivilege('advancement.upload', 'view'), asyncHandler(async (req, res) => {
  send(res, { buffer: await upload.template(), fileName: 'Advancement Upload Template.xlsx', mimeType: XLSX, attachment: true });
}));
router.post('/upload/check', requirePrivilege('advancement.upload', 'add'), parseValidatedExcel, asyncHandler(async (req, res) => {
  res.json({ data: { fileName: req.file.originalname, ...(await upload.check(req.file.buffer)) } });
}));
router.post('/upload/check.xlsx', requirePrivilege('advancement.upload', 'add'), parseValidatedExcel, asyncHandler(async (req, res) => {
  const r = await upload.check(req.file.buffer);
  send(res, { buffer: await upload.errorsWorkbook(r), fileName: 'Advancement Rows Not Ready.xlsx', mimeType: XLSX, attachment: true });
}));
router.post('/upload', requirePrivilege('advancement.upload', 'add'), parseValidatedExcel, asyncHandler(async (req, res) => {
  res.json({ data: { fileName: req.file.originalname, ...(await upload.importFile(req.file.buffer, req.file.originalname, req.actor)) } });
}));

// ---- the record's Advancement tab ----
router.get('/rating/:serviceNumber/scheduled', requirePrivilege('ratings.edit', 'view', { own: ownRecord }), asyncHandler(async (req, res) => {
  res.json({ data: await service.scheduledFor(String(req.params.serviceNumber).trim()) });
}));

module.exports = router;
