/*
 * scroll row: a row that scrolls sideways without showing a scrollbar (tab strips,
 * chip rows). A finger or a trackpad swipes it; scrollRow also turns a mouse wheel
 * into sideways scrolling while the row can still move, then lets the page scroll.
 * Tables keep their scrollbar: this is for rows of tabs and chips only.
 *
 *   scrollRow(h('div', { className: 'flex gap-2 overflow-x-auto' }, chips))
 *
 * On a phone it is the same row: swiped, with no bar under it.
 */
export function scrollRow(el) {
  el.classList.add('scrollbar-none');
  el.addEventListener('wheel', (e) => {
    // pinch-zoom, or a gesture that is already sideways: leave it to the browser
    if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) return;
    const next = Math.max(0, Math.min(max, el.scrollLeft + e.deltaY));
    if (next === el.scrollLeft) return; // at an end: the page scrolls instead
    el.scrollLeft = next;
    e.preventDefault();
  }, { passive: false });
  return el;
}
