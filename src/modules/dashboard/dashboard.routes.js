'use strict';

const express = require('express');
const dashboardService = require('./dashboard.service');
const { requireAuth } = require('../../middleware/auth');
const { requirePrivilege } = require('../../middleware/access');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();

router.get(
  '/summary',
  requireAuth,
  requirePrivilege('dashboard.home', 'view'),
  asyncHandler(async (_req, res) => {
    const summary = await dashboardService.getSummary();
    res.json({ data: summary });
  })
);

module.exports = router;
