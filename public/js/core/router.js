/*
 * router: hash routes (#ratings/current). Shows "Loading" in the outlet and
 * runs the route's mount function, which draws the screen (with the kit in
 * js/ui) into the outlet; a mount may return a cleanup function (or a promise
 * of one), run before the next page.
 *
 *   startRouter({ routes, outlet, onRouteActivated })
 *     routes            [{ pattern, mount(outlet, { params, query, route }) }] (patterns as in core/nav.js PAGES)
 *     onRouteActivated(route, params, query, path)   before the page draws (the shell redraws its chrome)
 *   navigate('#ratings/current')   goes there (draws the page again if already there)
 */
import { clear, el } from './dom.js';
import { matchPattern, parseHash } from './nav.js';
import { icon } from './icons.js';

let activeCleanup = null;
let routeTable = [];

function matchRoute(hash) {
  const { path, query } = parseHash(hash);
  for (const route of routeTable) {
    const params = matchPattern(route.pattern, path);
    if (params) return { route, params, query, rawPath: path };
  }
  return null;
}

export function navigate(hash) {
  const target = hash.startsWith('#') ? hash : `#${hash}`;
  if (window.location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = target;
}

export function startRouter({ routes, outlet, onRouteActivated }) {
  routeTable = routes;
  let navCounter = 0;

  async function resolveCurrentHash() {
    const token = ++navCounter;
    const match = matchRoute(window.location.hash);
    if (!match) {
      window.location.replace('#dashboard');
      return;
    }

    if (typeof activeCleanup === 'function') {
      try { activeCleanup(); } catch (_) { /* a page's cleanup must not stop the next page */ }
      activeCleanup = null;
    }

    const { route, params, query, rawPath } = match;
    if (typeof onRouteActivated === 'function') onRouteActivated(route, params, query, rawPath);

    // each visit draws into its own box, so a page still loading when it is left draws nowhere
    const page = el('div', {}, el('div', { className: 'flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground' }, [icon('loader-circle', 'icon animate-spin'), 'Loading']));
    clear(outlet);
    outlet.appendChild(page);

    try {
      const ctx = { params, query, route };
      const cleanup = route.mount ? await route.mount(page, ctx) : null;
      if (typeof cleanup !== 'function') return;
      // a page left before it finished drawing cleans up at once
      if (token === navCounter) activeCleanup = cleanup;
      else cleanup();
    } catch (err) {
      if (token !== navCounter) return;
      page.replaceChildren(el('div', { className: 'rounded-card border border-error/30 bg-error-soft p-5 text-sm text-error' }, [
        el('p', { className: 'mb-1 font-semibold', text: 'Unable to Load This Page' }),
        el('p', { text: err.message || 'Unexpected error.' }),
      ]));
    }
  }

  window.addEventListener('hashchange', resolveCurrentHash);
  resolveCurrentHash();
}
