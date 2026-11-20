#!/usr/bin/env node
'use strict';

/*
 * Walk-through of Training Drafting (WP6). Uses the Playwright installed on the machine (not a project
 * dependency):
 *
 *   npm run migrate:fresh                       # a fresh demo database (the walk-through makes and closes batches)
 *   npm start                                   # the app on :3000
 *   NODE_PATH=$(npm root -g) node tests/e2e/training-drafting-walkthrough.js
 *
 * BASE changes the address; SHOTS=<dir> saves screenshots there. It reads .env for the database (the audit
 * trail and what the screens wrote). Exits non-zero when a check fails. Browser errors fail the run.
 *
 * As the Administrator at 1440 px, light: every action through the screens. Process Training Draft (the
 * figures, a row, New Training Batch: the required course, a duplicate refused naming its batch, a filter that
 * matches nobody, the batch made and opened in Review); Training Review (Add Rating with the rating search
 * select and each refusal, Remove after a confirmation, Add by Branch); Update Training History (Attended, Change
 * Dates and its refusals, Confirm Training History and its refusals, then confirmed); the rating's Training tab
 * with the new entry; Reports (the four filters, a batch's dialog, the Training Draft Report in the preview with
 * its pages); Excel Upload (Download Template, Choose File, Review, Import). Then the rules, privileges (a 403
 * without the grant) and audit rows through the API, on a second course; then each layout (1440 and 390 px,
 * light and dark) draws every page and its main dialog with nothing overflowing.
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
const TRAINER = { username: 'B0901', password: 'Admin@123' }; // Training
const VIEWER = { username: 'B0902', password: 'Admin@123' }; // Training Viewer
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const API = '/api/training-drafting';

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
  await page.waitForTimeout(450); // a dialog or sheet slides in
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

/** An API call as the signed-in person. It goes through the page's cookies but not through the page, so a refusal is not a browser error. */
const api = async (page, method, url, data) => {
  const res = await page.request.fetch(`${BASE}${url}`, { method, data, failOnStatusCode: false });
  let body = null;
  try { body = await res.json(); } catch (_) { body = null; }
  return { status: res.status(), body };
};
/** A workbook sent as the file field of a form. */
const sendFile = async (page, url, buffer, name) => {
  const res = await page.request.fetch(`${BASE}${url}`, {
    method: 'POST', failOnStatusCode: false,
    multipart: { file: { name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from(buffer) } },
  });
  let body = null;
  try { body = await res.json(); } catch (_) { body = null; }
  return { status: res.status(), body };
};
const fileHead = async (page, url) => {
  const res = await page.request.fetch(`${BASE}${url}`, { failOnStatusCode: false });
  const buf = await res.body();
  return { status: res.status(), type: res.headers()['content-type'], head: buf.slice(0, 4).toString('latin1'), size: buf.length };
};

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

/** A choices.js select by its name; "All ..." picks the placeholder. */
async function choose(page, scope, name, label) {
  await scope.locator(`.custom-dropdown-wrapper[name="${name}"] input:not(.custom-dropdown-hidden)`).first().click();
  if (typeof label === 'string' && /^All /.test(label)) { await page.locator('.custom-dropdown-list:visible .cdd-placeholder').first().click(); return; }
  const options = page.locator('.custom-dropdown-list:visible .custom-dropdown-item:not(.cdd-placeholder)');
  await options.first().waitFor();
  if (label) await options.filter({ hasText: label }).first().click();
  else await options.first().click();
}
const chooseIn = (page, name, label) => choose(page, dialogOf(page), name, label);
async function optionLabels(page, scope, name) {
  await scope.locator(`.custom-dropdown-wrapper[name="${name}"] input:not(.custom-dropdown-hidden)`).first().click();
  const options = page.locator('.custom-dropdown-list:visible .custom-dropdown-item:not(.cdd-placeholder)');
  await options.first().waitFor();
  const labels = (await options.allInnerTexts()).map((t) => t.trim());
  await page.keyboard.press('Escape');
  return labels;
}
async function openFilters(page, phone) {
  if (!phone) return;
  const panelHidden = await page.locator('#app-main [data-filters] > div').last().isHidden();
  if (panelHidden) await page.locator('#app-main [data-filters] button', { hasText: 'Filters' }).click();
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
  // a first Escape may only close an open list of suggestions
  for (let i = 0; i < 2; i += 1) {
    await page.keyboard.press('Escape');
    const gone = await page.waitForFunction((k) => document.querySelectorAll('#overlay-root [role="dialog"]').length < k, n, { timeout: 2500 }).then(() => true, () => false);
    if (gone) return;
  }
  throw new Error('the dialog did not close');
}
async function closeAll(page) {
  for (let i = 0; i < 4 && (await dialogs(page).count()); i += 1) await closeTop(page);
}
const press = (page, name) => dialogOf(page).getByRole('button', { name, exact: true }).click();
const fillIn = (page, name, value) => dialogOf(page).locator(`[name="${name}"]`).first().fill(value);
const counted = async (page) => (await dialogOf(page).locator('[role="status"]').innerText()).trim();
async function countSettled(page) {
  await page.waitForFunction(() => { const s = document.querySelector('#overlay-root [role="dialog"]:last-of-type [role="status"]'); return s && s.textContent && !/Counting/.test(s.textContent); }, null, { timeout: 10000 });
  return counted(page);
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
  return n;
}

/** An .xlsx of rows to upload, kept in the temp folder. */
async function workbook(rows, name) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Training Upload');
  ws.addRow(['Official No', 'Course', 'Institution', 'Qualification', 'Start Date', 'End Date', 'Authority']);
  rows.forEach((r) => ws.addRow(r));
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cirerms-training-')), name);
  await wb.xlsx.writeFile(file);
  return file;
}

// ---------------------------------------------------------------------------
// Administrator, desktop, light: every action through the screens
// ---------------------------------------------------------------------------
async function adminFlow(browser, db, state) {
  console.log('\nAdministrator, desktop, light: every action through the screens');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);
  const options = (await api(page, 'GET', `${API}/options`)).body.data;
  const course = options.courses.find((c) => c.name === 'Marine Engineering Artificer');
  const leading = options.courses.find((c) => c.name === 'Leading Rate Course');
  const [[engBranch]] = [await db.query("SELECT id FROM ref_branch WHERE name = 'Marine Engineering'").then(([r]) => r)];
  state.uiCourse = course;

  // ---- sidebar, tabs, Ctrl K
  const link = page.locator('#rail nav a', { hasText: 'Training Drafting' }).first();
  check(await link.count() === 1 && !(await link.innerText()).includes('Soon'), 'Training Drafting has lost its Soon badge');
  await link.click();
  await settle(page);
  check(page.url().endsWith('#training/process'), 'the module opens on Process Training Draft', page.url());
  for (const t of ['Process Training Draft', 'Training Review', 'Update Training History', 'Reports', 'Excel Upload']) {
    check(await page.locator('#module-tabs a', { hasText: t }).count() > 0, `tab: ${t}`);
  }
  await page.keyboard.press('Control+K');
  await page.keyboard.type('Update Training History');
  await page.locator('#palette-results').getByText('Update Training History').first().waitFor();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash.startsWith('#training/history'));
  check(true, 'Ctrl K finds and opens Update Training History');

  // ---- 1. Process Training Draft
  await go(page, 'training/process');
  check(/OPEN BATCHES\s*2/i.test(await main(page).locator('[data-stats]').innerText()), 'Process: the figures (2 open batches)');
  const seeded = await rowTexts(page, false);
  check(seeded.length === 2 && seeded.every((t) => /Open/.test(t)), 'Process: only the open batches are listed', seeded.join(' | '));
  await openRow(page, false, 'DOT-2026-11-02');
  const facts = await dialogOf(page).innerText();
  check(/Batch Number\s*DOT-2026-11-02/.test(facts) && /Leading Rate Course/.test(facts), 'Process: a row opens the batch as label and value rows');
  await closeAll(page);

  await main(page).getByRole('button', { name: 'New Training Batch' }).click();
  await dialogOf(page).waitFor();
  check((await dialogOf(page).innerText()).includes('Course and Period'), 'New Training Batch: opens on its first step');
  await press(page, 'Next');
  check(/Choose the course/.test(await errorText(page, 'course_id')), 'New Training Batch: the course is required');
  await chooseIn(page, 'course_id', leading.name);
  check(/Open to current ratings/.test(await dialogOf(page).innerText()), 'New Training Batch: says who the course is open to');
  await chooseIn(page, 'month', 'November');
  await fillIn(page, 'year', '2026');
  await press(page, 'Next');
  await countSettled(page);
  await press(page, 'Create Batch');
  const dupError = await errorText(page, 'month');
  check(/DOT-2026-11-02/.test(dupError), 'New Training Batch: a duplicate is refused, naming the batch it matches', dupError);
  await chooseIn(page, 'course_id', course.name);
  await chooseIn(page, 'month', 'August');
  await fillIn(page, 'year', '2024');
  await press(page, 'Next');
  const matching = await countSettled(page);
  check(/^\d+ of \d+ eligible ratings match/.test(matching), 'New Training Batch: step 2 counts the eligible ratings', matching);
  const total = Number(/of (\d+)/.exec(matching)[1]);
  // a filter that matches nobody leaves Create Batch disabled
  let empty = null;
  for (const label of await optionLabels(page, dialogOf(page), 'rate_id')) {
    await chooseIn(page, 'rate_id', label);
    if (/No eligible rating matches/.test(await countSettled(page))) { empty = label; break; }
  }
  check(empty !== null, 'New Training Batch: a filter that matches nobody says so', String(empty));
  await page.waitForTimeout(600);
  check(await dialogOf(page).getByRole('button', { name: 'Create Batch' }).isDisabled(), 'New Training Batch: Create Batch is disabled when nobody matches');
  await shot(page, 'desktop-light-new-batch-step2');
  await chooseIn(page, 'rate_id', 'All Rates');
  check(/eligible ratings? match/.test(await countSettled(page)), 'New Training Batch: all rates counts again');
  await page.waitForTimeout(600);
  await press(page, 'Create Batch');
  check(/DOT-2024-08-\d\d made with \d+ ratings?/.test(await toastText(page, /made with/)), 'New Training Batch: the batch is made');
  await page.waitForFunction(() => /^#training\/review\/\d+/.test(location.hash));
  const batchId = Number(/review\/(\d+)/.exec(page.url())[1]);
  state.uiBatchId = batchId;
  await settle(page);
  const [[uiBatch]] = [await db.query('SELECT batch_number, status FROM training_batches WHERE id = ?', [batchId]).then(([r]) => r)];
  check(uiBatch.batch_number === `DOT-2024-08-${pad(course.id)}` && uiBatch.status === 'open', 'New Training Batch: it is open in Review straight after', uiBatch.batch_number);
  const [members] = await db.query('SELECT service_number FROM training_batch_ratings WHERE batch_id = ? ORDER BY service_number', [batchId]);
  check(members.length === total, 'New Training Batch: every eligible rating is in it', `${members.length} of ${total}`);

  // ---- 2. Training Review
  const reviewRows = await rowTexts(page, false);
  check(reviewRows.length === members.length && reviewRows.every((t) => /LOS \d+ yrs? \d+ mths?/.test(t)), 'Review: the ratings with rate and length of service', reviewRows[0]);
  check(reviewRows.some((t) => /First course/.test(t)) || reviewRows.some((t) => !/First course/.test(t)), 'Review: the last course, or First course');
  const first = members[0].service_number;
  const second = members[1].service_number;
  await main(page).getByRole('button', { name: 'Add Rating' }).click();
  await dialogOf(page).waitFor();
  await press(page, 'Add Rating');
  check(/Choose the rating/.test(await errorText(page, 'serviceNumber')), 'Add Rating: a rating must be picked');
  const [[inside]] = [await db.query('SELECT surname FROM ratings WHERE service_number = ?', [first]).then(([r]) => r)];
  await pickRating(page, dialogOf(page), 'Rating', inside.surname, first);
  await press(page, 'Add Rating');
  check(/already in this batch/.test(await errorText(page, 'serviceNumber')), 'Add Rating: a rating already in the batch is refused with the reason');
  const [[outsider]] = [await db.query("SELECT service_number, surname FROM ratings WHERE status = 'current' AND branch_id <> ? LIMIT 1", [engBranch.id]).then(([r]) => r)];
  await pickRating(page, dialogOf(page), 'Rating', outsider.surname, outsider.service_number);
  await press(page, 'Add Rating');
  await page.waitForFunction(() => /branch/.test(document.querySelector('#overlay-root [role="dialog"]:last-of-type').innerText), null, { timeout: 6000 }).catch(() => {});
  check(/Marine Engineering branch/.test(await errorText(page, 'serviceNumber')), 'Add Rating: a rating the course is not open to is refused with the reason', await errorText(page, 'serviceNumber'));
  await closeAll(page);

  await openRow(page, false, first);
  check(/Official No\s*B\d+/.test(await dialogOf(page).innerText()), 'Review: a row opens the rating as label and value rows');
  await press(page, 'Remove');
  check(/Remove Rating\?/.test(await dialogOf(page).innerText()), 'Review: Remove asks first');
  await press(page, 'Remove');
  check(/removed/.test(await toastText(page, /removed/)), 'Review: a rating is removed');
  await settle(page);
  check((await rowTexts(page, false)).length === members.length - 1, 'Review: the list lost the rating');
  await main(page).getByRole('button', { name: 'Add Rating' }).click();
  await dialogOf(page).waitFor();
  await pickRating(page, dialogOf(page), 'Rating', inside.surname, first);
  await press(page, 'Add Rating');
  check(/added/.test(await toastText(page, /added/)), 'Review: the rating is added again with the rating search select');
  await settle(page);
  check((await rowTexts(page, false)).length === members.length, 'Review: the list has it again');
  await main(page).getByRole('button', { name: 'Add by Branch' }).click();
  await dialogOf(page).waitFor();
  check(/No rating is eligible/.test(await countSettled(page)), 'Add by Branch: says when everyone eligible is in already');
  await press(page, 'Add Ratings');
  await page.waitForTimeout(500);
  check(await dialogOf(page).count() === 1, 'Add by Branch: nothing to add is refused');
  await closeAll(page);
  await shot(page, 'desktop-light-review');

  // ---- Process Training Draft again: Add Ratings and Open in Review on a batch's row
  await go(page, 'training/process');
  check(/OPEN BATCHES\s*3/i.test(await main(page).locator('[data-stats]').innerText()), 'Process: the new batch is in the figures (3 open batches)');
  await openRow(page, false, `DOT-2024-08-${pad(course.id)}`);
  await press(page, 'Add Ratings');
  await dialogOf(page).waitFor();
  check(/Add Ratings to DOT-2024-08/.test(await dialogOf(page).innerText()) && /No rating is eligible/.test(await countSettled(page)), 'Process: Add Ratings on a batch says when everyone eligible is in already');
  await closeAll(page);
  await openRow(page, false, `DOT-2024-08-${pad(course.id)}`);
  await press(page, 'Open in Review');
  await page.waitForFunction((id) => location.hash === `#training/review/${id}`, batchId);
  check(true, 'Process: Open in Review opens the batch');
  await settle(page);

  // ---- 3. Update Training History
  await page.locator('#module-tabs a', { hasText: 'Update Training History' }).first().click();
  await settle(page);
  await choose(page, main(page), 'batch', `DOT-2024-08-${pad(course.id)}`);
  await settle(page);
  check(new RegExp(`/${batchId}$`).test(page.url()), 'History: the batch picker opens the batch', page.url());
  check(/Attending\s*\d+ of \d+/.test(await main(page).locator('[data-batch-facts]').innerText()), 'History: the facts say how many attend');
  const absent = members[2].service_number;
  const box = main(page).locator('table tbody tr', { hasText: absent }).getByRole('checkbox');
  await box.uncheck();
  await page.waitForFunction((n) => new RegExp(`Attending\\s*${n} of ${n + 1}`).test(document.querySelector('[data-batch-facts]').innerText), members.length - 1, { timeout: 8000 });
  check(true, 'History: a rating is marked as not attended');
  check(/Not attending/.test(await main(page).locator('table tbody tr', { hasText: absent }).innerText()), 'History: its row says so');
  const owner = members[1].service_number;
  await openRow(page, false, owner);
  await press(page, 'Change Dates');
  await fillIn(page, 'start_date', ddmmyyyy(dayFrom(-30)));
  await fillIn(page, 'end_date', ddmmyyyy(dayFrom(-60)));
  await press(page, 'Save Dates');
  check(/before the start/i.test(await errorText(page, 'end_date')), 'Change Dates: an end date before the start is refused');
  await fillIn(page, 'start_date', ddmmyyyy(dayFrom(-60)));
  await fillIn(page, 'end_date', ddmmyyyy(dayFrom(1)));
  await press(page, 'Save Dates');
  check(/future/i.test(await errorText(page, 'end_date')), 'Change Dates: an end date in the future is refused');
  await fillIn(page, 'start_date', ddmmyyyy(dayFrom(-120)));
  await fillIn(page, 'end_date', ddmmyyyy(dayFrom(-45)));
  await press(page, 'Save Dates');
  check(/Dates saved/.test(await toastText(page, /Dates saved/)), 'Change Dates: a rating has its own dates');
  await settle(page);
  check(new RegExp(ddmmyyyy(dayFrom(-120)).replace(/\//g, '\\/')).test(await main(page).locator('table tbody tr', { hasText: owner }).innerText()), 'Change Dates: the row shows them');

  await main(page).getByRole('button', { name: 'Confirm Training History' }).click();
  await dialogOf(page).waitFor();
  check(new RegExp(`${members.length - 1} ratings`).test(await dialogOf(page).innerText()), 'Confirm: says how many records it adds');
  await press(page, 'Confirm and Close Batch');
  check(/start date/i.test(await errorText(page, 'start_date')) && /end date/i.test(await errorText(page, 'end_date')), 'Confirm: the batch dates are required');
  const offered = await dialogOf(page).locator('.custom-dropdown-wrapper[name="institution_id"] input:not(.custom-dropdown-hidden)').first().inputValue();
  check(offered === options.institutions.find((i) => i.id === course.institutionId).name, 'Confirm: the course\'s institution is the one offered', offered);
  await chooseIn(page, 'institution_id', options.institutions[0].name);
  await fillIn(page, 'start_date', ddmmyyyy(dayFrom(-150)));
  await fillIn(page, 'end_date', ddmmyyyy(dayFrom(1)));
  await press(page, 'Confirm and Close Batch');
  check(/future/i.test(await errorText(page, 'end_date')), 'Confirm: an end date in the future is refused');
  await fillIn(page, 'end_date', ddmmyyyy(dayFrom(-20)));
  await press(page, 'Confirm and Close Batch');
  const attendees = members.map((m) => m.service_number).filter((sn) => sn !== absent);
  check(/result/i.test(await errorText(page, `results.${attendees[0]}`)), 'Confirm: every rating that attended needs a result');
  const results = ['Distinction', 'Credit', 'Pass', 'Fail'];
  for (let i = 0; i < attendees.length; i += 1) await chooseIn(page, `results.${attendees[i]}`, results[i % 4]);
  await shot(page, 'desktop-light-confirm');
  await press(page, 'Confirm and Close Batch');
  check(/confirmed and closed/.test(await toastText(page, /confirmed and closed/)), 'Confirm: the history is confirmed and the batch closed');
  const [[closed]] = [await db.query('SELECT status FROM training_batches WHERE id = ?', [batchId]).then(([r]) => r)];
  check(closed.status === 'closed', 'Confirm: the batch is closed in the database');
  const [entries] = await db.query('SELECT service_number, institution_id, training_course_id, classification, start_date, end_date FROM rating_training WHERE training_course_id = ?', [course.id]);
  check(entries.length === attendees.length && !entries.some((e) => e.service_number === absent), 'Confirm: a Training entry for each rating that attended, none for the one that did not', `${entries.length}`);
  const mine = entries.find((e) => e.service_number === attendees[0]);
  check(mine.classification === 'Distinction' && mine.institution_id === options.institutions[0].id, 'Confirm: the result and the institution are on the entry');
  const ownEntry = entries.find((e) => e.service_number === owner);
  check(String(ownEntry.start_date).includes(String(dayFrom(-120).getFullYear())) && isoOf(new Date(ownEntry.end_date)) === isoOf(dayFrom(-45)), 'Confirm: a rating with its own dates keeps them');

  // ---- the rating's Training tab
  await go(page, `ratings/edit/${attendees[0]}?tab=training`);
  const tabText = await main(page).innerText();
  check(tabText.includes(course.name) && /Distinction/.test(tabText), 'Record: the Training tab shows the new entry with its result', tabText.slice(0, 120));
  await shot(page, 'desktop-light-record-training');

  // ---- 4. Reports
  await go(page, 'training/reports');
  check((await rowTexts(page, false)).length >= 5, 'Reports: every batch, open and closed');
  await openFilters(page, false);
  const filters = main(page).locator('[data-filters]');
  await choose(page, filters, 'courseId', course.name);
  await settle(page);
  check((await rowTexts(page, false)).length === 1 && /Closed/.test((await rowTexts(page, false))[0]), 'Reports: the Training filter');
  await choose(page, filters, 'month', 'August');
  await filters.locator('[name="year"]').fill('2024');
  await filters.locator('[name="year"]').press('Enter');
  await settle(page);
  check((await rowTexts(page, false)).length === 1, 'Reports: Training, Month and Year work together');
  await filters.locator('[name="year"]').fill('2023');
  await filters.locator('[name="year"]').press('Enter');
  await settle(page);
  check((await rowTexts(page, false)).length === 0 && /No Batches/.test(await main(page).innerText()), 'Reports: a filter that matches nothing lists nothing');
  await choose(page, filters, 'courseId', 'All Training');
  await choose(page, filters, 'month', 'All Months');
  await filters.locator('[name="year"]').fill('');
  await filters.locator('[name="batchNumber"]').fill(`DOT-2024-08-${pad(course.id)}`);
  await filters.locator('[name="batchNumber"]').press('Enter');
  await settle(page);
  check((await rowTexts(page, false)).length === 1, 'Reports: the Batch No filter');
  await rowsOf(page, false).first().click();
  await dialogOf(page).waitFor();
  const dlgText = await dialogOf(page).innerText();
  check(/Closed/.test(dlgText) && new RegExp(`${attendees.length} attended of ${members.length}`).test(dlgText), 'Reports: a batch opens with its facts', dlgText.slice(0, 160));
  check(/Distinction/.test(dlgText) && /Did not attend/.test(dlgText), 'Reports: and its ratings with their results');
  await press(page, 'Print PDF');
  const pages = await previewOpens(page, 'Training Draft Report');
  state.pdfPages = pages;
  await shot(page, 'desktop-light-report-preview');
  await closeAll(page);
  // a long batch runs on to a second page: the report's header is on the first page only, the footer on each
  const longCourse = options.courses.find((c) => c.name === 'ICT Fundamentals');
  const long = await api(page, 'POST', `${API}/batches`, { course_id: longCourse.id, month: 2, year: 2024 });
  check(long.status === 201 && long.body.data.ratings > 30, 'Reports: a long batch for the preview (every eligible rating)', JSON.stringify(long.body).slice(0, 120));
  await filters.locator('[name="batchNumber"]').fill(long.body.data.batchNumber);
  await filters.locator('[name="batchNumber"]').press('Enter');
  await settle(page);
  await rowsOf(page, false).first().click();
  await dialogOf(page).waitFor();
  await press(page, 'Print PDF');
  const longPages = await previewOpens(page, 'Training Draft Report (long batch)');
  check(longPages >= 2, 'Reports: the long batch runs on to a second page', String(longPages));
  await dialogOf(page).locator('canvas[data-pdf-page]').nth(1).scrollIntoViewIfNeeded();
  await shot(page, 'desktop-light-report-preview-page2');
  await closeAll(page);

  // ---- 5. Excel Upload
  await go(page, 'training/upload');
  const [download] = await Promise.all([page.waitForEvent('download'), main(page).getByRole('button', { name: 'Download Template' }).click()]);
  check(/Template/i.test(download.suggestedFilename()) && /\.xlsx$/.test(download.suggestedFilename()), 'Upload: Download Template', download.suggestedFilename());
  const upCourse = options.courses.find((c) => c.name === 'ICT Fundamentals');
  const [people] = await db.query("SELECT service_number FROM ratings WHERE status = 'current' ORDER BY service_number DESC LIMIT 3");
  const file = await workbook([
    [people[0].service_number, upCourse.name, '', '', '2024-03-04', '2024-04-12', 'NHQ/DOT/2024/001'],
    ['NOSUCH1', upCourse.name, '', '', '2024-03-04', '2024-04-12', ''],
    [people[1].service_number, upCourse.name, '', '', '2024-04-12', '2024-03-04', ''],
  ], 'training-ui.xlsx');
  await main(page).locator('input[type="file"]').setInputFiles(file);
  check(/training-ui\.xlsx/.test(await main(page).innerText()), 'Upload: Choose File shows the file');
  await main(page).getByRole('button', { name: 'Review', exact: true }).click();
  await main(page).getByText('Ready to Import').waitFor();
  const reviewText = await main(page).innerText();
  check(/1\s*Ready to Import/.test(reviewText) && /2\s*Errors/.test(reviewText), 'Upload: Review counts the rows that are ready and the errors', reviewText.replace(/\s+/g, ' ').slice(0, 200));
  check(/Row 3/.test(reviewText) && /Row 4/.test(reviewText) && /Official No/.test(reviewText) && /End Date/.test(reviewText), 'Upload: each problem names its row and field');
  const [[beforeUp]] = [await db.query('SELECT COUNT(*) AS n FROM rating_training WHERE training_course_id = ?', [upCourse.id]).then(([r]) => r)];
  await shot(page, 'desktop-light-upload-review');
  await main(page).getByRole('button', { name: /^Import 1$/ }).click();
  check(/1 entry imported/.test(await toastText(page, /imported/)), 'Upload: Import adds the rows that are right');
  const [[afterUp]] = [await db.query('SELECT COUNT(*) AS n FROM rating_training WHERE training_course_id = ?', [upCourse.id]).then(([r]) => r)];
  check(afterUp.n === beforeUp.n + 1, 'Upload: only the right row was written');
  check(/1\s*Imported/.test(await main(page).innerText()), 'Upload: the result shows the count');
  await shot(page, 'desktop-light-upload-done');

  check(errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// The rules, privileges and audit rows, through the API (a second course, so the screens' batches stay)
// ---------------------------------------------------------------------------
async function rulesFlow(browser, db, state) {
  console.log('\nThe rules, through the API');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);
  const options = (await api(page, 'GET', `${API}/options`)).body.data;
  check(options.courses.length >= 8 && options.institutions.length && options.rates.length, 'Options: courses, institutions, branches, specialisations and rates');
  const seeded = (await api(page, 'GET', `${API}/batches`)).body;
  check(seeded.meta.total >= 4, 'Batches: the demo has open and closed batches', String(seeded.meta.total));
  const open0 = (await api(page, 'GET', `${API}/batches?status=open`)).body;
  const closed0 = (await api(page, 'GET', `${API}/batches?status=closed`)).body;
  check(open0.data.length >= 2 && open0.data.every((b) => b.status === 'open'), 'Batches: the open filter');
  check(closed0.data.length >= 2 && closed0.data.every((b) => b.status === 'closed' && b.attending >= 1), 'Batches: the closed filter');
  check((await api(page, 'GET', `${API}/batches?status=weird`)).status === 422, 'Batches: a status that is not one is refused');
  check((await api(page, 'GET', `${API}/batches?month=13`)).status === 422, 'Batches: a month that is not one is refused');

  // ---- a new batch
  const course = options.courses.find((c) => c.name === 'Petty Officer Course');
  const make = (body) => api(page, 'POST', `${API}/batches`, body);
  const count0 = (await api(page, 'GET', `${API}/eligible?courseId=${course.id}`)).body.data;
  check(count0.count > 0 && count0.count === count0.total, 'Eligible: the course is open to current ratings, with a count', JSON.stringify(count0));
  const made = await make({ course_id: course.id, month: 5, year: 2025 });
  check(made.status === 201, 'New batch: made', JSON.stringify(made.body));
  const batch = made.body.data;
  check(batch.batchNumber === `DOT-2025-05-${pad(course.id)}`, 'New batch: the number is DOT-year-month-course', batch.batchNumber);
  check(batch.status === 'open' && batch.ratings === count0.count && batch.members.length === count0.count, 'New batch: open, with every eligible rating');
  const dup = await make({ course_id: course.id, month: 5, year: 2025 });
  check(dup.status === 422 && dup.body.error.message.includes(batch.batchNumber), 'New batch: a duplicate is refused, naming the batch it matches', dup.body && dup.body.error && dup.body.error.message);
  const none = await make({ course_id: course.id, month: 6, year: 2025 });
  check(none.status === 422 && /at least one rating/.test(none.body.error.message), 'New batch: no eligible rating is refused (they are all in the open batch)');
  check((await make({ course_id: course.id, month: 13, year: 2025 })).status === 422, 'New batch: a month that is not one is refused');
  check((await make({ course_id: course.id, month: 5, year: 1999 })).status === 422, 'New batch: a year that is too early is refused');
  check((await make({ month: 5, year: 2025 })).status === 422, 'New batch: no course is refused');
  const eligibleNow = (await api(page, 'GET', `${API}/eligible?courseId=${course.id}`)).body.data;
  check(eligibleNow.count === 0, 'Eligible: a rating already in an open batch for the course is left out');

  // ---- Training Review: remove, add, refusals
  const [first, second, third] = batch.members;
  const removed = await api(page, 'DELETE', `${API}/batches/${batch.id}/ratings/${first.serviceNumber}`);
  check(removed.status === 200, 'Review: a rating is removed');
  check((await api(page, 'DELETE', `${API}/batches/${batch.id}/ratings/${first.serviceNumber}`)).status === 404, 'Review: removing it again is refused');
  const back = await api(page, 'POST', `${API}/batches/${batch.id}/ratings`, { serviceNumber: first.serviceNumber });
  check(back.status === 201 && back.body.data.lastCourse, 'Review: the rating is added again, with its last course (or First course)');
  const again = await api(page, 'POST', `${API}/batches/${batch.id}/ratings`, { serviceNumber: first.serviceNumber });
  check(again.status === 422 && /already in this batch/.test(again.body.error.message), 'Review: a rating already in the batch is refused with the reason');
  check((await api(page, 'POST', `${API}/batches/${batch.id}/ratings`, { serviceNumber: 'NOSUCH1' })).status === 404, 'Review: an unknown rating is refused');
  const [[former]] = [await db.query("SELECT service_number FROM ratings WHERE status = 'former' LIMIT 1").then(([r]) => r)];
  if (former) {
    const f = await api(page, 'POST', `${API}/batches/${batch.id}/ratings`, { serviceNumber: former.service_number });
    check(f.status === 422 && /left the service/.test(f.body.error.message), 'Review: a former rating is refused with the reason');
  }
  const noFilter = await api(page, 'POST', `${API}/batches/${batch.id}/ratings/filter`, {});
  check(noFilter.status === 422, 'Add Ratings: when everyone eligible is in already, it says so');

  // ---- Update Training History
  const mark = await api(page, 'PUT', `${API}/batches/${batch.id}/ratings/${third.serviceNumber}`, { attended: false });
  check(mark.status === 200 && mark.body.data.attended === false, 'History: a rating is marked as not attended');
  const badDates = await api(page, 'PUT', `${API}/batches/${batch.id}/ratings/${second.serviceNumber}`, { start_date: isoOf(dayFrom(-5)), end_date: isoOf(dayFrom(-20)) });
  check(badDates.status === 422 && badDates.body.error.fields.end_date, 'History: an end date before the start is refused');
  const future = await api(page, 'PUT', `${API}/batches/${batch.id}/ratings/${second.serviceNumber}`, { start_date: isoOf(dayFrom(-5)), end_date: isoOf(dayFrom(1)) });
  check(future.status === 422 && future.body.error.fields.end_date, 'History: an end date in the future is refused');
  const half = await api(page, 'PUT', `${API}/batches/${batch.id}/ratings/${second.serviceNumber}`, { start_date: isoOf(dayFrom(-60)), end_date: '' });
  check(half.status === 422, 'History: one date without the other is refused');
  const own = await api(page, 'PUT', `${API}/batches/${batch.id}/ratings/${second.serviceNumber}`, { start_date: isoOf(dayFrom(-120)), end_date: isoOf(dayFrom(-30)) });
  check(own.status === 200 && own.body.data.startDate === isoOf(dayFrom(-120)), 'History: a rating has its own dates');
  const attending = (await api(page, 'GET', `${API}/batches/${batch.id}`)).body.data.members.filter((m) => m.attended);

  const confirm = (body) => api(page, 'POST', `${API}/batches/${batch.id}/confirm`, body);
  const institution = options.institutions[0];
  const allResults = Object.fromEntries(attending.map((m, i) => [m.serviceNumber, ['Distinction', 'Credit', 'Pass', 'Fail'][i % 4]]));
  const base = { institution_id: institution.id, start_date: isoOf(dayFrom(-150)), end_date: isoOf(dayFrom(-20)), results: allResults };
  const missing = await confirm({ ...base, results: {} });
  check(missing.status === 422 && Object.keys(missing.body.error.fields).some((k) => k.startsWith('results.')), 'Confirm: every attending rating needs a result');
  check((await confirm({ ...base, end_date: isoOf(dayFrom(-200)) })).status === 422, 'Confirm: an end date before the start is refused');
  const fut = await confirm({ ...base, end_date: isoOf(dayFrom(1)) });
  check(fut.status === 422 && fut.body.error.fields.end_date, 'Confirm: an end date in the future is refused');
  check((await confirm({ ...base, institution_id: 999999 })).status === 422, 'Confirm: an institution that is not in the table is refused');
  check((await confirm({ ...base, results: { ...allResults, [attending[0].serviceNumber]: 'Excellent' } })).status === 422, 'Confirm: a result outside Distinction, Credit, Pass and Fail is refused');
  const [[before]] = [await db.query('SELECT COUNT(*) AS n FROM rating_training WHERE training_course_id = ?', [course.id]).then(([r]) => r)];
  check(before.n === 0, 'Confirm: nothing was written by the refusals');

  const done = await confirm(base);
  check(done.status === 200 && done.body.data.status === 'closed', 'Confirm: the history is confirmed and the batch closed', JSON.stringify(done.body).slice(0, 200));
  const [entries] = await db.query('SELECT service_number, institution_id, training_course_id, qualification, classification, start_date, end_date FROM rating_training WHERE training_course_id = ?', [course.id]);
  check(entries.length === attending.length, 'Confirm: a Training entry for each rating that attended', `${entries.length} of ${attending.length}`);
  check(!entries.some((e) => e.service_number === third.serviceNumber), 'Confirm: none for the rating that did not attend');
  check(entries.every((e) => e.institution_id === institution.id && e.qualification === course.name && allResults[e.service_number] === e.classification), 'Confirm: the course, the institution and the result are on each entry');
  const ownEntry = entries.find((e) => e.service_number === second.serviceNumber);
  check(!ownEntry || String(ownEntry.start_date).includes(String(dayFrom(-120).getFullYear())), 'Confirm: a rating with its own dates keeps them');
  check((await api(page, 'POST', `${API}/batches/${batch.id}/ratings`, { serviceNumber: first.serviceNumber })).status === 409, 'Closed batch: a rating cannot be added');
  check((await api(page, 'DELETE', `${API}/batches/${batch.id}/ratings/${second.serviceNumber}`)).status === 409, 'Closed batch: a rating cannot be removed');
  check((await confirm(base)).status === 409, 'Closed batch: it cannot be confirmed twice');
  const stillOpen = (await api(page, 'GET', `${API}/batches?status=open`)).body.data;
  check(!stillOpen.some((b) => b.id === batch.id), 'Closed batch: it has left the open list');
  const nowEligible = (await api(page, 'GET', `${API}/eligible?courseId=${course.id}`)).body.data;
  check(nowEligible.count > 0, 'Eligible: once the batch is closed the course is open to those ratings again');

  // ---- Reports
  const found = (await api(page, 'GET', `${API}/batches?batchNumber=${encodeURIComponent(batch.batchNumber)}`)).body.data;
  check(found.length === 1 && found[0].id === batch.id, 'Reports: the batch number filter');
  check((await api(page, 'GET', `${API}/batches?courseId=${course.id}&month=5&year=2025`)).body.data.length === 1, 'Reports: the training, month and year filters work together');
  check((await api(page, 'GET', `${API}/batches?courseId=${course.id}&month=7&year=2025`)).body.data.length === 0, 'Reports: a filter that matches nothing lists nothing');
  const pdf = await fileHead(page, `${API}/batches/${batch.id}/pdf`);
  check(pdf.status === 200 && pdf.head === '%PDF' && /pdf/.test(pdf.type) && pdf.size > 2000, 'Reports: the Training Draft Report is a PDF', JSON.stringify(pdf));
  const pdfOpen = await fileHead(page, `${API}/batches/${open0.data[0].id}/pdf`);
  check(pdfOpen.head === '%PDF', 'Reports: an open batch prints too');

  // ---- Excel upload
  const tpl = await fileHead(page, `${API}/upload/template`);
  check(tpl.status === 200 && tpl.head === 'PK\u0003\u0004', 'Upload: the template is a workbook');
  const [rows] = await db.query("SELECT service_number FROM ratings WHERE status = 'current' ORDER BY service_number LIMIT 3");
  const ict = options.courses.find((c) => c.name === 'ICT Fundamentals');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Training Upload');
  ws.addRow(['Official No', 'Course', 'Institution', 'Qualification', 'Start Date', 'End Date', 'Authority']);
  ws.addRow([rows[0].service_number, ict.name, '', '', '2025-09-01', '2025-10-10', 'NHQ/DOT/2025/001']);
  ws.addRow(['NOSUCH1', ict.name, '', '', '2025-09-01', '2025-10-10', '']);
  ws.addRow([rows[1].service_number, 'No Such Course', '', '', '2025-09-01', '2025-10-10', '']);
  ws.addRow([rows[1].service_number, ict.name, '', '', '2025-10-10', '2025-09-01', '']);
  ws.addRow([rows[2].service_number, ict.name, '', '', '2025-09-01', '2999-01-01', '']);
  ws.addRow([rows[0].service_number, ict.name, '', '', '2025-09-01', '2025-10-10', 'repeat']);
  const buffer = await wb.xlsx.writeBuffer();
  const review = await sendFile(page, `${API}/upload/review`, buffer, 'training.xlsx');
  check(review.status === 200 && review.body.data.total === 6, 'Upload: review reads every row', JSON.stringify(review.body).slice(0, 200));
  check(review.body.data.importable === 1 && review.body.data.errors === 4 && review.body.data.skipped === 1, 'Upload: one ready, four errors, one repeat skipped', JSON.stringify(review.body.data).slice(0, 240));
  const fields = review.body.data.problems.map((p) => `${p.row}:${p.field}`);
  check(fields.includes('3:Official No') && fields.includes('4:Course') && fields.includes('5:End Date') && fields.includes('6:End Date'), 'Upload: each problem names its row and field', fields.join(','));
  const [[b4]] = [await db.query('SELECT COUNT(*) AS n FROM rating_training WHERE training_course_id = ?', [ict.id]).then(([r]) => r)];
  const imp = await sendFile(page, `${API}/upload/import`, buffer, 'training.xlsx');
  check(imp.status === 200 && imp.body.data.imported === 1, 'Upload: the rows that are right are imported together', JSON.stringify(imp.body).slice(0, 200));
  const [[a4]] = [await db.query('SELECT COUNT(*) AS n FROM rating_training WHERE training_course_id = ?', [ict.id]).then(([r]) => r)];
  check(a4.n === b4.n + 1, 'Upload: only that row was written');
  const second2 = await sendFile(page, `${API}/upload/import`, buffer, 'training.xlsx');
  check(second2.status === 200 && second2.body.data.imported === 0 && second2.body.data.skipped >= 1, 'Upload: the same file again adds nothing (already on the record)');
  const wrongHeadings = new ExcelJS.Workbook();
  wrongHeadings.addWorksheet('x').addRow(['Name', 'Thing']);
  check((await sendFile(page, `${API}/upload/review`, await wrongHeadings.xlsx.writeBuffer(), 'x.xlsx')).status === 400, 'Upload: wrong headings are refused');
  const emptyBook = new ExcelJS.Workbook();
  emptyBook.addWorksheet('x').addRow(['Official No', 'Course', 'Start Date', 'End Date']);
  check((await sendFile(page, `${API}/upload/review`, await emptyBook.xlsx.writeBuffer(), 'x.xlsx')).status === 400, 'Upload: a workbook with no rows is refused');
  const notExcel = await page.request.fetch(`${BASE}${API}/upload/review`, { method: 'POST', failOnStatusCode: false, multipart: { file: { name: 'x.csv', mimeType: 'text/plain', buffer: Buffer.from('hello') } } });
  check(notExcel.status() === 400, 'Upload: a file that is not .xlsx is refused');

  // ---- the audit trail
  const audit = async (table) => (await api(page, 'GET', `/api/audit?table=${table}&pageSize=100`)).body.data;
  const batches = (await audit('training_batches')).filter((a) => a.recordId === batch.batchNumber);
  check(batches.some((a) => a.action === 'INSERT') && batches.some((a) => a.action === 'UPDATE'), 'Audit: the making and the closing of a batch');
  const memberRows = (await audit('training_batch_ratings')).filter((a) => String(a.recordId).startsWith(`${batch.batchNumber}:`));
  check(memberRows.some((a) => a.action === 'DELETE') && memberRows.some((a) => a.action === 'INSERT') && memberRows.some((a) => a.action === 'UPDATE'), 'Audit: a rating removed, added and updated in a batch');
  const trainingRows = (await audit('rating_training')).filter((a) => attending.some((m) => String(a.recordId).startsWith(`${m.serviceNumber}:`)));
  check(trainingRows.length >= attending.length, 'Audit: each Training entry made by the confirmation');
  const screens = (await audit('training_batches')).filter((a) => a.recordId === `DOT-2024-08-${pad(state.uiCourse.id)}`);
  check(screens.some((a) => a.action === 'INSERT') && screens.some((a) => a.action === 'UPDATE'), 'Audit: the batch the screens made and closed');

  check(errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// The roles
// ---------------------------------------------------------------------------
async function roles(browser, state) {
  console.log('\nThe roles');
  // the old Training role may do all of it
  let s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, TRAINER);
  check((await api(s.page, 'GET', `${API}/batches`)).status === 200, 'Training role: may see the batches');
  check(/Training Drafting/.test(await s.page.locator('#rail').innerText()), 'Training role: Training Drafting is in the sidebar');
  check((await api(s.page, 'GET', `${API}/upload/template`)).status === 200, 'Training role: may download the upload template');
  check((await api(s.page, 'GET', '/api/ratings/search?q=B05&status=current')).status === 200, 'Training role: the rating search opens for Training Review');
  await go(s.page, 'training/process');
  check((await s.page.getByRole('button', { name: 'New Training Batch' }).count()) === 1, 'Training role: New Training Batch is there');
  check((await api(s.page, 'GET', '/api/users')).status === 403, 'Training role: no System Administration');
  check(s.errors.length === 0, 'Training role: no browser errors', s.errors.join(' | '));
  await s.context.close();

  // a role that may only view the batches and the reports
  s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, VIEWER);
  const open1 = (await api(s.page, 'GET', `${API}/batches?status=open`)).body.data[0];
  check(open1 !== undefined, 'Viewer: may see the batches');
  check((await api(s.page, 'POST', `${API}/batches`, { course_id: 1, month: 2, year: 2023 })).status === 403, 'Viewer: may not make a batch');
  check((await api(s.page, 'POST', `${API}/batches/${open1.id}/ratings`, { serviceNumber: 'B0501' })).status === 403, 'Viewer: may not add a rating');
  check((await api(s.page, 'PUT', `${API}/batches/${open1.id}/ratings/B0501`, { attended: false })).status === 403, 'Viewer: may not change attendance');
  check((await api(s.page, 'POST', `${API}/batches/${open1.id}/confirm`, {})).status === 403, 'Viewer: may not confirm a history');
  check((await api(s.page, 'DELETE', `${API}/batches/${open1.id}/ratings/B0501`)).status === 403, 'Viewer: may not remove a rating');
  check((await api(s.page, 'GET', `${API}/upload/template`)).status === 403, 'Viewer: has no Excel Upload');
  check((await sendFile(s.page, `${API}/upload/import`, Buffer.from('x'), 'x.xlsx')).status === 403, 'Viewer: may not import');
  check((await fileHead(s.page, `${API}/batches/${open1.id}/pdf`)).status === 200, 'Viewer: the Reports privilege prints the Training Draft Report');
  await go(s.page, 'training/process');
  check((await s.page.getByRole('button', { name: 'New Training Batch' }).count()) === 0, 'Viewer: no New Training Batch button');
  await go(s.page, `training/review/${open1.id}`);
  check((await main(s.page).getByRole('button', { name: 'Add Rating' }).count()) === 0 && (await main(s.page).getByRole('button', { name: 'Add by Branch' }).count()) === 0, 'Viewer: no Add Rating and no Add by Branch in Training Review');
  await go(s.page, `training/history/${open1.id}`);
  check((await main(s.page).getByRole('button', { name: 'Confirm Training History' }).count()) === 0 && (await main(s.page).getByRole('checkbox').first().isDisabled()), 'Viewer: no Confirm, and the Attended boxes are read only');
  await go(s.page, 'training/upload');
  check(/not allowed|do not have|permission/i.test(await main(s.page).innerText()), 'Viewer: Excel Upload shows the not-allowed page');
  check(s.errors.length === 0, 'Viewer: no browser errors', s.errors.join(' | '));
  await s.context.close();

  // a rating (the Rating role) has nothing of it
  s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, { username: 'B0539', password: 'Rating@123' });
  check((await api(s.page, 'GET', `${API}/batches`)).status === 403, 'A rating: no access to the batches');
  check((await api(s.page, 'GET', `${API}/options`)).status === 403, 'A rating: no access to the options');
  check((await s.page.locator('#rail').innerText()).includes('Training Drafting') === false, 'A rating: Training Drafting is not in the sidebar');
  await s.context.close();
  void state;
}

// ---------------------------------------------------------------------------
// Each layout: every page and its main dialog
// ---------------------------------------------------------------------------
async function layoutPass(browser, db, viewport, theme) {
  const label = `${viewport.width}px ${theme}`;
  console.log(`\nLayout ${label}`);
  const { context, page, errors, phone } = await open(browser, { viewport, theme });
  await signIn(page, ADMIN);
  const [[openBatch]] = [await db.query("SELECT id FROM training_batches WHERE status = 'open' ORDER BY id LIMIT 1").then(([r]) => r)];
  const plan = [
    ['training/process', async () => { await rowsOf(page, phone).first().click(); }],
    [`training/review/${openBatch.id}`, async () => { await rowsOf(page, phone).first().click(); }],
    [`training/history/${openBatch.id}`, async () => { await rowsOf(page, phone).first().click(); }],
    ['training/reports', async () => { await rowsOf(page, phone).first().click(); }],
    ['training/upload', null],
  ];
  for (const [route, openMain] of plan) {
    await go(page, route);
    await noOverflow(page, `${label} ${route}`);
    const words = await main(page).innerText();
    check(!/\b(null|undefined|NaN|\[object Object\])\b/.test(words), `${label} ${route}: no null, undefined or NaN on the page`);
    await shot(page, `${viewport.width}-${theme}-${route.replace(/\//g, '-')}`);
    if (!openMain) continue;
    await openMain();
    await dialogOf(page).waitFor();
    await page.waitForFunction(() => !document.querySelector('#overlay-root')?.textContent.includes('Loading'), null, { timeout: 10000 });
    await page.waitForTimeout(150);
    const fits = await dialogOf(page).evaluate((d) => d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().right <= window.innerWidth + 1);
    check(fits, `${label} ${route}: its dialog fits`);
    check(!/\b(null|undefined|NaN|\[object Object\])\b/.test(await dialogOf(page).innerText()), `${label} ${route}: no null, undefined or NaN in the dialog`);
    await shot(page, `${viewport.width}-${theme}-${route.replace(/\//g, '-')}-dialog`);
    await closeAll(page);
  }
  // the dialog that makes a batch, on both steps
  await go(page, 'training/process');
  await main(page).getByRole('button', { name: 'New Training Batch' }).click();
  await dialogOf(page).waitFor();
  await noOverflow(page, `${label} New Training Batch`);
  await shot(page, `${viewport.width}-${theme}-new-batch-1`);
  await chooseIn(page, 'course_id', 'Gunnery');
  await press(page, 'Next');
  await countSettled(page);
  const fits2 = await dialogOf(page).evaluate((d) => d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().right <= window.innerWidth + 1);
  check(fits2, `${label} New Training Batch: step 2 fits`);
  await shot(page, `${viewport.width}-${theme}-new-batch-2`);
  await closeAll(page);
  // the Add Rating and Confirm dialogs
  await go(page, `training/review/${openBatch.id}`);
  await main(page).getByRole('button', { name: 'Add Rating' }).click();
  await dialogOf(page).waitFor();
  check(await dialogOf(page).evaluate((d) => d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().right <= window.innerWidth + 1), `${label} Add Rating: its dialog fits`);
  await shot(page, `${viewport.width}-${theme}-add-rating`);
  await closeAll(page);
  await go(page, `training/history/${openBatch.id}`);
  await main(page).getByRole('button', { name: 'Confirm Training History' }).click();
  await dialogOf(page).waitFor();
  check(await dialogOf(page).evaluate((d) => d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().right <= window.innerWidth + 1), `${label} Confirm Training History: its dialog fits`);
  await shot(page, `${viewport.width}-${theme}-confirm`);
  await closeAll(page);
  if (phone) {
    await go(page, 'training/reports');
    check(await page.locator('#app-main [data-filters] button', { hasText: 'Filters' }).isVisible(), `${label}: the filters fold into a Filters button`);
    check(await rowsOf(page, true).count() > 0, `${label}: the lists are cards`);
    await go(page, `training/history/${openBatch.id}`);
    check(await main(page).locator('.desk\\:hidden').getByRole('checkbox').first().isVisible(), `${label}: the Attended box sits on each card`);
    const sheet = await (async () => { await rowsOf(page, true).first().click(); await dialogOf(page).waitFor(); const r = await dialogOf(page).boundingBox(); await closeAll(page); return r; })();
    check(sheet.y + sheet.height >= viewport.height - 2, `${label}: a row opens as a bottom sheet`, JSON.stringify(sheet));
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
    await rulesFlow(browser, db, state);
    await roles(browser, state);
    for (const vp of [DESKTOP, PHONE]) for (const theme of ['light', 'dark']) await layoutPass(browser, db, vp, theme);
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
