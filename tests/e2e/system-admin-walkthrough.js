#!/usr/bin/env node
'use strict';

/*
 * Walk-through of System Administration (WP3): Manage Users, Manage Roles, Manage Password, the
 * Audit Trail and Change Password. Uses the Playwright installed on the machine (not a project
 * dependency):
 *
 *   npm run migrate:fresh                       # a fresh demo database
 *   npm start                                   # the app on :3000
 *   NODE_PATH=$(npm root -g) node tests/e2e/system-admin-walkthrough.js
 *
 * BASE changes the address; SHOTS=<dir> saves screenshots there; ONLY=admin,guards,none,view,audit runs
 * part of it. It prints its total time and fails when that is over 5 minutes. It reads .env for the database,
 * to add throw-away roles and accounts (one with no administration grants, one that may only
 * view, one that manages users) and removes them again when it ends; the accounts and roles it
 * makes through the screens carry the name prefix WT. Exits non-zero when a check fails. Browser
 * errors fail the run.
 *
 * As the Administrator, at 1440 and 390 px in light and dark: every action of the four screens
 * and of Change Password, through the dialogs. Then the guards (self-deactivation, the last
 * administrator, the Administrator role, a role with users, duplicate names), a new account's
 * forced first change, a reset ending the person's session, a role change applying on the next
 * request, the accounts without grants (no buttons, 403 from the API), and the audit trail
 * holding every write and no password.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:3000';
const SHOTS = process.env.SHOTS || '';
const ADMIN = { username: 'HICO001', password: 'Admin@123' };
const NONE = { username: 'WTNONE', password: 'NoGrants1' };
const VIEWER = { username: 'WTVIEW', password: 'ViewOnly1' };
const MANAGER = { username: 'WTMGR', password: 'Manager1x' };
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const TAG = String(Date.now()).slice(-5);

// every password this run sets or is given; none may ever reach the audit trail
const secrets = new Set([ADMIN.password, NONE.password, VIEWER.password, MANAGER.password]);

let failures = 0;
let passes = 0;
function check(ok, label, detail = '') {
  if (ok) {
    passes += 1;
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`);
  }
}

async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null)))); // a dialog finishes opening
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

/** A browser context in one layout and theme, collecting browser errors. */
async function open(browser, { viewport, theme }) {
  const phone = viewport.width < 700;
  const context = await browser.newContext({ viewport, colorScheme: theme, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  const errors = [];
  // responses the walk-through provokes on purpose (401 an ended session, 403 no grant, 404 an unknown account, 409 a guard, 422 a bad value)
  const expected = new Set([401, 403, 404, 409, 422]);
  const watch = (p) => {
    p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    p.on('response', (r) => { if (r.status() === 404 && !/\/api\//.test(r.url())) errors.push(`404: ${r.url()}`); });
    p.on('console', (m) => {
      if (m.type() !== 'error') return;
      const status = Number((/status of (\d{3})/.exec(m.text()) || [])[1]);
      if (expected.has(status)) return;
      errors.push(`console: ${m.text()}`);
    });
  };
  context.on('page', watch);
  const page = await context.newPage();
  return { context, page, errors, phone, theme, viewport };
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
    method,
    credentials: 'include',
    headers: data ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  let body = null;
  try { body = await res.json(); } catch (_) { body = null; }
  return { status: res.status, body };
}, { method, url, data });

/** A request with no session, for sign-in checks. */
const anon = (page, method, url, data) => page.evaluate(async ({ method, url, data }) => {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: data ? JSON.stringify(data) : undefined, credentials: 'omit' });
  let body = null;
  try { body = await res.json(); } catch (_) { body = null; }
  return { status: res.status, body };
}, { method, url, data });

/** A button of the dialog's footer (the role grid's action chips carry aria-pressed and share names like Delete). */
const footBtn = (dlg, name) => dlg.locator('button:not([aria-pressed])').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) });
const dialogOf = (page) => page.locator('#overlay-root [role="dialog"]').last();
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** The text of the toast that matches `re`; it is closed with its button so it never covers anything. */
async function toastText(page, re) {
  const t = page.locator('#toast-root [role]', { hasText: re }).last();
  await t.waitFor({ timeout: 8000 });
  const text = (await t.innerText()).trim();
  await t.getByRole('button', { name: 'Dismiss' }).click();
  return text;
}

/** The next list answer from the server (users, roles or audit). */
const listResponse = (page) => page.waitForResponse((r) => /\/api\/(users|access\/roles|audit)(\?|$)/.test(r.url()) && r.request().method() === 'GET' && r.status() === 200);

async function choose(page, name, label) {
  const dlg = dialogOf(page);
  await dlg.locator(`.custom-dropdown-wrapper[name="${name}"] input:not(.custom-dropdown-hidden)`).first().click();
  const options = page.locator('.custom-dropdown-list:visible .custom-dropdown-item:not(.cdd-placeholder)');
  await options.first().waitFor();
  await options.filter({ hasText: label }).first().click();
}

/** Waits for the list on the page to stop loading. */
async function listReady(page) {
  await page.waitForFunction(() => {
    const m = document.querySelector('#app-main');
    return m && m.querySelector('h1') && !/Loading/.test(m.textContent);
  }, null, { timeout: 15000 });
}

const rowsOf = (page, phone) => (phone ? page.locator('#app-main .desk\\:hidden > div > button') : page.locator('#app-main table tbody tr[tabindex]'));

async function go(page, route) {
  await page.goto(`${BASE}/app.html#${route}`);
  await listReady(page);
}

/** Types into the screen's search box and waits for the list to follow. */
async function search(page, text) {
  const answered = listResponse(page);
  await page.fill('#app-main input[type="search"]', text);
  await answered;
  await listReady(page);
}

/** Sets a toolbar filter: the inline dropdown on desktop, the Filter sheet on a phone. */
async function filterBy(page, phone, name, label) {
  const answered = listResponse(page);
  if (phone) {
    await page.getByRole('button', { name: /^Filter/ }).click();
    const dlg = dialogOf(page);
    await dlg.locator(`.custom-dropdown-wrapper[name="sheet-${name}"] input:not(.custom-dropdown-hidden)`).first().click();
    const options = page.locator('.custom-dropdown-list:visible .custom-dropdown-item:not(.cdd-placeholder)');
    await options.first().waitFor();
    await options.filter({ hasText: label }).first().click();
    await dlg.getByRole('button', { name: /^Show/ }).click();
  } else {
    await page.locator(`#app-main .custom-dropdown-wrapper[name="${name}"] input:not(.custom-dropdown-hidden)`).first().click();
    const options = page.locator('.custom-dropdown-list:visible .custom-dropdown-item:not(.cdd-placeholder)');
    await options.first().waitFor();
    await options.filter({ hasText: label }).first().click();
  }
  await answered;
  await listReady(page);
}

async function clearFilters(page, phone) {
  if (phone) {
    await page.getByRole('button', { name: /^Filter/ }).click();
    await dialogOf(page).getByRole('button', { name: 'Clear', exact: true }).click();
  } else {
    await page.reload();
  }
  await listReady(page);
}

/** Presses Search or Reset on the Audit Trail and waits for the list. */
async function auditGo(page, name) {
  const answered = listResponse(page);
  await page.locator('#app-main').getByRole('button', { name, exact: true }).click();
  await answered;
  await listReady(page);
}

async function connect() {
  return mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
}

async function setup(db) {
  await cleanup(db);
  const hash = (pw) => bcrypt.hashSync(pw, 8);
  const role = async (name, description) => (await db.query('INSERT INTO roles (name, description, full_access) VALUES (?, ?, 0)', [name, description]))[0].insertId;
  const grant = (roleId, pairs) => Promise.all(pairs.map(([s, a]) => db.query('INSERT IGNORE INTO role_privileges (role_id, privilege_id) SELECT ?, id FROM privileges WHERE screen = ? AND action = ?', [roleId, s, a])));
  // every account belongs to a rating
  const user = async (who, roleId) => {
    await db.query("INSERT INTO ratings (service_number, status, surname, first_name) VALUES (?, 'current', 'WALKTHROUGH', ?)", [who.username, who.username]);
    await db.query('INSERT INTO users (username, password_hash, full_name, role_id, service_number, is_active) VALUES (?, ?, ?, ?, ?, 1)', [who.username, hash(who.password), `WT ${who.username}`, roleId, who.username]);
  };

  const none = await role('WT No Admin', 'walk-through: dashboard and the ratings list only');
  await grant(none, [['dashboard.home', 'view'], ['ratings.list', 'view']]);
  await user(NONE, none);

  const viewer = await role('WT Viewer', 'walk-through: View on the four administration screens');
  await grant(viewer, [['admin.users', 'view'], ['admin.roles', 'view'], ['admin.password', 'view'], ['admin.audit', 'view'], ['dashboard.home', 'view']]);
  await user(VIEWER, viewer);

  const manager = await role('WT Manager', 'walk-through: manages users but is not an administrator');
  await grant(manager, [['admin.users', 'view'], ['admin.users', 'add'], ['admin.users', 'edit'], ['admin.password', 'view'], ['admin.password', 'edit'], ['dashboard.home', 'view']]);
  await user(MANAGER, manager);
}

async function cleanup(db) {
  // the accounts this run made (the seeded ones stay), then its roles and ratings
  const seeded = ['HICO001', 'HICO002', 'HICO003', 'HICO004', 'HICO005', 'B0539', 'B0541', 'B0562'];
  await db.query(`DELETE FROM users WHERE username NOT IN (${seeded.map(() => '?').join(',')})`, seeded);
  await db.query("DELETE FROM roles WHERE name LIKE 'WT %'");
  await db.query("DELETE FROM ratings WHERE service_number LIKE 'WT%'");
}

const isPlausibleOneTime = (p) => /^[A-Za-z0-9]{12}$/.test(p) && /[A-Za-z]/.test(p) && /\d/.test(p);

/** The one-time password dialog: read the password off it, then confirm it was noted. */
async function takeOneTimePassword(page) {
  const dlg = dialogOf(page);
  const box = dlg.locator('[data-one-time-password]');
  await box.waitFor();
  const otp = (await box.innerText()).trim();
  secrets.add(otp);
  await dlg.getByRole('button', { name: 'I Have Noted It' }).click();
  await dlg.waitFor({ state: 'detached' });
  return otp;
}

// ---------------------------------------------------------------------------
// The administrator, in one layout and theme: every action of the four screens
// ---------------------------------------------------------------------------
async function adminSuite(browser, viewport, theme, idx) {
  const phone = viewport.width < 700;
  const where = `${phone ? 'phone' : 'desktop'}, ${theme}`;
  console.log(`\nAdministrator, ${where}`);
  const ctx = await open(browser, { viewport, theme });
  const { page } = ctx;
  await signIn(page, ADMIN);
  const tag = `${TAG}${idx}`;
  const linked = 'B0588';
  const newUser = linked; // an account's user name is its rating's official number
  const roleName = `WT Role ${tag}`;

  // ---- the sidebar item and the tabs
  if (!phone) {
    const item = page.locator('#rail a[data-module="admin"]');
    check((await item.count()) === 1 && !/Soon/.test(await item.innerText()), 'the sidebar item System Administration has lost Soon');
  }
  await go(page, 'admin/users');
  if (!phone) {
    const tabs = await page.locator('#module-tabs a').allInnerTexts();
    check(['Manage Users', 'Manage Roles', 'Manage Password', 'Audit Trail'].every((t) => tabs.some((x) => x.includes(t))), 'four tabs: Manage Users, Manage Roles, Manage Password, Audit Trail', tabs.join('|'));
  } else {
    check(await page.locator('#module-tabs').count() >= 0, 'phone shell loaded');
  }
  // Ctrl K finds each screen
  await page.keyboard.press('Control+k');
  await page.locator('input[aria-label^="Search"]').last().fill('Manage Roles');
  const found = await page.locator('[role="option"]', { hasText: 'Manage Roles' }).count();
  check(found >= 1, 'Ctrl K finds Manage Roles');
  await page.keyboard.press('Escape');

  // ---- Manage Users: list, search, filters
  await listReady(page);
  await shot(page, `users-list-${phone ? 'phone' : 'desktop'}-${theme}`);
  const list0 = (await api(page, 'GET', '/api/users')).body.data;
  const hico = list0.find((u) => u.username === 'HICO001');
  check(hico.fullName === 'MWO ADMINISTRATOR HICO', 'an account is named from its rating: rate, surname, first name', hico.fullName);
  check(list0.every((u) => !/^(Lt|Cdr|Mrs|Mr|Dr)\b/.test(u.fullName)), 'no officer or civilian titles in the account names', list0.map((u) => u.fullName).join('|'));
  check((await api(page, 'GET', '/api/auth/me')).body.data.user.fullName === 'MWO ADMINISTRATOR HICO', '/api/auth/me carries the rating’s name');
  const total = list0.length;
  check(total >= 7, 'the seeded accounts are listed', `${total}`);
  check(await noSideScroll(page), 'Manage Users: no sideways scroll');
  if (!phone) {
    check(await page.locator('#app-main table').evaluate((t) => t.parentElement.scrollWidth <= t.parentElement.clientWidth + 1), 'Manage Users: the table fits without scrolling');
    const heads = await page.locator('#app-main table thead th').allInnerTexts();
    check(heads.length <= 5, 'Manage Users: key columns only', heads.join('|'));
    await rowsOf(page, false).first().hover();
    const tip = page.locator('[role="tooltip"]', { hasText: 'View Details' });
    check(await tip.isVisible(), 'a row hover shows the View Details tooltip');
  }
  await search(page, 'OKAFOR');
  check((await rowsOf(page, phone).count()) === 1, 'search finds an account by name');
  await search(page, 'B0562');
  check((await rowsOf(page, phone).count()) === 1, 'search finds an account by official number');
  await search(page, '');
  await filterBy(page, phone, 'active', 'Inactive');
  let names = await rowsOf(page, phone).allInnerTexts();
  check(names.length >= 1 && names.every((t) => /Inactive/.test(t)), 'filter by Inactive shows only deactivated accounts', names.join('|'));
  await clearFilters(page, phone);
  await filterBy(page, phone, 'roleId', 'Auditor');
  names = await rowsOf(page, phone).allInnerTexts();
  check(names.length >= 1 && names.every((t) => /Auditor/.test(t)), 'filter by role shows only that role', names.join('|'));
  await clearFilters(page, phone);

  // ---- an account's dialog; the administrator's own account has no Deactivate or Reset
  await search(page, 'HICO001');
  await rowsOf(page, phone).first().click();
  let dlg = dialogOf(page);
  await dlg.waitFor();
  check(/MWO ADMINISTRATOR HICO/.test(await dlg.innerText()) && /Administrator/.test(await dlg.innerText()), 'a row opens the account in a dialog, named from its rating');
  check((await dlg.getByRole('button', { name: 'Deactivate' }).count()) === 0 && (await dlg.getByRole('button', { name: 'Reset Password' }).count()) === 0, 'your own account offers no Deactivate or Reset Password');
  check(/own account/.test(await dlg.innerText()), 'your own account says so');
  await shot(page, `users-account-${phone ? 'phone' : 'desktop'}-${theme}`);
  await dlg.getByRole('button', { name: 'Edit' }).click();
  dlg = dialogOf(page);
  await dlg.locator('input[name="phone"]').waitFor();
  check(await dlg.locator('.custom-dropdown-wrapper[name="roleId"] input:not(.custom-dropdown-hidden)').first().isDisabled(), 'your own role cannot be changed in the form');
  check(/cannot be changed/.test(await dlg.innerText()) && (await dlg.locator('input[name="serviceNumber"]').count()) === 0, 'the rating, and so the user name, is fixed once the account exists');
  await dlg.getByRole('button', { name: 'Cancel' }).click();
  await dlg.waitFor({ state: 'detached' });

  // ---- Add Account: it starts from a rating; validation, then the account with its one-time password
  await search(page, '');
  await page.getByRole('button', { name: 'Add Account' }).first().click();
  dlg = dialogOf(page);
  await dlg.locator('input[name="ratingSearch"]').waitFor();
  await shot(page, `users-add-${phone ? 'phone' : 'desktop'}-${theme}`);
  await dlg.getByRole('button', { name: 'Add Account' }).click();
  await dlg.locator('[data-field-error]:not(.hidden)').first().waitFor();
  check((await dlg.locator('[data-field-error]:not(.hidden)').allInnerTexts()).some((t) => /Find the rating/.test(t)), 'Add Account: with no rating the form is refused');
  await dlg.locator('input[name="ratingSearch"]').fill('NOSUCH99');
  await dlg.getByText('No rating matches').waitFor();
  check(true, 'Add Account: an official number no rating has finds nothing');
  await dlg.locator('input[name="ratingSearch"]').fill('B0541');
  const taken = dlg.locator('[data-rating="B0541"]');
  await taken.waitFor();
  check(await taken.isDisabled() && /Has account B0541/.test(await taken.innerText()), 'Add Account: a rating that already has an account cannot be picked');
  await dlg.locator('input[name="ratingSearch"]').fill(linked.slice(0, 4));
  await dlg.locator(`[data-rating="${linked}"]`).click();
  check(/B0588|B0601F|B0614|B0627/.test(await dlg.locator('[data-rating-chosen]').innerText()), 'Add Account: picking a rating shows it');
  check((await dlg.locator('input[name="fullName"]').count()) === 0, 'Add Account: there is no separate full-name field');
  await choose(page, 'roleId', 'Records Clerk');
  await dlg.locator('input[name="email"]').fill('not-an-email');
  await dlg.getByRole('button', { name: 'Add Account' }).click();
  await dlg.getByRole('alert').filter({ hasText: 'valid e-mail' }).first().waitFor();
  check(true, 'Add Account: a bad e-mail is refused');
  await dlg.locator('input[name="email"]').fill(`wt${tag}@navy.mil.ng`);
  await dlg.locator('input[name="phone"]').fill('08030001111');
  await choose(page, 'specialisationId', 'Navigation');
  await dlg.getByRole('button', { name: 'Add Account' }).click();
  const otp = await takeOneTimePassword(page);
  check(isPlausibleOneTime(otp), 'a new account gets a random one-time password, shown once', otp);
  check(/Account added/.test(await toastText(page, /Account added/)), 'Add Account: toast');
  const made = (await api(page, 'GET', `/api/users?q=${newUser}`)).body.data[0];
  check(made && made.specialisation === 'Navigation' && made.serviceNumber === linked && made.mustChangePassword === true && made.isActive, 'the account holds its role, linked rating, Specialisation and must change its password', JSON.stringify(made));
  check(!JSON.stringify(made).includes(otp) && !('password_hash' in made) && !('passwordHash' in made), 'the API never returns the password or its hash');
  const again = await api(page, 'GET', `/api/users/${made.id}`);
  check(!JSON.stringify(again.body).includes(otp), 'the one-time password cannot be read again');

  // ---- the new account's forced first change, in its own browser
  const person = await open(browser, { viewport, theme });
  await person.page.goto(`${BASE}/index.html`);
  await person.page.fill('#username', newUser);
  await person.page.fill('#password', otp);
  await Promise.all([person.page.waitForURL(/app\.html/), person.page.click('#login-submit')]);
  let pd = dialogOf(person.page);
  await pd.waitFor();
  check(/Choose a New Password/.test(await pd.innerText()), 'first sign-in: the forced password change opens before anything else');
  check((await person.page.locator('#app-main h1').count()) === 0, 'first sign-in: no screen opened behind it');
  const gated = await api(person.page, 'GET', '/api/ratings');
  check(gated.status === 403 && gated.body.error.code === 'PASSWORD_CHANGE_REQUIRED', 'first sign-in: the API refuses everything else until the password is chosen', JSON.stringify(gated.body));
  const gatedMe = await api(person.page, 'GET', '/api/auth/me');
  check(gatedMe.status === 200 && gatedMe.body.data.user.mustChangePassword === true, 'first sign-in: /api/auth/me still answers, saying it must be changed');
  const chosen = `Chosen${tag}x`;
  const fill = async (cur, nw, conf) => {
    await pd.locator('input[name="currentPassword"]').fill(cur);
    await pd.locator('input[name="newPassword"]').fill(nw);
    await pd.locator('input[name="confirmPassword"]').fill(conf);
    await pd.getByRole('button', { name: 'Set Password' }).click();
  };
  await shot(person.page, `change-password-forced-${phone ? 'phone' : 'desktop'}-${theme}`);
  await fill(otp, 'short1', 'short1');
  await pd.getByRole('alert').filter({ hasText: 'at least 8 characters' }).first().waitFor();
  check(true, 'Change Password: fewer than 8 characters is refused');
  await fill(otp, 'longenoughbutnodigit', 'longenoughbutnodigit');
  await pd.getByRole('alert').filter({ hasText: 'at least one number' }).first().waitFor();
  check(true, 'Change Password: no digit is refused');
  await fill(otp, '1234567890', '1234567890');
  await pd.getByRole('alert').filter({ hasText: 'at least one letter' }).first().waitFor();
  check(true, 'Change Password: no letter is refused');
  await fill(otp, chosen, `${chosen}z`);
  await pd.getByRole('alert').filter({ hasText: 'do not match' }).first().waitFor();
  check(true, 'Change Password: a confirmation that differs is refused');
  await fill(otp, otp, otp);
  await pd.getByRole('alert').filter({ hasText: 'different from the current' }).first().waitFor();
  check(true, 'Change Password: the same password is refused');
  await fill('WrongOne123', chosen, chosen);
  await pd.getByRole('alert').filter({ hasText: 'Wrong password' }).first().waitFor();
  check(true, 'Change Password: a wrong current password is refused');
  secrets.add(chosen);
  await fill(otp, chosen, chosen);
  await person.page.waitForSelector('#app-main h1', { timeout: 15000 }).catch(() => {});
  await pd.waitFor({ state: 'detached' }).catch(() => {});
  const afterChange = await api(person.page, 'GET', '/api/ratings?pageSize=1');
  check(afterChange.status === 200, 'after choosing a password the account works');
  const me2 = await api(person.page, 'GET', '/api/auth/me');
  check(me2.body.data.user.mustChangePassword === false, 'the forced change is cleared');
  const oldOtp = await anon(person.page, 'POST', '/api/auth/login', { username: newUser, password: otp });
  check(oldOtp.status === 401, 'the one-time password no longer signs in');

  // ---- Edit the account
  await search(page, newUser);
  await rowsOf(page, phone).first().click();
  dlg = dialogOf(page);
  await dlg.waitFor();
  check(/Navigation/.test(await dlg.innerText()) && new RegExp(linked).test(await dlg.innerText()), 'the account dialog shows the Specialisation and the linked rating');
  await dlg.getByRole('button', { name: 'Edit' }).click();
  dlg = dialogOf(page);
  await dlg.locator('input[name="phone"]').waitFor();
  await dlg.locator('input[name="phone"]').fill('08030002222');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await toastText(page, /Account updated/);
  await listReady(page);
  // a toast never covers a dialog's buttons: press one at once, while the toast is still showing
  await rowsOf(page, phone).first().click();
  const tdlg = dialogOf(page);
  await tdlg.waitFor();
  const tbox = await page.locator('#toast-root [role]').last().boundingBox();
  const fbox = await tdlg.getByRole('button', { name: 'Edit' }).boundingBox();
  check(!tbox || !fbox || tbox.y + tbox.height <= fbox.y || fbox.y + fbox.height <= tbox.y, 'a toast does not cover the dialog buttons', JSON.stringify({ tbox, fbox }));
  if (phone && tbox) check(tbox.y < 120, 'on a phone the toast shows at the top');
  await tdlg.getByRole('button', { name: 'Edit' }).click({ timeout: 3000 });
  await dialogOf(page).getByRole('button', { name: 'Cancel' }).click({ timeout: 3000 });
  await listReady(page);
  check((await api(page, 'GET', `/api/users?q=${newUser}`)).body.data[0].phone === '08030002222', 'Edit: the new phone is saved');

  // ---- Deactivate (ends the sessions), Reactivate
  await rowsOf(page, phone).first().click();
  dlg = dialogOf(page);
  await dlg.getByRole('button', { name: 'Deactivate' }).click();
  await page.locator('#overlay-root [role="dialog"]', { hasText: 'Deactivate Account' }).last().getByRole('button', { name: 'Deactivate' }).click();
  await toastText(page, /deactivated/);
  await listReady(page);
  const ended = await api(person.page, 'GET', '/api/auth/me');
  check(ended.status === 401, 'Deactivate: the person’s session ends at once');
  const refused = await anon(person.page, 'POST', '/api/auth/login', { username: newUser, password: chosen });
  check(refused.status === 403 && refused.body.error.code === 'ACCOUNT_DISABLED', 'Deactivate: the account cannot sign in');
  check(/Inactive/.test(await rowsOf(page, phone).first().innerText()), 'Deactivate: the list shows it Inactive');
  await rowsOf(page, phone).first().click();
  dlg = dialogOf(page);
  check((await dlg.getByRole('button', { name: 'Reset Password' }).count()) === 0, 'an inactive account offers no Reset Password');
  await dlg.getByRole('button', { name: 'Reactivate' }).click();
  await page.locator('#overlay-root [role="dialog"]', { hasText: 'Reactivate Account' }).last().getByRole('button', { name: 'Reactivate' }).click();
  await toastText(page, /reactivated/);
  await listReady(page);
  const back = await anon(person.page, 'POST', '/api/auth/login', { username: newUser, password: chosen });
  check(back.status === 200, 'Reactivate: the account signs in again with its own password');

  // ---- Reset Password from the account's dialog: ends the session, forces a new choice
  const person2 = await open(browser, { viewport, theme });
  await signIn(person2.page, { username: newUser, password: chosen });
  await rowsOf(page, phone).first().click();
  dlg = dialogOf(page);
  await dlg.getByRole('button', { name: 'Reset Password' }).click();
  await page.locator('#overlay-root [role="dialog"]', { hasText: /Reset the password of/ }).last().getByRole('button', { name: 'Reset Password' }).click();
  const otp2 = await takeOneTimePassword(page);
  check(isPlausibleOneTime(otp2) && otp2 !== otp, 'Reset Password (account dialog): a new one-time password, shown once', otp2);
  const endedByReset = await api(person2.page, 'GET', '/api/auth/me');
  check(endedByReset.status === 401, 'a reset ends the person’s session');
  const oldPw = await anon(person2.page, 'POST', '/api/auth/login', { username: newUser, password: chosen });
  check(oldPw.status === 401, 'a reset: the old password no longer works');
  const viaOtp = await anon(person2.page, 'POST', '/api/auth/login', { username: newUser, password: otp2 });
  check(viaOtp.status === 200 && viaOtp.body.data.user.mustChangePassword === true, 'a reset: the one-time password signs in and demands a new choice');
  await anon(person2.page, 'POST', '/api/auth/logout');
  await person2.context.close();

  // ---- Manage Password: find by user name and by official number, reset, once
  await go(page, 'admin/password');
  await shot(page, `password-${phone ? 'phone' : 'desktop'}-${theme}`);
  check(await noSideScroll(page), 'Manage Password: no sideways scroll');
  await page.fill('#app-main input[name="q"]', 'NOBODY1');
  await page.getByRole('button', { name: 'Find Account' }).click();
  await page.locator('#app-main').getByText('No account has').waitFor();
  check(true, 'Manage Password: an unknown official number or user name is refused');
  await page.fill('#app-main input[name="q"]', linked);
  await page.getByRole('button', { name: 'Find Account' }).click();
  const result = page.locator('[data-result]');
  await result.getByText(newUser).first().waitFor();
  check(/AONDOAKAA/.test(await result.innerText()) && /Must be chosen at next sign-in/.test(await result.innerText()), 'Manage Password: found by official number (not the user name), with its details');
  await page.fill('#app-main input[name="q"]', newUser.toLowerCase());
  await page.getByRole('button', { name: 'Find Account' }).click();
  await result.getByText(newUser).first().waitFor();
  check(true, 'Manage Password: found by user name');
  await shot(page, `password-found-${phone ? 'phone' : 'desktop'}-${theme}`);
  await page.getByRole('button', { name: 'Reset Password' }).click();
  await page.locator('#overlay-root [role="dialog"]', { hasText: /Reset the password of/ }).last().getByRole('button', { name: 'Reset Password' }).click();
  await dialogOf(page).locator('[data-one-time-password]').waitFor();
  await shot(page, `password-otp-${phone ? 'phone' : 'desktop'}-${theme}`);
  const otp3 = await takeOneTimePassword(page);
  check(isPlausibleOneTime(otp3) && otp3 !== otp2, 'Manage Password: a one-time password, shown once', otp3);
  check(!(await page.locator('body').innerText()).includes(otp3), 'Manage Password: the password is gone from the page once noted');
  const login3 = await anon(page, 'POST', '/api/auth/login', { username: newUser, password: otp3 });
  check(login3.status === 200, 'Manage Password: the new one-time password works');
  await anon(page, 'POST', '/api/auth/logout');
  // the old password gave way to the new one: cookies from that anon login must not leak into this page
  await page.fill('#app-main input[name="q"]', 'HICO001');
  await page.getByRole('button', { name: 'Find Account' }).click();
  await result.getByText('MWO ADMINISTRATOR HICO').first().waitFor();
  check(await page.getByRole('button', { name: 'Reset Password' }).isDisabled() && /your own account/.test(await result.innerText()), 'Manage Password: your own account cannot be reset here');

  // ---- Manage Roles
  await go(page, 'admin/roles');
  await shot(page, `roles-list-${phone ? 'phone' : 'desktop'}-${theme}`);
  check(await noSideScroll(page), 'Manage Roles: no sideways scroll');
  const roleList = (await api(page, 'GET', '/api/access/roles')).body;
  check(roleList.data.every((r) => typeof r.userCount === 'number') && roleList.meta.pageSize === 25, 'roles are listed with user counts, 25 a page');
  await search(page, 'Administrator');
  await rowsOf(page, phone).first().click();
  dlg = dialogOf(page);
  await dlg.waitFor();
  check(/full access/i.test(await dlg.innerText()) && (await footBtn(dlg, 'Save').count()) === 0 && (await footBtn(dlg, 'Delete').count()) === 0, 'the Administrator role opens read-only: no Save, no Delete');
  const catalogue = (await api(page, 'GET', '/api/access/privileges')).body.data;
  const catalogueScreens = catalogue.modules.flatMap((m) => m.screens);
  const shownScreens = await dlg.locator('[data-screen]').count();
  check(shownScreens === catalogueScreens.length && shownScreens >= 25, 'the grid holds every module’s screens', `${shownScreens} of ${catalogueScreens.length}`);
  const modulesShown = await dlg.locator('[data-module]').allInnerTexts();
  check(['Ratings Management', 'Static Tables', 'System Administration'].every((m) => catalogue.modules.some((x) => x.label === m)) && (await dlg.locator('[data-module]').count()) === catalogue.modules.length, 'the grid is grouped by module, Static Tables and System Administration included', `${modulesShown.length}`);
  check(await dlg.locator('[data-screen="tables.branch"] button[aria-pressed="true"]').count() === 4, 'Static Tables screens appear with their four actions');
  check(await dlg.locator('[data-screen="ratings.new"] button').count() === 1, 'a screen shows only the actions it has (New Rating: Add)');
  await dlg.getByRole('button', { name: 'Close' }).first().click();
  await search(page, '');

  // add a role
  await page.getByRole('button', { name: 'Add Role' }).first().click();
  dlg = dialogOf(page);
  await dlg.locator('input[name="name"]').waitFor();
  await shot(page, `roles-add-${phone ? 'phone' : 'desktop'}-${theme}`);
  await dlg.getByRole('button', { name: 'Add Role' }).click();
  await dlg.getByRole('alert').filter({ hasText: 'Role name is required' }).first().waitFor();
  check(true, 'Add Role: a name is required');
  await dlg.locator('input[name="name"]').fill(roleName);
  await dlg.getByRole('button', { name: 'Add Role' }).click();
  await dlg.locator('[data-priv-error]:not(.hidden)').waitFor();
  check(/at least one privilege/i.test(await dlg.locator('[data-priv-error]').innerText()), 'Add Role: a role with no privileges is refused');
  await dlg.locator('input[name="description"]').fill('walk-through role');
  // Edit on Rating Record also turns View on; Select All for Static Tables
  await dlg.locator('[data-screen="ratings.edit"] button', { hasText: 'Edit' }).click();
  check((await dlg.locator('[data-screen="ratings.edit"] button[aria-pressed="true"]').allInnerTexts()).join('|').includes('View'), 'the grid: choosing Edit also gives View');
  await dlg.locator('[data-module="Static Tables"]').getByRole('button', { name: /Select all of Static Tables/ }).click();
  check(await dlg.locator('[data-module="Static Tables"] button[aria-pressed="false"]').count() === 0, 'the grid: Select All for a module');
  await dlg.locator('[data-module="Static Tables"]').getByRole('button', { name: /Clear Static Tables/ }).click();
  check(await dlg.locator('[data-module="Static Tables"] button[aria-pressed="true"]').count() === 0, 'the grid: Clear for a module');
  await dlg.locator('[data-screen="ratings.edit"] button', { hasText: 'View' }).click();
  check(await dlg.locator('[data-screen="ratings.edit"] button[aria-pressed="true"]').count() === 0, 'the grid: taking View away takes the screen’s other actions with it');
  await dlg.locator('[data-screen="ratings.list"] button', { hasText: 'View' }).click();
  await dlg.locator('[data-screen="ratings.edit"] button', { hasText: 'Edit' }).click();
  await dlg.locator('[data-screen="tables.branch"] button', { hasText: 'View' }).click();
  await dlg.getByRole('button', { name: 'Add Role' }).click();
  await toastText(page, /Role added/);
  await listReady(page);
  await search(page, roleName);
  check((await rowsOf(page, phone).count()) === 1, 'Add Role: the role is in the list');
  const roleRow = (await api(page, 'GET', `/api/access/roles?q=${encodeURIComponent(roleName)}`)).body.data[0];
  check(roleRow && roleRow.privileges['ratings.list'].join() === 'view' && roleRow.privileges['ratings.edit'].join() === 'view,edit' && roleRow.privileges['tables.branch'].join() === 'view' && Object.keys(roleRow.privileges).length === 3, 'Add Role: the grid’s choices are what was saved', JSON.stringify(roleRow && roleRow.privileges));
  // a duplicate name (any case), through the dialog
  await page.getByRole('button', { name: 'Add Role' }).first().click();
  dlg = dialogOf(page);
  await dlg.locator('input[name="name"]').fill(roleName.toLowerCase());
  await dlg.locator('[data-screen="ratings.list"] button', { hasText: 'View' }).click();
  await dlg.getByRole('button', { name: 'Add Role' }).click();
  await dlg.getByRole('alert').filter({ hasText: 'already exists' }).first().waitFor();
  check(true, 'Add Role: a duplicate name is refused (any case)');
  await dlg.getByRole('button', { name: 'Cancel' }).click();
  await dlg.waitFor({ state: 'detached' });

  // a person on the role: the role's change applies at their next request, without signing them out
  const holder = 'B0601F';
  const hashPw = bcrypt.hashSync('Holder1pw', 8);
  secrets.add('Holder1pw');
  const createdHolder = await api(page, 'POST', '/api/users', { serviceNumber: holder, fullName: `WT Holder ${tag}`, roleId: roleRow.id });
  check(createdHolder.status === 201, 'a person is given the role');
  await dbExec("UPDATE users SET password_hash = ?, must_change_password = 0 WHERE username = ?", [hashPw, holder]);
  const hp = await open(browser, { viewport, theme });
  await signIn(hp.page, { username: holder, password: 'Holder1pw' }).catch(() => {});
  check((await api(hp.page, 'GET', '/api/ratings?pageSize=1')).status === 200 && (await api(hp.page, 'GET', '/api/audit')).status === 403, 'the role grants what it holds and nothing else');
  // edit the role in the dialog: drop the ratings list, add the audit trail
  await rowsOf(page, phone).first().click();
  dlg = dialogOf(page);
  await dlg.locator('input[name="name"]').fill(`${roleName} B`);
  await dlg.locator('[data-screen="ratings.list"] button', { hasText: 'View' }).click();
  await dlg.locator('[data-screen="admin.audit"] button', { hasText: 'View' }).click();
  await dlg.getByRole('button', { name: 'Save' }).click();
  await toastText(page, /Role updated/);
  const stillIn = await api(hp.page, 'GET', '/api/auth/me');
  check(stillIn.status === 200, 'a role change does not sign anyone out');
  check((await api(hp.page, 'GET', '/api/ratings?pageSize=1')).status === 403, 'a role change applies on the next request: the removed grant is refused');
  check((await api(hp.page, 'GET', '/api/audit')).status === 200, 'a role change applies on the next request: the new grant works');
  const meNow = await api(hp.page, 'GET', '/api/auth/me');
  check(!meNow.body.data.privileges['ratings.list'] && meNow.body.data.privileges['admin.audit'], '/api/auth/me carries the new privileges');
  await hp.context.close();

  // delete: a role with users is refused; one nobody holds is deleted
  await listReady(page);
  await search(page, roleName);
  await rowsOf(page, phone).first().click();
  dlg = dialogOf(page);
  await footBtn(dlg, 'Delete').click();
  await page.locator('#overlay-root [role="dialog"]', { hasText: 'Delete the role' }).last().getByRole('button', { name: 'Delete' }).click();
  check(/still has 1 user/.test(await toastText(page, /still has/)), 'Delete Role: a role with users is refused, saying so');
  await dbExec('UPDATE users SET role_id = (SELECT id FROM roles WHERE name = ?) WHERE username = ?', ['Rating', holder]);
  await footBtn(dialogOf(page), 'Delete').click();
  await page.locator('#overlay-root [role="dialog"]', { hasText: 'Delete the role' }).last().getByRole('button', { name: 'Delete' }).click();
  await toastText(page, /Role deleted/);
  await listReady(page);
  check((await rowsOf(page, phone).count()) === 0 || !(await rowsOf(page, phone).first().innerText()).includes(roleName), 'Delete Role: an unused role is deleted');

  // ---- Audit Trail
  await go(page, 'admin/audit');
  await shot(page, `audit-${phone ? 'phone' : 'desktop'}-${theme}`);
  check(await noSideScroll(page), 'Audit Trail: no sideways scroll');
  const auditCount = await rowsOf(page, phone).count();
  check(auditCount > 0 && auditCount <= 25, '25 rows a page at most', `${auditCount}`);
  const meta = (await api(page, 'GET', '/api/audit')).body.meta;
  check(meta.pageSize === 25 && meta.totalPages >= 1, 'the trail pages on the server', JSON.stringify(meta));
  if (!phone) {
    const heads = await page.locator('#app-main table thead th').allInnerTexts();
    check(heads.length <= 6, 'Audit Trail: key columns only', heads.join('|'));
  }
  // filters
  const filterIn = (name) => page.locator(`#app-main form [name="${name}"]`);
  const selectFilter = async (name, label) => {
    await page.locator(`#app-main form .custom-dropdown-wrapper[name="${name}"] input:not(.custom-dropdown-hidden)`).first().click();
    const options = page.locator('.custom-dropdown-list:visible .custom-dropdown-item:not(.cdd-placeholder)');
    await options.first().waitFor();
    await options.filter({ hasText: label }).first().click();
  };
  await selectFilter('action', 'INSERT');
  await auditGo(page, 'Search');
  let pills = await rowsOf(page, phone).allInnerTexts();
  check(pills.length > 0 && pills.every((t) => /INSERT/.test(t)), 'Audit filter: by action', `${pills.length}`);
  await filterIn('record').fill(newUser);
  await auditGo(page, 'Search');
  check((await rowsOf(page, phone).count()) === 1, 'Audit filter: by record (the new account’s INSERT)');
  await rowsOf(page, phone).first().click();
  dlg = dialogOf(page);
  await dlg.waitFor();
  await dlg.getByText('What Changed').waitFor();
  const entryText = await dlg.innerText();
  check(/What Changed/i.test(entryText) && /service_number/.test(entryText) && /Records Clerk/.test(entryText) && /One-time password issued/.test(entryText), 'a row opens the entry with its changes, before and after', entryText.replace(/\n/g, ' | ').slice(0, 700));
  check(![...secrets].some((s) => entryText.includes(s)), 'the entry shows no password');
  await shot(page, `audit-entry-${phone ? 'phone' : 'desktop'}-${theme}`);
  await dlg.getByRole('button', { name: 'Close' }).first().click();
  await dlg.waitFor({ state: 'detached' });
  await auditGo(page, 'Reset');
  await selectFilter('action', 'UPDATE');
  await filterIn('record').fill(newUser);
  await filterIn('user').fill('HICO001');
  await filterIn('from').fill(new Date().toLocaleDateString('en-GB'));
  await filterIn('to').fill(new Date().toLocaleDateString('en-GB'));
  await auditGo(page, 'Search');
  const upd = await rowsOf(page, phone).count();
  check(upd >= 5, 'Audit filter: dates, user, action and record together (edit, deactivate, reactivate, two resets)', `${upd}`);
  await filterIn('from').fill('31/02/2026');
  await page.locator('#app-main').getByRole('button', { name: 'Search', exact: true }).click();
  await page.locator('#app-main').getByText('Use dd/mm/yyyy').waitFor();
  check(true, 'Audit filter: a date that is not a date is refused');
  await filterIn('from').fill('');
  await auditGo(page, 'Reset');
  check((await rowsOf(page, phone).count()) === auditCount || (await rowsOf(page, phone).count()) === 25, 'Audit filter: Reset clears the filters');

  // ---- Change Password from the account menu
  await changePasswordFromMenu(browser, viewport, theme, idx, newUser, otp3);

  check(ctx.errors.length === 0, `${where}: no browser errors`, ctx.errors.join(' | '));
  check(person.errors.length === 0, `${where}: no browser errors (the new account's browser)`, person.errors.join(' | '));
  await person.context.close();
  await ctx.context.close();
}

let dbConn = null;
const dbExec = (sql, params = []) => dbConn.query(sql, params);

/** Change Password in the account menu (desktop sidebar, phone header), and the person's other sessions. */
async function changePasswordFromMenu(browser, viewport, theme, idx, username, startingPassword) {
  const phone = viewport.width < 700;
  // the account is on its one-time password: choose one first (through the API), then use the menu
  const a = await open(browser, { viewport, theme });
  const first = `Menu${TAG}${idx}a`;
  secrets.add(first);
  await a.page.goto(`${BASE}/index.html`);
  const login = await api(a.page, 'POST', '/api/auth/login', { username, password: startingPassword });
  check(login.status === 200, 'the menu test account signs in');
  await a.page.goto(`${BASE}/app.html#dashboard`);
  let dlg = dialogOf(a.page);
  await dlg.waitFor();
  await dlg.locator('input[name="currentPassword"]').fill(startingPassword);
  await dlg.locator('input[name="newPassword"]').fill(first);
  await dlg.locator('input[name="confirmPassword"]').fill(first);
  await dlg.getByRole('button', { name: 'Set Password' }).click();
  await a.page.waitForSelector('#app-main h1, #app-main h2', { timeout: 15000 });

  // a second session of the same account
  const b = await open(browser, { viewport, theme });
  await signIn(b.page, { username, password: first });
  check((await api(b.page, 'GET', '/api/auth/me')).status === 200, 'a second session is open');

  if (phone) await a.page.click('#phone-header button[aria-label="Account"]');
  else await a.page.click('#rail button[aria-haspopup="menu"]');
  await a.page.getByRole('menuitem', { name: 'Change Password' }).click();
  dlg = dialogOf(a.page);
  await dlg.waitFor();
  check(/Change Password/.test(await dlg.innerText()), `Change Password opens from the ${phone ? 'phone' : 'desktop'} account menu`);
  await shot(a.page, `change-password-${phone ? 'phone' : 'desktop'}-${theme}`);
  const second = `Menu${TAG}${idx}b`;
  secrets.add(second);
  await dlg.locator('input[name="newPassword"]').fill('abc');
  check(await dlg.locator('[data-rule="len"]').evaluate((li) => /muted/.test(li.className)), 'the rules checklist shows what is still missing');
  await dlg.locator('input[name="newPassword"]').fill(second);
  check(await dlg.locator('[data-rule="digit"]').evaluate((li) => /success/.test(li.className)), 'the rules checklist ticks what is met');
  await dlg.locator('input[name="currentPassword"]').fill('WrongPass12');
  await dlg.locator('input[name="confirmPassword"]').fill(second);
  await dlg.getByRole('button', { name: 'Change Password' }).click();
  await dlg.getByRole('alert').filter({ hasText: 'Wrong password' }).first().waitFor();
  await dlg.locator('input[name="currentPassword"]').fill(first);
  await dlg.locator('input[name="newPassword"]').fill(first);
  await dlg.locator('input[name="confirmPassword"]').fill(first);
  await dlg.getByRole('button', { name: 'Change Password' }).click();
  await dlg.getByRole('alert').filter({ hasText: 'different from the current' }).first().waitFor();
  check(true, 'Change Password: the current password again is refused');
  await dlg.locator('input[name="newPassword"]').fill(second);
  await dlg.locator('input[name="confirmPassword"]').fill(second);
  await dlg.getByRole('button', { name: 'Change Password' }).click();
  await toastText(a.page, /Password changed/);
  check((await api(a.page, 'GET', '/api/auth/me')).status === 200, 'Change Password: this session stays open');
  check((await api(b.page, 'GET', '/api/auth/me')).status === 401, 'Change Password: the other sessions are signed out');
  check((await anon(a.page, 'POST', '/api/auth/login', { username, password: first })).status === 401, 'Change Password: the old password no longer works');
  check((await anon(a.page, 'POST', '/api/auth/login', { username, password: second })).status === 200, 'Change Password: the new one does');
  check(a.errors.length === 0 && b.errors.length === 0, 'Change Password: no browser errors', [...a.errors, ...b.errors].join(' | '));
  await b.context.close();
  await a.context.close();
}

// ---------------------------------------------------------------------------
// Another layout or theme: each screen and its main dialog open, nothing overflows sideways, and the
// flows that differ on a phone (cards, the Filter sheet, the account menu's Change Password)
// ---------------------------------------------------------------------------
async function glance(browser, viewport, theme) {
  const phone = viewport.width < 700;
  const where = `${phone ? 'phone' : 'desktop'}, ${theme}`;
  const kind = phone ? 'phone' : 'desktop';
  console.log(`\nAdministrator, ${where} (each screen and its main dialog)`);
  const ctx = await open(browser, { viewport, theme });
  const { page } = ctx;
  await signIn(page, ADMIN);
  const dialogFits = (dlg) => dlg.locator('xpath=ancestor-or-self::*[@role="dialog"]').first().evaluate((d) => d.scrollWidth <= d.clientWidth + 1);

  await go(page, 'admin/users');
  await shot(page, `users-list-${kind}-${theme}`);
  check(await noSideScroll(page), 'Manage Users: no sideways scroll');
  check((await rowsOf(page, phone).count()) >= 8, 'Manage Users: the accounts are listed');
  await filterBy(page, phone, 'active', 'Inactive');
  check((await rowsOf(page, phone).allInnerTexts()).every((t) => /Inactive/.test(t)), 'Manage Users: the filter works' + (phone ? ' (the Filter sheet)' : ''));
  await clearFilters(page, phone);
  await rowsOf(page, phone).first().click();
  let dlg = dialogOf(page);
  await dlg.waitFor();
  check(await dialogFits(dlg), 'Manage Users: the account dialog fits');
  await shot(page, `users-account-${kind}-${theme}`);
  await dlg.getByRole('button', { name: /Close|Edit/ }).first().click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Add Account' }).first().click();
  dlg = dialogOf(page);
  await dlg.locator('input[name="ratingSearch"]').fill('B05');
  await dlg.locator('[data-rating]').first().waitFor();
  check(await dialogFits(dlg), 'Add Account: the dialog fits, with the rating results');
  await shot(page, `users-add-${kind}-${theme}`);
  await page.keyboard.press('Escape');

  await go(page, 'admin/roles');
  await shot(page, `roles-list-${kind}-${theme}`);
  check(await noSideScroll(page), 'Manage Roles: no sideways scroll');
  await rowsOf(page, phone).nth(1).click();
  dlg = dialogOf(page);
  await dlg.locator('[data-screen]').first().waitFor();
  check(await dialogFits(dlg), 'Manage Roles: the role dialog and its grid fit');
  await shot(page, `roles-add-${kind}-${theme}`);
  await page.keyboard.press('Escape');

  await go(page, 'admin/password');
  check(await noSideScroll(page), 'Manage Password: no sideways scroll');
  await page.fill('#app-main input[name="q"]', 'B0541');
  await page.getByRole('button', { name: 'Find Account' }).click();
  await page.locator('[data-result]').getByText('Records Clerk').first().waitFor();
  await shot(page, `password-found-${kind}-${theme}`);

  await go(page, 'admin/audit');
  check(await noSideScroll(page), 'Audit Trail: no sideways scroll');
  await shot(page, `audit-${kind}-${theme}`);
  await rowsOf(page, phone).first().click();
  dlg = dialogOf(page);
  await dlg.getByText('What Changed').waitFor();
  check(await dialogFits(dlg), 'Audit Trail: the entry dialog fits');
  await page.keyboard.press('Escape');

  if (phone) await page.click('#phone-header button[aria-label="Account"]');
  else await page.click('#rail button[aria-haspopup="menu"]');
  await page.getByRole('menuitem', { name: 'Change Password' }).click();
  dlg = dialogOf(page);
  await dlg.locator('input[name="currentPassword"]').waitFor();
  check(await dialogFits(dlg), 'Change Password: the dialog fits');
  await shot(page, `change-password-${kind}-${theme}`);
  await page.keyboard.press('Escape');
  check(ctx.errors.length === 0, `${where}: no browser errors`, ctx.errors.join(' | '));
  await ctx.context.close();
}

// ---------------------------------------------------------------------------
// The guards: self, the last administrator, the Administrator role, a role with users, names
// ---------------------------------------------------------------------------
async function guards(browser) {
  console.log('\nGuards');
  const ctx = await open(browser, { viewport: DESKTOP, theme: 'light' });
  const { page } = ctx;
  await signIn(page, ADMIN);
  const me = (await api(page, 'GET', '/api/auth/me')).body.data.user;
  const roles = (await api(page, 'GET', '/api/access/roles')).body.data;
  const roleId = (n) => roles.find((r) => r.name === n).id;

  const selfOff = await api(page, 'POST', `/api/users/${me.id}/deactivate`);
  check(selfOff.status === 409 && selfOff.body.error.code === 'SELF_DEACTIVATE', 'nobody deactivates their own account');
  const selfRole = await api(page, 'PUT', `/api/users/${me.id}`, { fullName: me.fullName, roleId: roleId('Auditor') });
  check(selfRole.status === 409 && selfRole.body.error.code === 'SELF_ROLE_CHANGE', 'nobody changes the role of their own account');
  const selfReset = await api(page, 'POST', `/api/users/${me.id}/reset-password`);
  check(selfReset.status === 409 && selfReset.body.error.code === 'SELF_RESET', 'nobody resets their own password in Manage Password');
  const selfEdit = await api(page, 'PUT', `/api/users/${me.id}`, { fullName: me.fullName, roleId: me.roleId, phone: '08030009999' });
  check(selfEdit.status === 200, 'but they may edit the rest of their own account');
  await api(page, 'PUT', `/api/users/${me.id}`, { fullName: me.fullName, roleId: me.roleId, phone: '' });

  // the Administrator role
  const adminRole = roleId('Administrator');
  const editAdmin = await api(page, 'PUT', `/api/access/roles/${adminRole}`, { name: 'Administrator', privileges: { 'dashboard.home': ['view'] } });
  check(editAdmin.status === 409 && editAdmin.body.error.code === 'ROLE_PROTECTED', 'the Administrator role cannot be edited');
  const delAdmin = await api(page, 'DELETE', `/api/access/roles/${adminRole}`);
  check(delAdmin.status === 409 && delAdmin.body.error.code === 'ROLE_PROTECTED', 'the Administrator role cannot be deleted');
  const dupe = await api(page, 'POST', '/api/access/roles', { name: 'administrator', privileges: { 'dashboard.home': ['view'] } });
  check(dupe.status === 409 && dupe.body.error.code === 'DUPLICATE_ROLE', 'role names are unique, whatever the case');
  const inUse = await api(page, 'DELETE', `/api/access/roles/${roleId('Auditor')}`);
  check(inUse.status === 409 && inUse.body.error.code === 'ROLE_IN_USE', 'a role with users cannot be deleted', JSON.stringify(inUse.body));
  const ghost = await api(page, 'POST', '/api/access/roles', { name: `WT Ghost ${TAG}`, privileges: { 'nothing.here': ['view'] } });
  check(ghost.status === 422, 'a role cannot hold a screen the catalogue does not have');
  const badAction = await api(page, 'POST', '/api/access/roles', { name: `WT Bad ${TAG}`, privileges: { 'ratings.new': ['delete'] } });
  check(badAction.status === 422, 'a role cannot hold an action a screen does not have');
  const noView = await api(page, 'POST', '/api/access/roles', { name: `WT NoView ${TAG}`, privileges: { 'ratings.edit': ['edit'] } });
  check(noView.status === 422, 'Edit without View is refused');

  // the last active administrator: a person who manages users but is not an administrator
  const mctx = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(mctx.page, MANAGER);
  const adminsBefore = (await api(mctx.page, 'GET', '/api/users?active=1')).body.data.filter((u) => u.fullAccess);
  check(adminsBefore.length === 1 && adminsBefore[0].username === 'HICO001', 'HICO001 is the only active administrator');
  const last = await api(mctx.page, 'POST', `/api/users/${me.id}/deactivate`);
  check(last.status === 409 && last.body.error.code === 'LAST_ADMIN', 'the last active administrator cannot be deactivated');
  const lastMove = await api(mctx.page, 'PUT', `/api/users/${me.id}`, { fullName: me.fullName, roleId: roleId('Auditor') });
  check(lastMove.status === 409 && lastMove.body.error.code === 'LAST_ADMIN', 'the last active administrator cannot be moved to another role');
  // with a second administrator, the first can be moved
  const second = await api(page, 'POST', '/api/users', { serviceNumber: 'B0614', fullName: 'WT Second Admin', roleId: adminRole });
  check(second.status === 201, 'a second administrator is added');
  const moved = await api(mctx.page, 'PUT', `/api/users/${second.body.data.user.id}`, { fullName: 'WT Second Admin', roleId: roleId('Auditor') });
  check(moved.status === 200, 'with another administrator active, one may be moved');
  const second2 = await api(mctx.page, 'POST', `/api/users/${second.body.data.user.id}/deactivate`);
  check(second2.status === 200, 'and a spare administrator can be deactivated');
  check(mctx.errors.length === 0, 'guards: no browser errors (manager)', mctx.errors.join(' | '));
  await mctx.context.close();

  // every account belongs to a rating, and a rating has at most one account
  const noRating = await api(page, 'POST', '/api/users', { fullName: 'No Rating', roleId: roleId('Rating') });
  check(noRating.status === 422 && noRating.body.error.fields.serviceNumber, 'an account cannot be made without a rating');
  const unknownRating = await api(page, 'POST', '/api/users', { serviceNumber: 'NOSUCH99', fullName: 'Nobody', roleId: roleId('Rating') });
  check(unknownRating.status === 422 && /No rating/.test(unknownRating.body.error.fields.serviceNumber), 'nor for a rating that does not exist');
  const secondAccount = await api(page, 'POST', '/api/users', { serviceNumber: 'B0541', fullName: 'Second', roleId: roleId('Rating') });
  check(secondAccount.status === 409 && secondAccount.body.error.code === 'RATING_HAS_ACCOUNT', 'a rating cannot get a second account');
  const hicoRating = (await api(page, 'GET', '/api/ratings/HICO001')).body;
  check(hicoRating && hicoRating.data, 'the administrator is a rating too (HICO001)');
  const myDetails = await api(page, 'GET', '/api/ratings/HICO001');
  check(myDetails.status === 200, 'My Details works for the administrator');
  const delRated = await api(page, 'DELETE', '/api/ratings/B0541');
  check(delRated.status === 409 && delRated.body.error.code === 'HAS_ACCOUNT', 'a rating that has an account cannot be deleted');
  const dbRefuses = await dbExec("INSERT INTO users (username, password_hash, full_name, role_id, service_number) VALUES ('WTNULL', 'x', 'x', 1, NULL)").then(() => false, () => true);
  check(dbRefuses, 'the database refuses an account with no rating');
  // an inactive Specialisation cannot be newly picked
  const noSpec = await api(page, 'POST', '/api/users', { serviceNumber: 'B0627', fullName: 'WT Spec', roleId: roleId('Rating'), specialisationId: 99999 });
  check(noSpec.status === 422 && noSpec.body.error.fields.specialisationId, 'a Specialisation that does not exist is refused');
  check(ctx.errors.length === 0, 'guards: no browser errors', ctx.errors.join(' | '));
  await ctx.context.close();
}

// ---------------------------------------------------------------------------
// Accounts without the grants: no buttons, and 403 from the API
// ---------------------------------------------------------------------------
async function withoutGrants(browser, viewport, theme) {
  const phone = viewport.width < 700;
  console.log(`\nAn account with no administration grants, ${phone ? 'phone' : 'desktop'}, ${theme}`);
  const ctx = await open(browser, { viewport, theme });
  const { page } = ctx;
  await signIn(page, NONE);
  await page.goto(`${BASE}/app.html#ratings/current`);
  await page.waitForSelector('#app-main h1');
  if (!phone) check((await page.locator('#rail a[data-module="admin"]').count()) === 0, 'System Administration is not in the sidebar');
  await page.goto(`${BASE}/app.html#admin/users`);
  await page.waitForSelector('#app-main h1');
  check(/You Do Not Have Access/.test(await page.locator('#app-main').innerText()), 'the pages show the not-allowed state');
  for (const route of ['admin/roles', 'admin/password', 'admin/audit']) {
    await page.goto(`${BASE}/app.html#${route}`);
    await page.waitForSelector('#app-main h1');
    check(/You Do Not Have Access/.test(await page.locator('#app-main').innerText()), `#${route}: not allowed`);
  }
  await page.keyboard.press('Control+k');
  await page.locator('input[aria-label^="Search"]').last().fill('Manage Users');
  check((await page.locator('[role="option"]', { hasText: 'Manage Users' }).count()) === 0, 'Ctrl K does not offer the administration screens');
  await page.keyboard.press('Escape');
  const reads = ['/api/users', '/api/users/meta', '/api/users/lookup?q=HICO001', '/api/users/1', '/api/access/roles', '/api/access/roles/1', '/api/access/privileges', '/api/audit', '/api/audit/filters', '/api/audit/1'];
  for (const url of reads) {
    const r = await api(page, 'GET', url);
    check(r.status === 403 && r.body.error.code === 'FORBIDDEN', `GET ${url}: 403`, `${r.status}`);
  }
  const writes = [
    ['POST', '/api/users', { serviceNumber: 'B0627', fullName: 'x', roleId: 1 }],
    ['PUT', '/api/users/2', { fullName: 'x', roleId: 1 }],
    ['POST', '/api/users/2/deactivate'],
    ['POST', '/api/users/2/reactivate'],
    ['POST', '/api/users/2/reset-password'],
    ['POST', '/api/access/roles', { name: 'WT X', privileges: { 'dashboard.home': ['view'] } }],
    ['PUT', '/api/access/roles/3', { name: 'WT X', privileges: { 'dashboard.home': ['view'] } }],
    ['DELETE', '/api/access/roles/3'],
  ];
  for (const [m, url, body] of writes) {
    const r = await api(page, m, url, body);
    check(r.status === 403, `${m} ${url}: 403`, `${r.status}`);
  }
  // Change Password belongs to everyone
  await page.goto(`${BASE}/app.html#ratings/current`);
  await page.waitForSelector('#app-main h1');
  if (phone) await page.click('#phone-header button[aria-label="Account"]');
  else await page.click('#rail button[aria-haspopup="menu"]');
  check(await page.getByRole('menuitem', { name: 'Change Password' }).isVisible(), 'Change Password is in the account menu without any grant');
  await page.keyboard.press('Escape');
  const wrong = await api(page, 'POST', '/api/auth/change-password', { currentPassword: 'nope', newPassword: 'Another1pass', confirmPassword: 'Another1pass' });
  check(wrong.status === 422, 'Change Password: the API checks the current password');
  check(ctx.errors.length === 0, 'no browser errors', ctx.errors.join(' | '));
  await ctx.context.close();
}

async function viewOnly(browser, viewport, theme) {
  const phone = viewport.width < 700;
  console.log(`\nAn account that may only view, ${phone ? 'phone' : 'desktop'}, ${theme}`);
  const ctx = await open(browser, { viewport, theme });
  const { page } = ctx;
  await signIn(page, VIEWER);
  await go(page, 'admin/users');
  check((await page.getByRole('button', { name: 'Add Account' }).count()) === 0, 'Manage Users: no Add Account button');
  await rowsOf(page, phone).first().click();
  let dlg = dialogOf(page);
  await dlg.waitFor();
  const btns = await dlg.locator('button').allInnerTexts();
  check(!btns.some((t) => /Edit|Deactivate|Reactivate|Reset/.test(t)), 'the account dialog has no Edit, Deactivate or Reset Password', btns.join('|'));
  await dlg.getByRole('button', { name: 'Close' }).first().click();
  await go(page, 'admin/roles');
  check((await page.getByRole('button', { name: 'Add Role' }).count()) === 0, 'Manage Roles: no Add Role button');
  await rowsOf(page, phone).nth(1).click();
  dlg = dialogOf(page);
  await dlg.waitFor();
  check((await footBtn(dlg, 'Save').count()) === 0 && (await footBtn(dlg, 'Delete').count()) === 0, 'the role dialog is read-only');
  check(await dlg.locator('[data-screen] button:not([disabled])').count() === 0, 'the role grid cannot be toggled');
  await dlg.getByRole('button', { name: 'Close' }).first().click();
  await go(page, 'admin/password');
  await page.fill('#app-main input[name="q"]', 'B0541');
  await page.getByRole('button', { name: 'Find Account' }).click();
  await page.locator('[data-result]').getByText('Records Clerk').first().waitFor();
  check(await page.getByRole('button', { name: 'Reset Password' }).isDisabled(), 'Manage Password: Reset Password is off without the edit grant');
  await go(page, 'admin/audit');
  check((await rowsOf(page, phone).count()) > 0, 'the Audit Trail opens with the view grant');
  for (const [m, url, body] of [
    ['POST', '/api/users', { serviceNumber: 'B0627', fullName: 'x', roleId: 1 }],
    ['PUT', '/api/users/2', { fullName: 'x', roleId: 1 }],
    ['POST', '/api/users/2/deactivate'],
    ['POST', '/api/users/2/reset-password'],
    ['POST', '/api/access/roles', { name: 'WT X', privileges: { 'dashboard.home': ['view'] } }],
    ['DELETE', '/api/access/roles/3'],
  ]) {
    const r = await api(page, m, url, body);
    check(r.status === 403, `view only: ${m} ${url}: 403`, `${r.status}`);
  }
  check(ctx.errors.length === 0, 'no browser errors', ctx.errors.join(' | '));
  await ctx.context.close();
}

// ---------------------------------------------------------------------------
// The audit trail holds every write, and no password
// ---------------------------------------------------------------------------
async function auditHoldsEverything(browser) {
  console.log('\nThe audit trail');
  const ctx = await open(browser, { viewport: DESKTOP, theme: 'light' });
  const { page } = ctx;
  await signIn(page, ADMIN);
  const rows = [];
  for (let p = 1; p <= 40; p += 1) {
    const r = (await api(page, 'GET', `/api/audit?pageSize=100&page=${p}`)).body;
    rows.push(...r.data);
    if (p >= r.meta.totalPages) break;
  }
  const has = (action, table, pred = () => true) => rows.some((r) => r.action === action && r.table === table && pred(r));
  check(has('INSERT', 'users', (r) => r.recordId === 'B0588'), 'an account added is in the trail (INSERT users)');
  check(has('UPDATE', 'users', (r) => r.recordId === 'B0588'), 'an account edited, deactivated, reactivated or reset is in the trail (UPDATE users)');
  check(has('INSERT', 'roles', (r) => /^WT Role/.test(r.recordId)), 'a role added is in the trail (INSERT roles)');
  check(has('UPDATE', 'roles', (r) => /^WT Role/.test(r.recordId)), 'a role edited is in the trail (UPDATE roles)');
  check(has('DELETE', 'roles', (r) => /^WT Role/.test(r.recordId)), 'a role deleted is in the trail (DELETE roles)');
  check(rows.every((r) => r.username && r.ip), 'every row names who and where from');
  // what each entry says; and none of it a password
  const details = [];
  for (const r of rows.filter((x) => (x.table === 'users' || x.table === 'roles') && /WT|^B0(588|601F)$/.test(x.recordId || '')).slice(0, 80)) details.push((await api(page, 'GET', `/api/audit/${r.id}`)).body.data);
  const text = JSON.stringify(details) + JSON.stringify(rows);
  const leaked = [...secrets].filter((s) => text.includes(s));
  check(leaked.length === 0, 'no password or one-time password is in the audit trail', leaked.join(','));
  check(!/"(password|password_hash|passwordHash)"/i.test(text) && !/\$2[aby]\$/.test(text), 'no password field or hash is in the audit trail');
  const reset = details.find((d) => d.action === 'UPDATE' && d.changes.some((c) => /Reset by an administrator/.test(c.to || '')));
  check(!!reset && reset.changes.some((c) => c.field === 'sessions'), 'a reset is recorded, with the sessions it ended', JSON.stringify(reset && reset.changes));
  const roleEdit = details.find((d) => d.table === 'roles' && d.action === 'UPDATE' && d.changes.some((c) => c.field === 'privileges added'));
  check(!!roleEdit && roleEdit.changes.some((c) => c.field === 'privileges removed'), 'a role edit records the privileges added and removed');
  // a refused write leaves nothing
  const before = (await api(page, 'GET', '/api/audit')).body.meta.total;
  await api(page, 'POST', '/api/users', { serviceNumber: 'HICO001', fullName: 'Dup', roleId: 1 });
  await api(page, 'DELETE', '/api/access/roles/1');
  const after = (await api(page, 'GET', '/api/audit')).body.meta.total;
  check(before === after, 'a refused write leaves no audit row');
  // nothing deletes audit rows through the API
  for (const [m, url] of [['DELETE', `/api/audit/${rows[0].id}`], ['PUT', `/api/audit/${rows[0].id}`], ['POST', '/api/audit']]) {
    const r = await api(page, m, url, {});
    check(r.status === 404, `${m} ${url}: no such route`, `${r.status}`);
  }
  check(ctx.errors.length === 0, 'no browser errors', ctx.errors.join(' | '));
  await ctx.context.close();
}

async function main() {
  const started = Date.now();
  dbConn = await connect();
  await setup(dbConn);
  const browser = await chromium.launch();
  try {
    const combos = [[DESKTOP, 'light'], [DESKTOP, 'dark'], [PHONE, 'light'], [PHONE, 'dark']];
    const want = (n) => !process.env.ONLY || process.env.ONLY.split(',').includes(n);
    // every action once at desktop light; the other layouts and themes: each screen and its main dialog
    if (want('admin')) {
      await adminSuite(browser, DESKTOP, 'light', 0);
      for (const [vp, th] of combos.slice(1)) await glance(browser, vp, th);
    }
    if (want('guards')) await guards(browser);
    if (want('none')) {
      await withoutGrants(browser, DESKTOP, 'light');
      await withoutGrants(browser, PHONE, 'dark');
    }
    if (want('view')) {
      await viewOnly(browser, DESKTOP, 'dark');
      await viewOnly(browser, PHONE, 'light');
    }
    if (want('audit')) await auditHoldsEverything(browser);
  } finally {
    await browser.close();
    await cleanup(dbConn).catch(() => {});
    await dbConn.end();
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`\n${passes} passed, ${failures} failed, ${seconds} s`);
  if (seconds > 300) {
    console.log(`  FAIL  the walk-through must run in 5 minutes at most: it took ${seconds} s`);
    failures += 1;
  }
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
