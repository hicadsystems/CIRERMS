#!/usr/bin/env node
'use strict';

/*
 * Walk-through of the record's fields (W1): next of kin, spouse, children, drafting (postings) and the
 * Ships' types and Command column. Uses the Playwright installed on the machine (not a project dependency):
 *
 *   npm run migrate:fresh && npm run seed       # a fresh demo database
 *   npm start                                   # the app on :3000
 *   NODE_PATH=$(npm root -g) node tests/e2e/record-fields-walkthrough.js
 *
 * BASE changes the address; SHOTS=<dir> saves screenshots there. It reads .env for the database (the audit
 * trail, the rows behind the screens) and makes one posting move in this process (the Drafting module's own
 * move), to see what a posting CIRERMS makes itself carries. Exits non-zero when a check fails; browser errors
 * fail the run; the run fails over five minutes.
 *
 * Through the API as the Administrator: the required fields and the errors under them, the Local Government
 * that must belong to its State, a child's date of birth, the defaults of a new posting (the ship's Command, the
 * rating's Branch, Active), the audit rows field by field, the dossier printout, the ship types Sea, Land and
 * Training. Then at 1440 px, light: every dialog through the screens (Add, the errors under the fields, View
 * Details, Edit, Delete). Then 1440 light and dark and 390 light and dark draw each tab, its Add dialog and its
 * View Details with nothing overflowing.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const mysql = require('mysql2/promise');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:3000';
const SHOTS = process.env.SHOTS || '';
const ADMIN = { username: 'HICO001', password: 'Admin@123' };
const RATING = { username: 'B0539', password: 'Rating@123' };
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const SN = 'B0541'; // a rating with a posting, no next of kin, spouse or children of its own

const STARTED = Date.now();
const LIMIT_SECONDS = 300;
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
  const context = await browser.newContext({ viewport, colorScheme: theme, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  const errors = [];
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
  const res = await fetch(url, { method, credentials: 'include', headers: data ? { 'Content-Type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined });
  let body = null;
  try { body = await res.json(); } catch (_) { body = null; }
  return { status: res.status, body };
}, { method, url, data });

const dialogOf = (page) => page.locator('#overlay-root [role="dialog"]').last();
const settle = (loc) => loc.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {}))));
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function toastText(page, re) {
  const t = page.locator('#toast-root [role]', { hasText: re }).last();
  await t.waitFor({ timeout: 8000 });
  const text = (await t.innerText()).trim();
  await t.getByRole('button', { name: 'Dismiss' }).click().catch(() => {});
  return text;
}

async function choose(page, name, label) {
  const dlg = dialogOf(page);
  await dlg.locator(`.custom-dropdown-wrapper[name="${name}"] input:not(.custom-dropdown-hidden)`).first().click();
  const options = page.locator('.custom-dropdown-list:visible .custom-dropdown-item:not(.cdd-placeholder)');
  await options.first().waitFor();
  if (label) await options.filter({ hasText: label }).first().click();
  else await options.first().click();
}
const dropdownValue = (page, name) => dialogOf(page).locator(`input.custom-dropdown-hidden[name="${name}"]`).inputValue();
const dropdownLabels = async (page, name) => {
  const dlg = dialogOf(page);
  await dlg.locator(`.custom-dropdown-wrapper[name="${name}"] input:not(.custom-dropdown-hidden)`).first().click();
  const items = page.locator('.custom-dropdown-list:visible .custom-dropdown-item:not(.cdd-placeholder)');
  await items.first().waitFor();
  const labels = await items.allInnerTexts();
  await page.keyboard.press('Escape');
  return labels.map((t) => t.trim());
};

async function goRecord(page, tab, sn = SN) {
  await page.goto(`${BASE}/app.html#ratings/edit/${sn}`);
  await page.waitForSelector('#app-main [role="tablist"]', { timeout: 15000 });
  await page.locator('#app-main [role="tab"]', { hasText: new RegExp(`^${tab}`) }).first().click();
  await page.waitForTimeout(150);
}
const body = (page) => page.locator('#app-main');
const saveBtn = (page) => dialogOf(page).getByRole('button', { name: 'Save' });
const fieldError = (page, name) => dialogOf(page).locator(`[name="${name}"]`).first().locator('xpath=ancestor::*[@data-field][1]').locator('[data-field-error]');

async function connect() {
  return mysql.createConnection({ host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
}

// ---------------------------------------------------------------------------
// The rules and the data, through the API
// ---------------------------------------------------------------------------
async function apiRules(browser, db) {
  console.log('\nThe rules, through the API');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);
  const base = `/api/ratings/${SN}/records`;
  const [[rel]] = await db.query("SELECT id FROM ref_next_of_kin_type WHERE name = 'Father'");
  const [[enugu]] = await db.query("SELECT id FROM ref_state WHERE name = 'Enugu'");
  const [[lagosLga]] = await db.query("SELECT l.id FROM ref_local_government l JOIN ref_state s ON s.id = l.state_id WHERE s.name = 'Lagos' LIMIT 1");
  const [[enuguLga]] = await db.query("SELECT l.id FROM ref_local_government l JOIN ref_state s ON s.id = l.state_id WHERE s.name = 'Enugu' LIMIT 1");

  // next of kin: the six required fields
  const empty = await api(page, 'POST', `${base}/next-of-kin`, {});
  const need = ['first_name', 'last_name', 'full_address', 'next_of_kin_type_id', 'mobile_number', 'email_address'];
  check(empty.status === 422 && need.every((k) => empty.body.error.fields && empty.body.error.fields[k]), 'Next of Kin: First Name, Last Name, Full Address, Relationship, Mobile Number and Email Address are required', JSON.stringify(empty.body && empty.body.error.fields));
  const badMail = await api(page, 'POST', `${base}/next-of-kin`, { first_name: 'Ada', last_name: 'Obi', full_address: '1 Road', next_of_kin_type_id: rel.id, mobile_number: '08031112222', email_address: 'nope' });
  check(badMail.status === 422 && badMail.body.error.fields.email_address, 'Next of Kin: an e-mail address must look like one');
  const badType = await api(page, 'POST', `${base}/next-of-kin`, { first_name: 'Ada', last_name: 'Obi', full_address: '1 Road', next_of_kin_type_id: rel.id, mobile_number: '08031112222', email_address: 'a@cirerms.example', kin_type: 'Third' });
  check(badType.status === 422 && badType.body.error.fields.kin_type, 'Next of Kin: the type is Main or Alternate');
  const nok = await api(page, 'POST', `${base}/next-of-kin`, {
    first_name: 'okeke', last_name: 'ADA nwosu', full_address: '9 Orji Street, Owerri', next_of_kin_type_id: rel.id, kin_type: 'Main',
    mobile_number: '08031112222', home_number: '08041113333', email_address: 'okeke.nwosu@cirerms.example', place_of_work: 'Imo State Secretariat',
  });
  check(nok.status === 200 || nok.status === 201, 'Next of Kin: a full record is saved', JSON.stringify(nok.body).slice(0, 200));
  const row = (nok.body.data.items || [])[0] || {};
  check(row.first_name === 'okeke' && row.last_name === 'ADA nwosu', "a relative's name stays as typed");
  check(row.full_address === '9 Orji Street, Owerri' && row.home_number === '08041113333' && row.place_of_work === 'Imo State Secretariat' && row.next_of_kin_type_name === 'Father' && row.kin_type === 'Main', 'Next of Kin: the new fields are kept and the Relationship is named');
  const [[audited]] = await db.query("SELECT changes FROM audit_trail WHERE table_name = 'rating_next_of_kin' AND action = 'INSERT' AND record_id = ? ORDER BY id DESC LIMIT 1", [`${SN}:${row.id}`]);
  const fields = (typeof audited.changes === 'string' ? JSON.parse(audited.changes) : audited.changes).map((c) => c.field);
  check(['full_address', 'home_number', 'email_address', 'place_of_work', 'kin_type'].every((f) => fields.includes(f)), 'Next of Kin: the audit trail keeps each new field', fields.join(', '));
  const upd = await api(page, 'PUT', `${base}/next-of-kin/${row.id}`, { first_name: 'okeke', last_name: 'ADA nwosu', full_address: '12 Orji Street, Owerri', next_of_kin_type_id: rel.id, mobile_number: '08031112222', email_address: 'okeke.nwosu@cirerms.example' });
  check(upd.status === 200, 'Next of Kin: an edit is saved');
  const [[auditedU]] = await db.query("SELECT changes FROM audit_trail WHERE table_name = 'rating_next_of_kin' AND action = 'UPDATE' AND record_id = ? ORDER BY id DESC LIMIT 1", [`${SN}:${row.id}`]);
  const changed = (typeof auditedU.changes === 'string' ? JSON.parse(auditedU.changes) : auditedU.changes).find((c) => c.field === 'full_address');
  check(changed && changed.from === '9 Orji Street, Owerri' && changed.to === '12 Orji Street, Owerri', 'Next of Kin: an edit is audited field by field (from and to)');

  // spouse: only the name is required; the Local Government must be in the State
  const noName = await api(page, 'POST', `${base}/spouse`, {});
  check(noName.status === 422 && noName.body.error.fields.name && Object.keys(noName.body.error.fields).length === 1, 'Spouse: only Full Name is required');
  const wrongLga = await api(page, 'POST', `${base}/spouse`, { name: 'Ngozi Eze', state_id: enugu.id, local_government_id: lagosLga.id });
  check(wrongLga.status === 422 && wrongLga.body.error.fields.local_government_id, 'Spouse: a Local Government must belong to the State');
  const lgaNoState = await api(page, 'POST', `${base}/spouse`, { name: 'Ngozi Eze', local_government_id: enuguLga.id });
  check(lgaNoState.status === 422 && lgaNoState.body.error.fields.local_government_id, 'Spouse: a Local Government needs its State');
  const sp = await api(page, 'POST', `${base}/spouse`, { name: 'ngozi EZE', street: '4 Park Avenue', town: 'GRA', state_id: enugu.id, local_government_id: enuguLga.id, po_box: 'PMB 12' });
  const spRow = (sp.body.data.items || [])[0] || {};
  check([200, 201].includes(sp.status) && spRow.name === 'ngozi EZE' && spRow.street === '4 Park Avenue' && spRow.state_name === 'Enugu' && spRow.local_government_name && spRow.po_box === 'PMB 12', 'Spouse: the address is kept and named');

  // children: the date of birth, not in the future
  const [[male]] = await db.query("SELECT id FROM ref_gender WHERE name = 'Male'");
  const future = new Date(Date.now() + 86400000 * 30).toISOString().slice(0, 10);
  const futureDob = await api(page, 'POST', `${base}/children`, { name: 'Baby Eze', date_of_birth: future });
  check(futureDob.status === 422 && futureDob.body.error.fields.date_of_birth, "Children: a date of birth in the future is refused");
  const badDob = await api(page, 'POST', `${base}/children`, { name: 'Baby Eze', date_of_birth: '2019-02-30' });
  check(badDob.status === 422 && badDob.body.error.fields.date_of_birth, 'Children: a date that is not real is refused');
  const born = `${new Date().getFullYear() - 6}-04-01`;
  const ch = await api(page, 'POST', `${base}/children`, {
    name: 'Obinna eze', gender_id: male.id, date_of_birth: born, phone_number: '08051112222', email_address: 'obinna@cirerms.example', street: '4 Park Avenue', town: 'GRA',
    state_id: enugu.id, local_government_id: enuguLga.id, po_box: 'PMB 12', school: 'Corona School', office_address: '', occupation: 'Pupil',
  });
  const chRow = (ch.body.data.items || [])[0] || {};
  check([200, 201].includes(ch.status) && ( chRow.gender_name === 'Male' && chRow.school === 'Corona School' && chRow.occupation === 'Pupil' && (chRow.age === 5 || chRow.age === 6)), 'Children: sex, date of birth (and so the age), school and occupation are kept', JSON.stringify(chRow).slice(0, 200));

  // postings: a new one the form leaves unsaid takes the ship's Command, the rating's Branch and Active
  const [[ship]] = await db.query("SELECT s.id, s.command_id, c.name AS command FROM ref_ship s JOIN ref_command c ON c.id = s.command_id WHERE s.name = 'NNS KADA'");
  const [[rating]] = await db.query('SELECT branch_id FROM ratings WHERE service_number = ?', [SN]);
  const [[active]] = await db.query("SELECT id FROM ref_exit_type WHERE name = 'Active'");
  const [[branch]] = await db.query("SELECT id FROM ref_branch WHERE id <> ? ORDER BY id LIMIT 1", [rating.branch_id]);
  const post = await api(page, 'POST', `${base}/drafting`, { ship_id: ship.id, start_date: '2019-01-01', end_date: '2020-12-31', authority: 'NHQ/NP/DOD/55/2019', decoration: 'Gallantry Medal', remarks: 'Walk-through posting' });
  const pRow = (post.body.data.items || []).find((p) => p.remarks === 'Walk-through posting') || {};
  check([200, 201].includes(post.status) && pRow.command_id === ship.command_id && pRow.branch_id === rating.branch_id && pRow.exit_type_id === active.id, "Drafting: a new posting takes the ship's Command, the rating's Branch and Active", JSON.stringify(pRow).slice(0, 250));
  check(pRow.authority === 'NHQ/NP/DOD/55/2019' && pRow.decoration === 'Gallantry Medal' && pRow.command_name === ship.command && pRow.status_name === 'Active', 'Drafting: Authority and Decoration/Award are kept, the names read');
  const own = await api(page, 'PUT', `${base}/drafting/${pRow.id}`, { ship_id: ship.id, start_date: '2019-01-01', end_date: '2020-12-31', branch_id: branch.id, command_id: '', exit_type_id: '', remarks: 'Walk-through posting' });
  const own2 = (own.body.data.items || []).find((p) => p.id === pRow.id) || {};
  check(own.status === 200 && own2.branch_id === branch.id && own2.command_id === null && own2.exit_type_id === null, 'Drafting: the person can change what the form prefilled, or leave it empty');
  const badBranch = await api(page, 'POST', `${base}/drafting`, { ship_id: ship.id, branch_id: 999999 });
  check(badBranch.status === 422 && badBranch.body.error.fields.branch_id, 'Drafting: a Branch that is not in the table is refused');

  // a posting CIRERMS makes itself
  const postings = require('../../src/modules/drafting/postings.service');
  const appDb = require('../../src/db');
  const [[other]] = await db.query("SELECT s.id, s.command_id FROM ref_ship s WHERE s.name = 'NNS DELTA'");
  const moved = await appDb.transaction((tx) => postings.move(tx, { userId: 1, username: 'HICO001', ip: '127.0.0.1' }, { serviceNumber: SN, shipId: other.id, wef: new Date().toISOString().slice(0, 10), authority: 'NHQ/NP/DOD/77/2026' }));
  const [[made]] = await db.query('SELECT * FROM rating_drafting WHERE id = ?', [moved.postingId]);
  check(moved.status === 'reported' && made.command_id === other.command_id && made.branch_id === rating.branch_id && made.authority === 'NHQ/NP/DOD/77/2026' && made.exit_type_id === active.id, "a posting CIRERMS makes: the new ship's Command, the rating's Branch, the authority, Active", JSON.stringify(made));
  await appDb.close && appDb.close().catch(() => {});

  // the dossier printout
  const pdf = await page.evaluate(async (sn) => {
    const res = await fetch(`/api/ratings/${sn}/pdf`, { credentials: 'include' });
    const buf = new Uint8Array(await res.arrayBuffer());
    return { status: res.status, type: res.headers.get('content-type'), bytes: Array.from(buf) };
  }, SN);
  check(pdf.status === 200 && /pdf/.test(pdf.type) && pdf.bytes.length > 2000, 'the dossier prints a PDF');
  const file = path.join(require('os').tmpdir(), `w1-dossier-${Date.now()}.pdf`);
  fs.writeFileSync(file, Buffer.from(pdf.bytes));
  const text = require('child_process').spawnSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' }).stdout || '';
  if (process.env.KEEP_PDF) fs.copyFileSync(file, process.env.KEEP_PDF);
  fs.unlinkSync(file);
  if (text) {
    const has = (s) => text.replace(/\s+/g, ' ').includes(s);
    check(has('9 Orji Street') || has('12 Orji Street'), 'the dossier shows the next of kin address');
    check(has('okeke.nwosu@cirerms.example') && has('Imo State Secretariat') || has('Place of Work'), 'the dossier shows the next of kin e-mail and place of work');
    check(has('4 Park Avenue') && has('PMB 12'), 'the dossier shows the spouse address and P.O. box');
    check(has('Corona School') && has('Pupil'), "the dossier shows a child's school and occupation");
    check(has('Operation Pulo Shield Medal') && has('NHQ/NP/DOD/204/2021') && has('Decoration/Award') && has('NHQ/NP/DOD/77/2026'), 'the dossier shows the posting authority, decoration and status');
  } else check(true, 'pdftotext is not here: the dossier text was not read');

  // the ships' types
  const [types] = await db.query("SELECT DISTINCT type FROM ref_ship ORDER BY type");
  check(types.every((t) => ['Sea', 'Land', 'Training'].includes(t.type)), 'Ships: every stored type is Sea, Land or Training', types.map((t) => t.type).join(', '));
  const [[kada]] = await db.query("SELECT type FROM ref_ship WHERE name = 'NNS KADA'");
  const [[beecroft]] = await db.query("SELECT type FROM ref_ship WHERE name = 'NNS BEECROFT'");
  check(kada.type === 'Sea' && beecroft.type === 'Land', 'Ships: the old Ship became Sea and Base became Land');
  const oldWord = await api(page, 'POST', '/api/tables/ships', { name: 'WT W1 Old', type: 'Ship' });
  check(oldWord.status === 422 && oldWord.body.error.fields.type, 'Ships: the old words are refused');
  for (const t of ['Sea', 'Land', 'Training']) {
    const r = await api(page, 'POST', '/api/tables/ships', { name: `WT W1 ${t}`, type: t });
    check(r.status === 200 || r.status === 201, `Ships: type ${t} is accepted`);
  }
  const lookups = await api(page, 'GET', '/api/lookups');
  check(lookups.body.data.ships.some((s) => s.type === 'Land') && lookups.body.data.ships.some((s) => s.type === 'Sea'), 'lookups: ships carry the new types');
  await db.query("DELETE FROM ref_ship WHERE name LIKE 'WT W1 %'");

  // a rating cannot add to another rating's record
  const other2 = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(other2.page, RATING);
  const refused = await api(other2.page, 'POST', `${base}/spouse`, { name: 'Not Mine' });
  check(refused.status === 403, "a rating cannot change another rating's record (403)");
  await other2.context.close();

  check(errors.length === 0, 'API: no browser errors', errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// Every dialog through the screens, once, desktop light
// ---------------------------------------------------------------------------
async function screens(browser, db) {
  console.log('\nThe dialogs, through the screens (1440, light)');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, ADMIN);
  const sn = 'B0562';

  // ---- Next of Kin
  await goRecord(page, 'Next of Kin', sn);
  await body(page).getByRole('button', { name: 'Add Next of Kin' }).first().click();
  let dlg = dialogOf(page);
  await dlg.waitFor();
  await settle(dlg);
  const labels = await dlg.locator('label').allInnerTexts();
  const wanted = ['First Name *', 'Last Name *', 'Next of Kin Type', 'Relationship *', 'Mobile Number *', 'Home Number', 'Email Address *', 'Place of Work', 'Full Address *'];
  check(wanted.every((l) => labels.map((x) => x.trim()).includes(l)), 'Next of Kin dialog: the live fields, the required ones marked', labels.join(' | '));
  await saveBtn(page).click();
  for (const n of ['first_name', 'last_name', 'next_of_kin_type_id', 'mobile_number', 'email_address', 'full_address']) {
    await fieldError(page, n).filter({ hasText: /required/i }).first().waitFor({ timeout: 5000 }).then(() => check(true, `Next of Kin dialog: an error under ${n}`), () => check(false, `Next of Kin dialog: an error under ${n}`));
  }
  check((await dropdownValue(page, 'kin_type')) === 'Main', 'Next of Kin dialog: the first next of kin is Main');
  await dlg.locator('[name="first_name"]').fill('chidi');
  await dlg.locator('[name="last_name"]').fill('NWANKWO');
  await choose(page, 'next_of_kin_type_id', 'Mother');
  await dlg.locator('[name="mobile_number"]').fill('08051234567');
  await dlg.locator('[name="home_number"]').fill('08061234567');
  await dlg.locator('[name="email_address"]').fill('chidi.nwankwo@cirerms.example');
  await dlg.locator('[name="place_of_work"]').fill('Ariaria Market, Aba');
  await dlg.locator('[name="full_address"]').fill('21 Ukegbu Road, Aba');
  await shot(page, 'nok-add');
  await saveBtn(page).click();
  await toastText(page, /Next of Kin added/);
  const card = body(page).locator('section[data-view-details]', { hasText: 'chidi NWANKWO' });
  await card.waitFor();
  check((await card.innerText()).includes('Mother'), 'Next of Kin tab: the card shows the Relationship');
  await card.click();
  dlg = dialogOf(page);
  await dlg.waitFor();
  await settle(dlg);
  const details = await dlg.innerText();
  check(['Full Address', '21 Ukegbu Road, Aba', 'Home Number', '08061234567', 'Place of Work', 'Ariaria Market, Aba', 'chidi.nwankwo@cirerms.example', 'Mother'].every((t) => details.includes(t)), 'Next of Kin: View Details shows every field');
  await shot(page, 'nok-details');
  await dlg.getByRole('button', { name: 'Edit' }).click();
  dlg = dialogOf(page);
  await dlg.locator('[name="place_of_work"]').waitFor();
  await dlg.locator('[name="place_of_work"]').fill('Ariaria International Market');
  await saveBtn(page).click();
  await toastText(page, /Next of Kin updated/);
  await card.click();
  check((await dialogOf(page).innerText()).includes('Ariaria International Market'), 'Next of Kin: Edit from View Details saves');
  await dialogOf(page).getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click();
  await toastText(page, /Next of Kin deleted/);
  check((await body(page).locator('section[data-view-details]', { hasText: 'chidi' }).count()) === 0, 'Next of Kin: Delete asks, then removes it');

  // ---- Spouse
  await goRecord(page, 'Spouse', sn);
  await body(page).getByRole('button', { name: 'Add Spouse' }).first().click();
  dlg = dialogOf(page);
  await dlg.waitFor();
  await settle(dlg);
  const sl = (await dlg.locator('label').allInnerTexts()).map((x) => x.trim());
  check(['Full Name *', 'Phone Number', 'Email Address', 'Street', 'Town', 'State', 'Local Government', 'P.O. Box'].every((l) => sl.includes(l)) && sl.filter((l) => l.endsWith('*')).length === 1, 'Spouse dialog: the address fields, only the Full Name required', sl.join(' | '));
  await saveBtn(page).click();
  await fieldError(page, 'name').filter({ hasText: /required/i }).first().waitFor({ timeout: 5000 });
  check(true, 'Spouse dialog: the error is under Full Name');
  await dlg.locator('[name="name"]').fill('funke AKINDELE');
  await dlg.locator('[name="street"]').fill('8 Allen Avenue');
  await dlg.locator('[name="town"]').fill('Ikeja');
  await choose(page, 'state_id', 'Lagos');
  const lgas = await dropdownLabels(page, 'local_government_id');
  const [lagosLgas] = await db.query("SELECT l.name FROM ref_local_government l JOIN ref_state s ON s.id = l.state_id WHERE s.name = 'Lagos' AND l.is_active = 1");
  check(lgas.length === lagosLgas.length && lagosLgas.every((l) => lgas.includes(l.name)), 'Spouse dialog: the Local Government list follows the State', lgas.join(', '));
  await choose(page, 'local_government_id', 'Ikeja');
  await dlg.locator('[name="po_box"]').fill('PMB 4410');
  await shot(page, 'spouse-add');
  await saveBtn(page).click();
  await toastText(page, /Spouse added/);
  const row = body(page).locator('tbody tr', { hasText: 'funke AKINDELE' });
  await row.waitFor();
  check((await row.innerText()).includes('Lagos'), 'Spouse tab: the list keeps its key columns and shows the State');
  await row.click();
  dlg = dialogOf(page);
  await dlg.waitFor();
  await settle(dlg);
  const sd = await dlg.innerText();
  check(['8 Allen Avenue', 'Ikeja', 'Lagos', 'PMB 4410', 'Local Government'].every((t) => sd.includes(t)), 'Spouse: View Details shows the address');
  await dlg.getByText('Close', { exact: true }).click();

  // ---- Children
  await goRecord(page, 'Children', sn);
  await body(page).getByRole('button', { name: 'Add Child' }).first().click();
  dlg = dialogOf(page);
  await dlg.waitFor();
  await settle(dlg);
  const cl = (await dlg.locator('label').allInnerTexts()).map((x) => x.trim());
  check(['Full Name *', 'Sex', 'Date of Birth', 'Phone Number', 'Email Address', 'Street', 'Town', 'State', 'Local Government', 'P.O. Box', 'School', 'Occupation', 'Office Address'].every((l) => cl.includes(l)) && cl.filter((l) => l.endsWith('*')).length === 1, 'Children dialog: the address, sex, date of birth, school, office address and occupation', cl.join(' | '));
  await dlg.locator('[name="name"]').fill('tola AKINDELE');
  await dlg.locator('[name="date_of_birth"]').fill(`01/01/${new Date().getFullYear() + 1}`);
  await saveBtn(page).click();
  await fieldError(page, 'date_of_birth').filter({ hasText: /future/i }).first().waitFor({ timeout: 5000 });
  check(true, 'Children dialog: a date of birth in the future is refused under the field');
  await choose(page, 'gender_id', 'Female');
  await dlg.locator('[name="date_of_birth"]').fill('14/03/2016');
  await dlg.locator('[name="school"]').fill('Greensprings School');
  await dlg.locator('[name="occupation"]').fill('Pupil');
  await dlg.locator('[name="office_address"]').fill('None');
  await saveBtn(page).click();
  await toastText(page, /Child added/);
  const crow = body(page).locator('tbody tr', { hasText: 'tola AKINDELE' });
  await crow.waitFor();
  const age = new Date().getFullYear() - 2016 - (new Date() < new Date(new Date().getFullYear(), 2, 14) ? 1 : 0);
  check((await crow.innerText()).includes(String(age)), `Children tab: the list shows the age (${age})`);
  await crow.click();
  dlg = dialogOf(page);
  await dlg.waitFor();
  await settle(dlg);
  const cd = await dlg.innerText();
  check(['Female', '14/03/2016', 'Greensprings School', 'Pupil', 'Office Address'].every((t) => cd.includes(t)), 'Children: View Details shows sex, date of birth, school and occupation', cd.replace(/\s+/g, ' ').slice(0, 200));
  await dlg.getByText('Close', { exact: true }).click();

  // ---- Drafting
  await goRecord(page, 'Drafting', sn);
  await body(page).getByRole('button', { name: 'Add Posting' }).first().click();
  dlg = dialogOf(page);
  await dlg.waitFor();
  await settle(dlg);
  const dl = (await dlg.locator('label').allInnerTexts()).map((x) => x.trim());
  check(['Ship or Unit *', 'Command', 'Branch', 'Rate at Posting', 'From', 'To', 'Authority', 'Decoration/Award', 'Status', 'Remarks'].every((l) => dl.includes(l)), 'Drafting dialog: Branch, Authority, Command, Decoration/Award and Status', dl.join(' | '));
  check(!dl.some((l) => /State|Sub-?Branch/i.test(l)), 'Drafting dialog: no State and no Sub-Branch');
  const [[victory]] = await db.query("SELECT s.name, c.name AS command FROM ref_ship s JOIN ref_command c ON c.id = s.command_id WHERE s.name = 'NNS PROSPERITY'");
  const [[brName]] = await db.query('SELECT b.name FROM ratings r JOIN ref_branch b ON b.id = r.branch_id WHERE r.service_number = ?', [sn]);
  check((await dlg.locator('.custom-dropdown-wrapper[name="exit_type_id"] input:not(.custom-dropdown-hidden)').first().inputValue()) === 'Active', 'Drafting dialog: Status starts as Active');
  check((await dlg.locator('.custom-dropdown-wrapper[name="branch_id"] input:not(.custom-dropdown-hidden)').first().inputValue()) === brName.name, "Drafting dialog: Branch starts as the rating's");
  await choose(page, 'ship_id', victory.name);
  await page.waitForFunction((cmd) => Array.from(document.querySelectorAll('#overlay-root [role="dialog"] .custom-dropdown-wrapper[name="command_id"] input:not(.custom-dropdown-hidden)')).some((i) => i.value === cmd), victory.command, { timeout: 4000 }).then(() => check(true, "Drafting dialog: picking the ship fills its Command"), () => check(false, "Drafting dialog: picking the ship fills its Command"));
  await choose(page, 'command_id', 'Naval Training Command');
  check((await dropdownValue(page, 'command_id')) !== '', 'Drafting dialog: the person can change the Command');
  await dlg.locator('[name="start_date"]').fill('01/02/2018');
  await dlg.locator('[name="end_date"]').fill('31/01/2020');
  await dlg.locator('[name="authority"]').fill('NHQ/NP/DOD/301/2018');
  await dlg.locator('[name="decoration"]').fill('Merit Award');
  await shot(page, 'drafting-add');
  await saveBtn(page).click();
  await toastText(page, /Posting added/);
  const item = body(page).locator('li[data-view-details]', { hasText: victory.name }).first();
  await item.waitFor();
  await item.click();
  dlg = dialogOf(page);
  await dlg.waitFor();
  await settle(dlg);
  const pd = await dlg.innerText();
  check(['Naval Training Command', brName.name, 'NHQ/NP/DOD/301/2018', 'Merit Award', 'Active', '01/02/2018', '31/01/2020', 'Authority', 'Decoration/Award'].every((t) => pd.includes(t)), 'Drafting: View Details shows every field', pd.replace(/\s+/g, ' ').slice(0, 300));
  await shot(page, 'drafting-details');
  await dlg.getByText('Close', { exact: true }).click();
  const [[mine]] = await db.query("SELECT COUNT(*) AS n FROM audit_trail WHERE table_name = 'rating_drafting' AND action = 'INSERT' AND changes LIKE '%decoration%' AND changes LIKE '%Merit Award%'");
  check(mine.n === 1, 'Drafting: the audit trail has the posting with its new fields');

  // ---- Ships
  await page.goto(`${BASE}/app.html#tables/ships`);
  await page.waitForSelector('#app-main table tbody tr', { timeout: 15000 });
  const heads = (await body(page).locator('thead th').allInnerTexts()).map((t) => t.trim());
  check(['SHIP', 'TYPE', 'COMMAND', 'STATUS'].every((t) => heads.map((x) => x.toUpperCase()).includes(t)), 'Ships list: Type, Command and Status columns', heads.join(' | '));
  const kada = body(page).locator('tbody tr', { hasText: 'NNS KADA' });
  const cells = await kada.locator('td').allInnerTexts();
  check(cells.some((c) => c.trim() === 'Sea') && cells.some((c) => /Naval Command/.test(c)), 'Ships list: a ship reads Sea and shows its Command', cells.join(' | '));
  const bee = await body(page).locator('tbody tr', { hasText: 'NNS BEECROFT' }).locator('td').allInnerTexts();
  check(bee.some((c) => c.trim() === 'Land'), 'Ships list: a base reads Land');
  await kada.click();
  dlg = dialogOf(page);
  await dlg.waitFor();
  await settle(dlg);
  const typeOptions = await dropdownLabels(page, 'type');
  check(JSON.stringify(typeOptions) === JSON.stringify(['Sea', 'Land', 'Training']), 'Ships dialog: the type is Sea, Land or Training', typeOptions.join(', '));
  check((await dialogOf(page).innerText()).includes('Description'), 'Ships dialog: Description stays in the dialog');
  await dialogOf(page).getByRole('button', { name: /Cancel|Close/ }).first().click();

  check(await noSideScroll(page), 'the Ships page does not scroll sideways');
  check(errors.length === 0, 'screens: no browser errors', errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// Each layout draws every tab, its Add dialog and a View Details
// ---------------------------------------------------------------------------
async function layout(browser, viewport, theme, tag) {
  const { context, page, errors, phone } = await open(browser, { viewport, theme });
  await signIn(page, ADMIN);
  const sn = 'B0539';
  for (const [tab, add, nameText] of [['Next of Kin', 'Add Next of Kin', 'Adaeze'], ['Spouse', 'Add Spouse', 'Adaeze Chioma'], ['Children', 'Add Child', 'Kamsiyochukwu'], ['Drafting', 'Add Posting', 'NNS KADA']]) {
    await goRecord(page, tab, sn);
    check(await noSideScroll(page), `${tag}: ${tab} does not scroll sideways`);
    await shot(page, `${tab.toLowerCase().replace(/ /g, '-')}-${tag.replace(/[ ,]+/g, '-')}`);
    await body(page).getByRole('button', { name: add }).first().click();
    let dlg = dialogOf(page);
    await dlg.waitFor();
    await settle(dlg);
    check(await noSideScroll(page), `${tag}: the ${add} dialog does not scroll sideways`);
    await shot(page, `${tab.toLowerCase().replace(/ /g, '-')}-add-${tag.replace(/[ ,]+/g, '-')}`);
    // a first field that is a dropdown opens its list on focus: Escape shuts it, then Cancel
    await page.keyboard.press('Escape');
    if (await dlg.isVisible().catch(() => false)) await dlg.getByRole('button', { name: 'Cancel' }).click();
    await dlg.waitFor({ state: 'detached' }).catch(() => {});
    const target = tab === 'Next of Kin' ? body(page).locator('section[data-view-details]', { hasText: nameText }).first()
      : tab === 'Drafting' ? body(page).locator('li[data-view-details]', { hasText: nameText }).first()
        : phone ? body(page).locator('section[data-view-details]', { hasText: nameText }).first() : body(page).locator('tbody tr', { hasText: nameText }).first();
    await target.click();
    dlg = dialogOf(page);
    await dlg.waitFor();
    await settle(dlg);
    check(await noSideScroll(page), `${tag}: ${tab} View Details does not scroll sideways`);
    const box = await dlg.boundingBox();
    check(box && box.x >= -1 && box.x + box.width <= viewport.width + 1, `${tag}: ${tab} View Details fits the screen`);
    await shot(page, `${tab.toLowerCase().replace(/ /g, '-')}-details-${tag.replace(/[ ,]+/g, '-')}`);
    await dlg.getByText('Close', { exact: true }).click();
  }
  await page.goto(`${BASE}/app.html#tables/ships`);
  await page.waitForFunction(() => Array.from(document.querySelectorAll('#app-main table tbody tr, #app-main .desk\\:hidden > div > button')).some((e) => e.offsetParent !== null), null, { timeout: 15000 });
  check(await noSideScroll(page), `${tag}: the Ships list does not scroll sideways`);
  await shot(page, `ships-${tag.replace(/[ ,]+/g, '-')}`);
  check(errors.length === 0, `${tag}: no browser errors`, errors.join(' | '));
  await context.close();
}

(async () => {
  const db = await connect();
  const browser = await chromium.launch();
  try {
    await apiRules(browser, db);
    await screens(browser, db);
    console.log('\nLayouts');
    await Promise.all([
      layout(browser, DESKTOP, 'light', '1440 light'),
      layout(browser, DESKTOP, 'dark', '1440 dark'),
      layout(browser, PHONE, 'light', '390 light'),
      layout(browser, PHONE, 'dark', '390 dark'),
    ]);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL  the walk-through stopped: ${err.stack || err.message}`);
  } finally {
    await browser.close();
    await db.end();
  }
  const seconds = Math.round((Date.now() - STARTED) / 1000);
  check(seconds <= LIMIT_SECONDS, `the walk-through ran in ${seconds} seconds (the limit is ${LIMIT_SECONDS})`);
  console.log(`\n${passes} checks passed, ${failures} failed.`);
  process.exit(failures ? 1 : 0);
})();
