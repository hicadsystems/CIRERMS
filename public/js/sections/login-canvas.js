/*
 * The sign-in page's background (auth.login): a sea under the sky. In light mode it is
 * day, an ivory sky over pale blue water with a warm sun glow; in dark mode night, a black
 * sky with twinkling stars and a moon glow over deep navy water. Four layers of slow
 * rolling waves, each with a crest line. Every colour is a --login-* token in
 * css/input.css (light in :root, dark under data-theme="dark"), so nothing here holds a
 * colour, and the sea changes with the light / dark switch.
 *
 * It stays still for people who ask for reduced motion, pauses with the tab (the browser
 * stops animation frames in a hidden tab), and draws sharp on high-density screens.
 */
import { onThemeChange } from '../core/theme.js';

const canvas = document.getElementById('login-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

// a token, "R G B" or "R G B / A", as channels and alpha
function token(name) {
  const [rgb, alpha] = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).split('/');
  return { rgb: rgb.trim().split(/\s+/).join(', '), a: alpha === undefined ? 1 : parseFloat(alpha) };
}
// the token's colour, its alpha scaled by k
const rgba = (c, k = 1) => `rgba(${c.rgb}, ${c.a * k})`;

// back to front: where the swell sits (share of the height), how tall it rolls, and how
// strong its crest line is (a share of --login-crest)
const WAVES = [
  { level: 0.70, height: 0.022, length: 0.0042, speed: 0.00018, crest: 0.60 },
  { level: 0.76, height: 0.028, length: 0.0034, speed: -0.00024, crest: 0.73 },
  { level: 0.83, height: 0.034, length: 0.0027, speed: 0.00031, crest: 0.87 },
  { level: 0.90, height: 0.040, length: 0.0021, speed: -0.00038, crest: 1 },
];

// the current theme's colours, read once and again on every switch
let paint = null;
function readPaint() {
  paint = {
    sky: ['login-from', 'login-via', 'login-to'].map(token),
    waves: WAVES.map((_, i) => token(`login-wave-${i + 1}`)),
    crest: token('login-crest'),
    glow: token('login-glow'),
    star: token('login-star'),
  };
}

let width = 0;
let height = 0;
let stars = [];
const still = window.matchMedia('(prefers-reduced-motion: reduce)');

function resize() {
  const ratio = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  // about one star per 9,000 px² of sky, between 50 and 160
  const count = Math.max(50, Math.min(160, Math.round((width * height * 0.68) / 9000)));
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height * 0.68,
    size: Math.random() * 1.2 + 0.3,
    base: Math.random() * 0.45 + 0.15,
    phase: Math.random() * Math.PI * 2,
    rate: Math.random() * 0.0015 + 0.0005,
  }));
}

// a wave's height at x: two sine swells over each other, so it never looks mechanical
function waveY(w, x, t) {
  const base = height * w.level;
  const amp = height * w.height;
  return base
    + Math.sin(x * w.length + t * w.speed) * amp
    + Math.sin(x * w.length * 2.3 - t * w.speed * 1.7 + 1.3) * amp * 0.35;
}

function draw(t) {
  // the sky, from the top down to the sea
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, rgba(paint.sky[0]));
  sky.addColorStop(0.55, rgba(paint.sky[1]));
  sky.addColorStop(1, rgba(paint.sky[2]));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // the sun or the moon: a soft glow, high on the right
  const mx = width * 0.82;
  const my = height * 0.16;
  const glow = ctx.createRadialGradient(mx, my, 0, mx, my, Math.max(width, height) * 0.35);
  glow.addColorStop(0, rgba(paint.glow));
  glow.addColorStop(0.3, rgba(paint.glow, 0.375));
  glow.addColorStop(1, rgba(paint.glow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // stars, at night only (by day their token's alpha is 0)
  if (paint.star.a > 0) {
    for (const s of stars) {
      const twinkle = s.base * (0.6 + 0.4 * Math.sin(s.phase + t * s.rate));
      ctx.fillStyle = rgba(paint.star, twinkle);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const step = 8;
  WAVES.forEach((w, i) => {
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width + step; x += step) ctx.lineTo(x, waveY(w, x, t));
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = rgba(paint.waves[i]);
    ctx.fill();

    ctx.beginPath();
    for (let x = 0; x <= width + step; x += step) {
      const y = waveY(w, x, t);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = rgba(paint.crest, w.crest);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  });
}

let frame = null;
function loop(t) {
  draw(t);
  frame = window.requestAnimationFrame(loop);
}

function start() {
  if (frame !== null) window.cancelAnimationFrame(frame);
  frame = null;
  if (still.matches) draw(0);
  else frame = window.requestAnimationFrame(loop);
}

if (ctx) {
  readPaint();
  resize();
  start();
  window.addEventListener('resize', () => { resize(); if (still.matches) draw(0); });
  still.addEventListener('change', start);
  // day or night: the tokens have changed, so read them again (and redraw a still sea)
  onThemeChange(() => { readPaint(); if (still.matches) draw(0); });
}
