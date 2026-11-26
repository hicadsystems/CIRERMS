# Database Recovery

Back up, restore, and what to do when the database is unavailable. The commands use the default credentials from `docker-compose.yml` (`cirerms` / `cirerms_password`, root password `root_password`). Use your own values wherever the environment differs.

## Back up MySQL

Do this before every deployment, and on a schedule.

Docker Compose:

```bash
docker compose exec db mysqldump -ucirerms -pcirerms_password \
  --single-transaction --routines=false --triggers=false cirerms \
  > cirerms-backup.sql
```

Local MySQL:

```bash
mysqldump -h127.0.0.1 -ucirerms -p \
  --single-transaction --routines=false --triggers=false cirerms \
  > cirerms-backup.sql
```

Check the backup is real: the file should be more than a few kilobytes, and its last line should be a `-- Dump completed on ...` comment.

```bash
tail -n 2 cirerms-backup.sql
```

Keep backups somewhere other than the machine that runs the database. Store credentials outside shell history in production. **Test restoring a backup into a spare database periodically**: a backup you have never restored is a hope, not a backup. A backup includes the `migrations` table, so a restored database knows which migrations it has had.

Uploaded files are not in the database dump. Back them up too ([Uploads and storage](storage-and-uploads.md)), and keep the two backups from the same time together.

## Restore MySQL

Stop application writes first.

Docker:

```bash
docker compose stop app
docker compose exec -T db mysql -uroot -proot_password cirerms < cirerms-backup.sql
docker compose start app
```

Local:

```bash
mysql -h127.0.0.1 -ucirerms -p cirerms < cirerms-backup.sql
```

The dump drops and recreates each table, so restoring replaces what is there.

Then confirm:

```bash
docker compose exec app npm run migrate:status      # or: npm run migrate:status
curl -i http://localhost:3000/api/health
```

Every migration should be `APPLIED` (or `PENDING`, if the backup is older than the code, in which case the next start applies them). Sign in and look at recent records on a screen you know.

Note that the application container runs `npm run seed` each time it starts. That re-creates any missing demo rows and privileges; see the warning in [Deployment](deployment.md).

## Full Docker volume recovery

For a complete volume restore, stop Compose, attach the intended backup to a disposable restore container, and replace the named volume only after validating the backup outside the live system. Do not use `docker compose down -v` as a recovery shortcut: it deletes the database and the uploads volumes.

Before replacing a volume:

1. Stop `app` and `db`.
2. Confirm the real volume names with `docker volume ls` and the mount points in `docker-compose.yml` (`cirerms_mysql_data` and `cirerms_uploads`, prefixed by the Compose project name).
3. Keep the current volume as an archive or a named copy.
4. Restore with an approved, database-specific procedure.

## Database unavailable

Symptoms: `/api/health` answers `503 DB_UNAVAILABLE`; other API calls answer `500`; the log shows `ECONNREFUSED`. See [Troubleshooting](incident-troubleshooting.md#the-server-is-up-but-the-database-is-not).

1. Check the container or process state: `docker compose ps`.
2. Read the database log: `docker compose logs --tail=200 db`.
3. Check disk space and memory on the host. A full disk is a common cause.
4. Check the credentials and host the application is using.
5. Ping it: `docker compose exec db mysqladmin ping -h 127.0.0.1 -ucirerms -pcirerms_password`.
6. Restart **only the database service**, and only after you understand why it stopped: `docker compose restart db`.
7. Do not restart the application for this. It reconnects by itself when the database returns.
8. Do not run migrations until the database is stable.
