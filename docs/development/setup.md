# Local Setup

## Prerequisites

- Node.js 20 or later (`node >=20`)
- npm
- MySQL 8, or the Docker Compose MySQL service
- Docker Desktop if using Compose
- Playwright only for browser walk-through tests
- Chromium or Chrome for local PDF generation

## Docker setup

Create `.env`, although Docker Compose supplies database variables directly:

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:3000`.

This Compose configuration is suitable for local demonstration and development. It uses development environment values and a placeholder JWT secret. Before internet-facing deployment, replace the Compose environment values with approved secrets and set `NODE_ENV=production`; do not expose the Compose ports or credential placeholders publicly.

The Compose setup provides:

- MySQL on port `3306`
- the Node application on port `3000`
- persistent MySQL data in `cirerms_mysql_data`
- persistent uploads in `cirerms_uploads`
- migrations and seeds before application startup

Stop the stack:

```bash
docker compose down
```

Do not use `docker compose down -v` unless deleting the MySQL and upload volumes is intentional.

## Local Node and MySQL setup

Create an empty database and a user for it. Run this as the MySQL administrator (use your own password):

```sql
CREATE DATABASE cirerms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cirerms'@'%' IDENTIFIED BY 'cirerms_password';
GRANT ALL ON cirerms.* TO 'cirerms'@'%';
```

Create configuration:

```bash
cp .env.example .env
```

Set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and a `JWT_SECRET`. A minimal working `.env` for development:

```text
NODE_ENV=development
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=cirerms
DB_PASSWORD=cirerms_password
DB_NAME=cirerms
JWT_SECRET=any-long-random-text-for-local-use
```

Use a long, private random `JWT_SECRET` in any shared or production environment.

Install and initialise:

```bash
npm install
npm run migrate:up
npm run seed
npm start
```

For source reloads:

```bash
npm run dev
```

## Required environment settings

Core settings are in `.env.example`. Important groups are:

- `NODE_ENV`, `HOST`, `PORT`
- `DB_*`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `SESSION_IDLE_MINUTES`, `SESSION_SERVER_GRACE_SECONDS`
- `UPLOAD_DIR` and upload size limits
- `PDF_CHROMIUM_PATH` and PDF limits
- `SMTP_*`, `MAIL_FROM` and `MAIL_DIR` (optional: Forgot Password e-mails a code; with no `SMTP_HOST` the message is written to `storage/mail/` instead)

`NODE_ENV=production` requires a `JWT_SECRET` that is not the development placeholder.

## First sign-in

After seeding, use the administrator account documented in the root README:

- Username: `HICO001`
- Password: `Admin@123`

Change the default password outside demonstration environments. The sign-in page shows no demo accounts; *Forgot password?* e-mails a one-time code (see the README, *Passwords*).

## Health check

```bash
curl http://localhost:3000/api/health
```

A healthy response reports database connectivity:

```json
{"data":{"status":"ok","database":"connected"}}
```

Docker Compose also has a database health check.

## Check your setup

1. `npm run migrate:status` lists every migration as `APPLIED`.
2. `curl http://localhost:3000/api/health` answers `200` as above.
3. Open `http://localhost:3000`, sign in as `HICO001`, and open a few screens.
4. In the Roles screen (**Manage Roles**) you can see the roles used in this documentation: Administrator, Records Officer, Auditor and others.

If any step fails, see [Troubleshooting](../runbooks/incident-troubleshooting.md#the-server-will-not-start).

## Docker and code changes

The Docker image contains a **copy** of the code taken when the image was built. After changing code, run `docker compose up --build`. Developing with Node directly (`npm run dev` or `npm start`) avoids this: the browser files are read from disk, and `npm run dev` restarts the server on change.

The Compose start command also runs `npm run seed` every time. The seeds load demo data; see [Deployment](../runbooks/deployment.md#read-this-first-what-the-seeds-do).

## Next

Build your first feature with [Creating and Maintaining Modules](modules.md).
