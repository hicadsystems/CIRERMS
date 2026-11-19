# Wave G: Drafting Reports and Reports

Two packages that can run at the same time, by two developers, once WP7a (the drafting tables) is merged. Both read
data other modules write; neither writes ratings.

Read `docs/waves/README.md` first: its rules, checks and report note are binding. Ratings are picked with the
rating search select; printouts are Handlebars templates rendered by WP13's Chromium renderer (`renderPdf`) and open in the app's preview; details are label and
value rows. One filtered query feeds each screen, its PDF and its Excel file.

---

## WP7b `drafting-reports`: Batch/Signal Content, Rate DOD History, Draft Report

- **Branch:** `drafting-reports` · **Needs merged first:** WP7a
- **AI session:** Sonnet 5.5, effort medium · **Size:** M · **Migration block:** `71` (only if you need one) ·
  **Seed:** `013_drafting_reports.sql` (only if you need one)

### Read first
- `docs/PLAN.md`: sections 3, 4 (the Drafting row), 5 (row WP7b).
- `docs/legacy/drafting.md` sections 8, 9 and 10, and `docs/legacy/reports.md` section 5.
- The design: `docs/design/demo.html` (Drafting: `drafting/batches`, `history`, `report`) and
  `docs/design/README.md`, D1 section, the rows for these three pages.
- WP7a's report note and tables: the batches, their rows, the postings.

### Build (as the demo shows, three pages, added to the Drafting module)
1. **Batch/Signal Content**: filters (branch, rate, signal code, batch number), all working (the rate filter matches
   the batch's rate or a rating inside it); the batch list with total, reported and not reported; **Print Summary**;
   a row opens the batch: its filter (official number with the rating search select, name), the ratings with old
   and new ship and the date reported, the header facts filled; **Print Draft Report** and **Export Excel** (the old
   Excel faults not copied).
2. **Rate DOD History**: pick a rating (rating search select); its drafts (batch, authority, old and new ship, date
   reported, status Proposed, Awaiting WEF or Reported); **Print PDF** (that rating's Draft History). A blank pick
   asks for a rating; it never lists every draft.
3. **Draft Report**: filters (specialisation, authority, from and to dates `dd/mm/yyyy`, from not after to); every
   posting that has reported; **Print Report** and **Export Excel**. Deployment/Vice shows the vice.
4. Privileges per page (view), grants in your seed or WP7a's roles; Ctrl K; `README.md`.

### Check
Your `tests/e2e/drafting-reports-walkthrough.js` (within 5 minutes) and every existing walkthrough, each on a fresh
database. Look at every page at 1440 and 390 px, light and dark.

### Report
`docs/reports/WP7b.md` on your branch, then tell the owner (or `send_message` to the administrator session).

---

## WP9 `reports`: Reports

- **Branch:** `reports` · **Needs merged first:** WP7a
- **AI session:** Sonnet 5.5, effort medium · **Size:** M · **Migration block:** `09` (only if you need one) ·
  **Seed:** `014_reports.sql` (only if you need one)

### Read first
- `docs/PLAN.md`: sections 3, 4 (the Report row), 5 (row WP9).
- `docs/legacy/reports.md` in full (sections 1 to 4, and 6: unify the filter logic into one query).
- The design: `docs/design/demo.html` (Reports: `reports/ship-history`, `all-personnel`, `disposition`) and
  `docs/design/README.md`, D2 section, "Reports pages (wide-table rule)" and "Printouts".

### Build (as the demo shows, three pages)
1. **Ship History Report**: a ship and a period; the ratings posted to it over time (from the postings); an
   **Excel** workbook, as in the old system (its Print PDF button says so).
2. **All Personnel**: filters (status current, former or all, labelled properly: the demo shows "all" in lower
   case; rate, branch, command, and the others the old page had that work); the key columns, a row opens the
   rating's details; figures; **Print PDF** (the Ratings Report) and **Export Excel** from one query.
3. **Disposition Report**: where ratings serve, by ship or unit and rate; a row opens its counts; **Print PDF** (the
   Disposition Report).
4. Privileges per page (view), grants in your seed (the old role was "Report"); Reports loses Soon; Ctrl K;
   `README.md`.

### Check
Your `tests/e2e/reports-walkthrough.js` (within 5 minutes) and every existing walkthrough, each on a fresh
database. Look at every page at 1440 and 390 px, light and dark.

### Report
`docs/reports/WP9.md` on your branch, then tell the owner (or `send_message` to the administrator session).
