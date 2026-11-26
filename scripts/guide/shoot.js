#!/usr/bin/env node
'use strict';

/*
 * Takes the User Guide's pictures (docs/manual/README.md says how a picture is specified).
 *
 *   npm run guide:shots                          every picture of every chapter
 *   npm run guide:shots -- --chapter <slug>      one chapter's
 *   npm run guide:shots -- --shot <id>           one picture
 *   npm run guide:shots -- --stale               only the pictures whose spec or screen changed, or that are missing
 *   --jobs <n>      pictures taken at the same time (default 4)       --url <address>   the running app (default http://localhost:3000)
 *
 * Needs the app running on a fresh database with the demo seed (npm run migrate:fresh, npm run seed, npm start) and the
 * machine's Playwright (NODE_PATH=$(npm root -g) when it is installed globally); it installs nothing.
 *
 * Four captures of every picture, `<id>.<device>.<theme>.png` in docs/manual/img/<chapter>/: desktop 1440 x 900 and phone
 * 390 x 844, each in light and in dark, at device scale 2. Built to be fast:
 *   - one browser for the whole run;
 *   - each demo account signs in once, through the API, and every picture of that account reuses the session;
 *   - the desktop and the phone run of a picture go side by side, and `--jobs` pictures at a time;
 *   - the steps of a picture run once for each device: the light capture is taken, the theme is switched in place (as the
 *     app's own switch does, with no reload and no transitions), the next frame is awaited, and the dark capture is
 *     taken with the same crop and the same marks;
 *   - nothing waits a fixed time: each step waits for what the next one needs (the fonts, the requests, the spinners).
 * Exit 0 when every picture asked for was taken, 1 when one was not (each says why).
 */
const fs = require('fs');
const path = require('path');
const lib = require('./lib');

/* The demo accounts a picture can be taken as: its `as:`. They are the ones in README.md's demo credentials. */
const ACCOUNTS = {
  admin: ['HICO001', 'Admin@123'],          // Administrator: every privilege
  rating: ['B0539', 'Rating@123'],          // Rating: View My Details only
  records: ['HICO002', 'Officer@123'],      // Records Officer
  navigation: ['HICO003', 'Officer@123'],   // Records Officer tied to the Navigation specialisation
  clerk: ['B0541', 'Clerk@123'],            // Records Clerk
  auditor: ['HICO004', 'Auditor@123'],      // Auditor
  tables: ['HICO005', 'Tables@123'],        // Static Tables
  discipline: ['B0575', 'Admin@123'],       // Disciplinary Actions
  initiator: ['B0588', 'Admin@123'],        // Disciplinary Initiator
  discharge: ['B1000', 'Admin@123'],        // Discharge
  drafting: ['B0705', 'Admin@123'],         // Drafting
  'drafting-marine': ['B0706', 'Admin@123'], // Drafting, Marine Propulsion department
  approver: ['B0707', 'Admin@123'],         // Drafting Approver
  advancement: ['B0801', 'Admin@123'],      // Advancement
  'advancement-approver': ['B0802', 'Admin@123'],
  'advancement-gunnery': ['B0803', 'Admin@123'], // Advancement, Gunnery department
  training: ['B0901', 'Admin@123'],         // Training
  'training-viewer': ['B0902', 'Admin@123'],
  special: ['B1101', 'Admin@123'],          // Special Drafting
  'special-officer': ['B1102', 'Admin@123'],
  appraisal: ['B1201', 'Admin@123'],        // Naval Assessment
  'appraisal-officer': ['B1202', 'Admin@123'],
  report: ['B1301', 'Admin@123'],           // Report
};

const SIZES = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } };
/* The moment every picture shows (the browser's clock; what the server computes follows the server's own day). */
const PICTURE_TIME = new Date('2026-11-26T10:00:00+01:00');
const WAIT_MS = 8000;
/* A screen that makes a PDF takes longer (the guide's book is made twice); a wait step and a settle allow for it. */
const SETTLE_MS = 45000;

/* What never reaches a picture: motion, the caret, toasts, tooltips and the focus a step left behind. */
const QUIET = `
*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; scroll-behavior: auto !important; }
#toast-root, [role="tooltip"] { display: none !important; }
*:focus, *:focus-visible { outline: none !important; box-shadow: none !important; }
`;

function options(argv) {
  const out = { chapter: null, shot: null, stale: false, jobs: 4, url: 'http://localhost:3000' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--chapter') out.chapter = argv[(i += 1)];
    else if (a === '--shot') out.shot = argv[(i += 1)];
    else if (a === '--stale') out.stale = true;
    else if (a === '--jobs') out.jobs = Math.max(1, Number(argv[(i += 1)]) || 4);
    else if (a === '--url') out.url = String(argv[(i += 1)]).replace(/\/$/, '');
    else if (a === '--help') out.help = true;
    else throw new Error(`Unknown option ${a} (try --help)`);
  }
  return out;
}

/** The pictures asked for: { chapter, spec }. */
function wanted(opts) {
  const { chapters, problems } = lib.store.get();
  if (problems.length) throw new Error(`The chapters have problems (npm run guide:check):\n  ${problems.slice(0, 8).join('\n  ')}`);
  const out = [];
  chapters.forEach((chapter) => {
    if (opts.chapter && chapter.slug !== opts.chapter) return;
    Object.values(chapter.shots).forEach((spec) => {
      if (opts.shot && spec.id !== opts.shot) return;
      if (opts.stale && !lib.isStale(chapter.slug, spec)) return;
      if (spec.as !== 'guest' && !ACCOUNTS[spec.as]) throw new Error(`${chapter.file}: picture ${spec.id}: as ${spec.as} is not a demo account (${Object.keys(ACCOUNTS).join(', ')}, guest)`);
      out.push({ chapter: chapter.slug, spec });
    });
  });
  if (opts.shot && !out.length && !opts.stale) throw new Error(`No picture named ${opts.shot}`);
  return out;
}

/* ---------- signing in: once per account, through the API ---------- */

async function login(origin, account) {
  const [username, password] = ACCOUNTS[account];
  const res = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  if (!res.ok) throw new Error(`${account} could not sign in (${res.status}): is the app running on a fresh seeded database?`);
  const cookie = /cirerms_session=([^;]+)/.exec(res.headers.get('set-cookie') || '');
  if (!cookie) throw new Error(`${account}: the sign-in set no session`);
  return decodeURIComponent(cookie[1]);
}

const sessions = new Map();
/** The account's session, signed in the first time it is asked for and shared by every picture after. */
function signIn(origin, account) {
  if (!sessions.has(account)) sessions.set(account, login(origin, account));
  return sessions.get(account);
}

/* ---------- finding what a step names ---------- */

/** A target as a Playwright locator inside `scope`. */
function locatorOf(scope, t) {
  const exact = { exact: true };
  switch (t.kind) {
    case 'button': return scope.getByRole('button', { name: t.name, ...exact });
    case 'link': return scope.getByRole('link', { name: t.name, ...exact });
    case 'tab': return scope.getByRole('tab', { name: t.name, ...exact });
    case 'menuitem': return scope.getByRole('menuitem', { name: t.name, ...exact });
    case 'heading': return scope.getByRole('heading', { name: t.name, ...exact });
    case 'label': return scope.getByLabel(t.name, exact);
    case 'text': return scope.getByText(t.name, exact);
    case 'searchbox': return scope.locator('input[type=search], [role=searchbox]');
    case 'role': return scope.getByRole(t.role, { name: t.name, ...exact });
    case 'css': return scope.locator(t.selector);
    case 'row': return scope.locator('#app-main tbody tr, #app-main [data-row]').filter({ visible: true }).nth(t.index - 1);
    default: throw new Error(`unknown target ${t.kind}`);
  }
}

const describeTarget = (t) => `${t.kind}${t.name ? ` "${t.name}"` : t.selector ? ` ${t.selector}` : t.index ? ` ${t.index}` : ''}`;

/** The first visible element a target names: in the open dialog when there is one, else anywhere on the page. */
async function find(page, t, patience = WAIT_MS) {
  const until = Date.now() + patience;
  for (;;) {
    const dialog = page.locator('[role=dialog]:visible').last();
    const scopes = (await dialog.count()) ? [dialog, page] : [page];
    for (const scope of scopes) {
      const all = await locatorOf(scope, t).all();
      for (const l of all) if (await l.isVisible().catch(() => false)) return l;
    }
    if (Date.now() > until) throw new Error(`${describeTarget(t)} is not on screen`);
    await page.waitForTimeout(60);
  }
}

/* ---------- waiting for the page to settle, with no fixed sleeps ---------- */

function watchRequests(page) {
  const state = { pending: 0 };
  page.on('request', (r) => { if (!r.url().startsWith('data:')) state.pending += 1; });
  page.on('requestfinished', () => { state.pending = Math.max(0, state.pending - 1); });
  page.on('requestfailed', () => { state.pending = Math.max(0, state.pending - 1); });
  return state;
}

/** Fonts ready, nothing loading, no spinner, every picture drawn, and a quiet frame. */
async function settle(page, requests) {
  const until = Date.now() + SETTLE_MS;
  for (;;) {
    const calm = await page.evaluate(async () => {
      await document.fonts.ready;
      const spinning = [...document.querySelectorAll('.animate-spin')].some((n) => n.getClientRects().length);
      // a picture still being fetched, where it is in view (one far down a page is only loaded when scrolled to)
      const drawing = [...document.images].some((i) => {
        const r = i.getBoundingClientRect();
        return r.width && r.top < window.innerHeight && r.bottom > 0 && !i.complete;
      });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return !spinning && !drawing;
    });
    if (calm && requests.pending === 0) return;
    if (Date.now() > until) throw new Error('the screen did not settle (still loading)');
    await page.waitForTimeout(40);
  }
}

/* ---------- the steps ---------- */

async function doStep(page, step) {
  if (step.action === 'press') { await page.keyboard.press(step.key); return; }
  const target = await find(page, step.target, step.action === 'wait' ? SETTLE_MS : WAIT_MS);
  if (step.action === 'click') await target.click();
  else if (step.action === 'fill') await target.fill(step.value);
  else if (step.action === 'wait') await target.waitFor({ state: 'visible' });
  else if (step.action === 'scroll') await target.scrollIntoViewIfNeeded();
  else if (step.action === 'select') await choose(page, target, step.value);
  else throw new Error(`unknown step ${step.action}`);
}

/** A dropdown: opened and its option pressed, as a person does (a native select by its value). */
async function choose(page, target, value) {
  const handle = await target.elementHandle();
  const kind = await handle.evaluate((el) => {
    if (el.tagName === 'SELECT') return el._customDropdown ? 'custom' : 'native';
    return el.closest('.custom-dropdown-wrapper') ? 'custom' : 'native';
  });
  if (kind === 'native') { await target.selectOption({ label: value }); return; }
  const box = await handle.evaluateHandle((el) => (el.tagName === 'SELECT' ? el._customDropdown.searchInput : el.closest('.custom-dropdown-wrapper').querySelector('.custom-dropdown-search')));
  await box.asElement().click();
  await page.locator('[role=listbox] [role=option]').filter({ hasText: new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`) }).first().click();
}

/* ---------- marks, the crop and the capture ---------- */

/** The numbered marks over their targets, in the app's brand colour (its tokens, so the dark capture re-colours them).
 *  Returns the area they cover, so the crop can take every mark in. */
async function drawMarks(page, marks) {
  if (!marks.length) return null;
  const found = [];
  for (const m of marks) found.push({ n: m.n, target: await find(page, m.target), what: describeTarget(m.target) });
  for (const f of found) await f.target.scrollIntoViewIfNeeded().catch(() => null);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const BADGE = 24;
  const drawn = [];
  for (const f of found) {
    const box = await f.target.boundingBox();
    const seen = await f.target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!hit && (hit === el || el.contains(hit) || !!hit.closest('label, button, a, [role=option], [role=menuitem], [role=tab]'));
    });
    if (!box || !seen) throw new Error(`mark ${f.n} (${f.what}) is not on screen: drop it or split the picture`);
    // the number sits left of a small target when there is room, on its left edge when there is not, and on the corner of a tall one
    let left;
    let top;
    if (box.height <= 90) {
      left = box.x >= 30 ? box.x - 2 - BADGE - 2 : Math.max(2, box.x - 2 - BADGE / 2);
      top = box.y + box.height / 2 - BADGE / 2;
    } else {
      left = Math.max(2, box.x - BADGE / 2);
      top = Math.max(2, box.y - BADGE / 2);
    }
    drawn.push({ n: f.n, box, badge: { left, top, size: BADGE }, width: box.height > 60 ? 3 : 2 });
  }
  await page.evaluate((list) => {
    const layer = document.createElement('div');
    layer.setAttribute('data-guide-marks', '');
    Object.assign(layer.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2147483647' });
    for (const { n, box, badge, width } of list) {
      const ring = document.createElement('div');
      Object.assign(ring.style, {
        position: 'fixed', left: `${box.x - 2}px`, top: `${box.y - 2}px`, width: `${box.width + 4}px`, height: `${box.height + 4}px`,
        border: `${width}px solid rgb(var(--brand))`, borderRadius: '10px', boxShadow: '0 0 0 2px rgb(var(--background))', boxSizing: 'border-box',
      });
      const dot = document.createElement('div');
      dot.textContent = String(n);
      Object.assign(dot.style, {
        position: 'fixed', left: `${badge.left}px`, top: `${badge.top}px`, width: `${badge.size}px`, height: `${badge.size}px`,
        borderRadius: '999px', background: 'rgb(var(--brand))', color: 'rgb(var(--brand-foreground))',
        font: '700 13px/24px system-ui, sans-serif', textAlign: 'center', boxShadow: '0 0 0 2px rgb(var(--background))',
      });
      layer.append(ring, dot);
    }
    document.body.append(layer);
  }, drawn);
  // what the marks cover, with the ring's glow
  const xs = drawn.flatMap((d) => [d.box.x - 6, d.box.x + d.box.width + 6, d.badge.left - 3, d.badge.left + d.badge.size + 3]);
  const ys = drawn.flatMap((d) => [d.box.y - 6, d.box.y + d.box.height + 6, d.badge.top - 3, d.badge.top + d.badge.size + 3]);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

/** The lowest edge of what an element really holds (its last text, picture or control), so empty space under it is left out. */
const contentBottom = (el) => el.evaluate((root) => {
  const limit = root.getBoundingClientRect().bottom;
  let low = root.getBoundingClientRect().top;
  root.querySelectorAll('*').forEach((n) => {
    const r = n.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const style = getComputedStyle(n);
    if (style.visibility === 'hidden' || style.display === 'none') return;
    const leaf = !n.children.length || /^(IMG|SVG|CANVAS|INPUT|SELECT|TEXTAREA)$/i.test(n.tagName);
    if (leaf) low = Math.max(low, Math.min(r.bottom, limit));
  });
  return low;
});

/** Where the picture is cut: the page without the empty space under it, the open dialog or sheet, the open menu, or one element. */
async function clipOf(page, crop, covered) {
  const vp = page.viewportSize();
  const whole = { x: 0, y: 0, width: vp.width, height: vp.height };
  let clip;
  if (crop === 'viewport') clip = whole;
  else if (crop === 'page') {
    if (await page.locator('[role=dialog]:visible').count()) clip = whole;
    else {
      const bottom = await page.evaluate(() => {
        const main = document.getElementById('app-main');
        const last = main && main.lastElementChild;
        return last ? last.getBoundingClientRect().bottom : null;
      });
      // on a phone the bottom bar belongs to the picture; on a desktop the content's end, with some air under it
      clip = !bottom || vp.width < 761 ? whole : { ...whole, height: Math.min(vp.height, Math.ceil(bottom + 28)) };
    }
  } else {
    // `modal`: the open dialog or sheet, else the open menu
    const modal = (await page.locator('[role=dialog]:visible').count()) ? page.locator('[role=dialog]:visible').last() : page.locator('[role=menu]:visible').last();
    const el = crop === 'modal' ? modal : page.locator(crop).first();
    const box = await el.boundingBox();
    if (!box) throw new Error(`crop ${crop}: nothing on screen`);
    const pad = crop === 'modal' ? 10 : 20;
    const bottom = Math.min(box.y + box.height, (await contentBottom(el)) + 24);
    const x = Math.max(0, box.x - pad);
    const y = Math.max(0, box.y - pad);
    clip = { x, y, width: Math.min(vp.width - x, box.width + pad * 2), height: Math.min(vp.height - y, bottom - y + pad) };
  }
  if (covered && crop !== 'viewport') {
    // every mark, with its number, is inside the picture
    const x = Math.max(0, Math.min(clip.x, covered.x));
    const y = Math.max(0, Math.min(clip.y, covered.y));
    const right = Math.min(vp.width, Math.max(clip.x + clip.width, covered.x + covered.width));
    const bottom = Math.min(vp.height, Math.max(clip.y + clip.height, covered.y + covered.height));
    clip = { x, y, width: right - x, height: bottom - y };
  }
  return clip;
}

async function switchTheme(page, theme) {
  await page.evaluate((t) => import('/js/core/theme.js').then((m) => m.setTheme(t)), theme);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

/* ---------- one picture on one device: the steps once, then light and dark ---------- */

async function takeDevice(browser, origin, shot, device) {
  const { spec } = shot;
  // a picture that locks or ends the session (`session: own`) signs in on its own; the rest share their account's session
  const session = spec.as === 'guest' ? null : spec.session === 'own' ? await login(origin, spec.as) : await signIn(origin, spec.as);
  const host = new URL(origin).hostname;
  const ctx = await browser.newContext({
    viewport: SIZES[device],
    deviceScaleFactor: 2,
    isMobile: false,
    reducedMotion: 'reduce',
    colorScheme: 'light',
    locale: 'en-GB',
    timezoneId: 'Africa/Lagos',
    serviceWorkers: 'block',
    storageState: session ? { cookies: [{ name: 'cirerms_session', value: session, domain: host, path: '/', httpOnly: true, secure: false, sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 3600 }], origins: [] } : undefined,
  });
  try {
    await ctx.clock.setFixedTime(PICTURE_TIME);
    await ctx.addInitScript(() => { try { window.localStorage.setItem('cirerms-theme', 'light'); } catch (_) { /* storage off */ } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(WAIT_MS);
    const requests = watchRequests(page);
    const open = spec.open.startsWith('#') ? `/app.html${spec.open}` : spec.open;
    await page.goto(`${origin}${open}`, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: QUIET });
    if (spec.open.startsWith('#')) await page.waitForSelector('#app-main > *');
    await settle(page, requests);
    for (const step of spec.do) {
      if (step.device && step.device !== device) continue;
      await doStep(page, step);
      await settle(page, requests);
    }
    const covered = await drawMarks(page, spec.marks);
    const clip = await clipOf(page, spec.crop, covered);
    const out = {};
    for (const theme of lib.THEMES) {
      if (theme === 'dark') await switchTheme(page, 'dark');
      const png = await page.screenshot({ type: 'png', clip, animations: 'disabled', caret: 'hide' });
      out[theme] = lib.shrinkPng(png);
    }
    return out;
  } finally {
    await ctx.close();
  }
}

async function takeShot(browser, origin, shot) {
  const started = Date.now();
  const devices = shot.spec.devices;
  const results = await Promise.all(devices.map((d) => takeDevice(browser, origin, shot, d).then((r) => [d, r], (err) => { throw new Error(`${d}: ${String(err.message).split('\n')[0]}`); })));
  const dir = path.join(lib.IMG, shot.chapter);
  fs.mkdirSync(dir, { recursive: true });
  let bytes = 0;
  results.forEach(([device, themes]) => lib.THEMES.forEach((theme) => {
    fs.writeFileSync(path.join(dir, `${shot.spec.id}.${device}.${theme}.png`), themes[theme]);
    bytes += themes[theme].length;
  }));
  return { ms: Date.now() - started, bytes };
}

async function main(argv) {
  const opts = options(argv);
  if (opts.help) { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, '').replace(/^'use strict';\n/, '')); return 0; }
  let playwright;
  try { playwright = require('playwright'); } catch (_) {
    throw new Error("Playwright is not installed here. Use the machine's: NODE_PATH=$(npm root -g) npm run guide:shots (this script never installs it).");
  }
  const list = wanted(opts);
  if (!list.length) { console.log('guide:shots: nothing to take'); return 0; }
  const started = Date.now();
  const browser = await playwright.chromium.launch();
  const failed = [];
  const taken = [];
  let at = 0;
  const worker = async () => {
    while (at < list.length) {
      const shot = list[at]; at += 1;
      try {
        const r = await takeShot(browser, opts.url, shot);
        taken.push(shot);
        console.log(`  ${shot.chapter}/${shot.spec.id}  ${(r.ms / 1000).toFixed(1)} s  ${(r.bytes / 1024).toFixed(0)} KB`);
      } catch (err) {
        failed.push(`${shot.chapter}/${shot.spec.id}: ${err.message}`);
      }
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(opts.jobs, list.length) }, worker));
  } finally {
    await browser.close();
  }
  // the hashes of what was taken, to find a picture whose spec or screen changes later
  const byChapter = new Map();
  taken.forEach((s) => byChapter.set(s.chapter, [...(byChapter.get(s.chapter) || []), s]));
  byChapter.forEach((shots, chapter) => {
    const all = lib.readShots(chapter);
    shots.forEach((s) => { all[s.spec.id] = { ...lib.hashesOf(s.spec), devices: s.spec.devices }; });
    lib.writeShots(chapter, all);
  });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (failed.length) {
    console.error(`guide:shots: ${failed.length} picture(s) not taken, ${taken.length} taken, ${seconds} s\n  ${failed.join('\n  ')}`);
    return 1;
  }
  console.log(`guide:shots: ${taken.length} picture(s) taken, ${taken.length * 4} captures at most, in ${seconds} s`);
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (err) => { console.error(`guide:shots: ${err.message}`); process.exit(1); });
}

module.exports = { ACCOUNTS, wanted, main };
