# Open questions for Hicad

The questions the demo could not settle, restated in one list (they come from `docs/PLAN.md` section 9 and the
report notes in `docs/reports/`). Until they are answered the demo uses the placeholders named here, and every
placeholder number is a setting in the database (the `settings` table, read through `src/shared/settings`), so the
real value is entered later without a code change.

## 1. Who is due (the most important)

The rules lived in the old system's SQL Server procedures and views, which we do not have. Please give them in plain
words (or as a schema-only script, which is read once and never kept in the repository):

| For | What the demo does now (placeholder) | Settings |
|---|---|---|
| **Draft** (who is due for a draft) | months on the current ship: due from 10, green to 20, amber to 24, red over 24 | `drafting.due_months`, `drafting.band_green_to`, `drafting.band_amber_to` |
| **Advancement** (who is due for the next rate) | months in the rate: due from 48, green to 50, amber to 54, red over 54; the next rate only; appraisal grades are not read | `advancement.due_months`, `advancement.band_green_to`, `advancement.band_amber_to` |
| **Training drafting** (who is eligible for a course) | current ratings matching the course's branch or specialisation (and its rates, if set), not already in an open batch for it | the course's own fields in Static Tables, Training |
| **Discharge** (who is due) | age 50 or 20 years of service; the bands 50, 55, 60 (age) and 20, 30, 35 (service) | `discharge.age_due`, `discharge.age_band_1` to `3`, `discharge.service_due`, `discharge.service_band_1` to `3` |

Also: whether an advancement should read the appraisal grades (Naval Character Assessment); where the old system
applied the new rate when an advancement was closed (the demo applies it on the board date).

## 2. The posting types TY and DW

Special Drafting's Posting Type is Complement, Vice, **TY** and **DW**. The owner does not know what TY and DW stand
for; they stay as codes on the screens, the forms and the upload until Hicad says.

## 3. The three discharge verification forms

Copies of the real **Re-engagement Verification**, **Retirement Routine** and **Engagement Form** are needed. The
demo prints the layouts designed from the old fields (D2/D4). The **special draft letter** is also an indicative
layout until the real letter is supplied.

## 4. Smaller points

- The discharge upload template is missing from the old repository: the demo's template is designed from the fields the
  old import reads (official number, exit type, exit date, authority, approved by, comment). Is it right?
- The old live database: if Hicad can give a schema-only copy, the due rules, the old Excel upload layouts and the
  real lookup values (ranks, ships, branches, states) can be checked against it. Real records are never needed and
  must never be committed.
- The old repository's `hpproject/Web.config` holds database passwords in plain text. If they are still in use they
  should be changed; they were never copied here.
