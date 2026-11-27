'use strict';

/*
 * The posting move: the one way a rating changes ship. Drafting's Update WEF calls it; Special Drafting
 * (WP11) calls it the same way. Given a rating, a ship, a WEF and an authority:
 *
 *   - a WEF today or earlier moves the rating now: the open posting ends the day before the WEF, a new
 *     posting starts on the WEF at the ship, carrying the ship's Command, the rating's Branch, the authority and the
 *     Active status (rating_drafting; the record's Drafting tab shows it and the
 *     current ship follows, as it is the open posting);
 *   - a WEF after today is Scheduled (src/shared/scheduled, kind 'posting'): nothing changes yet; the
 *     record's Drafting tab shows "Drafted to X wef dd/mm/yyyy" with Scheduled, and the server makes the
 *     same move on that date (at most an hour after midnight, or on its next start).
 *
 *   const postings = require('../drafting/postings.service');
 *   const r = await postings.move(tx, actor, {
 *     serviceNumber: 'B0539', shipId: 4, wef: '2026-12-01', authority: 'NHQ/NP/DOD/135/2026',
 *     remarks: 'optional; default "Drafted under <authority>"', source: { table: 'special_drafts', id: 12 },
 *   });
 *   // r = { status: 'reported', postingId, ship } or { status: 'scheduled', scheduledId, ship }
 *   postings.onSource('special_drafts', {                 // what to do to your record when a scheduled move is made
 *     applied: async (tx, { sourceId, postingId, wef, actor }) => {},
 *     cancelled: async (tx, { sourceId, reason, actor }) => {},
 *   });
 *   await postings.scheduledFor('B0539')                  // [{ id, shipId, ship, wef, authority }] still to come
 *
 * Refused (422, with the field): a rating that is not current, a ship that does not exist, the ship the rating
 * is already on, and a WEF on or before the day the current posting began. A move inside the caller's
 * transaction is audited (rating_drafting UPDATE and INSERT, or the scheduled change).
 */
const audit = require('../../shared/audit');
const scheduled = require('../../shared/scheduled');
const { validationError, AppError } = require('../../shared/errors');
const { parseIsoDate } = require('../../shared/dates');
const { dmy, todayIso, addDays } = require('./drafting.format');
const repo = require('./postings.repo');

const SOURCES = new Map();

function onSource(table, hooks) {
  SOURCES.set(table, hooks || {});
}

const fullName = (r) => [r.surname, r.first_name, r.middle_name].filter(Boolean).join(' ');
const refuse = (field, message) => validationError(message, { [field]: message });

/** Checks a move against the rating's current state; returns what the move needs. */
async function check(conn, { serviceNumber, shipId, wef }, { lock = false } = {}) {
  const p = parseIsoDate(wef);
  if (!wef || !p.valid || !p.value) throw refuse('wef', 'Enter the WEF date as dd/mm/yyyy.');
  const rating = await repo.rating(serviceNumber, conn, lock);
  if (!rating) throw refuse('serviceNumber', 'That rating was not found.');
  if (rating.status !== 'current') throw refuse('serviceNumber', `${fullName(rating)} has left the service and cannot be moved.`);
  const ship = shipId ? await repo.ship(shipId, conn) : null;
  if (!ship) throw refuse('shipId', 'Choose a ship or unit from the list.');
  const open = await repo.openPostings(serviceNumber, conn, lock);
  const current = open[0] || null;
  if (current && current.ship_id === ship.id) throw refuse('shipId', `${fullName(rating)} is already on ${ship.name}.`);
  const latestStart = open.reduce((m, x) => (x.start_date && x.start_date > m ? x.start_date : m), '');
  if (latestStart && p.value <= latestStart) {
    throw refuse('wef', `The WEF must be after ${dmy(latestStart)}, when ${fullName(rating)} joined ${current ? current.ship_name : 'the current ship'}.`);
  }
  return { rating, ship, open, wef: p.value };
}

/** Ends the open postings the day before the WEF and opens the new one on it. */
async function applyNow(tx, actor, { serviceNumber, shipId, wef, authority, remarks }) {
  const conn = tx.connection;
  const { rating, ship, open, wef: day } = await check(conn, { serviceNumber, shipId, wef }, { lock: true });
  for (const o of open) {
    await repo.endPosting(o.id, addDays(day, -1), conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'rating_drafting', recordId: `${serviceNumber}:${o.id}`, before: o, after: await repo.postingRaw(o.id, conn) });
  }
  const postingId = await repo.insertPosting({
    serviceNumber, shipId: ship.id, rateId: rating.rate_id, startDate: day,
    // the new ship's Command, the rating's Branch, the batch's authority (or the signal) and the Active status
    branchId: rating.branch_id, commandId: ship.command_id, authority: (authority || '').slice(0, 150), exitTypeId: await repo.activeExitTypeId(conn),
    remarks: (remarks || (authority ? `Drafted under ${authority}` : '')).slice(0, 500), userId: actor.userId,
  }, conn);
  await audit.record(tx, actor, { action: 'INSERT', table: 'rating_drafting', recordId: `${serviceNumber}:${postingId}`, after: await repo.postingRaw(postingId, conn) });
  return { postingId, ship: ship.name };
}

async function move(tx, actor, { serviceNumber, shipId, wef, authority = '', remarks = '', source = {} }, { today = todayIso() } = {}) {
  const { ship, wef: day } = await check(tx.connection, { serviceNumber, shipId, wef }, { lock: true });
  if (day <= today) {
    const r = await applyNow(tx, actor, { serviceNumber, shipId, wef: day, authority, remarks });
    return { status: 'reported', postingId: r.postingId, ship: r.ship, wef: day };
  }
  const scheduledId = await scheduled.schedule(tx, actor, {
    kind: 'posting', serviceNumber, effectiveDate: day,
    payload: { shipId: ship.id, authority, remarks }, source,
  });
  return { status: 'scheduled', scheduledId, ship: ship.name, wef: day };
}

// the server makes a scheduled move on its date, then tells the record it came from
scheduled.register('posting', {
  async apply(tx, change, actor) {
    const p = change.payload || {};
    const wef = typeof change.effective_date === 'string' ? change.effective_date : todayIso(change.effective_date);
    const r = await applyNow(tx, actor, { serviceNumber: change.service_number, shipId: p.shipId, wef, authority: p.authority, remarks: p.remarks });
    const hooks = SOURCES.get(change.source_table);
    if (hooks && hooks.applied) await hooks.applied(tx, { sourceId: change.source_id, postingId: r.postingId, wef, actor, change });
    return `Moved to ${r.ship} on ${dmy(wef)}`;
  },
  async cancelled(tx, change, reason, actor) {
    const hooks = SOURCES.get(change.source_table);
    if (hooks && hooks.cancelled) await hooks.cancelled(tx, { sourceId: change.source_id, reason, actor, change });
  },
});

/** The moves still to come for a rating, oldest first. */
async function scheduledFor(serviceNumber) {
  const list = await scheduled.forRating(serviceNumber, 'posting');
  const names = await repo.shipNames([...new Set(list.map((c) => c.payload.shipId).filter(Boolean))]);
  return list.map((c) => ({
    id: c.id,
    shipId: c.payload.shipId,
    ship: names.get(c.payload.shipId) || '',
    wef: typeof c.effective_date === 'string' ? c.effective_date : todayIso(c.effective_date),
    authority: c.payload.authority || '',
  }));
}

module.exports = { move, check, onSource, scheduledFor, AppError };
