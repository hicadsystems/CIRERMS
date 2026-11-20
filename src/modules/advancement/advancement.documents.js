'use strict';

/*
 * Advancement printouts and workbooks. The PDFs are D4's templates (src/templates/printouts):
 *   advancement-form           Advancement Review, Print Form (the batch; not-recommended lines struck)
 *   advancement-batch-summary  Report on Promoted Rates, Print Batch Summary (the batches, totals)
 *   advancement-report         Report on Promoted Rates, a batch's Print Advancement Report (date advanced, or Pending)
 */
const ExcelJS = require('exceljs');
const { renderPdf } = require('../../shared/printouts');
const { dmy, isoDay, todayIso } = require('../drafting/drafting.format');

const f = (label, value, kind) => (kind ? { label, value, kind } : { label, value });
const STATUS = { open: 'Batch open for review', approved: 'Approved, ready to close', closed: 'Closed' };
const BATCH_STATUS = { open: 'Open', approved: 'Approved', closed: 'Closed' };
const ROW_STATUS = { proposed: 'Proposed', not_recommended: 'Not Recommended', awaiting_board: 'Awaiting Board', scheduled: 'Scheduled', advanced: 'Advanced' };
const BLUE = 'FF0074A8';
const PAPER = 'FFF5F7F9';

/** When the new rate took effect, as the reports print it: the date, or Pending (no date, or a date not yet reached). */
function advancedOn(x, today = todayIso()) {
  if (x.notRecommended) return '';
  if (x.status === 'advanced' && x.boardDate) return x.boardDate;
  if (x.status === 'scheduled' && x.boardDate && x.boardDate > today) return `Pending (from ${dmy(x.boardDate)})`;
  return 'Pending';
}

/** The Advancement Form: the batch facts and its ratings with months in rate, new rate and remarks. */
async function formPdf({ b, rows, generatedBy }) {
  const struck = rows.some((x) => x.notRecommended);
  return renderPdf('advancement-form', {
    title: 'ADVANCEMENT FORM',
    generatedBy,
    ref: b.batchNumber,
    subtitle: b.status === 'closed' ? `Closed under ${b.authority}` : STATUS[b.status] || '',
    facts: [
      f('Batch Number', b.batchNumber, 'code'), f('Current Rate', b.rate), f('Initiated By', b.initiatedBy),
      f('Date', isoDay(b.initiatedAt), 'date'), f('Ratings', String(b.live)),
    ],
    table: {
      columns: [
        { label: 'Official No', key: 'sn', kind: 'code', w: '10%' }, { label: 'Name', key: 'name', kind: 'name', w: '25%' },
        { label: 'Current Rate', key: 'rate', w: '11%' }, { label: 'In Rate (months)', key: 'mo', kind: 'num', w: '12%' },
        { label: 'New Rate', key: 'to', w: '16%' }, { label: 'Remarks', key: 'remark' },
      ],
      rows: rows.map((x) => ({
        sn: x.serviceNumber, name: x.name, rate: x.rateCode, mo: x.months === null || x.months === undefined ? '' : x.months,
        to: x.notRecommended ? 'NOT RECOMMENDED' : x.newRateCode, remark: x.notRecommended ? x.notRecommended.reason : x.remark, struck: !!x.notRecommended,
      })),
      empty: 'No ratings in this batch.',
    },
    note: struck ? 'Lines struck through are ratings the board did not recommend.' : '',
    signatures: [{ role: 'Personnel Officer' }, { role: 'Chief of Naval Personnel' }],
  });
}

/** Batch Summary Report for Advancement: every batch of the filters, with total and promoted. */
async function batchSummaryPdf({ items, summary, filters, generatedBy }) {
  const total = items.reduce((a, b) => a + b.live, 0);
  const done = items.reduce((a, b) => a + b.advanced, 0);
  return renderPdf('advancement-batch-summary', {
    title: 'BATCH SUMMARY REPORT FOR ADVANCEMENT',
    generatedBy,
    subtitle: `${summary.batches} ${summary.batches === 1 ? 'batch' : 'batches'}${filters ? ` · ${filters}` : ''}`,
    facts: [f('Batches', String(summary.batches)), f('Open', String(summary.open)), f('Closed', String(summary.closed))],
    table: {
      columns: [
        { label: 'Signal Code', key: 'signal', kind: 'code', w: '17%' }, { label: 'Batch Number', key: 'no', kind: 'code', w: '22%' },
        { label: 'Branch', key: 'branch', w: '16%' }, { label: 'Rate', key: 'rate', w: '7%' }, { label: 'Status', key: 'status', w: '8%' },
        { label: 'Total', key: 'total', kind: 'num', w: '7%' }, { label: 'Promoted', key: 'done', kind: 'num', w: '9%' },
        { label: 'Date Closed', key: 'closedOn', kind: 'date', w: '11%' },
      ],
      rows: items.map((b) => ({
        signal: b.authority, no: b.batchNumber, branch: b.branch, rate: b.rate === 'All' ? 'All' : b.rate, status: BATCH_STATUS[b.status] || b.status,
        total: b.live, done: b.advanced, closedOn: b.closeDate || '',
      })),
      totals: items.length ? { signal: 'Total', total, done } : null,
      empty: 'No batch matches these filters.',
    },
  });
}

/** Advancement Report: one batch's ratings, old and new rate, and the date advanced (Pending until reached). */
async function reportPdf({ b, rows, generatedBy }) {
  return renderPdf('advancement-report', {
    title: 'ADVANCEMENT REPORT',
    generatedBy,
    ref: b.batchNumber,
    subtitle: b.status === 'closed' ? 'Closed batch' : 'Open batch: no authority yet',
    facts: [
      f('Batch Number', b.batchNumber, 'code'), f('Authority', b.authority, 'code'), f('Status', BATCH_STATUS[b.status] || b.status),
      f('Rate', b.rate), f('Date Closed', b.closeDate || '', 'date'), f('Ratings', String(b.live)),
    ],
    table: {
      columns: [
        { label: 'Official No', key: 'sn', kind: 'code', w: '12%' }, { label: 'Name', key: 'name', kind: 'name', w: '30%' },
        { label: 'Old Rate', key: 'from', w: '12%' }, { label: 'New Rate', key: 'to', w: '24%' }, { label: 'Date Advanced', key: 'date', kind: 'date' },
      ],
      rows: rows.map((x) => ({
        sn: x.serviceNumber, name: x.name, from: x.rateCode,
        to: x.notRecommended ? `NOT RECOMMENDED: ${x.notRecommended.reason}` : x.newRateCode, date: advancedOn(x), struck: !!x.notRecommended,
      })),
      empty: 'No ratings in this batch.',
    },
    signatures: [{ role: 'Prepared By' }, { role: 'Director of Personnel (Navy)' }],
  });
}

function head(ws, labels) {
  const row = ws.addRow(labels);
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: PAPER } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
  });
}

/** A batch's ratings (Advancement Review and a batch of Report on Promoted Rates, Export Excel). */
async function batchWorkbook({ b, rows, generatedBy }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = generatedBy || 'CIRERMS';
  const ws = wb.addWorksheet('Advancement');
  ws.addRow([`Advancement ${b.batchNumber}`]).font = { bold: true, size: 14 };
  ws.addRow([`Branch: ${b.branch}`, `Specialisation: ${b.specialisation}`, `Rate: ${b.rate}`, `Status: ${STATUS[b.status] || b.status}`, `Authority: ${b.authority || '-'}`, `Printed: ${dmy(todayIso())}`]);
  ws.addRow([]);
  head(ws, ['Official No', 'Name', 'Sex', 'Specialisation', 'Current Rate', 'In Rate Since', 'Months in Rate', 'New Rate', 'Remarks', 'Status', 'Not Recommended Because', 'Board Approval Date']);
  rows.forEach((x) => ws.addRow([
    x.serviceNumber, x.name, x.sex, x.specialisation, x.rateCode, dmy(x.rateSince), x.months, x.newRateCode, x.remark,
    ROW_STATUS[x.status] || x.status, x.notRecommended ? x.notRecommended.reason : '', dmy(x.boardDate),
  ]));
  [12, 30, 8, 22, 10, 13, 10, 10, 30, 16, 30, 14].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** The live rows of the open batches by department (Approval and Close, Export Excel). */
async function departmentsWorkbook({ rows, department, generatedBy }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = generatedBy || 'CIRERMS';
  const ws = wb.addWorksheet('Advancement by Department');
  ws.addRow(['Advancement by Department']).font = { bold: true, size: 14 };
  ws.addRow([`Department: ${department}`, `Ratings: ${rows.length}`, `Printed: ${dmy(todayIso())}`]);
  ws.addRow([]);
  head(ws, ['Department', 'Batch Number', 'Official No', 'Name', 'Sex', 'Current Rate', 'In Rate Since', 'Months in Rate', 'New Rate', 'Remarks', 'Approved By']);
  rows.slice().sort((a, b) => a.specialisation.localeCompare(b.specialisation)).forEach((x) => ws.addRow([
    x.specialisation, x.batchNumber, x.serviceNumber, x.name, x.sex, x.rateCode, dmy(x.rateSince), x.months, x.newRateCode, x.remark,
    x.approval ? `${x.approval.rank} ${x.approval.name}` : '',
  ]));
  [24, 24, 12, 30, 8, 10, 13, 10, 10, 30, 26].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Report on Promoted Rates, Export Excel: the batches of the filters. */
async function reportWorkbook({ items, generatedBy }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = generatedBy || 'CIRERMS';
  const ws = wb.addWorksheet('Promoted Rates');
  ws.addRow(['Report on Promoted Rates']).font = { bold: true, size: 14 };
  ws.addRow([`Batches: ${items.length}`, `Printed: ${dmy(todayIso())}`]);
  ws.addRow([]);
  head(ws, ['Signal Code', 'Batch Number', 'Branch', 'Specialisation', 'Rate', 'Status', 'Total', 'Promoted', 'Scheduled', 'Awaiting Board', 'Not Recommended', 'Initiated', 'Initiated By', 'Date Closed', 'Closed By']);
  items.forEach((b) => ws.addRow([
    b.authority, b.batchNumber, b.branch, b.specialisation, b.rate, BATCH_STATUS[b.status] || b.status, b.live, b.advanced, b.scheduled, b.awaiting, b.notRecommended,
    dmy(b.initiatedAt), b.initiatedBy, dmy(b.closeDate), b.closedBy,
  ]));
  [22, 26, 18, 22, 22, 10, 8, 10, 10, 14, 16, 12, 26, 12, 26].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { formPdf, batchSummaryPdf, reportPdf, batchWorkbook, departmentsWorkbook, reportWorkbook, advancedOn };
