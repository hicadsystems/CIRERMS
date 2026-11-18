/*
 * Sets light or dark on <html> before the page draws, so the app never flashes the
 * wrong theme. A choice the person made with the switch wins; until they make one, the
 * device's own setting decides. Loaded as a plain script in <head>, ahead of the CSS;
 * js/core/theme.js does the switching after that.
 */
(function () {
  var stored = null;
  try { stored = window.localStorage.getItem('cirerms-theme'); } catch (e) { /* storage off: follow the device */ }
  var dark = stored === 'dark' || stored === 'light'
    ? stored === 'dark'
    : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
