/*
 * admin-common: the small pieces System Administration's four screens share.
 *
 *   stamp(iso)                   '19/11/2026 14:05' (the browser's time zone), '-' for none
 *   rowTooltip(listEl)           the "View Details" tooltip just below the pointer on a list's rows (desktop)
 *   showOneTimePassword({ title, username, password })
 *                                the dialog that shows a one-time password once, with Copy
 *   accountHead(user)            avatar, name, user name and status pills, for a dialog or a card
 */
import { icon } from '../core/icons.js';
import { formatDisplayDate } from '../core/dates.js';
import { h, cx } from '../ui/html.js';
import { avatar } from '../ui/avatar.js';
import { pill } from '../ui/pill.js';
import { openDialog } from '../ui/dialog.js';
import { button } from '../ui/button.js';
import { toast } from '../ui/toast.js';

const pad = (n) => String(n).padStart(2, '0');

export function stamp(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const dateOnly = (value) => formatDisplayDate(value) || '-';

// ---- the tooltip a row of a list shows (CONVENTIONS, Frontend: wide tables) ----
let tip = null;
function tipEl() {
  if (!tip) {
    tip = h('div', { role: 'tooltip', className: 'pointer-events-none fixed z-[60] hidden whitespace-nowrap rounded-ctl bg-foreground px-2 py-1 text-xs font-medium text-background shadow-pop', text: 'View Details' });
    document.body.appendChild(tip);
  }
  return tip;
}
const hideTip = () => { if (tip) tip.classList.add('hidden'); };

export function rowTooltip(listEl) {
  listEl.addEventListener('pointermove', (e) => {
    const row = e.target.closest && e.target.closest('tbody tr[tabindex]');
    if (!row || e.pointerType === 'touch') { hideTip(); return; }
    const t = tipEl();
    t.classList.remove('hidden');
    const left = Math.max(8, Math.min(e.clientX - 6, window.innerWidth - t.offsetWidth - 8));
    const top = Math.min(e.clientY + 20, window.innerHeight - t.offsetHeight - 8);
    t.style.left = `${left}px`;
    t.style.top = `${top}px`;
  });
  listEl.addEventListener('pointerleave', hideTip);
  listEl.addEventListener('click', hideTip);
  document.addEventListener('keydown', hideTip, true);
}

// ---- a one-time password, shown once ----
export function showOneTimePassword({ title = 'One-Time Password', username, password }) {
  const box = h('div', {
    className: 'select-all break-all rounded-card border border-border bg-subtle px-4 py-3 text-center font-mono text-xl font-semibold tracking-wider',
    dataset: { oneTimePassword: '' },
    text: password,
  });
  const copy = button({
    label: 'Copy',
    icon: 'copy',
    variant: 'outline',
    onClick: async () => {
      try {
        await navigator.clipboard.writeText(password);
        toast('Copied.');
      } catch (_) {
        toast('Select the password and copy it.', 'info');
      }
    },
  });
  const body = h('div', { className: 'space-y-4' }, [
    h('p', { className: 'text-sm', text: `Give this to ${username}. They must choose their own password the first time they sign in.` }),
    box,
    h('div', { className: 'flex items-start gap-2 rounded-card bg-warning-soft px-4 py-3 text-sm text-warning', role: 'note' }, [
      icon('triangle-alert', 'icon mt-0.5 flex-none'),
      h('span', { text: 'This is the only time it is shown. It is not kept anywhere, so if it is lost, reset the password again.' }),
    ]),
    h('div', { className: 'flex justify-center' }, copy),
  ]);
  const dlg = openDialog({ title, size: 'sm', body, dismissible: false, initialFocus: copy });
  dlg.setFooter([button({ label: 'I Have Noted It', icon: 'check', variant: 'primary', onClick: () => dlg.close() })]);
  return dlg.closed;
}

export function statusPill(active) {
  return pill(active ? 'Active' : 'Inactive', active ? 'success' : 'error');
}

export function accountHead(u) {
  return h('div', { className: 'flex items-start gap-3' }, [
    avatar({ name: u.fullName, size: 'lg' }),
    h('div', { className: 'min-w-0' }, [
      h('div', { className: 'break-words text-xl font-semibold leading-tight', text: u.fullName }),
      h('div', { className: 'text-sm text-muted-foreground', text: u.username }),
      h('div', { className: cx('mt-1.5 flex flex-wrap gap-1.5') }, [
        statusPill(u.isActive),
        pill(u.role, u.fullAccess ? 'warning' : 'info'),
        u.mustChangePassword ? pill('Password Change Pending', 'neutral') : null,
      ]),
    ]),
  ]);
}
