# WP7b report

- Package: WP7b Drafting Reports (Batch/Signal Content, Rate DOD History, Draft Report)
- Branch: drafting-reports
- Last commit: 1ed2ecc Drafting reports: the history page's rating picker sits on the page without a card
- Done by: the owner
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
Merged `origin/master` first (conflict only in `CONVENTIONS.md`: both sides' lines kept, module list in order). Every walkthrough ran on a fresh database (`migrate:fresh`, `seed`, `npm start` before each), MySQL 8 in Docker, Chromium for the PDFs:
- Drafting reports (WP7b): 150 passed, 0 failed, in 21 s (24 s before the fixes below, 149 of 150)
- Access (with the second server): 177 passed, 0 failed, in 79 s
- Static tables: 1487 passed, 0 failed, in 87 s
- System administration: 285 passed, 0 failed, in 62 s
- Disciplinary: 191 passed, 0 failed, in 42 s
- Drafting: 195 passed, 0 failed, in 50 s
- Advancement: 243 passed, 0 failed, in 45 s
- Training drafting: 266 passed, 0 failed, in 44 s
- Discharge: 305 passed, 0 failed, in 98 s

Fixed:
- **"Batch: the page names the batch"**: the batch page passed the page's navigation title ("Batch Contents") to the header, so the h1 never held the batch number. The design demo titles it `Batch <number>` with `Authority <signal>` (or "Open: no authority yet") under it, so the page now builds its own header and the check is unchanged.
- **Rate DOD History**: the rating picker sat in a card, `max-w-2xl`. The rule of 20/11/2026 puts a page's picker on the page with no card, label above, `desk:w-96`, full width on a phone; done. (The batch page's Official No and Name filters are a filter bar, not a page picker, and stay as the demo has them.)

Looked at myself (Playwright, screenshots): the three pages, the batch page and the row dialog of each, and the four printouts in the app's preview (Draft Batch Summary, batch Draft Report, Draft History, Draft Report), at 1440 px light and at 390 px dark (bottom sheet, pages drawn by PDF.js). They follow the demo; nothing cut off, nothing scrolls sideways, no browser errors. Excel exports of the batch list, the batch and the Draft Report download at 1440 px and open with their title row, headers and data (checked with a spreadsheet reader).

## Not verified
- Page 2 of a printout: with the demo data every printout is one page, so a second page was never drawn.
- The 390 px dark pass was not repeated for the Excel buttons (they are the same buttons).
- The first commit on this branch (31ab74d) carries a different author e-mail from the owner's no-reply address; history was not rewritten, as the rules say. Question for the owner: is that acceptable, or should the commit be recreated?

## Files outside the package's own module
- `drafting.routes.js` and `drafting.module.js` (routes, three privileges), `public/js/core/nav.js` (three tabs, four pages), `README.md`, `CONVENTIONS.md`.

## For the next packages
- WP10 can link to `#drafting/batches/<id>` and `#drafting/history?serviceNumber=<sn>`.
