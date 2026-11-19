#!/usr/bin/env node
'use strict';

/*
 * Walk-through of the Static Tables (WP2). Uses the Playwright installed on the machine (not a
 * project dependency):
 *
 *   npm run migrate:fresh                       # a fresh demo database
 *   npm start                                   # the app on :3000
 *   NODE_PATH=$(npm root -g) node tests/e2e/static-tables-walkthrough.js
 *
 * BASE changes the address; SHOTS=<dir> saves screenshots there. It reads .env for the database,
 * to add two throw-away roles and accounts (a viewer with View only, and one with the Static
 * Tables role) and to find a row that records use; it removes them again when it ends.
 * Exits non-zero when a check fails. Browser errors fail the run.
 *
 * For every one of the 16 tables, as the Administrator, at 1440 and 390 px in light and dark:
 * list, search, add, edit, make inactive, delete a row in use (refused, with where it is used)
 * and delete an unused one, all through the dialogs. Then the privileges (a rating, a viewer, the
 * Static Tables role, a role with one table's grants), the audit trail, Ctrl K, and the rating
 * forms still offering their dropdowns, including a record that holds an inactive value.
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
const RATING = { username: 'B0539', password: 'Rating@123' };
const VIEWER = { username: 'WTVIEW', password: 'Viewer@123' };
const KEEPER = { username: 'WTTABLES', password: 'Tables@123' };
const PARTIAL = { username: 'WTPART', password: 'Partial@123' };
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

// the 16 tables: slug, the Add button's item, the table, the /api/lookups key (when the ratings forms use it)
// and a row a rating holds (column on `holder`), to try the in-use refusal
const TABLES = [
  { slug: 'appraisal-ratings', item: 'Grade', table: 'ref_appraisal_rating' },
  { slug: 'branch', item: 'Branch', table: 'ref_branch', lookup: 'branches', holder: ['ratings', 'branch_id'] },
  { slug: 'exit-type', item: 'Exit Type', table: 'ref_exit_type', lookup: 'exitTypes', holder: ['ratings', 'exit_type_id'] },
  { slug: 'entry-mode', item: 'Entry Mode', table: 'ref_entry_mode', lookup: 'entryModes', holder: ['ratings', 'entry_mode_id'] },
  { slug: 'offences', item: 'Offence', table: 'ref_disciplinary_offence', holder: ['discipline_cases', 'offence_id'] },
  { slug: 'sanctions', item: 'Sanction', table: 'ref_disciplinary_sanction', holder: ['discipline_cases', 'sanction_id'] },
  { slug: 'institution', item: 'Institution', table: 'ref_institution', holder: ['ref_training', 'institution_id'] },
  { slug: 'local-government', item: 'Local Government', table: 'ref_local_government', lookup: 'localGovernments', holder: ['ratings', 'local_government_id'] },
  { slug: 'languages', item: 'Language', table: 'ref_language', lookup: 'languages', holder: ['rating_language', 'language_id'] },
  { slug: 'relationship', item: 'Relationship', table: 'ref_next_of_kin_type', lookup: 'nextOfKinTypes', holder: ['rating_next_of_kin', 'next_of_kin_type_id'] },
  { slug: 'staff-branch', item: 'Staff Branch', table: 'ref_staff_branch', lookup: 'staffBranches', holder: ['ratings', 'staff_branch_id'] },
  { slug: 'specialisation', item: 'Specialisation', table: 'ref_specialisation', lookup: 'specialisations', holder: ['ratings', 'specialisation_id'] },
  { slug: 'ships', item: 'Ship', table: 'ref_ship', lookup: 'ships', holder: ['rating_drafting', 'ship_id'] },
  { slug: 'states', item: 'State', table: 'ref_state', lookup: 'states', holder: ['ratings', 'state_id'] },
  { slug: 'title', item: 'Title', table: 'ref_title', lookup: 'titles', holder: ['ratings', 'title_id'] },
  { slug: 'training', item: 'Course', table: 'ref_training' },
];

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
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

/** A browser context in one layout and theme, collecting browser errors. */
async function open(browser, { viewport, theme }) {
  const phone = viewport.width < 700;
  const context = await browser.newContext({ viewport, colorScheme: theme, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  const errors = [];
  // responses the walk-through provokes on purpose (403 without a grant, 404 a deleted row, 409 a row in use, 422 a bad value)
  const expected = new Set([403, 404, 409, 422]);
  context.on('page', (p) => {
    p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    p.on('console', (m) => {
      if (m.type() !== 'error') return;
      const status = Number((/status of (\d{3})/.exec(m.text()) || [])[1]);
      if (expected.has(status)) return;
      errors.push(`console: ${m.text()}`);
    });
  });
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

const dialogOf = (page) => page.locator('#overlay-root [role="dialog"]').last();
// waits for the dialog's opening animation to end (no fixed wait)
const settle = (dlg) => dlg.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))));

async function goTable(page, slug) {
  await page.goto(`${BASE}/app.html#tables/${slug}`);
  await page.waitForFunction(() => document.querySelector('#app-main h1') && !document.querySelector('#app-main')?.textContent.includes('Loading'), null, { timeout: 15000 });
  // a row of the table (desktop) or a card (phone) that is on screen
  await page.waitForFunction(() => Array.from(document.querySelectorAll('#app-main table tbody tr, #app-main .desk\\:hidden > div > button, #app-main .desk\\:hidden > div > div')).some((e) => e.offsetParent !== null), null, { timeout: 15000 });
}

/** Rows of the list as the person sees them: the desktop table, or the cards on a phone. */
const listRows = (page, phone) => (phone ? page.locator('#app-main .desk\\:hidden > div > button') : page.locator('#app-main table tbody tr'));

async function rowNames(page, phone) {
  const rows = listRows(page, phone);
  const n = await rows.count();
  const names = [];
  for (let i = 0; i < n; i += 1) {
    if (!phone && (await rows.nth(i).locator('td').count()) < 2) continue; // the empty state
    names.push(phone ? await rows.nth(i).locator('b').first().innerText() : await rows.nth(i).locator('td').nth(1).innerText());
  }
  return names;
}

async function openRowByName(page, phone, name) {
  const rows = listRows(page, phone);
  const n = await rows.count();
  for (let i = 0; i < n; i += 1) {
    if (!phone && (await rows.nth(i).locator('td').count()) < 2) continue;
    const text = phone ? await rows.nth(i).locator('b').first().innerText() : await rows.nth(i).locator('td').nth(1).innerText();
    if (text.trim() === name) {
      await rows.nth(i).click();
      await dialogOf(page).waitFor();
      return true;
    }
  }
  return false;
}

async function search(page, text) {
  const box = page.locator('#app-main input[type="search"]').first();
  await box.fill(text);
  // Enter always asks the server again: wait for that answer, then for the list to draw
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'GET' && /\/api\/tables\/[a-z-]+\?/.test(r.url())),
    box.press('Enter'),
  ]);
  await page.waitForFunction(() => !document.querySelector('#app-main')?.textContent.includes('Loading'), null, { timeout: 10000 });
}

/** Picks an option of a searchable dropdown in the open dialog, by its label or the first one. */
async function choose(page, name, label) {
  const dlg = dialogOf(page);
  await dlg.locator(`.custom-dropdown-wrapper[name="${name}"] input:not(.custom-dropdown-hidden)`).first().click();
  // a named choice may be the empty one ("Any Branch"); the first choice is a real row
  const options = page.locator(label ? '.custom-dropdown-list:visible .custom-dropdown-item' : '.custom-dropdown-list:visible .custom-dropdown-item:not(.cdd-placeholder)');
  await options.first().waitFor();
  if (label) await options.filter({ hasText: label }).first().click();
  else await options.first().click();
}

const dropdownValue = (page, name) => dialogOf(page).locator(`input.custom-dropdown-hidden[name="${name}"]`).inputValue();

// the text of the toast that matches `re` (earlier toasts may still be fading)
async function toastText(page, re) {
  const t = page.locator('#toast-root [role]', { hasText: re }).last();
  await t.waitFor({ timeout: 8000 });
  const text = (await t.innerText()).trim();
  await t.getByRole('button', { name: 'Dismiss' }).click().catch(() => {});
  return text;
}

async function noSideScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

// ---------------------------------------------------------------------------
// Fills the add / edit dialog for a table from its columns (GET .../meta): a name, and a value
// for every other field, as a person would.
// ---------------------------------------------------------------------------
const SCORES = { score_low: '41', score_high: '44' };
async function fillDialog(page, meta, tag, { onlyName = false } = {}) {
  const dlg = dialogOf(page);
  const name = `WT ${meta.item} ${tag}`;
  for (const c of meta.columns) {
    if (c.key === 'name') { await dlg.locator('input[name="name"]').fill(name); continue; }
    if (onlyName) continue;
    // codes are typed in lower case: they are kept upper case
    if (c.type === 'text') await dlg.locator(`input[name="${c.key}"]`).fill(c.key === 'code' ? `z${tag}`.slice(0, c.max || 5) : 'Test');
    else if (c.type === 'number') await dlg.locator(`input[name="${c.key}"]`).fill(SCORES[c.key] || '12');
    else if (c.type === 'select' || (c.type === 'ref' && c.required)) await choose(page, c.key);
    else if (c.type === 'multi') {
      await choose(page, `${c.key}__pick`);
      await choose(page, `${c.key}__pick`);
    }
  }
  return name;
}

// ---------------------------------------------------------------------------
// One table, one layout and theme: the whole cycle through the screens.
// ---------------------------------------------------------------------------
async function tableCycle(ctx, t, tag, inUse, label) {
  const { page, phone } = ctx;
  const meta = (await api(page, 'GET', `/api/tables/${t.slug}/meta`)).body.data;
  await goTable(page, t.slug);

  // list: 25 a page from the server, with a count and no sideways scroll
  const names = await rowNames(page, phone);
  check(names.length > 0 && names.length <= 25, `${label}: list shows rows (${names.length})`);
  check(await noSideScroll(page), `${label}: the page does not scroll sideways`);
  const wrap = page.locator('#app-main .overflow-x-auto').first();
  if (!phone) check(await wrap.evaluate((e) => e.scrollWidth <= e.clientWidth + 1), `${label}: the table does not scroll sideways`);
  check(await page.getByRole('button', { name: `Add ${t.item}` }).first().isVisible(), `${label}: Add ${t.item} shows`);

  // search: finds a row by part of its name; a nonsense word finds nothing
  const first = names[0];
  const word = first.split(/\s+/).sort((a, b) => b.length - a.length)[0].slice(0, 6);
  await search(page, word);
  const found = await rowNames(page, phone);
  check(found.length >= 1 && found.some((n) => n.toLowerCase().includes(word.toLowerCase())), `${label}: search "${word}" finds it`, found.join('|'));
  await search(page, 'zzqqxx-none');
  check(await page.locator('#app-main').getByText('Nothing Matches').locator('visible=true').count() > 0, `${label}: a search with no match says so`);
  await search(page, '');

  // add through the dialog
  await page.getByRole('button', { name: `Add ${t.item}` }).first().click();
  let dlg = dialogOf(page);
  await dlg.waitFor();
  await settle(dlg); // the sheet rises, the dialog settles
  if (phone) {
    const box = await dlg.boundingBox();
    check(Math.abs(box.y + box.height - PHONE.height) < 3 && box.width >= PHONE.width - 1, `${label}: the dialog is a bottom sheet`, JSON.stringify(box));
  } else {
    const box = await dlg.boundingBox();
    check(box.x > 100 && box.y > 20 && box.x + box.width < DESKTOP.width - 100, `${label}: the dialog is centred`, JSON.stringify(box));
  }
  if (t.slug === 'training' && tag === '0') await shot(page, `${label.replace(/[ ,]+/g, '-')}-training-add`);
  // a missing required field shows an error under it
  await dlg.getByRole('button', { name: 'Save' }).click();
  await dlg.locator('[data-field-error]:not(.hidden)').first().waitFor({ timeout: 5000 });
  check(true, `${label}: Save with nothing filled shows the required errors`);
  const name = await fillDialog(page, meta, tag);
  await dlg.getByRole('button', { name: 'Save' }).click();
  check(/added/.test(await toastText(page, /added/)), `${label}: added`);
  await dlg.waitFor({ state: 'detached' });
  await search(page, name);
  check((await rowNames(page, phone)).includes(name), `${label}: the new row shows in the list`);
  const created = (await api(page, 'GET', `/api/tables/${t.slug}?q=${encodeURIComponent(name)}`)).body.data[0];
  check(!!created && created.is_active === 1, `${label}: the row is stored and Active`);

  // a duplicate is refused
  const dup = await api(page, 'POST', `/api/tables/${t.slug}`, { ...fullBody(meta, created), name });
  check(dup.status === 422 && dup.body.error.fields && dup.body.error.fields.name, `${label}: a duplicate name is refused (422)`, JSON.stringify(dup.body));

  // edit through the dialog
  check(await openRowByName(page, phone, name), `${label}: the row opens its dialog`);
  dlg = dialogOf(page);
  check((await dlg.locator('input[name="name"]').inputValue()) === name, `${label}: the dialog holds the row`);
  const renamed = `${name} B`;
  await dlg.locator('input[name="name"]').fill(renamed);
  await dlg.getByRole('button', { name: 'Save' }).click();
  check(/updated/.test(await toastText(page, /updated/)), `${label}: edited`);
  await dlg.waitFor({ state: 'detached' });
  await search(page, renamed);
  check((await rowNames(page, phone)).includes(renamed), `${label}: the edited name shows`);

  // make it inactive: the pill says so, and the dropdown lists leave it out
  await openRowByName(page, phone, renamed);
  dlg = dialogOf(page);
  await choose(page, 'is_active', 'Inactive');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await dlg.waitFor({ state: 'detached' });
  await search(page, renamed);
  const rowText = await listRows(page, phone).first().innerText();
  check(/Inactive/.test(rowText), `${label}: made Inactive`, rowText);
  if (t.lookup) {
    const lookups = (await api(page, 'GET', '/api/lookups')).body.data;
    check(!(lookups[t.lookup] || []).some((x) => x.name === renamed) && (lookups.inactive[t.lookup] || []).some((x) => x.name === renamed), `${label}: an Inactive row leaves the dropdown list (kept for records that hold it)`);
  }

  // delete the unused row: confirmation, then gone
  await openRowByName(page, phone, renamed);
  dlg = dialogOf(page);
  await dlg.getByRole('button', { name: 'Delete' }).click();
  const confirm = page.locator('#overlay-root [role="dialog"]').last();
  check(/cannot be undone/.test(await confirm.innerText()), `${label}: delete asks first`);
  await confirm.getByRole('button', { name: 'Delete' }).click();
  check(/deleted/.test(await toastText(page, /deleted/)), `${label}: deleted`);
  await search(page, renamed);
  check(!(await rowNames(page, phone)).includes(renamed) || (await page.getByText('Nothing Matches').count()) > 0, `${label}: the deleted row is gone`);
  await search(page, '');

  // a row in use cannot be deleted: the dialog says where, the server refuses
  if (inUse) {
    await goTable(page, t.slug);
    await search(page, inUse.name);
    check(await openRowByName(page, phone, inUse.name), `${label}: the row "${inUse.name}" (in use) opens`);
    dlg = dialogOf(page);
    check(await dlg.getByText(/In use:/).isVisible(), `${label}: its dialog says where it is used`);
    await dlg.getByRole('button', { name: 'Delete' }).click();
    await page.locator('#overlay-root [role="dialog"]').last().getByRole('button', { name: 'Delete' }).click();
    const msg = await toastText(page, /cannot be deleted/);
    check(/is in use \(.+\), so it cannot be deleted/.test(msg), `${label}: delete refused, with where it is used`, msg);
    await page.keyboard.press('Escape');
    const still = (await api(page, 'GET', `/api/tables/${t.slug}/${inUse.id}`)).status === 200;
    check(still, `${label}: the row in use is still there`);
    await page.keyboard.press('Escape');
    await search(page, '');
  } else {
    const row = (await api(page, 'GET', `/api/tables/${t.slug}?q=`)).body.data[0];
    const detail = (await api(page, 'GET', `/api/tables/${t.slug}/${row.id}`)).body.data;
    check(detail.in_use === false, `${label}: no record refers to this table yet (nothing to refuse)`);
  }
  check(await noSideScroll(page), `${label}: still no sideways scroll`);
}

/** A body for POST from a row the API sent back (the fields a person would fill). */
function fullBody(meta, row) {
  const body = {};
  meta.columns.forEach((c) => { body[c.key] = row[c.key] === undefined ? '' : row[c.key]; });
  return body;
}

// ---------------------------------------------------------------------------
// Setup: throw-away roles and accounts, a row in use for each table
// ---------------------------------------------------------------------------
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
  const role = async (name, description) => {
    const [r] = await db.query('INSERT INTO roles (name, description, full_access) VALUES (?, ?, 0)', [name, description]);
    return r.insertId;
  };
  const grant = (roleId, where, params = []) => db.query(`INSERT IGNORE INTO role_privileges (role_id, privilege_id) SELECT ?, id FROM privileges WHERE ${where}`, [roleId, ...params]);
  // every account belongs to a rating: a throw-away one, removed with the account
  const user = async (who, roleId) => {
    await db.query("INSERT IGNORE INTO ratings (service_number, status, surname, first_name) VALUES (?, 'current', 'WALKTHROUGH', ?)", [who.username, who.username]);
    await db.query('INSERT INTO users (username, password_hash, full_name, role_id, service_number, is_active) VALUES (?, ?, ?, ?, ?, 1)', [who.username, hash(who.password), `WT ${who.username}`, roleId, who.username]);
  };

  const viewer = await role('WT Viewer', 'walk-through: View on every table');
  await grant(viewer, "screen LIKE 'tables.%' AND action = 'view'");
  await user(VIEWER, viewer);
  const keeper = await role('WT Tables', 'walk-through: every grant on every table');
  await grant(keeper, "screen LIKE 'tables.%'");
  await user(KEEPER, keeper);
  const partial = await role('WT Partial', 'walk-through: Branch view and add only');
  await grant(partial, "screen = 'tables.branch' AND action IN ('view', 'add')");
  await user(PARTIAL, partial);
}

async function cleanup(db) {
  await db.query("DELETE FROM users WHERE username IN ('WTVIEW', 'WTTABLES', 'WTPART')");
  await db.query("DELETE FROM roles WHERE name IN ('WT Viewer', 'WT Tables', 'WT Partial')");
  await db.query("DELETE FROM ratings WHERE service_number IN ('WTVIEW', 'WTTABLES', 'WTPART')");
  await db.query("UPDATE ref_appraisal_rating SET score_high = 44 WHERE code = 'E'").catch(() => {});
  await db.query("DELETE FROM rating_training WHERE classification = 'WT'").catch(() => {});
  await db.query("DELETE FROM rating_education WHERE qualification LIKE 'WT %'").catch(() => {});
  // anything a failed run left behind
  for (const t of TABLES) await db.query(`DELETE FROM ${t.table} WHERE name LIKE 'WT %'`).catch(() => {});
}

async function inUseRow(db, t) {
  if (!t.holder) return null;
  const [table, column] = t.holder;
  const [rows] = await db.query(`SELECT x.id, x.name FROM ${t.table} x WHERE x.id IN (SELECT ${column} FROM ${table} WHERE ${column} IS NOT NULL) ORDER BY x.id LIMIT 1`);
  return rows[0] || null;
}

// ---------------------------------------------------------------------------
// The rules, through the API (fast): required, lengths, codes, duplicates, inactive out of the
// lists, the in-use refusal and where it is used, the audit rows
// ---------------------------------------------------------------------------
async function apiRules(page, db) {
  console.log('\nThe rules through the API, every table');
  for (const t of TABLES) {
    const meta = (await api(page, 'GET', `/api/tables/${t.slug}/meta`)).body.data;
    const real = meta.columns.filter((c) => c.type !== 'virtual');
    const label = `${t.slug} (API)`;
    const empty = await api(page, 'POST', `/api/tables/${t.slug}`, {});
    const missing = real.filter((c) => c.required && c.type !== 'bool').map((c) => c.key);
    check(empty.status === 422 && missing.every((k) => empty.body.error.fields[k]), `${label}: empty body refused, each required field named (${missing.join(', ')})`, JSON.stringify(empty.body && empty.body.error));
    const long = real.find((c) => c.type === 'text' && c.max);
    if (long) {
      const tooLong = await api(page, 'POST', `/api/tables/${t.slug}`, { [long.key]: 'x'.repeat(long.max + 1) });
      check(tooLong.status === 422 && tooLong.body.error.fields[long.key], `${label}: ${long.key} over ${long.max} characters refused`);
    }
    if (t.slug === 'appraisal-ratings') continue; // its rows are covered by the specification (scores must not overlap)

    const body = { name: `WT API ${t.item}` };
    for (const c of real) {
      if (c.key === 'name') continue;
      if (c.type === 'text') body[c.key] = c.key === 'code' ? 'wy' : 'Test';
      else if (c.type === 'number') body[c.key] = 12;
      else if (c.type === 'select') body[c.key] = c.options[0];
      else if (c.type === 'ref' && c.required) body[c.key] = meta.options[c.key].find((o) => o.active).id;
    }
    const made = await api(page, 'POST', `/api/tables/${t.slug}`, body);
    check(made.status === 201, `${label}: a valid row is added`, JSON.stringify(made.body && made.body.error));
    if (made.status !== 201) continue;
    const id = made.body.data.id;
    const dup = await api(page, 'POST', `/api/tables/${t.slug}`, body);
    check(dup.status === 422 && dup.body.error.fields.name, `${label}: the same name is refused`);
    if (real.some((c) => c.key === 'code')) {
      check(made.body.data.code === 'WY', `${label}: the code "wy" is kept as WY`);
      const dupCode = await api(page, 'POST', `/api/tables/${t.slug}`, { ...body, name: `${body.name} 2` });
      check(dupCode.status === 422 && dupCode.body.error.fields.code, `${label}: the same code is refused`);
    }
    const off = await api(page, 'PUT', `/api/tables/${t.slug}/${id}`, { ...body, is_active: false });
    check(off.status === 200 && off.body.data.is_active === 0, `${label}: made Inactive`);
    if (t.lookup) {
      const lookups = (await api(page, 'GET', '/api/lookups')).body.data;
      check(!(lookups[t.lookup] || []).some((x) => x.name === body.name) && (lookups.inactive[t.lookup] || []).some((x) => x.name === body.name), `${label}: an Inactive row is out of the dropdown list`);
    }
    const inUse = await inUseRow(db, t);
    if (inUse) {
      const refused = await api(page, 'DELETE', `/api/tables/${t.slug}/${inUse.id}`);
      check(refused.status === 409 && refused.body.error.code === 'IN_USE' && /is in use \(.+\), so it cannot be deleted/.test(refused.body.error.message), `${label}: a row in use is refused, with where it is used`, refused.body && refused.body.error && refused.body.error.message);
      const detail = (await api(page, 'GET', `/api/tables/${t.slug}/${inUse.id}`)).body.data;
      check(detail.in_use === true && detail.usage.length > 0, `${label}: the row says where it is used (${detail.usage.map((u) => u.text).join(', ')})`);
    } else {
      const detail = (await api(page, 'GET', `/api/tables/${t.slug}/${id}`)).body.data;
      check(detail.in_use === false, `${label}: no record refers to this table yet`);
    }
    const gone = await api(page, 'DELETE', `/api/tables/${t.slug}/${id}`);
    check(gone.status === 200 && (await api(page, 'GET', `/api/tables/${t.slug}/${id}`)).status === 404, `${label}: an unused row is deleted`);
  }
}

// ---------------------------------------------------------------------------
// The administrator at desktop light: every table, the whole cycle through the dialogs.
// Worker lanes split the tables; each has its own tag so names and codes never collide.
// ---------------------------------------------------------------------------
async function cycleLane(browser, db, tables, tag) {
  const label0 = `desktop, light, lane ${tag}`;
  const ctx = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(ctx.page, ADMIN);
  await goTable(ctx.page, 'branch');
  check(await ctx.page.locator('#module-tabs a').count() >= 16, `${label0}: the Static Tables module shows its 16 tabs`);
  for (const t of tables) await tableCycle(ctx, t, tag, await inUseRow(db, t), `${t.slug} (desktop, light)`);
  check(ctx.errors.length === 0, `${label0}: no browser errors`, ctx.errors.join(' | '));
  await ctx.context.close();
}

// ---------------------------------------------------------------------------
// The other layouts (desktop dark, phone light, phone dark): for every table the list and one
// dialog (opens, shows its fields, no sideways overflow), then one full cycle on the tables with
// special parts: Training (rates), Local Government (under State), Exit Type (flags)
// ---------------------------------------------------------------------------
async function glance(ctx, t, label) {
  const { page, phone } = ctx;
  const meta = (await api(page, 'GET', `/api/tables/${t.slug}/meta`)).body.data;
  await goTable(page, t.slug);
  check(await listRows(page, phone).count() > 0, `${label}: the list shows rows`);
  check(await noSideScroll(page), `${label}: the page does not scroll sideways`);
  if (!phone) check(await page.locator('#app-main .overflow-x-auto').first().evaluate((e) => e.scrollWidth <= e.clientWidth + 1), `${label}: the table does not scroll sideways`);
  check(await page.getByRole('button', { name: `Add ${t.item}` }).first().isVisible(), `${label}: Add ${t.item} shows`);
  // the first row opens its dialog with every field of the table
  await listRows(page, phone).first().click();
  const dlg = dialogOf(page);
  await dlg.waitFor();
  await settle(dlg);
  const want = meta.columns.filter((c) => c.type !== 'virtual').length + 1; // and the Status
  const fields = await dlg.locator('[data-field]').count();
  check(fields >= want, `${label}: the dialog shows its ${want} fields`, `${fields}`);
  const box = await dlg.boundingBox();
  check(phone ? Math.abs(box.y + box.height - PHONE.height) < 3 && box.width >= PHONE.width - 1 : box.x > 100 && box.x + box.width < DESKTOP.width - 100, `${label}: the dialog is ${phone ? 'a bottom sheet' : 'centred'}`, JSON.stringify(box));
  check(await dlg.evaluate((e) => e.scrollWidth <= e.clientWidth + 1), `${label}: the dialog does not scroll sideways`);
  if (SHOTS && ['training', 'exit-type', 'ships'].includes(t.slug)) await shot(page, `${label.replace(/[ ,()]+/g, '-')}-${t.slug}-dialog`);
  await page.keyboard.press('Escape');
  await dlg.waitFor({ state: 'detached' });
}

async function glanceLane(browser, db, viewport, theme, tag) {
  const phone = viewport.width < 700;
  const label0 = `${phone ? 'phone' : 'desktop'}, ${theme}`;
  const ctx = await open(browser, { viewport, theme });
  await signIn(ctx.page, ADMIN);
  for (const t of TABLES) await glance(ctx, t, `${t.slug} (${label0})`);
  for (const slug of ['training', 'local-government', 'exit-type']) {
    const t = TABLES.find((x) => x.slug === slug);
    await tableCycle(ctx, t, tag, await inUseRow(db, t), `${t.slug} (${label0})`);
  }
  check(ctx.errors.length === 0, `${label0}: no browser errors`, ctx.errors.join(' | '));
  await ctx.context.close();
}

// ---------------------------------------------------------------------------
// Training: Rates as a multi-pick, Any branch and Any specialisation
// ---------------------------------------------------------------------------
async function trainingRules(browser) {
  console.log('\nTraining: who may attend');
  const ctx = await open(browser, { viewport: DESKTOP, theme: 'light' });
  const { page } = ctx;
  await signIn(page, ADMIN);
  await goTable(page, 'training');
  // the list shows Course, Institution and Weeks; the rest is in the dialog
  const heads = (await page.locator('#app-main table thead th').allInnerTexts()).map((s) => s.trim().toLowerCase());
  check(['#', 'course', 'institution', 'weeks', 'status'].every((h) => heads.includes(h)) && !heads.includes('branch') && !heads.includes('rates') && !heads.includes('qualification awarded'), 'the list shows Course, Institution and Weeks (and the code); the rest is in the dialog', heads.join(','));
  await page.getByRole('button', { name: 'Add Course' }).first().click();
  const dlg = dialogOf(page);
  await dlg.waitFor();
  check(await dlg.getByText('All Rates').isVisible(), 'no rate picked reads "All Rates" (every rate)');
  const name = 'WT Course Rules';
  await dlg.locator('input[name="name"]').fill(name);
  await choose(page, 'institution_id');
  await dlg.locator('input[name="weeks"]').fill('9');
  await dlg.locator('input[name="code"]').fill('wtr');
  await dlg.locator('input[name="qualification"]').fill('Test Award');
  await choose(page, 'branch_id', 'Seaman');
  await choose(page, 'rate_ids__pick', 'Able Seaman');
  await choose(page, 'rate_ids__pick', 'Leading Seaman');
  check(await dlg.locator('[data-chips="rate_ids"] button').count() === 2, 'two rates picked show as two chips');
  check(!(await dlg.getByText('All Rates').count()), 'once rates are picked "All Rates" goes');
  await dlg.locator('[data-chips="rate_ids"] button').first().click();
  check(await dlg.locator('[data-chips="rate_ids"] button').count() === 1, 'a chip removes its rate');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await dlg.waitFor({ state: 'detached' });
  const row = (await api(page, 'GET', `/api/tables/training?q=${encodeURIComponent(name)}`)).body.data[0];
  const full = (await api(page, 'GET', `/api/tables/training/${row.id}`)).body.data;
  check(full.code === 'WTR' && full.qualification === 'Test Award' && full.weeks === 9 && full.branch_name === 'Seaman' && full.specialisation_id === null && full.rate_ids.length === 1 && full.rate_names[0].includes('Leading Seaman'), 'the course holds weeks, branch, any specialisation and one rate', JSON.stringify(full));
  // edit: back to every rate and any branch
  await openRowByName(page, false, name);
  await dlg.locator('[data-chips="rate_ids"] button').first().click();
  await choose(page, 'branch_id', 'Any Branch');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await dlg.waitFor({ state: 'detached' });
  const again = (await api(page, 'GET', `/api/tables/training/${row.id}`)).body.data;
  check(again.rate_ids.length === 0 && again.branch_id === null, 'cleared rates mean every rate, and Any Branch stores none', JSON.stringify(again));
  check((await api(page, 'DELETE', `/api/tables/training/${row.id}`)).status === 200, 'the course is deleted');
  // an Institution with a course cannot be deleted; its dialog and the API say where
  const inst = (await api(page, 'GET', '/api/tables/institution?q=NNS Quorra')).body.data[0];
  const refused = await api(page, 'DELETE', `/api/tables/institution/${inst.id}`);
  check(refused.status === 409 && refused.body.error.code === 'IN_USE' && /training course/.test(refused.body.error.message), 'an Institution with courses is refused: "in use ... training courses"', JSON.stringify(refused.body));
  // a course needs its institution and weeks
  const bad = await api(page, 'POST', '/api/tables/training', { name: 'WT Bad' });
  check(bad.status === 422 && bad.body.error.fields.institution_id && bad.body.error.fields.weeks, 'a course without institution or weeks is refused (422)');
  const badRate = await api(page, 'POST', '/api/tables/training', { name: 'WT Bad2', institution_id: inst.id, weeks: 3, rate_ids: [99999] });
  check(badRate.status === 422 && badRate.body.error.fields.rate_ids, 'a rate that does not exist is refused (422)');
  check(ctx.errors.length === 0, 'Training: no browser errors', ctx.errors.join(' | '));
  await ctx.context.close();
}

// ---------------------------------------------------------------------------
// Local Government sits under State
// ---------------------------------------------------------------------------
async function lgaRules(browser) {
  console.log('\nLocal Government under State');
  const ctx = await open(browser, { viewport: DESKTOP, theme: 'light' });
  const { page } = ctx;
  await signIn(page, ADMIN);
  await goTable(page, 'local-government');
  const heads = (await page.locator('#app-main table thead th').allInnerTexts()).map((s) => s.trim().toLowerCase());
  check(heads.includes('local government') && heads.includes('state'), 'the list shows Local Government and State', heads.join(','));
  const states = (await api(page, 'GET', '/api/tables/local-government/meta')).body.data.options.state_id;
  const [a, b] = states.filter((s) => s.active);
  const same = { name: 'WT Same Name', state_id: a.id };
  const one = await api(page, 'POST', '/api/tables/local-government', same);
  const twice = await api(page, 'POST', '/api/tables/local-government', same);
  const other = await api(page, 'POST', '/api/tables/local-government', { ...same, state_id: b.id });
  check(one.status === 201 && twice.status === 422 && other.status === 201, 'the same name twice in one state is refused, in another state it is allowed', `${one.status}/${twice.status}/${other.status}`);
  const noState = await api(page, 'POST', '/api/tables/local-government', { name: 'WT No State' });
  check(noState.status === 422 && noState.body.error.fields.state_id, 'a local government needs a state (422)');
  await search(page, 'WT Same Name');
  check((await rowNames(page, false)).length === 2, 'both rows show, each under its state');
  for (const r of [one, other]) await api(page, 'DELETE', `/api/tables/local-government/${r.body.data.id}`);
  // a state with local governments cannot be deleted
  const abia = states.find((s) => s.name === 'Abia');
  const del = await api(page, 'DELETE', `/api/tables/states/${abia.id}`);
  check(del.status === 409 && /local government/.test(del.body.error.message), 'a state with local governments is refused', JSON.stringify(del.body));
  check(ctx.errors.length === 0, 'Local Government: no browser errors', ctx.errors.join(' | '));
  await ctx.context.close();
}

// ---------------------------------------------------------------------------
// Privileges: a rating, a viewer, the Static Tables role, one table's grants
// ---------------------------------------------------------------------------
async function withoutGrants(browser, theme, viewport) {
  const phone = viewport.width < 700;
  console.log(`\nA rating (no Static Tables grants), ${phone ? 'phone' : 'desktop'}, ${theme}`);
  const ctx = await open(browser, { viewport, theme });
  const { page } = ctx;
  await signIn(page, RATING);
  for (const t of TABLES) {
    await page.goto(`${BASE}/app.html#tables/${t.slug}`);
    await page.waitForSelector('#app-main h1');
    const blocked = await page.getByText('You Do Not Have Access to This Page').isVisible();
    const buttons = await page.getByRole('button', { name: new RegExp(`Add ${t.item}|Edit|Delete`) }).count();
    check(blocked && buttons === 0, `${t.slug}: the page shows not allowed, no buttons`);
  }
  const rail = await page.locator('#rail nav a:has-text("Static Tables")').count();
  check(rail === 0, 'the rail does not offer Static Tables');
  for (const t of TABLES) {
    const r = await api(page, 'GET', `/api/tables/${t.slug}`);
    const m = await api(page, 'GET', `/api/tables/${t.slug}/meta`);
    const g1 = await api(page, 'GET', `/api/tables/${t.slug}/1`);
    const p = await api(page, 'POST', `/api/tables/${t.slug}`, { name: 'WT No' });
    const u = await api(page, 'PUT', `/api/tables/${t.slug}/1`, { name: 'WT No' });
    const d = await api(page, 'DELETE', `/api/tables/${t.slug}/1`);
    const all = [r, m, g1, p, u, d].every((x) => x.status === 403 && x.body.error.code === 'FORBIDDEN');
    check(all, `${t.slug}: the API answers 403 to list, meta, row, add, edit and delete`, [r, m, g1, p, u, d].map((x) => x.status).join(','));
  }
  const lookups = await api(page, 'GET', '/api/lookups');
  check(lookups.status === 200 && lookups.body.data.branches.length > 0, 'the dropdown lists stay readable (My Details)');
  // Ctrl K does not find a table
  await page.keyboard.press('Control+k');
  await page.waitForSelector('[role="dialog"][aria-label="Search"]');
  await page.keyboard.type('ships');
  check(!(await page.locator('#palette-results').innerText()).includes('Tables'), 'Ctrl K does not offer the tables');
  await page.keyboard.press('Escape');
  check(ctx.errors.length === 0, 'rating: no browser errors', ctx.errors.join(' | '));
  await ctx.context.close();
}

async function viewerRun(browser, theme, viewport) {
  const phone = viewport.width < 700;
  console.log(`\nA viewer (View on every table), ${phone ? 'phone' : 'desktop'}, ${theme}`);
  const ctx = await open(browser, { viewport, theme });
  const { page } = ctx;
  await signIn(page, VIEWER);
  check(page.url().includes('#tables/'), 'a viewer lands on Static Tables (their first page)', page.url());
  for (const t of TABLES) {
    await goTable(page, t.slug);
    const add = await page.getByRole('button', { name: `Add ${t.item}` }).count();
    const edit = await page.getByRole('button', { name: /^Edit / }).count();
    check(add === 0 && edit === 0, `${t.slug}: no Add or Edit buttons`);
    check(await listRows(page, phone).count() > 0, `${t.slug}: the list shows`);
  }
  await goTable(page, 'ships');
  const row = (await rowNames(page, phone))[0];
  await openRowByName(page, phone, row);
  const dlg = dialogOf(page);
  const noSave = (await dlg.getByRole('button', { name: 'Save' }).count()) === 0 && (await dlg.getByRole('button', { name: 'Delete' }).count()) === 0;
  check(noSave, 'a row opens read-only: no Save, no Delete');
  check(await dlg.locator('input[name="name"]').isDisabled(), 'its fields are read-only');
  await shot(page, `viewer-${phone ? 'phone' : 'desktop'}-${theme}-ships`);
  await page.keyboard.press('Escape');
  const p = await api(page, 'POST', '/api/tables/ships', { name: 'WT No', type: 'Ship' });
  const u = await api(page, 'PUT', '/api/tables/ships/1', { name: 'WT No', type: 'Ship' });
  const d = await api(page, 'DELETE', '/api/tables/ships/1');
  check(p.status === 403 && u.status === 403 && d.status === 403, 'the API refuses add, edit and delete (403)', `${p.status},${u.status},${d.status}`);
  check((await api(page, 'GET', '/api/tables/ships')).status === 200, 'but lists (200)');
  // Ctrl K finds the tables
  await page.keyboard.press('Control+k');
  await page.waitForSelector('[role="dialog"][aria-label="Search"]');
  await page.keyboard.type('specialisation');
  check((await page.locator('#palette-results').innerText()).includes('Specialisation Area'), 'Ctrl K finds a table by name');
  await page.keyboard.press('Escape');
  check(ctx.errors.length === 0, 'viewer: no browser errors', ctx.errors.join(' | '));
  await ctx.context.close();
}

async function keeperRun(browser) {
  console.log('\nA role that is not the Administrator but holds every table grant');
  const ctx = await open(browser, { viewport: DESKTOP, theme: 'light' });
  const { page } = ctx;
  await signIn(page, KEEPER);
  await goTable(page, 'branch');
  check(await page.locator('#module-tabs a').locator('visible=true').count() === 16, 'all 16 tabs show');
  check(await page.getByRole('button', { name: 'Add Branch' }).first().isVisible(), 'Add shows');
  check(await page.getByRole('button', { name: /^Edit / }).count() > 0, 'Edit shows');
  const rail = await page.locator('#rail nav a').allInnerTexts();
  check(!rail.some((r) => /Soon/.test(r)), 'no Soon modules in the rail for a role without full access');
  const made = await api(page, 'POST', '/api/tables/branch', { name: 'WT Keeper Branch', code: 'wk' });
  check(made.status === 201, 'add works');
  const gone = await api(page, 'DELETE', `/api/tables/branch/${made.body.data.id}`);
  check(gone.status === 200, 'delete works');
  const denied = await api(page, 'GET', '/api/audit');
  check(denied.status === 403, 'but the audit trail is still the Administrator\'s (403)');
  check(ctx.errors.length === 0, 'keeper: no browser errors', ctx.errors.join(' | '));
  await ctx.context.close();

  console.log('\nA role with one table\'s grants (Branch: view and add)');
  const part = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(part.page, PARTIAL);
  await goTable(part.page, 'branch');
  check(await part.page.locator('#module-tabs a').locator('visible=true').count() <= 1, 'only the Branch tab is offered (no strip for a lone tab)');
  check(await part.page.getByRole('button', { name: 'Add Branch' }).first().isVisible(), 'Add shows');
  check(await part.page.getByRole('button', { name: /^Edit / }).count() === 0, 'Edit does not');
  const a = await api(part.page, 'POST', '/api/tables/branch', { name: 'WT Partial Branch', code: 'wp' });
  const u = await api(part.page, 'PUT', `/api/tables/branch/${a.body.data.id}`, { name: 'WT Partial Branch 2' });
  const d = await api(part.page, 'DELETE', `/api/tables/branch/${a.body.data.id}`);
  const other = await api(part.page, 'GET', '/api/tables/ships');
  check(a.status === 201 && u.status === 403 && d.status === 403 && other.status === 403, 'add 201; edit, delete and another table 403', `${a.status},${u.status},${d.status},${other.status}`);
  await part.page.goto(`${BASE}/app.html#tables/ships`);
  await part.page.waitForSelector('#app-main h1');
  check(await part.page.getByText('You Do Not Have Access to This Page').isVisible(), 'another table shows not allowed');
  check(part.errors.length === 0, 'partial: no browser errors', part.errors.join(' | '));
  await part.context.close();
}

// ---------------------------------------------------------------------------
// The audit trail holds every write; the ratings forms still have their dropdowns
// ---------------------------------------------------------------------------
async function auditAndRatings(browser, db) {
  console.log('\nThe audit trail');
  const ctx = await open(browser, { viewport: DESKTOP, theme: 'light' });
  const { page } = ctx;
  await signIn(page, ADMIN);
  for (const t of TABLES) {
    const rows = (await api(page, 'GET', `/api/audit?pageSize=100&table=${t.table}`)).body.data;
    const n = (a) => rows.filter((r) => r.action === a).length;
    check(n('INSERT') >= 1 && n('UPDATE') >= 2 && n('DELETE') >= 1, `${t.table}: INSERT, UPDATE and DELETE rows kept (${n('INSERT')}/${n('UPDATE')}/${n('DELETE')})`);
    check(rows.every((r) => r.username && r.ip), `${t.table}: the rows name who and where from`);
  }
  const trainingRows = (await api(page, 'GET', '/api/audit?pageSize=100&table=ref_training&action=INSERT')).body.data;
  const detail = (await api(page, 'GET', `/api/audit/${trainingRows[0].id}`)).body.data;
  check(detail.changes.some((c) => c.field === 'name') && detail.changes.some((c) => c.field === 'weeks'), 'an INSERT lists the fields filled');
  const refused = (await api(page, 'GET', '/api/audit?pageSize=100&table=ref_branch&action=DELETE')).body.data.length;
  const [branch] = (await db.query("SELECT id FROM ref_branch WHERE id IN (SELECT branch_id FROM ratings) LIMIT 1"))[0];
  await api(page, 'DELETE', `/api/tables/branch/${branch.id}`);
  const after = (await api(page, 'GET', '/api/audit?pageSize=100&table=ref_branch&action=DELETE')).body.data.length;
  check(after === refused, 'a refused delete leaves no audit row');

  console.log('\nThe rating forms still offer the dropdowns');
  await page.goto(`${BASE}/app.html#ratings/edit/B0539`);
  await page.waitForSelector('text=Edit Details');
  const heldId = (await db.query('SELECT branch_id FROM ratings WHERE service_number = ?', ['B0539']))[0][0].branch_id;
  check(!!heldId, 'B0539 holds a branch');
  const lookupsBefore = (await api(page, 'GET', '/api/lookups')).body.data;
  check(lookupsBefore.branches.length > 5 && lookupsBefore.ships.length > 5 && lookupsBefore.rates.length > 5 && lookupsBefore.localGovernments.length > 5, 'GET /api/lookups still lists branches, ships, rates and local governments');
  // make that branch Inactive: it leaves the list, B0539 still shows it and still can keep it
  const row = (await api(page, 'GET', `/api/tables/branch/${heldId}`)).body.data;
  const off = await api(page, 'PUT', `/api/tables/branch/${heldId}`, { name: row.name, code: row.code, is_active: false });
  check(off.status === 200, 'Branch made Inactive while a rating holds it');
  const lookupsAfter = (await api(page, 'GET', '/api/lookups')).body.data;
  check(!lookupsAfter.branches.some((b) => b.id === heldId) && lookupsAfter.inactive.branches.some((b) => b.id === heldId), 'the Inactive branch is out of the dropdown list');
  // leave the record and come back WITHOUT a page reload: the record reads the lists afresh each time it opens
  await page.evaluate(() => { window.location.hash = '#ratings/current'; });
  await page.waitForSelector('#app-main table tbody tr');
  await page.evaluate(() => { window.location.hash = '#ratings/edit/B0539'; });
  await page.waitForSelector('text=Edit Details');
  await page.waitForSelector(`text=${row.name}`);
  check(await page.getByText(row.name).first().isVisible(), 'the record still shows the Inactive branch');
  await page.getByRole('button', { name: /Edit Official/ }).first().click();
  const dlg = dialogOf(page);
  await dlg.waitFor();
  const value = await dlg.locator('input.custom-dropdown-hidden[name="branch_id"]').inputValue();
  check(Number(value) === heldId, 'the edit dialog keeps the Inactive branch selected');
  const options = await dlg.locator('[name="branch_id"]').first().evaluate((w) => (w.options ? Array.from(w.options).map((o) => o.text) : []));
  check(options.some((o) => o.includes('(Inactive)')) && options.length > 5, 'the dialog still offers the other branches', options.slice(0, 3).join('|'));
  await page.keyboard.press('Escape');
  await api(page, 'PUT', `/api/tables/branch/${heldId}`, { name: row.name, code: row.code, is_active: true });
  // the new-rating dialog has its dropdowns
  await page.goto(`${BASE}/app.html#ratings/new`);
  await page.waitForSelector('#overlay-root [role="dialog"]');
  const rateOptions = await dialogOf(page).locator('[name="rate_id"]').first().evaluate((w) => (w.options ? w.options.length : 0)).catch(() => 0);
  check(rateOptions > 5, 'New Rating offers the Rate dropdown', `${rateOptions}`);
  check(ctx.errors.length === 0, 'audit and forms: no browser errors', ctx.errors.join(' | '));
  await ctx.context.close();
}

// ---------------------------------------------------------------------------
// The specification (PLAN 9c): each table's fields, lengths and rules, field by field
// ---------------------------------------------------------------------------
const SPEC = {
  'appraisal-ratings': { fields: { code: [5, true], name: [50, true], score_low: [0, true], score_high: [100, true] } },
  branch: { fields: { name: [150, true], code: [2, true] } },
  'exit-type': { fields: { name: [150, true], code: [2, true], keeps_current: [null, false], is_death: [null, false] } },
  'entry-mode': { fields: { name: [150, true], code: [5, true] } },
  offences: { fields: { name: [100, true], code: [10, true], category: [null, false] } },
  sanctions: { fields: { name: [100, true], severity: [null, false] } },
  institution: { fields: { code: [30, false], name: [100, true], location: [100, false], type: [null, false] } },
  'local-government': { fields: { name: [150, true], state_id: [null, true], code: [10, false] } },
  languages: { fields: { name: [150, true] } },
  relationship: { fields: { name: [150, true], code: [5, false] } },
  'staff-branch': { fields: { name: [150, true], code: [20, false], command_id: [null, false], department: [20, false], cdr: [20, false] } },
  specialisation: { fields: { name: [150, true], code: [15, true], second_description: [20, false] } },
  ships: { fields: { name: [150, true], type: [null, true], command_id: [null, false], description: [150, false] } },
  states: { fields: { name: [150, true], code: [5, true], geo_political_zone_id: [null, false] } },
  title: { fields: { name: [150, true], description: [50, false] } },
  training: { fields: { code: [10, false], name: [60, true], qualification: [50, false], institution_id: [null, true], weeks: [1, true], branch_id: [null, false], specialisation_id: [null, false], rate_ids: [null, false] } },
};
const OPTIONS = {
  'offences.category': ['Conduct', 'Discipline', 'Duty', 'Property'],
  'sanctions.severity': ['Minor', 'Major'],
  'institution.type': ['University', 'Polytechnic', 'College', 'Secondary School', 'Training Centre', 'Training Base', 'Other'],
  'ships.type': ['Ship', 'Base', 'Training'],
};

async function specification(browser) {
  console.log('\nThe specification, table by table');
  const ctx = await open(browser, { viewport: DESKTOP, theme: 'light' });
  const { page } = ctx;
  await signIn(page, ADMIN);
  for (const t of TABLES) {
    const meta = (await api(page, 'GET', `/api/tables/${t.slug}/meta`)).body.data;
    const real = meta.columns.filter((c) => c.type !== 'virtual');
    const want = SPEC[t.slug].fields;
    check(JSON.stringify(real.map((c) => c.key).sort()) === JSON.stringify(Object.keys(want).sort()), `${t.slug}: the fields are ${Object.keys(want).join(', ')}`, real.map((c) => c.key).join(','));
    for (const [key, [limit, required]] of Object.entries(want)) {
      const c = real.find((x) => x.key === key);
      if (!c) continue;
      const okRequired = !!c.required === required;
      const okLimit = limit === null || c.max === limit || c.min === limit;
      check(okRequired && okLimit, `${t.slug}.${key}: ${required ? 'required' : 'optional'}${limit === null ? '' : `, ${limit}`}`, JSON.stringify({ required: c.required, max: c.max, min: c.min }));
      const opts = OPTIONS[`${t.slug}.${key}`];
      if (opts) check(JSON.stringify(c.options) === JSON.stringify(opts), `${t.slug}.${key}: ${opts.join(', ')}`);
      if (key === 'code') check(c.upper === true, `${t.slug}.code: kept upper case`);
    }
  }
  // lists: the demo's columns and the code, four at most
  for (const t of TABLES) {
    const meta = (await api(page, 'GET', `/api/tables/${t.slug}/meta`)).body.data;
    const listed = meta.columns.filter((c) => c.list);
    check(listed.length >= 1 && listed.length <= 4, `${t.slug}: the list shows ${listed.length} columns (${listed.map((c) => c.label).join(', ')})`);
  }

  // codes: trimmed, upper case, unique, required where marked
  const made = [];
  const post = async (slug, body) => { const r = await api(page, 'POST', `/api/tables/${slug}`, body); if (r.status === 201) made.push([slug, r.body.data.id]); return r; };
  const branch = await post('branch', { name: 'WT Code Branch', code: ' qz ' });
  check(branch.status === 201 && branch.body.data.code === 'QZ', 'a code is trimmed and kept upper case ("qz" becomes QZ)', JSON.stringify(branch.body));
  const dupCode = await post('branch', { name: 'WT Code Branch 2', code: 'qz' });
  check(dupCode.status === 422 && dupCode.body.error.fields.code, 'a duplicate code is refused, whatever its case');
  const longCode = await post('branch', { name: 'WT Code Branch 3', code: 'ABC' });
  check(longCode.status === 422 && longCode.body.error.fields.code, 'a code over its length is refused (Branch: 2)');
  const noCode = await post('branch', { name: 'WT Code Branch 4' });
  check(noCode.status === 422 && noCode.body.error.fields.code, 'a required code left empty is refused (Branch)');
  const noCodeOk = await post('relationship', { name: 'WT No Code Rel' });
  check(noCodeOk.status === 201 && noCodeOk.body.data.code === null, 'an optional code may be left empty (Relationship)');

  // Exit Type: the flag that keeps a rating current
  const exit = await post('exit-type', { name: 'WT Serving Exit', code: 'wz', keeps_current: true });
  check(exit.status === 201 && exit.body.data.keeps_current === 1, 'an Exit Type stores "Rating stays current"');
  let lookups = (await api(page, 'GET', '/api/lookups')).body.data;
  check(lookups.exitTypes.find((x) => x.code === 'A').keepsCurrent === true && lookups.exitTypes.find((x) => x.code === 'M').keepsCurrent === true && lookups.exitTypes.find((x) => x.code === 'C').keepsCurrent === true, 'the old codes A, M and C keep a rating current (seed, in /api/lookups)');
  check(lookups.exitTypes.filter((x) => x.isDeath).map((x) => x.code).join() === 'DE' && lookups.exitTypes.every((x) => typeof x.isDeath === 'boolean'), 'only the deceased exit type is marked Death (both flags are in /api/lookups)');
  check(lookups.inactive.entryModes.some((x) => x.name === 'Sportsmen Enlistment'), 'after a fresh seed the demo\'s switched-off entry mode is Inactive');
  check(lookups.exitTypes.find((x) => x.name === 'DECEASED').isDeath === true, 'after a fresh seed the deceased exit type has Death = yes');
  check(lookups.exitTypes.filter((x) => x.keepsCurrent).length === 4 && lookups.exitTypes.find((x) => x.code === 'RT').keepsCurrent === false, 'the other exit types do not');

  // Appraisal Ratings: low not above high, no overlap
  const g1 = await api(page, 'POST', '/api/tables/appraisal-ratings', { code: 'x1', name: 'WT Backwards', score_low: 50, score_high: 40 });
  check(g1.status === 422 && g1.body.error.fields.score_high, 'a grade whose lowest score is above its highest is refused');
  const g2 = await api(page, 'POST', '/api/tables/appraisal-ratings', { code: 'x2', name: 'WT Overlap', score_low: 80, score_high: 95 });
  check(g2.status === 422 && g2.body.error.fields.score_low && /overlap/.test(g2.body.error.fields.score_low), 'a grade overlapping another is refused', JSON.stringify(g2.body));
  const g3 = await api(page, 'POST', '/api/tables/appraisal-ratings', { code: 'x3', name: 'WT Range', score_low: 101, score_high: 105 });
  check(g3.status === 422, 'scores run from 0 to 100');
  const grades = (await api(page, 'GET', '/api/tables/appraisal-ratings')).body.data;
  check(grades.map((g) => g.score_range).join('|') === '90 - 100|75 - 89|60 - 74|45 - 59|0 - 44', 'the seeded grades have their score ranges', grades.map((g) => g.score_range).join('|'));

  // links the later modules read, in /api/lookups
  check(lookups.branches.find((b) => b.code === 'SM').name === 'Seaman', 'lookups: the Seaman branch has code SM');
  check(lookups.specialisations.every((x) => x.code), 'lookups: every specialisation has a code');
  const lagos = lookups.states.find((x) => x.name === 'Lagos');
  check(lagos.code === 'LA' && lookups.geoPoliticalZones.find((z) => z.id === lagos.geoPoliticalZoneId).name === 'South West', 'lookups: a state carries its code and zone (Lagos, LA, South West)');
  check(lookups.states.every((x) => x.code && x.geoPoliticalZoneId), 'lookups: every state has both');
  const aradu = lookups.ships.find((x) => x.name === 'NNS ARADU');
  check(aradu.type === 'Ship' && aradu.commandId && lookups.commands.find((c) => c.id === aradu.commandId), 'lookups: a ship carries its type and command');
  check(lookups.ships.some((x) => x.type === 'Base'), 'lookups: ships and bases are told apart');
  const tr = lookups.staffBranches.find((x) => x.name === 'Training');
  check(tr.code === 'TRG' && tr.commandId, 'lookups: a staff branch carries its code and command');
  check(lookups.titles.find((x) => x.name === 'PO').description === 'Petty Officer', 'lookups: a title carries its description');
  check(lookups.rates.map((r) => r.code).join(',') === 'OS,AB,LS,PO,CPO,WO,MWO,NWO', 'rates have codes, in rank order, lowest first', lookups.rates.map((r) => r.code).join(','));
  check(lookups.institutions.length >= 6 && lookups.trainingCourses.length >= 8 && lookups.appraisalRatings.length === 5 && lookups.offences.length >= 8 && lookups.sanctions.length >= 8, 'lookups: the new tables are served too (institutions, courses, grades, offences, sanctions)');
  const gun = lookups.trainingCourses.find((c) => c.name === 'Gunnery Course');
  check(gun.rateIds.length === 3 && gun.specialisationId && gun.branchId === null, 'lookups: a course carries its rates, specialisation and "any" branch');

  // a rating's training entry links an institution and a course; the record shows the names
  const inst = lookups.institutions.find((x) => x.name === 'NNS Quorra');
  const entry = await api(page, 'POST', '/api/ratings/B0539/records/training', { institution_id: inst.id, training_course_id: gun.id, classification: 'WT', start_date: '2020-01-01' });
  const row = entry.body && entry.body.data && entry.body.data.items.find((r) => r.training_course_id === gun.id);
  check(entry.status === 201 && row && row.institution === 'NNS Quorra' && row.qualification === 'Gunnery Course' && row.institution_id === inst.id, 'a training entry picks its course and institution; the record keeps their names', JSON.stringify(entry.body && entry.body.error));
  const edu = await api(page, 'POST', '/api/ratings/B0539/records/education', { institution_id: inst.id, qualification: 'WT Cert' });
  const eduRow = edu.body && edu.body.data && edu.body.data.items.find((r) => r.qualification === 'WT Cert');
  check(edu.status === 201 && eduRow && eduRow.institution === 'NNS Quorra' && eduRow.institution_id === inst.id, 'an education entry picks its institution');
  const legacy = await api(page, 'POST', '/api/ratings/B0539/records/education', { institution: 'Old Text School', qualification: 'WT Old' });
  check(legacy.status === 201, 'an entry with only text (before the table) is still accepted');
  const noInst = await api(page, 'POST', '/api/ratings/B0539/records/training', { qualification: 'x' });
  check(noInst.status === 422 && noInst.body.error.fields.institution_id, 'a training entry with no institution or course is refused');
  const refusedInst = await api(page, 'DELETE', `/api/tables/institution/${inst.id}`);
  check(refusedInst.status === 409 && /training record/.test(refusedInst.body.error.message) && /education record/.test(refusedInst.body.error.message), 'the in-use check reads declared foreign keys: the institution is held by training and education entries', refusedInst.body && refusedInst.body.error.message);
  const refusedCourse = await api(page, 'DELETE', `/api/tables/training/${gun.id}`);
  check(refusedCourse.status === 409 && /training record/.test(refusedCourse.body.error.message), 'a course a rating took cannot be deleted either');
  for (const [tabKey, list] of [['training', entry], ['education', legacy]]) {
    for (const it of list.body.data.items.filter((r) => r.classification === 'WT' || /^WT /.test(`${r.qualification}`))) await api(page, 'DELETE', `/api/ratings/B0539/records/${tabKey}/${it.id}`);
  }
  for (const [slug, id] of made.reverse()) await api(page, 'DELETE', `/api/tables/${slug}/${id}`);
  check(ctx.errors.length === 0, 'specification: no browser errors', ctx.errors.join(' | '));
  await ctx.context.close();
}

// ---------------------------------------------------------------------------
// The rating form: State fills the zone, Command narrows the Staff Branch list
// ---------------------------------------------------------------------------
async function ratingFormLinks(browser) {
  console.log('\nThe rating form follows the tables');
  const ctx = await open(browser, { viewport: DESKTOP, theme: 'light' });
  const { page } = ctx;
  await signIn(page, ADMIN);
  await page.goto(`${BASE}/app.html#ratings/edit/B0539`);
  await page.waitForSelector('text=Edit Details');
  await page.getByRole('button', { name: /Edit Contact/ }).first().click();
  let dlg = dialogOf(page);
  await dlg.waitFor();
  await choose(page, 'state_id', 'Lagos');
  const zones = (await api(page, 'GET', '/api/lookups')).body.data.geoPoliticalZones;
  const zoneValue = await dlg.locator('input.custom-dropdown-hidden[name="geo_political_zone_id"]').inputValue();
  check(zones.find((z) => String(z.id) === zoneValue).name === 'South West', 'choosing the state Lagos fills the zone South West');
  await choose(page, 'state_id', 'Kano');
  const zone2 = await dlg.locator('input.custom-dropdown-hidden[name="geo_political_zone_id"]').inputValue();
  check(zones.find((z) => String(z.id) === zone2).name === 'North West', 'choosing Kano changes it to North West');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Edit Official/ }).first().click();
  dlg = dialogOf(page);
  await dlg.waitFor();
  const before = await dlg.locator('[name="staff_branch_id"]').first().evaluate((w) => w.options.length);
  await choose(page, 'command_id', 'Logistics Command');
  const after = await dlg.locator('[name="staff_branch_id"]').first().evaluate((w) => Array.from(w.options).map((o) => o.text));
  check(after.includes('Logistics') && !after.includes('Training') && !after.includes('Operations'), 'choosing the Logistics Command narrows the Staff Branch list to its staff branches', `${before} -> ${after.join('|')}`);
  await page.keyboard.press('Escape');
  check(ctx.errors.length === 0, 'rating form: no browser errors', ctx.errors.join(' | '));
  await ctx.context.close();
}

async function main() {
  const started = Date.now();
  const db = await connect();
  await setup(db);
  const browser = await chromium.launch();
  try {
    // the specification and the rules first, through the API (they read the seeded grades)
    const admin = await open(browser, { viewport: DESKTOP, theme: 'light' });
    await signIn(admin.page, ADMIN);
    await specification(browser);
    await apiRules(admin.page, db);
    check(admin.errors.length === 0, 'API rules: no browser errors', admin.errors.join(' | '));
    await admin.context.close();

    // then the screens, lanes side by side (their data cannot collide: own tags, own contexts)
    await db.query("UPDATE ref_appraisal_rating SET score_high = 40 WHERE code = 'E'"); // room for the cycle's grade (41 to 44)
    const lanes = [0, 1, 2].map((n) => TABLES.filter((_, i) => i % 3 === n));
    await Promise.all([
      cycleLane(browser, db, lanes[0], '0'),
      cycleLane(browser, db, lanes[1], '4'),
      cycleLane(browser, db, lanes[2], '5'),
      (async () => { await glanceLane(browser, db, DESKTOP, 'dark', '1'); })(),
      (async () => { await glanceLane(browser, db, PHONE, 'light', '2'); })(),
      (async () => { await glanceLane(browser, db, PHONE, 'dark', '3'); })(),
      (async () => { await trainingRules(browser); await lgaRules(browser); await ratingFormLinks(browser); })(),
      (async () => {
        await withoutGrants(browser, 'light', DESKTOP);
        await withoutGrants(browser, 'dark', PHONE);
        await viewerRun(browser, 'light', DESKTOP);
        await viewerRun(browser, 'dark', PHONE);
        await keeperRun(browser);
      })(),
    ]);
    await db.query("UPDATE ref_appraisal_rating SET score_high = 44 WHERE code = 'E'");
    await auditAndRatings(browser, db);
  } finally {
    await browser.close();
    await cleanup(db).catch(() => {});
    await db.end();
  }
  const seconds = Math.round((Date.now() - started) / 1000);
  check(seconds <= 300, `the walk-through took ${seconds} s (at most 300 s)`);
  console.log(`\n${passes} passed, ${failures} failed, in ${seconds} s`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
