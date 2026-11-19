'use strict';

const express = require('express');
const auditService = require('./audit.service');
const { requireAuth } = require('../../middleware/auth');
const { requirePrivilege } = require('../../middleware/access');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();

router.use(requireAuth);
router.use(requirePrivilege('admin.audit', 'view'));

// GET /api/audit?from=YYYY-MM-DD&to=YYYY-MM-DD&user=&userId=&action=&table=&record=&page=1
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await auditService.listEntries(req.query);
    res.json({
      data: result.items,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages },
    });
  })
);

router.get(
  '/filters',
  asyncHandler(async (_req, res) => {
    res.json({ data: await auditService.getFilterOptions() });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json({ data: await auditService.getEntry(req.params.id) });
  })
);

module.exports = router;
