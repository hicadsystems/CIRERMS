/*
 * empty state: what a list, tab or page shows when there is nothing in it.
 *
 *   emptyState({ icon, title, text, action })
 *     icon    a sprite icon name in the round badge
 *     title   "No Ratings Found" (Title Case)
 *     text    an optional sentence under it
 *     action  an optional button (e.g. "Add Next of Kin")
 *
 * Same on a phone.
 */
import { h } from './html.js';
import { icon as iconEl } from '../core/icons.js';

export function emptyState({ icon = 'search', title = 'Nothing Here', text = '', action = null } = {}) {
  return h('div', { className: 'flex flex-col items-center gap-3 px-4 py-10 text-center' }, [
    h('div', { className: 'flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-muted to-subtle text-muted-foreground ring-8 ring-subtle' }, iconEl(icon, 'icon h-6 w-6')),
    h('p', { className: 'text-sm font-medium', text: title }),
    text ? h('p', { className: '-mt-2 max-w-sm text-sm text-muted-foreground', text }) : null,
    action,
  ]);
}
