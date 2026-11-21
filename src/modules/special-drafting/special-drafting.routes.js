'use strict';

/*
 * /api/special-drafting. Screens and actions as in special-drafting.module.js.
 *
 *   GET    /options                               ships, posting types, today, the latest WEF       any special-drafting screen
 *   GET    /rating/:serviceNumber                 a current rating's details and the draft that stops another   proposal add
 *   GET    /drafts?postingType&q&page             the drafts not yet printed (25 a page)            proposal or report view
 *   GET    /drafts/:id                            one draft                                         proposal or report view
 *   POST   /drafts                                Draft Rating                                      proposal add
 *   DELETE /drafts/:id                            Remove (only before printing)                     proposal delete
 *   GET    /drafts/:id/letter                     Draft Letter (PDF; marks nothing printed)         proposal view
 *   GET    /report/types?postingType              the posting types with the count waiting; for one type whether
 *                                                 every draft can be printed now                    report view
 *   GET    /report/preview?postingType            Preview Draft Form (PDF; marks nothing)           report view
 *   POST   /report/print                          Print and Mark Printed { postingType }            report edit
 *   GET    /forms?postingType&q&page   /forms/:id   the printed forms, one with its ratings          report view
 *   GET    /forms/:id/pdf                         Reprint Form (changes nothing)                    report view
 *   GET    /upload/template                       the workbook to fill in                           upload view
 *   POST   /upload/check   /upload/check.xlsx     every row checked, nothing written; the rows not ready as a workbook   upload add
 *   POST   /upload                                import the ready rows (one transaction)           upload add
 */
const express = require('express');
const service = require('./special-drafting.service');
const docs = require('./special-drafting.documents');
const upload = require('./special-drafting.upload');
const { requireAuth } = require('../../middleware/auth');
const { requirePrivilege, requireAnyPrivilege } = require('../../middleware/access');
const { parseValidatedExcel } = require('../../middleware/upload');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();
router.use(requireAuth);

const ANY = requireAnyPrivilege([['special-drafting.proposal', 'view'], ['special-drafting.report', 'view'], ['special-drafting.upload', 'view']]);
const DRAFTS_VIEW = requireAnyPrivilege([['special-drafting.proposal', 'view'], ['special-drafting.report', 'view']]);

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
  res.json({ data: await service.options() });
}));

// ---- Special Draft Proposal ----
router.get('/rating/:serviceNumber', requirePrivilege('special-drafting.proposal', 'add'), asyncHandler(async (req, res) => {
  res.json({ data: await service.ratingDetails(req.params.serviceNumber) });
}));
router.get('/drafts', DRAFTS_VIEW, asyncHandler(async (req, res) => {
  const r = await service.listDrafts(req.query);
  res.json({ data: r.items, summary: r.summary, meta: r.meta });
}));
router.get('/drafts/:id', DRAFTS_VIEW, asyncHandler(async (req, res) => {
  res.json({ data: await service.getDraft(id(req.params.id)) });
}));
router.post('/drafts', requirePrivilege('special-drafting.proposal', 'add'), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.createDraft(req.body || {}, req.actor) });
}));
router.delete('/drafts/:id', requirePrivilege('special-drafting.proposal', 'delete'), asyncHandler(async (req, res) => {
  res.json({ data: await service.removeDraft(id(req.params.id), req.actor) });
}));
router.get('/drafts/:id/letter', requirePrivilege('special-drafting.proposal', 'view'), asyncHandler(async (req, res) => {
  const d = await service.letterData(id(req.params.id));
  send(res, { buffer: await docs.letterPdf({ ...d, generatedBy: who(req) }), fileName: `Special Draft Letter ${d.draft.serviceNumber}.pdf`, mimeType: PDF });
}));

// ---- Special Draft Report ----
router.get('/report/types', requirePrivilege('special-drafting.report', 'view'), asyncHandler(async (req, res) => {
  res.json({ data: await service.reportTypes(req.query) });
}));
router.get('/report/preview', requirePrivilege('special-drafting.report', 'view'), asyncHandler(async (req, res) => {
  const p = await service.previewData(req.query.postingType);
  send(res, { buffer: await docs.formPdf({ form: null, postingType: p.postingType, drafts: p.drafts, generatedBy: who(req) }), fileName: `Special Draft Form ${p.postingType} (preview).pdf`, mimeType: PDF });
}));
router.post('/report/print', requirePrivilege('special-drafting.report', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.printForm(req.body || {}, req.actor) });
}));
router.get('/forms', requirePrivilege('special-drafting.report', 'view'), asyncHandler(async (req, res) => {
  const r = await service.listForms(req.query);
  res.json({ data: r.items, meta: r.meta });
}));
router.get('/forms/:id', requirePrivilege('special-drafting.report', 'view'), asyncHandler(async (req, res) => {
  res.json({ data: await service.getForm(id(req.params.id)) });
}));
router.get('/forms/:id/pdf', requirePrivilege('special-drafting.report', 'view'), asyncHandler(async (req, res) => {
  const r = await service.getForm(id(req.params.id));
  send(res, { buffer: await docs.formPdf({ form: r.form, postingType: r.form.postingType, drafts: r.drafts, generatedBy: who(req) }), fileName: `Special Draft Form ${r.form.formNumber}.pdf`, mimeType: PDF });
}));

// ---- Upload Draft ----
router.get('/upload/template', requirePrivilege('special-drafting.upload', 'view'), asyncHandler(async (req, res) => {
  send(res, { buffer: await upload.template(), fileName: 'Special Draft Upload Template.xlsx', mimeType: XLSX, attachment: true });
}));
router.post('/upload/check', requirePrivilege('special-drafting.upload', 'add'), parseValidatedExcel, asyncHandler(async (req, res) => {
  res.json({ data: { fileName: req.file.originalname, ...(await upload.check(req.file.buffer)) } });
}));
router.post('/upload/check.xlsx', requirePrivilege('special-drafting.upload', 'add'), parseValidatedExcel, asyncHandler(async (req, res) => {
  const r = await upload.check(req.file.buffer);
  send(res, { buffer: await upload.errorsWorkbook(r), fileName: 'Special Draft Rows Not Ready.xlsx', mimeType: XLSX, attachment: true });
}));
router.post('/upload', requirePrivilege('special-drafting.upload', 'add'), parseValidatedExcel, asyncHandler(async (req, res) => {
  res.json({ data: { fileName: req.file.originalname, ...(await upload.importFile(req.file.buffer, req.file.originalname, req.actor)) } });
}));

module.exports = router;
