import { api, setFallbackToken } from '../core/api.js';

const form = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const errorBox = document.getElementById('login-error');
const submitBtn = document.getElementById('login-submit');

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove('hidden');
}

function hideError() {
  errorBox.textContent = '';
  errorBox.classList.add('hidden');
}

// If session is already active, proceed directly to the SPA
api
  .get('/api/auth/me', { skipAuthRedirect: true })
  .then((res) => {
    if (res?.data?.user) {
      window.location.replace('/app.html#dashboard');
    }
  })
  .catch(() => {
    // Not signed in yet — stay on login page
  });

document.querySelectorAll('[data-demo-user]').forEach((btn) => {
  btn.addEventListener('click', () => {
    usernameInput.value = btn.dataset.demoUser || '';
    passwordInput.value = btn.dataset.demoPass || '';
    hideError();
    usernameInput.focus();
  });
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    showError('Please enter both Username and Password.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';

  try {
    const res = await api.post(
      '/api/auth/login',
      { username, password },
      { skipAuthRedirect: true }
    );
    if (res?.data?.token) {
      setFallbackToken(res.data.token);
    }
    window.location.href = '/app.html#dashboard';
  } catch (err) {
    showError(err.message || 'Sign in failed. Please check your credentials.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In to CIRERMS';
  }
});
