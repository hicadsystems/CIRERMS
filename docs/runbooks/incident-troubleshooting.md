# Troubleshooting

Start from what you **see**, find the matching entry, and follow it. Every entry gives the cause and the fix, and most give a command you can paste to prove it. The messages quoted here are the real ones the application prints.

Commands are shown for Docker (the standard deployment) and for running directly with Node. Use the set that matches how the application is running. Services in `docker-compose.yml` are `app` and `db`.

## Contents

- [First five minutes](#first-five-minutes)
- [Find your symptom](#find-your-symptom)
- [The server will not start](#the-server-will-not-start)
- [The server is up but the database is not](#the-server-is-up-but-the-database-is-not)
- [Sign-in and session problems](#sign-in-and-session-problems)
- [401, 403, 404, 422 and 500 from the API](#401-403-404-422-and-500-from-the-api)
- [The screen misbehaves](#the-screen-misbehaves)
- [Migration problems](#migration-problems)
- [Uploads](#uploads)
- [PDF printouts](#pdf-printouts)
- [Tools you will use](#tools-you-will-use)
- [What to collect before asking for help](#what-to-collect-before-asking-for-help)

---

## First five minutes

Run these three checks before anything else. They tell you which layer to look at.

| Check | Docker | Node directly |
|---|---|---|
| Is it running, and what did it say? | `docker compose ps` then `docker compose logs --tail=200 app` | the terminal where `npm start` runs |
| Does the server see the database? | `curl -i http://localhost:3000/api/health` | the same |
| Is the database schema where it should be? | `docker compose exec app npm run migrate:status` | `npm run migrate:status` |

Reading the health answer:

```text
200 {"data":{"status":"ok","database":"connected"}}                      server and database are fine
503 {"error":{"code":"DB_UNAVAILABLE", ...}}                              server is up, database is not
no answer / connection refused                                            the server is not running
```

Then decide the layer, **backend first, screen second**:

1. Call the API directly (see [Tools](#tools-you-will-use)). If the API is wrong, fix the backend. Do not touch the screen.
2. If the API is right and the screen is wrong, the fault is in the browser code, `nav.js`, or the build files.

## Find your symptom

| What you see | Go to |
|---|---|
| `npm start` or the container exits straight away | [The server will not start](#the-server-will-not-start) |
| `/api/health` answers 503, or everything returns 500 | [The server is up but the database is not](#the-server-is-up-but-the-database-is-not) |
| "Invalid username or password", a locked account, "Too many failed password attempts" | [Sign-in and session problems](#sign-in-and-session-problems) |
| A request answers 401, 403, 404, 422 or 500 | [401, 403, 404, 422 and 500 from the API](#401-403-404-422-and-500-from-the-api) |
| "Unable to Load This Page" | [The screen misbehaves](#the-screen-misbehaves) |
| "You Do Not Have Access to This Page" (even for the administrator) | [The screen misbehaves](#you-do-not-have-access-to-this-page) |
| A screen sends you back to the dashboard | [The screen misbehaves](#the-address-changes-to-dashboard) |
| A list is empty but the data exists | [The screen misbehaves](#a-list-is-empty-but-the-data-exists) |
| A style or icon is missing | [The screen misbehaves](#an-element-is-unstyled-or-an-icon-is-blank) |
| My code change does not show | [The screen misbehaves](#my-change-does-not-show) |
| A migration refuses to run, or stopped half way | [Migration problems](#migration-problems) |
| An upload is rejected or nothing is imported | [Uploads](#uploads) |
| A PDF does not appear | [PDF printouts](#pdf-printouts) |

---

## The server will not start

Read the first lines of the output (`docker compose logs --tail=100 app`, or the terminal). The server checks itself at startup and **names the problem in the message**. Find your message:

| Message | Cause | Fix |
|---|---|---|
| `[CIRERMS] Database connection failed (127.0.0.1:3306/cirerms): connect ECONNREFUSED ...` | The database is not running, or the host, port or name is wrong | Start the database. Check `DB_HOST`, `DB_PORT`, `DB_NAME` against where the database really is. With Docker use `DB_HOST=db` inside the compose network |
| the same, with `ER_ACCESS_DENIED_ERROR` | Wrong `DB_USER` or `DB_PASSWORD` | Correct `.env` or the compose environment. Test with `mysql -h127.0.0.1 -u<user> -p` |
| the same, with `ER_BAD_DB_ERROR` | The database does not exist | Create it (see [Local setup](../development/setup.md)) |
| `FATAL: Set a strong JWT_SECRET in .env before running in production.` | `NODE_ENV=production` with no `JWT_SECRET` | Set a long random `JWT_SECRET` |
| `Module "notices": GET /api/notices/:id has no privilege check. Add requirePrivilege(screen, action) ...` | A route in a module has no privilege guard | Add `requirePrivilege('screen.id', 'action')` to that route |
| `src/modules/notices/notices.module.js: "basePath" must start with /api/.` | Manifest `basePath` is wrong | Make it `/api/<name>` |
| `...: privilege screen "Notices" must be a screen id (module.screen).` | Screen ID is not lowercase and dotted | Use for example `notices.board` |
| `...: privilege notices.board actions must be some of view, add, edit, delete, approve.` | An action name is not one of the five | Fix the spelling in `actions` |
| `...: "key" is required.` / `the manifest must export an object.` | The manifest is incomplete | Compare with `notices.module.js` in [Creating and Maintaining Modules](../development/modules.md) |
| `Error: Cannot find module './notice.routes'` | Manifest `routes` points at a file that does not exist | Fix the `routes` path |
| `Error: listen EADDRINUSE: address already in use :::3000` | Another copy is running on the port | Stop it, or set a different `PORT` |
| nothing wrong printed, but a module is missing (404 on its API) | The manifest file is not named `<folder>/<folder>.module.js`; it is silently ignored | Rename it to match its folder |

With Docker, a container that restarts in a loop is almost always one of the first four rows. The database service must be healthy first; the compose file already waits for it. Also check that the migrations step did not fail: the app container runs `npm run migrate:up && npm run seed && npm start`, so **a failed migration stops the application from starting**. See [Migration problems](#migration-problems).

## The server is up but the database is not

```bash
curl -i http://localhost:3000/api/health
```

- `503 {"error":{"code":"DB_UNAVAILABLE","message":"Database connection is unavailable."}}` means the server cannot reach the database.
- While the database is down, other API calls answer `500 INTERNAL_ERROR` ("An unexpected server error occurred."). The server log shows `[CIRERMS Unhandled Error] Error: connect ECONNREFUSED ...`.

Check the database itself:

```bash
docker compose ps
docker compose logs --tail=200 db
docker compose exec db mysqladmin ping -h 127.0.0.1 -ucirerms -pcirerms_password
```

(Use your own credentials outside the default compose setup.) Typical causes are a stopped container, a full disk, a changed password, or a network or firewall change.

**You do not need to restart the application.** When the database comes back, the connection pool recovers by itself and `/api/health` returns to `200`. This was observed directly. Do not run migrations or restart the app to "fix" a database outage; first make the database healthy. Do not continue writing data while connectivity is unstable. If the database lost data, go to [Database recovery](database-recovery.md).

---

## Sign-in and session problems

| What happens | Meaning | What to do |
|---|---|---|
| `401 INVALID_CREDENTIALS` "Invalid username or password." | Wrong username or password, or the account does not exist | Check the service number and password. A reset is done by an administrator on **Manage Users**. Re-running seeds does not reset an unknown password |
| `ACCOUNT_DISABLED` | The account is disabled | An administrator re-enables it in **Manage Users** |
| Someone says the *Forgot password?* e-mail never came | The page always answers the same, so it cannot say. A code is sent only to an active account with an e-mail address, 3 an hour; with no `SMTP_HOST` set nothing is sent (development writes it to `storage/mail/`; production logs a warning at start) | Check the account has an e-mail address on **Manage Users**, that `SMTP_HOST` is set, and the server log for `An e-mail could not be sent` or the start-up warning. The Audit Trail shows each request and why no code was sent. Or give the person a one-time password on **Manage Password** |
| `403 PASSWORD_CHANGE_REQUIRED` | The account must choose a new password before doing anything else | Complete the forced password change. It is not a missing privilege |
| `429 TOO_MANY_ATTEMPTS` "Too many failed password attempts. Please wait 15 minutes and try again." | 25 failed attempts from one address within 15 minutes | Wait 15 minutes. The counter is held in memory, so **restarting the application clears it**. Find out why so many attempts failed |
| `423 SESSION_LOCKED` with `"fields":{"reason":"idle"}` | The session was idle longer than `SESSION_IDLE_MINUTES` (default 15) and is locked. **This is intentional** | The person unlocks it with their password, or signs out. Do not restart the server |
| Everyone was signed out at once | `JWT_SECRET` changed, or the application was redeployed with a different secret | Keep the secret stable between deployments. People sign in again |
| Signed in but the person's rating is missing | Sign-in needs the account's rating record | Check the user's service number exists in `ratings` |

Lock behaviour is controlled by `SESSION_IDLE_MINUTES` (default 15) and `SESSION_SERVER_GRACE_SECONDS` (default 120). While a session is locked, `GET /api/auth/me` still works but data calls answer 423.

Check who the server thinks you are, from a signed-in browser console:

```js
fetch('/api/auth/me', { credentials: 'include' }).then(async (r) => console.log(r.status, await r.json()));
```

## 401, 403, 404, 422 and 500 from the API

Every error has the same shape:

```json
{ "error": { "code": "FORBIDDEN", "message": "You do not have permission to perform this action." } }
```

`code` tells you what kind it is. `fields` appears on validation errors.

| Status and code | Meaning | First check | Do not |
|---|---|---|---|
| `401 UNAUTHORIZED` | No valid session | Sign in again. Check `GET /api/auth/me` | Continue protected writes |
| `403 FORBIDDEN` | Signed in, but the role lacks this privilege | [403 below](#403-forbidden) | "Fix" it by hiding the button |
| `423 SESSION_LOCKED` | Session is idle-locked | Unlock or sign out | Restart the server |
| `404 NOT_FOUND` "Endpoint not found: GET /api/x" | No such API route | [404 below](#404-endpoint-not-found) | Assume the database is down |
| `404 NOT_FOUND` "That ... was not found." | The route exists; the record does not | Check the id | |
| `422 VALIDATION_ERROR` | Input refused; `error.fields` has a message per field | Read `fields`; fix the input | |
| `400 BAD_REQUEST` | Malformed request, for example a non-numeric id | Check the URL and payload | |
| `409 CONFLICT` | A clash, such as a duplicate | Read the message | |
| `500 INTERNAL_ERROR` | Unexpected server fault | **Read the server log** for the stack | Retry repeatedly without evidence |
| `503 DB_UNAVAILABLE` (health) | Database unreachable | [The server is up but the database is not](#the-server-is-up-but-the-database-is-not) | Run migrations |

### 403 Forbidden

The signed-in role does not hold the privilege (`screen:action`) that the route requires. Work through:

1. Find the privilege the route needs: look for `requirePrivilege('<screen>', '<action>')` in `src/modules/<module>/<module>.routes.js`.
2. Check the role has it: sign in as an administrator, open **Manage Roles**, and look at the role. Role changes apply on the person's next request. No restart or sign-out is needed.
3. If the privilege is not listed at all, it is not in the catalogue yet. The catalogue is built from the module manifests when the server starts (and when seeds run). Check the manifest lists it, then restart the server.
4. Check the spelling matches in all places. The same screen ID appears in the manifest, the route guard and `public/js/core/nav.js`.

The administrator role holds every privilege automatically. A 403 for an administrator means the route's screen ID or action is not in any manifest (a typo).

### 404 Endpoint not found

`{"error":{"code":"NOT_FOUND","message":"Endpoint not found: GET /api/notices"}}` means Express has no route for that path. Check in order:

1. **Is the module mounted?** Its manifest must be `src/modules/<folder>/<folder>.module.js`, with `basePath` set to `/api/<name>`. A misnamed manifest is ignored without any message.
2. **Did you restart?** Modules are read once at startup.
3. **Is the route there?** Check the verb and path in the routes file (`router.get('/:id', ...)`).
4. **Is the screen calling the right URL?** Compare with `public/js/sections/<screen>.js`.

If the 404 is a *screen* (the address changes to the dashboard instead), it is a navigation problem; see [the screen misbehaves](#the-address-changes-to-dashboard).

### 500 Internal error

The response is deliberately vague. The cause is in the server log, with the stack, prefixed `[CIRERMS Unhandled Error]`. Read it. Common causes are a SQL error from a column that does not exist (a migration was not applied; run `npm run migrate:status`), or a `null` where the code expects a value.

### The page calls the API, but the data is wrong

1. In the browser Network tab, look at the request and the response.
2. Confirm the paging and filter parameter names the route reads.
3. Trace route, then service, then SQL in `<module>.repo.js`.
4. Compare the `data` and `meta` shape with what the screen reads. The envelope is `{ data, meta }`.
5. Check migration and seed state for missing lookup values.
6. Check the audit trail (**Audit Trail** screen) for writes you did not expect.

---

## The screen misbehaves

Screens are JavaScript files that the shell loads by name (see [Frontend](../development/frontend.md#how-screens-are-served)). Most screen faults are a mismatched name. Open the browser console (`F12`) and the Network tab first; they usually name the culprit.

| What you see | Cause | Fix |
|---|---|---|
| **Unable to Load This Page** and `<file>.js has no <mount>().` | `view.mount` in `nav.js` names a function the file does not export | Match `view.mount` to the exported function name exactly |
| **Unable to Load This Page** and `Failed to fetch dynamically imported module: .../<file>.js` | Either `view.file` names a file that does not exist, **or the file exists but one of its own `import` lines points at a file that does not** | Check the filename in `view.file`. If it is right, open the Network tab: a red 404 for a *different* `.js` file is the broken import |
| **You Do Not Have Access to This Page** | The page's `screen` in `PAGES` is not a privilege the person holds | See below |
| The address jumps to `#dashboard` | No entry in `PAGES` matches the route | Check `pattern` in the `PAGES` entry against the address |
| The screen loads but the list says "No ... Yet" although data exists | The list's API call failed; the failure is in the console (a red 404 or 403) and a toast, not on the page | Open the Network tab, find the `/api/...` call, fix the URL or privilege |
| New code does not appear | The page did not really reload, the browser cached it, or Docker is serving an old image | [My change does not show](#my-change-does-not-show) |
| An element has no styling | It uses a Tailwind class that is not in the built CSS | `npm run css:build` |
| An icon is a blank box | The icon is not in the sprite | Add it to `scripts/build-icons.js`, run `npm run icons:build` |
| A button is missing | The screen hides it with `can(screen, action)` and the role lacks that action | Grant the action in **Manage Roles** |
| White page, no shell | `public/app.html` or `app-shell.js` failed to load | Read the first red line in the console; check the server is serving `/js/sections/app-shell.js` |

### You Do Not Have Access to This Page

For a person with a real role, grant the screen in **Manage Roles**. If it appears **even for the administrator**, the `screen` in the `PAGES` entry in `nav.js` does not match any privilege. The usual cause is a typo (`notices.bord`). Make the same string appear in three places: the manifest, the route guard and `nav.js`.

### The address changes to dashboard

The router found no `PAGES` entry for the route and fell back to the dashboard. Check the entry's `pattern` equals the text after `#`, with no extra slash.

### A list is empty but the data exists

The list view shows its empty message when its load fails, so an API fault can look like "no data". Check the console and Network tab. A toast may also have flashed. Reproduce the call directly with [the API tool](#tools-you-will-use) to see the real error.

### An element is unstyled, or an icon is blank

Neither produces an error.

- Unstyled: Tailwind only includes classes it finds in the source files at build time. Run `npm run css:build` and hard reload. Write whole class names; `'bg-' + colour` is never found.
- Blank icon: add the Lucide name to `ICONS` in `scripts/build-icons.js` and run `npm run icons:build`. Check the sprite has it: open `/assets/icons.svg` and search for `id="<name>"`.
- With Docker, the CSS is rebuilt when the **image** is built, so rebuild it (`docker compose up --build`).

### My change does not show

Check in this order:

1. **Did the page reload?** Changing only the part after `#` in the address does not reload the page. Press `Ctrl+Shift+R`.
2. **Docker?** The image contains a copy of the code from when it was built. Run `docker compose up --build`.
3. **Production?** Static files are cached for 1 hour in production. Hard reload, or wait.
4. **Backend change?** The server reads code once. Restart it.
5. **Is it the right copy?** Confirm the file you edited is the one being served: open `/js/sections/<file>.js` in the browser.

### Inspect the screen from the console

Paste into the console while on the `/app` page to see what the router and the outlet are doing:

```js
console.log({
  hash: window.location.hash,
  outletExists: Boolean(document.getElementById('app-main')),
  heading: document.querySelector('#app-main h1')?.textContent.trim() || null,
  text: document.getElementById('app-main')?.innerText.replace(/\s+/g, ' ').slice(0, 200),
});
```

If `outletExists` is `false` the shell did not load. If the heading is present but the content is wrong, the data call is at fault. The module guide has a complete check for a screen at [Check the screen](../development/modules.md#6-check-the-screen).

---

## Migration problems

First run:

```bash
npm run migrate:status
```

(`docker compose exec app npm run migrate:status` with Docker.) Each file has one of four states:

| State | Meaning | Action |
|---|---|---|
| `APPLIED` | Applied, and the file is unchanged | Nothing |
| `PENDING` | Not applied yet | `npm run migrate:up` |
| `CHANGED` | Applied, but the file on disk now differs | Restore the original text of the file. Put your change in a **new** migration |
| `MISSING` | Applied, but the file is gone from disk | Restore the file from version control |

`CHANGED` and `MISSING` stop `migrate:up` completely:

```text
Migration integrity check failed — already-applied migrations have been modified or removed:
  - [CHANGED] 20261125_050342_create_notices.sql (applied in batch 2; expected ..., got ...)
Restore the applied file(s) and create a new migration with `npm run migrate:make <name>` instead.
```

This is deliberate: the history of a shared database must not be rewritten. Never "fix" it by editing the `migrations` table.

### A migration stopped half way

MySQL commits each schema change immediately, so when statement 2 of 3 fails, statement 1 stays applied, and the file is still `PENDING`. The error tells you exactly where:

```text
Migration up failed in 20261125_051344_broken_example.sql at statement 2 of 2.
MySQL error [ER_DUP_FIELDNAME]: Duplicate column name 'pinned'

Failing statement:
ALTER TABLE notices ADD COLUMN pinned TINYINT(1) NOT NULL DEFAULT 0;
...
Statements already executed in <file> (MySQL commits DDL immediately): 1 of 2
```

Do not retry blindly: the first statement would fail on the second run. Instead:

1. Read which statements already ran (the message lists them).
2. Undo them by hand so the database matches the state before the file, for example `ALTER TABLE notices DROP COLUMN pinned;`.
3. Fix the SQL in the migration file. This is allowed because it was **never recorded as applied**.
4. Run `npm run migrate:up` again. Confirm `npm run migrate:status` shows `APPLIED`.

If the file was already applied on any other database, do not edit it. Add a new migration.

### Other migration messages

| Message | Meaning |
|---|---|
| `Could not acquire migration lock ... Another migration run may be in progress.` | Two runs at once. Wait, then retry. Do not delete the lock by hand |
| `Migration <file> must contain both "-- UP" and "-- DOWN" sections.` | Add the missing marker |
| `Migration <file> has an empty "-- UP" section.` / `empty "-- DOWN" section` | The marker has no SQL under it. `-- DOWN` is only checked when rolling back |
| `Cannot roll back <file>: file is missing from ...` | Restore the file before rolling back |
| `Refusing to run migrate:fresh when NODE_ENV=production.` | Intended. `migrate:fresh` drops everything; it never runs in production |
| `Migration file already exists: ...` | Pick another name for `migrate:make` |

With Docker, a failed migration stops the app container from starting. Fix the cause, then `docker compose up -d`. For rollback and release rules, see [Migrations](migrations.md).

---

## Uploads

Review, in order:

1. **Size.** The limits are `MAX_PHOTO_SIZE_MB` (5), `MAX_DOC_SIZE_MB` (15) and `MAX_EXCEL_SIZE_MB` (10).
2. **Type.** Extension **and** content signature are checked, not the filename alone. A renamed file fails.
3. **Reached the route?** Look for the request in the Network tab and its status.
4. **Storage.** `UPLOAD_DIR` exists and the application user can write to it. With Docker the volume is mounted at `/app/storage/uploads`.
5. **Does the feature import on upload?** The Ratings batch upload (`POST /api/ratings/batch-upload`) validates and commits accepted rows in one request. It is not a preview.
6. **Rejected rows.** The response lists `inserted`, `skippedDuplicates` and `errors`, each row with its reason.

More in [Uploads and storage](storage-and-uploads.md).

## PDF printouts

Printouts are rendered by a headless Chromium. Look for `[printouts]` lines in the application log.

1. The endpoint must answer `Content-Type: application/pdf`. If it answers JSON, read the error.
2. Browser availability: the Docker image includes Chromium and Liberation fonts. Outside Docker the browser comes from `@sparticuz/chromium` unless `PDF_CHROMIUM_PATH` points to one.
3. Resources: memory, and free space in the temporary directory (`PDF_TEMP_DIR`). Large documents hit `PDF_MAX_HTML_MB` (10) or `PDF_TIMEOUT_MS` (60000).
4. Templates are in `src/templates/printouts/`.
5. If the endpoint returns a PDF but the screen shows nothing, test **Download PDF** and **Print** separately; the preview is `public/js/ui/pdf-preview.js`.

---

## Tools you will use

### Call an API from the browser

While signed in, paste into the console. Replace the path. This uses your real session, so it shows exactly what the screen gets:

```js
fetch('/api/ratings?status=current&page=1&pageSize=25', { credentials: 'include' })
  .then(async (r) => console.log(r.status, await r.json()));
```

### Call an API from the command line

Works on Windows, macOS and Linux with Node 18 or later. Save as `api-check.js` outside the repository:

```js
// node api-check.js /api/notices          (reads: GET)
// Environment: CIRERMS_BASE_URL (default http://localhost:3000), CIRERMS_TEST_USERNAME, CIRERMS_TEST_PASSWORD
const base = (process.env.CIRERMS_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const path = process.argv[2];
if (!path) { console.error('Usage: node api-check.js /api/...'); process.exit(1); }
(async () => {
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: process.env.CIRERMS_TEST_USERNAME, password: process.env.CIRERMS_TEST_PASSWORD }),
  });
  const session = await login.json();
  if (!login.ok) { console.error('Sign-in failed:', login.status, JSON.stringify(session)); process.exit(1); }
  const res = await fetch(base + path, { headers: { Authorization: `Bearer ${session.data.token}` } });
  console.log(res.status, JSON.stringify(await res.json(), null, 2));
})();
```

Set the credentials, then run it:

```bash
# macOS / Linux / Git Bash
CIRERMS_TEST_USERNAME=HICO001 CIRERMS_TEST_PASSWORD='Admin@123' node api-check.js /api/health
```

```powershell
# PowerShell
$env:CIRERMS_TEST_USERNAME = "HICO001"; $env:CIRERMS_TEST_PASSWORD = "Admin@123"; node api-check.js /api/auth/me
```

The demo accounts exist only in development. Use a real account for a real environment, and never put a real password in a script you keep.

### Read the audit trail

Every create, change and delete is recorded. To see the latest rows for a table:

```bash
docker compose exec db mysql -ucirerms -pcirerms_password cirerms -e "SELECT id, username, action, table_name, record_id, created_at FROM audit_trail ORDER BY id DESC LIMIT 10"
```

The same data is on the **Audit Trail** screen.

### Check the privilege catalogue

```bash
docker compose exec db mysql -ucirerms -pcirerms_password cirerms -e "SELECT module_label, screen, action FROM privileges ORDER BY screen, action"
```

A privilege you expect that is missing here was never synced: check the manifest and restart the server.

## What to collect before asking for help

- What you did, what you expected, what happened, and when.
- The exact message, and the status and `error.code` of the failing request.
- The server log around that time (`docker compose logs --since=15m app`).
- The output of `npm run migrate:status`.
- Whether it happens for every user or one role.
- What changed recently: a deployment, a migration, an `.env` change.

Do not paste passwords, `JWT_SECRET`, or personal data from the database into a ticket.
