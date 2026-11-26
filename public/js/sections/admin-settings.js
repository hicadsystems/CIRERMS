/*
 * admin-settings (admin.settings): the Settings page. The numbers behind the due rules (Drafting,
 * Advancement, Discharge), one card per module with a plain label, the value with its unit and the
 * description under it. Edit opens a dialog (a bottom sheet on a phone) with the group's numbers;
 * the server checks them, a confirmation states what changes, a toast follows. A change takes
 * effect at once: the due lists read the values every time.
 *
 *   mountAdminSettings(outlet, { info })      (the page's `view` in core/nav.js)
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { h } from '../ui/html.js';
import { pageHeader } from '../ui/page-header.js';
import { card } from '../ui/card.js';
import { button } from '../ui/button.js';
import { facts } from '../ui/facts.js';
import { field, textInput, setFieldErrors, clearFieldErrors } from '../ui/field.js';
import { openDialog } from '../ui/dialog.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';

const UNIT = { months: ['month', 'months'], years: ['year', 'years'], age: ['year of age', 'years of age'] };
const withUnit = (value, unit) => `${value} ${(UNIT[unit] || ['', ''])[Number(value) === 1 ? 0 : 1]}`.trim();

export async function mountAdminSettings(outlet, { info } = {}) {
  let groups = (await api.get('/api/settings')).data;
  const canEdit = can('admin.settings', 'edit');

  const note = h('div', { className: 'mb-4 rounded-card border border-border bg-subtle px-4 py-3 text-sm text-muted-foreground', dataset: { settingsNote: '' }, text: 'These are stand-in rules until Hicad confirms the real ones. A change applies at once, everywhere the rule is used, and is kept in the Audit Trail.' });
  const list = h('div', { className: 'grid grid-cols-1 gap-4 desk:grid-cols-2' });
  outlet.replaceChildren(pageHeader({ title: info ? info.title : 'Settings', subtitle: info ? info.subtitle : '' }), note, list);
  draw();

  function draw() {
    list.replaceChildren(...groups.map((g) => card({
      title: g.label,
      actions: canEdit ? [button({ label: 'Edit', icon: 'pencil', variant: 'ghost', ariaLabel: `Edit ${g.label} settings`, onClick: () => openEdit(g) })] : null,
      className: 'min-w-0',
      body: body(g),
    })));
  }

  function openEdit(g) {
    const form = h('form', { className: 'space-y-3', novalidate: true, autocomplete: 'off' }, g.items.map((i) => field({
      label: i.label,
      hint: `${i.min} to ${i.max} (${(UNIT[i.unit] || ['', ''])[1]}). ${i.help || i.description || ''}`.trim(),
      control: textInput({ name: i.key, value: i.value === null ? '' : String(i.value), inputmode: 'numeric', maxlength: 3, autocomplete: 'off' }),
    })));
    const dlg = openDialog({ title: `Edit ${g.label} Settings`, size: 'md', body: form });
    const save = button({ label: 'Save', icon: 'check', variant: 'primary', type: 'submit', attrs: { form: 'settings-form' } });
    form.id = 'settings-form';
    dlg.setFooter([button({ label: 'Cancel', variant: 'outline', onClick: () => dlg.close() }), save]);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearFieldErrors(form);
      const values = {};
      const errors = {};
      const changes = [];
      for (const i of g.items) {
        const v = (form.querySelector(`[name="${CSS.escape(i.key)}"]`).value || '').trim();
        if (!/^\d+$/.test(v)) { errors[i.key] = 'Enter a whole number.'; continue; }
        if (Number(v) < i.min || Number(v) > i.max) { errors[i.key] = `Use a number from ${i.min} to ${i.max}.`; continue; }
        values[i.key] = Number(v);
        if (String(values[i.key]) !== String(Number(i.value))) changes.push(`${i.label}: ${withUnit(i.value, i.unit)} to ${withUnit(v, i.unit)}`);
      }
      if (Object.keys(errors).length) { setFieldErrors(form, errors); return; }
      if (!changes.length) { toast('Nothing has changed.', 'info'); dlg.close(); return; }
      const ok = await confirmDialog({
        title: `Change ${g.label} Settings?`,
        confirmLabel: 'Change',
        message: h('div', { className: 'space-y-2 text-sm' }, [
          h('p', { text: 'The due rules change at once, everywhere they are used:' }),
          h('ul', { className: 'list-disc space-y-1 pl-5' }, changes.map((c) => h('li', { text: c }))),
        ]),
      });
      if (!ok) return;
      save.disabled = true;
      try {
        const res = (await api.put(`/api/settings/${g.key}`, { values })).data;
        groups = groups.map((x) => (x.key === g.key ? res.group : x));
        draw();
        dlg.close();
        toast(`${g.label} settings saved.`, 'success');
      } catch (err) {
        save.disabled = false;
        if (err.fields) setFieldErrors(form, err.fields);
        else toast(err.message || 'Could not save the settings.', 'error');
      }
    });
    setTimeout(() => { const first = form.querySelector('input'); if (first) first.focus(); }, 0);
  }

  // what the colours mean, worked out from the current numbers
  function legend(g) {
    if (!g.legend || !g.legend.length) return null;
    return h('div', { className: 'mb-2 rounded-card border border-border bg-subtle px-3 py-2 text-xs', dataset: { legend: '' } }, [
      h('p', { className: 'mb-1 font-semibold text-foreground', text: 'What this means now' }),
      h('ul', { className: 'list-disc space-y-0.5 pl-4 text-muted-foreground' }, g.legend.map((t) => h('li', { text: t }))),
    ]);
  }

  // label and value rows (facts); the description sits under each value
  function body(g) {
    return h('div', { dataset: { group: g.key } }, [legend(g), facts(g.items.map((i) => [i.label, h('div', { dataset: { setting: i.key } }, [
      h('div', { className: 'font-medium', dataset: { value: '' }, text: i.value === null ? 'N/A' : withUnit(i.value, i.unit) }),
      i.help || i.description ? h('p', { className: 'mt-0.5 text-xs text-muted-foreground', text: i.help || i.description }) : null,
    ])]))]);
  }
}
