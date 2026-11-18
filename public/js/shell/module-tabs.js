/*
 * module tabs: the current module's pages under the top bar. A strip of tabs
 * on desktop (the current one scrolled into view), rounded chips on a phone;
 * both scroll sideways with no scrollbar showing (ui/scroll-row.js).
 * Phones hide the chips on a record or form page (its header has a back arrow).
 *
 *   renderModuleTabs(info)
 */
import { cx, h } from '../ui/html.js';
import { scrollRow } from '../ui/scroll-row.js';

export function renderModuleTabs(info) {
  const nav = document.getElementById('module-tabs');
  if (!nav) return;
  const tabs = (info && info.tabs) || [];
  if (!tabs.length) {
    nav.replaceChildren();
    nav.className = 'hidden';
    return;
  }
  const cur = info.tab;
  const desk = scrollRow(h('div', { className: 'flex gap-1 overflow-x-auto border-b border-border/60 bg-background/60 px-4 backdrop-blur-xl phone:hidden' }, tabs.map((t) => {
    const on = t.route === cur;
    return h('a', {
      href: `#${t.route}`,
      'aria-current': on ? 'page' : undefined,
      className: cx('relative whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/15', on ? 'text-brand after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand' : 'text-muted-foreground hover:text-foreground'),
      text: t.label,
    });
  })));
  const phone = info.back ? null : scrollRow(h('div', { className: 'flex gap-2 overflow-x-auto border-b border-border/60 bg-background/70 px-3.5 py-2 backdrop-blur-xl desk:hidden' }, tabs.map((t) => {
    const on = t.route === cur;
    return h('a', {
      href: `#${t.route}`,
      'aria-current': on ? 'page' : undefined,
      className: cx('inline-flex h-9 flex-none items-center rounded-full border px-3.5 text-sm font-medium', on ? 'border-brand bg-brand text-brand-foreground' : 'border-border bg-background text-foreground'),
      text: t.label,
    });
  })));
  nav.className = 'relative z-10 flex-none';
  nav.setAttribute('aria-label', `${info.module.label} pages`);
  nav.replaceChildren(desk, ...(phone ? [phone] : []));
  // a long strip keeps the current tab in view
  nav.querySelectorAll('[aria-current="page"]').forEach((a) => {
    const strip = a.parentElement;
    if (strip.scrollWidth > strip.clientWidth) strip.scrollLeft = a.offsetLeft - (strip.clientWidth - a.offsetWidth) / 2;
  });
}
