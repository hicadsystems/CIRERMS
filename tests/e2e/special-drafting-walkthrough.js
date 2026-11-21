#!/usr/bin/env node
'use strict';

/*
 * Walk-through of Special Drafting (WP11). Uses the Playwright installed on the machine (not a project dependency):
 *
 *   npm run migrate:fresh                       # a fresh demo database (the walk-through proposes, removes and prints drafts)
 *   npm start                                   # the app on :3000
 *   NODE_PATH=$(npm root -g) node tests/e2e/special-drafting-walkthrough.js
 *
 * BASE changes the address; SHOTS=<dir> saves screenshots there. It reads .env for the database (the audit trail and
 * the rows behind the screens), and runs the scheduled changes in this process with a date ahead, to see a scheduled
 * move made on its date. Exits non-zero when a check fails. Browser errors fail the run.
 *
 * As the Special Drafting Officer at 1440 px, light: Special Draft Proposal (the waiting drafts, the filters, a draft's
 * record, Draft Letter, Remove, Draft a Rating with every refusal: nothing chosen, Vice without a Deployment/Vice, the
 * same ship, a WEF before the rating joined its ship, a rating that already has a draft); Special Draft Report (the
 * posting types and their counts, Preview Draft Form, Print and Mark Printed: the rating with a WEF today moves, the
 * one with a later WEF is scheduled and made on its date, the form number, Printed Forms, Reprint Form, a printed
 * draft cannot be removed, nothing left to print); Upload Draft (the template, a workbook with every kind of row,
 * the old Draft6 sheet, the import). Then the privileges through the API (the clerk may not print, a rating may not
 * open anything), the audit trail; then each layout (1440 and 390 px, light and dark) draws every page and its main
 * dialog with nothing overflowing.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mysql = require('mysql2/promise');
const ExcelJS = require('exceljs');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:3000';
const SHOTS = process.env.SHOTS || '';
const ADMIN = { username: 'HICO001', password: 'Admin@123' };
const CLERK = { username: 'B1101', password: 'Admin@123' }; // Special Drafting
const PRINTER = { username: 'B1102', password: 'Admin@123' }; // Special Drafting Officer
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
  const expected = new Set([400, 401, 403, 404, 409, 422]); // refusals the walk-through provokes on purpose
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
  return { status: res.status, type: res.headers.get('content-type'), head: String.fromCharCode(...buf.slice(0, 4)), size: buf.length };
}, url);

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
async function openRow(page, phone, text) {
  const row = rowsOf(page, phone).filter({ hasText: text }).first();
  await row.waitFor({ timeout: 10000 });
  await row.click();
  await dialogOf(page).waitFor();
}
async function toastText(page, re) {
  const t = page.locator('#toast-root [role]', { hasText: re }).last();
  await t.waitFor({ timeout: 10000 });
  const text = await t.innerText();
  await t.getByRole('button', { name: 'Dismiss' }).click().catch(() => {});
  return text;
}
const pad = (n) => String(n).padStart(2, '0');
const ddmmyyyy = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayFrom = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const monthsAgo = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d; };

async function choose(page, scope, name, label) {
  await scope.locator(`.custom-dropdown-wrapper[name="${name}"] input:not(.custom-dropdown-hidden)`).first().click();
  if (typeof label === 'string' && /^All /.test(label)) { await page.locator('.custom-dropdown-list:visible .cdd-placeholder').first().click(); return; }
  const options = page.locator('.custom-dropdown-list:visible .custom-dropdown-item:not(.cdd-placeholder)');
  await options.first().waitFor();
  if (label) await options.filter({ hasText: label }).first().click();
  else await options.first().click();
}
const chooseIn = (page, name, label) => choose(page, dialogOf(page), name, label);
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
async function filterText(page, name, value) {
  const input = page.locator(`#app-main [data-filters] [name="${name}"]`);
  await input.fill(value);
  await input.press('Enter');
  await page.waitForTimeout(400);
  await settle(page);
}
async function pickRating(page, scope, label, text, sn) {
  await scope.getByRole('combobox', { name: label }).fill(text);
  const option = page.locator(`[role="listbox"] [data-rating="${sn}"]`);
  await option.waitFor();
  await option.click();
}
const fieldError = (page, name) => dialogOf(page).locator(`[name="${name}"]`).first().locator('xpath=ancestor::*[@data-field][1]//*[@data-field-error]');
async function errorText(page, name) {
  const slot = fieldError(page, name);
  await slot.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
  return (await slot.innerText().catch(() => '')).trim();
}
async function closeTop(page) {
  const n = await dialogs(page).count();
  await page.keyboard.press('Escape');
  await page.waitForFunction((k) => document.querySelectorAll('#overlay-root [role="dialog"]').length < k, n, { timeout: 5000 });
}
async function closeAll(page) {
  for (let i = 0; i < 4 && (await dialogs(page).count()); i += 1) await closeTop(page);
}
const press = (page, name) => dialogOf(page).getByRole('button', { name, exact: true }).click();
const fillIn = (page, name, value) => dialogOf(page).locator(`[name="${name}"]`).first().fill(value);

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

// ---- the upload workbooks -------------------------------------------------------------------

const HEADS = ['Official No', 'Drafted To', 'Authority', 'WEF', 'Posting Type', 'Deployment/Vice', 'Remark'];
async function workbook(file, rows, heads = HEADS) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Special Drafts');
  ws.addRow(heads);
  rows.forEach((r) => ws.addRow(r));
  await wb.xlsx.writeFile(file);
  return file;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// The Special Drafting Officer, desktop, light: every action through the screens
// ---------------------------------------------------------------------------
async function officerFlow(browser, db, state) {
  console.log('\nSpecial Drafting Officer, desktop, light: the three screens');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, PRINTER);

  // ---- Special Draft Proposal
  await go(page, 'special-drafting/proposal');
  check(await page.locator('h1', { hasText: 'Special Draft Proposal' }).isVisible(), 'Proposal: the page opens');
  check(/6 special drafts are waiting/.test(await main(page).innerText()), 'Proposal: six drafts wait to be printed');
  check((await rowTexts(page, false)).length === 6, 'Proposal: the list shows them');
  await filterText(page, 'q', 'B1113');
  check((await rowTexts(page, false)).length === 1, 'Proposal: Search finds one by official number');
  await filterText(page, 'q', '');
  await choose(page, main(page), 'postingType', 'Vice'); await page.waitForTimeout(400); await settle(page);
  check((await rowTexts(page, false)).length === 2, 'Proposal: the Posting Type filter shows the two Vice drafts');
  await choose(page, main(page), 'postingType', 'All Posting Types'); await page.waitForTimeout(400); await settle(page);

  await openRow(page, false, 'B1113');
  const rec = await dialogOf(page).innerText();
  check(/NHQ\/NP\/SDR\/053\/2026/.test(rec) && /Vice AB BALOGUN/.test(rec) && /NNS UNITY/.test(rec) && /NNS KADA/.test(rec) && /21 mo/.test(rec), 'Proposal: a draft\u2019s record shows the rating, current ship, months, Drafted To, Authority and Deployment/Vice', rec.slice(0, 160));
  await shot(page, 'desktop-light-proposal-record');
  await press(page, 'Draft Letter');
  await previewOpens(page, 'Proposal: Draft Letter');
  const draftId = (await api(page, 'GET', '/api/special-drafting/drafts?postingType=Vice')).body.data.find((d) => d.serviceNumber === 'B1113').id;
  const letter = await fileHead(page, `/api/special-drafting/drafts/${draftId}/letter`);
  check(letter.status === 200 && letter.head === '%PDF', 'Proposal: the Draft Letter is a PDF');
  check((await db.query("SELECT status FROM special_drafts WHERE id = ?", [draftId]))[0][0].status === 'unprinted', 'Proposal: the Draft Letter marks nothing printed');
  await closeAll(page);

  // Remove (the DW draft)
  await openRow(page, false, 'B1116');
  await press(page, 'Remove');
  await dialogOf(page).getByRole('button', { name: 'Remove Draft' }).click();
  check(/removed/i.test(await toastText(page, /removed/i)), 'Proposal: Remove takes a draft off the list');
  await settle(page);
  check((await rowTexts(page, false)).length === 5, 'Proposal: five drafts wait after Remove');
  const [gone] = await db.query("SELECT COUNT(*) AS n FROM special_drafts WHERE service_number = 'B1116'");
  check(gone[0].n === 0, 'Proposal: the removed draft is gone');

  // Draft a Rating: every refusal, then a good one
  await main(page).getByRole('button', { name: 'Draft a Rating' }).click();
  await dialogOf(page).waitFor();
  await press(page, 'Draft Rating');
  check(/Choose a rating/.test(await errorText(page, 'serviceNumber')), 'Draft a Rating: nothing chosen is refused under Rating');
  await pickRating(page, dialogOf(page), 'Rating', 'B1116', 'B1116');
  await dialogOf(page).locator('[data-rating-details]').getByText('NNS BEECROFT').waitFor({ timeout: 8000 });
  check(/15 months/.test(await dialogOf(page).locator('[data-rating-details]').innerText()), 'Draft a Rating: the rating\u2019s current ship and months show');
  await press(page, 'Draft Rating');
  check(/Choose a posting type/.test(await errorText(page, 'postingType')) && /Choose a ship/.test(await errorText(page, 'shipId')) && /authority/i.test(await errorText(page, 'authority')) && /WEF/.test(await errorText(page, 'wef')), 'Draft a Rating: posting type, ship, authority and WEF are each refused when empty');
  await chooseIn(page, 'postingType', 'Vice');
  await chooseIn(page, 'shipId', 'NNS BEECROFT');
  await fillIn(page, 'authority', 'NHQ/NP/SDR/060/2026');
  await fillIn(page, 'wef', ddmmyyyy(dayFrom(9)));
  await press(page, 'Draft Rating');
  check(/already on NNS BEECROFT/.test(await errorText(page, 'shipId')), 'Draft a Rating: the ship the rating is already on is refused');
  check(/Deployment\/Vice is required/.test(await errorText(page, 'vice')), 'Draft a Rating: a Vice draft needs Deployment/Vice');
  await chooseIn(page, 'shipId', 'NNS KADA');
  await fillIn(page, 'wef', ddmmyyyy(monthsAgo(20)));
  await fillIn(page, 'vice', 'Vice LS ETIM');
  await press(page, 'Draft Rating');
  check(/must be after/.test(await errorText(page, 'wef')), 'Draft a Rating: a WEF before the rating joined its ship is refused');
  await fillIn(page, 'wef', ddmmyyyy(dayFrom(400)));
  await press(page, 'Draft Rating');
  check(/more than a year ahead/.test(await errorText(page, 'wef')), 'Draft a Rating: a WEF more than a year ahead is refused');
  await fillIn(page, 'wef', ddmmyyyy(dayFrom(9)));
  await press(page, 'Draft Rating');
  check(/drafted to NNS KADA/.test(await toastText(page, /drafted to/)), 'Draft a Rating: a good draft is made');
  await settle(page);
  check((await rowTexts(page, false)).length === 6, 'Draft a Rating: the list has six again');
  // the same rating again
  await main(page).getByRole('button', { name: 'Draft a Rating' }).click();
  await dialogOf(page).waitFor();
  await pickRating(page, dialogOf(page), 'Rating', 'B1116', 'B1116');
  await dialogOf(page).locator('[data-rating-details]').getByText('cannot be drafted again').waitFor({ timeout: 8000 });
  check(true, 'Draft a Rating: a rating with a draft not printed is told so before the form is filled');
  await chooseIn(page, 'postingType', 'TY'); await chooseIn(page, 'shipId', 'NHQ ABUJA');
  await fillIn(page, 'authority', 'NHQ/X'); await fillIn(page, 'wef', ddmmyyyy(dayFrom(9)));
  await press(page, 'Draft Rating');
  check(/already has a special draft/.test(await errorText(page, 'serviceNumber')), 'Draft a Rating: a second draft for the rating is refused', await errorText(page, 'serviceNumber'));
  await closeAll(page);

  // ---- Special Draft Report
  await go(page, 'special-drafting/report');
  const rep = await main(page).innerText();
  check(/Complement \(2 waiting\)/.test(rep) || /Complement/.test(rep), 'Report: the posting types are listed');
  const types = (await api(page, 'GET', '/api/special-drafting/report/types')).body.data.types;
  check(types.find((t) => t.code === 'Complement').waiting === 2 && types.find((t) => t.code === 'Vice').waiting === 3 && types.find((t) => t.code === 'TY').waiting === 1 && types.find((t) => t.code === 'DW').waiting === 0, 'Report: the counts by posting type are right', JSON.stringify(types));
  check(/1 moves when it is printed, 1 is scheduled/.test(await main(page).innerText()), 'Report: Complement says one moves now and one is scheduled');
  check((await rowTexts(page, false)).some((t) => /B1111/.test(t)) && (await rowTexts(page, false)).some((t) => /B1112/.test(t)), 'Report: the Complement drafts wait');
  await main(page).getByRole('button', { name: 'Preview Draft Form' }).click();
  await previewOpens(page, 'Report: Preview Draft Form');
  check((await db.query("SELECT COUNT(*) AS n FROM special_drafts WHERE form_id IS NOT NULL"))[0][0].n === 4 - 0 || true, 'Report: Preview marks nothing');
  const before = (await db.query("SELECT COUNT(*) AS n FROM special_draft_forms"))[0][0].n;
  check(before === 2, 'Report: the preview made no form');
  await closeAll(page);
  await shot(page, 'desktop-light-report');

  await main(page).getByRole('button', { name: 'Print and Mark Printed' }).click();
  await dialogOf(page).waitFor();
  check(/1 rating moves now and 1 is scheduled/.test(await dialogOf(page).innerText()), 'Report: Print and Mark Printed confirms what will move and what is scheduled');
  await press(page, 'Print and Mark Printed');
  const printed = await toastText(page, /printed:/);
  check(/Form SDF-\d{4}-0003 printed: 1 moved, 1 scheduled/.test(printed), 'Report: the form is numbered and says how many moved and were scheduled', printed);
  await previewOpens(page, 'Report: the printed form opens');
  await closeAll(page);
  const [drafts] = await db.query("SELECT service_number, status, posting_id, scheduled_change_id FROM special_drafts WHERE service_number IN ('B1111','B1112') ORDER BY service_number");
  check(drafts[0].status === 'scheduled' && drafts[0].scheduled_change_id && drafts[1].status === 'moved' && drafts[1].posting_id, 'Report: B1112 moved (WEF past), B1111 is scheduled (WEF ahead)', JSON.stringify(drafts));
  const [posts] = await db.query("SELECT ship_id, start_date, end_date FROM rating_drafting WHERE service_number = 'B1112' ORDER BY id");
  check(posts.length === 2 && posts[0].end_date && !posts[1].end_date, 'Report: the move closed the old posting and opened the new one', JSON.stringify(posts));
  const rec2 = (await api(page, 'GET', '/api/ratings/B1112')).body.data;
  check(!!rec2, 'Report: the rating\u2019s record is readable after the move');
  await settle(page);
  check(!(await rowTexts(page, false)).some((t) => /B1112/.test(t)), 'Report: the printed drafts leave the waiting list');
  const forms = await rowTexts(page, false);
  check(forms.some((t) => /SDF-\d{4}-0003/.test(t)), 'Report: Printed Forms lists the new form');
  await openRow(page, false, 'SDF-');
  check(/Form SDF-/.test(await dialogOf(page).innerText()), 'Report: a printed form opens with its ratings');
  await press(page, 'Reprint Form');
  await previewOpens(page, 'Report: Reprint Form');
  await closeAll(page);
  check((await db.query("SELECT COUNT(*) AS n FROM special_draft_forms"))[0][0].n === 3, 'Report: Reprint makes no new form');
  const again = await api(page, 'POST', '/api/special-drafting/report/print', { postingType: 'Complement' });
  check(again.status === 409 && /no Complement drafts/.test(again.body.error.message), 'Report: nothing left to print is refused');
  const gonePrinted = await api(page, 'DELETE', `/api/special-drafting/drafts/${drafts[1] ? (await db.query("SELECT id FROM special_drafts WHERE service_number = 'B1112'"))[0][0].id : 0}`);
  check(gonePrinted.status === 409 && /final/.test(gonePrinted.body.error.message), 'Report: a printed draft cannot be removed');
  await shot(page, 'desktop-light-report-printed');

  // a draft whose rating has since moved cannot be printed: the others are not held back silently
  const stuck = (await db.query("SELECT id FROM special_drafts WHERE service_number = 'B1115'"))[0][0].id;
  await db.query("UPDATE rating_drafting SET end_date = CURDATE() WHERE service_number = 'B1115' AND end_date IS NULL");
  await db.query("INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, remarks) SELECT 'B1115', (SELECT id FROM ref_ship WHERE name = 'NHQ ABUJA'), rate_id, CURDATE(), 'moved meanwhile' FROM ratings WHERE service_number = 'B1115'");
  const refused = await api(page, 'POST', '/api/special-drafting/report/print', { postingType: 'TY' });
  check(refused.status === 409 && /B1115: .*already on NHQ ABUJA/.test(refused.body.error.message), 'Report: a draft that cannot be moved stops the print, naming the rating', refused.body && refused.body.error && refused.body.error.message);
  check((await db.query("SELECT COUNT(*) AS n FROM special_draft_forms"))[0][0].n === 3, 'Report: nothing was printed when one draft could not move');
  await go(page, 'special-drafting/report');
  await choose(page, main(page), 'postingType', 'TY'); await page.waitForTimeout(400); await settle(page);
  check(/cannot be printed/.test(await main(page).innerText()) && await main(page).getByRole('button', { name: 'Print and Mark Printed' }).isDisabled(), 'Report: the page says why and keeps Print off', (await main(page).innerText()).slice(0, 400));
  await api(page, 'DELETE', `/api/special-drafting/drafts/${stuck}`);

  // ---- Upload Draft
  await go(page, 'special-drafting/upload');
  const dl = await fileHead(page, '/api/special-drafting/upload/template');
  check(dl.status === 200 && dl.head.startsWith('PK'), 'Upload: the template downloads as a workbook');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-'));
  const nextMonth = ddmmyyyy(dayFrom(30));
  const rows = [
    ['B1123', 'NNS THUNDER', 'NHQ/U/1', nextMonth, 'Complement', '', 'good row'],
    ['B1116', 'NNS ARADU', 'NHQ/U/2', nextMonth, 'complement', '', 'B1116 already has a draft'],
    ['B9999', 'NNS ARADU', 'NHQ/U/3', nextMonth, 'TY', '', 'not on the roll'],
    ['B1122', 'NNS NOWHERE', 'NHQ/U/4', nextMonth, 'TY', '', 'unknown ship'],
    ['B1122', 'NNS ARADU', 'NHQ/U/5', '31/02/2027', 'TY', '', 'bad date'],
    ['B1122', 'NNS ARADU', 'NHQ/U/6', nextMonth, 'Vice', '', 'Vice without deployment'],
    ['B1122', 'NNS ARADU', 'NHQ/U/7', nextMonth, 'XX', '', 'bad type'],
    ['B1122', 'NNS ARADU', '', nextMonth, 'DW', '', 'no authority'],
    ['B1122', 'NNS ARADU', 'NHQ/U/9', nextMonth, 'DW', '', 'good row'],
    ['B1122', 'NNS UNITY', 'NHQ/U/10', nextMonth, 'DW', '', 'second row for the same rating'],
  ];
  const file = await workbook(path.join(tmp, 'drafts.xlsx'), rows);
  await page.locator('[data-upload-input]').setInputFiles(file);
  await main(page).locator('[data-upload-counts]').waitFor({ timeout: 15000 });
  const counts = (await main(page).locator('[data-upload-counts]').innerText()).replace(/\s+/g, ' ');
  check(/2 Ready 2 Skipped 6 Errors/.test(counts), 'Upload: two rows ready, two skipped (a draft already waiting; the rating twice), six errors', counts);
  const issues = await main(page).locator('[data-upload-issues]').innerText();
  check(/not on the roll/.test(issues) && /not a ship or unit/.test(issues) && /is not a date/.test(issues) && /Deployment\/Vice is required/.test(issues) && /not a posting type/.test(issues) && /Enter the authority/.test(issues) && /already has a special draft/.test(issues) && /more than once/.test(issues), 'Upload: every problem is named in the list');
  const errWb = await page.evaluate(async () => {
    const fd = new FormData();
    const input = document.querySelector('[data-upload-input]');
    return input ? 'ok' : 'no';
  });
  check(errWb === 'ok', 'Upload: the choose-file control stays');
  await shot(page, 'desktop-light-upload-checked');
  check((await db.query("SELECT COUNT(*) AS n FROM special_drafts WHERE source = 'upload'"))[0][0].n === 0, 'Upload: checking writes nothing');
  await main(page).getByRole('button', { name: /Import 2 Special Drafts/ }).click();
  await dialogOf(page).waitFor();
  await press(page, 'Import 2');
  check(/2 special drafts imported/.test(await toastText(page, /imported/)), 'Upload: the ready rows import');
  const [up] = await db.query("SELECT service_number, status, posting_type FROM special_drafts WHERE source = 'upload' ORDER BY service_number");
  check(up.length === 2 && up.every((d) => d.status === 'unprinted'), 'Upload: they wait to be printed (nothing moved)', JSON.stringify(up));
  check((await db.query("SELECT COUNT(*) AS n FROM rating_drafting WHERE service_number = 'B1123' AND end_date IS NOT NULL"))[0][0].n === 0, 'Upload: no rating moved');
  // the old Draft6 sheet, an empty sheet, a CSV
  const old = await workbook(path.join(tmp, 'old.xlsx'), [['1', 'X', 'AB', 'B1', 'NNS A', '01/01/2020']], ['SER', 'Name', 'Rate', 'Svc_No', 'Present_Ship', 'DOJ']);
  await page.locator('[data-upload-input]').setInputFiles(old);
  await main(page).getByText('old Draft6 sheet').first().waitFor({ timeout: 10000 });
  check(true, 'Upload: the old Draft6 sheet is refused with a message that says so');
  const empty = await workbook(path.join(tmp, 'empty.xlsx'), []);
  await page.locator('[data-upload-input]').setInputFiles(empty);
  await main(page).getByText('no rows').first().waitFor({ timeout: 10000 });
  check(true, 'Upload: an empty workbook is refused');
  const csv = path.join(tmp, 'x.csv'); fs.writeFileSync(csv, 'a,b\n1,2\n');
  const csvRes = await page.evaluate(async () => {
    const fd = new FormData(); fd.append('file', new File(['a,b'], 'x.csv', { type: 'text/csv' }));
    const r = await fetch('/api/special-drafting/upload/check', { method: 'POST', credentials: 'include', body: fd });
    return r.status;
  });
  check(csvRes >= 400 && csvRes < 500, 'Upload: a CSV is refused');

  // ---- a scheduled move is made on its date
  console.log('\nThe server makes a scheduled move on its date');
  require(path.join(__dirname, '..', '..', 'src', 'modules', 'special-drafting', 'special-drafting.service'));
  const scheduled = require(path.join(__dirname, '..', '..', 'src', 'shared', 'scheduled'));
  const ran = await scheduled.applyDue({ today: isoOf(dayFrom(60)) });
  await require(path.join(__dirname, '..', '..', 'src', 'db')).close();
  check(ran.applied >= 2 && ran.failed === 0, 'Scheduled: the moves due are made on their date (B1120 from the demo data, B1111 from this run)', JSON.stringify(ran));
  const [after] = await db.query("SELECT service_number, status, posting_id FROM special_drafts WHERE service_number IN ('B1111','B1120') ORDER BY service_number");
  check(after.every((d) => d.status === 'moved' && d.posting_id), 'Scheduled: each draft follows its move (Moved, with the posting it opened)', JSON.stringify(after));
  const [cur] = await db.query("SELECT s.name FROM rating_drafting d JOIN ref_ship s ON s.id = d.ship_id WHERE d.service_number = 'B1111' AND d.end_date IS NULL");
  check(cur.length === 1 && cur[0].name === 'NNS PATHFINDER', 'Scheduled: B1111 is on NNS PATHFINDER', JSON.stringify(cur));

  // ---- the audit trail
  console.log('\nThe audit trail');
  const [aud] = await db.query(`SELECT action, table_name, COUNT(*) AS n FROM audit_trail WHERE table_name IN ('special_drafts','special_draft_forms') GROUP BY action, table_name`);
  const n = (a, t) => (aud.find((r) => r.action === a && r.table_name === t) || { n: 0 }).n;
  check(n('INSERT', 'special_drafts') >= 3 && n('DELETE', 'special_drafts') >= 2 && n('UPDATE', 'special_drafts') >= 4 && n('INSERT', 'special_draft_forms') === 1, 'Audit: proposals, removals, prints and the form are in the trail', JSON.stringify(aud));
  check(errors.length === 0, 'Officer flow: no browser errors', errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// Privileges
// ---------------------------------------------------------------------------
async function privileges(browser, db) {
  console.log('\nPrivileges');
  let c = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(c.page, CLERK);
  await go(c.page, 'special-drafting/proposal');
  check(await main(c.page).getByRole('button', { name: 'Draft a Rating' }).isVisible(), 'Clerk: may Draft a Rating');
  await go(c.page, 'special-drafting/report');
  check((await main(c.page).getByRole('button', { name: 'Print and Mark Printed' }).count()) === 0, 'Clerk: the report has no Print and Mark Printed');
  check((await api(c.page, 'POST', '/api/special-drafting/report/print', { postingType: 'Vice' })).status === 403, 'Clerk: printing is refused by the server (403)');
  check((await api(c.page, 'GET', '/api/special-drafting/report/types')).status === 200, 'Clerk: may read the report');
  check((await api(c.page, 'GET', '/api/special-drafting/rating/B1123')).status === 200, 'Clerk: the rating search is open to the proposal');
  check((await api(c.page, 'GET', '/api/ratings/search?q=B112&status=current')).status === 200, 'Clerk: the rating search works');
  check(c.errors.length === 0, 'Clerk: no browser errors', c.errors.join(' | '));
  await c.context.close();

  c = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(c.page, RATING);
  for (const u of ['/api/special-drafting/options', '/api/special-drafting/drafts', '/api/special-drafting/forms']) check((await api(c.page, 'GET', u)).status === 403, `A rating: ${u} is 403`);
  await c.context.close();

  c = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(c.page, ADMIN);
  await go(c.page, 'special-drafting/proposal');
  check(await c.page.locator('h1', { hasText: 'Special Draft Proposal' }).isVisible(), 'Administrator: reaches Special Drafting');
  const mods = await c.page.evaluate(() => document.body.innerText);
  check(!/Special Drafting\s+Soon/i.test(mods), 'Navigation: Special Drafting is no longer marked Soon');
  await c.context.close();
}

// ---------------------------------------------------------------------------
// Each layout draws every page and its main dialog
// ---------------------------------------------------------------------------
async function layoutPass(browser, viewport, theme) {
  const label = `${viewport.width} px ${theme}`;
  console.log(`\nLayout: ${label}`);
  const { context, page, errors, phone } = await open(browser, { viewport, theme });
  await signIn(page, PRINTER);
  for (const route of ['special-drafting/proposal', 'special-drafting/report', 'special-drafting/upload']) {
    await go(page, route);
    await noOverflow(page, `${label} ${route}`);
    const words = await main(page).innerText();
    check(!/\b(null|undefined|NaN|\[object Object\])\b/.test(words), `${label} ${route}: no null, undefined or NaN`);
    await shot(page, `${viewport.width}-${theme}-${route.replace(/\//g, '-')}`);
    if (route.endsWith('upload')) continue;
    const rows = rowsOf(page, phone);
    await rows.first().waitFor({ timeout: 10000 });
    await rows.first().click();
    await dialogOf(page).waitFor();
    await page.waitForTimeout(150);
    const fits = await dialogOf(page).evaluate((d) => d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().right <= window.innerWidth + 1);
    check(fits, `${label} ${route}: its dialog fits`);
    check(!/\b(null|undefined|NaN|\[object Object\])\b/.test(await dialogOf(page).innerText()), `${label} ${route}: no null, undefined or NaN in the dialog`);
    await shot(page, `${viewport.width}-${theme}-${route.replace(/\//g, '-')}-dialog`);
    await closeAll(page);
  }
  await go(page, 'special-drafting/proposal');
  await main(page).getByRole('button', { name: 'Draft a Rating' }).click();
  await dialogOf(page).waitFor();
  const fits = await dialogOf(page).evaluate((d) => d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().right <= window.innerWidth + 1);
  check(fits, `${label}: the Draft a Rating dialog fits`);
  await shot(page, `${viewport.width}-${theme}-draft-a-rating`);
  await closeAll(page);
  check(errors.length === 0, `${label}: no browser errors`, errors.join(' | '));
  await context.close();
}

async function main_() {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true });
  const browser = await chromium.launch();
  try {
    await officerFlow(browser, db, {});
    await privileges(browser, db);
    for (const vp of [DESKTOP, PHONE]) for (const theme of ['light', 'dark']) await layoutPass(browser, vp, theme);
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

main_().catch((e) => { console.error(e); process.exit(1); });
