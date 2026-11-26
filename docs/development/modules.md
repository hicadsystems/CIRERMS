# Creating and Maintaining Modules

This is the guide for adding a feature to CIRERMS from the database to the screen, changing it later, and removing it. It is written as a tutorial you can follow with copy and paste. Every file in it was built from this text and tested against a running copy of the application.

**You will build the Notice Board:** a screen where staff post short notices. It is small on purpose, but it uses every layer a real module uses: a table, an API, privileges, an audit trail, a navigation entry and a screen with a list, a form, validation messages and a delete confirmation.

## Contents

1. [How a module fits together](#1-how-a-module-fits-together)
2. [Before you start](#2-before-you-start)
3. [Backend](#3-backend)
4. [Check the backend](#4-check-the-backend)
5. [Frontend](#5-frontend)
6. [Check the screen](#6-check-the-screen)
7. [Maintaining a module](#7-maintaining-a-module)
8. [Removing a module](#8-removing-a-module)
9. [Reference](#9-reference)

If something goes wrong at any step, see [Troubleshooting](../runbooks/incident-troubleshooting.md). It is organised by what you see on screen.

---

## 1. How a module fits together

A feature is one folder on the server plus one screen in the browser, joined by names:

```text
Database          src/db/migrations/<stamp>_create_notices.sql      the table
  |
Server module     src/modules/notices/
                    notices.module.js    manifest: name, URL, privileges
                    notices.routes.js    URLs, privilege checks, response shape
                    notices.service.js   validation, rules, transaction, audit
                    notices.repo.js      SQL only
  |
Discovery         nothing to edit: the server mounts every folder in src/modules/
  |                that contains <folder>/<folder>.module.js
Browser           public/js/core/nav.js  where the screen appears (menu, tab, route)
                  public/js/sections/notices-board.js   the screen itself
```

The names must agree. Most "it does not work" problems in a new module are two names that do not match:

| Name | Notice Board value | Where it appears |
|---|---|---|
| Module key | `notices` | folder name, manifest file name (`notices.module.js`), manifest `key`, `nav.js` module `key` |
| API path | `/api/notices` | manifest `basePath`, the screen's `api` calls |
| Screen ID | `notices.board` | manifest `privileges[].screen`, `requirePrivilege(...)`, `nav.js` `screen` |
| Route | `notices/board` | `nav.js` `pattern`, `tab.route` and `href`; the browser address is `/app#notices/board` |

**Screen ID** is the one to remember. It is the name of a privilege. If the manifest says `notices.board` and `nav.js` says `notices.bord`, every user including the administrator is told they have no access.

A request travels like this:

```text
browser screen -> /api/notices -> requireAuth -> requirePrivilege('notices.board','add')
               -> service (validate, transaction, audit) -> repo (SQL) -> MySQL
```

Responses always use one envelope: `{ "data": ... }` on success (with `"meta"` for paging), and `{ "error": { "code", "message", "fields" } }` on failure.

## 2. Before you start

1. The application must be running with a migrated and seeded database. Follow [Local setup](setup.md) if it is not.
2. Sign in once at `http://localhost:3000` as `HICO001` / `Admin@123` to confirm everything works.
3. Use a **disposable development database**. The steps below create a table and rows.

Your editor should save files with the same line endings as the files around them (the repository uses Windows `CRLF`). Either is fine for the tutorial.

---

## 3. Backend

### Step 1. Create the table

Ask the migrator to create an empty, correctly named migration file:

```bash
npm run migrate:make create_notices
```

It prints the new path, for example `src/db/migrations/20261125_050342_create_notices.sql`. Open that file and replace its contents with:

```sql
-- UP
-- The notice board: short notices staff post for everyone who may open the Notice Board screen.
CREATE TABLE notices (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title       VARCHAR(120) NOT NULL,
  body        TEXT NULL,
  priority    ENUM('normal','urgent') NOT NULL DEFAULT 'normal',
  created_by  INT UNSIGNED NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notices_created (created_at),
  CONSTRAINT fk_notices_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Notice Board entries.';

-- DOWN
DROP TABLE notices;
```

Rules that this file follows (see [Database and migrations](database.md)):

- The file has an `-- UP` part and a `-- DOWN` part. Both are required.
- `utf8mb4_unicode_ci` and `INT UNSIGNED` keys, like every other table.
- Foreign keys name the table they point to, and say what happens on delete.
- Never edit this file again after it has been applied anywhere shared. Make a new migration instead.

Apply it and check:

```bash
npm run migrate:up
npm run migrate:status
```

You should see `+ <stamp>_create_notices.sql` applied, and `APPLIED` next to it in the status list. To look at the table:

```bash
mysql -h127.0.0.1 -ucirerms -p cirerms -e "DESCRIBE notices"
```

(With Docker: `docker compose exec db mysql -ucirerms -pcirerms_password cirerms -e "DESCRIBE notices"`.)

### Step 2. Write the manifest

The manifest tells the server what the module is called, where its URLs live, and which privileges it adds. Create the folder `src/modules/notices/` and this file inside it:

```js
'use strict';

// The Notice Board: short notices for everyone who may open the screen.
module.exports = {
  key: 'notices',                      // the folder name
  label: 'Notice Board',               // the module's name in the privilege catalogue
  basePath: '/api/notices',            // where the router is mounted
  routes: './notices.routes',
  order: 500,
  privileges: [
    { screen: 'notices.board', label: 'Notice Board', actions: ['view', 'add', 'edit', 'delete'] },
  ],
};
```

A privilege is a **screen ID plus an action**: `notices.board:view`, `notices.board:add`, `notices.board:edit`, `notices.board:delete`. The server adds these to the privilege catalogue every time it starts, and the Administrator role receives all of them automatically.

Screen IDs must be lowercase words joined by dots. Actions can only be `view`, `add`, `edit`, `delete` or `approve`. The server refuses to start otherwise.

### Step 3. Write the repository (SQL only)

The repository holds the SQL and nothing else: no validation, no rules. Every query uses `?` placeholders. Never put a request value into the SQL text. `conn` is the transaction connection, passed in when the call must be part of a transaction.

```js
'use strict';

const db = require('../../db');

/** One page of notices, newest first, and the total. */
async function list({ page, pageSize }) {
  const [count] = await db.query('SELECT COUNT(*) AS total FROM notices');
  const items = await db.query(
    `SELECT n.id, n.title, n.body, n.priority, n.created_at, u.username AS created_by_name
       FROM notices n
       LEFT JOIN users u ON u.id = n.created_by
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT ? OFFSET ?`,
    [pageSize, (page - 1) * pageSize]
  );
  return { items, total: Number(count.total) || 0 };
}

/** One notice, or null. Pass tx.connection to read inside a transaction. */
async function find(id, conn = null) {
  const rows = await db.query(
    `SELECT n.id, n.title, n.body, n.priority, n.created_by, n.created_at, u.username AS created_by_name
       FROM notices n
       LEFT JOIN users u ON u.id = n.created_by
      WHERE n.id = ? LIMIT 1`,
    [id],
    conn
  );
  return rows[0] || null;
}

async function insert({ title, body, priority }, userId, conn) {
  const res = await db.query(
    'INSERT INTO notices (title, body, priority, created_by) VALUES (?, ?, ?, ?)',
    [title, body, priority, userId],
    conn
  );
  return res.insertId;
}

async function update(id, { title, body, priority }, conn) {
  await db.query('UPDATE notices SET title = ?, body = ?, priority = ? WHERE id = ?', [title, body, priority, id], conn);
}

async function remove(id, conn) {
  await db.query('DELETE FROM notices WHERE id = ?', [id], conn);
}

module.exports = { list, find, insert, update, remove };
```

### Step 4. Write the service (rules, transaction, audit)

The service validates input, decides what is allowed, and wraps every write and its audit record in one transaction so they succeed or fail together. It never touches `req` or `res`; it throws errors from `src/shared/errors.js` and the error middleware turns them into responses.

```js
'use strict';

const db = require('../../db');
const audit = require('../../shared/audit');
const repo = require('./notices.repo');
const { badRequest, notFound, validationError } = require('../../shared/errors');

const PAGE_SIZE = 25;
const PRIORITIES = ['normal', 'urgent'];

function toItem(r) {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    priority: r.priority,
    createdAt: r.created_at,
    createdBy: r.created_by_name || null,
  };
}

function parseId(raw) {
  const id = Number.parseInt(raw, 10);
  if (!Number.isFinite(id) || id <= 0) throw badRequest('Invalid notice id.');
  return id;
}

/** Checks the body of a POST or PUT; returns the clean fields or throws 422 with a message per field. */
function validate(body = {}) {
  const errors = {};
  const title = String(body.title ?? '').trim();
  const text = String(body.body ?? '').trim();
  const priority = String(body.priority ?? 'normal').trim().toLowerCase();
  if (!title) errors.title = 'Enter a title.';
  else if (title.length > 120) errors.title = 'The title can be at most 120 characters.';
  if (text.length > 2000) errors.body = 'The notice can be at most 2000 characters.';
  if (!PRIORITIES.includes(priority)) errors.priority = `Priority must be ${PRIORITIES.join(' or ')}.`;
  if (Object.keys(errors).length) throw validationError('Check the notice and try again.', errors);
  return { title, body: text || null, priority };
}

async function list(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const { items, total } = await repo.list({ page, pageSize: PAGE_SIZE });
  return { items: items.map(toItem), page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

async function get(rawId) {
  const row = await repo.find(parseId(rawId));
  if (!row) throw notFound('That notice was not found.');
  return toItem(row);
}

async function create(body, actor) {
  const fields = validate(body);
  const id = await db.transaction(async (tx) => {
    const newId = await repo.insert(fields, actor.userId, tx.connection);
    const after = await repo.find(newId, tx.connection);
    await audit.record(tx, actor, { action: 'INSERT', table: 'notices', recordId: newId, after });
    return newId;
  });
  return get(id);
}

async function update(rawId, body, actor) {
  const id = parseId(rawId);
  const fields = validate(body);
  await db.transaction(async (tx) => {
    const before = await repo.find(id, tx.connection);
    if (!before) throw notFound('That notice was not found.');
    await repo.update(id, fields, tx.connection);
    const after = await repo.find(id, tx.connection);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'notices', recordId: id, before, after });
  });
  return get(id);
}

async function remove(rawId, actor) {
  const id = parseId(rawId);
  await db.transaction(async (tx) => {
    const before = await repo.find(id, tx.connection);
    if (!before) throw notFound('That notice was not found.');
    await repo.remove(id, tx.connection);
    await audit.record(tx, actor, { action: 'DELETE', table: 'notices', recordId: id, before });
  });
  return { id, deleted: true };
}

module.exports = { list, get, create, update, remove };
```

Points to copy into your own modules:

- `validate()` collects **every** problem and throws one `validationError` (HTTP 422) with a message per field. The screen shows each message beside its field.
- Writes go through `db.transaction`, and `audit.record(tx, actor, ...)` is inside the same transaction.
- `actor` is `req.actor`. It carries the signed-in user for the audit trail.
- `notFound` gives 404, `badRequest` gives 400, `validationError` gives 422. Other errors are listed in the [reference](#9-reference).

### Step 5. Write the routes (URLs and privileges)

Routes translate HTTP to service calls. Every route **must** name the privilege it needs. The server refuses to start if a route has none.

```js
'use strict';

/*
 *   GET    /api/notices?page=1   25 a page, newest first   (view)
 *   GET    /api/notices/:id                                 (view)
 *   POST   /api/notices          { title, body, priority }  (add)
 *   PUT    /api/notices/:id      { title, body, priority }  (edit)
 *   DELETE /api/notices/:id                                 (delete)
 */
const express = require('express');
const service = require('./notices.service');
const { requireAuth } = require('../../middleware/auth');
const { requirePrivilege } = require('../../middleware/access');
const { asyncHandler } = require('../../shared/errors');

const router = express.Router();
router.use(requireAuth);

router.get('/', requirePrivilege('notices.board', 'view'), asyncHandler(async (req, res) => {
  const r = await service.list(req.query);
  res.json({ data: r.items, meta: { page: r.page, pageSize: r.pageSize, total: r.total, totalPages: r.totalPages } });
}));

router.get('/:id', requirePrivilege('notices.board', 'view'), asyncHandler(async (req, res) => {
  res.json({ data: await service.get(req.params.id) });
}));

router.post('/', requirePrivilege('notices.board', 'add'), asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.create(req.body, req.actor) });
}));

router.put('/:id', requirePrivilege('notices.board', 'edit'), asyncHandler(async (req, res) => {
  res.json({ data: await service.update(req.params.id, req.body, req.actor) });
}));

router.delete('/:id', requirePrivilege('notices.board', 'delete'), asyncHandler(async (req, res) => {
  res.json({ data: await service.remove(req.params.id, req.actor) });
}));

module.exports = router;
```

### Step 6. Start the server (there is nothing to register)

The server finds modules by itself: every folder in `src/modules/` that contains `<folder>/<folder>.module.js` is mounted. You do not edit `src/modules/index.js`. The consequence is that **the manifest file must be named after its folder**: `notices/notices.module.js`. A manifest with any other name is silently ignored, and the module simply does not exist.

Modules are read once at startup, so **restart the server**:

```bash
# stop the running server (Ctrl+C), then:
npm start
```

Check that the module is mounted. An unauthenticated request must be answered with **401**, not 404:

```bash
curl -i http://localhost:3000/api/notices
```

```text
HTTP/1.1 401 Unauthorized
{"error":{"code":"UNAUTHORIZED","message":"Authentication required."}}
```

`404 Endpoint not found: GET /api/notices` means the module is not mounted: the manifest is misnamed, in the wrong folder, or the server was not restarted. If the server refuses to start, the first lines of its output name the problem. The common ones are in [Troubleshooting](../runbooks/incident-troubleshooting.md#the-server-will-not-start).

### Step 7. Give other roles access (seed)

The Administrator already has every notice privilege. Other roles get access in one of two ways:

- **In the application:** sign in as the administrator, open **Manage Roles**, and tick the Notice Board privileges for a role. This is how real roles are maintained.
- **In a seed file:** for development and demo roles. Seeds live in `src/db/seeds/`, run in filename order, and are re-run every time, so they must be safe to repeat. Use the next number after the last file in that folder. Create `src/db/seeds/015_notices.sql` (use a higher number if `015` is taken):

```sql
-- Notice Board (tutorial module): two demo notices and the privileges of the Records Officer role.
-- Safe to rerun: the notices are added only while the table is empty; INSERT IGNORE skips grants already made.
INSERT INTO notices (title, body, priority)
SELECT v.title, v.body, v.priority
  FROM (
            SELECT 'Welcome to the Notice Board' AS title, 'Notices posted here are seen by everyone who may open this screen.' AS body, 'normal' AS priority
  UNION ALL SELECT 'Records office closed Friday', 'The records office is closed for the monthly stock-take.', 'urgent'
       ) v
 WHERE NOT EXISTS (SELECT 1 FROM notices);

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id FROM roles r JOIN privileges p
    ON (p.screen = 'notices.board' AND p.action IN ('view', 'add', 'edit'))
 WHERE r.name = 'Records Officer';
```

Note the two techniques that make a seed safe to repeat: `WHERE NOT EXISTS` for rows, and `INSERT IGNORE` for grants.

> **Seeds in this project contain demo data.** The existing seeds create demo ratings and demo accounts with documented passwords. Keep your seed to what your module needs, and read the warning in the [deployment runbook](../runbooks/deployment.md) before running seeds anywhere that is not a development machine.

Run it:

```bash
npm run seed
```

---

## 4. Check the backend

Test the API before you build any screen. If something is wrong here, you know it is the server and not the screen.

Save this script as `notices-smoke.js` **outside the repository** (for example in your home folder). It signs in, then creates, lists, reads, edits and deletes a notice, and checks that bad input is refused. It needs only Node 18 or later, and works the same on Windows, macOS and Linux.

```js
'use strict';
// Smoke test for the Notice Board API. Writes data (and deletes what it wrote): local development only.
const BASE = (process.env.CIRERMS_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const USER = process.env.CIRERMS_TEST_USERNAME || 'HICO001';
const PASS = process.env.CIRERMS_TEST_PASSWORD || 'Admin@123';

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE) && process.env.CIRERMS_ALLOW_REMOTE !== '1') {
  console.error(`Refusing to write test data to ${BASE}. Use a local app, or set CIRERMS_ALLOW_REMOTE=1.`);
  process.exit(1);
}

let token = '';
async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  return { status: res.status, json };
}
function expect(label, condition, detail) {
  if (!condition) throw new Error(`${label}${detail ? `: ${JSON.stringify(detail)}` : ''}`);
  console.log(`PASS ${label}`);
}

(async () => {
  const login = await call('POST', '/api/auth/login', { username: USER, password: PASS });
  expect('sign in', login.status === 200 && login.json.data.token, login);
  token = login.json.data.token;

  const bad = await call('POST', '/api/notices', { title: '', priority: 'loud' });
  expect('empty title and bad priority give 422 with a message per field',
    bad.status === 422 && bad.json.error.fields.title && bad.json.error.fields.priority, bad);

  const made = await call('POST', '/api/notices', { title: 'Smoke test notice', body: 'Created by notices-smoke.js', priority: 'urgent' });
  expect('create gives 201 and the new notice', made.status === 201 && made.json.data.id, made);
  const id = made.json.data.id;
  expect('create records who posted it', made.json.data.createdBy === USER, made.json.data);

  const list = await call('GET', '/api/notices?page=1');
  expect('list gives 200, an array and paging meta',
    list.status === 200 && Array.isArray(list.json.data) && list.json.meta.pageSize === 25, list);
  expect('the new notice is first in the list (newest first)', list.json.data[0].id === id, list.json.data[0]);

  const one = await call('GET', `/api/notices/${id}`);
  expect('get one', one.status === 200 && one.json.data.title === 'Smoke test notice', one);

  const edited = await call('PUT', `/api/notices/${id}`, { title: 'Smoke test notice (edited)', body: null, priority: 'normal' });
  expect('update gives 200 and the new values', edited.status === 200 && edited.json.data.priority === 'normal', edited);

  const gone = await call('DELETE', `/api/notices/${id}`);
  expect('delete gives 200', gone.status === 200 && gone.json.data.deleted === true, gone);

  const missing = await call('GET', `/api/notices/${id}`);
  expect('the deleted notice is 404', missing.status === 404 && missing.json.error.code === 'NOT_FOUND', missing);

  const unsigned = await fetch(`${BASE}/api/notices`);
  expect('no session gives 401', unsigned.status === 401);

  console.log('\nNotice Board API smoke test passed.');
})().catch((err) => {
  console.error(`\nFAILED: ${err.message}`);
  process.exitCode = 1;
});
```

Run it from the folder where you saved it, with the application running:

```bash
node notices-smoke.js
```

Expected output:

```text
PASS sign in
PASS empty title and bad priority give 422 with a message per field
PASS create gives 201 and the new notice
PASS create records who posted it
PASS list gives 200, an array and paging meta
PASS the new notice is first in the list (newest first)
PASS get one
PASS update gives 200 and the new values
PASS delete gives 200
PASS the deleted notice is 404
PASS no session gives 401

Notice Board API smoke test passed.
```

The script stops at the first failure and prints what it received. It refuses to run against anything but a local address, because it writes data.

Check the audit trail recorded the writes:

```bash
mysql -h127.0.0.1 -ucirerms -p cirerms -e "SELECT id, username, action, table_name, record_id FROM audit_trail WHERE table_name='notices' ORDER BY id DESC LIMIT 5"
```

You should see an `INSERT`, `UPDATE` and `DELETE` by `HICO001` for the notice the script made. The same rows appear on the **Audit Trail** screen.

Finally, check that privileges are enforced. Save this as `notices-403.js` next to the smoke script. It signs in as a role with no notice privileges (`HICO004` / `Auditor@123`, the Auditor) and calls the API:

```js
(async () => {
  const base = 'http://localhost:3000';
  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'HICO004', password: 'Auditor@123' }),
  });
  const session = await login.json();
  const res = await fetch(`${base}/api/notices`, { headers: { Authorization: `Bearer ${session.data.token}` } });
  console.log(res.status, JSON.stringify(await res.json()));
})();
```

```bash
node notices-403.js
```

Expected: `403 {"error":{"code":"FORBIDDEN", ...}}`.

---

## 5. Frontend

The browser app is a single page. There are only two HTML files in `public/`: `index.html` (sign-in) and `app.html` (the shell). **Screens are not HTML files.** Each screen is a JavaScript file in `public/js/sections/` that builds its own HTML and draws it into the shell. The shell picks the right file from `public/js/core/nav.js`. See [Frontend](frontend.md) for how that works.

So a new screen is two edits: an entry in `nav.js`, and a section file.

### Step 8. Add the module and page to `nav.js`

Open `public/js/core/nav.js`. It has two lists to edit.

**1. The menu (`AREAS`).** Find the area the feature belongs in (here `records`) and add a module to its `modules` list. Put it after the last module in that area:

```js
      {
        key: 'notices',
        label: 'Notice Board',
        short: 'Notices',
        icon: 'bell',
        href: 'notices/board',
        tabs: [{ route: 'notices/board', label: 'Notice Board', icon: 'bell', screen: 'notices.board' }],
      },
```

- `key` is the module key (matches the server folder name).
- `short` is the label on phones.
- `icon` must be an icon in the sprite (`bell` is). See [adding an icon](frontend.md#adding-an-icon).
- `href` is the route the menu entry opens.
- `tabs` is the row of tabs inside the module. One tab is fine.

**2. The pages (`PAGES`).** Add one entry. It maps the route to the screen file and the privilege:

```js
  { pattern: 'notices/board', module: 'notices', tab: 'notices/board', title: 'Notice Board', subtitle: 'Short notices for everyone', short: 'Notices', screen: 'notices.board', view: { file: 'notices-board.js', mount: 'mountNoticesBoard' } },
```

- `pattern` is the route after `#`.
- `screen` is the **screen ID**, exactly as in the manifest.
- `view.file` is the file in `public/js/sections/`, and `view.mount` is the function that file exports. Both are checked at run time; a typo shows "Unable to Load This Page".

### Step 9. Write the screen

Create `public/js/sections/notices-board.js`:

```js
/*
 * notices-board (notices.board): the Notice Board. A list of 25 a page from the server, newest first.
 * Add, edit and delete follow the person's privileges (the server checks the same ones): without
 * `add` there is no New Notice button, without `edit` a row opens read-only, without `delete` there
 * is no Delete button.
 *
 *   mountNoticesBoard(outlet, { info })      (the page's `view` in core/nav.js)
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { h } from '../ui/html.js';
import { INPUT } from '../ui/classes.js';
import { pageHeader } from '../ui/page-header.js';
import { listView } from '../ui/list-view.js';
import { button } from '../ui/button.js';
import { pill } from '../ui/pill.js';
import { field, textInput, selectInput, setFieldErrors, clearFieldErrors } from '../ui/field.js';
import { openDialog } from '../ui/dialog.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';
import { formatDisplayDate } from '../core/dates.js';

const SCREEN = 'notices.board';
const priorityPill = (p) => pill(p === 'urgent' ? 'Urgent' : 'Normal', p === 'urgent' ? 'error' : 'neutral');

export async function mountNoticesBoard(outlet, { info } = {}) {
  const list = listView({
    columns: [
      { key: 'priority', label: 'Priority', render: (n) => priorityPill(n.priority) },
      { key: 'title', label: 'Title', className: 'font-semibold text-foreground' },
      { key: 'createdBy', label: 'Posted By', render: (n) => n.createdBy || '-' },
      { key: 'createdAt', label: 'Posted', render: (n) => formatDisplayDate(n.createdAt) || '-', className: 'text-muted-foreground' },
    ],
    load: ({ page }) => api.get(`/api/notices?page=${page}`),
    onPick: (n) => openNotice(n),
    card: {
      title: (n) => n.title,
      subtitle: (n) => `${formatDisplayDate(n.createdAt) || '-'} · ${n.createdBy || '-'}`,
      aside: (n) => priorityPill(n.priority),
    },
    empty: { icon: 'bell', title: 'No Notices Yet', text: can(SCREEN, 'add') ? 'Use New Notice to post the first one.' : 'Nothing has been posted.' },
  });

  const actions = can(SCREEN, 'add')
    ? [button({ label: 'New Notice', icon: 'plus', variant: 'primary', onClick: () => openNotice(null) })]
    : null;

  outlet.replaceChildren(
    pageHeader({ title: info ? info.title : 'Notice Board', subtitle: info ? info.subtitle : '', actions }),
    list.el
  );

  /** The dialog for one notice: a form to add (notice = null) or edit it, read-only without `edit`. */
  function openNotice(notice) {
    const editable = notice ? can(SCREEN, 'edit') : can(SCREEN, 'add');
    const form = h('form', { className: 'grid gap-3', novalidate: true, autocomplete: 'off' }, [
      field({ label: 'Title', control: textInput({ name: 'title', maxlength: 120, value: notice ? notice.title : '', disabled: !editable }) }),
      field({
        label: 'Priority',
        control: selectInput({ name: 'priority', options: [{ value: 'normal', label: 'Normal' }, { value: 'urgent', label: 'Urgent' }], value: notice ? notice.priority : 'normal', placeholder: null }),
      }),
      field({
        label: 'Notice',
        optional: true,
        control: h('textarea', { name: 'body', rows: '4', maxlength: '2000', className: INPUT, disabled: !editable, text: notice && notice.body ? notice.body : '' }),
      }),
    ]);

    const dlg = openDialog({ title: notice ? (editable ? 'Edit Notice' : 'Notice') : 'New Notice', body: form, size: 'md' });
    const get = (name) => (form.querySelector(`[name="${name}"]`) || {}).value;
    const footer = [button({ label: editable ? 'Cancel' : 'Close', variant: 'outline', onClick: () => dlg.close(false) })];

    if (notice && can(SCREEN, 'delete')) {
      footer.unshift(button({
        label: 'Delete', icon: 'trash-2', variant: 'danger',
        onClick: async () => {
          const ok = await confirmDialog({ title: 'Delete Notice?', message: `"${notice.title}" will be removed for everyone.`, confirmLabel: 'Delete', danger: true });
          if (!ok) return;
          try {
            await api.del(`/api/notices/${notice.id}`);
            toast('Notice deleted.');
            dlg.close(true);
            list.reload();
          } catch (err) {
            toast(err.message, 'error');
          }
        },
      }));
    }

    if (editable) {
      const save = button({ label: 'Save', icon: 'check', variant: 'primary', onClick: () => form.requestSubmit() });
      footer.push(save);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFieldErrors(form);
        save.disabled = true;
        const body = { title: get('title'), priority: get('priority'), body: get('body') };
        try {
          if (notice) await api.put(`/api/notices/${notice.id}`, body);
          else await api.post('/api/notices', body);
          toast(notice ? 'Notice saved.' : 'Notice posted.');
          dlg.close(true);
          list.reload({ resetPage: !notice });
        } catch (err) {
          if (err.fields) setFieldErrors(form, err.fields);   // the server's message for each field
          else toast(err.message, 'error');
        } finally {
          save.disabled = false;
        }
      });
    }
    dlg.setFooter(footer);
  }
}
```

How the screen works, so you can adapt it:

- `listView` draws the table on desktop and cards on phones, and handles paging. It calls `load({ page })` and expects the server's `{ data, meta }` shape.
- `can(screen, action)` hides what the person may not use. This is for tidiness only. **The server is the real check**, and it enforces the same privileges.
- `openDialog` shows the form. `setFieldErrors(form, err.fields)` puts each server message beside its field. That is why the service returns messages per field.
- `api.get/post/put/del` are in `public/js/core/api.js`. They throw an error with `.message`, `.status`, `.code` and `.fields` when the server answers with an error.
- Components come from `public/js/ui/`. Use these rather than writing raw HTML, so the screen matches the rest of the application in both light and dark themes and on phones. The [reference](#9-reference) lists them.

### Step 10. Rebuild CSS or icons only if needed

This screen uses only classes and icons that already exist, so **no build is needed**. For a screen of your own:

- If you use a Tailwind class no other screen uses, run `npm run css:build`. Until you do, the class has no effect.
- If you use an icon that is not in the sprite, add it to `scripts/build-icons.js` and run `npm run icons:build`. Until you do, the icon is a blank box with no error.

Details: [Frontend](frontend.md#build-steps).

---

## 6. Check the screen

Static files are served straight from disk in development, so **no restart is needed** for frontend changes, but you must reload the page properly (changing only the part after `#` does not reload it).

1. Open `http://localhost:3000/app#notices/board` and press `Ctrl+Shift+R` (hard reload).
2. You should see **Notice Board** under **Records**, with the demo notices in the list.
3. Click **New Notice**, leave the title empty and click **Save**. "Enter a title." appears beside the title.
4. Enter a title, click **Save**. The dialog closes, "Notice posted." appears, and the new notice is at the top.
5. Click the notice, change its priority to Urgent, **Save**.
6. Click it again, **Delete**, confirm. It disappears.
7. Narrow the browser window to phone width. The table becomes cards.
8. Switch between the light and dark themes with the theme toggle. Nothing should become unreadable.

### The same check as a script

Paste this into the browser console (`F12`, Console tab) while signed in on the `/app` page. It checks the API and the screen agree.

```js
(async () => {
  const main = document.getElementById('app-main');
  if (!main) throw new Error('Open the signed-in app at /app first (not the sign-in page).');
  const original = window.location.hash || '#dashboard';
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const waitFor = async (test, what) => {
    const end = Date.now() + 10000;
    while (Date.now() < end) { const value = test(); if (value) return value; await sleep(100); }
    throw new Error(`Timed out waiting for ${what}. The page shows: "${main.innerText.replace(/\s+/g, ' ').slice(0, 200)}"`);
  };

  // 1. the API, as this browser session sees it
  const res = await fetch('/api/notices?page=1', { credentials: 'include' });
  const api = await res.json();
  if (!res.ok) throw new Error(`GET /api/notices answered ${res.status}: ${api.error ? api.error.code : 'no JSON'}`);

  // 2. the screen: open the route, wait for the heading and for the rows to match the API
  window.location.hash = '#notices/board';
  await waitFor(() => { const h1 = main.querySelector('h1'); return h1 && h1.textContent.trim() === 'Notice Board'; }, 'the "Notice Board" heading');
  if (api.data.length) {
    await waitFor(() => main.querySelectorAll('tbody tr').length === api.data.length, `${api.data.length} table row(s)`);
  } else {
    await waitFor(() => main.innerText.includes('No Notices Yet'), 'the empty state');
  }
  console.log(`PASS #notices/board: heading shown, ${api.data.length} of ${api.meta.total} notice(s) drawn`);
  window.location.hash = original;
})().catch((err) => console.error(`FAIL ${err.message}`));
```

Expected: `PASS #notices/board: heading shown, N of N notice(s) drawn`. A failure names what it was waiting for and what the page showed instead.

### Check each role

| Sign in as | Expected on the Notice Board |
|---|---|
| `HICO001` / `Admin@123` (Administrator) | List, **New Notice**, edit, **Delete** |
| `HICO002` / `Officer@123` (Records Officer, after the seed above) | List, **New Notice**, edit; **no Delete** |
| `HICO004` / `Auditor@123` (Auditor) | "You Do Not Have Access to This Page" |

If a role sees something different, check its privileges in **Manage Roles**. Changes to a role take effect on the person's next request.

You are done. The module is complete when the smoke script passes, the screen behaves as above for all three roles, and the audit trail shows the writes.

---

## 7. Maintaining a module

### Add a field

Example: add a `pinned` flag to notices.

1. **New migration** (never edit the applied one):
   ```bash
   npm run migrate:make add_notices_pinned
   ```
   ```sql
   -- UP
   ALTER TABLE notices ADD COLUMN pinned TINYINT(1) NOT NULL DEFAULT 0;

   -- DOWN
   ALTER TABLE notices DROP COLUMN pinned;
   ```
   Then `npm run migrate:up`.
2. **Repo:** add the column to the `SELECT` lists, and to `insert` and `update`.
3. **Service:** add it to `toItem()` and `validate()` (for a yes/no field, convert with `body.pinned ? 1 : 0`).
4. **Screen:** add the control to the form and the value to the request body. Add a column if it should show in the list.
5. **Audit:** automatic. The audit record compares `before` and `after`, so the new field is included.
6. Restart the server and re-run the smoke script, extended to send and check the new field.

One statement per migration step is safest. If a migration stops half way, the first statements stay applied. See the [migration runbook](../runbooks/migrations.md).

### Add a screen to an existing module

1. Add a privilege to the manifest: `{ screen: 'notices.archive', label: 'Archive', actions: ['view'] }`.
2. Add the routes with `requirePrivilege('notices.archive', 'view')`.
3. In `nav.js` add a **tab** to the module's `tabs`, and a **page** to `PAGES` with the new route, `screen` and `view`.
4. Write the section file. Restart the server so the new privilege is added to the catalogue.
5. Give the privilege to roles in **Manage Roles**.

### Add an action to an existing screen

Add the action to the screen's `actions` list in the manifest (for example `'approve'`), guard the route with it, and use `can(SCREEN, 'approve')` in the screen. Restart the server. Grant it in **Manage Roles**.

### Change a rule

Rules live in the **service**. Change `validate()` or the service method, restart, and re-run the smoke script. Keep SQL in the repo and HTTP in the routes.

### Things never to do

- Never edit or delete a migration file that has been applied. See [Migrations](../runbooks/migrations.md).
- Never rename a screen ID in place. It is the privilege's name; roles are granted by it. Add the new one, move the grants, then retire the old one (see below).
- Never build SQL by joining request values into a string.
- Never rely on hiding a button as security. Guard the route.

## 8. Removing a module

**The server does not clean up after a removed module.** Deleting the folder leaves the table, the privileges and every role's grants in the database. Remove a module in this order. This is the procedure tested for the Notice Board, and it is safe on a shared database because it only adds a migration.

1. **Back up the database** if the table holds anything that matters.
2. **Add a migration that retires the data:**
   ```bash
   npm run migrate:make drop_notices
   ```
   ```sql
   -- UP
   -- The Notice Board is retired: its privileges (role grants go with them) and its table.
   DELETE FROM privileges WHERE screen = 'notices.board';
   DROP TABLE notices;

   -- DOWN
   -- Dropped data cannot be restored here; restore from a backup (docs/runbooks/database-recovery.md).
   SELECT 1;
   ```
   Deleting a privilege removes the role grants that reference it automatically.
3. **Remove the code:**
   - delete the folder `src/modules/notices/`
   - delete the module from `AREAS` and the page from `PAGES` in `public/js/core/nav.js`
   - delete `public/js/sections/notices-board.js`
   - delete any seed file that refers to the module (a seed that mentions a dropped table will fail)
4. **Keep the original `create_notices` migration.** It is part of the history. Deleting an applied migration file makes the migrator report it as `MISSING` and refuse to run.
5. **Apply and restart:**
   ```bash
   npm run migrate:up
   npm start
   ```
6. **Check:** the server starts, `GET /api/notices` is `404 Endpoint not found`, the menu entry is gone, and:
   ```bash
   mysql -h127.0.0.1 -ucirerms -p cirerms -e "SELECT COUNT(*) FROM privileges WHERE screen LIKE 'notices%'; SHOW TABLES LIKE 'notices'"
   ```
   returns `0` and no rows.

**Development shortcut.** On your own throw-away database, `npm run migrate:down` rolls back the most recent **batch**, which is every migration applied by the last `migrate:up`, not just one file. Check `npm run migrate:status` first. Only after a successful rollback may you delete the migration file. Do not use this on a shared or production database.

## 9. Reference

### Manifest fields (`<module>.module.js`)

| Field | Meaning |
|---|---|
| `key` | Module key; the folder name |
| `label` | Name in the privilege catalogue |
| `basePath` | Where the router mounts; must start with `/api/` |
| `routes` | Path to the routes file, relative to the manifest |
| `order` | Position in lists |
| `privileges` | `[{ screen, label, actions }]`; screen IDs are lowercase dotted; actions from `view`, `add`, `edit`, `delete`, `approve` |

### Route guards (`src/middleware/access.js`)

| Guard | Use |
|---|---|
| `requirePrivilege(screen, action)` | The person needs this privilege |
| `requireAnyPrivilege([...])` | Any one of several |
| `requireAuth` | Signed in only (set on the router with `router.use`) |

### Errors (`src/shared/errors.js`)

| Helper | HTTP | `error.code` |
|---|---|---|
| `badRequest(msg)` | 400 | `BAD_REQUEST` |
| `notFound(msg)` | 404 | `NOT_FOUND` |
| `validationError(msg, fields)` | 422 | `VALIDATION_ERROR` |

Also available: `unauthorized(msg)` (401 `UNAUTHORIZED`), `forbidden(msg)` (403 `FORBIDDEN`) and `conflict(msg)` (409 `CONFLICT`, for example a duplicate). Other statuses you will meet: 423 `SESSION_LOCKED` (idle lock), 429 `TOO_MANY_ATTEMPTS` (sign-in throttle), 500 `INTERNAL_ERROR` (unexpected; the cause is in the server log).

### Browser components (`public/js/ui/`)

| Need | Component |
|---|---|
| Screen title and buttons | `pageHeader({ title, subtitle, actions })` |
| A paged list (table and phone cards) | `listView({ columns, load, onPick, card, empty })` |
| Buttons | `button({ label, icon, variant, onClick })` |
| Status label | `pill(text, tone)` |
| Form field, text, dropdown | `field`, `textInput`, `selectInput`, `setFieldErrors`, `clearFieldErrors` |
| Dialog | `openDialog({ title, body, size })`, then `dlg.setFooter([...])`, `dlg.close()` |
| Confirm | `confirmDialog({ title, message, confirmLabel, danger })` |
| Message | `toast(text, 'error')` |
| Server calls | `api.get`, `api.post`, `api.put`, `api.del` from `core/api.js` |
| Privilege test | `can(screen, action)` from `core/access.js` |

Read the existing screens in `public/js/sections/` for patterns. Small ones to start with: `admin-audit.js` (list with filters) and `static-table.js`.

### Where to look next

- [Frontend](frontend.md): how the shell loads screens, CSS and icon builds.
- [Database and migrations](database.md).
- [Testing](testing.md).
- [CONVENTIONS.md](../../CONVENTIONS.md): the binding rules.
