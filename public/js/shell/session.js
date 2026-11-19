/*
 * session: who is signed in, and signing out. The shell fills it from
 * /api/auth/me before the first page draws.
 *
 *   getUser()   { username, fullName, role, roleId, fullAccess, serviceNumber } or null
 *   roleLabel(user)   the role's name ('Administrator', 'Rating', ...)
 *   signOut()   ends the session on the server, signs out the other tabs and returns to the sign-in page
 *   accountItems()   the account menu: View My Details (when allowed), Lock Screen,
 *                    Dark Mode / Light Mode, Sign Out
 */
import { api, setFallbackToken } from '../core/api.js';
import { can } from '../core/access.js';
import { currentTheme, toggleTheme } from '../core/theme.js';
import { lockScreen, announceSignOut } from './lock.js';

let user = null;

export const getUser = () => user;
export function setUser(u) { user = u; }

export function roleLabel(u) {
  return String((u && u.role) || 'User');
}

export async function signOut() {
  try {
    await api.post('/api/auth/logout', undefined, { skipAuthRedirect: true });
  } catch (_) {
    // the session ends on this side either way
  }
  setFallbackToken(null);
  announceSignOut();
  window.location.href = '/index.html';
}

export function accountItems() {
  return [
    can('ratings.my-details') ? { label: 'View My Details', icon: 'user-round', href: '#ratings/my-details' } : null,
    { label: 'Lock Screen', icon: 'lock-keyhole', onSelect: () => lockScreen('manual') },
    currentTheme() === 'dark'
      ? { label: 'Light Mode', icon: 'sun', onSelect: toggleTheme }
      : { label: 'Dark Mode', icon: 'moon', onSelect: toggleTheme },
    { divider: true },
    { label: 'Sign Out', icon: 'log-out', tone: 'danger', onSelect: signOut },
  ].filter(Boolean);
}
