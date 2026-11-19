'use strict';

/*
 * The one shared Chromium behind renderPdf (modelled on NAVY-PAYROLL's lib/chromiumPdfGenerator.js and pdfGate.js).
 *
 *  - Started on first use, kept open while PDFs are being made, closed after PDF_BROWSER_IDLE_MS without one.
 *  - Restarted (closed once idle) after PDF_BROWSER_MAX_PAGES pages, and started again if it crashed; a render
 *    that meets a crash is tried once more on a fresh browser.
 *  - A small pool of tabs: at most PDF_TAB_POOL_SIZE renders at once, the rest wait their turn.
 *  - Every render has a timeout (PDF_TIMEOUT_MS) and its tab is always closed.
 *  - Which Chromium: PDF_CHROMIUM_PATH if set (a system Chromium or Chrome); else the binary that comes with
 *    @sparticuz/chromium, as on NAVY-PAYROLL's server.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('../../config');

const cfg = config.pdf;
let puppeteer = null;
let launchOptions = null;
let browser = null;
let launching = null;
let active = 0; // tabs in use
let waiting = []; // renders waiting for a tab
let pagesSinceLaunch = 0;
let launches = 0;
let served = 0;
let idleTimer = null;

const log = (m) => console.log(`[printouts] ${m}`);

async function prepare() {
  if (launchOptions) return;
  puppeteer = require('puppeteer-core');
  const base = ['--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--disable-extensions'];
  if (cfg.chromiumPath) {
    if (!fs.existsSync(cfg.chromiumPath)) throw new Error(`PDF_CHROMIUM_PATH points to a file that does not exist: ${cfg.chromiumPath}`);
    launchOptions = { executablePath: cfg.chromiumPath, headless: true, args: [...base, '--no-sandbox', '--disable-setuid-sandbox'] };
  } else if (process.platform === 'win32') {
    const candidates = [
      path.join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env.PROGRAMFILES || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ];
    const executablePath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!executablePath) {
      throw new Error('No Chrome or Edge installation was found. Set PDF_CHROMIUM_PATH to a browser executable.');
    }
    launchOptions = { executablePath, headless: true, args: [...base, '--no-sandbox', '--disable-setuid-sandbox'] };
  } else {
    const sparticuzModule = require('@sparticuz/chromium');
    const sparticuz = sparticuzModule.default || sparticuzModule;
    const tmp = cfg.tempDir || path.join(os.tmpdir(), 'cirerms-chromium');
    fs.mkdirSync(tmp, { recursive: true });
    // --single-process and --no-zygote stop web fonts loading; the headless shell has no font renderer
    const args = sparticuz.args.filter((a) => a !== '--single-process' && a !== '--no-zygote' && !a.startsWith('--headless'));
    launchOptions = { executablePath: await sparticuz.executablePath(), headless: true, args: [...args, ...base, '--no-sandbox', `--user-data-dir=${tmp}`] };
  }
}

async function use() {
  await prepare();
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  if (!browser || !browser.connected) {
    if (!launching) {
      launching = puppeteer.launch(launchOptions).then((b) => {
        b.on('disconnected', () => { if (browser === b) { log('browser disconnected'); browser = null; } });
        browser = b;
        pagesSinceLaunch = 0;
        launches += 1;
        log('browser started');
        return b;
      }).finally(() => { launching = null; });
    }
    await launching;
  }
  return browser;
}

function closeBrowser() {
  const b = browser;
  browser = null;
  if (b) b.close().catch(() => {});
}

function release() {
  active = Math.max(0, active - 1);
  pagesSinceLaunch += 1;
  served += 1;
  const next = waiting.shift();
  if (next) { active += 1; next(); return; }
  if (active > 0 || !browser) return;
  if (pagesSinceLaunch >= cfg.browserMaxPages) { log(`restarting the browser after ${pagesSinceLaunch} pages`); closeBrowser(); return; }
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (active === 0 && browser) { log('closing the idle browser'); closeBrowser(); }
  }, cfg.browserIdleMs);
  idleTimer.unref();
}

const crashed = (e) => /Target closed|Session closed|Protocol error|disconnected|Connection closed|detached/i.test(String((e && e.message) || ''));

/** Run fn(page) on a fresh tab of the shared browser, within the tab pool; the tab is always closed. */
async function withPage(fn) {
  if (active >= cfg.tabPoolSize) await new Promise((resolve) => waiting.push(resolve));
  else active += 1;
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  try {
    for (let attempt = 0; ; attempt += 1) {
      let page = null;
      let b = null;
      let timer = null;
      try {
        b = await use();
        page = await b.newPage();
        page.setDefaultTimeout(cfg.timeoutMs);
        page.setDefaultNavigationTimeout(cfg.timeoutMs);
        // a hard stop in case the page hangs in a way the timeouts do not catch
        const stop = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The printout timed out.')), cfg.timeoutMs + 5000); });
        return await Promise.race([fn(page), stop]);
      } catch (err) {
        if (attempt === 0 && crashed(err)) {
          log(`browser failed during a render, trying once more: ${err.message}`);
          if (browser === b) closeBrowser();
          continue;
        }
        throw err;
      } finally {
        if (timer) clearTimeout(timer);
        if (page) await page.close().catch(() => {});
      }
    }
  } finally {
    release();
  }
}

async function close() {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  const b = browser;
  browser = null;
  if (b) await b.close().catch(() => {});
}

const stats = () => ({ running: Boolean(browser && browser.connected), active, waiting: waiting.length, launches, served, pagesSinceLaunch });

module.exports = { withPage, close, stats };
