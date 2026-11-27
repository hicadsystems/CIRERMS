/*
 * pwa: CIRERMS as an installed app (the manifest, public/manifest.webmanifest, and the service worker, public/sw.js).
 *
 *   registerServiceWorker()  registers the worker; when a new version is waiting it shows the update banner
 *   canInstall()             true while the browser offers installation (beforeinstallprompt) and the app is not installed
 *   promptInstall()          asks the browser to show its install question
 *
 * The banner ("A new version of CIRERMS is ready." with Reload) never reloads by itself, so nobody loses what they are
 * typing: Reload activates the waiting worker, and the page reloads once it has taken over.
 * Loaded by both pages (js/sections/app-shell.js and auth.js), as early as possible so the install offer is not missed.
 */
import { h } from '../ui/html.js';
import { icon } from './icons.js';

let deferred = null;
let reloading = false;

const standalone = () =>
  (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault(); // CIRERMS offers it from the account menu instead
  deferred = event;
});
window.addEventListener('appinstalled', () => { deferred = null; });

export function canInstall() {
  return !!deferred && !standalone();
}

export async function promptInstall() {
  if (!deferred) return;
  const offer = deferred;
  deferred = null; // an offer can be used once
  offer.prompt();
  try { await offer.userChoice; } catch (_) { /* closed without a choice */ }
}

function showUpdateBanner(worker) {
  if (document.getElementById('update-banner')) return;
  const reload = h('button', {
    type: 'button',
    className: 'inline-flex h-control flex-none items-center justify-center gap-1.5 rounded-ctl bg-gradient-to-b from-primary to-primary-hover px-3.5 text-sm font-medium text-primary-foreground shadow-btn hover:brightness-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 phone:h-tap',
    onClick: () => {
      reload.disabled = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    },
  }, [icon('refresh-cw'), 'Reload']);
  const banner = h('div', {
    id: 'update-banner',
    role: 'status',
    className: 'pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-card border border-border bg-background px-4 py-3 text-sm font-medium text-foreground shadow-pop',
  }, [
    icon('info', 'icon flex-none text-info'),
    h('span', { className: 'min-w-0 flex-1 leading-relaxed', text: 'A new version of CIRERMS is ready.' }),
    reload,
  ]);
  // centred on the page beside the desktop sidebar (which can be folded); the full width on the sign-in page and on a phone
  const wrap = h('div', {
    id: 'update-banner-wrap',
    className: 'pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex justify-center px-4 phone:bottom-20',
  }, banner);
  const rail = document.getElementById('rail');
  const place = () => {
    const w = rail && rail.offsetParent !== null ? rail.getBoundingClientRect().width : 0;
    wrap.style.paddingLeft = w ? `${w + 16}px` : '';
  };
  place();
  if (rail && window.ResizeObserver) new ResizeObserver(place).observe(rail);
  window.addEventListener('resize', place);
  document.body.appendChild(wrap);
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // a new worker took over because Reload was pressed (the first install does not change a controller)
    if (reloading || !hadController) return;
    reloading = true;
    window.location.reload();
  });
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((reg) => {
    const watch = (worker) => {
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdateBanner(worker);
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) showUpdateBanner(reg.waiting);
    if (reg.installing) watch(reg.installing);
    reg.addEventListener('updatefound', () => reg.installing && watch(reg.installing));
    // look for a new version when the window comes back to the front
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => { /* the app works without a worker */ });
}

registerServiceWorker();
