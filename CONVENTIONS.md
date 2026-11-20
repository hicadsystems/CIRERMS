# CIRERMS — Conventions

Rebuild of the CIRERMS ratings HR platform (ASP.NET MVC) as a Node/Express + vanilla JS SPA.
NAVY-PAYROLL is the reference for patterns; CIRERMS keeps its own look and its own database.

## Decisions

| Topic | Decision |
|---|---|
| Stack | HTML / Tailwind CSS v3 / vanilla JS (SPA) + Node.js 20 (CommonJS) / Express 4 |
| Libraries | `mysql2` (parameterised SQL, no ORM), `bcryptjs` + `jsonwebtoken` (auth), `helmet` (headers), `multer` (uploads), `exceljs` (Excel/CSV export & batch upload), `handlebars` + `puppeteer-core` + `@sparticuz/chromium` (printouts: HTML templates turned into PDFs by Chromium), `dotenv` (config) |
| Frontend | `public/` (with pre-compiled `public/css/output.css` so no build step is needed to run) |
| Backend | `src/` — everything server-side lives here, nothing at the project root except entry/config files |
| Uploads | `storage/uploads/` (outside `public/`, configurable via `UPLOAD_DIR`), served only through authenticated API routes |
| Serving | Express serves `public/` + `/api` from one process (Docker, cPanel Node app, VPS) |
| Database | MySQL 8+ (compatible with MariaDB 11; Postgres under discussion). All SQL stays in `*.repo.js` so a DB switch stays cheap. No stored procedures, functions, triggers or views: logic is code in `*.service.js` with plain parameterised SQL in `*.repo.js`, and the old system's procedures are rewritten that way |
| Data | Own database. No data shared with payroll |
| Organisation | Module-first: one folder per sidebar menu |
| Look & feel | CIRERMS colours (`#0074a8` sidebar, `#02a9f4` active pill, `#1caf9a` teal, `#d9534f` red, `#428bca` blue, `#1d2939` dark navy, `#e4e7ea` canvas), held as tokens in `public/css/input.css` and named by role (see Frontend). No white anywhere: ivory surfaces on an ivory-to-pale-blue page gradient. Light and dark mode (dark is "Navy Night"), following the device until the person chooses. Rounded corners, soft shadows, blue scrollbars. Nigerian Navy crest, sidebar, stat cards, Lucide icons. The approved look and layout is `docs/design/demo.html`. Payroll-style SPA behaviour |
| Auth | Payroll-style JWT login against `users` table (separate from `ratings`), in an HttpOnly cookie naming a `user_sessions` row (so a session can be signed out, locked and refused). Every account belongs to a rating (owner's rule, 19/11/2026): `users.service_number` is required, unique, and is the account's user name, the Hicad administrator `HICO001` included (a rating of that official number is in the demo data); it also decides *View My Details*, which so works for every account. **An account's name is its rating's** (`src/shared/rating-name.js`: rate abbreviation, surname, first name, as the rest of the app writes a rating's name); `users.full_name` is not read. Each user has one role (`users.role_id`); a role holds privileges, each one action (view, add, edit, delete, approve) on one screen id, checked on every route and used to hide what a person may not do (see *Access, audit and modules*) |
| Out of scope (for now) | CI pipelines. On hold until the legacy system is available as reference: Reports (its look is agreed in `docs/design/demo.html`). The other modules not yet built. System Administration is built (WP3) |
| Current focus | Ratings Management only — migration show-and-tell demo |

## Folder layout

```
CIRERMS/
├─ src/
│  ├─ server.js                 # boot + listen
│  ├─ app.js                    # express: middleware, /api, static public/, SPA fallback
│  ├─ config/index.js           # reads .env → one frozen config object
│  ├─ db/
│  │  ├─ index.js               # pool, query(), transaction(), close()
│  │  ├─ migrator.js            # migration & seed engine
│  │  ├─ migrations/            # YYYYMMDD_HHMMSS_name.sql
│  │  └─ seeds/                 # 001_lookups.sql, 002_demo_ratings.sql
│  ├─ middleware/               # auth.js (session), access.js (privileges), error.js, upload.js
│  ├─ shared/                   # audit.js (the audit trail helper), password.js (hash, rules, one-time passwords), excel.js, printouts/ (renderPdf: Chromium and Handlebars), dates.js, errors.js,
│  │                            # settings/ (values the business may change: the due rules), scheduled/ (changes that take effect on a later date)
│  ├─ templates/printouts/      # the printout templates (.hbs), partials, printout.css, helpers.js, fonts: D4's approved design
│  └─ modules/
│     ├─ index.js               # module registration: mounts every <module>/<module>.module.js
│     ├─ auth/                  # auth.module.js  auth.routes.js  auth.service.js  auth.repo.js  auth.throttle.js
│     ├─ access/                # roles (add, edit, delete) and the privilege catalogue, for Manage Roles
│     ├─ audit/                 # the audit trail (read side, for Audit Trail)
│     ├─ users/                 # Manage Users and Manage Password: accounts, one-time passwords, deactivation, reset
│     ├─ tables/                # Static Tables: tables.module.js  tables.config.js (one config per table)  tables.routes.js  tables.service.js  tables.repo.js
│     ├─ dashboard/             # dashboard.module.js  dashboard.routes.js  dashboard.service.js  dashboard.repo.js
│     ├─ ratings/               # ratings.module.js  ratings.routes.js  ratings.service.js  ratings.repo.js
│     └─ lookups/               # lookups.module.js  lookups.routes.js  lookups.service.js  lookups.repo.js
├─ public/
│  ├─ index.html                # sign in (auth.login): the sea canvas (js/sections/login-canvas.js; day or night), crest, form, light / dark switch
│  ├─ app.html                  # shell slots: rail, top bar, module tabs, phone header, <main>, bottom bar
│  ├─ js/core/                  # api, router, nav (the navigation catalogue), access (can(screen, action)), search (Ctrl K hook),
│  │                            # dates, dom, lookups, icons, choices, theme-boot (light or dark before the page draws) and theme (the switch)
│  ├─ js/shell/                 # rail, module-tabs, phone (header, bottom bar, More sheet), search-palette, session, lock (the session lock)
│  ├─ js/ui/                    # the component kit (docs/design/components.md)
│  ├─ js/sections/              # one file per screen (dashboard, ratings-list, rating-record, ratings-upload, ratings-documents, static-table,
│                            # admin-users, admin-roles, admin-password, admin-audit),
│  │                            # the record's parts (rating-*.js) and app-shell.js (loads each page's screen from nav.js)
│  ├─ css/                      # tailwind input.css (design tokens) + compiled output.css
│  └─ assets/                   # navy-logo.png (app crest), navy-crest.webp (large crest, sign in), icons.svg (built by scripts/build-icons.js)
├─ docs/PLAN.md                # the project plan: work packages, models, order, status
├─ docs/ADMIN.md               # the administrator session's handbook: role, owner's rules, how to check a branch
├─ docs/waves/                 # the remaining waves, one brief per wave for any developer (start with README.md)
├─ docs/reports/               # report notes: one per package, committed last on its branch
├─ docs/design/                 # demo.html: the approved layout and look (open it in a browser); demo-src.html + build-demo.js
│                               # rebuild it (npm run demo:build); components.md: the kit and the screen parts
├─ docs/legacy/                 # map of the old system: README.md (how to trace a page), one file per module, sql/ (definitions only)
├─ scripts/build-icons.js       # builds public/assets/icons.svg from Lucide (npm run icons:build)
├─ storage/uploads/             # runtime uploaded photos & personnel documents (gitignored)
├─ migrate.js                   # migration CLI
├─ tailwind.config.js           # names the colour tokens, the phone/desk screens and the shared sizes
├─ CONVENTIONS.md
├─ README.md
├─ .env.example
├─ Dockerfile
├─ docker-compose.yml
└─ package.json
```

New modules (drafting, advancement, discipline, ...) are added as a folder under `src/modules/` with a
manifest (`<module>.module.js`: its routes and privileges), their screens as files in `public/js/sections/`,
and their pages (with `screen`, `action` and `view`) and tabs in `public/js/core/nav.js`; nothing else moves
(see *Access, audit and modules*).
Tests: `tests/e2e/` holds Playwright walk-throughs (run with the machine's Playwright, see each file's header).

## Backend layering

Every module has three files, each with one job:

| File | Does | Never does |
|---|---|---|
| `<module>.routes.js` | Read request, call service, send response | SQL, business rules |
| `<module>.service.js` | Business rules (duplicates, current vs former, date/FK/upload validation) | Touch `req`/`res`, write SQL |
| `<module>.repo.js` | All SQL for the module, parameterised | Business decisions |

- Always use placeholders (`?`), never string-built SQL (identifiers like validated sort columns come strictly from allowlists).
- Any save touching more than one table (or multi-row batch import) uses `transaction()`.
- Services throw errors from `shared/errors.js`; `middleware/error.js` turns them into responses.

## API

- Routes: `/api/<module>/<resource>` — e.g. `GET /api/ratings`, `POST /api/ratings/:serviceNumber/next-of-kin`.
- Success: `{ "data": ..., "meta": { "page", "pageSize", "total", "totalPages" } }` (`meta` only on lists).
- Error: `{ "error": { "code": "DUPLICATE_OFFICIAL_NO", "message": "...", "fields": { ... } } }`.
- Lists are paged (25), filtered and sorted on the server: `GET /api/ratings?status=current|former|all&q=<Official No or name>&rateId=&shipId=&page=1&pageSize=25`.
- Exports (Excel/CSV/PDF) are server endpoints that use the same filters as the list; Copy copies the visible rows to the clipboard.

## Naming

| Thing | Style | Example |
|---|---|---|
| Files & folders | kebab-case | `my-details.js`, `filter-bar.js` |
| JS variables/functions | camelCase | `findByServiceNumber` |
| DB tables & columns | snake_case | `rating_next_of_kin.service_number` |
| Lookup tables | `ref_` prefix | `ref_rate`, `ref_title`, `ref_branch` |
| Screen ID | `module.screen` | `ratings.list`, `ratings.new` |

The **screen ID** is the single name for a screen: its page in `js/core/nav.js` (`screen`), the menu item, and
the privilege key (with an action: view, add, edit, delete, approve). UI labels preserve familiar
naval wording ("Official Number" / "Service No") while the DB and API standardise on `service_number`.

## Database

- **`ratings` uses `service_number VARCHAR(20)` as its natural primary key** (no surrogate `id`).
  Every child table (`rating_*`) references `ratings(service_number)` with `ON DELETE CASCADE ON UPDATE CASCADE`,
  and `users.service_number` references it with `ON DELETE RESTRICT ON UPDATE CASCADE` (a rating that has an account
  cannot be deleted: accounts are deactivated), so correcting a service number cascades cleanly across all related records.
- **All other tables** (`users`, `ref_*`, `rating_*`) have `id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY`,
  plus `created_at`, `updated_at`, `created_by`.
- **Login accounts (`users`) are separate from personnel records (`ratings`)**; `users.service_number` is required
  and unique: every account belongs to exactly one rating, and a rating has at most one account.
- **Lookup tables (`ref_*`)** carry `name`, `sort_order`, `is_active` (plus `code` on `ref_document_category`,
  `religion_id` on `ref_religion_denomination`, and `state_id` on `ref_local_government`). Dropdown queries filter
  `is_active = 1` and sort by `sort_order, name`; a record that holds a value since made inactive still shows it,
  and its edit form still offers it (`/api/lookups` keeps the inactive rows apart, `optionsWithHeld` in
  `js/core/lookups.js`). The 16 Static Tables are maintained through one engine (see *Access, audit and modules*).
- **`ratings.status`** is `ENUM('current','former')` paired with optional `exit_type_id`, `exit_date`, `exit_reason`.
- Real `DATE` / `DATETIME` columns. Missing date = `NULL` — never `0001-01-01`.
- Derived values (**current ship** from the open `rating_drafting` row where `end_date IS NULL`,
  **duration on current ship**, **previous ships**, and **age** from `date_of_birth`) are calculated from history,
  not stored as columns.
- Child tables `rating_training` and `rating_language` join `ratings` when displaying the rating's `Name` column.
- Dates go over the wire as ISO `YYYY-MM-DD`; the UI shows `dd/mm/yyyy`.

## Migrations

Based on NAVY-PAYROLL's migrator, with fixes.

**File format** — `src/db/migrations/20261116_090200_create_ratings.sql`:

```sql
-- UP
CREATE TABLE ratings ( ... );

-- DOWN
DROP TABLE ratings;
```

**Initial migration order**

1. `20261116_090000_create_users.sql` — `users` login table
2. `20261116_090100_create_lookups.sql` — 28 `ref_*` lookup tables
3. `20261116_090200_create_ratings.sql` — `ratings` table + `fk_users_rating` on `users`
4. `20261116_090300_create_rating_records.sql` — 9 `rating_*` child tables
5. `20261120_010000_create_roles_privileges.sql` — `roles`, `privileges`, `role_privileges`; the Administrator and Rating roles
6. `20261120_010100_users_role_id.sql` — `users.role` (a string) becomes `users.role_id` (existing values moved across)
7. `20261120_010200_create_user_sessions.sql` — `user_sessions`: open, locked or ended sign-ins
8. `20261120_010300_create_audit_trail.sql` — `audit_trail`
9. `20261120_020000_create_static_tables.sql` — the Static Tables' columns and new tables (WP2)
10. `20261120_030000_users_admin.sql` — `users`: e-mail, phone, Specialisation, `must_change_password`, `password_changed_at` (WP3)
11. `20261120_030100_users_require_rating.sql` — `users.service_number` becomes required (an account with none gets a rating of its user name first) and the link `ON DELETE RESTRICT` (WP3)
12. `20261120_030200_users_name_from_rating.sql` — `users.full_name` becomes nullable and unused (an account's name is its rating's, `src/shared/rating-name.js`) (WP3)
13. `20261120_070000_create_drafting.sql` — `settings`, `scheduled_changes`, `manning_requirements`, `batches`, `batch_approvals`, `draft_rows` (WP7a)
14. `20261120_080000_create_advancement.sql` — `advancement_rows` (the DOA flow's rows), `advancement_uploads` (WP8)
15. `20261120_060000_create_training_batches.sql` — `training_batches` and `training_batch_ratings` (WP6)
16. `20261120_050000_create_discharge.sql` — `discharge_proposals`, `discharge_rows`, `discharge_reengagements`, `discharge_uploads` (WP5)

Each work package numbers its migrations in its own block, `20261120_WW####_name.sql` (WP1 is `01`).

**Commands**

| Command | Does |
|---|---|
| `npm run migrate:make <name>` | Create a timestamped file with UP/DOWN sections |
| `npm run migrate:up` | Run pending migrations as one batch |
| `npm run migrate:down [steps]` | Roll back the last batch (or N batches) |
| `npm run migrate:status` | Show applied, pending, changed and missing files |
| `npm run migrate:fresh` | Drop all, migrate, seed — refuses when `NODE_ENV=production` |
| `npm run seed` | Run seeds (safe to rerun) |

**Rules**

- `migrations` table records `name`, `batch`, `checksum` (SHA-256 with LF-normalised line endings), `applied_at`.
- Checksums: editing an already-applied migration is flagged — write a new migration instead.
- Run lock: MySQL advisory lock (`GET_LOCK`) ensures two `migrate:up` runs can't overlap.
- Stops at the first failing statement and reports file, statement and what's applied.
  (MySQL commits schema changes immediately, so a failed file can be half-applied — fix forward.)
- No "if column exists" guards — the migrations table already tracks what ran.
- Seeds live in `src/db/seeds/`, insert only missing rows (`INSERT IGNORE` / `WHERE NOT EXISTS` + name subqueries), and never live inside migrations.

## Frontend

- `app.html` is the shell; the router runs the route's mount function (`js/sections/app-shell.js` `SCREENS`),
  which draws the whole screen, its page header included, with the kit in `js/ui/` (there are no HTML templates).
- Every "add" opens in a dialog (a bottom sheet on a phone), New Rating included; Ctrl K opens the search palette
  (`js/shell/search-palette.js`).
- Details read as label and value on one row with a divider (`facts`, `factPanels`), never small capital labels above values.
- A page's picker (batch, period) sits on the page without a card, label above, `desk:w-96`, full width on a phone.
- Date fields are typed and shown as dd/mm/yyyy (`core/dates.js` `parseDisplayDate`) and sent as YYYY-MM-DD.
- All requests go through one api client in `js/core/api.js` (adds token, handles JSON/FormData/blob downloads and errors).
- Navigation lives in one catalogue, `js/core/nav.js` (areas, modules, tabs, every page's title and screen id);
  the rail, the module tabs, the phone header, bottom bar and More sheet, and the router all read it.
- Reusable pieces are in `js/ui/`, one per file (list and examples: `docs/design/components.md`):
  - buttons and action group (`button.js`), page header (`page-header.js`), card (`card.js`), stat tile (`stat-tile.js`),
    pill (`pill.js`), avatar (`avatar.js`), facts list (`facts.js`), empty state (`empty-state.js`), field (`field.js`)
  - dialog and bottom sheet (`dialog.js`), confirm (`confirm.js`), menu (`menu.js`), toasts (`toast.js`)
  - toolbar (`toolbar.js`), list view (`list-view.js`, server paging at 25), pager (`pager.js`),
    list and record (`list-record.js`)
  - in-page tabs (`tabs.js`), stepper (`stepper.js`), completeness bar (`progress.js`)
  - screen parts shared by the record, My Details and New Rating: `js/sections/rating-*.js` (fields catalogue,
    list tabs, documents block, names; see `docs/design/components.md`)
  - small DOM helpers in `js/core/dom.js` (`el`, `clear`, `populateSelect`, `previewBlobModal`, `formatBytes`)
- **A rating is always picked with the rating search select** (`ratingSearch`, `js/ui/rating-search.js`), never a
  typed official number or a hand-made list: from 2 characters it suggests ratings by official number or any name,
  10 at a time from `GET /api/ratings/search` (the next 10 on scroll), each as `B0539 — PO OKONKWO CHUKWUEMEKA
  IFEANYI`. Options `status` (`current`, `former`) and `account` (`with`, `without`); read `.value`, `.rating` or a
  `change` event. A general list search box that matches many fields stays a plain search input.
- **Colours are tokens.** `public/css/input.css` (`:root`) is the only place a colour value lives;
  `tailwind.config.js` names each by its role: `bg-background`, `text-foreground`, `bg-muted` (the page
  canvas) and `text-muted-foreground`, `border-border` and `border-input`, `ring-ring`, `bg-primary` (teal,
  the main action), `bg-secondary` (blue), `bg-destructive`, the status pairs `text-success bg-success-soft`
  (and `warning`, `info`, `error`), and `bg-sidebar` with its `sidebar-*` parts. Each text pair records its
  contrast ratio. Markup uses only these: no hex, no `rgb()`, no Tailwind palette colour (`gray-*`,
  `red-*` ...). The only `cirerms-*` classes left are `.cirerms-scroll` and the completeness bar's.
- **No white.** Nothing is `#fff`, `bg-white` or `text-white`. Surfaces are `bg-background` / `bg-card`
  (ivory `#faf9f0`, sampled from the reference screen), text and icons on a coloured fill are `text-on-fill`
  (the same ivory), and faint tints on the sidebar are `bg-on-fill/10`. The app shell's `<body>` carries
  `app-canvas`, the page gradient (`--canvas-from` / `-via` / `-to`). The sign-in page has its own canvas
  (`--login-*` tokens, drawn by `js/sections/login-canvas.js`, still for people who ask for reduced motion):
  four layers of rolling waves under a day sky with a warm sun glow in light mode, under a night sky with
  stars and a moon glow in dark mode. The large crest sits at the left and the form in a glass card
  (`bg-login-glass`); its text is `text-login-ink`, the footer link `text-login-link`.
- **Accents are `brand`, not `sidebar`.** The selected tab, chip and bottom-bar item, step circles, avatars
  and icon badges use `text-brand`, `bg-brand text-brand-foreground` and `from-brand-fill to-brand-deep`.
  The `sidebar-*` tokens are for the sidebar and the phone header only: in dark mode the sidebar is near
  black and would vanish as an accent.
- **Light and dark.** `:root` holds the light values; `:root[data-theme="dark"]` in `input.css` gives every
  token its dark value, so markup never says `dark:`. `js/core/theme-boot.js` is the first script in the
  `<head>` of every page, before the stylesheet: it sets `data-theme` before the page draws (the person's
  choice, else the device's), so nothing flashes. `js/core/theme.js` switches it (`currentTheme`,
  `setTheme`, `toggleTheme`, `onThemeChange`, `bindThemeButton`), keeps the choice in `localStorage`
  (`cirerms-theme`), follows the device until a choice is made, and carries a choice to the other tabs.
  The switches: the top bar's button (desktop), *Dark Mode* / *Light Mode* in the account menu (sidebar and
  phone), and the button at the top right of the sign-in page; all share the one setting. A fill's text
  is its `*-foreground` token (`bg-primary text-primary-foreground`): in dark mode the bright fills carry
  dark text, so never put `text-on-fill` on `primary`, `secondary`, `destructive` or `brand`.
- **Depth and corners.** `rounded-ctl` (8 px: fields, buttons), `rounded-card` (12 px: cards, panels,
  dropdown lists), `rounded-dialog` (16 px: dialogs); shadows `shadow-card`, `shadow-card-hover`,
  `shadow-pop` (menus, dialogs) and `shadow-btn`, each a token (`--shadow-*`: tinted with the text colour
  in light mode, plain black in dark); actions are gentle gradients (`bg-gradient-to-b
  from-primary to-primary-hover`). Focus is a soft glow: `focus:ring-4 focus:ring-ring/15`.
- **Scrollbars** are thin and the theme blue everywhere (`--scrollbar`); on the blue sidebar the thumb is
  translucent ivory (`.cirerms-scroll`). Rows of tabs and chips show no scrollbar: they scroll sideways by
  swipe, trackpad or mouse wheel (`scrollRow` from `js/ui/scroll-row.js`, class `scrollbar-none`). Tables
  keep their vertical scrollbar and never scroll sideways (Wide tables, below).
- **Type scales with the screen** (owner's decision, 19/11/2026). Font sizes are fluid: every step of
  the type scale grows smoothly from its phone size at 360 px wide to its desktop size at 1440 px (CSS
  `clamp()` in the Tailwind font sizes), so text steps up or down with the screen instead of jumping
  at one breakpoint. Phone text stays light: no huge or heavy headings; a page title or a record's
  name is semibold, about 20 px on a phone, and only grows towards desktop. The scale and its values
  live in `tailwind.config.js` (package T1); screens use the usual size classes and never set sizes of
  their own. Each step is `clamp()`ed, held at its phone size up to 360 px and at its desktop size from
  1440 px, with a line height that scales the same way:

  | Step | Phone | Desktop | Line height (phone, desktop) | Used for |
  | --- | --- | --- | --- | --- |
  | `text-2xs` | 11 px | 11 px | 16, 16 | group labels, counts |
  | `text-xs` | 12 px | 12 px | 16, 16 | captions, hints |
  | `text-sm` | 13 px | 14 px | 20, 20 | body text, fields, tables (never below 13 px on a phone) |
  | `text-base` | 15 px | 16 px | 22, 24 | dialog and sheet titles, the phone header title |
  | `text-lg` | 16 px | 18 px | 24, 28 | small values |
  | `text-xl` | 18 px | 20 px | 26, 28 | a record's name |
  | `text-2xl` | 20 px | 24 px | 28, 32 | a page title, the lock heading |
  | `text-3xl` | 22 px | 30 px | 28, 36 | a stat value, the sign-in heading |

  Headings stay `font-semibold` on a phone (`phone:font-semibold` where desktop is bold); long names use
  `break-words`.
- **Wide tables never scroll sideways** (owner's decision, 19/11/2026). A list whose columns would
  overflow the screen shows only its most informative columns, the ones a person scans to find a
  row; the rest go in the record. Every row is clickable and opens the full record in a dialog (a
  bottom sheet on a phone). On desktop, hovering a row shows a tooltip just below the pointer, as the
  folded sidebar's do, reading "View Details"; the row also gets the pointer cursor and the hover
  tint, and it opens with Enter from the keyboard. On a phone the list is cards and a tap opens the
  sheet. Where the list already shows the picked record beside it (the ratings lists), that stays.
- **Completeness bars** (`.cirerms-progress-track` / `.cirerms-progress-bar`) are thin and plain; set
  `data-level` with the width: `low` (red, 0 to 49%), `mid` (amber, 50 to 79%), `high` (green, 80 to 100%).
- **Two layouts.** `phone:` is 760 px and below (and wins over `sm:` there); `desk:` is 761 px and up.
  Shared sizes: `h-tap` (44 px, the smallest touch target on a phone), `h-control` (36 px fields and buttons
  on desktop), `w-rail` / `w-rail-collapsed` (the sidebar), `max-w-page` (1340 px content), `text-2xs`
  (11 px labels).
- **Icons** are Lucide, served from one sprite, `public/assets/icons.svg`, which holds only the icons listed
  in `scripts/build-icons.js` (add a name there, then `npm run icons:build`). Use `icon('search')` from
  `js/core/icons.js`, or `<svg class="icon"><use href="/assets/icons.svg#search"></use></svg>` in HTML.
  Icons are decorative (`aria-hidden`); the button or link around one names the action.
- **Selects** become searchable dropdowns: `js/core/choices.js` converts every `<select>` (add `data-native`
  to keep one native). Look a select up with `querySelector('[name="…"]')` or its id, never
  `form.elements[…]` (that reaches only its hidden input), and look up again a select you built in JS once
  it is on the page. Its look is set at the end of `input.css`.
- **Printouts open in the app's own preview dialog** (`js/ui/pdf-preview.js`, `openPdfPreview({ url, title, filename })`;
  `previewBlobModal` hands PDFs to it). Where the browser can show a PDF inline (`navigator.pdfViewerEnabled`: desktop
  Chrome, Edge, Firefox, Safari) the dialog shows the PDF in the browser's own viewer with its toolbar hidden, as
  NAVY-PAYROLL does: the server's PDF is fetched as a blob and shown in an `<iframe>` from the blob URL with
  `#toolbar=0&navpanes=0` (CSP `frame-src 'self' blob:`), so it is exactly the PDF that is downloaded; the blob URL is
  revoked on close. Phones and other browsers without an inline PDF viewer get the pages drawn by PDF.js
  (`pdfjs-dist`, from our own origin `/vendor/pdfjs`, CSP `worker-src 'self' blob:`; no CDN) at 2x to 3x resolution with
  the PDF's own background. Only the app's own title, close, Download PDF and Print buttons. Every
  Static Table has **Print List** (`GET /api/tables/<slug>/print?q=&status=`, the `static-table-list` template: the crest, title,
  list columns, Active, row count, date printed and page numbers; the table's view privilege).
- **Printouts are Handlebars templates, made into PDFs by Chromium** (owner's decision, 19/11/2026; WP13). The
  templates, partials, `printout.css`, helpers and fonts are in `src/templates/printouts/` (D4's approved design,
  kept as a record in `docs/design/printouts/` with a `<name>.sample.json` for each template and the sample PDFs);
  the renderer is `src/shared/printouts/` (`renderPdf(template, data, { landscape })` returns a Buffer; settings
  `PDF_*` in `.env`, see README section 7). No pdfkit; no HTML written by hand for a PDF; nothing fetched from the
  internet while rendering. **To add a printout** (a package's brief names the template it needs, usually already
  in the folder): (1) read the template's `.sample.json` in `docs/design/printouts/`: it is the data shape the
  template reads; (2) in your module write `<module>.printouts.js` (or the module's documents file) that turns
  the service's data into that shape and returns `renderPdf('<template>', data)`; (3) pass `generatedBy` (the
  signed-in person's name, `req.user.fullName`) and optionally `generatedAt` (default now) in the data: the footer
  prints them with the time in Nigerian time; (4) the route sends it with `Content-Type: application/pdf`,
  `Content-Disposition: inline; filename="..."` and `X-Content-Type-Options: nosniff`, and the screen opens it with
  `openPdfPreview`; (5) hand the template its facts, `{ label, value, kind }` (kind `code` or `date`), and its
  table, `{ columns: [{ label, key, kind, w }], rows }` (kinds: text, code, name, num, date, ctr, yesno, index,
  check, fill; a row may be `{ group }`, `struck` or a `totals` row): dates may be ISO strings (the template
  writes `dd/mm/yyyy`), empty details read "N/A" in facts and "-" in tables, so hand it empty values, not
  your own placeholders; a list with an orientation of its own sets `orientation` in the data (or passes
  `{ landscape }`), as `static-table-list` does; (6) a new layout is a new `<name>.hbs` using the same partials
  (`head`, `header`, `facts`, `datatable`, `signatures`) and the same `printout.css`: change the shared CSS or
  partials only with the owner's approval, as they are the approved look; (7) a photo goes in as a data URI
  (the page cannot read the app's files) and every other file the template names must be in
  `src/templates/printouts/`; (8) add a check to your walkthrough that the printout opens in the preview with
  pages (`[data-pdf-stage][data-ready="1"]`, `canvas[data-pdf-page]`, `[data-pdf-count]`).
- **Toasts never cover a dialog's buttons** (`js/ui/toast.js`). On a phone they show full width at the top, under
  the header; on desktop they stay at the bottom right, and show at the top right while a dialog is open. They
  sit above a dialog's scrim.
- No other CSS framework or external CDN dependency.

## Access, audit and modules

**A module registers itself.** `src/modules/index.js` mounts every folder with a manifest,
`src/modules/<module>/<module>.module.js`; nothing else is edited to add a module:

```js
module.exports = {
  key: 'drafting',                       // the folder name
  label: 'Drafting',                     // the module's name in the privilege catalogue
  basePath: '/api/drafting',             // where its router is mounted
  routes: './drafting.routes',           // its router
  privileges: [                          // screen ids from public/js/core/nav.js, and their actions
    { screen: 'drafting.proposal', label: 'Print Draft Proposal', actions: ['view', 'add'] },
    { screen: 'drafting.approval', label: 'Draft Approval', actions: ['view', 'approve'] },
  ],
};
```

- **Privileges** are one action (`view`, `add`, `edit`, `delete`, `approve`) on one screen id. The manifests
  form the catalogue, written to `privileges` before the seeds run and when the server starts; roles with
  `full_access` (the Administrator) get every privilege, new ones included. A module's seed grants its
  privileges to other roles (`src/db/seeds/003_access.sql` gives the Rating role View My Details).
- **Every route is guarded.** After `requireAuth`, each route (or the router, before its routes) carries
  `requirePrivilege(screen, action)` or `requireAnyPrivilege([[screen, action], ...])` from
  `src/middleware/access.js`; without the grant the answer is 403 `FORBIDDEN` in the error shape. The server
  refuses to start when a route of a module has no check (only a manifest marked `public`, auth, is exempt).
  `{ own: (req) => ... }` also lets a request through for the person's own record (My Details).
- **Who is signed in.** `requireAuth` loads the session, the user, their role and privileges on every
  request: `req.user` (`id`, `username`, `role`, `fullAccess`, `serviceNumber`, `privileges`), `req.can(screen,
  action)`, and `req.actor`, the actor for the audit trail. `/api/auth/me` returns the user, their privileges
  as `{ screen: [actions] }` and the session (`locked`, `lockReason`, `idleMinutes`).
- **Every write is audited, inside its transaction.** A service write runs in `db.transaction()` and calls
  `audit.record(tx, actor, { action, table, recordId, before, after })` from `src/shared/audit.js`: `INSERT`
  with `after`, `UPDATE` with `before` and `after`, `DELETE` with `before` (the raw rows; what changed is worked
  out, secrets and bookkeeping columns are never kept, an UPDATE that changed nothing is not recorded). Routes
  pass `req.actor` to the service; services never read `req`. Sign in, sign out, lock and unlock are recorded
  by the auth service. The record id is the record's key: a service number, `B0539:12` for a child row.
- **Reading the trail.** `GET /api/audit?from=&to=&user=&userId=&action=&table=&record=&page=` (25 a page,
  newest first, dates `YYYY-MM-DD`), `GET /api/audit/:id` (with its changes), `GET /api/audit/filters`;
  `GET /api/access/privileges` and `GET /api/access/roles` for Manage Roles. Screen ids `admin.audit` (view)
  and `admin.roles` (view, add, edit, delete); see *System Administration* below.
- **The screens hide what a person may not do.** `js/core/access.js` holds the privileges from
  `/api/auth/me`: `can(screen, action)` (action defaults to `view`) decides every button, menu item and tab;
  the rail, the module tabs, the bottom bar, More and Ctrl K show only what may be opened. Each page in
  `nav.js` names its `screen`, the `action` needed to open it (default `view`) and its `view`
  (`{ file, mount, props }`: the section file and the function that draws it, loaded when the page opens).
  A page opened without the grant shows the not-allowed state; `#dashboard` without the grant goes to the
  person's first page.
- **Static Tables** (`src/modules/tables/`): one engine for the 16 tables, driven by `tables.config.js`.
  The privilege of each is its own screen, `tables.<slug>` (view, add, edit, delete); the routes are
  `/api/tables/<slug>` (list, `meta`, one row, add, edit, delete), each guarded by that screen. The screen
  is `js/sections/static-table.js`, which draws every table from its `meta` (a list of 25 a page from the
  server with search, Add and Edit in a dialog, Delete after a confirmation). **A row nothing uses is deleted;
  a row in use is refused with 409 `IN_USE` and says where it is used**; it is made Inactive instead. "In
  use" is read from the database's declared foreign keys (`information_schema`, cascading links excepted):
  **declare a foreign key for every link you add** and the check covers it (WP4's incidents at Offences and
  Sanctions, WP6's training history at Training). To add a table: its `ref_` migration, an entry in `TABLES`
  in `tables.config.js` and in `js/core/nav.js`, and its seed. To add a column: the migration and an entry in
  its `columns` (`text`, `select`, `number`, `bool`, `ref`, `multi`, with `required`, `max`, `upper`,
  `unique`, `list`). Every table carries the codes, flags and links the other modules need and every old
  column that held real data (PLAN 9c); codes are trimmed, upper case and unique. `/api/lookups` carries
  them (codes, flags, links) for the forms and later modules.
- **System Administration** (WP3). Screens `admin.users` (view, add, edit), `admin.roles` (view, add, edit,
  delete), `admin.password` (view, edit), `admin.audit` (view); routes under `/api/users` (accounts, `lookup`,
  `reset-password`), `/api/access/roles` (add, edit, delete) and `/api/audit`. **Passwords** go through
  `src/shared/password.js` only (bcrypt `hash`/`verify`, `validateNew`: at least 8 characters with a letter and a
  digit and different from the current one, `generateOneTime`); a hash is never returned, and no password or
  one-time password is ever logged or written to the audit trail (`audit.record` also drops any field named like
  one). A new or reset account has `users.must_change_password = 1` and a one-time password shown once to the
  administrator; `requireAuth` answers every route with 403 `PASSWORD_CHANGE_REQUIRED` until the person has chosen
  their own (`requireAuth.allowLocked` and `requireAuth.allowPasswordChange` are the exceptions: `/api/auth/me`,
  lock, sign out, `POST /api/auth/change-password`), and the shell shows `js/shell/password.js` before anything
  else. Changing or resetting a password ends the person's other sessions (a reset, all of them); deactivating
  ends them all. Accounts are never deleted. Guards (409 with a code): `SELF_DEACTIVATE`, `SELF_ROLE_CHANGE`,
  `SELF_RESET`, `LAST_ADMIN` (the last active full-access administrator), `ROLE_PROTECTED` (the Administrator
  role), `ROLE_IN_USE`, `DUPLICATE_ROLE`, `DUPLICATE_USERNAME`. **A later module's screens appear in Manage Roles
  from its manifest** (`privileges`), with nothing to add in System Administration; a grant to a role other than
  Administrator is that module's seed. A role change applies from the person's next request (grants are read on
  every request). The screens' shared parts (the View Details row tooltip, the one-time password dialog) are in
  `js/sections/admin-common.js`.
- **Disciplinary Action** (`src/modules/disciplinary/`, WP4): screens `disciplinary.initiate` (add: find a current
  rating, open a case), `disciplinary.pending` (view; **approve** concludes a case, **delete** cancels it with a
  reason), `disciplinary.concluded` (view; **edit** is Correct, with a reason and the before and after kept) and
  `disciplinary.report` (view: screen, PDF, Excel from one filtered query). A case's state is a `status` column
  (`pending`, `concluded`, `cancelled`); nothing is deleted; a concluded case is final apart from Correct. Its
  foreign keys to `ref_disciplinary_offence` and `ref_disciplinary_sanction` feed the Static Tables in-use check. The
  screens take their dropdowns from `GET /api/disciplinary/options` (the module's own guarded source). The rating's
  record shows a **Discipline** tab to whoever may view Concluded Cases (`rating-record.js`; never on My Details, not
  in the completeness). Lists are 25 a page with four key columns, a row opens the case in a dialog (View Details
  tooltip on desktop; `rowTips` in `js/sections/disciplinary-parts.js`), and filters are in a bar that folds into a
  Filters button on a phone.
- **Drafting** (`src/modules/drafting/`, WP7a): screens `drafting.manning` (view, add, edit, delete),
  `drafting.proposal` (view; **add** makes a batch), `drafting.review` (view, add, edit, delete), `drafting.approval`
  (view, **approve**), `drafting.close` (view; **edit** closes), `drafting.wef` (view; **edit** sets the WEF), and the
  read-only reports of WP7b: `drafting.batches` (Batch/Signal Content), `drafting.history` (Rate DOD History) and
  `drafting.report` (Draft Report), all view (`reports.service.js`, `reports.repo.js`, `reports.documents.js`; the pages
  in `js/sections/drafting-reports.js`). One filtered query feeds a report's screen, its PDF and its workbook. A user
  with a Specialisation (`req.user.specialisationId`, from `users.specialisation_id`) is held to that department by
  the service. Three parts are written to be reused:
  - **The batch cycle** (`cycle.service.js`, its SQL in `cycle.repo.js`): `batches` (a `flow`: DOD for drafting, DOA
    for advancement), `batch_approvals` and a flow's own rows table. A package registers its flow
    (`cycle.registerFlow('DOA', { rowsTable, target, targetLabel, closedStatus, noun })`; the rows table has `id`,
    `batch_id`, `service_number`, `rate_id`, `specialisation_id`, `approval_id`, `status` with `proposed`,
    `not_recommended` and its closed status) and calls `batchCode`, `previewBatch`, `openOrCreateBatch` (numbering:
    the code and a six-digit counter per code), `refreshStatus` (open or approved, after any change to rows),
    `clearApproval`, `departments` (the approval list with the rate groups in the Rates table's order),
    `approveDepartment`, `readiness` and `closeBatch` (final; the authority unique across every batch) inside its own
    transaction. Each audits what it writes.
  - **The posting move** (`postings.service.js`): `move(tx, actor, { serviceNumber, shipId, wef, authority, remarks,
    source: { table, id } })` ends the open posting the day before the WEF and opens the new one on it, or, for a WEF
    after today, schedules it; `onSource(table, { applied, cancelled })` tells the caller's record when a scheduled
    move is made (or cannot be); `scheduledFor(serviceNumber)` is what is still to come (the record's Drafting tab
    shows it, `js/sections/drafting-record.js`). Never write `rating_drafting` for a move any other way.
  - **Scheduled changes** (`src/shared/scheduled`): `register(kind, { apply, cancelled })` at load, `schedule(tx,
    actor, { kind, serviceNumber, effectiveDate, payload, source })`, `cancel`, `forRating`, `applyDue({ today })`. The
    server (`src/server.js`) applies the changes due at start and then every hour, each in its own transaction (actor
    `SYSTEM` in the audit trail); a handler's AppError cancels the change with its message, any other error leaves it
    for the next run.
  - **Settings** (`src/shared/settings`, table `settings`: `setting_key`, `value`, `description`): `number(key)`,
    `numbers(keys)`, `list(prefix)`, `set(tx, actor, key, value)` (audited). The due rules live here, named
    `<module>.<rule>` (`drafting.due_months`, `drafting.band_green_to`, `drafting.band_amber_to`); a package adds its
    rows with `INSERT IGNORE` in its seed, so a value someone changed is kept.
- **Discharge Administration** (`src/modules/discharge/`, WP5): screens `discharge.process` (view; **add** makes a
  proposal and adds a rating; **edit** processes and re-engages; **delete** removes a rating), `discharge.service`,
  `discharge.forms` and `discharge.report` (view) and `discharge.upload` (view; **add** imports). `applyExit(tx, actor,
  serviceNumber, { exitTypeId, exitDate, exitReason })` in `discharge.service.js` is the only place a rating leaves:
  Former (status, exit type, date, reason), the open `rating_drafting` posting ends on the exit date, the user
  account is deactivated and its sessions end, and every other scheduled change of the rating dated on or after the exit date is cancelled (`scheduled.cancel`), each step audited, all in the caller's transaction; Process, Upload
  Discharge and the scheduled change all call it. A later exit date is scheduled with
  `scheduled.schedule(tx, actor, { kind: 'discharge', ... })` and the handler registered for `discharge` applies it (or,
  if the rating can no longer leave, puts the row back to pending). Re-engagement is its own table
  (`discharge_reengagements`) and never changes the rating. Exit types offered are the ones with `keeps_current = 0`;
  the death documents are kept only for `is_death`. The due rule and its pill bands are settings
  (`discharge.age_due`, `discharge.service_due`, `discharge.age_band_1` to `3`, `discharge.service_band_1` to `3`).
  Demo ratings and the Discharge account (`B1000`) are in `009_discharge.sql` (official numbers `B1000` to `B1042`):
  a seed takes official numbers no other seed uses, because `INSERT IGNORE` would otherwise quietly keep the earlier
  seed's rating and account.
- **Training Drafting** (`src/modules/training-drafting/`, WP6): screens `training.process` (view; add makes a
  batch and adds ratings), `training.review` (view; edit adds and removes a batch's ratings), `training.history`
  (view; edit sets Attended, a rating's own dates and confirms the history), `training.reports` (view) and
  `training.upload` (view; add imports). A batch is `open` or `closed` (a `status` column); closing is confirming
  its history, which adds a Training entry to each attending rating's record in one transaction, and a closed batch
  is final. Eligibility is one SQL fragment (`eligibleWhere` in the repo) used by the count, the bulk add and the
  checks, so the dialog's count and what is added cannot differ. The batch number is made from the course's id,
  never its optional code. The screens take their dropdowns from `GET /api/training-drafting/options`, and the
  Excel upload reads every row before writing any (`upload/review`, then `upload/import`, which reads the file again).
- **Advancement Processing** (`src/modules/advancement/`, WP8): screens `advancement.due` (view; **add** makes a batch),
  `advancement.review` (view, add, edit, delete), `advancement.approval` (view, **approve**), `advancement.close` (view;
  **edit** closes), `advancement.board` (view; **edit** enters board dates), `advancement.promoted` (view) and
  `advancement.upload` (view; **add** checks and imports). It registers the `DOA` flow on WP7a's batch cycle
  (`cycle.registerFlow('DOA', { rowsTable: 'advancement_rows', target: 'new_rate_id', closedStatus: 'awaiting_board',
  rateColumn: 'new_rate_id', ... })`; `rateColumn` makes the approval's totals count the new rate) and does not copy it.
  Its own reusable part:
  - **The rate change** (`rates.service.js`): `advance(tx, actor, { serviceNumber, fromRateId, toRateId, date, authority,
    decoration, source })` ends the open `rating_advancement` line the day before the date, opens the new rate's line on
    it and sets `ratings.rate_id`, or, for a date after today, schedules it (kind `advancement`); `applyNow` (no
    scheduling: the upload), `onSource(table, { applied, cancelled })`, `scheduledFor(serviceNumber)` (the record's
    Advancement tab shows it, `js/sections/advancement-record.js`). Never change a rating's rate for an advancement any
    other way. The next rate is the next active rate by Rates `sort_order`.
  - Its due rule is in `settings` (`advancement.due_months`, `advancement.band_green_to`, `advancement.band_amber_to`);
    time in rate counts from the latest `rating_advancement` line of the current rate, else `seniority_date`.
- **The session lock** (`js/shell/lock.js`) locks after `SESSION_IDLE_MINUTES` without use (default 15) or
  from Lock Screen in the account menu; it unlocks with the password only (`POST /api/auth/unlock`, under the
  sign-in throttle). While locked the page is hidden and inert, the server answers 423 `SESSION_LOCKED`, and
  every open tab locks, unlocks and signs out together. The server also locks a session that made no request
  for the idle time plus `SESSION_SERVER_GRACE_SECONDS` (120), so a closed or sleeping tab reopens locked.

## Not carried over from the old app

- Unused theme content (chat panel/icon, hidden charts, sample tables).
- Known bugs & markup glitches: Ship Requirement Report's wrong record count; "Report on Appraisal" pointing
  to the dashboard; Concluded Cases and Disciplinary Report sharing one URL; `Next Of Kin Type/th>` broken tag;
  `Qualificatin` and `Religion Denomiation` typos; bare `Ratings Information of ,` heading; `..` placeholder panel text.
- `0001-01-01` placeholder dates.

## Demo scope — Ratings Management

| Screen ID | Screen |
|---|---|
| `auth.login` | Login (`public/index.html`) |
| `dashboard.home` | Dashboard: Members tile live (`total`, `current`, `former`), the others `0`; Recently Enlisted; Current Ratings by Rate |
| `ratings.list` | Current / Former Ratings (one screen, `status`): search, Rate and Ship filters, 25 a page, the picked rating beside the list (1280 px and up) or in a dialog or sheet; Export (Copy Rows, Excel, PDF, CSV) and New Rating |
| `ratings.new` | New Rating: a dialog with the four steps (Basic Details, Contact, Health, Official); `#ratings/new` opens it over the current list |
| `ratings.edit` | The rating's record: head row, completeness bar, ten tabs (Details as four cards with Edit dialogs; Next of Kin, Spouse, Children, Advancement, Drafting, Training, Education, Language with Add / Edit / Delete; Documents) |
| `ratings.upload` | Batch Upload: Download Template, Upload Workbook, Review and Commit (duplicates and rows with errors skipped, the rest added in one transaction) |
| `ratings.my-details` | My Details: the record read-only for the signed-in user's `service_number`, or a notice for an account with none |
| `ratings.documents` | Documents: find a rating by Official No or name, then its files by category, preview, download and upload |

Every screen has both layouts (desktop 761 px and up, phone 760 px and below) and is found by Ctrl K.

The other sidebar items carry a Soon badge and open a "Coming in a Later Release" page (`#soon/<key>`):
Special Drafting (Operations); Naval Character
Assessment (Records); Reports
(Administration). Static Tables is built (16 tabs, `tables.<slug>`), and so is System Administration (4 tabs: `admin/users`, `admin/roles`, `admin/password`, `admin/audit`).
Discharge Administration is built (WP5: 5 tabs, `discharge/process`, `service`, `forms`, `report`, `upload`).
Drafting is built (WP7a: 6 tabs, `drafting/manning`, `proposal`, `review`, `approval`, `close`, `wef`; WP7b: 3 report tabs, `drafting/batches` (and `drafting/batches/:id`), `history`, `report`).
Advancement Processing is built (WP8: 7 tabs, `advancement/due`, `review`, `approval`, `close`, `board`, `promoted`, `upload`).
Training Drafting is built (WP6: 5 tabs, `training/process`, `review`, `history`, `reports`, `upload`).

## Open items

- Real dropdown values (rate, title, religion denomination, tribe, state/LGA, ship, ...) — realistic placeholders seeded until official lists are supplied.
- Demo data: generated synthetic ratings shaped like the real records (`HICO001` the administrator, itself a rating, and `B0539`; every login account is a rating).
- MySQL vs Postgres — final call pending (all SQL isolated in `src/modules/*/*.repo.js`).
