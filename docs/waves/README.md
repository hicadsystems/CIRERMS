# CIRERMS: the remaining waves, for any developer

This folder hands out the work still to do in Phase 1 (`docs/PLAN.md`). Any developer can take a package: a
person, or an AI coding session working for one. Each wave has its own file with a full brief per package: what to
build, what to read first, the model and effort to use if you work with an AI session, the checks, and the report
note to leave. Read this page first, then your wave's file, then everything its brief lists under "Read first".

The administrator (who keeps `docs/PLAN.md`) inspects every branch before telling the owner it is ready to merge.
The owner merges on GitHub. Nobody else merges, and nobody opens pull requests.

## 1. The remaining waves

A package may start only when everything in its "Needs merged first" column is on `master`. Two packages in the
same wave do not depend on each other and can run at the same time, by two developers. Tell the owner which
package you take before you start, so two people never take the same one.

| Wave | File | Package | Branch | Needs merged first | Model · effort (AI session) | Size | Migration block | Seed file |
|---|---|---|---|---|---|---|---|---|
| P | `wave-P-printouts.md` | D4 PDF design: HTML templates (design only) | `design-printouts` | (all merged) | Sonnet 5.5 · medium | M | none | none |
| P | `wave-P-printouts.md` | WP13 PDFs by Chromium from the templates | `printouts` | D4 | Sonnet 5.5 · medium | M | `13` (if any) | none |
| E | `wave-E-training-and-drafting.md` | WP6 Training Drafting | `training-drafting` | WP13 | Sonnet 5.5 · high | M | `06` | `007_training_drafting.sql` |
| E | `wave-E-training-and-drafting.md` | WP7a Drafting Cycle | `drafting-cycle` | WP13 | Opus 5.5 · high | L | `07` | `008_drafting.sql` |
| F | `wave-F-discharge-and-advancement.md` | WP5 Discharge Administration | `discharge` | WP13 | Sonnet 5.5 · high | M | `05` | `009_discharge.sql` |
| F | `wave-F-discharge-and-advancement.md` | WP8 Advancement Processing | `advancement` | WP7a | Opus 5.5 · high | L | `08` | `010_advancement.sql` |
| F2 | `wave-F2-appraisal-and-special-drafting.md` | WP12 Naval Character Assessment | `appraisal` | WP13 | Sonnet 5.5 · medium | M | `12` | `011_appraisal.sql` |
| F2 | `wave-F2-appraisal-and-special-drafting.md` | WP11 Special Drafting | `special-drafting` | WP7a | Sonnet 5.5 · medium | M | `11` | `012_special_drafting.sql` |
| G | `wave-G-drafting-reports-and-reports.md` | WP7b Drafting Reports | `drafting-reports` | WP7a | Sonnet 5.5 · medium | M | `71` (if any) | `013_drafting_reports.sql` (if any) |
| G | `wave-G-drafting-reports-and-reports.md` | WP9 Reports | `reports` | WP7a | Sonnet 5.5 · medium | M | `09` (if any) | `014_reports.sql` (if any) |
| H | `wave-H-demo-finish.md` | WP10 Demo Finish | `demo-finish` | all of the above | Sonnet 5.5 · medium | M | `10` (if any) | `015_demo_finish.sql` (if any) |

The waves are an order, not a wall: WP5 and WP12 need only WP13, so they can start as soon as it is merged, even
before wave E finishes. WP8 waits for WP7a because it reuses the batch, approval and close parts WP7a builds.

"Model · effort" applies only if you work with an AI coding session: use that model and effort, give the session
this README and your wave's file as its brief, and make sure it follows the rules below.

## 2. Rules for everyone (binding)

The owner's rules, never to be broken:
1. **Your branch only.** Create the package's branch from the latest `master` and publish it at once
   (`git push -u origin <branch>`). Work only there. Never push to `master` or to another package's branch.
2. **No pull requests of any kind.** The owner opens and merges them.
3. **Nothing about the tools you used.** No mention of AI assistants, their makers or their models in commit
   messages, code, comments or documents, and no Co-Authored-By or session-link lines in commits.
4. **Commit author.** Everyone commits as the owner, people and AI sessions alike (the owner, 19/11/2026):
   `git config user.name swizfcodes` and `git config user.email 191121624+swizfcodes@users.noreply.github.com`
   (repository-local, set before the first commit).
5. **Never edit `public/js/core/choices.js`** (the owner's own component). Use it as it is.
6. Treat the owner's e-mail address and any personal data as private. Never copy the old system's passwords
   (`hpproject/Web.config` in the old repository holds some in plain text).

The project's rules (`docs/PLAN.md` section 3 and `CONVENTIONS.md` hold them in full):
- **Design first.** A build package makes the app match the approved design demo (`docs/design/demo.html`, built
  from `docs/design/demo-src.html`; `docs/design/README.md` explains every page). Anything the design lacks is
  raised in your report, not invented. Only design packages change `docs/design/`.
- **No stored procedures, functions, triggers or views**, in the database or the repository. Logic in the module's
  `*.service.js`, plain parameterised SQL in its `*.repo.js`.
- **Migrations** only in your package's block: `src/db/migrations/20261120_WW####_name.sql` with the block in the
  table above. Never edit a merged migration. Your seed file is the one in the table.
- **Modules** register from `src/modules/<m>/<m>.module.js` (key, label, basePath, routes, privileges). Every route
  is guarded with `requirePrivilege(screen, action)` (the server refuses to start with an unguarded route). Every
  write runs in `db.transaction` with `audit.record(tx, actor, {...})`. Pages go in `public/js/core/nav.js`
  `PAGES` with screen, action and view, and every button checks `can(screen, action)`. Grants for roles other
  than Administrator go in your seed file.
- **Every account belongs to a rating.** A user name is the rating's official number, one account per rating. A
  seed or test that makes an account makes or uses a rating for it.
- **Picking a rating** is always done with the rating search select (`ratingSearch` in `public/js/ui/`): at least
  2 characters, suggestions under the field by official number or name, 10 at a time from the server and the next
  10 on scroll, each shown as `B0539 — PO OKONKWO CHUKWUEMEKA IFEANYI`. Never a typed official number.
- **Details** read as label and value on one row with a divider (`facts` and `factPanels` in `public/js/ui/`),
  "N/A" when empty; never small capital labels stacked above values.
- **Wide tables never scroll sideways**: only the key columns show (about four), a row opens the full record in a
  dialog (a bottom sheet on a phone) holding the row's actions, a "View Details" tooltip on desktop, cards on a
  phone. 25 rows a page, paged by the server.
- **Every add and edit opens in a dialog** (a bottom sheet on a phone), with errors under the fields, a
  confirmation for anything that removes or closes, and a toast after.
- **Printouts** are HTML templates (Handlebars, in `src/templates/printouts/`, keeping CIRERMS's PDF conventions,
  improved to the standard of the owner's NAVY-PAYROLL application, designed by D4) turned into PDFs on the server by
  Chromium (`renderPdf`, WP13), and open in the app's preview dialog (`openPdfPreview` in
  `public/js/ui/pdf-preview.js`): it shows the PDF in the browser's own viewer with its toolbar hidden (`#toolbar=0`),
  as NAVY-PAYROLL does, and draws the pages on phones that cannot show a PDF inline. Never open a PDF in a new tab.
- **Look**: colour tokens only (no `bg-white`, `text-white`, `#fff`, hex or Tailwind palette colours in the app),
  light and dark mode, desktop and phone, the fluid type scale, Lucide icons from the sprite, dates `dd/mm/yyyy`,
  no inline scripts or `on*=` handlers (the Content Security Policy forbids them). Rebuild the CSS
  (`npm run css:build`) when you add classes.
- **Who is due** (for draft, advancement, training and discharge): the real rules are not known yet. Use the
  placeholder rules in your brief, and keep their numbers as settings in the database, so the real values can be
  entered later without a code change.

## 3. Checks before you report

1. MySQL in Docker: `docker run -d --name cirerms-db -e MYSQL_ROOT_PASSWORD=rootpw -e MYSQL_DATABASE=cirerms -e MYSQL_USER=cirerms -e MYSQL_PASSWORD=cirerms_password -p 3306:3306 mirror.gcr.io/library/mysql:8.0`
   (the mirror avoids Docker Hub's rate limit). `.env` from `.env.example` with those credentials.
2. `npm ci`, `npm run migrate:fresh`, `npm run seed`, `npm start`.
3. **Walkthroughs** (Playwright; `tests/e2e/`): every existing walkthrough must still pass on a fresh database
   (`migrate:fresh` and `seed` before each), and a build package adds its own, `tests/e2e/<module>-walkthrough.js`,
   in the same style. **Each walkthrough runs in 5 minutes at most** (it prints its time and fails over 5 minutes):
   the rules, privileges (a 403 for someone without the grant) and audit rows through the API; every action through
   the screens once at desktop light; desktop dark, phone light and phone dark only each page and its main dialog,
   plus what differs on a phone. No browser errors anywhere. The access walkthrough needs a second server, as its
   header says.
4. Look at your screens yourself at 1440 and 390 px wide, light and dark: nothing cut off, nothing scrolling
   sideways.
5. Before pushing: `git log --format=%B origin/master..HEAD` has no AI tool names and no Co-Authored-By lines, and
   the diff has no white, hex or palette colours in `public/` and no change to `choices.js`.

## 4. The report note (required)

When you have finished, write your report as a file on your branch, commit it last, and push:
`docs/reports/<package>.md` (for example `docs/reports/WP7a.md`), following `docs/reports/README.md`. It **must**
start with the package, the **branch** and the **last commit**, so the administrator can inspect the branch. Then
tell the owner it is there (an AI session working for the administrator sends the same text with its
`send_message` tool instead, as its brief says). Do not wait for a reply; the administrator's findings come back
through the owner.

The administrator then checks the branch: the author and commit messages, that only the package's files changed,
the rules above, a fresh-database run of every walkthrough, and the screens. Changes asked for come back to the
same branch; a new report note replaces the old one.
