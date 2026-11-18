/*
 * stat tile: a dashboard number with a label, a coloured icon and a foot line.
 *
 *   statTile({ label, value, icon, tone, foot, href })
 *     tone   'primary' (teal) | 'destructive' (red) | 'secondary' (blue) | 'brand' (navy blue)
 *     foot   node(s) under a divider ("12 current  3 former" links)
 *   Returns the tile; tile.setValue(v) updates the number.
 *
 * Phones: tiles sit two to a row (the grid around them decides); the tile itself is the same.
 */
import { cx, h } from './html.js';
import { CARD } from './classes.js';
import { icon as iconEl } from '../core/icons.js';

const TONES = {
  primary: ['from-primary to-primary-hover shadow-primary/30', 'bg-primary/10'],
  destructive: ['from-destructive to-destructive-hover shadow-destructive/30', 'bg-destructive/10'],
  secondary: ['from-secondary to-secondary-hover shadow-secondary/30', 'bg-secondary/10'],
  brand: ['from-brand-fill to-brand-deep shadow-brand-fill/30', 'bg-brand-fill/10'],
};

export function statTile({ label, value = '--', icon = 'users', tone = 'primary', foot = null, className = '' } = {}) {
  const [badge, glow] = TONES[tone] || TONES.primary;
  const number = h('div', { className: 'relative mt-1 text-3xl font-bold tracking-tight', text: value });
  const tile = h('div', { className: cx(CARD, 'relative overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover', className) }, [
    h('div', { className: cx('pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full', glow) }),
    h('div', { className: 'relative flex items-start justify-between gap-3' }, [
      h('div', { className: 'text-2xs font-semibold uppercase tracking-wider text-muted-foreground', text: label }),
      h('span', { className: cx('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-on-fill shadow-md', badge) }, iconEl(icon, 'icon h-5 w-5')),
    ]),
    number,
    foot ? h('div', { className: 'relative mt-2 flex gap-4 border-t border-border/70 pt-2.5 text-xs text-muted-foreground' }, foot) : null,
  ]);
  tile.setValue = (v) => { number.textContent = String(v); };
  return tile;
}
