'use strict';

const express = require('express');
const ratingsService = require('./ratings.service');
const { requireAuth } = require('../../middleware/auth');
const { requirePrivilege, requireAnyPrivilege } = require('../../middleware/access');
const {
  persistValidatedPhoto,
  persistValidatedDocument,
  parseValidatedExcel,
} = require('../../middleware/upload');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();

router.use(requireAuth);

// A rating reading their own record (View My Details): its photo, printouts and documents.
const ownRecord = (req) => req.can('ratings.my-details', 'view')
  && !!req.user.serviceNumber
  && String(req.params.serviceNumber || '').trim().toUpperCase() === String(req.user.serviceNumber).toUpperCase();
const ownPassportPhoto = (req) => req.params.kind === 'passport'
  && !!req.user.serviceNumber
  && String(req.params.serviceNumber || '').trim().toUpperCase() === String(req.user.serviceNumber).toUpperCase();

// ============================================================================
// Static routes FIRST (before /:serviceNumber)
// ============================================================================

router.get(
  '/',
  requireAnyPrivilege([['ratings.list', 'view'], ['ratings.documents', 'view']]),
  asyncHandler(async (req, res) => {
    const result = await ratingsService.listRatings(req.query);
    res.json({
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      },
    });
  })
);

// The rating search select (public/js/ui/rating-search.js): 10 suggestions a request, for every screen
// that picks a rating by official number or name, so each of those screens' privileges opens it.
router.get(
  '/search',
  requireAnyPrivilege([
    ['ratings.list', 'view'], ['ratings.edit', 'view'], ['ratings.documents', 'view'],
    ['admin.users', 'add'], ['admin.users', 'view'], ['admin.password', 'view'], ['admin.audit', 'view'],
    ['disciplinary.initiate', 'add'], ['disciplinary.pending', 'view'], ['disciplinary.concluded', 'view'], ['disciplinary.report', 'view'],
    ['training.review', 'edit'],
  ]),
  asyncHandler(async (req, res) => {
    const r = await ratingsService.searchRatings(req.query);
    res.json({ data: r.items, meta: { offset: r.offset, limit: r.limit, hasMore: r.hasMore } });
  })
);

router.get(
  '/me',
  requirePrivilege('ratings.my-details', 'view'),
  asyncHandler(async (req, res) => {
    const data = await ratingsService.getMyDetails(req.user);
    res.json({ data });
  })
);

router.get(
  '/export',
  requirePrivilege('ratings.list', 'view'),
  asyncHandler(async (req, res) => {
    const out = await ratingsService.exportRatingsList(req.query, req.user.fullName || req.user.username);
    const disposition = out.inline ? 'inline' : 'attachment';
    res.setHeader('Content-Type', out.mimeType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${out.fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(out.buffer);
  })
);

router.get(
  '/batch-template',
  requirePrivilege('ratings.upload', 'view'),
  asyncHandler(async (_req, res) => {
    const out = await ratingsService.generateBatchTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(out.buffer);
  })
);

router.post(
  '/batch-upload',
  requirePrivilege('ratings.upload', 'add'),
  parseValidatedExcel,
  asyncHandler(async (req, res) => {
    const summary = await ratingsService.processBatchUpload(req.file.buffer, req.actor);
    res.json({ data: summary });
  })
);

router.post(
  '/',
  requirePrivilege('ratings.new', 'add'),
  asyncHandler(async (req, res) => {
    const dossier = await ratingsService.createRating(req.body, req.actor);
    res.status(201).json({ data: dossier });
  })
);

// ============================================================================
// Parameterised /:serviceNumber routes
// ============================================================================

router.get(
  '/:serviceNumber',
  requireAnyPrivilege([['ratings.edit', 'view'], ['ratings.list', 'view']]),
  asyncHandler(async (req, res) => {
    const dossier = await ratingsService.getFullDossier(req.params.serviceNumber);
    res.json({ data: dossier });
  })
);

router.put(
  '/:serviceNumber',
  requirePrivilege('ratings.edit', 'edit'),
  asyncHandler(async (req, res) => {
    const dossier = await ratingsService.updateRating(req.params.serviceNumber, req.body, req.actor);
    res.json({ data: dossier });
  })
);

router.delete(
  '/:serviceNumber',
  requirePrivilege('ratings.edit', 'delete'),
  asyncHandler(async (req, res) => {
    const result = await ratingsService.deleteRating(req.params.serviceNumber, req.actor);
    res.json({ data: result });
  })
);

// Dossier & Per-Tab PDFs
router.get(
  '/:serviceNumber/pdf',
  requirePrivilege('ratings.edit', 'view', { own: ownRecord }),
  asyncHandler(async (req, res) => {
    const out = await ratingsService.exportRatingDossierPdf(req.params.serviceNumber, req.user.fullName || req.user.username);
    const disp = req.query.download === '1' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disp}; filename="${out.fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(out.buffer);
  })
);

router.get(
  '/:serviceNumber/tabs/:tabKey/pdf',
  requirePrivilege('ratings.edit', 'view', { own: ownRecord }),
  asyncHandler(async (req, res) => {
    const out = await ratingsService.exportRatingTabPdf(
      req.params.serviceNumber,
      req.params.tabKey,
      req.user.fullName || req.user.username
    );
    const disp = req.query.download === '1' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disp}; filename="${out.fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(out.buffer);
  })
);

// Photos (:kind = passport | next-of-kin)
router.post(
  '/:serviceNumber/photo/:kind',
  requireAnyPrivilege([['ratings.edit', 'edit'], ['ratings.new', 'add']]),
  persistValidatedPhoto,
  asyncHandler(async (req, res) => {
    const rating = await ratingsService.saveRatingPhoto(
      req.params.serviceNumber,
      req.params.kind,
      req.savedPhoto,
      req.actor
    );
    res.json({ data: { rating } });
  })
);

router.get(
  '/:serviceNumber/photo/:kind',
  requireAnyPrivilege([
    ['ratings.edit', 'view'], ['ratings.list', 'view'], ['ratings.documents', 'view'], ['admin.users', 'view'],
  ], { own: (req) => ownRecord(req) || ownPassportPhoto(req) }),
  asyncHandler(async (req, res) => {
    const file = await ratingsService.resolveRatingPhotoFile(
      req.params.serviceNumber,
      req.params.kind
    );
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(file.diskPath);
  })
);

// Documents (Navpers / View Document & 10th Profile Tab)
router.get(
  '/:serviceNumber/documents',
  requirePrivilege('ratings.documents', 'view', { own: ownRecord }),
  asyncHandler(async (req, res) => {
    const bundle = await ratingsService.getDocumentsBundle(req.params.serviceNumber, req.query);
    res.json({ data: bundle });
  })
);

router.post(
  '/:serviceNumber/documents',
  requirePrivilege('ratings.documents', 'add'),
  persistValidatedDocument,
  asyncHandler(async (req, res) => {
    const bundle = await ratingsService.uploadRatingDocument(
      req.params.serviceNumber,
      req.body,
      req.savedDocument,
      req.actor
    );
    res.status(201).json({ data: bundle });
  })
);

router.get(
  '/:serviceNumber/documents/:docId/file',
  requirePrivilege('ratings.documents', 'view', { own: ownRecord }),
  asyncHandler(async (req, res) => {
    const file = await ratingsService.resolveRatingDocumentFile(
      req.params.serviceNumber,
      req.params.docId
    );
    const forceDownload =
      req.query.download === '1'
      || (!file.mimeType.startsWith('image/') && file.mimeType !== 'application/pdf');
    const disp = forceDownload ? 'attachment' : 'inline';
    const safeDownloadName = file.originalName.replace(/["\r\n]/g, '_');

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `${disp}; filename="${safeDownloadName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(file.diskPath);
  })
);

router.delete(
  '/:serviceNumber/documents/:docId',
  requirePrivilege('ratings.documents', 'delete'),
  asyncHandler(async (req, res) => {
    const bundle = await ratingsService.deleteRatingDocument(
      req.params.serviceNumber,
      req.params.docId,
      req.actor
    );
    res.json({ data: bundle });
  })
);

// Generic Child Tab CRUD (:tabKey = next-of-kin | spouse | children | advancement | drafting | training | education | language)
router.get(
  '/:serviceNumber/records/:tabKey',
  requirePrivilege('ratings.edit', 'view', { own: ownRecord }),
  asyncHandler(async (req, res) => {
    const result = await ratingsService.listChildRecords(req.params.serviceNumber, req.params.tabKey);
    res.json({ data: result });
  })
);

router.post(
  '/:serviceNumber/records/:tabKey',
  requirePrivilege('ratings.edit', 'add'),
  asyncHandler(async (req, res) => {
    const result = await ratingsService.createChildRecord(
      req.params.serviceNumber,
      req.params.tabKey,
      req.body,
      req.actor
    );
    res.status(201).json({ data: result });
  })
);

router.put(
  '/:serviceNumber/records/:tabKey/:rowId',
  requirePrivilege('ratings.edit', 'edit'),
  asyncHandler(async (req, res) => {
    const result = await ratingsService.updateChildRecord(
      req.params.serviceNumber,
      req.params.tabKey,
      req.params.rowId,
      req.body,
      req.actor
    );
    res.json({ data: result });
  })
);

router.delete(
  '/:serviceNumber/records/:tabKey/:rowId',
  requirePrivilege('ratings.edit', 'delete'),
  asyncHandler(async (req, res) => {
    const result = await ratingsService.deleteChildRecord(
      req.params.serviceNumber,
      req.params.tabKey,
      req.params.rowId,
      req.actor
    );
    res.json({ data: result });
  })
);

module.exports = router;
