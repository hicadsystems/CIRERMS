#!/usr/bin/env node
'use strict';

/*
 * Smoke walk-through of the whole app (WP10 Demo Finish). Uses the Playwright installed on the machine (not a project dependency):
 *
 *   npm run migrate:fresh && npm run seed       # a fresh demo database (the walk-through renames one rating and puts it back)
 *   npm start                                   # the app on :3000
 *   NODE_PATH=$(npm root -g) node tests/e2e/demo-walkthrough.js
 *
 * BASE changes the address; SHOTS=<dir> saves screenshots there. It reads .env for the database. Exits non-zero when a
 * check fails. Browser errors fail the run.
 *
 * Through the API as the Administrator: the dashboard's five tiles equal the counts of the real tables (and no Memos and
 * Mails); every demo name is in capitals and every account belongs to a rating; a rating's new official number becomes
 * its account's user name (audited), and a number another account holds is refused; privileges (no sign-in 401, a role
 * without the grant 403). Ctrl K: every screen of every module is found by its label, ratings are found by official
 * number and by name, Enter opens the screen, a role sees only the screens it may open.
 * Then every page of every module is opened (the Administrator, desktop 1440 px light and phone 390 px dark, side by
 * side), each page's main dialog is opened, nothing scrolls sideways, label and value rows
 * never break inside a word, the dashboard shows its five tiles; no browser errors anywhere.
 * The six Reports pages are walked like every other (from the router's own list); WP9's reports-walkthrough does their rules.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mysql = require('mysql2/promise');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:3000';
const SHOTS = process.env.SHOTS || '';
const ADMIN = { username: 'HICO001', password: 'Admin@123' };
const VIEWER = { username: 'B0902', password: 'Admin@123' }; // Training Viewer: no ratings.edit, no discipline
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
  const expected = new Set(); // no refusal is provoked through the screens: every browser error counts
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
async function closeAll(page) {
  for (let i = 0; i < 4 && (await dialogs(page).count()); i += 1) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
  }
}
async function noOverflow(page, label) {
  const wide = await page.evaluate(() => {
    const over = Array.from(document.querySelectorAll('#app-main *')).filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'auto' && (e.closest('table') || e.querySelector('table'))).length;
    return { page: document.documentElement.scrollWidth - window.innerWidth, main: document.querySelector('#app-main').scrollWidth - document.querySelector('#app-main').clientWidth, tables: over };
  });
  check(wide.page <= 1 && wide.main <= 1 && wide.tables === 0, `${label}: nothing scrolls sideways`, JSON.stringify(wide));
}

// ---- the rules through the API ------------------------------------------------------------------------
async function rules(browser, db) {
  console.log('\nThe rules through the API (Administrator)');
  const { context, page } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);

  // the dashboard's tiles are the real tables' counts
  const summary = (await api(page, 'GET', '/api/dashboard/summary')).body.data;
  const one = async (sql) => Number(Object.values((await db.query(sql))[0][0])[0]);
  check(!('memos' in summary), 'the summary has no Memos and Mails');
  const year = 'YEAR(CURDATE())';
  check(summary.members.total === await one('SELECT COUNT(*) FROM ratings'), 'Members: every rating', JSON.stringify(summary.members));
  check(summary.members.current + summary.members.former === summary.members.total, 'Members: current and former add up');
  check(summary.drafting.reportedThisYear === await one(`SELECT COUNT(*) FROM draft_rows WHERE status='reported' AND YEAR(wef)=${year}`), 'Drafting: reported this year', JSON.stringify(summary.drafting));
  check(summary.drafting.openBatches === await one("SELECT COUNT(*) FROM batches WHERE flow='DOD' AND status IN ('open','approved')"), 'Drafting: open batches');
  check(summary.discipline.pending === await one("SELECT COUNT(*) FROM discipline_cases WHERE status='pending'"), 'Disciplinary: pending', JSON.stringify(summary.discipline));
  check(summary.discipline.concludedThisYear === await one(`SELECT COUNT(*) FROM discipline_cases WHERE status='concluded' AND YEAR(decision_date)=${year}`), 'Disciplinary: concluded this year');
  check(summary.discharge.thisYear === await one(`SELECT COUNT(*) FROM discharge_rows WHERE status='closed' AND YEAR(exit_date)=${year}`), 'Discharge: this year', JSON.stringify(summary.discharge));
  check(summary.discharge.proposed === await one("SELECT COUNT(*) FROM discharge_rows WHERE status='pending'"), 'Discharge: proposed');
  check(summary.appraisals.openPeriods === await one("SELECT COUNT(*) FROM appraisal_periods WHERE status='open'"), 'Appraisals: open periods', JSON.stringify(summary.appraisals));
  for (const [name, n] of [['drafting this year', summary.drafting.reportedThisYear], ['open batches', summary.drafting.openBatches], ['pending cases', summary.discipline.pending], ['discharges this year', summary.discharge.thisYear], ['appraisals this month', summary.appraisals.month]]) {
    check(n > 0, `demo data: there is something to count for ${name}`, String(n));
  }

  // demo names in capitals; every account has a rating
  const [lower] = await db.query("SELECT service_number FROM ratings WHERE BINARY surname <> UPPER(surname) OR BINARY first_name <> UPPER(first_name) OR BINARY IFNULL(middle_name,'') <> UPPER(IFNULL(middle_name,''))");
  check(lower.length === 0, 'every demo name is in capitals', lower.map((r) => r.service_number).join(' '));
  const [orphans] = await db.query('SELECT u.username FROM users u LEFT JOIN ratings r ON r.service_number = u.service_number WHERE r.service_number IS NULL');
  check(orphans.length === 0, 'every account belongs to a rating');
  const [mismatch] = await db.query('SELECT username FROM users WHERE username <> service_number');
  check(mismatch.length === 0, 'every user name is its rating’s official number', mismatch.map((r) => r.username).join(' '));

  // the user name follows the official number
  const renamed = await api(page, 'PUT', '/api/ratings/B0902', { service_number: 'B0902Z' });
  check(renamed.status === 200, 'a rating’s official number can change', JSON.stringify(renamed.body).slice(0, 120));
  const [afterRename] = await db.query("SELECT username, service_number FROM users WHERE service_number = 'B0902Z'");
  check(afterRename.length === 1 && afterRename[0].username === 'B0902Z', 'the account’s user name followed the new official number', JSON.stringify(afterRename));
  const [auditRows] = await db.query("SELECT username FROM audit_trail WHERE table_name = 'users' AND record_id = 'B0902Z' AND action = 'UPDATE'");
  check(auditRows.length === 1 && auditRows[0].username === 'HICO001', 'the change of user name is in the audit trail');
  const taken = await api(page, 'PUT', '/api/ratings/B0902Z', { service_number: 'B0901' });
  check(taken.status === 409, 'a number another rating holds is refused (409)');
  const back = await api(page, 'PUT', '/api/ratings/B0902Z', { service_number: 'B0902' });
  const [restored] = await db.query("SELECT username FROM users WHERE service_number = 'B0902'");
  check(back.status === 200 && restored.length === 1 && restored[0].username === 'B0902', 'the number put back, the user name with it');
  const signed = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(signed.page, VIEWER);
  check(true, 'the account signs in again with the restored user name');
  await signed.context.close();

  // privileges
  const bare = await browser.newContext();
  const noToken = await bare.request.get(`${BASE}/api/dashboard/summary`);
  check(noToken.status() === 401, 'the dashboard needs a sign-in (401)');
  await bare.close();
  const viewer = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(viewer.page, VIEWER);
  check((await api(viewer.page, 'PUT', '/api/ratings/B0539', { first_name: 'X' })).status === 403, 'a role without ratings.edit may not change a rating (403)');
  check((await api(viewer.page, 'GET', '/api/dashboard/summary')).status === 403, 'a role without the dashboard grant is refused its numbers (403)');
  await viewer.context.close();
  await context.close();
}

// ---- Ctrl K -----------------------------------------------------------------------------------------------
async function palette(browser) {
  console.log('\nCtrl K');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);
  const labels = await page.evaluate(async () => {
    const { MODULES } = await import('/js/core/nav.js');
    const out = [];
    MODULES.forEach((m) => { if (m.tabs.length) m.tabs.forEach((t) => out.push({ label: `${m.short} · ${t.label}`, route: t.route })); else if (!m.soon) out.push({ label: m.label, route: null }); });
    return out;
  });
  const optionsFor = async (text) => {
    await page.keyboard.press('Control+k');
    const box = page.getByRole('combobox', { name: /Search/ });
    await box.waitFor();
    await box.fill(text);
    return box;
  };
  const optionTexts = () => page.locator('#palette-results [role="option"]').allInnerTexts();
  const missing = [];
  for (const item of labels) {
    await optionsFor(item.label);
    const options = await page.waitForFunction((label) => Array.from(document.querySelectorAll('#palette-results [role="option"] b')).some((b) => b.textContent === label), item.label, { timeout: 4000 }).then(() => true, () => false);
    if (!options) missing.push(item.label);
    await page.keyboard.press('Escape');
  }
  check(missing.length === 0, `Ctrl K reaches all ${labels.length} screens of every module`, missing.join(' | '));
  check(labels.some((l) => l.label.startsWith('Drafting')) && labels.some((l) => l.label.startsWith('Assess')) && labels.some((l) => l.label.startsWith('Special')), 'the screens include Drafting, Special Drafting and Naval Character Assessment');

  // a screen opens on Enter
  await optionsFor('Discharge · Discharge Report');
  await page.waitForFunction(() => document.querySelector('#palette-results [role="option"]'));
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#discharge/report');
  check(true, 'Enter opens the chosen screen');
  await page.waitForFunction(() => document.querySelector('#app-main h1')?.textContent === 'Discharge Report');

  // ratings by official number and by name
  const byNumber = await optionsFor('B0539');
  await page.waitForFunction(() => /B0539/.test(document.querySelector('#palette-results [role="group"][aria-label="Ratings"]')?.textContent || ''), null, { timeout: 8000 });
  check((await optionTexts()).some((t) => t.includes('B0539') && t.includes('OKONKWO')), 'a rating is found by official number');
  await byNumber.fill('okonkwo');
  await page.waitForFunction(() => /OKONKWO/.test(document.querySelector('#palette-results [role="group"][aria-label="Ratings"]')?.textContent || ''), null, { timeout: 8000 });
  check(true, 'a rating is found by name');
  await page.locator('#palette-results [role="group"][aria-label="Ratings"] [role="option"]').first().click();
  await page.waitForFunction(() => /^#ratings\/edit\//.test(location.hash));
  check(true, 'a rating found opens its record');

  // a role sees only its own screens
  const viewer = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(viewer.page, VIEWER);
  await viewer.page.keyboard.press('Control+k');
  const vbox = viewer.page.getByRole('combobox', { name: /Search/ });
  await vbox.fill('Disciplinary');
  await viewer.page.waitForTimeout(300);
  check((await viewer.page.locator('#palette-results [role="option"]').allInnerTexts()).every((t) => !/Pending Cases|Initiate Incident/.test(t)), 'a role without the grant is not offered Disciplinary Action’s screens');
  await vbox.fill('Training');
  await viewer.page.waitForFunction(() => /Training/.test(document.querySelector('#palette-results')?.textContent || ''));
  check(true, 'but is offered the Training screens');
  await viewer.context.close();
  check(errors.length === 0, 'Ctrl K: no browser errors', errors.join(' | '));
  await context.close();
}

// ---- every page, in one layout ---------------------------------------------------------------------------
const DIALOG_BUTTON = /^(New |Add |Create |Initiate |Draft a )/;
// pages that are forms or pickers: no list and no add button, so no dialog is expected
const NO_DIALOG = new Set(['ratings/upload', 'ratings/documents', 'ratings/my-details', 'advancement/upload', 'disciplinary/initiate', 'discharge/service', 'discharge/forms', 'discharge/upload', 'special-drafting/upload', 'training/review', 'training/history', 'training/upload', 'admin/password', 'ratings/edit/B0539']);

const NEEDS_SHIP = new Set(['reports/ship-history', 'reports/nominal-roll']);

async function pagesIn(browser, viewport, theme, routes) {
  const label = `${viewport.width}px ${theme}`;
  const { context, page, errors, phone } = await open(browser, { viewport, theme });
  await signIn(page, ADMIN);
  const bad = { sideways: [], noHeading: [], noDialog: [], dialogWide: [], breaks: [], half: [] };
  let dialogs_ = 0;
  for (const route of routes) {
    await go(page, route);
    const heading = await page.locator('#app-main h1').first().textContent();
    if (!heading) bad.noHeading.push(route);
    const wide = await page.evaluate(() => ({ page: document.documentElement.scrollWidth - window.innerWidth, main: document.querySelector('#app-main').scrollWidth - document.querySelector('#app-main').clientWidth }));
    if (wide.page > 1 || wide.main > 1) bad.sideways.push(`${route} ${JSON.stringify(wide)}`);
    if (route === 'dashboard') continue;
    // Ship History and Nominal Roll list nothing until a ship is picked: pick the first one
    if (NEEDS_SHIP.has(route)) {
      if (phone) {
        const panelHidden = await page.locator('#app-main [data-filters] > div').last().isHidden();
        if (panelHidden) await page.locator('#app-main [data-filters] button', { hasText: 'Filters' }).click();
      }
      await page.locator('#app-main [data-filters] .custom-dropdown-wrapper[name="shipId"] input:not(.custom-dropdown-hidden)').first().click();
      await page.locator('.custom-dropdown-list:visible .custom-dropdown-item:not(.cdd-placeholder)').first().click();
      await settle(page);
    }
    // the page's main dialog: its add button, else its first row
    let opened = false;
    const add = page.locator('#app-main button:visible').filter({ hasText: DIALOG_BUTTON }).first();
    if (await add.count() && await add.isEnabled()) {
      await add.click();
      opened = await dialogOf(page).waitFor({ timeout: 4000 }).then(() => true, () => false);
    }
    if (!opened) {
      const row = phone ? page.locator('#app-main .desk\\:hidden > div > button:visible').first() : page.locator('#app-main table tbody tr[tabindex]:visible').first();
      if (await row.count()) {
        await row.click();
        opened = await dialogOf(page).waitFor({ timeout: 4000 }).then(() => true, () => false);
      }
    }
    if (opened) {
      dialogs_ += 1;
      const d = await dialogOf(page).evaluate((el) => {
        const labels = Array.from(el.querySelectorAll('dl dt')).map((dt) => { const cs = getComputedStyle(dt); return { broken: cs.overflowWrap !== 'normal' || cs.wordBreak !== 'normal' || dt.scrollWidth > dt.clientWidth + 1 }; });
        // a lone panel (factPanels) takes the whole width, not the left half
        const half = Array.from(el.querySelectorAll('section')).filter((sec) => sec.querySelector(':scope > dl') && sec.parentElement.children.length === 1 && sec.parentElement.className.includes('gap-x-8') && sec.getBoundingClientRect().width < sec.parentElement.getBoundingClientRect().width * 0.9).length;
        return { fits: el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= window.innerWidth + 1, breaks: labels.filter((l) => l.broken).length, half };
      });
      if (!d.fits) bad.dialogWide.push(route);
      if (d.breaks) bad.breaks.push(route);
      if (d.half) bad.half.push(route);
      await closeAll(page);
    } else if (!NO_DIALOG.has(route)) {
      bad.noDialog.push(route);
    }
  }
  check(bad.noHeading.length === 0, `${label}: all ${routes.length} pages draw a heading`, bad.noHeading.join(' '));
  check(bad.sideways.length === 0, `${label}: nothing scrolls sideways`, bad.sideways.join(' | '));
  check(bad.noDialog.length === 0, `${label}: every page with a list or an add button opens its dialog (${dialogs_} opened)`, bad.noDialog.join(' '));
  check(bad.dialogWide.length === 0, `${label}: every dialog fits the screen`, bad.dialogWide.join(' '));
  check(bad.breaks.length === 0, `${label}: no label breaks inside a word`, bad.breaks.join(' '));
  check(bad.half.length === 0, `${label}: no dialog lays a lone panel out in half its width`, bad.half.join(' '));

  // the dashboard
  await go(page, 'dashboard');
  const tiles = await page.locator('#app-main .text-2xs.uppercase').allInnerTexts();
  check(['Members', 'Drafting', 'Disciplinary', 'Discharge', 'Appraisals'].every((t) => tiles.some((x) => x.toLowerCase() === t.toLowerCase())) && !tiles.some((x) => /memos/i.test(x)), `${label}: the dashboard shows its five tiles and no Memos and Mails`, tiles.join(', '));
  await noOverflow(page, `${label} dashboard`);
  await shot(page, `dashboard-${viewport.width}-${theme}`);
  check(errors.length === 0, `${label}: no browser errors`, errors.join(' | '));
  await context.close();
}

// every tab of the record opens
async function recordTabs(browser) {
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);
  await go(page, 'ratings/edit/B0539');
  const tabs = page.locator('#app-main [role="tablist"] [role="tab"]');
  const n = await tabs.count();
  check(n >= 10, `the record has its ${n} tabs`);
  for (let i = 0; i < n; i += 1) {
    await tabs.nth(i).click();
    await settle(page);
  }
  check(true, 'every tab of the record opens');
  check(errors.length === 0, 'record tabs: no browser errors', errors.join(' | '));
  await context.close();
}

async function main_() {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true });
  const browser = await chromium.launch();
  try {
    await rules(browser, db);
    await palette(browser);
    // every page the router knows without a parameter, then one of each with a parameter (Reports included)
    const probe = await open(browser, { viewport: DESKTOP, theme: 'light' });
    await signIn(probe.page, ADMIN);
    const routes = await probe.page.evaluate(async () => {
      const { PAGES } = await import('/js/core/nav.js');
      return PAGES.filter((p) => !p.pattern.includes(':') && p.screen !== 'soon' && p.pattern !== 'ratings/new').map((p) => p.pattern);
    });
    await probe.context.close();
    const [[batch]] = await db.query("SELECT id FROM batches WHERE flow='DOD' ORDER BY id LIMIT 1");
    const [[adv]] = await db.query("SELECT id FROM batches WHERE flow='DOA' ORDER BY id LIMIT 1");
    const [[train]] = await db.query('SELECT id FROM training_batches ORDER BY id LIMIT 1');
    const withIds = [...routes, 'ratings/edit/B0539', `drafting/batches/${batch.id}`, `advancement/promoted/${adv.id}`, `training/review/${train.id}`, `training/history/${train.id}`];
    console.log(`\nEvery page (${withIds.length}), desktop light and phone dark side by side`);
    await Promise.all([pagesIn(browser, DESKTOP, 'light', withIds), pagesIn(browser, PHONE, 'dark', withIds), recordTabs(browser)]);
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
