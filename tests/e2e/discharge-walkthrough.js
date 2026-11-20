#!/usr/bin/env node
'use strict';

/*
 * Walk-through of Discharge Administration (WP5).
 *
 *   npm run migrate:fresh
 *   npm start
 *   NODE_PATH=$(npm root -g) node tests/e2e/discharge-walkthrough.js
 *
 * Runs in under five minutes. It exercises proposal, process, close, scheduled close,
 * re-engagement, removal, printouts, upload checks/import, refusals, audit rows and
 * desktop/phone, light/dark layouts.
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
const RATING = { username: 'B0539', password: 'Rating@123' };
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const STARTED = Date.now();
const LIMIT_SECONDS = 300;
let failures = 0;
let passes = 0;

function check(ok, label, detail = '') {
  if (ok) { passes += 1; console.log(`  ok    ${label}`); }
  else { failures += 1; console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`); }
}

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function open(browser, viewport, theme) {
  const phone = viewport.width < 700;
  const context = await browser.newContext({ viewport, colorScheme: theme, acceptDownloads: true, isMobile: phone, hasTouch: phone });
  const errors = [];
  const expected = new Set([401, 403, 404, 409, 422]);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const status = Number((/status of (\d{3})/.exec(m.text()) || [])[1]);
    if (!expected.has(status)) errors.push(`console: ${m.text()}`);
  });
  return { context, page, errors, phone };
}

async function signIn(page, who) {
  await page.goto(`${BASE}/index.html`);
  await page.fill('#username', who.username);
  await page.fill('#password', who.password);
  await Promise.all([page.waitForURL(/app\.html/), page.click('#login-submit')]);
  await page.waitForSelector('#app-main h1, #app-main h2', { timeout: 15000 });
}

const api = (page, method, url, data) => page.evaluate(async ({ method, url, data }) => {
  const res = await fetch(url, {
    method, credentials: 'include',
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  let body = null;
  try { body = await res.json(); } catch (_) {}
  return { status: res.status, body };
}, { method, url, data });

const fileHead = (page, url) => page.evaluate(async (u) => {
  const res = await fetch(u, { credentials: 'include' });
  const buf = new Uint8Array(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get('content-type'), head: String.fromCharCode(...buf.slice(0, 4)), size: buf.length };
}, url);

async function go(page, route) {
  await page.goto(`${BASE}/app.html#${route}`);
  await page.waitForSelector('#app-main h1', { timeout: 15000 });
}

async function settle(page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForTimeout(100);
}

async function noOverflow(page, label) {
  const v = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth - window.innerWidth,
    main: document.querySelector('#app-main').scrollWidth - document.querySelector('#app-main').clientWidth,
  }));
  check(v.page <= 1 && v.main <= 1, `${label}: nothing scrolls sideways`, JSON.stringify(v));
}

function isoDay(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function adminFlow(browser, db) {
  const s = await open(browser, DESKTOP, 'light');
  await signIn(s.page, ADMIN);

  await go(s.page, 'discharge/process');
  const link = s.page.locator('#rail nav a', { hasText: 'Discharge' }).first();
  check(await link.count() === 1 && !(await link.innerText()).includes('Soon'), 'Discharge has lost its Soon badge');
  for (const label of ['Process Discharge', 'Print Service Details', 'Verification Forms', 'Discharge Report', 'Upload Discharge']) {
    check(await s.page.locator('#module-tabs a', { hasText: label }).count() > 0, `tab: ${label}`);
  }

  await s.page.keyboard.press('Control+K');
  await s.page.keyboard.type('Discharge Report');
  await s.page.locator('#palette-results').getByText('Discharge Report').first().waitFor();
  await Promise.all([s.page.waitForURL(/#discharge\/report$/), s.page.keyboard.press('Enter')]);
  check(true, 'Ctrl K finds the Discharge Report');

  await go(s.page, 'discharge/process');
  const options = await api(s.page, 'GET', '/api/discharge/options');
  check(options.status === 200 && options.body.data.exitTypes.length > 0, 'exit type options load');
  const due = await api(s.page, 'GET', '/api/discharge/due');
  check(due.status === 200, 'due list loads');
  const candidate = await api(s.page, 'GET', '/api/discharge/ratings/B0702/candidate');
  check(candidate.status === 200 && candidate.body.data.canAdd, 'current unproposed rating is eligible to add');

  const proposed = await api(s.page, 'POST', '/api/discharge/proposals', { serviceNumbers: ['B0801'] });
  check(proposed.status === 201 && proposed.body.data.proposalNumber.startsWith('DIS-'), 'proposal is created');
  const proposalId = proposed.body.data.id;

  const retired = options.body.data.exitTypes.find((x) => /retired/i.test(x.name));
  const pending = await api(s.page, 'PUT', `/api/discharge/proposals/${proposalId}/ratings/B0801`, {
    exitTypeId: retired.id, exitDate: isoDay(-1), exitReason: 'Routine retirement', approvedBy: 'CNP', comment: 'Walk-through pending process', status: 'pending',
  });
  check(pending.status === 200 && pending.body.data.status === 'pending', 'row can be processed as pending');

  const closed = await api(s.page, 'PUT', `/api/discharge/proposals/${proposalId}/ratings/B0801`, {
    exitTypeId: retired.id, exitDate: isoDay(-1), exitReason: 'Routine retirement', approvedBy: 'CNP', comment: 'Walk-through close', status: 'closed',
  });
  check(closed.status === 200 && closed.body.data.status === 'closed', 'row closes immediately');

  const [[rating]] = await db.query("SELECT status, exit_reason, exit_type_id FROM ratings WHERE service_number='B0801'");
  const [[account]] = await db.query("SELECT is_active FROM users WHERE service_number='B0801'");
  check(rating.status === 'former' && rating.exit_reason === 'Routine retirement', 'closing makes the rating Former');
  check(Number(account.is_active) === 0, 'closing deactivates the rating account');
  const [[openPostings]] = await db.query("SELECT COUNT(*) AS n FROM rating_drafting WHERE service_number='B0801' AND end_date IS NULL");
  check(openPostings.n === 0, 'closing ends the open posting');
  const [[proposalCountBeforeDuplicate]] = await db.query('SELECT COUNT(*) AS n FROM discharge_proposals');
  const duplicateProposal = await api(s.page, 'POST', '/api/discharge/proposals', { serviceNumbers: ['B0801'] });
  const [[proposalCountAfterDuplicate]] = await db.query('SELECT COUNT(*) AS n FROM discharge_proposals');
  check(duplicateProposal.status === 422 && Number(proposalCountBeforeDuplicate.n) === Number(proposalCountAfterDuplicate.n), 'unavailable ratings do not create empty proposals');

  const scheduledProposal = await api(s.page, 'POST', '/api/discharge/proposals', { serviceNumbers: ['B0701'] });
  check(scheduledProposal.status === 201, 'scheduled close proposal is created');
  const scheduledId = scheduledProposal.body.data.id;
  const scheduled = await api(s.page, 'PUT', `/api/discharge/proposals/${scheduledId}/ratings/B0701`, {
    exitTypeId: retired.id, exitDate: isoDay(7), exitReason: 'Future retirement', approvedBy: 'CNP', comment: 'Scheduled close', status: 'closed',
  });
  check(scheduled.status === 200 && scheduled.body.data.status === 'scheduled', 'future exit is Scheduled');
  require('../../src/modules/discharge/discharge.service');
  const scheduledWorker = require('../../src/shared/scheduled');
  const applied = await scheduledWorker.applyDue({ today: isoDay(7) });
  check(applied.applied >= 1, 'scheduled close takes effect on its date');
  const [[scheduledRating]] = await db.query("SELECT status FROM ratings WHERE service_number='B0701'");
  check(scheduledRating.status === 'former', 'scheduled close changes the rating to Former');

  const reProposal = await api(s.page, 'POST', '/api/discharge/proposals', { serviceNumbers: ['B0702'] });
  const reId = reProposal.body.data.id;
  const proposedCandidate = await api(s.page, 'GET', '/api/discharge/ratings/B0702/candidate');
  check(proposedCandidate.status === 200 && !proposedCandidate.body.data.canAdd && proposedCandidate.body.data.proposalNumber, 'candidate check identifies an existing proposal');
  const re = await api(s.page, 'POST', `/api/discharge/proposals/${reId}/ratings/B0702/reengage`, { reengageDate: isoDay(-1), periodMonths: 12, approvedBy: 'CNP' });
  check(re.status === 200 && re.body.data.periodMonths === 12, 're-engagement is recorded');

  const removeProposal = await api(s.page, 'POST', '/api/discharge/proposals', { serviceNumbers: ['B0703'] });
  const removeId = removeProposal.body.data.id;
  const removed = await api(s.page, 'DELETE', `/api/discharge/proposals/${removeId}/ratings/B0703`);
  check(removed.status === 200, 'pending row can be removed');

  const refuses = await api(s.page, 'PUT', `/api/discharge/proposals/${proposalId}/ratings/B0801`, { exitTypeId: retired.id, status: 'closed' });
  check(refuses.status === 409, 'closed discharge refuses later change');

  for (const route of ['discharge/service', 'discharge/forms', 'discharge/report', 'discharge/upload']) {
    await go(s.page, route);
    await settle(s.page);
    check(await s.page.locator('#app-main h1').count() === 1, `${route}: page renders`);
  }

  await go(s.page, 'discharge/service');
  const reportList = await api(s.page, 'GET', '/api/discharge/report?page=1');
  check(reportList.status === 200 && reportList.body.data.meta.pageSize === 25 && reportList.body.data.items.length <= 25, 'discharge report is server-paged at 25 rows');
  const servicePdf = await fileHead(s.page, '/api/discharge/service-details/B0801/pdf');
  check(servicePdf.status === 200 && servicePdf.head.startsWith('%PDF'), 'service details PDF renders');
  const engagementPdf = await fileHead(s.page, '/api/discharge/verification/B0801/engagement/pdf');
  check(engagementPdf.status === 200 && engagementPdf.head.startsWith('%PDF'), 'engagement form PDF renders');
  const reportPdf = await fileHead(s.page, '/api/discharge/report/pdf');
  check(reportPdf.status === 200 && reportPdf.head.startsWith('%PDF'), 'discharge report PDF renders');
  const reportExcel = await fileHead(s.page, '/api/discharge/report/excel');
  check(reportExcel.status === 200 && reportExcel.type.includes('spreadsheet'), 'discharge report Excel exports');

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Upload Discharge');
  ws.columns = [
    { header: 'Official No' }, { header: 'Exit Type' }, { header: 'Exit Date' },
    { header: 'Authority' }, { header: 'Approved By' }, { header: 'Comment' },
  ];
  ws.addRow(['B0704', retired.name, isoDay(-1), 'CNP', 'CNP', 'Upload test']);
  ws.addRow(['NOT-A-RATING', retired.name, isoDay(-1), 'CNP', 'CNP', 'Invalid row']);
  const temp = path.join(os.tmpdir(), `discharge-walkthrough-${process.pid}.xlsx`);
  await wb.xlsx.writeFile(temp);

  check(fs.existsSync(temp), 'upload workbook is created');

  const template = await fileHead(s.page, '/api/discharge/upload/template');
  check(template.status === 200 && template.type.includes('spreadsheet'), 'upload template downloads');
  await go(s.page, 'discharge/upload');
  await s.page.locator('#app-main input[type="file"]').setInputFiles(temp);
  await s.page.getByRole('button', { name: 'Review Workbook', exact: true }).click();
  await s.page.getByText('NOT-A-RATING').waitFor({ timeout: 15000 });
  const review = await s.page.locator('#app-main').innerText();
  check(review.includes('Ready') && review.includes('Errors') && review.includes('NOT-A-RATING'), 'upload review shows ready and problem rows');
  await s.page.getByRole('button', { name: 'Import Discharges', exact: true }).click();
  await s.page.getByRole('dialog').getByRole('button', { name: 'Import Discharges', exact: true }).click();
  await s.page.getByText('1 discharge(s) imported.').waitFor({ timeout: 15000 });
  const uploaded = await db.query(
    "SELECT d.status, r.status AS rating_status FROM discharge_rows d JOIN ratings r ON r.service_number=d.service_number WHERE d.service_number='B0704' ORDER BY d.id DESC LIMIT 1",
  );
  check(uploaded[0][0].status === 'closed' && uploaded[0][0].rating_status === 'former', 'upload closes past-date discharge and moves rating to Former');

  const audit = await db.query("SELECT COUNT(*) AS n FROM audit_trail WHERE table_name IN ('discharge_proposals','discharge_rows','discharge_reengagements')");
  check(Number(audit[0][0].n) >= 5, 'discharge actions are audited');

  await shot(s.page, 'discharge-process');
  await noOverflow(s.page, 'discharge upload desktop');
  for (const [viewport, theme] of [[DESKTOP, 'dark'], [PHONE, 'light'], [PHONE, 'dark']]) {
    const x = await open(browser, viewport, theme);
    await signIn(x.page, ADMIN);
    for (const route of ['discharge/process', 'discharge/service', 'discharge/forms', 'discharge/report', 'discharge/upload']) {
      await go(x.page, route);
      await settle(x.page);
      await noOverflow(x.page, `${route} ${viewport.width}px ${theme}`);
    }
    check(x.errors.length === 0, `${viewport.width}px ${theme}: no browser errors`, x.errors.join(' | '));
    await x.context.close();
  }

  await fs.promises.rm(temp, { force: true });
  await s.context.close();
}

async function refusalFlow(browser) {
  const s = await open(browser, DESKTOP, 'light');
  await signIn(s.page, RATING);
  const r = await api(s.page, 'GET', '/api/discharge/due');
  check(r.status === 403, 'rating without Discharge grant gets 403');
  await s.context.close();
}

async function main() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const executablePath = process.env.PLAYWRIGHT_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    await adminFlow(browser, db);
    await refusalFlow(browser);
  } finally {
    await browser.close();
    await db.end();
  }
  const elapsed = (Date.now() - STARTED) / 1000;
  console.log(`\nDischarge walkthrough: ${passes} passed, ${failures} failed; ${elapsed.toFixed(1)} seconds`);
  if (elapsed > LIMIT_SECONDS) { failures += 1; console.log(`  FAIL  exceeded ${LIMIT_SECONDS} seconds`); }
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
