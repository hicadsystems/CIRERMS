#!/usr/bin/env node
'use strict';

/*
 * Walk-through of Discharge Administration (WP5). Uses the Playwright installed on the machine (not a project
 * dependency):
 *
 *   npm run migrate:fresh                       # a fresh demo database (the walk-through closes ratings for good)
 *   npm start                                   # the app on :3000
 *   NODE_PATH=$(npm root -g) node tests/e2e/discharge-walkthrough.js
 *
 * BASE changes the address; SHOTS=<dir> saves screenshots there. It reads .env for the database (the audit
 * trail, the rows behind the screens, the accounts it makes), and runs the scheduled changes in this process
 * with a later date, to see a scheduled discharge take effect. Exits non-zero when a check fails. Browser
 * errors fail the run.
 *
 * As the Administrator at 1440 px, light: the whole cycle through the screens. Process Discharge (the due list
 * only reads, a pending case is flagged, Create Proposal writes only when confirmed, Process with its refusals,
 * Pending, Closed in the future (Scheduled) and Closed today (the rating becomes Former, its posting ends, its
 * account is deactivated and its session ends), Add Rating, Re-engage, Remove); Print Service Details; Verification
 * Forms (off with the reason when the source is missing); Upload Discharge (every state: refused files, review,
 * import, the same file again); Discharge Report (filters, figures, the printout with page 2, the workbook).
 * Then the rules and privileges through the API (the due rule from the settings, every refusal, the Discharge
 * role, a role that may only read, a rating) and the audit trail; then each layout (1440 and 390 px, light and
 * dark) draws every page and its main dialog with nothing overflowing.
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
const OFFICER = { username: 'B1000', password: 'Admin@123' }; // Discharge
const READER = { username: 'B0812', password: 'Admin@123' }; // made here: may only read the Discharge Report
const MAKER = { username: 'B1011', password: 'Admin@123' }; // made here: a rating with an account, discharged below
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
    p.on('pageerror', (e) => { if (process.env.DEBUG) console.log(`    [pageerror] ${e.message}`); errors.push(`pageerror: ${e.message}`); });
    p.on('console', (m) => {
      if (m.type() !== 'error') return;
      if (process.env.DEBUG) console.log(`    [browser] ${m.text()}`);
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

/** Posts a file (as the page's session) and gives back the status and JSON. */
const sendFile = (page, url, name, bytes, type = 'application/octet-stream') => page.evaluate(async ({ url, name, bytes, type }) => {
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(bytes)], { type }), name);
  const res = await fetch(url, { method: 'POST', credentials: 'include', body: fd });
  let body = null;
  try { body = await res.json(); } catch (_) { body = null; }
  return { status: res.status, body };
}, { url, name, bytes: Array.from(bytes), type });

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
  await t.waitFor({ timeout: 10000 }).catch(async (e) => {
    throw new Error(`no toast matching ${re}; showing: ${(await page.locator('#toast-root').innerText().catch(() => '')).replace(/\s+/g, ' ')}; dialog: ${(await dialogOf(page).innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)}; errors: ${(await dialogOf(page).locator('[data-field-error]:visible').allInnerTexts().catch(() => [])).join(' | ')}; ${e.message.split('\n')[0]}`);
  });
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
/** Types into the due list's search and waits until the list shows only that rating. */
async function findDue(page, sn) {
  await main(page).getByRole('searchbox', { name: 'Official No or Name' }).fill(sn);
  await page.waitForFunction((x) => { const rows = document.querySelectorAll('#app-main table tbody tr[tabindex]'); return rows.length === 1 && rows[0].innerText.includes(x); }, sn);
}
const tab = (page, key) => main(page).locator(`[role="tab"][data-tab="${key}"]`).click();

async function noOverflow(page, label) {
  const wide = await page.evaluate(() => {
    const over = Array.from(document.querySelectorAll('#app-main *')).filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'auto' && e.closest('table')).length;
    return { page: document.documentElement.scrollWidth - window.innerWidth, main: document.querySelector('#app-main').scrollWidth - document.querySelector('#app-main').clientWidth, tables: over };
  });
  check(wide.page <= 1 && wide.main <= 1 && wide.tables === 0, `${label}: nothing scrolls sideways`, JSON.stringify(wide));
}

/** The printout opens in the app's own preview with its pages drawn; gives the page count. */
async function previewOpens(page, label) {
  await dialogOf(page).locator('[data-pdf-stage][data-ready="1"]').waitFor({ timeout: 30000 });
  const n = await dialogOf(page).locator('canvas[data-pdf-page]').count();
  const count = await dialogOf(page).locator('[data-pdf-count]').innerText();
  check(n >= 1 && new RegExp(`${n} pages?`).test(count), `${label}: opens in the preview with its pages (${count})`);
  check((await dialogOf(page).locator('iframe, embed, object').count()) === 0, `${label}: no browser PDF viewer`);
  return n;
}

/** A workbook for Upload Discharge as bytes. */
async function workbook(rows, headers = ['Official No', 'Exit Type', 'Exit Date', 'Authority', 'Approved By', 'Comment']) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Upload Discharge');
  ws.columns = headers.map((header) => ({ header }));
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** A change still to come for a rating, as Drafting or Advancement would have scheduled it. */
const scheduleLater = (db, sn, kind, date) => db.query("INSERT INTO scheduled_changes (kind, service_number, effective_date, payload, status) VALUES (?, ?, ?, '{}', 'scheduled')", [kind, sn, date]);
const stateOf = async (db, sn, kind, date) => (await db.query('SELECT status, outcome FROM scheduled_changes WHERE service_number = ? AND kind = ? AND effective_date = ?', [sn, kind, date]))[0][0];

const one = async (db, sql, params = []) => (await db.query(sql, params))[0][0];
const all = async (db, sql, params = []) => (await db.query(sql, params))[0];

// ---------------------------------------------------------------------------
// Administrator, desktop, light: the whole cycle
// ---------------------------------------------------------------------------
async function adminFlow(browser, db, state) {
  console.log('\nAdministrator, desktop, light: the whole cycle');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);
  const today = new Date();

  // a rating with an account and a posting, to see what closing does to them
  const roleRating = (await one(db, "SELECT id FROM roles WHERE name = 'Rating'")).id;
  const hash = (await one(db, "SELECT password_hash AS h FROM users WHERE username = 'HICO001'")).h;
  await db.query('INSERT INTO users (username, password_hash, role_id, service_number, is_active) VALUES (?, ?, ?, ?, 1)', [MAKER.username, hash, roleRating, MAKER.username]);
  await db.query("INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date) SELECT 'B1011', (SELECT id FROM ref_ship WHERE name = 'NNS ARADU'), rate_id, '2025-01-05', NULL FROM ratings WHERE service_number = 'B1011'");
  const makerSession = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(makerSession.page, MAKER);
  check((await api(makerSession.page, 'GET', '/api/auth/me')).status === 200, 'the rating with an account is signed in');

  // ---- sidebar, tabs, Ctrl K
  const link = page.locator('#rail nav a', { hasText: 'Discharge' }).first();
  check(await link.count() === 1 && !(await link.innerText()).includes('Soon'), 'Discharge Administration has lost its Soon badge');
  await link.click();
  await settle(page);
  check(page.url().endsWith('#discharge/process'), 'the module opens on Process Discharge', page.url());
  for (const t of ['Process Discharge', 'Print Service Details', 'Verification Forms', 'Discharge Report', 'Upload Discharge']) {
    check(await page.locator('#module-tabs a', { hasText: t }).count() > 0, `tab: ${t}`);
  }
  await page.keyboard.press('Control+K');
  await page.keyboard.type('Upload Discharge');
  await page.locator('#palette-results').getByText('Upload Discharge').first().waitFor();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#discharge/upload');
  check(true, 'Ctrl K finds and opens Upload Discharge');

  // ---- 1. Process Discharge: the due list only reads
  await go(page, 'discharge/process');
  const [[{ n: proposalsBefore }]] = await db.query('SELECT COUNT(*) AS n FROM discharge_proposals');
  const [[{ n: rowsBefore }]] = await db.query('SELECT COUNT(*) AS n FROM discharge_rows');
  const dueText = await main(page).innerText();
  check(/\d+ ratings are due, 5 already in a proposal/.test(dueText), 'Due list: the count and how many are already in a proposal');
  const due = await rowTexts(page, false);
  check(due.length === 25 && due.some((t) => /B1004/.test(t)), 'Due list: 25 a page from the server, the oldest first');
  check(!due.some((t) => /B1021|B1041/.test(t)), 'Due list: a closed discharge and a running re-engagement are left out');
  await findDue(page, 'B0640');
  check(/Pending case/.test((await rowTexts(page, false))[0]), 'Due list: a pending disciplinary case shows as a pill');
  await openRow(page, false, 'B0640');
  const dueDialog = await dialogOf(page).innerText();
  check(/pending disciplinary case/.test(dueDialog) && /Nothing blocks/.test(dueDialog), 'Due list: the dialog warns of the pending case, and says nothing blocks');
  check(/Official No\s*B0640/.test(dueDialog) && /Entry Mode/.test(dueDialog), 'Due list: details read as label and value rows');
  check(await dialogOf(page).getByRole('button', { name: /Create Proposal|Process|Remove|Re-engage/ }).count() === 0, 'Due list: the dialog writes nothing');
  await closeAll(page);
  const [[{ n: proposalsAfterRead }]] = await db.query('SELECT COUNT(*) AS n FROM discharge_proposals');
  check(proposalsAfterRead === proposalsBefore, 'Due list: reading, searching and opening make no proposal');
  await shot(page, 'desktop-light-process-due');

  // ---- 2. Create Proposal: written only when confirmed
  await findDue(page, 'B1006');
  await main(page).getByRole('button', { name: 'Create Proposal' }).click();
  await dialogOf(page).waitFor();
  const cp = await dialogOf(page).innerText();
  check(/DIS-\d{4}-0003/.test(cp) && /Ratings to Add\s*1/.test(cp), 'Create Proposal: the number and how many ratings go in', cp.replace(/\s+/g, ' '));
  await shot(page, 'desktop-light-create-proposal');
  await press(page, 'Cancel');
  const [[{ n: afterCancel }]] = await db.query('SELECT COUNT(*) AS n FROM discharge_proposals');
  check(afterCancel === proposalsBefore, 'Create Proposal: Cancel writes nothing');
  await main(page).getByRole('button', { name: 'Create Proposal' }).click();
  await dialogOf(page).waitFor();
  await press(page, 'Create Proposal');
  check(/Proposal DIS-\d{4}-0003 created/.test(await toastText(page, /created/)), 'Create Proposal: made when confirmed');
  const p3 = await one(db, "SELECT id, proposal_number FROM discharge_proposals WHERE proposal_number LIKE '%-0003'");
  state.p3 = p3;
  check(!!p3 && (await one(db, "SELECT COUNT(*) AS n FROM discharge_rows WHERE proposal_id = ? AND service_number = 'B1006' AND status = 'pending'", [p3.id])).n === 1, 'Create Proposal: the rating is in the proposal, pending');
  check((await one(db, "SELECT status FROM ratings WHERE service_number = 'B1006'")).status === 'current', 'Create Proposal: a proposal changes no rating');

  // ---- 3. Process a rating: refusals, Pending, then Closed in the future (Scheduled)
  await page.waitForFunction(() => /have an exit type/.test(document.querySelector('#app-main').innerText));
  await settle(page);
  const proposalRows = await rowTexts(page, false);
  check(proposalRows.length === 1 && /B1006/.test(proposalRows[0]), 'Proposals: the new proposal holds its one rating');
  await openRow(page, false, 'B1006');
  check(/Proposal\s*DIS-\d{4}-0003/.test(await dialogOf(page).innerText()), 'Proposals: a row opens the rating with its proposal');
  for (const b of ['Process', 'Re-engage', 'Remove', 'Open Record']) {
    check(await dialogOf(page).getByRole('button', { name: b, exact: true }).count() === 1, `Proposals: the dialog has ${b}`);
  }
  await press(page, 'Process');
  await dialogOf(page).locator('[name="exitReason"]').waitFor();
  check(await dialogOf(page).locator('[name="deathCertificate"]').isHidden(), 'Process: the death documents stay hidden until a Death exit type is chosen');
  await press(page, 'Save');
  check(/Choose an exit type/.test(await errorText(page, 'exitTypeId')) && /reason/.test(await errorText(page, 'exitReason')), 'Process: an empty form shows its errors under the fields');
  const types = await dialogOf(page).locator('.custom-dropdown-wrapper[name="exitTypeId"]').evaluate((w) => w.innerText);
  void types;
  await chooseIn(page, 'exitTypeId', 'RETIRED');
  await fillIn(page, 'exitReason', 'x'.repeat(101));
  check((await dialogOf(page).locator('[name="exitReason"]').inputValue()).length === 100, 'Process: the reason field takes 100 characters at most');
  await fillIn(page, 'exitReason', 'Compulsory retirement');
  await fillIn(page, 'approvedBy', 'Chief of Naval Staff');
  await fillIn(page, 'exitDate', ddmmyyyy(dayFrom(10)));
  await press(page, 'Save');
  check(/saved as pending/i.test(await toastText(page, /pending/)), 'Process: saved as Pending');
  check((await one(db, "SELECT status, exit_reason FROM discharge_rows WHERE service_number = 'B1006'")).status === 'pending', 'Process: a pending discharge changes nothing else');
  await settle(page);
  await openRow(page, false, 'B1006');
  check(/RETIRED/.test(await dialogOf(page).innerText()), 'Proposals: the row now shows its exit type');
  await press(page, 'Process');
  await dialogOf(page).locator('[name="exitReason"]').waitFor();
  await chooseIn(page, 'status', 'Closed');
  await press(page, 'Save');
  check(/Close Discharge/.test(await dialogOf(page).innerText()) && /stays current until/.test(await dialogOf(page).innerText()) && /final/.test(await dialogOf(page).innerText()), 'Process: Closed asks first, says it is final, and that a later date is scheduled');
  await shot(page, 'desktop-light-close-confirm');
  await press(page, 'Close Discharge');
  check(/closed/i.test(await toastText(page, /closed/i)), 'Process: a future exit date closes as Scheduled');
  const sched = await one(db, "SELECT s.id, s.status, s.effective_date, d.status AS row_status FROM scheduled_changes s JOIN discharge_rows d ON d.scheduled_change_id = s.id WHERE s.service_number = 'B1006' AND s.kind = 'discharge'");
  check(!!sched && sched.status === 'scheduled' && sched.row_status === 'scheduled' && sched.effective_date === isoOf(dayFrom(10)), 'Scheduled: through src/shared/scheduled, for the exit date', JSON.stringify(sched));
  check((await one(db, "SELECT status FROM ratings WHERE service_number = 'B1006'")).status === 'current', 'Scheduled: the rating stays current until the date');
  await settle(page);
  await go(page, 'ratings/edit/B1006');
  await main(page).locator('[data-discharge-pills]').getByText(`Leaves ${ddmmyyyy(dayFrom(10))}`).waitFor();
  check(true, 'Record: a scheduled discharge shows Leaves dd/mm/yyyy in the header');
  await shot(page, 'desktop-light-record-leaves');
  await go(page, 'ratings/edit/B1041');
  await main(page).locator('[data-discharge-pills]').getByText(/^Re-engaged to \d\d\/\d\d\/\d{4}$/).waitFor();
  check(true, 'Record: a re-engaged rating shows Re-engaged to dd/mm/yyyy in the header');
  await shot(page, 'desktop-light-record-reengaged');
  await go(page, 'ratings/edit/B1021');
  check(await main(page).locator('[data-discharge-pills]').count() === 0, 'Record: a former rating shows neither');

  // ---- 4. Add Rating, then close today: Former, posting ended, account deactivated, session ended
  await go(page, 'discharge/process');
  await tab(page, 'proposals');
  await settle(page);
  await main(page).getByRole('button', { name: 'Add Rating' }).click();
  await dialogOf(page).waitFor();
  await pickRating(page, dialogOf(page), 'Add Rating', 'B1005', 'B1005');
  await dialogOf(page).getByText(/MUSA/).first().waitFor();
  await press(page, 'Cancel');
  await main(page).getByRole('button', { name: 'Add Rating' }).click();
  await dialogOf(page).waitFor();
  await pickRating(page, dialogOf(page), 'Add Rating', 'B1011', 'B1011');
  await dialogOf(page).getByText(/OGBU/).first().waitFor();
  await chooseIn(page, 'proposalId', 'DIS-');
  await press(page, 'Add Rating');
  check(/added/i.test(await toastText(page, /added/i)), 'Add Rating: a current rating is found with the rating search and added');
  await settle(page);
  check((await one(db, "SELECT COUNT(*) AS n FROM discharge_rows WHERE service_number = 'B1011' AND status = 'pending'")).n === 1, 'Add Rating: the row is pending');
  await main(page).getByRole('button', { name: 'Add Rating' }).click();
  await dialogOf(page).waitFor();
  await pickRating(page, dialogOf(page), 'Add Rating', 'B1011', 'B1011');
  await page.waitForFunction(() => /already in proposal/.test(document.querySelector('#overlay-root [role="dialog"]:last-of-type')?.innerText || ''));
  check(/already in proposal/.test(await dialogOf(page).innerText()) && await dialogOf(page).getByRole('button', { name: 'Add Rating', exact: true }).isDisabled(), 'Add Rating: a rating already in a proposal is refused, with the proposal named');
  await closeAll(page);
  await main(page).locator('.custom-dropdown-wrapper[name="proposalId"] input:not(.custom-dropdown-hidden)').first().click();
  await page.locator('.custom-dropdown-list:visible .custom-dropdown-item', { hasText: /DIS-\d{4}-0002/ }).first().click();
  await settle(page);
  await openRow(page, false, 'B1011');
  await press(page, 'Process');
  await dialogOf(page).locator('[name="exitReason"]').waitFor();
  await chooseIn(page, 'exitTypeId', 'DISCHARGED');
  await fillIn(page, 'exitReason', 'Discharged on completion of engagement');
  await chooseIn(page, 'status', 'Closed');
  await press(page, 'Save');
  check(/A closed discharge needs the exit date/.test(await errorText(page, 'exitDate')), 'Process: Closed without an exit date is refused');
  await fillIn(page, 'exitDate', '01/01/2000');
  await press(page, 'Save');
  check(/before the date enlisted/.test(await errorText(page, 'exitDate')), 'Process: an exit date before the date enlisted is refused');
  await fillIn(page, 'exitDate', ddmmyyyy(today));
  await press(page, 'Save');
  check(/moves to Former Ratings now/.test(await dialogOf(page).innerText()), 'Process: Closed with today as the exit date says the rating becomes Former now');
  await press(page, 'Close Discharge');
  check(/closed/i.test(await toastText(page, /closed/i)), 'Process: closed');
  const maker = await one(db, "SELECT r.status, r.exit_date, r.exit_reason, e.name AS exit_type, u.is_active FROM ratings r JOIN ref_exit_type e ON e.id = r.exit_type_id JOIN users u ON u.service_number = r.service_number WHERE r.service_number = 'B1011'");
  check(maker.status === 'former' && maker.exit_date === isoOf(today) && maker.exit_type === 'DISCHARGED' && maker.exit_reason === 'Discharged on completion of engagement', 'Closing: the rating is Former with its exit type, date and reason', JSON.stringify(maker));
  check((await one(db, "SELECT COUNT(*) AS n FROM rating_drafting WHERE service_number = 'B1011' AND end_date IS NULL")).n === 0, 'Closing: its open posting ended');
  check(Number(maker.is_active) === 0, 'Closing: its user account is deactivated');
  check((await one(db, "SELECT COUNT(*) AS n FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE u.username = 'B1011' AND s.ended_at IS NULL")).n === 0, 'Closing: its sessions ended');
  check((await api(makerSession.page, 'GET', '/api/auth/me')).status === 401, 'Closing: the signed-in rating is refused at its next request (401)');
  await makerSession.context.close();
  const relogin = await page.evaluate(async () => (await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'B1011', password: 'Admin@123' }) })).status);
  check(relogin === 403 || relogin === 401, 'Closing: and cannot sign in again', String(relogin));
  const accountApi = await api(page, 'GET', '/api/users?q=B1011');
  check(accountApi.status === 200 && /Inactive|"isActive":false/.test(JSON.stringify(accountApi.body)), 'Closing: Manage Users shows the account as inactive');

  // the rating is in Former Ratings
  await go(page, 'ratings/former');
  await main(page).getByRole('searchbox').first().fill('B1011');
  await page.waitForFunction(() => document.querySelectorAll('#app-main table tbody tr[tabindex]').length === 1);
  check(/B1011/.test((await rowTexts(page, false))[0]), 'Former Ratings: the discharged rating is listed');
  await go(page, 'ratings/current');
  await main(page).getByRole('searchbox').first().fill('B1011');
  await settle(page);
  await page.waitForTimeout(600);
  check((await rowsOf(page, false).count()) === 0, 'Current Ratings: and no longer listed');

  // ---- 5. A pending disciplinary case warns and blocks nothing
  await go(page, 'discharge/process');
  await tab(page, 'proposals');
  await settle(page);
  await openRow(page, false, 'B0640');
  check(/pending disciplinary case/.test(await dialogOf(page).innerText()), 'Process: a pending case warns in the rating\'s dialog');
  await press(page, 'Process');
  await dialogOf(page).locator('[name="exitReason"]').waitFor();
  check(/pending disciplinary case/.test(await dialogOf(page).innerText()), 'Process: and in the form');
  await chooseIn(page, 'exitTypeId', 'DISMISSED');
  await fillIn(page, 'exitReason', 'Dismissed after a court martial');
  await fillIn(page, 'exitDate', ddmmyyyy(dayFrom(-1)));
  await chooseIn(page, 'status', 'Closed');
  await press(page, 'Save');
  await press(page, 'Close Discharge');
  check(/closed/i.test(await toastText(page, /closed/i)), 'Process: the discharge closes (nothing blocks)');
  check((await one(db, "SELECT status FROM ratings WHERE service_number = 'B0640'")).status === 'former' && (await one(db, "SELECT COUNT(*) AS n FROM discipline_cases WHERE service_number = 'B0640' AND status = 'pending'")).n === 1, 'Process: the rating is Former and its case stays pending, as decided');

  // ---- 6. Re-engage: the rating stays current, and it is not a discharge
  await openRow(page, false, 'B1004');
  await press(page, 'Re-engage');
  await dialogOf(page).locator('[name="periodMonths"]').waitFor();
  await press(page, 'Re-engage');
  check(/real date/.test(await errorText(page, 'reengageDate')) && /1 to 120/.test(await errorText(page, 'periodMonths')) && /approved/.test(await errorText(page, 'approvedBy')), 'Re-engage: an empty form shows its errors');
  await fillIn(page, 'reengageDate', ddmmyyyy(dayFrom(-3)));
  await fillIn(page, 'periodMonths', '24');
  await fillIn(page, 'approvedBy', 'Chief of Naval Staff');
  await press(page, 'Re-engage');
  check(/re-engaged for 24 months/.test(await toastText(page, /re-engaged/)), 'Re-engage: recorded');
  const reeng = await one(db, "SELECT x.until_date, r.status, r.exit_type_id FROM discharge_reengagements x JOIN ratings r ON r.service_number = x.service_number WHERE x.service_number = 'B1004'");
  check(reeng.status === 'current' && reeng.exit_type_id === null, 'Re-engage: the rating stays current, with no exit type');
  check(reeng.until_date === isoOf(new Date(dayFrom(-3).getFullYear(), dayFrom(-3).getMonth() + 24, dayFrom(-3).getDate())), 'Re-engage: ends after the period', reeng.until_date);
  check((await one(db, "SELECT COUNT(*) AS n FROM discharge_rows WHERE service_number = 'B1004'")).n === 0, 'Re-engage: not a discharge: the row leaves the proposal');
  check((await api(page, 'GET', '/api/discharge/due?q=B1004')).body.data.items.length === 0, 'Re-engage: not due while it runs');

  // ---- 7. Remove
  await openRow(page, false, 'B1003');
  await press(page, 'Remove');
  check(/remain current/.test(await dialogOf(page).innerText()), 'Remove: asks first');
  await press(page, 'Remove Rating');
  check(/Removed/.test(await toastText(page, /Removed/)), 'Remove: the rating leaves the proposal');
  check((await one(db, "SELECT COUNT(*) AS n FROM discharge_rows WHERE service_number = 'B1003'")).n === 0 && (await one(db, "SELECT status FROM ratings WHERE service_number = 'B1003'")).status === 'current', 'Remove: and stays current');

  // ---- 8. a seeded discharge for a later date, taking effect on its date
  await openRow(page, false, 'B1002');
  await press(page, 'Process');
  await dialogOf(page).locator('[name="exitReason"]').waitFor();
  await chooseIn(page, 'status', 'Closed');
  await press(page, 'Save');
  await press(page, 'Close Discharge');
  await toastText(page, /closed/i);
  const s2 = await one(db, "SELECT effective_date FROM scheduled_changes WHERE service_number = 'B1002' AND kind = 'discharge' AND status = 'scheduled'");
  check(!!s2, 'Scheduled: a seeded pending discharge is scheduled for its exit date');
  const exitB1031 = (await one(db, "SELECT exit_date AS d FROM discharge_rows WHERE service_number = 'B1031'")).d;
  await scheduleLater(db, 'B1031', 'posting', isoOf(dayFrom(5)));
  await scheduleLater(db, 'B1031', 'advancement', isoOf(dayFrom(35)));
  require('../../src/modules/discharge/discharge.service');
  const scheduledWorker = require('../../src/shared/scheduled');
  const before = await scheduledWorker.applyDue({ today: isoOf(dayFrom(1)) });
  check(before.applied === 0 || (await one(db, "SELECT status FROM ratings WHERE service_number = 'B1002'")).status === 'current', 'Scheduled: nothing takes effect before its date');
  const run = await scheduledWorker.applyDue({ today: isoOf(dayFrom(40)) });
  check(run.applied >= 3 && run.failed === 0, 'Scheduled: on their dates the scheduled discharges take effect', JSON.stringify(run));
  const later = await all(db, "SELECT service_number, status FROM ratings WHERE service_number IN ('B1002', 'B1006', 'B1031')");
  check(later.every((r) => r.status === 'former'), 'Scheduled: the ratings are Former', JSON.stringify(later));
  const lateRows = await all(db, "SELECT status FROM discharge_rows WHERE service_number IN ('B1002', 'B1006', 'B1031')");
  check(lateRows.every((r) => r.status === 'closed'), 'Scheduled: and their discharge rows are closed');
  check((await one(db, "SELECT COUNT(*) AS n FROM audit_trail WHERE username = 'SYSTEM' AND table_name = 'ratings' AND record_id = 'B1002'")).n === 1, 'Scheduled: the exit is in the audit trail, by SYSTEM');
  await go(page, 'discharge/service');
  await go(page, 'discharge/process');
  const afterText = await main(page).innerText();
  check(/\d+ ratings? (are|is) due/.test(afterText), 'Process: the page still draws after the exits', afterText.replace(/\s+/g, ' ').slice(0, 200));

  // ---- 9. Print Service Details
  await go(page, 'discharge/service');
  await pickRating(page, main(page), 'Official No or Name', 'B1021', 'B1021');
  await main(page).getByText('Former', { exact: true }).waitFor();
  const svc = await main(page).innerText();
  check(/AKINWALE/.test(svc) && /Date of Birth\s*26\/01\/1972/.test(svc) && /Left /.test(svc), 'Print Service Details: a former rating is found, with its details as label and value rows');
  await shot(page, 'desktop-light-service');
  await main(page).getByRole('button', { name: 'Print Service Details' }).click();
  await previewOpens(page, 'Personnel Details');
  await shot(page, 'desktop-light-service-pdf');
  await closeAll(page);
  await main(page).getByRole('button', { name: 'Reset' }).click();
  check(/Find a Rating/.test(await main(page).innerText()), 'Print Service Details: Reset clears the search');
  await pickRating(page, main(page), 'Official No or Name', 'B0539', 'B0539');
  await main(page).getByText('Current', { exact: true }).waitFor();
  check(true, 'Print Service Details: a current rating is found too');

  // ---- 10. Verification Forms: off with the reason when the source is missing
  await go(page, 'discharge/forms');
  await pickRating(page, main(page), 'Official No or Name', 'B1041', 'B1041');
  await main(page).getByRole('button', { name: 'Preview' }).first().waitFor();
  const forms = main(page).locator('section', { has: page.locator('h3') });
  const formsText = await main(page).innerText();
  check(/This rating has no discharge on file/.test(formsText), 'Verification Forms: the Retirement Routine is off, with its reason');
  check(await main(page).getByRole('button', { name: 'Preview' }).nth(1).isDisabled() && await main(page).getByRole('button', { name: 'Preview' }).nth(0).isEnabled() && await main(page).getByRole('button', { name: 'Preview' }).nth(2).isEnabled(), 'Verification Forms: a re-engaged rating can print the Re-engagement Verification and the Engagement Form');
  await shot(page, 'desktop-light-forms');
  void forms;
  await main(page).getByRole('button', { name: 'Preview' }).nth(0).click();
  await previewOpens(page, 'Re-engagement Verification');
  await closeAll(page);
  await main(page).getByRole('button', { name: 'Preview' }).nth(2).click();
  await previewOpens(page, 'Engagement Form');
  await closeAll(page);
  await pickRating(page, main(page), 'Official No or Name', 'B1021', 'B1021');
  await page.waitForFunction(() => /No re-engagement is recorded/.test(document.querySelector('#app-main').innerText));
  check(await main(page).getByRole('button', { name: 'Preview' }).nth(0).isDisabled(), 'Verification Forms: no re-engagement, no Re-engagement Verification');
  await main(page).getByRole('button', { name: 'Preview' }).nth(1).click();
  await previewOpens(page, 'Retirement Routine');
  await closeAll(page);

  // ---- 11. Upload Discharge: every state
  await go(page, 'discharge/upload');
  check(/Choose a workbook to see what will be imported/.test(await main(page).innerText()), 'Upload: before a file, step 3 waits for one');
  await shot(page, 'desktop-light-upload');
  const dl = page.waitForEvent('download');
  await main(page).getByRole('button', { name: 'Download Template' }).click();
  const template = await dl;
  const tpath = path.join(os.tmpdir(), `discharge-template-${process.pid}.xlsx`);
  await template.saveAs(tpath);
  const twb = new ExcelJS.Workbook();
  await twb.xlsx.readFile(tpath);
  const headings = twb.worksheets[0].getRow(1).values.slice(1);
  check(JSON.stringify(headings) === JSON.stringify(['Official No', 'Exit Type', 'Exit Date', 'Authority', 'Approved By', 'Comment']), 'Upload: the template has the six columns, keyed by Official No', JSON.stringify(headings));
  fs.rmSync(tpath, { force: true });
  const send = (name, bytes) => main(page).locator('input[type="file"]').setInputFiles({ name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: bytes });
  await send('notes.xlsx', Buffer.from('this is not a workbook'));
  await main(page).locator('[data-upload-refused]').waitFor();
  check(/was not read/.test(await main(page).locator('[data-upload-refused]').innerText()), 'Upload: a file that is not a workbook is refused, with the reason');
  await send('wrong.xlsx', await workbook([['B0711', 'RETIRED']], ['Official No', 'Exit Type']));
  await page.waitForFunction(() => /Column .* was not found/.test(document.querySelector('[data-upload-refused]')?.innerText || ''));
  check(true, 'Upload: a workbook without the columns is refused');
  const rows = [];
  const dateOf = (n) => isoOf(dayFrom(n));
  ['B0711', 'B0713', 'B0714', 'B0715', 'B0716', 'B0717', 'B0718', 'B0719', 'B0720', 'B0721', 'B0722', 'B0723', 'B0724', 'B0725', 'B0726', 'B0727', 'B0728', 'B0701', 'B0702', 'B0703', 'B0704'].forEach((sn, i) => {
    rows.push([sn, i % 3 === 0 ? 'RETIRED' : i % 3 === 1 ? 'VOLUNTARY DISCHARGE' : 'DS', dateOf(-5 - i), 'NHQ/NP/DIS/001', 'Chief of Naval Staff', `Upload row ${i + 1}`]);
  });
  rows.push(['B0729', 'RETIRED', dateOf(30), 'NHQ/NP/DIS/002', 'Chief of Naval Staff', 'A later date: scheduled']);
  rows.push(['B0730', 'MEDICAL DISCHARGE', ddmmyyyy(dayFrom(45)), 'NHQ/NP/DIS/002', 'Chief of Naval Staff', 'dd/mm/yyyy is read too']);
  rows.push(['B0729', 'RETIRED', dateOf(-2), '', '', 'The same rating twice']);
  rows.push(['B1021', 'RETIRED', dateOf(-2), '', '', 'Already discharged']);
  rows.push(['B1009', 'RETIRED', dateOf(-2), '', '', 'Already in a proposal']);
  rows.push(['B1002', 'RETIRED', dateOf(-2), '', '', 'Left the service already']);
  rows.push(['B9999', 'RETIRED', dateOf(-2), '', '', 'Not on the roll']);
  rows.push(['B0712', 'NO SUCH TYPE', dateOf(-2), '', '', 'Exit type not in the table']);
  rows.push(['B0712', 'Serving (A)', dateOf(-2), '', '', 'Keeps the rating current']);
  rows.push(['B0712', 'RETIRED', 'not a date', '', '', 'Bad date']);
  rows.push(['B0712', 'RETIRED', '2000-01-01', '', '', 'Before the rating joined']);
  rows.push(['', '', '', '', '', 'No official number']);
  const good = await workbook(rows);
  await send('discharges.xlsx', good);
  await main(page).locator('[data-upload-counts]').waitFor();
  const counts = (await main(page).locator('[data-upload-counts]').innerText()).replace(/\s+/g, ' ');
  check(/23 Ready/.test(counts) && /4 Skipped/.test(counts) && /6 Errors/.test(counts), 'Upload: the whole file is read first: ready, skipped and errors', counts);
  const issues = await main(page).locator('[data-upload-issues]').innerText();
  check(/Rows Not Ready/.test(issues) && /B9999/.test(issues) && /not on the roll/.test(issues) && /already in a proposal or has been discharged/.test(issues) && /already left the service/.test(issues) && /more than once/.test(issues) && /not an exit type/.test(issues), 'Upload: every problem row is listed with its row number and reason');
  check((await one(db, "SELECT COUNT(*) AS n FROM discharge_uploads")).n === 0, 'Upload: reviewing changes nothing');
  await shot(page, 'desktop-light-upload-review');
  const issuesDl = page.waitForEvent('download');
  await main(page).getByRole('button', { name: 'Download Error Rows' }).click();
  const issuesFile = await issuesDl;
  check(/Discharge Rows Not Ready/.test(issuesFile.suggestedFilename()), 'Upload: the problem rows download');
  await main(page).locator('[data-upload-issues] tbody tr[tabindex]').first().click();
  await dialogOf(page).waitFor();
  check(/Problem/.test(await dialogOf(page).innerText()), 'Upload: a problem row opens in a dialog');
  await closeAll(page);
  await scheduleLater(db, 'B0728', 'posting', dateOf(15));
  await scheduleLater(db, 'B0728', 'advancement', dateOf(-60));
  await main(page).getByRole('button', { name: /Import 23 Discharges/ }).click();
  check(/final/.test(await dialogOf(page).innerText()) && /scheduled/.test(await dialogOf(page).innerText()), 'Upload: Import asks first and says closed is final');
  await shot(page, 'desktop-light-upload-confirm');
  await press(page, 'Import 23');
  check(/23 discharges imported/.test(await toastText(page, /imported/)), 'Upload: imported');
  const done = await main(page).locator('[data-upload-done]').innerText();
  check(/in proposal DIS-\d{4}-0004/.test(done) && /21 closed and 2 scheduled/.test(done), 'Upload: the result names the one proposal and the closed and scheduled counts', done.replace(/\s+/g, ' '));
  const up = await one(db, "SELECT COUNT(DISTINCT proposal_id) AS proposals, COUNT(*) AS n FROM discharge_uploads");
  check(Number(up.proposals) === 1 && up.n === 23, 'Upload: all in one proposal, one upload row each', JSON.stringify(up));
  const former = await all(db, "SELECT service_number, status FROM ratings WHERE service_number IN ('B0711', 'B0728', 'B0729', 'B0730')");
  check(former.filter((r) => r.status === 'former').length === 2 && former.filter((r) => r.status === 'current').length === 2, 'Upload: a past date makes the rating Former, a later date leaves it current', JSON.stringify(former));
  check((await one(db, "SELECT COUNT(*) AS n FROM scheduled_changes WHERE kind = 'discharge' AND service_number IN ('B0729', 'B0730') AND status = 'scheduled'")).n === 2, 'Upload: the later dates are scheduled');
  const upLate = await stateOf(db, 'B0728', 'posting', dateOf(15));
  const upEarly = await stateOf(db, 'B0728', 'advancement', dateOf(-60));
  check(upLate.status === 'cancelled' && upEarly.status === 'scheduled', 'Upload: a leaver\'s later scheduled change is cancelled, an earlier one stays', JSON.stringify({ upLate, upEarly }));
  check((await one(db, "SELECT COUNT(*) AS n FROM discharge_rows WHERE service_number = 'B0712'")).n === 0, 'Upload: a rating with only problem rows is left alone');
  await send('again.xlsx', good);
  await page.waitForFunction(() => /0\s*Ready/.test(document.querySelector('[data-upload-counts]')?.innerText || ''));
  check(await main(page).getByRole('button', { name: /Import 0/ }).isDisabled(), 'Upload: the same file again has nothing ready, and Import is off');
  await shot(page, 'desktop-light-upload-again');

  // ---- 12. Discharge Report
  await go(page, 'discharge/report');
  const figures = (await main(page).locator('[data-figures]').innerText()).replace(/\s+/g, ' ');
  const [[{ n: closedN }]] = await db.query("SELECT COUNT(*) AS n FROM discharge_rows WHERE status = 'closed'");
  const [[{ n: schedN }]] = await db.query("SELECT COUNT(*) AS n FROM discharge_rows WHERE status = 'scheduled'");
  const [[{ n: reN }]] = await db.query('SELECT COUNT(*) AS n FROM discharge_reengagements');
  check(new RegExp(`DISCHARGES\\s*${closedN}`, 'i').test(figures) && new RegExp(`SCHEDULED\\s*${schedN}`, 'i').test(figures) && new RegExp(`RE-ENGAGEMENTS\\s*${reN}`, 'i').test(figures), 'Report: the three figures match the records', `${figures} vs ${closedN}/${schedN}/${reN}`);
  const firstPage = await rowTexts(page, false);
  check(firstPage.length === 25, 'Report: 25 a page from the server', String(firstPage.length));
  check(/Scheduled/.test(firstPage.join(' ')), 'Report: a later exit date is marked Scheduled');
  await main(page).locator('.pager button, [data-pager] button').last().click().catch(() => {});
  await shot(page, 'desktop-light-report');
  await choose(page, main(page), 'exitTypeId', 'Re-engagement');
  await page.waitForFunction((n) => document.querySelectorAll('#app-main table tbody tr[tabindex]').length === n, reN);
  check((await rowTexts(page, false)).every((t) => /Re-engagement/.test(t)), 'Report: the Re-engagement filter lists only re-engagements');
  await choose(page, main(page), 'exitTypeId', 'All Types');
  await main(page).getByRole('textbox', { name: 'Exit From' }).fill('31/02/2026');
  await main(page).getByRole('textbox', { name: 'Exit From' }).press('Tab');
  await page.getByText(/is not a date/).waitFor();
  check(await main(page).getByRole('button', { name: 'Print PDF' }).isEnabled(), 'Report: a bad date is reported above the list');
  await main(page).getByRole('textbox', { name: 'Exit From' }).fill(ddmmyyyy(dayFrom(-120)));
  await main(page).getByRole('textbox', { name: 'Exit From' }).press('Tab');
  await main(page).getByRole('textbox', { name: 'Exit To' }).fill(ddmmyyyy(dayFrom(-60)));
  await main(page).getByRole('textbox', { name: 'Exit To' }).press('Tab');
  await settle(page);
  await page.waitForTimeout(500);
  const narrowed = await rowTexts(page, false);
  check(narrowed.length > 0 && narrowed.length < firstPage.length + 10, 'Report: the date filters narrow the list');
  await main(page).getByRole('textbox', { name: 'Exit From' }).fill('');
  await main(page).getByRole('textbox', { name: 'Exit From' }).press('Tab');
  await main(page).getByRole('textbox', { name: 'Exit To' }).fill('');
  await main(page).getByRole('textbox', { name: 'Exit To' }).press('Tab');
  await settle(page);
  await page.waitForTimeout(500);
  await choose(page, main(page), 'exitTypeId', 'DECEASED');
  await page.waitForFunction(() => document.querySelectorAll('#app-main table tbody tr[tabindex]').length === 1);
  await openRow(page, false, 'B1024');
  const rd = await dialogOf(page).innerText();
  check(/Death Certificate/.test(rd) && /Condolence Letter/.test(rd) && /Retirement Routine/.test(rd) && /Open Record/.test(rd), 'Report: a row opens the discharge with its death documents and its form');
  await shot(page, 'desktop-light-report-dialog');
  await press(page, 'Retirement Routine');
  await previewOpens(page, 'Retirement Routine from the report');
  await closeAll(page);
  await choose(page, main(page), 'exitTypeId', 'All Types');
  await settle(page);
  await main(page).getByRole('button', { name: 'Print PDF' }).click();
  const reportPages = await previewOpens(page, 'Discharge Report');
  check(reportPages >= 2, 'Discharge Report: the printout has a page 2', String(reportPages));
  await dialogOf(page).locator('canvas[data-pdf-page]').nth(1).scrollIntoViewIfNeeded();
  await shot(page, 'desktop-light-report-pdf');
  await closeAll(page);
  const xl = page.waitForEvent('download');
  await main(page).getByRole('button', { name: 'Export Excel' }).click();
  const xlFile = await xl;
  const xpath = path.join(os.tmpdir(), `discharge-report-${process.pid}.xlsx`);
  await xlFile.saveAs(xpath);
  const xwb = new ExcelJS.Workbook();
  await xwb.xlsx.readFile(xpath);
  fs.rmSync(xpath, { force: true });
  check(xwb.worksheets[0].rowCount === 4 + closedN + schedN + reN, 'Export Excel: one row for every record in the report', `${xwb.worksheets[0].rowCount}`);

  check(errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// The rules and privileges through the API, and the audit trail
// ---------------------------------------------------------------------------
async function rulesAndRules(browser, db) {
  console.log('\nThe rules, the privileges and the audit trail');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);
  const options = (await api(page, 'GET', '/api/discharge/options')).body.data;
  const id = (name) => options.exitTypes.find((x) => x.name === name).id;
  const retired = id('RETIRED');
  const keeper = options.exitTypes.find((x) => x.keepsCurrent);
  const audited = async (label, call) => {
    const [[{ n: a }]] = await db.query('SELECT COUNT(*) AS n FROM audit_trail');
    const r = await call();
    const [[{ n: b }]] = await db.query('SELECT COUNT(*) AS n FROM audit_trail');
    check(r.status < 300 && b > a, `${label}: written and audited`, `${r.status} ${JSON.stringify(r.body).slice(0, 120)} audit ${a}->${b}`);
    return r;
  };

  // the due rule is read from the settings
  check(options.rule['discharge.age_due'] === 50 && options.rule['discharge.service_due'] === 20, 'Due rule: the placeholder is 50 years of age or 20 of service, from the settings');
  await db.query("UPDATE settings SET value = '58' WHERE setting_key = 'discharge.age_due'");
  await db.query("UPDATE settings SET value = '40' WHERE setting_key = 'discharge.service_due'");
  const narrow = (await api(page, 'GET', '/api/discharge/due')).body.data.items.map((x) => x.serviceNumber);
  await db.query("UPDATE settings SET value = '50' WHERE setting_key = 'discharge.age_due'");
  await db.query("UPDATE settings SET value = '20' WHERE setting_key = 'discharge.service_due'");
  check(narrow.length > 0 && narrow.length < 8 && narrow.includes('B1003'), 'Due rule: changing the settings changes who is due, with no code change', narrow.join(','));
  await db.query("UPDATE settings SET value = '10' WHERE setting_key = 'discharge.age_band_1'");
  const banded = (await api(page, 'GET', '/api/discharge/due?q=B1007')).body.data.items[0];
  await db.query("UPDATE settings SET value = '50' WHERE setting_key = 'discharge.age_band_1'");
  check(banded && banded.ageBand === 'success', 'Due rule: the pill bands come from the settings too');

  // proposals and the refusals
  const empty = await api(page, 'POST', '/api/discharge/proposals', { serviceNumbers: [] });
  check(empty.status === 422, 'Proposal: no ratings is refused (422)');
  const [[{ n: pBefore }]] = await db.query('SELECT COUNT(*) AS n FROM discharge_proposals');
  const gone = await api(page, 'POST', '/api/discharge/proposals', { serviceNumbers: ['B1021', 'B1011', 'B9999'] });
  const [[{ n: pAfter }]] = await db.query('SELECT COUNT(*) AS n FROM discharge_proposals');
  check(gone.status === 422 && pBefore === pAfter, 'Proposal: former, discharged and unknown ratings make no empty proposal (422)');
  const made = await audited('Proposal', () => api(page, 'POST', '/api/discharge/proposals', { serviceNumbers: ['B1007', 'B1008'] }));
  const pid = made.body.data.id;
  const rowUrl = (sn) => `/api/discharge/proposals/${pid}/ratings/${sn}`;
  const dup = await api(page, 'POST', `/api/discharge/proposals/${pid}/ratings`, { serviceNumber: 'B1007' });
  check(dup.status === 409, 'Add Rating: a rating already in a proposal is refused (409)');
  const former = await api(page, 'POST', `/api/discharge/proposals/${pid}/ratings`, { serviceNumber: 'B1021' });
  check(former.status === 422, 'Add Rating: a former rating is refused (422)');
  const bad = await api(page, 'PUT', rowUrl('B1007'), { exitTypeId: keeper.id, exitReason: 'Serving', status: 'pending' });
  check(bad.status === 422 && bad.body.error.fields.exitTypeId, 'Process: an exit type that keeps a rating current is refused (422)');
  const nodate = await api(page, 'PUT', rowUrl('B1007'), { exitTypeId: retired, exitReason: 'Retired', status: 'closed' });
  check(nodate.status === 422 && nodate.body.error.fields.exitDate, 'Process: Closed needs the exit date (422)');
  const long = await api(page, 'PUT', rowUrl('B1007'), { exitTypeId: retired, exitReason: 'x'.repeat(101), status: 'pending' });
  check(long.status === 422 && long.body.error.fields.exitReason, 'Process: a reason over 100 characters is refused (422)');
  const early = await api(page, 'PUT', rowUrl('B1007'), { exitTypeId: retired, exitReason: 'Retired', exitDate: '1980-01-01', status: 'pending' });
  check(early.status === 422 && early.body.error.fields.exitDate, 'Process: an exit date before the date enlisted is refused (422)');
  const status = await api(page, 'PUT', rowUrl('B1007'), { exitTypeId: retired, exitReason: 'Retired', exitDate: isoOf(dayFrom(-1)), status: 'maybe' });
  check(status.status === 422 && status.body.error.fields.status, 'Process: a status other than Pending or Closed is refused (422)');
  const notThere = await api(page, 'PUT', rowUrl('B0701'), { exitTypeId: retired, exitReason: 'Retired', status: 'pending' });
  check(notThere.status === 404, 'Process: a rating not in the proposal is 404');
  await audited('Process (Pending, a non-death type)', () => api(page, 'PUT', rowUrl('B1007'), { exitTypeId: retired, exitReason: 'Retired', exitDate: isoOf(dayFrom(-1)), status: 'pending', deathCertificate: true, condolenceLetter: true }));
  const docs = await one(db, "SELECT death_certificate AS a, condolence_letter AS b FROM discharge_rows WHERE service_number = 'B1007'");
  check(docs.a === 0 && docs.b === 0, 'Process: the death documents are recorded only for a Death exit type');
  await audited('Process (Closed, a Death type, with documents)', () => api(page, 'PUT', rowUrl('B1007'), { exitTypeId: id('DECEASED'), exitReason: 'Died in service', exitDate: isoOf(dayFrom(-1)), status: 'closed', deathCertificate: true, sworn_affidavit: true, swornAffidavit: true }));
  const death = await one(db, "SELECT death_certificate AS a, sworn_affidavit AS b, condolence_letter AS c FROM discharge_rows WHERE service_number = 'B1007'");
  check(death.a === 1 && death.b === 1 && death.c === 0, 'Process: a Death exit type records the documents that were ticked');
  const again = await api(page, 'PUT', rowUrl('B1007'), { exitTypeId: retired, exitReason: 'Retired', exitDate: isoOf(dayFrom(-1)), status: 'closed' });
  check(again.status === 409, 'Process: a closed discharge is final (409)');
  const rm = await api(page, 'DELETE', rowUrl('B1007'));
  check(rm.status === 409, 'Remove: a closed discharge cannot be removed (409)');
  const reClosed = await api(page, 'POST', `${rowUrl('B1007')}/reengage`, { reengageDate: isoOf(dayFrom(-1)), periodMonths: 12, approvedBy: 'CNS' });
  check(reClosed.status === 409, 'Re-engage: only a pending discharge can be re-engaged (409)');
  const badRe = await api(page, 'POST', `${rowUrl('B1008')}/reengage`, { reengageDate: '1980-01-01', periodMonths: 500, approvedBy: '' });
  check(badRe.status === 422 && badRe.body.error.fields.periodMonths && badRe.body.error.fields.approvedBy && badRe.body.error.fields.reengageDate, 'Re-engage: a date before enlisting, a period over 120 and no approver are refused (422)');
  const months = await audited('Re-engage', () => api(page, 'POST', `${rowUrl('B1008')}/reengage`, { reengageDate: '2026-01-31', periodMonths: 1, approvedBy: 'CNS' }));
  check(months.body.data.untilDate === '2026-02-28', 'Re-engage: 31 January and one month ends on 28 February', months.body.data.untilDate);
  check((await one(db, "SELECT status FROM ratings WHERE service_number = 'B1008'")).status === 'current', 'Re-engage: the rating stays current');

  // a leaver's scheduled moves are cancelled, in the same transaction, from the exit date on
  const leaver = await audited('Proposal for a leaver', () => api(page, 'POST', '/api/discharge/proposals', { serviceNumbers: ['B1012'] }));
  const today = isoOf(new Date());
  await scheduleLater(db, 'B1012', 'posting', isoOf(dayFrom(20)));
  await scheduleLater(db, 'B1012', 'advancement', isoOf(dayFrom(30)));
  await scheduleLater(db, 'B1012', 'posting', isoOf(dayFrom(-2)));
  await scheduleLater(db, 'B1012', 'advancement', today);
  await audited('Closing a leaver', () => api(page, 'PUT', `/api/discharge/proposals/${leaver.body.data.id}/ratings/B1012`, { exitTypeId: retired, exitReason: 'Retired', exitDate: today, status: 'closed' }));
  const cancelled = await all(db, "SELECT kind, effective_date, status, outcome FROM scheduled_changes WHERE service_number = 'B1012' ORDER BY effective_date");
  check(cancelled.length === 4 && cancelled[0].status === 'scheduled' && cancelled.slice(1).every((c) => c.status === 'cancelled' && /left the service/.test(c.outcome)), 'Leaver: every scheduled change dated on or after the exit date is cancelled (postings and advancements); an earlier one still applies', JSON.stringify(cancelled));
  check((await one(db, "SELECT COUNT(*) AS n FROM audit_trail WHERE table_name = 'scheduled_changes' AND action = 'UPDATE' AND record_id LIKE 'B1012:%'")).n === 3, 'Leaver: each cancellation is in the audit trail');

  // the printouts and their sources
  check((await api(page, 'GET', '/api/discharge/verification/B0701/reengagement/pdf')).status === 409, 'Verification: no re-engagement, no Re-engagement Verification (409)');
  check((await api(page, 'GET', '/api/discharge/verification/B0705/retirement/pdf')).status === 409, 'Verification: no discharge, no Retirement Routine (409)');
  check((await api(page, 'GET', '/api/discharge/verification/B0705/nonsense/pdf')).status === 404, 'Verification: an unknown form is 404');
  check((await api(page, 'GET', '/api/discharge/verification/B9999')).status === 404 && (await api(page, 'GET', '/api/discharge/service-details/B9999')).status === 404, 'Verification and Service Details: an unknown rating is 404');
  for (const [kind, sn] of [['reengagement', 'B1008'], ['retirement', 'B1007'], ['engagement', 'B0705']]) {
    const f = await fileHead(page, `/api/discharge/verification/${sn}/${kind}/pdf`);
    check(f.status === 200 && f.head === '%PDF', `Printout: ${kind} form is a PDF`);
  }
  check((await fileHead(page, '/api/discharge/service-details/B1007/pdf')).head === '%PDF', 'Printout: Personnel Details is a PDF');
  check((await fileHead(page, '/api/discharge/report/pdf?exitTypeId=reengagement')).head === '%PDF' && (await api(page, 'GET', '/api/discharge/report?from=2026-02-01&to=2026-01-01')).status === 422, 'Printout: the Discharge Report is a PDF; a From after To is 422');

  // the upload through the API
  check((await sendFile(page, '/api/discharge/upload/check', 'x.xlsx', Buffer.from('nope'))).status >= 400, 'Upload: a file that is not a workbook is refused');
  check((await sendFile(page, '/api/discharge/upload/check', 'x.txt', Buffer.from('nope'), 'text/plain')).status >= 400, 'Upload: a file that is not .xlsx is refused');
  const empties = await sendFile(page, '/api/discharge/upload/import', 'empty.xlsx', await workbook([]));
  check(empties.status === 200 && empties.body.data.imported === 0, 'Upload: a workbook with no rows imports nothing');

  // the privileges
  await db.query("INSERT INTO roles (name, description, full_access) VALUES ('Discharge Reader (walk-through)', 'May only read the Discharge Report', 0)");
  await db.query("INSERT INTO role_privileges (role_id, privilege_id) SELECT r.id, p.id FROM roles r JOIN privileges p ON (p.screen, p.action) IN (('dashboard.home', 'view'), ('discharge.report', 'view')) WHERE r.name = 'Discharge Reader (walk-through)'");
  const hash = (await one(db, "SELECT password_hash AS h FROM users WHERE username = 'HICO001'")).h;
  await db.query("INSERT INTO users (username, password_hash, role_id, service_number, is_active) VALUES (?, ?, (SELECT id FROM roles WHERE name = 'Discharge Reader (walk-through)'), ?, 1)", [READER.username, hash, READER.username]);
  const reader = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(reader.page, READER);
  const rr = async (m, u, d) => (await api(reader.page, m, u, d)).status;
  check((await rr('GET', '/api/discharge/report')) === 200 && (await rr('GET', '/api/discharge/options')) === 200, 'Reader: may read the report');
  const noRoutes = [['GET', '/api/discharge/due'], ['GET', '/api/discharge/proposals'], ['GET', '/api/discharge/proposals/rows'], ['POST', '/api/discharge/proposals', { serviceNumbers: ['B0701'] }],
    ['GET', '/api/discharge/service-details/B0701'], ['GET', '/api/discharge/verification/B0701'], ['GET', '/api/discharge/upload/template']];
  for (const [m, u, d] of noRoutes) check((await rr(m, u, d)) === 403, `Reader: ${m} ${u} is 403`);
  await reader.context.close();
  const officer = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(officer.page, OFFICER);
  const orr = async (m, u, d) => (await api(officer.page, m, u, d)).status;
  check((await orr('GET', '/api/discharge/due')) === 200 && (await orr('GET', '/api/discharge/report')) === 200 && (await orr('GET', '/api/discharge/upload/template')) === 200, 'Discharge officer: reads every page');
  const own = await api(officer.page, 'POST', '/api/discharge/proposals', { serviceNumbers: ['B1010'] });
  check(own.status === 201, 'Discharge officer: may make a proposal (add)');
  check((await orr('PUT', `/api/discharge/proposals/${own.body.data.id}/ratings/B1010`, { exitTypeId: retired, exitReason: 'Retired', status: 'pending' })) === 200, 'Discharge officer: may process (edit)');
  check((await orr('DELETE', `/api/discharge/proposals/${own.body.data.id}/ratings/B1010`)) === 200, 'Discharge officer: may remove (delete)');
  const officerPage = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(officerPage.page, OFFICER);
  await go(officerPage.page, 'discharge/process');
  check(await main(officerPage.page).getByRole('button', { name: 'Create Proposal' }).count() === 1, 'Discharge officer: sees Create Proposal');
  await go(officerPage.page, 'discharge/upload');
  check(await main(officerPage.page).locator('[data-choose-file]').isEnabled(), 'Discharge officer: may choose a file to upload');
  await officerPage.context.close();
  await officer.context.close();
  const readerScreens = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(readerScreens.page, READER);
  await go(readerScreens.page, 'discharge/report');
  check(await readerScreens.page.locator('#module-tabs a', { hasText: 'Upload Discharge' }).count() === 0 && await readerScreens.page.locator('#module-tabs a', { hasText: 'Process Discharge' }).count() === 0, 'Reader: sees only the Discharge Report tab');
  await readerScreens.context.close();

  const ratingSession = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(ratingSession.page, RATING);
  const every = [['GET', '/api/discharge/options'], ['GET', '/api/discharge/due'], ['GET', '/api/discharge/ratings/B0701/candidate'], ['GET', '/api/discharge/proposals'], ['GET', '/api/discharge/proposals/rows'],
    ['POST', '/api/discharge/proposals', { serviceNumbers: ['B0701'] }], ['GET', `/api/discharge/proposals/${pid}`], ['POST', `/api/discharge/proposals/${pid}/ratings`, { serviceNumber: 'B0701' }],
    ['PUT', `/api/discharge/proposals/${pid}/ratings/B0701`, {}], ['POST', `/api/discharge/proposals/${pid}/ratings/B0701/reengage`, {}], ['DELETE', `/api/discharge/proposals/${pid}/ratings/B0701`],
    ['GET', '/api/discharge/service-details/B0701'], ['GET', '/api/discharge/service-details/B0701/pdf'], ['GET', '/api/discharge/verification/B0701'], ['GET', '/api/discharge/verification/B0701/engagement/pdf'],
    ['GET', '/api/discharge/report'], ['GET', '/api/discharge/report/pdf'], ['GET', '/api/discharge/report/excel'], ['GET', '/api/discharge/upload/template']];
  let refused = 0;
  for (const [m, u, d] of every) if ((await api(ratingSession.page, m, u, d)).status === 403) refused += 1;
  check(refused === every.length, `A rating without the grants: every route is 403 (${refused} of ${every.length})`);
  const upload403 = await sendFile(ratingSession.page, '/api/discharge/upload/check', 'x.xlsx', Buffer.from('x'));
  const import403 = await sendFile(ratingSession.page, '/api/discharge/upload/import', 'x.xlsx', Buffer.from('x'));
  check(upload403.status === 403 && import403.status === 403, 'A rating without the grants: the upload routes are 403');
  await ratingSession.context.close();
  const bare = await fetch(`${BASE}/api/discharge/due`);
  check(bare.status === 401, 'Without a session every route is 401');

  // the audit trail
  const tables = (await all(db, "SELECT DISTINCT table_name AS t FROM audit_trail WHERE table_name IN ('discharge_proposals','discharge_rows','discharge_reengagements','discharge_uploads','scheduled_changes','ratings','users','rating_drafting')")).map((r) => r.t);
  for (const t of ['discharge_proposals', 'discharge_rows', 'discharge_reengagements', 'discharge_uploads', 'scheduled_changes', 'ratings', 'users', 'rating_drafting']) {
    check(tables.includes(t), `Audit trail: ${t} is recorded`);
  }
  const exit = await one(db, "SELECT username, action, changes FROM audit_trail WHERE table_name = 'ratings' AND record_id = 'B1011' ORDER BY id DESC LIMIT 1");
  check(exit && exit.username === 'HICO001' && /former/.test(JSON.stringify(exit.changes)) && /exit_date/.test(JSON.stringify(exit.changes)), 'Audit trail: the exit shows who closed it and what changed (status, exit type, date, reason)');
  const acct = await one(db, "SELECT changes FROM audit_trail WHERE table_name = 'users' AND record_id = 'B1011' AND action = 'UPDATE' ORDER BY id DESC LIMIT 1");
  check(acct && /is_active/.test(JSON.stringify(acct.changes)), 'Audit trail: the deactivated account is recorded');
  const trail = await api(page, 'GET', '/api/audit?table=discharge_rows');
  check(trail.status === 200, 'Audit trail: the Discharge rows are on the Audit Trail screen\'s API');
  const closedAudit = await all(db, "SELECT DISTINCT username FROM audit_trail WHERE table_name = 'discharge_rows'");
  check(closedAudit.some((r) => r.username === 'HICO001') && closedAudit.some((r) => r.username === 'B1000'), 'Audit trail: each writer is named');

  check(errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// Each layout: every page and its main dialog
// ---------------------------------------------------------------------------
async function layoutPass(browser, viewport, theme, upload) {
  const label = `${viewport.width}px ${theme}`;
  console.log(`\nLayout ${label}`);
  const { context, page, errors, phone } = await open(browser, { viewport, theme });
  await signIn(page, ADMIN);
  const plan = [
    ['discharge/process', async () => { await openRow(page, phone, 'B1005'); }],
    ['discharge/process#proposals', async () => { await tab(page, 'proposals'); await settle(page); await openRow(page, phone, 'B1009'); await press(page, 'Process'); await dialogOf(page).locator('[name="exitReason"]').waitFor(); }],
    ['discharge/service', async () => { await pickRating(page, main(page), 'Official No or Name', 'B1021', 'B1021'); await main(page).getByRole('button', { name: 'Print Service Details' }).click(); await previewOpens(page, `${label} Personnel Details`); }],
    ['discharge/forms', async () => { await pickRating(page, main(page), 'Official No or Name', 'B1041', 'B1041'); await main(page).getByRole('button', { name: 'Preview' }).first().click(); await previewOpens(page, `${label} Re-engagement Verification`); }],
    ['discharge/report', async () => { await rowsOf(page, phone).first().click(); }],
    ['discharge/upload', async () => {
      await main(page).locator('input[type="file"]').setInputFiles({ name: 'layout.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: upload });
      await main(page).locator('[data-upload-counts]').waitFor();
      await main(page).getByRole('button', { name: /^Import \d+ Discharge/ }).click();
    }],
  ];
  for (const [route, openMain] of plan) {
    await go(page, route.split('#')[0]);
    if (route.endsWith('#proposals')) { await tab(page, 'proposals'); await settle(page); }
    await noOverflow(page, `${label} ${route}`);
    await shot(page, `${viewport.width}-${theme}-${route.replace(/[/#]/g, '-')}`);
    await openMain();
    await dialogOf(page).waitFor();
    await page.waitForFunction(() => !document.querySelector('#overlay-root')?.textContent.includes('Loading'), null, { timeout: 10000 });
    await page.waitForTimeout(250);
    const fits = await dialogOf(page).evaluate((d) => d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().right <= window.innerWidth + 1);
    check(fits, `${label} ${route}: its dialog fits`);
    const words = `${await main(page).innerText()} ${await dialogOf(page).innerText().catch(() => '')}`;
    check(!/\b(null|undefined|NaN|\[object Object\])\b/.test(words), `${label} ${route}: no null, undefined or NaN on the page or in the dialog`);
    await shot(page, `${viewport.width}-${theme}-${route.replace(/[/#]/g, '-')}-dialog`);
    await closeAll(page);
  }
  for (const [sn, pillText] of [['B0729', /^Leaves \d\d\/\d\d\/\d{4}$/], ['B1041', /^Re-engaged to \d\d\/\d\d\/\d{4}$/]]) {
    await go(page, `ratings/edit/${sn}`);
    await main(page).locator('[data-discharge-pills]').getByText(pillText).waitFor();
    await noOverflow(page, `${label} record ${sn}`);
    await shot(page, `${viewport.width}-${theme}-record-${sn}`);
  }
  check(true, `${label}: the record header shows Leaves and Re-engaged to`);
  if (phone) {
    await go(page, 'discharge/process');
    check(await page.locator('#app-main [data-filters] button', { hasText: 'Filters' }).isVisible(), `${label}: the filters fold into a Filters button`);
    check(await rowsOf(page, true).count() > 0, `${label}: the lists are cards`);
  } else {
    await go(page, 'discharge/process');
    await rowsOf(page, false).first().hover();
    check(await page.locator('[role="tooltip"]', { hasText: 'View Details' }).isVisible(), `${label}: a row shows the View Details tooltip`);
  }
  check(errors.length === 0, `${label}: no browser errors`, errors.join(' | '));
  await context.close();
}

async function main_() {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true });
  const browser = await chromium.launch();
  const state = {};
  try {
    await adminFlow(browser, db, state);
    await rulesAndRules(browser, db);
    const layoutFile = await workbook([['B0801', 'RETIRED', isoOf(dayFrom(-1)), '', '', 'Layout']]);
    for (const vp of [DESKTOP, PHONE]) for (const theme of ['light', 'dark']) await layoutPass(browser, vp, theme, layoutFile);
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
