'use strict';

const express = require('express');
const lookupsService = require('./lookups.service');
const { requireAuth } = require('../../middleware/auth');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const data = await lookupsService.getAllLookups();
    res.json({ data });
  })
);

router.get(
  '/denominations',
  asyncHandler(async (req, res) => {
    const items = await lookupsService.getDenominations(req.query.religionId);
    res.json({ data: items });
  })
);

router.get(
  '/lgas',
  asyncHandler(async (req, res) => {
    const items = await lookupsService.getLocalGovernments(req.query.stateId);
    res.json({ data: items });
  })
);

module.exports = router;
