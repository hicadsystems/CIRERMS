/*
 * password: Change Password. Reached from the account menu (desktop and phone), and shown on its own,
 * before anything else opens, when the account must choose a password: a new account after its first
 * sign-in, or an account whose password an administrator reset.
 *
 *   openChangePassword({ forced })   a dialog (a bottom sheet on a phone): current, new and confirm
 *                                    password; resolves true once the password is changed.
 *                                    forced: it cannot be dismissed; only Sign Out leaves it.
 *
 * The rules (checked here as the person types, and again by the server): at least 8 characters with a
 * letter and a digit, different from the current password. The person's other sessions are signed out.
 */
import { api } from '../core/api.js';
import { icon } from '../core/icons.js';
import { h, cx } from '../ui/html.js';
import { field, textInput, setFieldErrors, clearFieldErrors } from '../ui/field.js';
import { openDialog } from '../ui/dialog.js';
import { button } from '../ui/button.js';
import { toast } from '../ui/toast.js';

export const PASSWORD_RULES = [
  { key: 'len', text: 'At least 8 characters', ok: (v) => v.length >= 8 },
  { key: 'letter', text: 'A letter', ok: (v) => /[A-Za-z]/.test(v) },
  { key: 'digit', text: 'A number', ok: (v) => /\d/.test(v) },
];

/** A password field with an eye button to show or hide what is typed. */
function passwordField(label, name, autocomplete) {
  const input = textInput({ name, type: 'password', autocomplete, className: 'pr-11' });
  const eye = h('button', {
    type: 'button',
    className: 'absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground',
    'aria-label': `Show ${label}`,
    onClick: () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eye.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} ${label}`);
      eye.replaceChildren(icon(show ? 'eye-off' : 'eye'));
    },
  }, icon('eye'));
  return field({ label, control: h('span', { className: 'relative block' }, [input, eye]) });
}

export function openChangePassword({ forced = false } = {}) {
  const current = passwordField('Current Password', 'currentPassword', 'current-password');
  const fresh = passwordField('New Password', 'newPassword', 'new-password');
  const again = passwordField('Confirm New Password', 'confirmPassword', 'new-password');
  const q = (name) => document.querySelector(`#overlay-root [name="${name}"]`);

  const rules = h('ul', { className: 'space-y-1.5 text-sm', 'aria-label': 'Password rules' }, PASSWORD_RULES.map((r) => h('li', {
    dataset: { rule: r.key },
    className: 'flex items-center gap-2 text-muted-foreground',
  }, [h('span', { className: 'flex h-5 w-5 flex-none items-center justify-center rounded-full bg-muted' }, icon('check', 'icon h-3 w-3')), r.text])));
  const match = h('p', { className: 'hidden text-xs font-medium text-error', role: 'status', text: 'The passwords do not match.' });

  const intro = forced
    ? h('p', { className: 'rounded-card bg-info-soft px-4 py-3 text-sm text-info', role: 'note', text: 'Choose your own password to continue. The one you were given works once.' })
    : null;
  const form = h('form', { className: 'grid gap-4', novalidate: true, autocomplete: 'off' }, [intro, current, fresh, rules, again, match]);

  let done = false;
  let resolveDone;
  const finished = new Promise((r) => { resolveDone = r; });
  const dlg = openDialog({
    title: forced ? 'Choose a New Password' : 'Change Password',
    size: 'md',
    body: form,
    dismissible: !forced,
    initialFocus: 'input[name="currentPassword"]',
    onClose: () => { if (!done) resolveDone(false); },
  });

  function sync() {
    const v = (q('newPassword') || {}).value || '';
    const c = (q('confirmPassword') || {}).value || '';
    PASSWORD_RULES.forEach((r) => {
      const li = rules.querySelector(`[data-rule="${r.key}"]`);
      const ok = r.ok(v);
      li.className = cx('flex items-center gap-2', ok ? 'text-success' : 'text-muted-foreground');
      li.firstElementChild.className = cx('flex h-5 w-5 flex-none items-center justify-center rounded-full', ok ? 'bg-success text-on-fill' : 'bg-muted');
    });
    match.classList.toggle('hidden', !c || c === v);
  }
  form.addEventListener('input', sync);

  const save = button({ label: forced ? 'Set Password' : 'Change Password', icon: 'key-round', variant: 'primary', onClick: () => submit() });
  const leave = forced ? button({ label: 'Sign Out', icon: 'log-out', variant: 'outline', onClick: async () => {
    try { await api.post('/api/auth/logout', undefined, { skipAuthRedirect: true }); } catch (_) { /* ends on this side anyway */ }
    window.location.href = '/index.html';
  } }) : button({ label: 'Cancel', variant: 'outline', onClick: () => dlg.close() });
  dlg.setFooter([leave, save]);
  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });

  async function submit() {
    clearFieldErrors(form);
    const body = {
      currentPassword: q('currentPassword').value,
      newPassword: q('newPassword').value,
      confirmPassword: q('confirmPassword').value,
    };
    save.disabled = true;
    try {
      const res = await api.post('/api/auth/change-password', body);
      done = true;
      dlg.close('changed');
      const ended = (res.data && res.data.otherSessionsEnded) || 0;
      toast(ended ? 'Password changed. Your other sessions were signed out.' : 'Password changed.');
      resolveDone(true);
    } catch (err) {
      save.disabled = false;
      if (err.fields) setFieldErrors(form, err.fields);
      else toast(err.message || 'Could not change the password.', 'error');
    }
  }
  return finished;
}
