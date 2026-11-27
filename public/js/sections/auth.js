/*
 * Sign In (auth.login, public/index.html): signs in, then opens the app.
 * Already signed in goes straight to the dashboard. The eye shows or hides a password; the button at
 * the top right switches light and dark, the same setting the app uses.
 *
 * Forgot password? opens the reset in place on the sign-in card: the Official Number and Send Code,
 * then the e-mailed code with a new password (the rules shown as it is typed). The page says the same
 * words whether or not the number has an account, and never shows a hint of the e-mail address. On
 * success it returns to Sign In with a toast.
 */
import '../core/pwa.js';
import { api, setFallbackToken } from '../core/api.js';
import { bindThemeButton } from '../core/theme.js';
import { toast } from '../ui/toast.js';
import { PASSWORD_RULES } from '../shell/password.js';

const $ = (id) => document.getElementById(id);

const form = $('login-form');
const usernameInput = $('username');
const passwordInput = $('password');
const errorBox = $('login-error');
const errorText = $('login-error-text');
const submitBtn = $('login-submit');
const submitText = $('login-submit-text');

const forgotForm = $('forgot-form');
const resetForm = $('reset-form');
const forgotInput = $('forgot-username');
const resetRules = $('reset-rules');

const title = $('auth-title');
const lead = $('auth-lead');
const heading = $('auth-icon');

bindThemeButton($('theme-toggle'));

const year = $('year');
if (year) year.textContent = String(new Date().getFullYear());

// ---- the three screens of the card ----

const SCREENS = {
  signin: { form, icon: 'circle-user', title: 'Welcome Back', lead: 'Sign in to CIRERMS, the Nigerian Navy ratings records.', focus: usernameInput },
  forgot: { form: forgotForm, icon: 'key-round', title: 'Forgot Password', lead: 'Enter your Official Number and we will e-mail you a one-time code.', focus: forgotInput },
  reset: { form: resetForm, icon: 'key-round', title: 'Reset Your Password', lead: 'Type the code from the e-mail and choose a new password.', focus: $('reset-code') },
};

function show(name) {
  Object.entries(SCREENS).forEach(([key, s]) => s.form.classList.toggle('hidden', key !== name));
  const s = SCREENS[name];
  title.textContent = s.title;
  lead.textContent = s.lead;
  heading.setAttribute('href', `/assets/icons.svg#${s.icon}`);
  s.focus.focus();
}

function showBox(box, msg) {
  const text = box.querySelector('[data-error-text]') || box.querySelector('span:last-child');
  text.textContent = msg;
  box.classList.remove('hidden');
  box.classList.add('flex');
}

function hideBox(box) {
  box.classList.add('hidden');
  box.classList.remove('flex');
}

function showError(msg) { showBox(errorBox, msg); }
function hideError() { hideBox(errorBox); }

/** Messages under the fields of a reset form, from the server's `fields`. */
function setFieldErrors(root, fields) {
  root.querySelectorAll('[data-field-error]').forEach((p) => {
    const msg = fields && fields[p.dataset.fieldError];
    p.textContent = msg || '';
    p.classList.toggle('hidden', !msg);
  });
}

// a session already open goes straight in
api
  .get('/api/auth/status', { skipAuthRedirect: true })
  .then((res) => {
    if (res?.data?.signedIn) window.location.replace('/app.html#dashboard');
  })
  .catch(() => {});

// the eye on a password box
document.querySelectorAll('[data-password-toggle]').forEach((btn) => {
  const input = $(btn.dataset.passwordToggle);
  const label = btn.getAttribute('aria-label').replace(/^Show /, '');
  btn.addEventListener('click', () => {
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    btn.setAttribute('aria-pressed', String(reveal));
    btn.setAttribute('aria-label', `${reveal ? 'Hide' : 'Show'} ${label}`);
    btn.querySelector('use').setAttribute('href', `/assets/icons.svg#${reveal ? 'eye-off' : 'eye'}`);
  });
});

// ---- sign in ----

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!username || !password) {
    showError('Enter your username and password.');
    (username ? passwordInput : usernameInput).focus();
    return;
  }

  submitBtn.disabled = true;
  submitText.textContent = 'Signing In';

  try {
    const res = await api.post('/api/auth/login', { username, password }, { skipAuthRedirect: true });
    if (res?.data?.token) setFallbackToken(res.data.token);
    window.location.href = '/app.html#dashboard';
  } catch (err) {
    showError(err.message || 'Sign in failed. Check your username and password.');
    submitBtn.disabled = false;
    submitText.textContent = 'Sign In';
    passwordInput.select();
  }
});

// ---- Forgot password ----

let officialNumber = '';

PASSWORD_RULES.forEach((r) => {
  const li = document.createElement('li');
  li.dataset.rule = r.key;
  li.className = 'flex items-center gap-2 text-login-ink/70';
  li.innerHTML = '<span class="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-login-ink/10"><svg class="icon h-3 w-3" aria-hidden="true"><use href="/assets/icons.svg#check"></use></svg></span><span></span>';
  li.lastElementChild.textContent = r.text;
  resetRules.appendChild(li);
});

function syncRules() {
  const v = $('reset-new').value;
  const c = $('reset-confirm').value;
  PASSWORD_RULES.forEach((r) => {
    const li = resetRules.querySelector(`[data-rule="${r.key}"]`);
    const ok = r.ok(v);
    li.className = `flex items-center gap-2 ${ok ? 'font-medium text-login-ink' : 'text-login-ink/70'}`;
    li.firstElementChild.className = `flex h-5 w-5 flex-none items-center justify-center rounded-full ${ok ? 'bg-success text-on-fill' : 'bg-login-ink/10'}`;
  });
  $('reset-mismatch').classList.toggle('hidden', !c || c === v);
}
resetForm.addEventListener('input', syncRules);

function clearResetForm() {
  resetForm.reset();
  hideBox($('reset-error'));
  setFieldErrors(resetForm, null);
  syncRules();
  ['reset-new', 'reset-confirm'].forEach((id) => {
    const input = $(id);
    if (input.type !== 'password') {
      const btn = document.querySelector(`[data-password-toggle="${id}"]`);
      if (btn) btn.click();
    }
  });
}

$('forgot-link').addEventListener('click', () => {
  forgotInput.value = usernameInput.value.trim();
  hideBox($('forgot-error'));
  setFieldErrors(forgotForm, null);
  show('forgot');
});

document.querySelectorAll('[data-back-to-sign-in]').forEach((btn) => {
  btn.addEventListener('click', () => {
    clearResetForm();
    if (officialNumber) usernameInput.value = officialNumber;
    hideError();
    show('signin');
  });
});

$('reset-again').addEventListener('click', () => {
  clearResetForm();
  forgotInput.value = officialNumber;
  show('forgot');
});

forgotForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideBox($('forgot-error'));
  setFieldErrors(forgotForm, null);
  const number = forgotInput.value.trim();
  if (!number) {
    setFieldErrors(forgotForm, { username: 'Enter your Official Number.' });
    forgotInput.focus();
    return;
  }
  const btn = $('forgot-submit');
  btn.disabled = true;
  $('forgot-submit-text').textContent = 'Sending';
  try {
    const res = await api.post('/api/auth/forgot-password', { username: number }, { skipAuthRedirect: true });
    officialNumber = number;
    if (res?.data?.message) $('reset-notice').textContent = res.data.message;
    clearResetForm();
    show('reset');
  } catch (err) {
    if (err.fields) setFieldErrors(forgotForm, err.fields);
    else showBox($('forgot-error'), err.message || 'Something went wrong. Try again.');
  } finally {
    btn.disabled = false;
    $('forgot-submit-text').textContent = 'Send Code';
  }
});

resetForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideBox($('reset-error'));
  setFieldErrors(resetForm, null);
  const body = {
    username: officialNumber,
    code: $('reset-code').value.trim(),
    newPassword: $('reset-new').value,
    confirmPassword: $('reset-confirm').value,
  };
  const btn = $('reset-submit');
  btn.disabled = true;
  $('reset-submit-text').textContent = 'Resetting';
  try {
    await api.post('/api/auth/reset-password', body, { skipAuthRedirect: true });
    clearResetForm();
    usernameInput.value = officialNumber;
    passwordInput.value = '';
    hideError();
    show('signin');
    passwordInput.focus();
    toast('Your password has been changed. Sign in with your new password.');
  } catch (err) {
    if (err.fields) setFieldErrors(resetForm, err.fields);
    else showBox($('reset-error'), err.message || 'Something went wrong. Try again.');
  } finally {
    btn.disabled = false;
    $('reset-submit-text').textContent = 'Reset Password';
  }
});
