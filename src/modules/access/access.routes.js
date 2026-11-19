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

// The roles, 25 a page (q matches name or description), with their user counts and privileges.
router.get(
  '/roles',
  requirePrivilege('admin.roles', 'view'),
  asyncHandler(async (req, res) => {
    const r = await accessService.listRoles(req.query);
    res.json({ data: r.items, meta: { page: r.page, pageSize: r.pageSize, total: r.total, totalPages: r.totalPages } });
  })
);

router.get(
  '/roles/:id',
  requirePrivilege('admin.roles', 'view'),
  asyncHandler(async (req, res) => {
    res.json({ data: await accessService.getRole(req.params.id) });
  })
);

router.post(
  '/roles',
  requirePrivilege('admin.roles', 'add'),
  asyncHandler(async (req, res) => {
    res.status(201).json({ data: await accessService.createRole(req.body || {}, req.actor) });
  })
);

router.put(
  '/roles/:id',
  requirePrivilege('admin.roles', 'edit'),
  asyncHandler(async (req, res) => {
    res.json({ data: await accessService.updateRole(req.params.id, req.body || {}, req.actor) });
  })
);

router.delete(
  '/roles/:id',
  requirePrivilege('admin.roles', 'delete'),
  asyncHandler(async (req, res) => {
    res.json({ data: await accessService.deleteRole(req.params.id, req.actor) });
  })
);

module.exports = router;
