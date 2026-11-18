const SVG_NS = 'http://www.w3.org/2000/svg';
const SPRITE = '/assets/icons.svg';

/**
 * An icon from the sprite (public/assets/icons.svg, built by scripts/build-icons.js).
 * Decorative: hidden from screen readers, so the button or link around it names the action.
 *
 *   icon('search')                     1rem square
 *   icon('printer', 'icon h-5 w-5')    sized with utilities
 */
export function icon(name, className = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `${SPRITE}#${name}`);
  svg.appendChild(use);
  return svg;
}
