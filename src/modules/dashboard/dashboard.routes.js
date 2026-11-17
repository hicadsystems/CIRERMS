'use strict';

const express = require('express');
const dashboardService = require('./dashboard.service');
const { requireAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();

router.get(
  '/summary',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const summary = await dashboardService.getSummary();
    res.json({ data: summary });
  })
);

module.exports = router;
