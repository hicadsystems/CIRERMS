# CIRERMS design reference

`demo.html` is the approved layout and look for the CIRERMS frontend (approved 18/11/2026). It is one
self-contained file: open it in a browser, offline. Everything on it is sample data and nothing saves.

The app now follows it: the theme, the shell, the component kit (`components.md`), every Ratings screen and
Ctrl K search are built. What is still only in the demo is listed at the end.

| File | What it is |
|---|---|
| `demo.html` | The built demo. Open it; **Phone Preview** (top right) shows the phone layout from a desktop |
| `demo-src.html` | Its source: the shell, every screen and the session lock, in plain JavaScript and Tailwind classes |
| `build-demo.js` | Builds `demo.html` from `demo-src.html` with the project's own `tailwind.config.js`, `public/css/input.css`, icon sprite and `js/core/choices.js` (`npm run demo:build`) |

Because it is built from the project's tokens, a change to `input.css` or `tailwind.config.js` shows in
the demo after `npm run demo:build`.

## What it decides

- **Shell.** Desktop: the sidebar grouped by area (Overview, Personnel, Operations, Records,
  Administration), folding to icons; it keeps its scroll place and brings the current item into view after
  every page change. A top bar with search (Ctrl K) and the module's pages as tabs under it. Phone: a
  header, the module's pages as chips, a bottom bar (Home, Ratings, Documents, My Details, More) and a More
  sheet of every module.
- **Lists.** 25 per page, search and filters above, a table on desktop and cards on a phone. Clicking a
  row shows the record beside the list on a wide screen, in a dialog on a narrower one and in a bottom
  sheet on a phone.
- **Every "add" opens in a dialog** (bottom sheet on a phone), New Rating included: its four steps are in
  the dialog and moving between them keeps what was typed.
- **The rating's record.** No banner: avatar, name, labels and actions on one row, then the thin
  completeness bar (red below 50%, amber to 79%, green from 80%), then the ten tabs.
- **Look.** No white: ivory surfaces on the ivory-to-pale-blue page gradient; rounded corners, soft
  shadows, gradient buttons, the theme-blue scrollbar. The rules are in `CONVENTIONS.md`, Frontend.

## Decided after the demo (built in the app)

- **Folded sidebar:** each item's name shows in a tooltip just below the pointer, with a soft shadow; the
  areas are separated by a thin line instead of blank space.
- **Dialogs and bottom sheets** animate in (rising on desktop, sliding up on a phone).
- **Toasts** fade, have a close button and stay 4.2 seconds (errors 6 seconds).
- **Light and dark mode:** dark is "Navy Night" (deep navy surfaces, dimmed ivory text, brighter teal and
  blue, dark text on the bright buttons and pills). The first visit follows the device; the switch is at the
  top right of the desktop top bar and in the account menu (sidebar and phone), and the choice is kept. The
  sign-in page is a day sea in light mode and a night sea in dark mode, with its own switch at the top
  right. The demo shows all of it: it opens on the sign-in page (Sign In, or a demo account button then
  Sign In, enters the dashboard; Sign Out in the account menu returns), and both modes work on every screen
  and on the phone. Its choice is kept in the browser (`cirerms-theme`), as in the app.
- **Sidebar Administration items** (Static Tables, Reports, System Administration) show as Soon until their
  screens are built.

## Demo only (not to be built as shown)

- The **Layout Demo** badge, **Phone Preview**, the sample data and the `?idle=` address setting.
- The session lock's password check against a fixed demo password (`Admin@123`); the real lock asks the
  server.
- **Administration** (Static Tables, Reports, System Administration) and the **session lock** show the
  agreed look only. They need new tables and API routes and wait on the legacy system as reference.

## Drafting, Training Drafting and Advancement Processing (package D1)

Three modules, 21 pages, built into the same demo (`demo-src.html`, each module in its own block between
`==== D1 BEGIN` and `==== D1 END` markers). Open the sidebar items **Drafting**, **Training Drafting** and
**Advancement Processing** (Special Drafting and Naval Character Assessment came with D3, below). The old rules and fields
come from `docs/legacy/` (`drafting.md`, `training-drafting.md`, `advancement.md`), the faults listed there are not
copied.

**Behaviour of the demo.** The pages share one in-memory store, so what you do on one page shows on the next: make a
batch on *Print Draft Proposal* and it is in *Review/Print Draft*; approve and close it and it is on *Update WEF*;
saving a WEF moves the rating's ship, saving a board date changes its rate, and confirming a training batch adds the
course to the rating's Training tab (open the record to see it). Nothing is saved: a reload brings the data back.
The Ratings demo dates most current ratings' ships and rates far in the past, so the demo re-dates the current ratings'
*time on ship* (11 to 34 months) and *time in rate* (31 to 62 months) at start-up; the Ratings screens read the same
dates.

**What is common to all three modules**

- *Who is due* is shown as a list that reads only. The old pages **created the batch on a GET** (a search, a refresh
  or a double click made records). Here the list only shows; **Create Batch** is a button that opens a dialog showing
  the batch number, the filters and the number of ratings, and writes only when confirmed. A rating already in an open
  batch is shown with its batch number and is left out of a new one; if an open batch for the same filters exists, the
  dialog adds to it (the old rule: reuse the open batch). One rating is enough to make a batch (the old code needed
  two).
- *Batch numbers* keep the old shape, a code and a six-digit counter per code: `DOD-SM-ALL-ALL-000006` (Drafting:
  branch, specialisation, rate), `DOA-ALL-ALL-LS-000001` (Advancement), `DOT-2026-11-06` (Training: year, month and
  course number, with the month padded: the old `/010/` for October is gone).
- *Placeholders are real choices.* "All" is a separate, labelled option; the old pages let "--Select" pass as a value.
- *Every add, edit and process step is a dialog* (a bottom sheet on a phone), with its errors under the field, a
  confirmation for anything that removes or closes, and a toast after. Lists are 25 a page with cards on a phone.
- *Wide tables never scroll sideways* (the owner's rule, `CONVENTIONS.md` on `project-plan`). Every list shows only the
  columns a person scans to find a row (about four); everything else is in the row's **record dialog** (a bottom
  sheet on a phone), with the row's actions. Every row opens it on a click or Enter, has the pointer cursor and the
  hover tint, and shows a **View Details** tooltip just below the pointer on desktop; on a phone the list is cards and
  a tap opens the sheet. The old per-row Edit and Remove buttons are in the dialog now. The attendance checkboxes in
  Update Training History stay in the table and do not open the dialog. Names in lists are plain text; the dialog has
  Open Record. Approval and the batch lists open the department or batch facts first, with a button to the contents.
- *Printouts* open as a **PDF preview** in a large dialog: a paper sheet with the crest, title, facts, the table,
  signature lines and page count, with Download PDF and Print. The server will make the real file; the preview shows
  the fields each printout carries (taken from the Crystal reports' datasets, whose layouts are binary). They are
  *Manning Requirement Report*, *Draft Form*, *Draft Batch Summary*, *Draft Report* (batch and whole), *Draft
  History*, *Training Draft Report*, *Advancement Form*, *Batch Summary Report for Advancement* and *Advancement
  Report*.
- *Uploads* (Training Excel Upload, Upload Advanced Rates) follow the Ratings Batch Upload: Download Template, Choose
  File, Review and Import. The review reads every row first and lists the ones not imported (row, official number,
  field, problem, skipped or error); the rest are imported in one go and the result says how many. The template is
  keyed by official number only: the old sheets repeated the name, sex, ship and date joined, which the record
  already has. *Choose File* is a demo picker with four files (one with row errors, an empty one, one with the wrong
  headings, a CSV) so every state can be seen.
- *Who is due: unconfirmed* (PLAN section 9). Months on a ship and months in rate are shown as the colour of a pill:
  on a ship 10 to 20 months green, 21 to 24 amber, over 24 red (under 10 neutral); in rate 48 to 50 green, 51 to 54
  amber, over 54 red (under 48 neutral). **Nothing on screen explains the colours.** As placeholder rules the demo
  lists a rating as due for a draft at 10 months or more on its ship, and for advancement at 48 months or more in its
  rate and not already in the top rate; training takes the ratings its course is open to. These are placeholders until Hicad's rules
  arrive; the build keeps the thresholds as settings in the database (decision 7).

### Drafting (old menu: 10 pages; 9 here)

| Old page | New screen (tab) | What changed, and why |
|---|---|---|
| Update Manning Requirement (`ShipRequirement/viewrequirement`, page title "Ship Requirement Report") | **Update Manning Requirement**: filters (Ship, Rate, Specialisation), list with Edit and Delete, Add Requirement, Print | The list shows "#" in the SN column in the old page; here it is the row number. A **duplicate check** (ship, rate and specialisation) and a quantity of 1 to 99 were missing. Delete asks first. Print is one dialog (a ship or all) that previews the PDF; the old *Print By Department* compared the wrong columns and *Print Ship* needed the exact name. The page now shows **Required, Aboard** (the current postings to that ship, rate and specialisation) and the **difference**; it advises and never blocks (decision 1) |
| Print Draft Proposal (`draftlistfilters`, page title "Draft Proposal") | **Print Draft Proposal**: Branch, Specialisation, Rate (each with All), the list of ratings due, **Create Draft Batch** | See *common* above (no write on search, one rating is enough, no batch for placeholder choices). "Department" is labelled **Specialisation** (it is the specialisation area in the old tables). Columns kept: official no, name, current ship, date joined it, months on ship, last two ships, authority of the last draft; the old *Rate* and *Sex* columns are folded into the name, the *Last Ship 11* label is fixed, and the name shows rate and both names, not the surname only |
| Review/Print Draft (`draftreview`) | **Review/Print Draft**: batch picker (open batches only), progress (n of m have a proposed ship), a record dialog per row (Edit Posting: Proposed Ship, Vice/Deployment, Remark; **Not Recommended**; Remove), Add Personnel, Print Draft, Export Excel, Clear Draft | The old row inputs and the "Save New Ship" that posted every edited row at once are one *Edit* dialog per row, validated: a ship is required and must differ from the current one (the old `Int32.Parse` aborted the save half-way). *Add Personnel* finds by official number (the name search was broken), shows the found rating, refuses a rating already in an open batch, and **saves the Request** (Medical, Special Requests, Others), which the old page lost. *Clear Draft* asks first. A proposed ship shows a **warning pill** (*Over by n* / *Under by n*) when the open batches would leave that ship over or under its manning requirement; nothing blocks (decision 1). **Not Recommended** (a required reason) takes the rating out of the batch: it is shown struck out with the reason, on the *Draft Form* too, and returns to the due list next time (decision 3). Print Draft is the old *Verification Form*, which was commented out in the old page but is the printout the old map assigns to this page |
| Draft Approval (`draftapproval` and its detail) | **Draft Approval**: one row per department with its totals by rate group, status and who approved; a row opens that department's list, then **Approve Department** (rank, name, appointment) | Approval stays **per department**, as in the old page. The old success handler crashed, the appointment was stored in the *draft officer* column, and an empty department could be approved: here the form has three required fields, a department with a rating that has no proposed ship cannot be approved, and approving again warns that it replaces the earlier approval. The rate groups come from the Rates table in its order (today OS, AB, LS, PO, CPO, WO, MWO, NWO; the old headings listed SM and had no CPO) and nothing hard-codes them; approving is a privilege of the approval pages, which the demo's Administrator holds (decision 5) |
| Close Draft (`closedraftreview`) | **Close Draft**: the open batches with their readiness, **Close** opens a dialog (Authority, Close Date) | The old page closed every pending batch at once with a hidden empty batch number. Here **one batch** is closed, and only when every rating has a proposed ship and every department in it is approved (the old page checked neither); the authority must be new (the dialog names the batch that already used it); the date is dd/mm/yyyy, not in the future and not before the batch started (the old parser swapped day and month). The message after saving was never shown; here it is a toast and the page moves on to Update WEF. A closed batch is final, with no reopen: a correction is made on the rating's record, and the audit trail records it (decision 3) |
| Upload Draft (`draftings/ExcelUpload`) | **Not here.** Moved to Special Drafting by the owner (19/11/2026) | |
| Update WEF (`draftenddate`) | **Update WEF**: batch picker (closed batches with an authority, still waiting or closed in the last 30 days), department filter, per-row **Set WEF**, **Set WEF for Department** | The old page named closed batches "open". The date is checked (dd/mm/yyyy, not before the authority date) and the old *Update All Department* dated every batch of the department with no confirmation: here it dates the chosen batch's pending ratings only, says how many, and skips ratings with no proposed ship. Saving **moves the rating**: the current posting ends the day before, a new posting starts on the WEF at the proposed ship, and the record's Drafting tab shows it. A WEF in the future shows on the record as scheduled (*Drafted to X wef dd/mm/yyyy*) and the ship changes on that date (decision 4) |
| Batch/Signal Content (`summaryreport`, detail `draftingreport`) | **Batch/Signal Content**: filters (Branch, Rate, Signal Code, Batch No), the batch list with total, reported and not reported, and Print Summary; a row opens the batch with its filter (Official No, Name), the ratings with old and new ship and the date reported, Print Draft Report and Export Excel | The old *Generate PDF* on the list was a 404, the rate filter used the branch value, the *Rank* column was always empty and the detail's header was never filled. All four filters work, the Rate filter matches the batch's rating rate or a rating inside it, the header facts are filled, and the Excel column faults ("Officail Number", WEF overwritten by the request, "COMPLEMENT" in the vice column) are not copied |
| Rate DOD History (`draftingreportindividual`) | **Rate DOD History**: an Official No search, the rating, and its drafts (batch, authority, old and new ship, date reported, status: Proposed, Awaiting WEF, Reported), Print PDF | A blank search used to list **every** draft of every rating, and the PDF was not the person's history. Here a blank search asks for a number, an unknown number says so, and the PDF is this rating's history. It opens on B0539 so the page is not empty |
| Draft Report (`draftingreportList`) | **Draft Report**: filters (Specialisation, Authority, From, To), every posting that has reported, Print Report, Export Excel | The old page showed a leftover shared table, its end-date box was named `authority` so the report was never rebuilt, and the date boxes had no labels or format. Here the filters are labelled, dates are dd/mm/yyyy and checked (a From after To shows an error), and the list is read from the batches. *Deployment/Vice* shows the vice, not the request |

### Training Drafting (5 pages)

| Old page | New screen (tab) | What changed, and why |
|---|---|---|
| Process Training Draft (`TrainingDraftiningProcess`, then `Traininglistfilters`) | **Process Training Draft**: the open training batches, **New Training Batch** (a dialog in two steps: Course and Period, then Select Ratings by Branch, Specialisation and Rate, with the count that match), and **Add Ratings** on an existing batch | The old page created the batch, then *always* redirected to a second form, then dropped the batch number on the way to Review, and swallowed every error. Here it is one dialog, a duplicate (same course, month and year) is refused with the batch it matches, "--Select" and "All" are not values, and the batch is open in Review straight after. A course takes only the ratings it is open to (its branch or specialisation, and its rates if it sets them) who are not already in an open batch for it, and the dialog says so (decision 6) |
| Training Review (`Trainingreview`) | **Training Review**: batch picker (open batches), the ratings with rate, length of service and last course, **Add Rating** (official number), **Add by Branch**, Remove | Workflow state lived in the session in the old page, so Add and the dates could land on a different batch from the one chosen; here every action uses the batch on screen. A rating with no earlier course shows *First course* (the old PDF crashed on it). The *Title* column repeated the rate in our data and is dropped |
| Update Training History (`trainingdraftenddate`) | **Update Training History**: the batch's ratings with an **Attended** box each, **Confirm Training History** (Institution, batch Start and End Date, Result: Distinction, Credit, Pass or Fail) | The batch has one start and end date, a rating that did not attend is left out and gets no result, and a rating's own dates can be changed one by one (**Change Dates** in its record dialog) before the batch is confirmed (decision 6). The end date must not be before the start or in the future (nothing was checked), the old *Remove Rate* button posted to an action that did not exist, and there was no message after saving. Saving adds a **Training record** to every attending rating and **closes the batch**: the old module had no way to close a training batch (decision 3) |
| Reports (`summaryreport`, `trainingdraftingreport`) | **Reports**: filters (Training, Month, Year, Batch No) that work, the batch list, a batch with its ratings and **Print PDF** | The old filters read inputs that did not exist, so the list ignored them while the count obeyed them. The PDF no longer prints the first name only or runs the names together |
| Excel Upload (`TrainingDraft/ExcelUpload`) | **Excel Upload**: Download Template, Choose File, Review and Import | Template columns: Official No, Course, Institution, Qualification, Start Date, End Date, Authority (the old sheet had 13, with a first column that did not bind). All rows are read first and the problem rows are listed with their row number (the old page stopped at the first bad row, printed a wrong line number and had inserted the earlier rows already); wrong messages (institution reported as "Drafted to Ship", training as "Rate") are gone |

### Advancement Processing (7 pages)

| Old page | New screen (tab) | What changed, and why |
|---|---|---|
| Rates due for Advancement (`advancementfilters`) | **Rates due for Advancement**: Branch, Specialisation, Current Rate, the list (age, length of service, current rate and since when, months in rate), **Create Advancement Batch** | As Print Draft Proposal. The old list showed 25 rows with the pager commented out, labelled the first name "Surname" and the department "Current Ship", and said *Double Click Here To Search*; the empty *New Rate* column is dropped |
| Advancement Review (`advancementreview`) | **Advancement Review**: batch picker, progress (n of m have a new rate), a record dialog per row (**Set New Rate**, **Not Recommended**, Remove), Add Personnel, Print Form, Export Excel, Clear Batch | A rating advances **one rate at a time**: the dialog shows the next rate and offers no choice (the old page allowed any rate, even the placeholder). *Reason* is now an optional *Remarks* field (decision 2). **Not Recommended** works as in Draft Review: a required reason, struck out on screen and on the *Advancement Form*, back on the due list next time (decision 3). Adding a person no longer used the drafting period, sent no department and set no rate; it refuses a rating already in an open batch. *Print Form* is the old *Advancement Form*, which the old map assigns to this page |
| Approval (`Advancementapproval`, detail `AdvancementreportByDept`) | **Approval**: as Draft Approval, with the totals by **new** rate | One screen in place of the old summary page plus a detail page where the real approval happened. The same checks as Draft Approval (every rating has a new rate) |
| Close (`closeadvancement`) | **Close**: as Close Draft | The old page closed every batch of the month (it used the month as the batch), through the same date parser fault. One batch, with the same readiness rules, a unique authority, and on to Board Returns |
| Board Returns Update (`advancementenddate`, page title "Returns From Advancement Board") | **Board Returns Update**: batch picker (closed batches with an authority), per-row **Set Date**, **Set Date for Batch** | The only place the date of advancement was entered in the old system. The date is dd/mm/yyyy, not in the future and not before the rating joined its current rate; the batch date leaves dates already entered alone (the old one overwrote them) and says how many it dates. Saving **applies the new rate**: the rating's rate changes from that date and its Advancement tab gets the line (decision 2; the old code does not show where this happened). Candidates the board does not approve are marked *Not Recommended* in Advancement Review before the batch is closed (decision 3) |
| Report on Promoted Rates (`summaryreportforadvancement`, detail `AdvancePersonelReport`) | **Report on Promoted Rates**: filters (Branch, Rate, Signal Code, Batch No), batch list with total and promoted, Print Batch Summary, a batch with its ratings and Print Advancement Report | The old *Rate* filter used the title table, the *Rank* column was blank, the Branch name came from the wrong table and `StartsWith("1")` matched branch 10; the batch summary PDF filters were not bound. An unreached date no longer prints as today: it shows *Pending* |
| Upload Advanced Rates (`Advancement/ExcelUpload`) | **Upload Advanced Rates**: Download Template, Choose File, Review and Import | Template columns: Official No, Old Rate, New Rate, Effective Date, Authority, Decoration, Remark. The review checks the official number, that the old rate is the rating's rate on record, that the new rate is above it, the date, and duplicates (a second promotion of the same rating is allowed; the same one twice is skipped, where the old procedure refused any second one). Importing adds the Advancement line and sets the rate |

### Decisions (the owner, 19/11/2026)

1. **Manning requirement is advisory, not a limit.** The proposal lists every due rating; the manning page shows
   Required, Aboard and the difference, and Review/Print Draft warns per proposed ship; nothing blocks, because the
   commander's draft decides and the requirement only informs it.
2. **A rating advances one rate at a time, and the new rate takes effect on the board date** entered in Board Returns
   Update (and on upload); *Reason* became the optional *Remarks*. There is no case in the old system for a skip.
3. **Close is one batch at a time and only when the batch is fully approved; a candidate can be "Not Recommended"**
   in Draft Review and Advancement Review (a required reason, struck out, on the printout too, back on the due list
   next time). A closed batch is final, with no reopen; corrections are made on the rating's record, which the audit
   trail records. A training batch closes when its history is confirmed.
4. **Update WEF ends the old posting the day before and starts the new one on the WEF date.** A WEF in the future shows
   on the record as scheduled ("Drafted to X wef dd/mm/yyyy") and the current ship changes on that date.
5. **Approving is a privilege** (the approve action on the approval pages, which the demo's Administrator has), and
   the rate groups come from the Rates table in its order, so nothing hard-codes them.
6. **Training.** Eligible are current ratings matching the course's branch or specialisation (and its rates, if the
   course sets them) who are not already in an open batch for that course. Results are Distinction, Credit, Pass and
   Fail; a rating not ticked as attending gets no result. The batch has one start and end date and a rating's dates
   can be changed one by one in Update Training History. *The Training static table therefore needs Branch,
   Specialisation and Rates columns on a course (WP2); the demo holds them in its own data.*
7. **The due rules stay placeholders** (10 months on a ship, 48 months in rate, every matching current rating for
   training) until Hicad supplies the real ones. The build keeps the thresholds as **settings in the database**, so
   the real values can be entered without a code change.

Shared Ratings code touched: the record's Drafting tab (`demo-src.html`, the timeline in `viewRecord`) gains one
line for a scheduled move (decision 4); the Ratings screens are otherwise unchanged.

## Disciplinary Action and Discharge Administration (package D2)

Two modules, 9 pages, built into the same demo (`demo-src.html`, between `==== D2 BEGIN` and `==== D2 END` markers, after D1's
wiring). Open the sidebar items **Disciplinary Action** and **Discharge Administration** (both lose *Soon*). The old fields and rules
come from `docs/legacy/` (`disciplinary.md`, `discharge.md`, `reports.md`); the faults listed there are not copied. D2 reuses D1's
patterns and parts, so everything under *What is common to all three modules* above holds here too: the due list only reads, a proposal
is made in a confirming dialog, each row opens a record dialog (a sheet on a phone) with its actions and a View Details tooltip, printouts
open as a PDF preview, uploads go Download Template, Choose File, Review and Import with every problem row listed, and the due rules are
placeholders shown only as coloured pills.

**Behaviour of the demo.** One in-memory store, as in D1. Open a case on *Initiate Incident*, see it in *Pending Cases*, conclude it, see
it in *Concluded Cases*, in the *Disciplinary Report* and on the rating's **Discipline** tab. Make a proposal on *Process Discharge*,
process a rating and close it: it leaves the lists and is in *Former Ratings* (with an exit date in the future it stays current, shows
**Leaves dd/mm/yyyy** on its record and in the Discharge Report as *Scheduled*). Re-engage a rating and it stays current, shows
**Re-engaged to dd/mm/yyyy** and its Re-engagement Verification form can be printed. Nothing is saved: a reload brings the data back.
The Ratings demo has nobody near retirement, so the demo gives 12 current ratings the age and length of service that make them due, and
every rating an entry mode.

### Disciplinary Action (old menu: 4 items, 3 distinct pages; 4 tabs here)

| Old page | New screen (tab) | What changed, and why |
|---|---|---|
| Initiate Incidence (`Decipline/index`, then `CreateNewIncident`) | **Initiate Incident**: find a rating by Official No or name (partial match), a list of the **current** ratings found, a row opens the rating with **Open Case**, then the case form (Incident Date, Offence, What Happened, Reported By) | The old search was an exact match, empty returned nothing and the "Are you sure" page came **after** the case was saved. Here a former rating is refused with a message (decision 1), the case form validates every field (the old Offence was optional, a blank text failed in the database, a future date and a date before the rating joined passed), a case already open for the same offence and date is refused, and one button opens the case as *Pending*. The case keeps the rate and ship the rating had at the time |
| Pending Cases (`Decipline/List`, `Edit`) | **Pending Cases**: Official No or name and Offence filters, the list, **Print List**; a row opens the case with **Conclude**, **Cancel Case**, **Print Case** and Open Record | The old *Saction And Comment* button opened an edit form whose read-only fields (even the Offence list) could be changed, and the decision date had no check. **Conclude** shows the incident and asks only for the decision date (not before the incident, not in the future), the sanction (Sanctions table), the decision and the authority, all required. **Cancel Case** needs a reason and takes a case opened by mistake off the lists; nothing is deleted (the old Delete page had no link and did not audit). Print List is the old *Export*, which printed every case including deleted ones with no filter, no name and no offence |
| Concluded Cases (`DesciplineHistoryList`) | **Concluded Cases**: filters (Official No or name, Offence, Sanction, decided From and To), the list; a row opens the case with **Correct**, **Print Case** and Open Record | The old *Review* re-opened the same edit form, so a concluded case was silently editable and the audit row was written only when the edit failed. **A concluded case is final**: it changes only with **Correct**, which needs a reason, keeps the before and after of every changed field with the case (shown in the dialog) and is for the audit trail. A concluded case with no sanction no longer crashes the list |
| Disciplinary Report (the same page and link as Concluded Cases) | **Disciplinary Report**: filters (decided From and To, Offence, Sanction, Ship, Rate), three figures, the list, **Print PDF**, **Export Excel** | See *Concluded Cases or Disciplinary Report: one tab or two* below |

**Concluded Cases and Disciplinary Report: one tab or two.** Two. The old menu had two labels for one page. They do two different jobs: *Concluded
Cases* is the working list, where one case is opened and corrected; the *Disciplinary Report* is a document, with the wider filter set (ship and rate
as well), a summary, a PDF and a workbook, and it only reads. Keeping them apart also lets a role be given the report (view, print, export) without
the right to correct a case. Both read the same concluded cases.

**The rating's Discipline tab** (decision 3). The record gains an eleventh tab, **Discipline**: the pending and concluded cases of that rating
(a cancelled case is not shown), each row opening the case read-only. It is seen only by someone who may view Concluded Cases (the demo's
Administrator), it is **not on My Details**, and it does **not count towards the record's completeness**.

### Discharge Administration (old menu: 5 live pages)

| Old page | New screen (tab) | What changed, and why |
|---|---|---|
| Process Discharge (`dischargereview`, with `dischargeproposal` behind its button) | **Process Discharge**, two views: **Due for Discharge** (filters Official No or name, Branch, Rate, Entry Mode; age and service as coloured pills; **Create Proposal**) and **Proposals** (a picker of the open proposals, progress, the ratings, **Add Rating**) | The old *Batch* search **created discharge rows on a GET** and "All" and "--Select Batch" were the same value; the Official No search had no handler. Here the due list only reads (Official No search works). **Create Proposal** opens a dialog with the proposal number (`DIS-2026-0003`), the filters and the number of ratings, and writes only when confirmed; every due rating in the filter goes in, and the old checkboxes are replaced by narrowing the filters, or by **Remove** afterwards. A rating already in a proposal is shown as such and left out of a new one. **Add Rating** finds any current rating by Official No (a medical discharge or a death is not tied to the due list) |
| Process (row) | A row of Proposals opens the rating with **Process**, **Re-engage**, **Remove** and Open Record | **Process**: Exit Type (Static Tables, Exit Type), Exit Date, Exit Reason (up to 100), Approved By and Comment (both optional), the four death documents **only when the exit type is Deceased** (recorded, never enforced, and posted properly: the old `.val()` on a checkbox always sent "on"), and Status **Pending** or **Closed**. Pending saves; **Closed asks first** and says it is final, and what happens (the rating moves to Former Ratings now, or is scheduled). The old code chose between a discharge and a re-engagement by whether a date box was filled, set the exit type even for a pending re-engagement and trusted the client's age and service: here each is its own action and the server works them out |
| Re-engagement (a branch of Process) | **Re-engage** in the same dialog: Re-engagement Date, Period in months (1 to 120), Approved By, all required | Decision 5: re-engagement is not a discharge. The rating **stays current** and leaves the proposal; it is not due again while the re-engagement runs; its record shows **Re-engaged to dd/mm/yyyy** |
| (hidden `Remove` button) | **Remove** in the record dialog, with a confirmation | The rating stays current and can be proposed again. The old delete removed any row, even a closed one |
| Print Service Details (`ServiceDetails`, printing `EmployeeMaster`) | **Print Service Details**: find a rating (current or former, partial match), one match shows the printout button, several are a list whose rows open it; preview **Personnel Details** | The old search was exact (service number or surname). The printout keeps the old fields (official number, names, date of birth, telephone) and the rate history (each rate, from and to) |
| Verification Forms (`Reports`, three buttons) | **Verification Forms**: find a rating, then **Re-engagement Verification**, **Retirement Routine** and **Engagement Form**, each a preview | The old page listed a rating's discharge rows of any status, but each form read only **pending** ones, so a closed discharge printed an empty form, and only the first name, number and rate were sent. Here a form is available when its source exists: the Re-engagement Verification needs a re-engagement, the Retirement Routine needs a discharge (pending or closed), the Engagement Form needs nothing; a button that is off says why |
| Discharge Report (`dischargereport`) | **Discharge Report**: filters (exit From and To, Exit Type, Rate, Branch), three figures (Discharges, Scheduled, Re-engagements), the list, **Print PDF**, **Export Excel** | The old page's filters never worked (the code was copied from the drafting report) and re-engagements could never be listed. Here the filters work, and the report lists closed discharges **and** re-engagements (Exit Type has *Re-engagement* as a choice), with a future exit date marked *Scheduled* |
| Upload Discharge (`ExcelUpload`) | **Upload Discharge**: Download Template, Choose File, Review and Import | Decision 8. The template (the old one was missing from the repository) is keyed by Official No, with the fields the old import reads: **Official No, Exit Type, Exit Date, Authority, Approved By, Comment** (the old sheet also repeated the name, title, sex, ship, date joined and entry mode, which the record already has). Every row is read first and each problem row is listed (not on the roll, exit type not in the table, bad date, date before the rating joined, already discharged, already in a proposal); an import **closes** each discharge, in one go. The exit type stands as the reason (the old sheet had no reason column) |

**A closed discharge moves the rating** (decision 4). With an exit date of today or earlier the rating becomes *Former* at once (Former Ratings,
the exit date and reason, its open posting ended). With a later date it stays current, shows as scheduled on its record and in the report, and is
Former from that date. The demo cannot move the clock, so a scheduled rating stays scheduled. `LiveStatus` is not carried over.

**A pending disciplinary case** (decision 7). A warning, never a block: a *Pending case* pill on the due list and the proposal, and a notice
(with a link to Pending Cases) in the rating's dialog, in Process, in Create Proposal (a count) and in Add Rating.

**Who is due** (decision 6). Placeholder rules, unconfirmed: a current rating is listed when it is 50 or over, or has served 20 years or
more, unless a re-engagement is still running or a discharge is closed. Age: 50 to 54 green, 55 to 59 amber, 60 and over red; service: 20 to 29
green, 30 to 34 amber, 35 and over red (the old page left 30 and 35 uncoloured). **Nothing on screen explains the colours.**

### Printouts (the old Crystal reports the in-scope pages load; the demo had none of these)

All are PDF previews in D1's style, opened from the page that prints them. The `.rpt` layouts cannot be read, so each shows the fields of the old
dataset (`docs/legacy/reports.md` section 5), with the names and offences the old printouts lacked.

| Printout | Opens from | Fields |
|---|---|---|
| Pending Disciplinary Cases | Pending Cases, *Print List* | case, official no, name, ship, offence, incident date, what happened, reported by |
| Disciplinary Report | Disciplinary Report, *Print PDF* | the filters, then case, official no, name, ship, offence, incident, decided, sanction, decision, authority |
| Disciplinary Case Sheet | a case's dialog, *Print Case* | the case facts and decision, with signature lines (new: the old pages had no single-case printout) |
| Personnel Details | Print Service Details | official no, names, date of birth, telephone, rate history |
| Re-engagement Verification, Retirement Routine, Engagement Form | Verification Forms (and the Discharge Report's dialog) | official no, name, rate, date employed, length of service, age, then the re-engagement or the exit and a clearance table, or the engagement history; the layouts are indicative |
| Discharge Report | Discharge Report, *Print PDF* | official no, name, rate, date employed, service, type, exit date, reason, approved by |
| Ratings Report (All Personnel) | Reports, All Personnel, *Print PDF* | the page's filters, then official no, rate, surname, first name, branch, specialisation, ship, command, date of birth, date joined |
| Disposition Report | Reports, Disposition, *Print PDF* | area office, then official no, surname, first name, rate, sex, trade, ship or unit, area office, WEF |
| Static Tables list | every Static Tables page, *Print List* | the table's columns and its status, for the entries shown by the search |

The Ship History Report stays an Excel workbook, as in the old system (its Print PDF button says so).

### Dashboard tiles

Five tiles (three, then two, on desktop; two across and the last one full width on a phone, so the grid has no gap): **Members**; **Drafting**, the
drafts reported this year from the drafting batches, with the open batches; **Disciplinary**, the pending cases, with the cases concluded this year;
**Discharge**, the discharges with an exit date this year, with the ratings in a proposal; **Appraisals**, which shows *Soon* until Naval Character
Assessment is built. The **Memos and Mails** tile is dropped (the owner): it had no source in the old system.

### Reports pages (wide-table rule)

Ship History, All Personnel and Disposition follow the wide-table rule as D1's pages do: four key columns (Disposition: ship, ratings, share), a row opens
the full record in a dialog (a sheet on a phone) with a View Details tooltip on desktop, cards on a phone, no sideways scrolling at 1440, 1024 or 390 px.
Disposition's rate-by-rate counts moved into the row's dialog and a strip above the list.

### Decisions (PLAN 9b) and how they show

1. **Initiating and concluding are separate privileges.** Initiate Incident is the *add* action, **Conclude** is the *approve* action of Pending
   Cases. Only a current rating can have a case opened.
2. **A concluded case is final.** **Correct** (the *edit* action) needs a reason and is audited; a case opened by mistake is **Cancelled** from
   Pending Cases (the *delete* action, a required reason) and leaves the lists; nothing is deleted outright.
3. **The Disciplinary Report is a real report**; Pending Cases prints its own list; the Discipline tab is for whoever may view Concluded Cases, is
   not on My Details and is not counted in the completeness.
4. **Discharge keeps the old flow** (propose, process, report). Closing makes the rating Former on its exit date; a future date is scheduled; closed
   is final.
5. **Re-engagement is its own action** and the rating stays current.
6. **Due rules are placeholders**, no explanation on screen.
7. **A pending case warns**, nothing blocks.
8. **The discharge upload is keyed by Official No.**

Privileges the build should map (the Manage Roles demo has only view, add, edit and delete per module; it needs **approve**, and these two modules,
added by WP3 and WP1): Disciplinary: Initiate Incident = add; Pending Cases and Concluded Cases and the Report and the Discipline tab = view; Conclude =
approve; Cancel Case = delete; Correct = edit. Discharge: Process Discharge, Print Service Details, Verification Forms and Discharge Report = view; Create
Proposal, Add Rating and Upload Discharge = add; Process and Re-engage = edit; Remove = delete.

### Decisions taken after the first review (the owner, then the administrator)

From the owner:
- The **Memos and Mails** tile is dropped and **Appraisals** shows *Soon*.
- The three verification forms **keep D2's indicative layouts** until copies of the real forms arrive (before WP5).

From the administrator:
- **Correct** may change every field of a case except the rating (offence, incident date and text, reported by, decision date, sanction, decision,
  authority); it is audited, needs one change and a reason.
- The **Discharge Report also lists re-engagements** (Exit Type has *Re-engagement* as a choice); a rating re-engaged is not due while the re-engagement runs.
- **Upload Discharge** skips ratings already in a proposal or already discharged; the reason is optional (left empty; the exit type stands).
- **The due placeholder stands**: 50 years of age or 20 of service; bands age 50/55/60 and service 20/30/35; in the build they are settings.
- **Manage Roles** (WP3) will list every module's screens from the privilege catalogue, the *approve* action included.
- **Exit Type flags (PLAN 9c, in the build):** the Exit Type table carries *Rating stays current* and *Death* flags. Discharge offers only the exit types that do
  not keep a rating current, and asks for the death documents only for an exit type marked *Death* (the demo uses the name *Deceased*).

Choices D2 made where nothing was decided (unchanged):
- **Reported By** and **Authority** stay free text, required.
- **Dates**: an incident is not in the future and not before the rating joined; a decision is not before the incident or in the future; an exit date may
  be in the future (scheduled) but not before the rating joined. Pending needs an exit type and a reason; Closed also needs the exit date.
- A rating with a pending case that is discharged: the case stays open and can still be concluded; nothing links the two.
- A proposal exists while it has a pending rating; a rating is in one proposal at a time; re-engaged and removed ratings leave it.

### Shared lines D2 touched (all in `demo-src.html`; nothing else outside `docs/design/`)

- **Sidebar**: *Disciplinary Action* and *Discharge Administration* get their `href` and lose `soon`; `moduleOf` knows both routes; the router asks `D2.owns`
  beside `D1.owns` (in `render` and `renderTabs`); the command palette lists both modules' pages.
- **The record**: `RECORD_TABS` gains *Discipline*; `viewRecord` shows it (not on My Details), counts its badge, shows its body and adds `D2.pills(r)`
  (Leaves, Re-engaged to) to the header labels.
- **Dashboard**: the tile grid (five tiles; the Memos and Mails tile removed, Appraisals shows Soon). **The record's tab strip**: tighter desktop spacing and the short
  labels *Kin* and *Advance* on desktop (the full names stay on a phone), so all 11 tabs fit at 1280 and 1440 px.
- **Reports**: `viewReport` now builds its three lists with D1's table (key columns, record dialog, cards on a phone).
- **Static Tables**: a *Print List* button beside *Add*; **Reports**: the *Print PDF* button of `reportShell` now calls the printouts above.
- **A D1 fault fixed**: D1's `function viewReport()` (Draft Report) had the same name as the Reports module's `viewReport(slug)`, and a later function declaration
  wins, so **every Reports page showed the Draft Report**. D1's is now `viewDraftReport`. The same happened to the Ratings **Batch Upload** (`viewUpload()`), which D1's `viewUpload(key)` replaced, so that page threw an error; D1's is now `viewImport`.

## Special Drafting and Naval Character Assessment (package D3)

Two modules, 6 pages, built into the same demo (`demo-src.html`, between `==== D3 BEGIN` and `==== D3 END` markers, after D2's wiring and before the
session lock). **Special Drafting** and **Naval Character Assessment** lose *Soon*: the sidebar has none left. The old fields and rules come from
`docs/legacy/` (`drafting.md` section 6, `advancement.md`, `static-tables.md` section 1, `reports.md` section 5) and PLAN sections 9a, 9e and 10; the
faults listed there are not copied. D3 reuses D1's and D2's parts, so everything under *What is common to all three modules* (D1) holds here: the lists
read only, a write happens in a confirming dialog, each row opens a record dialog (a sheet on a phone) with its actions and a View Details tooltip,
printouts are a PDF preview, uploads go Download Template, Choose File, Review and Import with every problem row listed.

**Behaviour of the demo.** One in-memory store, as in D1 and D2. Draft a rating on *Special Draft Proposal*, print its form on *Special Draft Report*, then
open its record: the Drafting tab shows the new posting, or **Drafted to X wef dd/mm/yyyy, Scheduled** for a later WEF. Record appraisals, edit, cancel and
close a period, and the list, the report, the record's Appraisals and the dashboard tile all follow. Nothing is saved: a reload brings the data back.

### Special Drafting (old menu: Special Draft, Special Draft Report, and Upload Draft moved from Drafting; 3 pages)

| Old page | New screen (tab) | What changed, and why |
|---|---|---|
| Special Draft (`draftings/SpecialDraft`) | **Special Draft Proposal**: *Find* by Official No or name (partial match, current ratings only), a list of ratings found, a row opens the rating's current details (rate, branch, ship, date joined it, months there) with **Draft Rating**, then the form (Posting Type, Drafted To, Authority, WEF, Deployment/Vice, Remark). Below: **Special Drafts Not Yet Printed**, a row opens the draft with **Remove**, **Draft Letter** and Open Record | The old name search failed from the menu (it needed a batch number in the address); the page now opens from the menu and finds by number or name. The posting type is a **labelled list** (Complement, Vice, TY, DW; the old page had a bare box). Surname and first name are no longer saved into each other's columns (the record holds the names). The **duplicate check** the old code had commented out is back: a rating with a draft not yet printed shows *cannot be drafted again* in its dialog and the form refuses a second. Deployment/Vice is required for a Vice draft. WEF cannot be before the rating joined its ship nor more than a year ahead. **Draft Letter** is a one-rating letter preview and does not mark anything printed |
| Special Draft Report (`specialdraftinglist`) | **Special Draft Report**: a labelled **Posting Type** list (with the count waiting), the drafts of that type, **Preview Draft Form** (a PDF preview: *Special Draft Form*), **Print and Mark Printed** (a confirmation first), and **Printed Forms** (a row opens the form with **Reprint Form**) | The old box had no label and the code called it a date. Printing marks every draft of the type printed **in one step with the form number** (`SDF-2026-0003`), and only after the preview was seen and confirmed. A printed form can be reprinted from the list; reprinting changes nothing |
| Upload Draft (`draftings/ExcelUpload`, under Drafting in the old menu) | **Upload Draft**: Download Template, Choose File, Review and Import | The old sheet (`Draft6.xlsx`: SER, Name, Rate, Sex, Svc_No, Present_Ship, DOJ, ...) repeated what the record has, stopped at the first bad row, matched ships on *Description* and gave a success message that counted the whole table. The template is **keyed by Official No**: **Official No, Drafted To, Authority, WEF, Posting Type, Deployment/Vice, Remark** (9e decision 4). Every row is read first; each problem row is listed (not on the roll, former rating, ship not in Static Tables, bad posting type, bad date, Vice without Deployment/Vice) and a rating with a draft waiting, or twice in the file, is *skipped*; the rest are imported in one go as drafts **not yet printed**. The old Draft6 sheet is refused with a message that says so |

**A special draft moves the rating when its form is printed, on its WEF** (decisions 1 to 3). *Add* only joins the list, so *Remove* needs no undo. Printing ends the old
posting the day before the WEF and starts the new one on it (9a decision 4); a WEF after today leaves the ship as it is and the record shows the move as
**Scheduled** (the same line D1 added to the Drafting tab). The demo cannot move the clock, so a scheduled move stays scheduled. A printed draft is final; a correction is
made on the rating's record, under the audit trail.

### Naval Character Assessment (old menu: Recommendation and Grading, Report on Appraisal; 3 pages here)

| Old page | New screen (tab) | What changed, and why |
|---|---|---|
| (switched off in the old menu: Appraisal Period setup) | **Appraisal Periods**: counts (open, closed, appraisals), a list (period, dates, appraisals, status), a row opens the period with **View Appraisals**, **Edit** and **Close Period**; **Add Period** | The old system had no way to manage periods. A period has a name, a start and an end; names are unique and periods may not overlap. A period opens when added and **closes for good**: **Close Period** warns how many current ratings have no appraisal, and a closed period is read-only (nothing added, edited or cancelled in it) |
| Recommendation and Grading (`AppraisalHistory/List`, Create, Edit) | **Recommendation and Grading**: filters Official No or name, **Period, Ship, Rate, Grade**; the list (rating, period, Character, Efficiency); a row opens the appraisal with **Edit** and **Cancel Appraisal** (only while its period is open); **Initiate Appraisal** | The old *Rate* column showed the name and the form's *Rate* picked the official number; the **director's date and name were never saved**; there was no delete and no paging. Now: find the rating by Official No, an **open** period, **Character** and **Efficiency** grades from Static Tables, Appraisal Ratings (code, name and score range), Remark, **CO's Name**, **Director's Name and Date** (saved). **One appraisal per rating per period**: a second is refused with the reason. **Edit** lists what changed in the dialog; **Cancel** needs a reason and the appraisal leaves the lists (nothing is deleted outright), after which the rating can be appraised again for the period. 25 a page, cards on a phone |
| Report on Appraisal (menu link to the dashboard; never built) | **Report on Appraisal**: filters Period, Ship, Rate, Branch, Grade; three figures, **Grade Counts** (each grade by Character and by Efficiency), the list, **Print PDF**, **Export Excel** | New. A row opens the appraisal read-only. The printout is *Report on Appraisal*: the filters, the grade counts in the header, then official no, name, rate, ship, branch, period, both grades, CO and director |
| The rating's profile (appraisal history) | **The record's Advancement tab** gains an **Appraisals** list (period, grades, CO), each row opening the appraisal; **Initiate Appraisal** from there when a period is open | See *The rating's record* below |

### The rating's record: where the appraisals went (decision 8)

I chose to put the appraisals **under the Advancement tab**, below the advancement lines, and **not** to add a twelfth tab. The strip already holds 11 tabs (Discipline was
the eleventh, D2) with the short labels *Kin* and *Advance*, and a twelfth would not fit at 1280 px without scrolling or another round of shortening. Appraisals sit
next to advancement in the career a board reads, the Advancement tab keeps its width, and the strip measures the same at 1280, 1440 and 1024 (checked). Like the
Discipline tab it is **seen only by someone who may view Recommendation and Grading** (the demo's Administrator), is **not on My Details** and **does not count towards the
record's completeness**. The Advancement tab's badge still counts advancements only. Eligibility for advancement does not read the grades (WP0).

### Printouts (new, PDF previews in D1's style)

| Printout | Opens from | Fields |
|---|---|---|
| Special Draft Form | Special Draft Report, *Preview Draft Form* (and *Reprint Form*) | form no, posting type, ratings, date, then official no, name, rate, sex, current ship, months, drafted to, deployment/vice, authority, WEF (scheduled marked); the footer of the first preview carries **Print and Mark Printed** |
| Special Draft Letter | a draft's dialog, *Draft Letter* | the rating's details and the one draft; indicative layout (the old letter's `.rpt` cannot be read) |
| Report on Appraisal | Report on Appraisal, *Print PDF* | the filters, the grade counts for both grades, then the list |

### Dashboard tile

**Appraisals** stops showing *Soon*: it counts the appraisals recorded this month (cancelled ones excluded), with the number of open periods; both link to their pages.

### Decisions (PLAN 9e) and how they show

1. **A special draft posts one rating outside the batch cycle**: found from the menu by number or name, details filled in, Posting Type a labelled list, a second draft refused, Remove until printed.
2. **The move follows 9a decision 4**, as above; a printed draft is final.
3. **Special Draft Report** prints one form for the posting type and marks the drafts printed; past forms can be reprinted.
4. **Upload Draft** is keyed by Official No with the seven columns of 9e.
5. **Appraisal Periods** is a page; one appraisal per rating per period; a closed period is read-only.
6. **Recommendation and Grading** as the table above: grades from Appraisal Ratings, director's date and name saved, Edit while open, Cancel with a reason.
7. **Report on Appraisal** with the grade counts, PDF and Excel.
8. **The record shows the appraisals**; the tile counts appraisals this month.

Privileges the build should map (WP1/WP3 catalogue): Special Drafting: Special Draft Proposal and Special Draft Report and the printed forms = view; Draft Rating and Upload Draft = add; Remove = delete;
**Print and Mark Printed** = edit (it writes the postings; a stricter choice is the approve action). Naval Character Assessment: Appraisal Periods, Recommendation and Grading and Report on Appraisal = view;
Add Period and Initiate Appraisal = add; Edit Period, Close Period and Edit Appraisal = edit; Cancel Appraisal = delete; the record's Appraisals list needs view of Recommendation and Grading.

### Choices D3 made where nothing was decided (the owner can change any)

- **Nothing moves until the form is printed.** The brief says a special draft moves the rating on its WEF; adding only lists it, so Remove stays simple and a printed draft is final.
- **Closing a period is final** (no reopen), as a closed batch is in D1. A period opened by mistake can be edited while open.
- **Periods must not overlap**; names are unique; there is no delete.
- **Director's name and date are optional but paired** (give both or neither), since the director may not have signed when the CO's grading is recorded; the date is not in the future and not before the period began.
- **Remark is optional; CO's Name is required.** The old page's required fields are not documented; the CO's name is the one signed field.
- **Edit an appraisal needs no reason**, only a change (the dialog keeps a list of what changed); **Cancel needs one**. Both go in the audit trail in the build.
- **The report's Grade filter matches either grade**; Branch is the rating's branch; Ship and Rate are those **at the time** of the appraisal.
- **Only current ratings** can be drafted or appraised. A WEF may be up to 12 months ahead.
- **TY and DW** are shown by their codes: the old code gives no expansion (question for the owner). The demo seeds one draft of each type.
- **Print and Mark Printed** is the *edit* action in the privilege map above.
- **Draft Letter** does not mark anything printed.

### Shared lines D3 touched (all in `demo-src.html`; nothing else outside `docs/design/`)

- **Sidebar**: *Special Drafting* and *Naval Character Assessment* get their `href` and lose `soon`; `moduleOf` knows `special/` and `assessment/`; the router asks `D3.owns` beside `D1.owns`
  and `D2.owns` (in `render` and `renderTabs`); the command palette lists both modules' pages.
- **Dashboard**: the Appraisals tile (a count and the open periods instead of *Soon*), with `const d3s = D3.stats();`.
- **The record**: one line, the Advancement tab appends `D3.recordAppraisals(r, readOnly)`; `RECORD_TABS` and the strip are unchanged.
- Nothing in `components.md`: D3 adds no new part (it uses the kit D1 and D2 built).


## Printouts (package D4)

Every printout is a Handlebars template in `docs/design/printouts/`, turned into a PDF by Chromium. `npm run printouts:render`
(`render.js`; needs Handlebars, `npm i --no-save handlebars`, and Playwright's Chromium) fills each `<name>.hbs` with its
`<name>.sample.json` and writes `printouts/pdf/<name>.pdf`: those PDFs are what the owner reviews. The app's renderer (WP13) takes
the same templates, partials, stylesheet, fonts and helpers; nothing is fetched from the internet when a PDF is made.

### The house style

**Kept as the app draws it today** (`src/shared/pdf.js`): the Navy crest at the top left; "NIGERIAN NAVY — CIRERMS" in bold dark ink with the
system name under it in muted ink; the title in navy, bold, with an optional subtitle on the right under it; a navy rule; the footer on every page, "RESTRICTED —
Nigerian Navy CIRERMS | Generated by: <name> | <date and time>" at the left and "Page X of Y" at the right, small and muted (Chromium's PDF footer template, so it is on
every page); the colours navy `#0074a8`, teal `#1caf9a`, dark ink `#1d2939`, muted ink `#556070`, border `#d3d7db`, stripe `#f5f7f9`, the table header band navy.

**Copied from NAVY-PAYROLL**: the crest watermark (`body::before`, fixed, full page height, centred, `opacity: 0.02`, behind the text), the faint blue page
(`@page { background-color: #f8fbff }`), and the fonts: Inter for text, Libre Baskerville for titles and section headings (Georgia as the fallback), Courier New
for codes, figures and dates. Inter and Libre Baskerville are under the SIL Open Font License; their Latin files (and licences) are in `fonts/`, loaded locally.

**Improved**: the header is one block on the first page only; the title is set in Libre Baskerville; facts are label and value on one row with a hairline under them
(never stacked small capitals); section headings carry a short teal rule; tables have a navy header band that repeats on every page, rows that never split across pages,
a stripe, numbers right-aligned in Courier New, group rows (a ship, a branch) and a totals row; "not recommended" lines are struck through (they read in black and white);
signature blocks keep together, with a line, the role, an optional name and a Date line; a note block with a teal edge; A4 portrait for forms and short lists, landscape
for wide tables (the template says which: `{{> head orientation="landscape"}}`); margins 12 mm, 17 mm at the foot; type 8 to 8.5 pt (7.4 pt for dense landscape tables).
Empty details read "N/A" in facts and "-" in tables; dates dd/mm/yyyy.

### Files

| File | What it is |
|---|---|
| `printout.css` | The one stylesheet: tokens, fonts, watermark, header, facts, summary strip, tables, signatures, forms |
| `partials/head.hbs`, `header.hbs`, `facts.hbs`, `datatable.hbs`, `signatures.hbs`, `footer.hbs` | Shared parts (the page size and stylesheet, the header, label and value rows, a table with totals, the signature blocks, Chromium's footer template) |
| `helpers.js` | `date`, `datetime`, `num`, `len`, `add`, `eq`, `upper`, `factValue`, `rowCells`, `totalCells`, `headCells` |
| `fonts/`, `assets/` | Inter and Libre Baskerville (woff2, Latin), the crest, a sample photo |
| `<name>.hbs`, `<name>.sample.json` | A printout and its believable sample data (every list runs past one page) |

Data shape for the table-style printouts: `title`, `ref`, `subtitle`, `generatedBy` (a rating's name as the app writes it: rate, surname, first name), `generatedAt`,
`facts: [{label, value, kind}]`, `table: { columns: [{label, key, kind, w}], rows, totals, dense, heading }`, `note`, `signatures: [{role, name}]`. A column `kind` is one of
`text`, `code`, `name`, `num`, `date`, `ctr`, `yesno`, `flag`, `index`, `check`, `fill`. A row with `group` is a group heading; `struck: true` strikes the row.

### The printouts (27)

| Template (`docs/design/printouts/`) | Opens from | Page | Sections and fields | Wired by |
|---|---|---|---|---|
| `personnel-dossier.hbs` | Ratings, a rating's record, *Print Dossier* | portrait | photo and identity; 1 Basic, 2 Contact, 3 Health, 4 Service (facts); 5 Next of Kin, 6 Spouse and Children, 7 Advancement, 8 Drafting, 9 Training and Education, 10 Languages (tables) | WP13 |
| `rating-report.hbs` | Current Ratings, a row's *Print Report* (one tab: Advancement, Drafting, Training, Education) | portrait | the rating's facts, the tab's table (shown: Drafting) | WP13 |
| `ratings-list.hbs` | Current and Former Ratings, *Export PDF* / *Print Report* | landscape | totals strip, filters, S/N, official no, name, rate, ship, branch, command (Former: exit type and date) | WP13 |
| `static-table-list.hbs` | every Static Tables page, *Print List* | landscape over four columns, else portrait (`orientation` in the data) | list, search, status, then the table's columns and Active | WP13 |
| `disciplinary-pending-cases.hbs` | Pending Cases, *Print List* | landscape | count, offence, search; case, official no, name, ship, offence, incident, what happened, reported by; signatures | WP13 |
| `disciplinary-report.hbs` | Disciplinary Report, *Print PDF* | landscape | the six filters; case ... authority; signatures | WP13 |
| `disciplinary-case-sheet.hbs` | a case's dialog, *Print Case* | portrait | rating, case, decision, corrections; three signatures | WP13 |
| `manning-requirement-report.hbs` | Manning Requirement, *Print* | portrait | ship groups; rate, specialisation, required, aboard, difference; totals row | WP7a |
| `draft-form.hbs` | Review/Print Draft, *Print Draft Form* | landscape | batch facts; ratings with proposed ship, vice, remark; not-recommended lines struck; signatures | WP7a |
| `draft-batch-summary.hbs` | Review/Print Draft, *Print List* | portrait | batches; signal code, batch, branch, rate, status, total, reported, closed; totals | WP7a |
| `draft-report-batch.hbs` | a closed draft batch, *Print Report* | landscape | batch facts; official no, name, rate, old and new ship, vice, date reported; signatures | WP7a |
| `draft-report-all.hbs` | Draft Report, *Print PDF* | landscape | filters; batch, name, rate, official no, present ship, authority, proposed ship, vice, WEF | WP7b |
| `draft-history.hbs` | a rating's Draft History, *Print* | portrait | rating; batch, authority, old ship, new ship, date reported | WP7b |
| `training-draft-report.hbs` | Training Drafting, a batch's *Print Report* | portrait | batch facts; official no, name, rate, previous course, from, to; signatures | WP6 |
| `advancement-form.hbs` | Advancement Processing, *Print Advancement Form* | portrait | batch facts; in-rate months, new rate, remarks, not-recommended lines struck; signatures | WP8 |
| `advancement-batch-summary.hbs` | Advancement batches, *Print List* | portrait | batches; signal code ... promoted, closed; totals | WP8 |
| `advancement-report.hbs` | a closed advancement batch, *Print Report* | portrait | batch facts; official no, name, old rate, new rate, date advanced; signatures | WP8 |
| `personnel-details.hbs` | Print Service Details | portrait | official no, names, date of birth, telephone; rate history; signatures | WP5 |
| `re-engagement-verification.hbs` | Verification Forms (and the Discharge Report's dialog) | portrait | particulars, a verified tick per line; three signatures. D2's content until the owner supplies the real form | WP5 |
| `retirement-routine.hbs` | Verification Forms | portrait | particulars, clearance table (section, tick, cleared by, date); three signatures. D2's content until the real form | WP5 |
| `engagement-form.hbs` | Verification Forms | portrait | particulars, engagement history; three signatures. D2's content until the real form | WP5 |
| `discharge-report.hbs` | Discharge Report, *Print PDF* | landscape | filters; official no ... approved by; signatures | WP5 |
| `ratings-report-all.hbs` | Reports, All Personnel, *Print PDF* | landscape | filters, count; official no ... date joined; signatures | WP9 |
| `disposition-report.hbs` | Reports, Disposition, *Print PDF* | landscape | area office; ships as groups; official no ... WEF; signatures | WP9 |
| `special-draft-form.hbs` | Special Draft Report, *Preview Draft Form* / *Reprint Form* | landscape | form no, posting type (TY, DW as codes), date; ratings with drafted-to, vice, authority, WEF (scheduled marked); signatures | WP11 |
| `special-draft-letter.hbs` | a draft's dialog, *Draft Letter* | portrait | a letter for one rating, the draft's table; indicative layout | WP11 |
| `report-on-appraisal.hbs` | Report on Appraisal, *Print PDF* | landscape | filters; grade counts for both grades; the list; signatures | WP12 |

The Ship History Report stays an Excel workbook. Posting types TY and DW stay as codes. The three verification forms keep D2's content until the owner supplies the real forms.
