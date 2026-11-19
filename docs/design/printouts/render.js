'use strict';
/* Renders every printout template here to pdf/<name>.pdf with Chromium.
   Run:  npm run printouts:render   (one name renders one:  npm run printouts:render -- draft-form)
   Each <name>.hbs is filled with <name>.sample.json, written next to this script, and loaded from disk,
   so the stylesheet, the crest and the fonts all come from this folder: nothing is fetched from the internet.
   Needs Handlebars (npm i --no-save handlebars; the app's renderer adds it as a dependency) and Playwright's Chromium. */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function load(name) {
  try { return require(name); } catch (_) { /* try the global folder */ }
  const root = execSync('npm root -g').toString().trim();
  return require(path.join(root, name));
}

const Handlebars = require('handlebars');
const { chromium } = load('playwright');
const registerHelpers = require('./helpers');

const DIR = __dirname;
const OUT = path.join(DIR, 'pdf');
const BUILD = path.join(DIR, '.build');
registerHelpers(Handlebars);

for (const f of fs.readdirSync(path.join(DIR, 'partials'))) {
  Handlebars.registerPartial(path.basename(f, '.hbs'), fs.readFileSync(path.join(DIR, 'partials', f), 'utf8'));
}

const footerFont = `data:font/woff2;base64,${fs.readFileSync(path.join(DIR, 'fonts', 'inter-latin-400-normal.woff2')).toString('base64')}`;
const footerTpl = Handlebars.compile(fs.readFileSync(path.join(DIR, 'partials', 'footer.hbs'), 'utf8'));

async function main() {
  const only = process.argv.slice(2);
  const names = fs.readdirSync(DIR).filter((f) => f.endsWith('.hbs')).map((f) => path.basename(f, '.hbs'))
    .filter((n) => !only.length || only.includes(n)).sort();
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(BUILD, { recursive: true });
  const browser = await chromium.launch();
  let failed = 0;
  try {
    for (const name of names) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(DIR, `${name}.sample.json`), 'utf8'));
        const html = Handlebars.compile(fs.readFileSync(path.join(DIR, `${name}.hbs`), 'utf8'))(data);
        const file = path.join(BUILD, `${name}.html`);
        // the page sits in this folder's .build, so link the folder's files by an absolute base
        fs.writeFileSync(file, html.replace('<head>', `<head><base href="file://${DIR}/">`));
        const page = await browser.newPage();
        const problems = [];
        page.on('requestfailed', (r) => problems.push(`failed: ${r.url()}`));
        page.on('pageerror', (e) => problems.push(String(e)));
        await page.goto(`file://${file}`, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        const footer = footerTpl({ generatedBy: data.generatedBy, generatedAt: Handlebars.helpers.datetime(data.generatedAt), fontData: footerFont });
        await page.pdf({
          path: path.join(OUT, `${name}.pdf`), format: 'A4', printBackground: true, preferCSSPageSize: true,
          displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: footer, tagged: true,
        });
        await page.close();
        if (problems.length) throw new Error(problems.join('; '));
        console.log(`ok   ${name}`);
      } catch (e) {
        failed += 1;
        console.error(`FAIL ${name}: ${e.message}`);
      }
    }
  } finally {
    await browser.close();
    fs.rmSync(BUILD, { recursive: true, force: true });
  }
  if (failed) { console.error(`${failed} failed`); process.exit(1); }
  console.log(`${names.length} PDFs in ${path.relative(process.cwd(), OUT)}`);
}
main();
