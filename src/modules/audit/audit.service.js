'use strict';

const auditRepo = require('./audit.repo');
const { accountName } = require('../../shared/rating-name');
const { ACTIONS } = require('../../shared/audit');
const { validationError, notFound, badRequest } = require('../../shared/errors');

const PAGE_SIZE = 25;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDate(value, field, errors) {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).trim();
  const d = new Date(`${s}T00:00:00Z`);
  if (!ISO_DATE.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    errors[field] = 'Use a real date (YYYY-MM-DD).';
    return null;
  }
  return s;
}

function text(value, max = 100) {
  const s = String(value ?? '').trim();
  return s ? s.slice(0, max) : null;
}

/** Filters from the query string: from, to (YYYY-MM-DD), userId, user, action, table, record. */
function parseFilters(q = {}) {
  const errors = {};
  const filters = {
    from: isoDate(q.from, 'from', errors),
    to: isoDate(q.to, 'to', errors),
    userId: null,
    user: text(q.user, 50),
    action: null,
    table: text(q.table, 64),
    record: text(q.record, 100),
  };
  if (q.userId !== undefined && q.userId !== '') {
    const id = Number.parseInt(q.userId, 10);
    if (!Number.isFinite(id) || id <= 0) errors.userId = 'userId must be a positive whole number.';
    else filters.userId = id;
  }
  if (q.action) {
    const a = String(q.action).trim().toUpperCase();
    if (!ACTIONS.includes(a)) errors.action = `Action must be one of ${ACTIONS.join(', ')}.`;
    else filters.action = a;
  }
  if (filters.from && filters.to && filters.from > filters.to) errors.to = 'To must be on or after From.';
  if (Object.keys(errors).length) throw validationError('Check the audit trail filters.', errors);
  return filters;
}

function toItem(r) {
  return {
    id: Number(r.id),
    time: r.created_at,
    userId: r.user_id,
    username: r.username,
    fullName: r.rating_surname ? accountName(r) : null,
    action: r.action,
    table: r.table_name,
    recordId: r.record_id,
    ip: r.ip_address,
  };
}

async function listEntries(query = {}) {
  const filters = parseFilters(query);
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize, 10) || PAGE_SIZE));
  const { items, total } = await auditRepo.listEntries(filters, { page, pageSize });
  return {
    items: items.map((r) => ({ ...toItem(r), changeCount: Number(r.change_count) || 0 })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

async function getEntry(idRaw) {
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id) || id <= 0) throw badRequest('Invalid audit entry id.');
  const row = await auditRepo.findEntry(id);
  if (!row) throw notFound('Audit entry not found.');
  let changes = row.changes;
  if (typeof changes === 'string') {
    try { changes = JSON.parse(changes); } catch (_) { changes = []; }
  }
  return { ...toItem(row), userAgent: row.user_agent, changes: changes || [] };
}

/** The choices for the filter lists: actions, tables seen, users seen. */
async function getFilterOptions() {
  const [tables, users] = await Promise.all([auditRepo.listTables(), auditRepo.listUsers()]);
  return {
    actions: [...ACTIONS],
    tables,
    users: users.map((u) => ({ id: u.id, username: u.username, fullName: u.rating_surname ? accountName(u) : null })),
  };
}

module.exports = {
  listEntries,
  getEntry,
  getFilterOptions,
};
