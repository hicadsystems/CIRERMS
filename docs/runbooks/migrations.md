# Migration Runbook

How the database schema is changed and recovered. For writing a migration, see [Database and migrations](../development/database.md). For what the messages mean, see [Troubleshooting](incident-troubleshooting.md#migration-problems).

## Check state

```bash
npm run migrate:status          # docker compose exec app npm run migrate:status
```

Example:

```text
STATUS     BATCH    APPLIED AT (UTC)       MIGRATION
APPLIED    1        2026-11-24 16:44:19    20261120_120000_create_appraisal.sql
APPLIED    2        2026-11-25 05:09:24    20261125_050342_create_notices.sql
PENDING    -        -                      20261126_090000_add_notices_pinned.sql
```

The columns are the state, the batch number, when it was applied, and the file name. A pending file has no batch yet.

| State | Meaning | Action |
|---|---|---|
| `APPLIED` | Recorded, and the file matches its checksum | None |
| `PENDING` | Not run yet | `npm run migrate:up` |
| `CHANGED` | The applied file's text now differs from what was run | Restore the original text; make a new migration for the change |
| `MISSING` | Recorded as applied, but the file is not on disk | Restore the file from the release it came from |

`CHANGED` or `MISSING` blocks `migrate:up` entirely, on purpose.

## Apply pending migrations

Take a database backup first.

```bash
npm run migrate:up
npm run migrate:status
```

Everything pending is applied together as one **batch**. The migrator holds a named lock while it runs, so two runs cannot collide.

## Roll back

```bash
npm run migrate:down          # the most recent batch
npm run migrate:down 2        # the two most recent batches
```

The number counts **batches, not files**. A batch is everything that one `migrate:up` applied, so rolling back one batch may undo several files. Look at `migrate:status` first and see which files share the batch number.

Only use DOWN scripts on a throw-away database, or after reviewing the data-loss impact. On a shared or production database, fix forward with a new migration. Delete a migration file only after it has been rolled back successfully, and never delete an applied one otherwise.

## A migration stopped half way

MySQL commits each schema change immediately, so when statement 2 of 3 fails, statement 1 stays in place and the file stays `PENDING`. The error names the file, the statement number, the MySQL error and the statements that already ran.

1. Keep the complete output.
2. Run `npm run migrate:status`. The file should be `PENDING`.
3. Undo, by hand, what the earlier statements did, so the database is back to the state before the file.
4. Correct the SQL in the file. This is allowed because it was never recorded as applied. (If it was applied on **any other** database, do not edit it: add a new migration.)
5. Run `npm run migrate:up`, then `npm run migrate:status`.

If you cannot tell what state the database is in, restore from the backup and start again.

Keep migrations to small steps, one change per statement where possible, so a failure leaves less to untangle.

## Checksum drift (`CHANGED`)

Never modify an applied migration. Restore the original file (from version control), then add a new migration for the change:

```bash
npm run migrate:make fix_<issue>
npm run migrate:up
```

## Missing migration (`MISSING`)

A file was removed, or a server checkout is incomplete.

1. Stop migration jobs.
2. Restore the missing file from the release it belongs to. It must be byte-for-byte the original.
3. Run `npm run migrate:status`.
4. Do not delete rows from the `migrations` table to "make it go away".

## Removing a feature's tables

Retire a module with a **new** migration that drops its table and its privileges, and leave the original create migration in place. The full procedure is in [Creating and Maintaining Modules](../development/modules.md#8-removing-a-module).

## Fresh database

Only on a disposable development database. Drops everything and rebuilds it:

```bash
npm run migrate:fresh
npm run seed
```

It refuses to run when `NODE_ENV=production`.
