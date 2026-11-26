# Wave H: Demo Finish

> **Done and merged (WP10 on 23/11/2026). Do not start this again.** It stays here as the record of how it was briefed; the plan's status table (`docs/PLAN.md` section 8) and the report notes in `docs/reports/` say what was built.

The last package of Phase 1. It starts when every other package is merged, and ends with the demo complete: every
module works end to end on demo data and matches the approved design.

Read `docs/waves/README.md` first: its rules, checks and report note are binding.

---

## WP10 `demo-finish`

- **Branch:** `demo-finish` · **Needs merged first:** every package above (WP13, WP6, WP7a, WP5, WP8, WP12, WP11,
  WP7b, WP9)
- **AI session:** Sonnet 5.5, effort medium · **Size:** M · **Migration block:** `10` (only if you need one) ·
  **Seed:** `015_demo_finish.sql` (only if you need one)

### Read first
- `docs/PLAN.md` in full, above all sections 1, 3, 4, 8 (status) and 9 (open questions).
- Every report note in `docs/reports/` (what each package left, and its "For the next packages").
- `docs/design/demo.html` and `docs/design/README.md` in full.

### Do
1. **Dashboard tiles live**: Members, Drafting (reported this year, open batches), Disciplinary (pending, concluded
   this year), Discharge (this year, proposed), Appraisals (this month, open periods), as the demo shows them, from
   the real tables.
2. **Ctrl K** reaches every screen of every module, and ratings by official number or name.
3. **Demo data across every module**, believable and consistent: every page has something to show; names in
   capitals everywhere (for example B0575's middle name is stored in lower case today); every demo account belongs
   to a rating.
4. **Compare the app with the demo**, page by page: same pages, steps, fields, labels and order; list every
   difference you fix and every one you leave (with the reason) in your report. The rules that win over the demo
   (wide tables, label and value rows, the rating search select, the PDF preview, the fluid type scale) stay.
5. **One smoke walkthrough of the whole app**, `tests/e2e/demo-walkthrough.js`, within 5 minutes: sign in, open
   every page of every module at desktop light and phone dark, open each page's main dialog, no browser errors, no
   sideways scrolling. Every other walkthrough still passes, each on a fresh database.
6. **Settle** the open item noted by WP3: when a rating's official number changes, the account's user name must
   follow it (the user name is the official number).
7. **Docs up to date**: `README.md` (what the app does, how to run it, the demo accounts), `CONVENTIONS.md`,
   `docs/design/README.md` ("what is built"), and the open questions in `docs/PLAN.md` section 9 restated in one
   list for Hicad (the due rules, the posting types TY and DW, the verification forms).

### Report
`docs/reports/WP10.md` on your branch, then tell the owner (or `send_message` to the administrator session).
