'use strict';

/*
 * The batch cycle: the parts Drafting (WP7a) and Advancement (WP8) share. A flow is a kind of batch with
 * its own rows table; Drafting registers DOD below, Advancement registers DOA the same way:
 *
 *   const cycle = require('../drafting/cycle.service');
 *   const FLOW = cycle.registerFlow('DOA', {
 *     rowsTable: 'advancement_rows',  // columns it must have: id, batch_id, service_number, rate_id, specialisation_id,
 *                                     // approval_id, status ENUM('proposed','not_recommended', <closedStatus>, ...)
 *     target: 'new_rate_id',          // what every rating must have before approval and close
 *     targetLabel: 'new rate',        // for the messages ("2 ratings have no new rate")
 *     closedStatus: 'awaiting_board', // a live row's status once its batch is closed
 *     noun: 'advancement',
 *   });
 *
 * Then, inside the caller's db.transaction (every write is audited here):
 *   cycle.batchCode('DOA', { branch, specialisation, rate })          'DOA-ALL-ALL-LS' (codes; null = ALL)
 *   await cycle.previewBatch(FLOW, code)                               { batchNumber, existing } (reads only)
 *   await cycle.openOrCreateBatch(tx, actor, FLOW, { code, branchId, specialisationId, rateId })
 *                                                                       the open batch for the code, or a new one
 *                                                                       numbered code-NNNNNN (a counter per code)
 *   await cycle.refreshStatus(tx, actor, FLOW, batchId)                open <-> approved, after any change to rows
 *   await cycle.clearApproval(tx, actor, FLOW, rowId)                  a changed row needs its department's approval again
 *   await cycle.departments(FLOW, { specialisationId })                approval list: totals, rate groups, status, approver
 *   await cycle.approveDepartment(tx, actor, FLOW, specialisationId, { rank, name, appointment })
 *   await cycle.readiness(FLOW, batchId)                               { live, missing, departments, problems, ready }
 *   await cycle.closeBatch(tx, actor, FLOW, batchId, { authority, closeDate })   final
 *
 * Rules kept here: one rating is enough for a batch; an open batch for the same code is added to; approval
 * is per department (the specialisation) over its live rows in the flow's open batches, refused while one of
 * them has no target, and approving again replaces the earlier approval; close takes one batch, only when
 * every live row has its target and every department in it is approved, with an authority never used before
 * (any flow) and a close date dd/mm/yyyy, not in the future and not before the batch began. A closed batch
 * is final.
 */
const audit = require('../../shared/audit');
const { accountName } = require('../../shared/rating-name');
const { validationError, conflict, notFound } = require('../../shared/errors');
const { dmy, isoDay } = require('./drafting.format');
const repo = require('./cycle.repo');

const FLOWS = new Map();

function registerFlow(key, def) {
  if (!/^[A-Z]{3}$/.test(key)) throw new Error('A flow key is three capital letters (DOD, DOA).');
  for (const k of ['rowsTable', 'target', 'closedStatus']) {
    if (!def[k] || !/^[a-z][a-z0-9_]*$/.test(def[k])) throw new Error(`Flow ${key}: ${k} must be a column or table name.`);
  }
  const flow = Object.freeze({ key, noun: 'batch', targetLabel: def.target, ...def });
  FLOWS.set(key, flow);
  return flow;
}

const flowOf = (key) => {
  const f = FLOWS.get(key);
  if (!f) throw new Error(`Unknown batch flow ${key}.`);
  return f;
};

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const who = (row, alias) => (row[`${alias}_username`] ? accountName({
  rating_surname: row[`${alias}_surname`], rating_first_name: row[`${alias}_first_name`], rating_middle_name: row[`${alias}_middle_name`],
  rating_rate_name: row[`${alias}_rate_name`], username: row[`${alias}_username`],
}) : '');

function batchCode(flowKey, { branch = null, specialisation = null, rate = null } = {}) {
  const part = (v) => (v ? String(v).trim().toUpperCase() : 'ALL');
  return `${flowKey}-${part(branch)}-${part(specialisation)}-${part(rate)}`;
}
const numberOf = (code, sequence) => `${code}-${String(sequence).padStart(6, '0')}`;

/** A batch as the screens read it. */
function shapeBatch(b) {
  if (!b) return null;
  return {
    id: b.id,
    flow: b.flow,
    batchNumber: b.batch_number,
    batchCode: b.batch_code,
    status: b.status,
    branchId: b.branch_id,
    branch: b.branch_name || 'All',
    specialisationId: b.specialisation_id,
    specialisation: b.specialisation_name || 'All',
    rateId: b.rate_id,
    rate: b.rate_name || 'All',
    initiatedAt: b.initiated_at,
    initiatedBy: who(b, 'ini'),
    closedAt: b.closed_at,
    closedBy: who(b, 'clo'),
    closeDate: b.close_date,
    authority: b.authority || '',
  };
}

async function getBatch(flow, id, conn = null) {
  const b = await repo.findBatch(id, conn);
  if (!b || b.flow !== flow.key) throw notFound('That batch was not found.', 'BATCH_NOT_FOUND');
  return shapeBatch(b);
}

async function previewBatch(flow, code) {
  const open = await repo.peekOpenBatch(flow.key, code);
  if (open) return { batchNumber: open.batch_number, existing: true, batchId: open.id };
  return { batchNumber: numberOf(code, await repo.peekSequence(code)), existing: false, batchId: null };
}

async function openOrCreateBatch(tx, actor, flow, { code, branchId = null, specialisationId = null, rateId = null }) {
  const conn = tx.connection;
  const open = await repo.openBatchForCode(flow.key, code, conn);
  if (open) return { batch: open, created: false };
  const sequence = await repo.nextSequence(code, conn);
  const id = await repo.insertBatch({ flow: flow.key, batchNumber: numberOf(code, sequence), code, sequence, branchId, specialisationId, rateId, userId: actor.userId }, conn);
  const batch = await repo.batchRaw(id, conn);
  await audit.record(tx, actor, { action: 'INSERT', table: 'batches', recordId: batch.batch_number, after: batch });
  return { batch, created: true };
}

/** Open or approved, worked out from the rows (a closed batch never changes). */
async function refreshStatus(tx, actor, flow, batchId) {
  const conn = tx.connection;
  const before = await repo.batchRaw(batchId, conn, true);
  if (!before || before.status === 'closed') return before ? before.status : null;
  const c = await repo.batchCounts(flow, batchId, conn);
  const status = c.live > 0 && c.missing === 0 && c.unapproved === 0 ? 'approved' : 'open';
  if (status !== before.status) {
    await repo.setBatchStatus(batchId, status, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'batches', recordId: before.batch_number, before, after: await repo.batchRaw(batchId, conn) });
  }
  return status;
}

/** A row changed after its department approved: the department must approve again. */
async function clearApproval(tx, actor, flow, rowId) {
  const conn = tx.connection;
  const before = await repo.rowRaw(flow, rowId, conn, true);
  if (!before || !before.approval_id) return false;
  await repo.setRowApproval(flow, rowId, null, conn);
  await audit.record(tx, actor, { action: 'UPDATE', table: flow.rowsTable, recordId: `${before.service_number}:${rowId}`, before, after: await repo.rowRaw(flow, rowId, conn) });
  return true;
}

function shapeApproval(a) {
  if (!a) return null;
  return {
    id: a.id,
    rank: a.approver_rank,
    name: a.approver_name,
    appointment: a.appointment,
    approvedAt: a.approved_at,
    approvedBy: who(a, 'apr'),
  };
}

/**
 * One row per department with live rows in the flow's open batches: total, the rate groups (every rate in
 * rank order, from the Rates table), how many have no target, status (approved when every row is), and the
 * latest approval.
 */
async function departments(flow, { specialisationId = null } = {}) {
  const [list, counts, rates] = await Promise.all([
    repo.departments(flow, { specialisationId }),
    repo.departmentRateCounts(flow, { specialisationId }),
    repo.rates(),
  ]);
  const out = [];
  for (const d of list) {
    const mine = counts.filter((c) => c.id === d.id);
    const approval = d.approval_id ? shapeApproval(await repo.findApproval(d.approval_id)) : null;
    out.push({
      specialisationId: d.id,
      department: d.name || 'No specialisation',
      total: Number(d.total),
      missing: Number(d.missing),
      waiting: Number(d.waiting),
      status: Number(d.waiting) === 0 ? 'approved' : 'waiting',
      partly: Number(d.waiting) > 0 && Number(d.waiting) < Number(d.total) && !!approval,
      approval,
      rateGroups: rates.map((r) => ({ rateId: r.id, code: r.code || r.name, name: r.name, count: Number((mine.find((c) => c.rate_id === r.id) || {}).n || 0) })),
    });
  }
  return out;
}

async function approveDepartment(tx, actor, flow, specialisationId, body = {}) {
  const errors = {};
  const rank = String(body.rank || '').trim();
  const name = String(body.name || '').trim();
  const appointment = String(body.appointment || '').trim();
  if (!rank) errors.rank = 'Choose the approving rank.';
  else if (Array.isArray(flow.ranks) && !flow.ranks.includes(rank)) errors.rank = 'Choose a rank from the list.';
  if (!name) errors.name = 'Enter the name of the approving officer.';
  else if (name.length > 150) errors.name = 'Use at most 150 characters.';
  if (!appointment) errors.appointment = 'Enter the appointment.';
  else if (appointment.length > 150) errors.appointment = 'Use at most 150 characters.';
  if (Object.keys(errors).length) throw validationError('Check the highlighted fields.', errors);

  const conn = tx.connection;
  const rows = await repo.departmentRowsForUpdate(flow, specialisationId, conn);
  if (!rows.length) throw conflict(`This department has no ratings in an open ${flow.noun} batch to approve.`, 'NOTHING_TO_APPROVE');
  const missing = rows.filter((r) => r[flow.target] === null || r[flow.target] === undefined).length;
  if (missing) {
    throw conflict(`${plural(missing, 'rating has', 'ratings have')} no ${flow.targetLabel}. Finish the review before approving.`, 'TARGET_MISSING');
  }
  const replaced = rows.some((r) => r.approval_id);
  const approvalId = await repo.insertApproval({ flow: flow.key, specialisationId, rank, name, appointment, userId: actor.userId }, conn);
  await audit.record(tx, actor, { action: 'INSERT', table: 'batch_approvals', recordId: `${flow.key}:${approvalId}`, after: await repo.approvalRaw(approvalId, conn) });
  for (const r of rows) {
    await repo.setRowApproval(flow, r.id, approvalId, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: flow.rowsTable, recordId: `${r.service_number}:${r.id}`, before: r, after: await repo.rowRaw(flow, r.id, conn) });
  }
  for (const batchId of new Set(rows.map((r) => r.batch_id))) await refreshStatus(tx, actor, flow, batchId);
  return { approval: shapeApproval(await repo.findApproval(approvalId, conn)), ratings: rows.length, replaced };
}

/** Whether a batch can be closed, and why not. */
async function readiness(flow, batchId, conn = null) {
  const c = await repo.batchCounts(flow, batchId, conn);
  const depts = (await repo.batchDepartments(flow, batchId, conn)).map((d) => ({ specialisationId: d.id, department: d.name || 'No specialisation', ratings: Number(d.n), approved: Number(d.waiting) === 0 }));
  const waiting = depts.filter((d) => !d.approved).map((d) => d.department);
  const problems = [
    c.live ? '' : 'The batch has no ratings.',
    c.missing ? `${plural(c.missing, 'rating has', 'ratings have')} no ${flow.targetLabel}.` : '',
    waiting.length ? `Not yet approved: ${waiting.join(', ')}.` : '',
  ].filter(Boolean);
  return { live: c.live, missing: c.missing, withTarget: c.live - c.missing, departments: depts, approvedDepartments: depts.length - waiting.length, problems, ready: problems.length === 0 };
}

async function closeBatch(tx, actor, flow, batchId, { authority, closeDate, today }) {
  const conn = tx.connection;
  const before = await repo.batchRaw(batchId, conn, true);
  if (!before || before.flow !== flow.key) throw notFound('That batch was not found.', 'BATCH_NOT_FOUND');
  if (before.status === 'closed') throw conflict(`${before.batch_number} is already closed. A closed batch is final.`, 'BATCH_CLOSED');
  const errors = {};
  const auth = String(authority || '').trim();
  if (!auth) errors.authority = 'Enter the authority.';
  else if (auth.length > 100) errors.authority = 'Use at most 100 characters.';
  else {
    const used = await repo.batchUsingAuthority(auth, conn);
    if (used) errors.authority = `${auth} is already used by batch ${used.batch_number}. Use a different authority.`;
  }
  const began = dmy(before.initiated_at);
  const beganIso = isoDay(before.initiated_at);
  if (!closeDate) errors.closeDate = 'Enter the close date as dd/mm/yyyy.';
  else if (closeDate > today) errors.closeDate = 'The close date cannot be in the future.';
  else if (closeDate < beganIso) errors.closeDate = `The close date cannot be before the batch was started (${began}).`;
  const ready = await readiness(flow, batchId, conn);
  if (!ready.ready) throw conflict(`This batch cannot be closed yet. ${ready.problems.join(' ')}`, 'BATCH_NOT_READY');
  if (Object.keys(errors).length) throw validationError('Check the highlighted fields.', errors);

  await repo.closeBatch(batchId, { authority: auth, closeDate, userId: actor.userId }, conn);
  await audit.record(tx, actor, { action: 'UPDATE', table: 'batches', recordId: before.batch_number, before, after: await repo.batchRaw(batchId, conn) });
  const rows = await repo.liveRowsForUpdate(flow, batchId, conn);
  for (const r of rows) {
    await repo.setRowStatus(flow, r.id, flow.closedStatus, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: flow.rowsTable, recordId: `${r.service_number}:${r.id}`, before: r, after: await repo.rowRaw(flow, r.id, conn) });
  }
  return { batch: shapeBatch(await repo.findBatch(batchId, conn)), ratings: rows.length };
}

module.exports = {
  registerFlow, flowOf, batchCode, numberOf, shapeBatch, getBatch, previewBatch, openOrCreateBatch, refreshStatus,
  clearApproval, departments, approveDepartment, readiness, closeBatch, shapeApproval, who,
};
