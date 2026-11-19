'use strict';

/* Disciplinary Action printouts (PDF) and the report workbook (Excel). */
const ExcelJS = require('exceljs');
const { renderPdf, today, todayIso } = require('../../shared/printouts');
const { dmy: formatDisplayDate } = require('./disciplinary.format');

// the workbook's header colours (the printouts have their own stylesheet)
const BLUE = '#0074a8';
const STRIPE = '#f5f7f9';
const argb = (hex) => `FF${hex.slice(1).toUpperCase()}`;
const d = (v) => formatDisplayDate(v) || '-';
const nameOf = (c) => `${c.rate ? `${c.rate} ` : ''}${c.name}`;
const f = (label, value, kind) => (kind ? { label, value, kind } : { label, value });
const SIGNED = [{ role: 'Prepared By' }, { role: 'Director of Personnel (Navy)' }];
const STATUS = { pending: 'Pending', concluded: 'Concluded', cancelled: 'Cancelled' };

async function pendingListPdf({ rows, offence, search, generatedBy }) {
  return renderPdf('disciplinary-pending-cases', {
    title: 'PENDING DISCIPLINARY CASES',
    generatedBy,
    subtitle: `As at ${today()}`,
    facts: [f('Cases', String(rows.length)), f('As At', todayIso(), 'date'), f('Offence', offence || 'All'), f('Search', search || 'None')],
    table: {
      dense: true,
      columns: [
        { label: 'Case', key: 'caseNumber', kind: 'code', w: '9%' }, { label: 'Official No', key: 'serviceNumber', kind: 'code', w: '7%' },
        { label: 'Name', key: 'who', kind: 'name', w: '15%' }, { label: 'Ship', key: 'ship', w: '10%' }, { label: 'Offence', key: 'offence', w: '13%' },
        { label: 'Incident', key: 'incidentDate', kind: 'date', w: '8%' }, { label: 'What Happened', key: 'what', w: '24%' }, { label: 'Reported By', key: 'reportedBy' },
      ],
      rows: rows.map((c) => ({ ...c, who: nameOf(c) })),
      empty: 'No cases.',
    },
    signatures: SIGNED,
  });
}

async function reportPdf({ rows, labels, generatedBy }) {
  return renderPdf('disciplinary-report', {
    title: 'DISCIPLINARY REPORT',
    generatedBy,
    subtitle: `Period ${labels.period}`,
    facts: [f('Period', labels.period), f('Offence', labels.offence), f('Sanction', labels.sanction), f('Ship', labels.ship), f('Rate', labels.rate), f('Cases', String(rows.length))],
    table: {
      dense: true,
      columns: [
        { label: 'Case', key: 'caseNumber', kind: 'code', w: '8%' }, { label: 'Official No', key: 'serviceNumber', kind: 'code', w: '7%' },
        { label: 'Name', key: 'who', kind: 'name', w: '13%' }, { label: 'Ship', key: 'ship', w: '8%' }, { label: 'Offence', key: 'offence', w: '11%' },
        { label: 'Incident', key: 'incidentDate', kind: 'date', w: '7%' }, { label: 'Decided', key: 'decisionDate', kind: 'date', w: '7%' },
        { label: 'Sanction', key: 'sanction', w: '10%' }, { label: 'Decision', key: 'decision', w: '15%' }, { label: 'Authority', key: 'authority' },
      ],
      rows: rows.map((c) => ({ ...c, who: nameOf(c) })),
      empty: 'No cases.',
    },
    signatures: SIGNED,
  });
}

async function caseSheetPdf({ c, generatedBy }) {
  const status = STATUS[c.status] || c.status;
  const particulars = [
    f('Case Number', c.caseNumber, 'code'), f('Status', status), f('Offence', c.offence), f('Incident date', c.incidentDate, 'date'),
    f('What happened', c.what), f('Reported by', c.reportedBy), f('Opened', `${d(c.openedAt)}${c.openedBy ? ` by ${c.openedBy}` : ''}`),
  ];
  let decision = null;
  if (c.status === 'concluded') {
    decision = [f('Decision date', c.decisionDate, 'date'), f('Sanction', c.sanction), f('Decision', c.decision), f('Authority', c.authority)];
  } else if (c.status === 'cancelled') {
    decision = [f('Cancelled', `${d(c.cancelledAt)}${c.cancelledBy ? ` by ${c.cancelledBy}` : ''}`), f('Reason', c.cancelReason)];
  } else {
    decision = [f('Decision', 'Awaiting decision')];
  }
  const concluded = c.status === 'concluded';
  return renderPdf('disciplinary-case-sheet', {
    title: 'DISCIPLINARY CASE SHEET',
    generatedBy,
    ref: c.caseNumber,
    subtitle: status,
    rating: [f('Official No', c.serviceNumber, 'code'), f('Name', c.name.toUpperCase()), f('Rate', c.rate), f('Ship', c.ship)],
    particulars,
    decision,
    corrections: {
      heading: 'Corrections',
      columns: [{ label: 'Date', key: 'at', kind: 'date', w: '14%' }, { label: 'By', key: 'by', w: '22%' }, { label: 'Reason', key: 'reason', w: '24%' }, { label: 'Changed', key: 'changed' }],
      rows: (c.corrections || []).map((k) => ({ at: k.at, by: k.by, reason: k.reason, changed: k.changes.map(([fld, a, b]) => `${fld}: ${a || '-'} to ${b || '-'}`).join('; ') })),
    },
    signatures: concluded
      ? [{ role: 'Reporting Officer', name: c.reportedBy }, { role: 'Authority', name: c.authority }, { role: 'Director of Personnel (Navy)' }]
      : [{ role: 'Reporting Officer', name: c.reportedBy }, { role: 'Commanding Officer' }],
  });
}

async function reportWorkbook({ rows, labels, generatedBy }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = generatedBy || 'CIRERMS';
  const ws = wb.addWorksheet('Disciplinary Report');
  ws.addRow(['Disciplinary Report']).font = { bold: true, size: 14 };
  ws.addRow([`Period: ${labels.period}`, `Offence: ${labels.offence}`, `Sanction: ${labels.sanction}`, `Ship: ${labels.ship}`, `Rate: ${labels.rate}`, `Cases: ${rows.length}`]);
  ws.addRow([]);
  const head = ws.addRow(['Case', 'Official No', 'Name', 'Rate', 'Ship', 'Offence', 'Incident Date', 'What Happened', 'Reported By', 'Decision Date', 'Sanction', 'Decision', 'Authority']);
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: argb(STRIPE) } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BLUE) } };
  });
  rows.forEach((c) => ws.addRow([c.caseNumber, c.serviceNumber, c.name, c.rate, c.ship, c.offence, d(c.incidentDate), c.what, c.reportedBy, d(c.decisionDate), c.sanction, c.decision, c.authority]));
  [14, 14, 30, 24, 22, 30, 14, 44, 30, 14, 20, 44, 28].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { pendingListPdf, reportPdf, caseSheetPdf, reportWorkbook };
