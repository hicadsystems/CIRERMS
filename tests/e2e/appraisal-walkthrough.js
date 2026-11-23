#!/usr/bin/env node
'use strict';

/*
 * Walk-through of Naval Character Assessment (WP12). Uses the Playwright installed on the machine (not a project dependency):
 *
 *   npm run migrate:fresh && npm run seed       # a fresh demo database (the walk-through adds periods and appraisals)
 *   npm start                                   # the app on :3000
 *   NODE_PATH=$(npm root -g) node tests/e2e/appraisal-walkthrough.js
 *
 * BASE changes the address; SHOTS=<dir> saves screenshots there. It reads .env for the database (the audit trail).
 * Exits non-zero when a check fails. Browser errors fail the run.
 *
 * The rules through the API as the Naval Assessment Officer (B1202): a period (name, dates, overlap, edit, close and
 * read-only afterwards); an appraisal (every refusal: no rating, a former rating, a closed period, a grade not in the
 * table, no CO, the director's name without a date, a future date, a date before the period, a second appraisal for the
 * rating and period); edit (nothing changed refused, a change listed in the audit trail); cancel (a reason is needed,
 * the rating may then be appraised again); the report (filters, grade counts, PDF, Excel from one query); the record's
 * list; the dashboard. Then the screens at 1440 px, light: Recommendation and Grading (Initiate, Edit, Cancel), Report on
 * Appraisal (Print PDF), Appraisal Periods (Add, Edit, Close), the record's Advancement tab and the dashboard tile.
 * Then the privileges (the recorder may not cancel or close; a rating may open nothing) and each layout (1440 and 390 px,
 * light and dark) draws every page and its main dialog with nothing overflowing.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mysql = require('mysql2/promise');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:3000';
const SHOTS = process.env.SHOTS || '';
const OFFICER = { username: 'B1202', password: 'Admin@123' }; // Naval Assessment Officer
const CLERK = { username: 'B1201', password: 'Admin@123' }; // Naval Assessment
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
async function closeAll(page) {
  for (let i = 0; i < 4 && (await dialogs(page).count()); i += 1) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
}
// waits for text to show in the open dialog (the server's answer arrives after the click)
const dialogShows = (page, re) => dialogOf(page).getByText(re).first().waitFor({ timeout: 8000 }).then(() => true, () => false);
const press = (page, name) => dialogOf(page).getByRole('button', { name, exact: true }).click();
const fillIn = (page, name, value) => dialogOf(page).locator(`[name="${name}"]`).first().fill(value);
async function noOverflow(page, label) {
  const wide = await page.evaluate(() => {
    const over = Array.from(document.querySelectorAll('#app-main *')).filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'auto' && (e.closest('table') || e.querySelector('table'))).length;
    return { page: document.documentElement.scrollWidth - window.innerWidth, main: document.querySelector('#app-main').scrollWidth - document.querySelector('#app-main').clientWidth, tables: over };
  });
  check(wide.page <= 1 && wide.main <= 1 && wide.tables === 0, `${label}: nothing scrolls sideways`, JSON.stringify(wide));
}
async function dialogFits(page, label) {
  const fits = await dialogOf(page).evaluate((d) => d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().right <= window.innerWidth + 1);
  check(fits, `${label}: the dialog fits the screen`);
}
const ddmmyyyy = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

// ---- the rules through the API ------------------------------------------------------------------------
async function rules(browser, db) {
  console.log('\nThe rules through the API (Naval Assessment Officer)');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, OFFICER);
  const opts = (await api(page, 'GET', '/api/appraisal/options')).body.data;
  const grade = (code) => opts.grades.find((g) => g.code === code);
  check(opts.grades.length === 5 && opts.periods.some((p) => p.open) && opts.periods.some((p) => !p.open), 'the options hold the grades and open and closed periods');
  const openPeriod = opts.periods.find((p) => p.open);
  const closedPeriod = opts.periods.find((p) => !p.open);

  // periods
  const base = { name: 'WT Period A', start: '2031-01-01', end: '2031-06-30' };
  const p1 = await api(page, 'POST', '/api/appraisal/periods', base);
  check(p1.status === 201 && p1.body.data.open, 'a period is added and open');
  check((await api(page, 'POST', '/api/appraisal/periods', { ...base, start: '2032-01-01', end: '2032-02-01' })).status === 422, 'a second period with that name is refused');
  check((await api(page, 'POST', '/api/appraisal/periods', { name: 'WT Backwards', start: '2033-05-01', end: '2033-04-01' })).status === 422, 'an end before the start is refused');
  const clash = await api(page, 'POST', '/api/appraisal/periods', { name: 'WT Overlap', start: '2031-06-30', end: '2031-12-31' });
  check(clash.status === 422 && !!clash.body.error.fields.start, 'a period that overlaps another is refused', JSON.stringify(clash.body));
  check((await api(page, 'PUT', `/api/appraisal/periods/${p1.body.data.id}`, { ...base, name: 'WT Period A2' })).status === 200, 'an open period is edited');
  const p2 = await api(page, 'POST', '/api/appraisal/periods', { name: 'WT Period B', start: '2031-07-01', end: '2031-12-31' });
  check(p2.status === 201, 'a second period is added');

  // appraisals
  const ap = (body) => api(page, 'POST', '/api/appraisal/appraisals', body);
  const good = { serviceNumber: 'B1222', periodId: openPeriod.id, characterGradeId: grade('B').id, efficiencyGradeId: grade('C').id, remark: 'Walk-through', coName: 'CDR A. DANJUMA' };
  check((await ap({ ...good, serviceNumber: '' })).status === 422, 'no rating is refused');
  check((await ap({ ...good, serviceNumber: 'NOPE1' })).status === 422, 'an unknown rating is refused');
  check((await ap({ ...good, periodId: closedPeriod.id })).status === 422, 'a closed period is refused');
  check((await ap({ ...good, characterGradeId: 99999 })).status === 422, 'a grade that is not in the table is refused');
  check((await ap({ ...good, coName: '' })).status === 422, 'no CO is refused');
  check((await ap({ ...good, directorName: 'CAPT N. EZE' })).status === 422, 'the director\u2019s name without a date is refused');
  check((await ap({ ...good, directorName: 'CAPT N. EZE', directorDate: '2099-01-01' })).status === 422, 'a director\u2019s date in the future is refused');
  check((await ap({ ...good, directorName: 'CAPT N. EZE', directorDate: '2020-01-01' })).status === 422, 'a director\u2019s date before the period began is refused');
  const made = await ap(good);
  check(made.status === 201 && made.body.data.no.startsWith('APR-') && made.body.data.ship === 'NNS PROSPERITY' && made.body.data.rateCode === 'LS', 'an appraisal is recorded with the rate and ship at the time', JSON.stringify(made.body));
  const dup = await ap(good);
  check(dup.status === 409 && /already has an appraisal/.test(dup.body.error.message), 'a second appraisal for the rating and period is refused, naming the first');
  const a1 = made.body.data;

  // edit
  const upd = (id, body) => api(page, 'PUT', `/api/appraisal/appraisals/${id}`, body);
  const same = { characterGradeId: grade('B').id, efficiencyGradeId: grade('C').id, remark: 'Walk-through', coName: 'CDR A. DANJUMA' };
  check((await upd(a1.id, same)).status === 422, 'an edit that changes nothing is refused');
  const edited = await upd(a1.id, { ...same, efficiencyGradeId: grade('A').id, directorName: 'CAPT N. EZE', directorDate: openPeriod.start > '2026-07-01' ? openPeriod.start : '2026-08-01' });
  check(edited.status === 200 && edited.body.data.efficiency.code === 'A', 'an edit is saved');
  const [[trail]] = await db.query("SELECT changes FROM audit_trail WHERE table_name = 'appraisals' AND record_id = ? AND action = 'UPDATE' ORDER BY id DESC LIMIT 1", [`B1222:${a1.id}`]);
  const changes = trail ? (typeof trail.changes === 'string' ? JSON.parse(trail.changes) : trail.changes) : [];
  check(changes.some((c) => c.field === 'Efficiency Grade' && /C - /.test(c.from) && /A - /.test(c.to)), 'the audit trail lists the change with before and after', JSON.stringify(changes));
  const one = (await api(page, 'GET', `/api/appraisal/appraisals/${a1.id}`)).body.data;
  check(one.edits.length === 1, 'the appraisal shows its edit');

  // cancel
  check((await api(page, 'POST', `/api/appraisal/appraisals/${a1.id}/cancel`, {})).status === 422, 'cancelling without a reason is refused');
  check((await api(page, 'POST', `/api/appraisal/appraisals/${a1.id}/cancel`, { reason: 'Walk-through cancel' })).status === 200, 'an appraisal is cancelled with a reason');
  check((await api(page, 'POST', `/api/appraisal/appraisals/${a1.id}/cancel`, { reason: 'again' })).status === 409, 'a cancelled appraisal cannot be cancelled again');
  check((await upd(a1.id, { ...same, remark: 'x' })).status === 409, 'a cancelled appraisal cannot be edited');
  const list1 = (await api(page, 'GET', `/api/appraisal/appraisals?serviceNumber=B1222&periodId=${openPeriod.id}`)).body;
  check(list1.data.length === 0, 'the cancelled appraisal has left the list');
  const again = await ap(good);
  check(again.status === 201, 'the rating can be appraised again for that period');

  // a closed period is read-only
  const closeP = await api(page, 'POST', `/api/appraisal/periods/${p2.body.data.id}/close`, {});
  check(closeP.status === 200 && closeP.body.data.status === 'closed', 'a period is closed');
  check((await api(page, 'POST', `/api/appraisal/periods/${p2.body.data.id}/close`, {})).status === 409, 'a closed period cannot be closed again');
  check((await api(page, 'PUT', `/api/appraisal/periods/${p2.body.data.id}`, { name: 'WT Period B2', start: '2031-07-01', end: '2031-12-31' })).status === 409, 'a closed period cannot be edited');
  const seededClosed = (await api(page, 'GET', `/api/appraisal/appraisals?periodId=${closedPeriod.id}`)).body.data[0];
  check((await upd(seededClosed.id, { characterGradeId: grade('A').id, efficiencyGradeId: grade('A').id, coName: 'X' })).status === 409, 'an appraisal in a closed period cannot be edited');
  check((await api(page, 'POST', `/api/appraisal/appraisals/${seededClosed.id}/cancel`, { reason: 'x' })).status === 409, 'an appraisal in a closed period cannot be cancelled');

  // report
  const rep = (await api(page, 'GET', `/api/appraisal/report?periodId=${openPeriod.id}`)).body;
  const sumC = rep.gradeCounts.reduce((a, g) => a + g.character, 0);
  check(rep.summary.appraisals === rep.meta.total && sumC === rep.summary.appraisals, 'the grade counts add up to the appraisals');
  const gradeA = grade('A').id;
  const repA = (await api(page, 'GET', `/api/appraisal/report?periodId=${openPeriod.id}&gradeId=${gradeA}`)).body;
  check(repA.data.every((a) => a.character.id === gradeA || a.efficiency.id === gradeA), 'the Grade filter matches either grade');
  const pdf = await fileHead(page, `/api/appraisal/report/pdf?periodId=${openPeriod.id}`);
  check(pdf.status === 200 && pdf.head === '%PDF', 'Print PDF is a PDF');
  const xls = await fileHead(page, `/api/appraisal/report/excel?periodId=${openPeriod.id}`);
  check(xls.status === 200 && xls.head.startsWith('PK'), 'Export Excel is a workbook');

  // the record's list and the dashboard
  const rec = (await api(page, 'GET', '/api/appraisal/rating/B1211/appraisals')).body.data;
  check(rec.items.length >= 3 && rec.canInitiate === true, 'the record lists the rating\u2019s appraisals and can initiate one (WT Period A2 is open and B1211 has none in it)');
  const dash = (await api(page, 'GET', '/api/dashboard/summary')).body.data;
  check(dash.appraisals.month >= 1 && dash.appraisals.openPeriods >= 1, 'the dashboard counts the appraisals this month and the open periods');

  // a former rating cannot be appraised
  const [former] = await db.query("SELECT service_number FROM ratings WHERE status = 'former' LIMIT 1");
  if (former) check((await ap({ ...good, serviceNumber: former.service_number })).status === 422, 'a former rating cannot be appraised');

  await db.query("DELETE FROM appraisals WHERE service_number = 'B1222' AND period_id = ? AND remark = 'Walk-through'", [openPeriod.id]); // leave the demo as it was
  check(errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

// ---- the screens at 1440 px, light ---------------------------------------------------------------------
async function screens(browser, db) {
  console.log('\nThe screens (Naval Assessment Officer, 1440 px, light)');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, OFFICER);
  const phone = false;

  // Recommendation and Grading: Initiate, Edit, Cancel
  await go(page, 'assessment/grading');
  check((await page.locator('#app-main h1').innerText()).includes('Recommendation and Grading'), 'Recommendation and Grading opens');
  await shot(page, 'grading');
  await page.getByRole('button', { name: 'Initiate Appraisal' }).click();
  await dialogOf(page).waitFor();
  await press(page, 'Record Appraisal');
  check(await dialogShows(page, /Choose a rating/), 'Initiate Appraisal: nothing chosen is refused under the fields');
  await closeAll(page);

  // the same through the rating's record: Initiate from the Advancement tab
  await go(page, 'ratings/edit/B1222?tab=advancement');
  await page.locator('[data-record-appraisals]').waitFor();
  check(await page.getByRole('button', { name: 'Initiate Appraisal' }).count() === 1, 'the record\u2019s Advancement tab offers Initiate Appraisal');
  await page.getByRole('button', { name: 'Initiate Appraisal' }).click();
  await dialogOf(page).waitFor();
  await dialogOf(page).locator('[name="characterGradeId"]').first().evaluate((el) => { el.value = el.options[1].value; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await dialogOf(page).locator('[name="efficiencyGradeId"]').first().evaluate((el) => { el.value = el.options[2].value; el.dispatchEvent(new Event('change', { bubbles: true })); });
  await fillIn(page, 'coName', 'CDR WT SCREEN');
  await press(page, 'Record Appraisal');
  check(/recorded for/.test(await toastText(page, /recorded for/)), 'an appraisal is recorded from the record');
  await page.locator('[data-record-appraisals] table tbody tr').first().click();
  await dialogOf(page).waitFor();
  await shot(page, 'record-appraisal');
  await page.getByRole('button', { name: 'Cancel Appraisal' }).click();
  await dialogOf(page).waitFor();
  await press(page, 'Cancel Appraisal');
  check(/reason/i.test(await dialogOf(page).innerText()), 'Cancel Appraisal needs a reason');
  await fillIn(page, 'reason', 'Walk-through screen cancel');
  await press(page, 'Cancel Appraisal');
  check(/cancelled/.test(await toastText(page, /cancelled/)), 'the appraisal is cancelled');

  // edit one from the list
  await go(page, 'assessment/grading');
  await openRow(page, phone, 'B1211');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await dialogOf(page).waitFor();
  await press(page, 'Save Changes');
  check(await dialogShows(page, /Nothing was changed/), 'Edit: no change is refused');
  await fillIn(page, 'remark', 'Edited by the walk-through');
  await press(page, 'Save Changes');
  check(/saved/.test(await toastText(page, /saved/)), 'an edit is saved');
  await openRow(page, phone, 'B1211');
  check(await dialogOf(page).locator('[data-appraisal-edits]').count() === 1, 'the appraisal lists its changes');
  await closeAll(page);

  // Report on Appraisal
  await go(page, 'assessment/report');
  check(await page.locator('[data-grade-counts] table').count() === 1 && await page.locator('[data-report-figures]').count() === 1, 'Report on Appraisal shows the figures and the grade counts');
  await page.getByRole('button', { name: 'Print PDF' }).click();
  await dialogOf(page).locator('[data-pdf-stage][data-ready="1"]').waitFor({ timeout: 30000 });
  check(await dialogOf(page).locator('canvas[data-pdf-page]').count() >= 1, 'Print PDF opens the printout in the preview');
  await closeAll(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export Excel' }).click()]);
  check(/\.xlsx$/.test(dl.suggestedFilename()), 'Export Excel downloads a workbook');
  await shot(page, 'report');

  // Appraisal Periods: Add, Edit, Close
  await go(page, 'assessment/periods');
  await page.getByRole('button', { name: 'Add Period' }).click();
  await dialogOf(page).waitFor();
  await press(page, 'Add Period');
  check(await dialogShows(page, /Enter the period name/), 'Add Period: an empty form is refused');
  await fillIn(page, 'name', 'WT Screen Period');
  await fillIn(page, 'start', ddmmyyyy('2035-01-01'));
  await fillIn(page, 'end', ddmmyyyy('2035-06-30'));
  await press(page, 'Add Period');
  check(/added and open/.test(await toastText(page, /added and open/)), 'a period is added');
  await openRow(page, phone, 'WT Screen Period');
  await page.getByRole('button', { name: 'Close Period' }).click();
  await page.getByRole('button', { name: 'Close Period' }).last().click();
  check(/closed/.test(await toastText(page, /closed/)), 'a period is closed after the confirmation');
  await openRow(page, phone, 'WT Screen Period');
  check(/closed and read-only/.test(await dialogOf(page).innerText()) && await page.getByRole('button', { name: 'Edit', exact: true }).count() === 0, 'a closed period is read-only');
  await closeAll(page);
  await shot(page, 'periods');

  // the dashboard tile
  await go(page, 'dashboard');
  check(/Appraisals/i.test(await page.locator('#app-main').innerText()) && !/Soon/.test(await page.locator('#app-main').innerText()), 'the dashboard\u2019s Appraisals tile counts appraisals');

  await db.query("DELETE FROM appraisals WHERE remark IS NULL AND co_name = 'CDR WT SCREEN'");
  await db.query("DELETE FROM appraisals WHERE co_name = 'CDR WT SCREEN'");
  await db.query("UPDATE appraisals SET remark = NULL WHERE remark = 'Edited by the walk-through'");
  check(errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

// ---- privileges -------------------------------------------------------------------------------------------
async function privileges(browser) {
  console.log('\nPrivileges');
  const clerk = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(clerk.page, CLERK);
  const first = (await api(clerk.page, 'GET', '/api/appraisal/appraisals')).body.data[0];
  const opts = (await api(clerk.page, 'GET', '/api/appraisal/options')).body.data;
  check(first && (await api(clerk.page, 'POST', `/api/appraisal/appraisals/${first.id}/cancel`, { reason: 'x' })).status === 403, 'the recorder may not cancel an appraisal');
  check((await api(clerk.page, 'POST', '/api/appraisal/periods', { name: 'No', start: '2040-01-01', end: '2040-06-30' })).status === 403, 'the recorder may not add a period');
  check((await api(clerk.page, 'POST', `/api/appraisal/periods/${opts.periods[0].id}/close`, {})).status === 403, 'the recorder may not close a period');
  check((await api(clerk.page, 'GET', '/api/appraisal/report')).status === 200, 'the recorder reads the report');
  await go(clerk.page, 'assessment/periods');
  check(await clerk.page.getByRole('button', { name: 'Add Period' }).count() === 0, 'Add Period is hidden from the recorder');
  await clerk.context.close();

  const rating = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(rating.page, RATING);
  for (const url of ['/api/appraisal/options', '/api/appraisal/appraisals', '/api/appraisal/periods', '/api/appraisal/report', '/api/appraisal/rating/B0539/appraisals']) {
    check((await api(rating.page, 'GET', url)).status === 403, `a rating may not open ${url}`);
  }
  await go(rating.page, 'ratings/my-details');
  check(await rating.page.locator('[data-record-appraisals]').count() === 0, 'My Details shows no appraisals');
  await rating.context.close();
}

// ---- each layout ------------------------------------------------------------------------------------------
async function layoutPass(browser, viewport, theme) {
  const label = `${viewport.width}px ${theme}`;
  console.log(`\nLayout ${label}`);
  const { context, page, errors, phone } = await open(browser, { viewport, theme });
  await signIn(page, OFFICER);
  for (const route of ['assessment/grading', 'assessment/report', 'assessment/periods']) {
    await go(page, route);
    await noOverflow(page, `${label} ${route}`);
  }
  await go(page, 'assessment/grading');
  await openRow(page, phone, 'B1211');
  await dialogFits(page, `${label} appraisal`);
  await closeAll(page);
  await page.getByRole('button', { name: 'Initiate Appraisal' }).click();
  await dialogOf(page).waitFor();
  await dialogFits(page, `${label} Initiate Appraisal`);
  await closeAll(page);
  await go(page, 'assessment/periods');
  await openRow(page, phone, '2026 Second Half');
  await dialogFits(page, `${label} period`);
  await closeAll(page);
  await go(page, 'ratings/edit/B1211?tab=advancement');
  await page.locator('[data-record-appraisals]').waitFor();
  await noOverflow(page, `${label} record appraisals`);
  await go(page, 'dashboard');
  await noOverflow(page, `${label} dashboard`);
  check(errors.length === 0, `${label}: no browser errors`, errors.join(' | '));
  await context.close();
}

async function main_() {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true });
  const browser = await chromium.launch();
  try {
    await rules(browser, db);
    await screens(browser, db);
    await privileges(browser);
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
