# WP5 report

- Package: WP5 Discharge Administration (clean-up of the first build: make it work, check it, tidy the branch)
- Branch: discharge
- Last commit: 3265a08 Discharge: pickers sit on the page with no card, desk:w-96 wide (the last code commit; the documentation commit and this report come after it)
- Done by: AI session for the administrator
- Date: 20/11/2026

The first build (commit 0cd385d, by another developer, no report) had never been run. It is kept as it is (no rewrite of history); my commits and two merges of `master` (the second after WP6 was merged, 6141835) follow it.

## Built (against the brief, page by page)
- **Process Discharge**: *Due for Discharge* reads only. The filter bar (Official No or name, Branch, Rate, Entry Mode) folds into a Filters button on a phone; age and years of service are coloured pills from the settings; a rating with a pending disciplinary case has a *Pending case* pill and a warning in its dialog (nothing blocks). Left out: ratings with a running re-engagement and ratings with a closed or scheduled discharge. **Create Proposal** (`DIS-YYYY-NNNN`) opens a confirming dialog and writes only on confirm. *Proposals*: a picker, progress, the ratings; a row opens a dialog with **Process**, **Re-engage**, **Remove**, Open Record; **Add Rating** uses the rating search select. **Process** takes the exit type (only types that do not keep a rating current), exit date, reason (100 characters), approved by, comment, the death documents (only for a Death exit type, never enforced) and status Pending or Closed; Closed asks first and says it is final. Closing with today or an earlier date makes the rating Former in one transaction (status, exit type, date, reason), ends its open posting, deactivates its account and ends its sessions; a later date is Scheduled and takes effect on that date.
- **Print Service Details** and **Verification Forms**: find a current or former rating with the rating search select; Personnel Details (with the rate history), Re-engagement Verification (needs a re-engagement), Retirement Routine (needs a discharge) and Engagement Form open in the preview; a form without its source is off, with the reason, and the API refuses it (409).
- **Discharge Report**: filter bar (dates, exit type with Re-engagement, rate, branch; a bad date or From after To is reported above the list), three figures, the list (Scheduled shown as such, 25 a page), a row dialog, **Print PDF** (with the figures) and **Export Excel**, from one query.
- **Upload Discharge**: three steps (template, file, review and import), the whole file read first, every problem row listed (Row, Official No, Problem, Result) with a row dialog and a download of the problem rows; the ready rows go into one new proposal.
- Privileges per page, the old role **Discharge** (account `B1000`, `Admin@123`), demo data on every page, Ctrl K, the sidebar without Soon.

## Bugs found by running it, and how they were fixed
1. **Print Service Details failed on MySQL** (`dec` is a reserved word in the rate-history query). Aliased columns renamed; the query also returned the whole `ratings` row, now only the columns the page and the printout use.
2. **The seed's Discharge account could not sign in**: its password hash had a typo. Fixed (same hash as the other demo accounts).
3. **The seed took Advancement's account.** Both seeds made `B0801`; `INSERT IGNORE` left Advancement's officer with the Discharge role. WP5's demo ratings and officer now use `B1000` to `B1042` (not `B09xx`, which the Training Drafting branch uses for `B0901` and `B0902`). The extra `RE-ENGAGEMENT` exit type the seed added is removed (re-engagement is not a discharge; the report has its own choice).
4. **No demo data**: the seed's header promised proposals and discharges and held none. Now: ratings due in every band, a proposal with four closed discharges (one a death with its documents) and two re-engagements, an open proposal (one rating processed, one with a pending case, one scheduled), a rate history on three ratings. The demo ratings also keep clear of the other modules' due lists and name searches (recent seniority and postings, no surname `OKONKWO`), which broke the Advancement and Disciplinary walkthroughs until changed.
5. **Every confirmation threw**: the screens called `toast.success` and `toast.error`, which do not exist (`toast(message, tone)` does). All calls fixed.
6. **Process could never be saved**: the form read the exit type and the status from the select elements it had created, which the dropdown component replaces once they are on the page ("Choose an exit type" always; the death documents never appeared). Values are now read by name from the form; the same fix in Add Rating and the proposal picker.
7. **Closing was not fully audited**: the rating's exit, the ended posting and the deactivated account left no rows; a new proposal audited only the proposal, not its rows. All are now audited, in the transaction.
8. **Closing took exit types that keep a rating current** (Serving A, M, C) and made the rating Former with them; **Closed without an exit date** silently used today; **Pending demanded a date**. Now: refused (422); the date is required only to close.
9. **The scheduled discharge** closed its row with no closer and no audit row, and if the rating had already left it stayed Scheduled for ever. It now keeps who scheduled it, audits each step, and when the discharge can no longer be made the shared scheduler cancels it and the row goes back to Pending.
10. **Upload Discharge**: one proposal for every row; a rating twice in one file broke the whole import with a database error; exit types that keep a rating current were accepted; no limit on rows. Now one proposal per file, the second row is skipped and said so, those exit types are errors, 2000 rows at most.
11. **Verification forms**: an unknown form name printed the Engagement Form, and a form with no source printed empty. Now 404 and 409.
12. **The proposal list did not show the exit type** after Process (the query did not join the Exit Type table).
13. **Printouts**: the signature lines had no labels (the template wants `{ role }`, the code sent strings); the Discharge Report did not show its figures. Fixed. Age and length of service on a former rating's forms ran to today; they now stop at the exit date. A re-engagement of 1 month from 31 January ended on 3 March; now 28 February.
14. **Screens**: five icons used are not in the sprite (`calendar-clock`, `rotate-cw`, `search-check`, `skip-forward`, `file-check`: blank tiles and tab icon), details showed "—" instead of "N/A", names were mixed case, the lists had no View Details tooltip, the filters did not fold on a phone, the upload used a native file input, Print Service Details and Verification Forms showed the details as a paragraph. All changed to the shared parts (`filterBar`, `rowTips`, the Advancement upload layout, `facts`).
15. **The walkthrough** launched a Windows Chrome path, needed a `playwright` dependency and tested mostly through the API.

## Tidying
- `playwright` removed from `package.json` and `package-lock.json` (back to `master`'s); `exceljs` was already there.
- `docs/waves/wave-F-discharge-and-advancement.md` restored to `master`'s. The point the commit made stays in the code: **Upload Discharge closes past and today's exit dates and schedules later ones, in one transaction** (decision below).
- `public/css/output.css` rebuilt after the merge (`npm run css:build`).
- Latest `origin/master` merged into the branch first.

## Decisions taken where the brief and the design were silent (the developer's, kept; mine)
- Upload Discharge closes or schedules by exit date in one transaction (the developer's; sound, kept). Mine: a whole file is one proposal; a rating repeated in a file uses its first ready row; the exit type stands as the reason and the Authority column is kept in `discharge_uploads` only.
- Pending needs an exit type and a reason, Closed also the exit date (the design's); the exit type must not keep a rating current.
- A closed discharge also ends the open posting on the exit date, never before the posting began.
- A scheduled discharge that cannot be made is cancelled by the shared scheduler and its row returns to Pending (the Proposals list).
- A proposal is listed while it has a pending rating; scheduled and closed rows leave it.
- The lists use `filterBar` (live filters, a Filters button on a phone) and not Search and Reset buttons as the demo has, as every other module built from the same demo does.
- Demo officer and ratings are `B1000` to `B1042` (WP6's accounts `B0901` and `B0902` are untouched).
- The owner's picker rule: the Proposal picker (Process Discharge, Proposals) and the rating pickers of Print Service Details and Verification Forms sit on the page with no card, label above, `desk:w-96` wide on desktop and full width on a phone, their buttons beside them (wrapping under on a phone). The filter bars with several fields stay as they were.

## Checks
Each on a fresh database (`migrate:fresh`, `seed`), run one after the other with this branch's final code (after the second merge of `master`):
- discharge: 285 passed, 0 failed, in 100 s (limit 300 s)
- access (with the second server on 3001): 177 passed, 0 failed, in 82 s
- static tables: 1487 passed, 0 failed, in 89 s
- system admin: 285 passed, 0 failed, in 64 s
- disciplinary: 191 passed, 0 failed, in 44 s
- drafting: 195 passed, 0 failed, in 52 s
- advancement: 243 passed, 0 failed, in 49 s
- training drafting (WP6): 266 passed, 0 failed, in 47 s

The discharge walkthrough covers: propose (cancel writes nothing, confirm writes), process (refusals under the fields, Pending, Closed in the future, Closed today), the rating Former with its posting ended and account deactivated and its signed-in session refused (401), the rating in Former Ratings and gone from Current, a scheduled close taking effect on its date by the scheduler (audited by SYSTEM), a re-engagement (rating current, not a discharge, not due), a pending case warning and not blocking, Remove, Add Rating, Print Service Details, every verification form and the one that is off, the upload in every state (not a workbook, no columns, review with ready/skipped/error rows, import into one proposal, the same file again), the report (figures, filters, a bad date, the printout with page 2, the workbook), the rules through the API (the due rule and bands from the settings, every refusal), the Discharge role, a read-only role and a rating (403 on every route), the audit rows for every table written, and every page and its main dialog at 1440 and 390 px in light and dark with no overflow and no browser errors. The 5-minute limit is enforced by the script.

Screens looked at (screenshots, 1440 and 390 px, light and dark, against `docs/design/demo.html` at 1440): the five pages, Create Proposal, the proposal row dialog and the Process form, the close confirmation, the due row dialog with its warning, the Personnel Details, three verification forms and the report in the preview (the report in the walkthrough has 3 pages; on the untouched demo database its seven rows put only the signatures on page 2), the report row dialog and the upload in every state. Matched to the demo apart from the filter bar (see decisions); nothing cut off and nothing scrolling sideways; wide tables show four key columns with a row dialog and cards on a phone.

## Not verified
- The three verification forms keep D2's indicative layouts; the real forms were due "before WP5" and are not in the repository.
- The Excel template and report workbook were opened and read back by the walkthrough, not looked at in Excel itself.
- Ratings picked on a real phone (touch) were checked only with Playwright's phone emulation.

## Files outside the package's own module
- `public/js/core/nav.js`: the Discharge Administration entry and its five pages (the first build's lines); the Verification Forms tab icon is `clipboard-check` (the sprite has no `file-check`).
- `public/css/output.css`: rebuilt.
- `README.md`, `CONVENTIONS.md`: WP5's lines only, after WP6's (feature item 18, migration line 16, a Discharge section, a module paragraph, the walkthrough and the printouts). The "Soon" sentences no longer name Discharge Administration. Merge conflicts with WP6 (`nav.js`, `CONVENTIONS.md`, `output.css`) were resolved by keeping both sides; the stylesheet was rebuilt.
- `tests/e2e/discharge-walkthrough.js`, `src/db/seeds/009_discharge.sql`, `src/db/migrations/20261120_050000_create_discharge.sql` (unchanged: it ran as written) are WP5's own.

## For the next packages
- Discharge's closing lives in `applyExit` (`discharge.service.js`); if Advancement, Drafting or Special Drafting need a rating to leave, call it rather than writing the exit again. A rating that left should also lose its scheduled postings and advancements (`scheduled_changes` of other kinds): nothing does that yet.
- Pick demo official numbers no other seed uses (`INSERT IGNORE` hides the clash). In use: B0xxx from the older seeds, `B0901`, `B0902` (Training Drafting), `B0801` to `B0826` (Advancement), `B1000` to `B1042` (Discharge). Demo ratings must also stay out of other modules' due lists and name searches, or their walkthroughs fail.
- The record page does not yet show *Leaves dd/mm/yyyy* or *Re-engaged to dd/mm/yyyy* (the design shows both), and the dashboard's Discharge tile is not built; neither is in WP5's brief. A scheduled discharge is visible in the Discharge Report and in `scheduled_changes`.
- A selects-in-forms rule worth keeping: once a form is on the page its selects are replaced by the dropdown component; read them by `name` from the form, never from the element `selectInput` returned.

## Questions for the owner
- Should the three verification forms and the Personnel Details wait for the real forms before WP10, or be signed off as they are?
- Should the record page show *Leaves* and *Re-engaged to* now (a small change to the Ratings record) or in WP10?
- Should a rating who leaves also lose its scheduled postings and scheduled advancements (what the scheduler does with them on their date was not checked)?
