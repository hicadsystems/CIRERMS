# CIRERMS — Nigerian Navy Ratings Management (Migration Demo)

Modernised **Ratings Management** slice of the **Centralised Integrated Ratings Electronic Records Management System (CIRERMS)**, demonstrating a clean migration from legacy **ASP.NET MVC / Razor / jQuery DataTables** to a zero-framework **HTML5 + Tailwind CSS + Vanilla ES Modules SPA** backed by **Node.js (Express) + MySQL 8**.

---

## 1. Tech Stack & Migration Mapping

| Legacy .NET Layer | Modernised Stack | Why Chosen |
|---|---|---|
| ASP.NET Razor Layouts (`_Layout.cshtml`) | `public/index.html` + `public/app.html` + `public/js/shell/` | Persistent shell loaded once: on desktop a sidebar grouped by area (folds to icons), a top bar with Ctrl K search and the module's pages as tabs; on a phone a header, chips, a bottom bar and a More sheet. No full-page postbacks. |
| Razor Partial Views (`.cshtml`) | `public/js/sections/*.js` built from the component kit in `public/js/ui/` | Each screen is an ES module that draws itself with shared parts (page header, list view, dialog and bottom sheet, tabs, stepper, toasts); no HTML templates and no React/Vue/Vite build chain. |
| Bootstrap 3 + Legacy Custom CSS | **Tailwind CSS v3** (`public/css/output.css`) | Precompiled single stylesheet. Colours are tokens in `public/css/input.css`: the CIRERMS naval palette (`#0074a8`, `#02a9f4`, `#1caf9a`, `#428bca`, `#d9534f`, `#1d2939`) with ivory surfaces on an ivory-to-pale-blue gradient (no white anywhere), light and dark mode ("Navy Night", following the device until the person chooses), rounded corners, soft shadows and theme-blue scrollbars. |
| ASP.NET MVC Controllers + Services | **Node.js 20 + Express 4** (`routes` → `service` → `repo`) | Strict 3-layer separation: HTTP concerns in `*.routes.js`, validation & transactions in `*.service.js`, parameterised SQL in `*.repo.js`. |
| Entity Framework / SQL Server | **MySQL 8 (`mysql2/promise`)** + `migrate.js` | Explicit `-- UP` / `-- DOWN` SQL migrations with SHA-256 checksum drift detection, advisory `GET_LOCK` concurrency safety, and idempotent seeds. |
| Server-side Reports & Imports | **`exceljs` + `pdfkit` + `multer` v2** | Streaming `.xlsx` / `.csv` exports, `.xlsx` batch template & transactional bulk import, official Nigerian Navy PDF dossiers, and magic-byte validated uploads. |

---

## 2. Demo Scope

### Implemented Screens (Ratings Management Slice)

Every screen works on desktop (761 px and up) and on a phone (760 px and below), and every "add" opens in a dialog (a bottom sheet on a phone).

1. **Sign In** (`/index.html`) — an animated sea with rolling waves, by day in light mode (a warm sun glow) and by night in dark mode (stars and a moon glow), with the Nigerian Navy crest at the left and the sign-in form at the right (the crest above the form on a phone); demo account buttons fill the form, and the button at the top right switches light and dark (the same setting the app uses). JWT session in `HttpOnly` cookie (`cirerms_session`), `bcrypt` password verification, brute-force throttle.
2. **Dashboard** (`#dashboard`) — Live **Members** tile (total, current, former) queried from `ratings`; **Drafting**, **Memos and Mails** and **Appraisals** show `0`; **Recently Enlisted**; **Current Ratings by Rate**.
3. **Current and Former Ratings** (`#ratings/current`, `#ratings/former`) — search by Official No or name, **Rate** and **Ship** filters, 25 a page from the server, a table on desktop and cards on a phone. A clicked rating shows beside the list on a wide screen (in a dialog or bottom sheet otherwise) with **Open Record**, **Print Report** and **Documents**. **Export** (Copy Rows, Excel, PDF, CSV) uses the same filters.
4. **New Rating** (`#ratings/new` or the **New Rating** buttons) — a dialog with four steps (*Basic Details*, *Contact*, *Health*, *Official*) and the passport photo; moving between steps keeps what was typed.
5. **The rating's record** (`#ratings/edit/:serviceNumber`) — photo, name, labels and **Edit Details** / **Print Dossier** / **Delete**; a thin completeness bar (red below 50%, amber to 79%, green from 80%); ten tabs:
   - **Details**: Basic Details, Contact, Health and Official as cards, each edited in a dialog.
   - **Next of Kin** (with photo), **Spouse**, **Children**, **Advancement**, **Drafting** (a timeline with the current posting), **Training**, **Education**, **Language**: Add and Edit in dialogs, Delete after a confirm, tab PDFs where the old system had them.
   - **Documents**: category chips (`DRAFTING`, `CERTIFICATE`, `REQUEST_FORM`, `EMOLUMENT`, `GEN_FORM`, `OTHER`), file list, preview, download and upload.
6. **My Details** (`#ratings/my-details`) — the same record read-only, resolved from `users.service_number` (a clear notice for an unlinked admin like `HICO001`; the full record for `B0539`).
7. **Batch Upload** (`#ratings/upload`) — **Download Template** (with an embedded lookup reference sheet), **Upload Workbook**, **Review and Commit**: compulsory fields, dates and lookups enforced, duplicate Official Numbers skipped, the rest added in one transaction.
8. **Documents** (`#ratings/documents`) — find a rating by Official No or name, then its Navpers files by category, with preview, download and upload.
9. **Search** (Ctrl K, or the search button) — finds screens and ratings by Official No or name.
10. **Users, roles and privileges** — each user has one role; a role holds privileges, each one action (view, add, edit, delete, approve) on one screen. The server checks them on every route (403 otherwise) and the screens hide the menus, tabs and buttons a person may not use; a page opened without the grant shows a not-allowed notice. **Administrator** holds every privilege; **Rating** holds *View My Details* only, as in the old system.
11. **Audit trail** — every saved change (who, when, what, which table and record, and what changed, field by field) and every sign in, sign out, lock and unlock, written in the same transaction as the change. Read through `/api/audit` (25 a page, filtered by date, user and action) for the System Administration screens.
12. **Session lock** — locks after 15 minutes without use (`SESSION_IDLE_MINUTES`) or from *Lock Screen* in the account menu; unlocks with the password only, checked by the server; *Sign Out* from the lock screen. While locked the page is hidden and the server refuses the session's requests; every open tab locks and unlocks together.
13. **Static Tables** (`#tables/<slug>`, 16 tabs) — one table engine for Appraisal Ratings, Branch, Exit Type, Entry Mode, Offences, Sanctions, Institution, Local Government, Languages, Relationship, Staff Branch, Specialisation Area, Ships, States, Title and Training. Each tab is a searchable list (25 a page from the server) with **Add** and **Edit** in a dialog (a bottom sheet on a phone), a Status of Active or Inactive, and **Delete** after a confirmation. A row that records use cannot be deleted: the message says where it is used (for example "in use (5 ratings)") and the row can be made Inactive instead, which takes it out of the dropdowns while the records that hold it still show it. Every write is audited. Each table is its own privilege, `tables.<slug>` with view, add, edit and delete, checked on every route and used to hide the buttons. Details below, *Static Tables*.

*(The other sidebar items — Drafting, Special Drafting, Training Drafting, Advancement Processing, Naval Character Assessment, Disciplinary Action, Discharge Administration, Reports and System Administration — carry a **Soon** badge and open a "Coming in a Later Release" page; they are shown to the Administrator only.)*

How a module registers itself, declares its privileges and writes to the audit trail: `CONVENTIONS.md`, *Access, audit and modules*.

The approved layout and look is `docs/design/demo.html` (one file; open it in a browser). `docs/design/components.md` lists the shared components.

The map of the old system (how it is built, one file per module, definitions from its 2017 backup) is in `docs/legacy/` (start at `docs/legacy/README.md`).

### Static Tables

One engine serves all 16 tables. `src/modules/tables/tables.config.js` holds a config per table; the routes (`tables.routes.js`), rules (`tables.service.js`), SQL (`tables.repo.js`) and the screen (`public/js/sections/static-table.js`) read it and know no table by name.

| API | Does | Needs |
|---|---|---|
| `GET /api/tables/<slug>?q=&status=&page=` | the list, 25 a page, `meta` with the totals; `q` searches every text column and the linked names | `tables.<slug>` view |
| `GET /api/tables/<slug>/meta` | the columns and the dropdown rows the dialog needs | view |
| `GET /api/tables/<slug>/:id` | one row, and where it is used (`usage`, `in_use`) | view |
| `POST` / `PUT /api/tables/<slug>[/:id]` | add / edit: required, length, range, the fixed choices, linked rows that exist, no duplicates (422 with a message per field) | add / edit |
| `DELETE /api/tables/<slug>/:id` | deletes a row nothing uses; 409 `IN_USE` with where it is used otherwise | delete |

**The tables and their columns** (the demo's): Appraisal Ratings (Grade, Code, Score Range), Branch, Exit Type, Entry Mode, Offences (Offence, Code, Category), Sanctions (Sanction, Severity), Institution (Institution, Location, Type), Local Government (Local Government, **State**), Languages, Relationship (the next of kin type table), Staff Branch, Specialisation Area, Ships (Ship, **Type**: Ship or Base), States, Title, Training (Course, **Institution**, **Weeks** in the list; Branch or Any, Specialisation or Any, and Rates in the row's dialog: none picked means every rate). Appraisal Ratings, Offences, Sanctions, Institution and Training are new tables (`20261120_020000_create_static_tables.sql`); Ships gained `type`. Rates, commands and the other dropdown tables that are not among the 16 stay seeded by SQL.

**Add a table.** Create the `ref_` table in a migration of your package's block (`id`, `name`, `sort_order`, `is_active`, the dates, `created_by`, `UNIQUE (name)`), add an entry to `TABLES` in `tables.config.js` (its columns, and `usedBy`), add the slug, tab and title to `TABLES` in `public/js/core/nav.js`, and seed its demo rows and grants in your own seed (the privilege `tables.<slug>` appears in the catalogue by itself, and the Administrator gets it from the sync).

**Add a column.** Add it to the table in a migration, then to `columns` in the table's config (`type` text, select, number, ref or multi, with `required`, `max`, `unique`, `list` and so on; `tables.config.js` explains each). The dialog, the list, the validation and the audit trail pick it up.

**Say where a row is used.** When a package adds a table that refers to a static table (WP4: the incident's offence and sanction; WP6: the training history's course), it adds `{ table, column, noun: [one, many] }` to that static table's `usedBy`. A row any `usedBy` entry refers to cannot be deleted (a foreign key also stops it, and shows the same message). Each package reads the active rows of its own dropdowns from `GET /api/tables/<slug>/meta` or its own query; `/api/lookups` still serves the ratings screens (active rows, with `inactive` kept apart so a record can still show and keep a value that has since been made inactive).

**Decisions made where the design was silent** (the rest follow PLAN section 9c):
- Offence **Code** is optional (the old offences had only a name) but unique when given; Appraisal Rating Code is required and unique. Category and Severity are optional fixed choices; Institution Type is an optional fixed choice (the demo's five).
- A new row goes to the end of its dropdown order (`sort_order` is not shown); every table's name is unique (a local government's within its State, case ignored).
- Ships' Type is required (Ship or Base); the existing ships are Ships except the seven the demo lists as Bases.
- A Training course needs its Institution and Weeks (1 to 520); Branch and Specialisation are empty for Any; Rates are picked from a dropdown that adds a chip.
- A row opens its dialog from the row or its Edit button; without the Edit grant it opens read-only (View).
- Relationship has the two types the demo ratings use (Primary, Secondary) and the demo's eleven.
- The seed adds the old system's `StaticTables` role ("Static Tables": view, add, edit and delete on all 16). Manage Roles (WP3) will group `tables.*` under Static Tables.

---

## 3. Demo Credentials

| Username | Password | Role | Linked Service No. | Purpose |
|---|---|---|---|---|
| `HICO001` | `Admin@123` | Administrator | `NULL` | Every privilege; demonstrates unlinked admin notice on *View My Details*. |
| `B0539` | `Rating@123` | Rating | `B0539` | *View My Details* only: linked to **PO Okonkwo Chukwuemeka**, sees the read-only dossier and nothing else (403 from every other API). |

---

## 4. Quick Start

### Option A — Docker Compose (Recommended One-Command Setup)
```bash
cp .env.example .env
docker compose up --build
```
Open **http://localhost:3000**. MySQL 8 starts, migrations and seeds run automatically, and the Express server launches on port `3000`.

### Option B — Local Node.js 20 + MySQL 8
1. Ensure Node.js `>= 20` and MySQL `8.x` (or MariaDB `10.11+` / `11.x`) are running, and create an empty UTF-8 database:
   ```sql
   CREATE DATABASE cirerms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Configure `.env`:
   ```bash
   cp .env.example .env
   # Edit DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, and JWT_SECRET in .env
   ```
3. Install dependencies, run migrations + seeds, and start the server:
   ```bash
   npm install
   npm run migrate:up
   npm run seed
   npm start
   ```
4. Open **http://localhost:3000**.

---

## 5. Database Migration & Seed CLI

| Command | Description |
|---|---|
| `npm run migrate:status` | Show `APPLIED`, `PENDING`, `CHANGED`, or `MISSING` status for every migration file. |
| `npm run migrate` / `npm run migrate:up` | Apply all pending migrations in filename order under a MySQL advisory lock. |
| `npm run migrate:down` | Roll back the most recently applied batch (`npm run migrate:down 2` rolls back 2 batches). |
| `npm run migrate:fresh` | Drop all tables, re-apply all migrations, and run seeds (**blocked when `NODE_ENV=production`**). |
| `npm run migrate:make <name>` | Scaffold a new timestamped `.sql` migration file in `src/db/migrations/`. |
| `npm run seed` | Sync the privilege catalogue from the module manifests, then run the idempotent lookup, demo personnel and role seeds (`INSERT IGNORE` / `WHERE NOT EXISTS`). |
| `npm run css:build` | Recompile minified Tailwind CSS (`public/css/input.css` → `public/css/output.css`). |
| `npm run icons:build` | Rebuild the icon sprite (`public/assets/icons.svg`) from the Lucide icons listed in `scripts/build-icons.js`. |
| `npm run demo:build` | Rebuild the design reference (`docs/design/demo.html`) from its source with the project's current tokens and icons. |

---

## 6. Walk-through Tests

`tests/e2e/access-walkthrough.js` signs in as the administrator and as `B0539` on desktop and phone, in light and dark mode: what each sees, the 403s, the audit rows every rating write leaves, and the session lock (Lock Screen, idle time, wrong and right password, other tabs, Sign Out). It uses the Playwright installed on the machine:

```bash
npm run migrate:fresh
npm start
PORT=3001 SESSION_IDLE_MINUTES=0.1 SESSION_SERVER_GRACE_SECONDS=20 node src/server.js   # locks after 6 s
NODE_PATH=$(npm root -g) node tests/e2e/access-walkthrough.js
```

`tests/e2e/static-tables-walkthrough.js` (WP2) walks all 16 tables as the Administrator at 1440 and 390 px in light and dark (list, search, add, edit, make inactive, delete a row in use and an unused one), then the Training and Local Government rules, a rating, a viewer, the Static Tables role and a role with one table's grants (buttons, 403s, Ctrl K), the audit rows and the rating forms' dropdowns. It adds and removes its own throw-away roles and accounts (it reads `.env`):

```bash
npm run migrate:fresh
npm start
NODE_PATH=$(npm root -g) node tests/e2e/static-tables-walkthrough.js
```
