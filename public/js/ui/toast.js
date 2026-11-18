/*
 * toast: a short message that confirms or warns, then goes away.
 *
 *   toast(message, tone, { timeout })
 *     tone     'success' (default) | 'error' | 'info' | 'warning'
 *     timeout  ms before it goes (default 3200, as in the demo); 0 keeps it
 *   Returns the toast element.
 *
 * Desktop: bottom right, 320 px wide. Phones: full width above the bottom bar.
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
  r.className = 'pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2 phone:bottom-20 phone:left-3 phone:right-3 phone:w-auto';
  r.setAttribute('aria-live', 'polite');
  return r;
}

export function toast(message, tone = 'success', { timeout } = {}) {
  const [cls, iconName] = TONES[tone] || TONES.info;
  const t = h('div', {
    role: tone === 'error' ? 'alert' : 'status',
    className: cx('pointer-events-auto flex items-start gap-2 rounded-card border px-4 py-3 text-sm font-medium shadow-pop', cls),
  }, [
    icon(iconName, 'icon mt-0.5'),
    h('span', { text: message }),
  ]);
  root().appendChild(t);
  const ms = timeout === undefined ? 3200 : timeout;
  if (ms > 0) setTimeout(() => t.remove(), ms);
  return t;
}
