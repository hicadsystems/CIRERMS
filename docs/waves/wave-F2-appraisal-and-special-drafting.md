# Wave F2: Naval Character Assessment and Special Drafting

Two packages that can run at the same time, by two developers. WP12 can start as soon as WP13 is merged; WP11
waits for WP7a, whose posting move it uses.

Read `docs/waves/README.md` first: its rules, checks and report note are binding. Ratings are picked with the
rating search select; printouts use WP13's shared layout and open in the app's preview; details are label and
value rows.

---

## WP12 `appraisal`: Naval Character Assessment

- **Branch:** `appraisal` · **Needs merged first:** WP13
- **AI session:** Sonnet 5.5, effort medium · **Size:** M · **Migration block:** `12` · **Seed:** `011_appraisal.sql`

### Read first
- `docs/PLAN.md`: sections 3, 4 (the Assessment of Naval Character row), 5 (row WP12), **9e** (decisions 5 to 8,
  and "D3's questions, answered" below it) and 10 (what is known of the module and the old page's faults).
- `docs/legacy/advancement.md` (its appraisal notes) and `docs/legacy/static-tables.md` section 1.
- The design: `docs/design/demo.html` (Naval Character Assessment: `assessment/grading`, `report`, `periods`; a
  rating's record, Advancement tab, the Appraisals list; the dashboard's Appraisals tile) and
  `docs/design/README.md`, D3 section.
- The grades: the Appraisal Ratings static table (`ref_appraisal_rating`: code, grade, lowest and highest score);
  `/api/lookups` key `appraisalRatings`.

### Build (as the demo shows, three pages)
1. **Appraisal Periods**: list; Add and Edit (name unique, start and end dates, periods never overlap); **Close
   Period** (confirmed; final: a closed period is read-only everywhere).
2. **Recommendation and Grading**: filters (official number or name with the rating search select, period, ship,
   rate, grade); **Initiate Appraisal** for a rating and an open period: Character grade and Efficiency grade
   (from the Appraisal Ratings table), remark, the CO's name (required), the director's name and date (optional,
   but together); the rating's rate and ship at the time are stored; one appraisal per rating per period (refused
   with the existing one named). **Edit** while the period is open (a changes list with before and after, in the
   audit trail); **Cancel** with a required reason (it leaves the lists; the rating may then be appraised again for
   that period); nothing is deleted outright.
3. **Report on Appraisal**: filters (period, ship, rate, branch, grade: either grade); three figures; the counts
   per grade for Character and Efficiency; the list; **Print PDF** (Report on Appraisal) and **Export Excel** from
   one query.
4. **The rating's record**: its appraisals as a list under the Advancement tab, seen only by someone who may view
   Recommendation and Grading; not on My Details; not counted in the record's completeness.
5. **Dashboard**: the Appraisals tile counts appraisals recorded this month and the open periods (it shows Soon
   today).
6. Privileges (add on Initiate, edit on Edit, delete on Cancel, add and edit on Periods), grants in your seed;
   Naval Character Assessment loses Soon; Ctrl K; demo data (periods open and closed, appraisals, an edited and a
   cancelled one); `README.md` and `CONVENTIONS.md`.

### Check
Your `tests/e2e/appraisal-walkthrough.js` (within 5 minutes) and every existing walkthrough, each on a fresh
database. Look at every page at 1440 and 390 px, light and dark.

### Report
`docs/reports/WP12.md` on your branch, then tell the owner (or `send_message` to the administrator session).

---

## WP11 `special-drafting`: Special Drafting

- **Branch:** `special-drafting` · **Needs merged first:** WP7a
- **AI session:** Sonnet 5.5, effort medium · **Size:** M · **Migration block:** `11` · **Seed:** `012_special_drafting.sql`

### Read first
- `docs/PLAN.md`: sections 3, 4 (the Special Drafting row), 5 (row WP11), 9a decision 4, **9e** (decisions 1 to 4
  and "D3's questions, answered") and 10 (the old pages and their faults).
- `docs/legacy/drafting.md` (special drafting and section 6, Upload Draft).
- The design: `docs/design/demo.html` (Special Drafting: `special/proposal`, `report`, `upload`) and
  `docs/design/README.md`, D3 section.
- WP7a's report note (`docs/reports/WP7a.md`) and its **posting move** service: a special draft moves the rating
  through it, never with its own code.

### Build (as the demo shows, three pages)
1. **Tables**: special drafts (rating, current ship and date joined it, months there, drafted to, authority, WEF,
   posting type, deployment or vice, remark, created by and when, form number once printed) and the forms (number
   `SDF-YYYY-NNNN`, posting type, printed by and when).
2. **Special Draft Proposal**: find a current rating (rating search select; no batch number needed); their current
   rate, branch, ship, date joined it and months there; the form: **Posting Type** (Complement, Vice, TY, DW, as
   codes: their meaning is not known), Drafted To, Authority, WEF, Deployment/Vice (required for Vice), Remark. A
   rating with an unprinted special draft cannot get a second one. The list of special drafts not yet printed: a
   row's dialog with **Remove** (confirmed; only before printing), **Draft Letter** (a one-rating printout; it marks
   nothing printed) and Open Record.
3. **Special Draft Report**: a Posting Type list with counts; the drafts of that type; **Preview Draft Form**;
   **Print and Mark Printed** (confirmed): the form gets its number, the drafts are marked printed and each rating
   is moved on its WEF through WP7a's posting move (a future WEF is Scheduled). A printed draft is final. **Printed
   Forms** list with **Reprint**. Who printed what goes in the audit trail.
4. **Upload Draft**: template keyed by Official No (Official No, Drafted To, Authority, WEF, Posting Type,
   Deployment/Vice, Remark); every row read first, problem rows and duplicates listed, the rest imported in one
   transaction as unprinted drafts.
5. Privileges (add on Proposal and Upload, edit on Print and Mark Printed), grants in your seed; Special Drafting
   loses Soon; Ctrl K; demo data; `README.md` and `CONVENTIONS.md`.

### Check
Your `tests/e2e/special-drafting-walkthrough.js` (within 5 minutes: a draft from proposal to printed form and the
record's move, a future WEF scheduled, the duplicate refusal, the upload states) and every existing walkthrough,
each on a fresh database. Look at every page at 1440 and 390 px, light and dark.

### Report
`docs/reports/WP11.md` on your branch, then tell the owner (or `send_message` to the administrator session).
