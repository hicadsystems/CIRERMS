/*
 * rail: the desktop sidebar. Crest and name, the areas and their modules (the
 * current one highlighted, Soon badges), and the account menu at its foot.
 * It folds to icons (remembered per browser); folded, each item's name shows
 * in a tooltip just below the pointer. Redrawing keeps its scroll place and
 * brings the current item into view if it is not.
 *
 *   renderRail(info)      draw for a page (info from nav.describe)
 *   isFolded()  setFolded(bool)
 */
import { AREAS } from '../core/nav.js';
import { icon } from '../core/icons.js';
import { cx, h } from '../ui/html.js';
import { attachMenu } from '../ui/menu.js';
import { initialsOf } from '../ui/avatar.js';
import { accountItems, getUser, roleLabel } from './session.js';

const KEY = 'cirerms.rail.folded';
let folded = false;
try { folded = window.localStorage.getItem(KEY) === '1'; } catch (_) { folded = false; }
let lastInfo = null;

export const isFolded = () => folded;

export function setFolded(v) {
  folded = !!v;
  try { window.localStorage.setItem(KEY, folded ? '1' : '0'); } catch (_) { /* private mode: not remembered */ }
  hideTip();
  if (lastInfo) renderRail(lastInfo);
}

// ---- tooltip just below the pointer (folded rail only) ----
let tip = null;
function tipEl() {
  if (!tip) {
    tip = h('div', { role: 'tooltip', className: 'pointer-events-none fixed z-[60] hidden whitespace-nowrap rounded-ctl bg-foreground px-2 py-1 text-xs font-medium text-background shadow-pop' });
    document.body.appendChild(tip);
  }
  return tip;
}
function showTip(text, x, y) {
  const t = tipEl();
  t.textContent = text;
  t.classList.remove('hidden');
  const w = t.offsetWidth;
  const left = Math.max(8, Math.min(x - 6, window.innerWidth - w - 8));
  const top = Math.min(y + 20, window.innerHeight - t.offsetHeight - 8);
  t.style.left = `${left}px`;
  t.style.top = `${top}px`;
}
function hideTip() {
  if (tip) tip.classList.add('hidden');
}

function bindTips(rail) {
  if (rail.dataset.tips) return;
  rail.dataset.tips = '1';
  rail.addEventListener('pointermove', (e) => {
    const item = folded && e.target.closest('[data-tip]');
    if (item) showTip(item.dataset.tip, e.clientX, e.clientY);
    else hideTip();
  });
  rail.addEventListener('pointerleave', hideTip);
  rail.addEventListener('focusin', (e) => {
    const item = folded && e.target.closest('[data-tip]');
    if (!item) return;
    const r = item.getBoundingClientRect();
    showTip(item.dataset.tip, r.left + r.width / 2, r.top + r.height / 2);
  });
  rail.addEventListener('focusout', hideTip);
  rail.addEventListener('click', hideTip);
}

export function renderRail(info) {
  lastInfo = info;
  const rail = document.getElementById('rail');
  if (!rail) return;
  const c = folded;
  const current = info && info.module ? info.module.key : null;
  const before = rail.querySelector('[data-rail-scroll]');
  const kept = before ? before.scrollTop : 0;
  const user = getUser() || {};

  rail.className = cx('flex flex-none flex-col bg-gradient-to-b from-sidebar to-sidebar-deep text-sidebar-foreground transition-all phone:hidden', c ? 'w-rail-collapsed' : 'w-rail');

  const brand = h('a', { href: '#dashboard', className: cx('flex flex-none items-center gap-2.5 pb-3 pt-4', c ? 'justify-center px-0' : 'px-3.5'), 'aria-label': 'CIRERMS Home', dataset: { tip: 'Dashboard' } }, [
    h('span', { className: 'flex h-11 w-11 flex-none items-center justify-center rounded-full bg-background p-0.5 shadow-md ring-2 ring-sidebar-foreground/30' }, h('img', { src: '/assets/navy-logo.png', alt: '', className: 'h-10 w-10 object-contain' })),
    c ? null : h('span', { className: 'min-w-0 leading-tight' }, [
      h('b', { className: 'block text-base font-bold tracking-wide', text: 'CIRERMS' }),
      h('span', { className: 'block text-2xs text-sidebar-muted', text: 'Nigerian Navy Ratings' }),
    ]),
  ]);

  const scroll = h('nav', { 'aria-label': 'Modules', className: 'cirerms-scroll flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-2.5 pb-3', dataset: { railScroll: '' } });
  AREAS.forEach((area) => {
    scroll.appendChild(h('div', { className: cx('text-2xs font-semibold uppercase tracking-widest text-sidebar-muted', c ? 'mx-2 mb-1.5 mt-3 h-px bg-sidebar-border' : 'px-2 pb-1.5 pt-4'), 'aria-hidden': c ? 'true' : undefined, text: c ? '' : area.label }));
    area.modules.forEach((m) => {
      const on = m.key === current;
      const href = `#${m.href || `soon/${m.key}`}`;
      scroll.appendChild(h('a', {
        href,
        'aria-current': on ? 'page' : undefined,
        'aria-label': c ? (m.soon ? `${m.label} (Soon)` : m.label) : undefined,
        dataset: { tip: m.soon ? `${m.label} · Soon` : m.label, module: m.key },
        className: cx(
          'relative flex min-h-10 items-center gap-3 rounded-ctl px-2.5 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-foreground/60',
          c && 'justify-center',
          on ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-md shadow-black/10' : m.soon ? 'text-sidebar-foreground/70 hover:bg-sidebar-hover' : 'text-sidebar-foreground hover:bg-sidebar-hover'
        ),
      }, [
        icon(m.icon, 'icon h-[18px] w-[18px]'),
        c ? null : h('span', { className: 'min-w-0 flex-1 leading-snug', text: m.label }),
        m.soon && !c ? h('span', { className: 'rounded-full bg-sidebar-hover px-2 py-0.5 text-2xs font-semibold text-sidebar-foreground', text: 'Soon' }) : null,
      ]));
    });
  });

  const accountBtn = h('button', {
    type: 'button',
    className: cx('flex w-full items-center gap-2.5 rounded-ctl p-1 text-left hover:bg-sidebar-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-foreground/60', c && 'justify-center'),
    'aria-label': c ? `Account: ${user.username || ''}` : 'Account',
    dataset: { tip: user.fullName || user.username || 'Account' },
  }, [
    h('span', { className: 'flex h-9 w-9 flex-none items-center justify-center rounded-full bg-sidebar-accent text-xs font-bold text-sidebar-accent-foreground', text: initialsOf(user.fullName || user.username || '') }),
    c ? null : h('span', { className: 'min-w-0 flex-1 leading-tight' }, [
      h('b', { className: 'block truncate text-sm font-semibold', text: user.username || '' }),
      h('span', { className: 'block truncate text-2xs text-sidebar-muted', text: roleLabel(user) }),
    ]),
    c ? null : icon('chevron-up', 'icon text-sidebar-muted'),
  ]);
  attachMenu(accountBtn, accountItems, { placement: 'top', align: 'start', width: 'w-56', title: user.fullName || 'Account', subtitle: `${user.username || ''} · ${roleLabel(user)}` });

  rail.replaceChildren(brand, scroll, h('div', { className: 'relative flex-none border-t border-sidebar-border p-2.5' }, accountBtn));
  bindTips(rail);

  // keep the scroll place, then bring the current item into view if it is not
  scroll.scrollTop = kept;
  const cur = scroll.querySelector('[aria-current="page"]');
  if (cur) {
    const b = scroll.getBoundingClientRect();
    const r = cur.getBoundingClientRect();
    if (r.top < b.top) scroll.scrollTop -= b.top - r.top + 12;
    else if (r.bottom > b.bottom) scroll.scrollTop += r.bottom - b.bottom + 12;
  }
}
