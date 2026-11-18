/*
 * app shell: the entry point of app.html. Checks the session, draws the
 * chrome for each page (rail, top bar, module tabs, phone header, bottom bar)
 * from the navigation catalogue (core/nav.js), puts the page header at the top
 * of the outlet, and hands each route to its screen.
 */
import { api } from '../core/api.js';
import { describe } from '../core/nav.js';
import { openSearch } from '../core/search.js';
import { startRouter } from '../core/router.js';
import { pageHeader } from '../ui/page-header.js';
import { button } from '../ui/button.js';
import { card } from '../ui/card.js';
import { emptyState } from '../ui/empty-state.js';
import { closeAllDialogs } from '../ui/dialog.js';
import { closeMenus } from '../ui/menu.js';
import { setUser } from '../shell/session.js';
import { renderRail, isFolded, setFolded } from '../shell/rail.js';
import { renderModuleTabs } from '../shell/module-tabs.js';
import { renderPhone } from '../shell/phone.js';
import { mountDashboard } from './dashboard.js';
import { mountRatingsList } from './ratings-list.js';
import { mountRatingsUpload } from './ratings-upload.js';
import { mountRatingsDocuments } from './ratings-documents.js';
import { mountRatingsProfile } from './ratings-profile.js';

/** The signed-in user ({ username, fullName, role, serviceNumber }); kept for older imports. */
export let currentSessionUser = null;

// Each route's screen. Titles, modules and tabs live in core/nav.js.
const SCREENS = {
  dashboard: { template: '/sections/dashboard/home.html', mount: mountDashboard },
  'ratings/current': { template: '/sections/ratings/list.html', mount: (o, ctx) => mountRatingsList(o, { ...ctx, status: 'current' }) },
  'ratings/former': { template: '/sections/ratings/list.html', mount: (o, ctx) => mountRatingsList(o, { ...ctx, status: 'former' }) },
  'ratings/new': { template: '/sections/ratings/profile.html', mount: (o, ctx) => mountRatingsProfile(o, { ...ctx, mode: 'create' }) },
  'ratings/edit/:serviceNumber': { template: '/sections/ratings/profile.html', mount: (o, ctx) => mountRatingsProfile(o, { ...ctx, mode: 'edit' }) },
  'ratings/my-details': { template: '/sections/ratings/profile.html', mount: (o, ctx) => mountRatingsProfile(o, { ...ctx, mode: 'readonly' }) },
  'ratings/upload': { template: '/sections/ratings/upload.html', mount: mountRatingsUpload },
  'ratings/documents': { template: '/sections/ratings/documents.html', mount: mountRatingsDocuments },
  'ratings/documents/:serviceNumber': { template: '/sections/ratings/documents.html', mount: mountRatingsDocuments },
  'soon/:key': { template: null, mount: mountSoon },
};

// Buttons a page's header carries (until step 4 rebuilds the screens with their own).
function headerActions(info) {
  if (info.path === 'dashboard') {
    return [button({ label: 'New Rating', icon: 'user-plus', variant: 'primary', href: '#ratings/new' })];
  }
  if (info.path === 'ratings/current' || info.path === 'ratings/former') {
    return [button({ label: 'New Rating', icon: 'user-plus', variant: 'primary', href: '#ratings/new' })];
  }
  return null;
}

let currentInfo = null;

function mountSoon(outlet) {
  const info = currentInfo;
  const m = (info && info.module) || { icon: 'lock' };
  outlet.appendChild(card({
    body: emptyState({
      icon: m.icon,
      title: 'Coming in a Later Release',
      action: button({ label: 'Go to Dashboard', icon: 'house', variant: 'outline', href: '#dashboard' }),
    }),
    padded: false,
  }));
}

function drawChrome(path) {
  const info = describe(path);
  currentInfo = info;
  closeMenus();
  closeAllDialogs();
  renderRail(info);
  renderModuleTabs(info);
  renderPhone(info);
  document.title = info ? `${info.title} · CIRERMS` : 'CIRERMS';
  const page = document.getElementById('page');
  if (page) page.scrollTop = 0;
}

function syncToggle() {
  const t = document.getElementById('rail-toggle');
  if (!t) return;
  const folded = isFolded();
  t.setAttribute('aria-expanded', String(!folded));
  t.setAttribute('aria-label', folded ? 'Unfold Menu' : 'Fold Menu');
}

function bindChrome() {
  document.getElementById('rail-toggle')?.addEventListener('click', () => {
    setFolded(!isFolded());
    syncToggle();
  });
  syncToggle();
  document.getElementById('search-open')?.addEventListener('click', () => openSearch());
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearch();
    }
  });
}

async function initAppShell() {
  try {
    const res = await api.get('/api/auth/me');
    currentSessionUser = res.data.user;
    setUser(currentSessionUser);
  } catch (_) {
    window.location.replace('/index.html');
    return;
  }

  bindChrome();

  const routes = Object.entries(SCREENS).map(([pattern, s]) => ({ pattern, ...s }));
  startRouter({
    routes,
    outlet: document.getElementById('app-main'),
    onRouteActivated: (route, params, query, path) => drawChrome(path),
    beforeMount: (outlet) => {
      const info = currentInfo;
      if (!info) return;
      outlet.prepend(pageHeader({
        title: info.title,
        subtitle: info.subtitle,
        actions: headerActions(info),
        // as in the demo: the dashboard's New Rating stretches on a phone; the lists use the button bottom right
        phoneActions: info.path === 'dashboard' ? 'stretch' : 'hide',
      }));
    },
  });
}

initAppShell();
