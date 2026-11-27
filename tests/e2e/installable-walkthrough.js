#!/usr/bin/env node
'use strict';

/*
 * Walk-through of the installable app (X1). Uses the Playwright installed on the machine (not a project dependency):
 *
 *   npm run migrate:fresh && npm run seed
 *   npm start                                   # the app on :3000
 *   NODE_PATH=$(npm root -g) node tests/e2e/installable-walkthrough.js
 *
 * BASE changes the address; SHOTS=<dir> saves screenshots of the offline page and the update banner (1440 light, 390 dark).
 * Checks: the manifest's fields and icons (their real sizes) load and both pages link them; the manifest and the worker are
 * served with the right headers and the CSP allows them; the service worker registers and controls the page; after a
 * sign-in an /api/ answer, a PDF and a photo are never in the cache or served by the worker, and the cache holds only
 * static files; with the network cut a page load shows the offline page (light and dark) and Try Again works once the
 * network is back; a new version brings the update banner and Reload moves to it, with no reload by itself; Download App is
 * not in the account menu without an install offer; no browser errors at 1440 and 390. Exits non-zero when a check fails.
 * Runs in well under five minutes (it prints its time and fails over five).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = process.env.BASE || 'http://localhost:3000';
const SHOTS = process.env.SHOTS || '';
const ADMIN = { username: 'HICO001', password: 'Admin@123' };
const STARTED = Date.now();
const LIMIT_SECONDS = 300;
let failures = 0;
function check(ok, label, detail = '') {
  if (ok) console.log(`  ok    ${label}`); else { failures += 1; console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ''}`); }
}
async function shot(page, name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

async function open(browser, { viewport, theme }) {
  const phone = viewport.width < 700;
  const context = await browser.newContext({ viewport, colorScheme: theme, isMobile: phone, hasTouch: phone, serviceWorkers: 'allow' });
  const errors = [];
  const state = { quiet: false }; // set while the walk-through asks for addresses that answer 404 on purpose
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // going offline on purpose makes the browser report the failed page load; nothing else may be reported
    if (m.type() === 'error' && !state.quiet && !/ERR_INTERNET_DISCONNECTED|Failed to load resource: net::/.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return { context, page, errors, state };
}

async function signIn(page) {
  await page.goto(`${BASE}/index.html`);
  await page.fill('#username', ADMIN.username);
  await page.fill('#password', ADMIN.password);
  await Promise.all([page.waitForURL(/app\.html/), page.click('#login-submit')]);
  await page.waitForSelector('#app-main h1, #app-main h2', { timeout: 15000 });
}

const controlled = (page) => page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 }).then(() => true, () => false);
const cacheKeys = (page) => page.evaluate(async () => {
  const out = {};
  for (const name of await caches.keys()) out[name] = (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname);
  return out;
});

async function manifestAndServer(browser) {
  console.log('\nThe manifest, its icons, the headers');
  const { context, page, errors } = await open(browser, { viewport: { width: 1440, height: 900 }, theme: 'light' });
  await page.goto(`${BASE}/index.html`);
  for (const file of ['index.html', 'app.html']) {
    const html = await (await context.request.get(`${BASE}/${file}`)).text();
    check(/rel="manifest" href="\/manifest\.webmanifest"/.test(html), `${file} links the manifest`);
    check(/rel="apple-touch-icon"/.test(html), `${file} links the Apple touch icon`);
    check((html.match(/<meta name="theme-color"[^>]*media="\(prefers-color-scheme: (light|dark)\)"/g) || []).length === 2, `${file} has the two theme-color metas`);
  }
  const res = await context.request.get(`${BASE}/manifest.webmanifest`);
  check(res.status() === 200 && /^application\/manifest\+json/.test(res.headers()['content-type'] || ''), 'the manifest is served as application/manifest+json');
  const m = await res.json();
  check(m.name === 'CIRERMS' && m.short_name === 'CIRERMS' && !!m.description, 'name, short name and description');
  check(m.start_url === '/app.html' && m.scope === '/' && m.display === 'standalone', 'start_url /app.html, scope /, display standalone');
  check(/^#[0-9a-f]{6}$/i.test(m.theme_color) && /^#[0-9a-f]{6}$/i.test(m.background_color), 'theme_color and background_color are set');
  const purposes = new Set();
  for (const icon of m.icons) {
    const r = await context.request.get(BASE + icon.src);
    const size = await page.evaluate(async (url) => {
      const img = new Image();
      img.src = url;
      await img.decode();
      return `${img.naturalWidth}x${img.naturalHeight}`;
    }, BASE + icon.src);
    check(r.status() === 200 && /image\/png/.test(r.headers()['content-type'] || '') && size === icon.sizes, `icon ${icon.src} loads at ${icon.sizes}`, size);
    purposes.add(`${icon.purpose}:${icon.sizes}`);
  }
  check(purposes.has('any:192x192') && purposes.has('any:512x512') && purposes.has('maskable:512x512'), 'icons: 192, 512 and a maskable 512');
  const touch = await context.request.get(`${BASE}/assets/icons/apple-touch-icon.png`);
  check(touch.status() === 200, 'the Apple touch icon loads');
  const sw = await context.request.get(`${BASE}/sw.js`);
  check(sw.status() === 200 && /no-cache/.test(sw.headers()['cache-control'] || '') && sw.headers()['service-worker-allowed'] === '/', 'sw.js: no-cache and Service-Worker-Allowed /');
  const csp = (await context.request.get(`${BASE}/app.html`)).headers()['content-security-policy'] || '';
  check(/manifest-src 'self'/.test(csp) && /worker-src 'self'/.test(csp), "the CSP allows manifest-src 'self' and worker-src 'self'");
  check(/script-src 'self';/.test(csp), 'the other CSP rules are as they were (script-src \'self\')');
  const swText = await sw.text();
  check(!swText.includes('__PRECACHE__') && /const VERSION = "/.test(swText) && /"\/js\/core\/pwa\.js"/.test(swText), 'the worker has its version and its file list');
  check(!/"\/api\/|\.pdf"/.test(swText.split('const PRECACHE')[1].split('\n')[0]), 'the file list holds no /api/ path and no PDF');
  check(errors.length === 0, 'no browser errors', errors.join(' | '));
  await context.close();
}

async function layout(browser, viewport, theme) {
  const label = `${viewport.width}px ${theme}`;
  console.log(`\nThe worker, the cache, offline and updates at ${label}`);
  const { context, page, errors, state } = await open(browser, { viewport, theme });
  const phone = viewport.width < 700;
  await signIn(page);
  await page.reload();
  check(await controlled(page), `${label}: the service worker registers and controls the page`);
  const reg = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return { scope: new URL(r.scope).pathname, script: new URL(r.active.scriptURL).pathname }; });
  check(reg.scope === '/' && reg.script === '/sw.js', `${label}: scope / and script /sw.js`, JSON.stringify(reg));

  // data requests, after a sign-in: the worker never answers them, and the cache never holds them
  state.quiet = true;
  const me = await page.evaluate(async () => {
    const r = await fetch('/api/health', { credentials: 'include' });
    const a = await fetch('/api/access/me', { credentials: 'include' }).catch(() => null);
    return { health: r.status, me: a ? a.status : 0 };
  });
  check(me.health === 200, `${label}: an /api/ request is answered`);
  const served = [];
  page.on('requestfinished', async (req) => {
    const r = await req.response();
    if (r && /\/api\//.test(req.url())) served.push(r.fromServiceWorker());
  });
  await page.evaluate(() => fetch('/api/access/privileges', { credentials: 'include' }));
  await page.evaluate(() => fetch('/api/health', { credentials: 'include' }));
  await page.waitForTimeout(300);
  check(served.length >= 2 && served.every((s) => s === false), `${label}: /api/ answers do not come from the service worker`, JSON.stringify(served));
  const caches_ = await cacheKeys(page);
  const stored = Object.values(caches_).flat();
  check(stored.length > 20 && stored.includes('/offline.html') && stored.includes('/js/core/pwa.js'), `${label}: the cache holds the app's static files (${stored.length})`);
  check(stored.every((p) => !/^\/(api|uploads|documents|photos|storage)\//.test(p) && !/\.pdf$/i.test(p)), `${label}: nothing from /api/, uploads, documents, photos or PDFs is cached`);
  check(Object.keys(caches_).length === 1, `${label}: one cache, named for the version`, Object.keys(caches_).join(','));
  const pdfPhoto = await page.evaluate(async () => {
    const out = [];
    for (const u of ['/api/ratings/B0539/photo', '/uploads/x.pdf', '/documents/x.pdf']) {
      await fetch(u, { credentials: 'include' }).catch(() => null);
      out.push(await caches.match(u) === undefined);
    }
    return out;
  });
  state.quiet = false;
  check(pdfPhoto.every(Boolean), `${label}: a photo, an upload and a PDF are not found in the cache after asking for them`);

  // Download App is only offered when the browser offers installation
  await page.locator(phone ? '#phone-header [aria-haspopup="menu"]' : '#rail [aria-haspopup="menu"]').last().click().catch(() => {});
  const items = await page.locator('[role="menu"] [role="menuitem"], [role="menu"] a, [role="menu"] button').allTextContents();
  check(items.some((t) => /User Guide/.test(t)) && !items.some((t) => /Download App/.test(t)), `${label}: the account menu has no Download App while the browser offers none`, items.join('|'));
  await page.keyboard.press('Escape');
  // ... and shows it, just before User Guide, when it does
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true });
    e.prompt = () => { window.__prompted = true; };
    e.userChoice = Promise.resolve({ outcome: 'dismissed' });
    window.dispatchEvent(e);
  });
  await page.locator(phone ? '#phone-header [aria-haspopup="menu"]' : '#rail [aria-haspopup="menu"]').last().click();
  const labels = await page.locator('[role="menu"] [role="menuitem"]').allTextContents();
  const at = labels.findIndex((t) => /Download App/.test(t));
  check(at >= 0 && /User Guide/.test(labels[at - 1] || '') && /Sign Out/.test(labels[at + 1] || ''), `${label}: with an install offer, Download App sits just after User Guide, in the group before Sign Out`, labels.join('|'));
  const look = await page.evaluate(() => {
    const items = [...document.querySelectorAll('[role="menu"] [role="menuitem"]')];
    const out = items.find((e) => /Sign Out/.test(e.textContent));
    const first = items[0];
    return { signOutSame: !!out && getComputedStyle(out).color === getComputedStyle(first).color, seps: document.querySelectorAll('[role="menu"] [role="separator"]').length, mutedIcon: !!first.querySelector('svg') && getComputedStyle(first.querySelector('svg')).color !== getComputedStyle(first).color };
  });
  check(look.signOutSame && look.seps === 2 && look.mutedIcon, `${label}: three groups, muted icons, Sign Out in the same colour as the other rows`, JSON.stringify(look));
  await page.waitForTimeout(500); // the sheet's animation and the icons settle
  await shot(page, `account-menu-${viewport.width}-${theme}`);
  if (at >= 0) {
    await page.locator('[role="menu"] [role="menuitem"]', { hasText: 'Download App' }).click();
    check(await page.evaluate(() => window.__prompted === true), `${label}: Download App asks the browser to install`);
  }

  // a new version: a static file changes (its time moves), so the server's worker text has a new version; the browser installs
  // it and the banner appears; nothing reloads by itself
  await page.evaluate(() => { window.__same = true; });
  const touched = path.join(__dirname, '..', '..', 'public', 'js', 'core', 'offline.js');
  const was = fs.statSync(touched);
  fs.utimesSync(touched, new Date(), new Date(Date.now() + 5000 * (viewport.width + (theme === 'dark' ? 1 : 0))));
  await page.waitForTimeout(2300); // the server looks at its files again every 2 seconds
  await page.evaluate(async () => { (await navigator.serviceWorker.getRegistration()).update(); });
  const banner = page.locator('#update-banner');
  await banner.waitFor({ timeout: 15000 });
  check(/A new version of CIRERMS is ready\./.test(await banner.textContent()) && await banner.getByRole('button', { name: 'Reload' }).isVisible(), `${label}: a new version shows the update banner with Reload`);
  await shot(page, `update-banner-${viewport.width}-${theme}`);
  await page.waitForTimeout(800);
  check(await page.evaluate(() => window.__same === true), `${label}: the page did not reload by itself`);
  const nav = page.waitForNavigation({ timeout: 15000 }).catch(() => null);
  await banner.getByRole('button', { name: 'Reload' }).click();
  await nav;
  await page.waitForSelector('#app-main h1, #app-main h2', { timeout: 15000 });
  check(await page.evaluate(() => window.__same === undefined) && await controlled(page), `${label}: Reload activates the new worker and reloads`);
  fs.utimesSync(touched, was.atime, was.mtime);
  const keys = Object.keys(await cacheKeys(page));
  check(keys.length === 1, `${label}: the old version's cache was replaced`, keys.join(','));

  // the network cut: a page load shows the offline page
  await context.setOffline(true);
  await page.goto(`${BASE}/app.html`).catch(() => {});
  const offline = page.locator('main h1', { hasText: 'You Are Offline' });
  await offline.waitFor({ timeout: 10000 });
  const text = await page.locator('main').textContent();
  check(/CIRERMS needs a connection to the server\. Check your network and try again\./.test(text), `${label}: with the network cut a page load shows the offline page`);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(theme === 'dark' ? /rgb\(20, 29, 48\)|rgb\(1[0-9], \d+, \d+\)/.test(bg) : /rgb\(2[45]\d/.test(bg), `${label}: the offline page follows ${theme} mode`, bg);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(wide <= 1, `${label}: the offline page does not scroll sideways`);
  check(await page.evaluate(() => !!document.querySelector('img[alt="Nigerian Navy crest"]') && document.querySelector('img').naturalWidth > 0), `${label}: the offline page shows the crest`);
  await shot(page, `offline-${viewport.width}-${theme}`);
  await context.setOffline(false);
  await Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(() => null), page.getByRole('button', { name: 'Try Again' }).click()]);
  await page.waitForSelector('#app-main h1, #app-main h2', { timeout: 15000 });
  check(/app\.html/.test(page.url()), `${label}: Try Again opens the app once the network is back`);

  check(errors.length === 0, `${label}: no browser errors`, errors.join(' | '));
  await context.close();
}

(async () => {
  const browser = await chromium.launch();
  await manifestAndServer(browser);
  await layout(browser, { width: 1440, height: 900 }, 'light');
  await layout(browser, { width: 390, height: 844 }, 'dark');
  await layout(browser, { width: 1440, height: 900 }, 'dark');
  await layout(browser, { width: 390, height: 844 }, 'light');
  await browser.close();
  const seconds = Math.round((Date.now() - STARTED) / 1000);
  console.log(`\n${failures === 0 ? 'PASSED' : `${failures} FAILED`} in ${seconds} s`);
  if (seconds > LIMIT_SECONDS) { console.log('FAIL  over five minutes'); failures += 1; }
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
