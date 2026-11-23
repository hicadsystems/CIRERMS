#!/usr/bin/env node
'use strict';

/*
 * Walk-through of the Reports module (WP9): Ship History, All Personnel, Disposition, Nominal Roll, Manning State and
 * Retirement Forecast. Uses the Playwright installed on the machine (not a project dependency):
 *
 *   npm run migrate:fresh && npm run seed       # a fresh demo database
 *   npm start                                   # the app on :3000
 *   NODE_PATH=$(npm root -g) node tests/e2e/reports-walkthrough.js
 *
 * BASE changes the address; SHOTS=<dir> saves screenshots there. It reads .env for the database: what the pages show is
 * compared with what the tables hold, and the audit trail is checked to be untouched (the reports only read). Exits
 * non-zero when a check fails. Browser errors fail the run.
 *
 * Through the API as the Administrator: Ship History (a ship is required, the period, the Aboard figure, the workbook,
 * no PDF), All Personnel (every filter against the tables, status, sort, paging, the workbook and PDF from the same
 * query), Disposition (counts by ship and rate, the filters), Nominal Roll (a ship or a command is required, the order,
 * the rate groups), Manning State (borne equals Drafting's own count, Short only, the filters), Retirement Forecast
 * (6, 12 and 24 months, the rule read from the settings, nobody Process Discharge already lists, the exclusions);
 * the printouts and workbooks; the privileges (the Report role reads, a rating and a drafting officer get 403).
 * Through the screens at 1440 px, light: each page, its filters, its dialog, its printout in the preview and its
 * workbook, Ctrl K and the tabs. Then each layout (1440 and 390 px, light and dark) draws every page and its main
 * dialog with nothing overflowing.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mysql = require('mysql2/promise');
const ExcelJS = require('exceljs');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:3000';
const SHOTS = process.env.SHOTS || '';
const ADMIN = { username: 'HICO001', password: 'Admin@123' };
const REPORT = { username: 'B1301', password: 'Admin@123' }; // the old Report role
const DRAFTING = { username: 'B0705', password: 'Admin@123' }; // Drafting: no Reports grant
const RATING = { username: 'B0539', password: 'Rating@123' };
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const STARTED = Date.now();
const LIMIT_SECONDS = 300; // the owner's rule: a walk-through runs in five minutes at most
let failures = 0;
let passes = 0;
function check(ok, label, detail = '') {
  if (ok) { passes += 1; console.log(`  ok    ${label}`); } else { failures += 1; console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`); }
}

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function open(browser, { viewport, theme }) {
  const phone = viewport.width < 700;
  const context = await browser.newContext({ viewport, colorScheme: theme, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone, acceptDownloads: true });
  const errors = [];
  const expected = new Set([401, 403, 404, 409, 422]); // refusals the walk-through provokes on purpose
  context.on('page', (p) => watch(p));
  function watch(p) {
    p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    p.on('console', (m) => {
      if (m.type() !== 'error') return;
      const status = Number((/status of (\d{3})/.exec(m.text()) || [])[1]);
      if (expected.has(status)) return;
      errors.push(`console: ${m.text()}`);
    });
  }
  const page = await context.newPage();
  return { context, page, errors, phone, theme };
}

async function signIn(page, who) {
  await page.goto(`${BASE}/index.html`);
  await page.fill('#username', who.username);
  await page.fill('#password', who.password);
  await Promise.all([page.waitForURL(/app\.html/), page.click('#login-submit')]);
  await page.waitForSelector('#app-main h1, #app-main h2', { timeout: 15000 });
}

const api = (page, method, url, data) => page.evaluate(async ({ method, url, data }) => {
  const res = await fetch(url, { method, credentials: 'include', headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined });
  let body = null;
  try { body = await res.json(); } catch (_) { body = null; }
  return { status: res.status, body };
}, { method, url, data });

const fileHead = (page, url) => page.evaluate(async (u) => {
  const res = await fetch(u, { credentials: 'include' });
  const buf = new Uint8Array(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get('content-type'), disposition: res.headers.get('content-disposition'), head: String.fromCharCode(...buf.slice(0, 4)), size: buf.length };
}, url);

async function workbookOf(page, url) {
  const bytes = await page.evaluate(async (u) => { const r = await fetch(u, { credentials: 'include' }); return Array.from(new Uint8Array(await r.arrayBuffer())); }, url);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(bytes));
  return wb;
}
const dataRows = (ws) => { let n = 0; ws.eachRow((r, i) => { if (i > 4) n += 1; }); return n; };
const headerOf = (ws) => ws.getRow(4).values.slice(1);

const dialogOf = (page) => page.locator('#overlay-root [role="dialog"]').last();
const dialogs = (page) => page.locator('#overlay-root [role="dialog"]');
const main = (page) => page.locator('#app-main');

async function settle(page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForFunction(() => !document.querySelector('#app-main')?.textContent.includes('Loading'), null, { timeout: 15000 });
}
async function go(page, route) {
  await page.goto(`${BASE}/app.html#${route}`);
  await page.waitForFunction(() => document.querySelector('#app-main h1'), null, { timeout: 15000 });
  await settle(page);
}
const rowsOf = (page, phone) => (phone ? page.locator('#app-main .desk\\:hidden > div > button') : page.locator('#app-main table tbody tr[tabindex]'));
async function rowTexts(page, phone) {
  const rows = rowsOf(page, phone);
  const n = await rows.count();
  const out = [];
  for (let i = 0; i < n; i += 1) out.push((await rows.nth(i).innerText()).replace(/\s+/g, ' '));
  return out;
}
async function toastText(page, re) {
  const t = page.locator('#toast-root [role]', { hasText: re }).last();
  await t.waitFor({ timeout: 10000 });
  const text = await t.innerText();
  await t.getByRole('button', { name: 'Dismiss' }).click().catch(() => {});
  return text;
}

async function choose(page, scope, name, label) {
  await scope.locator(`.custom-dropdown-wrapper[name="${name}"] input:not(.custom-dropdown-hidden)`).first().click();
  if (typeof label === 'string' && /^All /.test(label)) { await page.locator('.custom-dropdown-list:visible .cdd-placeholder').first().click(); return; }
  const options = page.locator('.custom-dropdown-list:visible .custom-dropdown-item:not(.cdd-placeholder)');
  await options.first().waitFor();
  if (label) await options.filter({ hasText: label }).first().click();
  else await options.first().click();
}
async function openFilters(page, phone) {
  if (!phone) return;
  const panelHidden = await page.locator('#app-main [data-filters] > div').last().isHidden();
  if (panelHidden) await page.locator('#app-main [data-filters] button', { hasText: 'Filters' }).click();
}
async function filterSelect(page, phone, name, label) {
  await openFilters(page, phone);
  await choose(page, page.locator('#app-main [data-filters]'), name, label);
  await settle(page);
}
/** What a filter's dropdown shows now: the picked name, or its placeholder when nothing is picked. */
const pickedOf = (page, name) => page.locator(`#app-main [data-filters] .custom-dropdown-wrapper[name="${name}"] input:not(.custom-dropdown-hidden)`).first()
  .evaluate((i) => i.value || i.getAttribute('placeholder') || '');

/** The names offered by a filter's dropdown (it is opened and closed again). */
async function optionsOf(page, name) {
  await page.locator(`#app-main [data-filters] .custom-dropdown-wrapper[name="${name}"] input:not(.custom-dropdown-hidden)`).first().click();
  const items = page.locator('.custom-dropdown-list:visible .custom-dropdown-item:not(.cdd-placeholder)');
  await items.first().waitFor();
  const texts = (await items.allInnerTexts()).map((t) => t.trim());
  await page.keyboard.press('Escape');
  return texts;
}
async function closeTop(page) {
  const n = await dialogs(page).count();
  await page.keyboard.press('Escape');
  await page.waitForFunction((k) => document.querySelectorAll('#overlay-root [role="dialog"]').length < k, n, { timeout: 5000 });
}
async function closeAll(page) {
  for (let i = 0; i < 4 && (await dialogs(page).count()); i += 1) await closeTop(page);
}

async function noOverflow(page, label) {
  const wide = await page.evaluate(() => {
    const over = Array.from(document.querySelectorAll('#app-main *')).filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'auto' && e.closest('table')).length;
    return { page: document.documentElement.scrollWidth - window.innerWidth, main: document.querySelector('#app-main').scrollWidth - document.querySelector('#app-main').clientWidth, tables: over };
  });
  check(wide.page <= 1 && wide.main <= 1 && wide.tables === 0, `${label}: nothing scrolls sideways`, JSON.stringify(wide));
}

/** The printout opens in the app's own preview with its pages drawn. */
async function previewOpens(page, label) {
  await dialogOf(page).locator('[data-pdf-stage][data-ready="1"]').waitFor({ timeout: 30000 });
  const n = await dialogOf(page).locator('canvas[data-pdf-page]').count();
  const count = await dialogOf(page).locator('[data-pdf-count]').innerText();
  check(n >= 1 && new RegExp(`${n} pages?`).test(count), `${label}: opens in the preview with its pages (${count})`);
  check((await dialogOf(page).locator('iframe, embed, object').count()) === 0, `${label}: no browser PDF viewer`);
}
async function printPreview(page, label, buttonName = 'Print PDF') {
  await main(page).getByRole('button', { name: buttonName }).click();
  await dialogOf(page).waitFor();
  await previewOpens(page, label);
  await closeAll(page);
}
async function downloadsWorkbook(page, label, pattern) {
  const [download] = await Promise.all([page.waitForEvent('download'), main(page).getByRole('button', { name: 'Export Excel' }).click()]);
  check(pattern.test(download.suggestedFilename()), `${label}: Export Excel downloads a workbook`, download.suggestedFilename());
}

const iso = (v) => (v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}` : String(v || '').slice(0, 10));
const addYears = (isoDate, n) => { const [y, m, d] = isoDate.split('-').map(Number); const t = new Date(Date.UTC(y + n, m - 1, d)); return t.toISOString().slice(0, 10); };

// ---------------------------------------------------------------------------
// Administrator: the rules through the API
// ---------------------------------------------------------------------------
async function apiFlow(browser, db) {
  console.log('\nAdministrator: the API');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);
  const R = '/api/reports';
  const [[auditBefore]] = await db.query('SELECT COUNT(*) AS n FROM audit_trail');
  const CUR = `LEFT JOIN rating_drafting cur ON cur.service_number = r.service_number AND cur.end_date IS NULL
       AND cur.id = (SELECT MAX(x.id) FROM rating_drafting x WHERE x.service_number = r.service_number AND x.end_date IS NULL)`;
  const count = async (sql, params = []) => { const [[x]] = await db.query(sql, params); return Number(x.n); };

  const opts = await api(page, 'GET', `${R}/options`);
  check(opts.status === 200 && opts.body.data.ships.length > 5 && opts.body.data.commands.length > 3 && opts.body.data.rates.length >= 8 && opts.body.data.sorts.length >= 5, 'Options: the pickers\' lists');
  const ships = opts.body.data.ships;
  const aradu = ships.find((s) => s.name === 'NNS ARADU');
  const western = opts.body.data.commands.find((c) => c.name === 'Western Naval Command');

  // ---- 1. Ship History
  console.log('  Ship History');
  const noShip = await api(page, 'GET', `${R}/ship-history`);
  check(noShip.status === 422 && noShip.body.error.fields.shipId, 'Ship History: a ship is required');
  check((await api(page, 'GET', `${R}/ship-history/excel`)).status === 422, 'Ship History: the workbook needs a ship too');
  const sh = await api(page, 'GET', `${R}/ship-history?shipId=${aradu.id}`);
  const shExpect = await count('SELECT COUNT(*) AS n FROM rating_drafting WHERE ship_id = ?', [aradu.id]);
  check(sh.status === 200 && sh.body.summary.postings === shExpect && shExpect > 0, 'Ship History: the ratings posted to the ship, from the postings', `${sh.body.summary.postings} vs ${shExpect}`);
  const aboardExpect = await count("SELECT COUNT(*) AS n FROM rating_drafting p JOIN ratings r ON r.service_number = p.service_number WHERE p.ship_id = ? AND p.end_date IS NULL AND r.status = 'current'", [aradu.id]);
  check(sh.body.summary.aboard === aboardExpect, 'Ship History: Aboard Now counts the open postings of current ratings', `${sh.body.summary.aboard} vs ${aboardExpect}`);
  check(typeof sh.body.summary.averageTour === 'string' && /yr/.test(sh.body.summary.averageTour), 'Ship History: the average tour');
  const starts = sh.body.data.map((x) => x.from);
  check(starts.every((d, i) => i === 0 || starts[i - 1] >= d), 'Ship History: newest posting first');
  const past = await db.query("SELECT start_date, end_date FROM rating_drafting WHERE ship_id = ? AND end_date IS NOT NULL ORDER BY end_date LIMIT 1", [aradu.id]);
  if (past[0].length) {
    const e = iso(past[0][0].end_date);
    const after = await api(page, 'GET', `${R}/ship-history?shipId=${aradu.id}&from=${addYears(e, 0).slice(0, 4)}-12-31`);
    const afterExpect = await count("SELECT COUNT(*) AS n FROM rating_drafting WHERE ship_id = ? AND COALESCE(end_date, '9999-12-31') >= ?", [aradu.id, `${e.slice(0, 4)}-12-31`]);
    check(after.body.summary.postings === afterExpect, 'Ship History: From keeps the postings still on or ending after it', `${after.body.summary.postings} vs ${afterExpect}`);
  }
  const before = await api(page, 'GET', `${R}/ship-history?shipId=${aradu.id}&to=2000-01-01`);
  check(before.status === 200 && before.body.summary.postings === 0, 'Ship History: a period before any posting is an empty list');
  check((await api(page, 'GET', `${R}/ship-history?shipId=${aradu.id}&from=2026-12-01&to=2026-01-01`)).status === 422, 'Ship History: a From after To is refused');
  check((await api(page, 'GET', `${R}/ship-history?shipId=${aradu.id}&from=31/02/2026`)).status === 422, 'Ship History: a bad date is refused');
  check((await api(page, 'GET', `${R}/ship-history/pdf?shipId=${aradu.id}`)).status === 404, 'Ship History: there is no PDF (it is a workbook, as in the old system)');
  const shWb = await workbookOf(page, `${R}/ship-history/excel?shipId=${aradu.id}`);
  check(dataRows(shWb.worksheets[0]) === shExpect && headerOf(shWb.worksheets[0]).includes('Official Number') && headerOf(shWb.worksheets[0]).includes('Tour'), 'Ship History: the workbook holds every posting of the same query');

  // ---- 2. All Personnel
  console.log('  All Personnel');
  const allN = await count('SELECT COUNT(*) AS n FROM ratings');
  const curN = await count("SELECT COUNT(*) AS n FROM ratings WHERE status = 'current'");
  const pAll = await api(page, 'GET', `${R}/personnel`);
  check(pAll.status === 200 && pAll.body.summary.personnel === allN && pAll.body.summary.current === curN && pAll.body.summary.former === allN - curN, 'All Personnel: no status is all ratings, with the current and former figures', JSON.stringify(pAll.body.summary));
  check(pAll.body.data.length === 25 && pAll.body.meta.totalPages === Math.ceil(allN / 25), 'All Personnel: 25 a page from the server');
  const p2 = await api(page, 'GET', `${R}/personnel?page=2`);
  check(p2.body.data.length > 0 && p2.body.data[0].serviceNumber !== pAll.body.data[0].serviceNumber, 'All Personnel: page 2');
  const pCur = await api(page, 'GET', `${R}/personnel?status=current`);
  const pFor = await api(page, 'GET', `${R}/personnel?status=former`);
  check(pCur.body.summary.personnel === curN && pFor.body.summary.personnel === allN - curN && pFor.body.data.every((x) => x.status === 'former'), 'All Personnel: Current and Former');
  check((await api(page, 'GET', `${R}/personnel?status=gone`)).status === 422 && (await api(page, 'GET', `${R}/personnel?sort=drop`)).status === 422, 'All Personnel: a bad status or sort is refused');
  const some = async (sql) => { const [[x]] = await db.query(sql); return x.id; };
  const filters = [
    ['rateId', await some('SELECT rate_id AS id FROM ratings GROUP BY rate_id ORDER BY COUNT(*) DESC LIMIT 1'), 'r.rate_id'],
    ['branchId', await some('SELECT branch_id AS id FROM ratings WHERE branch_id IS NOT NULL GROUP BY branch_id ORDER BY COUNT(*) DESC LIMIT 1'), 'r.branch_id'],
    ['commandId', western.id, 'r.command_id'],
    ['specialisationId', await some('SELECT specialisation_id AS id FROM ratings WHERE specialisation_id IS NOT NULL GROUP BY specialisation_id ORDER BY COUNT(*) DESC LIMIT 1'), 'r.specialisation_id'],
    ['staffBranchId', await some('SELECT staff_branch_id AS id FROM ratings WHERE staff_branch_id IS NOT NULL GROUP BY staff_branch_id ORDER BY COUNT(*) DESC LIMIT 1'), 'r.staff_branch_id'],
    ['entryModeId', await some('SELECT entry_mode_id AS id FROM ratings WHERE entry_mode_id IS NOT NULL GROUP BY entry_mode_id ORDER BY COUNT(*) DESC LIMIT 1'), 'r.entry_mode_id'],
    ['stateId', await some('SELECT state_id AS id FROM ratings WHERE state_id IS NOT NULL GROUP BY state_id ORDER BY COUNT(*) DESC LIMIT 1'), 'r.state_id'],
    ['zoneId', await some('SELECT geo_political_zone_id AS id FROM ratings WHERE geo_political_zone_id IS NOT NULL GROUP BY geo_political_zone_id ORDER BY COUNT(*) DESC LIMIT 1'), 'r.geo_political_zone_id'],
    ['shipId', aradu.id, 'cur.ship_id'],
  ];
  for (const [key, id, col] of filters) {
    const expect = await count(`SELECT COUNT(*) AS n FROM ratings r ${CUR} WHERE ${col} = ?`, [id]);
    const got = await api(page, 'GET', `${R}/personnel?${key}=${id}`);
    check(got.body.summary.personnel === expect && expect > 0 && expect < allN, `All Personnel: the ${key} filter`, `${got.body.summary.personnel} vs ${expect}`);
  }
  const combo = await api(page, 'GET', `${R}/personnel?status=current&commandId=${western.id}&rateId=${filters[0][1]}`);
  const comboExpect = await count("SELECT COUNT(*) AS n FROM ratings r WHERE r.status = 'current' AND r.command_id = ? AND r.rate_id = ?", [western.id, filters[0][1]]);
  check(combo.body.summary.personnel === comboExpect, 'All Personnel: filters combine');
  const byName = await api(page, 'GET', `${R}/personnel?sort=name`);
  const names = byName.body.data.map((x) => x.surname);
  check(names.every((n, i) => i === 0 || names[i - 1].localeCompare(n, 'en', { sensitivity: 'base' }) <= 0), 'All Personnel: Sort By name');
  const byRate = await api(page, 'GET', `${R}/personnel?sort=rate&status=current`);
  check(/WO|NWO|MWO/.test(byRate.body.data[0].rateCode), 'All Personnel: Sort By rate puts the highest first', byRate.body.data[0].rateCode);
  check(pAll.body.data.every((x) => x.status === 'current' || !x.ship), 'All Personnel: a former rating shows no ship');
  // one query: the screen, the PDF and the workbook
  const q = `status=current&commandId=${western.id}`;
  const qn = (await api(page, 'GET', `${R}/personnel?${q}`)).body.summary.personnel;
  const pWb = await workbookOf(page, `${R}/personnel/excel?${q}`);
  check(dataRows(pWb.worksheets[0]) === qn, 'All Personnel: the workbook holds every row of the screen\'s query', `${dataRows(pWb.worksheets[0])} vs ${qn}`);
  check(['Official Number', 'Surname', 'First Name', 'Status', 'Specialisation', 'Date of Birth'].every((h) => headerOf(pWb.worksheets[0]).includes(h)), 'All Personnel: the workbook headers');
  for (const [label, url, type, head] of [['Ratings Report PDF', `${R}/personnel/pdf?${q}`, 'application/pdf', '%PDF'], ['Ratings Report workbook', `${R}/personnel/excel`, 'spreadsheetml', 'PK']]) {
    const f = await fileHead(page, url);
    check(f.status === 200 && f.type.includes(type) && f.head.startsWith(head) && f.size > 2000, `Printout: ${label}`, JSON.stringify(f));
  }

  // ---- 3. Disposition
  console.log('  Disposition');
  const dAll = await api(page, 'GET', `${R}/disposition`);
  check(dAll.status === 200 && dAll.body.summary.ratings === curN, 'Disposition: every current rating, and only those', `${dAll.body.summary.ratings} vs ${curN}`);
  check(dAll.body.summary.ratings === dAll.body.data.reduce((a, s) => a + s.total, 0) && dAll.body.data.every((s) => s.total === s.rates.reduce((a, r) => a + r.count, 0) + s.noRate), 'Disposition: each ship\'s counts by rate add up to its total');
  check(dAll.body.summary.byRate.reduce((a, r) => a + r.count, 0) === dAll.body.summary.ratings, 'Disposition: the rate strip adds up');
  const dShip = dAll.body.data.find((s) => s.shipId === aradu.id);
  const dExpect = await count("SELECT COUNT(*) AS n FROM ratings r JOIN rating_drafting cur ON cur.service_number = r.service_number AND cur.end_date IS NULL WHERE r.status = 'current' AND cur.ship_id = ?", [aradu.id]);
  check(dShip && dShip.total === dExpect, 'Disposition: a ship\'s total is the current ratings on its open postings', `${dShip && dShip.total} vs ${dExpect}`);
  const dCmd = await api(page, 'GET', `${R}/disposition?commandId=${western.id}`);
  check(dCmd.body.summary.ratings === (await count("SELECT COUNT(*) AS n FROM ratings WHERE status = 'current' AND command_id = ?", [western.id])), 'Disposition: the Command filter');
  const area = opts.body.data.areas[0];
  const dArea = await api(page, 'GET', `${R}/disposition?areaId=${area.id}`);
  check(dArea.body.summary.ratings === (await count("SELECT COUNT(*) AS n FROM ratings WHERE status = 'current' AND mother_base_id = ?", [area.id])), 'Disposition: the Area Office filter');
  const trade = filters[3][1];
  const dTrade = await api(page, 'GET', `${R}/disposition?specialisationId=${trade}`);
  check(dTrade.body.summary.ratings === (await count("SELECT COUNT(*) AS n FROM ratings WHERE status = 'current' AND specialisation_id = ?", [trade])), 'Disposition: the Trade filter');
  const dWb = await workbookOf(page, `${R}/disposition/excel`);
  check(dWb.worksheets.length === 2 && dataRows(dWb.worksheets[1]) === curN && dataRows(dWb.worksheets[0]) === dAll.body.data.length + 1, 'Disposition: the workbook holds the ships (with a total) and every current rating');
  const dPdf = await fileHead(page, `${R}/disposition/pdf`);
  check(dPdf.status === 200 && dPdf.head.startsWith('%PDF') && dPdf.size > 2000, 'Printout: Disposition Report PDF', JSON.stringify(dPdf));

  // ---- 4. Nominal Roll
  console.log('  Nominal Roll');
  const noPick = await api(page, 'GET', `${R}/nominal-roll`);
  check(noPick.status === 422 && /ship or unit, or a command/.test(noPick.body.error.message), 'Nominal Roll: a ship or a command is required');
  check((await api(page, 'GET', `${R}/nominal-roll/pdf?branchId=1`)).status === 422, 'Nominal Roll: the printout needs one too');
  const rShip = await api(page, 'GET', `${R}/nominal-roll?shipId=${aradu.id}`);
  check(rShip.status === 200 && rShip.body.summary.total === dExpect && rShip.body.data.every((x) => x.ship === 'NNS ARADU'), 'Nominal Roll: the ratings serving now on one ship', `${rShip.body.summary.total} vs ${dExpect}`);
  const [rateOrder] = await db.query('SELECT code, sort_order FROM ref_rate');
  const orderOf = Object.fromEntries(rateOrder.map((r) => [r.code, r.sort_order]));
  const [seniors] = await db.query('SELECT service_number, seniority_date FROM ratings');
  const sen = Object.fromEntries(seniors.map((r) => [r.service_number, iso(r.seniority_date) || '9999']));
  const sorted = rShip.body.data.every((x, i, a) => {
    if (i === 0) return true;
    const p = a[i - 1];
    const ro = orderOf[p.rateCode] - orderOf[x.rateCode];
    if (ro !== 0) return ro > 0;
    if (sen[p.serviceNumber] !== sen[x.serviceNumber]) return sen[p.serviceNumber] < sen[x.serviceNumber];
    return p.serviceNumber < x.serviceNumber;
  });
  check(sorted, 'Nominal Roll: highest rate first, then seniority date, then official number');
  check(rShip.body.data.every((x) => x.joinedOn && x.months >= 0 && x.specialisation !== undefined), 'Nominal Roll: each has the date it joined the ship and the months there');
  check(rShip.body.summary.groups.reduce((a, g) => a + g.count, 0) === rShip.body.summary.total && rShip.body.summary.groups.length >= 2, 'Nominal Roll: the rate groups add up to the total');
  const gOrder = rShip.body.summary.groups.map((g) => orderOf[g.code]);
  check(gOrder.every((o, i) => i === 0 || gOrder[i - 1] > o), 'Nominal Roll: the groups run highest rate first');
  const rCmd = await api(page, 'GET', `${R}/nominal-roll?commandId=${western.id}`);
  const rCmdExpect = await count("SELECT COUNT(*) AS n FROM ratings r JOIN rating_drafting cur ON cur.service_number = r.service_number AND cur.end_date IS NULL JOIN ref_ship s ON s.id = cur.ship_id WHERE r.status = 'current' AND s.command_id = ?", [western.id]);
  check(rCmd.body.summary.total === rCmdExpect && new Set(rCmd.body.data.map((x) => x.ship)).size > 1 && rCmd.body.data.every((x) => x.command === 'Western Naval Command'), 'Nominal Roll: every ship of a command', `${rCmd.body.summary.total} vs ${rCmdExpect}`);
  const shipsInOrder = rCmd.body.data.map((x) => x.ship);
  check(shipsInOrder.every((s, i) => i === 0 || shipsInOrder[i - 1] <= s), 'Nominal Roll: across a command the ships come in name order');
  const rateId = opts.body.data.rates.find((r) => r.code === rShip.body.data[0].rateCode).id;
  const rRate = await api(page, 'GET', `${R}/nominal-roll?shipId=${aradu.id}&rateId=${rateId}`);
  check(rRate.body.summary.total > 0 && rRate.body.summary.total < rShip.body.summary.total && rRate.body.summary.groups.length === 1, 'Nominal Roll: the Rate filter');
  const rBranch = await api(page, 'GET', `${R}/nominal-roll?commandId=${western.id}&branchId=${filters[1][1]}`);
  check(rBranch.body.summary.total < rCmd.body.summary.total, 'Nominal Roll: the Branch filter');
  const rWb = await workbookOf(page, `${R}/nominal-roll/excel?commandId=${western.id}`);
  check(dataRows(rWb.worksheets[0]) === rCmdExpect, 'Nominal Roll: the workbook holds every row of the same query');
  for (const [label, url] of [['Nominal Roll PDF (one ship)', `${R}/nominal-roll/pdf?shipId=${aradu.id}`], ['Nominal Roll PDF (a command)', `${R}/nominal-roll/pdf?commandId=${western.id}`]]) {
    const f = await fileHead(page, url);
    check(f.status === 200 && f.head.startsWith('%PDF') && f.size > 2000, `Printout: ${label}`, JSON.stringify(f));
  }

  // ---- 5. Manning State
  console.log('  Manning State');
  const mAll = await api(page, 'GET', `${R}/manning-state`);
  const reqs = await count('SELECT COUNT(DISTINCT ship_id) AS n FROM manning_requirements');
  const requiredAll = await count('SELECT SUM(quantity) AS n FROM manning_requirements');
  check(mAll.status === 200 && mAll.body.summary.ships === reqs && mAll.body.summary.required === requiredAll, 'Manning State: one row per ship with a requirement, and the required total', JSON.stringify(mAll.body.summary));
  // "borne" is Drafting's own count: the same query, so the two pages never disagree
  let draftingAboard = 0;
  const dm = await api(page, 'GET', '/api/drafting/manning');
  for (let p = 1; p <= dm.body.meta.totalPages; p += 1) draftingAboard += (await api(page, 'GET', `/api/drafting/manning?page=${p}`)).body.data.reduce((a, m) => a + m.aboard, 0);
  check(mAll.body.summary.borne === draftingAboard, 'Manning State: borne equals Update Manning Requirement\'s aboard, line for line', `${mAll.body.summary.borne} vs ${draftingAboard}`);
  const dmShip = (await api(page, 'GET', `/api/drafting/manning?shipId=${mAll.body.data[0].shipId}`)).body.data;
  const first = mAll.body.data[0];
  check(first.lines.length === dmShip.length && first.lines.every((l) => dmShip.some((m) => m.rateId === l.rateId && m.specialisationId === l.specialisationId && m.aboard === l.borne && m.required === l.required)), 'Manning State: a ship\'s lines are Drafting\'s lines for that ship');
  check(mAll.body.data.every((s) => s.difference === s.borne - s.required && s.state === (s.difference < 0 ? 'short' : s.difference > 0 ? 'over' : 'exact')), 'Manning State: the difference and its state (short, over, exact)');
  check(mAll.body.data.every((s) => s.required === s.lines.reduce((a, l) => a + l.required, 0) && s.borne === s.lines.reduce((a, l) => a + l.borne, 0)), 'Manning State: a ship\'s totals are its lines\' totals');
  const shortN = mAll.body.data.filter((s) => s.state === 'short').length;
  check(mAll.body.summary.short === shortN && shortN > 0, 'Manning State: the Short figure counts the ships that are short');
  const mShort = await api(page, 'GET', `${R}/manning-state?short=1`);
  check(mShort.body.summary.ships === shortN && mShort.body.data.every((s) => s.state === 'short'), 'Manning State: Short only');
  const mShip = await api(page, 'GET', `${R}/manning-state?shipId=${first.shipId}`);
  check(mShip.body.summary.ships === 1 && mShip.body.data[0].shipId === first.shipId, 'Manning State: the Ship filter');
  const mCmd = await api(page, 'GET', `${R}/manning-state?commandId=${western.id}`);
  const mCmdExpect = await count('SELECT COUNT(DISTINCT m.ship_id) AS n FROM manning_requirements m JOIN ref_ship s ON s.id = m.ship_id WHERE s.command_id = ?', [western.id]);
  check(mCmd.body.summary.ships === mCmdExpect && mCmdExpect > 0 && mCmdExpect < reqs, 'Manning State: the Command filter', `${mCmd.body.summary.ships} vs ${mCmdExpect}`);
  const line = first.lines[0];
  const mRate = await api(page, 'GET', `${R}/manning-state?rateId=${line.rateId}&specialisationId=${line.specialisationId}`);
  check(mRate.body.data.every((s) => s.lines.every((l) => l.rateId === line.rateId && l.specialisationId === line.specialisationId)) && mRate.body.summary.ships >= 1, 'Manning State: the Rate and Specialisation filters narrow each ship\'s lines');
  const mWb = await workbookOf(page, `${R}/manning-state/excel?short=1`);
  check(mWb.worksheets.length === 2 && dataRows(mWb.worksheets[0]) === shortN, 'Manning State: the workbook holds the ships and their lines');
  const mPdf = await fileHead(page, `${R}/manning-state/pdf`);
  check(mPdf.status === 200 && mPdf.head.startsWith('%PDF') && mPdf.size > 2000, 'Printout: Manning State PDF (Drafting\'s Manning Requirement Report)', JSON.stringify(mPdf));

  // ---- 6. Retirement Forecast
  console.log('  Retirement Forecast');
  const [settings] = await db.query("SELECT setting_key, value FROM settings WHERE setting_key IN ('discharge.age_due','discharge.service_due')");
  const rule = Object.fromEntries(settings.map((s) => [s.setting_key, Number(s.value)]));
  check((await api(page, 'GET', `${R}/retirement-forecast?months=5`)).status === 422, 'Retirement Forecast: only 6, 12 or 24 months');
  const f12 = await api(page, 'GET', `${R}/retirement-forecast`);
  const f6 = await api(page, 'GET', `${R}/retirement-forecast?months=6`);
  const f24 = await api(page, 'GET', `${R}/retirement-forecast?months=24`);
  check(f12.body.summary.months === 12 && f6.body.summary.due < f12.body.summary.due && f12.body.summary.due < f24.body.summary.due && f6.body.summary.due > 0, '12 months is the default, and 6, 12, 24 grow', `${f6.body.summary.due}, ${f12.body.summary.due}, ${f24.body.summary.due}`);
  check(f24.body.summary.quarters.length === 8 && f24.body.summary.quarters.reduce((a, q) => a + q.count, 0) === f24.body.summary.due && f6.body.summary.quarters.length === 2, 'Retirement Forecast: the quarters add up to the total');
  const dates = f24.body.data.map((x) => x.dueOn);
  check(dates.every((d, i) => i === 0 || dates[i - 1] <= d), 'Retirement Forecast: soonest first');
  check(f24.body.data.every((x) => ['age', 'service', 'both'].includes(x.why) && x.whyText), 'Retirement Forecast: each says why (age or service)');
  // the rule, from the settings: the date is the sooner of the two
  const [seeded] = await db.query("SELECT service_number, date_of_birth, date_employed FROM ratings WHERE service_number IN ('B1302', 'B1304', 'B1309')");
  for (const r of seeded) {
    const row = f24.body.data.find((x) => x.serviceNumber === r.service_number);
    const age = addYears(iso(r.date_of_birth), rule['discharge.age_due']);
    const svc = addYears(iso(r.date_employed), rule['discharge.service_due']);
    check(row && row.dueOn === (age < svc ? age : svc), `Retirement Forecast: ${r.service_number} becomes due on the sooner of age ${rule['discharge.age_due']} and ${rule['discharge.service_due']} years' service`, row ? `${row.dueOn} vs ${age}/${svc}` : 'missing');
  }
  check(f24.body.data.find((x) => x.serviceNumber === 'B1302').why === 'age' && f24.body.data.find((x) => x.serviceNumber === 'B1304').why === 'service' && f24.body.data.find((x) => x.serviceNumber === 'B1309').why === 'both', 'Retirement Forecast: age, service and both');
  // nobody Process Discharge already lists as due today is listed here, and the figure is Process Discharge's own count
  const dueNow = [];
  for (let p = 1; p <= 10; p += 1) {
    const d = await api(page, 'GET', `/api/discharge/due?page=${p}`);
    dueNow.push(...d.body.data.items.map((x) => x.serviceNumber));
    if (p >= d.body.data.meta.totalPages) break;
  }
  check(f12.body.summary.dueToday === dueNow.length && dueNow.length > 0, 'Retirement Forecast: "already due today" is the count Process Discharge lists', `${f12.body.summary.dueToday} vs ${dueNow.length}`);
  check(!f24.body.data.some((x) => dueNow.includes(x.serviceNumber)), 'Retirement Forecast: nobody already due today is listed');
  check(f24.body.meta.pageSize === 25 && f24.body.data.length === Math.min(25, f24.body.summary.due), 'Retirement Forecast: 25 a page');
  const fBranch = await api(page, 'GET', `${R}/retirement-forecast?months=24&branchId=${(await db.query("SELECT branch_id AS id FROM ratings WHERE service_number = 'B1302'"))[0][0].id}`);
  check(fBranch.body.summary.due >= 1 && fBranch.body.summary.due < f24.body.summary.due && fBranch.body.data.some((x) => x.serviceNumber === 'B1302'), 'Retirement Forecast: the Branch filter');
  const fRate = await api(page, 'GET', `${R}/retirement-forecast?months=24&rateId=${(await db.query("SELECT rate_id AS id FROM ratings WHERE service_number = 'B1302'"))[0][0].id}`);
  check(fRate.body.summary.due >= 1 && fRate.body.summary.due < f24.body.summary.due, 'Retirement Forecast: the Rate filter');
  const fShip = await api(page, 'GET', `${R}/retirement-forecast?months=24&shipId=${aradu.id}`);
  check(fShip.body.data.length >= 1 && fShip.body.data.every((x) => x.ship === 'NNS ARADU'), 'Retirement Forecast: the Ship filter');
  const fWb = await workbookOf(page, `${R}/retirement-forecast/excel?months=24`);
  check(dataRows(fWb.worksheets[0]) === f24.body.summary.due && headerOf(fWb.worksheets[0]).includes('Becomes Due'), 'Retirement Forecast: the workbook holds every row of the same query');
  const fPdf = await fileHead(page, `${R}/retirement-forecast/pdf?months=24`);
  check(fPdf.status === 200 && fPdf.head.startsWith('%PDF') && fPdf.size > 2000, 'Printout: Retirement Forecast PDF', JSON.stringify(fPdf));

  // the rule is read from the settings: a lower age brings more ratings into the forecast (and puts the value back)
  const dueBefore = f12.body.summary.due;
  await db.query("UPDATE settings SET value = '49' WHERE setting_key = 'discharge.age_due'");
  try {
    const f49 = await api(page, 'GET', `${R}/retirement-forecast`);
    check(f49.status === 200 && f49.body.summary.ageDue === 49 && f49.body.summary.dueToday >= f12.body.summary.dueToday, 'Retirement Forecast: a changed setting changes the rule with no code change');
    check(f49.body.data.find((x) => x.serviceNumber === 'B1302') === undefined || f49.body.data.find((x) => x.serviceNumber === 'B1302').dueOn < f12.body.data.find((x) => x.serviceNumber === 'B1302').dueOn, 'Retirement Forecast: B1302 now falls due a year sooner or is due today');
  } finally {
    await db.query("UPDATE settings SET value = ? WHERE setting_key = 'discharge.age_due'", [String(rule['discharge.age_due'])]);
  }

  const [[auditAfter]] = await db.query('SELECT COUNT(*) AS n FROM audit_trail');
  check(auditAfter.n === auditBefore.n, 'Audit trail: the reports write nothing', `${auditBefore.n} to ${auditAfter.n}`);

  // the exclusions of Process Discharge: a rating in a waiting proposal is no longer forecast; a re-engaged one neither
  const target = f12.body.data.find((x) => x.serviceNumber === 'B1303') ? 'B1303' : f12.body.data[1].serviceNumber;
  const prop = await api(page, 'POST', '/api/discharge/proposals', { serviceNumbers: [target] });
  check(prop.status === 201, 'Exclusions: a rating is added to a discharge proposal', JSON.stringify(prop.body));
  const afterProposal = await api(page, 'GET', `${R}/retirement-forecast?months=24`);
  check(afterProposal.body.summary.due === f24.body.summary.due - 1 && !afterProposal.body.data.some((x) => x.serviceNumber === target), 'Exclusions: a rating already in a proposal is not forecast');
  const reTarget = f24.body.data.find((x) => x.serviceNumber !== target && x.ship).serviceNumber;
  await db.query("INSERT INTO discharge_reengagements (proposal_id, service_number, reengage_date, period_months, until_date, approved_by) VALUES ((SELECT MIN(id) FROM discharge_proposals), ?, CURDATE(), 12, DATE_ADD(CURDATE(), INTERVAL 12 MONTH), 'Chief of Naval Staff')", [reTarget]);
  const afterRe = await api(page, 'GET', `${R}/retirement-forecast?months=24`);
  check(afterRe.body.summary.due === f24.body.summary.due - 2 && !afterRe.body.data.some((x) => x.serviceNumber === reTarget), 'Exclusions: a re-engaged rating is not forecast');
  check(dueBefore > 0, 'Exclusions: (the forecast had ratings to start with)');

  check(errors.length === 0, 'Admin API: no browser errors', errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// Privileges
// ---------------------------------------------------------------------------
async function privileges(browser) {
  console.log('\nPrivileges');
  const R = '/api/reports';
  const urls = [
    `${R}/options`, `${R}/ship-history?shipId=1`, `${R}/ship-history/excel?shipId=1`, `${R}/personnel`, `${R}/personnel/pdf`, `${R}/personnel/excel`, `${R}/disposition`,
    `${R}/disposition/pdf`, `${R}/disposition/excel`, `${R}/nominal-roll?shipId=1`, `${R}/nominal-roll/pdf?shipId=1`, `${R}/nominal-roll/excel?shipId=1`, `${R}/manning-state`,
    `${R}/manning-state/pdf`, `${R}/manning-state/excel`, `${R}/retirement-forecast`, `${R}/retirement-forecast/pdf`, `${R}/retirement-forecast/excel`,
  ];

  const anon = await browser.newContext();
  const ap = await anon.newPage();
  await ap.goto(`${BASE}/index.html`);
  const statuses = await ap.evaluate(async (list) => Promise.all(list.map(async (u) => (await fetch(u)).status)), urls);
  check(statuses.every((s) => s === 401), 'Signed out: every report route is a 401');
  await anon.close();

  for (const [who, name] of [[RATING, 'a rating'], [DRAFTING, 'a drafting officer']]) {
    const { context, page } = await open(browser, { viewport: DESKTOP, theme: 'light' });
    await signIn(page, who);
    const got = [];
    for (const u of urls) got.push((await api(page, 'GET', u)).status);
    check(got.every((s) => s === 403), `${name} (no Reports grant): every report route is a 403`, got.join(','));
    await go(page, 'reports/nominal-roll');
    check(/Do Not Have Access/i.test(await main(page).innerText()), `${name}: a report page opens as not allowed`);
    check((await page.locator('#module-tabs a', { hasText: 'Nominal Roll' }).count()) === 0, `${name}: the report tabs are hidden`);
    await context.close();
  }

  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, REPORT);
  const ok = [];
  for (const u of urls) ok.push((await api(page, 'GET', u)).status);
  check(ok.every((s) => s === 200), 'The Report role: every report route is a 200', ok.join(','));
  check((await api(page, 'GET', '/api/drafting/manning')).status === 403 && (await api(page, 'GET', '/api/discharge/due')).status === 403, 'The Report role: reads nothing outside Reports (Drafting, Discharge: 403)');
  await go(page, 'reports/ship-history');
  const tabs = await page.locator('#module-tabs a').allInnerTexts();
  check(['Ship History', 'All Personnel', 'Disposition', 'Nominal Roll', 'Manning State', 'Retirement Forecast'].every((t) => tabs.some((x) => x.includes(t))), 'The Report role: sees the six report tabs', tabs.join(', '));
  check((await page.locator('#rail nav a', { hasText: 'Reports' }).count()) > 0, 'The Report role: Reports is in the menu');
  check(errors.length === 0, 'The Report role: no browser errors', errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// Administrator: the screens at desktop light
// ---------------------------------------------------------------------------
async function screensFlow(browser, shared) {
  console.log('\nAdministrator: the screens at 1440 px, light');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);

  // Reports is built: no Soon badge, six tabs, Ctrl K reaches them
  const railReports = page.locator('#rail nav a', { hasText: 'Reports' }).first();
  check(!/Soon/.test(await railReports.innerText()), 'Reports: the menu item has lost its Soon badge');
  await railReports.click();
  await page.waitForFunction(() => location.hash === '#reports/ship-history');
  await settle(page);
  const tabs = await page.locator('#module-tabs a').allInnerTexts();
  check(['Ship History', 'All Personnel', 'Disposition', 'Nominal Roll', 'Manning State', 'Retirement Forecast'].every((t) => tabs.some((x) => x.includes(t))), 'Reports: the six tabs', tabs.join(', '));
  for (const [typed, hash, label] of [['Nominal Roll', '#reports/nominal-roll', 'Nominal Roll'], ['Manning State', '#reports/manning-state', 'Manning State'], ['Retirement Forecast', '#reports/retirement-forecast', 'Retirement Forecast'],
    ['Ship History', '#reports/ship-history', 'Ship History'], ['All Personnel', '#reports/all-personnel', 'All Personnel'], ['Disposition', '#reports/disposition', 'Disposition']]) {
    await page.keyboard.press('Control+K');
    await page.locator('#palette-results').waitFor();
    await page.waitForTimeout(150);
    await page.keyboard.press('Control+A');
    await page.keyboard.type(typed);
    await page.locator('#palette-results').getByText(label).first().waitFor();
    await page.keyboard.press('Enter');
    await page.waitForFunction((h) => location.hash === h, hash);
    await page.locator('#palette-results').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    await settle(page);
    await page.waitForTimeout(300);
    check(true, `Ctrl K finds and opens ${label}`);
  }

  // ---- Ship History
  await go(page, 'reports/ship-history');
  check(/Choose a Ship/.test(await main(page).innerText()) && (await rowsOf(page, false).count()) === 0, 'Ship History: without a ship it asks for one');
  check(await main(page).getByRole('button', { name: 'Export Excel' }).isDisabled(), 'Ship History: Export Excel is off until a ship is picked');
  await main(page).getByRole('button', { name: 'Print PDF' }).click();
  check(/Excel workbook/.test(await toastText(page, /Excel workbook/)), 'Ship History: its Print PDF button says the report is an Excel workbook');
  await filterSelect(page, false, 'shipId', shared.ship.name);
  const shRows = await rowTexts(page, false);
  check(shRows.length > 0 && /POSTINGS\s*\d+/i.test(await main(page).locator('[data-stats]').innerText()) && /AVERAGE TOUR/i.test(await main(page).locator('[data-stats]').innerText()), 'Ship History: the figures (postings, aboard now, average tour) and the list');
  check(shRows.some((t) => /Aboard/.test(t)), 'Ship History: an open posting says Aboard');
  await main(page).locator('[name="from"]').fill('01/12/2026');
  await main(page).locator('[name="to"]').fill('01/01/2026');
  await page.keyboard.press('Enter');
  await settle(page);
  check(/From is after To/.test(await main(page).innerText()) && await main(page).getByRole('button', { name: 'Export Excel' }).isDisabled(), 'Ship History: a From after To shows an error and switches the workbook off');
  await main(page).locator('[name="from"]').fill('');
  await main(page).locator('[name="to"]').fill('');
  await page.keyboard.press('Enter');
  await settle(page);
  await rowsOf(page, false).first().click();
  await dialogOf(page).waitFor();
  const dtext = await dialogOf(page).innerText();
  check(/Official No/.test(dtext) && /From/.test(dtext) && /Tour/.test(dtext) && /Ship or Unit/.test(dtext) && await dialogOf(page).getByRole('button', { name: 'Open Record' }).count() > 0, 'Ship History: a row opens with the posting and Open Record');
  await closeAll(page);
  await downloadsWorkbook(page, 'Ship History', /^Ship History .*\.xlsx$/);

  // ---- All Personnel
  await go(page, 'reports/all-personnel');
  check(/PERSONNEL\s*\d+/i.test(await main(page).locator('[data-stats]').innerText()) && /CURRENT\s*\d+/i.test(await main(page).locator('[data-stats]').innerText()) && /FORMER\s*\d+/i.test(await main(page).locator('[data-stats]').innerText()), 'All Personnel: the figures');
  check((await rowTexts(page, false)).length === 25, 'All Personnel: 25 a page');
  check((await pickedOf(page, 'status')) === 'All', 'All Personnel: the status says All, spelled properly', await pickedOf(page, 'status'));
  await filterSelect(page, false, 'status', 'Former');
  const former = await rowTexts(page, false);
  check(former.length > 0 && former.every((t) => /Former/.test(t)), 'All Personnel: Status Former lists former ratings only');
  await filterSelect(page, false, 'status', 'Current');
  await filterSelect(page, false, 'commandId', 'Western');
  const wcount = Number((/(\d+) rating/.exec(await main(page).locator('[data-row-count]').innerText()) || [])[1]);
  check(wcount > 0 && (await rowTexts(page, false)).every((t) => /Current/.test(t)), 'All Personnel: Command and Status together');
  await rowsOf(page, false).first().click();
  await dialogOf(page).waitFor();
  const ptext = await dialogOf(page).innerText();
  check(['Official No', 'Branch', 'Specialisation', 'Ship or Unit', 'Command', 'Date of Birth', 'Date Joined', 'Staff Branch', 'AK (Entry Mode)'].every((l) => ptext.includes(l)), 'All Personnel: a row opens the rating\'s details as label and value rows');
  await closeAll(page);
  await printPreview(page, 'Ratings Report');
  await downloadsWorkbook(page, 'All Personnel', /^Personel\.xlsx$/);

  // ---- Disposition
  await go(page, 'reports/disposition');
  check(/SHIPS AND UNITS\s*\d+/i.test(await main(page).locator('[data-stats]').innerText()) && (await main(page).locator('[data-rate-strip]').innerText()).includes('OS:'), 'Disposition: the figures and the rate strip');
  const dRows = await rowTexts(page, false);
  check(dRows.length > 5 && dRows.length <= 25, 'Disposition: ships and units, each with its ratings and share', `${dRows.length}`);
  const header = await main(page).locator('table thead th').allInnerTexts();
  check(header.length === 3 && /Ship or Unit/i.test(header[0]) && /Ratings/i.test(header[1]) && /Share/i.test(header[2]), 'Disposition: the key columns are ship, ratings and share', header.join(','));
  await openRowByText(page, shared.ship.name);
  const dtx = await dialogOf(page).innerText();
  check(/By Rate/.test(dtx) && /Able Seaman/.test(dtx) && /Petty Officer/.test(dtx), 'Disposition: a row opens its counts by rate');
  await dialogOf(page).getByRole('button', { name: 'Nominal Roll' }).click();
  await page.waitForFunction((id) => location.hash === `#reports/nominal-roll?shipId=${id}`, shared.ship.id);
  await settle(page);
  check((await rowTexts(page, false)).length > 0 && (await pickedOf(page, 'shipId')) === 'NNS ARADU', 'Disposition: Nominal Roll from a ship opens with that ship picked');
  await go(page, 'reports/disposition');
  await printPreview(page, 'Disposition Report');
  await downloadsWorkbook(page, 'Disposition', /^Disposition Report\.xlsx$/);
  await filterSelect(page, false, 'commandId', 'Western');
  check((await rowTexts(page, false)).length > 0 && (await rowTexts(page, false)).length < dRows.length + 1, 'Disposition: the Command filter');

  // ---- Nominal Roll
  await go(page, 'reports/nominal-roll');
  check(/Choose a Ship or a Command/.test(await main(page).innerText()) && (await rowsOf(page, false).count()) === 0, 'Nominal Roll: without a ship or a command it asks for one');
  check(await main(page).getByRole('button', { name: 'Print PDF' }).isDisabled(), 'Nominal Roll: Print PDF is off until one is picked');
  const allShips = await optionsOf(page, 'shipId');
  await filterSelect(page, false, 'commandId', 'Western');
  const westShips = await optionsOf(page, 'shipId');
  check(westShips.length > 0 && westShips.length < allShips.length, 'Nominal Roll: choosing a command narrows the ships to its own', `${westShips.length} of ${allShips.length}`);
  const cmdRows = await rowTexts(page, false);
  check(cmdRows.length > 0 && /TOTAL\s*\d+/i.test(await main(page).locator('[data-stats]').innerText()) && (await main(page).locator('[data-rate-strip]').innerText()).includes('PO:'), 'Nominal Roll: a command lists every ship\'s ratings, with the total and the rate groups');
  check(cmdRows.every((t) => /NNS|NHQ|NAVTRAC/.test(t)), 'Nominal Roll: across a command each row names its ship');
  await filterSelect(page, false, 'shipId', shared.ship.name);
  const oneRows = await rowTexts(page, false);
  check(oneRows.length > 0 && oneRows.length < cmdRows.length + 1, 'Nominal Roll: one ship');
  await rowsOf(page, false).first().click();
  await dialogOf(page).waitFor();
  const ntext = await dialogOf(page).innerText();
  check(['Official No', 'Rate', 'Specialisation', 'Joined Ship', 'Months on Ship', 'Command'].every((l) => ntext.includes(l)) && await dialogOf(page).getByRole('button', { name: 'Open Record' }).count() > 0, 'Nominal Roll: a row opens the rating with Open Record');
  await dialogOf(page).getByRole('button', { name: 'Open Record' }).click();
  await page.waitForFunction(() => location.hash.startsWith('#ratings/edit/'));
  check(true, 'Nominal Roll: Open Record opens the rating\'s record');
  await go(page, `reports/nominal-roll?shipId=${shared.ship.id}`);
  await printPreview(page, 'Nominal Roll');
  await downloadsWorkbook(page, 'Nominal Roll', /^Nominal Roll\.xlsx$/);
  await filterSelect(page, false, 'rateId', 'Petty Officer');
  const poRows = await rowTexts(page, false);
  check(poRows.length > 0 && poRows.length < oneRows.length && poRows.every((t) => /PO/.test(t)), 'Nominal Roll: the Rate filter');

  // ---- Manning State
  await go(page, 'reports/manning-state');
  const mstats = await main(page).locator('[data-stats]').innerText();
  check(/SHIPS\s*\d+/i.test(mstats) && /REQUIRED\s*\d+/i.test(mstats) && /BORNE\s*\d+/i.test(mstats) && /SHORT\s*\d+/i.test(mstats), 'Manning State: the figures (ships, required, borne, short)');
  const mh = await main(page).locator('table thead th').allInnerTexts();
  check(mh.length === 4 && /Required/i.test(mh[1]) && /Borne/i.test(mh[2]) && /Difference/i.test(mh[3]), 'Manning State: the key columns', mh.join(','));
  const allM = (await rowTexts(page, false)).length;
  check(await main(page).locator('table tbody .bg-error-soft').count() > 0 && await main(page).locator('table tbody .bg-warning-soft').count() > 0, 'Manning State: the difference pills (short red, over amber)');
  await filterSelect(page, false, 'short', 'Short Only');
  const shortRows = await rowTexts(page, false);
  check(shortRows.length > 0 && shortRows.length < allM && await main(page).locator('table tbody .bg-warning-soft').count() === 0, 'Manning State: Short only leaves the ships that are short');
  await filterSelect(page, false, 'short', 'All Ships');
  await rowsOf(page, false).first().click();
  await dialogOf(page).waitFor();
  check(await dialogOf(page).locator('[data-manning-lines] > div').count() >= 1 && /Required \d+ · Borne \d+/.test(await dialogOf(page).innerText()), 'Manning State: a row opens the ship\'s lines by rate and specialisation');
  await closeAll(page);
  await printPreview(page, 'Manning State');
  await downloadsWorkbook(page, 'Manning State', /^Manning State\.xlsx$/);

  // ---- Retirement Forecast
  await go(page, 'reports/retirement-forecast');
  check((await pickedOf(page, 'months')) === 'Next 12 Months', 'Retirement Forecast: 12 months is the default');
  const f12 = Number((/(\d+) rating/.exec(await main(page).locator('[data-row-count]').innerText()) || [])[1]);
  check(/DUE IN 12 MONTHS\s*\d+/i.test(await main(page).locator('[data-stats]').innerText()) && /ALREADY DUE TODAY\s*\d+/i.test(await main(page).locator('[data-stats]').innerText()), 'Retirement Forecast: the figures, one for those already due today');
  check((await main(page).locator('[data-quarter-strip]').innerText()).includes('Months 1 to 3'), 'Retirement Forecast: the figure for each quarter');
  const frows = await rowTexts(page, false);
  check(frows.length > 0 && frows.some((t) => /Age 50/.test(t)) && frows.some((t) => /years of service/.test(t)), 'Retirement Forecast: each row says when and why (age or service)');
  await filterSelect(page, false, 'months', 'Next 24');
  const f24 = Number((/(\d+) rating/.exec(await main(page).locator('[data-row-count]').innerText()) || [])[1]);
  check(f24 > f12 && (await main(page).locator('[data-quarter-strip]').innerText()).includes('Months 22 to 24'), 'Retirement Forecast: 24 months lists more, with eight quarters', `${f12} then ${f24}`);
  await rowsOf(page, false).first().click();
  await dialogOf(page).waitFor();
  const ftext = await dialogOf(page).innerText();
  check(['Becomes Due', 'Why', 'Age Reached On', 'Service Reached On'].every((l) => ftext.includes(l)) && await dialogOf(page).getByRole('button', { name: 'Open Record' }).count() > 0, 'Retirement Forecast: the dialog holds the dates and Open Record');
  await closeAll(page);
  await printPreview(page, 'Retirement Forecast');
  await downloadsWorkbook(page, 'Retirement Forecast', /^Retirement Forecast\.xlsx$/);
  await main(page).locator('[data-due-today-link]').click();
  await page.waitForFunction(() => location.hash === '#discharge/process');
  check(true, 'Retirement Forecast: the figure for those already due links to Process Discharge');

  check(errors.length === 0, 'Admin screens: no browser errors', errors.join(' | '));
  await context.close();
}

async function openRowByText(page, text) {
  const row = rowsOf(page, false).filter({ hasText: text }).first();
  await row.waitFor({ timeout: 10000 });
  await row.click();
  await dialogOf(page).waitFor();
}

// ---------------------------------------------------------------------------
// Each layout: every page and its main dialog
// ---------------------------------------------------------------------------
async function layoutPass(browser, viewport, theme, shared) {
  const label = `${viewport.width}px ${theme}`;
  console.log(`\nLayout ${label}`);
  const { context, page, errors, phone } = await open(browser, { viewport, theme });
  await signIn(page, ADMIN);
  const first = async () => { await rowsOf(page, phone).first().click(); };
  const plan = [
    [`reports/ship-history`, async () => { await filterSelect(page, phone, 'shipId', shared.ship.name); await first(); }],
    ['reports/all-personnel', first],
    ['reports/disposition', first],
    [`reports/nominal-roll?shipId=${shared.ship.id}`, first],
    ['reports/nominal-roll?commandId=' + shared.western.id, first],
    ['reports/manning-state', first],
    ['reports/retirement-forecast', first],
  ];
  for (const [route, openMain] of plan) {
    await go(page, route);
    await noOverflow(page, `${label} ${route}`);
    await shot(page, `${viewport.width}-${theme}-${route.replace(/[/?=]/g, '-')}`);
    await openMain();
    await dialogOf(page).waitFor();
    await page.waitForTimeout(150);
    const fits = await dialogOf(page).evaluate((d) => d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().right <= window.innerWidth + 1);
    check(fits, `${label} ${route}: its dialog fits`);
    const words = `${await main(page).innerText()} ${await dialogOf(page).innerText()}`;
    check(!/\b(null|undefined|NaN|\[object Object\])\b/.test(words), `${label} ${route}: no null, undefined or NaN on the page or in the dialog`);
    await shot(page, `${viewport.width}-${theme}-${route.replace(/[/?=]/g, '-')}-dialog`);
    await closeAll(page);
  }
  // a printout in the preview, on each layout
  await go(page, 'reports/retirement-forecast');
  await printPreview(page, `${label}: Retirement Forecast`);
  await go(page, `reports/nominal-roll?commandId=${shared.western.id}`);
  await printPreview(page, `${label}: Nominal Roll`);
  if (phone) {
    await go(page, 'reports/all-personnel');
    check(await page.locator('#app-main [data-filters] button', { hasText: 'Filters' }).isVisible(), `${label}: the filters fold into a Filters button`);
    check(await rowsOf(page, true).count() > 0, `${label}: the lists are cards`);
    check(await page.locator('#module-tabs a', { hasText: 'Retirement Forecast' }).count() > 0, `${label}: the six report tabs are there (swipe for the rest)`);
  } else {
    await go(page, 'reports/all-personnel');
    await rowsOf(page, false).first().hover();
    check(await page.locator('[data-tip-pop], [role="tooltip"]').filter({ hasText: 'View Details' }).count() > 0 || await rowsOf(page, false).first().evaluate((r) => r.matches('[tabindex]')), `${label}: a row can be opened (View Details)`);
  }
  check(errors.length === 0, `${label}: no browser errors`, errors.join(' | '));
  await context.close();
}

async function main_() {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const browser = await chromium.launch();
  try {
    // the screens run first, on the seeded data; the API flow then adds a proposal and a re-engagement of its own
    const shared = await apiShared(browser, db);
    await screensFlow(browser, shared);
    await privileges(browser);
    for (const vp of [DESKTOP, PHONE]) for (const theme of ['light', 'dark']) await layoutPass(browser, vp, theme, shared);
    await apiFlow(browser, db);
  } finally {
    await browser.close();
    await db.end();
  }
  const seconds = Math.round((Date.now() - STARTED) / 1000);
  console.log(`\nTotal time ${seconds} s (limit ${LIMIT_SECONDS} s).`);
  if (seconds > LIMIT_SECONDS) { failures += 1; console.log('  FAIL  the walk-through took longer than five minutes'); }
  console.log(`${passes} checks passed, ${failures} failed.`);
  process.exit(failures ? 1 : 0);
}

/** The ship and command the screens use (ARADU and Western), found through the options. */
async function apiShared(browser) {
  const { context, page } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);
  const o = (await api(page, 'GET', '/api/reports/options')).body.data;
  await context.close();
  return { ship: o.ships.find((s) => s.name === 'NNS ARADU'), western: o.commands.find((c) => c.name === 'Western Naval Command') };
}

main_().catch((e) => { console.error(e); process.exit(1); });
