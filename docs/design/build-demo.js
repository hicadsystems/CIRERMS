#!/usr/bin/env node
/*
 * Builds docs/design/demo.html, the approved layout demo, from demo-src.html.
 * The CSS is compiled with the project's own Tailwind config and tokens
 * (public/css/input.css), and the icon sprite, both crests and js/core/choices.js are
 * inlined, so the one file opens offline in any browser.
 *
 *   npm run demo:build
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const HERE = __dirname;
const at = (...p) => path.join(ROOT, ...p);

const cssOut = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cirerms-demo-')), 'demo.css');
execFileSync(at('node_modules', '.bin', 'tailwindcss'), [
  '-c', at('tailwind.config.js'),
  '--content', [path.join(HERE, 'demo-src.html'), at('public', 'js', 'core', 'choices.js')].join(','),
  '-i', at('public', 'css', 'input.css'),
  '-o', cssOut, '--minify',
], { cwd: ROOT, stdio: 'pipe' });
const css = fs.readFileSync(cssOut, 'utf8');

// The project's sprite, plus the phone icon only the demo's Phone Preview uses; ids get an i- prefix.
const symbol = (name) => {
  const svg = fs.readFileSync(at('node_modules', 'lucide-static', 'icons', `${name}.svg`), 'utf8');
  const inner = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>')).split('\n').map((l) => l.trim()).join('');
  return `<symbol id="${name}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g></symbol>`;
};
const sprite = fs.readFileSync(at('public', 'assets', 'icons.svg'), 'utf8')
  .replace('<svg xmlns="http://www.w3.org/2000/svg">', '<svg xmlns="http://www.w3.org/2000/svg" hidden>')
  .replace('</svg>\n', `${symbol('smartphone')}</svg>\n`)
  .replace(/<symbol id="/g, '<symbol id="i-');

const crest = `data:image/png;base64,${fs.readFileSync(at('public', 'assets', 'navy-logo.png')).toString('base64')}`;
const crestLarge = `data:image/webp;base64,${fs.readFileSync(at('public', 'assets', 'navy-crest.webp')).toString('base64')}`;
const choices = fs.readFileSync(at('public', 'js', 'core', 'choices.js'), 'utf8');

const out = fs.readFileSync(path.join(HERE, 'demo-src.html'), 'utf8')
  .replace('/*__CSS__*/', () => css)
  .replace('<!--__SPRITE__-->', () => sprite)
  .replace('/*__CHOICES__*/', () => choices)
  .replace(/__CREST_LARGE__/g, () => crestLarge)
  .replace(/__CREST__/g, () => crest);
const left = out.match(/__[A-Z]+__/g);
if (left) throw new Error(`Unfilled placeholders: ${left.join(', ')}`);
fs.writeFileSync(path.join(HERE, 'demo.html'), out);
console.log(`Wrote docs/design/demo.html (${Math.round(out.length / 1024)} KB)`);
