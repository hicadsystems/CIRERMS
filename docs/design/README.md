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
**Advancement Processing**; Special Drafting and Naval Character Assessment stay *Soon*. The old rules and fields
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
