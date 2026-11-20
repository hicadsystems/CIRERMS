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
| Server-side Reports & Imports | **`exceljs` + `handlebars` + `puppeteer-core` / `@sparticuz/chromium` + `multer` v2** | Streaming `.xlsx` / `.csv` exports, `.xlsx` batch template & transactional bulk import, official Nigerian Navy PDFs made by Chromium from HTML (Handlebars) templates (see section 7), and magic-byte validated uploads. |

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
6. **My Details** (`#ratings/my-details`) — the same record read-only, resolved from `users.service_number` (works for every account, as every account belongs to a rating: the full record for `HICO001` and for `B0539`).
7. **Batch Upload** (`#ratings/upload`) — **Download Template** (with an embedded lookup reference sheet), **Upload Workbook**, **Review and Commit**: compulsory fields, dates and lookups enforced, duplicate Official Numbers skipped, the rest added in one transaction.
8. **Documents** (`#ratings/documents`) — find a rating by Official No or name, then its Navpers files by category, with preview, download and upload.
9. **Search** (Ctrl K, or the search button) — finds screens and ratings by Official No or name.
10. **Users, roles and privileges** — each user has one role; a role holds privileges, each one action (view, add, edit, delete, approve) on one screen. The server checks them on every route (403 otherwise) and the screens hide the menus, tabs and buttons a person may not use; a page opened without the grant shows a not-allowed notice. **Administrator** holds every privilege; **Rating** holds *View My Details* only, as in the old system.
11. **Audit trail** — every saved change (who, when, what, which table and record, and what changed, field by field) and every sign in, sign out, lock and unlock, written in the same transaction as the change. Read through `/api/audit` (25 a page, filtered by date, user and action) for the System Administration screens.
12. **Session lock** — locks after 15 minutes without use (`SESSION_IDLE_MINUTES`) or from *Lock Screen* in the account menu; unlocks with the password only, checked by the server; *Sign Out* from the lock screen. While locked the page is hidden and the server refuses the session's requests; every open tab locks and unlocks together.
13. **Static Tables** (`#tables/<slug>`, 16 tabs) — one table engine for Appraisal Ratings, Branch, Exit Type, Entry Mode, Offences, Sanctions, Institution, Local Government, Languages, Relationship, Staff Branch, Specialisation Area, Ships, States, Title and Training. Each tab is a searchable list (25 a page from the server) with **Add** and **Edit** in a dialog (a bottom sheet on a phone), a Status of Active or Inactive, and **Delete** after a confirmation. A row that records use cannot be deleted: the message says where it is used (for example "in use (5 ratings)") and the row can be made Inactive instead, which takes it out of the dropdowns while the records that hold it still show it. Every write is audited. Each table is its own privilege, `tables.<slug>` with view, add, edit and delete, checked on every route and used to hide the buttons. Details below, *Static Tables*.
14. **Disciplinary Action** (`#disciplinary/initiate`, `pending`, `concluded`, `report`; WP4) — four tabs. **Initiate Incident** finds a *current* rating by Official No or any part of a name (a former rating is refused with a message) and opens a case in a dialog: incident date (not in the future, not before the rating joined), offence, what happened, reported by; the same rating, offence and incident date twice is refused. A case is numbered `DC-YYYY-NNNN` and keeps the rate and ship the rating had at the time. **Pending Cases** (filters Official No or name and Offence, 25 a page from the server, **Print List** as a PDF): a row opens the case with **Conclude** (decision date not before the incident or in the future, sanction, decision, authority: the *approve* action), **Cancel Case** (a required reason, the *delete* action; the case leaves the lists, nothing is deleted), **Print Case** (the Case Sheet PDF) and Open Record. **Concluded Cases** (filters name, offence, sanction, decided From and To): a concluded case is final apart from **Correct** (the *edit* action: every field but the rating, a required reason, the before and after of each changed field kept with the case and shown in its dialog). **Disciplinary Report**: one filtered query (dates, offence, sanction, ship, rate) feeds the list, three figures, **Print PDF** and **Export Excel**. The rating's record gains a **Discipline** tab (pending and concluded cases, read only) for whoever may view Concluded Cases: never on My Details and not counted in the completeness. Screens `disciplinary.initiate` (add), `.pending` (view, approve, delete), `.concluded` (view, edit), `.report` (view); every write is audited, and an offence or sanction a case uses cannot be deleted in Static Tables. Details below, *Disciplinary Action*.

14. **System Administration** (`#admin/users`, `#admin/roles`, `#admin/password`, `#admin/audit`) — four tabs. **Manage Users**: search and filter the accounts (role, active state), 25 a page from the server; a row opens the account in a dialog; **Add Account**, **Edit**, **Deactivate** and **Reactivate** (after a confirmation) and **Reset Password**. **Manage Roles**: the roles with their user counts; a row opens the role with its privilege grid, every module's screens grouped by module with only the actions each has (view, add, edit, delete, approve); **Add Role**, **Edit** and **Delete**. **Manage Password**: find an account by official number or user name and reset it. **Audit Trail**: filters (dates, who, action, table, official number), 25 a page, a row opens the entry with before and after. **Change Password** is in the account menu (desktop and phone). Details below, *System Administration*.
15. **Drafting** (`#drafting/manning`, `proposal`, `review`, `approval`, `close`, `wef`; WP7a) — the draft cycle, six tabs. **Update Manning Requirement**: what each ship needs per rate and specialisation, with Required, Aboard (the current postings) and the difference; Add, Edit, Delete (confirmed), a duplicate (ship, rate, specialisation) and a quantity outside 1 to 99 refused, **Print** (one ship or all). Advisory only. **Print Draft Proposal**: who is due (Branch, Specialisation, Rate, each with All; the list only reads), months on the ship as a coloured pill; **Create Draft Batch** in a confirming dialog (the batch number, the filters, the count; an open batch for the same filters is added to; one rating is enough; a rating already in a batch is shown with it and left out). **Review/Print Draft**: an open batch, its progress, a row's dialog with **Edit Posting** (proposed ship, vice or deployment, remark), **Not Recommended** (a reason; struck out, on the Draft Form too) and **Remove**; **Add Personnel** (the rating search select, with a request), the **Over by n / Under by n** pill against the manning requirement, **Print Draft** (the Draft Form), **Export Excel**, **Clear Draft**. **Draft Approval**: one row per department with its totals by rate; **Approve Department** (rank, name, appointment; the *approve* action). **Close Draft**: one ready batch at a time, with a new authority and a close date; final. **Update WEF**: closed batches; **Set WEF** per rating or **for a Department**; the rating moves on the WEF, or the move is **scheduled** for a later date. Details below, *Drafting*.

16. **Advancement Processing** (`#advancement/due`, `review`, `approval`, `close`, `board`, `promoted`, `upload`; WP8) — the advancement cycle, seven tabs. **Rates due for Advancement**: who is due (Branch, Specialisation, Current Rate, each with All; the list only reads), months in rate as a coloured pill; **Create Advancement Batch** in a confirming dialog. **Advancement Review**: an open batch, its progress, a row's dialog with **Set New Rate** (the next rate in rank order only; optional Remarks), **Not Recommended** (a reason; struck out, on the Advancement Form too; back on the due list next time) and **Remove**; **Add Personnel** (the rating search select), **Print Form** (the Advancement Form), **Export Excel**, **Clear Batch**. **Approval**: one row per department with its totals by new rate; **Approve Department**. **Close**: one fully approved batch, a new authority, the close date; final. **Board Returns Update**: closed batches; **Set Date** per rating and **Set Date for Batch**; the new rate applies from that date (the rating's rate and its Advancement tab), or is **scheduled** for a later date. **Report on Promoted Rates**: filters, the batches with total and promoted, **Print Batch Summary**, a batch's ratings and **Print Advancement Report** (an unreached date reads Pending). **Upload Advanced Rates**: template, the whole file checked first, the ready rows imported together. Details below, *Advancement Processing*.

17. **Training Drafting** (`#training/process`, `review`, `history`, `reports`, `upload`; WP6) — the training draft, five tabs. **Process Training Draft**: the open batches and **New Training Batch** (course and period, then the eligible ratings by Branch, Specialisation and Rate with the live count); a batch is `DOT-YYYY-MM-NN`, one a course a month. **Training Review**: the batch's ratings with rate, length of service and last course; Add Rating, Add by Branch, Remove. **Update Training History**: Attended per rating, Change Dates, and **Confirm Training History**, which adds a Training entry (with its result) to each attending rating's record and closes the batch. **Reports**: the batches by training, month, year and number, and the Training Draft Report as a PDF. **Excel Upload**: a template, a review of every row, then the import. See *Training Drafting* below.

*(The other sidebar items — Special Drafting, Naval Character Assessment, Discharge Administration, Reports — carry a **Soon** badge and open a "Coming in a Later Release" page; they are shown to the Administrator only.)*

How a module registers itself, declares its privileges and writes to the audit trail: `CONVENTIONS.md`, *Access, audit and modules*.

The approved layout and look is `docs/design/demo.html` (one file; open it in a browser). `docs/design/components.md` lists the shared components.

The map of the old system (how it is built, one file per module, definitions from its 2017 backup) is in `docs/legacy/` (start at `docs/legacy/README.md`).

### Disciplinary Action

`src/modules/disciplinary/` (manifest, routes, service, repo, documents) and `public/js/sections/disciplinary.js` (the four screens) with `disciplinary-parts.js` (the filter bar, the case dialog and its forms, the Discipline tab). Tables `discipline_cases` and `discipline_case_corrections` (migration `20261120_040000_create_discipline_cases.sql`; seed `006_disciplinary.sql`).

- **A case** has a status, `pending`, `concluded` or `cancelled` (no "empty decision means pending"), the rating (foreign key), the rate and ship at the time, the incident date, the offence (foreign key to `ref_disciplinary_offence`), what happened, reported by, and once concluded the decision date, sanction (foreign key to `ref_disciplinary_sanction`), decision and authority; a cancelled case keeps its reason; who opened, concluded and cancelled it, and when. Dates are real `DATE`s, empty until set.
- **Rules (server side; the dialogs show each message under its field):** only a current rating can have a case opened; incident date not in the future and not before the rating's date employed; decision date not before the incident and not in the future; sanction and offence from the tables (an inactive one only if the case already holds it); the same rating, offence and incident date is refused while another case, pending or concluded, has it; Conclude only a pending case, Cancel only a pending case, Correct only a concluded case (409 otherwise); Correct needs at least one change and a reason, and keeps `[[field, from, to], ...]` and the reason in `discipline_case_corrections`.
- **Routes** `/api/disciplinary`: `options`, `ratings?q=`, `cases` (POST), `cases/pending`, `cases/pending/pdf`, `cases/concluded`, `cases/:id` and `cases/:id/pdf`, `cases/:id/conclude|cancel|correct`, `report`, `report/pdf`, `report/excel`, `rating/:serviceNumber/cases` (the Discipline tab). Every route is guarded (see `disciplinary.routes.js` for which). A single case is read by whoever may view the list it is on (a pending case by Pending Cases or Concluded Cases, a concluded one by Concluded Cases or the Report). The dropdown rows (`options`) are the module's own source, because `/api/lookups` is for the ratings screens.
- **Audit:** opening is an INSERT of the case, conclude, cancel and correct are UPDATEs of it (with the cancel reason), and a correction is also an INSERT of its row with the reason and the changes.
- **Printouts:** Pending Cases list, Disciplinary Report and Case Sheet as PDFs (`disciplinary.documents.js` shapes the data, the templates `disciplinary-pending-cases`, `disciplinary-report` and `disciplinary-case-sheet` make them) and the report as an Excel workbook; the screen, the PDF and the Excel file read one filtered query.
- **Demo data (seed 006):** 15 cases (6 pending, 7 concluded with one corrected, 2 cancelled); the old role **Disciplinary Actions** with every privilege of the module (account `B0575`, user name = the rating's official number), and **Disciplinary Initiator**, which may initiate and view but not conclude, cancel or correct (account `B0588`); both with the password `Admin@123`.
- **For Discharge (WP5):** a pending case for a rating is `SELECT ... FROM discipline_cases WHERE service_number = ? AND status = 'pending'`; either read it directly in the discharge repo, or call `GET /api/disciplinary/rating/:serviceNumber/cases` (needs Concluded Cases view). Nothing in this module blocks a discharge.

### Drafting

`src/modules/drafting/` and `public/js/sections/drafting.js` (the six screens) with `drafting-parts.js` (shared parts) and `drafting-record.js` (the record's scheduled move). Migration `20261120_070000_create_drafting.sql`; seed `008_drafting.sql`. The other three Drafting pages (Batch/Signal Content, Rate DOD History, Draft Report) are WP7b's; Upload Draft is Special Drafting's (WP11).

- **The cycle.** Proposal (a batch numbered `DOD-<branch>-<specialisation>-<rate>-NNNNNN`, codes from the Static Tables, `ALL` for All, a six-digit counter per code), review, approval per department (the specialisation), close (one batch, final), WEF. A batch is `open`, `approved` (every rating has a proposed ship and every department approved; worked out again after each change) or `closed`. A row is `proposed`, `not_recommended`, `awaiting_wef` (its batch closed), `scheduled` or `reported`. A rating whose draft is not finished (in an open batch, or waiting for its WEF) is left out of a new batch; a not recommended rating is back on the due list.
- **Rules (server side; the dialogs show each message under its field):** the proposed ship differs from the current one; Not Recommended needs a reason; Add Personnel refuses a rating in a batch (naming it), a former rating and one with no current posting; approval is refused while a rating of the department has no proposed ship, and approving again replaces the earlier approval (changing a ship afterwards asks the department to approve again); close needs every rating with a proposed ship and every department approved, an authority never used before (the message names the batch that used it), a close date not in the future and not before the batch began; a closed batch is not changed again (409). The WEF is not before the authority (close) date and not more than a year ahead.
- **The posting move** (`postings.service.js`, used by Update WEF and by Special Drafting later): the open posting ends the day before the WEF and a new one starts on it at the ship (`rating_drafting`); the record's Drafting tab shows it and the current ship follows. A WEF after today is **scheduled** (`scheduled_changes`): the record's Drafting tab shows *Drafted to X wef dd/mm/yyyy* with **Scheduled**, and the server makes the move on its date.
- **Scheduled changes** (`src/shared/scheduled`): the server applies the changes due at start and then every hour, each in its own transaction, through the handler of its kind (`posting` here; Discharge's later); a change that can no longer be made is cancelled with the reason, and the draft row waits for a WEF again.
- **The due rule** is a placeholder (PLAN section 9), kept as settings (`settings` table, `src/shared/settings`): `drafting.due_months` 10 (due at 10 months or more on the current ship), `drafting.band_green_to` 20 and `drafting.band_amber_to` 24 (the pill: under 10 neutral, 10 to 20 green, 21 to 24 amber, over 24 red). Change a value in the table and the screens follow; no code change.
- **Departments.** A user with a Specialisation (`users.specialisation_id`, now in the session user as `specialisationId`) drafts only that department: the due list, its batches and its approval.
- **Routes** `/api/drafting` (each guarded; the list is at the top of `drafting.routes.js`): `options`, `manning` (+ `pdf`), `due`, `batches` (`preview`, make, `?stage=open|wef`, one batch, its `rows`, `pdf`, `excel`, `close`, `wef`), `batches/:id/rows/:rowId` (edit, `not-recommended`, remove, `wef`), `approvals` (+ `excel`, a department's `rows`, approve), `rating/:serviceNumber/scheduled`.
- **Screens and privileges:** `drafting.manning` (view, add, edit, delete), `drafting.proposal` (view, add), `drafting.review` (view, add, edit, delete), `drafting.approval` (view, approve), `drafting.close` (view, edit), `drafting.wef` (view, edit).
- **Audit:** every write (manning, batches, rows, approvals, close, the postings and the scheduled changes) is recorded in its transaction; a scheduled move made on its date is recorded as `SYSTEM`.
- **Printouts:** the Manning Requirement Report and the Draft Form (`drafting.documents.js`, the templates `manning-requirement-report` and `draft-form`); the batch, and the open batches by department, as Excel workbooks.
- **Demo data (seed 008):** the three settings; 27 ratings with postings (months on a ship in every band), 27 manning requirements; a batch at each stage (Seaman open in review, Marine Engineering approved and ready to close, Logistics with a rating not recommended, Naval Police closed and waiting for its WEF, Weapon Engineering closed with two ratings reported and one move scheduled); the old role **Drafting** (proposal and review; reads the rest; account `B0705`), the same tied to the Marine Propulsion department (account `B0706`), and **Drafting Approver** (manning, approval, close, WEF; account `B0707`); password `Admin@123`.

### Training Drafting

`src/modules/training-drafting/` (manifest, routes, service, repo, upload, documents, format) and `public/js/sections/training.js` (the five screens) with `training-parts.js` (the dropdown rows, the form dialog, the two-step New Training Batch dialog, Add Ratings and the open-batch picker; the filter bar, row tooltip and PDF preview are `disciplinary-parts.js`'s).

- **A batch** is one course in one month of one year, `open` or `closed`, with the number `DOT-YYYY-MM-NN` (`NN` is the course's id padded to two digits, so `DOT-2026-11-06`). A second batch for the same course, month and year is refused, naming the batch it matches (also a unique key). `training_batch_ratings` holds each rating in a batch: `attended`, its own `start_date` and `end_date` when they differ from the batch's, the `result` (Distinction, Credit, Pass, Fail) and `training_id`, the record entry made when the batch was confirmed. Every link is a foreign key, so the Static Tables in-use check sees a course or institution used by a batch.
- **Eligible** (PLAN 9a decision 6): current ratings that match the branch and the specialisation the course sets (none means Any) and its rates (none means every rate), and are not in an open batch for the course. Adding a rating that is not eligible is refused with the reason (the branch, specialisation or rates the course is open to, or the open batch the rating is already in). Training has no numeric rule, so it has no settings.
- **Confirm Training History** needs an institution, a start and end date (end not before start, not in the future), a result for every rating that attended, and at least one attending rating. In one transaction it adds a `rating_training` entry to each attending rating (`training_course_id`, `institution_id`, the names kept as text as the record's own form does, the result in `classification`, the rating's own dates or the batch's), sets each result on the batch row and closes the batch. A rating that did not attend gets no entry and no result. A closed batch is final: a mistake is put right on the rating's record, under the audit trail.
- **Routes** `/api/training-drafting`: `options`, `eligible`, `batches` (list, one batch, POST), `batches/:id/ratings` (POST, and DELETE `/:serviceNumber`), `batches/:id/ratings/filter`, `batches/:id/ratings/:serviceNumber` (PUT: Attended, own dates), `batches/:id/confirm`, `batches/:id/pdf`, `upload/template`, `upload/review`, `upload/import`. Screens: `training.process` (view, add), `training.review` (view, edit), `training.history` (view, edit), `training.reports` (view), `training.upload` (view, add). Training Review's rating search is allowed by `training.review` edit.
- **Excel Upload** columns: Official No, Course, Institution, Qualification, Start Date, End Date, Authority. Course and Institution are matched by name or code; a blank Institution is the course's; a blank Qualification is the course name. Every row is read first: a problem is listed with its row, field and problem as an *Error* (the row is wrong) or *Skipped* (it repeats an earlier row, or is already on the rating's record); Import adds the rest in one transaction. Authority has no column on the record, so it is kept in the audit row of each Training entry.
- **Printout:** the Training Draft Report (`training-draft-report`) lists a batch's ratings with their previous course and its dates; a closed batch lists those who attended.
- **Demo data (seed 007):** four batches (two open, two closed with their history confirmed and the Training entries on the records); the old role **Training** with every privilege of the module (account `B0562`, password `Admin@123`) and **Training Viewer** (account `B0541`), which may only view the batches and the reports.

### Advancement Processing

`src/modules/advancement/` and `public/js/sections/advancement.js` (the seven screens; it reuses `drafting-parts.js`) with `advancement-record.js` (the record's scheduled rate change). Migration `20261120_080000_create_advancement.sql`; seed `010_advancement.sql`.

- **The cycle is WP7a's** (`src/modules/drafting/cycle.service.js`, flow `DOA`): proposal (a batch numbered `DOA-<branch>-<specialisation>-<rate>-NNNNNN`, as Drafting's), review, approval per department, close (one batch, final), then the board date. Rows are `advancement_rows`: `proposed`, `not_recommended`, `awaiting_board` (its batch closed), `scheduled` or `advanced`. A rating whose advancement is not finished is left out of a new batch; a not recommended rating is back on the due list.
- **Rules (server side):** the new rate is the next rate in rank order (Rates `sort_order`), one rate at a time, never chosen; Not Recommended needs a reason; Add Personnel takes any current rating below the top rate, due or not, and refuses one in a batch (naming it), a former rating and (for a department-tied user) another department's; approval is refused while a rating of the department has no new rate; close needs every rating with its new rate and every department approved, an authority never used before by any batch (drafting or advancement), a close date not in the future and not before the batch began. The board date is not before the rating joined its current rate and not more than a year ahead.
- **The rate change** (`rates.service.js`, used by Board Returns Update and Upload Advanced Rates): a date today or earlier ends the open Advancement line (`rating_advancement`) the day before and opens the new rate's line on the date (with the authority), and the rating's rate becomes the new one. A date after today is **scheduled** (`scheduled_changes`, kind `advancement`): the record's Advancement tab shows *Advanced to X wef dd/mm/yyyy* with **Scheduled**, and the server makes the change on its date.
- **Upload Advanced Rates:** template columns Official No, Old Rate, New Rate, Effective Date, Authority, Decoration, Remark; the whole file is read and every row checked first (the official number, the old rate is the rating's rate on record after the rows above it, the new rate above it, the date today or earlier and not before the old rate began, no unfinished advancement); the same promotion twice (in the file or on the record) is skipped; the ready rows are imported in one transaction through the rate change, each kept in `advancement_uploads` with its remark. An empty workbook, other headings or a file that is not `.xlsx` are refused with the reason.
- **The due rule** is a placeholder (PLAN section 9), kept as settings: `advancement.due_months` 48 (due at 48 months or more in the current rate, not already in the top rate), `advancement.band_green_to` 50 and `advancement.band_amber_to` 54 (the pill: under 48 neutral, 48 to 50 green, 51 to 54 amber, over 54 red). Time in rate counts from the latest Advancement line of the current rate, else the seniority date. It does not read appraisal grades or disciplinary cases; a pending case is shown as information only.
- **Routes** `/api/advancement` (each guarded; the list is at the top of `advancement.routes.js`): `options`, `due`, `batches` (`preview`, make, `?stage=open|board`, one batch, its `rows`, `form.pdf`, `report.pdf`, `excel`, `close`, `board`), `batches/:id/rows/:rowId` (Set New Rate, `not-recommended`, remove, `board`), `approvals` (+ `excel`, a department's `rows`, approve), `report` (+ `pdf`, `excel`), `upload` (`template`, `check`, `check.xlsx`, import), `rating/:serviceNumber/scheduled`.
- **Screens and privileges:** `advancement.due` (view, add), `advancement.review` (view, add, edit, delete), `advancement.approval` (view, approve), `advancement.close` (view, edit), `advancement.board` (view, edit), `advancement.promoted` (view), `advancement.upload` (view, add).
- **Printouts:** the Advancement Form, the Batch Summary Report for Advancement and the Advancement Report (`advancement.documents.js`); the batch, the open batches by department, the batch list and the rows not ready as Excel workbooks.
- **Demo data (seed 010):** the three settings; 19 ratings with Advancement lines (months in rate in every band) and a recent posting; a batch at each stage (`DOA-ALL-ALL-AB` open with a rating not recommended, `DOA-ME-ALL-ALL` approved and ready to close, `DOA-LG-ALL-ALL` closed and waiting for its board dates, `DOA-MD-ALL-ALL` closed with two advanced and one scheduled, `DOA-SM-ALL-PO` advanced months ago); the old role **Advancement** (due list and review; reads the rest; account `B0801`), the same tied to the Gunnery department (account `B0803`), and **Advancement Approver** (approval, close, board dates, upload; account `B0802`); password `Admin@123`.

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

### Rating search select

A rating is always picked with `ratingSearch` (`public/js/ui/rating-search.js`), never a typed official number. `GET /api/ratings/search?q=&offset=0&limit=10&status=current|former|all&account=with|without` (`ratings.routes.js`, guarded by the view or add privilege of every screen that picks a rating) answers `{ data: [{ serviceNumber, title, names, status, account? }], meta: { offset, limit, hasMore } }`. `q` under 2 characters answers an empty list without a query; `limit` is capped at 10 and the table is never loaded whole. Every word of `q` must start the official number (first word only) or one of the names (surname, first, middle, maiden), so more words narrow the list. `title` is the rating's title, or the rate's abbreviation when it has none. `account` is given only when asked for and carries the user name of the rating's account. Indexes: the primary key and `20261120_310000_ratings_name_search_indexes.sql`.

### System Administration

`src/modules/users/` (Manage Users and Manage Password), `src/modules/access/` (Manage Roles) and `src/modules/audit/` (Audit Trail) serve the four screens, drawn by `public/js/sections/admin-users.js`, `admin-roles.js`, `admin-password.js` and `admin-audit.js` (shared parts in `admin-common.js`). Privileges: `admin.users` (view, add, edit), `admin.roles` (view, add, edit, delete), `admin.password` (view, edit), `admin.audit` (view). Every route checks its own; the buttons show only with the grant.

| API | Does | Needs |
|---|---|---|
| `GET /api/users?q=&roleId=&active=&page=` | the accounts, 25 a page (`q` searches user name, name, official number and e-mail); never a hash | `admin.users` view |
| `GET /api/users/meta`, `GET /api/users/:id` | the roles and Specialisations for the dialogs; one account | view |
| `GET /api/ratings/search?q=&offset=&limit=10&status=&account=` | the rating search select (see *Rating search select* below) | any screen that picks a rating |
| `POST /api/users` | add an account for a rating (`serviceNumber`, required: it becomes the user name): a random one-time password comes back once, in the response only | add |
| `PUT /api/users/:id` | edit (the user name is fixed) | edit |
| `POST /api/users/:id/deactivate` / `reactivate` | an account is never deleted; deactivating ends its sessions | edit |
| `GET /api/users/lookup?q=` | one account by official number or user name | `admin.password` view |
| `POST /api/users/:id/reset-password` | a new one-time password (once), the person's sessions end, they choose a new one at next sign-in | `admin.password` edit |
| `GET /api/access/roles?q=&page=`, `GET /api/access/roles/:id`, `GET /api/access/privileges` | the roles (25 a page, with user counts and privileges); the catalogue | `admin.roles` view |
| `POST` / `PUT` / `DELETE /api/access/roles[/:id]` | add, edit, delete a role | add / edit / delete |
| `POST /api/auth/change-password` | Change Password (account menu): current, new, confirm | any signed-in account |
| `GET /api/audit`, `/api/audit/:id`, `/api/audit/filters` | the trail (WP1) | `admin.audit` view |

**An account belongs to a rating** (owner's rule, 19/11/2026; no special administrator account): Add Account starts by finding an existing rating by official number or name, and that official number is the account's **user name** (fixed once made). A rating has at most one account, and none can be made or saved without its rating; the database requires it (`users.service_number NOT NULL`, unique). The Hicad administrator `HICO001` is a rating too (a record in the demo data), so *View My Details* works for every account. A rating that has an account cannot be deleted (accounts are deactivated). **An account's name is its rating's**, written as the rest of the app writes a rating's name (rate abbreviation, surname, first name, middle name: `MWO ADMINISTRATOR HICO`), in Manage Users, the account menu, the lock screen, the Audit Trail's *Performed By* and `/api/auth/me`; there is no separate full-name field, and `users.full_name` is no longer read (the column is kept, nullable, unused). An account also has a role, an optional **Specialisation** (stored and shown here; the drafting packages apply it), phone, e-mail and an active state. **Nothing is deleted**: an account is deactivated, which ends its sessions, and can be reactivated. A deployment that already had accounts with no rating gets one made for each (its user name as official number) by migration `20261120_030100`.

**Guards** (the server refuses, with the reason): nobody deactivates, resets or changes the role of their own account (they may edit the rest of it, and use Change Password); the last active full-access administrator cannot be deactivated or moved to another role; the Administrator role (full access) cannot be edited or deleted; a role that still has users cannot be deleted; role names are unique, whatever the case; a role must hold at least one privilege, every pair must exist in the catalogue, and a screen's other actions need its View.

**Passwords.** Hashed with bcrypt (`src/shared/password.js`, the one helper); a hash is never returned. The rules (Change Password, and enforced by the server): at least 8 characters, with a letter and a digit, and different from the current password. A new or reset account gets a random 12-character **one-time password** (no look-alike characters), shown once to the administrator and never stored in clear, logged or written to the audit trail; at the next sign-in the person sees *Choose a New Password* before anything else opens, and until they do the server answers every other request with 403 `PASSWORD_CHANGE_REQUIRED`. Changing a password signs out the person's other sessions (this one stays). The old e-mailed-code reset is not rebuilt: someone who forgets their password asks an administrator.

**Roles.** A role is a grid of every module's screens and the actions each has, read from the privilege catalogue (`/api/access/privileges`, which the module manifests fill), grouped by module. **A later module's screens appear in Manage Roles by themselves**: declare them in its `<module>.module.js` `privileges` and they are in the catalogue (and in the Administrator role) at the next start or seed; nothing is added here. Seeding grants to other roles is that module's own seed file. A role change applies from the person's next request (the server reads the grants on every request), and nobody is signed out.

**The audit trail.** Every write is audited in its transaction: accounts (INSERT, UPDATE for edit, deactivate, reactivate, reset and password change) and roles (INSERT, UPDATE with the privileges added and removed, DELETE). A reset or password change records *that* the credentials changed (and the sessions it ended), never the password; `audit.record` drops any field named like a password, hash, token or secret. Nothing in the app edits or deletes an audit row.

Choices made where the design and decisions were silent (also in the report):

- **Manage Roles** is a list of roles with a dialog for each role's grid, not the demo's role list beside a grid, so it follows the wide-table rule (key columns, row opens a dialog) and a 25-a-page list; a screen's actions are toggles (not a six-column table) so the grid never scrolls sideways on a phone. Toggling an action turns View on; turning View off clears the screen's other actions. *Select All* and *Clear* act on one module.
- **Manage Password** is the administrator's reset (decision 3), not the demo's change-your-own-password form; that form is *Change Password* in the account menu.
- **Add Account's rating** is found by a search box (official number or name, up to 8 results; a rating that already has an account is shown but cannot be picked), not a list of every rating; its name is the rating's.
- **The user name cannot be changed** after the account is made (it is the rating's official number; the audit trail and sign-in use it).
- **Search** in Manage Users matches user name, name, official number and e-mail; the Audit Trail's *Official No* filter matches the record key (so it also finds a user name or role name for those tables).
- **Seeded roles other than Administrator**: Records Officer, Records Clerk, Auditor (the demo's names) with the grants the old system's privilege names map to (`UpdateDetails`, `NewRatings`, `BatchCreation`, the two lists, `ViewDocument`); the old role bundles themselves are not in the code. Grants for the later modules' screens come with their packages.

---

## 3. Demo Credentials

| Username | Password | Role | Rating (Service No.) | Purpose |
|---|---|---|---|---|
| `HICO001` | `Admin@123` | Administrator | `HICO001` | Every privilege; a rating too, so *View My Details* shows its record. |
| `B0539` | `Rating@123` | Rating | `B0539` | *View My Details* only: linked to **PO Okonkwo Chukwuemeka**, sees the read-only dossier and nothing else (403 from every other API). |
| `HICO002` | `Officer@123` | Records Officer | `HICO002` | Keeps the ratings records (new rating, batch upload, documents, edits); no administration. |
| `HICO003` | `Officer@123` | Records Officer | `HICO003` | As `HICO002`, tied to the **Navigation** Specialisation (a drafting officer will then see only that department's batches and approvals). |
| `B0541` | `Clerk@123` | Records Clerk | `B0541` | Looks up and updates records and documents; cannot add or upload. |
| `HICO004` | `Auditor@123` | Auditor | `HICO004` | Reads the records and the Audit Trail; changes nothing. |
| `HICO005` | `Tables@123` | Static Tables | `HICO005` | Maintains the 16 Static Tables (the old `StaticTables` role). |
| `B0562` | `Rating@123` | Rating | `B0562` | **Inactive**: cannot sign in (shows the deactivated state). |
| `B0705` | `Admin@123` | Drafting | `B0705` | The old Drafting role: who is due, makes batches and reviews them; reads approval, close and WEF. |
| `B0706` | `Admin@123` | Drafting | `B0706` | As `B0705`, tied to the **Marine Propulsion** department: sees only its due list, batches and approval. |
| `B0707` | `Admin@123` | Drafting Approver | `B0707` | Keeps the manning requirement, approves departments, closes batches and sets the WEF. |
| `B0801` | `Admin@123` | Advancement | `B0801` | The old Advancement role: who is due, makes advancement batches and reviews them; reads the other advancement pages. |
| `B0802` | `Admin@123` | Advancement Approver | `B0802` | Approves departments, closes advancement batches, enters board dates and uploads advanced rates. |
| `B0803` | `Admin@123` | Advancement | `B0803` | As `B0801`, tied to the **Gunnery** department: sees only its due list, batches and approval. |

An account made in Manage Users or reset in Manage Password has a **one-time password** that the person must replace at first sign-in; the seeded accounts above do not (so the demo opens straight in).

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

`tests/e2e/access-walkthrough.js` signs in as the administrator and as `B0539` on desktop and phone, in light and dark mode: what each sees, the 403s, the audit rows every rating write leaves, and the session lock (Lock Screen, idle time, wrong and right password, other tabs, Sign Out), and the ratings printouts (the dossier, a tab and the nominal roll open in the app's preview with their pages, and the roll downloads). It uses the Playwright installed on the machine:

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

`tests/e2e/system-admin-walkthrough.js` (WP3) walks Manage Users, Manage Roles, Manage Password, the Audit Trail and Change Password as the Administrator at 1440 and 390 px in light and dark (every action through the dialogs), then the guards (an account cannot be made without a rating, a rating cannot get a second one), a new account's forced first change, a reset ending a session, a role change applying on the next request, accounts with no grants or view only (no buttons, 403 from the API), and the audit trail holding every write and no password. Every action runs once at desktop light; the other layouts and themes open each screen and its main dialog and the flows that differ on a phone. It runs in about a minute and fails if it takes over 5 minutes. It adds throw-away `WT` roles, ratings and accounts and removes them when it ends.

```bash
npm run migrate:fresh
npm start
NODE_PATH=$(npm root -g) node tests/e2e/system-admin-walkthrough.js
```

`tests/e2e/disciplinary-walkthrough.js` (WP4) does every action of the four pages as the Administrator at 1440 px (find a rating, open a case, the filters, conclude, cancel, correct, every PDF and the Excel file downloaded and opened), every rule refused with its message, the Discipline tab, the in-use refusal in Static Tables and the audit rows; then draws every page and dialog at 1440 and 390 px in light and dark with nothing overflowing, and checks the role that may initiate but not conclude (403s, no buttons), the Disciplinary Actions role, a rating, and a role that may only view the report (it adds and removes its own account; it reads `.env`; it runs in about 35 seconds and fails over five minutes). It adds cases, so run it on a fresh database:

```bash
npm run migrate:fresh
npm start
NODE_PATH=$(npm root -g) node tests/e2e/disciplinary-walkthrough.js
```

`tests/e2e/drafting-walkthrough.js` (WP7a) runs the whole drafting cycle as the Administrator at 1440 px (manning add, edit, delete and its refusals, the printout; a batch made from who is due; Edit Posting, Not Recommended, Remove, Add Personnel and its refusal, the Draft Form and the workbook, Clear Draft; approval refused while a ship is missing, approve and approve again; the close refusals, then close; a WEF today reported and a future WEF scheduled, the record's Drafting tab, and the scheduled move made on its date by running the scheduled changes in its own process with a date three weeks ahead), then the privileges of the Drafting, Drafting Approver and department roles and a rating (403s, no buttons), the audit rows, and every page and its main dialog at 1440 and 390 px in light and dark. It reads `.env`; it runs in about 45 seconds and fails over five minutes. Run it on a fresh database:

```bash
NODE_PATH=$(npm root -g) node tests/e2e/drafting-walkthrough.js
```

`tests/e2e/advancement-walkthrough.js` (WP8) runs the whole advancement cycle as the Administrator at 1440 px (who is due, its bands and a pending case as information; a batch; Set New Rate (the next rate only), Not Recommended, Add Personnel and its refusal, Remove, the Advancement Form and the workbook; approval refused while a new rate is missing, approve and approve again; the close refusals (an authority used by advancement or drafting, the dates), then close; a board date today that changes the rate and adds the Advancement line, a future date for the batch scheduled and made on its date; the report filters and both printouts; the upload states and the import; Clear Batch), then the privileges of the Advancement, Advancement Approver and department roles and a rating, the audit rows, and every page and its main dialog at 1440 and 390 px in light and dark. It reads `.env`; it runs in about 50 seconds and fails over five minutes. Run it on a fresh database:

```bash
NODE_PATH=$(npm root -g) node tests/e2e/advancement-walkthrough.js
```

`tests/e2e/training-drafting-walkthrough.js` (WP6) does the same for Training Drafting: a batch made, Review, Update Training History and Confirm (every rule refused first), the reports and PDF, the Excel upload, the audit trail, the Training and viewer roles, then every page and dialog at 1440 and 390 px in light and dark.

```bash
npm run migrate:fresh
npm start
NODE_PATH=$(npm root -g) node tests/e2e/training-drafting-walkthrough.js
```

---

## 7. Printouts (PDFs made by Chromium)

Every PDF the app makes is an HTML (Handlebars) template in `src/templates/printouts/` turned into a PDF by Chromium (`renderPdf` in `src/shared/printouts/`), as the owner's NAVY-PAYROLL does. The templates are D4's approved designs (`docs/design/printouts/` keeps the design record and the sample PDFs). They open in the app's own preview.

| Printout | Template | Made by |
|---|---|---|
| Personnel Dossier (Print Dossier, Print Report) | `personnel-dossier` | `ratings.printouts.js` |
| One tab of a rating's record (Advancement, Drafting, Training, Education; Print) | `rating-report` | `ratings.printouts.js` |
| Current and Former Ratings list, Export, PDF | `ratings-list` | `ratings.printouts.js` |
| Static Tables, Print List (all 16; landscape over four columns) | `static-table-list` | `tables.service.js` |
| Disciplinary: Pending Cases, Report, Case Sheet | `disciplinary-pending-cases`, `disciplinary-report`, `disciplinary-case-sheet` | `disciplinary.documents.js` |
| Drafting: Manning Requirement Report, Draft Form | `manning-requirement-report`, `draft-form` | `drafting.documents.js` |
| Training Draft Report (a batch) | `training-draft-report` | `training-drafting.documents.js` |
| Advancement: Advancement Form, Batch Summary Report for Advancement, Advancement Report | `advancement-form`, `advancement-batch-summary`, `advancement-report` | `advancement.documents.js` |

The other templates in the folder (drafting, advancement, discharge, appraisal and so on) are ready for the packages that build those screens. How to add a printout is in `CONVENTIONS.md` (Frontend).

**The page.** A4, the header (crest, "NIGERIAN NAVY — CIRERMS", title) on page 1 only; on every page the footer "RESTRICTED — Nigerian Navy CIRERMS | Generated by: <name> | dd/mm/yyyy hh:mm" (Nigerian time, WAT) and "Page X of Y". Table headers repeat on each page. Fonts (Inter, Libre Baskerville) and the crest are the app's own files; nothing is fetched from the internet while a PDF is made.

**What the server needs.** Node 20+ and a Chromium that can run headless:
- *Where Chromium is.* Set `PDF_CHROMIUM_PATH` in `.env` to a system Chromium or Chrome (`/usr/bin/chromium` on Debian, Ubuntu and Alpine after `apt install chromium` / `apk add chromium`; the Dockerfile does this). On Windows, an installed Chrome or Edge is detected automatically; set `PDF_CHROMIUM_PATH` if it is installed in a non-standard location. On other platforms, leaving it empty uses the binary that ships inside `@sparticuz/chromium` (as NAVY-PAYROLL does on its shared host): that needs a writable temporary folder (`PDF_TEMP_DIR`, default the system's), about 200 MB of free space the first time it unpacks, and the libraries that package bundles for Amazon Linux-like hosts. If a render fails with a launch error, check the log line `[printouts] ...` and use a system Chromium.
- *Memory.* One Chromium, about 150 to 300 MB while busy. It starts on the first printout, stays open while PDFs are being made, closes after `PDF_BROWSER_IDLE_MS` without one and is restarted after `PDF_BROWSER_MAX_PAGES` pages. On a small host keep `PDF_TAB_POOL_SIZE` at 1 or 2.
- *Fonts.* The templates bring their own; install any basic font package (for example `ttf-liberation` or `fonts-liberation`) so the monospaced figures and codes have a fallback.

**Settings** (all optional, in `.env`; read by `src/config/index.js`, listed in `.env.example`):

| Setting | Default | Meaning |
|---|---|---|
| `PDF_CHROMIUM_PATH` | empty | Path of the Chromium or Chrome to run; empty detects Chrome/Edge on Windows and uses `@sparticuz/chromium` elsewhere |
| `PDF_TAB_POOL_SIZE` | `2` | PDFs made at the same time (the rest wait their turn) |
| `PDF_BROWSER_IDLE_MS` | `60000` | The browser closes after this long without a PDF |
| `PDF_BROWSER_MAX_PAGES` | `300` | The browser restarts (when idle) after this many PDFs |
| `PDF_TIMEOUT_MS` | `60000` | A PDF that takes longer fails with a message |
| `PDF_FONT_WAIT_MS` | `5000` | The longest wait for the fonts to load |
| `PDF_MAX_HTML_MB` | `10` | The largest page it will make; a longer list is refused and asks for a narrower one |
| `PDF_TEMP_DIR` | system temp | Where `@sparticuz/chromium` unpacks and keeps its profile |

A failed render is logged (`[printouts] <template> failed ...`) and the person gets "The printout could not be made. Try again in a moment."; the server never waits on it for ever.
