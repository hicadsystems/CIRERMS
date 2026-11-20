'use strict';

/*
 * Training Drafting: the rules. A training batch is one course in one month of one year. It is
 * made with the ratings the course is open to, which can be added to and removed from while it is
 * open, and it is closed when its history is confirmed: that adds a Training entry to the record of
 * every rating that attended. A closed batch is final (a mistake is put right on the rating's
 * record, under the audit trail). Nothing is deleted. Every write runs in a transaction with its
 * audit rows.
 */
const db = require('../../db');
const audit = require('../../shared/audit');
const { parseIsoDate } = require('../../shared/dates');
const { validationError, conflict, notFound, badRequest } = require('../../shared/errors');
const repo = require('./training-drafting.repo');
const fmt = require('./training-drafting.format');
const upload = require('./training-drafting.upload');
const docs = require('./training-drafting.documents');

const RESULTS = ['Distinction', 'Credit', 'Pass', 'Fail'];
const LIMITS = { qualification: 200, authority: 150 };
const FIRST_COURSE = 'First course';

const text = (v) => (v === undefined || v === null ? '' : String(v).trim());
const intOrNull = (v) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};
/** "Able Seaman (AB)" as "AB", as the rest of the app writes a rate. */
const shortRate = (rate) => { const m = /\(([^)]+)\)/.exec(rate || ''); return m ? m[1] : rate || ''; };
const nameOf = (r) => [r.surname, r.first_name, r.middle_name].filter(Boolean).join(' ');

// ---- shapes ----------------------------------------------------------------------

function shapeBatch(b) {
  return {
    id: b.id,
    batchNumber: b.batch_number,
    status: b.status,
    courseId: b.course_id,
    course: b.course_name,
    courseCode: b.course_code || '',
    qualification: b.qualification || '',
    weeks: b.weeks || null,
    year: b.year,
    month: b.month,
    period: `${fmt.monthName(b.month)} ${b.year}`,
    // an open batch shows the course's own institution until the history is confirmed
    institutionId: b.institution_id || b.course_institution_id || null,
    institution: b.institution_name || b.course_institution_name || '',
    startDate: b.start_date || null,
    endDate: b.end_date || null,
    ratings: b.ratings,
    attending: b.attending,
    openedAt: b.opened_at,
    openedBy: b.opened_by_name || '',
    closedAt: b.closed_at || null,
    closedBy: b.closed_by_name || '',
  };
}

function shapeMember(m, batch) {
  return {
    serviceNumber: m.service_number,
    name: nameOf(m),
    surname: m.surname,
    otherNames: [m.first_name, m.middle_name].filter(Boolean).join(' '),
    rate: m.rate_name || '',
    ratingStatus: m.rating_status,
    lengthOfService: fmt.serviceLength(m.date_employed),
    lastCourse: m.last_course || FIRST_COURSE,
    lastCourseStart: m.last_course_start || null,
    lastCourseEnd: m.last_course_end || null,
    attended: !!m.attended,
    startDate: m.start_date || null,
    endDate: m.end_date || null,
    effectiveStart: m.start_date || (batch ? batch.start_date : null) || null,
    effectiveEnd: m.end_date || (batch ? batch.end_date : null) || null,
    result: m.result || '',
  };
}

// ---- reading ---------------------------------------------------------------------------

async function getOptions() {
  return repo.options();
}

function paging(q) {
  return { page: Math.max(1, Number.parseInt(q.page, 10) || 1), pageSize: 25 };
}

function meta(total, page, pageSize) {
  return { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/** The filters of a batch list from a query string; a value that is not a value is an error, not ignored. */
function listFilters(q = {}) {
  const f = {};
  const errors = {};
  if (text(q.status)) {
    if (!['open', 'closed'].includes(text(q.status))) errors.status = 'Choose Open or Closed.';
    else f.status = text(q.status);
  }
  if (text(q.courseId)) {
    const n = intOrNull(q.courseId);
    if (!n) errors.courseId = 'Choose a course from the list.';
    else f.courseId = n;
  }
  if (text(q.month)) {
    const n = intOrNull(q.month);
    if (!n || n > 12) errors.month = 'Choose a month from the list.';
    else f.month = n;
  }
  if (text(q.year)) {
    const n = intOrNull(q.year);
    if (!n || n < 1900 || n > 2200) errors.year = 'Enter a four-digit year.';
    else f.year = n;
  }
  if (text(q.batchNumber)) f.batchNumber = text(q.batchNumber).slice(0, 30);
  if (Object.keys(errors).length) throw validationError(Object.values(errors)[0], errors);
  return f;
}

async function listBatches(q = {}) {
  const f = listFilters(q);
  const { page, pageSize } = paging(q);
  const { items, total } = await repo.listBatches(f, { page, pageSize });
  return { items: items.map(shapeBatch), meta: meta(total, page, pageSize) };
}

async function getBatch(id) {
  const b = await repo.findBatch(id);
  if (!b) throw notFound('That batch was not found.', 'BATCH_NOT_FOUND');
  const batch = shapeBatch(b);
  const members = (await repo.members(id)).map((m) => shapeMember(m, batch));
  return { ...batch, members };
}

/** The ratings a course is open to now, and how many match the filters (the dialogs' count). */
async function eligibleCount(q = {}) {
  const courseId = intOrNull(q.courseId);
  if (!courseId) throw validationError('Choose the course.', { course_id: 'Choose the course.' });
  const c = await repo.course(courseId);
  if (!c) throw validationError('Choose a course from the list.', { course_id: 'Choose a course from the list.' });
  const f = filtersFrom(q);
  const [count, total] = await Promise.all([repo.countEligible(c, f), repo.countEligible(c, {})]);
  return { count, total };
}

/** The Branch, Specialisation and Rate filters of a dialog ("All" is an empty value). */
function filtersFrom(body = {}) {
  const f = {};
  const errors = {};
  for (const [key, names, label] of [
    ['branchId', ['branch_id', 'branchId'], 'branch'], ['specialisationId', ['specialisation_id', 'specialisationId'], 'specialisation'], ['rateId', ['rate_id', 'rateId'], 'rate'],
  ]) {
    const raw = names.map((n) => body[n]).find((v) => v !== undefined && v !== null && text(v) !== '');
    if (raw !== undefined) {
      const n = intOrNull(raw);
      if (!n) errors[names[0]] = `Choose a ${label} from the list, or All.`;
      else f[key] = n;
    }
  }
  if (Object.keys(errors).length) throw validationError(Object.values(errors)[0], errors);
  return f;
}

// ---- making a batch -------------------------------------------------------------------

const thisYear = () => new Date().getFullYear();

function duplicateError(c, year, month, batchNumber) {
  const msg = `${c.name} already has a batch for ${fmt.monthName(month)} ${year}: ${batchNumber}.`;
  return validationError(msg, { month: msg });
}

async function createBatch(body, actor) {
  const errors = {};
  const courseId = intOrNull(body.course_id);
  const month = intOrNull(body.month);
  const year = intOrNull(body.year);
  if (!courseId) errors.course_id = 'Choose the course.';
  if (!month || month > 12) errors.month = 'Choose the month.';
  if (!year || year < 2000 || year > thisYear() + 1) errors.year = `Enter a year from 2000 to ${thisYear() + 1}.`;
  let filters = {};
  try { filters = filtersFrom(body); } catch (e) { Object.assign(errors, e.fields || {}); }
  if (Object.keys(errors).length) throw validationError('Check the highlighted fields.', errors);

  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const c = await repo.course(courseId, conn);
    if (!c || !c.is_active) throw validationError('Check the highlighted fields.', { course_id: 'Choose a course from the list.' });
    const dup = await repo.findByPeriod({ courseId, year, month }, conn);
    if (dup) throw duplicateError(c, year, month, dup.batch_number);
    if (!(await repo.countEligible(c, filters, conn))) {
      throw validationError('No eligible ratings match. A batch needs at least one rating.', { course_id: 'No eligible ratings match this course and these filters.' });
    }
    const batchNumber = fmt.batchNumber(year, month, courseId);
    let id;
    try {
      id = await repo.insertBatch({ batchNumber, courseId, year, month, userId: actor.userId }, conn);
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY') {
        const again = await repo.findByPeriod({ courseId, year, month }, conn);
        throw duplicateError(c, year, month, again ? again.batch_number : batchNumber);
      }
      throw err;
    }
    const added = await repo.addEligible(id, c, filters, actor.userId, conn);
    const after = await repo.findBatchRaw(id, conn);
    await audit.record(tx, actor, { action: 'INSERT', table: 'training_batches', recordId: batchNumber, after: { ...after, ratings_added: added } });
    return getBatchWith(id, conn);
  });
}

async function getBatchWith(id, conn) {
  const b = await repo.findBatch(id, conn);
  const batch = shapeBatch(b);
  return { ...batch, members: (await repo.members(id, conn)).map((m) => shapeMember(m, batch)) };
}

async function lockOpen(id, conn) {
  const raw = await repo.findBatchRaw(id, conn, true);
  if (!raw) throw notFound('That batch was not found.', 'BATCH_NOT_FOUND');
  if (raw.status !== 'open') throw conflict('This batch is closed. A closed batch is final; a mistake is put right on the rating\u2019s record.', 'BATCH_CLOSED');
  return raw;
}

/** Add Ratings / Add by Branch: every eligible rating matching the filters. */
async function addRatings(id, body, actor) {
  const filters = filtersFrom(body);
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const raw = await lockOpen(id, conn);
    const c = await repo.course(raw.course_id, conn);
    const before = (await repo.members(id, conn)).length;
    if (!(await repo.countEligible(c, filters, conn))) {
      throw validationError('No more eligible ratings match. Everyone the course is open to is already in an open batch for it.', { branch_id: 'No eligible ratings match.' });
    }
    const added = await repo.addEligible(id, c, filters, actor.userId, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'training_batches', recordId: raw.batch_number, changes: [{ field: 'ratings', from: before, to: before + added }] });
    const result = await getBatchWith(id, conn);
    return { ...result, added };
  });
}

/** Why a course is not open to a rating, or '' when it is. */
function ineligibleReason(c, r) {
  const who = nameOf(r);
  if (c.branch_id && r.branch_id !== c.branch_id) return `${c.name} is for the ${c.branch_name} branch. ${who} is in ${r.branch_name || 'no branch'}.`;
  if (c.specialisation_id && r.specialisation_id !== c.specialisation_id) return `${c.name} is for the ${c.specialisation_name} specialisation. ${who} is ${r.specialisation_name ? `in ${r.specialisation_name}` : 'in no specialisation'}.`;
  if (c.rate_ids.length && !c.rate_ids.includes(r.rate_id)) return `${c.name} is open to these rates only: ${c.rate_names}. ${who} is ${r.rate_name || 'without a rate'}.`;
  return '';
}

async function addRating(id, body, actor) {
  const sn = text(body.serviceNumber);
  if (!sn) throw validationError('Choose the rating.', { serviceNumber: 'Choose the rating.' });
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const raw = await lockOpen(id, conn);
    const c = await repo.course(raw.course_id, conn);
    const r = await repo.ratingFor(sn, conn, true);
    if (!r) throw notFound('That rating was not found.', 'RATING_NOT_FOUND');
    const fail = (message) => validationError(message, { serviceNumber: message });
    if (r.status !== 'current') throw fail(`${nameOf(r)} has left the service. Only a current rating can be added.`);
    if (await repo.findMember(id, r.service_number, conn)) throw fail(`${nameOf(r)} is already in this batch.`);
    const other = await repo.openBatchOfRating(c.id, r.service_number, conn);
    if (other) throw fail(`${nameOf(r)} is already in the open batch ${other.batch_number} for this course.`);
    const why = ineligibleReason(c, r);
    if (why) throw fail(why);
    await repo.insertMember({ batchId: id, serviceNumber: r.service_number, rateId: r.rate_id, userId: actor.userId }, conn);
    const member = await repo.findMember(id, r.service_number, conn);
    await audit.record(tx, actor, { action: 'INSERT', table: 'training_batch_ratings', recordId: `${raw.batch_number}:${r.service_number}`, after: member });
    const batch = shapeBatch(await repo.findBatch(id, conn));
    return shapeMember(await repo.memberView(id, r.service_number, conn), batch);
  });
}

async function removeRating(id, serviceNumber, actor) {
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const raw = await lockOpen(id, conn);
    const member = await repo.findMember(id, serviceNumber, conn, true);
    if (!member) throw notFound('That rating is not in this batch.', 'MEMBER_NOT_FOUND');
    await repo.deleteMember(id, serviceNumber, conn);
    await audit.record(tx, actor, { action: 'DELETE', table: 'training_batch_ratings', recordId: `${raw.batch_number}:${serviceNumber}`, before: member });
    return { serviceNumber, removed: true };
  });
}

// ---- updating the history ----------------------------------------------------------------------

/** A required or optional date from a body: { value } (null when blank) or { error }. */
function dateOf(raw, label, { required = false } = {}) {
  if (!text(raw)) return required ? { error: `Enter the ${label}.` } : { value: null };
  const p = parseIsoDate(text(raw));
  if (!p.valid || !p.value) return { error: 'Use a real date.' };
  return { value: p.value };
}

/** Attended, and a rating's own start and end date (both or neither: neither means the batch's). */
async function updateRating(id, serviceNumber, body, actor) {
  const errors = {};
  const touchesDates = 'start_date' in body || 'end_date' in body;
  const touchesAttended = 'attended' in body;
  if (!touchesDates && !touchesAttended) throw validationError('Nothing to change.', {});
  let attended = null;
  if (touchesAttended) {
    if (typeof body.attended === 'boolean') attended = body.attended;
    else if (['true', 'false', '1', '0', 1, 0].includes(body.attended)) attended = ['true', '1', 1].includes(body.attended);
    else errors.attended = 'Attended is yes or no.';
  }
  let start = { value: null };
  let end = { value: null };
  if (touchesDates) {
    start = dateOf(body.start_date, 'start date');
    end = dateOf(body.end_date, 'end date');
    if (start.error) errors.start_date = start.error;
    if (end.error) errors.end_date = end.error;
    if (!errors.start_date && !errors.end_date) {
      if (start.value && !end.value) errors.end_date = 'Enter the end date, or clear both dates to use the batch\u2019s.';
      else if (!start.value && end.value) errors.start_date = 'Enter the start date, or clear both dates to use the batch\u2019s.';
      else if (start.value && end.value && end.value < start.value) errors.end_date = 'The end date cannot be before the start date.';
      else if (end.value && end.value > fmt.todayIso()) errors.end_date = 'The end date cannot be in the future.';
    }
  }
  if (Object.keys(errors).length) throw validationError('Check the highlighted fields.', errors);

  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const raw = await lockOpen(id, conn);
    const before = await repo.findMember(id, serviceNumber, conn, true);
    if (!before) throw notFound('That rating is not in this batch.', 'MEMBER_NOT_FOUND');
    await repo.updateMember(id, serviceNumber, {
      attended: touchesAttended ? attended : !!before.attended,
      startDate: touchesDates ? start.value : before.start_date,
      endDate: touchesDates ? end.value : before.end_date,
    }, conn);
    const after = await repo.findMember(id, serviceNumber, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'training_batch_ratings', recordId: `${raw.batch_number}:${serviceNumber}`, before, after });
    const batch = shapeBatch(await repo.findBatch(id, conn));
    return shapeMember(await repo.memberView(id, serviceNumber, conn), batch);
  });
}

/**
 * Confirm Training History: the institution, the batch's start and end date and a result for every
 * rating that attended. Adds a Training entry to each attending rating's record and closes the batch.
 */
async function confirm(id, body, actor) {
  const errors = {};
  const institutionId = intOrNull(body.institution_id);
  const start = dateOf(body.start_date, 'start date', { required: true });
  const end = dateOf(body.end_date, 'end date', { required: true });
  const results = body.results && typeof body.results === 'object' ? body.results : {};
  if (!institutionId) errors.institution_id = 'Choose the institution.';
  if (start.error) errors.start_date = start.error;
  if (end.error) errors.end_date = end.error;
  const today = fmt.todayIso();
  if (!errors.start_date && start.value > today) errors.start_date = 'The start date cannot be in the future.';
  if (!errors.start_date && !errors.end_date) {
    if (end.value < start.value) errors.end_date = 'The end date cannot be before the start date.';
    else if (end.value > today) errors.end_date = 'The end date cannot be in the future. Confirm the history once the training has ended.';
  }

  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const raw = await lockOpen(id, conn);
    const c = await repo.course(raw.course_id, conn);
    const inst = institutionId ? await repo.institution(institutionId, conn) : null;
    if (institutionId && (!inst || (!inst.is_active && institutionId !== raw.institution_id))) errors.institution_id = 'Choose an institution from the list.';

    const members = (await repo.members(id, conn)).filter((m) => m.attended);
    if (!members.length) errors.attended = 'Mark at least one rating as attended. A batch with nobody attending has no history to confirm.';
    for (const m of members) {
      const result = text(results[m.service_number]);
      if (!result) errors[`results.${m.service_number}`] = `Choose ${nameOf(m)}\u2019s result.`;
      else if (!RESULTS.includes(result)) errors[`results.${m.service_number}`] = 'Choose Distinction, Credit, Pass or Fail.';
      const s = m.start_date || start.value;
      const e = m.end_date || end.value;
      if (s && e && !errors.start_date && !errors.end_date) {
        if (e < s) errors[`results.${m.service_number}`] = `${nameOf(m)}\u2019s own dates end before they start. Change the dates.`;
        else if (e > today) errors[`results.${m.service_number}`] = `${nameOf(m)}\u2019s end date is in the future. Change the dates.`;
      }
    }
    if (Object.keys(errors).length) throw validationError('Check the highlighted fields.', errors);

    for (const m of members) {
      const result = text(results[m.service_number]);
      const entryId = await repo.insertTraining({
        serviceNumber: m.service_number,
        institution: inst.name,
        institutionId: inst.id,
        courseId: c.id,
        qualification: c.name,
        classification: result,
        startDate: m.start_date || start.value,
        endDate: m.end_date || end.value,
        userId: actor.userId,
      }, conn);
      await repo.setMemberResult(id, m.service_number, { result, trainingId: entryId }, conn);
      await audit.record(tx, actor, { action: 'INSERT', table: 'rating_training', recordId: `${m.service_number}:${entryId}`, after: await repo.findTrainingRaw(entryId, conn) });
    }
    await repo.closeBatch(id, { institutionId: inst.id, startDate: start.value, endDate: end.value, userId: actor.userId }, conn);
    const after = await repo.findBatchRaw(id, conn);
    await audit.record(tx, actor, { action: 'UPDATE', table: 'training_batches', recordId: raw.batch_number, before: raw, after });
    return getBatchWith(id, conn);
  });
}

// ---- the report --------------------------------------------------------------------------------

/** The Training Draft Report of a batch: a PDF of its ratings with their previous course. */
async function batchPdf(id, printedBy) {
  const batch = await getBatch(id);
  const listed = batch.status === 'closed' ? batch.members.filter((m) => m.attended) : batch.members;
  const rows = listed.map((m) => ({
    sn: m.serviceNumber,
    name: `${String(m.surname || '').toUpperCase()} ${m.otherNames}`.trim(),
    rate: shortRate(m.rate),
    prev: m.lastCourse,
    from: m.lastCourseStart || '',
    to: m.lastCourseEnd || '',
  }));
  const buffer = await docs.batchReportPdf({ batch, rows, notListed: batch.members.length - listed.length, generatedBy: (printedBy && (printedBy.fullName || printedBy.username)) || '' });
  return { buffer, mimeType: 'application/pdf', fileName: `Training Draft Report ${batch.batchNumber}.pdf` };
}

// ---- Excel upload ---------------------------------------------------------------------------------

async function uploadTemplate() {
  const maps = await repo.lookupMaps();
  const instById = new Map(maps.institutions.map((i) => [i.id, i.name]));
  const courses = maps.courses.filter((c) => c.is_active).sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ code: c.code, name: c.name, qualification: c.qualification, institutionName: instById.get(c.institution_id) || '' }));
  const institutions = maps.institutions.filter((i) => i.is_active).sort((a, b) => a.name.localeCompare(b.name));
  return { buffer: await upload.buildTemplate({ courses, institutions }), fileName: 'CIRERMS_Training_Upload_Template.xlsx' };
}

/** Excel hands back a Date or text: YYYY-MM-DD, dd/mm/yyyy or dd-mm-yyyy. */
function cellDate(raw) {
  if (raw instanceof Date) return parseIsoDate(raw);
  const s = text(raw);
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return parseIsoDate(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  return parseIsoDate(s);
}

/** A date cell: { value } or { error }. */
function dateCell(raw, label) {
  if (!(raw instanceof Date) && !text(raw)) return { error: `Enter the ${label}.` };
  const p = cellDate(raw);
  return p.valid && p.value ? { value: p.value } : { error: 'Use a real date (YYYY-MM-DD).' };
}

const key = (v) => text(v).toLowerCase();

/**
 * Reads every row first. Returns { total, valid: [rows to import], problems: [{ row, serviceNumber, field,
 * problem, kind }] } where kind is 'error' (the row is wrong) or 'skipped' (the row is right but there is
 * nothing to add).
 */
async function analyse(buffer, conn = null) {
  const parsed = await upload.parseWorkbook(buffer);
  if (parsed.headerErrors.length) throw badRequest(parsed.headerErrors[0], 'INVALID_HEADINGS');
  if (!parsed.rows.length) throw badRequest('The workbook has no rows to read. Add one row for each Training entry under the headings.', 'EMPTY_FILE');
  if (parsed.rows.length > upload.MAX_ROWS) throw badRequest(`Use at most ${upload.MAX_ROWS} rows in one workbook.`, 'TOO_MANY_ROWS');

  const maps = await repo.lookupMaps(conn);
  const courseBy = new Map();
  const instBy = new Map();
  for (const c of maps.courses) { courseBy.set(key(c.name), c); if (c.code) courseBy.set(key(c.code), c); }
  for (const i of maps.institutions) { instBy.set(key(i.name), i); if (i.code) instBy.set(key(i.code), i); }
  const instById = new Map(maps.institutions.map((i) => [i.id, i]));
  const ratings = await repo.ratingsExist([...new Set(parsed.rows.map((r) => text(r.data.serviceNumber)).filter(Boolean))], conn);

  const today = fmt.todayIso();
  const valid = [];
  const problems = [];
  const seen = new Map();
  for (const { rowNumber, data } of parsed.rows) {
    const sn = text(data.serviceNumber);
    const bad = [];
    const add = (field, problem) => bad.push({ row: rowNumber, serviceNumber: sn, field, problem, kind: 'error' });

    const rating = sn ? ratings.get(sn.toLowerCase()) : null;
    if (!sn) add('Official No', 'Enter the Official No.');
    else if (!rating) add('Official No', 'No rating on file has this Official No.');

    const course = text(data.course) ? courseBy.get(key(data.course)) : null;
    if (!text(data.course)) add('Course', 'Enter the course.');
    else if (!course) add('Course', 'This course is not in the Training table. Use a name or code from the template.');
    else if (!course.is_active) add('Course', 'This course is no longer active.');

    let inst = null;
    if (text(data.institution)) {
      inst = instBy.get(key(data.institution)) || null;
      if (!inst) add('Institution', 'This institution is not in the Institutions table. Use a name or code from the template.');
      else if (!inst.is_active) add('Institution', 'This institution is no longer active.');
    } else if (course && course.institution_id) {
      inst = instById.get(course.institution_id) || null;
    }
    if (!text(data.institution) && course && !inst) add('Institution', 'Enter the institution: the course has none of its own.');

    const qualification = text(data.qualification);
    if (qualification.length > LIMITS.qualification) add('Qualification', `Use at most ${LIMITS.qualification} characters.`);
    const authority = text(data.authority);
    if (authority.length > LIMITS.authority) add('Authority', `Use at most ${LIMITS.authority} characters.`);

    const start = dateCell(data.startDate, 'start date');
    const end = dateCell(data.endDate, 'end date');
    const startOk = !start.error;
    const endOk = !end.error;
    if (!startOk) add('Start Date', start.error);
    if (!endOk) add('End Date', end.error);
    if (startOk && endOk) {
      if (end.value < start.value) add('End Date', 'The end date cannot be before the start date.');
      else if (end.value > today) add('End Date', 'The end date cannot be in the future.');
      if (rating && rating.date_employed && start.value < rating.date_employed) add('Start Date', `The rating joined on ${fmt.dmy(rating.date_employed)}. The training cannot start earlier.`);
    }

    if (bad.length) { problems.push(...bad); continue; }

    const dupKey = `${sn.toLowerCase()}|${course.id}|${start.value}|${end.value}`;
    if (seen.has(dupKey)) {
      problems.push({ row: rowNumber, serviceNumber: sn, field: 'Row', problem: `Repeats row ${seen.get(dupKey)}.`, kind: 'skipped' });
      continue;
    }
    seen.set(dupKey, rowNumber);
    // eslint-disable-next-line no-await-in-loop
    if (await repo.findTrainingDuplicate({ serviceNumber: rating.service_number || sn, courseId: course.id, startDate: start.value, endDate: end.value }, conn)) {
      problems.push({ row: rowNumber, serviceNumber: sn, field: 'Row', problem: 'This training is already on the rating\u2019s record.', kind: 'skipped' });
      continue;
    }
    valid.push({
      rowNumber, serviceNumber: sn, canonicalSn: rating.service_number, course, institution: inst,
      qualification: qualification || course.name, startDate: start.value, endDate: end.value, authority,
    });
  }
  problems.sort((a, b) => a.row - b.row);
  return { total: parsed.rows.length, valid, problems };
}

function countOf(problems, kind) {
  return new Set(problems.filter((p) => p.kind === kind).map((p) => p.row)).size;
}

/** Review: reads every row and writes nothing. */
async function reviewUpload(buffer) {
  const a = await analyse(buffer);
  return { total: a.total, importable: a.valid.length, skipped: countOf(a.problems, 'skipped'), errors: countOf(a.problems, 'error'), problems: a.problems };
}

/** Import: the rows that are right, in one transaction; the others are listed and left. */
async function importUpload(buffer, actor) {
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const a = await analyse(buffer, conn);
    for (const row of a.valid) {
      // eslint-disable-next-line no-await-in-loop
      const entryId = await repo.insertTraining({
        serviceNumber: row.canonicalSn, institution: row.institution.name, institutionId: row.institution.id, courseId: row.course.id,
        qualification: row.qualification, classification: null, startDate: row.startDate, endDate: row.endDate, userId: actor.userId,
      }, conn);
      const after = await repo.findTrainingRaw(entryId, conn);
      // eslint-disable-next-line no-await-in-loop
      await audit.record(tx, actor, {
        action: 'INSERT', table: 'rating_training', recordId: `${row.canonicalSn}:${entryId}`,
        after: row.authority ? { ...after, authority: row.authority } : after,
      });
    }
    return { total: a.total, imported: a.valid.length, skipped: countOf(a.problems, 'skipped'), errors: countOf(a.problems, 'error'), problems: a.problems };
  });
}

module.exports = {
  RESULTS,
  getOptions, listBatches, getBatch, eligibleCount,
  createBatch, addRatings, addRating, removeRating, updateRating, confirm, batchPdf,
  uploadTemplate, reviewUpload, importUpload,
  // for the unit checks
  ineligibleReason, cellDate, dateCell, filtersFrom,
};
