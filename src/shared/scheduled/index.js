'use strict';

/*
 * Scheduled changes: a change to a rating that takes effect on a later date. Drafting (WP7a) schedules a
 * posting with a WEF after today; Discharge (WP5) will schedule a discharge with a later exit date the same
 * way. A change is a row of `scheduled_changes` (kind, rating, effective date, payload, the record it came
 * from); the server applies the ones that are due, at start and then every hour (so at most an hour after
 * midnight, and on the next start after the server was down), each in its own transaction through the
 * handler registered for its kind.
 *
 *   const scheduled = require('../../shared/scheduled');
 *   scheduled.register('posting', {                         // once, at load
 *     apply: async (tx, change, actor) => 'what was done',  // the change takes effect
 *     cancelled: async (tx, change, reason, actor) => {},   // optional: it was cancelled or could not be made
 *   });
 *   const id = await scheduled.schedule(tx, actor, { kind: 'posting', serviceNumber, effectiveDate: 'YYYY-MM-DD',
 *                                                    payload: { ... }, source: { table: 'draft_rows', id } });
 *   await scheduled.cancel(tx, actor, id, 'why');
 *   await scheduled.forRating(serviceNumber, 'posting')   // what is still to come, oldest first
 *   await scheduled.applyDue({ today: 'YYYY-MM-DD' })     // what the timer runs; returns { applied, cancelled, failed }
 *   scheduled.start() / scheduled.stop()                  // src/server.js starts it
 *
 * A handler applies the change and returns a short outcome. If it throws an AppError (the change can no
 * longer be made: the rating has left, say), the change is marked cancelled with that message; any other
 * error leaves it scheduled for the next run. Every step is in the audit trail (actor SYSTEM).
 */
const db = require('../../db');
const audit = require('../audit');
const { AppError } = require('../errors');
const repo = require('./scheduled.repo');

const HANDLERS = new Map();
const SYSTEM = Object.freeze({ userId: null, username: 'SYSTEM', ip: null, userAgent: 'scheduled changes' });
const EVERY_MS = 60 * 60 * 1000;
let timer = null;
let running = null;

const pad = (n) => String(n).padStart(2, '0');
/** Today in the server's local time, as YYYY-MM-DD. */
function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function register(kind, handler) {
  if (!kind || !handler || typeof handler.apply !== 'function') throw new Error('scheduled.register(kind, { apply }) needs a kind and an apply function.');
  HANDLERS.set(kind, handler);
}

async function schedule(tx, actor, { kind, serviceNumber, effectiveDate, payload = {}, source = {} }) {
  if (!HANDLERS.has(kind)) throw new Error(`No handler is registered for scheduled changes of kind "${kind}".`);
  const id = await repo.insert({ kind, serviceNumber, effectiveDate, payload, sourceTable: source.table, sourceId: source.id, userId: actor && actor.userId }, tx.connection);
  await audit.record(tx, actor, { action: 'INSERT', table: 'scheduled_changes', recordId: `${serviceNumber}:${id}`, after: await repo.raw(id, tx.connection) });
  return id;
}

async function cancel(tx, actor, id, reason) {
  const before = await repo.find(id, tx.connection, true);
  if (!before || before.status !== 'scheduled') return false;
  await repo.finish(id, 'cancelled', reason, tx.connection);
  await audit.record(tx, actor, { action: 'UPDATE', table: 'scheduled_changes', recordId: `${before.service_number}:${id}`, before, after: await repo.raw(id, tx.connection) });
  const handler = HANDLERS.get(before.kind);
  if (handler && typeof handler.cancelled === 'function') await handler.cancelled(tx, before, reason, actor);
  return true;
}

const forRating = (serviceNumber, kind = null) => repo.forRating(serviceNumber, kind);

async function applyOne(id) {
  try {
    return await db.transaction(async (tx) => {
      const change = await repo.find(id, tx.connection, true);
      if (!change || change.status !== 'scheduled') return 'skipped';
      const handler = HANDLERS.get(change.kind);
      if (!handler) return 'skipped';
      const outcome = await handler.apply(tx, change, SYSTEM);
      await repo.finish(id, 'applied', outcome || 'Applied', tx.connection);
      await audit.record(tx, SYSTEM, { action: 'UPDATE', table: 'scheduled_changes', recordId: `${change.service_number}:${id}`, before: change, after: await repo.raw(id, tx.connection) });
      return 'applied';
    });
  } catch (err) {
    if (!(err instanceof AppError)) {
      console.error(`[CIRERMS] Scheduled change ${id} could not be applied; it stays scheduled: ${err.message}`);
      return 'failed';
    }
    // the change can no longer be made: keep the reason and stop trying
    await db.transaction(async (tx) => cancel(tx, SYSTEM, id, `Not applied: ${err.message}`));
    return 'cancelled';
  }
}

/** Applies every change due on or before `today`; one at a time, oldest first. */
async function applyDue({ today = todayIso() } = {}) {
  const counts = { applied: 0, cancelled: 0, failed: 0 };
  for (const id of await repo.dueIds(today)) {
    const r = await applyOne(id);
    if (counts[r] !== undefined) counts[r] += 1;
  }
  return counts;
}

function runNow() {
  if (!running) {
    running = applyDue()
      .then((c) => { if (c.applied || c.cancelled || c.failed) console.log(`[CIRERMS] Scheduled changes: ${c.applied} applied, ${c.cancelled} cancelled, ${c.failed} failed.`); })
      .catch((err) => console.error(`[CIRERMS] Scheduled changes could not run: ${err.message}`))
      .finally(() => { running = null; });
  }
  return running;
}

/** At start (after a short pause) and then every hour. */
function start() {
  if (timer) return;
  setTimeout(runNow, 5000).unref();
  timer = setInterval(runNow, EVERY_MS);
  timer.unref();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { register, schedule, cancel, forRating, applyDue, start, stop, todayIso, SYSTEM };
