#!/usr/bin/env node
'use strict';

/*
 * Walk-through of Training Drafting (WP6). Uses the Playwright installed on the machine (not a
 * project dependency):
 *
 *   npm run migrate:fresh                       # a fresh demo database (the walk-through adds a batch and entries)
 *   npm start                                   # the app on :3000
 *   NODE_PATH=$(npm root -g) node tests/e2e/training-drafting-walkthrough.js
 *
 * BASE changes the address; SHOTS=<dir> saves screenshots there. It reads .env for the database,
 * to check what was written. Exits non-zero when a check fails. Browser errors fail the run.
 *
 * As the Administrator: the options, a batch made with the eligible ratings (its number, a duplicate
 * refused naming the batch, no eligible rating refused, a bad month and year refused), Remove and
 * Add Rating (every refusal with its reason), Attended and a rating's own dates, Confirm Training
 * History (every rule refused, then confirmed: a Training entry with the course, the institution
 * and the result for each rating that attended, none for the one that did not, the batch closed and
 * final), the reports and the Training Draft Report PDF, the Excel upload (template, review, import,
 * and the same file again), and the audit trail. Then the roles (the old Training role, and one that
 * may only view) and each layout (1440 and 390 px, light and dark) draws every page and dialog with
 * nothing overflowing.
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
const TRAINER = { username: 'B0562', password: 'Admin@123' };
const VIEWER = { username: 'B0541', password: 'Admin@123' };
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
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function open(browser, { viewport, theme }) {
  const phone = viewport.width < 700;
  const context = await browser.newContext({ viewport, colorScheme: theme, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone, acceptDownloads: true });
  const errors = [];
  const expected = new Set([401, 403, 404, 409, 422]); // refusals the walk-through provokes on purpose
  const watch = (p) => {
    p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    p.on('console', (m) => {
      if (m.type() !== 'error') return;
      const status = Number((/status of (\d{3})/.exec(m.text()) || [])[1]);
      if (expected.has(status)) return;
      errors.push(`console: ${m.text()}`);
    });
  };
  context.on('page', watch);
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

/** A workbook sent as the file field of a form. */
const sendFile = (page, url, buffer, name) => page.evaluate(async ({ url, b64, name }) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
  const res = await fetch(url, { method: 'POST', credentials: 'include', body: fd });
  let body = null;
  try { body = await res.json(); } catch (_) { body = null; }
  return { status: res.status, body };
}, { url, b64: Buffer.from(buffer).toString('base64'), name });

const fileHead = (page, url) => page.evaluate(async (u) => {
  const res = await fetch(u, { credentials: 'include' });
  const buf = new Uint8Array(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get('content-type'), head: String.fromCharCode(...buf.slice(0, 4)), size: buf.length };
}, url);

const dialogs = (page) => page.locator('#overlay-root [role="dialog"]');
const main = (page) => page.locator('#app-main');

async function loaded(page) {
  await page.waitForFunction(() => document.querySelector('#app-main h1') && !document.querySelector('#app-main')?.textContent.includes('Loading'), null, { timeout: 15000 });
}
async function go(page, route) {
  await page.goto(`${BASE}/app.html#${route}`);
  await loaded(page);
}
const pad = (n) => String(n).padStart(2, '0');
const isoDaysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const tomorrowIso = () => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

async function noOverflow(page, label) {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(wide <= 1, `${label}: nothing scrolls sideways`, `${wide}px`);
}

/** The first row of the page's list (a table row on desktop, a card on a phone). */
const firstRow = (page, phone) => (phone ? page.locator('#app-main .desk\\:hidden > div > button') : page.locator('#app-main table tbody tr[tabindex]')).first();

async function adminFlow(browser, db, state) {
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);

  // ---- the options and the batches the seed made
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
  state.batchId = batch.id;
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
  const badDates = await api(page, 'PUT', `${API}/batches/${batch.id}/ratings/${second.serviceNumber}`, { start_date: isoDaysAgo(5), end_date: isoDaysAgo(20) });
  check(badDates.status === 422 && badDates.body.error.fields.end_date, 'History: an end date before the start is refused');
  const future = await api(page, 'PUT', `${API}/batches/${batch.id}/ratings/${second.serviceNumber}`, { start_date: isoDaysAgo(5), end_date: tomorrowIso() });
  check(future.status === 422 && future.body.error.fields.end_date, 'History: an end date in the future is refused');
  const half = await api(page, 'PUT', `${API}/batches/${batch.id}/ratings/${second.serviceNumber}`, { start_date: isoDaysAgo(60), end_date: '' });
  check(half.status === 422, 'History: one date without the other is refused');
  const own = await api(page, 'PUT', `${API}/batches/${batch.id}/ratings/${second.serviceNumber}`, { start_date: isoDaysAgo(120), end_date: isoDaysAgo(30) });
  check(own.status === 200 && own.body.data.startDate === isoDaysAgo(120), 'History: a rating has its own dates');
  const attending = (await api(page, 'GET', `${API}/batches/${batch.id}`)).body.data.members.filter((m) => m.attended);

  const confirm = (body) => api(page, 'POST', `${API}/batches/${batch.id}/confirm`, body);
  const institution = options.institutions[0];
  const allResults = Object.fromEntries(attending.map((m, i) => [m.serviceNumber, ['Distinction', 'Credit', 'Pass', 'Fail'][i % 4]]));
  const base = { institution_id: institution.id, start_date: isoDaysAgo(150), end_date: isoDaysAgo(20), results: allResults };
  const missing = await confirm({ ...base, results: {} });
  check(missing.status === 422 && Object.keys(missing.body.error.fields).some((k) => k.startsWith('results.')), 'Confirm: every attending rating needs a result');
  check((await confirm({ ...base, end_date: isoDaysAgo(200) })).status === 422, 'Confirm: an end date before the start is refused');
  const fut = await confirm({ ...base, end_date: tomorrowIso() });
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
  check(!ownEntry || String(ownEntry.start_date).includes(isoDaysAgo(120).slice(0, 4)), 'Confirm: a rating with its own dates keeps them');
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
  const pdfOpen = await fileHead(page, `${API}/batches/${state.openId || open0.data[0].id}/pdf`);
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
  const notExcel = await page.evaluate(async (url) => {
    const fd = new FormData(); fd.append('file', new Blob(['hello'], { type: 'text/plain' }), 'x.csv');
    const r = await fetch(url, { method: 'POST', credentials: 'include', body: fd }); return r.status;
  }, `${API}/upload/review`);
  check(notExcel === 400, 'Upload: a file that is not .xlsx is refused');

  // ---- the audit trail
  const audit = async (table) => (await api(page, 'GET', `/api/audit?table=${table}&pageSize=100`)).body.data;
  const batches = (await audit('training_batches')).filter((a) => a.recordId === batch.batchNumber);
  check(batches.some((a) => a.action === 'INSERT') && batches.some((a) => a.action === 'UPDATE'), 'Audit: the making and the closing of a batch');
  const memberRows = (await audit('training_batch_ratings')).filter((a) => String(a.recordId).startsWith(`${batch.batchNumber}:`));
  check(memberRows.some((a) => a.action === 'DELETE') && memberRows.some((a) => a.action === 'INSERT') && memberRows.some((a) => a.action === 'UPDATE'), 'Audit: a rating removed, added and updated in a batch');
  const trainingRows = (await audit('rating_training')).filter((a) => attending.some((m) => String(a.recordId).startsWith(`${m.serviceNumber}:`)));
  check(trainingRows.length >= attending.length, 'Audit: each Training entry made by the confirmation');

  // ---- the pages, as the screens show them
  for (const [route, heading] of [['training/process', 'Process Training Draft'], ['training/review', 'Training Review'], ['training/history', 'Update Training History'], ['training/reports', 'Training Reports'], ['training/upload', 'Training Excel Upload']]) {
    await go(page, route);
    check((await main(page).locator('h1').first().innerText()).includes(heading), `Page: ${heading}`);
  }
  await go(page, 'training/process');
  await firstRow(page, false).click();
  await dialogs(page).last().waitFor();
  check(await dialogs(page).last().innerText().then((t) => /DOT-\d{4}-\d{2}-\d{2}/.test(t)), 'Process: a row opens the batch');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New Training Batch' }).click();
  await dialogs(page).last().waitFor();
  check((await dialogs(page).last().innerText()).includes('Course and Period'), 'Process: New Training Batch opens its first step');
  await page.keyboard.press('Escape');
  await shot(page, 'process');

  check(errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

async function layoutPass(browser, viewport, theme) {
  const { context, page, errors, phone } = await open(browser, { viewport, theme });
  const label = `${viewport.width}px ${theme}`;
  await signIn(page, ADMIN);
  const openId = (await api(page, 'GET', `${API}/batches?status=open`)).body.data[0].id;
  for (const route of ['training/process', `training/review/${openId}`, `training/history/${openId}`, 'training/reports', 'training/upload']) {
    await go(page, route);
    await noOverflow(page, `${label}: ${route}`);
    if (route === 'training/process' || route === 'training/reports') {
      await firstRow(page, phone).click();
      await dialogs(page).last().waitFor();
      await noOverflow(page, `${label}: ${route} dialog`);
      await shot(page, `${route.replace('/', '-')}-${viewport.width}-${theme}`);
      await page.keyboard.press('Escape');
    }
  }
  await go(page, 'training/process');
  await page.getByRole('button', { name: 'New Training Batch' }).click();
  await dialogs(page).last().waitFor();
  await noOverflow(page, `${label}: New Training Batch`);
  await page.keyboard.press('Escape');
  check(errors.length === 0, `${label}: no browser errors`, errors.join(' | '));
  await context.close();
}

async function roles(browser, state) {
  // the old Training role may do all of it
  let s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, TRAINER);
  check((await api(s.page, 'GET', `${API}/batches`)).status === 200, 'Training role: may see the batches');
  const rail = await s.page.locator('body').innerText();
  check(/Training/.test(rail), 'Training role: Training Drafting is in the sidebar');
  check((await api(s.page, 'GET', `${API}/upload/template`)).status === 200, 'Training role: may download the upload template');
  check((await api(s.page, 'GET', '/api/ratings/search?q=B05&status=current')).status === 200, 'Training role: the rating search opens for Training Review');
  await s.context.close();

  // a role that may only view the batches and the reports
  s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, VIEWER);
  check((await api(s.page, 'GET', `${API}/batches`)).status === 200, 'Viewer: may see the batches');
  check((await api(s.page, 'POST', `${API}/batches`, { course_id: 1, month: 2, year: 2025 })).status === 403, 'Viewer: may not make a batch');
  check((await api(s.page, 'POST', `${API}/batches/1/ratings`, { serviceNumber: 'B0501' })).status === 403, 'Viewer: may not add a rating');
  check((await api(s.page, 'PUT', `${API}/batches/1/ratings/B0501`, { attended: false })).status === 403, 'Viewer: may not change attendance');
  check((await api(s.page, 'POST', `${API}/batches/1/confirm`, {})).status === 403, 'Viewer: may not confirm a history');
  check((await api(s.page, 'GET', `${API}/upload/template`)).status === 403, 'Viewer: has no Excel Upload');
  check((await fileHead(s.page, `${API}/batches/${state.batchId || 1}/pdf`)).status === 200, 'Viewer: the Reports privilege prints the Training Draft Report');
  await go(s.page, 'training/process');
  check((await s.page.getByRole('button', { name: 'New Training Batch' }).count()) === 0, 'Viewer: no New Training Batch button');
  await s.context.close();
}

async function main_() {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const browser = await chromium.launch();
  const state = {};
  try {
    await adminFlow(browser, db, state);
    for (const vp of [DESKTOP, PHONE]) for (const theme of ['light', 'dark']) await layoutPass(browser, vp, theme);
    await roles(browser, state);
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
