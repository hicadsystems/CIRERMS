'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const db = require('./index');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const SEEDS_DIR = path.join(__dirname, 'seeds');
const LOCK_NAME = `cirerms_migrate_${config.db.database}`.slice(0, 64);
const LOCK_TIMEOUT_SECONDS = 10;

function computeChecksum(rawContent) {
  const normalised = rawContent.replace(/\r\n/g, '\n');
  return crypto.createHash('sha256').update(normalised, 'utf8').digest('hex');
}

/**
 * Parse a migration file into its `-- UP` and `-- DOWN` SQL blocks.
 */
function parseMigrationFile(rawContent, fileName) {
  const lines = rawContent.replace(/\r\n/g, '\n').split('\n');
  let section = null;
  let sawUp = false;
  let sawDown = false;
  const upLines = [];
  const downLines = [];

  for (const line of lines) {
    if (/^\s*--\s*UP\s*$/i.test(line)) {
      if (sawUp) {
        throw new Error(`Migration ${fileName} contains multiple "-- UP" markers.`);
      }
      section = 'up';
      sawUp = true;
      continue;
    }
    if (/^\s*--\s*DOWN\s*$/i.test(line)) {
      if (sawDown) {
        throw new Error(`Migration ${fileName} contains multiple "-- DOWN" markers.`);
      }
      section = 'down';
      sawDown = true;
      continue;
    }
    if (section === 'up') upLines.push(line);
    else if (section === 'down') downLines.push(line);
  }

  if (!sawUp || !sawDown) {
    throw new Error(`Migration ${fileName} must contain both "-- UP" and "-- DOWN" sections.`);
  }

  return {
    up: upLines.join('\n'),
    down: downLines.join('\n'),
  };
}

/**
 * Split a SQL script into individual executable statements while preserving
 * semicolons inside quotes, backticks, and comments.
 */
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let hasCode = false;
  let mode = 'normal'; // normal | single | double | backtick | line_comment | block_comment

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1] || '';

    if (mode === 'line_comment') {
      if (ch === '\n') {
        mode = 'normal';
        current += ch;
      }
      continue;
    }

    if (mode === 'block_comment') {
      if (ch === '*' && next === '/') {
        mode = 'normal';
        i += 1;
      }
      continue;
    }

    if (mode === 'single') {
      current += ch;
      if (ch === '\\' && next) {
        current += next;
        i += 1;
      } else if (ch === '\'' && next === '\'') {
        current += next;
        i += 1;
      } else if (ch === '\'') {
        mode = 'normal';
      }
      continue;
    }

    if (mode === 'double') {
      current += ch;
      if (ch === '\\' && next) {
        current += next;
        i += 1;
      } else if (ch === '"' && next === '"') {
        current += next;
        i += 1;
      } else if (ch === '"') {
        mode = 'normal';
      }
      continue;
    }

    if (mode === 'backtick') {
      current += ch;
      if (ch === '`' && next === '`') {
        current += next;
        i += 1;
      } else if (ch === '`') {
        mode = 'normal';
      }
      continue;
    }

    // Normal mode
    if (ch === '-' && next === '-' && (i + 2 >= sql.length || /\s/.test(sql[i + 2]))) {
      mode = 'line_comment';
      i += 1;
      continue;
    }
    if (ch === '#') {
      mode = 'line_comment';
      continue;
    }
    if (ch === '/' && next === '*') {
      mode = 'block_comment';
      i += 1;
      continue;
    }
    if (ch === '\'') {
      mode = 'single';
      hasCode = true;
      current += ch;
      continue;
    }
    if (ch === '"') {
      mode = 'double';
      hasCode = true;
      current += ch;
      continue;
    }
    if (ch === '`') {
      mode = 'backtick';
      hasCode = true;
      current += ch;
      continue;
    }

    if (ch === ';') {
      const trimmed = current.trim();
      if (hasCode && trimmed) {
        statements.push(trimmed);
      }
      current = '';
      hasCode = false;
      continue;
    }

    if (!/\s/.test(ch)) {
      hasCode = true;
    }
    current += ch;
  }

  const trailing = current.trim();
  if (hasCode && trailing) {
    statements.push(trailing);
  }

  return statements;
}

function readDiskSqlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const fullPath = path.join(dir, name);
      const content = fs.readFileSync(fullPath, 'utf8');
      return {
        name,
        fullPath,
        content,
        checksum: computeChecksum(content),
      };
    });
}

async function ensureMigrationsTable(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name       VARCHAR(255) NOT NULL,
      batch      INT UNSIGNED NOT NULL,
      checksum   CHAR(64)     NOT NULL,
      applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_migrations_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function getAppliedMigrations(conn) {
  const [rows] = await conn.query(
    'SELECT id, name, batch, checksum, applied_at FROM migrations ORDER BY id ASC'
  );
  return rows;
}

async function withLock(work) {
  const conn = await db.getPool().getConnection();
  let acquired = false;
  try {
    const [rows] = await conn.query('SELECT GET_LOCK(?, ?) AS locked', [
      LOCK_NAME,
      LOCK_TIMEOUT_SECONDS,
    ]);
    if (!rows[0] || Number(rows[0].locked) !== 1) {
      throw new Error(
        `Could not acquire migration lock "${LOCK_NAME}" within ${LOCK_TIMEOUT_SECONDS}s. `
        + 'Another migration run may be in progress.'
      );
    }
    acquired = true;
    return await work(conn);
  } finally {
    if (acquired) {
      try {
        await conn.query('SELECT RELEASE_LOCK(?)', [LOCK_NAME]);
      } catch (_) {
        // Connection closing releases advisory locks automatically
      }
    }
    conn.release();
  }
}

function assertNoChecksumDrift(appliedRows, diskMap) {
  const problems = [];
  for (const row of appliedRows) {
    const disk = diskMap.get(row.name);
    if (!disk) {
      problems.push(`  - [MISSING] ${row.name} (applied in batch ${row.batch}, file not found on disk)`);
    } else if (disk.checksum !== row.checksum) {
      problems.push(
        `  - [CHANGED] ${row.name} (applied in batch ${row.batch}; expected ${row.checksum.slice(0, 12)}…, got ${disk.checksum.slice(0, 12)}…)`
      );
    }
  }
  if (problems.length > 0) {
    throw new Error(
      'Migration integrity check failed — already-applied migrations have been modified or removed:\n'
      + problems.join('\n')
      + '\nRestore the applied file(s) and create a new migration with `npm run migrate:make <name>` instead.'
    );
  }
}

function formatStatementFailure({ direction, fileName, stmtIndex, totalStmts, stmt, appliedStmts, completedFiles, err }) {
  const preview = stmt.length > 500 ? `${stmt.slice(0, 500)}…` : stmt;
  const lines = [
    `Migration ${direction} failed in ${fileName} at statement ${stmtIndex + 1} of ${totalStmts}.`,
    `MySQL error [${err.code || err.errno || 'UNKNOWN'}]: ${err.message}`,
    '',
    'Failing statement:',
    preview,
    '',
    `Files fully completed earlier in this run: ${completedFiles.length ? completedFiles.join(', ') : 'none'}`,
    `Statements already executed in ${fileName} (MySQL commits DDL immediately): ${appliedStmts.length} of ${totalStmts}`,
  ];
  if (appliedStmts.length > 0) {
    appliedStmts.forEach((s, idx) => {
      const firstLine = s.split('\n')[0].slice(0, 120);
      lines.push(`  ${idx + 1}. ${firstLine}`);
    });
    lines.push('Warning: This migration file is partially applied — inspect the schema and fix forward.');
  }
  const wrapped = new Error(lines.join('\n'));
  wrapped.cause = err;
  return wrapped;
}

async function runStatements(conn, { direction, fileName, statements, completedFiles }) {
  const appliedStmts = [];
  for (let i = 0; i < statements.length; i += 1) {
    const stmt = statements[i];
    try {
      await conn.query(stmt);
      appliedStmts.push(stmt);
    } catch (err) {
      throw formatStatementFailure({
        direction,
        fileName,
        stmtIndex: i,
        totalStmts: statements.length,
        stmt,
        appliedStmts,
        completedFiles,
        err,
      });
    }
  }
}

async function runUpOnConn(conn) {
  await ensureMigrationsTable(conn);
  const diskFiles = readDiskSqlFiles(MIGRATIONS_DIR);
  const diskMap = new Map(diskFiles.map((f) => [f.name, f]));
  const applied = await getAppliedMigrations(conn);
  const appliedSet = new Set(applied.map((r) => r.name));

  assertNoChecksumDrift(applied, diskMap);

  const pending = diskFiles.filter((f) => !appliedSet.has(f.name));
  if (pending.length === 0) {
    return { batch: null, applied: [] };
  }

  const maxBatch = applied.reduce((max, r) => Math.max(max, Number(r.batch)), 0);
  const nextBatch = maxBatch + 1;
  const completedFiles = [];

  for (const file of pending) {
    const parsed = parseMigrationFile(file.content, file.name);
    const statements = splitSqlStatements(parsed.up);
    if (statements.length === 0) {
      throw new Error(`Migration ${file.name} has an empty "-- UP" section.`);
    }
    await runStatements(conn, {
      direction: 'UP',
      fileName: file.name,
      statements,
      completedFiles,
    });
    await conn.query(
      'INSERT INTO migrations (name, batch, checksum) VALUES (?, ?, ?)',
      [file.name, nextBatch, file.checksum]
    );
    completedFiles.push(file.name);
  }

  return { batch: nextBatch, applied: completedFiles };
}

async function runSeedsOnConn(conn) {
  const seedFiles = readDiskSqlFiles(SEEDS_DIR);
  const completedFiles = [];
  const results = [];

  for (const file of seedFiles) {
    const statements = splitSqlStatements(file.content);
    await runStatements(conn, {
      direction: 'SEED',
      fileName: file.name,
      statements,
      completedFiles,
    });
    completedFiles.push(file.name);
    results.push({ name: file.name, statements: statements.length });
  }

  return results;
}

async function migrateUp() {
  return withLock((conn) => runUpOnConn(conn));
}

async function migrateDown(steps = 1) {
  const batchSteps = Number.parseInt(steps, 10);
  if (!Number.isFinite(batchSteps) || batchSteps < 1) {
    throw new Error(`Invalid rollback steps "${steps}". Expected a positive integer.`);
  }

  return withLock(async (conn) => {
    await ensureMigrationsTable(conn);
    const applied = await getAppliedMigrations(conn);
    if (applied.length === 0) {
      return { batches: [], rolledBack: [] };
    }

    const distinctBatches = [...new Set(applied.map((r) => Number(r.batch)))].sort((a, b) => b - a);
    const targetBatches = new Set(distinctBatches.slice(0, batchSteps));
    const toRollback = applied
      .filter((r) => targetBatches.has(Number(r.batch)))
      .sort((a, b) => Number(b.id) - Number(a.id));

    const diskFiles = readDiskSqlFiles(MIGRATIONS_DIR);
    const diskMap = new Map(diskFiles.map((f) => [f.name, f]));

    // Verify all rollback files exist before executing any DOWN statement
    for (const row of toRollback) {
      if (!diskMap.has(row.name)) {
        throw new Error(`Cannot roll back ${row.name}: file is missing from ${MIGRATIONS_DIR}.`);
      }
    }

    const completedFiles = [];
    for (const row of toRollback) {
      const file = diskMap.get(row.name);
      const parsed = parseMigrationFile(file.content, file.name);
      const statements = splitSqlStatements(parsed.down);
      if (statements.length === 0) {
        throw new Error(`Migration ${file.name} has an empty "-- DOWN" section.`);
      }
      await runStatements(conn, {
        direction: 'DOWN',
        fileName: file.name,
        statements,
        completedFiles,
      });
      await conn.query('DELETE FROM migrations WHERE id = ?', [row.id]);
      completedFiles.push(file.name);
    }

    return {
      batches: [...targetBatches].sort((a, b) => b - a),
      rolledBack: completedFiles,
    };
  });
}

async function migrateStatus() {
  const conn = await db.getPool().getConnection();
  try {
    await ensureMigrationsTable(conn);
    const diskFiles = readDiskSqlFiles(MIGRATIONS_DIR);
    const diskMap = new Map(diskFiles.map((f) => [f.name, f]));
    const applied = await getAppliedMigrations(conn);
    const appliedMap = new Map(applied.map((r) => [r.name, r]));

    const allNames = [...new Set([...applied.map((r) => r.name), ...diskFiles.map((f) => f.name)])].sort();
    return allNames.map((name) => {
      const dbRow = appliedMap.get(name);
      const disk = diskMap.get(name);
      if (dbRow && !disk) {
        return {
          name,
          status: 'MISSING',
          batch: dbRow.batch,
          appliedAt: dbRow.applied_at,
        };
      }
      if (dbRow && disk) {
        const changed = dbRow.checksum !== disk.checksum;
        return {
          name,
          status: changed ? 'CHANGED' : 'APPLIED',
          batch: dbRow.batch,
          appliedAt: dbRow.applied_at,
        };
      }
      return {
        name,
        status: 'PENDING',
        batch: null,
        appliedAt: null,
      };
    });
  } finally {
    conn.release();
  }
}

async function migrateFresh() {
  if (config.isProduction) {
    throw new Error('Refusing to run migrate:fresh when NODE_ENV=production.');
  }

  return withLock(async (conn) => {
    const [tables] = await conn.query(
      `SELECT table_name AS tableName
         FROM information_schema.tables
        WHERE table_schema = ?
          AND table_type = 'BASE TABLE'`,
      [config.db.database]
    );

    const dropped = [];
    if (tables.length > 0) {
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');
      try {
        for (const row of tables) {
          const safeName = String(row.tableName).replace(/`/g, '``');
          await conn.query(`DROP TABLE \`${safeName}\``);
          dropped.push(row.tableName);
        }
      } finally {
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
      }
    }

    const migrationResult = await runUpOnConn(conn);
    const seedResult = await runSeedsOnConn(conn);

    return {
      dropped,
      migration: migrationResult,
      seeds: seedResult,
    };
  });
}

function makeMigration(rawName) {
  const cleaned = String(rawName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!cleaned) {
    throw new Error('Usage: npm run migrate:make <migration_name>');
  }

  fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '_',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');

  const fileName = `${stamp}_${cleaned}.sql`;
  const fullPath = path.join(MIGRATIONS_DIR, fileName);

  if (fs.existsSync(fullPath)) {
    throw new Error(`Migration file already exists: ${fileName}`);
  }

  const template = '-- UP\n\n\n-- DOWN\n\n';
  fs.writeFileSync(fullPath, template, 'utf8');
  return { fileName, fullPath };
}

async function seed() {
  return withLock((conn) => runSeedsOnConn(conn));
}

module.exports = {
  migrateUp,
  migrateDown,
  migrateStatus,
  migrateFresh,
  makeMigration,
  seed,
  parseMigrationFile,
  splitSqlStatements,
  computeChecksum,
};
