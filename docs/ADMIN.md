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
- **Check every branch** before telling the owner it is ready (section 4). The owner merges on
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

## 6. Where things stand (19/11/2026, wave C)

| Item | State |
|---|---|
| master | WP0, WP1, T1, D1, D2, WP2 (merged early at 540100d, see below), the plan |
| `project-plan` | Even with master after the owner's merge of PR 16 |
| D1, T1, D2 | Merged 19/11/2026; sessions archived |
| WP3 `system-admin` | Session `session_01G8RfvnSc5mdVeps4sjzbKj` (Sonnet 5.5, medium), started 19/11/2026 with the section 9d decisions; also asked to move toasts clear of dialog buttons on a phone (kit), and told the owner's rule that every account belongs to an existing rating, HICO001 included (PLAN 9d). On report: check, run the three walkthroughs, owner merges, archive |
| WP2 `static-tables` | Session `session_01G8RfvmkVq1wRk75f9xaxJA`. Done at 9b1c802, checked (fresh database: access 166 in 74 s, static tables 1,444 in 92 s). Owner to merge `static-tables` a second time, then archive |
| WP4 `disciplinary` | Session `session_01G8RfvkhEqoo5KPx5QPdkE2` (Sonnet 5.5, medium), started 19/11/2026 (WP2's tables were on master). On report: check, run the walkthroughs (long ones in the background), owner merges, archive |
| D3 `design-special` | Not started. The owner (19/11/2026) wants Special Drafting and Naval Character Assessment designed and built this phase: D3 (Sonnet 5.5, medium) in the first free slot after WP3 or WP4, with PLAN 9e in its brief; then WP12 (needs WP2, D3) and WP11 (needs WP7a, D3) |
| Next | Wave E: WP6, WP7a once WP3 and WP4 are merged (the due rules: placeholders unless Hicad sends them). Then F: WP5, WP8; F2: WP12, WP11. G: WP7b, WP9. H: WP10. See PLAN sections 5 and 6 |

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
- **WP9:** the demo's All Personnel Status filter shows "all" in lower case; label it properly.
- **Security, told to the owner:** the old repository's `hpproject/Web.config` holds database
  passwords in plain text; they should be changed if still in use. Never copy them.

## 7. Other places

- The old system: `hicadsystems/cirems` (attach read-only with `add_repo` if needed). Its 2017
  backup is an older database; nothing more to get from it.
- `praxisjbs/mycity-app` was the layout reference for the UI restructure; `swizfcodes/navy-payroll`
  was the sign-in page reference. Neither is needed for the plan's packages.
