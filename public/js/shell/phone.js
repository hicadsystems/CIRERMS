/*
 * phone chrome (760 px and below): the header (crest, or a back arrow on a
 * record; the title; search; account), the bottom bar (Home, Ratings,
 * Documents, My Details, More), the More sheet of every module as tiles, and
 * the New Rating button bottom right on the ratings lists.
 *
 *   renderPhone(info)   openMore()
 *   setPhoneTitle(text)   a record page names its rating once it has loaded
 */
import { AREAS, BOTTOM, PAGES, bottomKeyFor, matchPattern } from '../core/nav.js';
import { can, pageAllowed, moduleVisible, moduleHref } from '../core/access.js';
import { icon } from '../core/icons.js';
import { openSearch } from '../core/search.js';
import { cx, h } from '../ui/html.js';
import { openDialog } from '../ui/dialog.js';
import { attachMenu } from '../ui/menu.js';
import { pillClass } from '../ui/pill.js';
import { photoAvatar } from '../ui/avatar.js';
import { accountItems, getUser, roleLabel } from './session.js';

const COLS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5' };
const ROUND = 'inline-flex h-tap w-tap flex-none items-center justify-center rounded-full hover:bg-sidebar-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-foreground/60';

export function openMore() {
  return openDialog({
    title: 'More',
    // only the modules the person may open (core/access.js)
    body: AREAS.filter((a) => a.modules.some(moduleVisible)).map((a) => h('div', { className: 'mb-4' }, [
      h('div', { className: 'mb-2 text-2xs font-semibold uppercase tracking-widest text-muted-foreground', text: a.label }),
      h('div', { className: 'grid grid-cols-4 gap-2' }, a.modules.filter(moduleVisible).map((m) => h('a', {
        href: `#${moduleHref(m)}`,
        className: 'relative flex flex-col items-center gap-1.5 rounded-card p-2 text-center text-2xs font-medium hover:bg-muted',
        'aria-label': m.soon ? `${m.label} (Soon)` : m.label,
      }, [
        h('span', { className: cx('flex h-12 w-12 items-center justify-center rounded-2xl', m.soon ? 'bg-muted text-muted-foreground' : 'bg-gradient-to-br from-brand-fill to-brand-deep text-on-fill shadow-md shadow-brand-fill/30') }, icon(m.icon, 'icon h-6 w-6')),
        m.short,
        m.soon ? h('span', { className: cx(pillClass('neutral'), 'absolute right-0 top-0'), text: 'Soon' }) : null,
      ]))),
    ])),
  });
}

function renderHeader(info) {
  const header = document.getElementById('phone-header');
  if (!header) return;
  const user = getUser() || {};
  const lead = info && info.back
    ? h('a', { href: `#${info.back}`, className: ROUND, 'aria-label': 'Back' }, icon('arrow-left', 'icon h-5 w-5'))
    : h('span', { className: 'ml-1.5 flex h-9 w-9 flex-none items-center justify-center rounded-full bg-background p-0.5 ring-2 ring-sidebar-foreground/30' }, h('img', { src: '/assets/navy-logo.png', alt: '', className: 'h-8 w-8 object-contain' }));
  const search = h('button', { type: 'button', className: ROUND, 'aria-label': 'Search', onClick: () => openSearch() }, icon('search', 'icon h-5 w-5'));
  const account = h('button', { type: 'button', className: ROUND, 'aria-label': 'Account' },
    photoAvatar(user.fullName || user.username || '', user.passportPhotoUrl, 'xs', user.initials || undefined, 'bg-sidebar-accent text-sidebar-accent-foreground shadow-none ring-0'));
  attachMenu(account, accountItems, { title: user.fullName || user.username || 'Account', subtitle: `${user.username || ''} · ${roleLabel(user)}` });
  header.replaceChildren(
    lead,
    h('span', { id: 'phone-title', className: 'min-w-0 flex-1 truncate px-1 text-base font-semibold', text: info ? info.short : 'CIRERMS' }),
    search,
    account
  );
}

function renderBottom(info) {
  const bar = document.getElementById('bottom-bar');
  if (!bar) return;
  const cur = bottomKeyFor(info);
  // only the items whose page the person may open; More always
  const items = BOTTOM.filter((b) => !b.href || pageAllowed(PAGES.find((p) => matchPattern(p.pattern, b.href))));
  bar.className = cx('grid flex-none border-t border-border/60 bg-background/80 px-1 pb-[env(safe-area-inset-bottom)] shadow-pop backdrop-blur-xl desk:hidden', COLS[items.length] || 'grid-cols-5');
  bar.replaceChildren(...items.map((b) => {
    const on = b.key === cur;
    const cls = cx('flex h-16 flex-col items-center justify-center gap-1 text-2xs focus-visible:outline-none', on ? 'font-semibold text-brand' : 'text-muted-foreground');
    const inner = [
      h('span', { className: cx('flex h-7 w-14 items-center justify-center rounded-full transition-colors', on && 'bg-brand/10') }, icon(b.icon, 'icon h-[22px] w-[22px]')),
      h('span', { text: b.label }),
    ];
    return b.href
      ? h('a', { href: `#${b.href}`, className: cls, 'aria-current': on ? 'page' : undefined }, inner)
      : h('button', { type: 'button', className: cls, 'aria-haspopup': 'dialog', onClick: openMore }, inner);
  }));

  const fab = document.getElementById('fab');
  if (fab) {
    const show = info && can('ratings.new', 'add') && ['ratings/current', 'ratings/former', 'ratings/new'].includes(info.path);
    fab.classList.toggle('hidden', !show);
    fab.classList.toggle('flex', !!show);
  }
}

export function setPhoneTitle(text) {
  const t = document.getElementById('phone-title');
  if (t) t.textContent = text;
}

export function renderPhone(info) {
  renderHeader(info);
  renderBottom(info);
}
