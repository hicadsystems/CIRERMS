/*
 * field: a form field with its label above, an "(Optional)" tag, a hint and
 * its error under it; plus the text input and select it usually holds.
 *
 *   field({ label, control, optional, hint, error, className })   wraps any control
 *   textInput({ name, id, type, value, placeholder, required, ...attrs })
 *   selectInput({ name, id, options, value, placeholder })
 *     options: ['A', 'B'] or [{ value, label }]; placeholder: the empty first option ('-- Select --'), null for none
 *   setFieldError(scope, name, message)   shows an error under the control named `name`
 *   setFieldErrors(scope, { name: message })   clears, then shows each (the API's error.fields)
 *   clearFieldErrors(scope)
 *
 * Selects become searchable dropdowns (core/choices.js) once they reach the
 * page: look them up again by name after that, and listen for `change` on a
 * container (it fires on the dropdown's wrapper, which has the same name and value).
 *
 * Phones: fields are 44 px tall; the form's grid decides the columns.
 */
import { cx, h } from './html.js';
import { INPUT, LABEL } from './classes.js';

let seq = 0;

export function field({ label, control, optional = false, hint = '', error = '', className = '' } = {}) {
  const ctl = control instanceof Node ? control : null;
  if (ctl && !ctl.id && ctl.matches && ctl.matches('input,select,textarea')) {
    seq += 1;
    ctl.id = `fld-${seq}`;
  }
  const err = h('p', { className: cx('mt-1 text-xs font-medium text-error', !error && 'hidden'), role: 'alert', dataset: { fieldError: '' }, text: error || '' });
  return h('div', { className: cx('min-w-0', className), dataset: { field: '' } }, [
    label
      ? h('label', { className: LABEL, for: ctl ? ctl.id : undefined }, [
          label,
          optional ? h('span', { className: 'font-normal', text: ' (Optional)' }) : null,
        ])
      : null,
    control,
    hint ? h('p', { className: 'mt-1 text-xs text-muted-foreground', text: hint }) : null,
    err,
  ]);
}

export function textInput({ name, id, type = 'text', value = '', placeholder = '', required = false, className = '', ...attrs } = {}) {
  const input = h('input', { type, name, id, placeholder, required, className: cx(INPUT, className), ...attrs });
  if (value !== null && value !== undefined) input.value = String(value);
  return input;
}

export function selectInput({ name, id, options = [], value = '', placeholder = '-- Select --', className = '', ...attrs } = {}) {
  const select = h('select', { name, id, className: cx(INPUT, className), ...attrs });
  if (placeholder !== null) select.appendChild(h('option', { value: '', text: placeholder }));
  const want = value === null || value === undefined ? '' : String(value);
  for (const o of options) {
    const opt = typeof o === 'object' ? o : { value: o, label: o };
    const node = h('option', { value: String(opt.value), text: opt.label });
    if (want !== '' && String(opt.value) === want) node.selected = true;
    select.appendChild(node);
  }
  return select;
}

// The box to colour: a converted select draws its border on its search field.
const boxOf = (control) => (control && control._customDropdown ? control._customDropdown.searchInput : control);

function findControl(scope, name) {
  return scope ? scope.querySelector(`[name="${CSS.escape(name)}"]`) : null;
}

export function setFieldError(scope, name, message) {
  const control = findControl(scope, name);
  if (!control) return false;
  const box = boxOf(control);
  if (box) {
    box.style.setProperty('border-color', 'rgb(var(--destructive))', 'important');
    box.setAttribute('aria-invalid', 'true');
    box.dataset.hasError = '';
  }
  const wrap = control.closest('[data-field]');
  const slot = wrap && wrap.querySelector('[data-field-error]');
  if (slot) {
    slot.textContent = message;
    slot.classList.remove('hidden');
  } else {
    control.insertAdjacentElement('afterend', h('p', { className: 'field-error-msg mt-1 text-xs font-medium text-error', role: 'alert', text: message }));
  }
  return true;
}

export function clearFieldErrors(scope) {
  if (!scope) return;
  scope.querySelectorAll('.field-error-msg').forEach((n) => n.remove());
  scope.querySelectorAll('[data-field-error]').forEach((n) => { n.textContent = ''; n.classList.add('hidden'); });
  // searchable dropdowns keep their search field outside the select-compatible API, so look at both
  scope.querySelectorAll('[data-has-error]').forEach((n) => {
    n.style.removeProperty('border-color');
    n.removeAttribute('aria-invalid');
    delete n.dataset.hasError;
  });
}

export function setFieldErrors(scope, fields = {}) {
  clearFieldErrors(scope);
  for (const [name, message] of Object.entries(fields || {})) setFieldError(scope, name, message);
}
