/*
 * Builds the installed app's icons from the crest (public/assets/navy-crest.webp) with the machine's
 * Playwright (it installs nothing; run with NODE_PATH=$(npm root -g) when Playwright is installed globally).
 * The PNGs are committed, like css/output.css and the icon sprite:
 *
 *   public/assets/icons/icon-192.png            the crest alone on a transparent background, with a small even margin
 *   public/assets/icons/icon-512.png            the same, larger
 *   public/assets/icons/apple-touch-icon.png    180 x 180: iOS fills transparency with black, so the crest sits on the
 *                                               page's light background colour with a small margin
 *
 * PAGE mirrors --background in public/css/input.css (#faf9f0), as the manifest's background_color does.
 * There is no maskable icon: it needs a filled background, which the app's icon does not have.
 *
 *   npm run icons:pwa
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = '#faf9f0';
const root = path.join(__dirname, '..');
const crest = 'data:image/webp;base64,' + fs.readFileSync(path.join(root, 'public/assets/navy-crest.webp')).toString('base64');
const outDir = path.join(root, 'public/assets/icons');

// [file, pixels, share of the square the crest's height may use, background (null: transparent)]
const ICONS = [
  ['icon-192.png', 192, 0.94, null],
  ['icon-512.png', 512, 0.94, null],
  ['apple-touch-icon.png', 180, 0.84, PAGE],
];

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [file, size, share, bg] of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<body style="margin:0;width:${size}px;height:${size}px;background:${bg || 'transparent'};display:flex;align-items:center;justify-content:center">` +
      `<img id="c" src="${crest}" style="height:${Math.round(size * share)}px;width:auto"></body>`
    );
    await page.waitForFunction(() => document.getElementById('c').complete);
    await page.screenshot({ path: path.join(outDir, file), omitBackground: !bg });
    console.log('wrote', path.join('public/assets/icons', file));
  }
  await browser.close();
})();
