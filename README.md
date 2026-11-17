# CIRERMS — Nigerian Navy Ratings Management (Migration Demo)

Modernised **Ratings Management** slice of the **Centralised Integrated Ratings Electronic Records Management System (CIRERMS)**, demonstrating a clean migration from legacy **ASP.NET MVC / Razor / jQuery DataTables** to a zero-framework **HTML5 + Tailwind CSS + Vanilla ES Modules SPA** backed by **Node.js (Express) + MySQL 8**.

---

## 1. Tech Stack & Migration Mapping

| Legacy .NET Layer | Modernised Stack | Why Chosen |
|---|---|---|
| ASP.NET Razor Layouts (`_Layout.cshtml`) | `public/index.html` + `public/app.html` | Persistent shell loaded once; zero full-page postbacks when switching screens or tabs. |
| Razor Partial Views (`.cshtml`) | `public/sections/**/*.html` + `public/js/sections/*.js` | Clean 1:1 pairing of static HTML markup and scoped ES2022 module controllers — no React/Vue/Vite build chain required. |
| Bootstrap 3 + Legacy Custom CSS | **Tailwind CSS v3** (`public/css/output.css`) | Precompiled single stylesheet using exact pixel-sampled CIRERMS naval palette (`#0074a8`, `#02a9f4`, `#1caf9a`, `#428bca`, `#d9534f`, `#1d2939`). |
| ASP.NET MVC Controllers + Services | **Node.js 20 + Express 4** (`routes` → `service` → `repo`) | Strict 3-layer separation: HTTP concerns in `*.routes.js`, validation & transactions in `*.service.js`, parameterised SQL in `*.repo.js`. |
| Entity Framework / SQL Server | **MySQL 8 (`mysql2/promise`)** + `migrate.js` | Explicit `-- UP` / `-- DOWN` SQL migrations with SHA-256 checksum drift detection, advisory `GET_LOCK` concurrency safety, and idempotent seeds. |
| Server-side Reports & Imports | **`exceljs` + `pdfkit` + `multer` v2** | Streaming `.xlsx` / `.csv` exports, `.xlsx` batch template & transactional bulk import, official Nigerian Navy PDF dossiers, and magic-byte validated uploads. |

---

## 2. Demo Scope

### Implemented Screens (Ratings Management Slice)
1. **Sign In** (`/index.html`) — JWT session in `HttpOnly` cookie (`cirerms_session`), `bcrypt` password verification, brute-force throttle.
2. **Dashboard** (`#dashboard`) — Live `MEMBERS` card (`Total`, `Old Members`, `Current Members`) queried from `ratings`; non-Ratings cards (`Drafting`, `Memos/Mails`, `Appraisals`) display `0`.
3. **Current Ratings List** (`#ratings/current`) — `Official No` + `Name` filter bar, live search, sortable columns, server-side pagination, `Copy | Excel | PDF | CSV` exports, row `Edit` and `Print Report` PDF.
4. **Former Ratings List** (`#ratings/former`) — Discharged/retired ratings roll with clean formatted exit dates (`DD MMM YYYY`) and exit reasons.
5. **New / Edit Rating (10-Tab Dossier)** (`#ratings/new`, `#ratings/edit/:serviceNumber`) —
   - Tab 1: **Ratings Details** across 4 sub-steps (*Basic Details*, *Contact*, *Health Info*, *Official*) + Passport Photo upload.
   - Tabs 2–9: **Next of Kin** (with NOK photo), **Spouse**, **Children**, **Advancement**, **Drafting**, **Training**, **Education**, **Language Fluency** — locked until Tab 1 is saved, with collapsible Add/Edit forms and per-tab **Generate PDF** + **View Document** actions.
   - Tab 10: **View Document/Upload** — Category filters (`DRAFTING`, `CERTIFICATE`, `REQUEST_FORM`, `EMOLUMENT`, `GEN_FORM`, `OTHER`) + file upload, inline preview, and download.
6. **View My Details** (`#ratings/my-details`) — Read-only 10-tab dossier resolved automatically from `users.service_number` (shows a clear administrative notice when signed in as an unlinked admin like `HICO001`, and loads the full personal dossier when signed in as `B0539`).
7. **Batch Upload** (`#ratings/upload`) — Official `.xlsx` template download (with embedded lookup reference sheet) and transactional bulk importer that enforces compulsory fields/dates/lookups and safely skips duplicate Official Numbers.
8. **View Ratings Documents** (`#ratings/documents`) — Standalone Navpers document lookup by Service Number, category filter, inline PDF/image modal viewer, download, and upload.

*(Non-Ratings sidebar items — Drafting, Special Drafting, Advancement Processing, Assessment of NAVAL Character & Efficiency, Disciplinary Action, Discharge Administration, Training Drafting — are preserved visually in a disabled state.)*

---

## 3. Demo Credentials

| Username | Password | Role | Linked Service No. | Purpose |
|---|---|---|---|---|
| `HICO001` | `Admin@123` | `admin` | `NULL` | Full administrative access; demonstrates unlinked admin notice on *View My Details*. |
| `B0539` | `Rating@123` | `rating` | `B0539` | Linked to **PO Okonkwo Chukwuemeka**; demonstrates automatic read-only dossier on *View My Details*. |

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
| `npm run migrate:up` | Apply all pending migrations in filename order under a MySQL advisory lock. |
| `npm run migrate:down` | Roll back the most recently applied batch (`npm run migrate:down 2` rolls back 2 batches). |
| `npm run migrate:fresh` | Drop all tables, re-apply all migrations, and run seeds (**blocked when `NODE_ENV=production`**). |
| `npm run migrate:make <name>` | Scaffold a new timestamped `.sql` migration file in `src/db/migrations/`. |
| `npm run seed` | Run idempotent lookup & demo personnel seeds (`INSERT IGNORE` / `WHERE NOT EXISTS`). |
| `npm run css:build` | Recompile minified Tailwind CSS (`public/css/input.css` → `public/css/output.css`). |
