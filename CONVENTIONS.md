# CIRERMS — Conventions

Rebuild of the CIRERMS ratings HR platform (ASP.NET MVC) as a Node/Express + vanilla JS SPA.
NAVY-PAYROLL is the reference for patterns; CIRERMS keeps its own look and its own database.

## Decisions

| Topic | Decision |
|---|---|
| Stack | HTML / Tailwind CSS v3 / vanilla JS (SPA) + Node.js 20 (CommonJS) / Express 4 |
| Libraries | `mysql2` (parameterised SQL, no ORM), `bcryptjs` + `jsonwebtoken` (auth), `helmet` (headers), `multer` (uploads), `exceljs` (Excel/CSV export & batch upload), `pdfkit` (server PDF reports), `dotenv` (config) |
| Frontend | `public/` (with pre-compiled `public/css/output.css` so no build step is needed to run) |
| Backend | `src/` — everything server-side lives here, nothing at the project root except entry/config files |
| Uploads | `storage/uploads/` (outside `public/`, configurable via `UPLOAD_DIR`), served only through authenticated API routes |
| Serving | Express serves `public/` + `/api` from one process (Docker, cPanel Node app, VPS) |
| Database | MySQL 8+ (compatible with MariaDB 11; Postgres under discussion). All SQL stays in `*.repo.js` so a DB switch stays cheap |
| Data | Own database. No data shared with payroll |
| Organisation | Module-first: one folder per sidebar menu |
| Look & feel | CIRERMS colours (`#0074a8` sidebar, `#02a9f4` active pill, `#1caf9a` teal, `#d9534f` red, `#428bca` blue, `#1d2939` dark navy, `#e4e7ea` canvas), Nigerian Navy crest, sidebar, stat cards. Payroll-style SPA behaviour |
| Auth | Payroll-style JWT login against `users` table (separate from `ratings`). Optional `users.service_number` links a login account to a rating for *View My Details*; admin accounts (e.g. `HICO001`) leave it `NULL`. One admin role for the demo; screen IDs ready for permissions later |
| Out of scope (for now) | Automated tests, Playwright, CI pipelines, non-Ratings sidebar modules |
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
│  ├─ middleware/               # auth.js, error.js, upload.js
│  ├─ shared/                   # excel.js, pdf.js, dates.js, errors.js
│  └─ modules/
│     ├─ auth/                  # auth.routes.js  auth.service.js  auth.repo.js
│     ├─ dashboard/             # dashboard.routes.js  dashboard.service.js  dashboard.repo.js
│     ├─ ratings/               # ratings.routes.js  ratings.service.js  ratings.repo.js
│     └─ lookups/               # lookups.routes.js  lookups.service.js  lookups.repo.js
├─ public/
│  ├─ index.html                # login (auth.login)
│  ├─ app.html                  # shell: sidebar + header + <main>
│  ├─ sections/<module>/<screen>.html
│  ├─ js/core/                  # api, auth, dates, router, ui, filter-bar, table, modal, tabs, upload, rating-profile
│  ├─ js/sections/<module>/<screen>.js
│  ├─ css/                      # tailwind input.css + compiled output.css
│  └─ assets/                   # navy-logo.png
├─ storage/uploads/             # runtime uploaded photos & personnel documents (gitignored)
├─ migrate.js                   # migration CLI
├─ tailwind.config.js           # Tailwind config with CIRERMS colour tokens
├─ conventions.md
├─ README.md
├─ .env.example
├─ Dockerfile
├─ docker-compose.yml
└─ package.json
```

New modules (drafting, advancement, discipline, ...) are added as new folders under
`src/modules/` and `public/sections/` — nothing else moves.

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
- Lists are paged, filtered and sorted on the server: `?page=1&pageSize=10&serviceNumber=...&name=...&status=current`.
- Exports (Excel/CSV/PDF) are server endpoints that use the same filters as the list; Copy copies the visible rows to the clipboard.

## Naming

| Thing | Style | Example |
|---|---|---|
| Files & folders | kebab-case | `my-details.js`, `filter-bar.js` |
| JS variables/functions | camelCase | `findByServiceNumber` |
| DB tables & columns | snake_case | `rating_next_of_kin.service_number` |
| Lookup tables | `ref_` prefix | `ref_rate`, `ref_title`, `ref_branch` |
| Screen ID | `module.screen` | `ratings.list`, `ratings.new` |

The **screen ID** is the single name for a screen: menu item, section file
(`sections/ratings/list.html`), and later the permission key. UI labels preserve familiar
naval wording ("Official Number" / "Service No") while the DB and API standardise on `service_number`.

## Database

- **`ratings` uses `service_number VARCHAR(20)` as its natural primary key** (no surrogate `id`).
  Every child table (`rating_*`) references `ratings(service_number)` with `ON DELETE CASCADE ON UPDATE CASCADE`,
  and `users.service_number` references it with `ON DELETE SET NULL ON UPDATE CASCADE`, so correcting a service
  number cascades cleanly across all related records.
- **All other tables** (`users`, `ref_*`, `rating_*`) have `id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY`,
  plus `created_at`, `updated_at`, `created_by`.
- **Login accounts (`users`) are separate from personnel records (`ratings`)**; `users.service_number` is nullable
  and unique (populated only when a user account belongs to a rating).
- **Lookup tables (`ref_*`)** carry `name`, `sort_order`, `is_active` (plus `code` on `ref_document_category`,
  `religion_id` on `ref_religion_denomination`, and `state_id` on `ref_local_government`). Dropdown queries filter
  `is_active = 1` and sort by `sort_order, name`.
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

- `app.html` is the shell; the router loads `sections/<module>/<screen>.html` into `<main>`
  and runs its matching `js/sections/<module>/<screen>.js` (payroll's `data-section` approach).
- All requests go through one api client in `js/core/api.js` (adds token, handles JSON/FormData/blob downloads and errors).
- Reusable pieces in `js/core/`, built once:
  - filter bar (`filter-bar.js`)
  - data table (`table.js` — server paging + sorting + Copy / Excel / PDF / CSV)
  - modal (`modal.js`) & collapsible form panel (`ui.js` — "Add Next of Kin" style)
  - tabbed record (`tabs.js` + `rating-profile.js` — the 10-tab rating profile with 4 sub-steps & striped progress bar)
  - Excel upload flow (`upload.js` — download template → upload & validate → error/duplicate report → commit)
- Tailwind with CIRERMS colours set as theme tokens. No other CSS framework or external CDN dependency.

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
| `dashboard.home` | Dashboard — Members card live (`total`, `former`, `current`), others show `0` |
| `ratings.list` | Current / Former Ratings List (one screen, `status` filter, server paging & exports, Print Report PDF) |
| `ratings.new` | New Ratings / Edit Rating — 10-tab profile (basic/contact/health/official, next of kin, spouse, children, advancement, drafting, training, education, language, documents) |
| `ratings.upload` | Batch Upload — `.xlsx` template, upload & validate, skip duplicate official numbers, error report, transactional commit |
| `ratings.my-details` | View My Details — read-only 10-tab profile for the logged-in user's `service_number` |
| `ratings.documents` | View Document — search by service number, filter by category, preview/download and upload files |

Other sidebar menus (`Drafting`, `Special Drafting`, `Advancement Processing`, `Assessment of NAVAL Character & Efficiency`, `Disciplinary Action`, `Discharge Administration`) are visible in the sidebar as disabled items.

## Open items

- Real dropdown values (rate, title, religion denomination, tribe, state/LGA, ship, ...) — realistic placeholders seeded until official lists are supplied.
- Demo data: generated synthetic ratings shaped like the real records (`HICO001` admin + `B0601` rating-linked login).
- MySQL vs Postgres — final call pending (all SQL isolated in `src/modules/*/*.repo.js`).
