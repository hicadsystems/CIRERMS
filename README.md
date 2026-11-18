# CIRERMS — Nigerian Navy Ratings Management (Migration Demo)

Modernised **Ratings Management** slice of the **Centralised Integrated Ratings Electronic Records Management System (CIRERMS)**, demonstrating a clean migration from legacy **ASP.NET MVC / Razor / jQuery DataTables** to a zero-framework **HTML5 + Tailwind CSS + Vanilla ES Modules SPA** backed by **Node.js (Express) + MySQL 8**.

---

## 1. Tech Stack & Migration Mapping

| Legacy .NET Layer | Modernised Stack | Why Chosen |
|---|---|---|
| ASP.NET Razor Layouts (`_Layout.cshtml`) | `public/index.html` + `public/app.html` + `public/js/shell/` | Persistent shell loaded once: on desktop a sidebar grouped by area (folds to icons), a top bar with Ctrl K search and the module's pages as tabs; on a phone a header, chips, a bottom bar and a More sheet. No full-page postbacks. |
| Razor Partial Views (`.cshtml`) | `public/js/sections/*.js` built from the component kit in `public/js/ui/` | Each screen is an ES module that draws itself with shared parts (page header, list view, dialog and bottom sheet, tabs, stepper, toasts); no HTML templates and no React/Vue/Vite build chain. |
| Bootstrap 3 + Legacy Custom CSS | **Tailwind CSS v3** (`public/css/output.css`) | Precompiled single stylesheet. Colours are tokens in `public/css/input.css`: the CIRERMS naval palette (`#0074a8`, `#02a9f4`, `#1caf9a`, `#428bca`, `#d9534f`, `#1d2939`) with ivory surfaces on an ivory-to-pale-blue gradient (no white anywhere), rounded corners, soft shadows and theme-blue scrollbars. |
| ASP.NET MVC Controllers + Services | **Node.js 20 + Express 4** (`routes` → `service` → `repo`) | Strict 3-layer separation: HTTP concerns in `*.routes.js`, validation & transactions in `*.service.js`, parameterised SQL in `*.repo.js`. |
| Entity Framework / SQL Server | **MySQL 8 (`mysql2/promise`)** + `migrate.js` | Explicit `-- UP` / `-- DOWN` SQL migrations with SHA-256 checksum drift detection, advisory `GET_LOCK` concurrency safety, and idempotent seeds. |
| Server-side Reports & Imports | **`exceljs` + `pdfkit` + `multer` v2** | Streaming `.xlsx` / `.csv` exports, `.xlsx` batch template & transactional bulk import, official Nigerian Navy PDF dossiers, and magic-byte validated uploads. |

---

## 2. Demo Scope

### Implemented Screens (Ratings Management Slice)

Every screen works on desktop (761 px and up) and on a phone (760 px and below), and every "add" opens in a dialog (a bottom sheet on a phone).

1. **Sign In** (`/index.html`) — an animated navy canvas with the Nigerian Navy crest at the left and the sign-in form at the right (the crest above the form on a phone); demo account buttons fill the form. JWT session in `HttpOnly` cookie (`cirerms_session`), `bcrypt` password verification, brute-force throttle.
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

*(The other sidebar items — Drafting, Special Drafting, Training Drafting, Advancement Processing, Naval Character Assessment, Disciplinary Action, Discharge Administration, Static Tables, Reports and System Administration — carry a **Soon** badge and open a "Coming in a Later Release" page.)*

The approved layout and look is `docs/design/demo.html` (one file; open it in a browser). `docs/design/components.md` lists the shared components.

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
| `npm run icons:build` | Rebuild the icon sprite (`public/assets/icons.svg`) from the Lucide icons listed in `scripts/build-icons.js`. |
| `npm run demo:build` | Rebuild the design reference (`docs/design/demo.html`) from its source with the project's current tokens and icons. |
