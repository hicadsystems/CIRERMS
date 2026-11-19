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
14. **Disciplinary Action** (`#disciplinary/initiate`, `pending`, `concluded`, `report`; WP4) — four tabs. **Initiate Incident** finds a *current* rating by Official No or any part of a name (a former rating is refused with a message) and opens a case in a dialog: incident date (not in the future, not before the rating joined), offence, what happened, reported by; the same rating, offence and incident date twice is refused. A case is numbered `DC-YYYY-NNNN` and keeps the rate and ship the rating had at the time. **Pending Cases** (filters Official No or name and Offence, 25 a page from the server, **Print List** as a PDF): a row opens the case with **Conclude** (decision date not before the incident or in the future, sanction, decision, authority: the *approve* action), **Cancel Case** (a required reason, the *delete* action; the case leaves the lists, nothing is deleted), **Print Case** (the Case Sheet PDF) and Open Record. **Concluded Cases** (filters name, offence, sanction, decided From and To): a concluded case is final apart from **Correct** (the *edit* action: every field but the rating, a required reason, the before and after of each changed field kept with the case and shown in its dialog). **Disciplinary Report**: one filtered query (dates, offence, sanction, ship, rate) feeds the list, three figures, **Print PDF** and **Export Excel**. The rating's record gains a **Discipline** tab (pending and concluded cases, read only) for whoever may view Concluded Cases: never on My Details and not counted in the completeness. Screens `disciplinary.initiate` (add), `.pending` (view, approve, delete), `.concluded` (view, edit), `.report` (view); every write is audited, and an offence or sanction a case uses cannot be deleted in Static Tables. Details below, *Disciplinary Action*.

*(The other sidebar items — Drafting, Special Drafting, Training Drafting, Advancement Processing, Naval Character Assessment, Discharge Administration, Reports and System Administration — carry a **Soon** badge and open a "Coming in a Later Release" page; they are shown to the Administrator only.)*

How a module registers itself, declares its privileges and writes to the audit trail: `CONVENTIONS.md`, *Access, audit and modules*.

The approved layout and look is `docs/design/demo.html` (one file; open it in a browser). `docs/design/components.md` lists the shared components.

The map of the old system (how it is built, one file per module, definitions from its 2017 backup) is in `docs/legacy/` (start at `docs/legacy/README.md`).

### Disciplinary Action

`src/modules/disciplinary/` (manifest, routes, service, repo, documents) and `public/js/sections/disciplinary.js` (the four screens) with `disciplinary-parts.js` (the filter bar, the case dialog and its forms, the Discipline tab). Tables `discipline_cases` and `discipline_case_corrections` (migration `20261120_040000_create_discipline_cases.sql`; seed `006_disciplinary.sql`).

- **A case** has a status, `pending`, `concluded` or `cancelled` (no "empty decision means pending"), the rating (foreign key), the rate and ship at the time, the incident date, the offence (foreign key to `ref_disciplinary_offence`), what happened, reported by, and once concluded the decision date, sanction (foreign key to `ref_disciplinary_sanction`), decision and authority; a cancelled case keeps its reason; who opened, concluded and cancelled it, and when. Dates are real `DATE`s, empty until set.
- **Rules (server side; the dialogs show each message under its field):** only a current rating can have a case opened; incident date not in the future and not before the rating's date employed; decision date not before the incident and not in the future; sanction and offence from the tables (an inactive one only if the case already holds it); the same rating, offence and incident date is refused while another case, pending or concluded, has it; Conclude only a pending case, Cancel only a pending case, Correct only a concluded case (409 otherwise); Correct needs at least one change and a reason, and keeps `[[field, from, to], ...]` and the reason in `discipline_case_corrections`.
- **Routes** `/api/disciplinary`: `options`, `ratings?q=`, `cases` (POST), `cases/pending`, `cases/pending/pdf`, `cases/concluded`, `cases/:id` and `cases/:id/pdf`, `cases/:id/conclude|cancel|correct`, `report`, `report/pdf`, `report/excel`, `rating/:serviceNumber/cases` (the Discipline tab). Every route is guarded (see `disciplinary.routes.js` for which). A single case is read by whoever may view the list it is on (a pending case by Pending Cases or Concluded Cases, a concluded one by Concluded Cases or the Report). The dropdown rows (`options`) are the module's own source, because `/api/lookups` is for the ratings screens.
- **Audit:** opening is an INSERT of the case, conclude, cancel and correct are UPDATEs of it (with the cancel reason), and a correction is also an INSERT of its row with the reason and the changes.
- **Printouts:** Pending Cases list, Disciplinary Report and Case Sheet as PDFs (`disciplinary.documents.js`, pdfkit) and the report as an Excel workbook; the screen, the PDF and the Excel file read one filtered query.
- **Demo data (seed 006):** 15 cases (6 pending, 7 concluded with one corrected, 2 cancelled); the old role **Disciplinary Actions** with every privilege of the module (account `B0575`, user name = the rating's official number), and **Disciplinary Initiator**, which may initiate and view but not conclude, cancel or correct (account `B0588`); both with the password `Admin@123`.
- **For Discharge (WP5):** a pending case for a rating is `SELECT ... FROM discipline_cases WHERE service_number = ? AND status = 'pending'`; either read it directly in the discharge repo, or call `GET /api/disciplinary/rating/:serviceNumber/cases` (needs Concluded Cases view). Nothing in this module blocks a discharge.

### Static Tables

One engine serves all 16 tables. `src/modules/tables/tables.config.js` holds a config per table; the routes (`tables.routes.js`), rules (`tables.service.js`), SQL (`tables.repo.js`) and the screen (`public/js/sections/static-table.js`) read it and know no table by name.

| API | Does | Needs |
|---|---|---|
| `GET /api/tables/<slug>?q=&status=&page=` | the list, 25 a page, `meta` with the totals; `q` searches every text column and the linked names | `tables.<slug>` view |
| `GET /api/tables/<slug>/meta` | the columns and the dropdown rows the dialog needs | view |
| `GET /api/tables/<slug>/:id` | one row, and where it is used (`usage`, `in_use`) | view |
| `POST` / `PUT /api/tables/<slug>[/:id]` | add / edit: required, length, range, the fixed choices, linked rows that exist, no duplicates (422 with a message per field) | add / edit |
| `DELETE /api/tables/<slug>/:id` | deletes a row nothing uses; 409 `IN_USE` with where it is used otherwise | delete |

**The tables and their columns** (the amended specification, PLAN 9c; lengths are the old ones; the list shows the demo's columns and the code, four at most, the rest is in the row's dialog). Codes are trimmed, upper case and unique; `*` means required.
- Appraisal Ratings (new): Code*(5), Grade*(50), Lowest and Highest Score* (0 to 100, low not above high, no overlap with another grade).
- Branch: Name*, Code*(2) (in the batch numbers, `DOD-SM-...`). Exit Type: Name*, Code*(2), Rating Stays Current (yes for the old codes A, M and C; decides Current or Former), Death (yes for the deceased exit type: Discharge shows the death documents only for it). Entry Mode: Name*, Code*(5).
- Offences (new): Name*, Code*(10), Category (Conduct, Discipline, Duty, Property). Sanctions (new): Name*, Severity (Minor, Major).
- Institution (new): Code(30), Name*(100), Location, Type (University, Polytechnic, College, Secondary School, Training Centre, Training Base, Other).
- Local Government: Name*, State*, Code(10). Languages: Name. Relationship (the next of kin type table): Name*, Code(5).
- Staff Branch: Name*, Code(20), Command, Department(20), CDR(20). Specialisation Area: Name*, Code*(15), Second Description(20) (the code goes in the batch numbers).
- Ships: Name*, Type* (Ship, Base, Training), Command, Description(150). States: Name*, Code*(5), Geo-Political Zone. Title: Name*, Description(50).
- Training (new): Code(10), Course*(60), Qualification Awarded(50), Institution*, Weeks* (1 to 104), Branch or Any, Specialisation or Any, Rates (none means every rate; link table `ref_training_rate`). The list shows Course, Institution, Weeks and the code.

Rates (`ref_rate`, no screen, seeded) gained a Code (OS, AB, LS, PO, CPO, WO, MWO, NWO); their `sort_order` is the rank order, lowest first. The rating's Education and Training entries gained `institution_id` (and Training `training_course_id`) with foreign keys: their dialogs pick from the tables, the entry keeps the name as text too, and an older entry that holds only text still shows and saves. Migration `20261120_020000_create_static_tables.sql`; seed `004_static_tables.sql`. Other dropdown tables not among the 16 stay seeded by SQL.

**`/api/lookups`** also carries each table's codes, flags and links for the forms and later modules: branches, entry modes and relationships (`code`), exit types (`code`, `keepsCurrent`), staff branches (`code`, `commandId`, `department`, `cdr`), specialisations (`code`, `secondDescription`), ships (`type`, `commandId`, `description`), states (`code`, `geoPoliticalZoneId`), titles (`description`), rates (`code`), and the new tables as `institutions`, `trainingCourses` (with `rateIds`), `appraisalRatings`, `offences` and `sanctions`. The rating form fills the zone from the chosen state and narrows Staff Branch to the chosen Command.

**Add a table.** Create the `ref_` table in a migration of your package's block (`id`, `name`, `sort_order`, `is_active`, the dates, `created_by`, `UNIQUE (name)`), add an entry to `TABLES` in `tables.config.js` (its columns), add the slug, tab and title to `TABLES` in `public/js/core/nav.js`, and seed its demo rows and grants in your own seed (the privilege `tables.<slug>` appears in the catalogue by itself, and the Administrator gets it from the sync).

**Add a column.** Add it to the table in a migration, then to `columns` in the table's config (`type` text, select, number, ref or multi, with `required`, `max`, `unique`, `list` and so on; `tables.config.js` explains each). The dialog, the list, the validation and the audit trail pick it up.

**Where a row is used is read from the database.** The in-use check on delete reads every declared foreign key that points at the table (`information_schema`; a cascading link such as a course's rates does not count), so a later module's table is covered as soon as it declares its own: **declare a foreign key for every link you add** (WP4's incident to Offences and Sanctions, WP6's training history to Training). `NOUNS` in `tables.config.js` only gives a referring table a friendly name for the message ("5 ratings"); any other table is named from its own name. `/api/lookups` still serves the ratings screens (active rows, with `inactive` kept apart so a record can still show and keep a value that has since been made inactive).

**Decisions made where the specification was silent** (the rest follow PLAN section 9c):
- Optional codes (Institution, Local Government, Relationship, Staff Branch, Training) may be empty but are unique when given. The database leaves every code column NULL-able so the migration runs on rows that exist; the engine requires the codes the specification marks.
- A new row goes to the end of its dropdown order (`sort_order` is not shown); every name is unique (a local government's within its State; case ignored).
- A Training course needs its Institution and Weeks; Branch and Specialisation empty mean Any; Rates are picked from a dropdown that adds a chip.
- Ships and bases: the seed keeps the demo's types (the shore bases are Base, the rest Ship); the old Sea and Land become Ship and Base. Ship, staff branch, state and exit-type values for command, zone and flag are demo values.
- The old exit codes A, M and C are seeded as "Serving (A)", "Serving (M)" and "Serving (C)" (stays current): their meaning beyond that is not in the repository.
- A row opens its dialog from the row or its Edit button; without the Edit grant it opens read-only (View).
- A training entry picked from the Training table takes the course's name as its Course text, and the course's institution when none is picked.
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

`tests/e2e/disciplinary-walkthrough.js` (WP4) does every action of the four pages as the Administrator at 1440 px (find a rating, open a case, the filters, conclude, cancel, correct, every PDF and the Excel file downloaded and opened), every rule refused with its message, the Discipline tab, the in-use refusal in Static Tables and the audit rows; then draws every page and dialog at 1440 and 390 px in light and dark with nothing overflowing, and checks the role that may initiate but not conclude (403s, no buttons), the Disciplinary Actions role, a rating, and a role that may only view the report (it adds and removes its own account; it reads `.env`; it runs in about 35 seconds and fails over five minutes). It adds cases, so run it on a fresh database:

```bash
npm run migrate:fresh
npm start
NODE_PATH=$(npm root -g) node tests/e2e/disciplinary-walkthrough.js
```

