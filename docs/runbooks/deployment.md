# Application Deployment

## Read this first: what the seeds do

`npm run seed` (and therefore the standard Compose start command) loads **demo data**: demo ratings and demo user accounts with documented passwords, including an Administrator account (`HICO001`). The repository has no separate set of production-only seeds.

Before the first deployment to any real environment, decide with the project owner exactly which seeds may run there, and what happens to the demo accounts. Do not leave accounts with documented passwords on a live system.

Seeds are safe to repeat (they do not duplicate rows), but the Compose command runs them on **every start**, so a deleted demo account or lookup row will come back.

## Before deployment

1. Identify the release commit and the target environment.
2. Back up MySQL ([Database recovery](database-recovery.md)).
3. Back up the upload volume or directory ([Uploads and storage](storage-and-uploads.md)).
4. Run `npm run migrate:status` against the target and read it. Look for `CHANGED` or `MISSING`.
5. Read the new migration files in the release. Check for anything that drops or rewrites data.
6. Confirm environment variables and secrets, in particular `JWT_SECRET` (required in production; changing it signs everyone out).
7. Confirm Chromium (PDF printouts) and upload storage are available.

## Docker Compose deployment

From the release checkout:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=200 app
```

The image copies the code when it is **built**. `--build` is what puts the new release into the container. (`docker compose pull` only fetches the database image; the application image is built locally.)

The application container runs migrations and seeds before it starts:

```text
npm run migrate:up && npm run seed && npm start
```

So **a failed migration stops the application from starting**. Read `docker compose logs app` and follow [Migrations](migrations.md).

After deployment:

```bash
curl -i http://localhost:3000/api/health
docker compose exec app npm run migrate:status
```

Expect `200` with `"database":"connected"`, and every migration `APPLIED`.

Then verify by hand: sign in, open a few screens from different areas, perform one read, and, if available, one upload and one printout.

## Non-Docker deployment

1. Deploy the Node application with its `public/` folder.
2. Install dependencies: `npm ci --omit=dev`.
3. Build the CSS if it is not committed with the release: `npm run css:build` (needs the dev dependencies).
4. Apply migrations: `npm run migrate:up`. Run seeds only as decided in the section above.
5. Restart the Node process (with your process manager).
6. Check `/api/health` and `npm run migrate:status`.

The server reads its code once at startup, so a code change needs a restart. Static files are served from disk: a change to files under `public/` needs no restart, but browsers may hold them for up to an hour in production.

Never run `migrate:fresh` in production.

## Rollback

Rolling back the application does not reverse database changes.

1. Stop new traffic or new writes if necessary.
2. Restore the previous application image or source revision (`git checkout <previous release>` then `docker compose up -d --build`).
3. Do **not** roll back SQL migrations unless their DOWN scripts and the data impact have been explicitly reviewed. A DOWN script that drops a table destroys its data.
4. If the release changed the schema incompatibly or altered business data, restore the database from the backup taken before deployment.
5. Restore uploads if the release touched or moved the storage directory.
6. Verify sign-in and `/api/health`.

Where possible, prefer **fixing forward** with a new migration to rolling back. Because earlier code keeps working only if the schema still suits it, add columns as optional (`NULL` or with a default) so the previous release continues to run against the new schema.
