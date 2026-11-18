# CIRERMS Project Plan

Written 18/11/2026. Owner: swizfcodes. This file is the plan every work session follows; the
administrator session hands out the work packages below, one branch each, and updates the status
table as they report back.

## 1. Goal

**Phase 1, this plan: finish the demo, fully.** Every module except Special Drafting and Naval
Character Assessment works end to end on demo data: every menu item of the old system, every
page, every step and every action (list, view, add, edit, delete, approve, close, upload, print,
export), with users, roles and privileges.

**Later, not planned here:** Special Drafting, Naval Character Assessment, then importing the real
records from the old SQL Server database once our tables are settled. Both modules keep their
**Soon** label in the sidebar until then.

## 2. The old system (the reference)

- Repository `hicadsystems/cirems` (named HPProject inside), last commit 21/12/2022. ASP.NET MVC 5,
  Entity Framework, SQL Server, Crystal Reports.
- `hpproject/Views/Shared/_menu.cshtml` is its menu; section 4 maps every item to our modules.
- Its logic lives in three places: the controllers (`hpproject/Controllers`, about 23,000 lines),
  the data layer (`HRProjectDAL`, its model in `Core/HicadHRProjectModel.edmx`: 174 tables), and
  84 SQL Server procedures. Most procedure bodies are not in the code; they are in the 2017 backup
  `hpproject/DatabaseFile/HicadHRProject_20170401.bak`.
- **The backup may hold real personnel records.** Only definitions (procedures, views, tables) are
  ever copied out of it, never a record. It is restored in a throwaway database inside one
  session's container and deleted after (WP0).
- The backup is from 2017 and the code from 2022: where they differ, the code wins and the
  difference is written down.

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
   Lucide icons from the sprite, no inline scripts or handlers (the CSP forbids them), dates shown
   dd/mm/yyyy.
7. Every screen is checked on desktop (1440 px) and phone (390 px), in light and dark mode.
8. Read the old system for the module before writing code: its menu items, controller actions,
   views, the tables and procedures they use (`docs/legacy/` from WP0 says where). Port the rules;
   rebuild the look in our style.
9. Migrations go in the package's own number block: `src/db/migrations/20261120_WW####_name.sql`,
   where `WW` is the package number (WP2 is `02`). Blocks follow the dependency order, so files
   always run in the right order. Never edit a merged migration.
10. Touch only your module's files. Shared files (`public/js/core/nav.js`, `README.md`,
    `CONVENTIONS.md`, the seeds) change only in your module's own lines or section. A change a
    shared component needs is named in the report, not slipped in.
11. **Done means:** every old menu action of the module works on demo data; privileges are checked
    on every route and the screens hide what a person may not do; every write lands in the audit
    trail; demo seed data fills every page; a Playwright walk-through presses every action, on
    desktop and phone, in both themes, with no browser errors; README and CONVENTIONS describe what
    was built.
12. When done, send one report to the administrator session (section 7) and stop. Do not wait for a
    reply.

## 4. Module map (old menu to new)

| Old menu | New module | Old actions (controller/action) | Phase 1 |
|---|---|---|---|
| Ratings Management | Ratings Management | Employee: Create, ExcelUpload, Index, FormerEmployeeList, GetFolderList2 (documents), GetFolderList (confidential documents); Security/Upload (batch creation of accounts) | Built. Gaps checked in WP0 (confidential documents, batch account creation) |
| Drafting | Drafting | ShipRequirement/viewrequirement (manning requirement); draftings: draftlistfilters (draft proposal), draftreview, draftapproval, closedraftreview, ExcelUpload, draftenddate (WEF), summaryreport (batch / signal content), draftingreportindividual (rate DOD history), draftingreportList | WP7 |
| Advance Draft | Special Drafting | draftings: SpecialDraft, specialdraftinglist | Later |
| Advancement Processing | Advancement Processing | Advancement: advancementfilters (rates due), advancementreview, Advancementapproval, closeadvancement, advancementenddate (board returns), summaryreportforadvancement, ExcelUpload | WP8 |
| Assessment of Naval Character & Efficiency | Naval Character Assessment | AppraisalHistory/List (recommendation and grading); Report on Appraisal (a placeholder link in the old menu) | Later |
| Disciplinary Action | Disciplinary Action | Decipline: index (initiate incident), List (pending), DesciplineHistoryList (concluded, report) | WP4 |
| Discharge Administration | Discharge Administration | Discharge: dischargeproposal, dischargereview (registration, processing), ServiceDetails (print), Reports (verification forms), dischargereport, ExcelUpload | WP5 |
| Training Drafting | Training Drafting | TrainingDraft: TrainingDraftiningProcess, Trainingreview, trainingdraftenddate (training history), summaryreport, ExcelUpload | WP6 |
| Static Tables | Static Tables | 25 tables: Appraisal Ratings, Branch, Exit Type, Entry Mode, Appraisal Period, Disciplinary Offence, Disciplinary Sanction, Institution, Local Government, Languages, Relationship, Blood Group, Genotype, Staff Branch, Specialisation Area, Appointment, Ships, Hospital, Ailment, Country, States, Title, Qualification, Leave Type, Training | WP2 |
| Report | Reports | Report: personellistbybranch (ship history), personellistfilter (all personnel), PersonelReport (disposition); the Crystal reports WP0 finds still in use | WP9 |
| System Administration | System Administration | Security/CreateNewUser, RoleManagement/roleList, RoleManagement/priviledgelist, Security/ResetPasswordServiceNumber, Account/AuditTrail | WP1 (backend), WP3 (screens) |
| (from the new app) | Session lock | Locks after idle time; unlocks with the password only | WP1 |

Not in the old menu and out of scope: leave applications, medical history screens, the file
explorer and the info routers. Their tables stay in WP0's map only.

## 5. Work packages

Size: S (a day of session work), M, L. Model and effort are chosen per package to spend tokens
where the thinking is: Opus where rules are ported from procedures or security is at stake,
Sonnet where screens follow patterns already in the kit.

| WP | Branch | Scope | Model · effort | Needs merged first | Size |
|---|---|---|---|---|---|
| WP0 | `legacy-map` | `docs/legacy/`: how the old system is built and where its logic lives; one file per in-scope module (menu item, controller action, view, tables and columns, procedures, rules, reports, upload templates in `App_Data/UploadFormat`, and gaps against our app); procedure, view and table definitions from the 2017 backup in `docs/legacy/sql/` (definitions only, never records); a note on whether Drafting should be split in two | Sonnet 5.5 · medium | This plan | M |
| WP1 | `foundation-access` | Users, roles and privileges modelled on the old ones (a privilege per screen and action: view, add, edit, delete, approve), checked on every route; menus, tabs and buttons hidden without the grant; the audit trail (table and a helper every write calls); the session lock (password only); routes and screens registered from each module's own folder so later packages only add files; the admin role seeded with every privilege | Opus 5.5 · high | WP0 | L |
| WP2 | `static-tables` | One table engine for the 25 static tables (columns, types and links per table, such as Local Government under States), list, add and edit in a dialog, delete with an in-use check; today's lookups move under it | Sonnet 5.5 · medium | WP1 | M |
| WP3 | `system-admin` | Manage Users (an account for a rating, batch creation from Excel), Manage Roles, Manage Privileges (a role and screen grid), Manage Password (reset by official number), Audit Trail (filter by date, user and action) | Sonnet 5.5 · medium | WP1 | M |
| WP4 | `disciplinary` | Initiate an incident, pending cases, conclude a case with its sanction, concluded cases, the disciplinary report (PDF and Excel); the rating's record shows the cases | Sonnet 5.5 · medium | WP2 | S |
| WP5 | `discharge` | Discharge proposal, registration, processing (the rating moves to Former), print service details, verification forms, the discharge report, upload discharges from Excel | Sonnet 5.5 · high | WP2 | M |
| WP6 | `training-drafting` | Process a training draft, training review, update training history (feeds the record's Training tab), the reports, upload from Excel | Sonnet 5.5 · high | WP2 | M |
| WP7 | `drafting` | Manning requirement per ship, draft proposal (who is due, by the old rules), review and print, approval, close, upload, update WEF, batch and signal content, rate DOD history, draft report; drafting updates the record's Drafting tab and current ship. Split into WP7a and WP7b if WP0 advises | Opus 5.5 · high | WP2 | L |
| WP8 | `advancement` | Rates due for advancement (eligibility by the old rules), review, approval, close, board returns update, report on promoted rates, upload advanced rates; updates the record's Advancement tab and rate. If the rules read appraisal grades, the demo seeds them (Naval Character Assessment is later) | Opus 5.5 · high | WP2, WP4 | L |
| WP9 | `reports` | Ship history, all personnel (with filters) and disposition reports, and the old Crystal reports WP0 lists as still in use, as PDF and Excel | Sonnet 5.5 · medium | WP7 | M |
| WP10 | `demo-finish` | Dashboard tiles live (Drafting, Memos and Mails as WP0 finds them, Appraisals stays 0), Ctrl K reaches every new screen, demo data across every module, one walk-through of the whole demo on desktop and phone in both themes, docs and `docs/design/demo.html` brought up to date | Sonnet 5.5 · medium | WP3 to WP9 | M |

## 6. Order: two sessions at a time

| Wave | Runs together | The owner merges before the next wave |
|---|---|---|
| A | WP0 | WP0 |
| B | WP1 | WP1 |
| C | WP2, WP3 | WP2 (WP3 may follow) |
| D | WP4, WP5 | WP4, WP5 |
| E | WP6, WP7 | WP6, WP7 |
| F | WP8, WP9 | WP8, WP9 |
| G | WP10 | WP10: the demo is complete |

A package starts only from a `master` that holds every package in its "Needs merged first" column.
Two packages in the same wave never share files beyond their own lines in the shared ones (rule
10), so they merge in either order.

## 7. How a session runs and reports

The administrator session creates each session with its model and effort, the repository
`hicadsystems/cirerms`, and a brief: this plan, its package, its branch. The session attaches
`hicadsystems/cirems` (read only) for the old code. Nobody watches a running session.

When done, the session sends one message to the administrator session
(`session_01G8RfviiqXAPPkGe8dkGyUw`) with:

- the branch and its last commit
- what was built: every page and action, against the module's row in section 4
- the tests run and their result, and anything not verified
- docs changed
- what the next package should know

The administrator checks the branch (author, no Claude mentions, rules 1 to 11 by reading the
diff), tells the owner it is ready to merge, updates the status table below, and starts the next
wave once the owner has merged.

## 8. Status

| WP | Status | Branch | Last report |
|---|---|---|---|
| WP0 | Not started | `legacy-map` | |
| WP1 | Not started | `foundation-access` | |
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
  those are rebuilt.
- **Advancement and appraisals:** if advancement needs appraisal grades, the demo seeds them until
  Naval Character Assessment is built.
