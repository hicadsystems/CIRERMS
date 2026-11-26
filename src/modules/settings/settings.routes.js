'use strict';

const express = require('express');
const service = require('./settings.service');
const { requireAuth } = require('../../middleware/auth');
const { requirePrivilege } = require('../../middleware/access');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();

router.use(requireAuth);

// GET /api/settings: every group with its settings
router.get(
  '/',
  requirePrivilege('admin.settings', 'view'),
  asyncHandler(async (_req, res) => {
    res.json({ data: await service.listGroups() });
  })
);

// PUT /api/settings/:group   { values: { 'drafting.due_months': 12, ... } }
router.put(
  '/:group',
  requirePrivilege('admin.settings', 'edit'),
  asyncHandler(async (req, res) => {
    res.json({ data: await service.updateGroup(req.params.group, req.body || {}, req.actor) });
  })
);

module.exports = router;
