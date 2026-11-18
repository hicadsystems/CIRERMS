#!/usr/bin/env node
/*
 * Builds public/assets/icons.svg: one SVG sprite holding only the icons the
 * frontend uses, taken from Lucide (lucide-static, a dev dependency). Nothing
 * is fetched at run time; the sprite is committed like css/output.css.
 *
 * Use an icon in HTML:  <svg class="icon" aria-hidden="true"><use href="/assets/icons.svg#search"></use></svg>
 * or in JS:             icon('search') from js/core/icons.js
 *
 * To add one: put its Lucide name (https://lucide.dev/icons) in ICONS and run
 * `npm run icons:build`.
 */
const fs = require('fs');
const path = require('path');

const ICONS = [
  // shell and navigation
  'house', 'layout-dashboard', 'layout-grid', 'menu', 'panel-left', 'panel-left-close', 'panel-left-open',
  'search', 'bell', 'log-out', 'circle-user', 'ellipsis', 'ellipsis-vertical',
  'chevron-down', 'chevron-up', 'chevron-left', 'chevron-right', 'arrow-left',
  // modules (sidebar)
  'users', 'user', 'user-round', 'user-plus', 'briefcase', 'anchor', 'ship', 'trending-up', 'award',
  'clipboard-check', 'gavel', 'door-open', 'graduation-cap',
  // record tabs
  'id-card', 'heart', 'baby', 'book-open', 'languages',
  // actions
  'plus', 'pencil', 'trash-2', 'eye', 'copy', 'printer', 'download', 'upload', 'file-up', 'refresh-cw',
  'funnel', 'sliders-horizontal', 'x', 'check',
  // files and documents
  'file-text', 'file-spreadsheet', 'folder-open', 'image', 'paperclip', 'list',
  // status and feedback
  'info', 'circle-alert', 'circle-check', 'triangle-alert', 'lock', 'shield-check', 'loader-circle', 'calendar',
  // administration and the session lock
  'database', 'chart-column', 'shield-user', 'key-round', 'history', 'eye-off', 'lock-keyhole', 'lock-keyhole-open', 'rotate-ccw',
];

const SRC = path.join(__dirname, '..', 'node_modules', 'lucide-static', 'icons');
const OUT = path.join(__dirname, '..', 'public', 'assets', 'icons.svg');
const version = require('lucide-static/package.json').version;

const symbols = ICONS.map((name) => {
  const file = path.join(SRC, `${name}.svg`);
  if (!fs.existsSync(file)) throw new Error(`No Lucide icon named "${name}" (lucide-static ${version})`);
  const svg = fs.readFileSync(file, 'utf8');
  const inner = svg.slice(svg.indexOf('>', svg.indexOf('<svg')) + 1, svg.lastIndexOf('</svg>'))
    .split('\n').map((l) => l.trim()).filter(Boolean).join('');
  // Lucide draws with strokes; the group carries its stroke settings so the sprite needs no CSS.
  return `<symbol id="${name}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g></symbol>`;
});

const sprite = [
  `<!-- Lucide icons v${version}, ISC License, Copyright (c) Lucide Icons and Contributors. Built by scripts/build-icons.js: do not edit. -->`,
  '<svg xmlns="http://www.w3.org/2000/svg">',
  ...symbols,
  '</svg>',
  '',
].join('\n');

fs.writeFileSync(OUT, sprite);
console.log(`Wrote ${path.relative(process.cwd(), OUT)}: ${ICONS.length} icons from lucide-static ${version}`);
