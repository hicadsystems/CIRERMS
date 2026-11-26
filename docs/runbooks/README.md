# CIRERMS Runbooks

Use these when you maintain the system, or when something is broken and you need to know where to look and what to do.

| Runbook | Use when |
|---|---|
| [Troubleshooting](incident-troubleshooting.md) | Something is unavailable, wrong, or showing an error. Start here. It is organised by what you see |
| [Deployment](deployment.md) | Deploying a release, or rolling one back |
| [Migrations](migrations.md) | A migration is pending, failed half way, changed or missing |
| [Database recovery](database-recovery.md) | The database is down, or data must be backed up or restored |
| [Uploads and storage](storage-and-uploads.md) | Uploads fail, a volume is full, or files must be backed up |

Adding or removing a feature is covered in [Creating and Maintaining Modules](../development/modules.md).

## Rules that always apply

1. Back up the database before any schema or destructive change.
2. Never run `npm run migrate:fresh` outside a disposable environment. It drops everything, and refuses to run when `NODE_ENV=production`.
3. Never edit or delete a migration that has been applied. Add a new one.
4. Diagnose the **backend first** (health, logs, the API itself), the screen second.
5. Write down what you saw and what you did: the service, the migration, the exact message, who ran what.

## Where to find what

| I need | Look here |
|---|---|
| The server start-up and shutdown | `src/server.js` |
| Express setup, security headers, static files, `/api/health`, 404 for unknown API paths | `src/app.js` |
| Every setting and its default | `src/config/index.js` (the variables are listed below); `.env.example` |
| Which modules exist and how they are mounted | `src/modules/index.js` (the loader) and each `src/modules/<name>/<name>.module.js` |
| An API route | `src/modules/<name>/<name>.routes.js` |
| Business rules and validation | `src/modules/<name>/<name>.service.js` |
| SQL | `src/modules/<name>/<name>.repo.js` |
| Who may do what | `src/middleware/access.js` (guards), `src/middleware/auth.js` (sign-in check), `src/modules/access/` (roles and privileges) |
| Error types and their HTTP statuses | `src/shared/errors.js`; the handler is `src/middleware/error.js` |
| The audit trail | `src/shared/audit.js` writes it; the table is `audit_trail`; the screen is **Audit Trail** |
| Database connection and transactions | `src/db/index.js` |
| Migrations (schema history) | `src/db/migrations/`; the tool is `src/db/migrator.js`, run through `migrate.js` |
| Seed data | `src/db/seeds/` |
| File upload checks | `src/middleware/upload.js`; Excel helpers `src/shared/excel.js` |
| Uploaded files on disk | `storage/uploads/` (photos, documents), or `UPLOAD_DIR` |
| PDF printouts | `src/shared/printouts/` (the browser), `src/templates/printouts/` (the templates) |
| The sign-in page and the app shell | `public/index.html`, `public/app.html` |
| Which screens exist, and their routes | `public/js/core/nav.js` (`AREAS` for the menu, `PAGES` for routes) |
| A screen | `public/js/sections/<screen>.js` |
| Reusable screen parts | `public/js/ui/`; the guide to them is [docs/design/components.md](../design/components.md) |
| Browser API client and privilege helper | `public/js/core/api.js`, `public/js/core/access.js` |
| Styles and icons (generated) | `public/css/output.css`, `public/assets/icons.svg`; sources `public/css/input.css`, `scripts/build-icons.js` |
| Automated walk-throughs | `tests/e2e/` |
| The binding coding rules | [CONVENTIONS.md](../../CONVENTIONS.md) |

## Settings

Set in `.env` (see `.env.example`) or in the Compose environment. Defaults are in `src/config/index.js`.

| Variable | Default | Meaning |
|---|---|---|
| `NODE_ENV` | | `production` turns on stricter behaviour (a `JWT_SECRET` is required, static files are cached for an hour) |
| `PORT` | 3000 | HTTP port |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | | The database. Inside Compose the host is `db` |
| `DB_POOL_LIMIT` | 10 | Database connection pool size |
| `JWT_SECRET` | | Required in production. Changing it signs everyone out, and makes any e-mailed Forgot Password code still unused stop working |
| `JWT_EXPIRES_IN` | 8h | Session token lifetime |
| `SESSION_IDLE_MINUTES` | 15 | Idle time before a session locks |
| `SESSION_SERVER_GRACE_SECONDS` | 120 | Seconds added to the idle time before the server itself treats the session as idle |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | empty, 587, false | The mail server Forgot Password sends its code through. With no `SMTP_HOST`, production starts with a warning and sends no code (the page still answers the same); development writes the message to `MAIL_DIR` |
| `SMTP_USER`, `SMTP_PASSWORD` | empty | The mail server's sign-in, when it needs one |
| `MAIL_FROM` | `CIRERMS <no-reply@cirerms.example>` | The sender of that e-mail |
| `MAIL_DIR` | `./storage/mail` | Where development mail is written when `SMTP_HOST` is empty |
| `UPLOAD_DIR` | `./storage/uploads` | Where uploads are stored |
| `MAX_PHOTO_SIZE_MB`, `MAX_DOC_SIZE_MB`, `MAX_EXCEL_SIZE_MB` | 5, 15, 10 | Upload limits |
| `PDF_CHROMIUM_PATH` | | A Chromium to use for PDFs; otherwise the bundled one |
| `PDF_TIMEOUT_MS`, `PDF_MAX_HTML_MB`, `PDF_TEMP_DIR`, `PDF_TAB_POOL_SIZE` | 60000, 10, the system temporary folder, 2 | PDF rendering limits |

## Key commands

```bash
# is it up, and what did it say
docker compose ps
docker compose logs --tail=200 app
docker compose logs --tail=200 db
curl -i http://localhost:3000/api/health

# schema state
docker compose exec app npm run migrate:status      # with Docker
npm run migrate:status                              # running directly

# rebuild generated front-end files
npm run css:build
npm run icons:build
```

## How a request travels

```text
browser screen   public/js/sections/<screen>.js      (found through public/js/core/nav.js)
      |  api.get / post / put / del
      v
src/middleware/auth.js       is there a valid, unlocked session?
      v
src/middleware/access.js     does the role hold this privilege?
      v
src/modules/<m>/<m>.routes.js    ->  <m>.service.js    ->  <m>.repo.js    ->  MySQL
```

Faults show up in a particular place for a reason: a 401, 403 or 423 comes from the middleware before your route runs; a 404 "Endpoint not found" means no route matched; a 500 comes from the service, repo or database. [Troubleshooting](incident-troubleshooting.md) uses this to send you to the right place.
