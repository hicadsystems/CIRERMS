'use strict';

/*
 * Advancement Processing: the rules of the cycle (docs/legacy/advancement.md; PLAN 9a decisions 2, 3, 5, 7).
 *
 *   Rates due for Advancement   who is due (reads only); a batch is made only by createBatch
 *   Advancement Review          a batch's rows: Set New Rate (the next rate only), Not Recommended, Remove, Add, Clear
 *   Approval                    per department, totals by new rate (WP7a's cycle.service)
 *   Close                       one batch, fully approved, final (cycle.service)
 *   Board Returns Update        the board date per rating or for the batch: the new rate applies (rates.service),
 *                               now, or scheduled for a later date
 *   Report on Promoted Rates    every batch with its total and promoted; a batch's ratings
 *   Upload Advanced Rates       advancement.upload.js
 *
 * The batch, approval and close parts are WP7a's (src/modules/drafting/cycle.service.js), flow DOA. Who is due
 * is a placeholder rule with its numbers in the settings table (advancement.due_months and the two month
 * bands): a current rating with at least advancement.due_months whole months in the current rate, not
 * already in the top rate. It does not read appraisal grades or disciplinary cases (the real rules are not
 * known); a rating's pending cases are shown as information only. A rating whose advancement is not finished
 * (a live row of an open batch, or of a closed batch waiting for its board date or scheduled) is shown with
 * its batch and left out of a new one. A user tied to a specialisation (their department) sees only that
 * department's due list, batches and approval.
 */
const db = require('../../db');
const audit = require('../../shared/audit');
const settings = require('../../shared/settings');
const { validationError, conflict, notFound, forbidden } = require('../../shared/errors');
const { parseIsoDate } = require('../../shared/dates');
const { dmy, todayIso, addDays } = require('../drafting/drafting.format');
const cycle = require('../drafting/cycle.service');
const rates = require('./rates.service');
const repo = require('./advancement.repo');

const RANKS = ['S/LT', 'LT', 'LTCDR', 'CDR', 'CAPT', 'CDRE', 'R/ADM', 'ADM'];
const BOARD_MAX_DAYS = 365;

const FLOW = cycle.registerFlow('DOA', {
  rowsTable: 'advancement_rows',
  target: 'new_rate_id',
  targetLabel: 'new rate',
  closedStatus: 'awaiting_board',
  noun: 'advancement',
  ranks: RANKS,
  rateColumn: 'new_rate_id', // the approval's totals are by new rate
});

const text = (v) => (v === undefined || v === null ? '' : String(v).trim());
const idOrNull = (v) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const nameOf = (r) => [String(r.surname || '').toUpperCase(), r.first_name, r.middle_name].filter(Boolean).join(' ');
const paging = (q) => ({ page: Math.max(1, Number.parseInt(q.page, 10) || 1), pageSize: 25 });
const meta = (total, page, pageSize) => ({ total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
const num = (v) => (v === null || v === undefined ? null : Number(v));

/** Whole months from one 'YYYY-MM-DD' to another (as TIMESTAMPDIFF(MONTH, ...)). */
function monthsBetween(from, to) {
  if (!from || !to) return null;
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  let m = (y2 - y1) * 12 + (m2 - m1);
  if (d2 < d1) m -= 1;
  return m;
}

// ---- the due rule (settings) ----------------------------------------------------------
const RULE_KEYS = ['advancement.due_months', 'advancement.band_green_to', 'advancement.band_amber_to'];
async function rule() {
  const s = await settings.numbers(RULE_KEYS);
  return { dueMonths: s['advancement.due_months'], greenTo: s['advancement.band_green_to'], amberTo: s['advancement.band_amber_to'] };
}
/** The pill tone for months in rate: under the due month neutral, then green, amber, red. */
const band = (m, r) => (m === null || m === undefined || m < r.dueMonths ? 'neutral' : m <= r.greenTo ? 'success' : m <= r.amberTo ? 'warning' : 'error');

/** A department-tied user may only work on their own department. */
const scopeOf = (user) => ({ specialisationId: (user && user.specialisationId) || null });
function checkDepartment(scope, specialisationId, what = 'batch') {
  if (scope.specialisationId && Number(specialisationId) !== Number(scope.specialisationId)) {
    throw forbidden(`This ${what} belongs to another department.`);
  }
}

/** The next rate up (rank order, Rates sort_order), from a list of rates; null for the top rate. */
function nextOf(list, rateId) {
  const cur = list.find((r) => r.id === rateId);
  if (!cur) return null;
  return list.filter((r) => r.sort_order > cur.sort_order && r.is_active !== 0).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)[0] || null;
}
const shortRate = (r) => (r ? r.code || r.name : '');

// ---- options -----------------------------------------------------------------------------
async function options(user) {
  const o = await repo.options();
  const scope = scopeOf(user);
  const top = o.rates.reduce((m, r) => Math.max(m, r.sort_order), -Infinity);
  return {
    rates: o.rates.map((x) => ({ id: x.id, name: x.name, code: x.code, active: !!x.is_active, top: x.sort_order === top })),
    branches: o.branches.map((x) => ({ id: x.id, name: x.name, code: x.code, active: !!x.is_active })),
    specialisations: o.specialisations.map((x) => ({ id: x.id, name: x.name, code: x.code, active: !!x.is_active })),
    ranks: RANKS,
    department: scope.specialisationId ? (o.specialisations.find((x) => x.id === scope.specialisationId) || { id: scope.specialisationId, name: '' }) : null,
    rule: await rule(),
    today: todayIso(),
  };
}

// ---- 1. Rates due for Advancement ---------------------------------------------------------
function shapeDue(r, rl) {
  const months = num(r.months);
  return {
    serviceNumber: r.service_number, name: nameOf(r), rate: r.rate_name || '', rateCode: r.rate_code || r.rate_name || '', sex: r.gender || '',
    branch: r.branch_name || '', specialisationId: r.specialisation_id, specialisation: r.specialisation_name || '',
    age: num(r.age), los: num(r.los), rateSince: r.rate_since, months, band: band(months, rl),
    inBatch: r.in_batch || '', inBatchId: r.in_batch_id || null, pendingCases: Number(r.pending_cases || 0),
  };
}

async function dueFilters(q, scope) {
  const f = { branchId: idOrNull(q.branchId), specialisationId: idOrNull(q.specialisationId), rateId: idOrNull(q.rateId) };
  if (scope.specialisationId) {
    if (f.specialisationId && f.specialisationId !== scope.specialisationId) throw forbidden('You may only propose your own department.');
    f.specialisationId = scope.specialisationId;
  }
  return f;
}

async function listDue(q = {}, user) {
  const rl = await rule();
  const f = { ...(await dueFilters(q, scopeOf(user))), today: todayIso(), dueMonths: rl.dueMonths };
  const { page, pageSize } = paging(q);
  const r = await repo.listDue(f, { page, pageSize });
  return { items: r.items.map((x) => shapeDue(x, rl)), summary: { due: r.total, inBatch: r.inBatch, toAdd: r.total - r.inBatch, dueMonths: rl.dueMonths }, meta: meta(r.total, page, pageSize) };
}

/** The batch code and labels for the filters: DOA-<branch>-<specialisation>-<rate> (codes, ALL for All). */
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
    code: cycle.batchCode('DOA', { branch: branch && (branch.code || branch.name), specialisation: spec && (spec.code || spec.name), rate: rate && (rate.code || rate.name) }),
    labels: { branch: branch ? branch.name : 'All branches', specialisation: spec ? spec.name : 'All specialisations', rate: rate ? rate.name : 'All rates' },
  };
}

async function previewBatch(q = {}, user) {
  const rl = await rule();
  const f = await dueFilters(q, scopeOf(user));
  const { code, labels } = await codeFor(f);
  const due = await repo.listDue({ ...f, today: todayIso(), dueMonths: rl.dueMonths }, { page: 1, pageSize: 1 });
  const p = await cycle.previewBatch(FLOW, code);
  return { ...p, labels, due: due.total, toAdd: due.total - due.inBatch, leftOut: due.inBatch };
}

async function createBatch(body = {}, user, actor) {
  const rl = await rule();
  const f = await dueFilters(body, scopeOf(user));
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const { code } = await codeFor(f, conn);
    const fresh = await repo.dueFresh({ ...f, today: todayIso(), dueMonths: rl.dueMonths }, conn);
    if (!fresh.length) {
      throw conflict('Nobody on this list can be added: everyone due is already in a batch, or nobody is due. Review that batch, or change the filters.', 'NOTHING_TO_ADD');
    }
    const { batch, created } = await cycle.openOrCreateBatch(tx, actor, FLOW, { code, branchId: f.branchId, specialisationId: f.specialisationId, rateId: f.rateId });
    for (const r of fresh) await addRowFor(tx, actor, batch.id, r);
    await cycle.refreshStatus(tx, actor, FLOW, batch.id);
    return { batch: await cycle.getBatch(FLOW, batch.id, conn), added: fresh.length, created };
  });
}

/** Adds a rating (a due-list row) to a batch, or takes a not-recommended row of it back in. */
async function addRowFor(tx, actor, batchId, r) {
  const conn = tx.connection;
  const x = {
    batchId, serviceNumber: r.service_number, rateId: r.rate_id, specialisationId: r.specialisation_id, rateSince: r.rate_since,
    months: num(r.months), userId: actor.userId,
  };
  const old = await repo.rowOfRating(batchId, r.service_number, conn);
  if (old) {
    await repo.resetRow(old.id, x, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'advancement_rows', recordId: `${r.service_number}:${old.id}`, before: old, after: await repo.rowRaw(old.id, conn) });
    return old.id;
  }
  const id = await repo.insertRow(x, conn);
  await audit.record(tx, actor, { action: 'INSERT', table: 'advancement_rows', recordId: `${r.service_number}:${id}`, after: await repo.rowRaw(id, conn) });
  return id;
}

// ---- batches (Review, Close, Board Returns, Report) ---------------------------------------------
function shapeBatchSummary(b) {
  return {
    ...cycle.shapeBatch(b),
    live: Number(b.live || 0), withRate: Number(b.with_rate || 0), dated: Number(b.dated || 0), advanced: Number(b.advanced || 0),
    scheduled: Number(b.scheduled || 0), awaiting: Number(b.awaiting || 0), notRecommended: Number(b.not_recommended || 0),
  };
}

async function listBatches(q = {}, user) {
  const stage = q.stage === 'board' ? 'board' : 'open';
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
  await loadBatch(id, user);
  const b = shapeBatchSummary(await repo.batchWithCounts(id));
  b.readiness = await cycle.readiness(FLOW, id);
  return b;
}

function shapeRow(x, rl, rateList) {
  const live = x.status === 'proposed' || x.status === 'not_recommended' || x.status === 'awaiting_board';
  const months = live ? num(x.months_now) : monthsBetween(x.rate_since, x.board_date);
  const next = x.status === 'proposed' ? nextOf(rateList, x.rate_id) : null;
  return {
    id: x.id, batchId: x.batch_id, batchNumber: x.batch_number, batchStatus: x.batch_status,
    serviceNumber: x.service_number, name: nameOf(x), rate: x.rate_name || '', rateCode: x.rate_code || x.rate_name || '', sex: x.gender || '',
    branch: x.branch_name || '', specialisationId: x.specialisation_id, specialisation: x.specialisation_name || '',
    age: num(x.age), los: num(x.los), rateSince: x.rate_since, months, band: band(months, rl),
    nowRateCode: x.now_rate_code || x.now_rate_name || '', rateChanged: x.status === 'proposed' && x.now_rate_id !== x.rate_id,
    newRateId: x.new_rate_id, newRate: x.new_rate_name || '', newRateCode: x.new_rate_code || x.new_rate_name || '',
    nextRateId: next ? next.id : null, nextRate: next ? next.name : '', nextRateCode: shortRate(next),
    remark: x.remark || '', status: x.status, pendingCases: Number(x.pending_cases || 0),
    notRecommended: x.status === 'not_recommended' ? { reason: x.not_recommended_reason, at: x.not_recommended_at, by: cycle.who(x, 'nr') } : null,
    approval: x.approval_id ? { rank: x.approver_rank, name: x.approver_name, appointment: x.approval_appointment, approvedAt: x.approved_at } : null,
    boardDate: x.board_date, authority: x.authority || '', closeDate: x.close_date,
  };
}

async function shapeRows(items) {
  const rl = await rule();
  const list = await repo.rates();
  return items.map((x) => shapeRow(x, rl, list));
}

async function listRows(batchId, q = {}, user) {
  await loadBatch(batchId, user);
  const { page, pageSize } = paging(q);
  const f = {
    batchId, specialisationId: idOrNull(q.specialisationId), live: q.live === '1' || q.live === 'true',
    q: text(q.q).slice(0, 80), sn: text(q.sn).slice(0, 20), name: text(q.name).slice(0, 80),
  };
  const r = await repo.listRows(f, { page, pageSize, today: todayIso() });
  return { items: await shapeRows(r.items), meta: meta(r.total, page, pageSize) };
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
  const x = await repo.findRow(rowId, todayIso(), conn);
  return x ? (await shapeRows([x]))[0] : null;
}

/** Set New Rate: the next rate in rank order, no choice (decision 2); optional remarks. */
async function setNewRate(batchId, rowId, body, user, actor) {
  const remark = text(body.remark);
  if (remark.length > 250) throw validationError('Check the highlighted fields.', { remark: 'Use at most 250 characters.' });
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const { row } = await lockOpenRow(tx, batchId, rowId, user);
    if (row.status !== 'proposed') throw conflict('This rating is not recommended. Remove the row, or add the rating again.', 'ROW_NOT_RECOMMENDED');
    const basic = await repo.ratingBasic(row.service_number, conn);
    if (basic.rate_id !== row.rate_id) {
      const old = await repo.refRow('ref_rate', row.rate_id, conn);
      throw conflict(`${nameOf(basic)} is now ${basic.rate_code || basic.rate_name}, no longer ${shortRate(old)}. Remove the row and add the rating again.`, 'RATE_CHANGED');
    }
    const next = nextOf(await repo.rates(conn), row.rate_id);
    if (!next) throw conflict(`${nameOf(basic)} is in the top rate and cannot be advanced.`, 'TOP_RATE');
    if (body.newRateId !== undefined && body.newRateId !== null && body.newRateId !== '' && idOrNull(body.newRateId) !== next.id) {
      throw validationError('A rating advances one rate at a time.', { newRateId: `A rating advances one rate at a time: the new rate is ${next.name}.` });
    }
    const changed = row.new_rate_id !== next.id;
    await repo.setNewRate(rowId, { newRateId: next.id, remark }, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'advancement_rows', recordId: `${row.service_number}:${rowId}`, before: row, after: await repo.rowRaw(rowId, conn) });
    const reapprove = changed ? await cycle.clearApproval(tx, actor, FLOW, rowId) : false;
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
    await audit.record(tx, actor, { action: 'UPDATE', table: 'advancement_rows', recordId: `${row.service_number}:${rowId}`, before: row, after: await repo.rowRaw(rowId, conn) });
    await cycle.refreshStatus(tx, actor, FLOW, row.batch_id);
    return { row: await rowResult(rowId, conn) };
  });
}

async function removeRow(batchId, rowId, user, actor) {
  return db.transaction(async (tx) => {
    const { row } = await lockOpenRow(tx, batchId, rowId, user);
    await repo.deleteRow(rowId, tx.connection);
    await audit.record(tx, actor, { action: 'DELETE', table: 'advancement_rows', recordId: `${row.service_number}:${rowId}`, before: row });
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
      await audit.record(tx, actor, { action: 'DELETE', table: 'advancement_rows', recordId: `${row.service_number}:${row.id}`, before: row });
    }
    await cycle.refreshStatus(tx, actor, FLOW, batchId);
    return { removed: rows.length };
  });
}

/** Add Personnel: any current rating not in the top rate and not already in a batch, whatever its months in rate. */
async function addPersonnel(batchId, body, user, actor) {
  const sn = text(body.serviceNumber);
  if (!sn) throw validationError('Choose the rating.', { serviceNumber: 'Choose the rating.' });
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const b = await loadBatch(batchId, user, conn);
    if (b.status === 'closed') throw conflict(`${b.batchNumber} is closed. A closed batch is final.`, 'BATCH_CLOSED');
    const basic = await repo.ratingBasic(sn, conn);
    const refuse = (m) => validationError(m, { serviceNumber: m });
    if (!basic) throw refuse('That rating was not found.');
    const who = nameOf(basic);
    if (basic.status !== 'current') throw refuse(`${who} has left the service and cannot be added.`);
    const scope = scopeOf(user);
    if (scope.specialisationId && basic.specialisation_id !== scope.specialisationId) throw refuse(`${who} is in another department.`);
    const pend = await repo.pendingAdvanceOf(sn, conn);
    if (pend && pend.batch_id === b.id) throw refuse(`${who} is already in this batch.`);
    if (pend) throw refuse(`${who} is already in batch ${pend.batch_number}.`);
    if (!nextOf(await repo.rates(conn), basic.rate_id)) throw refuse(`${who} is in the top rate and cannot be advanced.`);
    const r = await repo.ratingForAdvance(sn, todayIso(), conn);
    const id = await addRowFor(tx, actor, b.id, r);
    await cycle.refreshStatus(tx, actor, FLOW, b.id);
    return { row: await rowResult(id, conn) };
  });
}

// ---- 3. Approval ---------------------------------------------------------------------------------
async function approvals(user) {
  const items = await cycle.departments(FLOW, scopeOf(user));
  return { items, summary: { departments: items.length, approved: items.filter((d) => d.status === 'approved').length, waiting: items.filter((d) => d.status !== 'approved').length } };
}

async function approvalRows(specialisationId, q = {}, user) {
  checkDepartment(scopeOf(user), specialisationId, 'department');
  const { page, pageSize } = paging(q);
  const r = await repo.listRows({ openDepartment: specialisationId }, { page, pageSize, today: todayIso() });
  return { items: await shapeRows(r.items), meta: meta(r.total, page, pageSize) };
}

async function approve(specialisationId, body, user, actor) {
  checkDepartment(scopeOf(user), specialisationId, 'department');
  return db.transaction((tx) => cycle.approveDepartment(tx, actor, FLOW, specialisationId, body));
}

/** Every live row of the open batches, one department or all (the approval and close workbooks). */
async function openRowsForExport(q = {}, user) {
  const scope = scopeOf(user);
  const specialisationId = scope.specialisationId || idOrNull(q.specialisationId);
  const rows = await shapeRows(await repo.allRows({ openAll: true, specialisationId }, todayIso()));
  let department = 'All departments';
  if (specialisationId) {
    const sp = await repo.refRow('ref_specialisation', specialisationId);
    department = sp ? sp.name : department;
  }
  return { rows, department };
}

// ---- 4. Close ------------------------------------------------------------------------------------
async function closeBatch(batchId, body, user, actor) {
  await loadBatch(batchId, user);
  const raw = text(body.closeDate);
  const p = raw ? parseIsoDate(raw) : { valid: true, value: null };
  if (!p.valid) throw validationError('Check the highlighted fields.', { closeDate: 'Enter the close date as dd/mm/yyyy.' });
  return db.transaction((tx) => cycle.closeBatch(tx, actor, FLOW, batchId, { authority: body.authority, closeDate: p.value, today: todayIso() }));
}

// ---- 5. Board Returns Update -----------------------------------------------------------------------
function boardDate(raw) {
  const p = parseIsoDate(text(raw));
  if (!text(raw) || !p.valid || !p.value) throw validationError('Check the highlighted fields.', { date: 'Enter the board approval date as dd/mm/yyyy.' });
  if (p.value > addDays(todayIso(), BOARD_MAX_DAYS)) throw validationError('Check the highlighted fields.', { date: 'The board approval date cannot be more than a year ahead.' });
  return p.value;
}

async function loadClosedBatch(batchId, user, conn) {
  const b = await loadBatch(batchId, user, conn);
  if (b.status !== 'closed' || !b.authority) throw conflict('Only a closed batch with its authority gets board dates.', 'BATCH_NOT_CLOSED');
  return b;
}

async function advanceRow(tx, actor, b, row, date) {
  const conn = tx.connection;
  const r = await rates.advance(tx, actor, {
    serviceNumber: row.service_number, fromRateId: row.rate_id, toRateId: row.new_rate_id, date, authority: b.authority,
    source: { table: 'advancement_rows', id: row.id },
  });
  await repo.setBoard(row.id, { status: r.status, date, advancementId: r.advancementId || null, scheduledId: r.scheduledId || null, userId: actor.userId }, conn);
  await audit.record(tx, actor, { action: 'UPDATE', table: 'advancement_rows', recordId: `${row.service_number}:${row.id}`, before: row, after: await repo.rowRaw(row.id, conn) });
  return r;
}

async function setRowBoard(batchId, rowId, body, user, actor) {
  const date = boardDate(body.date);
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const b = await loadClosedBatch(batchId, user, conn);
    const row = await repo.rowRaw(rowId, conn, true);
    if (!row || row.batch_id !== b.id) throw notFound('That rating is not in this batch.', 'ROW_NOT_FOUND');
    if (row.status !== 'awaiting_board') throw conflict('This rating\'s board date is already set.', 'BOARD_DATE_SET');
    try {
      const r = await advanceRow(tx, actor, b, row, date);
      return { status: r.status, rate: r.rate, date, row: await rowResult(rowId, conn) };
    } catch (err) {
      if (err.fields && !err.fields.date) throw validationError(err.message, { date: err.message });
      throw err;
    }
  });
}

/** Set Date for Batch: every rating still waiting gets the date; dates already entered stay. */
async function setBatchBoard(batchId, body, user, actor) {
  const date = boardDate(body.date);
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const b = await loadClosedBatch(batchId, user, conn);
    const rows = await repo.awaitingRows(b.id, conn);
    if (!rows.length) throw validationError('Every rating in this batch already has its board date.', { date: 'Every rating in this batch already has its board date.' });
    const out = { advanced: 0, scheduled: 0 };
    for (const row of rows) {
      try {
        const r = await advanceRow(tx, actor, b, row, date);
        out[r.status] += 1;
      } catch (err) {
        if (err.fields) {
          const who = await repo.ratingBasic(row.service_number, conn);
          const m = `${who ? nameOf(who) : row.service_number}: ${err.message} Enter the dates one by one for ratings like this. Nothing was saved.`;
          throw validationError(m, { date: m });
        }
        throw err;
      }
    }
    return { ...out, ratings: rows.length, date };
  });
}

// a scheduled rate change made on its date: the row is advanced; one that could not be made waits again
rates.onSource('advancement_rows', {
  async applied(tx, { sourceId, advancementId, actor }) {
    const before = await repo.rowRaw(sourceId, tx.connection, true);
    if (!before) return;
    await repo.markAdvanced(sourceId, advancementId, tx.connection);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'advancement_rows', recordId: `${before.service_number}:${sourceId}`, before, after: await repo.rowRaw(sourceId, tx.connection) });
  },
  async cancelled(tx, { sourceId, actor }) {
    const before = await repo.rowRaw(sourceId, tx.connection, true);
    if (!before || before.status !== 'scheduled') return;
    await repo.markBackToAwaiting(sourceId, tx.connection);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'advancement_rows', recordId: `${before.service_number}:${sourceId}`, before, after: await repo.rowRaw(sourceId, tx.connection) });
  },
});

// ---- 6. Report on Promoted Rates ----------------------------------------------------------------------
function reportFilters(q, user) {
  return {
    branchId: idOrNull(q.branchId), rateId: idOrNull(q.rateId), signal: text(q.signal).slice(0, 100), batch: text(q.batch).slice(0, 48),
    specialisationId: scopeOf(user).specialisationId,
  };
}

async function report(q = {}, user) {
  const { page, pageSize } = paging(q);
  const r = await repo.reportBatches(reportFilters(q, user), { page, pageSize });
  return {
    items: r.items.map(shapeBatchSummary),
    summary: { batches: r.total, open: r.open, closed: r.closed, promoted: r.promoted },
    meta: meta(r.total, page, pageSize),
  };
}

async function reportForPrint(q = {}, user) {
  const r = await repo.reportBatches(reportFilters(q, user), { pageSize: 0 });
  return { items: r.items.map(shapeBatchSummary), summary: { batches: r.total, open: r.open, closed: r.closed, promoted: r.promoted } };
}

// ---- printouts and the workbook ------------------------------------------------------------------------
async function batchForPrint(batchId, user) {
  const b = await getBatch(batchId, user);
  const rows = await shapeRows(await repo.allRows({ batchId }, todayIso()));
  return { b, rows };
}

async function scheduledFor(serviceNumber) {
  return rates.scheduledFor(serviceNumber);
}

module.exports = {
  FLOW, RANKS, rule, band, options, nextOf, monthsBetween, nameOf,
  listDue, previewBatch, createBatch,
  listBatches, getBatch, listRows, setNewRate, notRecommend, removeRow, clearBatch, addPersonnel,
  approvals, approvalRows, approve, openRowsForExport, closeBatch, setRowBoard, setBatchBoard,
  report, reportForPrint, batchForPrint, scheduledFor, plural,
};
