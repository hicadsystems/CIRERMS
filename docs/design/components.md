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

## Rating search select

`ui/rating-search.js`

```js
ratingSearch({ name, status, account, value, onChange, placeholder, ariaLabel, disabled, className })
// status: 'current' | 'former' | 'all' (default); account: 'with' | 'without'
// the element has .value (official number), .rating, .set(), .clear(), .input and fires `change`

field({ label: 'Rating', control: ratingSearch({ name: 'serviceNumber', status: 'current' }) });
```

The one way to pick a rating. From 2 characters it suggests ratings by official number or name (10 at a time, the
next 10 on scroll) in a list drawn over the page, so it works inside dialogs and bottom sheets. Up, Down, Enter and
Escape work; each suggestion is a 44 px touch row on a phone.

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
statTile({ label, value, icon, tone, foot })   // tone: 'primary' | 'destructive' | 'secondary' | 'brand'

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

Toasts never cover a dialog's buttons: on a phone they show full width at the top, under the header; on desktop they show at the bottom right, and at the top right while a dialog is open. They sit above a dialog's scrim. `core/dom.js`
`showToast` calls it.

## PDF preview

`ui/pdf-preview.js`: every printout opens here, never in the browser's PDF viewer (no browser toolbar in Chrome, Edge,
Firefox or Safari). The pages are drawn by PDF.js (the `pdfjs-dist` package, served from our own origin at `/vendor/pdfjs`,
with a `worker-src 'self' blob:` in the CSP; no CDN and no `<iframe>`/`<embed>` of the PDF).

```js
openPdfPreview({ url, title, filename })    // fetched through the api client, so the session applies
openPdfPreview({ blob, title, filename })   // or a PDF already in hand
```

A large dialog on desktop and a tall sheet on a phone (one page wide, no sideways scroll), the title and the page count in
the head, the pages on paper (the `--paper` token: the page stays paper-coloured in dark mode, the dialog follows the
theme), and only **Download PDF** (saves the file under its name) and **Print** (sends the pages to the browser's print
dialog from a hidden frame, with no viewer shown). `previewBlobModal` in `core/dom.js` hands a PDF to it, so every place that
opened a PDF does too.

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

## Scroll row

`ui/scroll-row.js`: a row of tabs or chips that scrolls sideways with no scrollbar showing; a mouse wheel
moves it too, then the page scrolls at either end. The module tabs, the record's tabs and the document
category chips use it. Not for tables, which keep their scrollbar.

```js
scrollRow(h('div', { className: 'flex gap-2 overflow-x-auto' }, chips));
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
| Routes to screens | `public/js/sections/app-shell.js` `SCREENS`: route pattern to the screen's mount function, which draws the whole screen (there are no HTML templates) |
| The phone header's title on a record | `public/js/shell/phone.js` `setPhoneTitle(text)` |
| Rail, module tabs, phone header, bottom bar and More sheet | `public/js/shell/rail.js`, `module-tabs.js`, `phone.js` |

## Screen parts

Pieces of the Ratings screens, in `public/js/sections/`, shared by the record, My Details and New Rating.

| Name | File | What it is |
|---|---|---|
| `SECTIONS`, `sectionFields(section, lookups, values)`, `readForm(form)`, `displayRows(section, r)`, `wireCascades(scope, lookups)`, `dateField(name, value)` | `rating-fields.js` | The rating's own fields in their four sections (Basic Details, Contact, Health, Official): the New Rating steps, the record's Edit dialogs and its read-only cards all come from this one catalogue. `wireCascades` links Religion to Denomination and State to Local Government |
| `CHILD_TABS`, `childPanel({ serviceNumber, tab, rows, rating, readOnly, lookups, onChange })` | `rating-children.js` | The record's list tabs (Next of Kin as cards with photos, Drafting as a timeline, the rest as tables) with Add and Edit in a dialog and Delete after a confirm |
| `documentsBlock({ serviceNumber, readOnly, onCount })` | `rating-documents-block.js` | Category chips with counts, the file list and its preview, Upload Document. Used by the record's Documents tab and the Documents screen |
| `openNewRating({ onClose })`, `newRatingButton()`, `photoPicker()`, `uploadPassport(serviceNumber, file)` | `rating-new.js` | The New Rating dialog: the four steps in one form, the passport photo uploaded after the rating is created |
| `mountRatingRecord`, `mountMyDetails`, `photoAvatar(r, size)` | `rating-record.js` | The record (head row, completeness bar, ten tabs) and My Details, the same record read-only |
| `shortRate(rate)`, `personName(r)`, `ratingName(r)` | `rating-names.js` | How a rating is named on screen, the same everywhere |

```js
import { openNewRating } from './rating-new.js';
newRatingButton();                      // the page header's New Rating button
openNewRating();                        // what #ratings/new and the phone's floating button do
```

## Core helpers

| Name | File | What it does |
|---|---|---|
| `api.get / post / put / del / upload`, `downloadFile`, `fetchBlob` | `core/api.js` | Every request: the session token, JSON or form data, blob downloads, errors as `{ code, message, fields }` |
| `parseDisplayDate(text)`, `wireDateField(input)`, `formatDisplayDate(value)`, `toInputDate(value)`, `yearsBetween(from, to)`, `durationSince(from)` | `core/dates.js` | Dates are typed and shown as dd/mm/yyyy and sent as YYYY-MM-DD. `parseDisplayDate` returns the ISO date or `null` for a date that does not exist; `wireDateField` tidies a field when it loses focus |
| `getLookups()`, `filterDenominations(lookups, religionId)`, `filterLgas(lookups, stateId)` | `core/lookups.js` | The dropdown lists, loaded once per visit |
| `el`, `clear`, `populateSelect`, `previewBlobModal`, `formatBytes` | `core/dom.js` | Small DOM helpers (`el` is `ui/html.js` `h`); `previewBlobModal` shows a PDF or image in the dialog |
| `icon(name, className)` | `core/icons.js` | One icon from the sprite |
| `setAccess({ privileges, user })`, `can(screen, action = 'view')`, `pageAllowed(page)`, `moduleVisible(m)`, `moduleHref(m)`, `visibleTabs(m)`, `homeHref()`, `hasFullAccess()` | `core/access.js` | What the signed-in person may open and do: the shell fills it from `/api/auth/me`; every menu, tab and button asks `can()`. The server checks the same privileges on every route |
| `startLock(session)`, `lockScreen(reason)`, `announceSignOut()` | `shell/lock.js` | The session lock: locks after the idle time or from Lock Screen in the account menu, unlocks with the password only, and locks, unlocks and signs out every open tab together |
| `openChangePassword({ forced })` | `shell/password.js` | Change Password (account menu) and the forced change before anything else opens for a new or reset account |
| `currentTheme()`, `setTheme(theme)`, `toggleTheme()`, `onThemeChange(fn)`, `bindThemeButton(button)` | `core/theme.js` | Light or dark. `bindThemeButton` makes a button the switch: it shows a moon or a sun and says the mode it switches to. `core/theme-boot.js` (a plain script in each page's `<head>`) sets the first one before the page draws |

