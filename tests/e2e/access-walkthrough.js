#!/usr/bin/env node
'use strict';

/*
 * Walk-through of users, roles and privileges, the audit trail and the session lock (WP1).
 * Uses the Playwright installed on the machine (not a project dependency):
 *
 *   npm run migrate:fresh                       # a fresh demo database
 *   npm start                                   # the app on :3000
 *   PORT=3001 SESSION_IDLE_MINUTES=0.1 SESSION_SERVER_GRACE_SECONDS=20 node src/server.js
 *                                               # a second server that locks after 6 s idle
 *   NODE_PATH=$(npm root -g) node tests/e2e/access-walkthrough.js
 *
 * BASE and IDLE_BASE change the two addresses; SHOTS=<dir> saves screenshots there.
 * Exits non-zero when a check fails. Browser errors fail the run.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:3000';
const IDLE_BASE = process.env.IDLE_BASE || 'http://localhost:3001';
const SHOTS = process.env.SHOTS || '';
const ADMIN = { username: 'HICO001', password: 'Admin@123' };
const RATING = { username: 'B0539', password: 'Rating@123' };
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

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
async function open(browser, { viewport, theme, base = BASE }) {
  const context = await browser.newContext({ viewport, colorScheme: theme, deviceScaleFactor: 1, isMobile: viewport.width < 700, hasTouch: viewport.width < 700 });
  const errors = [];
  // responses the walk-through provokes on purpose (403, 423, a wrong password)
  const expected = new Set([403, 422, 423]);
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
  return { context, page, errors, base };
}

async function signIn(page, base, who) {
  await page.goto(`${base}/index.html`);
  await page.fill('#username', who.username);
  await page.fill('#password', who.password);
  await Promise.all([page.waitForURL(/app\.html/), page.click('#login-submit')]);
  await page.waitForSelector('#app-main h1, #app-main h2', { timeout: 15000 });
}

const api = (page, method, url, data) => page.evaluate(async ({ method, url, data }) => {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: data && !(data instanceof FormData) ? { 'Content-Type': 'application/json' } : {},
    body: data ? JSON.stringify(data) : undefined,
  });
  let body = null;
  try { body = await res.json(); } catch (_) { body = null; }
  return { status: res.status, body };
}, { method, url, data });

async function uploadVia(page, url, field, name, mime, base64, extra = {}) {
  return page.evaluate(async ({ url, field, name, mime, base64, extra }) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const fd = new FormData();
    Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
    fd.append(field, new File([bytes], name, { type: mime }));
    const res = await fetch(url, { method: 'POST', credentials: 'include', body: fd });
    let body = null;
    try { body = await res.json(); } catch (_) { body = null; }
    return { status: res.status, body };
  }, { url, field, name, mime, base64, extra });
}

async function latestAudit(page, query = '') {
  const res = await api(page, 'GET', `/api/audit?pageSize=100${query ? `&${query}` : ''}`);
  return res.body ? res.body.data : [];
}

const isLockShown = (page) => page.locator('#lock').isVisible();

async function lockFromMenu(page, phone) {
  if (phone) {
    await page.click('#phone-header button[aria-label="Account"]');
  } else {
    await page.click('#rail button[aria-haspopup="menu"]');
  }
  await page.getByRole('menuitem', { name: 'Lock Screen' }).click();
  await page.waitForSelector('#lock', { state: 'visible' });
}

// ---------------------------------------------------------------------------
// The administrator: sees and can do everything; every rating write is audited.
// ---------------------------------------------------------------------------
async function adminDesktop(browser, theme) {
  console.log(`\nAdministrator, desktop, ${theme}`);
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme });
  await signIn(page, BASE, ADMIN);
  await page.waitForSelector('text=Members');
  check(page.url().endsWith('#dashboard'), 'lands on the dashboard');
  const railItems = await page.locator('#rail nav a').count();
  check(railItems === 12, 'the rail shows all 12 modules (Soon ones included)', `${railItems}`);
  await shot(page, `admin-dashboard-${theme}`);

  await page.goto(`${BASE}/app.html#ratings/current`);
  await page.waitForSelector('#app-main table tbody tr');
  check(await page.getByRole('button', { name: 'New Rating' }).first().isVisible(), 'New Rating shows on the list');
  check(await page.getByRole('button', { name: 'Export' }).first().isVisible(), 'Export shows on the list');
  const tabs = await page.locator('#module-tabs a').count();
  check(tabs >= 5, 'all five Ratings tabs show', `${tabs}`);

  await page.goto(`${BASE}/app.html#ratings/edit/B0539`);
  await page.waitForSelector('text=Edit Details');
  check(await page.getByRole('button', { name: 'Delete' }).first().isVisible(), 'Delete shows on the record');

  // a write through the screen: edit the Contact section in its dialog
  await page.getByRole('button', { name: 'Edit Contact' }).click().catch(async () => {
    await page.locator('section:has-text("Contact") button:has-text("Edit")').first().click();
  });
  const dialog = page.locator('#overlay-root [role="dialog"]').last();
  await dialog.waitFor();
  const phoneField = dialog.locator('input[name="phone"]');
  await phoneField.fill('08031112233');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await page.waitForSelector('text=saved', { timeout: 10000 });
  let rows = await latestAudit(page, 'action=UPDATE&table=ratings&record=B0539');
  let detail = rows[0] ? (await api(page, 'GET', `/api/audit/${rows[0].id}`)).body.data : null;
  check(detail && detail.changes.some((c) => c.field === 'phone' && c.to === '08031112233'), 'editing a section leaves an UPDATE audit row with the change', JSON.stringify(detail && detail.changes));

  // every other rating write, through the API the screens call
  const sn = `T${String(Date.now()).slice(-6)}`;
  const lookups = (await api(page, 'GET', '/api/lookups')).body.data;
  const created = await api(page, 'POST', '/api/ratings', {
    service_number: sn,
    surname: 'Audit',
    first_name: 'Walk',
    rate_id: lookups.rates[0].id,
    title_id: (lookups.titles || [])[0] ? lookups.titles[0].id : undefined,
    gender_id: (lookups.genders || [])[0] ? lookups.genders[0].id : undefined,
    date_of_birth: '1995-01-01',
    date_employed: '2015-01-01',
  });
  check(created.status === 201, 'create a rating', JSON.stringify(created.body && created.body.error));
  const updated = await api(page, 'PUT', `/api/ratings/${sn}`, { home_address: 'Navy Town, Lagos' });
  check(updated.status === 200, 'update a rating');
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const photo = await uploadVia(page, `/api/ratings/${sn}/photo/passport`, 'photo', 'p.png', 'image/png', png);
  check(photo.status === 200, 'upload a passport photo', JSON.stringify(photo.body && photo.body.error));
  const child = await api(page, 'POST', `/api/ratings/${sn}/records/children`, { name: 'Walk Child' });
  check(child.status === 201, 'add a child row');
  const childId = child.body && child.body.data.items[0] && child.body.data.items[0].id;
  const childEdit = await api(page, 'PUT', `/api/ratings/${sn}/records/children/${childId}`, { name: 'Walk Child Two' });
  check(childEdit.status === 200, 'edit a child row');
  const childDel = await api(page, 'DELETE', `/api/ratings/${sn}/records/children/${childId}`);
  check(childDel.status === 200, 'delete a child row');
  const cat = (lookups.documentCategories || lookups.document_categories || [])[0];
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n').toString('base64');
  const doc = await uploadVia(page, `/api/ratings/${sn}/documents`, 'document', 'walk.pdf', 'application/pdf', pdf, { category_id: cat ? String(cat.id) : '' });
  check(doc.status === 201, 'upload a document', JSON.stringify(doc.body && doc.body.error));
  const docId = doc.body && doc.body.data.documents[0] && doc.body.data.documents[0].id;
  const docDel = await api(page, 'DELETE', `/api/ratings/${sn}/documents/${docId}`);
  check(docDel.status === 200, 'delete a document');
  const del = await api(page, 'DELETE', `/api/ratings/${sn}`);
  check(del.status === 200, 'delete the rating');

  rows = await latestAudit(page, `record=${sn}`);
  const has = (action, table) => rows.some((r) => r.action === action && r.table === table);
  check(has('INSERT', 'ratings'), 'audit: rating INSERT');
  check(rows.filter((r) => r.action === 'UPDATE' && r.table === 'ratings').length >= 2, 'audit: rating UPDATE (details and photo)');
  check(has('INSERT', 'rating_children') && has('UPDATE', 'rating_children') && has('DELETE', 'rating_children'), 'audit: child row INSERT, UPDATE, DELETE');
  check(has('INSERT', 'rating_documents') && has('DELETE', 'rating_documents'), 'audit: document INSERT, DELETE');
  check(has('DELETE', 'ratings'), 'audit: rating DELETE');
  check(rows.every((r) => r.username === 'HICO001' && r.ip), 'audit rows name who and where from');

  // a refused write leaves no audit row
  const before = (await latestAudit(page)).length;
  const bad = await api(page, 'POST', '/api/ratings', { service_number: 'B0539', surname: 'Dup' });
  const after = (await latestAudit(page)).length;
  check(bad.status >= 400 && after === before, 'a refused write leaves no audit row');

  // audit read endpoints: paging, filters
  const paged = await api(page, 'GET', '/api/audit?page=1');
  check(paged.body.meta.pageSize === 25 && Array.isArray(paged.body.data), 'audit list pages 25 a time on the server');
  const today = new Date().toISOString().slice(0, 10);
  const byDate = await api(page, 'GET', `/api/audit?from=${today}&to=${today}&user=HICO001&action=INSERT`);
  check(byDate.status === 200 && byDate.body.data.every((r) => r.action === 'INSERT' && r.username === 'HICO001'), 'audit filters by date, user and action');
  const filters = await api(page, 'GET', '/api/audit/filters');
  check(filters.body.data.actions.includes('UNLOCK') && filters.body.data.tables.includes('ratings'), 'audit filter choices');
  const roles = await api(page, 'GET', '/api/access/roles');
  const admin = roles.body.data.find((r) => r.name === 'Administrator');
  const rating = roles.body.data.find((r) => r.name === 'Rating');
  const catalogue = (await api(page, 'GET', '/api/access/privileges')).body.data;
  const total = catalogue.modules.reduce((n, m) => n + m.screens.reduce((k, s) => k + s.actions.length, 0), 0);
  const adminCount = Object.values(admin.privileges).reduce((n, a) => n + a.length, 0);
  check(adminCount === total, 'the Administrator holds every privilege', `${adminCount} of ${total}`);
  check(JSON.stringify(rating.privileges) === JSON.stringify({ 'ratings.my-details': ['view'] }), 'the Rating role holds View My Details only');

  // every page opens for the administrator
  const pages = ['dashboard', 'ratings/current', 'ratings/former', 'ratings/new', 'ratings/edit/B0539', 'ratings/upload',
    'ratings/documents', 'ratings/documents/B0539', 'ratings/my-details', 'soon/drafting'];
  const blocked = [];
  for (const route of pages) {
    await page.goto(`${BASE}/app.html#${route}`);
    await page.waitForSelector('#app-main h1, #app-main h2', { timeout: 15000 });
    await page.waitForTimeout(300);
    if (await page.getByText('You Do Not Have Access to This Page').count()) blocked.push(route);
  }
  check(blocked.length === 0, `every page opens for the administrator (${pages.length})`, blocked.join(', '));
  await page.keyboard.press('Escape');

  // ---- session lock from the menu, wrong and right password, other tabs
  const second = await context.newPage();
  await second.goto(`${BASE}/app.html#ratings/current`);
  await second.waitForSelector('#app-main table tbody tr');
  await lockFromMenu(page, false);
  check(await isLockShown(page), 'Lock Screen locks the session');
  check(await page.locator('#lock-reason').innerText() === 'You locked this session', 'the lock says why');
  check(await page.locator('#shell').evaluate((n) => getComputedStyle(n).visibility === 'hidden' && n.inert), 'the page underneath is hidden and inert');
  await second.waitForSelector('#lock', { state: 'visible', timeout: 5000 });
  check(await isLockShown(second), 'the other tab locks too');
  check(await second.locator('#shell').evaluate((n) => getComputedStyle(n).visibility === 'hidden'), 'the other tab hides its data');
  const refused = await api(page, 'GET', '/api/ratings?pageSize=1');
  check(refused.status === 423, 'the server refuses data while locked (423)');
  await shot(page, `lock-desktop-${theme}`);
  await page.fill('#lock-pass', 'not-the-password');
  await page.click('#lock-form button[type="submit"]');
  await page.waitForSelector('#lock-err:not(.hidden)');
  check((await page.locator('#lock-err').innerText()) === 'Wrong password', 'a wrong password is refused');
  check(await isLockShown(page), 'still locked after a wrong password');
  await shot(page, `lock-wrong-desktop-${theme}`);
  await page.fill('#lock-pass', ADMIN.password);
  await page.click('#lock-form button[type="submit"]');
  await page.waitForSelector('#lock', { state: 'hidden' });
  check(!(await isLockShown(page)), 'the right password unlocks');
  await second.waitForSelector('#lock', { state: 'hidden', timeout: 5000 });
  check(!(await isLockShown(second)), 'the other tab unlocks too');
  check((await api(page, 'GET', '/api/ratings?pageSize=1')).status === 200, 'data flows again after unlock');
  rows = await latestAudit(page, 'user=HICO001');
  check(rows.some((r) => r.action === 'LOCK') && rows.some((r) => r.action === 'UNLOCK'), 'lock and unlock are in the audit trail');

  // ---- Sign Out from the lock screen; the other tab signs out too
  await lockFromMenu(page, false);
  await Promise.all([page.waitForURL(/index\.html/), page.click('#lock button:has-text("Sign Out")')]);
  check(page.url().includes('index.html'), 'Sign Out on the lock screen signs out');
  await second.waitForURL(/index\.html/, { timeout: 5000 }).catch(() => {});
  check(second.url().includes('index.html'), 'the other tab signs out too');
  const gone = await api(page, 'GET', '/api/auth/status');
  check(gone.status === 200 && gone.body.data.signedIn === false, 'the session has ended on the server');

  check(errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

async function adminPhone(browser, theme) {
  console.log(`\nAdministrator, phone, ${theme}`);
  const { context, page, errors } = await open(browser, { viewport: PHONE, theme });
  await signIn(page, BASE, ADMIN);
  check(await page.locator('#bottom-bar > *').count() === 5, 'the bottom bar shows its five items');
  await page.goto(`${BASE}/app.html#ratings/current`);
  await page.locator('#app-main').getByText(/B0\d+ ·/).first().waitFor();
  check(await page.locator('#fab').isVisible(), 'the New Rating button shows on the list');
  await lockFromMenu(page, true);
  check(await isLockShown(page), 'Lock Screen from the phone account menu');
  await shot(page, `lock-phone-${theme}`);
  await page.fill('#lock-pass', ADMIN.password);
  await page.click('#lock-form button[type="submit"]');
  await page.waitForSelector('#lock', { state: 'hidden' });
  check(true, 'unlocks on a phone');
  await page.click('#bottom-bar button');
  await page.waitForSelector('#overlay-root [role="dialog"]');
  const tiles = await page.locator('#overlay-root [role="dialog"] a').count();
  check(tiles === 12, 'More lists every module', `${tiles}`);
  check(errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// The ratings printouts (Chromium, from the templates): each opens in the app's own preview with its pages.
// ---------------------------------------------------------------------------
async function printouts(browser) {
  console.log('\nPrintouts: dossier, a tab and the nominal roll, desktop, light');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light' });
  await signIn(page, BASE, ADMIN);
  const dlg = () => page.locator('#overlay-root [role="dialog"]').last();
  const previews = async (label, heading) => {
    await dlg().locator('[data-pdf-stage][data-ready="1"]').waitFor({ timeout: 30000 });
    const pages = await dlg().locator('canvas[data-pdf-page]').count();
    check(pages >= 1 && new RegExp(`${pages} pages?`).test(await dlg().locator('[data-pdf-count]').innerText()), `${label}: the preview draws its pages itself and shows the count`, `${pages}`);
    check(heading.test(await dlg().innerText()), `${label}: the preview is titled`);
    check((await dlg().locator('iframe, embed, object').count()) === 0, `${label}: no browser PDF viewer in the preview`);
    await page.keyboard.press('Escape');
    await dlg().waitFor({ state: 'detached' });
    return pages;
  };
  await page.goto(`${BASE}/app.html#ratings/edit/B0539`);
  await page.getByRole('button', { name: 'Print Dossier' }).click();
  const dossierPages = await previews('Personnel Dossier', /Dossier: B0539/);
  check(dossierPages >= 2, 'Personnel Dossier: a full record runs to more than one page', `${dossierPages}`);
  await page.locator('[role="tab"]', { hasText: 'Drafting' }).click();
  await page.getByRole('button', { name: 'Print', exact: true }).click();
  await previews('Drafting record', /Drafting: B0539/);
  for (const format of ['current', 'former']) {
    const r = await page.evaluate(async (status) => {
      const res = await fetch(`/api/ratings/export?status=${status}&format=pdf`, { credentials: 'include' });
      const buf = new Uint8Array(await res.arrayBuffer());
      return { status: res.status, head: String.fromCharCode(...buf.slice(0, 4)), size: buf.length, type: res.headers.get('content-type') };
    }, format);
    check(r.status === 200 && r.head === '%PDF' && /pdf/.test(r.type) && r.size > 1500, `the ${format} ratings list exports as a PDF`, JSON.stringify(r));
  }
  await page.goto(`${BASE}/app.html#ratings/current`);
  await page.waitForSelector('#app-main table tbody tr');
  await page.getByRole('button', { name: 'Export' }).first().click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'PDF' }).click();
  check(/\.pdf$/.test((await download).suggestedFilename()), 'Export, PDF: the nominal roll downloads as a PDF file');
  check(errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// B0539, the Rating role: View My Details only; 403 from every other API.
// ---------------------------------------------------------------------------
async function ratingRole(browser, viewport, theme) {
  const phone = viewport.width < 700;
  console.log(`\nB0539 (Rating), ${phone ? 'phone' : 'desktop'}, ${theme}`);
  const { context, page, errors } = await open(browser, { viewport, theme });
  await signIn(page, BASE, RATING);
  await page.waitForURL(/#ratings\/my-details/);
  check(page.url().endsWith('#ratings/my-details'), 'lands on My Details');
  await page.waitForSelector('text=Print Dossier');
  check(!(await page.getByRole('button', { name: 'Edit Details' }).count()), 'no Edit Details on My Details');
  check(await page.locator('#module-tabs a').count() === 0, 'no module tabs (My Details is the only page)');
  if (phone) {
    const bottom = await page.locator('#bottom-bar > *').allInnerTexts();
    check(bottom.length === 2 && bottom[0].includes('My Details'), 'the bottom bar shows My Details and More only', bottom.join(','));
    await page.click('#bottom-bar button');
    await page.waitForSelector('#overlay-root [role="dialog"]');
    const tiles = await page.locator('#overlay-root [role="dialog"] a').allInnerTexts();
    check(tiles.length === 1 && tiles[0].includes('Ratings'), 'More lists only Ratings', tiles.join(','));
    await page.keyboard.press('Escape');
  } else {
    const rail = await page.locator('#rail nav a').allInnerTexts();
    check(rail.length === 1 && rail[0].includes('Ratings Management'), 'the rail shows only Ratings Management', rail.join(','));
  }
  await shot(page, `rating-my-details-${phone ? 'phone' : 'desktop'}-${theme}`);

  await page.goto(`${BASE}/app.html#dashboard`);
  await page.waitForURL(/#ratings\/my-details/);
  check(true, '#dashboard goes to My Details');
  await page.goto(`${BASE}/app.html#ratings/current`);
  await page.waitForSelector('text=You Do Not Have Access to This Page');
  check(true, 'a page without the grant shows the not-allowed state');
  await shot(page, `rating-not-allowed-${phone ? 'phone' : 'desktop'}-${theme}`);
  await page.goto(`${BASE}/app.html#soon/drafting`);
  await page.waitForSelector('text=You Do Not Have Access to This Page');
  check(true, 'Soon pages are not shown to the Rating role');

  // the account menu
  if (phone) await page.click('#phone-header button[aria-label="Account"]');
  else await page.click('#rail button[aria-haspopup="menu"]');
  const menu = await page.getByRole('menuitem').allInnerTexts();
  check(menu.some((t) => t.includes('View My Details')) && menu.some((t) => t.includes('Lock Screen')), 'the account menu has View My Details and Lock Screen', menu.join(','));
  await page.keyboard.press('Escape');

  if (!phone) {
    const forbidden = [
      ['GET', '/api/dashboard/summary'], ['GET', '/api/ratings'], ['GET', '/api/ratings/export?format=csv'],
      ['GET', '/api/ratings/batch-template'], ['GET', '/api/ratings/B0539'], ['GET', '/api/ratings/B0559F'],
      ['GET', '/api/ratings/B0559F/pdf'], ['GET', '/api/ratings/B0559F/documents'], ['GET', '/api/ratings/B0559F/photo/passport'],
      ['POST', '/api/ratings', { service_number: 'X1' }], ['PUT', '/api/ratings/B0539', { phone: '1' }], ['DELETE', '/api/ratings/B0559F'],
      ['POST', '/api/ratings/B0539/records/children', { name: 'x' }], ['PUT', '/api/ratings/B0539/records/children/1', { name: 'x' }],
      ['DELETE', '/api/ratings/B0539/records/children/1'], ['DELETE', '/api/ratings/B0539/documents/1'],
      ['POST', '/api/ratings/B0539/documents'], ['POST', '/api/ratings/B0539/photo/passport'], ['POST', '/api/ratings/batch-upload'],
      ['GET', '/api/audit'], ['GET', '/api/audit/filters'], ['GET', '/api/access/roles'], ['GET', '/api/access/privileges'],
    ];
    const wrong = [];
    for (const [method, url, body] of forbidden) {
      const res = await api(page, method, url, body);
      if (res.status !== 403 || !res.body || !res.body.error || res.body.error.code !== 'FORBIDDEN') wrong.push(`${method} ${url} ${res.status}`);
    }
    check(wrong.length === 0, `403 FORBIDDEN from every other API (${forbidden.length} tried)`, wrong.join(', '));
    const allowed = [['GET', '/api/ratings/me'], ['GET', '/api/lookups'], ['GET', '/api/ratings/B0539/pdf'], ['GET', '/api/ratings/B0539/documents'], ['GET', '/api/auth/me']];
    const refused = [];
    for (const [method, url] of allowed) {
      const res = await api(page, method, url);
      if (res.status !== 200) refused.push(`${method} ${url} ${res.status}`);
    }
    check(refused.length === 0, 'My Details\' own reads are allowed (record, lookups, own printout and documents)', refused.join(', '));
  }

  // the lock works for a rating too
  await page.goto(`${BASE}/app.html#ratings/my-details`);
  await page.waitForSelector('text=Print Dossier');
  await lockFromMenu(page, phone);
  await page.fill('#lock-pass', RATING.password);
  await page.click('#lock-form button[type="submit"]');
  await page.waitForSelector('#lock', { state: 'hidden' });
  check(true, 'the rating locks and unlocks');

  check(errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// The lock after idle time (the second server locks after 6 seconds).
// ---------------------------------------------------------------------------
async function idleLock(browser, viewport, theme) {
  const phone = viewport.width < 700;
  console.log(`\nIdle lock, ${phone ? 'phone' : 'desktop'}, ${theme}`);
  const { context, page, errors } = await open(browser, { viewport, theme, base: IDLE_BASE });
  await signIn(page, IDLE_BASE, ADMIN);
  await page.waitForSelector('#lock', { state: 'visible', timeout: 15000 });
  check(await isLockShown(page), 'the session locks after the idle time');
  check(await page.locator('#lock-reason').innerText() === 'Locked while you were away', 'it says it locked while you were away');
  await shot(page, `lock-idle-${phone ? 'phone' : 'desktop'}-${theme}`);
  const refused = await api(page, 'GET', '/api/ratings?pageSize=1');
  check(refused.status === 423, 'the server refuses data after the idle lock');
  await page.fill('#lock-pass', 'wrong');
  await page.click('#lock-form button[type="submit"]');
  await page.waitForSelector('#lock-err:not(.hidden)');
  check(await isLockShown(page), 'a wrong password keeps it locked');
  await page.fill('#lock-pass', ADMIN.password);
  await page.click('#lock-form button[type="submit"]');
  await page.waitForSelector('#lock', { state: 'hidden' });
  check(true, 'the right password unlocks');
  const rows = await latestAudit(page, 'user=HICO001');
  const lock = rows.find((r) => r.action === 'LOCK');
  const detail = lock ? (await api(page, 'GET', `/api/audit/${lock.id}`)).body.data : null;
  check(detail && detail.changes.some((c) => String(c.to).includes('idle')), 'the idle lock is in the audit trail as idle');
  // a session left without requests past the idle time and grace is locked by the server
  check(errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

async function serverIdle(browser) {
  console.log('\nServer-side idle lock (tab closed)');
  const { context, page, errors } = await open(browser, { viewport: DESKTOP, theme: 'light', base: IDLE_BASE });
  await signIn(page, IDLE_BASE, ADMIN);
  const cookies = await context.cookies();
  await page.close();
  // 6 s idle + 20 s grace, no requests: the server locks it on the next request
  await new Promise((r) => setTimeout(r, 28000));
  const fresh = await context.newPage();
  await fresh.goto(`${IDLE_BASE}/app.html#ratings/current`);
  await fresh.waitForSelector('#lock', { state: 'visible', timeout: 10000 });
  check(await isLockShown(fresh), 'a session idle past the limit opens locked');
  check(!(await fresh.locator('#app-main table').count()), 'and draws no data underneath');
  await fresh.fill('#lock-pass', ADMIN.password);
  await fresh.click('#lock-form button[type="submit"]');
  await fresh.waitForSelector('#app-main table tbody tr', { timeout: 10000 });
  check(true, 'the page draws once unlocked');
  check(cookies.length > 0 && errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    await adminDesktop(browser, 'light');
    await adminDesktop(browser, 'dark');
    await adminPhone(browser, 'light');
    await adminPhone(browser, 'dark');
    await printouts(browser);
    await ratingRole(browser, DESKTOP, 'light');
    await ratingRole(browser, DESKTOP, 'dark');
    await ratingRole(browser, PHONE, 'light');
    await ratingRole(browser, PHONE, 'dark');
    await idleLock(browser, DESKTOP, 'dark');
    await idleLock(browser, PHONE, 'light');
    await serverIdle(browser);
  } catch (err) {
    failures += 1;
    console.log(`  FAIL  walk-through stopped: ${err.message}`);
  } finally {
    await browser.close();
  }
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
})();
