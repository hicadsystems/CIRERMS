# Wave E: Training Drafting and the Drafting Cycle

Two packages that can run at the same time, by two developers: WP6 builds Training Drafting, WP7a builds the
drafting cycle (the heart of Drafting, which WP7b, WP8, WP9 and WP11 build on). Both start once WP13 (the shared PDF
layout) is merged.

Read `docs/waves/README.md` first: its rules, checks and report note are binding.

Common to both:
- **Who is due is not known yet** (`docs/PLAN.md` section 9). Placeholder rules, with their numbers kept as settings
  in the database (a small settings table, or a settings row per rule, readable and changeable without a code
  change): due for draft at 10 months or more on the current ship; months on a ship shown as a coloured pill, 10 to
  20 green, 21 to 24 amber, over 24 red, under 10 neutral; nothing on screen explains the colours. Training takes
  the ratings a course is open to (below).
- **Batch numbers** keep the old shape: a code and a six-digit counter per code, as `docs/design/README.md` (D1
  section) shows.
- A list of who is due only reads. A batch is created only when a confirming dialog is confirmed, never on a
  search or a page load. A rating already in an open batch is shown with its batch and left out of a new one.
- Ratings are picked with the rating search select. Printouts use WP13's shared layout and open in the app's
  preview. Details are label and value rows.

---

## WP6 `training-drafting`: Training Drafting

- **Branch:** `training-drafting` · **Needs merged first:** WP13
- **AI session:** Sonnet 5.5, effort high · **Size:** M · **Migration block:** `06` · **Seed:** `007_training_drafting.sql`

### Read first
- `docs/PLAN.md`: sections 3, 4 (the Training Drafting row), 5 (row WP6), 9a (decisions 3, 6 and 7 above all).
- `docs/legacy/training-drafting.md` in full (the old pages, data, rules, faults not to copy).
- The design: `docs/design/demo.html` (Training Drafting in the sidebar: `training/process`, `review`, `history`,
  `reports`, `upload`) and `docs/design/README.md`, D1 section, "Training Drafting (5 pages)" and "What is common".
- What Static Tables left you: a Training course (`ref_training`: code, course, qualification, institution, weeks,
  branch, specialisation, and its rates in `ref_training_rate`; none means every rate), Institutions
  (`ref_institution`), and `/api/lookups` keys `trainingCourses` (with `rateIds`, `branchId`, `specialisationId`)
  and `institutions`. A rating's Training entry (`rating_training`) already has `training_course_id` and
  `institution_id`. Declare foreign keys for every link you add (the Static Tables in-use check reads them).

### Build (as the demo shows, five pages, with PLAN 9a)
1. **Process Training Draft**: the open training batches; **New Training Batch** in a two-step dialog (course and
   period, then the eligible ratings by branch, specialisation and rate with the count that match); **Add
   Ratings** to an open batch. Batch number `DOT-YYYY-MM-NN` (year, month with leading zero, course). A duplicate
   (same course, month and year) is refused, naming the batch it matches.
2. **Eligible** (decision 6): current ratings matching the course's branch or specialisation, and its rates if it
   sets them, not already in an open batch for that course. The dialog says so; adding an ineligible rating is
   refused with the reason.
3. **Training Review**: batch picker (open batches); the ratings with rate, length of service and last course
   ("First course" when none); Add Rating (rating search select), Add by Branch, Remove (confirmed).
4. **Update Training History**: the batch's ratings with an Attended box each; **Change Dates** in a rating's
   dialog (its own start and end date); **Confirm Training History** (institution, the batch's start and end dates,
   a result per attending rating: Distinction, Credit, Pass or Fail). Confirming adds a Training entry to each
   attending rating's record (with `training_course_id` and `institution_id`) and **closes the batch**; a rating
   not attending gets nothing. End date not before start and not in the future.
5. **Reports**: filters (training, month, year, batch number) that work; the batch list; a batch's ratings;
   **Print PDF** (the Training Draft Report as D4 designed it).
6. **Excel Upload**: Download Template (Official No, Course, Institution, Qualification, Start Date, End Date,
   Authority), Choose File, Review (every row read first; problem rows listed with row number, field and problem,
   skipped or error), Import (the rest in one transaction, with the count).
7. Privileges per page (view; add on Process; edit on Review and History; add on Upload), grants in your seed for
   roles other than Administrator (the old role was "Training"); Training Drafting loses Soon in the sidebar; Ctrl K
   finds its pages; demo data so every page has something (open, confirmed and closed batches).
8. `README.md` and `CONVENTIONS.md`: what was built.

### Check
Your `tests/e2e/training-drafting-walkthrough.js` (within 5 minutes) and every existing walkthrough, each on a fresh
database. Look at every page at 1440 and 390 px, light and dark.

### Report
`docs/reports/WP6.md` on your branch, then tell the owner (or `send_message` to the administrator session).

---

## WP7a `drafting-cycle`: the drafting cycle

- **Branch:** `drafting-cycle` · **Needs merged first:** WP13
- **AI session:** Opus 5.5, effort high · **Size:** L · **Migration block:** `07` · **Seed:** `008_drafting.sql`

### Read first
- `docs/PLAN.md`: sections 3, 4 (the Drafting row), 5 (row WP7a), 9 and 9a (decisions 1 to 5 and 7).
- `docs/legacy/drafting.md` in full, above all section 15 (the cycle) and sections 1 to 5 and 7.
- The design: `docs/design/demo.html` (Drafting in the sidebar: `drafting/manning`, `proposal`, `review`,
  `approval`, `close`, `wef`) and `docs/design/README.md`, D1 section, "Drafting" and "What is common". The other
  three Drafting pages (`batches`, `history`, `report`) are WP7b's; Upload Draft is Special Drafting's (WP11).
- What earlier packages left: the static tables with the codes the batch numbers need (`ref_branch.code`,
  `ref_specialisation.code`, `ref_rate.code`, rates in rank order by `sort_order`), ships with their command and
  type; `users.specialisation_id` (a drafting officer's department; not yet in the session user: add it in
  `auth.service` where the user is formatted); the rating's postings in `rating_drafting` and its current ship.

### Build (as the demo shows, six pages, with PLAN 9a)
1. **Tables**: the batches (number, code, filters, status open, approved or closed, initiated by and when, closed
   by and when, authority, close date) and their rows (rating, current ship and date joined it, months there,
   proposed ship, vice or deployment, remark, request, Not Recommended with its reason, approval per department,
   WEF and status Proposed, Awaiting WEF, Scheduled or Reported); a manning requirement table (ship, rate,
   specialisation, quantity); the settings for the due rules.
2. **One posting move**, as a service the other packages call (WP11 Special Drafting will): given a rating, a ship,
   a WEF and an authority, the open posting ends the day before the WEF and a new one starts on it, the record's
   Drafting tab shows it and the current ship follows; a WEF in the future is **Scheduled** and takes effect on its
   date (decide how: a daily task the server runs, or applying due moves when they are read; say which in your
   report).
3. **Update Manning Requirement**: filters (ship, rate, specialisation); Required, Aboard (current postings) and the
   difference; Add, Edit, Delete (confirmed); duplicate (ship, rate, specialisation) refused; quantity 1 to 99;
   Print (one ship or all: the Manning Requirement Report). Advisory only (decision 1).
4. **Print Draft Proposal**: Branch, Specialisation, Rate (each with All); the due list (read only; months on ship
   pill); **Create Draft Batch** in a confirming dialog with the batch number `DOD-<branch code><specialisation
   code><rate code>-NNNNNN`, the filters and the count; one rating is enough; an open batch for the same filters is
   added to.
5. **Review/Print Draft**: open batches; progress (n of m have a proposed ship); a row's dialog: **Edit Posting**
   (proposed ship, different from the current one; vice or deployment; remark), **Not Recommended** (a required
   reason; struck out, on the Draft Form too, back on the due list next time), Remove; **Add Personnel** (rating
   search select; refuses a rating in an open batch; saves the request: Medical, Special Requests, Others); the
   **Over by n / Under by n** pill per proposed ship against its manning requirement (advisory); **Print Draft**
   (the Draft Form), **Export Excel**, **Clear Draft** (confirmed).
6. **Draft Approval**: one row per department (specialisation) with totals by rate group (the rates in rank
   order; nothing hard-coded), status and approver; a row opens the department's list; **Approve Department**
   (rank, name, appointment; the approve privilege; refused while a rating has no proposed ship; approving again
   warns it replaces the earlier approval). A user with a specialisation sees only that department.
7. **Close Draft**: open batches with their readiness; **Close** one batch (every rating has a proposed ship, every
   department approved; authority new, naming the batch that used it; close date `dd/mm/yyyy`, not future, not
   before the batch began). Final: no reopen (decision 3).
8. **Update WEF**: closed batches with an authority (still waiting, or closed in the last 30 days); department
   filter; **Set WEF** per row and **Set WEF for Department** (only that batch's pending ratings, with the count);
   the date not before the authority date; saving moves the rating (item 2).
9. Privileges per page (approve on Draft Approval), grants in your seed (the old role was "Drafting"); Drafting
   loses Soon; Ctrl K finds its pages; demo data so every page has something (a batch at each stage).
10. `README.md` and `CONVENTIONS.md`: the cycle, the posting move, the settings.

### Check
Your `tests/e2e/drafting-walkthrough.js` (within 5 minutes: the whole cycle from proposal to a reported WEF, a
future WEF scheduled, Not Recommended, the refusals) and every existing walkthrough, each on a fresh database.
Look at every page at 1440 and 390 px, light and dark.

### Report
`docs/reports/WP7a.md` on your branch, then tell the owner (or `send_message` to the administrator session). Say
exactly how the posting move and the batch, approval and close parts can be reused: WP8 and WP11 build on them.
