/*
 * router: hash routes (#ratings/current). Loads a page's section template
 * (sections/<module>/<screen>.html) into the outlet and runs its mount
 * function; a mount may return a cleanup function, run before the next page.
 *
 *   startRouter({ routes, outlet, onRouteActivated, beforeMount })
 *     routes            [{ pattern, template, mount }] (patterns as in core/nav.js PAGES)
 *     onRouteActivated(route, params, query, path)   before the page loads (the shell redraws its chrome)
 *     beforeMount(outlet, ctx)   after the template is in, before mount (the shell adds the page header)
 *   navigate('#ratings/current')   goes there (reloads the page if already there)
 */
import { clear, el } from './dom.js';
import { matchPattern, parseHash } from './nav.js';
import { icon } from './icons.js';

const templateCache = new Map();
let activeCleanup = null;
let routeTable = [];

async function fetchTemplate(partialPath) {
  if (templateCache.has(partialPath)) return templateCache.get(partialPath);
  const res = await fetch(partialPath, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Failed to load view template: ${partialPath}`);
  const html = await res.text();
  templateCache.set(partialPath, html);
  return html;
}

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

export function startRouter({ routes, outlet, onRouteActivated, beforeMount }) {
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

    clear(outlet);
    outlet.appendChild(el('div', { className: 'flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground' }, [icon('loader-circle', 'icon animate-spin'), 'Loading']));

    try {
      const html = route.template ? await fetchTemplate(route.template) : '';
      if (token !== navCounter) return;

      // Templates come strictly from static server-hosted /sections/*.html files
      const parsedDoc = new DOMParser().parseFromString(html, 'text/html');
      clear(outlet);
      while (parsedDoc.body.firstChild) outlet.appendChild(parsedDoc.body.firstChild);

      const ctx = { params, query, route };
      if (typeof beforeMount === 'function') beforeMount(outlet, ctx);
      const cleanup = route.mount ? await route.mount(outlet, ctx) : null;
      if (token === navCounter && typeof cleanup === 'function') activeCleanup = cleanup;
    } catch (err) {
      if (token !== navCounter) return;
      clear(outlet);
      outlet.appendChild(el('div', { className: 'rounded-card border border-error/30 bg-error-soft p-5 text-sm text-error' }, [
        el('p', { className: 'mb-1 font-semibold', text: 'Unable to Load This Page' }),
        el('p', { text: err.message || 'Unexpected error.' }),
      ]));
    }
  }

  window.addEventListener('hashchange', resolveCurrentHash);
  resolveCurrentHash();
}
