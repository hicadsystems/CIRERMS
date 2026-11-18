# CIRERMS Project Plan

Written 18/11/2026, last updated 18/11/2026. Owner: swizfcodes. This file is the plan every work
session follows; the administrator session hands out the packages below, one branch each, and
updates the status table as they report back.

## 1. Goal

**Phase 1, this plan: finish the demo, fully, design first.** Every module except Special Drafting
and Naval Character Assessment, through every menu item of the old system, every page, every step
and every action (list, view, add, edit, delete, approve, close, upload, print, export), with users,
roles and privileges. In two steps per module:

1. **Design:** the design demo (`docs/design/demo.html`) shows every page, step and dialog, on
   desktop and phone, in light and dark. The owner reviews it; merging the design branch is the
   owner's approval.
2. **Build:** the app is made to match the approved design and works end to end on demo data.

**Later, not planned here:** Special Drafting, Naval Character Assessment (section 10 keeps what is
known of both), then importing the real records from the old SQL Server database once our tables
are settled. Both modules keep their **Soon** label until then.

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
- The backup is from 2017 and the code from 2022: where they differ, the code wins and the
  difference is written down.
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
    walk-through presses every action, on desktop and phone, in both themes, with no browser errors;
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
| Drafting | Drafting | ShipRequirement/viewrequirement (manning requirement); draftings: draftlistfilters (draft proposal), draftreview, ExcelUpload, draftenddate (WEF), summaryreport (batch / signal content), draftingreportindividual (rate DOD history), draftingreportList, draftapproval, closedraftreview | D1 | WP7 |
| Special Drafting | Special Drafting | draftings: SpecialDraft (special draft proposal), specialdraftinglist (special draft report) | Later | Later |
| Advancement Processing | Advancement Processing | Advancement: advancementfilters (rates due), advancementreview, advancementenddate (board returns), summaryreportforadvancement, ExcelUpload; Advancementapproval and closeadvancement (in the code, not in the live menu; included by the owner's decision, 18/11/2026) | D1 | WP8 |
| Assessment of Naval Character & Efficiency | Naval Character Assessment | AppraisalHistory/List (recommendation and grading); Report on Appraisal (never built, section 10) | Later | Later |
| Disciplinary Action | Disciplinary Action | Decipline: index (initiate incident), List (pending), DesciplineHistoryList (concluded, report) | D2 | WP4 |
| Discharge Administration | Discharge Administration | Discharge: dischargereview (process discharge), ServiceDetails (print service details), Reports (verification forms), dischargereport, ExcelUpload | D2 | WP5 |
| Training Drafting | Training Drafting | TrainingDraft: TrainingDraftiningProcess, Trainingreview, trainingdraftenddate (training history), summaryreport, ExcelUpload | D1 | WP6 |
| Static Tables | Static Tables | 16 tables: Appraisal Ratings, Branch, Exit Type, Entry Mode, Disciplinary Offence, Disciplinary Sanction, Institution, Local Government, Languages, Relationship, Staff Branch, Specialisation Area, Ships, States, Title, Training | Done, approved | WP2 |
| Report | Reports | Report: personellistbybranch (ship history), personellistfilter (all personnel), PersonelReport (disposition); the Crystal reports WP0 finds still in use | Done, approved (D2 adds any Crystal reports WP0 finds in use) | WP9 |
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
| D1 | `design-drafting` | Drafting (its 10 pages), Training Drafting (5) and Advancement Processing (7: its 5 live pages plus Approval and Close): every page, step and dialog, by rule 14 | Sonnet 5.5 · high | WP0, `demo-themes` | L |
| D2 | `design-casework` | Disciplinary Action (4 pages) and Discharge Administration (5), the Crystal reports WP0 finds still in use (under Reports), and the dashboard tiles as they will read once the modules exist | Sonnet 5.5 · medium | D1 (both edit the demo source) | M |

### Build packages

| Pkg | Branch | Scope | Model · effort | Needs merged first | Size |
|---|---|---|---|---|---|
| WP0 | `legacy-map` | `docs/legacy/`: how the old system is built and where its logic lives; one file per in-scope module (menu item, controller action, view, tables and columns, procedures, rules, reports, upload templates in `App_Data/UploadFormat`, and the old pages' faults we should not copy); the old tables and columns in `docs/legacy/sql/tables.md`, and what every procedure an in-scope page calls does, written in words in its module file (read from the 2017 backup, never copied as SQL; definitions only, never records); a note on whether Drafting should be split in two | Sonnet 5.5 · medium | This plan | M |
| WP1 | `foundation-access` | Users, roles and privileges modelled on the old ones (a privilege per screen and action: view, add, edit, delete, approve), checked on every route; menus, tabs and buttons hidden without the grant; the audit trail (table and a helper every write calls); the session lock as the demo shows it (password only); routes and screens registered from each module's own folder so later packages only add files; the admin role seeded with every privilege | Opus 5.5 · high | WP0 | L |
| WP2 | `static-tables` | One table engine for the 16 static tables as the demo shows them (columns, types and links per table, such as Local Government under States), list, add and edit in a dialog, delete with an in-use check; today's lookups move under it | Sonnet 5.5 · medium | WP1 | M |
| WP3 | `system-admin` | Manage Users (an account for a rating), Manage Roles (with the screens and actions each role may use), Manage Password (reset by official number), Audit Trail (filter by date, user and action), as the demo shows them | Sonnet 5.5 · medium | WP1 | M |
| WP4 | `disciplinary` | Initiate an incident, pending cases, conclude a case with its sanction, concluded cases, the disciplinary report (PDF and Excel); the rating's record shows the cases | Sonnet 5.5 · medium | WP2, D2 | S |
| WP5 | `discharge` | Process discharge (the rating moves to Former), print service details, verification forms, the discharge report, upload discharges from Excel | Sonnet 5.5 · high | WP2, D2 | M |
| WP6 | `training-drafting` | Process a training draft, training review, update training history (feeds the record's Training tab), the reports, upload from Excel | Sonnet 5.5 · high | WP2, D1 | M |
| WP7 | `drafting` | Manning requirement per ship, draft proposal (who is due, by the old rules), review and print, upload, update WEF, batch and signal content, rate DOD history, draft report, approval, close; drafting updates the record's Drafting tab and current ship. Split into WP7a and WP7b if WP0 advises | Opus 5.5 · high | WP2, D1 | L |
| WP8 | `advancement` | Rates due for advancement (eligibility by the old rules), review, approval, close, board returns update, report on promoted rates, upload advanced rates; updates the record's Advancement tab and rate. If the rules read appraisal grades, the demo seeds them (Naval Character Assessment is later) | Opus 5.5 · high | WP2, WP4, D1 | L |
| WP9 | `reports` | Ship history, all personnel (with filters) and disposition reports, and the Crystal reports D2 designed, as PDF and Excel | Sonnet 5.5 · medium | WP7, D2 | M |
| WP10 | `demo-finish` | Dashboard tiles live, Ctrl K reaches every new screen, demo data across every module, one walk-through of the whole app on desktop and phone in both themes against the demo, and the docs brought up to date | Sonnet 5.5 · medium | All the above | M |

## 6. Order: two sessions at a time

| Wave | Runs together | Merged before the next wave |
|---|---|---|
| A | WP0 (and `demo-themes`, already running) | WP0, `demo-themes` |
| B | D1, WP1 | D1 after the owner's review, WP1 |
| C | D2, WP2 | D2 after the owner's review, WP2 |
| D | WP3, WP4 | WP3, WP4 |
| E | WP6, WP7 | WP6, WP7 |
| F | WP5, WP8 | WP5, WP8 |
| G | WP9 | WP9 |
| H | WP10 | WP10: the demo is complete |

A package starts only from a `master` that holds every package in its "Needs merged first" column.
Two packages in the same wave never share files beyond their own lines in the shared ones (rule
12), so they merge in either order. Changes the owner asks for in a design review are made on the
same design branch before it merges.

## 7. How a session runs and reports

The administrator session creates each session with its model and effort, the repository
`hicadsystems/cirerms`, and a brief: this plan, its package, its branch. The session attaches
`hicadsystems/cirems` (read only) for the old code. Nobody watches a running session.

When done, the session sends one message to the administrator session
(`session_01G8RfviiqXAPPkGe8dkGyUw`) with:

- the branch and its last commit
- what was built or designed: every page and action, against the module's row in section 4
- the tests run and their result, and anything not verified
- docs changed
- for a design package, what the owner should look at first
- what the next package should know

The administrator checks the branch (author, no Claude mentions, rules 1 to 14 by reading the
diff), tells the owner it is ready to review or merge, updates the status table below, and starts
the next wave once the owner has merged.

## 8. Status

| Pkg | Status | Branch | Last report |
|---|---|---|---|
| `demo-themes` (extra: light and dark mode and the sign-in page in the demo) | Merged 18/11/2026 (Sonnet 5.5 · low) | `demo-themes` | 18/11/2026: 3dcaa39, only `docs/design/` changed; screens checked at 1440 and 390 px in both themes, no errors. Not tested: device-follow while open, cross-tab sync, reduced motion |
| WP0 | Running since 18/11/2026, Sonnet 5.5 · medium | `legacy-map` | |
| D1 | Not started | `design-drafting` | |
| WP1 | Not started | `foundation-access` | |
| D2 | Not started | `design-casework` | |
| WP2 | Not started | `static-tables` | |
| WP3 | Not started | `system-admin` | |
| WP4 | Not started | `disciplinary` | |
| WP5 | Not started | `discharge` | |
| WP6 | Not started | `training-drafting` | |
| WP7 | Not started | `drafting` | |
| WP8 | Not started | `advancement` | |
| WP9 | Not started | `reports` | |
| WP10 | Not started | `demo-finish` | |

## 9. Open questions

- **Memos and Mails** (a dashboard tile) has no menu item in the old system; WP0 looks for where it
  comes from. Until then the tile stays 0.
- **Crystal reports:** the old system has 77; WP0 lists which ones its screens still open, and only
  those are designed (D2) and rebuilt (WP9).
- **Advancement and appraisals:** if advancement needs appraisal grades, the demo seeds them until
  Naval Character Assessment is built.

## 10. Notes for later phases

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
