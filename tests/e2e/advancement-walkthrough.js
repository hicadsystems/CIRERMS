#!/usr/bin/env node
'use strict';

/*
 * Walk-through of Advancement Processing (WP8). Uses the Playwright installed on the machine (not a project
 * dependency):
 *
 *   npm run migrate:fresh                       # a fresh demo database (the walk-through makes and closes batches)
 *   npm start                                   # the app on :3000
 *   NODE_PATH=$(npm root -g) node tests/e2e/advancement-walkthrough.js
 *
 * BASE changes the address; SHOTS=<dir> saves screenshots there. It reads .env for the database (the audit
 * trail and the rows behind the screens), and runs the scheduled changes in this process with a date three
 * weeks ahead, to see a scheduled rate change take effect. Exits non-zero when a check fails. Browser errors
 * fail the run.
 *
 * As the Administrator at 1440 px, light: the whole cycle through the screens. Rates due for Advancement (who
 * is due reads only, the month bands, the pending case shown as information, Create Advancement Batch); Advancement
 * Review (Set New Rate, the next rate only, Not Recommended, Add Personnel and its refusal, Remove, the
 * Advancement Form, the workbook, Clear Batch); Approval (refused while a new rate is missing, approve, approve
 * again); Close (authority used, by any flow, future date, before the batch, then close; final); Board Returns
 * Update (a date before the rating joined its rate refused, a date today applies the new rate and the record's
 * Advancement tab gets the line, a future date for the batch is scheduled and made on its date); Report on
 * Promoted Rates (the filters, Print Batch Summary, a batch and its Advancement Report, Pending); Upload Advanced
 * Rates (the template, a workbook with every kind of row, an empty one, wrong headings, a CSV, the import).
 * Then the rules and privileges through the API (the Advancement role, the approver, a department-tied officer,
 * a rating) and the audit trail; then each layout (1440 and 390 px, light and dark) draws every page and its
 * main dialog with nothing overflowing.
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
const OFFICER = { username: 'B0801', password: 'Admin@123' }; // Advancement
const APPROVER = { username: 'B0802', password: 'Admin@123' }; // Advancement Approver
const DEPT_OFFICER = { username: 'B0803', password: 'Admin@123' }; // Advancement, Gunnery only
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
const HEADS = ['Official No', 'Old Rate', 'New Rate', 'Effective Date', 'Authority', 'Decoration', 'Remark'];
async function workbook(file, rows, heads = HEADS) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Advancements');
  ws.addRow(heads);
  rows.forEach((r) => ws.addRow(r));
  await wb.xlsx.writeFile(file);
  return file;
}

// ---------------------------------------------------------------------------
// Administrator, desktop, light: the whole cycle
// ---------------------------------------------------------------------------
async function adminFlow(browser, db, state) {
  console.log('\nAdministrator, desktop, light: the whole cycle');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);

  // ---- sidebar, tabs, Ctrl K
  const link = page.locator('#rail nav a', { hasText: 'Advancement Processing' }).first();
  check(await link.count() === 1 && !(await link.innerText()).includes('Soon'), 'Advancement Processing has lost its Soon badge');
  await link.click();
  await settle(page);
  check(page.url().endsWith('#advancement/due'), 'the module opens on Rates due for Advancement', page.url());
  for (const t of ['Rates due for Advancement', 'Advancement Review', 'Approval', 'Close', 'Board Returns Update', 'Report on Promoted Rates', 'Upload Advanced Rates']) {
    check(await page.locator('#module-tabs a', { hasText: t }).count() > 0, `tab: ${t}`);
  }
  await page.keyboard.press('Control+K');
  await page.keyboard.type('Board Returns');
  await page.locator('#palette-results').getByText('Board Returns Update').first().waitFor();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#advancement/board');
  check(true, 'Ctrl K finds and opens Board Returns Update');

  // ---- 1. Rates due for Advancement
  const [[{ n: batchesBefore }]] = await db.query('SELECT COUNT(*) AS n FROM batches');
  await go(page, 'advancement/due');
  const all = await rowTexts(page, false);
  check(all.length === 25 && /mo/.test(all.join(' ')), 'Due: 25 a page with the months in rate', String(all.length));
  await filterSelect(page, false, 'branchId', 'Naval Police');
  const due = await rowTexts(page, false);
  check(due.length === 3 && ['B0717', 'B0718', 'B0588'].every((sn) => due.some((t) => t.includes(sn))), 'Due: the Naval Police branch lists its three due ratings', due.join(' | '));
  check(/3 ratings are due/.test(await main(page).locator('[data-due-count]').innerText()), 'Due: the count');
  const [[{ n: batchesAfterSearch }]] = await db.query('SELECT COUNT(*) AS n FROM batches');
  check(batchesAfterSearch === batchesBefore, 'Due: a search makes no batch (the list only reads)');
  const bandsApi = (await api(page, 'GET', '/api/advancement/due?page=1')).body.data.concat((await api(page, 'GET', '/api/advancement/due?page=2')).body.data);
  const tone = (sn) => (bandsApi.find((r) => r.serviceNumber === sn) || {}).band;
  check(tone('B0812') === 'success' && tone('B0811') === 'warning' && tone('B0813') === 'error', 'Due: months in rate as a pill, 48-50 green, 51-54 amber, over 54 red (from the settings)', `${tone('B0812')} ${tone('B0811')} ${tone('B0813')}`);
  check(!bandsApi.some((r) => r.serviceNumber === 'B0825') && !bandsApi.some((r) => r.rateCode === 'NWO'), 'Due: under 48 months and the top rate are not due');
  check(bandsApi.some((r) => r.serviceNumber === 'B0813' && !r.inBatch) && bandsApi.some((r) => r.serviceNumber === 'B0824' && !r.inBatch), 'Due: a rating not recommended is back on the due list');
  await openRow(page, false, 'B0588');
  const dueDlg = await dialogOf(page).innerText();
  check(/In Rate Since/.test(dueDlg) && /1 pending disciplinary case/.test(dueDlg) && /does not change who is due/.test(dueDlg), 'Due: a row opens the rating; a pending case is shown as information only');
  await closeAll(page);
  await main(page).getByRole('button', { name: 'Create Advancement Batch' }).click();
  await dialogOf(page).locator('[data-batch-number]').waitFor();
  const cd = await dialogOf(page).innerText();
  check(/DOA-NP-ALL-ALL-000001/.test(cd) && /Ratings to Add\s*3/.test(cd), 'Due: Create Advancement Batch shows the batch number (DOA-NP-ALL-ALL-000001), the filters and the count', cd.replace(/\s+/g, ' '));
  await press(page, 'Create Batch');
  check(/Created batch DOA-NP-ALL-ALL-000001: 3 ratings/.test(await toastText(page, /Created batch/)), 'Due: the batch is made only when confirmed');
  await page.waitForFunction(() => location.hash.startsWith('#advancement/review'));
  await settle(page);
  const again = await api(page, 'POST', '/api/advancement/batches', { branchId: 8 });
  check(again.status === 409 && again.body.error.code === 'NOTHING_TO_ADD', 'Due: everyone in a batch is left out of a new one (409)');
  const np = (await api(page, 'GET', '/api/advancement/batches?stage=open')).body.data.find((b) => b.batchNumber === 'DOA-NP-ALL-ALL-000001');
  state.np = np;
  check(!!np && np.live === 3, 'Due: the new batch holds the three ratings');

  // ---- 2. Advancement Review
  check(/DOA-NP-ALL-ALL-000001/.test(await main(page).locator('[data-batch-facts]').innerText()), 'Review: opens on the new batch');
  check(/0 of 3 have a new rate/.test(await main(page).locator('[data-progress]').innerText()), 'Review: progress 0 of 3');
  const rowId = async (sn, batch = np.id) => (await api(page, 'GET', `/api/advancement/batches/${batch}/rows`)).body.data.find((x) => x.serviceNumber === sn).id;
  const notReady = await api(page, 'POST', '/api/advancement/approvals/12', { rank: 'CDR', name: 'A', appointment: 'B' });
  check(notReady.status === 409 && notReady.body.error.code === 'TARGET_MISSING', 'Approval: refused while a rating has no new rate (409)');
  const skip = await api(page, 'PUT', `/api/advancement/batches/${np.id}/rows/${await rowId('B0717')}`, { newRateId: 6 });
  check(skip.status === 422 && /one rate at a time/.test(skip.body.error.fields.newRateId), 'Review: a rating advances one rate at a time; a skip is refused (422)');
  await openRow(page, false, 'B0717');
  await press(page, 'Set New Rate');
  check(/Chief Petty Officer \(CPO\)/.test(await dialogOf(page).locator('[data-next-rate]').innerText()), 'Review: Set New Rate shows the next rate (PO to CPO) and offers no choice');
  check(await dialogOf(page).locator('.custom-dropdown-wrapper').count() === 0, 'Review: no rate list to choose from');
  await fillIn(page, 'remark', 'Outstanding conduct');
  await press(page, 'Set New Rate');
  check(/New rate CPO set/.test(await toastText(page, /New rate/)), 'Review: Set New Rate saved with remarks');
  await settle(page);
  await openRow(page, false, 'B0718');
  await press(page, 'Set New Rate');
  await press(page, 'Set New Rate');
  check(/New rate LS set/.test(await toastText(page, /New rate/)), 'Review: remarks are optional');
  await settle(page);
  await openRow(page, false, 'B0588');
  await press(page, 'Not Recommended');
  await press(page, 'Not Recommended');
  check(/Give the reason/.test(await errorText(page, 'reason')), 'Review: Not Recommended needs a reason');
  await fillIn(page, 'reason', 'Pending disciplinary case');
  await press(page, 'Not Recommended');
  check(/not recommended/.test(await toastText(page, /not recommended/)), 'Review: Not Recommended saved');
  await settle(page);
  const struck = rowsOf(page, false).filter({ hasText: 'B0588' });
  check(await struck.locator('s').count() === 1 && /Pending disciplinary case/.test(await struck.innerText()), 'Review: the rating is struck out with the reason');
  check(/2 of 2 have a new rate/.test(await main(page).locator('[data-progress]').innerText()), 'Review: progress 2 of 2');
  // Add Personnel: a rating not yet due may be added; one in another batch is refused
  await main(page).getByRole('button', { name: 'Add Personnel' }).click();
  await dialogOf(page).waitFor();
  await pickRating(page, dialogOf(page), 'Rating', 'B0811', 'B0811');
  await press(page, 'Add to Batch');
  check(/already in batch DOA-ALL-ALL-AB-000001/.test(await errorText(page, 'serviceNumber')), 'Review: Add Personnel refuses a rating already in a batch (naming it)');
  await pickRating(page, dialogOf(page), 'Rating', 'B0825', 'B0825');
  await press(page, 'Add to Batch');
  check(/added to DOA-NP-ALL-ALL-000001/.test(await toastText(page, /added to/)), 'Review: Add Personnel adds a rating (picked with the rating search select)');
  await settle(page);
  await openRow(page, false, 'B0825');
  await press(page, 'Remove');
  check(/Remove LS BELLO/.test(await dialogOf(page).innerText()), 'Review: Remove asks first');
  await press(page, 'Remove Rating');
  check(/Removed/.test(await toastText(page, /Removed from the batch/)), 'Review: Remove removes');
  await settle(page);
  await main(page).getByRole('button', { name: 'Print Form' }).click();
  await previewOpens(page, 'Advancement Form');
  await shot(page, 'desktop-light-advancement-form');
  await closeAll(page);
  const form = await fileHead(page, `/api/advancement/batches/${np.id}/form.pdf`);
  check(form.status === 200 && form.head === '%PDF', 'Review: the Advancement Form is a PDF');
  const xl = await page.evaluate(async (u) => { const r = await fetch(u, { credentials: 'include' }); return { status: r.status, type: r.headers.get('content-type'), disp: r.headers.get('content-disposition') }; }, `/api/advancement/batches/${np.id}/excel`);
  check(xl.status === 200 && /spreadsheetml/.test(xl.type) && /attachment/.test(xl.disp), 'Review: Export Excel gives the workbook');

  // ---- 3. Approval
  await go(page, 'advancement/approval');
  check(/DEPARTMENTS/i.test(await main(page).locator('[data-stats]').innerText()), 'Approval: the figures');
  await openRow(page, false, 'Regulating (Provost)');
  const ad = await dialogOf(page).innerText();
  check(/By New Rate/.test(ad) && /CPO\s*1/.test(ad) && /LS\s*1/.test(ad), 'Approval: the totals by new rate (from the Rates table)', ad.replace(/\s+/g, ' ').slice(0, 300));
  await dialogOf(page).locator('[data-dept-row]').first().waitFor();
  check(await dialogOf(page).locator('[data-dept-row]').count() === 2, 'Approval: the department\'s ratings (the one not recommended left out)');
  await press(page, 'Approve Department');
  await press(page, 'Approve');
  check(/Choose the approving rank/.test(await errorText(page, 'rank')), 'Approval: rank, name and appointment are required');
  await chooseIn(page, 'rank', 'CAPT');
  await fillIn(page, 'name', 'Adaora Nwankwo');
  await fillIn(page, 'appointment', 'Director of Personnel (Navy)');
  await press(page, 'Approve');
  check(/Regulating \(Provost\) approved by CAPT Adaora Nwankwo: 2 ratings/.test(await toastText(page, /approved by/)), 'Approval: the department is approved');
  await settle(page);
  await openRow(page, false, 'Regulating (Provost)');
  await press(page, 'Approve Again');
  check(/Approving again replaces that/.test(await dialogOf(page).innerText()), 'Approval: approving again warns it replaces the earlier approval');
  await closeAll(page);
  await openRow(page, false, 'ICT / Cyber');
  await press(page, 'Approve Department');
  check(await dialogOf(page).getByRole('button', { name: 'Approve', exact: true }).isDisabled() && /no new rate/.test(await dialogOf(page).innerText()), 'Approval: the button is off while a new rate is missing');
  await closeAll(page);

  // ---- 4. Close
  await go(page, 'advancement/close');
  await openRow(page, false, 'DOA-NP-ALL-ALL-000001');
  check(/Ready/.test(await dialogOf(page).innerText()), 'Close: the batch is ready');
  await press(page, 'Close Batch');
  await fillIn(page, 'authority', 'NHQ/NP/DOA/052/2026');
  await press(page, 'Close Batch');
  check(/already used by batch DOA-LG-ALL-ALL-000001/.test(await errorText(page, 'authority')), 'Close: an authority already used is refused (naming the batch)');
  await fillIn(page, 'authority', 'NHQ/NP/DOD/131/2026');
  await press(page, 'Close Batch');
  check(/already used by batch DOD-WE-ALL-ALL-000001/.test(await errorText(page, 'authority')), 'Close: the authority is unique across drafting and advancement');
  await fillIn(page, 'authority', 'NHQ/NP/DOA/060/2026');
  await fillIn(page, 'closeDate', ddmmyyyy(dayFrom(1)));
  await press(page, 'Close Batch');
  check(/cannot be in the future/.test(await errorText(page, 'closeDate')), 'Close: a future close date is refused');
  await fillIn(page, 'closeDate', ddmmyyyy(dayFrom(-1)));
  await press(page, 'Close Batch');
  check(/before the batch was started/.test(await errorText(page, 'closeDate')), 'Close: a close date before the batch began is refused');
  await fillIn(page, 'closeDate', ddmmyyyy(new Date()));
  await press(page, 'Close Batch');
  check(/closed under NHQ\/NP\/DOA\/060\/2026/.test(await toastText(page, /closed under/)), 'Close: the batch is closed');
  await page.waitForFunction(() => location.hash.startsWith('#advancement/board'));
  await settle(page);
  const closedAgain = await api(page, 'POST', `/api/advancement/batches/${np.id}/close`, { authority: 'X/1', closeDate: isoOf(new Date()) });
  check(closedAgain.status === 409 && closedAgain.body.error.code === 'BATCH_CLOSED', 'Close: a closed batch is final (409, no reopen)');
  const editClosed = await api(page, 'PUT', `/api/advancement/batches/${np.id}/rows/${await rowId('B0717')}`, { remark: 'x' });
  check(editClosed.status === 409, 'Review: a closed batch can no longer be changed (409)');
  const notApproved = (await api(page, 'GET', '/api/advancement/batches?stage=open')).body.data.find((b) => b.batchNumber === 'DOA-ALL-ALL-AB-000001');
  const early = await api(page, 'POST', `/api/advancement/batches/${notApproved.id}/close`, { authority: 'NHQ/NP/DOA/061/2026', closeDate: isoOf(new Date()) });
  check(early.status === 409 && early.body.error.code === 'BATCH_NOT_READY', 'Close: a batch not fully approved is refused (409)');

  // ---- 5. Board Returns Update
  check(/DOA-NP-ALL-ALL-000001/.test(await main(page).locator('[data-batch-facts]').innerText()), 'Board: opens on the batch just closed');
  check((await rowTexts(page, false)).length === 2, 'Board: the ratings to advance (not the one not recommended)');
  await openRow(page, false, 'B0717');
  await press(page, 'Set Date');
  await fillIn(page, 'date', ddmmyyyy(monthsAgo(100)));
  await press(page, 'Save Date');
  check(/before .* joined the current rate/.test(await errorText(page, 'date')), 'Board: a date before the rating joined its current rate is refused');
  await fillIn(page, 'date', ddmmyyyy(dayFrom(400)));
  await press(page, 'Save Date');
  check(/more than a year ahead/.test(await errorText(page, 'date')), 'Board: a date more than a year ahead is refused');
  await fillIn(page, 'date', ddmmyyyy(new Date()));
  await press(page, 'Save Date');
  check(/advanced to CPO from/.test(await toastText(page, /advanced to CPO/)), 'Board: a date today applies the new rate now');
  await settle(page);
  check(/Advanced/.test(await rowsOf(page, false).filter({ hasText: 'B0717' }).innerText()), 'Board: the row is Advanced');
  const rec = (await api(page, 'GET', '/api/ratings/B0717')).body.data;
  const lines = rec.children.advancement || [];
  check(rec.rating.rate_name === 'Chief Petty Officer (CPO)' && lines.some((l) => l.rate_name === 'Chief Petty Officer (CPO)' && l.start_date === isoOf(new Date()) && !l.end_date && l.authority === 'NHQ/NP/DOA/060/2026'),
    'Board: the rating\'s rate changes from the date and its Advancement tab gets the line (with the authority)', JSON.stringify({ rate: rec.rating.rate_name, lines: lines.map((l) => `${l.rate_name} ${l.start_date}-${l.end_date}`) }));
  await main(page).getByRole('button', { name: 'Set Date for Batch' }).click();
  await dialogOf(page).waitFor();
  check(/1 rating in DOA-NP-ALL-ALL-000001 with no date yet gets this date/.test(await dialogOf(page).innerText()), 'Set Date for Batch: says how many (dates already entered stay)');
  const future = dayFrom(20);
  await fillIn(page, 'date', ddmmyyyy(future));
  await press(page, 'Save Date');
  check(/saved for 1 rating \(1 scheduled\)/.test(await toastText(page, /saved for/)), 'Set Date for Batch: a future date is Scheduled');
  await settle(page);
  check(/Scheduled/.test(await rowsOf(page, false).filter({ hasText: 'B0718' }).innerText()) && /Advanced/.test(await rowsOf(page, false).filter({ hasText: 'B0717' }).innerText()), 'Board: the batch date left the date already entered alone');
  await go(page, 'ratings/edit/B0718?tab=advancement');
  await page.locator('[data-scheduled-advancement]').first().waitFor({ timeout: 10000 });
  const line = await page.locator('[data-scheduled-advancement]').first().innerText();
  check(new RegExp(`Advanced to LS wef ${ddmmyyyy(future).replace(/\//g, '\\/')}`).test(line) && /Scheduled/.test(line), 'Record: the Advancement tab shows the scheduled rate change', line);
  check((await api(page, 'GET', '/api/ratings/B0718')).body.data.rating.rate_name === 'Able Seaman (AB)', 'Record: the rate does not change before the date');
  await shot(page, 'desktop-light-record-scheduled');

  // ---- the scheduled change is made on its date (the server's hourly run, here with a date three weeks ahead)
  require(path.join(__dirname, '..', '..', 'src', 'modules', 'advancement', 'advancement.service'));
  const scheduled = require(path.join(__dirname, '..', '..', 'src', 'shared', 'scheduled'));
  const ran = await scheduled.applyDue({ today: isoOf(dayFrom(21)) });
  await require(path.join(__dirname, '..', '..', 'src', 'db')).close();
  check(ran.applied >= 2 && ran.failed === 0, 'Scheduled: the changes due are made on their date', JSON.stringify(ran));
  const after = (await api(page, 'GET', '/api/ratings/B0718')).body.data;
  check(after.rating.rate_name === 'Leading Seaman (LS)' && after.children.advancement.some((l) => l.rate_name === 'Leading Seaman (LS)' && l.start_date === isoOf(future)), 'Scheduled: the rate follows, with its Advancement line');
  const rows = (await api(page, 'GET', `/api/advancement/batches/${np.id}/rows`)).body.data;
  check(rows.filter((x) => x.status === 'advanced').length === 2, 'Scheduled: both rows are Advanced');
  const due2 = (await api(page, 'GET', '/api/advancement/due?branchId=8')).body.data;
  check(due2.length === 1 && due2[0].serviceNumber === 'B0588' && !due2[0].inBatch, 'Due: the rating not recommended is back on the due list; the advanced ones are not');

  // ---- 6. Report on Promoted Rates
  await go(page, 'advancement/promoted');
  check(/BATCHES\s*6/i.test(await main(page).locator('[data-stats]').innerText()), 'Report: every advancement batch (6)');
  await filterText(page, 'signal', 'DOA/060');
  let rep = await rowTexts(page, false);
  check(rep.length === 1 && /DOA-NP-ALL-ALL-000001/.test(rep[0]) && /2 of 2/.test(rep[0]), 'Report: the Signal Code filter, with total and promoted', rep.join(' | '));
  await filterText(page, 'signal', '');
  await filterText(page, 'batch', 'DOA-MD');
  rep = await rowTexts(page, false);
  check(rep.length === 1 && /DOA-MD-ALL-ALL-000001/.test(rep[0]), 'Report: the Batch No filter', rep.join(' | '));
  await filterText(page, 'batch', '');
  await filterSelect(page, false, 'branchId', 'Logistics');
  rep = await rowTexts(page, false);
  check(rep.some((t) => /DOA-LG-ALL-ALL-000001/.test(t)) && !rep.some((t) => /DOA-MD|DOA-NP|DOA-ME|DOA-SM/.test(t)), 'Report: the Branch filter (by the batch and its ratings, not the wrong table)', rep.join(' | '));
  await filterSelect(page, false, 'branchId', 'All Branches');
  await filterSelect(page, false, 'rateId', 'Chief Petty Officer');
  rep = await rowTexts(page, false);
  check(rep.length >= 3 && rep.some((t) => /DOA-SM-ALL-PO-000001/.test(t)) && rep.some((t) => /DOA-NP-ALL-ALL-000001/.test(t)), 'Report: the Rate filter (the Rates table, not the title table)', rep.join(' | '));
  await filterSelect(page, false, 'rateId', 'All Rates');
  await main(page).getByRole('button', { name: 'Print Batch Summary' }).click();
  await previewOpens(page, 'Batch Summary Report for Advancement');
  await closeAll(page);
  await openRow(page, false, 'DOA-LG-ALL-ALL-000001');
  await press(page, 'Open Contents');
  await page.waitForFunction(() => /^#advancement\/promoted\/\d+$/.test(location.hash));
  await settle(page);
  await rowsOf(page, false).first().waitFor();
  check((await rowTexts(page, false)).every((t) => /Pending/.test(t)), 'Report: a batch\'s ratings; an unreached date shows Pending');
  await main(page).getByRole('button', { name: 'Print Advancement Report' }).click();
  await previewOpens(page, 'Advancement Report');
  await shot(page, 'desktop-light-advancement-report');
  await closeAll(page);
  await filterText(page, 'name', 'UMOH');
  check((await rowTexts(page, false)).length === 1, 'Report: the batch\'s Name filter');
  const sum = await fileHead(page, '/api/advancement/report/pdf?branchId=4');
  check(sum.status === 200 && sum.head === '%PDF', 'Report: the Batch Summary takes the filters');

  // ---- 7. Upload Advanced Rates
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adv-upload-'));
  const good = await workbook(path.join(dir, 'advancements.xlsx'), [
    ['B0826', 'WO', 'MWO', ddmmyyyy(dayFrom(-30)), 'NHQ/NP/DOA/040/2026', 'Long Service Medal', 'Board of October'], // ready
    ['B0824', 'PO', 'CPO', ddmmyyyy(dayFrom(-60)), 'NHQ/NP/DOA/038/2026', '', ''], // ready
    ['B0824', 'CPO', 'WO', ddmmyyyy(dayFrom(-10)), 'NHQ/NP/DOA/041/2026', '', ''], // ready, after the row above
    ['B0824', 'CPO', 'WO', ddmmyyyy(dayFrom(-10)), 'NHQ/NP/DOA/041/2026', '', ''], // the same promotion twice: skipped
    ['B0539', 'LS', 'PO', '01/07/2022', 'NHQ/CNS/ADV/2022/059', '', ''], // already on the record: skipped
    ['B9999', 'AB', 'LS', '01/01/2026', '', '', ''], // not on the roll
    ['B0801', 'LS', 'PO', '01/01/2026', '', '', ''], // old rate not the rating's
    ['B0802', 'CPO', 'PO', '01/01/2026', '', '', ''], // new rate not above
    ['B0727', 'LS', 'PO', '', '', '', ''], // date empty
    ['B0726', 'LS', 'PO', ddmmyyyy(dayFrom(5)), '', '', ''], // future
    ['B0811', 'AB', 'LS', '01/01/2026', '', '', ''], // in an advancement batch not finished
    ['B0705', 'CPO', 'WO', '31/02/2026', '', '', ''], // not a date
  ]);
  const empty = await workbook(path.join(dir, 'advancements-empty.xlsx'), []);
  const oldHeads = await workbook(path.join(dir, 'advancements-old-format.xlsx'), [['B0826', 'WO', 'MWO']], ['svcno', 'oldrate', 'newrate']);
  const csv = path.join(dir, 'advancements.csv');
  fs.writeFileSync(csv, 'Official No,Old Rate\nB0826,WO\n');
  await go(page, 'advancement/upload');
  const tpl = await page.evaluate(async () => { const r = await fetch('/api/advancement/upload/template', { credentials: 'include' }); return { status: r.status, size: (await r.arrayBuffer()).byteLength }; });
  check(tpl.status === 200 && tpl.size > 1000, 'Upload: Download Template gives the workbook');
  const tplBook = new ExcelJS.Workbook();
  await tplBook.xlsx.load(Buffer.from(await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch('/api/advancement/upload/template', { credentials: 'include' })).arrayBuffer())))));
  check(HEADS.every((hd, i) => tplBook.worksheets[0].getRow(1).getCell(i + 1).value === hd), 'Upload: the template columns are Official No, Old Rate, New Rate, Effective Date, Authority, Decoration, Remark');
  const input = page.locator('[data-upload-input]');
  for (const [file, re, label] of [
    [csv, /Only modern Excel/, 'a CSV is refused'],
    [empty, /no rows under the headings/, 'a workbook with no rows is refused'],
    [oldHeads, /Column "Official No" was not found in row 1/, 'a workbook with other headings is refused'],
  ]) {
    await input.setInputFiles(file);
    await main(page).getByText('was not read.').waitFor({ timeout: 10000 });
    check(re.test(await main(page).innerText()), `Upload: ${label}`);
  }
  await input.setInputFiles(good);
  await main(page).locator('[data-upload-counts]').waitFor({ timeout: 10000 });
  const counts = (await main(page).locator('[data-upload-counts]').innerText()).replace(/\s+/g, ' ');
  check(/3 Ready 2 Skipped 7 Errors/.test(counts), 'Upload: the whole file is read first: 3 ready, 2 skipped, 7 errors', counts);
  const issues = (await rowTexts(page, false)).join(' | ');
  check(/B9999 is not on the roll/.test(issues) && /does not match the rating's rate on record \(PO\)/.test(issues) && /New Rate must be above the old rate/.test(issues)
    && /effective date is empty/.test(issues) && /in the future/.test(issues) && /is in advancement batch DOA-ALL-ALL-AB-000001/.test(issues) && /31\/02\/2026 is not a date/.test(issues),
  'Upload: each error row is listed with its row number and problem', issues);
  check(/was already advanced to WO/.test(issues) && /was already advanced to PO on 01\/07\/2022/.test(issues), 'Upload: the same promotion twice is skipped (in the file, and on the record)');
  const [[{ n: linesBefore }]] = await db.query("SELECT COUNT(*) AS n FROM rating_advancement WHERE service_number IN ('B0826','B0824')");
  check(linesBefore === 2, 'Upload: checking writes nothing');
  await main(page).getByRole('button', { name: 'Import 3 Advancements' }).click();
  check(/adds a line to each rating's Advancement tab and sets its rate/.test(await dialogOf(page).innerText()), 'Upload: Import asks first');
  await press(page, 'Import 3');
  check(/3 advancements imported/.test(await toastText(page, /imported/)), 'Upload: the ready rows are imported');
  await main(page).getByText('3 advancements imported.').waitFor();
  const b0826 = (await api(page, 'GET', '/api/ratings/B0826')).body.data;
  const b0824 = (await api(page, 'GET', '/api/ratings/B0824')).body.data;
  check(b0826.rating.rate_name === 'Master Warrant Officer (MWO)' && b0826.children.advancement.some((l) => l.rate_name === 'Master Warrant Officer (MWO)' && l.decoration === 'Long Service Medal' && !l.end_date)
    && b0826.children.advancement.some((l) => l.rate_name === 'Warrant Officer (WO)' && l.end_date === isoOf(dayFrom(-31))), 'Upload: importing sets the rate and adds the line (the old line ends the day before)');
  check(b0824.rating.rate_name === 'Warrant Officer (WO)' && b0824.children.advancement.filter((l) => /CPO|WO/.test(l.rate_name)).length === 2, 'Upload: two rows for one rating are applied in order');
  const [[{ n: uploads }]] = await db.query('SELECT COUNT(*) AS n FROM advancement_uploads');
  check(uploads === 3, 'Upload: each imported row is kept with its remark (advancement_uploads)');

  // ---- Clear Batch (on the seeded open batch)
  const ab = (await api(page, 'GET', '/api/advancement/batches?stage=open')).body.data.find((b) => b.batchNumber === 'DOA-ALL-ALL-AB-000001');
  await go(page, `advancement/review?batch=${ab.id}`);
  await main(page).getByRole('button', { name: 'Clear Batch' }).click();
  check(/Remove every rating/.test(await dialogOf(page).innerText()), 'Clear Batch asks first');
  await press(page, 'Clear Batch');
  check(/Batch cleared: 3 ratings removed/.test(await toastText(page, /Batch cleared/)), 'Clear Batch empties the batch');
  check(errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// Rules, privileges and the audit trail through the API
// ---------------------------------------------------------------------------
async function rolesAndRules(browser, db, state) {
  console.log('\nPrivileges, departments and the audit trail');
  let s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, OFFICER);
  check(await s.page.locator('#rail nav a', { hasText: 'Advancement Processing' }).count() === 1, 'Advancement role: the module is in the sidebar');
  check((await api(s.page, 'GET', '/api/advancement/due')).status === 200, 'Advancement role: reads who is due');
  const me = (await api(s.page, 'GET', '/api/advancement/batches?stage=open')).body.data.find((b) => b.batchNumber === 'DOA-ME-ALL-ALL-000001');
  const lg = (await api(s.page, 'GET', '/api/advancement/batches?stage=board')).body.data.find((b) => b.batchNumber === 'DOA-LG-ALL-ALL-000001');
  for (const [label, method, url, body] of [
    ['approve a department', 'POST', '/api/advancement/approvals/5', { rank: 'CDR', name: 'X', appointment: 'Y' }],
    ['close a batch', 'POST', `/api/advancement/batches/${me.id}/close`, { authority: 'X/2', closeDate: isoOf(new Date()) }],
    ['enter a board date', 'POST', `/api/advancement/batches/${lg.id}/board`, { date: isoOf(new Date()) }],
    ['import advanced rates', 'POST', '/api/advancement/upload', null],
  ]) check((await api(s.page, method, url, body)).status === 403, `Advancement role: may not ${label} (403)`);
  await go(s.page, 'advancement/approval');
  await openRow(s.page, false, 'Marine Propulsion');
  check(await dialogOf(s.page).getByRole('button', { name: /Approve/ }).count() === 0, 'Advancement role: the approval dialog has no Approve button');
  await closeAll(s.page);
  await go(s.page, 'advancement/upload');
  check(await main(s.page).locator('[data-choose-file]').isDisabled(), 'Advancement role: Upload offers the template only');
  check(s.errors.length === 0, 'no browser errors', s.errors.join(' | '));
  await s.context.close();

  s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, APPROVER);
  check((await api(s.page, 'POST', '/api/advancement/batches', { branchId: 3 })).status === 403, 'Approver role: may not make a batch (403)');
  check((await api(s.page, 'POST', `/api/advancement/batches/${me.id}/rows`, { serviceNumber: 'B0720' })).status === 403, 'Approver role: may not add personnel (403)');
  await go(s.page, 'advancement/due');
  check(await main(s.page).getByRole('button', { name: 'Create Advancement Batch' }).count() === 0, 'Approver role: no Create Advancement Batch button');
  const closed = await api(s.page, 'POST', `/api/advancement/batches/${me.id}/close`, { authority: 'NHQ/NP/DOA/062/2026', closeDate: isoOf(new Date()) });
  check(closed.status === 200 && closed.body.data.batch.status === 'closed', 'Approver role: closes the approved batch');
  check(s.errors.length === 0, 'no browser errors', s.errors.join(' | '));
  await s.context.close();

  s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, DEPT_OFFICER);
  const appr = (await api(s.page, 'GET', '/api/advancement/approvals')).body.data;
  check(appr.every((d) => d.department === 'Gunnery'), 'Department officer: sees only their department\'s approval', appr.map((d) => d.department).join(','));
  const dueMine = (await api(s.page, 'GET', '/api/advancement/due')).body.data;
  check(dueMine.length > 0 && dueMine.every((r) => r.specialisation === 'Gunnery'), 'Department officer: the due list is their department');
  check((await api(s.page, 'GET', '/api/advancement/batches?stage=open')).body.data.length === 0, 'Department officer: other departments\' batches are not listed');
  check((await api(s.page, 'GET', `/api/advancement/batches/${state.np.id}`)).status === 403, 'Department officer: another department\'s batch is refused (403)');
  check((await api(s.page, 'GET', '/api/advancement/due?specialisationId=2')).status === 403, 'Department officer: may not propose another department (403)');
  const mine = await api(s.page, 'POST', '/api/advancement/batches', {});
  check(mine.status === 201 && /^DOA-ALL-GUN-ALL-/.test(mine.body.data.batch.batchNumber), 'Department officer: a batch is made for their department', mine.body && mine.body.data && mine.body.data.batch.batchNumber);
  const other = await api(s.page, 'POST', `/api/advancement/batches/${mine.body.data.batch.id}/rows`, { serviceNumber: 'B0720' });
  check(other.status === 422 && /another department/.test(other.body.error.fields.serviceNumber), 'Department officer: may not add a rating of another department (422)');
  await go(s.page, 'advancement/due');
  check(/You propose for your department: Gunnery/.test(await main(s.page).innerText()), 'Department officer: the page says which department');
  check(s.errors.length === 0, 'no browser errors', s.errors.join(' | '));
  await s.context.close();

  s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, RATING);
  for (const u of ['/api/advancement/options', '/api/advancement/due', '/api/advancement/batches?stage=open', '/api/advancement/approvals', '/api/advancement/report', '/api/advancement/upload/template', '/api/advancement/rating/B0821/scheduled']) {
    check((await api(s.page, 'GET', u)).status === 403, `Rating: ${u} answers 403`);
  }
  check((await api(s.page, 'GET', '/api/advancement/rating/B0539/scheduled')).status === 200, 'Rating: reads the rate changes to come on their own record');
  await s.page.goto(`${BASE}/app.html#advancement/review`);
  await s.page.getByText('You Do Not Have Access to This Page').waitFor();
  check(true, 'Rating: the page shows the not-allowed state');
  check(s.errors.length === 0, 'no browser errors', s.errors.join(' | '));
  await s.context.close();

  const [audit] = await db.query(
    `SELECT action, table_name, COUNT(*) AS n FROM audit_trail
      WHERE table_name IN ('batches','advancement_rows','batch_approvals','rating_advancement','ratings','scheduled_changes','advancement_uploads')
      GROUP BY action, table_name`);
  const has = (a, t) => audit.some((r) => r.action === a && r.table_name === t && r.n > 0);
  check(has('INSERT', 'batches') && has('UPDATE', 'batches') && has('INSERT', 'advancement_rows') && has('UPDATE', 'advancement_rows') && has('DELETE', 'advancement_rows')
    && has('INSERT', 'batch_approvals') && has('INSERT', 'rating_advancement') && has('UPDATE', 'rating_advancement') && has('UPDATE', 'ratings')
    && has('INSERT', 'scheduled_changes') && has('UPDATE', 'scheduled_changes') && has('INSERT', 'advancement_uploads'),
  'Audit trail: every write of the cycle is recorded', JSON.stringify(audit.map((r) => `${r.action} ${r.table_name}`)));
  const [[sys]] = await db.query("SELECT COUNT(*) AS n FROM audit_trail WHERE username = 'SYSTEM' AND table_name = 'rating_advancement'");
  check(sys.n >= 2, 'Audit trail: the scheduled rate changes are recorded as made by SYSTEM');
  const [[proc]] = await db.query("SELECT COUNT(*) AS n FROM information_schema.routines WHERE routine_schema = DATABASE()");
  const [[views]] = await db.query("SELECT COUNT(*) AS n FROM information_schema.views WHERE table_schema = DATABASE()");
  const [[trg]] = await db.query("SELECT COUNT(*) AS n FROM information_schema.triggers WHERE trigger_schema = DATABASE()");
  check(proc.n === 0 && views.n === 0 && trg.n === 0, 'No stored procedures, functions, views or triggers');
}

// ---------------------------------------------------------------------------
// Each layout: every page and its main dialog
// ---------------------------------------------------------------------------
async function layoutPass(browser, viewport, theme, state) {
  const label = `${viewport.width}px ${theme}`;
  console.log(`\nLayout ${label}`);
  const { context, page, errors, phone } = await open(browser, { viewport, theme });
  await signIn(page, ADMIN);
  const firstRow = async () => { await rowsOf(page, phone).first().click(); };
  const plan = [
    ['advancement/due', firstRow],
    ['advancement/review', firstRow],
    ['advancement/approval', firstRow],
    ['advancement/close', firstRow],
    ['advancement/board', firstRow],
    ['advancement/promoted', firstRow],
    [`advancement/promoted/${state.np.id}`, firstRow],
    ['advancement/upload', async () => { await main(page).getByRole('button', { name: 'Download Template' }).waitFor(); await page.locator('[data-upload-input]').setInputFiles(state.uploadFile); await main(page).locator('[data-upload-counts]').waitFor(); await firstRow(); }],
  ];
  for (const [route, openMain] of plan) {
    await go(page, route);
    await noOverflow(page, `${label} ${route}`);
    await shot(page, `${viewport.width}-${theme}-${route.replace(/\//g, '-')}`);
    await openMain();
    await dialogOf(page).waitFor();
    await page.waitForFunction(() => !document.querySelector('#overlay-root')?.textContent.includes('Loading'), null, { timeout: 10000 });
    await page.waitForTimeout(150);
    const fits = await dialogOf(page).evaluate((d) => d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().right <= window.innerWidth + 1);
    check(fits, `${label} ${route}: its dialog fits`);
    const words = `${await main(page).innerText()} ${await dialogOf(page).innerText()}`;
    check(!/\b(null|undefined|NaN|\[object Object\])\b/.test(words), `${label} ${route}: no null, undefined or NaN on the page or in the dialog`);
    await shot(page, `${viewport.width}-${theme}-${route.replace(/\//g, '-')}-dialog`);
    await closeAll(page);
  }
  if (phone) {
    await go(page, 'advancement/due');
    check(await page.locator('#app-main [data-filters] button', { hasText: 'Filters' }).isVisible(), `${label}: the filters fold into a Filters button`);
    check(await rowsOf(page, true).count() > 0, `${label}: the lists are cards`);
  }
  check(errors.length === 0, `${label}: no browser errors`, errors.join(' | '));
  await context.close();
}

async function main_() {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const browser = await chromium.launch();
  const state = {};
  try {
    await adminFlow(browser, db, state);
    await rolesAndRules(browser, db, state);
    state.uploadFile = await workbook(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'adv-layout-')), 'check.xlsx'), [['B9999', 'AB', 'LS', '01/01/2026', '', '', ''], ['B0811', 'AB', 'LS', '', '', '', '']]);
    for (const vp of [DESKTOP, PHONE]) for (const theme of ['light', 'dark']) await layoutPass(browser, vp, theme, state);
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
