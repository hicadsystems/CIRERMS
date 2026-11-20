#!/usr/bin/env node
'use strict';

/*
 * Walk-through of the drafting reports (WP7b): Batch/Signal Content, Rate DOD History and Draft Report.
 * Uses the Playwright installed on the machine (not a project dependency):
 *
 *   npm run migrate:fresh && npm run seed       # a fresh demo database
 *   npm start                                   # the app on :3000
 *   NODE_PATH=$(npm root -g) node tests/e2e/drafting-reports-walkthrough.js
 *
 * BASE changes the address; SHOTS=<dir> saves screenshots there. It reads .env for the database: what the pages
 * show is compared with what the tables hold, and the audit trail is checked to be untouched (the pages only read).
 * Exits non-zero when a check fails. Browser errors fail the run.
 *
 * Through the API as the Administrator: the batch list (DOD only, every filter, the counts), a batch's ratings
 * (the Official No and name filters), the history (a blank number asks for a rating, an unknown one is a 404), the
 * Draft Report (only postings that have reported, the filters, a From after To refused, a bad date refused), the PDFs
 * and workbooks; the privileges (the Drafting role reads, a rating gets 403, a department-tied officer sees only
 * their department). Through the screens at 1440 px, light: each page, its filters, its dialog, its printout in the
 * preview and its workbook. Then each layout (1440 and 390 px, light and dark) draws every page and its main dialog
 * with nothing overflowing.
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
// Administrator: the rules through the API, then the screens at desktop light
// ---------------------------------------------------------------------------
async function adminFlow(browser, db) {
  console.log('\nAdministrator: the API');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);
  const A = '/api/drafting/report';
  const [[auditBefore]] = await db.query('SELECT COUNT(*) AS n FROM audit_trail');

  // ---- Batch/Signal Content, the list
  const [[dod]] = await db.query("SELECT COUNT(*) AS n FROM batches WHERE flow = 'DOD'");
  const [[closed]] = await db.query("SELECT COUNT(*) AS n FROM batches WHERE flow = 'DOD' AND status = 'closed'");
  const all = await api(page, 'GET', `${A}/batches?page=1`);
  check(all.status === 200 && all.body.summary.batches === dod.n, 'Batches: the total is every DOD batch and no other flow', `${all.body.summary.batches} vs ${dod.n}`);
  check(all.body.summary.closed === closed.n && all.body.summary.open === dod.n - closed.n, 'Batches: the open and closed figures');
  check(all.body.data.every((b) => /^DOD-/.test(b.batchNumber)), 'Batches: every number starts DOD- (no advancement batch)');
  check(all.body.data.every((b) => b.total === b.reported + b.notReported), 'Batches: total = reported + not reported');
  const withAuthority = all.body.data.find((b) => b.authority);
  const sig = await api(page, 'GET', `${A}/batches?signal=${encodeURIComponent(withAuthority.authority.slice(4, 14))}`);
  check(sig.body.data.length >= 1 && sig.body.data.every((b) => b.authority.includes(withAuthority.authority.slice(4, 14))), 'Batches: the Signal Code filter');
  const num = await api(page, 'GET', `${A}/batches?batchNo=${encodeURIComponent(withAuthority.batchNumber)}`);
  check(num.body.data.length === 1 && num.body.data[0].id === withAuthority.id, 'Batches: the Batch No filter');
  const [rateRows] = await db.query("SELECT DISTINCT d.rate_id FROM draft_rows d JOIN batches b ON b.id = d.batch_id WHERE b.flow = 'DOD' AND d.rate_id IS NOT NULL LIMIT 1");
  const [[rateExpect]] = await db.query("SELECT COUNT(*) AS n FROM batches b WHERE b.flow = 'DOD' AND (b.rate_id = ? OR EXISTS (SELECT 1 FROM draft_rows x WHERE x.batch_id = b.id AND x.rate_id = ?))", [rateRows[0].rate_id, rateRows[0].rate_id]);
  const rate = await api(page, 'GET', `${A}/batches?rateId=${rateRows[0].rate_id}`);
  check(rate.body.summary.batches === rateExpect.n && rate.body.summary.batches > 0, 'Batches: the Rate filter matches the batch rate or a rating inside it', `${rate.body.summary.batches} vs ${rateExpect.n}`);
  const [branchRows] = await db.query("SELECT DISTINCT r.branch_id FROM draft_rows d JOIN batches b ON b.id = d.batch_id JOIN ratings r ON r.service_number = d.service_number WHERE b.flow = 'DOD' AND r.branch_id IS NOT NULL LIMIT 1");
  const branch = await api(page, 'GET', `${A}/batches?branchId=${branchRows[0].branch_id}`);
  check(branch.body.summary.batches > 0 && branch.body.summary.batches <= dod.n, 'Batches: the Branch filter');
  const none = await api(page, 'GET', `${A}/batches?signal=${encodeURIComponent('NO-SUCH-SIGNAL')}`);
  check(none.status === 200 && none.body.data.length === 0 && none.body.summary.batches === 0, 'Batches: a filter that matches nothing is an empty list');

  // ---- one batch
  const one = await api(page, 'GET', `${A}/batches/${withAuthority.id}`);
  check(one.status === 200 && one.body.data.batchNumber === withAuthority.batchNumber, 'Batch: the facts');
  const rows = await api(page, 'GET', `${A}/batches/${withAuthority.id}/rows`);
  const [[rowCount]] = await db.query('SELECT COUNT(*) AS n FROM draft_rows WHERE batch_id = ?', [withAuthority.id]);
  check(rows.body.meta.total === rowCount.n, 'Batch: every rating of the batch is listed (not recommended too)', `${rows.body.meta.total} vs ${rowCount.n}`);
  const sn = rows.body.data[0].serviceNumber;
  const bySn = await api(page, 'GET', `${A}/batches/${withAuthority.id}/rows?serviceNumber=${sn}`);
  check(bySn.body.data.length === 1 && bySn.body.data[0].serviceNumber === sn, 'Batch: the Official No filter');
  const surname = rows.body.data[0].name.split(' ')[0];
  const byName = await api(page, 'GET', `${A}/batches/${withAuthority.id}/rows?name=${encodeURIComponent(surname.slice(0, 4))}`);
  check(byName.body.data.length >= 1 && byName.body.data.every((x) => x.name.toUpperCase().includes(surname.slice(0, 4).toUpperCase())), 'Batch: the name filter');
  check((await api(page, 'GET', `${A}/batches/99999999`)).status === 404, 'Batch: an unknown batch is a 404');
  const [[doa]] = await db.query("SELECT id FROM batches WHERE flow = 'DOA' LIMIT 1");
  if (doa) check((await api(page, 'GET', `${A}/batches/${doa.id}`)).status === 404, 'Batch: an advancement batch is not a drafting batch (404)');

  // ---- Rate DOD History
  const blank = await api(page, 'GET', `${A}/history`);
  check(blank.status === 422 && !!blank.body.error.fields.serviceNumber, 'History: a blank pick asks for a rating and lists nothing');
  check((await api(page, 'GET', `${A}/history?serviceNumber=ZZ9999`)).status === 404, 'History: an unknown number is a 404');
  const [[hist]] = await db.query("SELECT d.service_number AS sn, COUNT(*) AS n FROM draft_rows d JOIN batches b ON b.id = d.batch_id WHERE b.flow = 'DOD' GROUP BY d.service_number ORDER BY n DESC, sn LIMIT 1");
  const h1 = await api(page, 'GET', `${A}/history?serviceNumber=${hist.sn.toLowerCase()}`);
  check(h1.status === 200 && h1.body.data.items.length === hist.n && h1.body.data.rating.serviceNumber === hist.sn, 'History: a rating (any case) and all its drafts', `${h1.body.data && h1.body.data.items.length} vs ${hist.n}`);
  check(h1.body.data.items.every((x) => ['proposed', 'not_recommended', 'awaiting_wef', 'scheduled', 'reported'].includes(x.status)), 'History: each draft has a status');

  // ---- Draft Report
  const [[rep]] = await db.query("SELECT COUNT(*) AS n FROM draft_rows d JOIN batches b ON b.id = d.batch_id WHERE b.flow = 'DOD' AND d.status = 'reported'");
  const p1 = await api(page, 'GET', `${A}/postings`);
  check(p1.status === 200 && p1.body.summary.postings === rep.n && rep.n > 0, 'Draft Report: every posting that has reported, and only those', `${p1.body.summary.postings} vs ${rep.n}`);
  check(p1.body.data.every((x) => x.wef && x.proposedShip), 'Draft Report: each has a WEF and a proposed ship');
  const first = p1.body.data[0];
  const byDate = await api(page, 'GET', `${A}/postings?from=${first.wef}&to=${first.wef}`);
  check(byDate.body.data.length >= 1 && byDate.body.data.every((x) => x.wef === first.wef), 'Draft Report: From and To (inclusive)');
  const bad1 = await api(page, 'GET', `${A}/postings?from=2026-12-01&to=2026-01-01`);
  check(bad1.status === 422 && /after To/.test(bad1.body.error.message), 'Draft Report: a From after To is refused');
  const bad2 = await api(page, 'GET', `${A}/postings?from=31/02/2026`);
  check(bad2.status === 422 && /not a date/.test(bad2.body.error.message), 'Draft Report: a bad date is refused');
  const byAuth = await api(page, 'GET', `${A}/postings?authority=${encodeURIComponent(first.authority.slice(0, 8))}`);
  check(byAuth.body.data.length >= 1 && byAuth.body.data.every((x) => x.authority.includes(first.authority.slice(0, 8))), 'Draft Report: the Authority filter');
  const [[spec]] = await db.query("SELECT d.specialisation_id AS id FROM draft_rows d JOIN batches b ON b.id = d.batch_id WHERE b.flow = 'DOD' AND d.status = 'reported' AND d.specialisation_id IS NOT NULL LIMIT 1");
  const [[specN]] = await db.query("SELECT COUNT(*) AS n FROM draft_rows d JOIN batches b ON b.id = d.batch_id WHERE b.flow = 'DOD' AND d.status = 'reported' AND d.specialisation_id = ?", [spec.id]);
  const bySpec = await api(page, 'GET', `${A}/postings?specialisationId=${spec.id}`);
  check(bySpec.body.summary.postings === specN.n, 'Draft Report: the Specialisation filter');

  // ---- printouts and workbooks
  for (const [label, url, type, head] of [
    ['batch summary PDF', `${A}/batches/pdf`, 'application/pdf', '%PDF'],
    ['batch summary workbook', `${A}/batches/excel`, 'spreadsheetml', 'PK'],
    ['draft report (batch) PDF', `${A}/batches/${withAuthority.id}/pdf`, 'application/pdf', '%PDF'],
    ['draft report (batch) workbook', `${A}/batches/${withAuthority.id}/excel`, 'spreadsheetml', 'PK'],
    ['draft history PDF', `${A}/history/pdf?serviceNumber=${hist.sn}`, 'application/pdf', '%PDF'],
    ['draft report PDF', `${A}/postings/pdf`, 'application/pdf', '%PDF'],
    ['draft report workbook', `${A}/postings/excel`, 'spreadsheetml', 'PK'],
  ]) {
    const f = await fileHead(page, url);
    check(f.status === 200 && f.type.includes(type) && f.head.startsWith(head) && f.size > 500, `Printout: ${label}`, JSON.stringify(f));
  }
  check((await fileHead(page, `${A}/history/pdf`)).status === 422, 'Printout: the history PDF for a blank pick is refused');
  const xl = await page.evaluate(async (u) => { const r = await fetch(u, { credentials: 'include' }); return Array.from(new Uint8Array(await r.arrayBuffer())); }, `${A}/batches/${withAuthority.id}/excel`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(xl));
  const header = wb.worksheets[0].getRow(4).values.slice(1);
  check(header.includes('Official Number') && header.includes('WEF') && header.includes('Deployment/Vice') && !header.includes('Officail Number'), 'Workbook: the headers are spelled right, WEF and Deployment/Vice are there');
  const viceCol = header.indexOf('Deployment/Vice') + 1;
  const vices = []; wb.worksheets[0].eachRow((r, n) => { if (n > 4) vices.push(String(r.getCell(viceCol).value || '')); });
  check(!vices.includes('COMPLEMENT'), 'Workbook: the vice column is the vice, not the constant text COMPLEMENT');

  const [[auditAfter]] = await db.query('SELECT COUNT(*) AS n FROM audit_trail');
  check(auditAfter.n === auditBefore.n, 'Audit trail: the reports write nothing', `${auditBefore.n} to ${auditAfter.n}`);

  console.log('\nAdministrator: the screens at 1440 px, light');
  await page.locator('#rail nav a', { hasText: 'Drafting' }).first().click();
  await settle(page);
  for (const t of ['Batch/Signal Content', 'Rate DOD History', 'Draft Report']) check(await page.locator('#module-tabs a', { hasText: t }).count() > 0, `tab: ${t}`);
  await page.keyboard.press('Control+K');
  await page.keyboard.type('Rate DOD');
  await page.locator('#palette-results').getByText('Rate DOD History').first().waitFor();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#drafting/history');
  check(true, 'Ctrl K finds and opens Rate DOD History');

  // Batch/Signal Content
  await go(page, 'drafting/batches');
  check(/BATCHES\s*\d+/i.test(await main(page).locator('[data-stats]').innerText()), 'Batches: the figures');
  const lines = await rowTexts(page, false);
  check(lines.length > 0 && lines.length <= 25 && lines.every((t) => /\d+ of \d+/.test(t)), 'Batches: each row shows reported of total', `${lines.length}`);
  await openFilters(page, false);
  await main(page).locator('[name="signal"]').fill('NO-SUCH-SIGNAL');
  await page.keyboard.press('Enter');
  await settle(page);
  check(/No Batch Found/.test(await main(page).innerText()), 'Batches: a signal that matches nothing says so');
  await main(page).locator('[name="signal"]').fill(withAuthority.authority.slice(4, 14));
  await page.keyboard.press('Enter');
  await settle(page);
  check((await rowTexts(page, false)).some((t) => t.includes(withAuthority.batchNumber)), 'Batches: the Signal Code filter finds the batch');
  await main(page).getByRole('button', { name: 'Print Summary' }).click();
  await dialogOf(page).waitFor();
  await previewOpens(page, 'Draft Batch Summary');
  await closeAll(page);
  await openRow(page, false, withAuthority.batchNumber);
  check(new RegExp(`Reported\\s*${withAuthority.reported}`).test(await dialogOf(page).innerText()) && /Not Reported/.test(await dialogOf(page).innerText()), 'Batches: a row opens its record with total, reported and not reported');
  await press(page, 'Open Contents');
  await page.waitForFunction((id) => location.hash === `#drafting/batches/${id}`, withAuthority.id);
  await settle(page);
  check((await main(page).locator('h1').innerText()).includes(withAuthority.batchNumber), 'Batch: the page names the batch');
  const facts = await main(page).locator('[data-batch-facts]').innerText();
  check(facts.includes(withAuthority.authority) && !/\bN\/A\b/.test(facts.split('Closed')[0] || ''), 'Batch: the header facts are filled');
  check((await rowTexts(page, false)).length === Math.min(25, rowCount.n), 'Batch: its ratings are listed');
  await pickRating(page, main(page), 'Official No', sn, sn);
  await settle(page);
  check((await rowTexts(page, false)).length === 1, 'Batch: the Official No filter uses the rating search select');
  await main(page).getByRole('button', { name: 'Print Draft Report' }).click();
  await dialogOf(page).waitFor();
  await previewOpens(page, 'Draft Report (batch)');
  await closeAll(page);
  const [download] = await Promise.all([page.waitForEvent('download'), main(page).getByRole('button', { name: 'Export Excel' }).click()]);
  check(/\.xlsx$/.test(download.suggestedFilename()), 'Batch: Export Excel downloads a workbook', download.suggestedFilename());
  await main(page).getByRole('link', { name: 'All Batches' }).click();
  await page.waitForFunction(() => location.hash === '#drafting/batches');
  check(true, 'Batch: All Batches goes back to the list');

  // Rate DOD History
  await go(page, 'drafting/history');
  check(/Pick a Rating/.test(await main(page).innerText()) && (await rowsOf(page, false).count()) === 0, 'History: a blank page asks for a rating and lists nothing');
  check(await main(page).getByRole('button', { name: 'Print PDF' }).count() === 0, 'History: no Print PDF before a rating is picked');
  await pickRating(page, main(page), 'Rating', hist.sn, hist.sn);
  await settle(page);
  check((await rowTexts(page, false)).length === hist.n, 'History: the rating\'s drafts', `${(await rowTexts(page, false)).length} vs ${hist.n}`);
  check(/Proposed|Awaiting WEF|Reported|Scheduled|Not Recommended/.test((await rowTexts(page, false)).join(' ')), 'History: each draft shows its status');
  await main(page).getByRole('button', { name: 'Print PDF' }).click();
  await dialogOf(page).waitFor();
  await previewOpens(page, 'Draft History');
  await closeAll(page);
  await rowsOf(page, false).first().click();
  await dialogOf(page).waitFor();
  check(/Batch Number/.test(await dialogOf(page).innerText()) && /Authority/.test(await dialogOf(page).innerText()), 'History: a row opens its draft');
  await closeAll(page);

  // Draft Report
  await go(page, 'drafting/report');
  check(new RegExp(`${rep.n} postings? reported`).test(await main(page).innerText()), 'Draft Report: the count of postings reported', await main(page).locator('[data-row-count]').innerText());
  check((await rowTexts(page, false)).length === Math.min(25, rep.n), 'Draft Report: 25 a page');
  await openFilters(page, false);
  await main(page).locator('[name="from"]').fill('01/12/2026');
  await main(page).locator('[name="to"]').fill('01/01/2026');
  await page.keyboard.press('Enter');
  await settle(page);
  check(/From is after To/.test(await main(page).innerText()), 'Draft Report: a From after To shows an error above the list');
  check(await main(page).getByRole('button', { name: 'Print Report' }).isDisabled(), 'Draft Report: Print Report is off while the dates are wrong');
  await main(page).locator('[name="from"]').fill('');
  await main(page).locator('[name="to"]').fill('');
  await page.keyboard.press('Enter');
  await settle(page);
  check(!/From is after To/.test(await main(page).innerText()) && (await rowTexts(page, false)).length > 0, 'Draft Report: clearing the dates brings the list back');
  await main(page).getByRole('button', { name: 'Print Report' }).click();
  await dialogOf(page).waitFor();
  await previewOpens(page, 'Draft Report');
  await closeAll(page);
  await rowsOf(page, false).first().click();
  await dialogOf(page).waitFor();
  const text = await dialogOf(page).innerText();
  check(/Deployment\/Vice/.test(text) && /Present Ship/.test(text) && /DOJ/.test(text) && /Authority/.test(text), 'Draft Report: a row opens with the present ship, DOJ, authority, vice and WEF');
  await closeAll(page);

  check(errors.length === 0, 'Admin: no browser errors', errors.join(' | '));
  await context.close();
  return { batch: withAuthority, sn: hist.sn };
}

// ---------------------------------------------------------------------------
// Privileges
// ---------------------------------------------------------------------------
async function privileges(browser, db, shared) {
  console.log('\nPrivileges');
  const A = '/api/drafting/report';
  const routes = [`${A}/batches`, `${A}/batches/${shared.batch.id}`, `${A}/batches/${shared.batch.id}/rows`, `${A}/history?serviceNumber=${shared.sn}`, `${A}/postings`, `${A}/batches/pdf`, `${A}/postings/excel`];

  let s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, OFFICER);
  for (const u of routes) check((await api(s.page, 'GET', u)).status === 200, `Drafting role: reads ${u.replace(A, '')}`);
  check(await s.page.locator('#rail nav a', { hasText: 'Drafting' }).count() > 0, 'Drafting role: sees the Drafting module');
  await go(s.page, 'drafting/report');
  check(await s.page.locator('#module-tabs a', { hasText: 'Draft Report' }).count() > 0, 'Drafting role: has the Draft Report tab');
  await s.context.close();

  s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, RATING);
  for (const u of routes) check((await api(s.page, 'GET', u)).status === 403, `A rating: 403 on ${u.replace(A, '')}`);
  await s.page.goto(`${BASE}/app.html#drafting/batches`);
  await settle(s.page).catch(() => {});
  check(!/Batch\/Signal Content[\s\S]*Print Summary/.test(await main(s.page).innerText().catch(() => '')), 'A rating: the page does not open');
  await s.context.close();

  // a department-tied officer sees only that department's batches
  const [[dept]] = await db.query("SELECT u.specialisation_id AS id FROM users u WHERE u.username = ?", [DEPT_OFFICER.username]);
  s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, DEPT_OFFICER);
  const list = await api(s.page, 'GET', `${A}/batches`);
  const [[mine]] = await db.query("SELECT COUNT(*) AS n FROM batches WHERE flow = 'DOD' AND specialisation_id = ?", [dept.id]);
  check(list.status === 200 && list.body.summary.batches === mine.n, 'Department officer: only the batches of their department', `${list.body.summary.batches} vs ${mine.n}`);
  const [[other]] = await db.query("SELECT id FROM batches WHERE flow = 'DOD' AND (specialisation_id IS NULL OR specialisation_id <> ?) LIMIT 1", [dept.id]);
  check((await api(s.page, 'GET', `${A}/batches/${other.id}`)).status === 403, 'Department officer: another department\'s batch is a 403');
  const [[otherSpec]] = await db.query("SELECT id FROM ref_specialisation WHERE id <> ? LIMIT 1", [dept.id]);
  const pst = await api(s.page, 'GET', `${A}/postings?specialisationId=${otherSpec.id}`);
  const [[ownReported]] = await db.query("SELECT COUNT(*) AS n FROM draft_rows d JOIN batches b ON b.id = d.batch_id WHERE b.flow = 'DOD' AND d.status = 'reported' AND d.specialisation_id = ?", [dept.id]);
  check(pst.status === 200 && pst.body.summary.postings === ownReported.n, 'Department officer: the Draft Report holds to their department whatever is asked', `${pst.body.summary.postings} vs ${ownReported.n}`);
  await s.context.close();
}

// ---------------------------------------------------------------------------
// Each layout: every page and its main dialog
// ---------------------------------------------------------------------------
async function layoutPass(browser, viewport, theme, shared) {
  const label = `${viewport.width}px ${theme}`;
  console.log(`\nLayout ${label}`);
  const { context, page, errors, phone } = await open(browser, { viewport, theme });
  await signIn(page, ADMIN);
  const plan = [
    ['drafting/batches', async () => { await rowsOf(page, phone).first().click(); }],
    [`drafting/batches/${shared.batch.id}`, async () => { await rowsOf(page, phone).first().click(); }],
    ['drafting/history', async () => { await pickRating(page, main(page), 'Rating', shared.sn, shared.sn); await settle(page); await rowsOf(page, phone).first().click(); }],
    ['drafting/report', async () => { await rowsOf(page, phone).first().click(); }],
  ];
  for (const [route, openMain] of plan) {
    await go(page, route);
    await noOverflow(page, `${label} ${route}`);
    await shot(page, `${viewport.width}-${theme}-${route.replace(/\//g, '-')}`);
    await openMain();
    await dialogOf(page).waitFor();
    await page.waitForTimeout(150);
    const fits = await dialogOf(page).evaluate((d) => d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().right <= window.innerWidth + 1);
    check(fits, `${label} ${route}: its dialog fits`);
    const words = `${await main(page).innerText()} ${await dialogOf(page).innerText()}`;
    check(!/\b(null|undefined|NaN|\[object Object\])\b/.test(words), `${label} ${route}: no null, undefined or NaN on the page or in the dialog`);
    await shot(page, `${viewport.width}-${theme}-${route.replace(/\//g, '-')}-dialog`);
    await closeAll(page);
  }
  if (phone) {
    await go(page, 'drafting/report');
    check(await page.locator('#app-main [data-filters] button', { hasText: 'Filters' }).isVisible(), `${label}: the filters fold into a Filters button`);
    check(await rowsOf(page, true).count() > 0, `${label}: the lists are cards`);
    await go(page, `drafting/batches/${shared.batch.id}`);
    check(await page.locator('a[aria-label="Back"]').count() > 0, `${label}: a batch page has a back arrow`);
  }
  check(errors.length === 0, `${label}: no browser errors`, errors.join(' | '));
  await context.close();
}

async function main_() {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const browser = await chromium.launch();
  try {
    const shared = await adminFlow(browser, db);
    await privileges(browser, db, shared);
    for (const vp of [DESKTOP, PHONE]) for (const theme of ['light', 'dark']) await layoutPass(browser, vp, theme, shared);
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
