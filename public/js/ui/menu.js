/*
 * menu: a short list of actions that pops over its button (Export, the account menu).
 *
 *   attachMenu(trigger, items, { align, placement, title })
 *     items      [{ label, icon, onSelect, href, tone: 'danger' }, { divider: true }, ...]
 *                or a function returning them (built each time it opens)
 *     align      'start' | 'end' (default): which edge lines up with the button
 *     placement  'bottom' (default) | 'top' (the rail's account menu); flips when there is no room
 *     title      the phone sheet's title (default: the button's text or aria-label)
 *     subtitle   a line under the sheet's title (the account sheet's "HICO001 · Administrator")
 *     width      the popover's width class (default 'w-44'; the account menu uses 'w-56')
 *     variant    'account' gives the account menu its roomier look: grouped rows with dividers, muted icons, no red;
 *                other menus keep the default look
 *   openMenu(trigger, items, options)   opens one now; returns { close }
 *
 * Desktop: a popover beside the button; arrow keys move through it, Esc and a
 * click outside close it. Phones: a bottom sheet of full-width buttons instead.
 */
import { cx, h } from './html.js';
import { icon } from '../core/icons.js';
import { isPhone } from './media.js';
import { openDialog } from './dialog.js';
import { buttonClass } from './button.js';

let current = null;

function closeCurrent() {
  if (current) current.close();
}

function itemNode(item, onDone, sheet, account) {
  if (item.divider) return h('div', { className: account ? 'mx-1 my-1.5 h-px bg-border' : 'my-1 h-px bg-border', role: 'separator' });
  const cls = account
    ? cx(
      'flex w-full items-center gap-3 text-left text-sm font-normal text-foreground outline-none transition-colors hover:bg-subtle focus-visible:bg-subtle',
      sheet ? 'min-h-tap rounded-ctl px-3 py-3 text-base' : 'rounded-ctl px-3 py-2.5'
    )
    : sheet
    ? cx(buttonClass('outline').replace('justify-center', 'justify-start'), 'w-full', item.tone === 'danger' && 'text-destructive')
    : cx('flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm outline-none transition-colors focus-visible:bg-subtle', item.tone === 'danger' ? 'text-destructive hover:bg-error-soft' : 'hover:bg-subtle');
  const children = [item.icon ? icon(item.icon, account ? 'icon flex-none text-muted-foreground' : undefined) : null, item.label];
  const run = (e) => {
    onDone();
    if (typeof item.onSelect === 'function') item.onSelect(e);
  };
  if (item.href) return h('a', { href: item.href, role: 'menuitem', className: cls, onClick: run }, children);
  return h('button', { type: 'button', role: 'menuitem', className: cls, disabled: item.disabled, onClick: run }, children);
}

export function openMenu(trigger, items, { align = 'end', placement = 'bottom', title, subtitle, width = 'w-44', variant } = {}) {
  const account = variant === 'account';
  closeCurrent();
  const list = typeof items === 'function' ? items() : items;

  if (isPhone()) {
    const dlg = openDialog({
      title: title || trigger.getAttribute('aria-label') || trigger.textContent.trim() || 'Menu',
      size: 'sm',
      body: [
        subtitle ? h('div', { className: 'mb-3 text-sm text-muted-foreground', text: subtitle }) : null,
        account
          ? h('div', { className: 'flex flex-col', role: 'menu' }, list.map((it) => itemNode(it, () => dlg.close(), true, true)))
          : h('div', { className: 'flex flex-col gap-2', role: 'menu' }, list.filter((it) => !it.divider).map((it) => itemNode(it, () => dlg.close(), true))),
      ],
    });
    return { close: () => dlg.close() };
  }

  const pop = h('div', {
    role: 'menu',
    className: cx('fixed z-[55] rounded-card border border-border/70 bg-popover text-sm text-popover-foreground shadow-pop', account ? 'p-1.5' : 'p-1', width),
  });
  const close = () => {
    if (!pop.isConnected) return;
    pop.remove();
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', keys, true);
    window.removeEventListener('resize', close);
    window.removeEventListener('scroll', onScroll, true);
    if (current && current.pop === pop) current = null;
  };
  list.forEach((it) => pop.appendChild(itemNode(it, close, false, account)));
  document.body.appendChild(pop);

  // place it beside the trigger, flipping when it would leave the window
  const r = trigger.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  let top = placement === 'top' ? r.top - ph - 6 : r.bottom + 6;
  if (placement !== 'top' && top + ph > window.innerHeight - 8 && r.top - ph - 6 > 8) top = r.top - ph - 6;
  if (placement === 'top' && top < 8) top = r.bottom + 6;
  let left = align === 'start' ? r.left : r.right - pw;
  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  pop.style.top = `${Math.max(8, top)}px`;
  pop.style.left = `${left}px`;
  trigger.setAttribute('aria-expanded', 'true');

  const focusables = () => Array.from(pop.querySelectorAll('[role="menuitem"]:not([disabled])'));
  function outside(e) {
    if (!pop.contains(e.target) && !trigger.contains(e.target)) close();
  }
  function keys(e) {
    const f = focusables();
    const i = f.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); trigger.focus(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); (f[i + 1] || f[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (f[i - 1] || f[f.length - 1]).focus(); }
    else if (e.key === 'Tab') close();
  }
  function onScroll(e) {
    if (!pop.contains(e.target)) close();
  }
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('keydown', keys, true);
  window.addEventListener('resize', close);
  window.addEventListener('scroll', onScroll, true);
  setTimeout(() => { const f = focusables(); if (f[0]) f[0].focus(); }, 0);

  current = { pop, close };
  return current;
}

export function attachMenu(trigger, items, options = {}) {
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    if (current && trigger.getAttribute('aria-expanded') === 'true') { closeCurrent(); return; }
    openMenu(trigger, items, options);
  });
  return trigger;
}

export const closeMenus = closeCurrent;
