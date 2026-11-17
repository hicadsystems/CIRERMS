#!/usr/bin/env node
'use strict';

const db = require('./src/db');
const migrator = require('./src/db/migrator');

function formatTimestamp(val) {
  if (!val) return '-';
  if (val instanceof Date) {
    return val.toISOString().replace('T', ' ').slice(0, 19);
  }
  return String(val).slice(0, 19);
}

function printStatusTable(rows) {
  if (rows.length === 0) {
    console.log('No migration files found.');
    return;
  }

  const statusWidth = 9;
  const batchWidth = 7;
  const timeWidth = 21;
  const nameWidth = Math.max(24, ...rows.map((r) => r.name.length));

  const header = [
    'STATUS'.padEnd(statusWidth),
    'BATCH'.padEnd(batchWidth),
    'APPLIED AT (UTC)'.padEnd(timeWidth),
    'MIGRATION'.padEnd(nameWidth),
  ].join('  ');

  console.log(header);
  console.log('-'.repeat(header.length));

  for (const row of rows) {
    console.log([
      row.status.padEnd(statusWidth),
      (row.batch == null ? '-' : String(row.batch)).padEnd(batchWidth),
      formatTimestamp(row.appliedAt).padEnd(timeWidth),
      row.name,
    ].join('  '));
  }

  const changedOrMissing = rows.filter((r) => r.status === 'CHANGED' || r.status === 'MISSING');
  if (changedOrMissing.length > 0) {
    console.log(
      `\nWarning: ${changedOrMissing.length} applied migration(s) flagged as CHANGED or MISSING.`
    );
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'make': {
      const name = args.join('_');
      const created = migrator.makeMigration(name);
      console.log(`Created migration: src/db/migrations/${created.fileName}`);
      return;
    }

    case 'up': {
      const result = await migrator.migrateUp();
      if (result.applied.length === 0) {
        console.log('Nothing to migrate — database is up to date.');
      } else {
        console.log(`Applied ${result.applied.length} migration(s) in batch ${result.batch}:`);
        result.applied.forEach((f) => console.log(`  + ${f}`));
      }
      return;
    }

    case 'down': {
      const steps = args[0] ? args[0] : 1;
      const result = await migrator.migrateDown(steps);
      if (result.rolledBack.length === 0) {
        console.log('Nothing to roll back.');
      } else {
        console.log(
          `Rolled back ${result.rolledBack.length} migration(s) from batch(es) [${result.batches.join(', ')}]:`
        );
        result.rolledBack.forEach((f) => console.log(`  - ${f}`));
      }
      return;
    }

    case 'status': {
      const rows = await migrator.migrateStatus();
      printStatusTable(rows);
      return;
    }

    case 'fresh': {
      const result = await migrator.migrateFresh();
      console.log(`Dropped ${result.dropped.length} table(s).`);
      console.log(
        `Applied ${result.migration.applied.length} migration(s) in batch ${result.migration.batch || '-'}:`
      );
      result.migration.applied.forEach((f) => console.log(`  + ${f}`));
      console.log(`Executed ${result.seeds.length} seed file(s):`);
      result.seeds.forEach((s) => console.log(`  * ${s.name} (${s.statements} statements)`));
      return;
    }

    case 'seed': {
      const results = await migrator.seed();
      if (results.length === 0) {
        console.log('No seed files found.');
      } else {
        console.log(`Executed ${results.length} seed file(s):`);
        results.forEach((s) => console.log(`  * ${s.name} (${s.statements} statements)`));
      }
      return;
    }

    default: {
      console.error(
        'Usage: node migrate.js <make|up|down|status|fresh|seed> [args]\n'
        + '  npm run migrate:make <name>\n'
        + '  npm run migrate:up\n'
        + '  npm run migrate:down [steps]\n'
        + '  npm run migrate:status\n'
        + '  npm run migrate:fresh\n'
        + '  npm run seed'
      );
      process.exitCode = 1;
    }
  }
}

main()
  .catch((err) => {
    console.error(`\n[migrate] ERROR: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.close();
  });
