/*
 * page header: a page's title, a one-line subtitle and its actions.
 *
 *   pageHeader({ title, subtitle, actions, phoneActions })
 *     actions        buttons on the right (New Rating, Export ...)
 *     phoneActions   'stretch' (default: the buttons share the full width under the title)
 *                    | 'hide' (when the phone has its own way in, like the New Rating button bottom right)
 *   Returns the element; its title is an <h1>.
 *
 * Phones: the title is a size smaller and the subtitle is hidden.
 */
import { cx, h } from './html.js';

export function pageHeader({ title, subtitle = '', actions = null, phoneActions = 'stretch', className = '' } = {}) {
  const hasActions = actions && (!Array.isArray(actions) || actions.length);
  return h('div', { className: cx('mb-4 flex flex-wrap items-end gap-3', className), dataset: { pageHeader: '' } }, [
    h('div', { className: 'min-w-0' }, [
      h('h1', { className: 'text-2xl font-semibold tracking-tight phone:text-xl', text: title }),
      subtitle ? h('p', { className: 'mt-0.5 text-sm text-muted-foreground phone:hidden', text: subtitle }) : null,
    ]),
    hasActions
      ? h(
          'div',
          { className: cx('flex flex-wrap gap-2 desk:ml-auto', phoneActions === 'hide' ? 'phone:hidden' : 'phone:w-full phone:[&>*]:flex-1') },
          actions
        )
      : null,
  ]);
}
