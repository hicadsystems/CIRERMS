/*
 * button: the five buttons and a row of them.
 *
 *   button({ label, icon, variant, href, onClick, type, iconAfter, ariaLabel, className, disabled })
 *     variant: 'primary' (teal, the main action) | 'blue' (a second action: Print, Next)
 *              | 'danger' (delete) | 'outline' (Cancel, quiet actions) | 'ghost' (Edit in a card head, View All)
 *     href makes it a link (<a>) that looks the same.
 *   buttonClass(variant)   the class string, for HTML templates
 *   actionGroup(buttons, { stackOnPhone })   a wrapping row with an 8 px gap
 *
 * Phones: every button is the 44 px touch height; actionGroup can stack its
 * buttons full width (stackOnPhone) for sheet footers and record actions.
 */
import { cx, h } from './html.js';
import { icon } from '../core/icons.js';

const BASE =
  'inline-flex h-control items-center justify-center gap-1.5 whitespace-nowrap rounded-ctl px-3.5 text-sm font-medium transition-all active:translate-y-px focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 phone:h-tap';

export const BUTTON = {
  primary: `${BASE} bg-gradient-to-b from-primary to-primary-hover text-primary-foreground shadow-btn hover:brightness-105 focus-visible:ring-4 focus-visible:ring-primary/25`,
  blue: `${BASE} bg-gradient-to-b from-secondary to-secondary-hover text-secondary-foreground shadow-btn hover:brightness-105 focus-visible:ring-4 focus-visible:ring-secondary/25`,
  danger: `${BASE} bg-gradient-to-b from-destructive to-destructive-hover text-destructive-foreground shadow-btn hover:brightness-105 focus-visible:ring-4 focus-visible:ring-destructive/25`,
  outline: `${BASE} border border-input bg-background text-foreground shadow-card hover:border-ring/40 hover:bg-subtle focus-visible:ring-4 focus-visible:ring-ring/15`,
  ghost:
    'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-ctl px-2.5 text-sm font-medium text-secondary transition-colors hover:bg-secondary/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 disabled:pointer-events-none disabled:opacity-50 phone:h-tap',
};

export const buttonClass = (variant = 'outline') => BUTTON[variant] || BUTTON.outline;

export function button({
  label = '',
  icon: iconName,
  iconAfter,
  variant = 'outline',
  href,
  onClick,
  type = 'button',
  ariaLabel,
  className = '',
  disabled = false,
  attrs = {},
} = {}) {
  const children = [iconName ? icon(iconName) : null, label || null, iconAfter ? icon(iconAfter) : null];
  const cls = cx(buttonClass(variant), !label && 'px-0 w-control phone:w-tap', className);
  if (href) {
    return h('a', { href, className: cls, 'aria-label': ariaLabel, onClick, ...attrs }, children);
  }
  return h('button', { type, className: cls, 'aria-label': ariaLabel, disabled, onClick, ...attrs }, children);
}

export function actionGroup(buttons, { stackOnPhone = false, className = '' } = {}) {
  return h('div', { className: cx('flex flex-wrap items-center gap-2', stackOnPhone && 'phone:w-full phone:flex-col phone:items-stretch', className) }, buttons);
}
