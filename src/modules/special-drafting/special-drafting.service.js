'use strict';

/*
 * Special Drafting: the rules (PLAN 9e decisions 1 to 4; docs/legacy/drafting.md; the design's D3 section).
 *
 *   Special Draft Proposal   one rating at a time, outside the batch cycle, on a signal's authority: their current
 *                            details, a posting type (Complement, Vice, TY, DW), Drafted To, Authority, WEF,
 *                            Deployment/Vice (required for Vice), Remark. A rating with a draft that is not
 *                            finished (waiting to be printed, or printed with its move still to come) cannot get
 *                            another. Remove is possible until the draft is printed.
 *   Special Draft Report     Print and Mark Printed makes one form (SDF-YYYY-NNNN) of a posting type's waiting
 *                            drafts and moves each rating on its WEF through WP7a's posting move (a WEF after today
 *                            is Scheduled); all or nothing. A printed draft is final. Reprint changes nothing.
 *   Upload Draft             special-drafting.upload.js: the same rules, from a workbook.
 *
 * Nothing here writes rating_drafting: the move is postings.move (src/modules/drafting/postings.service.js).
 */
const db = require('../../db');
const audit = require('../../shared/audit');
const { accountName } = require('../../shared/rating-name');
const { validationError, conflict, notFound, AppError } = require('../../shared/errors');
const { parseIsoDate } = require('../../shared/dates');
const { dmy, isoDay, todayIso, addDays } = require('../drafting/drafting.format');
const postings = require('../drafting/postings.service');
const repo = require('./special-drafting.repo');

// The codes the old page took in a bare box. Their meaning (TY, DW) is not known: they stay codes until Hicad says.
const POSTING_TYPES = Object.freeze([
  { code: 'Complement', label: 'Complement' },
  { code: 'Vice', label: 'Vice' },
  { code: 'TY', label: 'TY' },
  { code: 'DW', label: 'DW' },
]);
const WEF_MAX_DAYS = 365;
const MAX = { authority: 150, vice: 150, remark: 250 };

const text = (v) => (v === undefined || v === null ? '' : String(v).trim());
const idOrNull = (v) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const nameOf = (r) => [String(r.surname || '').toUpperCase(), r.first_name, r.middle_name].filter(Boolean).join(' ');
const sexOf = (g) => (g ? String(g)[0].toUpperCase() : '');
const paging = (q) => ({ page: Math.max(1, Number.parseInt(q.page, 10) || 1), pageSize: 25 });
const meta = (total, page, pageSize) => ({ total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
const who = (row, alias) => (row[`${alias}_username`] ? accountName({
  rating_surname: row[`${alias}_surname`], rating_first_name: row[`${alias}_first_name`], rating_middle_name: row[`${alias}_middle_name`],
  rating_rate_name: row[`${alias}_rate_name`], username: row[`${alias}_username`],
}) : '');

/** The posting type as the list writes it (any case), or null. */
function postingTypeOf(v) {
  const k = text(v).toLowerCase();
  const t = POSTING_TYPES.find((x) => x.code.toLowerCase() === k);
  return t ? t.code : null;
}

// ---- shapes ---------------------------------------------------------------------------------
function shapeDraft(d, today) {
  return {
    id: d.id,
    serviceNumber: d.service_number,
    name: nameOf(d),
    rate: d.rate_name || '',
    rateCode: d.rate_code || d.rate_name || '',
    sex: d.gender || '',
    currentShip: d.current_ship_name || '',
    joinedOn: isoDay(d.joined_on),
    months: d.months_now === null || d.months_now === undefined ? null : Number(d.months_now),
    shipId: d.ship_id,
    draftedTo: d.ship_name || '',
    authority: d.authority,
    wef: isoDay(d.wef),
    future: isoDay(d.wef) > today,
    postingType: d.posting_type,
    vice: d.vice || '',
    remark: d.remark || '',
    status: d.status,
    printed: !!d.form_id,
    formId: d.form_id || null,
    formNumber: d.form_number || '',
    printedAt: d.printed_at || null,
    source: d.source,
    cancelledReason: d.cancelled_reason || '',
    createdBy: who(d, 'cre'),
    createdAt: d.created_at || null,
  };
}

function shapeForm(f) {
  return {
    id: f.id, formNumber: f.form_number, postingType: f.posting_type, count: f.draft_count,
    printedBy: who(f, 'prt'), printedAt: f.printed_at || null,
  };
}

// ---- options --------------------------------------------------------------------------------
async function options() {
  const today = todayIso();
  const ships = await repo.ships();
  return {
    ships: ships.map((s) => ({ id: s.id, name: s.name, active: !!s.is_active })),
    postingTypes: POSTING_TYPES,
    today,
    latestWef: addDays(today, WEF_MAX_DAYS),
  };
}

// ---- the rules for one draft (the form and the upload share them) ----------------------------
/**
 * What is wrong with a draft, as [{ field, message }] (empty when it is fine). `card` is the rating (null when
 * it is not on the roll), `ship` the ship drafted to (null when not chosen or not found).
 */
function problemsWith(x, { card, ship, today }) {
  const out = [];
  const add = (field, message) => { if (!out.some((o) => o.field === field)) out.push({ field, message }); };
  if (!card) { add('serviceNumber', 'That rating was not found.'); return out; }
  const name = [card.rate_code || card.rate_name, nameOf(card)].filter(Boolean).join(' ');
  if (card.status !== 'current') { add('serviceNumber', `${name} has left the service and cannot be drafted.`); return out; }

  if (!x.postingType) add('postingType', 'Choose a posting type from the list.');
  if (!ship) add('shipId', 'Choose a ship or unit from the list.');
  else if (!ship.is_active) add('shipId', `${ship.name} is not active in the Ships table.`);
  else if (card.current_ship_id && card.current_ship_id === ship.id) add('shipId', `${name} is already on ${ship.name}.`);

  if (!x.authority) add('authority', 'Enter the authority (the signal).');
  else if (x.authority.length > MAX.authority) add('authority', `The authority is longer than ${MAX.authority} characters.`);

  const p = parseIsoDate(x.wef);
  if (!x.wef || !p.valid || !p.value) add('wef', 'Enter the WEF date as dd/mm/yyyy.');
  else if (p.value > addDays(today, WEF_MAX_DAYS)) add('wef', `The WEF cannot be more than a year ahead (after ${dmy(addDays(today, WEF_MAX_DAYS))}).`);
  else if (card.joined_on && p.value <= card.joined_on) add('wef', `The WEF must be after ${dmy(card.joined_on)}, when ${name} joined ${card.current_ship_name || 'the current ship'}.`);

  if (x.postingType === 'Vice' && !x.vice) add('vice', 'Deployment/Vice is required for a Vice draft.');
  else if (x.vice.length > MAX.vice) add('vice', `Deployment/Vice is longer than ${MAX.vice} characters.`);
  if (x.remark.length > MAX.remark) add('remark', `The remark is longer than ${MAX.remark} characters.`);
  return out;
}

/** The fields of a request, as the rules read them. */
function inputOf(body = {}) {
  const p = parseIsoDate(body.wef);
  return {
    serviceNumber: text(body.serviceNumber).toUpperCase(),
    postingType: postingTypeOf(body.postingType),
    shipId: idOrNull(body.shipId),
    authority: text(body.authority),
    wef: p.valid && p.value ? p.value : text(body.wef),
    vice: text(body.vice),
    remark: text(body.remark),
  };
}

const existingMessage = (card, open) => `${[card.rate_code || card.rate_name, nameOf(card)].filter(Boolean).join(' ')} already has a special draft ${open.status === 'scheduled' ? 'whose move is still to come' : 'not yet printed'}; a rating cannot be drafted again until it is finished.`;

// ---- Special Draft Proposal ------------------------------------------------------------------
/** A rating's current details for the proposal form, and the draft that stops it getting another. */
async function ratingDetails(serviceNumber) {
  const today = todayIso();
  const card = await repo.ratingCard(text(serviceNumber).toUpperCase(), today);
  if (!card) throw notFound('That rating was not found.');
  const open = (await repo.openDraftsOf([card.service_number]))[0] || null;
  const draft = open ? await repo.findDraft(open.id, today) : null;
  return {
    serviceNumber: card.service_number,
    name: nameOf(card),
    rate: card.rate_name || '',
    rateCode: card.rate_code || card.rate_name || '',
    sex: card.gender || '',
    branch: card.branch_name || '',
    specialisation: card.specialisation_name || '',
    status: card.status,
    currentShip: card.current_ship_name || '',
    currentShipId: card.current_ship_id || null,
    joinedOn: isoDay(card.joined_on),
    months: card.months === null || card.months === undefined ? null : Number(card.months),
    openDraft: draft ? shapeDraft(draft, today) : null,
  };
}

function listFilters(q = {}) {
  const t = postingTypeOf(q.postingType);
  return { status: q.status === 'all' ? 'all' : 'waiting', postingType: t, q: text(q.q), formId: idOrNull(q.formId) };
}

async function listDrafts(q = {}) {
  const today = todayIso();
  const { page, pageSize } = paging(q);
  const f = listFilters(q);
  const r = await repo.listDrafts(f, today, { page, pageSize });
  const counts = await repo.waitingCounts();
  const byType = POSTING_TYPES.map((t) => ({ code: t.code, label: t.label, waiting: Number((counts.find((c) => c.posting_type === t.code) || {}).n || 0) }));
  return {
    items: r.items.map((d) => shapeDraft(d, today)),
    summary: { total: r.total, waiting: byType.reduce((a, t) => a + t.waiting, 0), byType },
    meta: meta(r.total, page, pageSize),
  };
}

async function getDraft(id) {
  const today = todayIso();
  const d = await repo.findDraft(id, today);
  if (!d) throw notFound('That special draft was not found.');
  return shapeDraft(d, today);
}

async function createDraft(body, actor) {
  const x = inputOf(body);
  const today = todayIso();
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    if (!x.serviceNumber) throw validationError('Choose a rating.', { serviceNumber: 'Choose a rating.' });
    await repo.lockRating(x.serviceNumber, conn);
    const card = await repo.ratingCard(x.serviceNumber, today, conn);
    const ship = x.shipId ? (await repo.ships(conn)).find((s) => s.id === x.shipId) || null : null;
    if (card && card.status === 'current') {
      const open = (await repo.openDraftsOf([card.service_number], conn))[0];
      if (open) { const m = existingMessage(card, open); throw conflict(m, 'DRAFT_EXISTS', { serviceNumber: m }); }
    }
    const problems = problemsWith(x, { card, ship, today });
    if (problems.length) {
      const fields = {};
      problems.forEach((p) => { fields[p.field] = p.message; });
      throw validationError(problems[0].message, fields);
    }
    const id = await repo.insertDraft({
      serviceNumber: card.service_number, rateId: card.rate_id, currentShipId: card.current_ship_id, joinedOn: card.joined_on, months: card.months === null ? null : Number(card.months),
      shipId: ship.id, authority: x.authority, wef: x.wef, postingType: x.postingType, vice: x.vice, remark: x.remark, source: 'proposal', userId: actor.userId,
    }, conn);
    await audit.record(tx, actor, { action: 'INSERT', table: 'special_drafts', recordId: `${card.service_number}:${id}`, after: await repo.draftRaw(id, conn) });
    return shapeDraft(await repo.findDraft(id, today, conn), today);
  });
}

async function removeDraft(id, actor) {
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const before = await repo.draftRaw(id, conn, true);
    if (!before) throw notFound('That special draft was not found.');
    if (before.status !== 'unprinted') throw conflict('A printed special draft is final. Correct the posting on the rating\u2019s record instead (it is in the audit trail).', 'PRINTED_FINAL');
    await repo.deleteDraft(id, conn);
    await audit.record(tx, actor, { action: 'DELETE', table: 'special_drafts', recordId: `${before.service_number}:${id}`, before });
    return { id, serviceNumber: before.service_number };
  });
}

// ---- Special Draft Report --------------------------------------------------------------------
/** Why a waiting draft cannot be moved now (the posting move's own checks), for the drafts of one posting type. */
async function problemsOfDrafts(drafts, conn = null, lock = false) {
  const out = [];
  for (const d of drafts) {
    try {
      await postings.check(conn, { serviceNumber: d.service_number, shipId: d.ship_id, wef: isoDay(d.wef) }, { lock });
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      out.push({ id: d.id, serviceNumber: d.service_number, name: nameOf(d), message: err.message });
    }
  }
  return out;
}

function typeOrThrow(v) {
  const t = postingTypeOf(v);
  if (!t) throw validationError('Choose a posting type from the list.', { postingType: 'Choose a posting type from the list.' });
  return t;
}

/** The posting types with how many drafts wait, and for one type whether its drafts can all be printed now. */
async function reportTypes(q = {}) {
  const counts = await repo.waitingCounts();
  const types = POSTING_TYPES.map((t) => ({ code: t.code, label: t.label, waiting: Number((counts.find((c) => c.posting_type === t.code) || {}).n || 0) }));
  const out = { types };
  const t = postingTypeOf(q.postingType);
  if (t) {
    const drafts = await repo.waitingOfType(t, todayIso());
    out.postingType = t;
    const today = todayIso();
    out.ready = drafts.length;
    out.moveNow = drafts.filter((d) => isoDay(d.wef) <= today).length;
    out.scheduled = drafts.length - out.moveNow;
    out.problems = await problemsOfDrafts(drafts);
  }
  return out;
}

/** The waiting drafts of a posting type, for the form's preview (nothing is marked). */
async function previewData(postingType) {
  const t = typeOrThrow(postingType);
  const today = todayIso();
  const drafts = await repo.waitingOfType(t, today);
  if (!drafts.length) throw conflict(`There are no ${t} drafts waiting to be printed.`, 'NOTHING_TO_PRINT', { postingType: `There are no ${t} drafts waiting to be printed.` });
  return { postingType: t, today, drafts: drafts.map((d) => shapeDraft(d, today)), problems: await problemsOfDrafts(drafts) };
}

const moveRemark = (d) => [`Drafted under ${d.authority}`, d.vice, d.remark].filter(Boolean).join(' \u00b7 ').slice(0, 500);

/**
 * Print and Mark Printed: the form gets its number, every waiting draft of the posting type is marked printed and
 * each rating is moved on its WEF through the posting move (a WEF after today is Scheduled). All or nothing: if a
 * draft can no longer be moved nothing is printed and the drafts that cannot are named.
 */
async function printForm(body, actor) {
  const t = typeOrThrow(body && body.postingType);
  const today = todayIso();
  const done = await db.transaction(async (tx) => {
    const conn = tx.connection;
    const drafts = await repo.waitingOfType(t, today, conn, true);
    if (!drafts.length) throw conflict(`There are no ${t} drafts waiting to be printed.`, 'NOTHING_TO_PRINT', { postingType: `There are no ${t} drafts waiting to be printed.` });
    const problems = await problemsOfDrafts(drafts, conn, true);
    if (problems.length) {
      const shown = problems.slice(0, 3).map((p) => `${p.serviceNumber}: ${p.message}`).join(' ');
      throw conflict(`${plural(problems.length, 'draft')} cannot be printed. ${shown}${problems.length > 3 ? ` (and ${problems.length - 3} more)` : ''} Remove ${problems.length === 1 ? 'it' : 'them'} on Special Draft Proposal, then print again.`, 'DRAFTS_NOT_READY');
    }
    const year = Number(today.slice(0, 4));
    const seq = await repo.nextFormSeq(year, conn);
    const formNumber = `SDF-${year}-${String(seq).padStart(4, '0')}`;
    const formId = await repo.insertForm({ formNumber, year, seq, postingType: t, count: drafts.length, userId: actor.userId }, conn);
    await audit.record(tx, actor, { action: 'INSERT', table: 'special_draft_forms', recordId: formNumber, after: await repo.formRaw(formId, conn) });

    let moved = 0;
    let scheduled = 0;
    for (const d of drafts) {
      const card = await repo.ratingCard(d.service_number, today, conn);
      const before = await repo.draftRaw(d.id, conn);
      const r = await postings.move(tx, actor, {
        serviceNumber: d.service_number, shipId: d.ship_id, wef: isoDay(d.wef), authority: d.authority, remarks: moveRemark(d),
        source: { table: 'special_drafts', id: d.id },
      }, { today });
      const isNow = r.status === 'reported';
      await repo.markPrinted(d.id, {
        rateId: card.rate_id, currentShipId: card.current_ship_id, joinedOn: card.joined_on, months: card.months === null ? null : Number(card.months),
        formId, status: isNow ? 'moved' : 'scheduled', postingId: isNow ? r.postingId : null, scheduledChangeId: isNow ? null : r.scheduledId,
      }, conn);
      await audit.record(tx, actor, { action: 'UPDATE', table: 'special_drafts', recordId: `${d.service_number}:${d.id}`, before, after: await repo.draftRaw(d.id, conn) });
      if (isNow) moved += 1; else scheduled += 1;
    }
    return { formId, moved, scheduled };
  });
  return { form: shapeForm(await repo.findForm(done.formId)), moved: done.moved, scheduled: done.scheduled };
}

// ---- printed forms ---------------------------------------------------------------------------
async function listForms(q = {}) {
  const { page, pageSize } = paging(q);
  const r = await repo.listForms({ postingType: postingTypeOf(q.postingType), q: text(q.q) }, { page, pageSize });
  return { items: r.items.map(shapeForm), meta: meta(r.total, page, pageSize) };
}

async function getForm(id) {
  const f = await repo.findForm(id);
  if (!f) throw notFound('That form was not found.');
  const today = todayIso();
  const drafts = (await repo.listDrafts({ status: 'all', formId: id }, today, { page: 1, pageSize: 5000 })).items;
  return { form: shapeForm(f), drafts: drafts.map((d) => shapeDraft(d, today)) };
}

// what the printouts need (special-drafting.documents.js)
async function letterData(id) {
  const d = await getDraft(id);
  const card = await repo.ratingCard(d.serviceNumber, todayIso());
  return { draft: d, branch: card ? card.branch_name || '' : '' };
}

// a scheduled move was made on its date (or could no longer be made): the draft follows
postings.onSource('special_drafts', {
  async applied(tx, { sourceId, postingId, actor }) {
    const before = await repo.draftRaw(sourceId, tx.connection, true);
    if (!before || before.status !== 'scheduled') return;
    await repo.setOutcome(sourceId, { status: 'moved', postingId }, tx.connection);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'special_drafts', recordId: `${before.service_number}:${sourceId}`, before, after: await repo.draftRaw(sourceId, tx.connection) });
  },
  async cancelled(tx, { sourceId, reason, actor }) {
    const before = await repo.draftRaw(sourceId, tx.connection, true);
    if (!before || before.status !== 'scheduled') return;
    await repo.setOutcome(sourceId, { status: 'cancelled', reason: String(reason || 'The move could not be made.').slice(0, 250) }, tx.connection);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'special_drafts', recordId: `${before.service_number}:${sourceId}`, before, after: await repo.draftRaw(sourceId, tx.connection) });
  },
});

module.exports = {
  POSTING_TYPES, WEF_MAX_DAYS, MAX, postingTypeOf, problemsWith, existingMessage, nameOf, sexOf, text, plural,
  options, ratingDetails, listDrafts, getDraft, createDraft, removeDraft,
  reportTypes, previewData, printForm, listForms, getForm, letterData,
};
