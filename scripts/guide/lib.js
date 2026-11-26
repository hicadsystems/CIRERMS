'use strict';

/*
 * What the picture script (shoot.js) and the checks share: the chapters (read by the same parser the server uses),
 * the two hashes that say whether a picture still shows its screen, and a smaller PNG.
 *
 *   spec     the picture's own spec (open, as, device, do, marks, crop, sources), as written
 *   source   the screen's code when it was taken: the section file its address opens in public/js/sections, the
 *            files it imports from public/js/sections and public/js/shell, and every path the spec lists under `sources`
 *
 * A picture whose hashes differ from the ones in its chapter's shots.json is stale: `npm run guide:shots -- --stale`
 * retakes it.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const store = require('../../src/modules/guide/guide.store');
const nav = require('../../src/modules/guide/guide.nav');

const ROOT = path.resolve(__dirname, '..', '..');
const IMG = store.imgDir;
const THEMES = ['light', 'dark'];

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);

/** The files a spec's screen is made of, repo-relative and sorted. */
function sourcesOf(spec) {
  const out = new Set();
  const walk = (rel) => {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) { out.add(`${rel} (missing)`); return; }
    if (fs.statSync(full).isDirectory()) { fs.readdirSync(full).sort().forEach((e) => walk(`${rel}/${e}`)); return; }
    if (out.has(rel)) return;
    out.add(rel);
    if (!/^public\/js\/(sections|shell)\//.test(rel)) return;
    // follow the file's own imports inside the sections and the shell, so a part the screen is built from counts
    for (const m of fs.readFileSync(full, 'utf8').matchAll(/from '(\.[^']+\.js)'/g)) {
      const next = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]));
      if (/^public\/js\/(sections|shell)\//.test(next)) walk(next);
    }
  };
  if (spec.open && spec.open.startsWith('#')) {
    const page = nav.pageFor(spec.open);
    if (page && page.view) walk(`public/js/sections/${page.view.file}`);
  }
  (spec.sources || []).forEach((s) => walk(s.replace(/\/$/, '')));
  return [...out].sort();
}

function hashesOf(spec) {
  const { line: _line, ...own } = spec;
  const source = crypto.createHash('sha256');
  sourcesOf(spec).forEach((f) => {
    source.update(f);
    if (!f.endsWith('(missing)')) source.update(fs.readFileSync(path.join(ROOT, f)));
  });
  return { spec: sha(JSON.stringify(own)), source: source.digest('hex').slice(0, 16) };
}

const shotsFile = (chapter) => path.join(IMG, chapter, 'shots.json');
const readShots = (chapter) => (fs.existsSync(shotsFile(chapter)) ? JSON.parse(fs.readFileSync(shotsFile(chapter), 'utf8')) : {});
function writeShots(chapter, shots) {
  fs.mkdirSync(path.dirname(shotsFile(chapter)), { recursive: true });
  const sorted = Object.fromEntries(Object.entries(shots).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(shotsFile(chapter), `${JSON.stringify(sorted, null, 2)}\n`);
}

/** The files a picture is saved as. */
const filesOf = (chapter, id, devices) => devices.flatMap((d) => THEMES.map((t) => path.join(IMG, chapter, `${id}.${d}.${t}.png`)));

/** A picture is stale when its spec or its screen changed since it was taken, or a file is missing. */
function isStale(chapter, spec) {
  const was = readShots(chapter)[spec.id];
  const now = hashesOf(spec);
  return !was || was.spec !== now.spec || was.source !== now.source || !filesOf(chapter, spec.id, spec.devices).every((f) => fs.existsSync(f));
}

/* ---------- a smaller PNG: the same pixels, compressed as hard as zlib can ---------- */

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
const crc32 = (buf) => { let c = -1; for (let i = 0; i < buf.length; i += 1) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** Undoes a PNG row filter in place: `row` is the filtered bytes of one scanline, `prev` the finished row above (or zeros). */
function unfilter(type, row, prev, bpp) {
  const n = row.length;
  if (type === 1) for (let i = bpp; i < n; i += 1) row[i] = (row[i] + row[i - bpp]) & 255;
  else if (type === 2) for (let i = 0; i < n; i += 1) row[i] = (row[i] + prev[i]) & 255;
  else if (type === 3) for (let i = 0; i < n; i += 1) row[i] = (row[i] + (((i >= bpp ? row[i - bpp] : 0) + prev[i]) >> 1)) & 255;
  else if (type === 4) {
    for (let i = 0; i < n; i += 1) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      row[i] = (row[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
    }
  }
}

/** Filters one scanline with `type` (1 Sub, 2 Up, 3 Average, 4 Paeth) into out[at..]; returns the sum of the filtered bytes read as signed (a guess at how well it will compress). */
function filterRow(type, row, prev, bpp, out, at) {
  let sum = 0;
  const n = row.length;
  out[at] = type;
  for (let i = 0; i < n; i += 1) {
    const a = i >= bpp ? row[i - bpp] : 0;
    let guess;
    if (type === 1) guess = a;
    else if (type === 2) guess = prev[i];
    else if (type === 3) guess = (a + prev[i]) >> 1;
    else {
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      guess = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    }
    const v = (row[i] - guess) & 255;
    out[at + 1 + i] = v;
    sum += v < 128 ? v : 256 - v;
  }
  return sum;
}

/**
 * The same picture in fewer bytes: the pixels are read back, every row is filtered the way that suits it best (Sub, Up, Average
 * or Paeth, picked by how small its bytes come out; the screenshot arrives with no filter at all) and compressed at a high
 * zlib level, and every chunk the picture does not need is dropped. Lossless: not one pixel changes. Returns the smaller of
 * the two files, and the file itself when it is not a plain 8-bit picture.
 */
function shrinkPng(png) {
  if (png.toString('latin1', 1, 4) !== 'PNG') return png;
  const keep = [];
  const idat = [];
  let header = null;
  for (let at = 8; at < png.length;) {
    const len = png.readUInt32BE(at);
    const type = png.toString('latin1', at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + len);
    if (type === 'IDAT') idat.push(data);
    else if (type === 'IHDR') { header = data; keep.push(chunk(type, data)); } else if (type === 'PLTE' || type === 'tRNS') keep.push(chunk(type, data));
    at += 12 + len;
  }
  if (!header) return png;
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const depth = header[8];
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[header[9]];
  if (depth !== 8 || !channels || header[12] !== 0) return png; // 8-bit, not interlaced
  const bpp = channels;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  // the picture's pixels with no filter at all, and filtered row by row: screenshots are often smallest with none (long flat
  // runs and repeated rows), a gradient or a photo with a filter, so both are tried (quickly) and the smaller is packed hard
  const plain = Buffer.alloc(height * (stride + 1));
  const adaptive = Buffer.alloc(height * (stride + 1));
  let prev = Buffer.alloc(stride);
  const tries = [1, 2, 3, 4].map(() => Buffer.alloc(stride + 1));
  for (let y = 0; y < height; y += 1) {
    const start = y * (stride + 1);
    const row = Buffer.from(raw.subarray(start + 1, start + 1 + stride));
    unfilter(raw[start], row, prev, bpp);
    row.copy(plain, start + 1);
    let best = 0;
    let bestSum = Infinity;
    [1, 2, 3, 4].forEach((type, k) => {
      const sum = filterRow(type, row, prev, bpp, tries[k], 0);
      if (sum < bestSum) { bestSum = sum; best = k; }
    });
    tries[best].copy(adaptive, start);
    prev = row;
  }
  const quick = (data) => zlib.deflateSync(data, { level: 4 }).length;
  const out = quick(plain) <= quick(adaptive) ? plain : adaptive;
  const packed = zlib.deflateSync(out, { level: 9, memLevel: 9 });
  const result = Buffer.concat([png.subarray(0, 8), ...keep, chunk('IDAT', packed), chunk('IEND', Buffer.alloc(0))]);
  return result.length < png.length ? result : png;
}

module.exports = { ROOT, IMG, THEMES, store, hashesOf, sourcesOf, readShots, writeShots, filesOf, isStale, shrinkPng };
