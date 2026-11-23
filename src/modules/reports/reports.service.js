'use strict';

/*
 * Reports (WP9): six read-only pages. Each page's filters are read, checked and turned into one query (reports.repo.js)
 * that feeds the page (25 a page), its PDF and its workbook, so the three never disagree. Nothing here writes.
 *
 *   Ship History         a ship and a period: the ratings posted to it, from the postings (workbook only)
 *   All Personnel        the Ratings Report: current, former or all, with the filters the old page had that work
 *   Disposition          where the current ratings serve, by ship or unit and rate
 *   Nominal Roll         the ratings serving now on one ship or unit, or on every ship of a command
 *   Manning State        every ship's manning requirement against who is aboard (Drafting's own count)
 *   Retirement Forecast  who becomes due for discharge in the next 6, 12 or 24 months (Discharge's own rule)
 */
const { validationError } = require('../../shared/errors');
const { parseIsoDate } = require('../../shared/dates');
const { dmy, isoDay, todayIso } = require('../drafting/drafting.format');
const dischargeService = require('../discharge/discharge.service');
const repo = require('./reports.repo');

const PAGE_SIZE = 25;
const PDF_MAX = 3000; // a printout holds this many lines at most; above it the person narrows the filters
const XLSX_MAX = 50000;

const text = (v) => (v === undefined || v === null ? '' : String(v).trim());
const idOrNull = (v) => { const n = Number.parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };
const pageOf = (q) => Math.max(1, Number.parseInt(q.page, 10) || 1);
const meta = (total, page, pageSize = PAGE_SIZE) => ({ total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
const nameOf = (r) => [String(r.surname || '').toUpperCase(), r.first_name, r.middle_name].filter(Boolean).join(' ');
const rateOf = (r) => r.rate_code || r.rate_name || '';
const sexOf = (g) => (g ? String(g)[0].toUpperCase() : '');
const yearsMonths = (m) => (m === null || m === undefined ? '' : `${Math.floor(m / 12)} yr ${m % 12} mo`);

/** What a printout or workbook of `total` lines may be, or a message that asks the person to narrow the filters. */
function printLimit(total, kind) {
  const max = kind === 'pdf' ? PDF_MAX : XLSX_MAX;
  if (total > max) {
    throw validationError(`There are ${total.toLocaleString()} lines: too many to ${kind === 'pdf' ? 'print in one PDF' : 'export in one file'} (the limit is ${max.toLocaleString()}). Narrow the filters.`);
  }
}

function checkDate(raw, key, label, fields) {
  const v = text(raw);
  if (!v) return null;
  const p = parseIsoDate(v);
  if (!p.valid || !p.value) { fields[key] = `${label} is not a date. Use dd/mm/yyyy.`; return null; }
  return p.value;
}

async function options() {
  const o = await repo.options();
  const act = (rows) => rows.map((x) => ({ id: x.id, name: x.name, code: x.code, active: !!x.is_active }));
  return {
    ships: o.ships.map((s) => ({ id: s.id, name: s.name, type: s.type, commandId: s.command_id, active: !!s.is_active })),
    commands: act(o.commands),
    branches: act(o.branches),
    rates: o.rates.map((x) => ({ id: x.id, name: x.name, code: x.code })),
    specialisations: act(o.specialisations),
    areas: act(o.areas),
    staffBranches: act(o.staffBranches),
    entryModes: act(o.entryModes),
    states: act(o.states),
    zones: act(o.zones),
    sorts: [
      { value: 'number', label: 'Official Number' }, { value: 'name', label: 'Name' }, { value: 'dob', label: 'Date of Birth' },
      { value: 'branch', label: 'Branch' }, { value: 'ship', label: 'Ship or Unit' }, { value: 'specialisation', label: 'Specialisation' },
      { value: 'rate', label: 'Rate (Highest First)' }, { value: 'seniority', label: 'Seniority Date' }, { value: 'state', label: 'State' },
    ],
    today: todayIso(),
  };
}

/** The name of a reference row, for a printout's filter line ("All" when none is chosen). */
async function labelOf(table, id, all = 'All') {
  return id ? (await repo.refName(table, id)) || all : all;
}

// =====================================================================================================
// 1. Ship History
// =====================================================================================================

function shipFilters(q) {
  const fields = {};
  const shipId = idOrNull(q.shipId);
  if (!shipId) fields.shipId = 'Choose the ship or unit.';
  const from = checkDate(q.from, 'from', 'From', fields);
  const to = checkDate(q.to, 'to', 'To', fields);
  if (from && to && from > to) fields.from = 'From is after To. Swap the dates.';
  if (Object.keys(fields).length) throw validationError(Object.values(fields)[0], fields);
  return { shipId, from, to, today: todayIso() };
}

function shapePosting(x) {
  return {
    id: x.id,
    serviceNumber: x.service_number,
    name: nameOf(x),
    rate: x.rate_name || '',
    rateCode: x.rate_code || x.rate_name || '',
    specialisation: x.specialisation_name || '',
    from: x.start_date || '',
    to: x.end_date || '',
    aboard: !x.end_date,
    months: x.months === null || x.months === undefined ? null : Number(x.months),
    tour: yearsMonths(x.months === null || x.months === undefined ? null : Number(x.months)),
    status: x.status,
    remarks: x.remarks || '',
  };
}

async function shipHistory(q = {}) {
  const f = shipFilters(q);
  const page = pageOf(q);
  const r = await repo.shipHistory(f, { page, pageSize: PAGE_SIZE });
  return {
    items: r.items.map(shapePosting),
    summary: {
      postings: r.total, aboard: r.aboard,
      averageMonths: r.avgMonths === null ? null : Math.round(r.avgMonths), averageTour: r.avgMonths === null ? '' : yearsMonths(Math.round(r.avgMonths)),
    },
    meta: meta(r.total, page),
  };
}

async function shipHistoryForPrint(q = {}, kind = 'excel') {
  const f = shipFilters(q);
  const probe = await repo.shipHistory(f, { page: 1, pageSize: 1 });
  printLimit(probe.total, kind);
  const r = await repo.shipHistory(f, { pageSize: 0 });
  const ship = await labelOf('ref_ship', f.shipId);
  return {
    ship,
    period: f.from || f.to ? `${f.from ? dmy(f.from) : 'Start'} to ${f.to ? dmy(f.to) : dmy(f.today)}` : 'All dates',
    items: r.items.map(shapePosting),
    total: r.total,
    aboard: r.aboard,
    averageTour: r.avgMonths === null ? '' : yearsMonths(Math.round(r.avgMonths)),
  };
}

// =====================================================================================================
// 2. All Personnel
// =====================================================================================================

function personFilters(q) {
  const status = text(q.status).toLowerCase();
  if (status && !['current', 'former', 'all'].includes(status)) throw validationError('Choose Current, Former or All.', { status: 'Choose Current, Former or All.' });
  const sort = text(q.sort);
  if (sort && !repo.PERSON_SORT_KEYS.includes(sort)) throw validationError('Choose a sort from the list.', { sort: 'Choose a sort from the list.' });
  return {
    status: status || 'all',
    rateId: idOrNull(q.rateId),
    branchId: idOrNull(q.branchId),
    commandId: idOrNull(q.commandId),
    shipId: idOrNull(q.shipId),
    staffBranchId: idOrNull(q.staffBranchId),
    specialisationId: idOrNull(q.specialisationId),
    entryModeId: idOrNull(q.entryModeId),
    stateId: idOrNull(q.stateId),
    zoneId: idOrNull(q.zoneId),
    sort: sort || 'number',
  };
}

function shapePerson(x) {
  return {
    serviceNumber: x.service_number,
    name: nameOf(x),
    surname: String(x.surname || '').toUpperCase(),
    firstName: [x.first_name, x.middle_name].filter(Boolean).join(' '),
    rate: x.rate_name || '',
    rateCode: x.rate_code || x.rate_name || '',
    status: x.status,
    sex: x.gender || '',
    branch: x.branch_name || '',
    staffBranch: x.staff_branch_name || '',
    specialisation: x.specialisation_name || '',
    ship: x.ship_name || '',
    command: x.command_name || '',
    areaOffice: x.area_name || '',
    entryMode: x.entry_mode_name || '',
    state: x.state_name || '',
    zone: x.zone_name || '',
    dateOfBirth: x.date_of_birth || '',
    seniorityDate: x.seniority_date || '',
    dateJoined: x.date_employed || '',
    exitDate: x.exit_date || '',
  };
}

async function personnel(q = {}) {
  const f = personFilters(q);
  const page = pageOf(q);
  const r = await repo.personnel(f, { page, pageSize: PAGE_SIZE });
  return { items: r.items.map(shapePerson), summary: { personnel: r.total, current: r.current, former: r.former }, meta: meta(r.total, page) };
}

const STATUS_TEXT = { all: 'All', current: 'Current', former: 'Former' };

async function personnelForPrint(q = {}, kind = 'pdf') {
  const f = personFilters(q);
  const r = await repo.personnel(f, { pageSize: 0 });
  printLimit(r.total, kind);
  const [rate, branch, command, ship, staffBranch, specialisation, entryMode, state, zone] = await Promise.all([
    labelOf('ref_rate', f.rateId), labelOf('ref_branch', f.branchId), labelOf('ref_command', f.commandId), labelOf('ref_ship', f.shipId),
    labelOf('ref_staff_branch', f.staffBranchId), labelOf('ref_specialisation', f.specialisationId), labelOf('ref_entry_mode', f.entryModeId),
    labelOf('ref_state', f.stateId), labelOf('ref_geo_political_zone', f.zoneId),
  ]);
  return {
    items: r.items.map(shapePerson),
    total: r.total,
    filters: { status: STATUS_TEXT[f.status], rate, branch, command, ship, staffBranch, specialisation, entryMode, state, zone },
    subtitle: [STATUS_TEXT[f.status] === 'All' ? 'Current and former ratings' : `${STATUS_TEXT[f.status]} ratings`, command === 'All' ? '' : command].filter(Boolean).join(', '),
  };
}

// =====================================================================================================
// 3. Disposition
// =====================================================================================================

function dispositionFilters(q) {
  return { commandId: idOrNull(q.commandId), areaId: idOrNull(q.areaId), specialisationId: idOrNull(q.specialisationId) };
}

/** The ships (or units) with their counts by rate, in name order, with the figures of the whole selection. */
async function dispositionAll(f) {
  const [rows, rates] = await Promise.all([repo.dispositionCounts(f), repo.allRates()]);
  const byShip = new Map();
  for (const x of rows) {
    const key = x.ship_id === null ? 0 : x.ship_id;
    if (!byShip.has(key)) byShip.set(key, { shipId: x.ship_id, ship: x.ship_name || 'No ship or unit recorded', type: x.ship_type || '', total: 0, counts: new Map() });
    const s = byShip.get(key);
    s.total += Number(x.n);
    s.counts.set(x.rate_id, (s.counts.get(x.rate_id) || 0) + Number(x.n));
  }
  const unrated = (s) => s.total - [...s.counts.entries()].reduce((a, [id, n]) => a + (id === null ? 0 : n), 0);
  const ships = [...byShip.values()].map((s) => ({
    shipId: s.shipId, ship: s.ship, type: s.type, total: s.total,
    rates: rates.map((r) => ({ rateId: r.id, code: r.code || r.name, name: r.name, count: s.counts.get(r.id) || 0 })),
    noRate: unrated(s),
  }));
  const max = Math.max(1, ...ships.map((s) => s.total));
  ships.forEach((s) => { s.share = Math.round((s.total / max) * 100); });
  const total = ships.reduce((a, s) => a + s.total, 0);
  const largest = ships.reduce((best, s) => (!best || s.total > best.total ? s : best), null);
  return {
    ships,
    summary: {
      ships: ships.length,
      ratings: total,
      largest: largest ? largest.ship : '',
      byRate: rates.map((r) => ({ rateId: r.id, code: r.code || r.name, name: r.name, count: ships.reduce((a, s) => a + (s.rates.find((x) => x.rateId === r.id) || { count: 0 }).count, 0) })),
    },
  };
}

async function disposition(q = {}) {
  const f = dispositionFilters(q);
  const page = pageOf(q);
  const r = await dispositionAll(f);
  return { items: r.ships.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), summary: r.summary, meta: meta(r.ships.length, page) };
}

async function dispositionForPrint(q = {}, kind = 'pdf') {
  const f = dispositionFilters(q);
  const r = await dispositionAll(f);
  printLimit(r.summary.ratings, kind);
  const rows = await repo.dispositionRows(f);
  const [command, area, specialisation] = await Promise.all([
    labelOf('ref_command', f.commandId), labelOf('ref_mother_base', f.areaId), labelOf('ref_specialisation', f.specialisationId),
  ]);
  return {
    asAt: todayIso(),
    filters: { command, area, specialisation },
    summary: r.summary,
    ships: r.ships,
    rows: rows.map((x) => ({
      serviceNumber: x.service_number, surname: String(x.surname || '').toUpperCase(), firstName: [x.first_name, x.middle_name].filter(Boolean).join(' '),
      rateCode: rateOf(x), sex: sexOf(x.gender), specialisation: x.specialisation_name || '', ship: x.ship_name || 'No ship or unit recorded',
      areaOffice: x.area_name || '', command: x.command_name || '', wef: x.wef || '',
    })),
  };
}

// =====================================================================================================
// 4. Nominal Roll
// =====================================================================================================

function rollFilters(q) {
  const f = { commandId: idOrNull(q.commandId), shipId: idOrNull(q.shipId), branchId: idOrNull(q.branchId), rateId: idOrNull(q.rateId), today: todayIso() };
  if (!f.shipId && !f.commandId) {
    const msg = 'Choose a ship or unit, or a command.';
    throw validationError(msg, { shipId: msg, commandId: msg });
  }
  return f;
}

function shapeRoll(x) {
  return {
    serviceNumber: x.service_number,
    name: nameOf(x),
    rate: x.rate_name || '',
    rateCode: x.rate_code || x.rate_name || '',
    sex: x.gender || '',
    branch: x.branch_name || '',
    specialisation: x.specialisation_name || '',
    shipId: x.ship_id,
    ship: x.ship_name || '',
    command: x.command_name || '',
    seniorityDate: x.seniority_date || '',
    joinedOn: x.joined_on || '',
    months: x.months === null || x.months === undefined ? null : Number(x.months),
  };
}

/** The rate groups of the roll, highest rate first, with how many are in each. */
async function rollGroups(byRate) {
  const rates = await repo.allRates();
  return rates.slice().reverse()
    .map((r) => ({ rateId: r.id, code: r.code || r.name, name: r.name, count: Number((byRate.find((x) => x.rate_id === r.id) || {}).n || 0) }))
    .filter((g) => g.count > 0);
}

async function nominalRoll(q = {}) {
  const f = rollFilters(q);
  const page = pageOf(q);
  const r = await repo.nominalRoll(f, { page, pageSize: PAGE_SIZE });
  return { items: r.items.map(shapeRoll), summary: { total: r.total, groups: await rollGroups(r.byRate) }, meta: meta(r.total, page) };
}

async function nominalRollForPrint(q = {}, kind = 'pdf') {
  const f = rollFilters(q);
  const probe = await repo.nominalRoll(f, { page: 1, pageSize: 1 });
  printLimit(probe.total, kind);
  const r = await repo.nominalRoll(f, { pageSize: 0 });
  const [ship, command, branch, rate] = await Promise.all([
    labelOf('ref_ship', f.shipId), labelOf('ref_command', f.commandId), labelOf('ref_branch', f.branchId), labelOf('ref_rate', f.rateId),
  ]);
  const items = r.items.map(shapeRoll);
  // the command a single ship belongs to, for the heading
  const shipCommand = f.shipId && !f.commandId && items[0] ? items[0].command : command;
  return {
    asAt: f.today,
    ship: f.shipId ? ship : 'Every ship or unit',
    command: f.commandId ? command : (shipCommand === 'All' ? '' : shipCommand),
    singleShip: !!f.shipId,
    branch,
    rate,
    items,
    total: r.total,
    groups: await rollGroups(r.byRate),
  };
}

// =====================================================================================================
// 5. Manning State
// =====================================================================================================

const diffText = (d) => (d > 0 ? `+${d}` : String(d));
const stateOf = (d) => (d < 0 ? 'short' : d > 0 ? 'over' : 'exact');

function manningFilters(q) {
  const shortOnly = text(q.short).toLowerCase();
  return {
    commandId: idOrNull(q.commandId), shipId: idOrNull(q.shipId), rateId: idOrNull(q.rateId), specialisationId: idOrNull(q.specialisationId),
    shortOnly: shortOnly === '1' || shortOnly === 'true' || shortOnly === 'yes',
  };
}

/**
 * One row per ship with its totals and its lines. "Borne" is Drafting's own aboard count (the same query as Update
 * Manning Requirement, so the two pages cannot disagree); a ship is short when it bears fewer than it requires.
 */
async function manningShips(f) {
  const lines = await repo.manningLines(f);
  const byShip = new Map();
  for (const m of lines) {
    if (!byShip.has(m.ship_id)) byShip.set(m.ship_id, { shipId: m.ship_id, ship: m.ship_name, required: 0, borne: 0, lines: [] });
    const s = byShip.get(m.ship_id);
    const borne = Number(m.aboard || 0);
    s.required += Number(m.quantity);
    s.borne += borne;
    s.lines.push({
      rateId: m.rate_id, rate: m.rate_name, rateCode: m.rate_code || m.rate_name, specialisationId: m.specialisation_id, specialisation: m.specialisation_name,
      required: Number(m.quantity), borne, difference: borne - Number(m.quantity), state: stateOf(borne - Number(m.quantity)),
    });
  }
  let ships = [...byShip.values()].map((s) => ({ ...s, difference: s.borne - s.required, state: stateOf(s.borne - s.required) }));
  if (f.shortOnly) ships = ships.filter((s) => s.state === 'short');
  return ships;
}

async function manningState(q = {}) {
  const f = manningFilters(q);
  const page = pageOf(q);
  const ships = await manningShips(f);
  return {
    items: ships.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    summary: {
      ships: ships.length,
      required: ships.reduce((a, s) => a + s.required, 0),
      borne: ships.reduce((a, s) => a + s.borne, 0),
      short: ships.filter((s) => s.state === 'short').length,
    },
    meta: meta(ships.length, page),
  };
}

async function manningStateForPrint(q = {}, kind = 'pdf') {
  const f = manningFilters(q);
  const ships = await manningShips(f);
  const lineCount = ships.reduce((a, s) => a + s.lines.length, 0);
  printLimit(lineCount, kind);
  const [ship, command, rate, specialisation] = await Promise.all([
    labelOf('ref_ship', f.shipId, ''), labelOf('ref_command', f.commandId, ''), labelOf('ref_rate', f.rateId, ''), labelOf('ref_specialisation', f.specialisationId, ''),
  ]);
  // the Manning Requirement Report's own label for what is covered
  const label = (ship || (command ? `${command}, every ship or unit` : 'All')) + (f.shortOnly ? ' (short only)' : '');
  const lines = ships.flatMap((s) => s.lines.map((l) => ({ ship: s.ship, shipId: s.shipId, rateCode: l.rateCode, rate: l.rate, specialisation: l.specialisation, required: l.required, aboard: l.borne, difference: l.difference })));
  return { label, ships, lines, command, rate, specialisation, shortOnly: f.shortOnly, asAt: todayIso() };
}

// =====================================================================================================
// 6. Retirement Forecast
// =====================================================================================================

const PERIODS = [6, 12, 24];

async function forecastFilters(q) {
  const months = q.months === undefined || q.months === '' ? 12 : Number.parseInt(q.months, 10);
  if (!PERIODS.includes(months)) throw validationError('Choose 6, 12 or 24 months.', { months: 'Choose 6, 12 or 24 months.' });
  const rule = await dischargeService.rule();
  return {
    months, today: todayIso(), ageDue: rule['discharge.age_due'], serviceDue: rule['discharge.service_due'],
    branchId: idOrNull(q.branchId), rateId: idOrNull(q.rateId), shipId: idOrNull(q.shipId),
  };
}

function shapeForecast(x, f) {
  const due = isoDay(x.due_on);
  const age = isoDay(x.age_due_on);
  const service = isoDay(x.service_due_on);
  const byAge = !!age && age === due;
  const byService = !!service && service === due;
  const why = byAge && byService ? 'both' : byAge ? 'age' : 'service';
  const whyText = why === 'both' ? `Age ${f.ageDue} and ${f.serviceDue} years of service` : why === 'age' ? `Age ${f.ageDue}` : `${f.serviceDue} years of service`;
  return {
    serviceNumber: x.service_number,
    name: nameOf(x),
    rate: x.rate_name || '',
    rateCode: x.rate_code || x.rate_name || '',
    ship: x.ship_name || '',
    dueOn: due,
    why,
    whyText,
    ageDueOn: age,
    serviceDueOn: service,
    dateOfBirth: x.date_of_birth || '',
    dateEmployed: x.date_employed || '',
  };
}

const quarterLabels = (n) => Array.from({ length: n }, (_, i) => (i === 0 ? 'Months 1 to 3' : `Months ${i * 3 + 1} to ${(i + 1) * 3}`));

async function retirementForecast(q = {}) {
  const f = await forecastFilters(q);
  const page = pageOf(q);
  const [r, dueToday] = await Promise.all([repo.forecast(f, { page, pageSize: PAGE_SIZE }), repo.dueToday(f)]);
  const labels = quarterLabels(r.quarters.length);
  return {
    items: r.items.map((x) => shapeForecast(x, f)),
    summary: {
      due: r.total, dueToday, months: f.months, ageDue: f.ageDue, serviceDue: f.serviceDue,
      quarters: r.quarters.map((count, i) => ({ label: labels[i], count })),
    },
    meta: meta(r.total, page),
  };
}

async function retirementForecastForPrint(q = {}, kind = 'pdf') {
  const f = await forecastFilters(q);
  const probe = await repo.forecast(f, { page: 1, pageSize: 1 });
  printLimit(probe.total, kind);
  const [r, dueToday] = await Promise.all([repo.forecast(f, { pageSize: 0 }), repo.dueToday(f)]);
  const [branch, rate, ship] = await Promise.all([labelOf('ref_branch', f.branchId), labelOf('ref_rate', f.rateId), labelOf('ref_ship', f.shipId)]);
  const labels = quarterLabels(r.quarters.length);
  return {
    asAt: f.today, months: f.months, ageDue: f.ageDue, serviceDue: f.serviceDue, branch, rate, ship, dueToday, total: r.total,
    quarters: r.quarters.map((count, i) => ({ label: labels[i], count })),
    items: r.items.map((x) => shapeForecast(x, f)),
  };
}

module.exports = {
  PAGE_SIZE, PDF_MAX, XLSX_MAX, diffText, yearsMonths, sexOf,
  options, shipHistory, shipHistoryForPrint, personnel, personnelForPrint, disposition, dispositionForPrint,
  nominalRoll, nominalRollForPrint, manningState, manningStateForPrint, retirementForecast, retirementForecastForPrint,
};
