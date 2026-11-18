/*
 * session: who is signed in, and signing out. The shell fills it from
 * /api/auth/me before the first page draws.
 *
 *   getUser()   { username, fullName, role, serviceNumber } or null
 *   roleLabel(user)   'Administrator' for admin, else the role in Title Case
 *   signOut()   ends the session on the server and returns to the sign-in page
 */
import { api, setFallbackToken } from '../core/api.js';

let user = null;

export const getUser = () => user;
export function setUser(u) { user = u; }

export function roleLabel(u) {
  const role = String((u && u.role) || 'admin');
  if (role === 'admin') return 'Administrator';
  return role.replace(/(^|[\s_-])(\w)/g, (_, s, c) => `${s ? ' ' : ''}${c.toUpperCase()}`);
}

export async function signOut() {
  try {
    await api.post('/api/auth/logout');
  } catch (_) {
    // the session ends on this side either way
  }
  setFallbackToken(null);
  window.location.href = '/index.html';
}

export function accountItems() {
  return [
    { label: 'View My Details', icon: 'user-round', href: '#ratings/my-details' },
    { divider: true },
    { label: 'Sign Out', icon: 'log-out', tone: 'danger', onSelect: signOut },
  ];
}
