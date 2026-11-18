/*
 * search: the one way into the Ctrl K search. The top bar's search button,
 * the phone header's search button and Ctrl K (Cmd K on a Mac) all call
 * openSearch().
 *
 *   openSearch()              opens the search (does nothing until a handler is set)
 *   setSearchHandler(fn)      the search palette registers itself here
 */
let handler = null;

export function setSearchHandler(fn) {
  handler = typeof fn === 'function' ? fn : null;
}

export function openSearch() {
  if (handler) handler();
}
