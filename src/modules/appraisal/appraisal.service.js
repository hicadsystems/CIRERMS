'use strict';

/*
 * Naval Character Assessment: the rules (PLAN 9e decisions 5 to 8; docs/design/README.md, D3 section).
 *
 *   Appraisal Periods         a name (unique), a start and an end (the end after the start; periods never overlap).
 *                             A period opens when added; Close Period is final and a closed period is read-only
 *                             everywhere. No delete.
 *   Recommendation and        Initiate Appraisal for a current rating and an open period: a Character grade and an
 *   Grading                   Efficiency grade from the Appraisal Ratings table, a remark, the CO's name (required),
 *                             the director's name and date (optional, but together; the date is not in the future and
 *                             not before the period began). The rating's rate and ship at the time are kept. One active
 *                             appraisal per rating per period. Edit (only a change counts) and Cancel (a reason) while
 *                             the period is open; a cancelled appraisal leaves the lists and the rating may be appraised
 *                             again. Nothing is deleted outright.
 *   Report on Appraisal       the same filters as the list, the grade counts for both grades, the list, a PDF and an
 *                             Excel workbook from one query (appraisal.documents.js).
 *
 * Every write runs in one transaction with its audit row (an edit's changes are listed with before and after).
 */
const db = require('../../db');
const audit = require('../../shared/audit');
const { accountName } = require('../../shared/rating-name');
const { validationError, conflict, notFound } = require('../../shared/errors');
const { parseIsoDate } = require('../../shared/dates');
const { dmy, isoDay, todayIso } = require('../drafting/drafting.format');
const repo = require('./appraisal.repo');

const MAX = { name: 60, remark: 250, co: 100, director: 100, reason: 250 };

const text = (v) => (v === undefined || v === null ? '' : String(v).trim());
const idOrNull = (v) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const nameOf = (r) => [String(r.surname || '').toUpperCase(), r.first_name, r.middle_name].filter(Boolean).join(' ');
const paging = (q) => ({ page: Math.max(1, Number.parseInt(q.page, 10) || 1), pageSize: 25 });
const meta = (total, page, pageSize) => ({ total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
const appraisalNo = (id) => `APR-${String(id).padStart(4, '0')}`;
const gradeLabel = (code, name) => `${code} - ${name}`;
const who = (row, alias) => (row[`${alias}_username`] ? accountName({
  rating_surname: row[`${alias}_surname`], rating_first_name: row[`${alias}_first_name`], rating_middle_name: row[`${alias}_middle_name`],
  rating_rate_name: row[`${alias}_rate_name`], username: row[`${alias}_username`],
}) : '');

// ---- shapes --------------------------------------------------------------------------------------
function shapePeriod(p) {
  return {
    id: p.id,
    name: p.name,
    start: isoDay(p.start_date),
    end: isoDay(p.end_date),
    status: p.status,
    open: p.status === 'open',
    appraisals: Number(p.appraisal_count || 0),
    closedAt: p.closed_at || null,
    closedBy: who(p, 'clo'),
    createdAt: p.created_at || null,
  };
}

const shapeGrade = (g) => ({
  id: g.id, code: g.code, name: g.name, label: gradeLabel(g.code, g.name), scoreLow: g.score_low, scoreHigh: g.score_high, active: !!g.is_active,
});

function shapeAppraisal(a) {
  const open = a.period_status === 'open';
  return {
    id: a.id,
    no: appraisalNo(a.id),
    serviceNumber: a.service_number,
    name: nameOf(a),
    ratingStatus: a.rating_status,
    rate: a.rate_name || '',
    rateCode: a.rate_code || a.rate_name || '',
    ship: a.ship_name || '',
    branch: a.branch_name || '',
    periodId: a.period_id,
    periodName: a.period_name,
    periodStart: isoDay(a.period_start),
    periodEnd: isoDay(a.period_end),
    periodOpen: open,
    character: { id: a.character_grade_id, code: a.char_code, name: a.char_name, label: gradeLabel(a.char_code, a.char_name), scoreLow: a.char_low, scoreHigh: a.char_high },
    efficiency: { id: a.efficiency_grade_id, code: a.eff_code, name: a.eff_name, label: gradeLabel(a.eff_code, a.eff_name), scoreLow: a.eff_low, scoreHigh: a.eff_high },
    remark: a.remark || '',
    coName: a.co_name,
    directorName: a.director_name || '',
    directorDate: isoDay(a.director_date),
    status: a.status,
    cancelledReason: a.cancelled_reason || '',
    cancelledAt: a.cancelled_at || null,
    cancelledBy: who(a, 'can'),
    createdBy: who(a, 'cre'),
    createdAt: a.created_at || null,
    // Edit and Cancel only while the period is open and the appraisal is active
    editable: open && a.status === 'active',
  };
}

// ---- options -------------------------------------------------------------------------------------
async function options() {
  const [grades, periods, ships, rates, branches] = await Promise.all([repo.grades(), repo.allPeriods(), repo.ships(), repo.rates(), repo.branches()]);
  return {
    today: todayIso(),
    grades: grades.map(shapeGrade),
    periods: periods.map(shapePeriod),
    ships: ships.map((s) => ({ id: s.id, name: s.name, active: !!s.is_active })),
    rates: rates.map((r) => ({ id: r.id, name: r.name, code: r.code || r.name, active: !!r.is_active })),
    branches: branches.map((b) => ({ id: b.id, name: b.name, active: !!b.is_active })),
  };
}

// ---- Appraisal Periods ---------------------------------------------------------------------------
/** What is wrong with a period's fields, as [{ field, message }] (empty when it is fine). */
async function periodProblems(x, { exceptId = null, conn = null } = {}) {
  const out = [];
  const add = (field, message) => { if (!out.some((o) => o.field === field)) out.push({ field, message }); };
  if (!x.name) add('name', 'Enter the period name.');
  else if (x.name.length > MAX.name) add('name', `The name is longer than ${MAX.name} characters.`);
  else if (await repo.periodByName(x.name, exceptId, conn)) add('name', `A period named ${x.name} already exists.`);

  const s = parseIsoDate(x.start);
  const e = parseIsoDate(x.end);
  const start = s.valid && s.value ? s.value : null;
  const end = e.valid && e.value ? e.value : null;
  if (!x.start) add('start', 'Enter the start date.');
  else if (!start) add('start', 'Enter the start date as dd/mm/yyyy.');
  if (!x.end) add('end', 'Enter the end date.');
  else if (!end) add('end', 'Enter the end date as dd/mm/yyyy.');
  else if (start && end <= start) add('end', 'The end must be after the start.');
  if (start && end && end > start) {
    const clash = await repo.overlappingPeriod(start, end, exceptId, conn);
    if (clash) add('start', `Overlaps ${clash.name} (${dmy(clash.start_date)} to ${dmy(clash.end_date)}). Periods must not overlap.`);
    if (exceptId && start) {
      const earliest = await repo.earliestDirectorDate(exceptId, conn);
      if (earliest && isoDay(earliest) < start) add('start', `An appraisal in this period has a director\u2019s date of ${dmy(earliest)}, before this start. Choose an earlier start.`);
    }
  }
  return { problems: out, start, end };
}

const periodInput = (body = {}) => {
  const s = parseIsoDate(body.start);
  const e = parseIsoDate(body.end);
  return { name: text(body.name), start: s.valid && s.value ? s.value : text(body.start), end: e.valid && e.value ? e.value : text(body.end) };
};

function throwProblems(problems) {
  const fields = {};
  problems.forEach((p) => { fields[p.field] = p.message; });
  throw validationError(problems[0].message, fields);
}

async function listPeriods(q = {}) {
  const { page, pageSize } = paging(q);
  const status = q.status === 'open' || q.status === 'closed' ? q.status : '';
  const r = await repo.listPeriods({ status }, { page, pageSize });
  return { items: r.items.map(shapePeriod), summary: await repo.periodCounts(), meta: meta(r.total, page, pageSize) };
}

async function getPeriod(id) {
  const p = await repo.findPeriod(id);
  if (!p) throw notFound('That appraisal period was not found.');
  const shaped = shapePeriod(p);
  // Close Period warns with this: current ratings with no appraisal in the period
  shaped.withoutAppraisal = shaped.open ? await repo.missingCount(id) : 0;
  return shaped;
}

async function createPeriod(body, actor) {
  const x = periodInput(body);
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const { problems, start, end } = await periodProblems(x, { conn });
    if (problems.length) throwProblems(problems);
    const id = await repo.insertPeriod({ name: x.name, start, end, userId: actor.userId }, conn);
    await audit.record(tx, actor, { action: 'INSERT', table: 'appraisal_periods', recordId: String(id), after: await repo.periodRaw(id, conn) });
    return shapePeriod(await repo.findPeriod(id, conn));
  });
}

async function updatePeriod(id, body, actor) {
  const x = periodInput(body);
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const before = await repo.periodRaw(id, conn, 'update');
    if (!before) throw notFound('That appraisal period was not found.');
    if (before.status !== 'open') throw conflict(`${before.name} is closed. A closed period is final and read-only.`, 'PERIOD_CLOSED');
    const { problems, start, end } = await periodProblems(x, { exceptId: id, conn });
    if (problems.length) throwProblems(problems);
    await repo.updatePeriod(id, { name: x.name, start, end }, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'appraisal_periods', recordId: String(id), before, after: await repo.periodRaw(id, conn) });
    return shapePeriod(await repo.findPeriod(id, conn));
  });
}

/** Close Period: final. Appraisals can no longer be added, edited or cancelled in it. */
async function closePeriod(id, actor) {
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const before = await repo.periodRaw(id, conn, 'update');
    if (!before) throw notFound('That appraisal period was not found.');
    if (before.status !== 'open') throw conflict(`${before.name} is already closed.`, 'PERIOD_CLOSED');
    await repo.closePeriod(id, actor.userId, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'appraisal_periods', recordId: String(id), before, after: await repo.periodRaw(id, conn) });
    return shapePeriod(await repo.findPeriod(id, conn));
  });
}

// ---- the rules for one appraisal (Initiate and Edit share them) ----------------------------------
function inputOf(body = {}) {
  const d = parseIsoDate(body.directorDate);
  return {
    serviceNumber: text(body.serviceNumber).toUpperCase(),
    periodId: idOrNull(body.periodId),
    characterGradeId: idOrNull(body.characterGradeId),
    efficiencyGradeId: idOrNull(body.efficiencyGradeId),
    remark: text(body.remark),
    coName: text(body.coName),
    directorName: text(body.directorName),
    directorDate: d.valid && d.value ? d.value : text(body.directorDate),
  };
}

/**
 * What is wrong with an appraisal's fields, as [{ field, message }] (empty when it is fine). `before` is the stored
 * row when editing: a grade that is no longer active may stay if it is the one already held.
 */
function problemsWith(x, { period, gradesById, today, before = null }) {
  const out = [];
  const add = (field, message) => { if (!out.some((o) => o.field === field)) out.push({ field, message }); };
  const grade = (field, id, held, what) => {
    if (!id) { add(field, `Choose the ${what} grade.`); return; }
    const g = gradesById.get(id);
    if (!g) add(field, 'Choose a grade from the list.');
    else if (!g.is_active && !(before && held === g.id)) add(field, `${gradeLabel(g.code, g.name)} is not active in the Appraisal Ratings table.`);
  };
  grade('characterGradeId', x.characterGradeId, before && before.character_grade_id, 'Character');
  grade('efficiencyGradeId', x.efficiencyGradeId, before && before.efficiency_grade_id, 'Efficiency');

  if (!x.coName) add('coName', 'Enter the CO\u2019s name.');
  else if (x.coName.length > MAX.co) add('coName', `The CO\u2019s name is longer than ${MAX.co} characters.`);
  if (x.remark.length > MAX.remark) add('remark', `The remark is longer than ${MAX.remark} characters.`);
  if (x.directorName.length > MAX.director) add('directorName', `The director\u2019s name is longer than ${MAX.director} characters.`);

  if (x.directorDate) {
    const p = parseIsoDate(x.directorDate);
    if (!p.valid || !p.value) add('directorDate', 'Enter the director\u2019s date as dd/mm/yyyy.');
    else if (p.value > today) add('directorDate', 'The director\u2019s date cannot be in the future.');
    else if (period && p.value < isoDay(period.start_date)) add('directorDate', `The date is before the period began (${dmy(period.start_date)}).`);
  }
  if (x.directorName && !x.directorDate) add('directorDate', 'Enter the director\u2019s date too.');
  if (x.directorDate && !x.directorName) add('directorName', 'Enter the director\u2019s name too.');
  return out;
}

const gradesMap = async (conn) => new Map((await repo.grades(conn)).map((g) => [g.id, g]));
const ratingTitle = (card) => [card.rate_code || card.rate_name, nameOf(card)].filter(Boolean).join(' ');
const existingMessage = (card, a) => `${ratingTitle(card)} already has an appraisal for ${a.period_name} (${appraisalNo(a.id)}: Character ${a.char_code}, Efficiency ${a.eff_code}). Edit it from the list: there is one appraisal for each rating and period.`;

// ---- Recommendation and Grading ------------------------------------------------------------------
function listFilters(q = {}) {
  return {
    status: 'active',
    q: text(q.q),
    serviceNumber: text(q.serviceNumber).toUpperCase(),
    periodId: idOrNull(q.periodId),
    shipId: idOrNull(q.shipId),
    rateId: idOrNull(q.rateId),
    branchId: idOrNull(q.branchId),
    gradeId: idOrNull(q.gradeId),
  };
}

async function listAppraisals(q = {}) {
  const { page, pageSize } = paging(q);
  const r = await repo.listAppraisals(listFilters(q), { page, pageSize });
  const counts = await repo.periodCounts();
  return { items: r.items.map(shapeAppraisal), summary: { total: r.total, openPeriods: counts.open }, meta: meta(r.total, page, pageSize) };
}

async function getAppraisal(id) {
  const a = await repo.findAppraisal(id);
  if (!a) throw notFound('That appraisal was not found.');
  const rows = await repo.history(id, a.service_number);
  const edits = rows.map((r) => {
    let changes = r.changes;
    if (typeof changes === 'string') { try { changes = JSON.parse(changes); } catch (_) { changes = []; } }
    return { at: r.created_at || null, by: accountName(r), changes: Array.isArray(changes) ? changes : [] };
  }).filter((e) => e.changes.length && !e.changes.some((c) => c.field === 'Status'));
  return { ...shapeAppraisal(a), edits };
}

/** A rating's appraisals (the record's Advancement tab) and whether one can be initiated for it now. */
async function ratingAppraisals(serviceNumber) {
  const sn = text(serviceNumber).toUpperCase();
  const card = await repo.ratingCard(sn);
  if (!card) throw notFound('That rating was not found.');
  const items = (await repo.ofRating(sn)).map(shapeAppraisal);
  const counts = await repo.periodCounts();
  return {
    rating: { serviceNumber: card.service_number, name: nameOf(card), status: card.status },
    items,
    openPeriods: counts.open,
    canInitiate: card.status === 'current' && counts.open > 0,
  };
}

/** A current rating's rate, branch and ship, for the Initiate Appraisal form. */
async function ratingDetails(serviceNumber) {
  const card = await repo.ratingCard(text(serviceNumber).toUpperCase());
  if (!card) throw notFound('That rating was not found.');
  return {
    serviceNumber: card.service_number,
    name: nameOf(card),
    rate: card.rate_name || '',
    rateCode: card.rate_code || card.rate_name || '',
    branch: card.branch_name || '',
    ship: card.current_ship_name || '',
    status: card.status,
  };
}

async function createAppraisal(body, actor) {
  const x = inputOf(body);
  const today = todayIso();
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    if (!x.serviceNumber) throw validationError('Choose a rating.', { serviceNumber: 'Choose a rating.' });
    await repo.lockRating(x.serviceNumber, conn);
    const card = await repo.ratingCard(x.serviceNumber, conn);
    const period = x.periodId ? await repo.periodRaw(x.periodId, conn, 'share') : null;
    const head = [];
    if (!card) head.push({ field: 'serviceNumber', message: 'That rating was not found.' });
    else if (card.status !== 'current') head.push({ field: 'serviceNumber', message: `${ratingTitle(card)} has left the service and cannot be appraised.` });
    if (!x.periodId) head.push({ field: 'periodId', message: 'Choose an open period.' });
    else if (!period) head.push({ field: 'periodId', message: 'That period was not found.' });
    else if (period.status !== 'open') head.push({ field: 'periodId', message: `${period.name} is closed. Its appraisals are read-only.` });
    if (head.length) throwProblems(head);

    const existing = await repo.activeFor(card.service_number, period.id, conn);
    if (existing) { const m = existingMessage(card, existing); throw conflict(m, 'APPRAISAL_EXISTS', { periodId: m }); }

    const problems = problemsWith(x, { period, gradesById: await gradesMap(conn), today });
    if (problems.length) throwProblems(problems);

    let id;
    try {
      id = await repo.insertAppraisal({ ...x, serviceNumber: card.service_number, rateId: card.rate_id || null, shipId: card.current_ship_id || null, userId: actor.userId }, conn);
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') { const m = `${ratingTitle(card)} already has an appraisal for ${period.name}.`; throw conflict(m, 'APPRAISAL_EXISTS', { periodId: m }); }
      throw err;
    }
    await audit.record(tx, actor, { action: 'INSERT', table: 'appraisals', recordId: `${card.service_number}:${id}`, after: await repo.appraisalRaw(id, conn) });
    return shapeAppraisal(await repo.findAppraisal(id, conn));
  });
}

/** The fields an edit changed, as [{ field, from, to }] with the labels the trail shows (grades as "B - Very Good"). */
function changesOf(before, x, gradesById) {
  const g = (id) => { const row = gradesById.get(id); return row ? gradeLabel(row.code, row.name) : ''; };
  const list = [];
  const diff = (field, from, to) => { if ((from || '') !== (to || '')) list.push({ field, from: from || null, to: to || null }); };
  diff('Character Grade', g(before.character_grade_id), g(x.characterGradeId));
  diff('Efficiency Grade', g(before.efficiency_grade_id), g(x.efficiencyGradeId));
  diff('Remark', before.remark, x.remark);
  diff('CO\u2019s Name', before.co_name, x.coName);
  diff('Director\u2019s Name', before.director_name, x.directorName);
  diff('Director\u2019s Date', dmy(before.director_date), dmy(x.directorDate));
  return list;
}

async function updateAppraisal(id, body, actor) {
  const x = inputOf(body);
  const today = todayIso();
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const before = await repo.appraisalRaw(id, conn, true);
    if (!before) throw notFound('That appraisal was not found.');
    const period = await repo.periodRaw(before.period_id, conn, 'share');
    if (period.status !== 'open') throw conflict(`${period.name} is closed. Its appraisals are read-only.`, 'PERIOD_CLOSED');
    if (before.status !== 'active') throw conflict('This appraisal was cancelled and cannot be changed.', 'APPRAISAL_CANCELLED');
    const grades = await gradesMap(conn);
    const problems = problemsWith(x, { period, gradesById: grades, today, before });
    if (problems.length) throwProblems(problems);
    const changes = changesOf(before, x, grades);
    if (!changes.length) throw validationError('Nothing was changed.', { characterGradeId: 'Nothing was changed.' });
    await repo.updateAppraisal(id, x, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'appraisals', recordId: `${before.service_number}:${id}`, changes });
    return shapeAppraisal(await repo.findAppraisal(id, conn));
  });
}

async function cancelAppraisal(id, body, actor) {
  const reason = text(body && body.reason);
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const before = await repo.appraisalRaw(id, conn, true);
    if (!before) throw notFound('That appraisal was not found.');
    const period = await repo.periodRaw(before.period_id, conn, 'share');
    if (period.status !== 'open') throw conflict(`${period.name} is closed. Its appraisals are read-only.`, 'PERIOD_CLOSED');
    if (before.status !== 'active') throw conflict('This appraisal is already cancelled.', 'APPRAISAL_CANCELLED');
    if (!reason) throw validationError('Give the reason the appraisal is cancelled.', { reason: 'Give the reason the appraisal is cancelled.' });
    if (reason.length > MAX.reason) throw validationError(`The reason is longer than ${MAX.reason} characters.`, { reason: `The reason is longer than ${MAX.reason} characters.` });
    await repo.cancelAppraisal(id, { reason, userId: actor.userId }, conn);
    await audit.record(tx, actor, {
      action: 'UPDATE', table: 'appraisals', recordId: `${before.service_number}:${id}`,
      changes: [{ field: 'Status', from: 'active', to: 'cancelled' }, { field: 'Reason', from: null, to: reason }],
    });
    return shapeAppraisal(await repo.findAppraisal(id, conn));
  });
}

// ---- Report on Appraisal -------------------------------------------------------------------------
function reportFilters(q = {}) {
  const f = listFilters(q);
  return { status: 'active', periodId: f.periodId, shipId: f.shipId, rateId: f.rateId, branchId: f.branchId, gradeId: f.gradeId };
}

/** The grade counts (every grade of the table, best first), as Character and as Efficiency, and the two top-grade shares. */
async function gradeFigures(f, total) {
  const [grades, counts] = await Promise.all([repo.grades(), repo.gradeCounts(f)]);
  const list = grades.map((g) => ({ ...shapeGrade(g), character: counts.character.get(g.id) || 0, efficiency: counts.efficiency.get(g.id) || 0 }));
  const top = (key) => (total ? Math.round((list.slice(0, 2).reduce((a, g) => a + g[key], 0) / total) * 100) : null);
  return { gradeCounts: list, summary: { appraisals: total, characterTop: top('character'), efficiencyTop: top('efficiency') } };
}

async function report(q = {}) {
  const { page, pageSize } = paging(q);
  const f = reportFilters(q);
  const r = await repo.listAppraisals(f, { page, pageSize });
  const figures = await gradeFigures(f, r.total);
  return { items: r.items.map(shapeAppraisal), ...figures, meta: meta(r.total, page, pageSize) };
}

/** Everything the PDF and the workbook print: the filters as words, the figures and every row (one query). */
async function reportAll(q = {}) {
  const f = reportFilters(q);
  const [rows, o] = await Promise.all([repo.reportRows(f), options()]);
  const figures = await gradeFigures(f, rows.length);
  const pick = (list, id, label = (x) => x.name) => { const x = id ? list.find((i) => i.id === id) : null; return x ? label(x) : ''; };
  return {
    filters: {
      period: pick(o.periods, f.periodId) || 'All',
      ship: pick(o.ships, f.shipId) || 'All',
      rate: pick(o.rates, f.rateId, (r) => r.code) || 'All',
      branch: pick(o.branches, f.branchId) || 'All',
      grade: pick(o.grades, f.gradeId, (g) => g.label) || 'Any',
    },
    rows: rows.map(shapeAppraisal),
    ...figures,
  };
}

// ---- the dashboard's tile ------------------------------------------------------------------------
async function dashboard() {
  const c = await repo.dashboardCounts();
  return { month: c.month, openPeriods: c.openPeriods, total: c.month };
}

module.exports = {
  MAX, problemsWith, appraisalNo, nameOf, text, plural,
  options, listPeriods, getPeriod, createPeriod, updatePeriod, closePeriod,
  listAppraisals, getAppraisal, ratingAppraisals, ratingDetails, createAppraisal, updateAppraisal, cancelAppraisal,
  report, reportAll, dashboard,
};
