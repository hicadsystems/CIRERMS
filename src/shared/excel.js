'use strict';

const ExcelJS = require('exceljs');
const { formatDisplayDate } = require('./dates');

const BATCH_COLUMNS = [
  { key: 'service_number', header: 'Official Number *', width: 18, required: true },
  { key: 'surname', header: 'Surname *', width: 20, required: true },
  { key: 'first_name', header: 'First Name *', width: 20, required: true },
  { key: 'middle_name', header: 'Middle Name', width: 18 },
  { key: 'rate', header: 'Rate *', width: 28, required: true },
  { key: 'title', header: 'Title', width: 12 },
  { key: 'gender', header: 'Gender *', width: 12, required: true },
  { key: 'date_of_birth', header: 'Date of Birth (YYYY-MM-DD)', width: 24 },
  { key: 'marital_status', header: 'Marital Status', width: 16 },
  { key: 'religion', header: 'Religion', width: 16 },
  { key: 'tribe', header: 'Tribe', width: 16 },
  { key: 'state', header: 'State of Origin', width: 18 },
  { key: 'local_government', header: 'Local Government', width: 22 },
  { key: 'geo_political_zone', header: 'Geo-Political Zone', width: 20 },
  { key: 'phone', header: 'Phone Number', width: 18 },
  { key: 'email_address', header: 'Email Address', width: 26 },
  { key: 'home_address', header: 'Home Address', width: 34 },
  { key: 'branch', header: 'Branch', width: 22 },
  { key: 'command', header: 'Command', width: 24 },
  { key: 'mother_base', header: 'Mother Base', width: 28 },
  { key: 'current_ship', header: 'Current Ship', width: 22 },
  { key: 'entry_mode', header: 'Entry Mode', width: 22 },
  { key: 'date_employed', header: 'Date Employed (YYYY-MM-DD)', width: 24 },
  { key: 'seniority_date', header: 'Seniority Date (YYYY-MM-DD)', width: 24 },
  { key: 'specialisation', header: 'Specialisation', width: 24 },
];

function styleHeaderRow(row, fillArgb = 'FF0074A8') {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: fillArgb },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF005A82' } },
    };
  });
}

/**
 * Generate the Batch Upload Excel (.xlsx) template buffer.
 * Sheet 1 ("Ratings Batch Upload") contains the exact import headers ready for data entry.
 * Sheet 2 ("Instructions & Valid Lookups") provides guidance, an example row, and live lookup values.
 */
async function buildBatchTemplateWorkbook(lookups) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nigerian Navy CIRERMS';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Ratings Batch Upload', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = BATCH_COLUMNS.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width,
  }));

  styleHeaderRow(sheet.getRow(1));

  // Force text format on Official Number, Phone, and Date columns so Excel does not mangle leading zeros or dates
  ['service_number', 'phone', 'date_of_birth', 'date_employed', 'seniority_date'].forEach((key) => {
    const col = sheet.getColumn(key);
    if (col) col.numFmt = '@';
  });

  const guide = wb.addWorksheet('Instructions & Valid Lookups');
  guide.columns = [
    { header: 'Field / Guidance', key: 'col1', width: 34 },
    { header: 'Details / Accepted Values', key: 'col2', width: 85 },
  ];
  styleHeaderRow(guide.getRow(1), 'FF1CAF9A');

  const notes = [
    ['Compulsory Fields (*)', 'Official Number, Surname, First Name, Rate, and Gender must be filled on every row.'],
    ['Duplicate Official Numbers', 'Rows whose Official Number already exists in CIRERMS (or repeats earlier in the file) are skipped safely and reported.'],
    ['Dates', 'Enter dates strictly as YYYY-MM-DD (e.g. 1994-06-21). Leave unknown optional dates blank — never enter 0001-01-01.'],
    ['Current Ship', 'Optional. When filled with a valid Ship name, CIRERMS creates an active Drafting record automatically.'],
    ['Example Row', 'B0701 | NWACHUKWU | EMEKA | CHIDI | Petty Officer (PO) | PO | Male | 1993-05-14 | Married | Christianity | Igbo | Enugu | Enugu North | South East | 08031234567 | e.nwachukwu@navy.mil.ng | Navy Town, Ojo | Seaman | Western Naval Command | NNS BEECROFT (Apapa) | NNS KADA | Regular Recruitment | 2014-08-01 | 2023-07-01 | Navigation'],
    ['', ''],
    ['Valid Rates', (lookups.rates || []).map((r) => r.name).join(' | ')],
    ['Valid Genders', (lookups.genders || []).map((r) => r.name).join(' | ')],
    ['Valid Marital Statuses', (lookups.maritalStatuses || []).map((r) => r.name).join(' | ')],
    ['Valid Religions', (lookups.religions || []).map((r) => r.name).join(' | ')],
    ['Valid Geo-Political Zones', (lookups.geoPoliticalZones || []).map((r) => r.name).join(' | ')],
    ['Valid States', (lookups.states || []).map((r) => r.name).join(' | ')],
    ['Valid Branches', (lookups.branches || []).map((r) => r.name).join(' | ')],
    ['Valid Commands', (lookups.commands || []).map((r) => r.name).join(' | ')],
    ['Valid Mother Bases', (lookups.motherBases || []).map((r) => r.name).join(' | ')],
    ['Valid Ships', (lookups.ships || []).map((r) => r.name).join(' | ')],
    ['Valid Entry Modes', (lookups.entryModes || []).map((r) => r.name).join(' | ')],
    ['Valid Specialisations', (lookups.specialisations || []).map((r) => r.name).join(' | ')],
  ];

  notes.forEach(([col1, col2]) => {
    const r = guide.addRow({ col1, col2 });
    r.getCell(1).font = { bold: true, size: 10 };
    r.getCell(2).alignment = { wrapText: true, vertical: 'top' };
  });

  return wb.xlsx.writeBuffer();
}

function extractCellValue(cellValue) {
  if (cellValue === null || cellValue === undefined) return '';
  if (cellValue instanceof Date) return cellValue;
  if (typeof cellValue === 'object') {
    if (Array.isArray(cellValue.richText)) {
      return cellValue.richText.map((part) => part.text || '').join('').trim();
    }
    if (cellValue.text !== undefined) {
      return String(cellValue.text).trim();
    }
    if (cellValue.result !== undefined) {
      return cellValue.result instanceof Date ? cellValue.result : String(cellValue.result).trim();
    }
  }
  return String(cellValue).trim();
}

function normaliseHeaderLabel(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/\*/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const HEADER_ALIASES = new Map([
  ['official number', 'service_number'],
  ['service number', 'service_number'],
  ['svc no', 'service_number'],
  ['surname', 'surname'],
  ['last name', 'surname'],
  ['first name', 'first_name'],
  ['middle name', 'middle_name'],
  ['other name', 'middle_name'],
  ['rate', 'rate'],
  ['rank', 'rate'],
  ['title', 'title'],
  ['gender', 'gender'],
  ['sex', 'gender'],
  ['date of birth', 'date_of_birth'],
  ['dob', 'date_of_birth'],
  ['marital status', 'marital_status'],
  ['religion', 'religion'],
  ['tribe', 'tribe'],
  ['state of origin', 'state'],
  ['state', 'state'],
  ['local government', 'local_government'],
  ['lga', 'local_government'],
  ['geo political zone', 'geo_political_zone'],
  ['geopolitical zone', 'geo_political_zone'],
  ['phone number', 'phone'],
  ['phone', 'phone'],
  ['mobile', 'phone'],
  ['email address', 'email_address'],
  ['email', 'email_address'],
  ['home address', 'home_address'],
  ['address', 'home_address'],
  ['branch', 'branch'],
  ['command', 'command'],
  ['mother base', 'mother_base'],
  ['current ship', 'current_ship'],
  ['ship', 'current_ship'],
  ['entry mode', 'entry_mode'],
  ['date employed', 'date_employed'],
  ['date enlisted', 'date_employed'],
  ['seniority date', 'seniority_date'],
  ['specialisation', 'specialisation'],
  ['specialization', 'specialisation'],
]);

/**
 * Parse an uploaded .xlsx buffer into an array of `{ rowNumber, data }`.
 */
async function parseBatchUploadBuffer(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const sheet = wb.worksheets[0];
  if (!sheet) {
    return { headerErrors: ['Workbook contains no worksheets.'], rows: [] };
  }

  const headerRow = sheet.getRow(1);
  const colIndexToKey = new Map();

  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const rawHeader = extractCellValue(cell.value);
    const norm = normaliseHeaderLabel(rawHeader);
    const mapped = HEADER_ALIASES.get(norm);
    if (mapped) {
      colIndexToKey.set(colNumber, mapped);
    }
  });

  const requiredKeys = ['service_number', 'surname', 'first_name', 'rate', 'gender'];
  const mappedKeys = new Set(colIndexToKey.values());
  const missingHeaders = requiredKeys.filter((k) => !mappedKeys.has(k));

  if (missingHeaders.length > 0) {
    const labels = missingHeaders.map(
      (k) => (BATCH_COLUMNS.find((c) => c.key === k) || { header: k }).header
    );
    return {
      headerErrors: [
        `Missing compulsory column header(s) on Row 1: ${labels.join(', ')}. Download the official template and keep Row 1 headers intact.`,
      ],
      rows: [],
    };
  }

  const parsedRows = [];
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r);
    const data = {};
    let nonEmpty = false;

    for (const [colIdx, key] of colIndexToKey.entries()) {
      const val = extractCellValue(row.getCell(colIdx).value);
      if (val !== '' && val !== null && val !== undefined) {
        nonEmpty = true;
      }
      data[key] = val;
    }

    if (nonEmpty) {
      parsedRows.push({ rowNumber: r, data });
    }
  }

  return { headerErrors: [], rows: parsedRows };
}

function getListExportColumns(status) {
  if (status === 'former') {
    return [
      { header: 'S/N', key: 'sn', width: 7 },
      { header: 'Official Number', key: 'service_number', width: 18 },
      { header: 'Fullname', key: 'full_name', width: 32 },
      { header: 'Rate', key: 'rate_name', width: 26 },
      { header: 'Exit Type', key: 'exit_type_name', width: 22 },
      { header: 'Exit Date', key: 'exit_date_fmt', width: 16 },
      { header: 'Branch', key: 'branch_name', width: 22 },
      { header: 'State', key: 'state_name', width: 18 },
    ];
  }
  return [
    { header: 'S/N', key: 'sn', width: 7 },
    { header: 'Official Number', key: 'service_number', width: 18 },
    { header: 'Full Name', key: 'full_name', width: 32 },
    { header: 'Rate', key: 'rate_name', width: 26 },
    { header: 'Current Ship', key: 'current_ship_name', width: 24 },
    { header: 'Branch', key: 'branch_name', width: 22 },
    { header: 'Command', key: 'command_name', width: 24 },
    { header: 'Phone', key: 'phone', width: 18 },
  ];
}

function mapRowsForExport(status, rows) {
  return rows.map((r, index) => ({
    sn: index + 1,
    service_number: r.service_number || '',
    full_name: r.full_name || '',
    rate_name: r.rate_name || '',
    current_ship_name: r.current_ship_name || '',
    exit_type_name: r.exit_type_name || '',
    exit_date_fmt: formatDisplayDate(r.exit_date),
    branch_name: r.branch_name || '',
    command_name: r.command_name || '',
    state_name: r.state_name || '',
    phone: r.phone || '',
  }));
}

async function buildRatingsExcelBuffer(status, rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nigerian Navy CIRERMS';
  wb.created = new Date();

  const sheetName = status === 'former' ? 'Former Ratings' : 'Current Ratings';
  const sheet = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const cols = getListExportColumns(status);
  sheet.columns = cols;
  styleHeaderRow(sheet.getRow(1));

  const mapped = mapRowsForExport(status, rows);
  mapped.forEach((item) => sheet.addRow(item));

  return wb.xlsx.writeBuffer();
}

function escapeCsvCell(value) {
  const str = value == null ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildRatingsCsvString(status, rows) {
  const cols = getListExportColumns(status);
  const mapped = mapRowsForExport(status, rows);
  const lines = [cols.map((c) => escapeCsvCell(c.header)).join(',')];
  for (const item of mapped) {
    lines.push(cols.map((c) => escapeCsvCell(item[c.key])).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

module.exports = {
  BATCH_COLUMNS,
  buildBatchTemplateWorkbook,
  parseBatchUploadBuffer,
  buildRatingsExcelBuffer,
  buildRatingsCsvString,
};
