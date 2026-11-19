/*
 * app shell: the entry point of app.html. Checks the session and the person's privileges,
 * draws the chrome for each page (rail, top bar, module tabs, phone header, bottom bar) from
 * the navigation catalogue (core/nav.js), and hands each route to its screen: the page's
 * `view` in nav.js names the section file and the function that draws it, loaded when the
 * page opens. A page the person may not open shows the not-allowed state; the session lock
 * (shell/lock.js) covers everything while the session is locked.
 */
import { api } from '../core/api.js';
import { PAGES, describe } from '../core/nav.js';
import { setAccess, pageAllowed, homeHref, can } from '../core/access.js';
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
import { openChangePassword } from '../shell/password.js';
import { startLock } from '../shell/lock.js';
import { renderRail, isFolded, setFolded } from '../shell/rail.js';
import { renderModuleTabs } from '../shell/module-tabs.js';
import { renderPhone } from '../shell/phone.js';
import { openPalette, closePalette } from '../shell/search-palette.js';
import { openNewRating } from './rating-new.js';

/** The signed-in user ({ username, fullName, role, serviceNumber }); kept for older imports. */
export let currentSessionUser = null;

let currentInfo = null;

function mountSoon(outlet) {
  const info = currentInfo;
  const m = (info && info.module) || { icon: 'lock' };
  outlet.replaceChildren(pageHeader({ title: info ? info.title : 'Coming Soon' }), card({
    body: emptyState({
      icon: m.icon,
      title: 'Coming in a Later Release',
      action: button({ label: 'Go to Dashboard', icon: 'house', variant: 'outline', href: `#${homeHref() || 'dashboard'}` }),
    }),
    padded: false,
  }));
}

/** The not-allowed state: the page exists, but the person's role does not include it. */
function mountNotAllowed(outlet) {
  const info = currentInfo;
  const home = homeHref();
  outlet.replaceChildren(pageHeader({ title: info ? info.title : 'Not Allowed' }), card({
    body: emptyState({
      icon: 'lock',
      title: 'You Do Not Have Access to This Page',
      text: 'Your role does not include this screen. Ask the administrator if you need it.',
      action: home ? button({ label: 'Go to My Start Page', icon: 'house', variant: 'outline', href: `#${home}` }) : null,
    }),
    padded: false,
  }));
}

async function mountPage(page, outlet, ctx) {
  if (!pageAllowed(page)) {
    // the default address (#dashboard) goes to the person's first page instead
    const home = homeHref();
    if (page.pattern === 'dashboard' && home && home !== 'dashboard') {
      window.location.replace(`#${home}`);
      return null;
    }
    return mountNotAllowed(outlet);
  }
  if (page.screen === 'soon' || !page.view) return mountSoon(outlet);
  const { file, mount, props = {} } = page.view;
  const mod = await import(`./${file}`);
  if (typeof mod[mount] !== 'function') throw new Error(`${file} has no ${mount}().`);
  const { infoFrom, ...rest } = props;
  return mod[mount](outlet, { ...ctx, info: infoFrom ? describe(infoFrom) : currentInfo, ...rest });
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
    if (can('ratings.new', 'add')) openNewRating();
  });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearch();
    }
  });
}

async function initAppShell() {
  let me;
  try {
    const res = await api.get('/api/auth/me');
    me = res.data;
  } catch (_) {
    window.location.replace('/index.html');
    return;
  }
  currentSessionUser = me.user;
  setUser(me.user);
  setAccess({ privileges: me.privileges, user: me.user });

  bindChrome();
  // a locked session shows the lock first; the page draws once it is unlocked
  await startLock(me.session || {});
  // a new or reset account chooses its own password before anything else opens
  while (me.user.mustChangePassword) {
    if (await openChangePassword({ forced: true })) me.user.mustChangePassword = false;
  }

  const routes = PAGES.map((page) => ({ pattern: page.pattern, mount: (outlet, ctx) => mountPage(page, outlet, ctx) }));
  startRouter({
    routes,
    outlet: document.getElementById('app-main'),
    onRouteActivated: (route, params, query, path) => drawChrome(path),
  });
}

initAppShell();
