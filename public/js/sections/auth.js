/*
 * Sign In (auth.login, public/index.html): signs in, then opens the app.
 * Already signed in goes straight to the dashboard. The demo account buttons
 * fill the form; the eye shows or hides the password.
 */
import { api, setFallbackToken } from '../core/api.js';

const form = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorBox = document.getElementById('login-error');
const errorText = document.getElementById('login-error-text');
const submitBtn = document.getElementById('login-submit');
const submitText = document.getElementById('login-submit-text');
const toggle = document.getElementById('password-toggle');

const year = document.getElementById('year');
if (year) year.textContent = String(new Date().getFullYear());

function showError(msg) {
  errorText.textContent = msg;
  errorBox.classList.remove('hidden');
  errorBox.classList.add('flex');
}

function hideError() {
  errorText.textContent = '';
  errorBox.classList.add('hidden');
  errorBox.classList.remove('flex');
}

// a session already open goes straight in (a 401 here is expected when signed out)
api
  .get('/api/auth/me', { skipAuthRedirect: true })
  .then((res) => {
    if (res?.data?.user) window.location.replace('/app.html#dashboard');
  })
  .catch(() => {});

document.querySelectorAll('[data-demo-user]').forEach((btn) => {
  btn.addEventListener('click', () => {
    usernameInput.value = btn.dataset.demoUser || '';
    passwordInput.value = btn.dataset.demoPass || '';
    hideError();
    submitBtn.focus();
  });
});

toggle.addEventListener('click', () => {
  const show = passwordInput.type === 'password';
  passwordInput.type = show ? 'text' : 'password';
  toggle.setAttribute('aria-pressed', String(show));
  toggle.setAttribute('aria-label', show ? 'Hide Password' : 'Show Password');
  toggle.querySelector('use').setAttribute('href', `/assets/icons.svg#${show ? 'eye-off' : 'eye'}`);
});

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
