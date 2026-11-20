'use strict';

/*
 * Drafting report printouts and workbooks (WP7b). The PDFs are D4's templates (src/templates/printouts):
 *   draft-batch-summary   Batch/Signal Content, Print Summary
 *   draft-report-batch    Batch/Signal Content, one batch, Print Draft Report
 *   draft-history         Rate DOD History, Print PDF (one rating, portrait; everyone, landscape)
 *   draft-report-all      Draft Report, Print Report
 * The workbooks fix the old Excel's faults: the header is spelled right, the WEF column holds the WEF and the
 * vice column holds the vice.
 */
const ExcelJS = require('exceljs');
const { renderPdf } = require('../../shared/printouts');
const { dmy, todayIso } = require('./drafting.format');
const { STATUS_TEXT, ROW_STATE } = require('./reports.service');

const f = (label, value, kind) => (kind ? { label, value, kind } : { label, value });
const sexLetter = (g) => (g ? String(g)[0].toUpperCase() : '');
const BLUE = 'FF0074A8';
const PAPER = 'FFF5F7F9';

/** A DATE or DATETIME as YYYY-MM-DD for a fact or cell of kind date. */
const iso = (v) => { const s = dmy(v); return s ? `${s.slice(6)}-${s.slice(3, 5)}-${s.slice(0, 2)}` : ''; };

/** What the "Date Reported" column says: the date, or what is still to come. */
function reportedText(x) {
  if (x.status === 'reported') return iso(x.wef);
  if (x.status === 'scheduled') return `Scheduled ${dmy(x.wef)}`;
  if (x.status === 'not_recommended') return '';
  return 'Pending';
}

function sheet(wb, name, title, line, headers, widths) {
  const ws = wb.addWorksheet(name);
  ws.addRow([title]).font = { bold: true, size: 14 };
  ws.addRow(line);
  ws.addRow([]);
  const head = ws.addRow(headers);
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: PAPER } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
  });
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  return ws;
}

// ---- Batch/Signal Content: the list -------------------------------------------------------------------------------

async function summaryPdf({ items, summary, filtered, generatedBy }) {
  return renderPdf('draft-batch-summary', {
    title: 'DRAFT BATCH SUMMARY',
    generatedBy,
    subtitle: `${summary.batches} ${summary.batches === 1 ? 'batch' : 'batches'}${filtered.length ? ` (filtered: ${filtered.join(', ')})` : ''}`,
    facts: [f('Batches', String(summary.batches)), f('Open', String(summary.open)), f('Closed', String(summary.closed))],
    table: {
      columns: [
        { label: 'Signal Code', key: 'signal', kind: 'code', w: '17%' }, { label: 'Batch Number', key: 'no', kind: 'code', w: '22%' },
        { label: 'Branch', key: 'branch', w: '16%' }, { label: 'Rate', key: 'rate', w: '7%' }, { label: 'Status', key: 'status', w: '8%' },
        { label: 'Total', key: 'total', kind: 'num', w: '7%' }, { label: 'Reported', key: 'done', kind: 'num', w: '9%' },
        { label: 'Date Closed', key: 'closedOn', kind: 'date', w: '11%' },
      ],
      rows: items.map((b) => ({
        signal: b.authority, no: b.batchNumber, branch: b.branch, rate: b.rate === 'All' ? 'All' : b.rateCode, status: STATUS_TEXT[b.status] || b.status,
        total: b.total, done: b.reported, closedOn: iso(b.closeDate),
      })),
      totals: items.length ? { signal: 'Total', total: items.reduce((a, b) => a + b.total, 0), done: items.reduce((a, b) => a + b.reported, 0) } : null,
      empty: 'No batch matches the filters.',
    },
  });
}

async function summaryWorkbook({ items, generatedBy }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = generatedBy || 'CIRERMS';
  const ws = sheet(wb, 'Batches', 'Draft Batch Summary', [`Batches: ${items.length}`, `Printed: ${dmy(todayIso())}`],
    ['Signal Code', 'Batch Number', 'Branch', 'Specialisation', 'Rate', 'Status', 'Total', 'Reported', 'Not Reported', 'Not Recommended', 'Initiated By', 'Date Initiated', 'Closed By', 'Date Closed'],
    [26, 26, 18, 22, 8, 12, 8, 10, 12, 16, 26, 14, 26, 14]);
  items.forEach((b) => ws.addRow([
    b.authority, b.batchNumber, b.branch, b.specialisation, b.rate === 'All' ? 'All' : b.rateCode, STATUS_TEXT[b.status] || b.status,
    b.total, b.reported, b.notReported, b.notRecommended, b.initiatedBy, dmy(b.initiatedAt), b.closedBy, dmy(b.closeDate),
  ]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---- Batch/Signal Content: one batch -----------------------------------------------------------------------------

async function batchPdf({ b, rows, generatedBy }) {
  const struck = rows.some((x) => x.status === 'not_recommended');
  return renderPdf('draft-report-batch', {
    title: 'DRAFT REPORT',
    generatedBy,
    ref: b.batchNumber,
    subtitle: b.status === 'closed' ? 'Closed batch' : 'Open batch: no authority yet',
    facts: [
      f('Batch Number', b.batchNumber, 'code'), f('Authority', b.authority, 'code'), f('Status', STATUS_TEXT[b.status] || b.status),
      f('Branch', b.branch), f('Date Closed', iso(b.closeDate), 'date'), f('Ratings', String(b.total)),
    ],
    table: {
      dense: true,
      columns: [
        { label: 'Official No', key: 'sn', kind: 'code', w: '9%' }, { label: 'Name', key: 'name', kind: 'name', w: '22%' }, { label: 'Rate', key: 'rate', w: '7%' },
        { label: 'Old Ship', key: 'from', w: '14%' }, { label: 'New Ship', key: 'to', w: '14%' }, { label: 'Vice / Deployment', key: 'vice', w: '18%' },
        { label: 'Date Reported', key: 'wef', kind: 'date', w: '11%' },
      ],
      rows: rows.map((x) => ({
        sn: x.serviceNumber, name: x.name, rate: x.rateCode, from: x.oldShip,
        to: x.status === 'not_recommended' ? `NOT RECOMMENDED: ${x.notRecommendedReason}` : x.newShip,
        vice: x.vice, wef: reportedText(x), struck: x.status === 'not_recommended',
      })),
      empty: 'No ratings match.',
    },
    note: struck ? 'Lines struck through are ratings the drafting officer did not recommend.' : '',
    signatures: [{ role: 'Drafting Officer' }, { role: 'Director of Personnel (Navy)' }],
  });
}

async function batchWorkbook({ b, rows, generatedBy }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = generatedBy || 'CIRERMS';
  const ws = sheet(wb, 'Batch', `Draft Report ${b.batchNumber}`,
    [`Authority: ${b.authority || 'none yet'}`, `Branch: ${b.branch}`, `Status: ${STATUS_TEXT[b.status] || b.status}`, `Printed: ${dmy(todayIso())}`],
    ['Official Number', 'Name', 'Rate', 'Sex', 'Present Ship', 'DOJ', 'Authority', 'Drafted To', 'WEF', 'Deployment/Vice', 'Remark', 'Status', 'Not Recommended Because'],
    [14, 30, 8, 8, 22, 12, 24, 22, 12, 26, 30, 16, 30]);
  rows.forEach((x) => ws.addRow([
    x.serviceNumber, x.name, x.rateCode, sexLetter(x.sex), x.oldShip, dmy(x.joinedOn), b.authority, x.newShip, dmy(x.wef), x.vice, x.remark,
    ROW_STATE[x.status] || x.status, x.notRecommendedReason,
  ]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---- Rate DOD History -----------------------------------------------------------------------------------------------

const draftTo = (x) => (x.status === 'not_recommended' ? 'Not recommended' : x.newShip);

async function historyPdf({ rating, items, total, generatedBy }) {
  const one = !!rating;
  return renderPdf('draft-history', {
    title: 'DRAFT HISTORY',
    generatedBy,
    ref: one ? rating.serviceNumber : undefined,
    subtitle: one ? undefined : `All ratings, ${total} ${total === 1 ? 'draft' : 'drafts'}`,
    orientation: one ? 'portrait' : 'landscape', // the template's head reads it
    facts: one
      ? [f('Official No', rating.serviceNumber, 'code'), f('Name', rating.name), f('Rate', rating.rateCode)]
      : [f('Drafts', String(total)), f('Printed', dmy(todayIso()))],
    table: {
      dense: !one,
      columns: one
        ? [
          { label: 'Batch Number', key: 'no', kind: 'code', w: '26%' }, { label: 'Authority', key: 'auth', kind: 'code', w: '20%' },
          { label: 'Old Ship', key: 'old', w: '20%' }, { label: 'New Ship', key: 'neu', w: '20%' }, { label: 'Date Reported', key: 'wef', kind: 'date' },
        ]
        : [
          { label: 'Official No', key: 'sn', kind: 'code', w: '9%' }, { label: 'Name', key: 'name', kind: 'name', w: '19%' }, { label: 'Rate', key: 'rate', w: '5%' },
          { label: 'Old Ship', key: 'old', w: '14%' }, { label: 'New Ship', key: 'neu', w: '14%' }, { label: 'Date Reported', key: 'wef', kind: 'date', w: '10%' },
          { label: 'Batch Number', key: 'no', kind: 'code', w: '17%' }, { label: 'Authority', key: 'auth', kind: 'code' },
        ],
      rows: items.map((x) => ({
        sn: x.serviceNumber, name: x.name, rate: x.rateCode, no: x.batchNumber, auth: x.authority, old: x.oldShip,
        neu: draftTo(x), wef: reportedText(x), struck: x.status === 'not_recommended',
      })),
      empty: one ? 'This rating has not been through a draft batch.' : 'No draft has been made yet.',
    },
  });
}

async function historyWorkbook({ rating, items, generatedBy }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = generatedBy || 'CIRERMS';
  const ws = sheet(wb, 'Draft History', 'Draft History',
    [rating ? `Rating: ${rating.serviceNumber} ${rating.name}` : 'All ratings', `Printed: ${dmy(todayIso())}`],
    ['Official Number', 'Name', 'Rate', 'Old Ship', 'New Ship', 'Date Reported', 'Status', 'Batch Number', 'Authority', 'Deployment/Vice', 'Not Recommended Because'],
    [14, 30, 8, 22, 22, 16, 16, 26, 24, 26, 30]);
  items.forEach((x) => ws.addRow([
    x.serviceNumber, x.name, x.rateCode, x.oldShip, x.newShip, x.status === 'reported' ? dmy(x.wef) : reportedText(x), ROW_STATE[x.status] || x.status,
    x.batchNumber, x.authority, x.vice, x.notRecommendedReason,
  ]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ---- Draft Report ------------------------------------------------------------------------------------------------------

async function postingsPdf({ items, filters, total, generatedBy }) {
  return renderPdf('draft-report-all', {
    title: 'DRAFT REPORT',
    generatedBy,
    subtitle: `All postings, ${filters.period}`,
    facts: [f('Specialisation', filters.specialisation), f('Authority', filters.authority), f('Period', filters.period), f('Postings', String(total))],
    table: {
      dense: true,
      columns: [
        { label: 'Batch', key: 'batch', kind: 'code', w: '14%' }, { label: 'Name', key: 'name', kind: 'name', w: '17%' }, { label: 'Rate', key: 'rate', w: '5%' },
        { label: 'Official No', key: 'sn', kind: 'code', w: '8%' }, { label: 'Present Ship', key: 'from', w: '10%' }, { label: 'Authority', key: 'auth', kind: 'code', w: '12%' },
        { label: 'Proposed Ship', key: 'to', w: '10%' }, { label: 'Vice', key: 'vice', w: '11%' }, { label: 'WEF', key: 'wef', kind: 'date', w: '8%' },
      ],
      rows: items.map((x) => ({
        batch: x.batchNumber, name: x.name, rate: x.rateCode, sn: x.serviceNumber, from: x.presentShip, auth: x.authority, to: x.proposedShip, vice: x.vice, wef: iso(x.wef),
      })),
      empty: 'No posting reported in this selection.',
    },
  });
}

async function postingsWorkbook({ items, filters, generatedBy }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = generatedBy || 'CIRERMS';
  const ws = sheet(wb, 'Draft Report', 'Draft Report',
    [`Specialisation: ${filters.specialisation}`, `Authority: ${filters.authority}`, `Period: ${filters.period}`, `Printed: ${dmy(todayIso())}`],
    ['Batch Number', 'Official Number', 'Name', 'Rate', 'Sex', 'Specialisation', 'Present Ship', 'DOJ', 'Authority', 'Proposed Ship', 'Deployment/Vice', 'WEF'],
    [26, 14, 30, 8, 8, 22, 22, 12, 24, 22, 26, 12]);
  items.forEach((x) => ws.addRow([
    x.batchNumber, x.serviceNumber, x.name, x.rateCode, sexLetter(x.sex), x.specialisation, x.presentShip, dmy(x.joinedOn), x.authority, x.proposedShip, x.vice, dmy(x.wef),
  ]));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { summaryPdf, summaryWorkbook, batchPdf, batchWorkbook, historyPdf, historyWorkbook, postingsPdf, postingsWorkbook };
