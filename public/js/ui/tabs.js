/*
 * in-page tabs: switches between parts of one page (the rating record's ten
 * tabs). Not for moving between pages: the shell draws the module's tabs.
 *
 *   const t = inPageTabs({ tabs, active, onChange, pills })
 *     tabs     [{ key, label, count }]   count shows as a small number after the label (hidden when 0 or empty)
 *     active   the key shown first (default: the first tab)
 *     onChange(key)
 *   t.el  t.setActive(key)  t.setCount(key, n)  t.active()
 *
 * Arrow keys move between tabs. The row scrolls sideways with no scrollbar showing
 * (a mouse wheel moves it too). Phones: rounded chips.
 */
import { cx, h } from './html.js';
import { scrollRow } from './scroll-row.js';

const ON = 'text-brand desk:after:absolute desk:after:inset-x-3 desk:after:bottom-0 desk:after:h-0.5 desk:after:rounded-full desk:after:bg-brand phone:border-brand phone:bg-brand phone:text-brand-foreground';
const OFF = 'text-muted-foreground hover:text-foreground phone:border-border phone:bg-background phone:text-foreground';
const BASE = 'inline-flex flex-none items-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 desk:relative desk:px-2.5 desk:py-2.5 phone:h-9 phone:rounded-full phone:border phone:px-3.5';

const PILL_ON = 'border-brand bg-brand text-brand-foreground';
const PILL_OFF = 'border-border bg-background text-foreground hover:border-ring/40';
const PILL_BASE = 'inline-flex h-9 flex-none items-center whitespace-nowrap rounded-full border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15';

export function inPageTabs({ tabs = [], active, onChange = () => {}, pills = false } = {}) {
  let current = active || (tabs[0] && tabs[0].key);
  const buttons = new Map();
  const counts = new Map();

  const el = scrollRow(h('div', { role: 'tablist', className: pills ? 'mb-4 flex gap-2 overflow-x-auto' : 'mb-4 flex gap-1 overflow-x-auto border-b border-border phone:gap-2 phone:border-0' }));
  tabs.forEach((t) => {
    const count = h('span', { className: 'ml-1.5 hidden rounded-full bg-muted px-1.5 text-2xs font-semibold text-muted-foreground' });
    const b = h('button', { type: 'button', role: 'tab', dataset: { tab: t.key } }, [t.label, count]);
    b.addEventListener('click', () => select(t.key, true));
    b.addEventListener('keydown', (e) => {
      const keys = tabs.map((x) => x.key);
      const i = keys.indexOf(t.key);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = keys[(i + (e.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length];
        select(next, true);
        buttons.get(next).focus();
      }
    });
    buttons.set(t.key, b);
    counts.set(t.key, count);
    el.appendChild(b);
    setCount(t.key, t.count);
  });

  function paint() {
    buttons.forEach((b, key) => {
      const on = key === current;
      b.className = pills ? cx(PILL_BASE, on ? PILL_ON : PILL_OFF) : cx(BASE, on ? ON : OFF);
      if (pills) counts.get(b.dataset.tab).className = cx('ml-1.5 rounded-full px-1.5 text-2xs font-semibold', on ? 'bg-brand-foreground/20 text-brand-foreground' : 'bg-muted text-muted-foreground', counts.get(b.dataset.tab).classList.contains('hidden') && 'hidden');
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      if (on) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  function select(key, fire) {
    if (!buttons.has(key)) return;
    const changed = key !== current;
    current = key;
    paint();
    if (fire && changed) onChange(key);
  }

  function setCount(key, n) {
    const c = counts.get(key);
    if (!c) return;
    const has = n !== undefined && n !== null && n !== '' && Number(n) !== 0;
    c.textContent = has ? String(n) : '';
    c.classList.toggle('hidden', !has);
  }

  // scrollIntoView before the strip is on the page does nothing, so paint after it lands too
  paint();
  requestAnimationFrame(paint);

  return { el, setActive: (key) => select(key, false), setCount, active: () => current };
}
