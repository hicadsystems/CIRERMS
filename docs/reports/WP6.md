# WP6 report

- Package: WP6 Training Drafting: five pages, the batch rules, the Training Draft Report and the Excel upload
- Branch: training-drafting
- Last commit: see `git log -1` on the branch (this report is committed last)
- Done by: AI session for the owner
- Date: 20/11/2026

## Built (against the brief, page by page)
- **Migration `20261120_060000_create_training_batches.sql`** (block 06): `training_batches` (number, course, year, month, `open` or `closed`, institution, start and end date, who opened and closed it) with a unique key on the number and on (course, year, month), and `training_batch_ratings` (batch, rating, rate at the time, `attended`, the rating's own dates, `result`, `training_id`). Every link is a foreign key (course, institution, rating, rate, users, and the record entry), so the Static Tables in-use check sees them. No merged table is changed.
- **Module `src/modules/training-drafting/`**: manifest (five screens), routes, service, repo, upload, documents, format. Routes and privileges are listed at the top of `training-drafting.routes.js` and in `README.md`.
- **Process Training Draft**: the open batches (25 a page); **New Training Batch** as a two-step dialog (course and period, then Branch, Specialisation and Rate with "All" as its own option and the live count of eligible ratings that match); **Add Ratings** on an existing batch. Number `DOT-YYYY-MM-NN`, `NN` the course's id padded to two digits. A duplicate (same course, month and year, open or closed) is refused naming the batch it matches. A batch needs at least one rating. After making a batch the person lands on it in Training Review.
- **Eligible (9a decision 6)**: one SQL fragment (`eligibleWhere`) used by the count, the bulk add and the checks. Current ratings that match the branch and the specialisation the course sets (none set means Any), and its rates (none means every rate), not in an open batch for the course. Adding a rating one at a time that is not eligible is refused with the reason (branch, specialisation, rates, former, already in this batch, already in another open batch of the course, named).
- **Training Review**: batch picker (open batches, also reachable as `#training/review/<id>`), the ratings with rate, length of service and last course (*First course* when none), Add Rating (rating search select), Add by Branch, Remove (confirmed).
- **Update Training History**: Attended box per rating (saves on tick, does not open the dialog), Change Dates (a rating's own start and end, or both cleared to use the batch's), **Confirm Training History** (institution, the batch's dates, a result for each attending rating). Confirming, in one transaction: a `rating_training` entry for each attending rating with `training_course_id`, `institution_id`, the names as text (as the record's own form does), the result in `classification`, the rating's own dates or the batch's; each result set on the batch row; the batch closed. A rating not attending gets nothing. End not before start and not in the future; at least one rating attending. A closed batch is final (409 on any change).
- **Reports**: filters Training, Month, Year, Batch No that work together; the batch list; a batch's ratings; **Print PDF** (`training-draft-report` through WP13's `renderPdf`; ratings with their previous course and its dates).
- **Excel Upload**: Download Template (Official No, Course, Institution, Qualification, Start Date, End Date, Authority, with a sheet listing the courses and institutions), Choose File, **Review** (every row read, nothing written; problems listed by row, field and problem, as Error or Skipped), **Import** (the rows that are right, in one transaction, with the count). The same file again adds nothing (already on the record).
- **Privileges and seed**: screens `training.process` (view, add), `training.review` (view, edit), `training.history` (view, edit), `training.reports` (view), `training.upload` (view, add). Seed `007_training_drafting.sql`: the old role **Training** (all five screens; account `B0562`) and **Training Viewer** (view of the first four; account `B0541`), both with password `Admin@123`; four demo batches (two open, two closed and confirmed, with the Training entries on the records). Training Drafting no longer shows Soon; Ctrl K finds the five pages (they are in `core/nav.js`).
- **Docs**: `README.md` (feature list, a Training Drafting section, the printout table, the walkthrough) and `CONVENTIONS.md` (the module, the migration list).

## Decisions taken where the brief and the design were silent
- **Batch number** uses the course id, not its optional code (the owner's answer through the administrator).
- **Result** is written in `rating_training.classification` and kept on the batch row (same answer).
- **Both branch and specialisation set on a course**: a rating must match both (each criterion the course sets must match). The brief says "branch or specialisation", meaning whichever the course sets.
- **A duplicate batch** is refused whatever the other batch's status (open or closed), because the brief says same course, month and year and the database keeps it unique.
- **Authority** (an upload column) has no column on the record, and the record is a merged table. It is kept in the audit row of each imported Training entry. If the owner wants it shown on the record, that is a new column in block 06 and a field on the Training tab.
- **A closed batch's PDF** lists the ratings that attended, with a note saying how many did not; an open batch's PDF lists everyone.
- **Qualification on an entry** is the course name (as the record's form does); an upload row's own Qualification text replaces it when given.
- **Upload rules**: both dates required, the start not before the rating's date employed, institution blank means the course's, rows repeated in the file or already on the record are Skipped.
- **Update uses PUT** (the api client has no PATCH): `PUT /batches/:id/ratings/:serviceNumber` for Attended and the rating's own dates.
- A confirmation still records an entry for a rating that has left the service since it was added (they did attend); adding a former rating to a batch is refused.

## Checks
- **Rules checked in isolation: 48 checks pass** (`node` with the database and packages stubbed: batch number, length of service, the eligibility reasons, filters, upload dates, making a batch and its refusals, every Confirm rule and what it writes, Add Rating refusals). These test the service rules against a fake store. They do not test the SQL.
- The migration and the seed split into statements the migrator accepts (2 and 9); the five screens appear in the privilege catalogue; `core/nav.js` loads with the new module (five tabs, no Soon); every file passes a syntax check; every Tailwind class the new screens use is in the compiled `output.css`.

## Not verified
- **Nothing was run against MySQL.** The migration, the seed, and every query (the eligibility fragment, the bulk `INSERT ... SELECT`, the last-course subqueries) have not been executed. The first thing to do is `npm run migrate:fresh`.
- **`tests/e2e/training-drafting-walkthrough.js` was written but never run**, so none of its checks, nor the existing four walkthroughs, have been run since this change.
- **No screen was looked at.** The five pages and the dialogs were not seen at 1440 and 390 px in light and dark, so layout, the two-step dialog, the checkbox column and the phone cards are unchecked beyond the class check.
- The PDF was not rendered (no Chromium or Handlebars here); the data follows `docs/design/printouts/training-draft-report.sample.json`.
- The Excel template and the upload reading were not run (ExcelJS is not installed here).

## Files outside the package's own module
- `src/modules/ratings/ratings.routes.js`: `['training.review', 'edit']` added to the privileges that open `GET /api/ratings/search` (Training Review picks a rating with the search select).
- `public/js/core/nav.js`: the Training Drafting module's tabs (it was a Soon item) and its pages.
- `public/js/sections/training-parts.js` imports `filterBar`, `queryString`, `rowTips` and `previewPdf` from `disciplinary-parts.js`. They are generic; moving them to `js/ui/` is worth doing when the next package needs them.
- `README.md`, `CONVENTIONS.md`.

## For the next packages
- Drafting and Advancement can reuse the shape: one `eligibleWhere` fragment for the count and the write, a two-step New Batch dialog (`newBatchDialog` in `training-parts.js`), the open-batch picker, and review-then-import for uploads (`upload/review`, `upload/import`).
- `docs/PLAN.md` still lists WP6 as Not started; that table is the administrator's.
