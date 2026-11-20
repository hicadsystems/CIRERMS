'use strict';

/*
 * Drafting reports (WP7b): Batch/Signal Content, Rate DOD History and Draft Report. They read what the draft
 * cycle wrote (batches, draft_rows) and write nothing. One filter reading feeds a screen, its PDF and its
 * workbook. A user tied to a specialisation (their department) sees only that department's batches and drafts.
 */
const { validationError, notFound, forbidden } = require('../../shared/errors');
const { parseIsoDate } = require('../../shared/dates');
const { dmy, todayIso } = require('./drafting.format');
const cycle = require('./cycle.service');
const repo = require('./reports.repo');

const text = (v) => (v === undefined || v === null ? '' : String(v).trim());
const idOrNull = (v) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };
const nameOf = (r) => [String(r.surname || '').toUpperCase(), r.first_name, r.middle_name].filter(Boolean).join(' ');
const sexOf = (g) => (g ? String(g)[0].toUpperCase() : '');
const page = (q) => Math.max(1, Number.parseInt(q.page, 10) || 1);
const PAGE_SIZE = 25;
const meta = (total, p, size) => ({ total, page: p, pageSize: size, totalPages: Math.max(1, Math.ceil(total / size)) });
const scopeOf = (user) => ({ specialisationId: (user && user.specialisationId) || null });
const STATUS_TEXT = { open: 'Open', approved: 'Approved', closed: 'Closed' };

/** What a row of a batch says about the posting: Not Recommended, Reported, Scheduled or Pending. */
const ROW_STATE = { proposed: 'Proposed', not_recommended: 'Not Recommended', awaiting_wef: 'Awaiting WEF', scheduled: 'Scheduled', reported: 'Reported' };

// ---- Batch/Signal Content ---------------------------------------------------------------------------------------

function batchFilters(q, user) {
  return {
    branchId: idOrNull(q.branchId),
    rateId: idOrNull(q.rateId),
    signal: text(q.signal),
    batchNo: text(q.batchNo),
    specialisationId: scopeOf(user).specialisationId,
  };
}

function shapeBatchLine(b) {
  const total = Number(b.total || 0);
  const reported = Number(b.reported || 0);
  return {
    ...cycle.shapeBatch(b),
    rateCode: b.rate_code || '',
    total,
    reported,
    scheduled: Number(b.scheduled || 0),
    notReported: total - reported,
    notRecommended: Number(b.not_recommended || 0),
  };
}

async function listBatches(q = {}, user) {
  const f = batchFilters(q, user);
  const p = page(q);
  const r = await repo.listBatches(f, { page: p, pageSize: PAGE_SIZE });
  const totals = await repo.batchTotals(f);
  return {
    items: r.items.map(shapeBatchLine),
    summary: { batches: r.total, open: totals.open, closed: totals.closed },
    meta: meta(r.total, p, PAGE_SIZE),
  };
}

async function loadBatch(id, user) {
  const b = await repo.findBatch(id);
  if (!b) throw notFound('Batch not found.');
  const scope = scopeOf(user);
  if (scope.specialisationId && Number(b.specialisation_id) !== Number(scope.specialisationId)) throw forbidden('This batch belongs to another department.');
  return shapeBatchLine(b);
}

async function getBatch(id, user) {
  return loadBatch(id, user);
}

/** What a rating's row says: the date it reported (or will, scheduled), or what is still to come. */
function shapeBatchRow(x) {
  return {
    id: x.id,
    serviceNumber: x.service_number,
    name: nameOf(x),
    rate: x.rate_name || '',
    rateCode: x.rate_code || x.rate_name || '',
    sex: x.gender || '',
    specialisation: x.specialisation_name || '',
    oldShip: x.current_ship_name || '',
    newShip: x.proposed_ship_name || '',
    vice: x.vice || '',
    remark: x.remark || '',
    request: x.request || '',
    joinedOn: x.joined_on || '',
    status: x.status,
    wef: x.wef || '',
    notRecommendedReason: x.not_recommended_reason || '',
  };
}

function rowFilters(id, q) {
  return { batchId: id, serviceNumber: text(q.serviceNumber).toUpperCase(), name: text(q.name) };
}

async function batchRows(id, q = {}, user) {
  await loadBatch(id, user);
  const p = page(q);
  const r = await repo.batchRows(rowFilters(id, q), { page: p, pageSize: PAGE_SIZE });
  return { items: r.items.map(shapeBatchRow), meta: meta(r.total, p, PAGE_SIZE) };
}

/** Every filtered batch for Print Summary and its workbook. */
async function batchesForPrint(q = {}, user) {
  const f = batchFilters(q, user);
  const r = await repo.listBatches(f, { pageSize: 0 });
  const totals = await repo.batchTotals(f);
  const items = r.items.map(shapeBatchLine);
  const filters = [];
  if (f.branchId) filters.push('Branch');
  if (f.rateId) filters.push('Rate');
  if (f.signal) filters.push(`Signal "${f.signal}"`);
  if (f.batchNo) filters.push(`Batch "${f.batchNo}"`);
  return { items, summary: { batches: r.total, open: totals.open, closed: totals.closed }, filtered: filters };
}

/** One batch with all its ratings (the filters of the screen apply), for Print Draft Report and Export Excel. */
async function batchForPrint(id, q = {}, user) {
  const b = await loadBatch(id, user);
  const r = await repo.batchRows(rowFilters(id, q), { pageSize: 0 });
  return { b, rows: r.items.map(shapeBatchRow) };
}

// ---- Rate DOD History -----------------------------------------------------------------------------------------------

function shapeHistory(x) {
  return {
    id: x.id,
    serviceNumber: x.service_number,
    name: nameOf(x),
    rateCode: x.rate_code || x.rate_name || '',
    batchId: x.batch_id,
    batchNumber: x.batch_number,
    batchStatus: x.batch_status,
    authority: x.authority || '',
    oldShip: x.current_ship_name || '',
    newShip: x.proposed_ship_name || '',
    vice: x.vice || '',
    status: x.status,
    statusText: ROW_STATE[x.status] || x.status,
    wef: x.wef || '',
    notRecommendedReason: x.not_recommended_reason || '',
  };
}

const HISTORY_PDF_MAX = 2000; // the printout for everyone: above this the person narrows it with the search
const HISTORY_XLSX_MAX = 50000;

function ratingOf(r) {
  return {
    serviceNumber: r.service_number, name: nameOf(r), rate: r.rate_name || '', rateCode: r.rate_code || r.rate_name || '',
    sex: r.gender || '', specialisation: r.specialisation_name || '', status: r.status, ship: r.ship_name || '',
  };
}

/** The filters: one rating (an unknown number is a 404), or everyone; a department-tied user sees only theirs. */
async function historyFilters(q, user) {
  const sn = text(q.serviceNumber).toUpperCase();
  let rating = null;
  if (sn) {
    const r = await repo.findRating(sn);
    if (!r) throw notFound(`No rating has Official Number ${sn}.`);
    rating = ratingOf(r);
  }
  return { rating, f: { serviceNumber: sn, specialisationId: scopeOf(user).specialisationId, today: todayIso() } };
}

/** The drafts, newest first, 25 a page: a rating's, or everyone's when no number is given. */
async function history(q = {}, user) {
  const { rating, f } = await historyFilters(q, user);
  const p = page(q);
  const r = await repo.history(f, { page: p, pageSize: PAGE_SIZE });
  return { rating, items: r.items.map(shapeHistory), meta: meta(r.total, p, PAGE_SIZE) };
}

/** What Print PDF and Export Excel take: every draft of the selection. The PDF refuses a selection it cannot hold. */
async function historyForPrint(q = {}, user, kind = 'pdf') {
  const { rating, f } = await historyFilters(q, user);
  const max = kind === 'pdf' ? HISTORY_PDF_MAX : HISTORY_XLSX_MAX;
  const r = await repo.history(f, { pageSize: 0, limit: max + 1 });
  if (r.total > max) {
    throw validationError(`There are ${r.total.toLocaleString()} drafts: too many to ${kind === 'pdf' ? 'print in one PDF' : 'export in one file'} (the limit is ${max.toLocaleString()}). Pick a rating with the search to narrow it.`,
      { serviceNumber: 'Pick a rating to narrow the list.' });
  }
  return { rating, items: r.items.map(shapeHistory), total: r.total };
}

// ---- Draft Report ----------------------------------------------------------------------------------------------

/** The filters, checked: dates as dd/mm/yyyy arrive as YYYY-MM-DD; a From after To is refused. */
function postingFilters(q, user) {
  const fields = {};
  const date = (key, label) => {
    const raw = text(q[key]);
    if (!raw) return null;
    const p = parseIsoDate(raw);
    if (!p.valid || !p.value) { fields[key] = `${label} is not a date. Use dd/mm/yyyy.`; return null; }
    return p.value;
  };
  const from = date('from', 'From');
  const to = date('to', 'To');
  if (from && to && from > to) fields.from = 'From is after To. Swap the dates.';
  if (Object.keys(fields).length) throw validationError(Object.values(fields)[0], fields);
  return { specialisationId: scopeOf(user).specialisationId || idOrNull(q.specialisationId), authority: text(q.authority), from, to };
}

function shapePosting(x) {
  return {
    id: x.id,
    batchId: x.batch_id,
    batchNumber: x.batch_number,
    serviceNumber: x.service_number,
    name: nameOf(x),
    rate: x.rate_name || '',
    rateCode: x.rate_code || x.rate_name || '',
    sex: x.gender || '',
    specialisation: x.specialisation_name || '',
    presentShip: x.current_ship_name || '',
    joinedOn: x.joined_on || '',
    authority: x.authority || '',
    proposedShip: x.proposed_ship_name || '',
    vice: x.vice || '',
    wef: x.wef || '',
  };
}

async function postings(q = {}, user) {
  const f = postingFilters(q, user);
  const p = page(q);
  const r = await repo.postings(f, { page: p, pageSize: PAGE_SIZE });
  return { items: r.items.map(shapePosting), summary: { postings: r.total }, meta: meta(r.total, p, PAGE_SIZE) };
}

async function postingsForPrint(q = {}, user) {
  const f = postingFilters(q, user);
  const r = await repo.postings(f, { pageSize: 0 });
  const specialisation = f.specialisationId ? await repo.specialisationName(f.specialisationId) || 'All' : 'All';
  const period = f.from || f.to ? `${f.from ? dmy(f.from) : 'Start'} to ${f.to ? dmy(f.to) : dmy(todayIso())}` : 'All dates';
  return { items: r.items.map(shapePosting), filters: { specialisation, authority: f.authority || 'All', period }, total: r.total };
}

module.exports = {
  STATUS_TEXT, ROW_STATE, sexOf,
  listBatches, getBatch, batchRows, batchesForPrint, batchForPrint, history, historyForPrint, postings, postingsForPrint,
};
