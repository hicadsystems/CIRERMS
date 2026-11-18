/*
 * toolbar: the search box and filters above a list, and its count.
 *
 *   const tb = toolbar({ search, filters, onChange, actions, noun })
 *     search    { placeholder, value, name } or null for none
 *     filters   [{ name, label, options, value, placeholder: 'All Rates', width: 'w-56' }]
 *               options: ['A', 'B'] or [{ value, label }]
 *     onChange(values)  called (search debounced 300 ms) with { [search.name || 'q']: ..., [filter name]: ... }
 *     actions   extra nodes at the end (desktop) or after Filter (phone)
 *     noun      ['rating', 'ratings'] for the count ("112 ratings")
 *   tb.el  tb.values()  tb.setCount(n)  tb.setOptions(name, options)
 *
 * Phones: the filters fold into a Filter button (with how many are set) that
 * opens a sheet of the same selects (changes apply at once; "Show Ratings"
 * closes it); the count is hidden.
 */
import { cx, h } from './html.js';
import { icon } from '../core/icons.js';
import { INPUT } from './classes.js';
import { field, selectInput } from './field.js';
import { buttonClass, button } from './button.js';
import { pillClass } from './pill.js';
import { openDialog } from './dialog.js';

export function toolbar({ search = { placeholder: 'Search' }, filters = [], onChange = () => {}, actions = [], noun = ['row', 'rows'] } = {}) {
  const values = {};
  const searchName = (search && search.name) || 'q';
  if (search) values[searchName] = search.value || '';
  const defs = filters.map((f) => ({ ...f }));
  defs.forEach((f) => { values[f.name] = f.value || ''; });

  const emit = () => onChange({ ...values });
  let syncing = false; // a value set from code fires `change` on a dropdown; ignore those

  // search
  let timer = null;
  const input = search
    ? h('input', { type: 'search', name: searchName, placeholder: search.placeholder || 'Search', className: cx(INPUT, 'pl-9'), autocomplete: 'off', 'aria-label': search.placeholder || 'Search' })
    : null;
  if (input) {
    input.value = values[searchName];
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => { values[searchName] = input.value.trim(); emit(); }, 300);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); values[searchName] = input.value.trim(); emit(); }
    });
  }
  const searchBox = input
    ? h('label', { className: 'relative min-w-0 flex-1 desk:max-w-xs' }, [
        h('span', { className: 'sr-only', text: 'Search' }),
        h('span', { className: 'pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground' }, icon('search')),
        input,
      ])
    : null;

  // desktop filters: selects inline (choices.js turns them into dropdowns once they are on the page)
  const deskFilters = defs.map((f) =>
    h('div', { className: cx(f.width || 'w-56', 'phone:hidden') }, selectInput({ name: f.name, options: f.options || [], value: values[f.name], placeholder: f.placeholder || `All ${f.label}`, 'aria-label': f.label }))
  );

  // phone: one Filter button opening a sheet
  const badge = h('span', { className: cx(pillClass('info'), 'hidden') });
  const filterBtn = defs.length
    ? h('button', { type: 'button', className: cx(buttonClass('outline'), 'desk:hidden') }, [icon('funnel'), 'Filter', badge])
    : null;
  const syncBadge = () => {
    const n = defs.filter((f) => values[f.name]).length;
    badge.textContent = String(n);
    badge.classList.toggle('hidden', !n);
  };
  if (filterBtn) {
    // as in the demo: a change applies straight away; the main button just closes the sheet
    filterBtn.addEventListener('click', () => {
      const body = h('div', { className: 'space-y-4' }, defs.map((f) =>
        field({ label: f.label, control: selectInput({ name: `sheet-${f.name}`, options: f.options || [], value: values[f.name], placeholder: f.placeholder || `All ${f.label}` }) })
      ));
      body.addEventListener('change', (e) => {
        const n = e.target.getAttribute && e.target.getAttribute('name');
        if (!n || !n.startsWith('sheet-')) return;
        values[n.slice(6)] = e.target.value;
        sync();
        emit();
      });
      const plural = noun[1].charAt(0).toUpperCase() + noun[1].slice(1);
      const dlg = openDialog({ title: 'Filter', size: 'sm', body });
      dlg.setFooter([
        button({ label: 'Clear', variant: 'outline', onClick: () => { defs.forEach((f) => { values[f.name] = ''; }); sync(); dlg.close(); emit(); } }),
        button({ label: `Show ${plural}`, variant: 'primary', onClick: () => dlg.close() }),
      ]);
    });
  }

  const count = h('span', { className: 'ml-auto whitespace-nowrap text-sm text-muted-foreground phone:hidden' });
  const el = h('div', { className: 'mb-3 flex flex-wrap items-end gap-3 phone:gap-2' }, [searchBox, ...deskFilters, filterBtn, ...(actions || []), count]);

  // desktop selects report on their wrapper
  el.addEventListener('change', (e) => {
    const n = e.target.getAttribute && e.target.getAttribute('name');
    if (syncing || !n || !defs.some((f) => f.name === n)) return;
    values[n] = e.target.value;
    syncBadge();
    emit();
  });

  // put the desktop selects back in step after a phone sheet change
  function sync() {
    syncing = true;
    defs.forEach((f) => {
      const s = el.querySelector(`[name="${CSS.escape(f.name)}"]`);
      if (s && s.value !== values[f.name]) s.value = values[f.name];
    });
    syncing = false;
    syncBadge();
  }
  syncBadge();

  return {
    el,
    values: () => ({ ...values }),
    setCount(n) {
      const num = Number(n) || 0;
      count.textContent = `${num.toLocaleString()} ${num === 1 ? noun[0] : noun[1]}`;
    },
    setOptions(name, options) {
      const f = defs.find((d) => d.name === name);
      if (!f) return;
      f.options = options;
      const s = el.querySelector(`[name="${CSS.escape(name)}"]`);
      if (!s) return;
      const keep = values[name];
      const fresh = selectInput({ name, options, value: keep, placeholder: f.placeholder || `All ${f.label}` });
      syncing = true;
      s.innerHTML = fresh.innerHTML;
      s.value = keep;
      syncing = false;
    },
  };
}
