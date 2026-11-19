'use strict';

/*
 * Upload Advanced Rates: past advancements from a workbook (docs/legacy/advancement.md section 7; the design's
 * template). One row per advancement, keyed by official number:
 *
 *   Official No | Old Rate | New Rate | Effective Date | Authority | Decoration | Remark
 *
 * The whole file is read and every row checked before anything is written (check); importing runs the
 * same checks again inside one transaction and applies the ready rows in order through the rate change
 * (rates.service: the rating's rate and its Advancement line). A row is an error when the official number is
 * not on the roll or has left, a rate is not in the Rates table, the old rate is not the rating's rate on
 * record (after the rows above it in the file), the new rate is not above the old one, the date is empty,
 * not a date, in the future or before the rating joined the old rate, or the rating has an advancement not
 * yet finished (a batch or a scheduled change). The same promotion twice (rating, new rate and date already
 * on the record, or twice in the file) is skipped. Rates are written by code (OS, AB, ...) or name.
 */
const ExcelJS = require('exceljs');
const db = require('../../db');
const audit = require('../../shared/audit');
const { badRequest } = require('../../shared/errors');
const { parseIsoDate } = require('../../shared/dates');
const { dmy, todayIso } = require('../drafting/drafting.format');
const rates = require('./rates.service');
const repo = require('./advancement.repo');

const COLUMNS = [
  { key: 'sn', header: 'Official No', width: 16 },
  { key: 'oldRate', header: 'Old Rate', width: 14 },
  { key: 'newRate', header: 'New Rate', width: 14 },
  { key: 'date', header: 'Effective Date', width: 16 },
  { key: 'authority', header: 'Authority', width: 26 },
  { key: 'decoration', header: 'Decoration', width: 26 },
  { key: 'remark', header: 'Remark', width: 34 },
];
const MAX_ROWS = 2000;
const BLUE = 'FF0074A8';
const PAPER = 'FFF5F7F9';

const norm = (s) => String(s || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const pad = (n) => String(n).padStart(2, '0');

/** A cell's value as text; a date cell as YYYY-MM-DD. */
function cellText(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  if (typeof v === 'object') {
    if (v.result !== undefined) return cellText(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('').trim();
    if (v.text !== undefined) return cellText(v.text);
    return '';
  }
  return String(v).trim();
}

/** dd/mm/yyyy, d/m/yyyy or YYYY-MM-DD as YYYY-MM-DD; null when it is not a date. */
function dateOf(raw) {
  const s = String(raw || '').trim();
  let iso = null;
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) iso = `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) iso = s;
  if (!iso) return null;
  const p = parseIsoDate(iso);
  return p.valid && p.value ? p.value : null;
}

/** Reads the first sheet: its headings in row 1 and every row under them. Refuses a workbook it cannot use. */
async function readWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buffer); } catch (_) {
    throw badRequest('The file could not be read as an Excel workbook. Save it as .xlsx and choose it again.', 'WORKBOOK_UNREADABLE');
  }
  const ws = wb.worksheets[0];
  if (!ws) throw badRequest('The workbook has no sheet.', 'WORKBOOK_EMPTY');
  const head = {};
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => { head[norm(cellText(cell.value))] = col; });
  for (const c of COLUMNS) {
    if (!head[norm(c.header)]) throw badRequest(`Column "${c.header}" was not found in row 1. Download the template and copy the rows into it.`, 'WORKBOOK_HEADINGS');
  }
  const rows = [];
  for (let i = 2; i <= ws.rowCount; i += 1) {
    const row = ws.getRow(i);
    const x = { row: i };
    for (const c of COLUMNS) x[c.key] = cellText(row.getCell(head[norm(c.header)]).value);
    if (COLUMNS.every((c) => !x[c.key])) continue;
    rows.push(x);
    if (rows.length > MAX_ROWS) throw badRequest(`The workbook has more than ${MAX_ROWS} rows. Split it into smaller files.`, 'WORKBOOK_TOO_LARGE');
  }
  if (!rows.length) throw badRequest('The workbook has no rows under the headings. Add the rows and choose the file again.', 'WORKBOOK_EMPTY');
  return rows;
}

/** Checks every row against the database and the rows above it; returns the ready rows and the issues. */
async function review(rows, conn = null) {
  const today = todayIso();
  const rateList = await repo.rates(conn);
  const rateOf = (t) => {
    const k = norm(t);
    return k ? rateList.find((r) => norm(r.code) === k || norm(r.name) === k) || null : null;
  };
  const sns = [...new Set(rows.map((x) => x.sn.toUpperCase()).filter(Boolean))];
  const found = new Map((await repo.ratingsForUpload(sns, conn)).map((r) => [r.service_number.toUpperCase(), r]));
  const lines = await repo.advancementLines(sns, conn);
  const state = new Map();
  const seen = new Set();
  const ready = [];
  const issues = [];
  const code = (r) => (r ? r.code || r.name : '');

  for (const x of rows) {
    const sn = x.sn.toUpperCase();
    const issue = (field, problem, result = 'error') => issues.push({ row: x.row, serviceNumber: x.sn || '', field, problem, result });
    if (!sn) { issue('Official No', 'The official number is empty'); continue; }
    const rating = found.get(sn);
    if (!rating) { issue('Official No', `${x.sn} is not on the roll`); continue; }
    if (rating.status !== 'current') { issue('Official No', `${rating.service_number} has left the service`); continue; }
    const oldRate = rateOf(x.oldRate);
    const newRate = rateOf(x.newRate);
    if (!x.oldRate) { issue('Old Rate', 'The old rate is empty'); continue; }
    if (!oldRate) { issue('Old Rate', `"${x.oldRate}" is not a rate in the Rates table`); continue; }
    if (!x.newRate) { issue('New Rate', 'The new rate is empty'); continue; }
    if (!newRate) { issue('New Rate', `"${x.newRate}" is not a rate in the Rates table`); continue; }
    if (!x.date) { issue('Effective Date', 'The effective date is empty'); continue; }
    const date = dateOf(x.date);
    if (!date) { issue('Effective Date', `${x.date} is not a date`); continue; }
    if (date > today) { issue('Effective Date', `${dmy(date)} is in the future; only past advancements are uploaded`); continue; }
    if (x.authority.length > 150) { issue('Authority', 'The authority is longer than 150 characters'); continue; }
    if (x.decoration.length > 150) { issue('Decoration', 'The decoration is longer than 150 characters'); continue; }
    if (x.remark.length > 250) { issue('Remark', 'The remark is longer than 250 characters'); continue; }

    const key = `${sn}|${newRate.id}|${date}`;
    const onRecord = lines.some((l) => l.service_number.toUpperCase() === sn && l.rate_id === newRate.id && l.start_date === date);
    if (onRecord || seen.has(key)) { issue('Duplicate', `${rating.service_number} was already advanced to ${code(newRate)} on ${dmy(date)}`, 'skipped'); continue; }

    if (!state.has(sn)) {
      const open = lines.filter((l) => l.service_number.toUpperCase() === sn && !l.end_date && l.start_date).map((l) => l.start_date).sort();
      state.set(sn, { rateId: rating.rate_id, since: rating.rate_since || '', openStart: open.length ? open[open.length - 1] : '' });
    }
    const st = state.get(sn);
    const cur = rateList.find((r) => r.id === st.rateId);
    if (oldRate.id !== st.rateId) { issue('Old Rate', `Old Rate ${code(oldRate)} does not match the rating's rate on record (${code(cur) || 'none'})`); continue; }
    if (newRate.sort_order <= oldRate.sort_order) { issue('New Rate', 'New Rate must be above the old rate'); continue; }
    if ((st.since && date < st.since) || (st.openStart && date <= st.openStart)) {
      issue('Effective Date', `${dmy(date)} is before the rating joined ${code(oldRate)} (${dmy(st.openStart || st.since)})`); continue;
    }
    if (rating.in_batch) { issue('Official No', `${rating.service_number} is in advancement batch ${rating.in_batch}, which is not finished`); continue; }
    if (rating.scheduled_on) { issue('Official No', `${rating.service_number} has an advancement scheduled for ${dmy(rating.scheduled_on)}`); continue; }

    seen.add(key);
    st.rateId = newRate.id; st.since = date; st.openStart = date;
    ready.push({ row: x.row, serviceNumber: rating.service_number, oldRateId: oldRate.id, newRateId: newRate.id, newRate: code(newRate), date, authority: x.authority, decoration: x.decoration, remark: x.remark });
  }
  return { ready, issues };
}

const summary = (rows, r) => ({
  totalRows: rows.length, ready: r.ready.length,
  skipped: r.issues.filter((i) => i.result === 'skipped').length, errors: r.issues.filter((i) => i.result === 'error').length,
  issues: r.issues.sort((a, b) => a.row - b.row),
});

async function check(buffer) {
  const rows = await readWorkbook(buffer);
  return summary(rows, await review(rows));
}

async function importFile(buffer, fileName, actor) {
  const rows = await readWorkbook(buffer);
  return db.transaction(async (tx) => {
    const conn = tx.connection;
    const r = await review(rows, conn);
    for (const x of r.ready) {
      const done = await rates.applyNow(tx, actor, { serviceNumber: x.serviceNumber, fromRateId: x.oldRateId, toRateId: x.newRateId, date: x.date, authority: x.authority, decoration: x.decoration });
      const id = await repo.insertUpload({ ...x, fileName: String(fileName || '').slice(0, 255), advancementId: done.advancementId, userId: actor.userId }, conn);
      await audit.record(tx, actor, { action: 'INSERT', table: 'advancement_uploads', recordId: `${x.serviceNumber}:${id}`, after: await repo.uploadRaw(id, conn) });
    }
    return { ...summary(rows, r), imported: r.ready.length, advanced: r.ready.map((x) => ({ row: x.row, serviceNumber: x.serviceNumber, rate: x.newRate, date: x.date })) };
  });
}

function styleHead(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: PAPER } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
  });
}

async function template() {
  const rateList = await repo.rates();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CIRERMS';
  const ws = wb.addWorksheet('Advancements');
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  styleHead(ws.getRow(1));
  ws.getColumn(4).numFmt = 'dd/mm/yyyy';
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  const info = wb.addWorksheet('Instructions');
  info.columns = [{ width: 22 }, { width: 90 }];
  [
    ['Official No', 'Required. The rating\'s official number, as on the roll.'],
    ['Old Rate', 'Required. The rating\'s rate before this advancement: the rate on record (or the new rate of a row above it).'],
    ['New Rate', 'Required. A rate above the old rate.'],
    ['Effective Date', 'Required. dd/mm/yyyy, today or earlier, not before the rating joined the old rate.'],
    ['Authority', 'Optional. The signal or board reference (up to 150 characters).'],
    ['Decoration', 'Optional (up to 150 characters).'],
    ['Remark', 'Optional (up to 250 characters).'],
    ['', 'The same advancement twice is skipped. Rows with errors are listed and not imported; the rest are imported together.'],
  ].forEach((r) => info.addRow(r));
  info.getColumn(1).font = { bold: true };
  const rs = wb.addWorksheet('Rates');
  rs.columns = [{ header: 'Code', width: 10 }, { header: 'Rate', width: 34 }];
  styleHead(rs.getRow(1));
  rateList.forEach((r) => rs.addRow([r.code || '', r.name]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

async function errorsWorkbook(result) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CIRERMS';
  const ws = wb.addWorksheet('Rows Not Ready');
  ws.columns = [{ header: 'Row', width: 8 }, { header: 'Official No', width: 14 }, { header: 'Field', width: 16 }, { header: 'Result', width: 10 }, { header: 'Problem', width: 70 }];
  styleHead(ws.getRow(1));
  result.issues.forEach((i) => ws.addRow([i.row, i.serviceNumber, i.field, i.result === 'error' ? 'Error' : 'Skipped', i.problem]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { COLUMNS, readWorkbook, review, check, importFile, template, errorsWorkbook, dateOf };
