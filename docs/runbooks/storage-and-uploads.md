# Upload and Storage Runbook

## Storage locations

Uploaded files are kept outside `public/`:

- photos: `storage/uploads/photos`
- documents: `storage/uploads/documents`
- the root of both is `UPLOAD_DIR` (default `./storage/uploads`)

Docker Compose mounts the root at `/app/storage/uploads` using the named volume `cirerms_uploads`. Files are stored under generated (UUID) names, and the database records which stored file belongs to which photo or document. They are served only through authenticated API routes. Never add a static route for them.

## Limits and checks

| Setting | Default | Limits |
|---|---|---|
| `MAX_PHOTO_SIZE_MB` | 5 | photos |
| `MAX_DOC_SIZE_MB` | 15 | documents |
| `MAX_EXCEL_SIZE_MB` | 10 | `.xlsx` batch workbooks |

Every upload is checked for size, extension **and** file signature (the first bytes of the file). A file renamed to a different type is refused.

## Check disk and volume

Docker:

```bash
docker compose exec app df -h /app/storage/uploads
docker volume ls
```

Compose prefixes named volumes with the project name, so the real name is not necessarily `cirerms_uploads`. Read the exact name from the `docker volume ls` output and use that in volume commands.

Host:

```bash
df -h
```

Free only known temporary or cache data. Do not recursively delete upload directories without an approved backup and recovery plan.

## Check permissions

Docker runs the application as the `node` user. The mounted volume and its folders must be readable and writable by that user. A permission problem typically shows as an upload request that fails with a server error, with an `EACCES` (permission denied) message in the application log:

```bash
docker compose logs --tail=200 app
docker compose exec app ls -ld /app/storage/uploads /app/storage/uploads/photos /app/storage/uploads/documents
docker compose exec app sh -c "touch /app/storage/uploads/.write-test && rm /app/storage/uploads/.write-test && echo writable"
```

## Back up uploads

Docker named volume (use the real volume name):

```bash
docker run --rm \
  -v <actual-compose-upload-volume>:/data \
  -v "${PWD}:/backup" \
  alpine tar czf /backup/cirerms_uploads_backup.tar.gz -C /data .
```

Local configured directory:

```bash
tar czf cirerms_uploads_backup.tar.gz storage/uploads
```

Adapt the commands for your shell and your approved backup system. Take this backup at the same time as the database backup.

## Restore uploads

Restore to the same configured root and keep the generated filenames unchanged, because the database refers to them. Restore only after confirming the target volume is not in use by another running application.

## File failures

If an upload is refused, the response says why. Check size, extension and signature in that order ([Troubleshooting](incident-troubleshooting.md#uploads)).

If a file is valid but cannot be found after a restore, compare the filename recorded in the database for that photo or document with the files in the storage directory. A record with no file means the uploads backup is older than the database backup, or the volume was not restored.
