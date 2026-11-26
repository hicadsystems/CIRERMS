# Open questions

Every question still open on CIRERMS, in one place, written 26/11/2026 from `docs/PLAN.md` (section 9 and its
decision sections), the report notes in `docs/reports/`, `docs/ADMIN.md` and the hand-off notes in `docs/legacy/`.
A question the plan or a later report note has answered is not here; the decision sections of `docs/PLAN.md` (9a to 9e)
are the record of those.

Until a question is answered the app runs on a stand-in, named under it. Every stand-in number for a due rule is a
setting in the database (the `settings` table, read through `src/shared/settings`), so the real value is entered
later without a code change.

## For Hicad

### H1. Who is due for a draft
- **Asked:** the real rule for who is due for a draft: months on the current ship (and whether sea and shore time
  count differently), by rate group and branch, and which service states and exit types are left out.
- **Why:** the rule lived in the old system's SQL Server procedures and views, which exist nowhere we can reach
  (`docs/legacy/README.md`). The owner has no access to the live server.
- **Used in:** Drafting, Print Draft Proposal (who is due) and its months-on-ship pill.
- **Meanwhile:** a stand-in: due from 10 months on the ship, green to 20, amber to 24, red over 24. Settings
  `drafting.due_months`, `drafting.band_green_to`, `drafting.band_amber_to`.
- **Who answers:** whoever at Hicad keeps the live system: in plain words, or as a schema-only script read once in a
  container and never kept in the repository.

### H2. Who is due for advancement
- **Asked:** the real rule for who is due for the next rate (time in rate and any other conditions), and whether
  the appraisal grades (Naval Character Assessment) count. The old code does not read them, but the view that decides
  who is due is missing, so a hidden join cannot be ruled out (`docs/legacy/open-questions.md` 3).
- **Why:** a wrong rule puts the wrong ratings in front of the board.
- **Used in:** Advancement Processing, Rates due for Advancement; Create Advancement Batch.
- **Meanwhile:** a stand-in: due from 48 months in the rate, green to 50, amber to 54, red over 54; the next rate
  only; no appraisal grade is read (a rule would go in `dueWhere` in `advancement.repo.js`, its number in `settings`).
  Settings `advancement.due_months`, `advancement.band_green_to`, `advancement.band_amber_to`.
- **Who answers:** Hicad.

### H3. Who is eligible for a training course
- **Asked:** the real rule for who may be put forward for a course (length of service, time since the last course,
  branch, department, rate).
- **Why:** it lived only in the missing procedure `migratefromTrainingHisToTrainingDraftTex`
  (`docs/legacy/training-drafting.md`).
- **Used in:** Training Drafting, Process Training Draft (New Training Batch and the eligible list).
- **Meanwhile:** current ratings that match the course's branch or specialisation (and its rates, if it has any),
  not already in an open batch for that course. The course's own fields in Static Tables, Training carry the
  stand-in.
- **Who answers:** Hicad.

### H4. Who is due for discharge
- **Asked:** the real rule: age, length of service, and what makes a rating "due" in the old `dischargeproposal` view.
- **Why:** the missing view held it.
- **Used in:** Discharge Administration, Process Discharge (Due for Discharge, its colour pills); Reports, Retirement
  Forecast (it reads the same rule).
- **Meanwhile:** a stand-in: due at age 50 or 20 years of service; the bands 50, 55, 60 (age) and 20, 30, 35
  (service). Settings `discharge.age_due`, `discharge.age_band_1` to `3`, `discharge.service_due`,
  `discharge.service_band_1` to `3`.
- **Who answers:** Hicad.

### H5. What the posting types TY and DW stand for
- **Asked:** the meaning of the posting types **TY** and **DW** (the other two are Complement and Vice), and whether
  the list is complete.
- **Why:** the owner does not know; the old code only passes them on to the missing procedure
  `performOperationForSpecialDraft`.
- **Used in:** Special Drafting, Special Draft Proposal (Posting Type), Special Draft Report (one form per type),
  Upload Draft.
- **Meanwhile:** they stay as codes on the screens, the forms and the upload (`POSTING_TYPES` in
  `special-drafting.service.js`).
- **Who answers:** Hicad.

### H6. The real verification forms and the special draft letter
- **Asked:** copies of the real **Re-engagement Verification**, **Retirement Routine** and **Engagement Form**, and
  of the **Special Draft Letter**.
- **Why:** the old reports are binary Crystal files that cannot be read, so the layouts were designed from the
  fields the old code fills in.
- **Used in:** Discharge Administration, Verification Forms; Special Drafting, Draft Letter.
- **Meanwhile:** the indicative layouts of D2 and D4 (templates `re-engagement-verification`, `retirement-routine`,
  `engagement-form`, `special-draft-letter` in `src/templates/printouts/`). The owner said copies should come
  before Discharge was built; none has arrived.
- **Who answers:** Hicad (the owner passes the copies on).

### H7. The discharge upload template
- **Asked:** is the demo's template right? The old repository lacks the file.
- **Why:** it was designed from the fields the old import reads: official number, exit type, exit date, authority,
  approved by, comment.
- **Used in:** Discharge Administration, Upload Discharge.
- **Meanwhile:** that template, keyed by official number.
- **Who answers:** Hicad.

### H8. A schema-only copy of the live database
- **Asked:** if possible, a copy of the old live database's structure with its lookup rows (not one personnel
  record): it would settle H1 to H4 at once, and give the real exit-type codes (which of A, M, C keep a rating
  current), the Excel upload layouts and the real values of ranks, ships, branches, states and commands.
- **Why:** the 2017 backup is an older, different database (`docs/legacy/README.md`); the lookup values the import
  needs are in none of the files we have.
- **Used in:** every module that reads a lookup (Ratings Management, Static Tables) and the later import.
- **Meanwhile:** realistic stand-in values are seeded. Real records are never needed and must never be committed.
- **Who answers:** Hicad.

### H9. The old system's database passwords
- **Asked:** are the passwords in the old repository's `hpproject/Web.config` still in use? If so they should be
  changed.
- **Why:** they are in plain text in a repository others can read. They were never copied here.
- **Used in:** nowhere in CIRERMS.
- **Meanwhile:** nothing; told to the owner.
- **Who answers:** Hicad.

## For the owner

### O1. Should Training Reports open a batch on its own page?
- **Asked:** the design demo draws a batch as its own page with Export Excel; the built Reports tab opens it in a
  dialog, because the wide-table rule says a row opens a dialog.
- **Why:** one of the two is wrong for the owner; the demo and the rule disagree (WP6 report note, WP10's list of
  differences).
- **Used in:** Training Drafting, Reports.
- **Meanwhile:** the dialog.
- **Who answers:** the owner.

### O2. What to carry over when the real records are imported (the later phase)
- **Asked:** which data with no counterpart in the new tables is kept: spouse, children and next-of-kin addresses
  and children's dates of birth, the drafting authority (`signal`), the promotion rank code, passport, BVN and
  commission data. If any is kept, columns are added first; if not, the loss is recorded. Also: how rows with a
  missing or duplicate official number, or with blanks where the new tables demand a value, are reported rather
  than dropped; how photos (files on the old web server) and documents (an external document server) are moved;
  and that imported users need a new password, because the old hashes cannot be used.
- **Why:** the new tables are settled by now and the import is the next phase after this one
  (`docs/legacy/ratings.md`, `docs/legacy/system-admin.md` hand-off notes; `docs/PLAN.md` section 1).
- **Used in:** Ratings Management (the record), System Administration (accounts); nothing yet.
- **Meanwhile:** nothing is imported; the demo uses synthetic ratings.
- **Who answers:** the owner, with Hicad for the old data (H8).

### O3. How much to test before real use
Never checked, in any report note. None of it blocks the demo; the owner decides what is tried before the app holds
real data.
- **MariaDB** (the SQL is meant to be portable; only MySQL 8 was run).
- **The Docker image** (`apk add chromium` on Alpine) and **Chromium on a bare shared host**: only tried in a
  development container.
- **The scheduled changes past a real midnight** (the hourly run was tried with a future date, not left running),
  and **a server and database in different time zones** near midnight.
- **Two people acting at once** on the same batch, close, date entry, print or upload: rows are locked and keys are
  unique, but no concurrent test was run.
- **Large data:** the demo has about 127 ratings; the 2,000-row upload caps, the 3,000 and 50,000 report limits and a
  dossier with a very long record were never exercised.
- **Paper and other browsers:** printing on paper, the PDF preview in browsers other than headless Chromium, and a
  real phone (only Playwright's emulation was used); Excel files were read back by code, not opened in Excel.
- **The dashboard's "this year" tiles** count by calendar year and the demo data is dated around the seed date, so a
  January seed reads lower.
- **Who answers:** the owner.

### O4. Phone tab chips are 36 px tall, not 44
- **Asked:** should the record's tab chips on a phone be made 44 px tall (the usual touch size)?
- **Why:** left as it was when the fluid type scale was built (T1 report, `docs/PLAN.md` status table).
- **Used in:** Ratings Management, the rating's record on a phone.
- **Meanwhile:** 36 px.
- **Who answers:** the owner.
