/*
 * toast: a short message that confirms or warns, then goes away.
 *
 *   toast(message, tone, { timeout })
 *     tone     'success' (default) | 'error' | 'info' | 'warning'
 *     timeout  ms before it fades (default 4200; errors 6000); 0 keeps it until closed
 *   Returns the toast element.
 *
 * Toasts never cover a dialog's buttons. Phones: full width at the top, under the header. Desktop: 320 px
 * wide at the bottom right, and at the top right while a dialog is open. They sit above a dialog's scrim.
 */
import { cx, h } from './html.js';
import { icon } from '../core/icons.js';

const TONES = {
  success: ['border-success bg-success-soft text-success', 'circle-check'],
  error: ['border-error bg-error-soft text-error', 'circle-alert'],
  info: ['border-info bg-info-soft text-info', 'info'],
  warning: ['border-warning bg-warning-soft text-warning', 'triangle-alert'],
};

function root() {
  let r = document.getElementById('toast-root');
  if (!r) {
    r = h('div', { id: 'toast-root' });
    document.body.appendChild(r);
  }
  r.setAttribute('aria-live', 'polite');
  place(r);
  if (!watching) {
    watching = true;
    // a dialog opening or closing moves the toasts that are showing
    new MutationObserver(() => place(r)).observe(document.body, { childList: true, subtree: true });
  }
  return r;
}

let watching = false;

function place(r) {
  const dialogOpen = !!document.querySelector('#overlay-root [role="dialog"]');
  r.className = cx(
    'pointer-events-none fixed right-4 z-[70] flex w-80 flex-col gap-2 phone:left-3 phone:right-3 phone:top-16 phone:bottom-auto phone:w-auto',
    dialogOpen ? 'top-4 bottom-auto' : 'bottom-4 top-auto'
  );
}

export function toast(message, tone = 'success', { timeout } = {}) {
  const [cls, iconName] = TONES[tone] || TONES.info;
  const close = () => {
    t.classList.add('opacity-0');
    setTimeout(() => t.remove(), 220);
  };
  const t = h('div', {
    role: tone === 'error' ? 'alert' : 'status',
    className: cx('pointer-events-auto flex items-start gap-2 rounded-card border px-4 py-3 text-sm font-medium shadow-pop transition-opacity duration-200 desk:animate-rise', cls),
  }, [
    icon(iconName, 'icon mt-0.5'),
    h('span', { className: 'min-w-0 flex-1 leading-relaxed', text: message }),
    h('button', { type: 'button', className: '-mr-1 inline-flex h-6 w-6 flex-none items-center justify-center rounded-md opacity-70 hover:opacity-100', 'aria-label': 'Dismiss', onClick: close }, icon('x')),
  ]);
  root().appendChild(t);
  const ms = timeout === undefined ? (tone === 'error' ? 6000 : 4200) : timeout;
  if (ms > 0) setTimeout(close, ms);
  return t;
}
