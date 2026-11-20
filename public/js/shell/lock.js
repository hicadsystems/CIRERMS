/*
 * session lock, as docs/design/demo.html shows it: the screen locks after the idle time (the
 * server's setting, /api/auth/me session.idleMinutes, 15 by default) or from Lock Screen in
 * the account menu. It unlocks with the account's password only, checked by the server (with
 * the sign-in throttle); Sign Out is on the lock screen too.
 *
 * While locked the page underneath is hidden (not just covered) and inert, and the server
 * refuses every request of the session (423), so nothing can be read; what was open (a list,
 * a half-filled dialog) is kept and shows again on unlock. Every open tab locks and unlocks
 * together (localStorage), and signing out in one tab signs out the others.
 *
 *   startLock(session)   the shell calls it once with /api/auth/me's session; resolves when
 *                        the session is unlocked (at once when it is not locked)
 *   lockScreen(reason)   'manual' (Lock Screen) or 'idle'
 */
import { api, setLockedHandler } from '../core/api.js';
import { icon } from '../core/icons.js';
import { navigate } from '../core/router.js';
import { h } from '../ui/html.js';
import { closeMenus } from '../ui/menu.js';
import { photoAvatar } from '../ui/avatar.js';
import { getUser, roleLabel, signOut } from './session.js';
import { closePalette } from './search-palette.js';

const LOCK_KEY = 'cirerms-lock';
const SIGNED_OUT_KEY = 'cirerms-signed-out';
const REASONS = { idle: 'Locked while you were away', manual: 'You locked this session' };
const ACTIVITY = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'];
// parts of the page hidden while locked
const HIDDEN = ['shell', 'overlay-root', 'toast-root', 'fab'];
const PING_EVERY_MS = 60 * 1000;

let idleMs = 15 * 60 * 1000;
let locked = false;
let lastActive = Date.now();
let lastPing = Date.now();
let refused = false;
let busy = false;
let started = false;
let waiters = [];
let ui = null;

const store = {
  get: (k) => { try { return window.localStorage.getItem(k); } catch (_) { return null; } },
  set: (k, v) => { try { if (v === null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch (_) { /* storage off: this tab only */ } },
};

function build() {
  const user = getUser() || {};
  const pass = h('input', {
    id: 'lock-pass',
    type: 'password',
    name: 'password',
    autocomplete: 'current-password',
    className: 'w-full rounded-ctl border border-input bg-background px-3 py-2 pr-11 text-sm shadow-sm transition placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-4 focus:ring-ring/15 phone:h-tap',
  });
  const eye = h('button', { type: 'button', className: 'absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground', 'aria-label': 'Show Password' }, icon('eye'));
  const err = h('span', { id: 'lock-err', role: 'alert', className: 'mt-1 hidden text-xs font-medium text-error' });
  const reason = h('p', { id: 'lock-reason', className: 'mt-1 text-sm text-muted-foreground', text: REASONS.idle });
  const submit = h('button', { type: 'submit', className: 'inline-flex h-control w-full items-center justify-center gap-1.5 rounded-ctl bg-gradient-to-b from-primary to-primary-hover px-3.5 text-sm font-medium text-primary-foreground shadow-btn transition-all hover:brightness-105 active:translate-y-px disabled:opacity-60 phone:h-tap' }, [icon('lock-keyhole-open'), 'Unlock']);
  const out = h('button', { type: 'button', className: 'inline-flex h-control w-full items-center justify-center gap-1.5 rounded-ctl px-3.5 text-sm font-medium text-destructive transition-colors hover:bg-error-soft phone:h-tap' }, [icon('log-out'), 'Sign Out']);
  const cardEl = h('div', { id: 'lock-card', className: 'animate-rise rounded-dialog border border-border/60 bg-card p-6 text-card-foreground shadow-pop' }, [
    h('div', { className: 'flex flex-col items-center text-center' }, [
      h('span', { className: 'relative' }, [
        photoAvatar(user.fullName || user.username || '', user.passportPhotoUrl, '2xl', user.initials || undefined, 'font-bold phone:font-semibold text-on-fill shadow-md ring-4 ring-background'),
        h('span', { className: 'absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-md ring-4 ring-card' }, icon('lock-keyhole')),
      ]),
      h('h2', { id: 'lock-title', className: 'mt-4 text-2xl font-bold tracking-tight phone:font-semibold', text: 'Session Locked' }),
      reason,
      h('p', { className: 'mt-4 font-semibold', text: user.fullName || user.username || '' }),
      h('p', { className: 'text-sm text-muted-foreground', text: `${user.username || ''} · ${roleLabel(user)}` }),
    ]),
    h('label', { className: 'mt-5 block' }, [
      h('span', { className: 'mb-1 block text-xs font-semibold text-muted-foreground', text: 'Password' }),
      h('span', { className: 'relative block' }, [pass, eye]),
      err,
    ]),
    h('div', { className: 'mt-6 flex flex-col gap-2' }, [submit, h('div', { className: 'my-2 h-px bg-border' }), out]),
  ]);
  const form = h('form', { id: 'lock-form', novalidate: true, className: 'relative w-full max-w-sm' }, cardEl);
  const root = h('div', {
    id: 'lock',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'lock-title',
    'aria-describedby': 'lock-reason',
    className: 'fixed inset-0 z-[70] hidden items-center justify-center overflow-y-auto bg-sidebar-deep/90 p-4 backdrop-blur-xl',
  }, [
    h('div', { 'aria-hidden': 'true', className: 'pointer-events-none absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-sidebar-primary/25 blur-3xl' }),
    h('div', { 'aria-hidden': 'true', className: 'pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full bg-primary/20 blur-3xl' }),
    form,
  ]);

  eye.addEventListener('click', () => {
    const show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    eye.setAttribute('aria-label', show ? 'Hide Password' : 'Show Password');
    eye.replaceChildren(icon(show ? 'eye-off' : 'eye'));
    pass.focus();
  });
  pass.addEventListener('input', () => {
    err.classList.add('hidden');
    pass.classList.remove('border-error', 'ring-4', 'ring-error/15');
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    tryUnlock();
  });
  out.addEventListener('click', () => {
    store.set(LOCK_KEY, null);
    signOut();
  });
  document.body.appendChild(root);
  return { root, pass, err, reason, submit, card: cardEl };
}

function showError(text) {
  ui.err.textContent = text;
  ui.err.classList.remove('hidden');
  ui.pass.classList.add('border-error', 'ring-4', 'ring-error/15');
  ui.card.classList.remove('animate-shake');
  void ui.card.offsetWidth; // restart the shake
  ui.card.classList.add('animate-shake');
  ui.pass.select();
}

function setHidden(on) {
  HIDDEN.forEach((id) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.inert = on;
    node.classList.toggle('invisible', on);
  });
}

function show(reason) {
  closeMenus();
  closePalette();
  document.querySelectorAll('.custom-dropdown-list.cdd-open').forEach((l) => l._customDropdown && l._customDropdown.close());
  ui.reason.textContent = REASONS[reason] || REASONS.idle;
  ui.pass.value = '';
  ui.err.classList.add('hidden');
  ui.pass.classList.remove('border-error', 'ring-4', 'ring-error/15');
  setHidden(true);
  ui.root.classList.remove('hidden');
  ui.root.classList.add('flex');
  setTimeout(() => ui.pass.focus(), 50);
}

function hide() {
  ui.root.classList.add('hidden');
  ui.root.classList.remove('flex');
  setHidden(false);
}

/**
 * Locks this tab. `server`: tell the server (false when the server already knows: a 423
 * answer, the session found locked, another tab's lock). `announce`: tell the other tabs.
 */
export function lockScreen(reason = 'manual', { server = true, announce = true } = {}) {
  if (!ui) return;
  const why = reason === 'idle' ? 'idle' : 'manual';
  if (locked) return;
  locked = true;
  show(why);
  if (announce) store.set(LOCK_KEY, JSON.stringify({ reason: why, at: Date.now() }));
  if (server) api.post('/api/auth/lock', { reason: why }).catch(() => { /* the screen is locked either way */ });
}

function unlocked({ announce = true } = {}) {
  locked = false;
  lastActive = Date.now();
  lastPing = Date.now();
  hide();
  if (announce) store.set(LOCK_KEY, null);
  const list = waiters;
  waiters = [];
  list.forEach((resolve) => resolve());
  // a page refused while locked draws again
  if (refused && started) {
    refused = false;
    navigate(window.location.hash || '#dashboard');
  }
}

async function tryUnlock() {
  if (busy) return;
  const password = ui.pass.value;
  if (!password) {
    showError('Enter your password');
    return;
  }
  busy = true;
  ui.submit.disabled = true;
  try {
    await api.post('/api/auth/unlock', { password }, { skipAuthRedirect: true });
    unlocked();
  } catch (e) {
    if (e.status === 401) {
      // the session has ended (signed out elsewhere, or expired)
      window.location.href = '/index.html';
      return;
    }
    showError(e.code === 'WRONG_PASSWORD' ? 'Wrong password' : e.message || 'Could not unlock. Try again.');
  } finally {
    busy = false;
    ui.submit.disabled = false;
  }
}

function onActivity() {
  if (locked) return;
  const now = Date.now();
  lastActive = now;
  // keep the server's session open while the person works without calling it
  if (now - lastPing > PING_EVERY_MS) {
    lastPing = now;
    api.post('/api/auth/ping').catch(() => {});
  }
}

export function startLock(session = {}) {
  if (!ui) {
    ui = build();
    const minutes = Number(session.idleMinutes);
    if (Number.isFinite(minutes) && minutes > 0) idleMs = minutes * 60 * 1000;

    setLockedHandler((reason) => {
      refused = true;
      lockScreen(reason, { server: false });
    });
    ACTIVITY.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true, capture: true }));
    setInterval(() => {
      if (!locked && Date.now() - lastActive >= idleMs) lockScreen('idle');
    }, 1000);
    window.addEventListener('storage', (e) => {
      if (e.key === SIGNED_OUT_KEY && e.newValue) {
        window.location.href = '/index.html';
        return;
      }
      if (e.key !== LOCK_KEY) return;
      if (e.newValue) {
        let reason = 'manual';
        try { reason = JSON.parse(e.newValue).reason; } catch (_) { /* keep manual */ }
        lockScreen(reason, { server: false, announce: false });
      } else if (locked) {
        unlocked({ announce: false });
      }
    });
  }
  const wait = new Promise((resolve) => {
    if (session.locked) {
      waiters.push(resolve);
      lockScreen(session.lockReason || 'idle', { server: false });
    } else {
      resolve();
    }
  });
  return wait.then(() => { started = true; });
}

export const isLocked = () => locked;

// for the session menu's Sign Out: the other tabs leave too
export function announceSignOut() {
  store.set(LOCK_KEY, null);
  store.set(SIGNED_OUT_KEY, String(Date.now()));
}

