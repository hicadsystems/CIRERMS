'use strict';

/*
 * The User Guide's routes. Each is open to every signed-in, unlocked person (no privilege of its own, as Change
 * Password's) and sends only the parts of the guide that person's privileges allow.
 *
 *   GET /api/guide                          the contents
 *   GET /api/guide/chapters/:slug           one chapter
 *   GET /api/guide/where/:anchor            the chapter that holds a section or task (for #guide/<anchor>)
 *   GET /api/guide/search?q=                words, at least 2 characters, 25 results
 *   GET /api/guide/pictures/:chapter/:shot?device=desktop|phone&theme=light|dark
 *   GET /api/guide/book                     the PDF book
 */
const express = require('express');
const service = require('./guide.service');
const { buildBook } = require('./guide.book');
const { requireAuth } = require('../../middleware/auth');
const { asyncHandler, badRequest } = require('../../shared/errors');
const { DEVICES, THEMES } = require('./guide.format');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  res.json({ data: service.listContents(req.user) });
}));

router.get('/chapters/:slug', asyncHandler(async (req, res) => {
  res.json({ data: service.chapterFor(req.user, req.params.slug) });
}));

router.get('/where/:anchor', asyncHandler(async (req, res) => {
  res.json({ data: service.locate(req.user, req.params.anchor) });
}));

router.get('/search', asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) throw badRequest('Type at least 2 characters to search the guide.', 'SEARCH_TOO_SHORT');
  res.json({ data: service.searchFor(req.user, q) });
}));

router.get('/pictures/:chapter/:shot', asyncHandler(async (req, res) => {
  const { device = 'desktop', theme = 'light' } = req.query;
  if (!DEVICES.includes(device) || !THEMES.includes(theme)) throw badRequest('A picture is for the desktop or the phone, in the light or the dark theme.');
  const file = service.pictureFile(req.user, req.params.chapter, req.params.shot, device, theme);
  // the file is retaken whenever its screen changes: always ask the server whether it is still the same
  res.sendFile(file, { dotfiles: 'deny', headers: { 'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff' } });
}));

router.get('/book', asyncHandler(async (req, res) => {
  const pdf = await buildBook(req.user);
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': 'inline; filename="CIRERMS-User-Guide.pdf"',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(pdf);
}));

module.exports = router;
