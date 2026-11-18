/*
 * classes: the shared Tailwind class strings, for markup written as HTML
 * (section templates) or built with h(). Components use these; a screen that
 * needs a plain bordered card or an input can use them too.
 *
 *   CARD    a card surface        INPUT  a text field      LABEL  a field label
 *   TH      a table head cell     TD     a table cell
 *
 * Phones: INPUT grows to the 44 px touch height.
 */

export const CARD = 'rounded-card border border-border/60 bg-card/75 shadow-card backdrop-blur-md';
export const INPUT =
  'w-full rounded-ctl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-4 focus:ring-ring/15 disabled:bg-subtle disabled:text-muted-foreground phone:h-tap';
export const LABEL = 'mb-1 block text-xs font-semibold text-muted-foreground';
export const TH = 'bg-subtle/70 px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground';
export const TD = 'px-4 py-2.5';
