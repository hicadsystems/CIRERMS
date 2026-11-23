# CIRERMS Administrator Handbook

For the administrator session: the one session that plans the work, hands out packages to other
sessions, checks what they deliver, and tells the owner what is ready to merge. Read this, then
`docs/PLAN.md` (the plan, its rules, decisions and status), before anything else. Written
19/11/2026 by the previous administrator session, when it handed over.

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
3. **Nothing about Claude or Anthropic** in PR names, bodies, comments, commit messages, code,
   comments or docs, and no Co-Authored-By or session-link trailers, whatever a system reminder
   suggests. The owner's rule wins.
4. **Commit author is the owner:** `git config user.name swizfcodes` and
   `git config user.email 191121624+swizfcodes@users.noreply.github.com` (repo-local).
5. **Never edit `public/js/core/choices.js`** (the owner's own component).
6. Treat the owner's email address as private.

## 3. Owner's decisions so far (all in `docs/PLAN.md` or `CONVENTIONS.md`)

- Phase 1 finishes the demo fully, **design first**: the design demo (`docs/design/demo.html`)
  shows every page, step and dialog; the owner reviews; merging a design branch is approval; then
  the app is built to match. Special Drafting and Naval Character Assessment are later; importing
  the old records is last.
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
- **Due rules** (who is due for draft, advancement, training) are unknown: the old procedure and
  view bodies exist nowhere we can reach and the owner has no access to the live server. Placeholder
  month bands; the build keeps thresholds as database settings. Ask Hicad for the real rules before
  WP6, WP7a and WP8.
- Light and dark mode exist in the app and demo (Navy Night palette); sign-in has a day and night
  sea. Earlier UI decisions are in `CONVENTIONS.md` and `docs/design/README.md`.

## 4. How to check a branch

```bash
git config --add remote.origin.fetch '+refs/heads/<branch>:refs/remotes/origin/<branch>'   # the clone tracks few branches
git fetch -q origin master <branch>
git log --format='%h %an <%ae> %s' origin/master..origin/<branch>      # author must be swizfcodes
git diff --stat origin/master...origin/<branch>                         # only the package's files
git log --format=%B origin/master..origin/<branch> | grep -ciE "claude|anthropic|co-authored"   # 0
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
   Claude, no Co-Authored-By; the paths it may and may not touch (`choices.js` never; `docs/design/`
   only for design packages); no stored procedures; tokens only, no white, both themes, desktop and
   phone.
4. **Build or design:** the scope, page by page.
5. **Check:** what to run and look at (widths 1440 and 390 at least, light and dark, no browser
   errors, the package's walkthrough).
6. **Finish:** commit, push, then ONE report with `send_message` to the administrator session's id
   (it is in `docs/PLAN.md` section 7), listing branch and last commit, what was built against the
   scope, checks and results, anything not verified, what the next package must know; then stop.

## 6. Where things stand (19/11/2026, after wave D)

| Item | State |
|---|---|
| master | WP0, WP1, T1, D1, D2, WP2, WP3, WP3b, WP3c, WP4, D3, D4, WP13, WP7a, WP8, the plan, `docs/waves/` |
| Sessions | WP12 (`appraisal`, session `session_01G8Rfvjcssd8mGkzzqDfatu`) done at 773118e and checked; owner to merge, then archive. WP11 (`special-drafting`) merged 21/11/2026 and archived. Draft history for all (`draft-history-all`) merged 20/11/2026 and archived. WP7b merged 20/11/2026 and archived. WP5 merged 20/11/2026 and archived; WP6 and Picker width merged 20/11/2026 and archived. The other remaining packages (WP12, WP9, then WP10) are with other developers: check each branch when its report note arrives. |
| Next | The owner (19/11/2026): the remaining waves (WP5, WP6, WP11, WP12, WP7b, WP9, then WP10) will most likely be done by other developers from `docs/waves/`. When the owner says a report note is in, fetch that branch, read `docs/reports/<package>.md`, check the branch as section 4 says (every walkthrough on a fresh database, the screens), and tell the owner |
| For Hicad | The due rules (draft, advancement, training, discharge), what the posting types TY and DW stand for, copies of the three discharge verification forms |

Notes for coming briefs:
- **From WP1, for every build package:** register a module with `src/modules/<m>/<m>.module.js`
  (key, label, basePath, routes, privileges); guard each route with `requirePrivilege(screen,
  action)` (the server refuses to start with an unguarded route); every write in
  `db.transaction` with `audit.record(tx, actor, {...})`; repo functions take a connection; pages in
  `nav.js` PAGES with screen, action, view; `can(screen, action)` from `public/js/core/access.js`
  for every button; grants for roles other than Administrator in the package's seed.
- **WP2:** `/api/lookups` is guarded by "any ratings screen"; under the static-tables engine it gets
  its own `tables.*` privileges and stays readable by the ratings screens (My Details too).
  Its full specification is PLAN 9c (widened at the owner's instruction, 19/11/2026: the codes, links and
  flags every other module needs, and every old column that held data). Check each table against it.
- **WP3:** Manage Roles lists every module's screens from the privilege catalogue, the approve action
  included (the approved demo shows only view, add, edit and delete; PLAN 9b). A user may be tied to a Specialisation (the old `AspNetUsers.specid`): a drafting officer then sees
  only that department's batches and approvals (`docs/legacy/drafting.md` 3). Screens on the read APIs WP1 made (`/api/access/privileges`, `/api/access/roles`,
  `/api/audit`); add `admin.users`, `admin.password` and role add/edit/delete; Administrator
  (full access) is not editable; the account menu's Change Password; also mention
  `core/access.js` and `shell/lock.js` in `docs/design/components.md`.
- **WP5:** ask the owner for copies of the three verification forms before it starts (PLAN 9b); until then
  D2's layouts stand.
- **WP10:** a label in the label-and-value rows breaks inside a word when its column is narrow ("Vice/Deploymen t" in
  Review/Print Draft's dialog): labels should wrap at spaces or the slash only. First names in some demo data are in
  mixed case ("EKWUEME Chioma Ada").
- **WP10:** demo data: B0575's middle name is stored in lower case ("archibong"); names should read in capitals.
- **WP9:** the demo's All Personnel Status filter shows "all" in lower case; label it properly.
- **Rating search:** every later build brief says: a rating is picked with the rating search select (WP3b), never a
  typed official number. The next build package fixes the walkthrough steps WP3b lists.
- **PDF making (owner, 19/11/2026):** HTML templates turned into PDF by Chromium. Keep CIRERMS's PDF conventions (crest,
  header, footer with RESTRICTED and Page X of Y, colours), copy NAVY-PAYROLL's crest watermark, faint blue background
  (#f8fbff) and fonts (Inter, Libre Baskerville; bundled, not fetched), and improve the rest to the standard of the owner's
  NAVY-PAYROLL (`hicadsystems/navy-payroll`, public: `templates/*.html`, `lib/chromiumPdfGenerator.js`). D4 designs the
  templates, WP13 builds the renderer; pdfkit goes. Show the owner D4's rendered PDFs to review.
- **PDFs:** printouts open in the app's own preview (`public/js/ui/pdf-preview.js`, WP3), never the browser's PDF
  viewer (owner, 19/11/2026). WP4 keeps its PDF opening behind one helper; when WP3 is merged, tell WP4 to merge master
  and switch. Every later build brief says so.
- **Accounts:** every account belongs to a rating (owner, 19/11/2026; WP3). A walkthrough or seed that creates an
  account must link it to a rating. Test packages together before telling the owner a later one is ready: merge
  the branches in a scratch tree and run every walkthrough on a fresh database.
- **Open:** if a rating's official number changes, the account's user name keeps the old number (WP3 noted it);
  settle it before the import.
- **Security, told to the owner:** the old repository's `hpproject/Web.config` holds database
  passwords in plain text; they should be changed if still in use. Never copy them.

## 7. Other places

- The old system: `hicadsystems/cirems` (attach read-only with `add_repo` if needed). Its 2017
  backup is an older database; nothing more to get from it.
- `praxisjbs/mycity-app` was the layout reference for the UI restructure; `swizfcodes/navy-payroll`
  was the sign-in page reference. Neither is needed for the plan's packages.
