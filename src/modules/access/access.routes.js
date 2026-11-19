'use strict';

const express = require('express');
const accessService = require('./access.service');
const { requireAuth } = require('../../middleware/auth');
const { requirePrivilege } = require('../../middleware/access');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();

router.use(requireAuth);

// The privilege catalogue: every screen and action a role can be given.
router.get(
  '/privileges',
  requirePrivilege('admin.roles', 'view'),
  asyncHandler(async (_req, res) => {
    res.json({ data: await accessService.getCatalogue() });
  })
);

// The roles, with their user counts and privileges.
router.get(
  '/roles',
  requirePrivilege('admin.roles', 'view'),
  asyncHandler(async (_req, res) => {
    res.json({ data: await accessService.getRoles() });
  })
);

module.exports = router;
