# Wave F: Discharge Administration and Advancement Processing

> **Done and merged (WP8 on 19/11/2026, WP5 on 20/11/2026). Do not start this again.** It stays here as the record of how it was briefed; the plan's status table (`docs/PLAN.md` section 8) and the report notes in `docs/reports/` say what was built.

Two packages that can run at the same time, by two developers. WP5 can start as soon as WP13 is merged; WP8 waits
for WP7a, whose batch, approval and close parts it reuses.

Read `docs/waves/README.md` first: its rules, checks and report note are binding. Ratings are picked with the
rating search select; printouts are Handlebars templates rendered by WP13's Chromium renderer (`renderPdf`) and open in the app's preview; details are label and
value rows. Who is due is not known yet: use the placeholder rules below and keep their numbers as settings in the
database.

---

## WP5 `discharge`: Discharge Administration

- **Branch:** `discharge` · **Needs merged first:** WP13
- **AI session:** Sonnet 5.5, effort high · **Size:** M · **Migration block:** `05` · **Seed:** `009_discharge.sql`

### Read first
- `docs/PLAN.md`: sections 3, 4 (the Discharge Administration row), 5 (row WP5), 9 and **9b** (decisions 4 to 8
  and "D2's questions, answered").
- `docs/legacy/discharge.md` in full (sections 0.2 and 0.3: what discharging did to the rating).
- The design: `docs/design/demo.html` (Discharge Administration: `discharge/process`, `service`, `forms`, `report`,
  `upload`) and `docs/design/README.md`, D2 section ("Discharge Administration", "Printouts", "Decisions").
- What earlier packages left: `ratings.status` (current or former), `exit_type_id`, `exit_date`, `exit_reason`;
  the Exit Type table with `keeps_current` and `is_death` (in `/api/lookups` as `keepsCurrent` and `isDeath`); the
  disciplinary cases (`discipline_cases`, status `pending`); the rating's postings (`rating_drafting`).

### Build (as the demo shows, five pages)
1. **Tables**: proposals (number `DIS-YYYY-NNNN`, proposed by and when) and one discharge row per rating (state
   pending or closed, exit type, exit date, reason up to 100 characters, approved by, comment, the four death
   documents as true or false, closed by and when); re-engagements in their own table (date, months, until, approved
   by), because a re-engagement is not a discharge (decision 5).
2. **Process Discharge**: the due list (read only; placeholder rule: age 50 or more, or 20 years of service or
   more; pills for age 50, 55, 60 and service 20, 30, 35; nothing explains the colours; leaves out re-engaged and
   closed ratings); **Create Proposal** in a confirming dialog (writes only on confirm); a proposal's ratings, each
   with its dialog: **Process** (exit type from the types that do not keep a rating current, exit date, reason,
   approved by, comment, the death documents only for an exit type marked Death and never enforced, status Pending
   or Closed, with a confirmation that Closed is final), **Re-engage**, **Remove**; Add Rating (rating search
   select). A **warning** when the rating has a pending disciplinary case; nothing blocks (decision 7).
3. **Closing**: with an exit date today or earlier, in one transaction the rating becomes Former (status, exit
   type, exit date, exit reason), its open posting ends, and **its user account, if it has one, is deactivated**
   (its sessions end); a future exit date is Scheduled and takes effect on that date (use the same mechanism WP7a
   chose for a scheduled WEF). Age and length of service are worked out on the server.
4. **Print Service Details**: find a current or former rating; the Personnel Details printout.
5. **Verification Forms**: find a rating; Re-engagement Verification (needs a re-engagement), Retirement Routine
   (needs a discharge row), Engagement Form (always); each a printout, off with the reason when its source is
   missing. Their layouts are D2's until the owner supplies the real forms.
6. **Discharge Report**: filters (dates, exit type incl. re-engagements, rate, branch); figures; the list (closed
   discharges and re-engagements; Scheduled shown as such); **Print PDF** and **Export Excel** from one query.
7. **Upload Discharge**: template keyed by Official No (Official No, Exit Type, Exit Date, Authority, Approved By,
   Comment), the whole file read first, problem rows listed with row number, ratings already in a proposal or
   already discharged skipped, the rest in one transaction.
8. Privileges per page (edit on Process), grants in your seed (the old role was "Discharge"); Discharge
   Administration loses Soon; Ctrl K; demo data on every page; `README.md` and `CONVENTIONS.md`.

### Check
Your `tests/e2e/discharge-walkthrough.js` (within 5 minutes: propose, process, close, the rating in Former Ratings
and its account deactivated, a scheduled close, re-engage, the refusals, every printout, the upload states) and
every existing walkthrough, each on a fresh database. Look at every page at 1440 and 390 px, light and dark.

### Report
`docs/reports/WP5.md` on your branch, then tell the owner (or `send_message` to the administrator session).

---

## WP8 `advancement`: Advancement Processing

- **Branch:** `advancement` · **Needs merged first:** WP7a (it reuses WP7a's batch, approval and close parts)
- **AI session:** Opus 5.5, effort high · **Size:** L · **Migration block:** `08` · **Seed:** `010_advancement.sql`

### Read first
- `docs/PLAN.md`: sections 3, 4 (the Advancement Processing row), 5 (row WP8), 9 and 9a (decisions 2, 3, 5, 7).
- `docs/legacy/advancement.md` in full.
- The design: `docs/design/demo.html` (Advancement Processing: `advancement/due`, `review`, `approval`, `close`,
  `board`, `promoted`, `upload`) and `docs/design/README.md`, D1 section, "Advancement Processing" and "What is
  common".
- WP7a's report note (`docs/reports/WP7a.md`) and code: the batch tables and parts, the approval per department,
  the close, the settings for the due rules, the user's specialisation scope. Reuse them rather than copying.

### Build (as the demo shows, seven pages)
1. **Rates due for Advancement**: Branch, Specialisation, Current Rate (each with All); the due list (read only;
   placeholder rule: 48 months or more in the current rate and not already in the top rate; months in rate as a
   pill, 48 to 50 green, 51 to 54 amber, over 54 red, under 48 neutral); **Create Advancement Batch** in a
   confirming dialog, number `DOA-<branch code><specialisation code><rate code>-NNNNNN`.
2. **Advancement Review**: open batches; progress (n of m have a new rate); a row's dialog: **Set New Rate** (the
   next rate in rank order only, no choice; optional Remarks), **Not Recommended** (a required reason; struck out,
   on the Advancement Form too, back on the due list next time), Remove; Add Personnel (rating search select);
   **Print Form** (Advancement Form), Export Excel, Clear Batch (confirmed).
3. **Approval**: as Draft Approval, with totals by new rate; the approve privilege.
4. **Close**: as Close Draft: one batch, fully approved, a new authority, the close date.
5. **Board Returns Update**: closed batches; **Set Date** per row and **Set Date for Batch** (leaves dates already
   entered; says how many); the date not in the future and not before the rating joined its current rate; saving
   **applies the new rate** from that date (the rating's rate changes and its Advancement tab gets the line).
6. **Report on Promoted Rates**: filters (branch, rate, signal code, batch number) that work; the batch list with
   total and promoted; Print Batch Summary; a batch's ratings with Print Advancement Report; an unreached date shows
   "Pending".
7. **Upload Advanced Rates**: template (Official No, Old Rate, New Rate, Effective Date, Authority, Decoration,
   Remark); checks: the official number, the old rate is the rating's rate, the new rate is above it, the date,
   duplicates (the same promotion twice skipped); importing applies the rate and adds the line.
8. Eligibility does not read appraisal grades or disciplinary cases (unknown rules); a rating's pending cases may be
   shown as information only.
9. Privileges per page (approve on Approval), grants in your seed (the old role was "Advancement"); Advancement
   Processing loses Soon; Ctrl K; demo data on every page; `README.md` and `CONVENTIONS.md`.

### Check
Your `tests/e2e/advancement-walkthrough.js` (within 5 minutes: the whole cycle to a board date that changes the
rate, Not Recommended, the refusals, the upload states, the printouts) and every existing walkthrough, each on a
fresh database. Look at every page at 1440 and 390 px, light and dark.

### Report
`docs/reports/WP8.md` on your branch, then tell the owner (or `send_message` to the administrator session).
