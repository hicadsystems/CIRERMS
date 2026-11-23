'use strict';

/*
 * /api/reports. Six read-only pages, each guarded by its own screen (view). One filtered query feeds a page, its PDF
 * and its workbook: the same query string goes to all three.
 *
 *   GET /options                                  the pickers' lists                         any reports screen
 *   GET /ship-history?shipId&from&to&page         Ship History (a ship is required)          ship-history view
 *   GET /ship-history/pdf  /ship-history/excel    the printout, the workbook                  ship-history view
 *   GET /personnel?status&rateId&branchId&commandId&shipId&staffBranchId&specialisationId&entryModeId&stateId&zoneId&sort&page
 *   GET /personnel/pdf  /personnel/excel          Ratings Report, workbook                     all-personnel view
 *   GET /disposition?commandId&areaId&specialisationId&page      ships with counts by rate    disposition view
 *   GET /disposition/pdf  /disposition/excel                                                  disposition view
 *   GET /nominal-roll?commandId&shipId&branchId&rateId&page      a ship or a command is required   nominal-roll view
 *   GET /nominal-roll/pdf  /nominal-roll/excel                                                nominal-roll view
 *   GET /manning-state?commandId&shipId&rateId&specialisationId&short=1&page                  manning-state view
 *   GET /manning-state/pdf  /manning-state/excel                                              manning-state view
 *   GET /retirement-forecast?months=6|12|24&branchId&rateId&shipId&page                      retirement-forecast view
 *   GET /retirement-forecast/pdf  /retirement-forecast/excel                                  retirement-forecast view
 *
 * A PDF or workbook holds 3,000 / 50,000 lines at most (422 above: narrow the filters).
 */
const express = require('express');
const service = require('./reports.service');
const docs = require('./reports.documents');
const { requireAuth } = require('../../middleware/auth');
const { requirePrivilege, requireAnyPrivilege } = require('../../middleware/access');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();
router.use(requireAuth);

const SCREENS = ['ship-history', 'all-personnel', 'disposition', 'nominal-roll', 'manning-state', 'retirement-forecast'];
const ANY = requireAnyPrivilege(SCREENS.map((s) => [`reports.${s}`, 'view']));
const who = (req) => (req.user && (req.user.fullName || req.user.username)) || '';
const PDF = 'application/pdf';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function send(res, { buffer, fileName, mimeType, attachment = false }) {
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `${attachment ? 'attachment' : 'inline'}; filename="${fileName.replace(/"/g, '')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(buffer);
}
const pdf = (res, buffer, fileName) => send(res, { buffer, fileName, mimeType: PDF });
const xlsx = (res, buffer, fileName) => send(res, { buffer, fileName, mimeType: XLSX, attachment: true });

router.get('/options', ANY, asyncHandler(async (req, res) => {
  res.json({ data: await service.options() });
}));

// ---- Ship History ----
router.get('/ship-history', requirePrivilege('reports.ship-history', 'view'), asyncHandler(async (req, res) => {
  const r = await service.shipHistory(req.query);
  res.json({ data: r.items, summary: r.summary, meta: r.meta });
}));
router.get('/ship-history/pdf', requirePrivilege('reports.ship-history', 'view'), asyncHandler(async (req, res) => {
  const p = await service.shipHistoryForPrint(req.query, 'pdf');
  pdf(res, await docs.shipHistoryPdf({ ...p, generatedBy: who(req) }), 'Ship History.pdf');
}));
router.get('/ship-history/excel', requirePrivilege('reports.ship-history', 'view'), asyncHandler(async (req, res) => {
  const p = await service.shipHistoryForPrint(req.query);
  xlsx(res, await docs.shipHistoryWorkbook({ ...p, generatedBy: who(req) }), `Ship History ${p.ship}.xlsx`);
}));

// ---- All Personnel ----
router.get('/personnel', requirePrivilege('reports.all-personnel', 'view'), asyncHandler(async (req, res) => {
  const r = await service.personnel(req.query);
  res.json({ data: r.items, summary: r.summary, meta: r.meta });
}));
router.get('/personnel/pdf', requirePrivilege('reports.all-personnel', 'view'), asyncHandler(async (req, res) => {
  const p = await service.personnelForPrint(req.query, 'pdf');
  pdf(res, await docs.personnelPdf({ ...p, generatedBy: who(req) }), 'Personel.pdf');
}));
router.get('/personnel/excel', requirePrivilege('reports.all-personnel', 'view'), asyncHandler(async (req, res) => {
  const p = await service.personnelForPrint(req.query, 'excel');
  xlsx(res, await docs.personnelWorkbook({ ...p, generatedBy: who(req) }), 'Personel.xlsx');
}));

// ---- Disposition ----
router.get('/disposition', requirePrivilege('reports.disposition', 'view'), asyncHandler(async (req, res) => {
  const r = await service.disposition(req.query);
  res.json({ data: r.items, summary: r.summary, meta: r.meta });
}));
router.get('/disposition/pdf', requirePrivilege('reports.disposition', 'view'), asyncHandler(async (req, res) => {
  const p = await service.dispositionForPrint(req.query, 'pdf');
  pdf(res, await docs.dispositionPdf({ ...p, generatedBy: who(req) }), 'Disposition Report.pdf');
}));
router.get('/disposition/excel', requirePrivilege('reports.disposition', 'view'), asyncHandler(async (req, res) => {
  const p = await service.dispositionForPrint(req.query, 'excel');
  xlsx(res, await docs.dispositionWorkbook({ ...p, generatedBy: who(req) }), 'Disposition Report.xlsx');
}));

// ---- Nominal Roll ----
router.get('/nominal-roll', requirePrivilege('reports.nominal-roll', 'view'), asyncHandler(async (req, res) => {
  const r = await service.nominalRoll(req.query);
  res.json({ data: r.items, summary: r.summary, meta: r.meta });
}));
router.get('/nominal-roll/pdf', requirePrivilege('reports.nominal-roll', 'view'), asyncHandler(async (req, res) => {
  const p = await service.nominalRollForPrint(req.query, 'pdf');
  pdf(res, await docs.nominalRollPdf({ ...p, generatedBy: who(req) }), 'Nominal Roll.pdf');
}));
router.get('/nominal-roll/excel', requirePrivilege('reports.nominal-roll', 'view'), asyncHandler(async (req, res) => {
  const p = await service.nominalRollForPrint(req.query, 'excel');
  xlsx(res, await docs.nominalRollWorkbook({ ...p, generatedBy: who(req) }), 'Nominal Roll.xlsx');
}));

// ---- Manning State ----
router.get('/manning-state', requirePrivilege('reports.manning-state', 'view'), asyncHandler(async (req, res) => {
  const r = await service.manningState(req.query);
  res.json({ data: r.items, summary: r.summary, meta: r.meta });
}));
router.get('/manning-state/pdf', requirePrivilege('reports.manning-state', 'view'), asyncHandler(async (req, res) => {
  const p = await service.manningStateForPrint(req.query, 'pdf');
  pdf(res, await docs.manningStatePdf({ ...p, generatedBy: who(req) }), 'Manning State.pdf');
}));
router.get('/manning-state/excel', requirePrivilege('reports.manning-state', 'view'), asyncHandler(async (req, res) => {
  const p = await service.manningStateForPrint(req.query, 'excel');
  xlsx(res, await docs.manningStateWorkbook({ ...p, generatedBy: who(req) }), 'Manning State.xlsx');
}));

// ---- Retirement Forecast ----
router.get('/retirement-forecast', requirePrivilege('reports.retirement-forecast', 'view'), asyncHandler(async (req, res) => {
  const r = await service.retirementForecast(req.query);
  res.json({ data: r.items, summary: r.summary, meta: r.meta });
}));
router.get('/retirement-forecast/pdf', requirePrivilege('reports.retirement-forecast', 'view'), asyncHandler(async (req, res) => {
  const p = await service.retirementForecastForPrint(req.query, 'pdf');
  pdf(res, await docs.retirementForecastPdf({ ...p, generatedBy: who(req) }), 'Retirement Forecast.pdf');
}));
router.get('/retirement-forecast/excel', requirePrivilege('reports.retirement-forecast', 'view'), asyncHandler(async (req, res) => {
  const p = await service.retirementForecastForPrint(req.query, 'excel');
  xlsx(res, await docs.retirementForecastWorkbook({ ...p, generatedBy: who(req) }), 'Retirement Forecast.xlsx');
}));

module.exports = router;
