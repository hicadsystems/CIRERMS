'use strict';

/*
 * Reports printouts and workbooks (WP9). The PDFs are D4's templates (src/templates/printouts):
 *   ratings-report-all          All Personnel, Print PDF (the Ratings Report)
 *   disposition-report          Disposition, Print PDF
 *   nominal-roll                Nominal Roll, Print PDF
 *   manning-requirement-report  Manning State, Print PDF (Drafting's own printout: drafting.documents.manningPdf)
 *   retirement-forecast         Retirement Forecast, Print PDF
 * Ship History is a workbook only, as in the old system. Every page's workbook is made from the same data as its PDF.
 */
const ExcelJS = require('exceljs');
const { renderPdf } = require('../../shared/printouts');
const { dmy, todayIso } = require('../drafting/drafting.format');
const { manningPdf } = require('../drafting/drafting.documents');
const { diffText } = require('./reports.service');

const f = (label, value, kind) => (kind ? { label, value, kind } : { label, value });
const BLUE = 'FF0074A8';
const PAPER = 'FFF5F7F9';
const SIGNATURES = [{ role: 'Prepared By' }, { role: 'Director of Personnel (Navy)' }];
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`;
const some = (v) => v && v !== 'All';

function sheet(wb, name, title, lines, headers, widths) {
  const ws = wb.addWorksheet(name);
  ws.addRow([title]).font = { bold: true, size: 14 };
  ws.addRow(lines);
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
const workbook = (generatedBy) => { const wb = new ExcelJS.Workbook(); wb.creator = generatedBy || 'CIRERMS'; return wb; };
const buffer = async (wb) => Buffer.from(await wb.xlsx.writeBuffer());

// ---- 1. Ship History: the workbook ----------------------------------------------------------------

async function shipHistoryWorkbook({ ship, period, items, total, aboard, generatedBy }) {
  const wb = workbook(generatedBy);
  const ws = sheet(wb, 'Ship History', `Ship History: ${ship}`, [`Period: ${period}`, `Postings: ${total}`, `Aboard now: ${aboard}`, `Printed: ${dmy(todayIso())}`],
    ['Official Number', 'Name', 'Rate', 'Specialisation', 'Ship or Unit', 'From', 'To', 'Months', 'Tour', 'Status'],
    [15, 32, 8, 24, 24, 12, 12, 9, 12, 12]);
  items.forEach((x) => ws.addRow([
    x.serviceNumber, x.name, x.rateCode, x.specialisation, ship, dmy(x.from), x.aboard ? '' : dmy(x.to), x.months, x.tour, x.aboard ? 'Aboard' : 'Left the ship',
  ]));
  return buffer(wb);
}

// ---- 2. All Personnel ---------------------------------------------------------------------------

function personnelFacts(filters, total) {
  const facts = [f('Status', filters.status), f('Rate', filters.rate), f('Branch', filters.branch), f('Command', filters.command)];
  if (some(filters.ship)) facts.push(f('Ship or Unit', filters.ship));
  if (some(filters.specialisation)) facts.push(f('Specialisation', filters.specialisation));
  if (some(filters.staffBranch)) facts.push(f('Staff Branch', filters.staffBranch));
  if (some(filters.entryMode)) facts.push(f('Entry Mode', filters.entryMode));
  if (some(filters.state)) facts.push(f('State', filters.state));
  if (some(filters.zone)) facts.push(f('Geo-Political Zone', filters.zone));
  facts.push(f('Ratings', String(total)));
  return facts;
}

async function personnelPdf({ items, total, filters, subtitle, generatedBy }) {
  return renderPdf('ratings-report-all', {
    title: 'RATINGS REPORT (ALL PERSONNEL)',
    generatedBy,
    subtitle,
    summary: [{ label: 'Ratings', value: total }],
    facts: personnelFacts(filters, total),
    table: {
      dense: true,
      columns: [
        { label: 'Official No', key: 'sn', kind: 'code', w: '8%' }, { label: 'Rate', key: 'rate', w: '5%' }, { label: 'Surname', key: 'surname', kind: 'name', w: '10%' },
        { label: 'First Name', key: 'first', w: '13%' }, { label: 'Branch', key: 'branch', w: '11%' }, { label: 'Specialisation', key: 'spec', w: '9%' },
        { label: 'Ship', key: 'ship', w: '10%' }, { label: 'Command', key: 'cmd', w: '12%' }, { label: 'Date of Birth', key: 'dob', kind: 'date', w: '8%' },
        { label: 'Date Joined', key: 'joined', kind: 'date', w: '8%' },
      ],
      rows: items.map((x) => ({
        sn: x.serviceNumber, rate: x.rateCode, surname: x.surname, first: x.firstName, branch: x.branch, spec: x.specialisation, ship: x.ship,
        cmd: x.command, dob: x.dateOfBirth, joined: x.dateJoined,
      })),
      empty: 'No rating matches the filters.',
    },
    signatures: SIGNATURES,
  });
}

async function personnelWorkbook({ items, total, filters, generatedBy }) {
  const wb = workbook(generatedBy);
  const ws = sheet(wb, 'Ratings Report', 'Ratings Report (All Personnel)',
    [`Status: ${filters.status}`, `Rate: ${filters.rate}`, `Branch: ${filters.branch}`, `Command: ${filters.command}`, `Ratings: ${total}`, `Printed: ${dmy(todayIso())}`],
    ['Official Number', 'Rate', 'Surname', 'First Name', 'Sex', 'Status', 'Branch', 'Staff Branch', 'Specialisation', 'Ship or Unit', 'Command', 'Area Office', 'Entry Mode',
      'State', 'Geo-Political Zone', 'Date of Birth', 'Seniority Date', 'Date Joined', 'Exit Date'],
    [15, 8, 20, 24, 6, 10, 22, 20, 22, 22, 24, 24, 20, 16, 20, 14, 14, 14, 14]);
  items.forEach((x) => ws.addRow([
    x.serviceNumber, x.rateCode, x.surname, x.firstName, x.sex ? x.sex[0] : '', x.status === 'current' ? 'Current' : 'Former', x.branch, x.staffBranch, x.specialisation, x.ship,
    x.command, x.areaOffice, x.entryMode, x.state, x.zone, dmy(x.dateOfBirth), dmy(x.seniorityDate), dmy(x.dateJoined), dmy(x.exitDate),
  ]));
  return buffer(wb);
}

// ---- 3. Disposition -------------------------------------------------------------------------------

/** The ships as groups, each rating under it: official no, surname, first name, rate, sex, trade, ship, area office, WEF. */
async function dispositionPdf({ rows, ships, summary, filters, asAt, generatedBy }) {
  const counts = new Map(ships.map((s) => [s.ship, s.total]));
  const out = [];
  let last = null;
  for (const x of rows) {
    if (x.ship !== last) { out.push({ group: `${x.ship}  (${plural(counts.get(x.ship) || 0, 'rating')})` }); last = x.ship; }
    out.push({ sn: x.serviceNumber, surname: x.surname, first: x.firstName, rate: x.rateCode, sex: x.sex, spec: x.specialisation, ship: x.ship, cmd: x.areaOffice, wef: x.wef });
  }
  const facts = [f('Area Office', filters.area)];
  if (some(filters.command)) facts.push(f('Command', filters.command));
  if (some(filters.specialisation)) facts.push(f('Trade', filters.specialisation));
  facts.push(f('As At', asAt, 'date'), f('Ships and Units', String(summary.ships)), f('Current Ratings', String(summary.ratings)));
  return renderPdf('disposition-report', {
    title: 'DISPOSITION REPORT',
    generatedBy,
    subtitle: `As at ${dmy(asAt)}`,
    facts,
    table: {
      dense: true,
      columns: [
        { label: 'Official No', key: 'sn', kind: 'code', w: '9%' }, { label: 'Surname', key: 'surname', kind: 'name', w: '14%' }, { label: 'First Name', key: 'first', w: '14%' },
        { label: 'Rate', key: 'rate', w: '6%' }, { label: 'Sex', key: 'sex', kind: 'ctr', w: '5%' }, { label: 'Trade', key: 'spec', w: '12%' },
        { label: 'Ship or Unit', key: 'ship', w: '13%' }, { label: 'Area Office', key: 'cmd', w: '17%' }, { label: 'WEF', key: 'wef', kind: 'date', w: '9%' },
      ],
      rows: out,
      empty: 'No current rating matches the filters.',
    },
    signatures: SIGNATURES,
  });
}

async function dispositionWorkbook({ rows, ships, summary, filters, asAt, generatedBy }) {
  const wb = workbook(generatedBy);
  const codes = summary.byRate.map((r) => r.code);
  const wsShips = sheet(wb, 'By Ship', 'Disposition Report: ships and units',
    [`Area Office: ${filters.area}`, `Command: ${filters.command}`, `Trade: ${filters.specialisation}`, `As at: ${dmy(asAt)}`],
    ['Ship or Unit', 'Ratings', ...codes], [30, 10, ...codes.map(() => 8)]);
  ships.forEach((s) => wsShips.addRow([s.ship, s.total, ...s.rates.map((r) => r.count)]));
  wsShips.addRow(['Total', summary.ratings, ...summary.byRate.map((r) => r.count)]).font = { bold: true };
  const ws = sheet(wb, 'Ratings', 'Disposition Report: ratings', [`Current ratings: ${summary.ratings}`, `As at: ${dmy(asAt)}`],
    ['Official Number', 'Surname', 'First Name', 'Rate', 'Sex', 'Trade', 'Ship or Unit', 'Area Office', 'Command', 'WEF'], [15, 20, 24, 8, 6, 22, 24, 26, 24, 12]);
  rows.forEach((x) => ws.addRow([x.serviceNumber, x.surname, x.firstName, x.rateCode, x.sex, x.specialisation, x.ship, x.areaOffice, x.command, dmy(x.wef)]));
  return buffer(wb);
}

// ---- 4. Nominal Roll ------------------------------------------------------------------------------

async function nominalRollPdf({ items, total, groups, ship, command, singleShip, branch, rate, asAt, generatedBy }) {
  const counts = new Map();
  items.forEach((x) => counts.set(x.ship, (counts.get(x.ship) || 0) + 1));
  const out = [];
  let last = null;
  let n = 0;
  for (const x of items) {
    if (!singleShip && x.ship !== last) { out.push({ group: `${x.ship}  (${plural(counts.get(x.ship), 'rating')})` }); last = x.ship; n = 0; }
    n += 1;
    out.push({ no: n, sn: x.serviceNumber, name: x.name, rate: x.rateCode, spec: x.specialisation, joined: x.joinedOn, months: x.months });
  }
  const heading = singleShip ? [ship, command].filter(Boolean).join(', ') : `${command}, every ship or unit`;
  return renderPdf('nominal-roll', {
    title: 'NOMINAL ROLL',
    generatedBy,
    subtitle: heading,
    summary: [{ label: 'Total', value: total }, ...groups.map((g) => ({ label: g.code, value: g.count }))],
    facts: [f('Ship or Unit', singleShip ? ship : 'Every ship or unit'), f('Command', command || 'N/A'), f('As At', asAt, 'date'), f('Branch', branch), f('Rate', rate), f('Ratings', String(total))],
    table: {
      columns: [
        { label: 'No', key: 'no', kind: 'ctr', w: '5%' }, { label: 'Official No', key: 'sn', kind: 'code', w: '11%' }, { label: 'Name', key: 'name', kind: 'name' },
        { label: 'Rate', key: 'rate', w: '8%' }, { label: 'Specialisation', key: 'spec', w: '19%' }, { label: 'Joined Ship', key: 'joined', kind: 'date', w: '12%' },
        { label: 'Months', key: 'months', kind: 'num', w: '8%' },
      ],
      rows: out,
      empty: 'No rating is serving here with these filters.',
    },
    signatures: SIGNATURES,
  });
}

async function nominalRollWorkbook({ items, total, groups, ship, command, singleShip, asAt, generatedBy }) {
  const wb = workbook(generatedBy);
  const ws = sheet(wb, 'Nominal Roll', 'Nominal Roll',
    [`Ship or Unit: ${singleShip ? ship : 'Every ship or unit'}`, `Command: ${command || 'N/A'}`, `Ratings: ${total}`, groups.map((g) => `${g.code} ${g.count}`).join('  '), `As at: ${dmy(asAt)}`],
    ['Official Number', 'Name', 'Rate', 'Sex', 'Branch', 'Specialisation', 'Ship or Unit', 'Command', 'Seniority Date', 'Joined Ship', 'Months on Ship'],
    [15, 32, 8, 6, 22, 24, 24, 24, 14, 14, 14]);
  items.forEach((x) => ws.addRow([x.serviceNumber, x.name, x.rateCode, x.sex ? x.sex[0] : '', x.branch, x.specialisation, x.ship, x.command, dmy(x.seniorityDate), dmy(x.joinedOn), x.months]));
  return buffer(wb);
}

// ---- 5. Manning State -----------------------------------------------------------------------------

/** Drafting's own Manning Requirement Report, with the lines of the ships these filters leave. */
function manningStatePdf({ label, lines, generatedBy }) {
  return manningPdf({ ship: label, rows: lines, generatedBy });
}

const STATE_TEXT = { short: 'Short', over: 'Over', exact: 'Exact' };

async function manningStateWorkbook({ label, ships, lines, asAt, generatedBy }) {
  const wb = workbook(generatedBy);
  const wsShips = sheet(wb, 'By Ship', 'Manning State: ships and units', [`Covers: ${label}`, `As at: ${dmy(asAt)}`],
    ['Ship or Unit', 'Required', 'Borne', 'Difference', 'State'], [30, 10, 10, 12, 10]);
  ships.forEach((s) => wsShips.addRow([s.ship, s.required, s.borne, diffText(s.difference), STATE_TEXT[s.state]]));
  const ws = sheet(wb, 'Lines', 'Manning State: rate and specialisation', [`Covers: ${label}`, `As at: ${dmy(asAt)}`],
    ['Ship or Unit', 'Rate', 'Specialisation', 'Required', 'Borne', 'Difference', 'State'], [30, 8, 26, 10, 10, 12, 10]);
  lines.forEach((l) => ws.addRow([l.ship, l.rateCode, l.specialisation, l.required, l.aboard, diffText(l.difference), STATE_TEXT[l.difference < 0 ? 'short' : l.difference > 0 ? 'over' : 'exact']]));
  return buffer(wb);
}

// ---- 6. Retirement Forecast -----------------------------------------------------------------------

async function retirementForecastPdf({ items, total, quarters, months, ageDue, serviceDue, branch, rate, ship, dueToday, asAt, generatedBy }) {
  return renderPdf('retirement-forecast', {
    title: 'RETIREMENT FORECAST',
    generatedBy,
    subtitle: `Due for discharge in the next ${months} months, as at ${dmy(asAt)}`,
    summary: [{ label: `Due in ${months} months`, value: total }, ...quarters.map((q) => ({ label: q.label, value: q.count }))],
    facts: [f('Period', `Next ${months} months`), f('Branch', branch), f('Rate', rate), f('Ship or Unit', ship), f('Due in Period', String(total)), f('Already Due Today', String(dueToday))],
    table: {
      dense: true,
      columns: [
        { label: 'No', key: 'no', kind: 'ctr', w: '5%' }, { label: 'Official No', key: 'sn', kind: 'code', w: '10%' }, { label: 'Name', key: 'name', kind: 'name', w: '26%' },
        { label: 'Rate', key: 'rate', w: '7%' }, { label: 'Ship or Unit', key: 'ship', w: '20%' }, { label: 'Becomes Due', key: 'due', kind: 'date', w: '12%' }, { label: 'Why', key: 'why' },
      ],
      rows: items.map((x, i) => ({ no: i + 1, sn: x.serviceNumber, name: x.name, rate: x.rateCode, ship: x.ship, due: x.dueOn, why: x.whyText })),
      empty: `No rating becomes due in the next ${months} months.`,
    },
    note: `A rating is due at age ${ageDue} or after ${serviceDue} years of service, whichever comes first (the placeholder rule in Discharge's settings). ${dueToday} ${dueToday === 1 ? 'rating is' : 'ratings are'} already due today and ${dueToday === 1 ? 'is' : 'are'} not listed: see Process Discharge.`,
    signatures: SIGNATURES,
  });
}

async function retirementForecastWorkbook({ items, total, quarters, months, ageDue, serviceDue, dueToday, asAt, generatedBy }) {
  const wb = workbook(generatedBy);
  const ws = sheet(wb, 'Retirement Forecast', 'Retirement Forecast',
    [`Due in the next ${months} months: ${total}`, quarters.map((q) => `${q.label}: ${q.count}`).join('  '), `Already due today (not listed): ${dueToday}`,
      `Rule: age ${ageDue} or ${serviceDue} years of service, whichever comes first`, `As at: ${dmy(asAt)}`],
    ['Official Number', 'Name', 'Rate', 'Ship or Unit', 'Becomes Due', 'Why', 'Age Reached On', 'Service Reached On', 'Date of Birth', 'Date Joined'],
    [15, 32, 8, 24, 14, 32, 16, 18, 14, 14]);
  items.forEach((x) => ws.addRow([x.serviceNumber, x.name, x.rateCode, x.ship, dmy(x.dueOn), x.whyText, dmy(x.ageDueOn), dmy(x.serviceDueOn), dmy(x.dateOfBirth), dmy(x.dateEmployed)]));
  return buffer(wb);
}

module.exports = {
  shipHistoryWorkbook, personnelPdf, personnelWorkbook, dispositionPdf, dispositionWorkbook, nominalRollPdf, nominalRollWorkbook,
  manningStatePdf, manningStateWorkbook, retirementForecastPdf, retirementForecastWorkbook,
};
