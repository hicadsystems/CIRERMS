# WP9 report

- Package: WP9 Reports (six pages)
- Branch: reports
- Last commit: 06be784 Reports: README and CONVENTIONS lines, the disposition dialog's rate names
- Done by: AI session for the administrator
- Date: 23/11/2026

## Built (against the brief, page by page)
- **Ship History Report**: a ship (required) and a period (From, To); the ratings posted to it from `rating_drafting` (a posting counts when it overlaps the period; an open one is still on); figures: postings, aboard now, average tour; **Export Excel**. Its Print PDF button says the report is an Excel workbook, as in the old system; there is no PDF route.
- **All Personnel**: Status (All, Current, Former), Rate, Branch, Command, Ship or Unit, Specialisation, Staff Branch, AK (Entry Mode), State, Geo-Political Zone and Sort By; figures (personnel, current, former); key columns official number, name, ship, status; a row opens every detail with Open Record; **Print PDF** (`ratings-report-all`, the Ratings Report) and **Export Excel**, all from one query.
- **Disposition Report**: the current ratings by their open posting and rate (Command, Area Office, Trade); figures, a strip of rate counts, list of ship, ratings, share; a row opens its counts by rate (and the Nominal Roll for that ship); **Print PDF** (`disposition-report`) and **Export Excel** (ships, and every rating).
- **Nominal Roll**: a ship or unit, or every ship of a command (Command, Ship or Unit, Branch, Rate); ordered by rate (highest first), seniority date, official number; official number, name, rate, specialisation, date joined the ship, months there; the total and the count of each rate; a row opens the rating with Open Record; 25 a page; **Print PDF** (new `nominal-roll` template, grouped by ship for a command, ship and command in the heading) and **Export Excel**.
- **Manning State**: one row per ship with required, borne and the difference as a pill (short red, over amber, exact green); a row opens the ship's lines by rate and specialisation; figures: ships, required, borne, short; filters Command, Ship, Rate, Specialisation, Short only; **Print PDF** (Drafting's `manning-requirement-report`, through `drafting.documents.manningPdf`) and **Export Excel**. "Borne" is Drafting's own count: the page reads `drafting.repo.allManning`, the query Update Manning Requirement lists with.
- **Retirement Forecast**: the current ratings who become due in the next 6, 12 (default) or 24 months by Discharge's rule (`discharge.age_due`, `discharge.service_due`, whichever date comes first), with the same exclusions as Process Discharge (re-engaged, closed or scheduled discharge) plus a waiting proposal; Branch, Rate, Ship; official number and name, rate, ship, date due and why; soonest first, 25 a page; figures: due in the period, each quarter, and those already due today (Process Discharge's own count for the same filters, linked to it); **Print PDF** (new `retirement-forecast` template) and **Export Excel**.
- Module `src/modules/reports/` (routes each guarded with `requirePrivilege(screen, 'view')`; screens `reports.*`), pages in `public/js/sections/reports.js`, nav tabs and routes in `core/nav.js` (Reports lost Soon; Ctrl K finds the six). Seed `014_reports.sql`: the old role **Report** with its grants, account `B1301` (a rating, password `Admin@123`) and eight ratings `B1302` to `B1309` that fall due over the next two years. No migration, no stored procedure, colour tokens only.

## Decisions taken where the brief and the design were silent
- Shared parts: Drafting's manning query gained a Command filter and a row limit, and its current-posting fragment is exported; Discharge's due rule, exclusions and `dueWhere` are exported from its repo and its `rule()` from its service. Behaviour of those modules is unchanged (all their walkthroughs pass).
- **Retirement Forecast and proposals**: "already in a proposal" is read as a waiting (pending) proposal row, which Process Discharge itself still lists; the forecast leaves it out, as it does closed and scheduled discharges and a running re-engagement.
- **Short** in Manning State is the number of ships short (borne below required, net over all the ship's lines); "Short only" filters the same way; the pill is the ship's net difference, the lines inside carry their own.
- **Nominal Roll** needs a ship or a command (the whole navy is not a roll); across a command the ships come in name order first, then the brief's order within each. A ship and a command that disagree give an empty list; the Ship list narrows to the command's ships.
- **Disposition**: the filters are the old page's (Area Office = the rating's mother base) plus Command and Trade; there is no As At date (it would need history of ratings who have left): the printout says "As at today". The rate counts use every rate in Rates, in the table's order. A rating with no open posting is counted under "No ship or unit recorded".
- **All Personnel** keeps the old page's filters that work; its Rank and Course ranges and the unfilled Sub-Branch, LGA are left out. Sort By is a fixed list.
- Printout limits: 3,000 lines for a PDF and 50,000 for a workbook; above it a 422 asks for narrower filters.
- A filter bar cannot start with a value, so the Retirement Forecast period offers "Next 12 Months" as its empty choice (the default) beside 6 and 24.

## Checks
- Walkthroughs, each on a fresh database (`migrate:fresh`, seed): reports 284 passed, 0 failed, in 48 s (the first run), access 177 in 77 s, advancement 243 in 45 s, appraisal 105 in 22 s, discharge 305 in 96 s, disciplinary 191 in 42 s, drafting 195 in 50 s, drafting-reports 177 in 36 s, special-drafting 126 in 26 s, static-tables 1490 in 81 s, system-admin 285 in 61 s, training-drafting 266 in 48 s. All passed.
- Screens looked at: the six pages and their row dialogs at 1440 px light and dark, and 390 px light and dark (nothing cut off, nothing scrolling sideways, no browser errors); the four new or reused printouts and Manning State's in the preview at 1440 px light (page 2 of the Manning State printout) and 390 px dark (Nominal Roll), and every page's printout opens with its pages drawn in the walkthrough at all four layouts.
- Before pushing: no AI tool names or Co-Authored-By lines in the commit messages; no white, hex or palette colour added in `public/`; `choices.js` untouched.

## Not verified
- The browser's own PDF viewer (headless Chromium here draws the pages with PDF.js, as phones do).
- The Excel files in Excel itself (read back with ExcelJS only).
- Large data: the demo has 127 ratings; the 3,000 and 50,000 limits were not exercised.

## Files outside the package's own module
- `src/modules/drafting/drafting.repo.js`: `manningWhere` takes `commandId`, `allManning` a limit, and `CURRENT_POSTING` is exported.
- `src/modules/discharge/discharge.repo.js`: the due rule and its exclusions are named (`DUE_RULE`, `DUE_EXCLUSIONS`, ...) and exported with `dueWhere`; `dueWhere` itself builds the same SQL as before. `discharge.service.js` exports `rule`.
- `public/js/core/nav.js` (the Reports module with six tabs, six pages), `README.md` and `CONVENTIONS.md` (Reports' own lines only), `public/css/output.css` (rebuilt).
- Not touched, by design: `docs/design/` (the printout table's two new rows, `nominal-roll` and `retirement-forecast`, are for the administrator).

## For the next packages
- Questions for the owner: (1) is "already in a proposal" meant to include a waiting proposal (as built)? (2) Disposition: should "As at" be a real historical date? (3) Should Nominal Roll also be allowed for the whole navy?
- The shared pieces other reports can reuse: `drafting.repo.allManning`, `discharge.repo.DUE_RULE` / `DUE_EXCLUSIONS` / `dueWhere`, and `reports.documents.js`'s workbook helpers.
