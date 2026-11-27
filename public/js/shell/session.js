/*
 * session: who is signed in, and signing out. The shell fills it from
 * /api/auth/me before the first page draws.
 *
 *   getUser()   { username, fullName, role, roleId, fullAccess, serviceNumber } or null
 *   roleLabel(user)   the role's name ('Administrator', 'Rating', ...)
 *   signOut()   ends the session on the server, signs out the other tabs and returns to the sign-in page
 *   accountItems()   the account menu, in three groups: View My Details (when allowed), Change Password, Lock Screen;
 *                    Dark Mode / Light Mode, User Guide, Download App (only when the browser offers it); Sign Out
 */
import { api, setFallbackToken } from '../core/api.js';
import { can } from '../core/access.js';
import { currentTheme, toggleTheme } from '../core/theme.js';
import { lockScreen, announceSignOut } from './lock.js';
import { openChangePassword } from './password.js';
import { canInstall, promptInstall } from '../core/pwa.js';

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
    { label: 'Change Password', icon: 'key-round', onSelect: () => openChangePassword() },
    { label: 'Lock Screen', icon: 'lock-keyhole', onSelect: () => lockScreen('manual') },
    { divider: true },
    currentTheme() === 'dark'
      ? { label: 'Light Mode', icon: 'sun', onSelect: toggleTheme }
      : { label: 'Dark Mode', icon: 'moon', onSelect: toggleTheme },
    { label: 'User Guide', icon: 'book-open', href: '#guide' },
    canInstall() ? { label: 'Download App', icon: 'download', onSelect: promptInstall } : null,
    { divider: true },
    { label: 'Sign Out', icon: 'log-out', onSelect: signOut },
  ].filter(Boolean);
}
