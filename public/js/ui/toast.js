/*
 * toast: a short message that confirms or warns, then goes away.
 *
 *   toast(message, tone, { timeout })
 *     tone     'success' (default) | 'error' | 'info' | 'warning'
 *     timeout  ms before it fades (default 4200; errors 6000); 0 keeps it until closed
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
