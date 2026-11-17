import { api, setFallbackToken } from '../core/api.js';
import { showToast } from '../core/dom.js';
import { startRouter } from '../core/router.js';
import { mountDashboard } from './dashboard.js';
import { mountRatingsList } from './ratings-list.js';
import { mountRatingsUpload } from './ratings-upload.js';
import { mountRatingsDocuments } from './ratings-documents.js';
import { mountRatingsProfile } from './ratings-profile.js';

export let currentSessionUser = null;

function syncNavigationUI(route, params) {
  const heading = document.getElementById('page-heading');
  const bcParent = document.getElementById('breadcrumb-parent');
  const bcCurrent = document.getElementById('breadcrumb-current');

  const resolvedTitle = typeof route.title === 'function' ? route.title(params) : route.title;
  const resolvedCrumb = typeof route.crumb === 'function' ? route.crumb(params) : route.crumb || resolvedTitle;

  if (heading) heading.textContent = resolvedTitle;
  if (bcParent) bcParent.textContent = route.parentCrumb || 'Ratings Management';
  if (bcCurrent) bcCurrent.textContent = resolvedCrumb;
  document.title = `${resolvedTitle} — Nigerian Navy CIRERMS`;

  // Highlight Dashboard vs Ratings Management sub-links
  const dashLink = document.querySelector('[data-nav-route="dashboard"]');
  if (dashLink) {
    if (route.navKey === 'dashboard') {
      dashLink.className = 'nav-top-link flex items-center gap-2.5 rounded px-3 py-2 font-medium transition bg-cirerms-pill text-white shadow-sm';
    } else {
      dashLink.className = 'nav-top-link flex items-center gap-2.5 rounded px-3 py-2 font-medium transition text-white/90 hover:bg-white/10 hover:text-white';
    }
  }

  document.querySelectorAll('[data-sub-route]').forEach((link) => {
    const isActive = link.dataset.subRoute === route.navKey;
    if (isActive) {
      link.className = 'nav-sub-link flex items-center gap-2 px-3 py-1.5 rounded text-cirerms-teal font-semibold bg-white/10 transition';
    } else {
      link.className = 'nav-sub-link flex items-center gap-2 px-3 py-1.5 rounded text-white/90 hover:text-white hover:bg-white/10 transition';
    }
  });
}

async function initAppShell() {
  try {
    const res = await api.get('/api/auth/me');
    currentSessionUser = res.data.user;
  } catch (_) {
    window.location.replace('/index.html');
    return;
  }

  const headerUsername = document.getElementById('header-username');
  const menuFullname = document.getElementById('menu-fullname');
  const menuRole = document.getElementById('menu-role');

  if (headerUsername) headerUsername.textContent = currentSessionUser.username;
  if (menuFullname) menuFullname.textContent = currentSessionUser.fullName;
  if (menuRole) {
    menuRole.textContent = currentSessionUser.serviceNumber
      ? `Service No: ${currentSessionUser.serviceNumber}`
      : `Role: ${String(currentSessionUser.role || 'admin').toUpperCase()}`;
  }

  // Sidebar collapse toggle
  const sidebar = document.getElementById('app-sidebar');
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
  sidebarToggleBtn?.addEventListener('click', () => {
    sidebar?.classList.toggle('hidden');
  });

  // Ratings Management group expand/collapse
  const groupBtn = document.getElementById('ratings-group-toggle');
  const submenu = document.getElementById('ratings-submenu');
  const caret = document.getElementById('ratings-group-caret');
  groupBtn?.addEventListener('click', () => {
    const hidden = submenu.classList.toggle('hidden');
    groupBtn.setAttribute('aria-expanded', String(!hidden));
    caret?.classList.toggle('rotate-90', !hidden);
  });

  // Disabled out-of-scope modules notice
  document.querySelectorAll('[data-disabled-module]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modName = btn.dataset.disabledModule;
      showToast(
        `"${modName}" is disabled in this demo — scope is focused strictly on Ratings Management.`,
        'info'
      );
    });
  });

  // User dropdown menu
  const userMenuBtn = document.getElementById('user-menu-btn');
  const userMenuDropdown = document.getElementById('user-menu-dropdown');
  userMenuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    userMenuDropdown?.classList.toggle('hidden');
  });
  document.addEventListener('click', () => {
    userMenuDropdown?.classList.add('hidden');
  });

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (_) {
      // Ignore network error on logout
    }
    setFallbackToken(null);
    window.location.href = '/index.html';
  });

  const routes = [
    {
      pattern: 'dashboard',
      navKey: 'dashboard',
      title: 'Dashboard',
      parentCrumb: 'CIRERMS',
      crumb: 'Dashboard',
      template: '/sections/dashboard/home.html',
      mount: mountDashboard,
    },
    {
      pattern: 'ratings/current',
      navKey: 'ratings/current',
      title: 'Current Rating List',
      parentCrumb: 'Ratings Management',
      crumb: 'Current Ratings List',
      template: '/sections/ratings/list.html',
      mount: (outlet, ctx) => mountRatingsList(outlet, { ...ctx, status: 'current' }),
    },
    {
      pattern: 'ratings/former',
      navKey: 'ratings/former',
      title: 'Former Rating List',
      parentCrumb: 'Ratings Management',
      crumb: 'Former Ratings List',
      template: '/sections/ratings/list.html',
      mount: (outlet, ctx) => mountRatingsList(outlet, { ...ctx, status: 'former' }),
    },
    {
      pattern: 'ratings/new',
      navKey: 'ratings/new',
      title: 'Ratings Personal Details',
      parentCrumb: 'Ratings Management',
      crumb: 'New Ratings',
      template: '/sections/ratings/profile.html',
      mount: (outlet, ctx) => mountRatingsProfile(outlet, { ...ctx, mode: 'create' }),
    },
    {
      pattern: 'ratings/edit/:serviceNumber',
      navKey: 'ratings/current',
      title: 'Ratings Personal Details',
      parentCrumb: 'Ratings Management',
      crumb: (p) => `Edit Rating (${p.serviceNumber})`,
      template: '/sections/ratings/profile.html',
      mount: (outlet, ctx) => mountRatingsProfile(outlet, { ...ctx, mode: 'edit' }),
    },
    {
      pattern: 'ratings/my-details',
      navKey: 'ratings/my-details',
      title: 'My Service Details',
      parentCrumb: 'Ratings Management',
      crumb: 'View My Details',
      template: '/sections/ratings/profile.html',
      mount: (outlet, ctx) => mountRatingsProfile(outlet, { ...ctx, mode: 'readonly' }),
    },
    {
      pattern: 'ratings/upload',
      navKey: 'ratings/upload',
      title: 'Upload New Rates',
      parentCrumb: 'Ratings Management',
      crumb: 'Batch Upload',
      template: '/sections/ratings/upload.html',
      mount: mountRatingsUpload,
    },
    {
      pattern: 'ratings/documents',
      navKey: 'ratings/documents',
      title: 'VIEW RATINGS DOCUMENTS',
      parentCrumb: 'Navpers',
      crumb: 'View document',
      template: '/sections/ratings/documents.html',
      mount: mountRatingsDocuments,
    },
    {
      pattern: 'ratings/documents/:serviceNumber',
      navKey: 'ratings/documents',
      title: 'VIEW RATINGS DOCUMENTS',
      parentCrumb: 'Navpers',
      crumb: (p) => `View document (${p.serviceNumber})`,
      template: '/sections/ratings/documents.html',
      mount: mountRatingsDocuments,
    },
  ];

  const outlet = document.getElementById('app-main');
  startRouter({
    routes,
    outlet,
    onRouteActivated: syncNavigationUI,
  });
}

initAppShell();
