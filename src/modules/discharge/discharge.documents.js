'use strict';

const ExcelJS = require('exceljs');
const { renderPdf } = require('../../shared/printouts');
const { dmy } = require('../drafting/drafting.format');
const { notFound, conflict } = require('../../shared/errors');

const f = (label, value, kind) => (kind ? { label, value, kind } : { label, value });

async function servicePdf(r, generatedBy) {
  return {
    mimeType: 'application/pdf',
    fileName: `Personnel Details ${r.service_number}.pdf`,
    buffer: await renderPdf('personnel-details', {
      title: `PERSONNEL DETAILS — ${r.service_number}`,
      generatedBy,
      ref: r.service_number,
      facts: [
        f('Official Number', r.service_number, 'code'),
        f('Surname', r.surname), f('First Name', r.first_name), f('Middle Name', r.middle_name),
        f('Date of Birth', r.date_of_birth, 'date'), f('Telephone', r.phone),
      ],
      table: {
        heading: 'Rate History',
        columns: [
          { label: 'Rate', key: 'rate', w: '40%' },
          { label: 'From', key: 'start', kind: 'date', w: '30%' },
          { label: 'To', key: 'end', kind: 'date', w: '30%' },
        ],
        rows: r.rateHistory || [],
        empty: 'No rate history is recorded.',
      },
      signatures: [{ role: 'Records Officer' }, { role: 'Director of Personnel (Navy)' }],
    }),
  };
}

async function verificationPdf(kind, v, generatedBy) {
  if (!['reengagement', 'retirement', 'engagement'].includes(kind)) throw notFound('That form does not exist.', 'FORM_NOT_FOUND');
  if (kind === 'reengagement' && !v.reengagement) throw conflict('No re-engagement is recorded for this rating.', 'NO_REENGAGEMENT');
  if (kind === 'retirement' && !v.discharge) throw conflict('This rating has no discharge on file.', 'NO_DISCHARGE');
  const label = kind === 'reengagement' ? 'RE-ENGAGEMENT VERIFICATION' : kind === 'retirement' ? 'RETIREMENT ROUTINE' : 'ENGAGEMENT FORM';
  const rating = v.rating;
  const source = kind === 'reengagement' ? v.reengagement : kind === 'retirement' ? v.discharge : null;
  const name = [rating.surname, rating.first_name, rating.middle_name].filter(Boolean).join(' ');
  const baseFacts = [
    f('Official No', rating.service_number, 'code'),
    f('Name', name), f('Rate', rating.rate_name),
    f('Date Employed', rating.date_employed, 'date'),
    f('Length of Service', `${rating.years_service ?? '—'} years`),
    f('Age', `${rating.age ?? '—'} years`),
  ];
  let template;
  let facts;
  let table;
  let note = '';
  let signatures;

  if (kind === 'reengagement') {
    template = 're-engagement-verification';
    facts = baseFacts.concat(source ? [
      f('Re-engagement Date', source.reengage_date, 'date'),
      f('Period', `${source.period_months} months`),
      f('Ends', source.until_date, 'date'),
      f('Approved By', source.approved_by),
    ] : []);
    table = {
      heading: 'Re-engagement History',
      columns: [
        { label: 'Date', key: 'date', kind: 'date', w: '22%' },
        { label: 'Period', key: 'period', w: '18%' },
        { label: 'Ends', key: 'until', kind: 'date', w: '22%' },
        { label: 'Approved By', key: 'approvedBy', w: '38%' },
      ],
      rows: (v.reengagements || []).slice().reverse().map((x) => ({
        date: x.reengage_date, period: `${x.period_months} months`, until: x.until_date, approvedBy: x.approved_by || '',
      })),
      empty: 'No re-engagement is recorded.',
    };
    signatures = [{ role: 'Rating' }, { role: 'Verifying Officer' }, { role: 'Director of Personnel (Navy)' }];
  } else if (kind === 'retirement') {
    template = 'retirement-routine';
    facts = baseFacts.concat(source ? [
      f('Exit Type', source.exit_type_name),
      f('Exit Date', source.exit_date, 'date'),
      f('Reason', source.exit_reason),
      f('Proposal', source.proposal_number),
      f('Approved By', source.approved_by),
    ] : []);
    table = {
      heading: 'Clearance',
      blank: true,
      columns: [
        { label: 'Section', key: 'section', w: '38%' },
        { label: 'Cleared', kind: 'check', w: '10%' },
        { label: 'Cleared By', kind: 'fill' },
        { label: 'Date', kind: 'fill', w: '18%' },
      ],
      rows: ['Ship or Unit', 'Stores and Equipment', 'Medical', 'Accounts and Pay', 'Documents and Records']
        .map((section) => ({ section })),
      empty: 'No clearance sections are defined.',
    };
    note = source && source.comment ? `Comment: ${source.comment}` : '';
    signatures = [{ role: 'Rating' }, { role: 'Commanding Officer' }, { role: 'Director of Personnel (Navy)' }];
  } else {
    template = 'engagement-form';
    facts = baseFacts.concat([
      f('Branch', rating.branch_name),
      f('Entry Mode', rating.entry_mode_name),
    ]);
    table = {
      heading: 'Engagement History',
      columns: [
        { label: 'Engagement', key: 'engagement', w: '24%' },
        { label: 'Date', key: 'date', kind: 'date', w: '20%' },
        { label: 'Period', key: 'period', w: '18%' },
        { label: 'Ends', key: 'until', kind: 'date', w: '18%' },
        { label: 'Approved By', key: 'approvedBy', w: '20%' },
      ],
      rows: [{ engagement: 'Initial Engagement', date: rating.date_employed, period: '', until: '', approvedBy: '' }]
        .concat((v.reengagements || []).slice().reverse().map((x, i) => ({
          engagement: `Re-engagement ${i + 1}`,
          date: x.reengage_date,
          period: `${x.period_months} months`,
          until: x.until_date,
          approvedBy: x.approved_by || '',
        }))),
    };
    signatures = [{ role: 'Rating' }, { role: 'Divisional Officer' }, { role: 'Commanding Officer' }];
  }

  return {
    mimeType: 'application/pdf',
    fileName: `${label} ${rating.service_number}.pdf`,
    buffer: await renderPdf(template, {
      title: label,
      generatedBy,
      ref: rating.service_number,
      facts,
      table,
      note,
      signatures,
    }),
  };
}

async function reportPdf(r, filters, generatedBy) {
  const reportFilters = r.filters || filters;
  const rows = r.items.map((x) => ({
    sn: x.service_number, name: [x.surname, x.first_name, x.middle_name].filter(Boolean).join(' '),
    rate: x.rate_code || x.rate_name || '',
    dateEmployed: x.date_employed,
    service: `${x.years_service ?? '—'} years`,
    type: x.exit_type_name || 'Re-engagement',
    date: `${dmy(x.exit_date)}${x.status === 'scheduled' ? ' (Scheduled)' : ''}`,
    reason: x.type === 'reengagement' ? `${x.period_months} months` : x.exit_reason || '',
    approvedBy: x.approved_by || '',
  }));
  return {
    mimeType: 'application/pdf',
    fileName: 'Discharge Report.pdf',
    buffer: await renderPdf('discharge-report', {
      title: 'DISCHARGE REPORT',
      generatedBy,
      ref: '',
      facts: [
        f('Exit From', reportFilters.from === 'All' ? 'All' : dmy(reportFilters.from)),
        f('Exit To', reportFilters.to === 'All' ? 'All' : dmy(reportFilters.to)),
        f('Exit Type', reportFilters.exitType || reportFilters.exitTypeId || 'All'),
        f('Rate', reportFilters.rate || reportFilters.rateId || 'All'),
        f('Branch', reportFilters.branch || reportFilters.branchId || 'All'),
        f('Records', String(r.meta.total)),
      ],
      table: {
        columns: [
          { label: 'Official No', key: 'sn', kind: 'code', w: '10%' },
          { label: 'Name', key: 'name', w: '20%' },
          { label: 'Rate', key: 'rate', w: '7%' },
          { label: 'Date Employed', key: 'dateEmployed', kind: 'date', w: '10%' },
          { label: 'Service', key: 'service', w: '8%' },
          { label: 'Type', key: 'type', w: '12%' },
          { label: 'Exit Date', key: 'date', w: '11%' },
          { label: 'Reason', key: 'reason', w: '12%' },
          { label: 'Approved By', key: 'approvedBy', w: '10%' },
        ],
        rows,
      },
      signatures: [{ role: 'Prepared By' }, { role: 'Director of Personnel (Navy)' }],
      summary: [
        { label: 'Discharges', value: String(r.summary.discharges) },
        { label: 'Scheduled', value: String(r.summary.scheduled) },
        { label: 'Re-engagements', value: String(r.summary.reengagements) },
      ],
    }),
  };
}

async function reportExcel(r, generatedBy) {
  const wb = new ExcelJS.Workbook();
  wb.creator = generatedBy || 'CIRERMS';
  const ws = wb.addWorksheet('Discharge Report');
  ws.addRow(['Discharge Report']).font = { bold: true, size: 14 };
  ws.addRow([`Discharges: ${r.summary.discharges}`, `Scheduled: ${r.summary.scheduled}`, `Re-engagements: ${r.summary.reengagements}`]);
  ws.addRow([]);
  const head = ws.addRow(['Official No', 'Name', 'Rate', 'Branch', 'Date Employed', 'Service (Years)', 'Type', 'Exit Date', 'Status', 'Reason', 'Approved By']);
  head.eachCell((c) => { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0074A8' } }; });
  r.items.forEach((x) => ws.addRow([
    x.service_number, [x.surname, x.first_name, x.middle_name].filter(Boolean).join(' '),
    x.rate_name || '', x.branch_name || '', dmy(x.date_employed), x.years_service ?? '',
    x.exit_type_name || 'Re-engagement', dmy(x.exit_date), x.status,
    x.type === 'reengagement' ? `${x.period_months} months` : x.exit_reason || '', x.approved_by || '',
  ]));
  [14, 30, 12, 18, 14, 16, 22, 14, 14, 36, 24].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: 4 }];
  return { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName: 'Discharge Report.xlsx', buffer: Buffer.from(await wb.xlsx.writeBuffer()) };
}

module.exports = { servicePdf, verificationPdf, reportPdf, reportExcel };
