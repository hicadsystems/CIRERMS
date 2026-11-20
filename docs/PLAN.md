# CIRERMS Project Plan

Written 18/11/2026, last updated 19/11/2026. Owner: swizfcodes. This file is the plan every work
session follows; the administrator session hands out the packages below, one branch each, and
updates the status table as they report back.

## 1. Goal

**Phase 1, this plan: finish the demo, fully, design first.** Every module, Special Drafting and
Naval Character Assessment included (owner, 19/11/2026: D3 designs them, WP11 and WP12 build them),
through every menu item of the old system, every page, every step
and every action (list, view, add, edit, delete, approve, close, upload, print, export), with users,
roles and privileges. In two steps per module:

1. **Design:** the design demo (`docs/design/demo.html`) shows every page, step and dialog, on
   desktop and phone, in light and dark. The owner reviews it; merging the design branch is the
   owner's approval.
2. **Build:** the app is made to match the approved design and works end to end on demo data.

**Later, not planned here:** importing the real records from the old SQL Server database once our
tables are settled. (Special Drafting and Naval Character Assessment were here until 19/11/2026; section
10 keeps what is known of both, and section 9e has the decisions for them.)

## 2. The old system (the reference)

- Repository `hicadsystems/cirems` (named HPProject inside), last commit 21/12/2022. ASP.NET MVC 5,
  Entity Framework, SQL Server, Crystal Reports.
- `hpproject/Views/Shared/_menu.cshtml` is its menu; section 4 maps every item to our modules. The
  live system's menu (its page source, 18/11/2026) matches this file once the items commented out in
  it are dropped, so this repository is the code the live system runs. Commented-out items are
  switched off and out of scope.
- Its logic lives in three places: the controllers (`hpproject/Controllers`, about 23,000 lines),
  the data layer (`HRProjectDAL`, its model in `Core/HicadHRProjectModel.edmx`: 174 tables), and
  84 SQL Server procedures. Most procedure bodies are not in the code; they are in the 2017 backup
  `hpproject/DatabaseFile/HicadHRProject_20170401.bak`.
- **The backup may hold real personnel records.** Only definitions (procedures, views, tables) are
  ever copied out of it, never a record. It is restored in a throwaway database inside one
  session's container and deleted after (WP0).
- The backup is from 2017 and the code from 2022, and WP0 found it is an older, different database
  (77 tables, no views, 3 unrelated procedures). **No body of the procedures and views the 2022 code
  calls exists in anything we have**, so the rules inside them (who is due for draft, advancement or
  training) are unconfirmed (section 9). `docs/legacy/` describes every page from the C#.
- The old pages mostly check roles only in the menu, and their APIs are anonymous. Ours checks every
  route (WP1).
- The old pages have faults (wrong labels, broken searches, missing checks). We port the rules, not
  the faults: WP0 lists them per module.
- **No stored procedures.** The old system keeps much of its logic in SQL Server procedures; ours
  keeps none. Their logic is rewritten as code (section 3, rule 10).

## 3. Rules for every session

1. Work only on the branch named for the package, created from the latest `master` and published
   as soon as it is created (`git push -u origin <branch>`).
2. Commits are authored as the owner: `git config user.name swizfcodes` and
   `git config user.email 191121624+swizfcodes@users.noreply.github.com`.
3. No pull requests, of any kind. The owner opens and merges them.
4. Nothing about Claude or Anthropic in any commit message, code, comment or document, and no
   Co-Authored-By lines.
5. Never edit `public/js/core/choices.js`.
6. `CONVENTIONS.md` is binding: colour tokens only (no hex, no white), 25 rows a page from the
   server, every add opens in a dialog (a sheet on a phone), the component kit in `public/js/ui/`,
   Lucide icons from the sprite, no inline scripts or handlers in the app (the CSP forbids them),
   dates shown dd/mm/yyyy, accents in `brand` and a fill's text in its `*-foreground` token.
   **Wide tables never scroll sideways** (owner, 19/11/2026; CONVENTIONS, Frontend): only the most
   informative columns show, a row opens the full record in a dialog, and hovering a row shows a
   "View Details" tooltip. For build packages this wins over the design demo where a demo table is
   wider.
   **Type scales with the screen** (owner, 19/11/2026; CONVENTIONS, Frontend): fluid font sizes from
   phone to desktop, light and modest headings on a phone. This too wins over the demo.
   **A rating is always picked with the rating search select** (owner, 19/11/2026; WP3b builds it): wherever a
   person enters an official number to pick one rating, suggestions appear under the field after at least 2
   characters, by official number or name, 10 at a time from the server with the next 10 on scroll, narrowing as
   they type, each shown as `B0539 — PO OKONKWO CHUKWUEMEKA IFEANYI`.
   **Details read as label and value on one row** (owner, 19/11/2026; WP3c): the label left in normal case, the value
   right, a divider under each row, "N/A" when empty; on a wide page two panels with brand-coloured headings; never
   small capital labels stacked above values. This wins over the demo.
   **Printouts open in the app's own PDF preview** (owner, 19/11/2026; since WP13b the dialog shows the PDF in the browser's own viewer with its toolbar hidden (`#toolbar=0`), exactly as NAVY-PAYROLL does, and phones without an inline PDF viewer get the pages drawn by PDF.js; the PDFs are HTML templates turned into PDF by Chromium on the server, keeping CIRERMS's PDF conventions and improved to the standard of the owner's NAVY-PAYROLL application, from WP13): a dialog (a sheet on a phone) with the
   pages drawn, Download PDF and Print, never the browser's PDF viewer and its toolbar (`public/js/ui/pdf-preview.js`,
   from WP3).
7. Every screen is checked on desktop (1440 px) and phone (390 px), in light and dark mode.
8. Read the old system for the module before designing or building: its menu items, controller
   actions, views, the tables and procedures they use (`docs/legacy/` from WP0 says where).
9. **Design first.** Design packages change only `docs/design/` and rebuild the demo
   (`npm run demo:build`). Build packages make the app match the approved demo: same pages, steps,
   fields, labels and order. Anything the design lacks is raised in the report, not invented.
10. **No stored procedures, functions, triggers or views in our database**, and none kept in this
    repository, not even as reference copies (owner's decision, 18/11/2026). Logic lives in the
    module's service (`*.service.js`), with plain parameterised SQL in its repo file (`*.repo.js`).
    An old procedure is rewritten that way from the description of its logic in `docs/legacy/`.
11. Migrations go in the package's own number block: `src/db/migrations/20261120_WW####_name.sql`,
    where `WW` is the package number (WP2 is `02`). Blocks follow the dependency order, so files
    always run in the right order. Never edit a merged migration.
12. Touch only your module's files. Shared files (`public/js/core/nav.js`, `README.md`,
    `CONVENTIONS.md`, the seeds, `docs/design/demo-src.html` for design packages) change only in
    your module's own lines or section. A change a shared component needs is named in the report,
    not slipped in.
13. **A build package is done when** every old menu action of the module works on demo data and
    matches the demo; privileges are checked on every route and the screens hide what a person may
    not do; every write lands in the audit trail; demo seed data fills every page; a Playwright
    walk-through presses every action, on desktop and phone, in both themes, with no browser errors,
    and runs in 5 minutes at most (owner, 19/11/2026: rules through the API, every action through the
    screens once, the other layouts only per screen and its main dialog; it prints its time and fails over 5
    minutes);
    README and CONVENTIONS describe what was built.
14. **A design package is done when** every old menu page of its modules has its screen in the demo,
    with every step, dialog, confirmation, upload (template, preview, result), print preview, empty
    state and error state, filled with believable demo data; it works on desktop and phone in both
    themes with no browser errors; and `docs/design/README.md` lists, per module, what each old page
    became and what was changed from it and why.
15. When done, send one report to the administrator session (section 7) and stop. Do not wait for a
    reply.

## 4. Module map (old menu to new)

| Old menu | New module | Old actions (controller/action) | Design | Build |
|---|---|---|---|---|
| Ratings Management | Ratings Management | Employee: viewprofile (View My Details), Create, ExcelUpload, Index, FormerEmployeeList, GetFolderList2 (documents) | Done, approved | Done |
| Drafting | Drafting | ShipRequirement/viewrequirement (manning requirement); draftings: draftlistfilters (draft proposal), draftreview, draftenddate (WEF), summaryreport (batch / signal content), draftingreportindividual (rate DOD history), draftingreportList, draftapproval, closedraftreview | D1 | WP7a, WP7b |
| Special Drafting | Special Drafting | draftings: SpecialDraft (special draft proposal), specialdraftinglist (special draft report), and draftings/ExcelUpload (Upload Draft: listed under Drafting in the old menu, but it imports special drafts; moved here by the owner, 19/11/2026) | D3 | WP11 |
| Advancement Processing | Advancement Processing | Advancement: advancementfilters (rates due), advancementreview, advancementenddate (board returns), summaryreportforadvancement, ExcelUpload; Advancementapproval and closeadvancement (in the code, not in the live menu; included by the owner's decision, 18/11/2026) | D1 | WP8 |
| Assessment of Naval Character & Efficiency | Naval Character Assessment | AppraisalHistory/List (recommendation and grading); Report on Appraisal (never built, section 10) | D3 | WP12 |
| Disciplinary Action | Disciplinary Action | Decipline: index (initiate incident), List (pending), DesciplineHistoryList (concluded, report) | D2 | WP4 |
| Discharge Administration | Discharge Administration | Discharge: dischargereview (process discharge), ServiceDetails (print service details), Reports (verification forms), dischargereport, ExcelUpload | D2 | WP5 |
| Training Drafting | Training Drafting | TrainingDraft: TrainingDraftiningProcess, Trainingreview, trainingdraftenddate (training history), summaryreport, ExcelUpload | D1 | WP6 |
| Static Tables | Static Tables | 16 tables: Appraisal Ratings, Branch, Exit Type, Entry Mode, Disciplinary Offence, Disciplinary Sanction, Institution, Local Government, Languages, Relationship, Staff Branch, Specialisation Area, Ships, States, Title, Training | Done, approved | WP2 |
| Report | Reports | Report: personellistbybranch (ship history), personellistfilter (all personnel), PersonelReport (disposition) | Done, approved; D2 adds the printouts each module's pages load (`docs/legacy/reports.md` section 5) | WP9 |
| System Administration | System Administration | Security/CreateNewUser (Manage Users), RoleManagement/roleList (Manage Roles), Security/ResetPasswordServiceNumber (Manage Password), Account/AuditTrail | Done, approved | WP1 (backend), WP3 (screens) |
| (from the new app) | Session lock | Locks after idle time; unlocks with the password only | Done, approved | WP1 |
| (from the new app) | Light and dark mode, sign-in page | The app has them; the demo got them in the `demo-themes` job (section 8) | Done | Done |

Not in the old menu and out of scope: leave applications, medical history screens, the file
explorer and the info routers. Their tables stay in WP0's map only.

## 5. Packages

Size: S (a day of session work), M, L. Model and effort are chosen per package to spend tokens
where the thinking is: Opus where rules are ported from procedures or security is at stake,
Sonnet where screens follow patterns already in the kit.

### Design packages (change only `docs/design/`)

| Pkg | Branch | Scope | Model · effort | Needs merged first | Size |
|---|---|---|---|---|---|
| D1 | `design-drafting` | Drafting (9 pages; Upload Draft moved to Special Drafting), Training Drafting (5) and Advancement Processing (7: its 5 live pages plus Approval and Close): every page, step and dialog, by rule 14 | Sonnet 5.5 · high | WP0, `demo-themes` | L |
| D2 | `design-casework` | Disciplinary Action (4 pages) and Discharge Administration (5), the printouts the in-scope pages load (`docs/legacy/reports.md` section 5, as PDF previews on the pages that print them), and the dashboard tiles as they will read once the modules exist | Sonnet 5.5 · medium | D1 (both edit the demo source) | M |
| D3 | `design-special` | Special Drafting (Special Draft Proposal, Special Draft Report, Upload Draft) and Naval Character Assessment (Recommendation and Grading, Report on Appraisal, Appraisal Periods), by rule 14 and section 9e; the sidebar loses its last Soon items and the Appraisals tile counts appraisals | Sonnet 5.5 · medium | D2 | M |
| D4 | `design-printouts` | PDF reforming, design: every printout as an HTML (Handlebars) template, keeping CIRERMS's PDF conventions (crest, header, footer with RESTRICTED and Page X of Y, colours), copying NAVY-PAYROLL's crest watermark, faint blue page background (#f8fbff) and fonts (Inter, Libre Baskerville), and improving the rest to NAVY-PAYROLL's standard; rendered to PDF for the owner's review (`docs/waves/wave-P-printouts.md`) | Sonnet 5.5 · medium | D3 | M |

### Build packages

| Pkg | Branch | Scope | Model · effort | Needs merged first | Size |
|---|---|---|---|---|---|
| WP0 | `legacy-map` | `docs/legacy/`: how the old system is built and where its logic lives; one file per in-scope module (menu item, controller action, view, tables and columns, procedures, rules, reports, upload templates in `App_Data/UploadFormat`, and the old pages' faults we should not copy); the old tables and columns in `docs/legacy/sql/tables.md`, and what every procedure an in-scope page calls does, written in words in its module file (read from the 2017 backup, never copied as SQL; definitions only, never records); a note on whether Drafting should be split in two | Sonnet 5.5 · medium | This plan | M |
| WP1 | `foundation-access` | Users, roles and privileges modelled on the old ones (a privilege per screen and action: view, add, edit, delete, approve), checked on every route; menus, tabs and buttons hidden without the grant; the audit trail (table and a helper every write calls); the session lock as the demo shows it (password only); routes and screens registered from each module's own folder so later packages only add files; the admin role seeded with every privilege | Opus 5.5 · high | WP0 | L |
| T1 | `fluid-type` | The fluid type scale (CONVENTIONS, Frontend, "Type scales with the screen"): font sizes in `tailwind.config.js` as `clamp()` from 360 to 1440 px wide, headings lighter and smaller on a phone (the record's name, page titles, stat values, dialog titles), every existing screen checked at 360, 390, 430, 768, 1024 and 1440 px in both themes with nothing cut off or overflowing; CONVENTIONS records the scale. Not `docs/design/`: the demo takes it at its next build | Sonnet 5.5 · medium | WP1 | S |
| WP2 | `static-tables` | One table engine for the 16 static tables as the demo shows them (columns, types and links per table, such as Local Government under States), list, add and edit in a dialog, delete with an in-use check; today's lookups move under it. A Training course also carries its Branch, Specialisation and Rates (who may attend; D1, `docs/design/README.md`) | Sonnet 5.5 · medium | WP1, T1 | M |
| WP3 | `system-admin` | Manage Users (an account for a rating), Manage Roles (with the screens and actions each role may use), Manage Password (reset by official number), Audit Trail (filter by date, user and action), as the demo shows them | Sonnet 5.5 · medium | WP1, T1 | M |
| WP4 | `disciplinary` | Initiate an incident, pending cases, conclude a case with its sanction, concluded cases, the disciplinary report (PDF and Excel); the rating's record shows the cases | Sonnet 5.5 · medium | WP2, D2 | S |
| WP5 | `discharge` | Process discharge (the rating moves to Former), print service details, verification forms, the discharge report, upload discharges from Excel | Sonnet 5.5 · high | WP13 | M |
| WP6 | `training-drafting` | Process a training draft, training review, update training history (feeds the record's Training tab), the reports, upload from Excel | Sonnet 5.5 · high | WP13 | M |
| WP7a | `drafting-cycle` | The draft cycle (`docs/legacy/drafting.md` section 15): Update Manning Requirement, Print Draft Proposal (who is due, section 9), Review/Print Draft, Draft Approval, Close Draft, Update WEF; it creates the drafting tables and updates the record's Drafting tab and current ship | Opus 5.5 · high | WP13 | L |
| WP7b | `drafting-reports` | Batch/Signal Content, Rate DOD History and Draft Report, reading WP7a's tables, with their printouts | Sonnet 5.5 · medium | WP7a | M |
| WP8 | `advancement` | Rates due for advancement (eligibility by the old rules), review, approval, close, board returns update, report on promoted rates, upload advanced rates; updates the record's Advancement tab and rate. Eligibility does not read appraisal grades (WP0) | Opus 5.5 · high | WP7a | L |
| WP9 | `reports` | Ship history, all personnel (with filters) and disposition reports, as PDF and Excel, and the static tables' list printouts | Sonnet 5.5 · medium | WP7a | M |
| WP11 | `special-drafting` | Special Draft Proposal, Special Draft Report (the draft form by posting type), Upload Draft from Excel, as D3 shows them; a special draft moves the rating on its WEF through WP7a's postings | Sonnet 5.5 · medium | WP7a, D3 | M |
| WP12 | `appraisal` | Appraisal Periods, Recommendation and Grading (character and efficiency grades from the Appraisal Ratings table), Report on Appraisal (PDF and Excel), the dashboard's Appraisals tile, as D3 shows them | Sonnet 5.5 · medium | WP13 | M |
| WP13 | `printouts` | PDF reforming, build: a Chromium renderer (as NAVY-PAYROLL's) with Handlebars, D4's templates in `src/templates/printouts/`, every PDF the app makes today rebuilt from them and pdfkit removed; the walkthrough steps WP3b and WP3c broke fixed (`docs/waves/wave-P-printouts.md`) | Sonnet 5.5 · medium | D4 | M |
| WP10 | `demo-finish` | Dashboard tiles live, Ctrl K reaches every new screen, demo data across every module, one walk-through of the whole app on desktop and phone in both themes against the demo, and the docs brought up to date | Sonnet 5.5 · medium | All the above | M |

## 6. Order: two sessions at a time

| Wave | Runs together | Merged before the next wave |
|---|---|---|
| A | WP0 (and `demo-themes`, already running) | WP0, `demo-themes` |
| B | D1, WP1, then T1 once WP1 is merged | D1 after the owner's review, WP1, T1 |
| C | D2, WP2 | D2 after the owner's review, WP2 |
| D | WP3, WP4, then D3 in the first free slot | WP3, WP4, D3 after the owner's review |
| P | D4, then WP13 (PDF reforming) | D4 after the owner's review, WP13 |
| E | WP6, WP7a | WP6, WP7a |
| F | WP5 (any time after WP13), WP8 (after WP7a) | WP5, WP8 |
| F2 | WP12 (any time after WP13), WP11 (after WP7a) | WP12, WP11 |
| G | WP7b, WP9 | WP7b, WP9 |
| H | WP10 | WP10: the demo is complete |

The owner (19/11/2026): the remaining waves (WP5, WP6, WP11, WP12, WP7b, WP9, WP10) will most likely be done by
other developers, from `docs/waves/`; the administrator checks each branch from its report note.
Since 19/11/2026 the remaining waves are written out for any developer, one file per wave, in `docs/waves/` (start
with its `README.md`): model and effort, what to read, what to build, the checks, and the report note.

A package starts only from a `master` that holds every package in its "Needs merged first" column.
Two packages in the same wave never share files beyond their own lines in the shared ones (rule
12), so they merge in either order. Changes the owner asks for in a design review are made on the
same design branch before it merges.

## 7. How a session runs and reports

The administrator session creates each session with its model and effort, the repository
`hicadsystems/cirerms`, and a brief: this plan, its package, its branch. The session attaches
`hicadsystems/cirems` (read only) for the old code. Nobody watches a running session.

When done, the session sends one message to the administrator session
(`session_01G8RfvmysEhqqTQUZ45Qn5D`) with:

- the branch and its last commit
- what was built or designed: every page and action, against the module's row in section 4
- the tests run and their result, and anything not verified
- docs changed
- for a design package, what the owner should look at first
- what the next package should know

A developer (a person, or an AI session working for one) leaves the same report as a note on their branch,
`docs/reports/<package>.md` (outline in `docs/reports/README.md`), naming the branch and its last commit, and tells
the owner.

The administrator checks the branch (author, no Claude mentions, rules 1 to 14 by reading the
diff), tells the owner it is ready to review or merge, updates the status table below, and starts
the next wave once the owner has merged.

## 8. Status

| Pkg | Status | Branch | Last report |
|---|---|---|---|
| `demo-themes` (extra: light and dark mode and the sign-in page in the demo) | Merged 18/11/2026 (Sonnet 5.5 · low) | `demo-themes` | 18/11/2026: 3dcaa39, only `docs/design/` changed; screens checked at 1440 and 390 px in both themes, no errors. Not tested: device-follow while open, cross-tab sync, reduced motion |
| WP0 | Merged 19/11/2026 (Sonnet 5.5 · medium) | `legacy-map` | 19/11/2026: 2a17517, only `docs/legacy/` and two tree lines; backup restored for definitions only, then deleted; no procedure SQL kept |
| D1 | Merged 19/11/2026 (Sonnet 5.5 · high; about $11 at API prices) | `design-drafting` | 19/11/2026: 62992bc, 21 pages with the wide-table rule and the section 9a decisions, only `docs/design/`; checked by the administrator: the demo rebuilds identically, every new page at 1440 and 390 px in both themes, no browser errors, no sideways scrolling |
| WP1 | Merged 19/11/2026 (Opus 5.5 · high) | `foundation-access` | 19/11/2026: 31ad257; its walkthrough re-run by the administrator, 166 passed; sign-in and theme suites pass |
| T1 | Merged 19/11/2026 (Sonnet 5.5 · medium; about $0.64) | `fluid-type` | 19/11/2026: c0ed596; type scale 11 to 30 px, desktop sizes unchanged; walkthrough re-run by the administrator, 166 passed; My Details' name two lines at 18 px semibold on a phone; no overflow or browser errors at 360, 390 and 1440 px in both themes. Left as before: the record's tab chips are 36 px tall on a phone, not 44 |
| D2 | Merged 19/11/2026 (Sonnet 5.5 · medium; about $4.56) | `design-casework` | 19/11/2026: bfbb20a, Disciplinary Action (4 pages), Discharge Administration (5), 12 printouts, five dashboard tiles (Memos and Mails dropped, Appraisals Soon), the Reports pages under the wide-table rule, 11 record tabs; only `docs/design/`; fixed two D1 name clashes that hid the Reports pages and the Ratings Batch Upload; checked by the administrator: rebuilds identically, no browser errors, no sideways scrolling |
| WP2 | Merged 19/11/2026, in two merges (Sonnet 5.5 · medium; about $11.77) | `static-tables` | 19/11/2026: 9b1c802; every field of section 9c confirmed; the Death seed and the held "(Inactive)" value fixed (a record reads the lists afresh when it opens); walkthrough restructured to the 5-minute rule. Administrator's run on a fresh database: access walkthrough 166 passed in 74 s, static tables walkthrough 1,444 passed in 92 s |
| WP3 | Merged 19/11/2026 (Sonnet 5.5 · medium; about $17.94) | `system-admin` | 19/11/2026: 01cf6df, Manage Users, Manage Roles, Manage Password, Audit Trail, Change Password; every account a rating; the app's own PDF preview (pdfkit makes, PDF.js draws) for every printout; Static Tables' Print List; checked on fresh databases: access 166, static tables 1,474, disciplinary 192, system admin 285 |
| WP4 | Merged 19/11/2026 (Sonnet 5.5 · medium; about $6.48) | `disciplinary` | 19/11/2026: fdd2698, Disciplinary Action (cases, rules, four pages, three PDFs and the Excel report, the Discipline tab); checked with WP3's a7c85e2 on fresh databases: access 166, static tables 1,452, disciplinary 189, system admin 271 |
| WP3b | Merged 19/11/2026 (Sonnet 5.5 · medium; about $2.02) | `rating-search` | 19/11/2026: 7c31158, the rating search select (10 a time, at least 2 characters) in Add Account, Manage Password, the Audit Trail filter, Initiate Incident, the Pending and Concluded filters and Documents; checked on 15,000 ratings and in the browser |
| WP3c | Merged 19/11/2026 (Sonnet 5.5 · medium; about $0.41) | `detail-rows` | 19/11/2026: b7407f7, details as label and value rows (`facts`, `factPanels`), the record's Details tab in two panels |
| D4 | Merged 19/11/2026, approved by the owner (Sonnet 5.5 · medium; about $1.92) | `design-printouts` | 19/11/2026: e66c8ef, 27 printouts as Handlebars templates with a shared stylesheet, partials and local fonts, rendered to PDF by Chromium (`npm run printouts:render`); CIRERMS's header, footer and colours kept; NAVY-PAYROLL's watermark, faint blue page and fonts copied. Checked by the administrator: only `docs/design/`, a script line and its report note; re-rendered, 27 of 27; pages looked at |
| WP13 | Merged 19/11/2026 (Sonnet 5.5 · medium; about $5.44); followed on master by a commit that finds Chrome or Edge on Windows | `printouts` | 19/11/2026: a337a18, `renderPdf` in `src/shared/printouts/` (one shared Chromium, idle close, tab pool, no internet at render time, settings `PDF_*`), the 27 templates in `src/templates/printouts/`, every existing PDF rebuilt from them, pdfkit removed, footer time in WAT; a WP3b bug in the rating search fixed; the broken walkthrough steps fixed. Administrator's run on fresh databases: access 177 (79 s), static tables 1,474 (88 s), system admin 285 (61 s), disciplinary 191 (42 s); a PDF from the app compared with D4's. Not verified: the Docker image, a bare shared host |
| WP13b | Merged 19/11/2026 (Sonnet 5.5 · medium; about $1.36): the preview shows the PDF in the browser's own viewer inside our dialog with its toolbar hidden (`#toolbar=0`), as NAVY-PAYROLL does; phones without an inline PDF viewer keep the drawn pages (made sharp at a78b424) | `preview-sharp` | 19/11/2026: a78b424 sharp drawn pages; the owner: "still not there yet, replicate payroll"; 81f6cd5 the browser's own viewer, checked on the real Print Dossier at 1440 px light and dark and the phone fallback at 412 px |
| WP5 | Clean-up session running 20/11/2026 (Sonnet 5.5 · high, `session_01G8RfvhoLruF9UfJP8THrzk`): built by another developer in one commit (0cd385d) with no report note; the session runs it against MySQL, fixes it, makes every walkthrough pass, looks at the screens, removes an added `playwright` package and an edit to the wave F brief, and writes the report | `discharge` | |
| WP6 | Clean-up session running 20/11/2026 (Sonnet 5.5 · high, `session_01G8RfvitA7ntkaa4Jj5NTR9`): built by a developer on another device (6a28adf) but never run; the session runs it against MySQL, fixes it, makes every walkthrough pass, looks at the screens, undoes an editor's reformatting of nav.js, README and CONVENTIONS and removes stray Playwright scaffolding | `training-drafting` | |
| WP7a | Merged 19/11/2026 (Opus 5.5 · high; about $19.56) | `drafting-cycle` | 19/11/2026: 5b70cbc, the six drafting pages; batches, rows, approvals, manning, settings (`src/shared/settings`) and scheduled changes (`src/shared/scheduled`, hourly, reusable); the posting move (`postings.move`) for WP11; `cycle.service` flows for WP8; the user's department in the session. Administrator's run on fresh databases: drafting 195 (49 s), access 177, static tables 1,474, system admin 285, disciplinary 191, each under 90 s; screens looked at. Not verified: MariaDB, a real midnight |
| WP7b | Not started | `drafting-reports` | |
| WP8 | Merged 19/11/2026 (Opus 5.5 · high; about $16.60) | `advancement` | 19/11/2026: bf86b3b, the seven advancement pages on WP7a's cycle (no WP7a part changed), the next rate only, a future board date scheduled, the rate applied through `rates.service.js`, the three printouts, the upload. Administrator's run on fresh databases: advancement 243 (49 s), drafting 195, access 177, static tables 1,474, system admin 285, disciplinary 191, each under 90 s; screens looked at. Not verified: MariaDB, a real midnight |
| WP9 | Not started | `reports` | |
| D3 | Merged 19/11/2026, approved by the owner (Sonnet 5.5 · medium; about $2.70) | `design-special` | 19/11/2026: 91884e3, Special Drafting and Naval Character Assessment designed; no Soon items left |
| WP11 | Not started | `special-drafting` | |
| WP12 | Not started | `appraisal` | |
| WP10 | Not started | `demo-finish` | |

## 9. Open questions

- **Who is due (draft, advancement, training drafting, discharge).** The rules lived in the live database's
  procedures and views; we have neither, and the owner has no access to the live server. Known so far
  (`docs/legacy/drafting.md`, `advancement.md`): months on a ship 10 to 20 green, 21 to 24 amber,
  over 24 red; months in rate 48 to 50 green, 51 to 54 amber, over 54 red. The design (D1) goes on
  without them. Before WP6, WP7a and WP8 start, the rules come from whoever at Hicad keeps the live
  system (in plain words, or a schema-only script read in a container and never committed). If none
  arrive, the demo uses the month bands as placeholder rules, marked unconfirmed in `docs/legacy/`.
- **Memos and Mails** has no source in the old system (a fixed 0 on its dashboard, as are Drafting
  and Appraisals). D2 shows the Drafting tile from the drafting tables; whether Memos and Mails stays
  is for the owner at D2's review.
- **Where advancement Close applies the new rate** to the rating is not visible in the old code
  (`docs/legacy/advancement.md`); WP8 settles it with the owner.
- **The discharge upload template** is missing from the old repository; D2 designs one from the
  fields the old import reads.

## 9a. Design decisions for Drafting, Training Drafting and Advancement

Asked by D1, decided by the administrator at the owner's request (19/11/2026). The build packages
(WP6, WP7a, WP7b, WP8) follow them; the owner can change any of them.

1. **Manning requirement is advisory.** The proposal lists every due rating. The manning page shows
   required, aboard and the difference per ship and rate; the draft review warns when a batch would
   take a ship over or under its requirement. Nothing blocks.
2. **Advancement goes one rate at a time.** The new rate takes effect on the board date (Board
   Returns Update) or on upload. Remarks are optional.
3. **Close and rejection.** Close takes one fully approved batch at a time. In review, a candidate
   can be marked Not Recommended with a reason and leaves the batch, returning to the due list next
   time. A closed batch is final; corrections are made on the rating's record, under the audit
   trail. A training batch closes when its history is confirmed.
4. **WEF.** The old posting ends the day before the WEF date and the new one starts on it; a future
   WEF shows as scheduled and takes effect on its date.
5. **Approval is a privilege** (the approve action on the approval pages). Rate groups come from the
   Rates table, in its order; nothing hard-codes them.
6. **Training.** Eligible: current ratings matching the course's branch or specialisation (and its
   rates, if set), not already in an open batch for the course. Results: Distinction, Credit, Pass,
   Fail; no result for a rating not attending. One start and end date per batch, changeable per
   rating in Update Training History.
7. **Due rules** stay placeholders until Hicad supplies the real ones (section 9). The build keeps
   the thresholds as settings in the database, so the real values go in without a code change.

## 9b. Design decisions for Disciplinary Action and Discharge Administration

Decided by the administrator before D2 started, at the owner's request (19/11/2026), from the open points in
`docs/legacy/disciplinary.md` and `discharge.md`. D2, WP4 and WP5 follow them; the owner can change any of them.

1. **Initiating and concluding are separate privileges.** Initiate Incident is the add action; concluding a case
   (decision date, sanction, decision, authority) is the approve action on Pending Cases. Only a current rating can
   have a case opened.
2. **A concluded case is final.** A correction is made with **Correct** on Concluded Cases (the edit action, a
   required reason, in the audit trail). A case opened by mistake is **Cancelled** from Pending Cases (the delete
   action, a required reason); nothing is deleted outright, and a cancelled case leaves the lists.
3. **The Disciplinary Report is a real report**: Concluded Cases with filters (dates, offence, sanction, ship, rate),
   printed as PDF and exported to Excel; Pending Cases prints its own list. The rating's record gains a
   **Discipline** tab, seen only by someone who may view Concluded Cases; it is not on My Details and does not count
   towards the record's completeness.
4. **Discharge keeps the old flow** (propose, process, report) in D1's patterns: the due list only reads, a proposal
   is made in a confirming dialog, each rating is processed in its record dialog (exit type, exit date, reason, and
   the death documents only for a death). **Closing makes the rating Former** on its exit date; a future exit date
   shows as scheduled and takes effect on that date (as 9a decision 4). A closed discharge is final. `LiveStatus` is
   not carried over.
5. **Re-engagement is not a discharge.** It is its own action in the rating's dialog on Process Discharge
   (re-engagement date, period in months, approved by); the rating stays current, and the Re-engagement Verification
   form prints from it.
6. **Who is due for discharge** is unconfirmed, as in section 9: the age and length-of-service bands in
   `docs/legacy/discharge.md` 1.5 are placeholder rules, kept as database settings by the build.
7. **A pending disciplinary case shows a warning** on Process Discharge; nothing blocks (as 9a decision 1).
8. **The discharge upload template** is keyed by official number, as D1's uploads, with the fields the old import
   reads (section 9).

D2's questions, answered (19/11/2026). By the owner: the Memos and Mails tile is dropped, and Appraisals shows Soon
until Naval Character Assessment is built; the three verification forms (Re-engagement Verification, Retirement
Routine, Engagement Form) keep D2's layouts until copies of the real forms arrive, which should be before WP5. By the
administrator: Correct may change every field of a case except the rating; the Discharge Report also lists
re-engagements; Upload Discharge skips ratings already in a proposal or already discharged, and its reason is
optional; the discharge due placeholder is 50 years of age or 20 of service (bands 50/55/60 and 20/30/35), kept as
settings; Manage Roles (WP3) lists every module's screens from the privilege catalogue, the approve action included.

Added by the administrator (19/11/2026): closing a discharge also deactivates the rating's user account, if it has
one (its sessions end), since every account belongs to a rating.

D4's questions, answered by the administrator (19/11/2026; the owner can change any): the "Generated by" stamp reads
`dd/mm/yyyy hh:mm` in Nigerian time (WAT), not UTC; the header stays on page 1 only and the footer on every page, as the
app's PDFs do now; the watermark stays at payroll's 0.02; the three verification forms and the special draft letter keep
their indicative layouts until the owner supplies the real ones. The owner's review (19/11/2026): table headers have no
background; their text is navy blue (#0074a8) with a 1.3px navy line (#0074a8) under it.

## 9c. Decisions for Static Tables (WP2)

Decided by the administrator before WP2 started, at the owner's request (19/11/2026), and widened the same day
at the owner's instruction: the static tables drive the other modules, so each carries everything those modules
need.

1. **One engine for the 16 tables**, as the demo shows them (Active state, add and edit in a dialog). Five have no
   table yet and WP2 creates them: Appraisal Ratings, Disciplinary Offence, Disciplinary Sanction, Institution,
   Training.
2. **Delete only what nothing uses.** A row in use cannot be deleted (the message says where it is used); it can be
   made inactive, which takes it out of the dropdowns while records that hold it still show it. A row not in use is
   deleted after a confirmation. "In use" is read from the database's declared foreign keys, so a later module's
   tables are covered as soon as they declare theirs.
3. **A privilege per table**: screen `tables.<slug>` with view, add, edit and delete; Manage Roles groups them under
   Static Tables. The dropdown lists (`/api/lookups`) stay readable by anyone who may open a ratings screen, My
   Details included, and carry each table's codes, flags and links for the forms and modules that use them.
4. **Every table carries what the other modules need, and every old column that held real data**, so the import of
   the old records loses nothing; the old dead columns (never saved) are dropped. Codes are required where marked,
   unique, trimmed and upper case. The table below is the specification; the demo shows fewer fields and this
   decision stands in for its design. Lists show the demo's columns plus the code (four at most); everything else
   is in the row's dialog.
5. **Relationship** is the next-of-kin type table (`ref_next_of_kin_type`).

| # | Table (new or existing) | Fields | Why |
|---|---|---|---|
| 1 | Appraisal Ratings (new) | Code (5, required), Grade (50, required), lowest and highest score (0 to 100, not overlapping another grade) | Naval Character Assessment grades |
| 2 | Branch (`ref_branch`) | Name, Code (2, required) | the code is in the drafting and advancement batch numbers (`DOD-SM...`) |
| 3 | Exit Type (`ref_exit_type`) | Name, Code (2, required), **Rating stays current** (yes for the old A, M and C), **Death** (yes for the deceased type) | decides Current or Former; Discharge offers only the exit types that do not keep a rating current, and asks for the death documents only for a death |
| 4 | Entry Mode (`ref_entry_mode`) | Name, Code (5, required) | old code kept for the import |
| 5 | Disciplinary Offence (new) | Name, Code (required), Category (Conduct, Discipline, Duty, Property) | Disciplinary cases (WP4) |
| 6 | Disciplinary Sanction (new) | Name, Severity (Minor, Major) | Disciplinary cases (WP4) |
| 7 | Institution (new) | Code (30, as UNIBEN), Name (100, required), Location, Type (University, Polytechnic, College, Secondary School, Training Centre, Training Base, Other) | training courses, and the record's Education and Training entries |
| 8 | Local Government (`ref_local_government`) | Name, State (required), Code (10) | the old code kept for the import |
| 9 | Languages (`ref_language`) | Name | |
| 10 | Relationship (`ref_next_of_kin_type`) | Name, Code (5) | old code kept for the import |
| 11 | Staff Branch (`ref_staff_branch`) | Name, Code (20), Command (from Commands), Department (20), CDR (20) | the rating form's Staff Branch list follows the chosen Command, as in the old form |
| 12 | Specialisation Area (`ref_specialisation`) | Name, Code (15, required), Second Description (20) | the code is in the batch numbers; the specialisation is the "department" whose approval Drafting and Advancement ask for |
| 13 | Ships (`ref_ship`) | Name, Type (Ship, Base, Training: the old Sea, Land, Training), Command (from Commands), Description (150) | where a rating serves; sea or shore time may enter the due rules; printouts show the command |
| 14 | States (`ref_state`) | Name, Code (5, required), Geo-Political Zone | the rating form fills the zone from the state |
| 15 | Title (`ref_title`) | Name, Description (50) | old description kept for the import |
| 16 | Training (new) | Code (10), Course (60, required), Qualification awarded (50), Institution (from Institutions), Weeks (1 to 104), Branch (or Any), Specialisation (or Any), Rates (none means every rate) | who may attend a course (9a decision 6); the training batches and the record's Training entries point to it |

Also, outside the 16 screens (seeded by SQL, as in the old system):
- **Rates** (`ref_rate`) gain a Code (5, required, as PO); their order (`sort_order`, lowest rate first) decides the
  next rate in Advancement and the rate groups in the approval totals; the code goes in the advancement batch
  numbers.
- **The rating's Education and Training entries point to the tables**: `institution_id` on both and
  `training_course_id` on Training (nullable; an old entry keeps its text until the import maps it), and their
  dialogs pick the institution and the course from the tables.

## 9d. Decisions for System Administration (WP3)

Decided by the administrator before WP3 started, at the owner's request (19/11/2026), from
`docs/legacy/system-admin.md`.

1. **Manage Users.** **Every account belongs to an existing rating; there is no special administrator account, the
   Hicad one included** (owner, 19/11/2026). Add Account starts by finding the rating; the user name is its
   official number, and a rating has at most one account (the seeded HICO001 becomes a rating in the demo data). An
   account also has its role, an optional **Specialisation** (a
   drafting officer then sees only that department's batches and approvals, as the old `specid`; WP7a and WP8 apply
   it), phone and e-mail, and an active state. A new account gets a random one-time password, shown once to the
   administrator, and the person must choose their own at first sign-in. Nothing is deleted: an account is
   deactivated, which ends its sessions. Nobody can deactivate or change the role of their own account, and the last
   active full-access administrator cannot be deactivated or moved to another role.
2. **Manage Roles.** Add, edit and delete roles. A role is a grid of every module's screens and the actions each
   screen has (view, add, edit, delete, approve), read from the privilege catalogue, grouped by module. The
   Administrator role (full access) cannot be edited or deleted; a role that still has users cannot be deleted;
   role names are unique. A change applies from the users' next request, without signing them out.
3. **Manage Password** is an administrator's reset, by official number or user name: it sets a one-time password,
   shown once, ends that user's sessions, and makes them choose a new one at next sign-in. The old anonymous
   e-mailed-code reset is not rebuilt (it allowed account takeover); a person who forgets their password asks an
   administrator.
4. **Change Password** (account menu): current password, new password, confirm. Passwords are at least 8 characters
   with a letter and a digit, and differ from the current one. The person's other sessions are signed out.
5. **Audit Trail**: filters by dates, user, action and official number, 25 a page from the server, a row opens the
   entry with what changed (before and after). No password or one-time password is ever written to the audit trail;
   nothing deletes audit rows.

## 9e. Decisions for Special Drafting and Naval Character Assessment (D3, WP11, WP12)

Decided by the administrator at the owner's request (19/11/2026), from section 10 and `docs/legacy/`. D3, WP11 and
WP12 follow them; the owner can change any of them.

1. **A special draft posts one rating outside the batch cycle**, on a signal's authority. Special Draft Proposal
   finds the rating by official number or name (from the menu, with no batch number in the address), fills in their
   current rate, branch, ship, date joined it and months there, and takes Deployment/Vice, Authority (the signal),
   WEF, Drafted To, Remark and the **Posting Type** (Complement, Vice, TY, DW: a labelled list). A rating with a
   special draft not yet printed cannot get a second one. Remove is possible until it is printed.
2. **The move follows 9a decision 4**: the old posting ends the day before the WEF and the new one starts on it; a
   future WEF shows on the record as scheduled. A printed special draft is final; a correction is made on the
   rating's record, in the audit trail.
3. **Special Draft Report** prints every unprinted special draft of the chosen posting type as one draft form (a PDF
   preview), and marks them printed; it can also reprint a past form.
4. **Upload Draft** (moved here from Drafting) imports special drafts from Excel in D1's upload pattern, keyed by
   official number: Official No, Drafted To, Authority, WEF, Posting Type, Deployment/Vice, Remark.
5. **Appraisal Periods** is a page of the module (name, start and end dates, open or closed); one appraisal per
   rating per period; a closed period is read-only.
6. **Recommendation and Grading**: Initiate Appraisal for a rating and an open period: Character grade and
   Efficiency grade from the Appraisal Ratings table, remark, the CO's name; the director's date and name are saved
   (the old page lost them). The list has filters; Edit while the period is open; Cancel with a reason; nothing is
   deleted outright. Recording is the add action; editing the edit action.
7. **Report on Appraisal** (never built in the old system) lists the appraisals of a period, filtered by ship, rate,
   branch and grade, with the grade counts, as PDF and Excel.
8. The rating's record shows its appraisals (as the old profile did) for someone who may view Recommendation and
   Grading; the dashboard's Appraisals tile counts appraisals this month.

D3's questions, answered by the administrator (19/11/2026): a special draft moves the rating only once its form is
printed (on its WEF), so Remove needs no undo; closing an appraisal period is final; the director's name and date are
optional but go together, and the CO's name is required; the appraisals sit in a list under the record's Advancement
tab rather than a twelfth tab. The owner does not know what the posting types TY and DW stand for: they stay as codes until Hicad says.

## 10. What is known of Special Drafting and Naval Character Assessment

**Special Drafting** posts chosen ratings straight away on a signal's authority, outside the batch
drafting cycle.
- *Special Draft Proposal:* find a rating by name or official number; their current details fill
  in (rate, branch, ship, date joined it, months there); enter Deployment/Vice, Authority (the
  signal), WEF, Drafted To, Remark and Complement/Vice/TY/DW (the posting type); Add Record. The
  list shows special drafts not yet printed, with Remove and Draft Letter.
- *Special Draft Report:* an unlabelled box takes the posting type entered above; Print Special
  Draft prints every special draft of that type as one draft form (procedure
  `performOperationForSpecialDraft`, body only in the 2017 backup).
- Faults not to copy: the name search fails when opened from the menu (it needs a batch number in
  the address); the report box has no label and the code calls it a date; Surname and Firstname are
  saved into each other's columns; the duplicate check is commented out, so a rating can be added
  twice.

**Naval Character Assessment** (Recommendation and Grading): Initiate Appraisal records, per rating
and period, a Character grade, an Efficiency grade, a remark and the CO's name; the list has Edit
only.
- Faults not to copy: the list's "Rate" column shows the name and the form's "Rate" picks the
  official number; the director's date and author are never saved; no delete, no paging.
- **Report on Appraisal was never built:** its menu link opens the dashboard, and no page,
  procedure or Crystal report produces it. It is designed new, with a way to manage appraisal
  periods (whose setup page the old menu switched off).
