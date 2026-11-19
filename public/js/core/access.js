/*
 * access: what the signed-in person may open and do. The shell fills it from /api/auth/me
 * before the first page draws; every screen, menu and button asks it. A privilege is one
 * action on one screen: the screen id from core/nav.js and view, add, edit, delete or
 * approve. The server checks the same privileges on every route; hiding is for the person.
 *
 *   can(screen, action = 'view')   true when the person's role holds it
 *   pageAllowed(page)              a PAGES entry: may it be opened (page.action, default view)
 *   moduleVisible(m)               a module from AREAS: shown in the rail, More and search
 *   moduleHref(m)                  the first page of the module the person may open
 *   visibleTabs(m)                 the module's tabs the person may open
 *   homeHref()                     the first page the person may open (Dashboard if allowed)
 *   hasFullAccess()                the Administrator (sees the Soon modules too)
 */
import { AREAS, PAGES, matchPattern } from './nav.js';

let granted = {};
let fullAccess = false;

export function setAccess({ privileges = {}, user = {} } = {}) {
  granted = privileges || {};
  fullAccess = !!(user && user.fullAccess);
}

export const hasFullAccess = () => fullAccess;

export function can(screen, action = 'view') {
  return Array.isArray(granted[screen]) && granted[screen].includes(action);
}

export function pageAllowed(page) {
  if (!page) return false;
  if (page.screen === 'soon') return fullAccess;
  return can(page.screen, page.action || 'view');
}

const pageFor = (route) => PAGES.find((p) => matchPattern(p.pattern, route)) || null;

export function visibleTabs(m) {
  return (m.tabs || []).filter((t) => pageAllowed(pageFor(t.route)));
}

export function moduleVisible(m) {
  if (m.soon) return fullAccess;
  if (m.tabs && m.tabs.length) return visibleTabs(m).length > 0;
  return pageAllowed(pageFor(m.href));
}

export function moduleHref(m) {
  if (m.soon) return `soon/${m.key}`;
  if (m.tabs && m.tabs.length) {
    if (pageAllowed(pageFor(m.href))) return m.href;
    const first = visibleTabs(m)[0];
    return first ? first.route : m.href;
  }
  return m.href;
}

export function homeHref() {
  for (const area of AREAS) {
    for (const m of area.modules) {
      if (!m.soon && moduleVisible(m)) return moduleHref(m);
    }
  }
  return null;
}
