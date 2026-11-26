'use strict';

/*
 * The navigation catalogue (public/js/core/nav.js) read on the server, so the guide knows which
 * screen each address opens and which privilege that needs. The file is plain ES module source with
 * no imports; its `export` keywords are dropped and it is run once in an isolated context. There is
 * one catalogue: a page added there is known to the guide at once.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const config = require('../../config');

let cached = null;

function load() {
  if (cached) return cached;
  const source = fs.readFileSync(path.join(config.publicDir, 'js', 'core', 'nav.js'), 'utf8').replace(/^export /gm, '');
  const context = vm.createContext({});
  vm.runInContext(`${source}\n;this.result = { AREAS, PAGES, matchPattern };`, context, { filename: 'nav.js' });
  cached = context.result;
  return cached;
}

/** The page an address opens ("disciplinary/pending", no #), or null. */
function pageFor(route) {
  const { PAGES, matchPattern } = load();
  const clean = String(route || '').replace(/^#\/?/, '').split('?')[0];
  return PAGES.find((p) => matchPattern(p.pattern, clean)) || null;
}

/** The action that opens a screen: the one its page asks for (view when it says nothing). */
function openAction(screen) {
  const page = load().PAGES.find((p) => p.screen === screen);
  return page ? page.action || 'view' : 'view';
}

/** Every screen id that has a page. */
const screens = () => new Set(load().PAGES.map((p) => p.screen).filter((s) => s !== 'soon'));

/** The module (key, label, icon) that holds a screen's page, or null. */
function moduleOf(screen) {
  const { AREAS, PAGES } = load();
  const page = PAGES.find((p) => p.screen === screen);
  if (!page || typeof page.module !== 'string') return null;
  for (const area of AREAS) {
    const m = area.modules.find((x) => x.key === page.module);
    if (m) return { key: m.key, label: m.label, icon: m.icon };
  }
  return null;
}

module.exports = { pageFor, openAction, screens, moduleOf };
