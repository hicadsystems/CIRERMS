# WP7b report

- Package: WP7b Drafting Reports (Batch/Signal Content, Rate DOD History, Draft Report)
- Branch: drafting-reports (not pushed: the work is delivered as files, as the owner prefers)
- Last commit: none (no git history was in the upload)
- Done by: AI session for the owner
- Date: 20/11/2026

## Built (against the brief, page by page)
- **Batch/Signal Content** (`#drafting/batches`): filters Branch, Rate, Signal Code, Batch No, all working (Rate matches the batch's rate or a rating inside it; Branch likewise); figures (batches, open, closed); the list (Signal Code, Batch Number with branch and rate, Status, "n of total" reported with the not-reported count under it), 25 a page from the server; a row opens a record dialog (total, reported, not reported, not recommended, who initiated and closed) with **Open Contents**; **Print Summary** (`draft-batch-summary`) and **Export Excel** (the list demo shows it).
- **One batch** (`#drafting/batches/:id`): header facts filled (signal code, status, branch, specialisation, rate, initiated, closed, total, reported, not reported, not recommended); filter by Official No (rating search select) and Name; ratings with old ship, new ship and date reported (Pending, Scheduled, or Not Recommended shown as such); a row opens its record with Open Record; **Print Draft Report** (`draft-report-batch`) and **Export Excel**, both following the filter on screen.
- **Rate DOD History** (`#drafting/history`): rating search select; a blank pick asks for a rating and sends no request (the API answers 422 to a blank number, 404 to an unknown one); the drafts with status Proposed, Awaiting WEF, Scheduled, Reported or Not Recommended; **Print PDF** (`draft-history`). `?serviceNumber=` pre-fills it.
- **Draft Report** (`#drafting/report`): filters Specialisation, Authority, From, To (dd/mm/yyyy, From after To or a bad date shown above the list, list and buttons off meanwhile); every posting with status reported; Deployment/Vice shows the vice; **Print Report** (`draft-report-all`) and **Export Excel**.
- **Privileges**: `drafting.batches`, `drafting.history`, `drafting.report` (view); seed `013_drafting_reports.sql` gives them to Drafting and Drafting Approver. Every route guarded. A department-tied user sees only their department's batches and drafts. Ctrl K and the Drafting tabs list the pages. README and CONVENTIONS updated. No migration; reads only, nothing is audited.
- The workbooks do not copy the old faults: "Official Number" spelled right, WEF is the WEF, the vice column is the vice.

## Decisions taken where the brief and the design were silent
- A batch opens by id (`drafting/batches/<id>`), not by number.
- "Reported" counts rows with status reported; a scheduled move counts as not yet reported.
- The batch list's Excel is added because the demo shows the button (the brief names Excel only on the batch).
- History also shows Scheduled and Not Recommended drafts, as the demo does.
- The Branch filter uses a rating's current branch.

## Checks
- **Nothing was run.** No server, database, browser, test or CSS build was started (the owner's rule: no running without approval). Files were only syntax-checked with `node --check`.
- `tests/e2e/drafting-reports-walkthrough.js` is written (API rules, privileges, every screen, four layouts) but has never been run; expect to fix small things on its first run.
- No existing walkthrough was re-run. Screens at 1440 and 390 px, light and dark, were not looked at.
- Every CSS class I used already exists in `public/css/output.css` (checked by script), so no rebuild is needed.

## Not verified
- All SQL against MySQL; the PDFs and workbooks; the front end in a browser; the walkthrough itself.

## Files outside the package's own module
- `drafting.routes.js` and `drafting.module.js` (routes, three privileges), `public/js/core/nav.js` (three tabs, four pages), `README.md`, `CONVENTIONS.md`.

## For the next packages
- WP10 can link to `#drafting/batches/<id>` and `#drafting/history?serviceNumber=<sn>`.
