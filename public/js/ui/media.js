/*
 * media: the two layouts and the wide screen, as the JS sees them.
 *
 *   isPhone()        760 px and below (Tailwind `phone:`)
 *   isWide()         1280 px and up: a record shows beside its list
 *   onLayout(fn)     calls fn() when either changes; returns an unsubscribe function
 *
 * Use CSS (`phone:` / `desk:`) for looks; use these only when the DOM itself differs.
 */

const phoneMq = window.matchMedia('(max-width: 760px)');
const wideMq = window.matchMedia('(min-width: 1280px)');

export const isPhone = () => phoneMq.matches;
export const isWide = () => wideMq.matches;

export function onLayout(fn) {
  phoneMq.addEventListener('change', fn);
  wideMq.addEventListener('change', fn);
  return () => {
    phoneMq.removeEventListener('change', fn);
    wideMq.removeEventListener('change', fn);
  };
}
