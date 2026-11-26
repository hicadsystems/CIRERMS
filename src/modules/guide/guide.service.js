'use strict';

/*
 * The guide for one signed-in person: contents, a chapter, the search, a picture's file and the book's data,
 * each cut to their privileges (guide.cut.js). A cut is kept per set of privileges until the chapters change
 * (a role change shows at the next request, as grants do everywhere).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./guide.store');
const { cutAll, contents } = require('./guide.cut');
const { search } = require('./guide.search');
const { notFound } = require('../../shared/errors');

const cache = new Map();

/** The chapters cut for this person. */
function cutFor(user) {
  const guide = store.get();
  const key = crypto.createHash('sha1').update([...(user.privileges || [])].sort().join('|')).digest('hex');
  const hit = cache.get(key);
  if (hit && hit.version === guide.version) return hit.cut;
  const cut = cutAll(guide.chapters, user);
  cut.specs = new Map(guide.chapters.map((c) => [c.slug, c.shots]));
  if (cache.size > 200) cache.clear();
  cache.set(key, { version: guide.version, cut });
  return cut;
}

const listContents = (user) => ({ chapters: contents(cutFor(user)) });

/** A PNG's width and height in pixels, from its header, or null when the file is not there. */
function pngSize(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const head = Buffer.alloc(24);
    fs.readSync(fd, head, 0, 24, 0);
    fs.closeSync(fd);
    return head.toString('latin1', 1, 4) === 'PNG' ? { w: head.readUInt32BE(16), h: head.readUInt32BE(20) } : null;
  } catch (_) {
    return null;
  }
}

const pictureFileOf = (chapterSlug, shot, device, theme) => path.join(store.imgDir, chapterSlug, `${shot}.${device}.${theme}.png`);

function chapterFor(user, slug) {
  const chapter = cutFor(user).chapters.find((c) => c.slug === slug);
  if (!chapter) throw notFound('This chapter is not in your guide.', 'GUIDE_NOT_FOUND');
  // each picture's size per device (its shape, so the page keeps its place while the pictures load); none until it is taken
  const pictures = {};
  Object.entries(chapter.pictures).forEach(([id, spec]) => {
    const size = {};
    spec.devices.forEach((d) => { size[d] = pngSize(pictureFileOf(slug, id, d, 'light')); });
    pictures[id] = { ...spec, size };
  });
  return { ...chapter, pictures };
}

/** Where a section or task lives, for opening the guide at an address: { chapter, anchor }. */
function locate(user, anchor) {
  const hit = cutFor(user).anchors.get(anchor);
  if (!hit) throw notFound('This part is not in your guide.', 'GUIDE_NOT_FOUND');
  return { chapter: hit.chapter.slug, anchor };
}

const searchFor = (user, q) => ({ results: search(cutFor(user), q) });

/** The picture's file, only when the chapter the person receives shows it (and was taken for that device and theme). */
function pictureFile(user, chapterSlug, shot, device, theme) {
  const chapter = cutFor(user).chapters.find((c) => c.slug === chapterSlug);
  const spec = chapter && chapter.pictures[shot];
  if (!spec || !spec.devices.includes(device)) throw notFound('This picture is not in your guide.', 'GUIDE_NOT_FOUND');
  const file = pictureFileOf(chapterSlug, shot, device, theme);
  if (!fs.existsSync(file)) throw notFound('This picture has not been taken yet.', 'GUIDE_NOT_FOUND');
  return file;
}

module.exports = { pngSize, cutFor, listContents, chapterFor, locate, searchFor, pictureFile };
