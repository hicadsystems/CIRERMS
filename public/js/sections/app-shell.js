/*
 * app shell: the entry point of app.html. Checks the session, draws the
 * chrome for each page (rail, top bar, module tabs, phone header, bottom bar)
 * from the navigation catalogue (core/nav.js), hands each route to its screen
 * (each draws its own page header), and opens the Ctrl K search palette.
 */
import { api } from '../core/api.js';
import { describe } from '../core/nav.js';
import { openSearch, setSearchHandler } from '../core/search.js';
import { bindThemeButton } from '../core/theme.js';
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
import { openPalette, closePalette } from '../shell/search-palette.js';
import { mountDashboard } from './dashboard.js';
import { mountRatingsList } from './ratings-list.js';
import { mountRatingsUpload } from './ratings-upload.js';
import { mountRatingsDocuments } from './ratings-documents.js';
import { mountRatingRecord, mountMyDetails } from './rating-record.js';
import { openNewRating } from './rating-new.js';

/** The signed-in user ({ username, fullName, role, serviceNumber }); kept for older imports. */
export let currentSessionUser = null;

// Each route's screen; every screen draws its own page header. Titles, modules and tabs live in core/nav.js.
const list = (status, extra = {}) => (o, ctx) => mountRatingsList(o, { ...ctx, info: currentInfo, status, ...extra });
const SCREENS = {
  dashboard: mountDashboard,
  'ratings/current': list('current'),
  'ratings/former': list('former'),
  // New Rating is a dialog: this address opens it over the current list
  'ratings/new': (o, ctx) => mountRatingsList(o, { ...ctx, info: describe('ratings/current'), status: 'current', openNew: true }),
  'ratings/edit/:serviceNumber': mountRatingRecord,
  'ratings/my-details': mountMyDetails,
  'ratings/upload': mountRatingsUpload,
  'ratings/documents': mountRatingsDocuments,
  'ratings/documents/:serviceNumber': mountRatingsDocuments,
  'soon/:key': mountSoon,
};

let currentInfo = null;

function mountSoon(outlet) {
  const info = currentInfo;
  const m = (info && info.module) || { icon: 'lock' };
  outlet.replaceChildren(pageHeader({ title: info ? info.title : 'Coming Soon' }), card({
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
  closePalette();
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
  bindThemeButton(document.getElementById('theme-toggle'));
  document.getElementById('rail-toggle')?.addEventListener('click', () => {
    setFolded(!isFolded());
    syncToggle();
  });
  syncToggle();
  setSearchHandler(openPalette);
  document.getElementById('search-open')?.addEventListener('click', () => openSearch());
  // the phone's New Rating button opens the dialog where it is
  document.getElementById('fab')?.addEventListener('click', (e) => {
    e.preventDefault();
    openNewRating();
  });
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

  const routes = Object.entries(SCREENS).map(([pattern, mount]) => ({ pattern, template: null, mount }));
  startRouter({
    routes,
    outlet: document.getElementById('app-main'),
    onRouteActivated: (route, params, query, path) => drawChrome(path),
  });
}

initAppShell();
