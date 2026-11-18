/*
 * theme: light or dark. js/core/theme-boot.js picks the first one before the page draws
 * (the person's last choice, else the device's setting); this switches it and keeps it.
 *
 *   currentTheme()        'light' | 'dark'
 *   setTheme(theme)       applies it and remembers it in this browser
 *   toggleTheme()         the other one
 *   onThemeChange(fn)     fn(theme) after every change; returns an unsubscribe function
 *   bindThemeButton(btn)  makes btn the light / dark switch (the app's top bar, the sign-in page)
 *
 * Until the person chooses, the app follows the device when its setting changes. A choice
 * made in one tab reaches the others.
 */
const KEY = 'cirerms-theme';
const listeners = new Set();
const device = window.matchMedia('(prefers-color-scheme: dark)');

function stored() {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' ? v : null;
  } catch (_) {
    return null;
  }
}

function apply(theme) {
  if (theme === currentTheme()) return;
  document.documentElement.setAttribute('data-theme', theme);
  listeners.forEach((fn) => fn(theme));
}

export function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  try {
    window.localStorage.setItem(KEY, t);
  } catch (_) {
    // storage off: the choice lasts for this page only
  }
  apply(t);
}

export function toggleTheme() {
  setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}

export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// A switch shows and says the mode it switches to: a moon in light mode, a sun in dark.
// It needs an <svg><use></svg> inside for the icon.
export function bindThemeButton(button) {
  if (!button) return;
  const sync = () => {
    const dark = currentTheme() === 'dark';
    button.setAttribute('aria-label', dark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    button.querySelector('use')?.setAttribute('href', `/assets/icons.svg#${dark ? 'sun' : 'moon'}`);
  };
  button.addEventListener('click', () => toggleTheme());
  onThemeChange(sync);
  sync();
}

device.addEventListener('change', (e) => {
  if (!stored()) apply(e.matches ? 'dark' : 'light');
});

window.addEventListener('storage', (e) => {
  if (e.key === KEY && (e.newValue === 'dark' || e.newValue === 'light')) apply(e.newValue);
});
