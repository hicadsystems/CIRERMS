'use strict';

const db = require('../../db');
const audit = require('../../shared/audit');
const settings = require('../../shared/settings');
const scheduled = require('../../shared/scheduled');
const { parseIsoDate } = require('../../shared/dates');
const { validationError, conflict, notFound } = require('../../shared/errors');
const repo = require('./discharge.repo');

const text = (v) => (v === undefined || v === null ? '' : String(v).trim());
const intOrNull = (v) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };
const fullName = (r) => [r.surname, r.first_name, r.middle_name].filter(Boolean).join(' ');
const paging = (q) => ({ page: Math.max(1, Number.parseInt(q.page, 10) || 1), pageSize: 25 });
const meta = (total, page, pageSize) => ({ total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
const todayIso = () => scheduled.todayIso();

async function rule() {
  const s = await settings.numbers([
    'discharge.age_due', 'discharge.service_due', 'discharge.age_band_1', 'discharge.age_band_2',
    'discharge.age_band_3', 'discharge.service_band_1', 'discharge.service_band_2', 'discharge.service_band_3',
  ]);
  return s;
}

async function options() {
  const o = await repo.options();
  return {
    exitTypes: o.exitTypes.map((x) => ({ ...x, keepsCurrent: !!x.keepsCurrent, isDeath: !!x.isDeath })),
    branches: o.branches, rates: o.rates, entryModes: o.entryModes, rule: await rule(), today: todayIso(),
    proposalNumber: await repo.nextProposalNumber(new Date().getFullYear(), null, false),
  };
}

function ageBand(age, r) {
  if (age === null || age === undefined) return 'neutral';
  if (age >= r['discharge.age_band_3']) return 'error';
  if (age >= r['discharge.age_band_2']) return 'warning';
  if (age >= r['discharge.age_band_1']) return 'success';
  return 'neutral';
}
function serviceBand(years, r) {
  if (years === null || years === undefined) return 'neutral';
  if (years >= r['discharge.service_band_3']) return 'error';
  if (years >= r['discharge.service_band_2']) return 'warning';
  if (years >= r['discharge.service_band_1']) return 'success';
  return 'neutral';
}

async function due(q = {}) {
  const r = await rule();
  const { page, pageSize } = paging(q);
  const x = await repo.listDue({
    today: todayIso(), ageDue: r['discharge.age_due'], serviceDue: r['discharge.service_due'],
    q: text(q.q).slice(0, 100), branchId: intOrNull(q.branchId), rateId: intOrNull(q.rateId), entryModeId: intOrNull(q.entryModeId),
  }, { page, pageSize });
  return {
    items: x.items.map((d) => ({
      serviceNumber: d.service_number, name: fullName(d).toUpperCase(), rate: d.rate_code || d.rate_name || '',
      branch: d.branch_name || '', dateOfBirth: d.date_of_birth, dateEmployed: d.date_employed,
      entryMode: d.entry_mode_name || '', currentShip: d.current_ship_name || '',
      proposalNumber: d.proposal_number || '', proposalId: d.proposal_id || null,
      lastReengagement: d.last_reengagement_date ? {
        date: d.last_reengagement_date, periodMonths: Number(d.last_reengagement_period),
        untilDate: d.last_reengagement_until,
      } : null,
      age: d.age === null ? null : Number(d.age), yearsService: d.years_service === null ? null : Number(d.years_service),
      ageBand: ageBand(d.age === null ? null : Number(d.age), r),
      serviceBand: serviceBand(d.years_service === null ? null : Number(d.years_service), r),
      pendingCases: Number(d.pending_cases || 0),
    })),
    meta: meta(x.total, page, pageSize),
    inProposalCount: x.inProposal,
  };
}

async function proposalCandidate(serviceNumber) {
  const r = await repo.proposalCandidate(text(serviceNumber).toUpperCase());
  if (!r) throw notFound('That rating was not found.', 'RATING_NOT_FOUND');
  const name = fullName(r).toUpperCase();
  const reengagementUntil = r.reengagement_until || null;
  return {
    serviceNumber: r.service_number,
    name,
    rate: r.rate_code || r.rate_name || '',
    branch: r.branch_name || '',
    status: r.status,
    pendingCases: Number(r.pending_cases || 0),
    proposalNumber: r.proposal_number || '',
    dischargeStatus: r.discharge_status || '',
    reengagementUntil,
    canAdd: r.status === 'current' && !r.proposal_number && !r.discharge_status,
    isReengaged: !!reengagementUntil && String(reengagementUntil).slice(0, 10) >= todayIso(),
  };
}

async function createProposal(body, actor) {
  const sns = Array.isArray(body.serviceNumbers) ? body.serviceNumbers.map((s) => text(s).toUpperCase()).filter(Boolean) : [];
  if (!sns.length) throw validationError('Choose at least one rating.', { serviceNumbers: 'Choose at least one rating.' });
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const candidates = [];
    for (const sn of [...new Set(sns)]) {
      const rating = await repo.ratingBasic(sn, conn);
      if (!rating || rating.status !== 'current') continue;
      if (await repo.hasExistingProposalRow(sn, conn)) continue;
      candidates.push(sn);
    }
    if (!candidates.length) {
      throw validationError('No ratings could be added. They may already be in a proposal or no longer current.', {
        serviceNumbers: 'Choose current ratings that are not already in a proposal.',
      });
    }
    const number = await repo.nextProposalNumber(new Date().getFullYear(), conn);
    const proposalId = await repo.insertProposal(number, actor.userId, conn);
    for (const sn of candidates) await repo.insertRow(proposalId, sn, actor.userId, conn);
    const after = await repo.proposalRaw(proposalId, conn);
    await audit.record(tx, actor, { action: 'INSERT', table: 'discharge_proposals', recordId: number, after });
    return { id: proposalId, proposalNumber: number, added: candidates.length };
  });
}

function shapeRow(d) {
  return {
    id: d.id, proposalId: d.proposal_id, serviceNumber: d.service_number,
    name: fullName(d).toUpperCase(), rate: d.rate_code || d.rate_name || '',
    status: d.status, exitTypeId: d.exit_type_id, exitType: d.exit_type_name || '',
    exitDate: d.exit_date, exitReason: d.exit_reason || '', approvedBy: d.approved_by || '',
    comment: d.comment || '', deathCertificate: !!d.death_certificate,
    condolenceLetter: !!d.condolence_letter, dependentFundEvidence: !!d.dependent_fund_evidence,
    swornAffidavit: !!d.sworn_affidavit, closedBy: d.closed_by_name || '',
    closedAt: d.closed_at, pendingCases: Number(d.pending_cases || 0),
  };
}

async function proposals(q = {}) {
  const { page, pageSize } = paging(q);
  const r = await repo.proposals({ page, pageSize });
  return {
    items: r.items.map((p) => ({
      id: p.id, proposalNumber: p.proposal_number, proposedAt: p.proposed_at,
      proposedBy: p.proposed_by_name || '', ratings: Number(p.ratings || 0),
      pending: Number(p.pending || 0), closed: Number(p.closed || 0),
      reengagements: Number(p.reengagements || 0),
    })),
    meta: meta(r.total, page, pageSize),
  };
}

async function proposalRows(q = {}) {
  const rawId = text(q.proposalId);
  const proposalId = rawId ? intOrNull(rawId) : null;
  if (rawId && !proposalId) throw validationError('Choose a valid proposal.', { proposalId: 'Choose a valid proposal.' });
  if (proposalId && !await repo.proposalRaw(proposalId)) {
    throw notFound('That proposal was not found.', 'DISCHARGE_PROPOSAL_NOT_FOUND');
  }
  const { page, pageSize } = paging(q);
  const r = await repo.pendingProposalRows(proposalId, { page, pageSize });
  return {
    items: r.items.map((d) => ({
      ...shapeRow(d),
      proposalNumber: d.proposal_number,
      proposedAt: d.proposed_at,
      proposedBy: d.proposed_by_name || '',
      dateOfBirth: d.date_of_birth,
      dateEmployed: d.date_employed,
      age: d.age === null ? null : Number(d.age),
      yearsService: d.years_service === null ? null : Number(d.years_service),
      branch: d.branch_name || '',
      entryMode: d.entry_mode_name || '',
      currentShip: d.current_ship_name || '',
      lastReengagement: d.last_reengagement_date ? {
        date: d.last_reengagement_date,
        periodMonths: Number(d.last_reengagement_period),
        untilDate: d.last_reengagement_until,
      } : null,
    })),
    meta: meta(r.total, page, pageSize),
    processed: r.processed,
  };
}

async function proposal(id) {
  const p = await repo.proposalRaw(id);
  if (!p) throw notFound('That proposal was not found.', 'DISCHARGE_PROPOSAL_NOT_FOUND');
  const rows = await repo.listRows(id);
  return {
    id: p.id, proposalNumber: p.proposal_number, proposedAt: p.proposed_at,
    rows: rows.map(shapeRow),
  };
}

async function addRating(proposalId, body, actor) {
  const sn = text(body.serviceNumber).toUpperCase();
  if (!sn) throw validationError('Choose a rating.', { serviceNumber: 'Choose a rating.' });
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    if (!await repo.proposalRaw(proposalId, conn, true)) throw notFound('That proposal was not found.', 'DISCHARGE_PROPOSAL_NOT_FOUND');
    const rating = await repo.ratingBasic(sn, conn);
    if (!rating || rating.status !== 'current') throw validationError('Choose a current rating.', { serviceNumber: 'Only a current rating can be added.' });
    const existing = await db.query("SELECT id FROM discharge_rows WHERE service_number=? AND status IN ('pending','scheduled','closed') LIMIT 1", [sn], conn);
    if (existing.length) throw conflict('This rating is already in a proposal or has been discharged.');
    const id = await repo.insertRow(proposalId, sn, actor.userId, conn);
    await audit.record(tx, actor, { action: 'INSERT', table: 'discharge_rows', recordId: `${proposalId}:${sn}`, after: await repo.rowRaw(id, conn) });
    return shapeRow((await repo.listRows(proposalId, conn)).find((x) => x.id === id));
  });
}

async function processRow(proposalId, sn, body, actor) {
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const row = await repo.rowByProposal(proposalId, sn, conn, true);
    if (!row) throw notFound('That discharge row was not found.', 'DISCHARGE_ROW_NOT_FOUND');
    if (row.status !== 'pending') throw conflict('A scheduled or closed discharge cannot be changed.');

    const exitTypeId = intOrNull(body.exitTypeId);
    const exitReason = text(body.exitReason).slice(0, 100);
    const approvedBy = text(body.approvedBy).slice(0, 150);
    const comment = text(body.comment).slice(0, 500);
    const status = text(body.status).toLowerCase();
    const errors = {};
    if (!exitTypeId) errors.exitTypeId = 'Choose the exit type.';
    if (!exitReason) errors.exitReason = 'Give the reason the rating is leaving.';
    if (exitReason.length > 100) errors.exitReason = 'Use at most 100 characters.';
    if (!['pending', 'closed'].includes(status)) errors.status = 'Choose Pending or Closed.';
    let exitDate = null;
    if (text(body.exitDate)) {
      const p = parseIsoDate(text(body.exitDate));
      if (!p.valid) errors.exitDate = 'Use a real date.';
      else exitDate = p.value;
    }
    const rating = await repo.ratingBasic(sn, conn);
    if (exitDate && rating && rating.date_employed && exitDate < String(rating.date_employed).slice(0, 10)) {
      errors.exitDate = 'Exit date cannot be before the date enlisted.';
    }
    if (Object.keys(errors).length) throw validationError('Check the highlighted fields.', errors);

    const type = await repo.exitType(exitTypeId, conn);
    if (!type || !type.is_active) throw validationError('Choose an exit type from the list.', { exitTypeId: 'Choose an exit type from the list.' });
    if (!type.keepsCurrent && !exitDate) errors.exitDate = 'Enter the exit date.';
    if (Object.keys(errors).length) throw validationError('Check the highlighted fields.', errors);

    if (status === 'closed' && exitDate > todayIso()) {
      const id = row.id;
      await repo.updateRow(id, {
        exitTypeId, exitDate, exitReason, approvedBy, comment,
        deathCertificate: !!body.deathCertificate && !!type.isDeath,
        condolenceLetter: !!body.condolenceLetter && !!type.isDeath,
        dependentFundEvidence: !!body.dependentFundEvidence && !!type.isDeath,
        swornAffidavit: !!body.swornAffidavit && !!type.isDeath,
        status: 'scheduled', closedBy: null, closedAt: null,
      }, conn);
      const scheduledId = await scheduled.schedule(tx, actor, {
        kind: 'discharge', serviceNumber: sn, effectiveDate: exitDate,
        payload: { exitTypeId, exitReason, approvedBy, comment,
          deathCertificate: !!body.deathCertificate && !!type.isDeath,
          condolenceLetter: !!body.condolenceLetter && !!type.isDeath,
          dependentFundEvidence: !!body.dependentFundEvidence && !!type.isDeath,
          swornAffidavit: !!body.swornAffidavit && !!type.isDeath,
        },
        source: { table: 'discharge_rows', id },
      });
      await repo.setScheduled(id, scheduledId, conn);
      await audit.record(tx, actor, { action: 'UPDATE', table: 'discharge_rows', recordId: `${proposalId}:${sn}`, before: row, after: await repo.rowRaw(id, conn) });
      return { status: 'scheduled', exitDate };
    }

    if (status === 'closed') {
      await repo.updateRow(row.id, {
        exitTypeId, exitDate: exitDate || todayIso(), exitReason, approvedBy, comment,
        deathCertificate: !!body.deathCertificate && !!type.isDeath,
        condolenceLetter: !!body.condolenceLetter && !!type.isDeath,
        dependentFundEvidence: !!body.dependentFundEvidence && !!type.isDeath,
        swornAffidavit: !!body.swornAffidavit && !!type.isDeath,
        status: 'closed', closedBy: actor.userId, closedAt: new Date(),
      }, conn);
      await repo.applyExit(sn, { exitTypeId, exitDate: exitDate || todayIso(), exitReason }, conn);
    } else {
      await repo.updateRow(row.id, {
        exitTypeId, exitDate, exitReason, approvedBy, comment,
        deathCertificate: !!body.deathCertificate && !!type.isDeath,
        condolenceLetter: !!body.condolenceLetter && !!type.isDeath,
        dependentFundEvidence: !!body.dependentFundEvidence && !!type.isDeath,
        swornAffidavit: !!body.swornAffidavit && !!type.isDeath,
        status: 'pending', closedBy: null, closedAt: null,
      }, conn);
    }
    await audit.record(tx, actor, { action: 'UPDATE', table: 'discharge_rows', recordId: `${proposalId}:${sn}`, before: row, after: await repo.rowRaw(row.id, conn) });
    return status === 'closed' ? { status: 'closed' } : { status: 'pending' };
  });
}

async function reengage(proposalId, sn, body, actor) {
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const row = await repo.rowByProposal(proposalId, sn, conn, true);
    if (!row) throw notFound('That discharge row was not found.', 'DISCHARGE_ROW_NOT_FOUND');
    if (row.status !== 'pending') throw conflict('Only a pending discharge can be re-engaged.');
    const date = text(body.reengageDate);
    const period = Number.parseInt(body.periodMonths, 10);
    const errors = {};
    const p = parseIsoDate(date);
    if (!p.valid) errors.reengageDate = 'Use a real date.';
    if (!Number.isInteger(period) || period < 1 || period > 120) errors.periodMonths = 'Enter a period from 1 to 120 months.';
    const approvedBy = text(body.approvedBy).slice(0, 150);
    if (!approvedBy) errors.approvedBy = 'Say who approved the re-engagement.';
    const rating = await repo.ratingBasic(sn, conn);
    if (rating && rating.status !== 'current') errors.reengageDate = 'Only a current rating can be re-engaged.';
    if (p.valid && rating && rating.date_employed && p.value < String(rating.date_employed).slice(0, 10)) {
      errors.reengageDate = 'Re-engagement date cannot be before the date enlisted.';
    }
    if (Object.keys(errors).length) throw validationError('Check the highlighted fields.', errors);
    const d = new Date(`${p.value}T00:00:00`);
    d.setMonth(d.getMonth() + period);
    const until = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const id = await repo.insertReengagement({
      proposalId, serviceNumber: sn, reengageDate: p.value, periodMonths: period, untilDate: until,
      approvedBy, userId: actor.userId,
    }, conn);
    await audit.record(tx, actor, { action: 'INSERT', table: 'discharge_reengagements', recordId: `${proposalId}:${sn}`, after: await repo.reengagementRaw(id, conn) });
    await repo.removeRow(row.id, conn);
    await audit.record(tx, actor, { action: 'DELETE', table: 'discharge_rows', recordId: `${proposalId}:${sn}`, before: row });
    return { id, reengageDate: p.value, periodMonths: period, untilDate: until };
  });
}

async function removeRow(proposalId, sn, actor) {
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const row = await repo.rowByProposal(proposalId, sn, conn, true);
    if (!row) throw notFound('That discharge row was not found.', 'DISCHARGE_ROW_NOT_FOUND');
    if (row.status === 'closed' || row.status === 'scheduled') throw conflict('Scheduled or closed discharge rows cannot be removed.');
    await repo.removeRow(row.id, conn);
    await audit.record(tx, actor, { action: 'DELETE', table: 'discharge_rows', recordId: `${proposalId}:${sn}`, before: row });
    return { serviceNumber: sn };
  });
}

async function report(q = {}, { all = false } = {}) {
  const f = {};
  for (const k of ['from', 'to']) if (text(q[k])) { const p = parseIsoDate(text(q[k])); if (!p.valid) throw validationError(`${k} is not a date.`, { [k]: 'Use a real date.' }); f[k] = p.value; }
  if (f.from && f.to && f.from > f.to) throw validationError('From is after To.', { from: 'From is after To.' });
  f.reengagementOnly = text(q.exitTypeId) === 'reengagement';
  f.exitTypeId = f.reengagementOnly ? null : intOrNull(q.exitTypeId);
  f.rateId = intOrNull(q.rateId); f.branchId = intOrNull(q.branchId);
  const { page, pageSize } = paging(q);
  const [r, choices] = await Promise.all([repo.report(f, { page, pageSize, all }), all ? repo.options() : null]);
  const reportFilters = all ? {
    from: f.from || 'All',
    to: f.to || 'All',
    exitType: f.reengagementOnly ? 'Re-engagement' : (choices.exitTypes.find((x) => Number(x.id) === f.exitTypeId) || {}).name || 'All',
    rate: (choices.rates.find((x) => Number(x.id) === f.rateId) || {}).name || 'All',
    branch: (choices.branches.find((x) => Number(x.id) === f.branchId) || {}).name || 'All',
  } : null;
  return {
    items: r.items,
    summary: {
      discharges: r.discharges,
      scheduled: r.scheduled,
      reengagements: r.reengagements,
    },
    meta: meta(r.total, page, pageSize),
    filters: reportFilters,
  };
}

async function serviceDetails(sn) {
  if (!text(sn)) throw validationError('Enter an Official No.', { serviceNumber: 'Enter an Official No.' });
  const r = await repo.serviceDetails(text(sn).toUpperCase());
  if (!r) throw notFound('That rating was not found.', 'RATING_NOT_FOUND');
  return r;
}

async function verification(sn) {
  const rating = await repo.ratingBasic(text(sn).toUpperCase());
  if (!rating) throw notFound('That rating was not found.', 'RATING_NOT_FOUND');
  const reengagements = await repo.reengagementHistory(rating.service_number);
  return {
    rating,
    reengagement: reengagements[0] || null,
    reengagements,
    discharge: await repo.verificationDischarge(rating.service_number),
  };
}

// Scheduled discharge: apply the rating exit and close/open posting in the scheduled transaction.
scheduled.register('discharge', {
  async apply(tx, change, actor) {
    const p = change.payload || {};
    await repo.applyExit(change.service_number, {
      exitTypeId: p.exitTypeId, exitDate: typeof change.effective_date === 'string' ? change.effective_date : todayIso(), exitReason: p.exitReason,
    }, tx.connection);
    await db.query(
      `UPDATE discharge_rows SET status='closed', closed_by=?, closed_at=NOW(),
       exit_type_id=?, exit_date=?, exit_reason=?, approved_by=?, comment=?,
       death_certificate=?, condolence_letter=?, dependent_fund_evidence=?, sworn_affidavit=?
       WHERE scheduled_change_id=?`,
      [actor.userId || null, p.exitTypeId, typeof change.effective_date === 'string' ? change.effective_date : todayIso(),
       p.exitReason || null, p.approvedBy || null, p.comment || null,
       p.deathCertificate ? 1 : 0, p.condolenceLetter ? 1 : 0, p.dependentFundEvidence ? 1 : 0, p.swornAffidavit ? 1 : 0,
       change.id], tx.connection);
    return `Discharged ${change.service_number} on ${typeof change.effective_date === 'string' ? change.effective_date : todayIso()}`;
  },
});

module.exports = { options, due, proposalCandidate, createProposal, proposals, proposalRows, proposal, addRating, processRow, reengage, removeRow, report, serviceDetails, verification };
