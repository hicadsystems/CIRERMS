# CIRERMS design reference

`demo.html` is the approved layout and look for the CIRERMS frontend (approved 18/11/2026). It is one
self-contained file: open it in a browser, offline. Everything on it is sample data and nothing saves.

| File | What it is |
|---|---|
| `demo.html` | The built demo. Open it; **Phone Preview** (top right) shows the phone layout from a desktop |
| `demo-src.html` | Its source: the shell, every screen and the session lock, in plain JavaScript and Tailwind classes |
| `build-demo.js` | Builds `demo.html` from `demo-src.html` with the project's own `tailwind.config.js`, `public/css/input.css`, icon sprite and `js/core/choices.js` (`npm run demo:build`) |

Because it is built from the project's tokens, a change to `input.css` or `tailwind.config.js` shows in
the demo after `npm run demo:build`.

## What it decides

- **Shell.** Desktop: the sidebar grouped by area (Overview, Personnel, Operations, Records,
  Administration), folding to icons; it keeps its scroll place and brings the current item into view after
  every page change. A top bar with search (Ctrl K) and the module's pages as tabs under it. Phone: a
  header, the module's pages as chips, a bottom bar (Home, Ratings, Documents, My Details, More) and a More
  sheet of every module.
- **Lists.** 25 per page, search and filters above, a table on desktop and cards on a phone. Clicking a
  row shows the record beside the list on a wide screen, in a dialog on a narrower one and in a bottom
  sheet on a phone.
- **Every "add" opens in a dialog** (bottom sheet on a phone), New Rating included: its four steps are in
  the dialog and moving between them keeps what was typed.
- **The rating's record.** No banner: avatar, name, labels and actions on one row, then the thin
  completeness bar (red below 50%, amber to 79%, green from 80%), then the ten tabs.
- **Look.** No white: ivory surfaces on the ivory-to-pale-blue page gradient; rounded corners, soft
  shadows, gradient buttons, the theme-blue scrollbar. The rules are in `CONVENTIONS.md`, Frontend.

## Decided after the demo (build these too)

- **Collapsed sidebar:** each item's name shows in a tooltip just below the pointer.

## Demo only (not to be built as shown)

- The **Layout Demo** badge, **Phone Preview**, the sample data and the `?idle=` address setting.
- The session lock's password check against a fixed demo password (`Admin@123`); the real lock asks the
  server.
- **Administration** (Static Tables, Reports, System Administration) and the **session lock** show the
  agreed look only. They need new tables and API routes and wait on the legacy system as reference.
