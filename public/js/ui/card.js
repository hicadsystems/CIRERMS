/*
 * card: the ivory panel everything sits on.
 *
 *   card({ title, actions, body, padded, className, as })
 *     title    optional heading in a head band (with a divider under it)
 *     actions  nodes on the right of the head band (usually ghost buttons)
 *     body     node(s) or text
 *     padded   pad the body (default true); false for tables and lists that run edge to edge
 *   CARD (from classes.js) is the bare surface class, for HTML templates.
 *
 * Same on a phone.
 */
import { cx, h } from './html.js';
import { CARD } from './classes.js';

export { CARD };

export function card({ title, actions, body, padded = true, className = '', as = 'section' } = {}) {
  const head = title || actions
    ? h('div', { className: 'flex items-center justify-between gap-3 border-b border-border px-4 py-3' }, [
        title ? h('h2', { className: 'text-sm font-semibold', text: title }) : h('span'),
        actions ? h('div', { className: 'flex items-center gap-1' }, actions) : null,
      ])
    : null;
  return h(as, { className: cx(CARD, 'overflow-hidden', className) }, [head, h('div', { className: padded ? 'p-4' : '' }, body)]);
}
