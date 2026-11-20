'use strict';

const express = require('express');
const service = require('./discharge.service');
const upload = require('./discharge.upload');
const documents = require('./discharge.documents');
const { requireAuth } = require('../../middleware/auth');
const { requirePrivilege, requireAnyPrivilege } = require('../../middleware/access');
const { asyncHandler } = require('../../shared/errors');
const { parseValidatedExcel } = require('../../middleware/upload');

const router = express.Router();
router.use(requireAuth);

const ANY = requireAnyPrivilege([
  ['discharge.process', 'view'], ['discharge.service', 'view'], ['discharge.forms', 'view'],
  ['discharge.report', 'view'], ['discharge.upload', 'view'],
]);

const send = (res, out, attachment = false) => {
  res.setHeader('Content-Type', out.mimeType);
  res.setHeader('Content-Disposition', `${attachment ? 'attachment' : 'inline'}; filename="${out.fileName.replace(/"/g, '')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(out.buffer);
};
const who = (req) => req.user && (req.user.fullName || req.user.username) || '';

router.get('/options', ANY, asyncHandler(async (req, res) => {
  const data = await service.options();
  data.proposedBy = req.user && (req.user.fullName || req.user.username) || '';
  res.json({ data });
}));

router.get('/due', requirePrivilege('discharge.process', 'view'), asyncHandler(async (req, res) => {
  res.json({ data: await service.due(req.query) });
}));
router.get('/ratings/:serviceNumber/candidate', requirePrivilege('discharge.process', 'view'), asyncHandler(async (req, res) => {
  res.json({ data: await service.proposalCandidate(req.params.serviceNumber) });
}));

router.get('/proposals', requirePrivilege('discharge.process', 'view'), asyncHandler(async (req, res) => {
  res.json({ data: await service.proposals(req.query) });
}));
router.get('/proposals/rows', requirePrivilege('discharge.process', 'view'), asyncHandler(async (req, res) => {
  res.json({ data: await service.proposalRows(req.query) });
}));
router.post('/proposals', requirePrivilege('discharge.process', 'add'), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.createProposal(req.body || {}, req.actor) });
}));
router.get('/proposals/:id', requirePrivilege('discharge.process', 'view'), asyncHandler(async (req, res) => {
  res.json({ data: await service.proposal(Number.parseInt(req.params.id, 10) || 0) });
}));
router.post('/proposals/:id/ratings', requirePrivilege('discharge.process', 'add'), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.addRating(Number.parseInt(req.params.id, 10) || 0, req.body || {}, req.actor) });
}));
router.put('/proposals/:id/ratings/:serviceNumber', requirePrivilege('discharge.process', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.processRow(Number.parseInt(req.params.id, 10) || 0, req.params.serviceNumber, req.body || {}, req.actor) });
}));
router.post('/proposals/:id/ratings/:serviceNumber/reengage', requirePrivilege('discharge.process', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.reengage(Number.parseInt(req.params.id, 10) || 0, req.params.serviceNumber, req.body || {}, req.actor) });
}));
router.delete('/proposals/:id/ratings/:serviceNumber', requirePrivilege('discharge.process', 'delete'), asyncHandler(async (req, res) => {
  res.json({ data: await service.removeRow(Number.parseInt(req.params.id, 10) || 0, req.params.serviceNumber, req.actor) });
}));

router.get('/service-details/:serviceNumber', requirePrivilege('discharge.service', 'view'), asyncHandler(async (req, res) => {
  res.json({ data: await service.serviceDetails(req.params.serviceNumber) });
}));
router.get('/service-details/:serviceNumber/pdf', requirePrivilege('discharge.service', 'view'), asyncHandler(async (req, res) => {
  send(res, await documents.servicePdf(await service.serviceDetails(req.params.serviceNumber), who(req)), false);
}));

router.get('/verification/:serviceNumber', requirePrivilege('discharge.forms', 'view'), asyncHandler(async (req, res) => {
  res.json({ data: await service.verification(req.params.serviceNumber) });
}));
router.get('/verification/:serviceNumber/:kind/pdf', requirePrivilege('discharge.forms', 'view'), asyncHandler(async (req, res) => {
  send(res, await documents.verificationPdf(req.params.kind, await service.verification(req.params.serviceNumber), who(req)), false);
}));

router.get('/report', requirePrivilege('discharge.report', 'view'), asyncHandler(async (req, res) => {
  res.json({ data: await service.report(req.query) });
}));
router.get('/report/pdf', requirePrivilege('discharge.report', 'view'), asyncHandler(async (req, res) => {
  const r = await service.report(req.query, { all: true });
  send(res, await documents.reportPdf(r, req.query, who(req)), false);
}));
router.get('/report/excel', requirePrivilege('discharge.report', 'view'), asyncHandler(async (req, res) => {
  const r = await service.report(req.query, { all: true });
  send(res, await documents.reportExcel(r, who(req)), true);
}));

router.get('/upload/template', requirePrivilege('discharge.upload', 'view'), asyncHandler(async (_req, res) => {
  send(res, await upload.template(), true);
}));
router.post('/upload/check', requirePrivilege('discharge.upload', 'view'), parseValidatedExcel, asyncHandler(async (req, res) => {
  res.json({ data: await upload.check(req.file.buffer) });
}));
router.post('/upload/import', requirePrivilege('discharge.upload', 'add'), parseValidatedExcel, asyncHandler(async (req, res) => {
  res.json({ data: await upload.importFile(req.file.buffer, req.file.originalname, req.actor) });
}));

module.exports = router;
