'use strict';

const ExcelJS = require('exceljs');
const db = require('../../db');
const audit = require('../../shared/audit');
const { badRequest, validationError } = require('../../shared/errors');
const { parseIsoDate } = require('../../shared/dates');
const scheduled = require('../../shared/scheduled');
const repo = require('./discharge.repo');

const COLUMNS = [
  { key: 'sn', header: 'Official No' },
  { key: 'exitType', header: 'Exit Type' },
  { key: 'exitDate', header: 'Exit Date' },
  { key: 'authority', header: 'Authority' },
  { key: 'approvedBy', header: 'Approved By' },
  { key: 'comment', header: 'Comment' },
];
const norm = (v) => String(v || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const cellText = (v) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, '0')}-${String(v.getUTCDate()).padStart(2, '0')}`;
  if (typeof v === 'object') {
    if (v.result !== undefined) return cellText(v.result);
    if (v.text !== undefined) return cellText(v.text);
    if (Array.isArray(v.richText)) return v.richText.map((x) => x.text).join('');
  }
  return String(v).trim();
};

async function template() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CIRERMS';
  const ws = wb.addWorksheet('Upload Discharge');
  ws.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.key === 'comment' ? 36 : 24 }));
  ws.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0074A8' } }; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName: 'Upload Discharge.xlsx', buffer: Buffer.from(await wb.xlsx.writeBuffer()) };
}

async function read(buffer) {
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buffer); } catch (_) { throw badRequest('The workbook could not be read.', 'WORKBOOK_UNREADABLE'); }
  const ws = wb.worksheets[0];
  if (!ws) throw badRequest('The workbook has no sheet.', 'WORKBOOK_EMPTY');
  const head = {};
  ws.getRow(1).eachCell({ includeEmpty: false }, (c, col) => { head[norm(cellText(c.value))] = col; });
  for (const c of COLUMNS) if (!head[norm(c.header)]) throw badRequest(`Column "${c.header}" was not found in row 1.`, 'WORKBOOK_HEADINGS');
  const rows = [];
  for (let i = 2; i <= ws.rowCount; i += 1) {
    const x = { row: i };
    for (const c of COLUMNS) x[c.key] = cellText(ws.getRow(i).getCell(head[norm(c.header)]).value);
    if (COLUMNS.every((c) => !x[c.key])) continue;
    rows.push(x);
  }
  return rows;
}

async function review(rows, conn) {
  const types = (await repo.options()).exitTypes;
  const ready = [];
  const issues = [];
  for (const x of rows) {
    const issue = (field, problem, result = 'error') => issues.push({ row: x.row, serviceNumber: x.sn, field, problem, result });
    const sn = x.sn.toUpperCase();
    if (!sn) { issue('Official No', 'The official number is empty'); continue; }
    const rating = await repo.ratingBasic(sn, conn);
    if (!rating) { issue('Official No', `${sn} is not on the roll`); continue; }
    if (rating.status !== 'current') { issue('Official No', `${sn} has already left the service`, 'skipped'); continue; }
    const existing = await db.query("SELECT id FROM discharge_rows WHERE service_number=? AND status IN ('pending','scheduled','closed') LIMIT 1", [sn], conn);
    if (existing.length) { issue('Official No', `${sn} is already in a proposal or has been discharged`, 'skipped'); continue; }
    const type = types.find((t) => norm(t.code) === norm(x.exitType) || norm(t.name) === norm(x.exitType));
    if (!type) { issue('Exit Type', `"${x.exitType}" is not an exit type in the table`); continue; }
    let iso = null;
    let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(x.exitDate);
    if (m) iso = x.exitDate;
    m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(x.exitDate);
    if (m) iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const p = iso ? parseIsoDate(iso) : { valid: false };
    if (!p.valid) { issue('Exit Date', 'Enter a real exit date'); continue; }
    if (rating.date_employed && p.value < String(rating.date_employed).slice(0, 10)) { issue('Exit Date', 'The exit date is before the date the rating joined'); continue; }
    if (x.comment.length > 500) { issue('Comment', 'Use at most 500 characters'); continue; }
    ready.push({ row: x.row, serviceNumber: sn, exitTypeId: type.id, exitDate: p.value, exitReason: type.name, authority: x.authority, approvedBy: x.approvedBy, comment: x.comment });
  }
  return { ready, issues };
}

async function check(buffer) {
  const rows = await read(buffer);
  const r = await review(rows, null);
  return { totalRows: rows.length, ready: r.ready.length, skipped: r.issues.filter((x) => x.result === 'skipped').length, errors: r.issues.filter((x) => x.result === 'error').length, issues: r.issues };
}

async function importFile(buffer, fileName, actor) {
  const rows = await read(buffer);
  return db.transaction(async (tx) => {
    const r = await review(rows, tx.connection);
    let imported = 0;
    let closed = 0;
    let scheduledCount = 0;
    for (const x of r.ready) {
      const number = await repo.nextProposalNumber(new Date().getFullYear(), tx.connection);
      const proposalId = await repo.insertProposal(number, actor.userId, tx.connection);
      const rowId = await repo.insertRow(proposalId, x.serviceNumber, actor.userId, tx.connection);
      const before = await repo.rowRaw(rowId, tx.connection);
      const details = {
        exitTypeId: x.exitTypeId, exitDate: x.exitDate, exitReason: x.exitReason, approvedBy: x.approvedBy, comment: x.comment,
        deathCertificate: false, condolenceLetter: false, dependentFundEvidence: false, swornAffidavit: false,
      };
      if (x.exitDate > scheduled.todayIso()) {
        await repo.updateRow(rowId, { ...details, status: 'scheduled', closedBy: null, closedAt: null }, tx.connection);
        const scheduledId = await scheduled.schedule(tx, actor, {
          kind: 'discharge', serviceNumber: x.serviceNumber, effectiveDate: x.exitDate,
          payload: details, source: { table: 'discharge_rows', id: rowId },
        });
        await repo.setScheduled(rowId, scheduledId, tx.connection);
        scheduledCount += 1;
      } else {
        await repo.updateRow(rowId, { ...details, status: 'closed', closedBy: actor.userId, closedAt: new Date() }, tx.connection);
        await repo.applyExit(x.serviceNumber, details, tx.connection);
        closed += 1;
      }
      await audit.record(tx, actor, {
        action: 'UPDATE', table: 'discharge_rows', recordId: `${proposalId}:${x.serviceNumber}`,
        before, after: await repo.rowRaw(rowId, tx.connection),
      });
      const uploadId = await repo.insertUpload({ fileName, row: x.row, serviceNumber: x.serviceNumber, exitTypeId: x.exitTypeId, exitDate: x.exitDate, authority: x.authority, approvedBy: x.approvedBy, comment: x.comment, proposalId, rowId, userId: actor.userId }, tx.connection);
      await audit.record(tx, actor, { action: 'INSERT', table: 'discharge_uploads', recordId: `${x.serviceNumber}:${uploadId}`, after: await repo.uploadRaw(uploadId, tx.connection) });
      imported += 1;
    }
    return {
      totalRows: rows.length, imported, closed, scheduled: scheduledCount,
      skipped: r.issues.filter((x) => x.result === 'skipped').length,
      errors: r.issues.filter((x) => x.result === 'error').length, issues: r.issues,
    };
  });
}

module.exports = { template, check, importFile };
