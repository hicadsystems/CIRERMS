# CIRERMS components

The shared pieces the screens are built from. They are ES modules in `public/js/ui/`, one per file, each
ported from `docs/design/demo-src.html` and drawn only with the theme tokens. Every file starts with a
comment saying what it is for and what it does on a phone.

Import one file, or everything from `ui/index.js`:

```js
import { button, openDialog, toast } from '../ui/index.js';
```

Strings passed as content are always text, never HTML. Pass nodes for anything richer.

Layouts: `phone` means 760 px and below, `desktop` means 761 px and up, and `wide` means 1280 px and up.

## Helpers

| Name | Import | Signature |
|---|---|---|
| h | `ui/html.js` | `h(tag, attrs, children)` builds an element. `attrs` takes `className`, `text`, `dataset`, `onClick` and plain attributes; `children` takes nodes, strings or arrays. `core/dom.js` `el` is the same function |
| cx / fill | `ui/html.js` | `cx('a', cond && 'b')` joins classes; `fill(node, content)` replaces a node's children |
| media | `ui/media.js` | `isPhone()`, `isWide()`, `onLayout(fn)` returns an unsubscribe function |
| class strings | `ui/classes.js` | `CARD`, `INPUT`, `LABEL`, `TH`, `TD` for HTML templates |

## Buttons

`ui/button.js`

```js
button({ label, icon, iconAfter, variant, href, onClick, type, ariaLabel, className, disabled, attrs })
// variant: 'primary' (teal, main action) | 'blue' (second action) | 'danger' | 'outline' | 'ghost'
buttonClass('outline')                       // the class string, for templates
actionGroup([btnA, btnB], { stackOnPhone })  // a wrapping row; stackOnPhone stacks the buttons full width on a phone

button({ label: 'New Rating', icon: 'user-plus', variant: 'primary', href: '#ratings/new' });
button({ icon: 'download', ariaLabel: 'Export', variant: 'outline' }); // icon only
```

On a phone, buttons are 44 px tall.

## Page header

`ui/page-header.js`

```js
pageHeader({ title, subtitle, actions, phoneActions })
// phoneActions: 'stretch' (default, the buttons share the full width) | 'hide'

pageHeader({ title: 'Current Ratings', subtitle: 'Serving ratings on the nominal roll',
  actions: [exportBtn, newBtn], phoneActions: 'hide' });
```

The subtitle is hidden on phones. Each screen draws its own page header (the titles and subtitles are in
`core/nav.js` `PAGES`).

## Card

`ui/card.js`

```js
card({ title, actions, body, padded = true, className, as = 'section' })

card({ title: 'Recently Enlisted', actions: [button({ label: 'View All', variant: 'ghost', href: '#ratings/current' })],
  body: list, padded: false });
```

## Stat tile

`ui/stat-tile.js`

```js
statTile({ label, value, icon, tone, foot })   // tone: 'primary' | 'destructive' | 'secondary' | 'sidebar'

const t = statTile({ label: 'Members', value: 33, icon: 'users', tone: 'primary',
  foot: [h('a', { href: '#ratings/current' }, [h('b', { className: 'text-foreground', text: '25' }), ' current'])] });
t.setValue(34);
```

Lay tiles out with `grid grid-cols-4 gap-4 phone:grid-cols-2 phone:gap-3`.

## Pill

`ui/pill.js`

```js
pill('Current', 'success');    // tone: 'success' | 'warning' | 'info' | 'error' | 'neutral'
pillClass('neutral');          // the class string
```

## Avatar

`ui/avatar.js`

```js
avatar({ name, initials, src, size })
// size: 'xs' 32 px | 'sm' 36 | 'md' 40 | 'base' 44 (default) | 'lg' 48 | 'xl' 64 (56 on a phone)

avatar({ name: 'Okonkwo Chukwuemeka', size: 'xl' });   // shows "OC"
```

## Facts

`ui/facts.js`

```js
facts([[label, value], ...], { columns = 2 })   // empty values show "-"; a value can be a node

facts([['Current Ship', 'NNS ARADU'], ['Command', 'Western Naval Command']]);
```

## Empty state

`ui/empty-state.js`

```js
emptyState({ icon, title, text, action })

emptyState({ icon: 'users', title: 'No Next of Kin Recorded',
  action: button({ label: 'Add Next of Kin', icon: 'plus', variant: 'outline' }) });
```

## Field

`ui/field.js`

```js
field({ label, control, optional, hint, error })
textInput({ name, type, value, placeholder, required, ...attrs })
selectInput({ name, options, value, placeholder = '-- Select --' })   // options: ['A'] or [{ value, label }]
setFieldError(scope, name, message)
setFieldErrors(scope, err.fields)      // clears the old errors, then shows the API's error.fields
clearFieldErrors(scope)

form.append(
  field({ label: 'Surname', control: textInput({ name: 'surname', required: true }) }),
  field({ label: 'Middle Name', optional: true, control: textInput({ name: 'middle_name' }) }),
  field({ label: 'Religion', control: selectInput({ name: 'religion_id', options: religions.map((r) => ({ value: r.id, label: r.name })) }) }),
);
```

`choices.js` turns every select into a searchable dropdown once it is on the page. After that:

- look the select up again with `querySelector('[name="religion_id"]')`;
- listen for `change` on a container, because the event fires on the dropdown's wrapper;
- read and set `.value` on the wrapper; setting it fires `change` when the value changes.

## Dialog and bottom sheet

`ui/dialog.js`: one component. It is a centred dialog on desktop and a bottom sheet on a phone.

```js
const dlg = openDialog({ title, body, footer, size = 'md', onClose, dismissible = true, initialFocus });
// size: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
dlg.body; dlg.footer; dlg.panel;
dlg.setTitle(t); dlg.setBody(nodes); dlg.setFooter(nodes); dlg.setDismissible(false); dlg.close(result);
await dlg.closed;
closeAllDialogs();   // the shell calls it on every page change

const dlg = openDialog({ title: 'Add Next of Kin', size: 'lg', body: form });
dlg.setFooter([
  button({ label: 'Cancel', variant: 'outline', onClick: () => dlg.close() }),
  button({ label: 'Save', icon: 'check', variant: 'primary', onClick: save }),
]);
```

- Esc, the scrim and the X close the top dialog. Dialogs can stack.
- Focus starts on the Close button, as in the demo, unless you pass `initialFocus`, and returns to where it was when the dialog closes.
- Tab stays inside the dialog.
- A link (`href="#..."`) inside the dialog closes it as it navigates; add `data-keep-open` to a link that should not.
- On a phone, the footer buttons stack and the last one is on top, so put the main action last.

## Confirm

`ui/confirm.js`

```js
if (await confirmDialog({ title: 'Delete Rating', message: 'This removes the record and all its tabs.',
  confirmLabel: 'Delete Rating', danger: true })) { ... }
```

## Menu

`ui/menu.js`: on desktop a popover; on a phone a sheet of full-width buttons.

```js
attachMenu(trigger, items, { align = 'end', placement = 'bottom', width = 'w-44', title, subtitle })
// items: [{ label, icon, onSelect, href, tone: 'danger' }, { divider: true }] or a function returning them
openMenu(trigger, items, options)

const exportBtn = button({ label: 'Export', icon: 'download', iconAfter: 'chevron-down', variant: 'blue' });
attachMenu(exportBtn, [
  { label: 'Copy Rows', icon: 'copy', onSelect: copyRows },
  { label: 'Excel', icon: 'file-spreadsheet', onSelect: () => download('xlsx') },
]);
```

## Toast

`ui/toast.js`

```js
toast('Rating saved.');                       // tone: 'success' (default) | 'error' | 'info' | 'warning'
toast(err.message, 'error', { timeout: 0 });  // 4200 ms by default (errors 6000); 0 keeps it until its X is pressed
```

It shows bottom right on desktop and full width above the bottom bar on a phone. `core/dom.js`
`showToast` calls it.

## Toolbar

`ui/toolbar.js`

```js
const tb = toolbar({
  search: { placeholder: 'Official No or name', name: 'q' },
  filters: [{ name: 'rate', label: 'Rates', options: rates, placeholder: 'All Rates', width: 'w-56' }],
  noun: ['rating', 'ratings'],
  actions: [],
  onChange: (values) => list.reload({ resetPage: true }),   // search is debounced 300 ms
});
tb.el; tb.values(); tb.setCount(meta.total); tb.setOptions('rate', rates);
```

On a phone the filters fold into a **Filter** button that opens a sheet. Changes apply at once, and
**Show Ratings** closes the sheet.

## List view

`ui/list-view.js`: server paging, fixed at 25 per page, read from the API's `meta`. There is no
page-size picker. It shows a table on desktop and cards on a phone.

```js
const list = listView({
  columns: [
    { key: 'service_number', label: 'Official No' },
    { key: 'name', label: 'Name', render: (r) => `${r.surname} ${r.first_name}` },
    { key: 'rate_name', label: 'Rate' },
  ],
  load: ({ page, pageSize }) => api.get(`/api/ratings?status=current&page=${page}&pageSize=${pageSize}&${filters}`),
  card: { avatar: (r) => `${r.surname} ${r.first_name}`, subtitle: (r) => `${r.service_number} · ${r.current_ship || '-'}` },
  rowKey: (r) => r.service_number,
  onPick: (r) => openRecord(r),
  empty: { icon: 'search', title: 'No Ratings Found' },
  onLoaded: ({ meta }) => tb.setCount(meta.total),
});
list.el; list.reload({ resetPage: true }); list.setPage(2); list.rows(); list.meta(); list.setPicked(key);
```

- Defaults: the first column is muted and the second is bold. On a card, the second column is the title and the first is the subtitle.
- It loads page 1 straight away; pass `autoLoad: false` to wait for `list.reload()`.

## Pager

`ui/pager.js`: used by the list view; standalone use:

```js
const p = pager({ meta, onPage: (n) => load(n) });
p.update(meta);
```

## List and record

`ui/list-record.js`: shows the picked record beside the list at 1280 px and up (the first row is picked
automatically), in a dialog from 761 to 1279 px, and in a bottom sheet on a phone.

```js
const view = listRecordView({
  list: { columns, load, card, rowKey, empty, onLoaded },     // listView options; onPick is taken over
  renderRecord: async (row) => ratingCard(row),                // node or promise of one
  recordTitle: (row, { phone }) => (phone ? 'Rating' : fullName(row)),
  size: 'md',
});
view.el; view.list; view.reload({ resetPage: true }); view.pick(row); view.destroy();
```

## In-page tabs

`ui/tabs.js`: the record's ten tabs. They are chips on a phone, and the arrow keys move between them.

```js
const tabs = inPageTabs({
  tabs: [{ key: 'details', label: 'Details' }, { key: 'nok', label: 'Next of Kin', count: 2 }],
  active: 'details',
  onChange: (key) => showTab(key),
});
tabs.el; tabs.setActive('nok'); tabs.setCount('nok', 3); tabs.active();
```

## Stepper

`ui/stepper.js`: New Rating's four steps. Keep all the steps' fields in the form and show only the
current one, so moving between steps keeps what was typed.

```js
const s = stepper({ steps: ['Basic Details', 'Contact', 'Health', 'Official'], current: 1, onStep: (n) => go(n) });
s.el; s.set(2); s.current();
```

## Completeness bar

`ui/progress.js`: red below 50%, amber to 79%, green from 80% (`.cirerms-progress-*`, `data-level`).

```js
const bar = completeness({ percent: 70 });   // "Record 70% complete", in the record head's band
bar.set(80);
levelFor(64);                                 // 'mid'
```

## Shell hooks

| What | Where |
|---|---|
| Areas, modules, tabs and every page's title, subtitle, back link and screen id | `public/js/core/nav.js` (`AREAS`, `MODULES`, `PAGES`, `describe(path)`) |
| Ctrl K and the search buttons | `public/js/core/search.js`: `openSearch()` calls the handler registered with `setSearchHandler(fn)`; the shell registers the palette in `public/js/shell/search-palette.js` |
| Signed-in user, sign out, account menu items | `public/js/shell/session.js` (`getUser()`, `signOut()`, `accountItems()`) |
| Routes to screens | `public/js/sections/app-shell.js` `SCREENS` (pattern, template, mount) |
| Rail, module tabs, phone header, bottom bar and More sheet | `public/js/shell/rail.js`, `module-tabs.js`, `phone.js` |
