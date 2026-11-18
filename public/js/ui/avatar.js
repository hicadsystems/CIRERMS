/*
 * avatar: a round badge with a person's initials (or their photo).
 *
 *   avatar({ name, initials, src, size })
 *     name      "Okonkwo Chukwuemeka": initials are taken from its first two words
 *     initials  given directly instead
 *     src       a photo URL; shown instead of the initials
 *     size      'xs' (32 px, search rows) | 'sm' (36 px, dashboard rows) | 'md' (40 px, list cards)
 *               | 'base' (44 px, default) | 'lg' (48 px, record card) | 'xl' (64 px, the record head)
 *
 * Same on a phone, except 'xl' drops to 56 px.
 */
import { cx, h } from './html.js';

const SIZES = {
  xs: 'h-8 w-8 text-2xs',
  sm: 'h-9 w-9 text-xs',
  base: 'h-11 w-11 text-sm',
  md: 'h-10 w-10 text-xs',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-xl phone:h-14 phone:w-14 phone:text-lg',
};

export function initialsOf(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
}

export function avatar({ name = '', initials, src, size = 'base', className = '' } = {}) {
  const cls = cx(
    'flex flex-none items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-fill to-brand-deep font-semibold text-on-fill shadow-sm ring-2 ring-background',
    SIZES[size] || SIZES.base,
    className
  );
  if (src) return h('span', { className: cls }, h('img', { src, alt: '', className: 'h-full w-full object-cover' }));
  return h('span', { className: cls, 'aria-hidden': 'true', text: initials || initialsOf(name) });
}
