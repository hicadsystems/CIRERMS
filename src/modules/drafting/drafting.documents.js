'use strict';

/*
 * Drafting printouts and the workbook. The PDFs are D4's templates (src/templates/printouts):
 * manning-requirement-report (Update Manning Requirement, Print) and draft-form (Review/Print Draft, Print Draft).
 */
const ExcelJS = require('exceljs');
const { renderPdf } = require('../../shared/printouts');
const { dmy, todayIso } = require('./drafting.format');

const f = (label, value, kind) => (kind ? { label, value, kind } : { label, value });
const diffText = (d) => (d > 0 ? `+${d}` : String(d));
const STATUS = { open: 'Batch open for review', approved: 'Approved, ready to close', closed: 'Closed' };

/** Manning Requirement Report: the ships as groups; rate, specialisation, required, aboard, difference; totals. */
async function manningPdf({ ship, rows, generatedBy }) {
  const out = [];
  let last = null;
  for (const m of rows) {
    if (m.ship !== last) { out.push({ group: m.ship }); last = m.ship; }
    out.push({ rate: m.rateCode, spec: m.specialisation, req: m.required, aboard: m.aboard, diff: diffText(m.difference) });
  }
  const req = rows.reduce((a, m) => a + m.required, 0);
  const aboard = rows.reduce((a, m) => a + m.aboard, 0);
  return renderPdf('manning-requirement-report', {
    title: 'MANNING REQUIREMENT REPORT',
    generatedBy,
    subtitle: `As at ${dmy(todayIso())}`,
    facts: [f('Ship or Unit', ship), f('Requirements', String(rows.length)), f('Required', String(req))],
    table: {
      columns: [
        { label: 'Rate', key: 'rate', kind: 'name', w: '14%' }, { label: 'Specialisation', key: 'spec' },
        { label: 'Required', key: 'req', kind: 'num', w: '14%' }, { label: 'Aboard', key: 'aboard', kind: 'num', w: '14%' },
        { label: 'Difference', key: 'diff', kind: 'num', w: '14%' },
      ],
      rows: out,
      totals: rows.length ? { rate: 'Total', req, aboard, diff: diffText(aboard - req) } : null,
      empty: 'No requirement.',
    },
  });
}

/** The Draft Form: the batch facts, its ratings with proposed ship, vice and remark; not-recommended lines struck. */
async function draftFormPdf({ b, rows, generatedBy }) {
  const struck = rows.some((x) => x.notRecommended);
  return renderPdf('draft-form', {
    title: 'DRAFT FORM',
    generatedBy,
    ref: b.batchNumber,
    subtitle: b.status === 'closed' ? `Closed under ${b.authority}` : STATUS[b.status] || '',
    facts: [
      f('Batch Number', b.batchNumber, 'code'), f('Branch', b.branch), f('Specialisation', b.specialisation),
      f('Initiated By', b.initiatedBy), f('Date', b.initiatedAt ? dmyIso(b.initiatedAt) : '', 'date'), f('Ratings', String(b.readiness.live)),
    ],
    table: {
      dense: true,
      columns: [
        { label: 'Official No', key: 'sn', kind: 'code', w: '7%' }, { label: 'Name', key: 'name', kind: 'name', w: '17%' },
        { label: 'Rate', key: 'rate', w: '5%' }, { label: 'Sex', key: 'sex', kind: 'ctr', w: '4%' },
        { label: 'Current Ship', key: 'from', w: '11%' }, { label: 'Months', key: 'months', kind: 'num', w: '6%' },
        { label: 'Proposed Ship', key: 'to', w: '12%' }, { label: 'Vice / Deployment', key: 'vice', w: '13%' }, { label: 'Remark', key: 'remark' },
      ],
      rows: rows.map((x) => ({
        sn: x.serviceNumber, name: x.name, rate: x.rateCode, sex: x.sex ? x.sex[0].toUpperCase() : '', from: x.currentShip,
        months: x.months === null || x.months === undefined ? '' : x.months,
        to: x.notRecommended ? `NOT RECOMMENDED: ${x.notRecommended.reason}` : x.proposedShip,
        vice: x.vice, remark: x.remark, struck: !!x.notRecommended,
      })),
      empty: 'No ratings in this batch.',
    },
    note: struck ? 'Lines struck through are ratings the drafting officer did not recommend.' : '',
    signatures: [{ role: 'Drafting Officer' }, { role: 'Director of Personnel (Navy)' }],
  });
}

// a DATETIME as YYYY-MM-DD (the template writes dd/mm/yyyy)
function dmyIso(v) {
  const s = dmy(v);
  return s ? `${s.slice(6)}-${s.slice(3, 5)}-${s.slice(0, 2)}` : '';
}

const BLUE = 'FF0074A8';
const PAPER = 'FFF5F7F9';
const STATUS_ROW = { proposed: 'Proposed', not_recommended: 'Not Recommended', awaiting_wef: 'Awaiting WEF', scheduled: 'Scheduled', reported: 'Reported' };

async function batchWorkbook({ b, rows, generatedBy }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = generatedBy || 'CIRERMS';
  const ws = wb.addWorksheet('Draft');
  ws.addRow([`Draft ${b.batchNumber}`]).font = { bold: true, size: 14 };
  ws.addRow([`Branch: ${b.branch}`, `Specialisation: ${b.specialisation}`, `Rate: ${b.rate}`, `Status: ${STATUS[b.status] || b.status}`, `Printed: ${dmy(todayIso())}`]);
  ws.addRow([]);
  const head = ws.addRow(['Official No', 'Name', 'Rate', 'Sex', 'Specialisation', 'Current Ship', 'Date Joined', 'Months', 'Proposed Ship', 'Vice/Deployment', 'Remark', 'Request', 'Status', 'Not Recommended Because', 'WEF']);
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: PAPER } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
  });
  rows.forEach((x) => ws.addRow([
    x.serviceNumber, x.name, x.rateCode, x.sex, x.specialisation, x.currentShip, dmy(x.joinedOn), x.months, x.proposedShip, x.vice, x.remark, x.request,
    STATUS_ROW[x.status] || x.status, x.notRecommended ? x.notRecommended.reason : '', dmy(x.wef),
  ]));
  [12, 30, 8, 8, 22, 20, 12, 8, 20, 24, 30, 16, 16, 30, 12].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** The live rows of the open batches by department (Draft Approval and Close Draft, Export Excel). */
async function departmentsWorkbook({ rows, department, generatedBy }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = generatedBy || 'CIRERMS';
  const ws = wb.addWorksheet('Draft by Department');
  ws.addRow(['Draft by Department']).font = { bold: true, size: 14 };
  ws.addRow([`Department: ${department}`, `Ratings: ${rows.length}`, `Printed: ${dmy(todayIso())}`]);
  ws.addRow([]);
  const head = ws.addRow(['Department', 'Batch Number', 'Official No', 'Name', 'Rate', 'Sex', 'Current Ship', 'Date Joined', 'Months', 'Proposed Ship', 'Vice/Deployment', 'Remark', 'Request', 'Approved By']);
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: PAPER } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
  });
  rows.slice().sort((a, b) => a.specialisation.localeCompare(b.specialisation)).forEach((x) => ws.addRow([
    x.specialisation, x.batchNumber, x.serviceNumber, x.name, x.rateCode, x.sex, x.currentShip, dmy(x.joinedOn), x.months, x.proposedShip, x.vice, x.remark, x.request,
    x.approval ? `${x.approval.rank} ${x.approval.name}` : '',
  ]));
  [24, 24, 12, 30, 8, 8, 20, 12, 8, 20, 24, 30, 16, 26].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { manningPdf, draftFormPdf, batchWorkbook, departmentsWorkbook };
