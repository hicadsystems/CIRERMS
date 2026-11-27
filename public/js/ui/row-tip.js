/*
 * row tip: the "View Details" tooltip under the pointer on desktop, for a list whose rows or cards open a record
 * (a table row with tabindex, or anything marked data-view-details). Touch shows nothing.
 *
 *   rowTip(listEl)   returns listEl
 */
import { h } from './html.js';

let tip = null;

export function rowTip(listEl) {
  const tipEl = () => {
    if (!tip) {
      tip = h('div', { role: 'tooltip', className: 'pointer-events-none fixed z-[60] hidden whitespace-nowrap rounded-ctl bg-foreground px-2 py-1 text-xs font-medium text-background shadow-pop' });
      document.body.appendChild(tip);
    }
    return tip;
  };
  const hide = () => { if (tip) tip.classList.add('hidden'); };
  listEl.addEventListener('pointermove', (e) => {
    const target = e.target.closest && e.target.closest('tbody tr[tabindex], [data-view-details]');
    // not over the row's own buttons
    if (!target || e.pointerType === 'touch' || e.target.closest('button')) { hide(); return; }
    const t = tipEl();
    t.textContent = 'View Details';
    t.classList.remove('hidden');
    t.style.left = `${Math.max(8, Math.min(e.clientX - 6, window.innerWidth - t.offsetWidth - 8))}px`;
    t.style.top = `${Math.min(e.clientY + 20, window.innerHeight - t.offsetHeight - 8)}px`;
  });
  listEl.addEventListener('pointerleave', hide);
  listEl.addEventListener('click', hide);
  return listEl;
}
