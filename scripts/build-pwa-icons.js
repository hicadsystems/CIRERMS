#!/usr/bin/env node
/*
 * Builds the installed app's icons from the crest (public/assets/navy-crest.webp) with the machine's
 * Playwright (it installs nothing; run with NODE_PATH=$(npm root -g) when Playwright is installed globally).
 * The PNGs are committed, like css/output.css and the icon sprite:
 *
 *   public/assets/icons/icon-192.png            crest on the brand colour, filling the square
 *   public/assets/icons/icon-512.png            the same, larger
 *   public/assets/icons/icon-maskable-512.png   the crest inside the safe zone (the middle 60%), so any mask keeps it whole
 *   public/assets/icons/apple-touch-icon.png    180 x 180, no transparency (iPhone and iPad fill it themselves)
 *
 * BRAND mirrors --sidebar in public/css/input.css (#0074a8), as the manifest's theme_color does.
 *
 *   npm run icons:pwa
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BRAND = '#0074a8';
const root = path.join(__dirname, '..');
const crest = 'data:image/webp;base64,' + fs.readFileSync(path.join(root, 'public/assets/navy-crest.webp')).toString('base64');
const outDir = path.join(root, 'public/assets/icons');

// [file, pixels, share of the square the crest's height may use]
const ICONS = [
  ['icon-192.png', 192, 0.8],
  ['icon-512.png', 512, 0.8],
  ['icon-maskable-512.png', 512, 0.6],
  ['apple-touch-icon.png', 180, 0.8],
];

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [file, size, share] of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<body style="margin:0;width:${size}px;height:${size}px;background:${BRAND};display:flex;align-items:center;justify-content:center">` +
      `<img id="c" src="${crest}" style="height:${Math.round(size * share)}px;width:auto"></body>`
    );
    await page.waitForFunction(() => document.getElementById('c').complete);
    await page.screenshot({ path: path.join(outDir, file) });
    console.log('wrote', path.join('public/assets/icons', file));
  }
  await browser.close();
})();
