/*
 * admin-roles (admin.roles): Manage Roles. The roles with their user counts (25 a page from the
 * server, searchable); a row opens the role in a dialog (a bottom sheet on a phone) with its privilege
 * grid: every module's screens, grouped by module, each with only the actions it has (view, add, edit,
 * delete, approve), read from the privilege catalogue (/api/access/privileges) so a later module's
 * screens appear here by themselves. Add Role and Edit use the same dialog; Delete is in it.
 *
 *   mountAdminRoles(outlet, { info })      (the page's `view` in core/nav.js)
 *
 * The Administrator role (full access) opens read-only: it cannot be edited or deleted. A role that
 * still has users cannot be deleted, and role names are unique (the server says so). A change applies
 * from the users' next request; nobody is signed out.
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { h, cx } from '../ui/html.js';
import { icon } from '../core/icons.js';
import { pageHeader } from '../ui/page-header.js';
import { toolbar } from '../ui/toolbar.js';
import { listView } from '../ui/list-view.js';
import { button } from '../ui/button.js';
import { pill } from '../ui/pill.js';
import { field, textInput, setFieldErrors, clearFieldErrors } from '../ui/field.js';
import { openDialog } from '../ui/dialog.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';
import { rowTooltip } from './admin-common.js';

const ACTION_LABEL = { view: 'View', add: 'Add', edit: 'Edit', delete: 'Delete', approve: 'Approve' };
const count = (role) => Object.values(role.privileges || {}).reduce((n, a) => n + a.length, 0);

/** One action as a toggle: on is a brand fill, off is muted; aria-pressed carries the state. */
function actionChip(label, on, disabled, onToggle) {
  const b = h('button', {
    type: 'button',
    disabled,
    'aria-pressed': String(on),
    className: cx(
      'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 phone:h-tap phone:px-4 phone:text-sm',
      on ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground hover:bg-subtle',
      disabled && 'cursor-default opacity-70',
    ),
    onClick: () => !disabled && onToggle(),
  }, [on ? icon('check', 'icon h-3 w-3') : null, label]);
  return b;
}

export async function mountAdminRoles(outlet, { info } = {}) {
  const allow = { add: can('admin.roles', 'add'), edit: can('admin.roles', 'edit'), del: can('admin.roles', 'delete') };
  const catalogue = (await api.get('/api/access/privileges')).data;

  const addBtn = allow.add ? button({ label: 'Add Role', icon: 'plus', variant: 'primary', onClick: () => openRole(null) }) : null;
  const header = pageHeader({ title: info ? info.title : 'Manage Roles', subtitle: info ? info.subtitle : '', actions: addBtn ? [addBtn] : null });
  const tb = toolbar({
    search: { placeholder: 'Search roles', name: 'q' },
    noun: ['role', 'roles'],
    onChange: () => lv.reload({ resetPage: true }),
  });
  const accessPill = (r) => (r.fullAccess ? pill('Full Access', 'warning') : pill(`${count(r)} ${count(r) === 1 ? 'privilege' : 'privileges'}`, 'neutral'));
  const lv = listView({
    columns: [
      { key: 'name', label: 'Role', className: 'font-semibold text-foreground' },
      { key: 'description', label: 'Description', render: (r) => r.description || '-', className: 'max-w-md truncate' },
      { key: 'userCount', label: 'Users', render: (r) => String(r.userCount) },
      { key: 'access', label: 'Access', render: accessPill },
    ],
    load: ({ page }) => api.get(`/api/access/roles?page=${page}&q=${encodeURIComponent(tb.values().q || '')}`),
    onPick: (r) => openRole(r),
    card: {
      title: (r) => r.name,
      subtitle: (r) => `${r.userCount} ${r.userCount === 1 ? 'user' : 'users'}${r.description ? ` · ${r.description}` : ''}`,
      aside: accessPill,
    },
    empty: { icon: 'shield-user', title: 'No Roles Found', text: 'Change the search.' },
    onLoaded: ({ meta: m }) => tb.setCount(m.total),
  });
  rowTooltip(lv.el);
  outlet.replaceChildren(header, tb.el, lv.el);

  // ---- the role's dialog: add (role null), edit, or read-only for a role that cannot be edited
  function openRole(role) {
    const locked = !!role && role.fullAccess;
    const readOnly = locked || (role ? !allow.edit : !allow.add);
    // the grid's state: { screen: Set(actions) }
    const grants = {};
    Object.entries((role && role.privileges) || {}).forEach(([s, a]) => { grants[s] = new Set(a); });

    const form = h('form', { className: 'space-y-4', novalidate: true, autocomplete: 'off' });
    const top = h('div', { className: 'grid grid-cols-2 gap-4 phone:grid-cols-1' }, [
      field({ label: 'Role Name *', control: textInput({ name: 'name', value: role ? role.name : '', maxlength: 60, disabled: readOnly }) }),
      field({ label: 'Description', optional: true, control: textInput({ name: 'description', value: role ? role.description || '' : '', maxlength: 255, disabled: readOnly }) }),
    ]);
    const note = locked
      ? h('p', { className: 'flex items-start gap-2 rounded-card bg-warning-soft px-4 py-3 text-sm text-warning', role: 'note' }, [icon('lock-keyhole', 'icon mt-0.5 flex-none'), 'The Administrator role has full access to every screen and action, including any added later. It cannot be edited or deleted.'])
      : null;
    const privError = h('p', { className: 'hidden text-xs font-medium text-error', role: 'alert', dataset: { privError: '' } });
    const grid = h('div', { className: 'space-y-3', dataset: { grid: '' } });
    form.append(...[top, note, privError, grid].filter(Boolean));

    function drawGrid() {
      grid.replaceChildren(...catalogue.modules.map((mod) => {
        const all = mod.screens.flatMap((s) => s.actions.map((a) => [s.screen, a]));
        const allOn = all.every(([s, a]) => grants[s] && grants[s].has(a));
        const head = h('div', { className: 'flex items-center gap-3 border-b border-border/70 bg-subtle/70 px-4 py-2' }, [
          h('h3', { className: 'flex-1 text-2xs font-semibold uppercase tracking-widest text-muted-foreground', text: mod.label }),
          readOnly ? null : button({
            label: allOn ? 'Clear' : 'Select All',
            variant: 'ghost',
            ariaLabel: `${allOn ? 'Clear' : 'Select all of'} ${mod.label}`,
            onClick: () => {
              all.forEach(([s, a]) => {
                if (allOn) { if (grants[s]) grants[s].delete(a); } else (grants[s] = grants[s] || new Set()).add(a);
              });
              drawGrid();
            },
          }),
        ]);
        const rows = mod.screens.map((s) => {
          const set = grants[s.screen] || new Set();
          const hasView = s.actions.includes('view');
          return h('div', { className: 'flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 px-4 py-2.5 first:border-t-0', dataset: { screen: s.screen } }, [
            h('span', { className: 'min-w-0 flex-1 basis-48 text-sm font-medium', text: s.label }),
            h('span', { className: 'flex flex-wrap gap-1.5' }, s.actions.map((a) => actionChip(ACTION_LABEL[a] || a, set.has(a), readOnly, () => {
              const cur = (grants[s.screen] = grants[s.screen] || new Set());
              if (cur.has(a)) {
                cur.delete(a);
                if (a === 'view') cur.clear(); // nothing else works without View
              } else {
                cur.add(a);
                if (hasView) cur.add('view');
              }
              drawGrid();
            }))),
          ]);
        });
        return h('section', { className: 'overflow-hidden rounded-card border border-border/70', dataset: { module: mod.label } }, [head, ...rows]);
      }));
    }
    drawGrid();

    const dlg = openDialog({
      title: role ? (readOnly ? role.name : 'Edit Role') : 'Add Role',
      size: '2xl',
      body: form,
      initialFocus: readOnly ? undefined : 'input[name="name"]',
    });
    const save = readOnly ? null : button({ label: role ? 'Save' : 'Add Role', icon: 'check', variant: 'primary', onClick: () => submit() });
    const del = role && !locked && allow.del ? button({ label: 'Delete', icon: 'trash-2', variant: 'outline', className: 'text-destructive desk:mr-auto', onClick: () => remove() }) : null;
    dlg.setFooter([del, button({ label: readOnly ? 'Close' : 'Cancel', variant: 'outline', onClick: () => dlg.close() }), save]);
    form.addEventListener('submit', (e) => { e.preventDefault(); if (!readOnly) submit(); });

    const busy = (on) => {
      if (save) save.disabled = on;
      if (del) del.disabled = on;
      dlg.setDismissible(!on);
    };

    async function submit() {
      clearFieldErrors(form);
      privError.classList.add('hidden');
      const privileges = {};
      Object.entries(grants).forEach(([s, set]) => { if (set.size) privileges[s] = [...set]; });
      const body = { name: form.querySelector('[name="name"]').value, description: form.querySelector('[name="description"]').value, privileges };
      busy(true);
      try {
        if (role) await api.put(`/api/access/roles/${role.id}`, body);
        else await api.post('/api/access/roles', body);
        busy(false);
        dlg.close('saved');
        toast(role ? 'Role updated. It applies from the users’ next request.' : 'Role added.');
        lv.reload({ resetPage: !role });
      } catch (err) {
        busy(false);
        if (err.fields) setFieldErrors(form, err.fields);
        if (err.fields && err.fields.privileges) {
          privError.textContent = err.fields.privileges;
          privError.classList.remove('hidden');
        }
        toast(err.message || 'Could not save the role.', 'error');
      }
    }

    async function remove() {
      const ok = await confirmDialog({ title: 'Delete Role', message: `Delete the role "${role.name}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      busy(true);
      try {
        await api.del(`/api/access/roles/${role.id}`);
        busy(false);
        dlg.close('deleted');
        toast('Role deleted.');
        lv.reload();
      } catch (err) {
        busy(false);
        toast(err.message || 'Could not delete the role.', 'error');
      }
    }
  }
}
