'use strict';

/*
 * The Static Tables' SQL, one set of functions for every table. Table and column names come only
 * from tables.config.js (never from a request); every value is a placeholder. Each function takes
 * a connection (`conn`, the transaction's, or null for the pool).
 */
const db = require('../../db');
const { stem } = require('./tables.config');

const q = (identifier) => `\`${identifier}\``;
const own = (cfg) => cfg.columns.filter((c) => c.type !== 'multi');
const refs = (cfg) => cfg.columns.filter((c) => c.type === 'ref');
const multis = (cfg) => cfg.columns.filter((c) => c.type === 'multi');

/** SELECT list and joins for a table's rows: its columns, is_active and each ref's name. */
function shape(cfg) {
  const select = ['t.id', ...own(cfg).map((c) => `t.${q(c.key)}`), 't.sort_order', 't.is_active'];
  const joins = [];
  refs(cfg).forEach((c) => {
    select.push(`j_${c.key}.name AS ${q(`${stem(c.key)}_name`)}`);
    joins.push(`LEFT JOIN ${q(c.ref)} j_${c.key} ON j_${c.key}.id = t.${q(c.key)}`);
  });
  return { select: select.join(', '), joins: joins.join(' ') };
}

/** WHERE for the list: the search words over the text columns and each ref's name, and the status. */
function filter(cfg, { search = '', status = '' }) {
  const where = [];
  const params = [];
  if (search) {
    const like = `%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const fields = ['t.name'];
    own(cfg).forEach((c) => { if (c.key !== 'name' && c.type !== 'number' && c.type !== 'ref') fields.push(`t.${q(c.key)}`); });
    refs(cfg).forEach((c) => fields.push(`j_${c.key}.name`));
    where.push(`(${fields.map((f) => `${f} LIKE ?`).join(' OR ')})`);
    fields.forEach(() => params.push(like));
  }
  if (status === 'active') where.push('t.is_active = 1');
  if (status === 'inactive') where.push('t.is_active = 0');
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

async function list(cfg, { search, status, limit, offset }, conn = null) {
  const { select, joins } = shape(cfg);
  const { sql, params } = filter(cfg, { search, status });
  const order = cfg.order || 't.sort_order ASC, t.name ASC';
  return db.query(
    `SELECT ${select} FROM ${q(cfg.table)} t ${joins} ${sql} ORDER BY ${order}, t.id ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
    conn
  );
}

async function count(cfg, { search, status }, conn = null) {
  const { joins } = shape(cfg);
  const { sql, params } = filter(cfg, { search, status });
  const rows = await db.query(`SELECT COUNT(*) AS total FROM ${q(cfg.table)} t ${joins} ${sql}`, params, conn);
  return Number(rows[0].total);
}

async function ratesOf(cfg, column, ids, conn = null) {
  const j = column.junction;
  if (!ids.length) return new Map();
  const rows = await db.query(
    `SELECT l.${q(j.owner)} AS owner_id, r.id, r.name
       FROM ${q(j.table)} l JOIN ${q(j.ref)} r ON r.id = l.${q(j.value)}
      WHERE l.${q(j.owner)} IN (?) ORDER BY r.sort_order ASC, r.name ASC`,
    [ids],
    conn
  );
  const map = new Map();
  rows.forEach((r) => {
    if (!map.has(r.owner_id)) map.set(r.owner_id, []);
    map.get(r.owner_id).push({ id: r.id, name: r.name });
  });
  return map;
}

/** One row as the screens read it (with each multi's picks), or null. */
async function findById(cfg, id, conn = null, { lock = false } = {}) {
  const { select, joins } = shape(cfg);
  const rows = await db.query(
    `SELECT ${select} FROM ${q(cfg.table)} t ${joins} WHERE t.id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [id],
    conn
  );
  const row = rows[0];
  if (!row) return null;
  for (const c of multis(cfg)) {
    const picks = (await ratesOf(cfg, c, [row.id], conn)).get(row.id) || [];
    row[c.key] = picks.map((p) => p.id);
    row[`${stem(c.key)}_names`] = picks.map((p) => p.name);
  }
  return row;
}

/** The row as stored, for the audit trail: every column, and each multi's ids as "1,2,3". */
async function rawRow(cfg, id, conn = null) {
  const extra = multis(cfg).map((c) => `(SELECT GROUP_CONCAT(l.${q(c.junction.value)} ORDER BY l.${q(c.junction.value)}) FROM ${q(c.junction.table)} l WHERE l.${q(c.junction.owner)} = t.id) AS ${q(c.key)}`);
  const rows = await db.query(`SELECT t.*${extra.length ? `, ${extra.join(', ')}` : ''} FROM ${q(cfg.table)} t WHERE t.id = ? LIMIT 1`, [id], conn);
  return rows[0] || null;
}

async function nextSortOrder(cfg, conn = null) {
  const rows = await db.query(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM ${q(cfg.table)}`, [], conn);
  return Number(rows[0].next);
}

async function insert(cfg, values, isActive, createdBy, conn = null) {
  const keys = own(cfg).map((c) => c.key);
  const sortOrder = await nextSortOrder(cfg, conn);
  const res = await db.query(
    `INSERT INTO ${q(cfg.table)} (${keys.map(q).join(', ')}, sort_order, is_active, created_by) VALUES (${keys.map(() => '?').join(', ')}, ?, ?, ?)`,
    [...keys.map((k) => values[k]), sortOrder, isActive ? 1 : 0, createdBy || null],
    conn
  );
  return res.insertId;
}

async function update(cfg, id, values, isActive, conn = null) {
  const keys = own(cfg).map((c) => c.key);
  await db.query(
    `UPDATE ${q(cfg.table)} SET ${keys.map((k) => `${q(k)} = ?`).join(', ')}, is_active = ? WHERE id = ?`,
    [...keys.map((k) => values[k]), isActive ? 1 : 0, id],
    conn
  );
}

async function setMulti(column, ownerId, ids, conn = null) {
  const j = column.junction;
  await db.query(`DELETE FROM ${q(j.table)} WHERE ${q(j.owner)} = ?`, [ownerId], conn);
  for (const id of ids) {
    await db.query(`INSERT INTO ${q(j.table)} (${q(j.owner)}, ${q(j.value)}) VALUES (?, ?)`, [ownerId, id], conn);
  }
}

async function remove(cfg, id, conn = null) {
  await db.query(`DELETE FROM ${q(cfg.table)} WHERE id = ?`, [id], conn);
}

/** The other row with the same value (within the same scope), if any. */
async function findDuplicate(cfg, column, value, values, exceptId, conn = null) {
  const scope = column.scope || [];
  const where = [`${q(column.key)} = ?`, ...scope.map((k) => `${q(k)} = ?`)];
  const params = [value, ...scope.map((k) => values[k])];
  if (exceptId) { where.push('id <> ?'); params.push(exceptId); }
  const rows = await db.query(`SELECT id FROM ${q(cfg.table)} WHERE ${where.join(' AND ')} LIMIT 1`, params, conn);
  return rows[0] || null;
}

/** How many rows of one table refer to this row, for each place in `usedBy`. */
async function usageCounts(cfg, id, conn = null) {
  const out = [];
  for (const u of cfg.usedBy) {
    const rows = await db.query(`SELECT COUNT(*) AS c FROM ${q(u.table)} WHERE ${q(u.column)} = ?`, [id], conn);
    const n = Number(rows[0].c);
    if (n > 0) out.push({ table: u.table, count: n, noun: u.noun });
  }
  return out;
}

/** Every row of a table a 'ref' or 'multi' column picks from. */
async function refOptions(table, conn = null) {
  return db.query(`SELECT id, name, is_active FROM ${q(table)} ORDER BY sort_order ASC, name ASC`, [], conn);
}

async function refExists(table, id, conn = null) {
  const rows = await db.query(`SELECT id FROM ${q(table)} WHERE id = ? LIMIT 1`, [id], conn);
  return rows.length > 0;
}

module.exports = {
  list,
  count,
  findById,
  rawRow,
  insert,
  update,
  setMulti,
  remove,
  findDuplicate,
  usageCounts,
  refOptions,
  refExists,
};
