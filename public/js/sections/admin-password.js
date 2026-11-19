/*
 * admin-password (admin.password): Manage Password. An administrator finds an account by official
 * number or user name and resets its password: a random one-time password is made and shown once, the
 * person's sessions end now, and they must choose a new password at next sign-in. (The old e-mailed-code
 * reset that anyone could start is not rebuilt: a person who forgets their password asks an administrator.)
 *
 *   mountAdminPassword(outlet, { info })      (the page's `view` in core/nav.js)
 *
 * Needs admin.password view to open and edit to reset. Nobody resets their own password here: that is
 * Change Password in the account menu.
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { icon } from '../core/icons.js';
import { getUser } from '../shell/session.js';
import { h } from '../ui/html.js';
import { pageHeader } from '../ui/page-header.js';
import { card } from '../ui/card.js';
import { button } from '../ui/button.js';
import { facts } from '../ui/facts.js';
import { field, setFieldErrors, clearFieldErrors } from '../ui/field.js';
import { ratingSearch } from '../ui/rating-search.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';
import { accountHead, showOneTimePassword, stamp } from './admin-common.js';

export function mountAdminPassword(outlet, { info } = {}) {
  const canReset = can('admin.password', 'edit');
  const me = getUser() || {};

  // Every account belongs to a rating and its user name is the rating's official number: pick a rating that has an account
  const input = ratingSearch({ name: 'q', account: 'with', ariaLabel: 'Official Number or Name', placeholder: 'Official number or name' });
  const form = h('form', { className: 'grid gap-4', novalidate: true, autocomplete: 'off' }, [
    field({ label: 'Rating', control: input, hint: 'Only ratings that have an account are listed.' }),
  ]);
  const result = h('div', { className: 'mt-5 border-t border-border/70 pt-5', dataset: { result: '' }, 'aria-live': 'polite' });
  result.hidden = true;

  const notice = h('div', { className: 'space-y-3 text-sm' }, [
    h('p', { className: 'text-muted-foreground', text: 'Use this when someone cannot sign in because they forgot their password.' }),
    h('ul', { className: 'space-y-2.5' }, [
      'A one-time password is made and shown to you once. It is kept nowhere.',
      'The person’s sessions end now.',
      'At their next sign-in they choose their own password before anything else opens.',
    ].map((t) => h('li', { className: 'flex items-start gap-2.5' }, [
      h('span', { className: 'mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-success-soft text-success' }, icon('check', 'icon h-3 w-3')),
      t,
    ]))),
  ]);

  outlet.replaceChildren(
    pageHeader({ title: info ? info.title : 'Manage Password', subtitle: info ? info.subtitle : '' }),
    h('div', { className: 'grid grid-cols-5 gap-4 phone:grid-cols-1' }, [
      card({ className: 'col-span-3 phone:col-span-1', body: [form, result] }),
      card({ title: 'How a Reset Works', className: 'col-span-2 self-start phone:col-span-1', body: notice }),
    ])
  );

  form.addEventListener('submit', (e) => e.preventDefault());
  input.addEventListener('change', async () => {
    clearFieldErrors(form);
    result.hidden = true;
    if (!input.value) return;
    const wanted = input.value;
    try {
      const res = await api.get(`/api/users/lookup?q=${encodeURIComponent(wanted)}`);
      if (input.value === wanted) showAccount(res.data);
    } catch (err) {
      if (input.value !== wanted) return;
      if (err.fields) setFieldErrors(form, err.fields);
      else setFieldErrors(form, { q: err.message || 'Could not find the account.' });
    }
  });

  function showAccount(u) {
    const isSelf = u.id === me.id;
    let why = null;
    if (!canReset) why = 'You may look accounts up but not reset passwords.';
    else if (isSelf) why = 'This is your own account. Use Change Password in the account menu.';
    else if (!u.isActive) why = 'This account is deactivated. Reactivate it in Manage Users before resetting its password.';
    const resetBtn = button({ label: 'Reset Password', icon: 'key-round', variant: 'primary', disabled: !!why, onClick: () => reset(u) });
    result.replaceChildren(...[
      accountHead(u),
      h('div', { className: 'mt-4' }, facts([
        ['Official Number', u.serviceNumber || 'None'],
        ['Role', u.role],
        ['Last Sign In', stamp(u.lastLoginAt)],
        ['Password', u.mustChangePassword ? 'Must be chosen at next sign-in' : 'Chosen by the person'],
      ])),
      why ? h('p', { className: 'mt-4 rounded-card bg-info-soft px-4 py-3 text-sm text-info', role: 'note', text: why }) : null,
      h('div', { className: 'mt-4 flex justify-end' }, resetBtn),
    ].filter(Boolean));
    result.hidden = false;
  }

  async function reset(u) {
    const ok = await confirmDialog({
      title: 'Reset Password',
      message: `Reset the password of ${u.fullName} (${u.username})? A one-time password is made, their sessions end now, and they choose a new password at next sign-in.`,
      confirmLabel: 'Reset Password',
      icon: 'key-round',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await api.post(`/api/users/${u.id}/reset-password`);
      showAccount(res.data.user);
      await showOneTimePassword({ title: 'Password Reset', username: u.username, password: res.data.oneTimePassword });
    } catch (err) {
      toast(err.message || 'Could not reset the password.', 'error');
    }
  }
}
