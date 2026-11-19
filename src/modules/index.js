'use strict';

/*
 * Module registration. Every folder under src/modules with a manifest
 * (<module>/<module>.module.js) is mounted by the server; nothing else is edited to add a
 * module. A manifest:
 *
 *   module.exports = {
 *     key: 'drafting',                 // the folder name
 *     label: 'Drafting',               // the module's name in the privilege catalogue
 *     basePath: '/api/drafting',       // where its router is mounted
 *     routes: './drafting.routes',     // its router, relative to the manifest
 *     order: 100,                      // optional: mount and catalogue order (lower first)
 *     public: false,                   // optional: true only for routes that guard themselves (auth)
 *     privileges: [                    // the screens (ids from public/js/core/nav.js) and actions
 *       { screen: 'drafting.proposal', label: 'Print Draft Proposal', actions: ['view', 'add'] },
 *     ],
 *   };
 *
 * At mount, every route of a module that is not public must carry a privilege check
 * (middleware/access.js), on the route or on the router before it: a route without one stops
 * the server from starting. The privileges of every manifest form the catalogue, synced into
 * the privileges table when the seeds run and when the server starts.
 */
const fs = require('fs');
const path = require('path');
const { ACTIONS } = require('../middleware/access');

const MODULES_DIR = __dirname;

function validate(manifest, file) {
  const where = path.relative(process.cwd(), file);
  if (!manifest || typeof manifest !== 'object') throw new Error(`${where}: the manifest must export an object.`);
  if (!manifest.key || typeof manifest.key !== 'string') throw new Error(`${where}: "key" is required.`);
  if (manifest.basePath && !String(manifest.basePath).startsWith('/api/')) {
    throw new Error(`${where}: "basePath" must start with /api/.`);
  }
  for (const p of manifest.privileges || []) {
    if (!p || typeof p.screen !== 'string' || !/^[a-z0-9-]+\.[a-z0-9.-]+$/.test(p.screen)) {
      throw new Error(`${where}: privilege screen "${p && p.screen}" must be a screen id (module.screen).`);
    }
    if (!p.label) throw new Error(`${where}: privilege ${p.screen} needs a label.`);
    if (!Array.isArray(p.actions) || !p.actions.length || p.actions.some((a) => !ACTIONS.includes(a))) {
      throw new Error(`${where}: privilege ${p.screen} actions must be some of ${ACTIONS.join(', ')}.`);
    }
  }
}

let cache = null;

/** Every manifest, in mount order. */
function loadManifests() {
  if (cache) return cache;
  const found = [];
  for (const entry of fs.readdirSync(MODULES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(MODULES_DIR, entry.name, `${entry.name}.module.js`);
    if (!fs.existsSync(file)) continue;
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const manifest = require(file);
    validate(manifest, file);
    found.push({ ...manifest, dir: path.dirname(file), order: manifest.order ?? 100 });
  }
  found.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  cache = found;
  return found;
}

/** Throws when a route of the router has no privilege check before its handler. */
function assertGuarded(manifest, router) {
  let routerGuarded = false;
  for (const layer of router.stack || []) {
    if (!layer.route) {
      if (layer.handle && layer.handle.privileges) routerGuarded = true;
      continue;
    }
    const guarded = routerGuarded || layer.route.stack.some((l) => l.handle && l.handle.privileges);
    if (!guarded) {
      const methods = Object.keys(layer.route.methods).map((m) => m.toUpperCase()).join(',');
      throw new Error(
        `Module "${manifest.key}": ${methods} ${manifest.basePath}${layer.route.path} has no privilege check. `
        + 'Add requirePrivilege(screen, action) from src/middleware/access.js.'
      );
    }
  }
}

/** Mounts every module's router on the app. */
function mountModules(app) {
  const mounted = [];
  for (const manifest of loadManifests()) {
    if (!manifest.routes || !manifest.basePath) continue;
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const router = require(path.resolve(manifest.dir, manifest.routes));
    if (!manifest.public) assertGuarded(manifest, router);
    app.use(manifest.basePath, router);
    mounted.push({ key: manifest.key, basePath: manifest.basePath });
  }
  return mounted;
}

/** The privilege catalogue: one entry per screen and action, in a stable order. */
function privilegeCatalogue() {
  const out = [];
  const seen = new Set();
  loadManifests().forEach((m, mi) => {
    (m.privileges || []).forEach((p, pi) => {
      p.actions.forEach((action) => {
        const key = `${p.screen}:${action}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({
          screen: p.screen,
          action,
          moduleLabel: p.module || m.label || m.key,
          screenLabel: p.label,
          sortOrder: (mi + 1) * 1000 + pi * 10 + ACTIONS.indexOf(action),
        });
      });
    });
  });
  return out;
}

module.exports = {
  loadManifests,
  mountModules,
  privilegeCatalogue,
};
