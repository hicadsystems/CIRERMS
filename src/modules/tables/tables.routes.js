'use strict';

/*
 * /api/tables/<slug>: one set of routes per table in tables.config.js, each guarded by that
 * table's own privilege (screen `tables.<slug>`: view, add, edit, delete).
 *
 *   GET    /api/tables/<slug>/meta   the columns and dropdown rows the dialog needs      (view)
 *   GET    /api/tables/<slug>        ?q=&status=&page=   25 rows a page                  (view)
 *   GET    /api/tables/<slug>/print  ?q=&status=   the list as a PDF (Print List)           (view)
 *   GET    /api/tables/<slug>/:id    one row, and where it is used                       (view)
 *   POST   /api/tables/<slug>                                                            (add)
 *   PUT    /api/tables/<slug>/:id                                                        (edit)
 *   DELETE /api/tables/<slug>/:id    refused with 409 IN_USE when anything refers to it  (delete)
 */
const express = require('express');
const service = require('./tables.service');
const { TABLES } = require('./tables.config');
const { requireAuth } = require('../../middleware/auth');
const { requirePrivilege } = require('../../middleware/access');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();
router.use(requireAuth);

for (const t of TABLES) {
  const screen = `tables.${t.slug}`;
  const base = `/${t.slug}`;

  router.get(`${base}/meta`, requirePrivilege(screen, 'view'), asyncHandler(async (_req, res) => {
    res.json({ data: await service.getMeta(t.slug) });
  }));

  // the list as a PDF (Print List), following the search and status filter; before `/:id`
  router.get(`${base}/print`, requirePrivilege(screen, 'view'), asyncHandler(async (req, res) => {
    const out = await service.printList(t.slug, req.query, req.user.fullName || req.user.username);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${out.fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(out.buffer);
  }));

  router.get(base, requirePrivilege(screen, 'view'), asyncHandler(async (req, res) => {
    const r = await service.list(t.slug, req.query);
    res.json({ data: r.items, meta: { total: r.total, page: r.page, pageSize: r.pageSize, totalPages: r.totalPages } });
  }));

  router.get(`${base}/:id`, requirePrivilege(screen, 'view'), asyncHandler(async (req, res) => {
    res.json({ data: await service.get(t.slug, req.params.id) });
  }));

  router.post(base, requirePrivilege(screen, 'add'), asyncHandler(async (req, res) => {
    res.status(201).json({ data: await service.create(t.slug, req.body, req.actor) });
  }));

  router.put(`${base}/:id`, requirePrivilege(screen, 'edit'), asyncHandler(async (req, res) => {
    res.json({ data: await service.update(t.slug, req.params.id, req.body, req.actor) });
  }));

  router.delete(`${base}/:id`, requirePrivilege(screen, 'delete'), asyncHandler(async (req, res) => {
    res.json({ data: await service.remove(t.slug, req.params.id, req.actor) });
  }));
}

module.exports = router;
