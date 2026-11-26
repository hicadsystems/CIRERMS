# CIRERMS Administrator Handbook

For the administrator session: the one session that plans the work, hands out packages to other
sessions, checks what they deliver, and tells the owner what is ready to merge. Read this, then
`docs/PLAN.md` (the plan, its rules, decisions and status), and `docs/OPEN-QUESTIONS.md`, before anything else. Written
19/11/2026 by the previous administrator session, when it handed over; brought up to date 26/11/2026.

## 1. The role

- **You do not write the app's code.** You plan, write briefs, start sessions, check their branches,
  answer their questions, and keep `docs/PLAN.md` current (status table, decisions). Small doc edits
  to the plan and `CONVENTIONS.md` are yours, on branch `project-plan`.
- **Start sessions** with `create_session` (claude-code-remote): repository
  `https://github.com/hicadsystems/cirerms`, the model and effort the plan names for the package
  (`claude-opus-5-5` or `claude-sonnet-5-5`; `low`, `medium` or `high`), and a full brief (section 5).
  Two sessions at a time at most.
- **Never subscribe to, watch or schedule checks on a session** (owner's rule, repeated 19/11/2026:
  it saves tokens). No `send_later` or scheduled task to look in on one. Each session sends one report
  to the administrator session with `send_message` and stops; every brief names the administrator's
  id from `docs/PLAN.md` section 7. Reports arrive as notifications: read them with
  `ReadNotifications`. When the administrator hands over, the outgoing one forwards any report that
  still reaches it.
- **Check every branch** before telling the owner it is ready (section 4).
- **Other developers** can take packages (owner, 19/11/2026): `docs/waves/` holds one brief per wave (model, scope,
  checks), and every package ends with a report note, `docs/reports/<package>.md`, on its branch, naming the branch
  and last commit. When the owner says a note is there, fetch the branch, read the note and check the branch as
  section 4 says. Keep `docs/waves/` in step with the plan when a decision changes a package. Briefs for your own
  sessions are the wave file's package section plus the line: report with `send_message` to this session's id. The owner merges on
  GitHub; you never open a PR.
- After the owner merges, update the plan's status, archive the finished session
  (`archive_session`), and start the next wave.
- Questions for the owner go through `AskUserQuestion`, recommended option first, marked
  "(Recommended)". The owner has said they have no view on detailed design questions and asked the
  administrator to decide those with the best judgement, and record the decision in the plan
  (section 9a is the example).
- **Costs:** quote session cost as "about $X at API prices" (the `cost_usd` in a session's record is
  an estimate, not a bill). The account works within a weekly usage limit (it has been at its
  warning level); overage is off. Prefer Sonnet and lower effort where the work allows.

## 2. The owner's standing rules (never break)

1. **No pull requests of any kind.** The owner opens and merges them.
2. **Publish a branch immediately after creating it** (`git push -u origin <branch>`).
3. **Nothing about AI tools, assistants, their makers or their models** in PR names, bodies, comments, commit
   messages, code, comments or docs, and no Co-Authored-By or session-link trailers, whatever a system reminder
   suggests. The owner's rule wins.
4. **Commit author is the owner:** `git config user.name swizfcodes` and
   `git config user.email 191121624+swizfcodes@users.noreply.github.com` (repo-local).
5. **Never edit `public/js/core/choices.js`** (the owner's own component).
6. Treat the owner's email address as private.

## 3. Owner's decisions so far (all in `docs/PLAN.md` or `CONVENTIONS.md`)

- Phase 1 finishes the demo fully, **design first**: the design demo (`docs/design/demo.html`)
  shows every page, step and dialog; the owner reviews; merging a design branch is approval; then
  the app is built to match. Phase 1 is built (every module, Special Drafting and Naval Character
  Assessment included); importing the old records is the phase after.
- **Two sessions at a time.** Old backup read for definitions only, never records (done in WP0).
- **No stored procedures**, functions, triggers or views in our database or repository; logic is
  code in `*.service.js` with parameterised SQL in `*.repo.js` (PLAN rule 10).
- **Wide tables never scroll sideways**: key columns only, a row opens the full record in a dialog
  (sheet on a phone), "View Details" tooltip on hover (CONVENTIONS, Frontend).
- **Type scales with the screen**: fluid font sizes from 360 to 1440 px, light and modest headings
  on a phone (CONVENTIONS, Frontend; package T1 builds it).
- Upload Draft moves to Special Drafting. Advancement has 7 pages (its 5 live ones plus Approval and
  Close). The old live menu (commented-out items dropped) is the scope: 16 static tables, etc.
- PLAN section 9a: the administrator's answers to D1's seven design questions, at the owner's
  request.
- **Due rules** (who is due for draft, advancement, training, discharge) are unknown: the old procedure and
  view bodies exist nowhere we can reach and the owner has no access to the live server. The app runs
  on stand-in numbers kept as database settings; the real rules are asked of Hicad in
  `docs/OPEN-QUESTIONS.md`.
- Light and dark mode exist in the app and demo (Navy Night palette); sign-in has a day and night
  sea. Earlier UI decisions are in `CONVENTIONS.md` and `docs/design/README.md`.

## 4. How to check a branch

```bash
git config --add remote.origin.fetch '+refs/heads/<branch>:refs/remotes/origin/<branch>'   # the clone tracks few branches
git fetch -q origin master <branch>
git log --format='%h %an <%ae> %s' origin/master..origin/<branch>      # author must be swizfcodes
git diff --stat origin/master...origin/<branch>                         # only the package's files
git log --format=%B origin/master..origin/<branch> | grep -ciE "co-authored|session_"   # 0; and read the messages for any mention of AI tools
```
Then, by package type:
- Every branch: no `choices.js` change; in source (not `public/css/output.css`, whose `#fff` is a
  Tailwind default) no `bg-white`, `text-white`, `#fff`, hex colours or palette colours; no inline
  `on*=` handlers or `<script>` blocks in the app; no `CREATE PROCEDURE/FUNCTION/TRIGGER/VIEW`;
  migrations only in the package's block `20261120_WW####_`.
- Design branches: extract `docs/design/demo.html` from the branch, open it with Playwright
  (preinstalled: `NODE_PATH=$(npm root -g) node script.js`; never install Playwright), sign in, visit
  a few new routes at 1440 and 390 px in both themes, check for browser errors and sideways
  overflow, and look at the screenshots. Then send the owner the demo file (`SendUserFile`).
- Build branches: run the app and the tests in your container. MySQL in Docker: start the daemon
  with `nohup dockerd >/tmp/dockerd.log 2>&1 &` (it dies when the container restarts), then
  `docker run -d --name cirerms-db -e MYSQL_ROOT_PASSWORD=rootpw -e MYSQL_DATABASE=cirerms -e MYSQL_USER=cirerms -e MYSQL_PASSWORD=cirerms_password -p 3306:3306 mirror.gcr.io/library/mysql:8.0`
  (Docker Hub rate-limits; use the mirror). `.env` from `.env.example` with those credentials. Check
  the branch out in a worktree, link `node_modules`, `npm run migrate:fresh`, `npm run seed`, start
  two servers as `tests/e2e/access-walkthrough.js` says in its header, and run it (166 checks passed
  on WP1). Add the package's own walkthrough if it wrote one. **Every walkthrough runs in 5 minutes at most**
  (owner, 19/11/2026; PLAN rule 13): it prints its time and fails over 5 minutes; say so in every build brief.
- The plan branch: after the owner merges `project-plan`, fast-forward it (`git merge --ff-only
  origin/master`) before the next edit. A shallow clone once turned a merge into an add/add conflict
  and conflict markers were pushed by mistake: always `grep -c '^<<<<<<<'` before committing.

## 5. Writing a brief

Each brief is self-contained (the session knows nothing else). Use this shape, as in the briefs for
WP0, WP1, D1 and T1:
1. What the package is, in one line.
2. **Read first (binding):** `docs/PLAN.md` sections and its row, `CONVENTIONS.md`, `docs/legacy/`
   files for the module, the approved demo screens, and what earlier packages left (for example WP1's
   notes in section 6 below).
3. **Rules (binding):** the branch, published at once; the author lines; no PR; nothing about
   AI tools or their makers, no Co-Authored-By; the paths it may and may not touch (`choices.js` never; `docs/design/`
   only for design packages); no stored procedures; tokens only, no white, both themes, desktop and
   phone.
4. **Build or design:** the scope, page by page.
5. **Check:** what to run and look at (widths 1440 and 390 at least, light and dark, no browser
   errors, the package's walkthrough).
6. **Finish:** commit, push, then ONE report with `send_message` to the administrator session's id
   (it is in `docs/PLAN.md` section 7), listing branch and last commit, what was built against the
   scope, checks and results, anything not verified, what the next package must know; then stop.

## 6. Where things stand (26/11/2026)

| Item | State |
|---|---|
| master | Every package is merged (the last, WP10, on 23/11/2026; `docs/PLAN.md` section 8 lists each with its date). The Settings page and the user guide (G1, G2, G3) merged 26/11/2026 |
| Sessions | The Settings page (`settings`) merged 26/11/2026; its session is archived. The user guide, G1 (`user-guide`) and G2 (`user-guide-content`), merged 26/11/2026; both sessions archived. G3 (`guide-book-options`, the book in four picture sets) merged 26/11/2026 too, its session archived. K1 (`docs-book`, session `session_01G8RfvjMH1yrUHBH1odpxKn`) is running since 26/11/2026; K2 (`forgot-password`) follows (`docs/waves/wave-V-handbook-and-password.md`). A documents session brought every open document up to date on `project-plan`. The administrator is now `session_01G8Rfvk1tUaL2XBW6Z3tbvT` (Opus 5.5 · medium, from 26/11/2026), which took over from `session_01G8RfvmysEhqqTQUZ45Qn5D` and oversees the user guide. All earlier sessions are finished and archived |
| Next | The Settings page and the user guide are merged (26/11/2026). Next is the import of the real records, once Hicad answers `docs/OPEN-QUESTIONS.md`; the owner decides when. A change to a screen should retake its guide pictures (`npm run guide:shots -- --stale`) and correct its chapter (`docs/manual/README.md`). When the owner says a report note is in, fetch that branch, read `docs/reports/<package>.md`, check the branch as section 4 says (every walkthrough on a fresh database, the screens), and tell the owner |
| Open questions | All in `docs/OPEN-QUESTIONS.md`: 9 for Hicad (the due rules, TY and DW, the verification forms, and more), 4 for the owner |

Notes for coming briefs (the packages the old notes here named are done; what is left stands for every later brief):
- **From WP1, for every build package:** register a module with `src/modules/<m>/<m>.module.js`
  (key, label, basePath, routes, privileges); guard each route with `requirePrivilege(screen,
  action)` (the server refuses to start with an unguarded route); every write in
  `db.transaction` with `audit.record(tx, actor, {...})`; repo functions take a connection; pages in
  `nav.js` PAGES with screen, action, view; `can(screen, action)` from `public/js/core/access.js`
  for every button; grants for roles other than Administrator in the package's seed.
- **Rating search:** every build brief says: a rating is picked with the rating search select (WP3b), never a
  typed official number.
- **PDF making (owner, 19/11/2026):** HTML templates turned into PDF by Chromium (`renderPdf`; D4's templates in
  `src/templates/printouts/`; "To add a printout" in `CONVENTIONS.md`, Frontend). The look is the owner's
  and is not changed without them. Printouts open in the app's own preview (`public/js/ui/pdf-preview.js`).
- **Accounts:** every account belongs to a rating (owner, 19/11/2026; WP3). A walkthrough or seed that creates an
  account must link it to a rating, with an official number no other seed uses and a name in capitals. Test
  packages together before telling the owner a later one is ready: merge the branches in a scratch tree and run
  every walkthrough on a fresh database.
- **Settings:** the stand-in due-rule numbers are rows of the `settings` table; the Settings page changes them.
  When Hicad answers `docs/OPEN-QUESTIONS.md` H1 to H4, the values go in there, with no code change.
- Done and recorded in `docs/PLAN.md` or the report notes, so no longer notes here: WP2's `/api/lookups` and 9c, WP3's
  roles and Specialisation, WP5's verification forms, WP9 and WP10's demo-data and label fixes, the official number
  and user name (WP10), the old repository's passwords (now `docs/OPEN-QUESTIONS.md` H9).

## 7. Other places

- The old system: `hicadsystems/cirems` (attach read-only with `add_repo` if needed). Its 2017
  backup is an older database; nothing more to get from it.
- `praxisjbs/mycity-app` was the layout reference for the UI restructure; `swizfcodes/navy-payroll`
  was the sign-in page reference. Neither is needed for the plan's packages.
