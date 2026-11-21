'use strict';

/*
 * Upload Draft (moved here from Drafting by the owner; PLAN 9e decision 4; docs/legacy/drafting.md section 6).
 * One row per special draft, keyed by official number:
 *
 *   Official No | Drafted To | Authority | WEF | Posting Type | Deployment/Vice | Remark
 *
 * The whole file is read and every row checked before anything is written (check); importing runs the same checks
 * again inside one transaction and adds the ready rows as drafts not yet printed (a draft moves nothing until its form
 * is printed). A row is an error when the official number is not on the roll or has left, the ship is not in the
 * Ships table (Static Tables) or is not active, the posting type is not Complement, Vice, TY or DW, the date is not
 * a date, is more than a year ahead or is not after the day the rating joined its ship, the authority is empty, or a
 * Vice draft has no Deployment/Vice. A rating that already has a draft not finished, or that appears twice in the
 * file, is skipped. The old Draft6 sheet (SER, Svc_No, Present_Ship ...) is refused with a message that says so.
 */
const ExcelJS = require('exceljs');
const db = require('../../db');
const audit = require('../../shared/audit');
const { badRequest } = require('../../shared/errors');
const { parseIsoDate } = require('../../shared/dates');
const { dmy, todayIso } = require('../drafting/drafting.format');
const service = require('./special-drafting.service');
const repo = require('./special-drafting.repo');

const COLUMNS = [
  { key: 'sn', header: 'Official No', width: 16 },
  { key: 'draftedTo', header: 'Drafted To', width: 26 },
  { key: 'authority', header: 'Authority', width: 28 },
  { key: 'wef', header: 'WEF', width: 14 },
  { key: 'postingType', header: 'Posting Type', width: 16 },
  { key: 'vice', header: 'Deployment/Vice', width: 28 },
  { key: 'remark', header: 'Remark', width: 34 },
];
const OLD_SHEET = ['svc_no', 'present_ship', 'doj'];
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
  if (OLD_SHEET.every((k) => head[k]) || (head.ser && head.svc_no)) {
    throw badRequest('This is the old Draft6 sheet (SER, Name, Rate, Svc_No, Present_Ship ...), which is no longer used. Download the template: it needs only Official No, Drafted To, Authority, WEF, Posting Type, Deployment/Vice and Remark.', 'WORKBOOK_OLD_FORMAT');
  }
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

const FIELD_HEADER = { serviceNumber: 'Official No', postingType: 'Posting Type', shipId: 'Drafted To', authority: 'Authority', wef: 'WEF', vice: 'Deployment/Vice', remark: 'Remark' };

/** Checks every row against the database and the rows above it; returns the ready rows and the issues. */
async function review(rows, conn = null) {
  const today = todayIso();
  const shipList = await repo.ships(conn);
  const shipOf = (t) => { const k = norm(t); return k ? shipList.find((s) => norm(s.name) === k) || null : null; };
  const sns = [...new Set(rows.map((x) => x.sn.toUpperCase()).filter(Boolean))];
  const found = new Map((await repo.ratingsForUpload(sns, today, conn)).map((r) => [r.service_number.toUpperCase(), r]));
  const open = new Map((await repo.openDraftsOf(sns, conn)).map((d) => [d.service_number.toUpperCase(), d]));
  const seen = new Set();
  const ready = [];
  const issues = [];

  for (const x of rows) {
    const sn = x.sn.toUpperCase();
    const issue = (field, problem, result = 'error') => issues.push({ row: x.row, serviceNumber: x.sn || '', field, problem, result });
    if (!sn) { issue('Official No', 'The official number is empty'); continue; }
    const rating = found.get(sn);
    if (!rating) { issue('Official No', `${x.sn} is not on the roll`); continue; }
    if (rating.status !== 'current') { issue('Official No', `${rating.service_number} has left the service`); continue; }
    if (open.has(sn)) { issue('Duplicate', `${rating.service_number} already has a special draft ${open.get(sn).status === 'scheduled' ? 'whose move is still to come' : 'not yet printed'}`, 'skipped'); continue; }

    const postingType = service.postingTypeOf(x.postingType);
    if (!x.postingType) { issue('Posting Type', 'The posting type is empty'); continue; }
    if (!postingType) { issue('Posting Type', `"${x.postingType}" is not a posting type (Complement, Vice, TY or DW)`); continue; }
    if (!x.draftedTo) { issue('Drafted To', 'Drafted To is empty'); continue; }
    const ship = shipOf(x.draftedTo);
    if (!ship) { issue('Drafted To', `"${x.draftedTo}" is not a ship or unit in Static Tables (Ships)`); continue; }
    let wef = '';
    if (x.wef) {
      wef = dateOf(x.wef);
      if (!wef) { issue('WEF', `${x.wef} is not a date`); continue; }
    }
    const input = { serviceNumber: sn, postingType, shipId: ship.id, authority: x.authority, wef: wef || '', vice: x.vice, remark: x.remark };
    const card = { ...rating, rate_name: '', rate_code: '' };
    const problem = service.problemsWith(input, { card, ship, today })[0];
    if (problem) { issue(FIELD_HEADER[problem.field] || problem.field, problem.message); continue; }

    if (seen.has(sn)) { issue('Duplicate', `${rating.service_number} appears more than once in the file; only the first row is imported`, 'skipped'); continue; }
    seen.add(sn);
    ready.push({
      row: x.row, serviceNumber: rating.service_number, shipId: ship.id, draftedTo: ship.name, authority: x.authority, wef, postingType, vice: x.vice, remark: x.remark,
      rateId: rating.rate_id, currentShipId: rating.current_ship_id, joinedOn: rating.joined_on, months: rating.months === null || rating.months === undefined ? null : Number(rating.months),
    });
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
    // the ratings are locked first, so a draft made in the meantime is seen by the check below
    await repo.lockRatings([...new Set(rows.map((x) => x.sn.toUpperCase()).filter(Boolean))], conn);
    const r = await review(rows, conn);
    const added = [];
    for (const x of r.ready) {
      const id = await repo.insertDraft({ ...x, source: 'upload', fileName: String(fileName || '').slice(0, 255), sheetRow: x.row, userId: actor.userId }, conn);
      await audit.record(tx, actor, { action: 'INSERT', table: 'special_drafts', recordId: `${x.serviceNumber}:${id}`, after: await repo.draftRaw(id, conn) });
      added.push({ row: x.row, serviceNumber: x.serviceNumber, draftedTo: x.draftedTo, wef: x.wef });
    }
    return { ...summary(rows, r), imported: r.ready.length, drafts: added };
  });
}

function styleHead(row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: PAPER } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
  });
}

async function template() {
  const shipList = await repo.ships();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CIRERMS';
  const ws = wb.addWorksheet('Special Drafts');
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  styleHead(ws.getRow(1));
  ws.getColumn(4).numFmt = 'dd/mm/yyyy';
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  const info = wb.addWorksheet('Instructions');
  info.columns = [{ width: 22 }, { width: 90 }];
  [
    ['Official No', 'Required. The rating\'s official number, as on the roll (a current rating).'],
    ['Drafted To', 'Required. The ship or unit, written as in the Ships sheet.'],
    ['Authority', 'Required. The signal that authorises the draft (up to 150 characters).'],
    ['WEF', 'Required. dd/mm/yyyy: the day the rating moves. After the day the rating joined its ship, and not more than a year ahead.'],
    ['Posting Type', 'Required. Complement, Vice, TY or DW.'],
    ['Deployment/Vice', 'Required when the posting type is Vice (up to 150 characters); optional otherwise.'],
    ['Remark', 'Optional (up to 250 characters).'],
    ['', 'A rating that already has a special draft not yet printed, or that is in the file twice, is skipped. Rows with errors are listed and not imported; the rest are imported together as drafts not yet printed.'],
  ].forEach((r) => info.addRow(r));
  info.getColumn(1).font = { bold: true };
  const sh = wb.addWorksheet('Ships');
  sh.columns = [{ header: 'Ship or Unit', width: 40 }];
  styleHead(sh.getRow(1));
  shipList.filter((s) => s.is_active).forEach((s) => sh.addRow([s.name]));
  const pt = wb.addWorksheet('Posting Types');
  pt.columns = [{ header: 'Posting Type', width: 20 }];
  styleHead(pt.getRow(1));
  service.POSTING_TYPES.forEach((t) => pt.addRow([t.code]));
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

module.exports = { COLUMNS, readWorkbook, review, check, importFile, template, errorsWorkbook, dateOf, dmy };
