'use strict';

/*
 * The audit trail helper. Every service write calls it inside the transaction of the change
 * it records, so a row is kept only when the change is saved:
 *
 *   await db.transaction(async (tx) => {
 *     const before = await repo.findRaw(id, tx.connection);
 *     await repo.update(id, fields, tx.connection);
 *     const after = await repo.findRaw(id, tx.connection);
 *     await audit.record(tx, actor, { action: 'UPDATE', table: 'ratings', recordId: sn, before, after });
 *   });
 *
 *   actor     who did it: { userId, username, ip, userAgent } (req.actor, set by requireAuth)
 *   action    INSERT | UPDATE | DELETE | SIGN IN | SIGN OUT | LOCK | UNLOCK
 *   table     the table changed (null for session events)
 *   recordId  the record's key: a service number, a row id, a username
 *   before    the row before the change (UPDATE, DELETE)
 *   after     the row after the change (INSERT, UPDATE)
 *   changes   [{ field, from, to }] instead of before/after, for events that are not a row
 *
 * What changed is worked out from before and after: an INSERT keeps every filled field, a
 * DELETE every field it had, an UPDATE only the fields that differ. Secrets (password hashes,
 * tokens) and bookkeeping columns are never kept. An UPDATE that changed nothing is not recorded.
 */

const ACTIONS = Object.freeze(['INSERT', 'UPDATE', 'DELETE', 'SIGN IN', 'SIGN OUT', 'LOCK', 'UNLOCK']);

// never written to the trail
const SECRET = /(password|passwd|secret|token|hash)/i;
const SKIP = new Set(['created_at', 'updated_at', 'created_by', 'last_seen_at', 'last_login_at']);
const MAX_VALUE = 500;

function plain(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().replace('T', ' ').slice(0, 19);
  if (Buffer.isBuffer(value)) return `[${value.length} bytes]`;
  if (typeof value === 'object') return JSON.stringify(value).slice(0, MAX_VALUE);
  const s = String(value);
  return s.length > MAX_VALUE ? `${s.slice(0, MAX_VALUE)}…` : s;
}

function keep(field) {
  return !SKIP.has(field) && !SECRET.test(field);
}

/** The fields that differ between two rows, as [{ field, from, to }]. */
function diff(before, after) {
  const out = [];
  const fields = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const field of fields) {
    if (!keep(field)) continue;
    const from = before ? plain(before[field]) : null;
    const to = after ? plain(after[field]) : null;
    if (from !== to) out.push({ field, from, to });
  }
  return out;
}

function clean(changes) {
  return (changes || [])
    .filter((c) => c && c.field && keep(c.field))
    .map((c) => ({ field: String(c.field), from: plain(c.from), to: plain(c.to) }));
}

/**
 * Writes one audit row through the transaction `tx` (from db.transaction). Returns the row's
 * id, or null when an UPDATE changed nothing.
 */
async function record(tx, actor, { action, table = null, recordId = null, before = null, after = null, changes = null } = {}) {
  if (!tx || typeof tx.query !== 'function') {
    throw new Error('audit.record must be called inside db.transaction(), with its tx.');
  }
  if (!ACTIONS.includes(action)) {
    throw new Error(`Unknown audit action "${action}".`);
  }
  if (!actor || !actor.username) {
    throw new Error('audit.record needs the actor (req.actor): who made the change.');
  }
  const list = changes ? clean(changes) : diff(before, after);
  if (action === 'UPDATE' && list.length === 0) return null;

  const res = await tx.query(
    `INSERT INTO audit_trail (user_id, username, action, table_name, record_id, changes, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      actor.userId || null,
      String(actor.username).slice(0, 50),
      action,
      table,
      recordId === null || recordId === undefined ? null : String(recordId).slice(0, 100),
      list.length ? JSON.stringify(list) : null,
      actor.ip ? String(actor.ip).slice(0, 45) : null,
      actor.userAgent ? String(actor.userAgent).slice(0, 255) : null,
    ]
  );
  return res.insertId || null;
}

/** The actor for a request: who is signed in and where from. */
function actorFrom(req, user = req.user) {
  return {
    userId: user ? user.id : null,
    username: user ? user.username : 'anonymous',
    ip: req.ip || null,
    userAgent: req.headers ? req.headers['user-agent'] || null : null,
  };
}

module.exports = {
  ACTIONS,
  record,
  diff,
  actorFrom,
};
