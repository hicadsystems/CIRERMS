'use strict';

/*
 * Training Excel Upload: the template and the reading of a workbook. One row is one Training entry
 * for a rating: Official No, Course, Institution, Qualification, Start Date, End Date, Authority.
 * Reading only turns the sheet into rows; the rules (does the rating exist, is the course real,
 * are the dates sound) are the service's.
 */
const ExcelJS = require('exceljs');

const COLUMNS = [
  { key: 'serviceNumber', header: 'Official No *', width: 16, required: true },
  { key: 'course', header: 'Course *', width: 34, required: true },
  { key: 'institution', header: 'Institution', width: 30 },
  { key: 'qualification', header: 'Qualification', width: 30 },
  { key: 'startDate', header: 'Start Date * (YYYY-MM-DD)', width: 24, required: true },
  { key: 'endDate', header: 'End Date * (YYYY-MM-DD)', width: 24, required: true },
  { key: 'authority', header: 'Authority', width: 30 },
];
const MAX_ROWS = 2000;

const ALIASES = new Map([
  ['official no', 'serviceNumber'], ['official number', 'serviceNumber'], ['service number', 'serviceNumber'], ['svc no', 'serviceNumber'],
  ['course', 'course'], ['training', 'course'], ['training course', 'course'],
  ['institution', 'institution'],
  ['qualification', 'qualification'],
  ['start date', 'startDate'], ['from', 'startDate'],
  ['end date', 'endDate'], ['to', 'endDate'],
  ['authority', 'authority'],
]);

const norm = (label) => String(label || '').toLowerCase().replace(/\*/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function cellValue(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((p) => p.text || '').join('').trim();
    if (v.text !== undefined) return String(v.text).trim();
    if (v.result !== undefined) return v.result instanceof Date ? v.result : String(v.result).trim();
  }
  return String(v).trim();
}

/** The template: the headings in row 1, an example row, and the valid courses and institutions. */
async function buildTemplate({ courses, institutions }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nigerian Navy CIRERMS';
  wb.created = new Date();
  const sheet = wb.addWorksheet('Training Upload');
  sheet.columns = COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  const head = sheet.getRow(1);
  head.height = 24;
  head.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0074A8' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  const first = courses[0];
  sheet.addRow({
    serviceNumber: 'B0501', course: first ? first.name : 'Basic Seamanship', institution: first && first.institutionName ? first.institutionName : '',
    qualification: first && first.qualification ? first.qualification : '', startDate: '2026-01-12', endDate: '2026-07-10', authority: 'NHQ/DOT/2026/014',
  }).font = { italic: true, color: { argb: 'FF6B7280' } };

  const guide = wb.addWorksheet('Instructions and Courses');
  guide.columns = [{ width: 34 }, { width: 70 }];
  const lines = [
    ['Training Excel Upload', ''],
    ['', ''],
    ['How it works', 'Each row adds one Training entry to a rating\u2019s record. Keep Row 1 as it is and delete the example row (row 2).'],
    ['Official No', 'Required. The rating must be on file.'],
    ['Course', 'Required. A course name or code from the list below.'],
    ['Institution', 'Optional. A name or code from the list below. Blank uses the course\u2019s own institution.'],
    ['Qualification', 'Optional. Blank uses the course name.'],
    ['Start Date, End Date', 'Required. YYYY-MM-DD (or an Excel date). The end must not be before the start or in the future.'],
    ['Authority', 'Optional. The authority for the training (kept in the audit trail).'],
    ['', ''],
    ['Courses (code and name)', 'Institution'],
    ...courses.map((c) => [`${c.code ? `${c.code} \u00b7 ` : ''}${c.name}`, c.institutionName || '']),
    ['', ''],
    ['Institutions (code and name)', ''],
    ...institutions.map((i) => [`${i.code ? `${i.code} \u00b7 ` : ''}${i.name}`, '']),
  ];
  for (const r of lines) guide.addRow(r);
  guide.getRow(1).font = { bold: true, size: 13 };
  for (const r of [3, 4, 5, 6, 7, 8, 9, 11]) { guide.getRow(r).getCell(1).font = { bold: true }; guide.getRow(r).getCell(2).alignment = { wrapText: true, vertical: 'top' }; }
  return wb.xlsx.writeBuffer();
}

/** The rows of a workbook: { headerErrors, rows: [{ rowNumber, data }] }. */
async function parseWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch (_) {
    return { headerErrors: ['The file could not be read as an Excel workbook.'], rows: [] };
  }
  const sheet = wb.worksheets[0];
  if (!sheet) return { headerErrors: ['The workbook has no worksheets.'], rows: [] };

  const byColumn = new Map();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const key = ALIASES.get(norm(cellValue(cell.value)));
    if (key && ![...byColumn.values()].includes(key)) byColumn.set(col, key);
  });
  const have = new Set(byColumn.values());
  const missing = COLUMNS.filter((c) => c.required && !have.has(c.key)).map((c) => c.header);
  if (missing.length) {
    return { headerErrors: [`Row 1 is missing the heading(s): ${missing.join(', ')}. Download the template and keep its first row as it is.`], rows: [] };
  }

  const rows = [];
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const data = {};
    let any = false;
    for (const [col, key] of byColumn.entries()) {
      const v = cellValue(row.getCell(col).value);
      if (v !== '') any = true;
      data[key] = v;
    }
    if (any) rows.push({ rowNumber: r, data });
  }
  return { headerErrors: [], rows };
}

module.exports = { COLUMNS, MAX_ROWS, buildTemplate, parseWorkbook };
