#!/usr/bin/env node
'use strict';

/*
 * Walk-through of the drafting cycle (WP7a). Uses the Playwright installed on the machine (not a project
 * dependency):
 *
 *   npm run migrate:fresh                       # a fresh demo database (the walk-through makes and closes batches)
 *   npm start                                   # the app on :3000
 *   NODE_PATH=$(npm root -g) node tests/e2e/drafting-walkthrough.js
 *
 * BASE changes the address; SHOTS=<dir> saves screenshots there. It reads .env for the database (the audit
 * trail and the rows behind the screens), and runs the scheduled changes in this process with a date three
 * weeks ahead, to see a scheduled move take effect. Exits non-zero when a check fails. Browser errors fail
 * the run.
 *
 * As the Administrator at 1440 px, light: the whole cycle through the screens. Update Manning Requirement
 * (add, the duplicate and quantity refusals, edit, delete, the printout); Print Draft Proposal (who is due
 * reads only, Create Draft Batch); Review/Print Draft (Edit Posting, Not Recommended, Remove, Add Personnel
 * and its refusal, the Draft Form, the workbook, Clear Draft); Draft Approval (refused while a ship is
 * missing, approve, approve again); Close Draft (authority used, future date, before the batch, then close);
 * Update WEF (before the authority date refused, a WEF today reported, a future WEF for the department
 * scheduled, the record's Drafting tab, the scheduled move made on its date). Then the rules and privileges
 * through the API (the Drafting role, the approver, a department-tied officer, a rating) and the audit trail;
 * then each layout (1440 and 390 px, light and dark) draws every page and its main dialog with nothing
 * overflowing.
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
const OFFICER = { username: 'B0705', password: 'Admin@123' }; // Drafting
const DEPT_OFFICER = { username: 'B0706', password: 'Admin@123' }; // Drafting, Marine Propulsion only
const APPROVER = { username: 'B0707', password: 'Admin@123' }; // Drafting Approver
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

// ---------------------------------------------------------------------------
// Administrator, desktop, light: the whole cycle
// ---------------------------------------------------------------------------
async function adminFlow(browser, db, state) {
  console.log('\nAdministrator, desktop, light: the whole cycle');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);

  // ---- sidebar, tabs, Ctrl K
  const link = page.locator('#rail nav a', { hasText: 'Drafting' }).first();
  check(await link.count() === 1 && !(await link.innerText()).includes('Soon'), 'Drafting has lost its Soon badge');
  await link.click();
  await settle(page);
  check(page.url().endsWith('#drafting/manning'), 'the module opens on Update Manning Requirement', page.url());
  for (const t of ['Update Manning Requirement', 'Print Draft Proposal', 'Review/Print Draft', 'Draft Approval', 'Close Draft', 'Update WEF']) {
    check(await page.locator('#module-tabs a', { hasText: t }).count() > 0, `tab: ${t}`);
  }
  await page.keyboard.press('Control+K');
  await page.keyboard.type('Update WEF');
  await page.locator('#palette-results').getByText('Update WEF').first().waitFor();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#drafting/wef');
  check(true, 'Ctrl K finds and opens Update WEF');

  // ---- 1. Update Manning Requirement
  await go(page, 'drafting/manning');
  check(/REQUIREMENTS\s*27/i.test(await main(page).locator('[data-stats]').innerText()), 'Manning: the figures (27 requirements)');
  const first = await rowTexts(page, false);
  check(first.length === 25 && /Short by|Full|Over by/.test(first.join(' ')), 'Manning: 25 a page with Required, Aboard and the difference', `${first.length}`);
  await main(page).getByRole('button', { name: 'Add Requirement' }).click();
  await dialogOf(page).waitFor();
  await press(page, 'Add Requirement');
  check(/Choose the ship/.test(await errorText(page, 'shipId')), 'Manning: an empty form shows its errors under the fields');
  await chooseIn(page, 'shipId', 'NNS ARADU'); await chooseIn(page, 'rateId', 'Able Seaman'); await chooseIn(page, 'specialisationId', 'Gunnery');
  await fillIn(page, 'quantity', '100');
  await press(page, 'Add Requirement');
  check(/1 to 99/.test(await errorText(page, 'quantity')), 'Manning: a quantity over 99 is refused');
  check(/already has a requirement/.test(await errorText(page, 'shipId')), 'Manning: a duplicate ship, rate and specialisation is refused');
  await chooseIn(page, 'shipId', 'NNS JUBILEE'); await chooseIn(page, 'specialisationId', 'Catering');
  await fillIn(page, 'quantity', '3');
  await press(page, 'Add Requirement');
  check(/Requirement added/.test(await toastText(page, /Requirement added/)), 'Manning: a requirement is added');
  await filterSelect(page, false, 'shipId', 'NNS JUBILEE');
  check((await rowTexts(page, false)).every((t) => /NNS JUBILEE/.test(t)), 'Manning: the ship filter');
  await openRow(page, false, 'Catering');
  check(/Required\s*3/.test(await dialogOf(page).innerText()), 'Manning: a row opens its record');
  await press(page, 'Edit');
  await fillIn(page, 'quantity', '0');
  await press(page, 'Save');
  check(/1 to 99/.test(await errorText(page, 'quantity')), 'Manning: a quantity of 0 is refused');
  await fillIn(page, 'quantity', '4');
  await press(page, 'Save');
  check(/updated/.test(await toastText(page, /Requirement updated/)), 'Manning: edited');
  await openRow(page, false, 'Catering');
  await press(page, 'Delete');
  check(/Delete the requirement/.test(await dialogOf(page).innerText()), 'Manning: delete asks first');
  await press(page, 'Delete Requirement');
  check(/deleted/.test(await toastText(page, /Requirement deleted/)), 'Manning: deleted');
  await filterSelect(page, false, 'shipId', 'All Ships');
  await main(page).getByRole('button', { name: 'Print' }).click();
  await chooseIn(page, 'shipId', 'NNS ARADU');
  await press(page, 'Preview PDF');
  await previewOpens(page, 'Manning Requirement Report');
  await shot(page, 'desktop-light-manning-pdf');
  await closeAll(page);
  const manPdf = await fileHead(page, '/api/drafting/manning/pdf');
  check(manPdf.status === 200 && manPdf.head === '%PDF', 'Manning: the report for all ships is a PDF');

  // ---- 2. Print Draft Proposal
  const [[{ n: batchesBefore }]] = await db.query('SELECT COUNT(*) AS n FROM batches');
  await go(page, 'drafting/proposal');
  await filterSelect(page, false, 'branchId', 'Medical');
  const due = await rowTexts(page, false);
  check(due.length === 4 && due.some((t) => /B0601F/.test(t)) && due.some((t) => /B0723/.test(t)), 'Proposal: the Medical branch lists its four due ratings', due.join(' | '));
  check(/4 ratings are due/.test(await main(page).locator('[data-due-count]').innerText()), 'Proposal: the count');
  const [[{ n: batchesAfterSearch }]] = await db.query('SELECT COUNT(*) AS n FROM batches');
  check(batchesAfterSearch === batchesBefore, 'Proposal: a search makes no batch (the list only reads)');
  const dueApi = await api(page, 'GET', '/api/drafting/due?branchId=5');
  const bands = Object.fromEntries(dueApi.body.data.map((r) => [r.serviceNumber, `${r.months}:${r.band}`]));
  check(/:error$/.test(bands.B0601F) && /^1[0-9]:success$/.test(bands.B0722), 'Proposal: months on the ship as a coloured band from the settings', JSON.stringify(bands));
  await openRow(page, false, 'B0601F');
  check(/Last Ship 1/.test(await dialogOf(page).innerText()) && await dialogOf(page).getByRole('button', { name: 'Open Record' }).count() === 1, 'Proposal: a row opens the rating with its postings');
  await closeAll(page);
  await main(page).getByRole('button', { name: 'Create Draft Batch' }).click();
  await dialogOf(page).locator('[data-batch-number]').waitFor();
  const cd = await dialogOf(page).innerText();
  check(/DOD-MD-ALL-ALL-000001/.test(cd) && /Ratings to Add\s*4/.test(cd), 'Proposal: Create Draft Batch shows the batch number, the filters and the count', cd.replace(/\s+/g, ' '));
  await press(page, 'Create Batch');
  check(/Created batch DOD-MD-ALL-ALL-000001: 4 ratings/.test(await toastText(page, /Created batch/)), 'Proposal: the batch is made only when confirmed');
  await page.waitForFunction(() => location.hash.startsWith('#drafting/review'));
  await settle(page);
  const again = await api(page, 'POST', '/api/drafting/batches', { branchId: 5 });
  check(again.status === 409 && again.body.error.code === 'NOTHING_TO_ADD', 'Proposal: everyone in a batch is left out of a new one (409)');
  const md = (await api(page, 'GET', '/api/drafting/batches?stage=open')).body.data.find((b) => b.batchNumber === 'DOD-MD-ALL-ALL-000001');
  state.md = md;
  check(!!md && md.live === 4, 'Proposal: the new batch holds the four ratings');

  // ---- 3. Review/Print Draft
  check(/DOD-MD-ALL-ALL-000001/.test(await main(page).locator('[data-batch-facts]').innerText()), 'Review: opens on the new batch');
  check(/0 of 4 have a proposed ship/.test(await main(page).locator('[data-progress]').innerText()), 'Review: progress 0 of 4');
  const rowId = async (sn) => (await api(page, 'GET', `/api/drafting/batches/${md.id}/rows`)).body.data.find((x) => x.serviceNumber === sn).id;
  const same = await api(page, 'PUT', `/api/drafting/batches/${md.id}/rows/${await rowId('B0601F')}`, { shipId: 15 });
  check(same.status === 422 && /already on NHQ ABUJA/.test(same.body.error.fields.shipId), 'Review: the proposed ship must differ from the current one (422)');
  await openRow(page, false, 'B0601F');
  await press(page, 'Edit Posting');
  await press(page, 'Save Posting');
  check(/Choose the ship/.test(await errorText(page, 'shipId')), 'Review: Edit Posting needs a ship');
  check(await dialogOf(page).locator('.custom-dropdown-wrapper[name="shipId"]').count() === 1, 'Review: the ship list (the current ship left out)');
  await chooseIn(page, 'shipId', 'NNS BEECROFT');
  await fillIn(page, 'vice', 'Vice AB TANKO');
  await press(page, 'Save Posting');
  check(/Posting saved/.test(await toastText(page, /Posting saved/)), 'Review: Edit Posting saved');
  await settle(page);
  await openRow(page, false, 'B0722');
  await press(page, 'Edit Posting');
  await chooseIn(page, 'shipId', 'NNS ARADU');
  await press(page, 'Save Posting');
  await toastText(page, /Posting saved/);
  await settle(page);
  await openRow(page, false, 'B0723');
  await press(page, 'Not Recommended');
  await press(page, 'Not Recommended');
  check(/Give the reason/.test(await errorText(page, 'reason')), 'Review: Not Recommended needs a reason');
  await fillIn(page, 'reason', 'Medical board pending');
  await press(page, 'Not Recommended');
  check(/not recommended/.test(await toastText(page, /not recommended/)), 'Review: Not Recommended saved');
  await settle(page);
  const struck = rowsOf(page, false).filter({ hasText: 'B0723' });
  check(await struck.locator('s').count() === 1 && /Medical board pending/.test(await struck.innerText()), 'Review: the rating is struck out with the reason');
  await openRow(page, false, 'B0724');
  await press(page, 'Remove');
  await press(page, 'Remove Rating');
  check(/Removed/.test(await toastText(page, /Removed from the batch/)), 'Review: Remove asks first, then removes');
  await settle(page);
  await main(page).getByRole('button', { name: 'Add Personnel' }).click();
  await dialogOf(page).waitFor();
  await pickRating(page, dialogOf(page), 'Rating', 'odigie', 'B0701');
  await press(page, 'Add to Batch');
  check(/already in batch DOD-SM-ALL-ALL-000001/.test(await errorText(page, 'serviceNumber')), 'Add Personnel: a rating in another batch is refused, naming it');
  await dialogOf(page).getByRole('button', { name: 'Clear rating' }).click();
  await pickRating(page, dialogOf(page), 'Rating', 'B0724', 'B0724');
  await chooseIn(page, 'request', 'Medical');
  await press(page, 'Add to Batch');
  check(/added to DOD-MD-ALL-ALL-000001/.test(await toastText(page, /added to/)), 'Add Personnel: added (rating search select)');
  await settle(page);
  await openRow(page, false, 'B0724');
  check(/Request\s*Medical/.test(await dialogOf(page).innerText()), 'Add Personnel: the request is saved');
  await press(page, 'Edit Posting');
  await chooseIn(page, 'shipId', 'NNS VICTORY');
  await press(page, 'Save Posting');
  await toastText(page, /Posting saved/);
  await settle(page);
  check(/3 of 3 have a proposed ship/.test(await main(page).locator('[data-progress]').innerText()), 'Review: progress 3 of 3 (the not recommended one left out)');
  await main(page).getByRole('button', { name: 'Print Draft' }).click();
  await previewOpens(page, 'Draft Form');
  await shot(page, 'desktop-light-draft-form');
  await closeAll(page);
  const dl = page.waitForEvent('download');
  await main(page).getByRole('button', { name: 'Export Excel' }).click();
  const file = path.join(os.tmpdir(), `draft-${Date.now()}.xlsx`);
  await (await dl).saveAs(file);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  const cells = [];
  ws.eachRow((r) => cells.push(r.values.slice(1).join('|')));
  check(/Official No\|Name/.test(cells.join('\n')) && /B0723.*Not Recommended.*Medical board pending/.test(cells.join('\n')), 'Review: Export Excel opens with the batch rows');
  fs.unlinkSync(file);
  // the manning pill on a seeded batch: Logistics proposes NNS BEECROFT for an OS of Catering (needs 2)
  const lg = (await api(page, 'GET', '/api/drafting/batches?stage=open')).body.data.find((b) => b.batchNumber === 'DOD-LG-ALL-ALL-000001');
  await go(page, `drafting/review?batch=${lg.id}`);
  check(/Under by 1/.test(rowsOf(page, false).filter({ hasText: 'B0715' }).first() ? await rowsOf(page, false).filter({ hasText: 'B0715' }).innerText() : ''), 'Review: the Under by n pill against the manning requirement');

  // ---- 4. Draft Approval
  await go(page, 'drafting/approval');
  await openRow(page, false, 'Communications');
  await press(page, 'Approve Department');
  check(await dialogOf(page).getByRole('button', { name: 'Approve', exact: true }).isDisabled() && /no proposed ship/.test(await dialogOf(page).innerText()), 'Approval: refused while a rating has no proposed ship (the button is off and says why)');
  await closeAll(page);
  const comm = (await api(page, 'GET', '/api/drafting/approvals')).body.data.find((d) => d.department === 'Communications');
  const refusedAppr = await api(page, 'POST', `/api/drafting/approvals/${comm.specialisationId}`, { rank: 'CDR', name: 'X', appointment: 'Y' });
  check(refusedAppr.status === 409 && refusedAppr.body.error.code === 'TARGET_MISSING', 'Approval: the API refuses it too (409)');
  const mas = (await api(page, 'GET', '/api/drafting/approvals')).body.data.find((d) => d.department === 'Medical Assistant');
  check(mas && mas.total === 3 && mas.rateGroups.map((g) => g.code).join(',') === 'OS,AB,LS,PO,CPO,WO,MWO,NWO', 'Approval: totals by rate group, in the rank order of the Rates table', JSON.stringify(mas && mas.rateGroups.map((g) => `${g.code}:${g.count}`)));
  await openRow(page, false, 'Medical Assistant');
  await dialogOf(page).locator('[data-dept-row]').first().waitFor();
  check(await dialogOf(page).locator('[data-dept-row]').count() === 3 && await dialogOf(page).locator('[data-rate-groups] > div').count() === 8, 'Approval: the department\'s list and its rate groups');
  await press(page, 'Approve Department');
  await press(page, 'Approve');
  check(/Choose the approving rank/.test(await errorText(page, 'rank')) && /Enter the name/.test(await errorText(page, 'name')) && /Enter the appointment/.test(await errorText(page, 'appointment')), 'Approval: rank, name and appointment are required');
  await chooseIn(page, 'rank', /^CDR$/);
  await fillIn(page, 'name', 'Ibrahim Danladi');
  await fillIn(page, 'appointment', 'Chief of Naval Personnel');
  await press(page, 'Approve');
  const apprToast = await toastText(page, /approved by/);
  check(/Medical Assistant approved by CDR Ibrahim Danladi: 3 ratings/.test(apprToast), 'Approval: the department is approved', apprToast);
  await settle(page);
  check(/Approved/.test(await rowsOf(page, false).filter({ hasText: 'Medical Assistant' }).innerText()), 'Approval: the row shows Approved and who');
  await openRow(page, false, 'Medical Assistant');
  await press(page, 'Approve Again');
  check(/Approving again replaces that/.test(await dialogOf(page).innerText()), 'Approval: approving again warns it replaces the earlier approval');
  await chooseIn(page, 'rank', 'CAPT');
  await press(page, 'Approve');
  await toastText(page, /approved by CAPT/);
  await settle(page);

  // ---- 5. Close Draft
  await go(page, 'drafting/close');
  check(/Ready/.test(await rowsOf(page, false).filter({ hasText: 'DOD-MD-ALL-ALL-000001' }).innerText()) && /Not ready/.test(await rowsOf(page, false).filter({ hasText: 'DOD-LG-ALL-ALL-000001' }).innerText()), 'Close: each open batch with its readiness');
  await openRow(page, false, 'DOD-LG-ALL-ALL-000001');
  await press(page, 'Close Draft');
  check(await dialogOf(page).getByRole('button', { name: 'Close Draft' }).isDisabled() && /Not yet approved/.test(await dialogOf(page).innerText()), 'Close: a batch not ready cannot be closed (and says why)');
  await closeAll(page);
  const notReady = await api(page, 'POST', `/api/drafting/batches/${lg.id}/close`, { authority: 'X/1', closeDate: isoOf(new Date()) });
  check(notReady.status === 409 && notReady.body.error.code === 'BATCH_NOT_READY', 'Close: the API refuses a batch not ready (409)');
  await openRow(page, false, 'DOD-MD-ALL-ALL-000001');
  await press(page, 'Close Draft');
  await fillIn(page, 'authority', 'NHQ/NP/DOD/134/2026');
  await fillIn(page, 'closeDate', ddmmyyyy(dayFrom(1)));
  await press(page, 'Close Draft');
  check(/already used by batch DOD-NP-ALL-ALL-000001/.test(await errorText(page, 'authority')), 'Close: an authority used before is refused, naming the batch');
  check(/cannot be in the future/.test(await errorText(page, 'closeDate')), 'Close: a close date in the future is refused');
  await fillIn(page, 'authority', 'NHQ/NP/DOD/140/2026');
  await fillIn(page, 'closeDate', ddmmyyyy(dayFrom(-1)));
  await press(page, 'Close Draft');
  check(/before the batch was started/.test(await errorText(page, 'closeDate')), 'Close: a close date before the batch began is refused');
  await fillIn(page, 'closeDate', ddmmyyyy(new Date()));
  await press(page, 'Close Draft');
  check(/closed under NHQ\/NP\/DOD\/140\/2026/.test(await toastText(page, /closed under/)), 'Close: the batch is closed');
  await page.waitForFunction(() => location.hash.startsWith('#drafting/wef'));
  await settle(page);
  const closedAgain = await api(page, 'POST', `/api/drafting/batches/${md.id}/close`, { authority: 'NHQ/NP/DOD/141/2026', closeDate: isoOf(new Date()) });
  check(closedAgain.status === 409 && closedAgain.body.error.code === 'BATCH_CLOSED', 'Close: a closed batch is final (409, no reopen)');
  const editClosed = await api(page, 'PUT', `/api/drafting/batches/${md.id}/rows/${await rowId('B0601F')}`, { shipId: 9 });
  check(editClosed.status === 409, 'Review: a closed batch can no longer be edited (409)');

  // ---- 6. Update WEF
  check(/DOD-MD-ALL-ALL-000001/.test(await main(page).locator('[data-batch-facts]').innerText()), 'WEF: opens on the batch just closed');
  await openRow(page, false, 'B0601F');
  await press(page, 'Set WEF');
  await fillIn(page, 'wef', ddmmyyyy(dayFrom(-1)));
  await press(page, 'Save WEF');
  check(/before the authority date/.test(await errorText(page, 'wef')), 'WEF: a date before the authority date is refused');
  await fillIn(page, 'wef', ddmmyyyy(new Date()));
  await press(page, 'Save WEF');
  check(/is on NNS BEECROFT from/.test(await toastText(page, /is on NNS BEECROFT/)), 'WEF: a WEF today moves the rating now');
  await settle(page);
  check(/Reported/.test(await rowsOf(page, false).filter({ hasText: 'B0601F' }).innerText()), 'WEF: the row is Reported');
  const rec = (await api(page, 'GET', '/api/ratings/B0601F')).body.data;
  const recRating = rec.rating || rec;
  const posts = (rec.children && rec.children.drafting) || [];
  const openPosts = posts.filter((p) => !p.end_date);
  const ended = posts.find((p) => p.ship_name === 'NHQ ABUJA');
  check(recRating.current_ship_name === 'NNS BEECROFT' && openPosts.length === 1 && ended && ended.end_date === isoOf(dayFrom(-1)), 'WEF: the old posting ends the day before, the new one starts on the WEF, the current ship follows', JSON.stringify({ cur: recRating.current_ship_name, open: openPosts.length, end: ended && ended.end_date }));
  const future = dayFrom(20);
  await main(page).getByRole('button', { name: 'Set WEF for Department' }).click();
  await dialogOf(page).waitFor();
  check(/2 pending ratings get this date/.test(await dialogOf(page).innerText()), 'WEF for Department: says how many');
  await fillIn(page, 'wef', ddmmyyyy(future));
  await press(page, 'Save WEF');
  check(/saved for 2 ratings \(2 scheduled\)/.test(await toastText(page, /saved for/)), 'WEF for Department: a WEF after today is Scheduled');
  await settle(page);
  check((await rowTexts(page, false)).filter((t) => /Scheduled/.test(t)).length === 2, 'WEF: the rows show Scheduled');
  await go(page, 'ratings/edit/B0722?tab=drafting');
  await page.locator('[data-scheduled-move]').first().waitFor({ timeout: 10000 });
  const line = await page.locator('[data-scheduled-move]').first().innerText();
  check(new RegExp(`Drafted to NNS ARADU wef ${ddmmyyyy(future).replace(/\//g, '\\/')}`).test(line) && /Scheduled/.test(line), 'Record: the Drafting tab shows the scheduled move', line);
  const before = (await api(page, 'GET', '/api/ratings/B0722')).body.data;
  check((before.rating || before).current_ship_name === 'NHQ ABUJA', 'Record: the ship does not change before the WEF');
  await shot(page, 'desktop-light-record-scheduled');

  // ---- the scheduled move is made on its date (the server's hourly run, here with a date three weeks ahead)
  require(path.join(__dirname, '..', '..', 'src', 'modules', 'drafting', 'drafting.service'));
  const scheduled = require(path.join(__dirname, '..', '..', 'src', 'shared', 'scheduled'));
  const ran = await scheduled.applyDue({ today: isoOf(dayFrom(21)) });
  await require(path.join(__dirname, '..', '..', 'src', 'db')).close();
  check(ran.applied >= 2 && ran.failed === 0, 'Scheduled: the moves due are made on their date', JSON.stringify(ran));
  const after = (await api(page, 'GET', '/api/ratings/B0722')).body.data;
  check((after.rating || after).current_ship_name === 'NNS ARADU', 'Scheduled: the current ship follows');
  const rows = (await api(page, 'GET', `/api/drafting/batches/${md.id}/rows`)).body.data;
  check(rows.filter((x) => x.status === 'reported').length === 3, 'Scheduled: the draft rows are Reported');

  // ---- Clear Draft (on the seeded Seaman batch)
  const sm = (await api(page, 'GET', '/api/drafting/batches?stage=open')).body.data.find((b) => b.batchNumber === 'DOD-SM-ALL-ALL-000001');
  await go(page, `drafting/review?batch=${sm.id}`);
  await main(page).getByRole('button', { name: 'Clear Draft' }).click();
  check(/Remove every rating/.test(await dialogOf(page).innerText()), 'Clear Draft asks first');
  await press(page, 'Clear Draft');
  check(/Draft cleared: 4 ratings removed/.test(await toastText(page, /Draft cleared/)), 'Clear Draft empties the batch');
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
  check(await s.page.locator('#rail nav a', { hasText: 'Drafting' }).count() === 1, 'Drafting role: the module is in the sidebar');
  check((await api(s.page, 'GET', '/api/drafting/due')).status === 200, 'Drafting role: reads who is due');
  const lg = (await api(s.page, 'GET', '/api/drafting/batches?stage=open')).body.data.find((b) => b.batchNumber === 'DOD-LG-ALL-ALL-000001');
  const spec = (await api(s.page, 'GET', '/api/drafting/approvals')).body.data[0];
  for (const [label, method, url, body] of [
    ['approve a department', 'POST', `/api/drafting/approvals/${spec.specialisationId}`, { rank: 'CDR', name: 'X', appointment: 'Y' }],
    ['close a batch', 'POST', `/api/drafting/batches/${lg.id}/close`, { authority: 'X', closeDate: isoOf(new Date()) }],
    ['set a WEF', 'POST', `/api/drafting/batches/${state.md.id}/wef`, { wef: isoOf(new Date()) }],
    ['add a manning requirement', 'POST', '/api/drafting/manning', { shipId: 1, rateId: 1, specialisationId: 1, quantity: 1 }],
  ]) check((await api(s.page, method, url, body)).status === 403, `Drafting role: may not ${label} (403)`);
  await go(s.page, 'drafting/approval');
  await openRow(s.page, false, spec.department);
  check(await dialogOf(s.page).getByRole('button', { name: /Approve/ }).count() === 0, 'Drafting role: the approval dialog has no Approve button');
  check(s.errors.length === 0, 'no browser errors', s.errors.join(' | '));
  await s.context.close();

  s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, APPROVER);
  check((await api(s.page, 'POST', '/api/drafting/batches', { branchId: 2 })).status === 403, 'Approver role: may not make a batch (403)');
  check((await api(s.page, 'POST', `/api/drafting/batches/${lg.id}/rows`, { serviceNumber: 'B0729' })).status === 403, 'Approver role: may not add personnel (403)');
  await go(s.page, 'drafting/proposal');
  check(await main(s.page).getByRole('button', { name: 'Create Draft Batch' }).count() === 0, 'Approver role: no Create Draft Batch button');
  check(s.errors.length === 0, 'no browser errors', s.errors.join(' | '));
  await s.context.close();

  s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, DEPT_OFFICER);
  const appr = (await api(s.page, 'GET', '/api/drafting/approvals')).body.data;
  check(appr.length === 1 && appr[0].department === 'Marine Propulsion', 'Department officer: sees only their department\'s approval', appr.map((d) => d.department).join(','));
  const dueMine = (await api(s.page, 'GET', '/api/drafting/due')).body.data;
  check(dueMine.length > 0 && dueMine.every((r) => r.specialisation === 'Marine Propulsion'), 'Department officer: the due list is their department');
  check((await api(s.page, 'GET', '/api/drafting/batches?stage=open')).body.data.length === 0, 'Department officer: other departments\' batches are not listed');
  check((await api(s.page, 'GET', `/api/drafting/batches/${lg.id}`)).status === 403, 'Department officer: another department\'s batch is refused (403)');
  check((await api(s.page, 'GET', '/api/drafting/due?specialisationId=1')).status === 403, 'Department officer: may not draft another department (403)');
  const mine = await api(s.page, 'POST', '/api/drafting/batches', {});
  check(mine.status === 201 && /^DOD-ALL-MPR-ALL-/.test(mine.body.data.batch.batchNumber), 'Department officer: a batch is made for their department', mine.body && mine.body.data && mine.body.data.batch.batchNumber);
  await go(s.page, 'drafting/proposal');
  check(/You draft for your department: Marine Propulsion/.test(await main(s.page).innerText()), 'Department officer: the page says which department');
  check(s.errors.length === 0, 'no browser errors', s.errors.join(' | '));
  await s.context.close();

  s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, RATING);
  for (const u of ['/api/drafting/options', '/api/drafting/due', '/api/drafting/manning', '/api/drafting/batches?stage=open', '/api/drafting/approvals', '/api/drafting/rating/B0722/scheduled']) {
    check((await api(s.page, 'GET', u)).status === 403, `Rating: ${u} answers 403`);
  }
  check((await api(s.page, 'GET', '/api/drafting/rating/B0539/scheduled')).status === 200, 'Rating: reads the moves to come on their own record');
  await s.page.goto(`${BASE}/app.html#drafting/review`);
  await s.page.getByText('You Do Not Have Access to This Page').waitFor();
  check(true, 'Rating: the page shows the not-allowed state');
  check(s.errors.length === 0, 'no browser errors', s.errors.join(' | '));
  await s.context.close();

  const [audit] = await db.query(
    `SELECT action, table_name, COUNT(*) AS n FROM audit_trail
      WHERE table_name IN ('batches','draft_rows','batch_approvals','manning_requirements','rating_drafting','scheduled_changes')
      GROUP BY action, table_name`);
  const has = (a, t) => audit.some((r) => r.action === a && r.table_name === t && r.n > 0);
  check(has('INSERT', 'batches') && has('UPDATE', 'batches') && has('INSERT', 'draft_rows') && has('UPDATE', 'draft_rows') && has('DELETE', 'draft_rows')
    && has('INSERT', 'batch_approvals') && has('INSERT', 'manning_requirements') && has('UPDATE', 'manning_requirements') && has('DELETE', 'manning_requirements')
    && has('INSERT', 'rating_drafting') && has('UPDATE', 'rating_drafting') && has('INSERT', 'scheduled_changes') && has('UPDATE', 'scheduled_changes'),
  'Audit trail: every write of the cycle is recorded', JSON.stringify(audit.map((r) => `${r.action} ${r.table_name}`)));
  const [[sys]] = await db.query("SELECT COUNT(*) AS n FROM audit_trail WHERE username = 'SYSTEM' AND table_name = 'rating_drafting'");
  check(sys.n >= 2, 'Audit trail: the scheduled moves are recorded as made by SYSTEM');
}

// ---------------------------------------------------------------------------
// Each layout: every page and its main dialog
// ---------------------------------------------------------------------------
async function layoutPass(browser, viewport, theme) {
  const label = `${viewport.width}px ${theme}`;
  console.log(`\nLayout ${label}`);
  const { context, page, errors, phone } = await open(browser, { viewport, theme });
  await signIn(page, ADMIN);
  const plan = [
    ['drafting/manning', async () => { await main(page).getByRole('button', { name: 'Add Requirement' }).click(); }],
    ['drafting/proposal', async () => { await openRow(page, phone, 'B0640'); }],
    ['drafting/review', async () => { await rowsOf(page, phone).first().click(); }],
    ['drafting/approval', async () => { await rowsOf(page, phone).first().click(); }],
    ['drafting/close', async () => { await rowsOf(page, phone).first().click(); }],
    ['drafting/wef', async () => { await rowsOf(page, phone).first().click(); }],
  ];
  for (const [route, openMain] of plan) {
    await go(page, route);
    await noOverflow(page, `${label} ${route}`);
    await shot(page, `${viewport.width}-${theme}-${route.replace('/', '-')}`);
    await openMain();
    await dialogOf(page).waitFor();
    await page.waitForTimeout(150);
    const fits = await dialogOf(page).evaluate((d) => d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().right <= window.innerWidth + 1);
    check(fits, `${label} ${route}: its dialog fits`);
    await shot(page, `${viewport.width}-${theme}-${route.replace('/', '-')}-dialog`);
    await closeAll(page);
  }
  if (phone) {
    await go(page, 'drafting/proposal');
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
