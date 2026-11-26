# Database and Migrations

## Database conventions

- MySQL 8 or compatible MariaDB
- `utf8mb4_unicode_ci`
- Real `DATE` and `DATETIME` values
- `ratings.service_number` is the natural primary key
- Child personnel tables reference `ratings.service_number`
- Surrogate integer primary keys use `INT UNSIGNED AUTO_INCREMENT`
- Lookup tables use the `ref_` prefix
- Parameterised SQL is used for every query
- No procedures, functions, triggers, or views

## Migration files

Migrations live in `src/db/migrations/`.

Filename pattern:

```text
20261120_070000_create_drafting.sql
```

Each file has both sections:

```sql
-- UP
CREATE TABLE example (...);

-- DOWN
DROP TABLE example;
```

Create a migration:

```bash
npm run migrate:make add_example_table
```

Apply migrations:

```bash
npm run migrate:up
```

Check status:

```bash
npm run migrate:status
```

Roll back (development databases only):

```bash
npm run migrate:down      # the most recent batch
npm run migrate:down 2    # the two most recent batches
```

The number counts **batches**, not files. A batch is everything one `migrate:up` applied, so a rollback can undo several files.

The migration table stores the filename, batch, checksum, and applied time. **Editing or deleting an applied file makes the migrator report `CHANGED` or `MISSING` and refuse to run anything else.** Never do it. Add a new migration instead.

The migrator uses an advisory lock and stops at the first failed statement. MySQL commits schema changes immediately, so if a migration fails part-way the earlier statements stay applied and the file stays `PENDING`. See the [migration runbook](../runbooks/migrations.md#a-migration-stopped-half-way) for the recovery steps.

### A model migration

```sql
-- UP
CREATE TABLE notices (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title       VARCHAR(120) NOT NULL,
  created_by  INT UNSIGNED NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notices_created (created_at),
  CONSTRAINT fk_notices_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='What the table is for.';

-- DOWN
DROP TABLE notices;
```

Name keys and constraints (`idx_<table>_<what>`, `fk_<table>_<what>`), say what happens on delete, and add a table comment. A complete worked example is in [Creating and Maintaining Modules](modules.md#step-1-create-the-table). To add a column later, make a new migration. To remove a feature, see [Removing a module](modules.md#8-removing-a-module).

## Seeds

Seeds live in `src/db/seeds/` and run in filename order. **They run again every time**, so they must be safe to rerun: use `INSERT IGNORE`, or `INSERT ... SELECT ... WHERE NOT EXISTS`.

The existing seeds contain **demo data** (demo ratings and demo accounts with documented passwords). See [Deployment](../runbooks/deployment.md#read-this-first-what-the-seeds-do) before running them anywhere that is not a development machine.

```bash
npm run seed
```

Starting the application synchronises module privileges from manifests. Seeding also has demo data and role setup for development.

## Fresh databases

Use only in development or test environments:

```bash
npm run migrate:fresh
npm run seed
```

This refuses to run when `NODE_ENV=production`.

## Transactions

Use `db.transaction()` when a write spans multiple tables or imports multiple rows. A transaction should include any associated audit write.
