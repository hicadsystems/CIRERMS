'use strict';

/*
 * Disciplinary Action: the rules. A case is opened for a current rating (pending), concluded
 * with a decision date, sanction, decision and authority, or cancelled with a reason; a concluded
 * case is final apart from Correct (every field but the rating, with a reason, keeping the before
 * and after). Nothing is deleted. Every write runs in a transaction with its audit row.
 */
const db = require('../../db');
const audit = require('../../shared/audit');
const { parseIsoDate } = require('../../shared/dates');
const { dmy: formatDisplayDate, todayIso } = require('./disciplinary.format');
const { validationError, conflict, notFound, badRequest } = require('../../shared/errors');
const repo = require('./disciplinary.repo');
const docs = require('./disciplinary.documents');

const LIMITS = { what: 250, reportedBy: 150, decision: 250, authority: 150, reason: 200 };

const text = (v) => (v === undefined || v === null ? '' : String(v).trim());
const intOrNull = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const fullName = (r) => [r.surname, r.first_name, r.middle_name].filter(Boolean).join(' ');

function shape(c) {
  return {
    id: c.id,
    caseNumber: c.case_number,
    status: c.status,
    serviceNumber: c.service_number,
    name: fullName(c),
    ratingStatus: c.rating_status,
    rate: c.rate_name || '',
    ship: c.ship_name || '',
    offenceId: c.offence_id,
    offence: c.offence_name,
    incidentDate: c.incident_date,
    what: c.what_happened,
    reportedBy: c.reported_by,
    decisionDate: c.decision_date || null,
    sanctionId: c.sanction_id || null,
    sanction: c.sanction_name || '',
    decision: c.decision || '',
    authority: c.authority || '',
    cancelReason: c.cancel_reason || '',
    openedAt: c.opened_at,
    openedBy: c.opened_by_name || '',
    concludedAt: c.concluded_at,
    concludedBy: c.concluded_by_name || '',
    cancelledAt: c.cancelled_at,
    cancelledBy: c.cancelled_by_name || '',
  };
}

/** A required date: { value } or an error message. */
function dateField(raw, label) {
  if (!text(raw)) return { error: `Enter the ${label}.` };
  const p = parseIsoDate(text(raw));
  if (!p.valid || !p.value) return { error: 'Use a real date.' };
  return { value: p.value };
}

function paging(q) {
  const page = Math.max(1, Number.parseInt(q.page, 10) || 1);
  return { page, pageSize: 25 };
}

function meta(total, page, pageSize) {
  return { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** The filters of a list from a query string; From and To are checked here. */
function filtersFrom(q = {}, allowed) {
  const f = {};
  const errors = {};
  if (allowed.includes('q') && text(q.q)) f.q = text(q.q).slice(0, 100);
  if (allowed.includes('serviceNumber') && text(q.serviceNumber)) f.serviceNumber = text(q.serviceNumber).slice(0, 20);
  for (const [key, name] of [['offenceId', 'offenceId'], ['sanctionId', 'sanctionId'], ['shipId', 'shipId'], ['rateId', 'rateId']]) {
    if (allowed.includes(key) && text(q[name])) {
      const n = intOrNull(q[name]);
      if (!n) errors[name] = 'Choose a value from the list.';
      else f[key] = n;
    }
  }
  for (const key of ['from', 'to']) {
    if (allowed.includes(key) && text(q[key])) {
      const p = parseIsoDate(text(q[key]));
      if (!p.valid) errors[key] = `${key === 'from' ? 'From' : 'To'} is not a date.`;
      else f[key] = p.value;
    }
  }
  if (!errors.from && !errors.to && f.from && f.to && f.from > f.to) errors.from = 'From is after To. Swap the dates.';
  if (Object.keys(errors).length) throw validationError(Object.values(errors)[0], errors);
  return f;
}

// ---- reading ---------------------------------------------------------------

async function getOptions() {
  return repo.options();
}

async function findRatings(q = {}) {
  const term = text(q.q);
  if (!term) return { items: [], former: 0, meta: meta(0, 1, 25) };
  const { page, pageSize } = paging(q);
  const { items, total } = await repo.findRatings({ q: term.slice(0, 100), status: 'current', page, pageSize });
  const former = await repo.countRatings({ q: term.slice(0, 100), status: 'former' });
  return {
    items: items.map((r) => ({
      serviceNumber: r.service_number,
      name: fullName(r),
      rate: r.rate_name || '',
      branch: r.branch_name || '',
      command: r.command_name || '',
      ship: r.current_ship_name || '',
      dateEmployed: r.date_employed,
      pendingCases: r.pending_cases,
      cases: r.cases,
    })),
    former,
    meta: meta(total, page, pageSize),
  };
}

async function listPending(q = {}) {
  const f = { ...filtersFrom(q, ['serviceNumber', 'offenceId']), status: 'pending' };
  const { page, pageSize } = paging(q);
  const { items, total } = await repo.listCases(f, { order: 'pending', page, pageSize });
  return { items: items.map(shape), meta: meta(total, page, pageSize) };
}

async function listConcluded(q = {}) {
  const f = { ...filtersFrom(q, ['serviceNumber', 'offenceId', 'sanctionId', 'from', 'to']), status: 'concluded' };
  const { page, pageSize } = paging(q);
  const { items, total } = await repo.listCases(f, { order: 'decided', page, pageSize });
  return { items: items.map(shape), meta: meta(total, page, pageSize) };
}

const REPORT_FILTERS = ['from', 'to', 'offenceId', 'sanctionId', 'shipId', 'rateId'];

/** The one filtered query behind the report's screen, PDF and Excel file. */
async function reportFilters(q) {
  return { ...filtersFrom(q, REPORT_FILTERS), status: 'concluded' };
}

async function report(q = {}) {
  const f = await reportFilters(q);
  const { page, pageSize } = paging(q);
  const [{ items, total }, sum] = await Promise.all([repo.listCases(f, { order: 'decided', page, pageSize }), repo.summary(f)]);
  return { items: items.map(shape), summary: { cases: sum.total, topOffence: sum.topOffence, topSanction: sum.topSanction }, meta: meta(total, page, pageSize) };
}

async function getCase(id) {
  const c = await repo.findCase(id);
  if (!c) throw notFound('That case was not found.', 'CASE_NOT_FOUND');
  return { ...shape(c), corrections: (await repo.corrections(c.id)).map(shapeCorrection) };
}

function shapeCorrection(k) {
  return { id: k.id, at: k.corrected_at, by: k.corrected_by_name || '', reason: k.reason, changes: k.changes };
}

/** A rating's pending and concluded cases (the Discipline tab), 25 a page; a cancelled case is not shown. */
async function casesOfRating(serviceNumber, q = {}) {
  const { page, pageSize } = paging(q);
  const { items, total } = await repo.listCases({ serviceNumber, notCancelled: true }, { order: 'rating', page, pageSize });
  return { items: items.map(shape), meta: meta(total, page, pageSize) };
}

// ---- the three actions ------------------------------------------------------

async function openCase(body, actor) {
  const errors = {};
  const sn = text(body.serviceNumber);
  const offenceId = intOrNull(body.offence_id);
  const what = text(body.what_happened);
  const by = text(body.reported_by);
  const inc = dateField(body.incident_date, 'incident date');
  if (!sn) errors.serviceNumber = 'Choose the rating.';
  if (inc.error) errors.incident_date = inc.error;
  if (!offenceId) errors.offence_id = 'Choose the offence.';
  if (!what) errors.what_happened = 'Describe what happened.';
  else if (what.length > LIMITS.what) errors.what_happened = `Use at most ${LIMITS.what} characters.`;
  if (!by) errors.reported_by = 'Say who reported it.';
  else if (by.length > LIMITS.reportedBy) errors.reported_by = `Use at most ${LIMITS.reportedBy} characters.`;
  if (!errors.incident_date && inc.value > todayIso()) errors.incident_date = 'The incident cannot be in the future.';
  if (Object.keys(errors).length) throw validationError('Check the highlighted fields.', errors);

  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const rating = await repo.ratingForCase(sn, conn, true);
    if (!rating) throw notFound('That rating was not found.', 'RATING_NOT_FOUND');
    if (rating.status !== 'current') {
      throw validationError('Only a current rating can have a case opened. This rating has left the service.', { serviceNumber: 'Only a current rating can have a case opened.' });
    }
    if (rating.date_employed && inc.value < rating.date_employed) {
      throw validationError('Check the highlighted fields.', { incident_date: `${fullName(rating)} joined on ${formatDisplayDate(rating.date_employed)}. The incident cannot be earlier.` });
    }
    const offence = await repo.offenceExists(offenceId, conn);
    if (!offence || !offence.is_active) throw validationError('Check the highlighted fields.', { offence_id: 'Choose an offence from the list.' });
    const dup = await repo.findDuplicate({ serviceNumber: sn, offenceId, incidentDate: inc.value }, conn);
    if (dup) throw validationError('Check the highlighted fields.', { offence_id: `This incident is already open as ${dup.case_number}.` });

    const now = new Date();
    const caseNumber = await repo.nextCaseNumber(now.getFullYear(), conn);
    const id = await repo.insertCase({
      caseNumber, serviceNumber: sn, rateId: rating.rate_id, shipId: rating.ship_id, incidentDate: inc.value,
      offenceId, what, reportedBy: by, userId: actor.userId, openedAt: now,
    }, conn);
    const after = await repo.findRaw(id, conn);
    await audit.record(tx, actor, { action: 'INSERT', table: 'discipline_cases', recordId: caseNumber, after });
    return shape(await repo.findCase(id, conn));
  });
}

async function lockCase(id, conn) {
  const raw = await repo.findRaw(id, conn, true);
  if (!raw) throw notFound('That case was not found.', 'CASE_NOT_FOUND');
  return raw;
}

async function conclude(id, body, actor) {
  const errors = {};
  const sanctionId = intOrNull(body.sanction_id);
  const decision = text(body.decision);
  const authority = text(body.authority);
  const dd = dateField(body.decision_date, 'decision date');
  if (dd.error) errors.decision_date = dd.error;
  if (!sanctionId) errors.sanction_id = 'Choose the sanction.';
  if (!decision) errors.decision = 'Record the decision.';
  else if (decision.length > LIMITS.decision) errors.decision = `Use at most ${LIMITS.decision} characters.`;
  if (!authority) errors.authority = 'Name the authority.';
  else if (authority.length > LIMITS.authority) errors.authority = `Use at most ${LIMITS.authority} characters.`;
  if (!errors.decision_date && dd.value > todayIso()) errors.decision_date = 'The decision cannot be in the future.';

  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const before = await lockCase(id, conn);
    if (before.status !== 'pending') throw conflict('Only a pending case can be concluded.', 'CASE_NOT_PENDING');
    if (!errors.decision_date && dd.value < before.incident_date) {
      errors.decision_date = `The decision cannot be before the incident (${formatDisplayDate(before.incident_date)}).`;
    }
    if (sanctionId) {
      const s = await repo.sanctionExists(sanctionId, conn);
      if (!s || !s.is_active) errors.sanction_id = 'Choose a sanction from the list.';
    }
    if (Object.keys(errors).length) throw validationError('Check the highlighted fields.', errors);

    await repo.conclude(id, { decisionDate: dd.value, sanctionId, decision, authority, userId: actor.userId }, conn);
    const after = await repo.findRaw(id, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'discipline_cases', recordId: before.case_number, before, after });
    return shape(await repo.findCase(id, conn));
  });
}

async function cancel(id, body, actor) {
  const reason = text(body.reason);
  if (!reason) throw validationError('Give the reason the case is cancelled.', { reason: 'Give the reason the case is cancelled.' });
  if (reason.length > LIMITS.reason) throw validationError('The reason is too long.', { reason: `Use at most ${LIMITS.reason} characters.` });
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const before = await lockCase(id, conn);
    if (before.status !== 'pending') throw conflict('Only a pending case can be cancelled. A concluded case is changed with Correct.', 'CASE_NOT_PENDING');
    await repo.cancel(id, { reason, userId: actor.userId }, conn);
    const after = await repo.findRaw(id, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'discipline_cases', recordId: before.case_number, before, after });
    return shape(await repo.findCase(id, conn));
  });
}

const CORRECTABLE = [
  ['Offence', 'offence'], ['Incident Date', 'incidentDate'], ['What Happened', 'what'], ['Reported By', 'reportedBy'],
  ['Decision Date', 'decisionDate'], ['Sanction', 'sanction'], ['Decision', 'decision'], ['Authority', 'authority'],
];

async function correct(id, body, actor) {
  const errors = {};
  const offenceId = intOrNull(body.offence_id);
  const sanctionId = intOrNull(body.sanction_id);
  const what = text(body.what_happened);
  const by = text(body.reported_by);
  const decision = text(body.decision);
  const authority = text(body.authority);
  const reason = text(body.reason);
  const inc = dateField(body.incident_date, 'incident date');
  const dd = dateField(body.decision_date, 'decision date');
  if (inc.error) errors.incident_date = inc.error;
  if (dd.error) errors.decision_date = dd.error;
  if (!offenceId) errors.offence_id = 'Choose the offence.';
  if (!sanctionId) errors.sanction_id = 'Choose the sanction.';
  for (const [key, value, name, max] of [
    ['what_happened', what, 'What happened', LIMITS.what], ['reported_by', by, 'Reported by', LIMITS.reportedBy],
    ['decision', decision, 'The decision', LIMITS.decision], ['authority', authority, 'The authority', LIMITS.authority],
  ]) {
    if (!value) errors[key] = `${name} cannot be empty.`;
    else if (value.length > max) errors[key] = `Use at most ${max} characters.`;
  }
  if (!reason) errors.reason = 'Give the reason for the correction.';
  else if (reason.length > LIMITS.reason) errors.reason = `Use at most ${LIMITS.reason} characters.`;
  if (!errors.incident_date && inc.value > todayIso()) errors.incident_date = 'The incident cannot be in the future.';
  if (!errors.decision_date && dd.value > todayIso()) errors.decision_date = 'The decision cannot be in the future.';
  if (!errors.incident_date && !errors.decision_date && dd.value < inc.value) errors.decision_date = 'The decision cannot be before the incident.';

  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const before = await lockCase(id, conn);
    if (before.status !== 'concluded') throw conflict('Only a concluded case can be corrected.', 'CASE_NOT_CONCLUDED');
    const old = shape(await repo.findCase(id, conn));
    const rating = await repo.ratingForCase(before.service_number, conn);
    if (!errors.incident_date && rating && rating.date_employed && inc.value < rating.date_employed) {
      errors.incident_date = `${fullName(rating)} joined on ${formatDisplayDate(rating.date_employed)}.`;
    }
    let offence = null;
    let sanction = null;
    if (offenceId) {
      offence = await repo.offenceExists(offenceId, conn);
      if (!offence || (!offence.is_active && offenceId !== before.offence_id)) errors.offence_id = 'Choose an offence from the list.';
    }
    if (sanctionId) {
      sanction = await repo.sanctionExists(sanctionId, conn);
      if (!sanction || (!sanction.is_active && sanctionId !== before.sanction_id)) errors.sanction_id = 'Choose a sanction from the list.';
    }
    if (!errors.offence_id && !errors.incident_date) {
      const dup = await repo.findDuplicate({ serviceNumber: before.service_number, offenceId, incidentDate: inc.value, exceptId: id }, conn);
      if (dup) errors.offence_id = `This incident is already on file as ${dup.case_number}.`;
    }
    if (Object.keys(errors).length) throw validationError('Check the highlighted fields.', errors);

    const next = { offenceId, incidentDate: inc.value, what, reportedBy: by, decisionDate: dd.value, sanctionId, decision, authority };
    await repo.correct(id, next, conn);
    const fresh = shape(await repo.findCase(id, conn));
    const show = (key, v) => (key === 'incidentDate' || key === 'decisionDate' ? formatDisplayDate(v) : v || '');
    const changes = CORRECTABLE
      .filter(([, key]) => show(key, old[key]) !== show(key, fresh[key]))
      .map(([label, key]) => [label, show(key, old[key]), show(key, fresh[key])]);
    if (!changes.length) {
      // nothing changed: leave the case as it was (the transaction rolls back)
      throw validationError('Nothing was changed. Edit a field first, then give the reason.', { reason: 'Nothing was changed. Edit a field first, then give the reason.' });
    }
    const korId = await repo.insertCorrection(id, { userId: actor.userId, reason, changes }, conn);
    const after = await repo.findRaw(id, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'discipline_cases', recordId: before.case_number, before, after });
    await audit.record(tx, actor, { action: 'INSERT', table: 'discipline_case_corrections', recordId: `${before.case_number}:${korId}`, after: await repo.correctionRaw(korId, conn) });
    return { ...fresh, corrections: (await repo.corrections(id, conn)).map(shapeCorrection) };
  });
}

// ---- printouts and the workbook ---------------------------------------------

const who = (actor) => (actor && (actor.fullName || actor.username)) || '';

async function pendingPdf(q, actor) {
  const f = { ...filtersFrom(q, ['serviceNumber', 'offenceId']), status: 'pending' };
  const rows = (await repo.allCases(f, { order: 'pending' })).map(shape);
  const o = await repo.options();
  const offence = f.offenceId ? (o.offences.find((x) => x.id === f.offenceId) || {}).name || 'All' : 'All';
  const buffer = await docs.pendingListPdf({ rows, offence, search: f.serviceNumber || '', generatedBy: who(actor) });
  return { buffer, fileName: 'Pending Disciplinary Cases.pdf', mimeType: 'application/pdf' };
}

async function reportPdf(q, actor) {
  const f = await reportFilters(q);
  const rows = (await repo.allCases(f, { order: 'decided' })).map(shape);
  const labels = await filterLabels(f, q);
  return { buffer: await docs.reportPdf({ rows, labels, generatedBy: who(actor) }), fileName: 'Disciplinary Report.pdf', mimeType: 'application/pdf' };
}

async function reportExcel(q, actor) {
  const f = await reportFilters(q);
  const rows = (await repo.allCases(f, { order: 'decided' })).map(shape);
  const labels = await filterLabels(f, q);
  return {
    buffer: await docs.reportWorkbook({ rows, labels, generatedBy: who(actor) }),
    fileName: 'Disciplinary Report.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
}

async function casePdf(id, actor) {
  const c = await getCase(id);
  return { buffer: await docs.caseSheetPdf({ c, generatedBy: who(actor) }), fileName: `Case ${c.caseNumber}.pdf`, mimeType: 'application/pdf' };
}

/** The filter values as words, for the heading of a printout. */
async function filterLabels(f) {
  const o = await repo.options();
  const name = (list, id) => (list.find((x) => x.id === id) || {}).name;
  return {
    period: `${f.from ? formatDisplayDate(f.from) : 'Start'} to ${f.to ? formatDisplayDate(f.to) : formatDisplayDate(todayIso())}`,
    offence: f.offenceId ? name(o.offences, f.offenceId) || 'All' : 'All',
    sanction: f.sanctionId ? name(o.sanctions, f.sanctionId) || 'All' : 'All',
    ship: f.shipId ? name(o.ships, f.shipId) || 'All' : 'All',
    rate: f.rateId ? name(o.rates, f.rateId) || 'All' : 'All',
  };
}

module.exports = {
  getOptions, findRatings, listPending, listConcluded, report, getCase, casesOfRating,
  openCase, conclude, cancel, correct, pendingPdf, reportPdf, reportExcel, casePdf, todayIso, badRequest,
};
