/*
 * The sign-in page's background (auth.login): a navy night sea. Faint stars twinkle in a
 * dark sky with a soft moon glow, over four layers of slow rolling waves, the farthest
 * pale and blue, the nearest deep navy, each with a light crest line. Colours come from
 * the --login-* and --on-fill tokens in css/input.css, so nothing here holds a colour.
 *
 * It stays still for people who ask for reduced motion, pauses with the tab (the browser
 * stops animation frames in a hidden tab), and draws sharp on high-density screens.
 */
const canvas = document.getElementById('login-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

// "R G B" token channels to an rgba() colour with the given alpha
const root = getComputedStyle(document.documentElement);
const channels = (name) => root.getPropertyValue(`--${name}`).trim().split(/\s+/).join(', ');
const colour = (name, alpha = 1) => `rgba(${channels(name)}, ${alpha})`;

// back to front: where the swell sits (share of the height), how tall it rolls, its colour
const WAVES = [
  { level: 0.70, height: 0.022, length: 0.0042, speed: 0.00018, fill: ['login-dot', 0.10], crest: 0.18 },
  { level: 0.76, height: 0.028, length: 0.0034, speed: -0.00024, fill: ['login-accent', 0.18], crest: 0.22 },
  { level: 0.83, height: 0.034, length: 0.0027, speed: 0.00031, fill: ['login-to', 0.45], crest: 0.26 },
  { level: 0.90, height: 0.040, length: 0.0021, speed: -0.00038, fill: ['login-deep', 0.92], crest: 0.30 },
];

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
  // the sky, dark at the top to navy at the sea
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, colour('login-from'));
  sky.addColorStop(0.55, colour('login-via'));
  sky.addColorStop(1, colour('login-to'));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // a soft moon glow, high on the right
  const mx = width * 0.82;
  const my = height * 0.16;
  const glow = ctx.createRadialGradient(mx, my, 0, mx, my, Math.max(width, height) * 0.35);
  glow.addColorStop(0, colour('login-dot', 0.16));
  glow.addColorStop(0.3, colour('login-dot', 0.06));
  glow.addColorStop(1, colour('login-dot', 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  for (const s of stars) {
    const twinkle = s.base * (0.6 + 0.4 * Math.sin(s.phase + t * s.rate));
    ctx.fillStyle = colour('on-fill', twinkle);
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
    ctx.fill();
  }

  const step = 8;
  for (const w of WAVES) {
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width + step; x += step) ctx.lineTo(x, waveY(w, x, t));
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = colour(w.fill[0], w.fill[1]);
    ctx.fill();

    ctx.beginPath();
    for (let x = 0; x <= width + step; x += step) {
      const y = waveY(w, x, t);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = colour('login-dot', w.crest);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
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
  resize();
  start();
  window.addEventListener('resize', () => { resize(); if (still.matches) draw(0); });
  still.addEventListener('change', start);
}
