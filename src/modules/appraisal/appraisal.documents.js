'use strict';

/*
 * Report on Appraisal printouts: D4's template (src/templates/printouts/report-on-appraisal) as a PDF, and an Excel
 * workbook. Both are made from the one query the page's list uses (appraisal.service.js reportAll).
 */
const ExcelJS = require('exceljs');
const { renderPdf } = require('../../shared/printouts');
const { dmy } = require('../drafting/drafting.format');

const f = (label, value) => ({ label, value });
const upperName = (name) => name; // the service writes SURNAME First Middle already

/** The Report on Appraisal: the filters, the grade counts for both grades, then the list. */
async function reportPdf(r, generatedBy) {
  const total = r.summary.appraisals;
  return renderPdf('report-on-appraisal', {
    title: 'REPORT ON APPRAISAL',
    generatedBy,
    subtitle: r.filters.period === 'All' ? 'All periods' : `Period ${r.filters.period}`,
    facts: [
      f('Period', r.filters.period), f('Ship', r.filters.ship), f('Rate', r.filters.rate),
      f('Branch', r.filters.branch), f('Grade', r.filters.grade), f('Appraisals', String(total)),
    ],
    charGrades: r.gradeCounts.map((g) => ({ label: `${g.code} ${g.name}`, value: g.character })),
    effGrades: r.gradeCounts.map((g) => ({ label: `${g.code} ${g.name}`, value: g.efficiency })),
    table: {
      dense: true,
      columns: [
        { label: 'Official No', key: 'sn', kind: 'code', w: '8%' }, { label: 'Name', key: 'name', kind: 'name', w: '15%' },
        { label: 'Rate', key: 'rate', w: '5%' }, { label: 'Ship', key: 'ship', w: '10%' },
        { label: 'Branch', key: 'branch', w: '10%' }, { label: 'Period', key: 'period', w: '9%' },
        { label: 'Character', key: 'ch', w: '10%' }, { label: 'Efficiency', key: 'ef', w: '10%' },
        { label: 'CO\u2019s Name', key: 'co', w: '12%' }, { label: 'Director', key: 'dir', w: '11%' },
      ],
      rows: r.rows.map((a) => ({
        sn: a.serviceNumber, name: upperName(a.name), rate: a.rateCode, ship: a.ship, branch: a.branch, period: a.periodName,
        ch: `${a.character.code} ${a.character.name}`, ef: `${a.efficiency.code} ${a.efficiency.name}`, co: a.coName, dir: a.directorName,
        c: a.character.code, e: a.efficiency.code,
      })),
      empty: 'No appraisal matches these filters.',
    },
    signatures: [{ role: 'Prepared By' }, { role: 'Director of Personnel (Navy)' }],
  });
}

/** The same report as a workbook: the filters, the grade counts, then one row for each appraisal. */
async function reportExcel(r, generatedBy) {
  const wb = new ExcelJS.Workbook();
  wb.creator = generatedBy || 'CIRERMS';
  const ws = wb.addWorksheet('Report on Appraisal');
  ws.addRow(['Report on Appraisal']).font = { bold: true, size: 14 };
  ws.addRow([`Period: ${r.filters.period}`, `Ship: ${r.filters.ship}`, `Rate: ${r.filters.rate}`, `Branch: ${r.filters.branch}`, `Grade: ${r.filters.grade}`, `Appraisals: ${r.summary.appraisals}`]);
  ws.addRow([]);
  const gradeHead = ws.addRow(['Grade', 'Character', 'Efficiency']);
  gradeHead.font = { bold: true };
  r.gradeCounts.forEach((g) => ws.addRow([`${g.code} - ${g.name}`, g.character, g.efficiency]));
  ws.addRow([]);
  const head = ws.addRow(['Appraisal No', 'Official No', 'Name', 'Rate', 'Ship', 'Branch', 'Period', 'Character', 'Efficiency', 'CO\u2019s Name', 'Director\u2019s Name', 'Director\u2019s Date', 'Remark']);
  head.eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0074A8' } }; });
  const headRow = head.number;
  r.rows.forEach((a) => ws.addRow([
    a.no, a.serviceNumber, a.name, a.rateCode, a.ship, a.branch, a.periodName, a.character.label, a.efficiency.label,
    a.coName, a.directorName, dmy(a.directorDate), a.remark,
  ]));
  [14, 14, 30, 10, 20, 22, 18, 18, 18, 24, 24, 16, 40].forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: headRow }];
  return { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fileName: 'Report on Appraisal.xlsx', buffer: Buffer.from(await wb.xlsx.writeBuffer()) };
}

module.exports = { reportPdf, reportExcel };
