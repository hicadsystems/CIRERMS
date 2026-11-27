'use strict';

/*
 * The installable app's server side: the service worker with this deployment's version filled in.
 * The version is the package version and a short hash of every static file's path, size and time, so a
 * new deployment (or a changed file) gives a new worker and the browser replaces the old cache.
 * The list to cache holds the app's own static files only; see public/sw.js for what is never cached.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pkg = require('../package.json');
const config = require('./config');

const SKIP = /(^|\/)(\.|sw\.js$)|\.map$/;
let memo = null;

function walk(dir, base, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base + '/' + entry.name;
    if (SKIP.test(rel)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, rel, out);
    else out.push({ rel, stat: fs.statSync(full) });
  }
}

function build() {
  const files = [];
  walk(config.publicDir, '', files);
  files.sort((a, b) => (a.rel < b.rel ? -1 : 1));
  const hash = crypto.createHash('sha1');
  for (const f of files) hash.update(`${f.rel}:${f.stat.size}:${Math.floor(f.stat.mtimeMs)}\n`);
  const version = `${pkg.version}-${hash.digest('hex').slice(0, 10)}`;
  // pages are fetched from the network; only static files are stored (plus the offline page)
  const precache = files.map((f) => f.rel).filter((p) => !['/index.html', '/app.html', '/css/input.css'].includes(p));
  return { version, precache };
}

/** The worker's text for this deployment. Looked at again after 2 seconds so a changed file shows. */
function serviceWorkerSource() {
  const now = Date.now();
  if (!memo || now - memo.at > 2000) {
    const { version, precache } = build();
    const src = fs.readFileSync(path.join(config.publicDir, 'sw.js'), 'utf8')
      .replace("'__VERSION__'", JSON.stringify(version))
      .replace('= __PRECACHE__;', () => `= ${JSON.stringify(precache)};`);
    memo = { at: now, src };
  }
  return memo.src;
}

module.exports = { serviceWorkerSource };
