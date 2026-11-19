'use strict';

const express = require('express');
const usersService = require('./users.service');
const { requireAuth } = require('../../middleware/auth');
const { requirePrivilege } = require('../../middleware/access');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();

router.use(requireAuth);

// A one-time password is in the answer once and must not be kept by a cache.
const noStore = (res) => res.set('Cache-Control', 'no-store');

// GET /api/users?q=&roleId=&active=1|0&page=1
router.get('/', requirePrivilege('admin.users', 'view'), asyncHandler(async (req, res) => {
  const r = await usersService.list(req.query);
  res.json({ data: r.items, meta: { page: r.page, pageSize: r.pageSize, total: r.total, totalPages: r.totalPages } });
}));

router.get('/meta', requirePrivilege('admin.users', 'view'), asyncHandler(async (_req, res) => {
  res.json({ data: await usersService.meta() });
}));

// Manage Password: one account by official number or user name
router.get('/lookup', requirePrivilege('admin.password', 'view'), asyncHandler(async (req, res) => {
  res.json({ data: await usersService.lookup(req.query.q) });
}));

// Add Account's first step: find the rating the account is for
router.get('/ratings', requirePrivilege('admin.users', 'add'), asyncHandler(async (req, res) => {
  res.json({ data: await usersService.findRatings(req.query.q) });
}));

router.get('/:id', requirePrivilege('admin.users', 'view'), asyncHandler(async (req, res) => {
  res.json({ data: await usersService.get(req.params.id) });
}));

router.post('/', requirePrivilege('admin.users', 'add'), asyncHandler(async (req, res) => {
  noStore(res);
  res.status(201).json({ data: await usersService.create(req.body || {}, req.actor) });
}));

router.put('/:id', requirePrivilege('admin.users', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await usersService.update(req.params.id, req.body || {}, req.actor) });
}));

router.post('/:id/deactivate', requirePrivilege('admin.users', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await usersService.setActive(req.params.id, false, req.actor) });
}));

router.post('/:id/reactivate', requirePrivilege('admin.users', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await usersService.setActive(req.params.id, true, req.actor) });
}));

router.post('/:id/reset-password', requirePrivilege('admin.password', 'edit'), asyncHandler(async (req, res) => {
  noStore(res);
  res.json({ data: await usersService.resetPassword(req.params.id, req.actor) });
}));

module.exports = router;
