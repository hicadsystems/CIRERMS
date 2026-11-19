'use strict';

/*
 * The Static Tables' rules: validation (required, length, range, the fixed choices, the linked
 * rows, no duplicates), the in-use check on delete, and the audit trail for every write.
 */
const db = require('../../db');
const audit = require('../../shared/audit');
const { buildStaticTableListPdf } = require('../../shared/pdf');
const { bySlug, stem } = require('./tables.config');
const repo = require('./tables.repo');
const { conflict, notFound, validationError } = require('../../shared/errors');

const PAGE_SIZE = 25;

function tableOf(slug) {
  const cfg = bySlug(slug);
  if (!cfg) throw notFound('That table does not exist.');
  return cfg;
}

// the values the service works out for the screens (a grade's score range)
function decorate(cfg, row) {
  if (cfg.rule === 'score-range') return { ...row, score_range: `${row.score_low} - ${row.score_high}` };
  return row;
}

function toId(raw) {
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** What the screen needs to draw the table: its columns, and the rows its dropdowns pick from. */
async function getMeta(slug) {
  const cfg = tableOf(slug);
  const columns = cfg.columns.map((c) => ({
    key: c.key,
    label: c.label,
    type: c.type,
    required: !!c.required,
    max: c.max,
    min: c.min,
    options: c.options,
    blank: c.blank,
    hint: c.hint,
    upper: !!c.upper,
    list: c.list === true,
    name: c.type === 'ref' ? `${stem(c.key)}_name` : undefined,
  }));
  const options = {};
  for (const c of cfg.columns) {
    const table = c.type === 'ref' ? c.ref : c.type === 'multi' ? c.junction.ref : null;
    if (table) options[c.key] = (await repo.refOptions(table)).map((r) => ({ id: r.id, name: r.name, active: !!r.is_active }));
  }
  return { slug: cfg.slug, title: cfg.title, item: cfg.item, columns, options };
}

async function list(slug, query = {}) {
  const cfg = tableOf(slug);
  const search = String(query.q || '').trim().slice(0, 100);
  const status = ['active', 'inactive'].includes(query.status) ? query.status : '';
  const pageSize = PAGE_SIZE;
  const total = await repo.count(cfg, { search, status });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number.parseInt(query.page, 10) || 1), totalPages);
  const offset = (page - 1) * pageSize;
  const rows = await repo.list(cfg, { search, status, limit: pageSize, offset });
  return { items: rows.map((r, i) => ({ ...decorate(cfg, r), no: offset + i + 1 })), total, page, pageSize, totalPages };
}

/** "In use: 12 ratings and 2 training courses". */
function usageText(usage) {
  const parts = usage.map((u) => `${u.count} ${u.count === 1 ? u.noun[0] : u.noun[1]}`);
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

async function get(slug, rawId) {
  const cfg = tableOf(slug);
  const id = toId(rawId);
  const row = id ? await repo.findById(cfg, id) : null;
  if (!row) throw notFound(`That ${cfg.item.toLowerCase()} was not found.`);
  const usage = await repo.usageCounts(cfg, id);
  return { ...decorate(cfg, row), usage: usage.map((u) => ({ table: u.table, count: u.count, text: `${u.count} ${u.count === 1 ? u.noun[0] : u.noun[1]}` })), in_use: usage.length > 0 };
}

/** Checks a body against the config: the values to store, or a 422 with a message per field. */
async function validate(cfg, body, existingId, conn) {
  const input = body && typeof body === 'object' ? body : {};
  const values = {};
  const fields = {};

  for (const c of cfg.columns) {
    if (c.type === 'virtual') continue;
    const raw = input[c.key];
    if (c.type === 'bool') {
      values[c.key] = raw === true || raw === 1 || raw === '1' || raw === 'true' ? 1 : 0;
      continue;
    }
    if (c.type === 'multi') {
      const list = Array.isArray(raw) ? raw : [];
      const ids = [...new Set(list.map(toId))];
      if (ids.some((id) => id === null)) { fields[c.key] = `${c.label}: pick from the list.`; continue; }
      let bad = false;
      for (const id of ids) if (!(await repo.refExists(c.junction.ref, id, conn))) bad = true;
      if (bad) fields[c.key] = `${c.label}: pick from the list.`;
      else values[c.key] = ids.sort((a, b) => a - b);
      continue;
    }
    const empty = raw === undefined || raw === null || String(raw).trim() === '';
    if (empty) {
      if (c.required) fields[c.key] = `${c.label} is required.`;
      values[c.key] = null;
      continue;
    }
    if (c.type === 'text') {
      let v = String(raw).trim().replace(/\s+/g, ' ');
      if (c.upper) v = v.toUpperCase();
      if (c.max && v.length > c.max) fields[c.key] = `${c.label} can be at most ${c.max} characters.`;
      else values[c.key] = v;
    } else if (c.type === 'select') {
      const v = String(raw).trim();
      if (!c.options.includes(v)) fields[c.key] = `${c.label}: pick from the list.`;
      else values[c.key] = v;
    } else if (c.type === 'number') {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < (c.min ?? 0) || n > (c.max ?? 65535)) fields[c.key] = `${c.label} must be a whole number from ${c.min ?? 0} to ${c.max ?? 65535}.`;
      else values[c.key] = n;
    } else if (c.type === 'ref') {
      const id = toId(raw);
      if (!id || !(await repo.refExists(c.ref, id, conn))) fields[c.key] = `${c.label}: pick from the list.`;
      else values[c.key] = id;
    }
  }

  // no two rows share a name, a code (or whatever is marked unique), within the column's scope
  for (const c of cfg.columns) {
    if (fields[c.key] || values[c.key] === null || values[c.key] === undefined) continue;
    if (!(c.key === 'name' || c.unique)) continue;
    if ((c.scope || []).some((k) => fields[k] || values[k] === null)) continue;
    if (await repo.findDuplicate(cfg, c, values[c.key], values, existingId, conn)) {
      fields[c.key] = `${c.label} "${values[c.key]}" already exists${c.scope && c.scope.length ? ' there' : ''}.`;
    }
  }

  // a grade's scores: low not above high, and no overlap with another grade
  if (cfg.rule === 'score-range' && !fields.score_low && !fields.score_high) {
    if (values.score_low > values.score_high) fields.score_high = 'Highest Score cannot be below the Lowest Score.';
    else {
      const other = await repo.findOverlap(cfg, values.score_low, values.score_high, existingId, conn);
      if (other) fields.score_low = `These scores overlap "${other.name}" (${other.score_low} - ${other.score_high}).`;
    }
  }

  const active = input.is_active === undefined || input.is_active === null
    ? true
    : !(input.is_active === false || input.is_active === 0 || input.is_active === '0' || input.is_active === 'false');

  if (Object.keys(fields).length) throw validationError('Please correct the highlighted fields.', fields);
  return { values, active };
}

/** A duplicate that slipped past the check (two saves at once) is the same message. */
function asValidation(err, cfg) {
  if (err && err.code === 'ER_DUP_ENTRY') return validationError('That value already exists.', { name: `${cfg.item} already exists.` });
  return err;
}

async function create(slug, body, actor) {
  const cfg = tableOf(slug);
  try {
    const id = await db.transaction(async (tx) => {
      const { values, active } = await validate(cfg, body, null, tx.connection);
      const newId = await repo.insert(cfg, values, active, actor && actor.userId, tx.connection);
      for (const c of cfg.columns.filter((x) => x.type === 'multi')) await repo.setMulti(c, newId, values[c.key] || [], tx.connection);
      const after = await repo.rawRow(cfg, newId, tx.connection);
      await audit.record(tx, actor, { action: 'INSERT', table: cfg.table, recordId: newId, after });
      return newId;
    });
    return await get(slug, id);
  } catch (err) {
    throw asValidation(err, cfg);
  }
}

async function update(slug, rawId, body, actor) {
  const cfg = tableOf(slug);
  const id = toId(rawId);
  try {
    await db.transaction(async (tx) => {
      const before = id ? await repo.rawRow(cfg, id, tx.connection) : null;
      if (!before) throw notFound(`That ${cfg.item.toLowerCase()} was not found.`);
      const { values, active } = await validate(cfg, body, id, tx.connection);
      await repo.update(cfg, id, values, active, tx.connection);
      for (const c of cfg.columns.filter((x) => x.type === 'multi')) await repo.setMulti(c, id, values[c.key] || [], tx.connection);
      const after = await repo.rawRow(cfg, id, tx.connection);
      await audit.record(tx, actor, { action: 'UPDATE', table: cfg.table, recordId: id, before, after });
    });
    return await get(slug, id);
  } catch (err) {
    throw asValidation(err, cfg);
  }
}

/** Deletes a row nothing uses; a row in use is refused, with where it is used. */
async function remove(slug, rawId, actor) {
  const cfg = tableOf(slug);
  const id = toId(rawId);
  const refused = (usage) => conflict(
    `This ${cfg.item.toLowerCase()} is in use (${usage}), so it cannot be deleted. Make it Inactive instead: it leaves the dropdowns, and the records that hold it still show it.`,
    'IN_USE'
  );
  try {
    await db.transaction(async (tx) => {
      const before = id ? await repo.rawRow(cfg, id, tx.connection) : null;
      if (!before) throw notFound(`That ${cfg.item.toLowerCase()} was not found.`);
      await repo.findById(cfg, id, tx.connection, { lock: true });
      const usage = await repo.usageCounts(cfg, id, tx.connection);
      if (usage.length) throw refused(usageText(usage));
      await repo.remove(cfg, id, tx.connection);
      await audit.record(tx, actor, { action: 'DELETE', table: cfg.table, recordId: id, before });
    });
  } catch (err) {
    // a table nothing here knows about still holds it (a foreign key stopped the delete)
    if (err && (err.errno === 1451 || err.code === 'ER_ROW_IS_REFERENCED_2')) throw refused('other records hold it');
    throw err;
  }
  return { id };
}

const MAX_PRINT_ROWS = 5000;

/** The table's list printed as a PDF, following the search and status filter on screen. */
async function printList(slug, query = {}, generatedBy = '') {
  const cfg = tableOf(slug);
  const search = String(query.q || '').trim().slice(0, 100);
  const status = ['active', 'inactive'].includes(query.status) ? query.status : '';
  const rows = (await repo.list(cfg, { search, status, limit: MAX_PRINT_ROWS, offset: 0 })).map((r) => decorate(cfg, r));
  const meta = await getMeta(slug);
  // the screen's columns: the name first, then the other list columns (the code among them)
  const listed = meta.columns.filter((c) => c.list).sort((a, b) => (b.key === 'name') - (a.key === 'name'));
  const cell = (c, row) => (c.type === 'ref' ? row[c.name] : c.type === 'bool' ? (row[c.key] ? 'Yes' : 'No') : row[c.key]);
  const columns = [
    ...listed.map((c) => ({ header: c.label, weight: c.key === 'name' ? 2.2 : 1.2, value: (row) => cell(c, row) })),
    { header: 'Active', weight: 0.8, value: (row) => (row.is_active ? 'Yes' : 'No') },
  ];
  const notes = [];
  if (search) notes.push(`Search "${search}"`);
  if (status) notes.push(status === 'active' ? 'Active only' : 'Inactive only');
  const buffer = await buildStaticTableListPdf({ title: meta.title, columns, rows, filterNote: notes.join(', '), generatedBy });
  return { buffer, fileName: `CIRERMS_${slug}_list.pdf` };
}

module.exports = { printList, getMeta, list, get, create, update, remove, PAGE_SIZE };
