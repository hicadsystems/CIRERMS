/*
 * The sign-in page's background (auth.login): a black-to-navy gradient with slow drifting
 * dots that link up when they pass close and reach toward the pointer. Colours come from
 * the --login-* tokens in css/input.css, so nothing here holds a colour of its own.
 *
 * It stays still for people who ask for reduced motion, pauses with the tab (the browser
 * stops animation frames in a hidden tab), and draws sharp on high-density screens.
 */
const canvas = document.getElementById('login-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;

const LINK_DISTANCE = 120;
const POINTER_RADIUS = 150;

// "R G B" token channels to an rgba() colour with the given alpha
const root = getComputedStyle(document.documentElement);
const channels = (name) => root.getPropertyValue(`--login-${name}`).trim().split(/\s+/).join(', ');
const colour = (name, alpha = 1) => `rgba(${channels(name)}, ${alpha})`;

let width = 0;
let height = 0;
let dots = [];
const pointer = { x: null, y: null };
const still = window.matchMedia('(prefers-reduced-motion: reduce)');

function makeDot() {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    size: Math.random() * 3 + 1,
    dx: Math.random() * 0.5 - 0.25,
    dy: Math.random() * 0.5 - 0.25,
    alpha: Math.random() * 0.5 + 0.2,
  };
}

function resize() {
  const ratio = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  // about one dot per 14,000 px², between 40 (a phone) and 110 (a large screen)
  const wanted = Math.max(40, Math.min(110, Math.round((width * height) / 14000)));
  while (dots.length < wanted) dots.push(makeDot());
  dots.length = wanted;
  dots.forEach((d) => { d.x = Math.min(d.x, width); d.y = Math.min(d.y, height); });
}

function draw() {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, colour('from'));
  gradient.addColorStop(0.5, colour('via'));
  gradient.addColorStop(1, colour('to'));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (const d of dots) {
    ctx.fillStyle = colour('dot', d.alpha);
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < dots.length; i += 1) {
    const a = dots[i];
    for (let j = i + 1; j < dots.length; j += 1) {
      const b = dots[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance < LINK_DISTANCE) {
        ctx.strokeStyle = colour('dot', 0.15 * (1 - distance / LINK_DISTANCE));
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    if (pointer.x !== null) {
      const distance = Math.hypot(a.x - pointer.x, a.y - pointer.y);
      if (distance < POINTER_RADIUS) {
        ctx.strokeStyle = colour('dot', 0.3 * (1 - distance / POINTER_RADIUS));
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(pointer.x, pointer.y);
        ctx.stroke();
      }
    }
  }
}

function step() {
  for (const d of dots) {
    d.x += d.dx;
    d.y += d.dy;
    if (d.x > width) d.x = 0;
    if (d.x < 0) d.x = width;
    if (d.y > height) d.y = 0;
    if (d.y < 0) d.y = height;
  }
}

let frame = null;
function loop() {
  step();
  draw();
  frame = window.requestAnimationFrame(loop);
}

function start() {
  if (frame !== null) window.cancelAnimationFrame(frame);
  frame = null;
  if (still.matches) draw();
  else loop();
}

if (ctx) {
  resize();
  start();
  window.addEventListener('resize', () => { resize(); if (still.matches) draw(); });
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.x = null; pointer.y = null; });
  still.addEventListener('change', start);
}
