# Open questions

Every question still open on CIRERMS, in one place, written 26/11/2026 (H1 to H9 brought up to date 27/11/2026 from the live schema script, below) from `docs/PLAN.md` (section 9 and its
decision sections), the report notes in `docs/reports/`, `docs/ADMIN.md` and the hand-off notes in `docs/legacy/`.
A question the plan or a later report note has answered is not here; the decision sections of `docs/PLAN.md` (9a to 9e)
are the record of those.

Until a question is answered the app runs on a stand-in, named under it. Every stand-in number for a due rule is a
setting in the database (the `settings` table, read through `src/shared/settings`), so the real value is entered
later without a code change.

## What the live schema script answered (27/11/2026)

On 27/11/2026 the owner sent a **schema-only script of the live database** (`HicadHRProject1`, scripted that day: 131
tables, 35 views, 77 procedures, 1 function, and not one record). It was read once in the administrator's container
and is **not kept in this repository** (PLAN rule 10). Only its rules are written here, in plain words.

| Question | Answered? | What the live system does |
|---|---|---|
| H1 Draft | **Yes** | Due when the current posting (the employment-history row with no end date) has lasted **18 months or more**, counted in whole months from its start date. One number for everyone: no rate, branch or sea/shore difference, and no exit type left out by the rule itself. CIRERMS's stand-in is 10 months, which is **wrong** |
| H2 Advancement | **Yes** | Due after **48 months from the rating's seniority date**. No appraisal grade or any other table is read, so Naval Character Assessment does not count. CIRERMS's 48 is right; check that it counts from the seniority date |
| H3 Training | **Yes** | No time rule at all. The person picks a course, rate, branch and specialisation; every rating who matches all three is listed, with their last course (the latest training-history row) and length of service (years since the commission date). Nothing excludes someone recently trained or already in a batch |
| H4 Discharge | **Yes** | Due when **age is 50 or more**, or **20 or more years since the date employed**, or the rating has a **re-engagement date of today or later** and has not left (so every re-engaged rating is listed, whatever their age). The live rule leaves out a rating already in a waiting discharge proposal only for the age case, an operator-precedence fault: CIRERMS ports the intent and leaves them out in every case. CIRERMS's 50 and 20 are right. CIRERMS does the opposite for re-engaged ratings: it leaves them off the list until their re-engagement ends (the owner, 27/11/2026: CIRERMS's way stays) |
| H5 TY and DW | **No** | The live tables and procedures never mention a posting type; the special-draft table has no such column. Still open |
| H6 Forms | **No** | Crystal Reports layouts are not in a database script. Still open |
| H7 Discharge upload | **Mostly** | The live upload takes, per row: name, title (rank), sex, official number, present ship, date of joining, authority, exit type (by its description), comment, entry mode, exit date, re-engagement date, approved by. CIRERMS's template keeps the fields that decide the discharge; entry mode and the re-engagement date are the two it lacks |
| H8 Schema copy | **Half** | The structure is here (every table, column and upload layout: `tbl_Person`, `tbl_DraftUpload`, `tbl_Trainingupload`, `tbl_advancementUpload`, `tbl_uploadexceltodischarge`). The lookup rows are not, because the script has no data. A rating is **current** when its exit type id is **1 or 7**; any other exit type is former. Which names ids 1 and 7 carry needs the lookup rows |
| H9 Passwords | **No** | Not in a database script. Still open |

**Decision (owner, 27/11/2026):** keep CIRERMS's discharge and training rules. Every answer is applied as a setting or by a package, not by editing data: `drafting.due_months` becomes 18 (System Administration > Settings), and nothing else: the owner (27/11/2026) keeps CIRERMS's own rules where they differ from the live ones, for discharge (a re-engaged rating is not listed until the re-engagement ends) and training (the course's own branch, specialisation and rates, and nobody already in an open batch for it), as more sensible. Advancement needs no change: the live system moves the seniority date to the board date on each promotion, and CIRERMS counts from the latest promotion of the current rate, which is the same date. The drafting colour bands (green to 20, amber to 24) are the old system's own and stay.

## For Hicad

### H1. Who is due for a draft
**Answered 27/11/2026** by the live schema script: 18 months on the current posting, the same for everyone. Set `drafting.due_months` to 18; the bands 20 and 24 stay (the old system's own).
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
**Answered 27/11/2026** by the live schema script: 48 months from the seniority date, which the live system moves to the board date on each promotion; no appraisal grade is read. CIRERMS already does this; no change.
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
**Answered 27/11/2026** by the live schema script: everyone of the chosen rate, branch and specialisation, with no time rule. The owner keeps CIRERMS's stricter rule (the course's own branch, specialisation and rates; nobody already in an open batch for it).
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
**Answered 27/11/2026** by the live schema script: age 50, or 20 years since joining, or any re-engaged rating. CIRERMS's 50 and 20 match; the owner keeps CIRERMS's handling of re-engaged ratings (not listed until the re-engagement ends).
- **Asked:** the real rule: age, length of service, and what makes a rating "due" in the old `dischargeproposal` view.
- **Why:** the missing view held it.
- **Used in:** Discharge Administration, Process Discharge (Due for Discharge, its colour pills); Reports, Retirement
  Forecast (it reads the same rule).
- **Meanwhile:** a stand-in: due at age 50 or 20 years of service; the bands 50, 55, 60 (age) and 20, 30, 35
  (service). Settings `discharge.age_due`, `discharge.age_band_1` to `3`, `discharge.service_due`,
  `discharge.service_band_1` to `3`.
- **Who answers:** Hicad.

### H5. What the posting types TY and DW stand for
**Still open** after the live schema script (27/11/2026): it never mentions a posting type.
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
**Still open** after the live schema script (27/11/2026): report layouts are not in a database.
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
**Mostly answered 27/11/2026** by the live schema script: the live upload's columns are listed in the table above; CIRERMS lacks only entry mode and the re-engagement date.
- **Asked:** is the demo's template right? The old repository lacks the file.
- **Why:** it was designed from the fields the old import reads: official number, exit type, exit date, authority,
  approved by, comment.
- **Used in:** Discharge Administration, Upload Discharge.
- **Meanwhile:** that template, keyed by official number.
- **Who answers:** Hicad.

### H8. A schema-only copy of the live database
**Half answered 27/11/2026:** the structure arrived (the table above); the lookup rows come with the data later. Current means exit type id 1 or 7.
- **Asked:** if possible, a copy of the old live database's structure with its lookup rows (not one personnel
  record): it would settle H1 to H4 at once, and give the real exit-type codes (which of A, M, C keep a rating
  current), the Excel upload layouts and the real values of ranks, ships, branches, states and commands.
- **Why:** the 2017 backup is an older, different database (`docs/legacy/README.md`); the lookup values the import
  needs are in none of the files we have.
- **Used in:** every module that reads a lookup (Ratings Management, Static Tables) and the later import.
- **Meanwhile:** realistic stand-in values are seeded. Real records are never needed and must never be committed.
- **Who answers:** Hicad.

### H9. The old system's database passwords
**Still open** after the live schema script (27/11/2026).
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
