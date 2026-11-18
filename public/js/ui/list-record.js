/*
 * list and record: a list whose rows open a record. Where the record shows
 * depends on the width:
 *   1280 px and up   beside the list (a third of the width, sticky), the first row picked
 *   761 to 1279 px   in a dialog over the list
 *   phone            in a bottom sheet
 *
 *   const view = listRecordView({ list, renderRecord, recordTitle, size })
 *     list           the listView options (onPick is taken over)
 *     renderRecord   (row) => node (or a promise of one): the record card's content
 *     recordTitle    (row, { phone }) => the dialog's title (default 'Record'; the demo uses the
 *                    rating's name on desktop and 'Rating' in the phone sheet)
 *     size           the dialog size below 1280 px (default 'md')
 *   view.el  view.list (the listView)  view.reload(opts)  view.pick(row)  view.destroy()
 *
 * Phones: the sheet; the list stays as cards.
 */
import { cx, h, fill } from './html.js';
import { CARD } from './classes.js';
import { listView } from './list-view.js';
import { isPhone, isWide, onLayout } from './media.js';
import { openDialog } from './dialog.js';
import { emptyState } from './empty-state.js';

export function listRecordView({ list: listOptions = {}, renderRecord, recordTitle = () => 'Record', size = 'md' } = {}) {
  const rowKey = listOptions.rowKey || ((r) => r.id);
  let pickedRow = null;
  const aside = h('aside', { className: cx(CARD, 'sticky top-0 self-start overflow-hidden p-4'), 'aria-label': 'Record' });

  async function show(row, target) {
    const content = await renderRecord(row);
    fill(target, content);
  }

  function pick(row) {
    pickedRow = row;
    if (isWide()) {
      list.setPicked(rowKey(row));
      show(row, aside);
      return;
    }
    const dlg = openDialog({ title: recordTitle(row, { phone: isPhone() }), size, body: emptyState({ icon: 'loader-circle', title: 'Loading' }) });
    show(row, dlg.body);
  }

  const list = listView({
    ...listOptions,
    onPick: pick,
    onLoaded(info) {
      if (typeof listOptions.onLoaded === 'function') listOptions.onLoaded(info);
      layout();
    },
  });

  const grid = h('div', { className: 'grid grid-cols-1 gap-4' }, [list.el]);

  function layout() {
    const rows = list.rows();
    if (isWide() && rows.length) {
      const still = pickedRow && rows.find((r) => rowKey(r) === rowKey(pickedRow));
      grid.className = 'grid grid-cols-3 gap-4';
      list.el.className = 'col-span-2 min-w-0';
      if (!aside.isConnected) grid.appendChild(aside);
      pick(still || rows[0]);
    } else {
      grid.className = 'grid grid-cols-1 gap-4';
      list.el.className = 'min-w-0';
      aside.remove();
      list.setPicked(null);
    }
  }

  const off = onLayout(layout);

  return {
    el: grid,
    list,
    reload: (opts) => list.reload(opts),
    pick,
    destroy: off,
  };
}
