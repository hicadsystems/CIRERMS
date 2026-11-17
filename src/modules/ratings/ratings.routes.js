'use strict';

const express = require('express');
const ratingsService = require('./ratings.service');
const { requireAuth } = require('../../middleware/auth');
const {
  persistValidatedPhoto,
  persistValidatedDocument,
  parseValidatedExcel,
} = require('../../middleware/upload');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();

router.use(requireAuth);

// ============================================================================
// Static routes FIRST (before /:serviceNumber)
// ============================================================================

router.get(
  '/',
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

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const data = await ratingsService.getMyDetails(req.user);
    res.json({ data });
  })
);

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const out = await ratingsService.exportRatingsList(req.query, req.user.username);
    const disposition = out.inline ? 'inline' : 'attachment';
    res.setHeader('Content-Type', out.mimeType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${out.fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(out.buffer);
  })
);

router.get(
  '/batch-template',
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
  parseValidatedExcel,
  asyncHandler(async (req, res) => {
    const summary = await ratingsService.processBatchUpload(req.file.buffer, req.user.id);
    res.json({ data: summary });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const dossier = await ratingsService.createRating(req.body, req.user.id);
    res.status(201).json({ data: dossier });
  })
);

// ============================================================================
// Parameterised /:serviceNumber routes
// ============================================================================

router.get(
  '/:serviceNumber',
  asyncHandler(async (req, res) => {
    const dossier = await ratingsService.getFullDossier(req.params.serviceNumber);
    res.json({ data: dossier });
  })
);

router.put(
  '/:serviceNumber',
  asyncHandler(async (req, res) => {
    const dossier = await ratingsService.updateRating(req.params.serviceNumber, req.body);
    res.json({ data: dossier });
  })
);

router.delete(
  '/:serviceNumber',
  asyncHandler(async (req, res) => {
    const result = await ratingsService.deleteRating(req.params.serviceNumber);
    res.json({ data: result });
  })
);

// Dossier & Per-Tab PDFs
router.get(
  '/:serviceNumber/pdf',
  asyncHandler(async (req, res) => {
    const out = await ratingsService.exportRatingDossierPdf(req.params.serviceNumber, req.user.username);
    const disp = req.query.download === '1' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${disp}; filename="${out.fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(out.buffer);
  })
);

router.get(
  '/:serviceNumber/tabs/:tabKey/pdf',
  asyncHandler(async (req, res) => {
    const out = await ratingsService.exportRatingTabPdf(
      req.params.serviceNumber,
      req.params.tabKey,
      req.user.username
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
  persistValidatedPhoto,
  asyncHandler(async (req, res) => {
    const rating = await ratingsService.saveRatingPhoto(
      req.params.serviceNumber,
      req.params.kind,
      req.savedPhoto
    );
    res.json({ data: { rating } });
  })
);

router.get(
  '/:serviceNumber/photo/:kind',
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
  asyncHandler(async (req, res) => {
    const bundle = await ratingsService.getDocumentsBundle(req.params.serviceNumber, req.query);
    res.json({ data: bundle });
  })
);

router.post(
  '/:serviceNumber/documents',
  persistValidatedDocument,
  asyncHandler(async (req, res) => {
    const bundle = await ratingsService.uploadRatingDocument(
      req.params.serviceNumber,
      req.body,
      req.savedDocument,
      req.user.id
    );
    res.status(201).json({ data: bundle });
  })
);

router.get(
  '/:serviceNumber/documents/:docId/file',
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
  asyncHandler(async (req, res) => {
    const bundle = await ratingsService.deleteRatingDocument(
      req.params.serviceNumber,
      req.params.docId
    );
    res.json({ data: bundle });
  })
);

// Generic Child Tab CRUD (:tabKey = next-of-kin | spouse | children | advancement | drafting | training | education | language)
router.get(
  '/:serviceNumber/records/:tabKey',
  asyncHandler(async (req, res) => {
    const result = await ratingsService.listChildRecords(req.params.serviceNumber, req.params.tabKey);
    res.json({ data: result });
  })
);

router.post(
  '/:serviceNumber/records/:tabKey',
  asyncHandler(async (req, res) => {
    const result = await ratingsService.createChildRecord(
      req.params.serviceNumber,
      req.params.tabKey,
      req.body,
      req.user.id
    );
    res.status(201).json({ data: result });
  })
);

router.put(
  '/:serviceNumber/records/:tabKey/:rowId',
  asyncHandler(async (req, res) => {
    const result = await ratingsService.updateChildRecord(
      req.params.serviceNumber,
      req.params.tabKey,
      req.params.rowId,
      req.body
    );
    res.json({ data: result });
  })
);

router.delete(
  '/:serviceNumber/records/:tabKey/:rowId',
  asyncHandler(async (req, res) => {
    const result = await ratingsService.deleteChildRecord(
      req.params.serviceNumber,
      req.params.tabKey,
      req.params.rowId
    );
    res.json({ data: result });
  })
);

module.exports = router;
