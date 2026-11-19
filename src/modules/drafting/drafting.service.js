'use strict';

/*
 * Drafting: the rules of the cycle (docs/legacy/drafting.md section 15; PLAN 9a decisions 1 to 5 and 7).
 *
 *   Update Manning Requirement   advisory: required, aboard (current postings) and the difference
 *   Print Draft Proposal         who is due (reads only); a batch is made only by createBatch
 *   Review/Print Draft           a batch's rows: proposed ship, vice, remark; Not Recommended; Remove; Add; Clear
 *   Draft Approval               per department (cycle.service)
 *   Close Draft                  one batch, final (cycle.service)
 *   Update WEF                   the posting move (postings.service): now, or scheduled for a later date
 *
 * Who is due is a placeholder rule with its numbers in the settings table (drafting.due_months and the two
 * month bands): a current rating with a current posting of at least drafting.due_months months. A rating
 * whose draft is not finished (a live row of an open batch, or of a closed batch waiting for its WEF or
 * scheduled) is shown with its batch and left out of a new one. A user tied to a specialisation (their
 * department) sees only that department's batches, due list and approval.
 */
const db = require('../../db');
const audit = require('../../shared/audit');
const settings = require('../../shared/settings');
const { validationError, conflict, notFound, forbidden } = require('../../shared/errors');
const { parseIsoDate } = require('../../shared/dates');
const { dmy, todayIso, addDays } = require('./drafting.format');
const cycle = require('./cycle.service');
const postings = require('./postings.service');
const repo = require('./drafting.repo');

const RANKS = ['S/LT', 'LT', 'LTCDR', 'CDR', 'CAPT', 'CDRE', 'R/ADM', 'ADM'];
const REQUESTS = ['Medical', 'Special Requests', 'Others'];
const WEF_MAX_DAYS = 365;

const FLOW = cycle.registerFlow('DOD', {
  rowsTable: 'draft_rows',
  target: 'proposed_ship_id',
  targetLabel: 'proposed ship',
  closedStatus: 'awaiting_wef',
  noun: 'draft',
  ranks: RANKS,
});

const text = (v) => (v === undefined || v === null ? '' : String(v).trim());
const idOrNull = (v) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const nameOf = (r) => [String(r.surname || '').toUpperCase(), r.first_name, r.middle_name].filter(Boolean).join(' ');
const sexOf = (g) => (g ? String(g)[0].toUpperCase() : '');
const paging = (q) => ({ page: Math.max(1, Number.parseInt(q.page, 10) || 1), pageSize: 25 });
const meta = (total, page, pageSize) => ({ total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });

// ---- the due rule (settings) ----------------------------------------------------------
const RULE_KEYS = ['drafting.due_months', 'drafting.band_green_to', 'drafting.band_amber_to'];
async function rule() {
  const s = await settings.numbers(RULE_KEYS);
  return { dueMonths: s['drafting.due_months'], greenTo: s['drafting.band_green_to'], amberTo: s['drafting.band_amber_to'] };
}
/** The pill tone for months on a ship: under the due month neutral, then green, amber, red. */
const band = (m, r) => (m === null || m === undefined || m < r.dueMonths ? 'neutral' : m <= r.greenTo ? 'success' : m <= r.amberTo ? 'warning' : 'error');

/** A department-tied user may only work on their own department. */
function scopeOf(user) {
  return { specialisationId: (user && user.specialisationId) || null };
}
function checkDepartment(scope, specialisationId, what = 'batch') {
  if (scope.specialisationId && Number(specialisationId) !== Number(scope.specialisationId)) {
    throw forbidden(`This ${what} belongs to another department.`);
  }
}

// ---- options -----------------------------------------------------------------------------
async function options(user) {
  const o = await repo.options();
  const scope = scopeOf(user);
  const r = await rule();
  return {
    ships: o.ships.map((s) => ({ id: s.id, name: s.name, type: s.type, active: !!s.is_active })),
    rates: o.rates.map((x) => ({ id: x.id, name: x.name, code: x.code })),
    branches: o.branches.map((x) => ({ id: x.id, name: x.name, code: x.code, active: !!x.is_active })),
    specialisations: o.specialisations.map((x) => ({ id: x.id, name: x.name, code: x.code, active: !!x.is_active })),
    ranks: RANKS,
    requests: REQUESTS,
    department: scope.specialisationId ? (o.specialisations.find((x) => x.id === scope.specialisationId) || { id: scope.specialisationId, name: '' }) : null,
    rule: r,
    today: todayIso(),
  };
}

// ---- 1. Update Manning Requirement ----------------------------------------------------------
const diffText = (d) => (d > 0 ? `+${d}` : String(d));
function shapeManning(m) {
  const aboard = Number(m.aboard || 0);
  return {
    id: m.id, shipId: m.ship_id, ship: m.ship_name, rateId: m.rate_id, rate: m.rate_name, rateCode: m.rate_code || m.rate_name,
    specialisationId: m.specialisation_id, specialisation: m.specialisation_name, required: m.quantity, aboard, difference: aboard - m.quantity,
  };
}

function manningFilters(q = {}) {
  return { shipId: idOrNull(q.shipId), rateId: idOrNull(q.rateId), specialisationId: idOrNull(q.specialisationId) };
}

async function listManning(q = {}) {
  const { page, pageSize } = paging(q);
  const r = await repo.listManning(manningFilters(q), { page, pageSize });
  return { items: r.items.map(shapeManning), summary: { requirements: r.total, required: r.required, aboard: r.aboard }, meta: meta(r.total, page, pageSize) };
}

async function validateManning(body, exceptId, conn) {
  const errors = {};
  const shipId = idOrNull(body.shipId);
  const rateId = idOrNull(body.rateId);
  const specialisationId = idOrNull(body.specialisationId);
  const qty = text(body.quantity);
  if (!shipId) errors.shipId = 'Choose the ship or unit.';
  if (!rateId) errors.rateId = 'Choose the rate.';
  if (!specialisationId) errors.specialisationId = 'Choose the specialisation.';
  if (!/^\d+$/.test(qty) || Number(qty) < 1 || Number(qty) > 99) errors.quantity = 'Enter a whole number from 1 to 99.';
  const ship = shipId ? await repo.refRow('ref_ship', shipId, conn) : null;
  const rate = rateId ? await repo.refRow('ref_rate', rateId, conn) : null;
  const spec = specialisationId ? await repo.refRow('ref_specialisation', specialisationId, conn) : null;
  if (shipId && !ship) errors.shipId = 'Choose a ship or unit from the list.';
  if (rateId && !rate) errors.rateId = 'Choose a rate from the list.';
  if (specialisationId && !spec) errors.specialisationId = 'Choose a specialisation from the list.';
  if (ship && rate && spec) {
    const dup = await repo.manningDuplicate({ shipId, rateId, specialisationId, exceptId }, conn);
    if (dup) errors.shipId = `${ship.name} already has a requirement for ${rate.code || rate.name} ${spec.name}. Edit that one instead.`;
  }
  if (Object.keys(errors).length) throw validationError('Check the highlighted fields.', errors);
  return { shipId, rateId, specialisationId, quantity: Number(qty) };
}

async function addManning(body, actor) {
  return db.transaction(async (tx) => {
    const v = await validateManning(body, 0, tx.connection);
    const id = await repo.insertManning({ ...v, userId: actor.userId }, tx.connection);
    await audit.record(tx, actor, { action: 'INSERT', table: 'manning_requirements', recordId: id, after: await repo.manningRaw(id, tx.connection) });
    return shapeManning(await repo.findManning(id, tx.connection));
  });
}

async function editManning(id, body, actor) {
  return db.transaction(async (tx) => {
    const before = await repo.manningRaw(id, tx.connection, true);
    if (!before) throw notFound('That requirement was not found.', 'MANNING_NOT_FOUND');
    const v = await validateManning(body, id, tx.connection);
    await repo.updateManning(id, v, tx.connection);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'manning_requirements', recordId: id, before, after: await repo.manningRaw(id, tx.connection) });
    return shapeManning(await repo.findManning(id, tx.connection));
  });
}

async function deleteManning(id, actor) {
  return db.transaction(async (tx) => {
    const before = await repo.manningRaw(id, tx.connection, true);
    if (!before) throw notFound('That requirement was not found.', 'MANNING_NOT_FOUND');
    await repo.deleteManning(id, tx.connection);
    await audit.record(tx, actor, { action: 'DELETE', table: 'manning_requirements', recordId: id, before });
    return { id };
  });
}

async function manningForPrint(q = {}) {
  const f = { shipId: idOrNull(q.shipId) };
  const ship = f.shipId ? await repo.refRow('ref_ship', f.shipId) : null;
  if (f.shipId && !ship) throw validationError('Choose a ship or unit from the list.', { shipId: 'Choose a ship or unit from the list.' });
  return { ship: ship ? ship.name : 'All', rows: (await repo.allManning(f)).map(shapeManning) };
}

// ---- 2. Print Draft Proposal -----------------------------------------------------------------
function shapeDue(r, rl) {
  const months = r.months === null || r.months === undefined ? null : Number(r.months);
  return {
    serviceNumber: r.service_number, name: nameOf(r), rate: r.rate_name || '', rateCode: r.rate_code || r.rate_name || '', sex: r.gender || '',
    branch: r.branch_name || '', specialisationId: r.specialisation_id, specialisation: r.specialisation_name || '',
    shipId: r.ship_id, ship: r.ship_name || '', joinedOn: r.joined_on, months, band: band(months, rl),
    lastShip1: r.last_ship_1 || '', lastShip2: r.last_ship_2 || '', authority: r.last_authority || '',
    inBatch: r.in_batch || '', inBatchId: r.in_batch_id || null,
  };
}

/** The proposal filters; a department-tied user is held to their department. */
async function proposalFilters(q, scope) {
  const f = { branchId: idOrNull(q.branchId), specialisationId: idOrNull(q.specialisationId), rateId: idOrNull(q.rateId) };
  if (scope.specialisationId) {
    if (f.specialisationId && f.specialisationId !== scope.specialisationId) throw forbidden('You may only draft your own department.');
    f.specialisationId = scope.specialisationId;
  }
  return f;
}

async function listDue(q = {}, user) {
  const scope = scopeOf(user);
  const rl = await rule();
  const f = { ...(await proposalFilters(q, scope)), today: todayIso(), dueMonths: rl.dueMonths };
  const { page, pageSize } = paging(q);
  const r = await repo.listDue(f, { page, pageSize });
  return { items: r.items.map((x) => shapeDue(x, rl)), summary: { due: r.total, inBatch: r.inBatch, toAdd: r.total - r.inBatch, dueMonths: rl.dueMonths }, meta: meta(r.total, page, pageSize) };
}

/** The batch code and labels for the filters. */
async function codeFor(f, conn = null) {
  const branch = f.branchId ? await repo.refRow('ref_branch', f.branchId, conn) : null;
  const spec = f.specialisationId ? await repo.refRow('ref_specialisation', f.specialisationId, conn) : null;
  const rate = f.rateId ? await repo.refRow('ref_rate', f.rateId, conn) : null;
  const errors = {};
  if (f.branchId && !branch) errors.branchId = 'Choose a branch from the list.';
  if (f.specialisationId && !spec) errors.specialisationId = 'Choose a specialisation from the list.';
  if (f.rateId && !rate) errors.rateId = 'Choose a rate from the list.';
  if (Object.keys(errors).length) throw validationError('Check the filters.', errors);
  return {
    code: cycle.batchCode('DOD', { branch: branch && (branch.code || branch.name), specialisation: spec && (spec.code || spec.name), rate: rate && (rate.code || rate.name) }),
    labels: { branch: branch ? branch.name : 'All branches', specialisation: spec ? spec.name : 'All specialisations', rate: rate ? rate.name : 'All rates' },
  };
}

/** What Create Draft Batch would do: the batch number, whether it adds to an open batch, the counts. */
async function previewBatch(q = {}, user) {
  const scope = scopeOf(user);
  const rl = await rule();
  const f = await proposalFilters(q, scope);
  const { code, labels } = await codeFor(f);
  const due = await repo.listDue({ ...f, today: todayIso(), dueMonths: rl.dueMonths }, { page: 1, pageSize: 1 });
  const p = await cycle.previewBatch(FLOW, code);
  return { ...p, labels, due: due.total, toAdd: due.total - due.inBatch, leftOut: due.inBatch };
}

async function createBatch(body = {}, user, actor) {
  const scope = scopeOf(user);
  const rl = await rule();
  const f = await proposalFilters(body, scope);
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const { code } = await codeFor(f, conn);
    const fresh = await repo.dueFresh({ ...f, today: todayIso(), dueMonths: rl.dueMonths }, conn);
    if (!fresh.length) {
      throw conflict('Nobody on this list can be added: everyone due is already in a batch, or nobody is due. Review that batch, or change the filters.', 'NOTHING_TO_ADD');
    }
    const { batch, created } = await cycle.openOrCreateBatch(tx, actor, FLOW, { code, branchId: f.branchId, specialisationId: f.specialisationId, rateId: f.rateId });
    for (const r of fresh) await addRowFor(tx, actor, batch.id, r, null);
    await cycle.refreshStatus(tx, actor, FLOW, batch.id);
    return { batch: await cycle.getBatch(FLOW, batch.id, conn), added: fresh.length, created };
  });
}

/** Adds a rating (a due-list row) to a batch, or takes a not-recommended row of it back in. */
async function addRowFor(tx, actor, batchId, r, request) {
  const conn = tx.connection;
  const x = {
    batchId, serviceNumber: r.service_number, rateId: r.rate_id, specialisationId: r.specialisation_id, currentShipId: r.ship_id,
    joinedOn: r.joined_on, months: r.months === null || r.months === undefined ? null : Number(r.months), request, userId: actor.userId,
  };
  const old = await repo.rowOfRating(batchId, r.service_number, conn);
  if (old) {
    await repo.resetRow(old.id, x, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'draft_rows', recordId: `${r.service_number}:${old.id}`, before: old, after: await repo.rowRaw(old.id, conn) });
    return old.id;
  }
  const id = await repo.insertRow(x, conn);
  await audit.record(tx, actor, { action: 'INSERT', table: 'draft_rows', recordId: `${r.service_number}:${id}`, after: await repo.rowRaw(id, conn) });
  return id;
}

// ---- batches (Review, Close, Update WEF) ----------------------------------------------------------
function shapeBatchSummary(b) {
  return {
    ...cycle.shapeBatch(b),
    live: Number(b.live || 0), withShip: Number(b.with_ship || 0), dated: Number(b.dated || 0), notRecommended: Number(b.not_recommended || 0),
  };
}

async function listBatches(q = {}, user) {
  const stage = q.stage === 'wef' ? 'wef' : 'open';
  const scope = scopeOf(user);
  const rows = await repo.listBatches({ stage, specialisationId: scope.specialisationId, today: todayIso() });
  const items = [];
  for (const b of rows) {
    const s = shapeBatchSummary(b);
    if (stage === 'open') s.readiness = await cycle.readiness(FLOW, b.id);
    items.push(s);
  }
  return { items };
}

async function loadBatch(id, user, conn = null) {
  const b = await cycle.getBatch(FLOW, id, conn);
  checkDepartment(scopeOf(user), b.specialisationId);
  return b;
}

async function getBatch(id, user) {
  const b = await loadBatch(id, user);
  const ready = await cycle.readiness(FLOW, id);
  const depts = (await repo.batchDepartmentCounts(id)).map((d) => ({ specialisationId: d.id, department: d.name || 'No specialisation', ratings: Number(d.n), pending: Number(d.pending || 0) }));
  return { ...b, readiness: ready, departments: depts };
}

function shapeRow(x, rl) {
  const months = x.months_now === null || x.months_now === undefined ? x.months_on_ship : Number(x.months_now);
  return {
    id: x.id, batchId: x.batch_id, batchNumber: x.batch_number, batchStatus: x.batch_status,
    serviceNumber: x.service_number, name: nameOf(x), rate: x.rate_name || '', rateCode: x.rate_code || x.rate_name || '', sex: x.gender || '',
    specialisationId: x.specialisation_id, specialisation: x.specialisation_name || '',
    currentShipId: x.current_ship_id, currentShip: x.current_ship_name || '', joinedOn: x.joined_on, months, band: band(months, rl),
    nowShipId: x.now_ship_id, nowShip: x.now_ship_name || '',
    proposedShipId: x.proposed_ship_id, proposedShip: x.proposed_ship_name || '', vice: x.vice || '', remark: x.remark || '', request: x.request || '',
    status: x.status,
    notRecommended: x.status === 'not_recommended' ? { reason: x.not_recommended_reason, at: x.not_recommended_at, by: cycle.who(x, 'nr') } : null,
    approval: x.approval_id ? { rank: x.approver_rank, name: x.approver_name, appointment: x.approval_appointment, approvedAt: x.approved_at } : null,
    wef: x.wef, authority: x.authority || '', closeDate: x.close_date,
  };
}

/** The Over by n / Under by n of a proposed ship (advisory): what it will have once the open batches are carried out. */
async function manningFor(row, cache) {
  if (!row.proposedShipId || row.status !== 'proposed' || !row.specialisationId) return null;
  const rateId = row._rateId;
  const key = `${row.proposedShipId}|${rateId}|${row.specialisationId}`;
  if (!cache.has(key)) {
    const need = await repo.requirement(row.proposedShipId, rateId, row.specialisationId);
    if (need === null) cache.set(key, null);
    else {
      const aboard = await repo.aboardCount(row.proposedShipId, rateId, row.specialisationId);
      const f = await repo.draftFlows(row.proposedShipId, rateId, row.specialisationId);
      const will = aboard + f.incoming - f.outgoing;
      cache.set(key, { required: need, aboard, will, difference: will - need });
    }
  }
  return cache.get(key);
}

async function listRows(batchId, q = {}, user) {
  const b = await loadBatch(batchId, user);
  const rl = await rule();
  const { page, pageSize } = paging(q);
  const specialisationId = idOrNull(q.specialisationId);
  const r = await repo.listRows({ batchId, specialisationId, q: text(q.q).slice(0, 80) }, { page, pageSize, today: todayIso() });
  const cache = new Map();
  const items = [];
  for (const x of r.items) {
    const row = { ...shapeRow(x, rl), _rateId: x.rate_id };
    if (b.status !== 'closed') row.manning = await manningFor(row, cache);
    delete row._rateId;
    items.push(row);
  }
  return { items, meta: meta(r.total, page, pageSize) };
}

/** A row of an open batch, locked, with its batch checked. */
async function lockOpenRow(tx, batchId, rowId, user) {
  const b = await loadBatch(batchId, user, tx.connection);
  if (b.status === 'closed') throw conflict(`${b.batchNumber} is closed. A closed batch is final; a correction is made on the rating's record.`, 'BATCH_CLOSED');
  const row = await repo.rowRaw(rowId, tx.connection, true);
  if (!row || row.batch_id !== b.id) throw notFound('That rating is not in this batch.', 'ROW_NOT_FOUND');
  return { b, row };
}

async function rowResult(rowId, conn) {
  const rl = await rule();
  const x = await repo.findRow(rowId, todayIso(), conn);
  return x ? shapeRow(x, rl) : null;
}

async function editPosting(batchId, rowId, body, user, actor) {
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const { row } = await lockOpenRow(tx, batchId, rowId, user);
    if (row.status !== 'proposed') throw conflict('This rating is not recommended. Remove the row, or add the rating again.', 'ROW_NOT_RECOMMENDED');
    const errors = {};
    const shipId = idOrNull(body.shipId);
    const vice = text(body.vice);
    const remark = text(body.remark);
    const ship = shipId ? await repo.refRow('ref_ship', shipId, conn) : null;
    if (!shipId) errors.shipId = 'Choose the ship the rating is drafted to.';
    else if (!ship || !ship.is_active) errors.shipId = 'Choose a ship or unit from the list.';
    if (vice.length > 150) errors.vice = 'Use at most 150 characters.';
    if (remark.length > 250) errors.remark = 'Use at most 250 characters.';
    if (!errors.shipId) {
      const current = await repo.findRow(rowId, todayIso(), conn);
      const nowShip = current.now_ship_id || current.current_ship_id;
      if (nowShip && nowShip === shipId) errors.shipId = `${nameOf(current)} is already on ${ship.name}. Choose another ship.`;
    }
    if (Object.keys(errors).length) throw validationError('Check the highlighted fields.', errors);
    const changedShip = row.proposed_ship_id !== shipId;
    await repo.updatePosting(rowId, { shipId, vice, remark }, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'draft_rows', recordId: `${row.service_number}:${rowId}`, before: row, after: await repo.rowRaw(rowId, conn) });
    const reapprove = changedShip ? await cycle.clearApproval(tx, actor, FLOW, rowId) : false;
    await cycle.refreshStatus(tx, actor, FLOW, row.batch_id);
    return { row: await rowResult(rowId, conn), reapprove };
  });
}

async function notRecommend(batchId, rowId, body, user, actor) {
  const reason = text(body.reason);
  if (!reason) throw validationError('Give the reason.', { reason: 'Give the reason.' });
  if (reason.length > 250) throw validationError('The reason is too long.', { reason: 'Use at most 250 characters.' });
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const { row } = await lockOpenRow(tx, batchId, rowId, user);
    if (row.status !== 'proposed') throw conflict('This rating is already not recommended.', 'ROW_NOT_RECOMMENDED');
    await repo.notRecommend(rowId, { reason, userId: actor.userId }, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'draft_rows', recordId: `${row.service_number}:${rowId}`, before: row, after: await repo.rowRaw(rowId, conn) });
    await cycle.refreshStatus(tx, actor, FLOW, row.batch_id);
    return { row: await rowResult(rowId, conn) };
  });
}

async function removeRow(batchId, rowId, user, actor) {
  return db.transaction(async (tx) => {
    const { row } = await lockOpenRow(tx, batchId, rowId, user);
    await repo.deleteRow(rowId, tx.connection);
    await audit.record(tx, actor, { action: 'DELETE', table: 'draft_rows', recordId: `${row.service_number}:${rowId}`, before: row });
    await cycle.refreshStatus(tx, actor, FLOW, row.batch_id);
    return { id: rowId, serviceNumber: row.service_number };
  });
}

async function clearBatch(batchId, user, actor) {
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const b = await loadBatch(batchId, user, conn);
    if (b.status === 'closed') throw conflict(`${b.batchNumber} is closed. A closed batch is final.`, 'BATCH_CLOSED');
    const rows = await repo.rowsOfBatch(batchId, conn);
    for (const row of rows) {
      await repo.deleteRow(row.id, conn);
      await audit.record(tx, actor, { action: 'DELETE', table: 'draft_rows', recordId: `${row.service_number}:${row.id}`, before: row });
    }
    await cycle.refreshStatus(tx, actor, FLOW, batchId);
    return { removed: rows.length };
  });
}

async function addPersonnel(batchId, body, user, actor) {
  const sn = text(body.serviceNumber);
  const request = text(body.request);
  if (!sn) throw validationError('Choose the rating.', { serviceNumber: 'Choose the rating.' });
  if (request && !REQUESTS.includes(request)) throw validationError('Choose a request from the list.', { request: 'Choose a request from the list.' });
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const b = await loadBatch(batchId, user, conn);
    if (b.status === 'closed') throw conflict(`${b.batchNumber} is closed. A closed batch is final.`, 'BATCH_CLOSED');
    const basic = await repo.ratingBasic(sn, conn);
    const refuse = (m) => validationError(m, { serviceNumber: m });
    if (!basic) throw refuse('That rating was not found.');
    const who = nameOf(basic);
    if (basic.status !== 'current') throw refuse(`${who} has left the service and cannot be added.`);
    const pend = await repo.pendingDraftOf(sn, conn);
    if (pend && pend.batch_id === b.id) throw refuse(`${who} is already in this batch.`);
    if (pend) throw refuse(`${who} is already in batch ${pend.batch_number}.`);
    const r = await repo.ratingForDraft(sn, todayIso(), conn);
    if (!r) throw refuse(`${who} has no current posting. Add it on the rating's Drafting tab first.`);
    const id = await addRowFor(tx, actor, b.id, r, request || null);
    await cycle.refreshStatus(tx, actor, FLOW, b.id);
    return { row: await rowResult(id, conn) };
  });
}

// ---- 4. Draft Approval -------------------------------------------------------------------------
async function approvals(user) {
  const scope = scopeOf(user);
  const items = await cycle.departments(FLOW, scope);
  return { items, summary: { departments: items.length, approved: items.filter((d) => d.status === 'approved').length, waiting: items.filter((d) => d.status !== 'approved').length } };
}

async function approvalRows(specialisationId, q = {}, user) {
  checkDepartment(scopeOf(user), specialisationId, 'department');
  const rl = await rule();
  const { page, pageSize } = paging(q);
  const r = await repo.listRows({ openDepartment: specialisationId }, { page, pageSize, today: todayIso() });
  return { items: r.items.map((x) => shapeRow(x, rl)), meta: meta(r.total, page, pageSize) };
}

async function approve(specialisationId, body, user, actor) {
  checkDepartment(scopeOf(user), specialisationId, 'department');
  return db.transaction((tx) => cycle.approveDepartment(tx, actor, FLOW, specialisationId, body));
}

// ---- 5. Close Draft ------------------------------------------------------------------------------
async function closeBatch(batchId, body, user, actor) {
  await loadBatch(batchId, user);
  const raw = text(body.closeDate);
  const p = raw ? parseIsoDate(raw) : { valid: true, value: null };
  if (!p.valid) throw validationError('Check the highlighted fields.', { closeDate: 'Enter the close date as dd/mm/yyyy.' });
  return db.transaction((tx) => cycle.closeBatch(tx, actor, FLOW, batchId, { authority: body.authority, closeDate: p.value, today: todayIso() }));
}

// ---- 6. Update WEF ---------------------------------------------------------------------------------
function wefDate(raw, b) {
  const p = parseIsoDate(text(raw));
  if (!text(raw) || !p.valid || !p.value) throw validationError('Check the highlighted fields.', { wef: 'Enter the WEF date as dd/mm/yyyy.' });
  const authorityDate = b.closeDate;
  if (authorityDate && p.value < authorityDate) throw validationError('Check the highlighted fields.', { wef: `The WEF cannot be before the authority date (${dmy(authorityDate)}).` });
  if (p.value > addDays(todayIso(), WEF_MAX_DAYS)) throw validationError('Check the highlighted fields.', { wef: 'The WEF cannot be more than a year ahead.' });
  return p.value;
}

async function moveRow(tx, actor, b, row, wef) {
  const conn = tx.connection;
  const r = await postings.move(tx, actor, {
    serviceNumber: row.service_number, shipId: row.proposed_ship_id, wef, authority: b.authority, source: { table: 'draft_rows', id: row.id },
  });
  await repo.setWef(row.id, { status: r.status, wef, postingId: r.postingId || null, scheduledId: r.scheduledId || null, userId: actor.userId }, conn);
  await audit.record(tx, actor, { action: 'UPDATE', table: 'draft_rows', recordId: `${row.service_number}:${row.id}`, before: row, after: await repo.rowRaw(row.id, conn) });
  return r;
}

async function loadClosedBatch(batchId, user, conn) {
  const b = await loadBatch(batchId, user, conn);
  if (b.status !== 'closed' || !b.authority) throw conflict('Only a closed batch with its authority can be dated.', 'BATCH_NOT_CLOSED');
  return b;
}

async function setRowWef(batchId, rowId, body, user, actor) {
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const b = await loadClosedBatch(batchId, user, conn);
    const wef = wefDate(body.wef, b);
    const row = await repo.rowRaw(rowId, conn, true);
    if (!row || row.batch_id !== b.id) throw notFound('That rating is not in this batch.', 'ROW_NOT_FOUND');
    if (row.status !== 'awaiting_wef') throw conflict('This rating\'s WEF is already set.', 'WEF_SET');
    if (!row.proposed_ship_id) throw conflict('This rating has no proposed ship.', 'NO_PROPOSED_SHIP');
    try {
      const r = await moveRow(tx, actor, b, row, wef);
      return { status: r.status, ship: r.ship, wef, row: await rowResult(rowId, conn) };
    } catch (err) {
      if (err.fields && (err.fields.shipId || err.fields.serviceNumber)) throw validationError(err.message, { wef: err.message });
      throw err;
    }
  });
}

async function setDepartmentWef(batchId, body, user, actor) {
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const b = await loadClosedBatch(batchId, user, conn);
    const wef = wefDate(body.wef, b);
    const scope = scopeOf(user);
    const specialisationId = scope.specialisationId || idOrNull(body.specialisationId);
    const rows = await repo.pendingWefRows(b.id, specialisationId, conn);
    if (!rows.length) throw validationError('No pending rating with a proposed ship in this selection.', { specialisationId: 'No pending rating with a proposed ship in this selection.' });
    const out = { reported: 0, scheduled: 0 };
    for (const row of rows) {
      try {
        const r = await moveRow(tx, actor, b, row, wef);
        out[r.status] += 1;
      } catch (err) {
        if (err.fields) {
          const who = await repo.ratingBasic(row.service_number, conn);
          const m = `${who ? nameOf(who) : row.service_number}: ${err.message} Nothing was saved.`;
          throw validationError(m, { wef: m });
        }
        throw err;
      }
    }
    return { ...out, ratings: rows.length, wef };
  });
}

// a scheduled move made on its date: the draft row is reported; one that could not be made waits again
postings.onSource('draft_rows', {
  async applied(tx, { sourceId, postingId, actor }) {
    const before = await repo.rowRaw(sourceId, tx.connection, true);
    if (!before) return;
    await repo.markReported(sourceId, postingId, tx.connection);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'draft_rows', recordId: `${before.service_number}:${sourceId}`, before, after: await repo.rowRaw(sourceId, tx.connection) });
  },
  async cancelled(tx, { sourceId, actor }) {
    const before = await repo.rowRaw(sourceId, tx.connection, true);
    if (!before || before.status !== 'scheduled') return;
    await repo.markBackToAwaiting(sourceId, tx.connection);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'draft_rows', recordId: `${before.service_number}:${sourceId}`, before, after: await repo.rowRaw(sourceId, tx.connection) });
  },
});

// ---- printouts and the workbook ------------------------------------------------------------------
async function batchForPrint(batchId, user) {
  const b = await getBatch(batchId, user);
  const rl = await rule();
  const rows = (await repo.allRows({ batchId }, todayIso())).map((x) => shapeRow(x, rl));
  return { b, rows };
}

/** Every live row of the open batches, one department or all (the approval and close workbooks). */
async function openRowsForExport(q = {}, user) {
  const scope = scopeOf(user);
  const specialisationId = scope.specialisationId || idOrNull(q.specialisationId);
  const rl = await rule();
  const rows = (await repo.allRows({ openAll: true, specialisationId }, todayIso())).map((x) => shapeRow(x, rl));
  let department = 'All departments';
  if (specialisationId) {
    const sp = await repo.refRow('ref_specialisation', specialisationId);
    department = sp ? sp.name : department;
  }
  return { rows, department };
}

async function scheduledFor(serviceNumber) {
  return postings.scheduledFor(serviceNumber);
}

module.exports = {
  FLOW, RANKS, REQUESTS, rule, band, options,
  listManning, addManning, editManning, deleteManning, manningForPrint, diffText,
  listDue, previewBatch, createBatch,
  listBatches, getBatch, listRows, editPosting, notRecommend, removeRow, clearBatch, addPersonnel,
  approvals, approvalRows, approve, openRowsForExport, closeBatch, setRowWef, setDepartmentWef, batchForPrint, scheduledFor, plural,
};
