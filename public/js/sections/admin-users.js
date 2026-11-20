/*
 * admin-users (admin.users): Manage Users. Search and filter the accounts (by role and by active
 * state), 25 a page from the server; a row opens the account in a dialog (a bottom sheet on a phone)
 * with its full details and, with the grants, Edit, Reset Password and Deactivate or Reactivate.
 * Add Account and Edit are a dialog too. A new account gets a random one-time password, shown once.
 * Nothing is deleted: an account is deactivated, which ends its sessions.
 *
 *   mountAdminUsers(outlet, { info })      (the page's `view` in core/nav.js)
 *
 * Buttons show only with the grant: Add and Edit (admin.users), Reset Password (admin.password edit).
 * The server refuses the rest: nobody deactivates or changes the role of their own account, and the
 * last active administrator cannot be deactivated or moved to another role.
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { getUser } from '../shell/session.js';
import { h, cx } from '../ui/html.js';
import { pageHeader } from '../ui/page-header.js';
import { toolbar } from '../ui/toolbar.js';
import { listView } from '../ui/list-view.js';
import { photoAvatar } from '../ui/avatar.js';
import { button } from '../ui/button.js';
import { pill } from '../ui/pill.js';
import { facts } from '../ui/facts.js';
import { field, textInput, selectInput, setFieldErrors, clearFieldErrors } from '../ui/field.js';
import { ratingSearch } from '../ui/rating-search.js';
import { openDialog } from '../ui/dialog.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';
import { accountHead, rowTooltip, showOneTimePassword, stamp, dateOnly, statusPill } from './admin-common.js';

export async function mountAdminUsers(outlet, { info } = {}) {
  const allow = { add: can('admin.users', 'add'), edit: can('admin.users', 'edit'), reset: can('admin.password', 'edit') };
  const me = getUser() || {};
  const meta = (await api.get('/api/users/meta')).data;

  const addBtn = allow.add ? button({ label: 'Add Account', icon: 'user-plus', variant: 'primary', onClick: () => openForm(null) }) : null;
  const header = pageHeader({ title: info ? info.title : 'Manage Users', subtitle: info ? info.subtitle : '', actions: addBtn ? [addBtn] : null });

  const tb = toolbar({
    search: { placeholder: 'Search accounts', name: 'q' },
    filters: [
      { name: 'roleId', label: 'Role', options: meta.roles.map((r) => ({ value: r.id, label: r.name })), placeholder: 'All Roles', width: 'w-52' },
      { name: 'active', label: 'Status', options: [{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }], placeholder: 'All Accounts', width: 'w-44' },
    ],
    noun: ['account', 'accounts'],
    onChange: () => lv.reload({ resetPage: true }),
  });

  const lv = listView({
    columns: [
      { key: 'username', label: 'User Name', className: 'font-semibold text-foreground' },
      { key: 'fullName', label: 'Name' },
      { key: 'role', label: 'Role', render: (u) => pill(u.role, u.fullAccess ? 'warning' : 'info') },
      { key: 'isActive', label: 'Status', render: (u) => statusPill(u.isActive) },
    ],
    load: ({ page }) => {
      const v = tb.values();
      const qs = new URLSearchParams({ page: String(page) });
      if (v.q) qs.set('q', v.q);
      if (v.roleId) qs.set('roleId', v.roleId);
      if (v.active) qs.set('active', v.active);
      return api.get(`/api/users?${qs}`);
    },
    onPick: (u) => openAccount(u),
    card: {
      avatarNode: (u) => photoAvatar(u.fullName, u.passportPhotoUrl, 'md', u.initials || undefined),
      title: (u) => u.fullName,
      subtitle: (u) => `${u.username} · ${u.role}`,
      aside: (u) => statusPill(u.isActive),
    },
    empty: { icon: 'users', title: 'No Accounts Found', text: 'Change the search or the filters.' },
    onLoaded: ({ meta: m }) => tb.setCount(m.total),
  });
  rowTooltip(lv.el);
  outlet.replaceChildren(header, tb.el, lv.el);

  // ---- the account's dialog
  function openAccount(u) {
    const isSelf = u.id === me.id;
    const rows = [
      ['Role', u.role],
      ['Rating', h('a', { href: `#ratings/edit/${encodeURIComponent(u.serviceNumber)}`, className: 'font-medium text-brand underline-offset-2 hover:underline', text: u.serviceNumber })],
      ['Specialisation', u.specialisation || 'None'],
      ['E-mail', u.email],
      ['Phone', u.phone],
      ['Last Sign In', stamp(u.lastLoginAt)],
      ['Password', u.mustChangePassword ? 'Must be chosen at next sign-in' : (u.passwordChangedAt ? `Chosen ${dateOnly(u.passwordChangedAt)}` : 'Chosen by the person')],
      ['Created', dateOnly(u.createdAt)],
    ];
    const body = h('div', { className: 'space-y-4' }, [
      accountHead(u),
      facts(rows),
      isSelf ? h('p', { className: 'rounded-card bg-info-soft px-4 py-3 text-sm text-info', role: 'note', text: 'This is your own account: you cannot deactivate it or change its role.' }) : null,
    ]);
    const dlg = openDialog({ title: 'Account', size: 'md', body });
    const actions = [];
    if (allow.edit && !isSelf) {
      actions.push(u.isActive
        ? button({ label: 'Deactivate', icon: 'lock-keyhole', variant: 'outline', className: 'text-destructive', onClick: () => deactivate(u, dlg) })
        : button({ label: 'Reactivate', icon: 'lock-keyhole-open', variant: 'outline', onClick: () => reactivate(u, dlg) }));
    }
    if (allow.reset && !isSelf && u.isActive) {
      actions.push(button({ label: 'Reset Password', icon: 'key-round', variant: 'blue', onClick: () => reset(u, dlg) }));
    }
    if (allow.edit) actions.push(button({ label: 'Edit', icon: 'pencil', variant: 'primary', onClick: () => { dlg.close(); openForm(u); } }));
    else actions.push(button({ label: 'Close', variant: 'outline', onClick: () => dlg.close() }));
    dlg.setFooter(actions);
  }

  async function deactivate(u, dlg) {
    const ok = await confirmDialog({
      title: 'Deactivate Account',
      message: `Deactivate ${u.fullName} (${u.username})? Their sessions end now and they cannot sign in until the account is reactivated. Nothing is deleted.`,
      confirmLabel: 'Deactivate',
      icon: 'lock-keyhole',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.post(`/api/users/${u.id}/deactivate`);
      dlg.close();
      toast(`${u.username} deactivated.`);
      lv.reload();
    } catch (err) {
      toast(err.message || 'Could not deactivate the account.', 'error');
    }
  }

  async function reactivate(u, dlg) {
    const ok = await confirmDialog({
      title: 'Reactivate Account',
      message: `Reactivate ${u.fullName} (${u.username})? They can sign in again with their current password.`,
      confirmLabel: 'Reactivate',
      icon: 'lock-keyhole-open',
    });
    if (!ok) return;
    try {
      await api.post(`/api/users/${u.id}/reactivate`);
      dlg.close();
      toast(`${u.username} reactivated.`);
      lv.reload();
    } catch (err) {
      toast(err.message || 'Could not reactivate the account.', 'error');
    }
  }

  async function reset(u, dlg) {
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
      dlg.close();
      lv.reload();
      await showOneTimePassword({ title: 'Password Reset', username: u.username, password: res.data.oneTimePassword });
    } catch (err) {
      toast(err.message || 'Could not reset the password.', 'error');
    }
  }

  // ---- Add Account (u null) and Edit
  function openForm(u) {
    const isSelf = !!u && u.id === me.id;
    const spec = meta.specialisations
      .filter((s) => s.active || (u && u.specialisationId === s.id))
      .map((s) => ({ value: s.id, label: s.active ? s.name : `${s.name} (Inactive)` }));
    // Add Account starts by finding the rating the account is for; its official number is the user name
    const rating = ratingSearch({ name: 'serviceNumber', account: 'without', ariaLabel: 'Rating', placeholder: 'Official number or name' });
    const ratingField = u
      ? field({ label: 'Official Number (User Name)', control: h('div', { className: 'rounded-ctl border border-border bg-subtle px-3 py-2 text-sm font-semibold', text: u.serviceNumber }), hint: `The account belongs to this rating (${u.fullName}); it cannot be changed.`, className: 'col-span-2 phone:col-span-1' })
      : field({
        label: 'Rating *',
        className: 'col-span-2 phone:col-span-1',
        control: rating,
        hint: 'Every account belongs to a rating, and its name is the rating’s. Find it by official number or name (ratings that already have an account are not listed); its official number becomes the user name.',
      });
    const form = h('form', { className: 'grid grid-cols-2 gap-4 phone:grid-cols-1', novalidate: true, autocomplete: 'off' }, [
      ratingField,
      field({
        label: 'Role *',
        control: selectInput({ name: 'roleId', options: meta.roles.map((r) => ({ value: r.id, label: r.name })), value: u ? u.roleId : '', disabled: isSelf }),
        hint: isSelf ? 'You cannot change the role of your own account.' : '',
      }),
      field({ label: 'Specialisation', optional: true, control: selectInput({ name: 'specialisationId', options: spec, value: u ? u.specialisationId || '' : '', placeholder: '-- None --' }), hint: 'A drafting officer then sees only this department’s batches and approvals.' }),
      field({ label: 'Phone', optional: true, control: textInput({ name: 'phone', type: 'tel', value: u ? u.phone || '' : '', maxlength: 30 }) }),
      field({ label: 'E-mail', optional: true, control: textInput({ name: 'email', type: 'email', value: u ? u.email || '' : '', maxlength: 150 }) }),
      u ? null : h('div', { className: 'col-span-2 flex items-start gap-2 rounded-card bg-info-soft px-4 py-3 text-sm text-info phone:col-span-1', role: 'note' }, [
        'A one-time password is shown once the account is saved. The person chooses their own at first sign-in.',
      ]),
    ]);
    const dlg = openDialog({ title: u ? 'Edit Account' : 'Add Account', size: 'lg', body: form, initialFocus: u ? undefined : 'input[name="ratingSearch"]' });
    const save = button({ label: u ? 'Save' : 'Add Account', icon: 'check', variant: 'primary', onClick: () => submit() });
    dlg.setFooter([button({ label: 'Cancel', variant: 'outline', onClick: () => dlg.close() }), save]);
    form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });

    const val = (name) => {
      const el = form.querySelector(`[name="${name}"]`);
      return el ? el.value : '';
    };
    async function submit() {
      clearFieldErrors(form);
      const body = {
        roleId: isSelf ? u.roleId : val('roleId'),
        serviceNumber: u ? u.serviceNumber : rating.value,
        specialisationId: val('specialisationId'),
        phone: val('phone'),
        email: val('email'),
      };
      save.disabled = true;
      dlg.setDismissible(false);
      try {
        const res = u ? await api.put(`/api/users/${u.id}`, body) : await api.post('/api/users', body);
        dlg.setDismissible(true);
        dlg.close('saved');
        lv.reload({ resetPage: !u });
        if (u) {
          toast('Account updated.');
        } else {
          toast('Account added.');
          await showOneTimePassword({ title: 'Account Added', username: res.data.user.username, password: res.data.oneTimePassword });
        }
      } catch (err) {
        save.disabled = false;
        dlg.setDismissible(true);
        if (err.fields) setFieldErrors(form, err.fields);
        toast(err.message || 'Could not save the account.', 'error');
      }
    }
  }
}
