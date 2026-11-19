'use strict';

/*
 * The rate change: the one way a rating's rate moves up. Board Returns Update and Upload Advanced Rates call
 * it; it is written to be reused (a later package that changes a rate calls it the same way).
 *
 *   const rates = require('../advancement/rates.service');
 *   const r = await rates.advance(tx, actor, {
 *     serviceNumber: 'B0539', fromRateId: 4, toRateId: 5, date: '2026-11-19', authority: 'NHQ/NP/DOA/052/2026',
 *     decoration: '', source: { table: 'advancement_rows', id: 12 },
 *   });
 *   // r = { status: 'advanced', advancementId, rate } or { status: 'scheduled', scheduledId, rate }
 *   rates.onSource('advancement_rows', { applied: async (tx, { sourceId, advancementId, actor }) => {},
 *                                        cancelled: async (tx, { sourceId, reason, actor }) => {} });
 *   await rates.scheduledFor('B0539')   // [{ id, rateId, rate, date, authority }] still to come
 *
 * A date today or earlier applies now: the rating's open Advancement line (rating_advancement) ends the day
 * before, a new line of the new rate starts on the date (with the authority and decoration), and the
 * rating's rate becomes the new one. A date after today is Scheduled (src/shared/scheduled, kind
 * 'advancement'): nothing changes yet, the record's Advancement tab shows it, and the server makes the same
 * change on that date (at most an hour after midnight, or on its next start).
 *
 * Refused (422, with the field): a rating that is not current, a rating whose rate is no longer the old rate,
 * a new rate that is not above it, and a date before the rating joined its current rate. Every write is
 * audited inside the caller's transaction.
 */
const audit = require('../../shared/audit');
const scheduled = require('../../shared/scheduled');
const { validationError } = require('../../shared/errors');
const { parseIsoDate } = require('../../shared/dates');
const { dmy, todayIso, addDays } = require('../drafting/drafting.format');
const repo = require('./rates.repo');

const SOURCES = new Map();
function onSource(table, hooks) {
  SOURCES.set(table, hooks || {});
}

const fullName = (r) => [String(r.surname || '').toUpperCase(), r.first_name, r.middle_name].filter(Boolean).join(' ');
const refuse = (field, message) => validationError(message, { [field]: message });
const short = (rt) => (rt ? rt.code || rt.name : '');

/** Checks a change against the rating's current state; returns what it needs. */
async function check(conn, { serviceNumber, fromRateId, toRateId, date }, { lock = false } = {}) {
  const p = parseIsoDate(date);
  if (!date || !p.valid || !p.value) throw refuse('date', 'Enter the date as dd/mm/yyyy.');
  const rating = await repo.rating(serviceNumber, conn, lock);
  if (!rating) throw refuse('serviceNumber', 'That rating was not found.');
  if (rating.status !== 'current') throw refuse('serviceNumber', `${fullName(rating)} has left the service and cannot be advanced.`);
  const from = fromRateId ? await repo.rate(fromRateId, conn) : null;
  const to = toRateId ? await repo.rate(toRateId, conn) : null;
  if (!to) throw refuse('toRateId', 'Choose the new rate from the list.');
  if (from && rating.rate_id !== from.id) {
    throw refuse('serviceNumber', `${fullName(rating)} is now ${rating.rate_code || rating.rate_name || 'of another rate'}, no longer ${short(from)}.`);
  }
  const now = from || (await repo.rate(rating.rate_id, conn));
  if (now && to.sort_order <= now.sort_order) throw refuse('toRateId', `${short(to)} is not above ${short(now)}.`);
  const since = rating.rate_since || '';
  if (since && p.value < since) {
    throw refuse('date', `The date cannot be before ${fullName(rating)} joined the current rate (${dmy(since)}).`);
  }
  const open = await repo.openLines(serviceNumber, conn, lock);
  if (open.some((o) => o.start_date && o.start_date >= p.value)) {
    const latest = open.reduce((m, o) => (o.start_date > m ? o.start_date : m), '');
    throw refuse('date', `The date must be after ${dmy(latest)}, when ${fullName(rating)} joined the current rate.`);
  }
  return { rating, from: now, to, open, date: p.value };
}

/** Ends the open Advancement line the day before and opens the new one; the rating's rate follows. */
async function applyNow(tx, actor, { serviceNumber, fromRateId, toRateId, date, authority = '', decoration = '' }) {
  const conn = tx.connection;
  const { rating, to, open, date: day } = await check(conn, { serviceNumber, fromRateId, toRateId, date }, { lock: true });
  for (const o of open) {
    await repo.endLine(o.id, addDays(day, -1), conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'rating_advancement', recordId: `${serviceNumber}:${o.id}`, before: o, after: await repo.lineRaw(o.id, conn) });
  }
  const advancementId = await repo.insertLine({
    serviceNumber, rateId: to.id, startDate: day, authority: String(authority || '').slice(0, 150), decoration: String(decoration || '').slice(0, 150), userId: actor.userId,
  }, conn);
  await audit.record(tx, actor, { action: 'INSERT', table: 'rating_advancement', recordId: `${serviceNumber}:${advancementId}`, after: await repo.lineRaw(advancementId, conn) });
  const before = await repo.ratingRaw(serviceNumber, conn);
  await repo.setRate(serviceNumber, to.id, actor.userId, conn);
  await audit.record(tx, actor, { action: 'UPDATE', table: 'ratings', recordId: serviceNumber, before, after: await repo.ratingRaw(serviceNumber, conn) });
  return { advancementId, rate: short(to), rateName: to.name, rating };
}

async function advance(tx, actor, { serviceNumber, fromRateId, toRateId, date, authority = '', decoration = '', source = {} }, { today = todayIso() } = {}) {
  const { to, date: day } = await check(tx.connection, { serviceNumber, fromRateId, toRateId, date }, { lock: true });
  if (day <= today) {
    const r = await applyNow(tx, actor, { serviceNumber, fromRateId, toRateId, date: day, authority, decoration });
    return { status: 'advanced', advancementId: r.advancementId, rate: r.rate, date: day };
  }
  const scheduledId = await scheduled.schedule(tx, actor, {
    kind: 'advancement', serviceNumber, effectiveDate: day,
    payload: { fromRateId: fromRateId || null, toRateId: to.id, authority, decoration }, source,
  });
  return { status: 'scheduled', scheduledId, rate: short(to), date: day };
}

// the server makes a scheduled change on its date, then tells the record it came from
scheduled.register('advancement', {
  async apply(tx, change, actor) {
    const p = change.payload || {};
    const date = typeof change.effective_date === 'string' ? change.effective_date : todayIso(change.effective_date);
    const r = await applyNow(tx, actor, { serviceNumber: change.service_number, fromRateId: p.fromRateId, toRateId: p.toRateId, date, authority: p.authority, decoration: p.decoration });
    const hooks = SOURCES.get(change.source_table);
    if (hooks && hooks.applied) await hooks.applied(tx, { sourceId: change.source_id, advancementId: r.advancementId, date, actor, change });
    return `Advanced to ${r.rate} on ${dmy(date)}`;
  },
  async cancelled(tx, change, reason, actor) {
    const hooks = SOURCES.get(change.source_table);
    if (hooks && hooks.cancelled) await hooks.cancelled(tx, { sourceId: change.source_id, reason, actor, change });
  },
});

/** The rate changes still to come for a rating, oldest first. */
async function scheduledFor(serviceNumber) {
  const list = await scheduled.forRating(serviceNumber, 'advancement');
  const all = await repo.rates();
  return list.map((c) => {
    const to = all.find((x) => x.id === Number(c.payload.toRateId)) || {};
    return {
      id: c.id,
      rateId: to.id || null,
      rate: to.name || '',
      rateCode: to.code || to.name || '',
      date: typeof c.effective_date === 'string' ? c.effective_date : todayIso(c.effective_date),
      authority: c.payload.authority || '',
    };
  });
}

module.exports = { advance, check, applyNow, onSource, scheduledFor };
