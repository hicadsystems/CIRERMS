/*
 * static-table: the screen of every Static Table (Branch, Ships, Training ...): one searchable
 * list, 25 rows a page from the server, and Add and Edit in a dialog (a bottom sheet on a phone).
 * It draws any table from the columns the API sends (GET /api/tables/<slug>/meta, built from
 * src/modules/tables/tables.config.js), so a new table or column needs no change here.
 *
 *   mountStaticTable(outlet, { slug, info })      (the page's `view` in core/nav.js)
 *
 * Add, Edit and Delete show only with the table's own grant (`tables.<slug>` add, edit, delete);
 * without Edit a row opens read-only. A row in use is refused on Delete with where it is used;
 * the dialog's Status makes it Inactive instead (it leaves the dropdowns, records that hold it
 * still show it).
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { icon } from '../core/icons.js';
import { invalidateLookups } from '../core/lookups.js';
import { h, cx } from '../ui/html.js';
import { pageHeader } from '../ui/page-header.js';
import { toolbar } from '../ui/toolbar.js';
import { listView } from '../ui/list-view.js';
import { button } from '../ui/button.js';
import { pill, pillClass } from '../ui/pill.js';
import { field, textInput, selectInput, setFieldErrors, clearFieldErrors } from '../ui/field.js';
import { openDialog } from '../ui/dialog.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';

const STATUS = [{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }];

/** A multi-pick: the picked rows as removable chips and a dropdown to add one; none picked means all. */
function multiPick(column, rows, picked, disabled) {
  let ids = (picked || []).map(Number);
  const chips = h('div', { className: 'mb-2 flex flex-wrap gap-1.5', dataset: { chips: column.key } });
  const pickName = `${column.key}__pick`;
  const addLabel = `Add ${column.label.replace(/s$/, '')}`;
  const pickable = () => rows.filter((r) => r.active && !ids.includes(r.id)).map((r) => ({ value: r.id, label: r.name }));
  const picker = disabled ? null : selectInput({ name: pickName, options: pickable(), value: '', placeholder: addLabel });
  const nameOf = (id) => (rows.find((r) => r.id === id) || { name: `#${id}` }).name;

  function drawChips() {
    chips.replaceChildren(...(ids.length
      ? ids.map((id) => h('button', {
        type: 'button',
        className: cx(pillClass('info'), 'gap-1.5 py-1', disabled ? 'cursor-default' : 'hover:bg-error-soft hover:text-error'),
        'aria-label': disabled ? nameOf(id) : `Remove ${nameOf(id)}`,
        disabled,
        onClick: () => { ids = ids.filter((x) => x !== id); sync(); },
      }, [nameOf(id), disabled ? null : icon('x', 'icon h-3 w-3')]))
      : [pill(`All ${column.label}`, 'neutral')]));
  }
  function sync() {
    drawChips();
    if (!picker) return;
    const live = el.querySelector(`[name="${CSS.escape(pickName)}"]`);
    if (!live) return;
    const fresh = selectInput({ name: pickName, options: pickable(), value: '', placeholder: addLabel });
    live.innerHTML = fresh.innerHTML;
    live.value = '';
  }
  const el = h('div', { dataset: { multi: column.key } }, [chips, picker]);
  el.addEventListener('change', (e) => {
    const n = e.target.getAttribute && e.target.getAttribute('name');
    if (n !== pickName || !e.target.value) return;
    ids = [...ids, Number(e.target.value)];
    sync();
  });
  drawChips();
  return { el, get: () => ids.slice() };
}

/** The dropdown rows of a ref column: the active ones, and the row this record holds even if inactive. */
function refOptions(rows, heldId) {
  return rows
    .filter((r) => r.active || r.id === Number(heldId))
    .map((r) => ({ value: r.id, label: r.active ? r.name : `${r.name} (Inactive)` }));
}

export async function mountStaticTable(outlet, { slug, info } = {}) {
  const screen = `tables.${slug}`;
  const allow = { add: can(screen, 'add'), edit: can(screen, 'edit'), del: can(screen, 'delete') };
  const base = `/api/tables/${slug}`;
  const meta = (await api.get(`${base}/meta`)).data;
  // the list shows the demo's columns and the code, the name first
  const listed = meta.columns.filter((c) => c.list).sort((a, b) => (b.key === 'name') - (a.key === 'name'));
  const cellOf = (c, row) => {
    if (c.type === 'ref') return row[c.name];
    if (c.type === 'bool') return row[c.key] ? 'Yes' : 'No';
    return row[c.key];
  };
  const lower = meta.title.toLowerCase();

  const addButton = allow.add ? button({ label: `Add ${meta.item}`, icon: 'plus', variant: 'primary', onClick: () => openForm(null) }) : null;
  const header = pageHeader({ title: info ? info.title : meta.title, subtitle: info ? info.subtitle : '', actions: addButton ? [addButton] : null });

  const tb = toolbar({
    search: { placeholder: `Search ${lower}`, name: 'q' },
    noun: ['entry', 'entries'],
    onChange: () => lv.reload({ resetPage: true }),
  });

  const columns = [
    { key: 'no', label: '#', className: 'w-14', headClassName: 'w-14' },
    ...listed.map((c) => ({ key: c.key, label: c.label, render: (row) => cellOf(c, row) })),
    { key: 'is_active', label: 'Status', headClassName: 'w-28', render: (row) => pill(row.is_active ? 'Active' : 'Inactive', row.is_active ? 'success' : 'neutral') },
    {
      key: 'act',
      label: '',
      headClassName: 'w-24',
      className: 'text-right',
      render: (row) => button({ label: allow.edit ? 'Edit' : 'View', icon: allow.edit ? 'pencil' : 'eye', variant: 'ghost', ariaLabel: `${allow.edit ? 'Edit' : 'View'} ${row.name}`, onClick: () => openForm(row) }),
    },
  ];

  const lv = listView({
    columns,
    load: ({ page }) => api.get(`${base}?q=${encodeURIComponent(tb.values().q || '')}&page=${page}`),
    onPick: (row) => openForm(row),
    card: {
      title: (row) => row.name,
      subtitle: (row) => listed.slice(1).map((c) => cellOf(c, row)).filter((v) => v !== null && v !== undefined && v !== '').join(' · '),
      aside: (row) => pill(row.is_active ? 'Active' : 'Inactive', row.is_active ? 'success' : 'neutral'),
    },
    empty: { icon: 'search', title: 'Nothing Matches', text: `No ${lower} found.` },
    onLoaded: ({ meta: m }) => tb.setCount(m.total),
  });

  outlet.replaceChildren(header, tb.el, lv.el);

  // ---- the dialog: add (row null) or edit / view
  async function openForm(row) {
    let full = null;
    if (row) {
      try {
        full = (await api.get(`${base}/${row.id}`)).data;
      } catch (err) {
        toast(err.message || 'Could not open it.', 'error');
        return;
      }
    }
    const readOnly = row ? !allow.edit : !allow.add;
    const multis = {};

    const controls = meta.columns.map((c) => {
      const raw = full ? full[c.key] : undefined;
      let control;
      if (c.type === 'multi') {
        multis[c.key] = multiPick(c, meta.options[c.key] || [], full ? full[c.key] : [], readOnly);
        control = multis[c.key].el;
      } else if (c.type === 'ref') {
        control = selectInput({ name: c.key, options: refOptions(meta.options[c.key] || [], raw), value: raw ?? '', placeholder: c.blank || '-- Select --', disabled: readOnly });
      } else if (c.type === 'bool') {
        control = selectInput({ name: c.key, options: [{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }], value: full ? String(raw ? 1 : 0) : '0', placeholder: null, disabled: readOnly });
      } else if (c.type === 'virtual') {
        return null;
      } else if (c.type === 'select') {
        control = selectInput({ name: c.key, options: c.options, value: raw ?? '', placeholder: '-- Select --', disabled: readOnly });
      } else if (c.type === 'number') {
        control = textInput({ name: c.key, type: 'number', value: raw ?? '', min: c.min, max: c.max, step: '1', inputmode: 'numeric', disabled: readOnly });
      } else {
        control = textInput({ name: c.key, value: raw ?? '', maxlength: c.max, disabled: readOnly, autocomplete: 'off', className: c.upper ? 'uppercase placeholder:normal-case' : '' });
      }
      return field({ label: c.required ? `${c.label} *` : c.label, control, hint: c.hint, className: c.type === 'multi' || c.hint ? 'col-span-2 phone:col-span-1' : '' });
    });
    const status = field({ label: 'Status', control: selectInput({ name: 'is_active', options: STATUS, value: full ? String(full.is_active ? 1 : 0) : '1', placeholder: null, disabled: readOnly }) });

    const note = full && full.in_use
      ? h('p', { className: 'col-span-2 rounded-ctl bg-info-soft px-3 py-2 text-sm text-info phone:col-span-1', role: 'note' },
        `In use: ${full.usage.map((u) => u.text).join(', ')}. It cannot be deleted; make it Inactive to take it out of the dropdowns.`)
      : null;

    const form = h('form', { className: 'grid grid-cols-2 gap-4 phone:grid-cols-1', novalidate: true, autocomplete: 'off' }, [...controls.filter(Boolean), status, note]);
    const dlg = openDialog({
      title: row ? `${readOnly ? '' : 'Edit '}${meta.item}` : `Add ${meta.item}`,
      size: 'md',
      body: form,
      initialFocus: readOnly ? undefined : 'input:not([type="hidden"]), [name]',
    });

    const saveBtn = readOnly ? null : button({ label: 'Save', icon: 'check', variant: 'primary', onClick: () => save() });
    const deleteBtn = row && allow.del ? button({ label: 'Delete', icon: 'trash-2', variant: 'outline', className: 'text-destructive desk:mr-auto', onClick: () => remove() }) : null;
    dlg.setFooter([deleteBtn, button({ label: readOnly ? 'Close' : 'Cancel', variant: 'outline', onClick: () => dlg.close() }), saveBtn]);
    form.addEventListener('submit', (e) => { e.preventDefault(); if (!readOnly) save(); });

    function payload() {
      const body = {};
      meta.columns.forEach((c) => {
        if (c.type === 'virtual') return;
        if (c.type === 'multi') { body[c.key] = multis[c.key].get(); return; }
        const el = form.querySelector(`[name="${CSS.escape(c.key)}"]`);
        body[c.key] = el ? el.value : '';
      });
      body.is_active = form.querySelector('[name="is_active"]').value === '1';
      return body;
    }

    function busy(on) {
      if (saveBtn) saveBtn.disabled = on;
      if (deleteBtn) deleteBtn.disabled = on;
      dlg.setDismissible(!on);
    }

    async function save() {
      clearFieldErrors(form);
      busy(true);
      try {
        if (row) await api.put(`${base}/${row.id}`, payload());
        else await api.post(base, payload());
        busy(false);
        dlg.close('saved');
        toast(row ? `${meta.item} updated.` : `${meta.item} added.`);
        invalidateLookups();
        lv.reload({ resetPage: !row });
      } catch (err) {
        busy(false);
        if (err.fields) setFieldErrors(form, err.fields);
        toast(err.message || 'Could not save.', 'error');
      }
    }

    async function remove() {
      const ok = await confirmDialog({ title: `Delete ${meta.item}`, message: `Delete "${full.name}"? This cannot be undone.`, confirmLabel: 'Delete', danger: true });
      if (!ok) return;
      busy(true);
      try {
        await api.del(`${base}/${row.id}`);
        busy(false);
        dlg.close('deleted');
        toast(`${meta.item} deleted.`);
        invalidateLookups();
        lv.reload();
      } catch (err) {
        busy(false);
        toast(err.message || 'Could not delete.', 'error');
      }
    }
  }
}
