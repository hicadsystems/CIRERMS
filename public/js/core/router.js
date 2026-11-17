import { clear, el } from './dom.js';

const templateCache = new Map();
let activeCleanup = null;
let routeTable = [];
let currentNavSync = null;

async function fetchTemplate(partialPath) {
  if (templateCache.has(partialPath)) {
    return templateCache.get(partialPath);
  }
  const res = await fetch(partialPath, { credentials: 'same-origin' });
  if (!res.ok) {
    throw new Error(`Failed to load view template: ${partialPath}`);
  }
  const html = await res.text();
  templateCache.set(partialPath, html);
  return html;
}

function matchRoute(hashPath) {
  const clean = (hashPath || '').replace(/^#\/?/, '').trim() || 'dashboard';
  const [pathPart, queryPart] = clean.split('?');
  const segments = pathPart.split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(queryPart || ''));

  for (const route of routeTable) {
    const patternSegments = route.pattern.split('/').filter(Boolean);
    if (patternSegments.length !== segments.length) continue;

    const params = {};
    let matched = true;
    for (let i = 0; i < patternSegments.length; i += 1) {
      const pat = patternSegments[i];
      const seg = segments[i];
      if (pat.startsWith(':')) {
        params[pat.slice(1)] = decodeURIComponent(seg);
      } else if (pat !== seg) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return { route, params, query, rawPath: pathPart };
    }
  }

  return null;
}

export function navigate(hash) {
  const target = hash.startsWith('#') ? hash : `#${hash}`;
  if (window.location.hash === target) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

export function startRouter({ routes, outlet, onRouteActivated }) {
  routeTable = routes;
  currentNavSync = onRouteActivated;

  let navCounter = 0;

  async function resolveCurrentHash() {
    const token = ++navCounter;
    const match = matchRoute(window.location.hash);

    if (!match) {
      window.location.replace('#dashboard');
      return;
    }

    if (typeof activeCleanup === 'function') {
      try {
        activeCleanup();
      } catch (_) {
        // Ignore cleanup error
      }
      activeCleanup = null;
    }

    const { route, params, query } = match;
    if (typeof currentNavSync === 'function') {
      currentNavSync(route, params, query);
    }

    clear(outlet);
    outlet.appendChild(
      el('div', { className: 'py-12 text-center text-sm text-gray-500', text: 'Loading section...' })
    );

    try {
      const html = await fetchTemplate(route.template);
      if (token !== navCounter) return;

      // Templates come strictly from static server-hosted /sections/*.html files
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(html, 'text/html');
      clear(outlet);
      while (parsedDoc.body.firstChild) {
        outlet.appendChild(parsedDoc.body.firstChild);
      }

      const cleanup = await route.mount(outlet, { params, query, route });
      if (token === navCounter && typeof cleanup === 'function') {
        activeCleanup = cleanup;
      }
    } catch (err) {
      if (token !== navCounter) return;
      clear(outlet);
      outlet.appendChild(
        el('div', { className: 'rounded bg-red-50 border border-red-200 p-5 text-sm text-red-700' }, [
          el('p', { className: 'font-semibold mb-1', text: 'Unable to load screen' }),
          el('p', { text: err.message || 'Unexpected error.' }),
        ])
      );
    }
  }

  window.addEventListener('hashchange', resolveCurrentHash);
  resolveCurrentHash();
}
