#!/usr/bin/env node
'use strict';

/*
 * Walk-through of Disciplinary Action (WP4). Uses the Playwright installed on the machine (not a
 * project dependency):
 *
 *   npm run migrate:fresh                       # a fresh demo database (the walk-through adds cases)
 *   npm start                                   # the app on :3000
 *   NODE_PATH=$(npm root -g) node tests/e2e/disciplinary-walkthrough.js
 *
 * BASE changes the address; SHOTS=<dir> saves screenshots there. It reads .env for the database,
 * to add a throw-away role and account that may only view the report, and removes them again.
 * Exits non-zero when a check fails. Browser errors fail the run.
 *
 * As the Administrator at 1440 px, light: every action of the four pages (find a rating, open a
 * case, filters, conclude, cancel, correct, every PDF and the Excel file downloaded and opened),
 * the Discipline tab on a rating's record, every rule refused with its message (in the dialogs and
 * on the API), the Static Tables in-use refusal, and the audit trail. Then each layout (1440 and
 * 390 px, light and dark) draws every page and dialog with nothing overflowing; the role that may
 * initiate and view but not conclude (B0588), a rating and a report-only role are checked.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:3000';
const SHOTS = process.env.SHOTS || '';
const ADMIN = { username: 'HICO001', password: 'Admin@123' };
const OFFICER = { username: 'B0575', password: 'Admin@123' };
const INITIATOR = { username: 'B0588', password: 'Admin@123' };
const RATING = { username: 'B0539', password: 'Rating@123' };
const REPORTER = { username: 'B0601F', password: 'Report@123' };
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

/** The first bytes of a file the API sends: a PDF starts with %PDF. */
const fileHead = (page, url) => page.evaluate(async (u) => {
  const res = await fetch(u, { credentials: 'include' });
  const buf = new Uint8Array(await res.arrayBuffer());
  return { status: res.status, type: res.headers.get('content-type'), head: String.fromCharCode(...buf.slice(0, 4)), size: buf.length };
}, url);

const dialogOf = (page) => page.locator('#overlay-root [role="dialog"]').last();
const dialogs = (page) => page.locator('#overlay-root [role="dialog"]');
const main = (page) => page.locator('#app-main');

async function loaded(page) {
  await page.waitForFunction(() => document.querySelector('#app-main h1') && !document.querySelector('#app-main')?.textContent.includes('Loading'), null, { timeout: 15000 });
}
async function go(page, route) {
  await page.goto(`${BASE}/app.html#${route}`);
  await loaded(page);
}
const rowsOf = (page, phone) => (phone ? page.locator('#app-main .desk\\:hidden > div > button') : page.locator('#app-main table tbody tr[tabindex]'));
const rowTexts = async (page, phone) => {
  const rows = rowsOf(page, phone);
  const n = await rows.count();
  const out = [];
  for (let i = 0; i < n; i += 1) out.push((await rows.nth(i).innerText()).replace(/\s+/g, ' '));
  return out;
};
/** A list has finished loading: a reload shows "Loading" at once, so wait a frame, then for it to go. */
async function settle(page) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForFunction(() => !document.querySelector('#app-main')?.textContent.includes('Loading'), null, { timeout: 10000 });
}
const waitRows = (page) => settle(page);
const toastText = async (page, re) => {
  const t = page.locator('#toast-root [role]', { hasText: re }).last();
  await t.waitFor({ timeout: 8000 });
  const text = await t.innerText();
  await t.getByRole('button', { name: 'Dismiss' }).click();
  return text;
};
const pad = (n) => String(n).padStart(2, '0');
const ddmmyyyy = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return ddmmyyyy(d); };

/** Searchable dropdown: on the page (scope = main) or in the open dialog. */
async function choose(page, scope, name, label) {
  await scope.locator(`.custom-dropdown-wrapper[name="${name}"] input:not(.custom-dropdown-hidden)`).first().click();
  if (label && /^All /.test(label)) { await page.locator('.custom-dropdown-list:visible .cdd-placeholder').first().click(); return; }
  const options = page.locator('.custom-dropdown-list:visible .custom-dropdown-item:not(.cdd-placeholder)');
  await options.first().waitFor();
  if (label) await options.filter({ hasText: label }).first().click();
  else await options.first().click();
}
const chooseIn = (page, name, label) => choose(page, dialogOf(page), name, label);
const filterSelect = (page, name, label) => choose(page, page.locator('#app-main [data-filters]'), name, label);

async function openFilters(page, phone) {
  if (!phone) return;
  const panelHidden = await page.locator('#app-main [data-filters] > div').last().isHidden();
  if (panelHidden) await page.locator('#app-main [data-filters] button', { hasText: 'Filters' }).click();
}
async function setFilter(page, phone, name, value) {
  await openFilters(page, phone);
  const input = page.locator(`#app-main [data-filters] input[name="${name}"]`);
  await input.fill(value);
  await input.press('Enter');
  await waitRows(page);
}
async function clearFilters(page, phone) {
  await openFilters(page, phone);
  for (const name of ['q', 'from', 'to']) {
    const input = page.locator(`#app-main [data-filters] input[name="${name}"]`);
    if (await input.count()) { await input.fill(''); await input.press('Enter'); }
  }
  await waitRows(page);
}

async function noOverflow(page, label) {
  const wide = await page.evaluate(() => {
    const over = Array.from(document.querySelectorAll('#app-main *')).filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'auto' && e.closest('table')).length;
    return { page: document.documentElement.scrollWidth - window.innerWidth, main: document.querySelector('#app-main').scrollWidth - document.querySelector('#app-main').clientWidth, tables: over };
  });
  check(wide.page <= 1 && wide.main <= 1 && wide.tables === 0, `${label}: nothing scrolls sideways`, JSON.stringify(wide));
}

const fieldError = (page, name) => dialogOf(page).locator(`[name="${name}"]`).first().locator('xpath=ancestor::*[@data-field][1]//*[@data-field-error]');
async function errorText(page, name) {
  const slot = fieldError(page, name);
  await slot.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
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

// ---------------------------------------------------------------------------
// Administrator, desktop, light: every action
// ---------------------------------------------------------------------------
async function adminFlow(browser, state) {
  console.log('\nAdministrator, desktop, light: every action');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);

  // ---- sidebar, tabs, Ctrl K
  const link = page.locator('#rail nav a', { hasText: 'Disciplinary Action' });
  check(await link.count() === 1 && !(await link.innerText()).includes('Soon'), 'Disciplinary Action has lost its Soon badge');
  await link.click();
  await loaded(page);
  check(page.url().endsWith('#disciplinary/initiate'), 'the module opens on Initiate Incident', page.url());
  for (const t of ['Initiate Incident', 'Pending Cases', 'Concluded Cases', 'Disciplinary Report']) {
    await page.locator('a', { hasText: t }).filter({ visible: true }).first().waitFor({ timeout: 5000 }).catch(() => {});
    check(await page.locator('a', { hasText: t }).filter({ visible: true }).count() > 0, `tab: ${t}`);
  }
  await page.keyboard.press('Control+K');
  await page.keyboard.type('Disciplinary Report');
  await page.locator('#palette-results, [role="listbox"]').first().getByText('Disciplinary Report').first().waitFor();
  check(true, 'Ctrl K finds Disciplinary Report');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#disciplinary/report');
  check(page.url().endsWith('#disciplinary/report'), 'Ctrl K opens it');

  // ---- Initiate Incident
  await go(page, 'disciplinary/initiate');
  check(/Find a Rating/.test(await main(page).innerText()), 'Initiate: starts with "Find a Rating"');
  const q = main(page).locator('input[name="q"]');
  await q.fill('dafe'); await q.press('Enter'); await main(page).getByText('No Current Rating Found').waitFor();
  let text = await main(page).innerText();
  check(/No Current Rating Found/.test(text) && /left the service/.test(text), 'Initiate: a former rating is not offered, and the page says why');
  await q.fill('zzzzzz'); await q.press('Enter'); await main(page).getByText('Check the Official Number').waitFor();
  check(/Check the Official Number/.test(await main(page).innerText()), 'Initiate: no match says so');
  await q.fill('okon'); await q.press('Enter'); await rowsOf(page, false).first().waitFor();
  const found = await rowTexts(page, false);
  check(found.length === 1 && /B0539/.test(found[0]) && /OKONKWO/.test(found[0]) && /1 current rating found/.test(await main(page).innerText()), 'Initiate: a partial name finds the current rating', found.join('|'));
  const row = rowsOf(page, false).first();
  await row.hover();
  await page.locator('[role="tooltip"]', { hasText: 'View Details' }).waitFor({ state: 'visible' });
  check(await page.locator('[role="tooltip"]:visible', { hasText: 'View Details' }).count() === 1, 'a row shows the View Details tooltip on hover');
  await shot(page, 'desktop-light-initiate');
  await row.click();
  await dialogOf(page).waitFor();
  check(/already has a pending case/.test(await dialogOf(page).innerText()), 'the rating dialog warns of the pending case (nothing blocks)');
  await dialogOf(page).getByRole('button', { name: 'Open Case' }).click();
  await dialogOf(page).locator('form').waitFor();
  check(/Initiate Incident/.test(await dialogOf(page).innerText()), 'Open Case shows the case form');
  await shot(page, 'desktop-light-initiate-form');
  const save = () => dialogOf(page).getByRole('button', { name: /Open Case|Conclude Case|Save Correction|Cancel Case/ }).last().click();

  await save();
  check(await errorText(page, 'incident_date') === 'Enter the incident date.', 'rule: the incident date is required', await errorText(page, 'incident_date'));
  check(await errorText(page, 'offence_id') === 'Choose the offence.', 'rule: the offence is required');
  check(await errorText(page, 'what_happened') === 'Describe what happened.' && await errorText(page, 'reported_by') === 'Say who reported it.', 'rule: what happened and reported by are required');
  await dialogOf(page).locator('[name="incident_date"]').fill(tomorrow());
  await chooseIn(page, 'offence_id', 'Insubordination');
  await dialogOf(page).locator('[name="what_happened"]').fill('Walk-through incident.');
  await dialogOf(page).locator('[name="reported_by"]').fill('Walk-through Officer');
  await save();
  check(await errorText(page, 'incident_date') === 'The incident cannot be in the future.', 'rule: an incident in the future is refused', await errorText(page, 'incident_date'));
  await dialogOf(page).locator('[name="incident_date"]').fill('01/01/2010');
  await save();
  check(/joined on 15\/09\/2012/.test(await errorText(page, 'incident_date')), 'rule: an incident before the rating joined is refused', await errorText(page, 'incident_date'));
  await dialogOf(page).locator('[name="incident_date"]').fill('abc');
  await save();
  check(/real date/.test(await errorText(page, 'incident_date')), 'rule: a date that is not a date is refused');
  await dialogOf(page).locator('[name="incident_date"]').fill('02/11/2026');
  await chooseIn(page, 'offence_id', 'Negligent performance of duty');
  await save();
  check(/already open as DC-2026-0007/.test(await errorText(page, 'offence_id')), 'rule: the same rating, offence and incident date twice is refused', await errorText(page, 'offence_id'));
  await dialogOf(page).locator('[name="incident_date"]').fill('10/11/2026');
  await chooseIn(page, 'offence_id', 'Insubordination');
  await save();
  const opened = await toastText(page, /opened for/);
  const newNo = (/DC-\d{4}-\d{4}/.exec(opened) || [])[0];
  check(!!newNo, 'a valid case opens, with a case number DC-YYYY-NNNN', opened);
  state.newNo = newNo;
  await page.waitForFunction(() => location.hash === '#disciplinary/pending', null, { timeout: 8000 });
  await loaded(page); await waitRows(page);
  check((await rowTexts(page, false)).some((t) => t.includes(newNo)), 'the new case is first on Pending Cases');
  check(/DC-\d{4}-0012/.test(newNo) || /DC-2026-0012/.test(newNo), 'the number follows the year\'s last (DC-2026-0012)', newNo);

  // the server refuses a former rating and a missing rating, whatever the screen did
  let r = await api(page, 'POST', '/api/disciplinary/cases', { serviceNumber: 'B0410', incident_date: '2026-11-01', offence_id: 1, what_happened: 'x', reported_by: 'y' });
  check(r.status === 422 && /Only a current rating/.test(r.body.error.message), 'API: only a current rating can have a case opened', JSON.stringify(r.body));
  r = await api(page, 'POST', '/api/disciplinary/cases', { serviceNumber: 'NOPE', incident_date: '2026-11-01', offence_id: 1, what_happened: 'x', reported_by: 'y' });
  check(r.status === 404, 'API: an unknown rating is refused');
  r = await api(page, 'POST', '/api/disciplinary/cases', { serviceNumber: 'B0539', incident_date: '2099-01-01', offence_id: 1, what_happened: 'x', reported_by: 'y' });
  check(r.status === 422 && r.body.error.fields.incident_date, 'API: a future incident date is refused');
  r = await api(page, 'POST', '/api/disciplinary/cases', { serviceNumber: 'B0539', incident_date: '2026-11-02', offence_id: 4, what_happened: 'x', reported_by: 'y' });
  check(r.status === 422 && /already open as/.test(r.body.error.fields.offence_id), 'API: a duplicate is refused');

  // ---- Pending Cases
  await go(page, 'disciplinary/pending'); await waitRows(page);
  check(/\d+ cases are waiting for a decision/.test(await main(page).innerText()), 'Pending: the count line');
  await setFilter(page, false, 'q', 'okon');
  let texts = await rowTexts(page, false);
  check(texts.length === 2 && texts.every((t) => /B0539/.test(t)), 'Pending: the name filter', `${texts.length}`);
  await filterSelect(page, 'offenceId', 'Insubordination'); await waitRows(page);
  texts = await rowTexts(page, false);
  check(texts.length === 1 && texts[0].includes(newNo), 'Pending: the offence filter', texts.join('|'));
  await setFilter(page, false, 'q', 'zzzz');
  check(/No Pending Cases/.test(await main(page).innerText()), 'Pending: nothing matching shows the empty state');
  await setFilter(page, false, 'q', '');
  await filterSelect(page, 'offenceId', 'All Offences'); await waitRows(page);
  check((await rowTexts(page, false)).length >= 7, 'Pending: filters cleared');

  const pend = await api(page, 'GET', '/api/disciplinary/cases/pending');
  check(pend.status === 200 && pend.body.meta.pageSize === 25, 'Pending: 25 a page from the server');
  const pdf = await fileHead(page, '/api/disciplinary/cases/pending/pdf');
  check(pdf.status === 200 && pdf.head === '%PDF' && pdf.size > 1500, 'Pending: the printout is a PDF', JSON.stringify(pdf));
  await main(page).getByRole('button', { name: 'Print List' }).click();
  await dialogOf(page).locator('iframe').waitFor();
  check(/Pending Disciplinary Cases/.test(await dialogOf(page).innerText()), 'Print List opens the PDF preview');
  await shot(page, 'desktop-light-pending-pdf');
  await closeTop(page);

  // a case with a pending list that has other cases and the one we opened: Case Sheet, then Conclude
  await setFilter(page, false, 'q', 'okon');
  await rowsOf(page, false).first().click();
  await dialogOf(page).waitFor();
  const dlgText = await dialogOf(page).innerText();
  check(dlgText.includes(newNo) && /Rate at the Time/i.test(dlgText) && /Ship at the Time/i.test(dlgText) && /Walk-through incident/.test(dlgText), 'the case dialog shows the case, with the rate and ship at the time');
  for (const b of ['Conclude', 'Cancel Case', 'Print Case', 'Open Record']) check(await dialogOf(page).getByRole('button', { name: b }).count() === 1, `the case dialog offers ${b}`);
  await shot(page, 'desktop-light-case-dialog');
  const mine = (await api(page, 'GET', '/api/disciplinary/cases/pending?q=okon')).body.data.find((c) => c.caseNumber === newNo);
  state.id = mine.id;
  const sheet = await fileHead(page, `/api/disciplinary/cases/${mine.id}/pdf`);
  check(sheet.head === '%PDF' && sheet.status === 200, 'Case Sheet is a PDF');
  await dialogOf(page).getByRole('button', { name: 'Print Case' }).click();
  await dialogs(page).last().locator('iframe').waitFor();
  check(/Case DC-/.test(await dialogs(page).last().innerText()), 'Print Case opens the Case Sheet preview');
  await closeTop(page);

  // Conclude
  await dialogOf(page).getByRole('button', { name: 'Conclude', exact: true }).click();
  await dialogOf(page).locator('form').waitFor();
  await shot(page, 'desktop-light-conclude');
  await save();
  check(await errorText(page, 'decision_date') === 'Enter the decision date.' && await errorText(page, 'sanction_id') === 'Choose the sanction.' && await errorText(page, 'decision') === 'Record the decision.' && await errorText(page, 'authority') === 'Name the authority.', 'Conclude: every field is required');
  await dialogOf(page).locator('[name="decision_date"]').fill('01/11/2026');
  await chooseIn(page, 'sanction_id', 'Reprimand');
  await dialogOf(page).locator('[name="decision"]').fill('Found guilty. Reprimanded.');
  await dialogOf(page).locator('[name="authority"]').fill('Commanding Officer');
  await save();
  check(/before the incident \(10\/11\/2026\)/.test(await errorText(page, 'decision_date')), 'rule: a decision before the incident is refused', await errorText(page, 'decision_date'));
  await dialogOf(page).locator('[name="decision_date"]').fill(tomorrow());
  await save();
  check(/cannot be in the future/.test(await errorText(page, 'decision_date')), 'rule: a decision in the future is refused');
  await dialogOf(page).locator('[name="decision_date"]').fill('15/11/2026');
  await save();
  check(/concluded: Reprimand/.test(await toastText(page, /concluded/)), 'Conclude: the case is concluded with its sanction');
  await waitRows(page);
  check(!(await rowTexts(page, false)).some((t) => t.includes(newNo)), 'the concluded case leaves Pending Cases');
  r = await api(page, 'POST', `/api/disciplinary/cases/${state.id}/conclude`, { decision_date: '2026-11-16', sanction_id: 1, decision: 'x', authority: 'y' });
  check(r.status === 409 && r.body.error.code === 'CASE_NOT_PENDING', 'API: a concluded case cannot be concluded again');
  r = await api(page, 'POST', `/api/disciplinary/cases/${state.id}/cancel`, { reason: 'x' });
  check(r.status === 409, 'API: a concluded case cannot be cancelled (it is final)');
  r = await api(page, 'DELETE', `/api/disciplinary/cases/${state.id}`);
  check(r.status === 404 || r.status === 405, 'nothing is deleted outright: there is no delete route', String(r.status));

  // Cancel: a case opened for the purpose
  r = await api(page, 'POST', '/api/disciplinary/cases', { serviceNumber: 'B0562', incident_date: '2026-11-16', offence_id: 7, what_happened: 'Opened to be cancelled.', reported_by: 'Walk-through Officer' });
  check(r.status === 201, 'API: a case opens');
  const cancelNo = r.body.data.caseNumber; const cancelId = r.body.data.id;
  await go(page, 'disciplinary/pending'); await waitRows(page);
  await setFilter(page, false, 'q', 'briggs');
  await rowsOf(page, false).first().click();
  await dialogOf(page).waitFor();
  await dialogOf(page).getByRole('button', { name: 'Cancel Case' }).click();
  await dialogOf(page).locator('form').waitFor();
  await shot(page, 'desktop-light-cancel');
  await save();
  check(await errorText(page, 'reason') === 'Give the reason the case is cancelled.', 'Cancel: a reason is required');
  await dialogOf(page).locator('[name="reason"]').fill('Walk-through: opened by mistake.');
  await save();
  check(new RegExp(`Case ${cancelNo} cancelled`).test(await toastText(page, /Case DC-\S+ cancelled/)), 'Cancel: the case is cancelled');
  await waitRows(page);
  check(!(await rowTexts(page, false)).some((t) => t.includes(cancelNo)), 'a cancelled case leaves Pending Cases');
  const cancelled = (await api(page, 'GET', `/api/disciplinary/cases/${cancelId}`)).body.data;
  check(cancelled.status === 'cancelled' && /opened by mistake/.test(cancelled.cancelReason) && cancelled.cancelledBy === 'HICO001', 'the cancelled case keeps its reason and who cancelled it (nothing deleted)');
  await setFilter(page, false, 'q', '');

  // ---- Concluded Cases
  await go(page, 'disciplinary/concluded'); await waitRows(page);
  texts = await rowTexts(page, false);
  check(texts.length === 8 && texts[0].includes(newNo), 'Concluded: the new case is first (8 cases)', `${texts.length}`);
  check(!texts.some((t) => t.includes(cancelNo)), 'Concluded: a cancelled case is not listed');
  await setFilter(page, false, 'q', 'musa');
  check((await rowTexts(page, false)).length === 1, 'Concluded: the name filter');
  await setFilter(page, false, 'q', '');
  await filterSelect(page, 'offenceId', 'Absence without leave'); await waitRows(page);
  check((await rowTexts(page, false)).length === 1, 'Concluded: the offence filter');
  await filterSelect(page, 'offenceId', 'All Offences');
  await filterSelect(page, 'sanctionId', 'Fine'); await waitRows(page);
  check((await rowTexts(page, false)).length === 2, 'Concluded: the sanction filter');
  await filterSelect(page, 'sanctionId', 'All Sanctions'); await waitRows(page);
  await setFilter(page, false, 'from', '01/01/2026'); await setFilter(page, false, 'to', '30/06/2026');
  texts = await rowTexts(page, false);
  check(texts.length === 2, 'Concluded: decided From and To', `${texts.length}`);
  await setFilter(page, false, 'to', '31/12/2025');
  check(/Swap the dates/.test(await main(page).innerText()), 'Concluded: From after To is reported');
  await setFilter(page, false, 'to', 'xx');
  check(/To is not a date. Use dd\/mm\/yyyy/.test(await main(page).innerText()), 'Concluded: a date that is not a date is reported');
  await clearFilters(page, false);
  r = await api(page, 'GET', '/api/disciplinary/cases/concluded?from=2026-12-01&to=2026-01-01');
  check(r.status === 422, 'API: From after To is refused');

  await rowsOf(page, false).first().click();
  await dialogOf(page).waitFor();
  check(await dialogOf(page).getByRole('button', { name: 'Correct' }).count() === 1 && await dialogOf(page).getByRole('button', { name: 'Conclude', exact: true }).count() === 0, 'a concluded case offers Correct and not Conclude');
  check(/A concluded case is final/.test(await dialogOf(page).innerText()), 'the dialog says a concluded case is final');
  await dialogOf(page).getByRole('button', { name: 'Correct' }).click();
  await dialogOf(page).locator('form').waitFor();
  await shot(page, 'desktop-light-correct');
  await dialogOf(page).locator('[name="reason"]').fill('Nothing to change.');
  await save();
  check(/Nothing was changed/.test(await errorText(page, 'reason')), 'Correct: no change is refused');
  await dialogOf(page).locator('[name="reason"]').fill('');
  await chooseIn(page, 'sanction_id', 'Extra duties');
  await save();
  check(/Give the reason/.test(await errorText(page, 'reason')), 'Correct: a reason is required');
  await dialogOf(page).locator('[name="decision_date"]').fill('01/11/2026');
  await dialogOf(page).locator('[name="reason"]').fill('The Commanding Officer awarded extra duties.');
  await save();
  check(/before the incident/.test(await errorText(page, 'decision_date')), 'Correct: the date rules apply again');
  await dialogOf(page).locator('[name="decision_date"]').fill('16/11/2026');
  await dialogOf(page).locator('[name="decision"]').fill('Found guilty. Seven days of extra duties.');
  await save();
  check(/corrected: .*Decision Date.*Sanction.*Decision|corrected/.test(await toastText(page, /corrected/)), 'Correct: the case is corrected');
  await waitRows(page);
  await rowsOf(page, false).first().click();
  await dialogOf(page).waitFor();
  const corrBlock = await dialogOf(page).locator('[data-corrections]').innerText();
  check(/extra duties/.test(corrBlock) && /Sanction: Reprimand → Extra duties/.test(corrBlock) && /HICO001/.test(corrBlock), 'the correction shows its reason, who and the before and after', corrBlock.replace(/\s+/g, ' '));
  await shot(page, 'desktop-light-corrections');
  await closeTop(page);
  const seededCorrected = (await api(page, 'GET', '/api/disciplinary/cases/concluded?q=briggs')).body.data[0];
  const seeded = (await api(page, 'GET', `/api/disciplinary/cases/${seededCorrected.id}`)).body.data;
  check(seeded.corrections.length === 1 && seeded.corrections[0].changes.length === 2, 'the seeded corrected case shows its correction');
  const rating = await api(page, 'POST', `/api/disciplinary/cases/${state.id}/correct`, { offence_id: 1, incident_date: '2026-11-10', what_happened: 'a', reported_by: 'b', decision_date: '2026-11-16', sanction_id: 1, decision: 'c', authority: 'd', reason: 'r', serviceNumber: 'B0541' });
  const afterRating = (await api(page, 'GET', `/api/disciplinary/cases/${state.id}`)).body.data;
  check(rating.status === 200 && afterRating.serviceNumber === 'B0539', 'Correct changes every field but the rating (a rating in the body is ignored)');
  r = await api(page, 'POST', `/api/disciplinary/cases/${cancelId}/correct`, { offence_id: 1, incident_date: '2026-11-10', what_happened: 'a', reported_by: 'b', decision_date: '2026-11-16', sanction_id: 1, decision: 'c', authority: 'd', reason: 'r' });
  check(r.status === 409 && r.body.error.code === 'CASE_NOT_CONCLUDED', 'API: only a concluded case can be corrected');
  r = await api(page, 'POST', `/api/disciplinary/cases/${state.id}/correct`, { offence_id: 4, incident_date: '2026-11-02', what_happened: 'a', reported_by: 'b', decision_date: '2026-11-16', sanction_id: 1, decision: 'c', authority: 'd', reason: 'r' });
  check(r.status === 422 && /already on file as DC-2026-0007/.test(r.body.error.fields.offence_id), 'API: a correction cannot duplicate another case');

  // ---- Disciplinary Report
  await go(page, 'disciplinary/report'); await waitRows(page);
  const figures = await page.locator('#app-main [data-figures]').innerText();
  check(/CASES\s*8/i.test(figures), 'Report: the Cases figure', figures.replace(/\s+/g, ' '));
  check(/MOST COMMON OFFENCE/i.test(figures) && /MOST COMMON SANCTION/i.test(figures), 'Report: the common offence and sanction figures');
  await openFilters(page, false);
  await filterSelect(page, 'sanctionId', 'Fine'); await waitRows(page);
  check((await rowTexts(page, false)).length === 2 && /CASES\s*2/i.test(await page.locator('#app-main [data-figures]').innerText()), 'Report: the sanction filter, and the figures follow it');
  await filterSelect(page, 'sanctionId', 'All Sanctions'); await waitRows(page);
  await setFilter(page, false, 'from', '01/01/2025'); await setFilter(page, false, 'to', '31/12/2025');
  check((await rowTexts(page, false)).length === 3, 'Report: Decided From and To');
  await filterSelect(page, 'shipId', 'NNS CENTENARY'); await waitRows(page);
  check((await rowTexts(page, false)).length === 1, 'Report: the ship filter');
  await filterSelect(page, 'shipId', 'All Ships');
  await filterSelect(page, 'rateId', 'Master Warrant Officer'); await waitRows(page);
  check((await rowTexts(page, false)).length === 1, 'Report: the rate filter');
  await filterSelect(page, 'rateId', 'All Rates'); await waitRows(page);
  await filterSelect(page, 'offenceId', 'Insubordination'); await waitRows(page);
  check((await rowTexts(page, false)).length === 0, 'Report: the offence filter applies with the dates (none in 2025)');
  await filterSelect(page, 'offenceId', 'All Offences');
  await clearFilters(page, false);
  await setFilter(page, false, 'from', '01/01/2026'); await setFilter(page, false, 'to', '31/12/2026');
  const expected = (await rowTexts(page, false)).length;
  const reportQuery = 'from=2026-01-01&to=2026-12-31';
  const rpdf = await fileHead(page, `/api/disciplinary/report/pdf?${reportQuery}`);
  check(rpdf.head === '%PDF' && rpdf.status === 200, 'Report: the PDF is a PDF');
  await main(page).getByRole('button', { name: 'Print PDF' }).click();
  await dialogOf(page).locator('iframe').waitFor();
  check(/Disciplinary Report/.test(await dialogOf(page).innerText()), 'Print PDF opens the preview');
  await shot(page, 'desktop-light-report-pdf');
  await closeTop(page);
  const [download] = await Promise.all([page.waitForEvent('download'), main(page).getByRole('button', { name: 'Export Excel' }).click()]);
  const file = path.join(os.tmpdir(), `dc-report-${Date.now()}.xlsx`);
  await download.saveAs(file);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = wb.worksheets[0];
  const dataRows = [];
  ws.eachRow((row, n) => { if (n > 4) dataRows.push(row.values.slice(1)); });
  check(download.suggestedFilename() === 'Disciplinary Report.xlsx' && ws.getRow(4).getCell(1).value === 'Case', 'Excel: the file downloads and opens, with its heading row', download.suggestedFilename());
  check(dataRows.length === expected, 'Excel: the same filtered cases as the screen', `${dataRows.length} vs ${expected}`);
  check(dataRows.every((x) => /^DC-2026-/.test(x[0])), 'Excel: every row is in the period');
  fs.unlinkSync(file);
  const bad = await api(page, 'GET', '/api/disciplinary/report/excel?from=2026-12-01&to=2026-01-01');
  check(bad.status === 422, 'API: the Excel file refuses a bad period as the screen does');
  await clearFilters(page, false);

  // ---- the rating's Discipline tab
  await go(page, 'ratings/edit/B0539');
  const tab = page.locator('[role="tab"]', { hasText: 'Discipline' });
  check(await tab.count() === 1, 'the record has a Discipline tab');
  await tab.click(); await waitRows(page);
  texts = await rowTexts(page, false);
  check(texts.length === 2 && texts.some((t) => t.includes(newNo)) && texts.some((t) => /Pending/.test(t)), 'the tab lists the pending and concluded cases', texts.join('|'));
  check(!texts.some((t) => t.includes(cancelNo)), 'the tab does not list a cancelled case');
  check(/2/.test(await tab.innerText()), 'the tab shows its count');
  await rowsOf(page, false).first().click();
  await dialogOf(page).waitFor();
  check(await dialogOf(page).getByRole('button', { name: /Conclude|Correct|Cancel Case/ }).count() === 0, 'a case opened from the tab is read only');
  await shot(page, 'desktop-light-discipline-tab');
  await closeAll(page);
  const before = await page.locator('.cirerms-progress-bar').first().getAttribute('style');
  await page.locator('[role="tab"]', { hasText: 'Details' }).click();
  check(await page.locator('.cirerms-progress-bar').first().getAttribute('style') === before, 'the Discipline tab does not count towards the completeness');

  // ---- Static Tables: an offence or sanction in use cannot be deleted
  r = await api(page, 'GET', '/api/tables/offences?q=Insubordination');
  const offenceId = r.body.data[0].id;
  r = await api(page, 'DELETE', `/api/tables/offences/${offenceId}`);
  check(r.status === 409 && r.body.error.code === 'IN_USE' && /disciplinary case/.test(r.body.error.message), 'Static Tables: an offence in use cannot be deleted, and it says where', JSON.stringify(r.body));
  r = await api(page, 'GET', '/api/tables/sanctions?q=Reprimand');
  const sanctionId = r.body.data.find((s) => s.name === 'Reprimand').id;
  r = await api(page, 'DELETE', `/api/tables/sanctions/${sanctionId}`);
  check(r.status === 409 && /disciplinary case/.test(r.body.error.message), 'Static Tables: a sanction in use cannot be deleted either', JSON.stringify(r.body));

  // ---- the audit trail
  const audit = async (table) => (await api(page, 'GET', `/api/audit?table=${table}&pageSize=100`)).body.data;
  const cases = await audit('discipline_cases');
  const forNew = cases.filter((a) => a.recordId === newNo);
  check(forNew.some((a) => a.action === 'INSERT') && forNew.filter((a) => a.action === 'UPDATE').length >= 3, 'Audit: the opening, the conclusion and the corrections of a case', forNew.map((a) => a.action).join(','));
  const forCancel = cases.filter((a) => a.recordId === cancelNo);
  check(forCancel.some((a) => a.action === 'INSERT') && forCancel.some((a) => a.action === 'UPDATE'), 'Audit: the opening and the cancellation');
  const detail = (await api(page, 'GET', `/api/audit/${forCancel.find((a) => a.action === 'UPDATE').id}`)).body.data;
  check(JSON.stringify(detail).includes('opened by mistake'), 'Audit: the cancellation keeps its reason');
  const corr = await audit('discipline_case_corrections');
  check(corr.length >= 1 && JSON.stringify((await api(page, 'GET', `/api/audit/${corr[0].id}`)).body.data).includes('extra duties'), 'Audit: a correction keeps its reason and what changed');

  // ---- the lists and the dialogs draw in this layout too
  await noOverflow(page, 'desktop light');
  check(errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// Each layout: every page and dialog, nothing overflowing, no browser errors
// ---------------------------------------------------------------------------
async function layoutPass(browser, viewport, theme) {
  const tag = `${viewport.width}-${theme}`;
  console.log(`\nAdministrator, ${viewport.width} px, ${theme}: every page and dialog`);
  const { context, page, errors, phone } = await open(browser, { viewport, theme });
  await signIn(page, ADMIN);
  check(await page.evaluate(() => document.documentElement.dataset.theme) === theme, `theme is ${theme}`);
  for (const [route, label] of [['initiate', 'Initiate Incident'], ['pending', 'Pending Cases'], ['concluded', 'Concluded Cases'], ['report', 'Disciplinary Report']]) {
    await go(page, `disciplinary/${route}`);
    if (route !== 'initiate') await waitRows(page);
    check(await main(page).locator('h1', { hasText: label }).count() === 1, `${label} draws`);
    await noOverflow(page, label);
    await shot(page, `${tag}-${route}`);
  }
  // each page's main dialog: Initiate (rating, then the case form), a pending case, a concluded case
  await go(page, 'disciplinary/initiate');
  const q = main(page).locator('input[name="q"]');
  await q.fill('bassey'); await q.press('Enter');
  await rowsOf(page, phone).first().waitFor();
  await noOverflow(page, 'Initiate results');
  await shot(page, `${tag}-initiate-results`);
  await rowsOf(page, phone).first().click();
  await dialogOf(page).waitFor();
  await shot(page, `${tag}-initiate-rating`);
  await dialogOf(page).getByRole('button', { name: 'Open Case' }).click();
  await dialogOf(page).locator('[name="incident_date"]').waitFor();
  if (phone) {
    // the sheet rises into place: wait for it to settle at the bottom edge
    const sheet = await dialogOf(page).evaluateHandle((d) => d).then(async (hd) => page.waitForFunction((d) => { const r = d.getBoundingClientRect(); return Math.abs(r.bottom - window.innerHeight) < 2 && r.width >= window.innerWidth - 1; }, hd, { timeout: 3000 }).then(() => true, () => false));
    check(sheet, 'on a phone the form is a bottom sheet');
  }
  await dialogOf(page).getByRole('button', { name: 'Open Case' }).last().click();
  await errorText(page, 'incident_date');
  await shot(page, `${tag}-initiate-form-errors`);
  await closeAll(page);
  await go(page, 'disciplinary/pending'); await waitRows(page);
  await rowsOf(page, phone).first().click(); await dialogOf(page).waitFor();
  await shot(page, `${tag}-pending-case`);
  await closeAll(page);
  if (phone) { await openFilters(page, true); await shot(page, `${tag}-pending-filters`); }
  await go(page, 'disciplinary/concluded'); await waitRows(page);
  await setFilter(page, phone, 'q', 'briggs');
  await rowsOf(page, phone).first().click(); await dialogOf(page).waitFor();
  await shot(page, `${tag}-concluded-case`);
  await closeAll(page);
  await go(page, 'ratings/edit/B0539');
  await page.locator('[role="tab"]', { hasText: 'Discipline' }).click(); await waitRows(page);
  await noOverflow(page, 'Discipline tab');
  await shot(page, `${tag}-discipline-tab`);
  check(errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// A role that may initiate and view but not conclude; a rating; a report-only role
// ---------------------------------------------------------------------------
async function limitedRoles(browser, db) {
  console.log('\nRoles that may not do everything');
  // B0588: initiate and view
  let s = await open(browser, { viewport: DESKTOP, theme: 'dark' });
  await signIn(s.page, INITIATOR);
  await go(s.page, 'disciplinary/pending'); await waitRows(s.page);
  for (const t of ['Initiate Incident', 'Pending Cases', 'Concluded Cases', 'Disciplinary Report']) check(await s.page.locator('a', { hasText: t }).filter({ visible: true }).count() > 0, `B0588 sees the ${t} tab`);
  await rowsOf(s.page, false).first().click(); await dialogOf(s.page).waitFor();
  check(await dialogOf(s.page).getByRole('button', { name: 'Conclude', exact: true }).count() === 0 && await dialogOf(s.page).getByRole('button', { name: 'Cancel Case' }).count() === 0, 'without approve and delete: no Conclude and no Cancel Case');
  check(await dialogOf(s.page).getByRole('button', { name: 'Print Case' }).count() === 1, 'but Print Case is there');
  await shot(s.page, 'initiator-dark-pending-case');
  await closeAll(s.page);
  const any = (await api(s.page, 'GET', '/api/disciplinary/cases/pending')).body.data[0];
  let r = await api(s.page, 'POST', `/api/disciplinary/cases/${any.id}/conclude`, { decision_date: '2026-11-16', sanction_id: 1, decision: 'x', authority: 'y' });
  check(r.status === 403, 'API: conclude answers 403 without approve', String(r.status));
  r = await api(s.page, 'POST', `/api/disciplinary/cases/${any.id}/cancel`, { reason: 'x' });
  check(r.status === 403, 'API: cancel answers 403 without delete');
  const done = (await api(s.page, 'GET', '/api/disciplinary/cases/concluded')).body.data[0];
  r = await api(s.page, 'POST', `/api/disciplinary/cases/${done.id}/correct`, { offence_id: 1, incident_date: '2026-11-10', what_happened: 'a', reported_by: 'b', decision_date: '2026-11-16', sanction_id: 1, decision: 'c', authority: 'd', reason: 'r' });
  check(r.status === 403, 'API: correct answers 403 without edit');
  await go(s.page, 'disciplinary/concluded'); await waitRows(s.page);
  await rowsOf(s.page, false).first().click(); await dialogOf(s.page).waitFor();
  check(await dialogOf(s.page).getByRole('button', { name: 'Correct' }).count() === 0, 'without edit: no Correct');
  await closeAll(s.page);
  await go(s.page, 'disciplinary/initiate');
  const q = main(s.page).locator('input[name="q"]');
  await q.fill('suleiman'); await q.press('Enter'); await rowsOf(s.page, false).first().waitFor();
  await rowsOf(s.page, false).first().click(); await dialogOf(s.page).waitFor();
  await dialogOf(s.page).getByRole('button', { name: 'Open Case' }).click(); await dialogOf(s.page).locator('form').waitFor();
  await dialogOf(s.page).locator('[name="incident_date"]').fill('16/11/2026');
  await choose(s.page, dialogOf(s.page), 'offence_id', 'Absence without leave');
  await dialogOf(s.page).locator('[name="what_happened"]').fill('Opened by the initiator role.');
  await dialogOf(s.page).locator('[name="reported_by"]').fill('Walk-through Officer');
  await dialogOf(s.page).getByRole('button', { name: 'Open Case' }).last().click();
  check(/opened for/.test(await toastText(s.page, /opened for/)), 'B0588 can open a case');
  check((await api(s.page, 'GET', '/api/disciplinary/rating/B0539/cases')).status === 200, 'it may view Concluded Cases, so the Discipline tab\'s list is open to it');
  check(s.errors.length === 0, 'no browser errors', s.errors.join(' | '));
  await s.context.close();

  // the Disciplinary Actions role (B0575) has everything
  s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, OFFICER);
  await go(s.page, 'disciplinary/pending'); await waitRows(s.page);
  await rowsOf(s.page, false).first().click(); await dialogOf(s.page).waitFor();
  check(await dialogOf(s.page).getByRole('button', { name: 'Conclude', exact: true }).count() === 1 && await dialogOf(s.page).getByRole('button', { name: 'Cancel Case' }).count() === 1, 'the old role "Disciplinary Actions" can conclude and cancel');
  await closeAll(s.page);
  const me = (await api(s.page, 'GET', '/api/auth/me')).body.data;
  check(['initiate', 'pending', 'concluded', 'report'].every((k) => me.privileges[`disciplinary.${k}`]) && me.privileges['disciplinary.pending'].includes('approve') && me.privileges['disciplinary.concluded'].includes('edit'), 'it holds every privilege of the module');
  check(s.errors.length === 0, 'no browser errors', s.errors.join(' | '));
  await s.context.close();

  // a rating
  s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, RATING);
  await go(s.page, 'ratings/my-details');
  check(await s.page.locator('[role="tab"]', { hasText: 'Discipline' }).count() === 0, 'a rating sees no Discipline tab on My Details');
  check(await s.page.locator('#rail nav a', { hasText: 'Disciplinary Action' }).count() === 0, 'a rating does not see Disciplinary Action in the sidebar');
  await s.page.goto(`${BASE}/app.html#disciplinary/pending`);
  await s.page.getByText('You Do Not Have Access to This Page').waitFor();
  check(/Do Not Have Access/.test(await main(s.page).innerText()), 'a rating who types the address gets the not-allowed state');
  for (const u of ['/api/disciplinary/cases/pending', '/api/disciplinary/cases/concluded', '/api/disciplinary/report', '/api/disciplinary/options', '/api/disciplinary/rating/B0539/cases', '/api/disciplinary/cases/1']) {
    check((await api(s.page, 'GET', u)).status === 403, `API: ${u} answers 403 to a rating`);
  }
  check((await api(s.page, 'POST', '/api/disciplinary/cases', { serviceNumber: 'B0539' })).status === 403, 'API: a rating cannot open a case');
  await s.page.evaluate(() => fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }));
  check((await api(s.page, 'GET', '/api/disciplinary/cases/pending')).status === 401, 'API: signed out answers 401');
  check(s.errors.length === 0, 'no browser errors', s.errors.join(' | '));
  await s.context.close();

  // a role that may only view the report
  s = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(s.page, REPORTER);
  check(await s.page.locator('#app-main h1', { hasText: 'Disciplinary Report' }).count() === 1, 'the report-only role lands on the Disciplinary Report');
  await waitRows(s.page);
  check(await s.page.locator('a', { hasText: 'Pending Cases' }).filter({ visible: true }).count() === 0, 'it sees only the report tab');
  await rowsOf(s.page, false).first().click(); await dialogOf(s.page).waitFor();
  check(await dialogOf(s.page).getByRole('button', { name: /Correct|Conclude|Cancel/ }).count() === 0 && await dialogOf(s.page).getByRole('button', { name: 'Print Case' }).count() === 1, 'it may read a concluded case but not change it');
  await closeAll(s.page);
  const conc = (await api(s.page, 'GET', '/api/disciplinary/report')).body.data[0];
  check((await api(s.page, 'GET', `/api/disciplinary/cases/${conc.id}`)).status === 200, 'API: it reads a concluded case');
  const pendingCase = await db.query("SELECT id FROM discipline_cases WHERE status = 'pending' LIMIT 1").then(([r]) => r[0]);
  check((await api(s.page, 'GET', `/api/disciplinary/cases/${pendingCase.id}`)).status === 403, 'API: but not a pending case');
  check((await api(s.page, 'GET', '/api/disciplinary/cases/pending')).status === 403 && (await api(s.page, 'GET', '/api/disciplinary/cases/concluded')).status === 403, 'API: nor the two lists');
  check(s.errors.length === 0, 'no browser errors', s.errors.join(' | '));
  await s.context.close();
}

async function main_() {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  const clean = async () => {
    await db.query("DELETE FROM users WHERE username = ?", [REPORTER.username]);
    await db.query("DELETE FROM roles WHERE name = 'WTDREPORT'");
  };
  await clean();
  await db.query("INSERT INTO roles (name, description) VALUES ('WTDREPORT', 'Walk-through: the report only')");
  const [[{ id: roleId }]] = [await db.query("SELECT id FROM roles WHERE name = 'WTDREPORT'").then(([r]) => r)];
  await db.query("INSERT INTO role_privileges (role_id, privilege_id) SELECT ?, id FROM privileges WHERE screen = 'disciplinary.report' AND action = 'view'", [roleId]);
  await db.query('INSERT INTO users (username, password_hash, full_name, role_id, service_number, is_active) VALUES (?, ?, ?, ?, ?, 1)', [REPORTER.username, await bcrypt.hash(REPORTER.password, 10), 'Walk-through Reporter', roleId, 'B0601F']);

  const browser = await chromium.launch();
  const state = {};
  try {
    await adminFlow(browser, state);
    for (const vp of [DESKTOP, PHONE]) for (const theme of ['light', 'dark']) await layoutPass(browser, vp, theme);
    await limitedRoles(browser, db);
  } finally {
    await browser.close();
    await clean();
    await db.end();
  }
  const seconds = Math.round((Date.now() - STARTED) / 1000);
  console.log(`\nTotal time ${seconds} s (limit ${LIMIT_SECONDS} s).`);
  if (seconds > LIMIT_SECONDS) { failures += 1; console.log('  FAIL  the walk-through took longer than five minutes'); }
  console.log(`${passes} checks passed, ${failures} failed.`);
  process.exit(failures ? 1 : 0);
}

main_().catch((e) => { console.error(e); process.exit(1); });
