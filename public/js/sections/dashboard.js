import { api } from '../core/api.js';
import { showToast } from '../core/dom.js';

export async function mountDashboard(outlet) {
  const totalEl = outlet.querySelector('#stat-members-total');
  const formerEl = outlet.querySelector('#stat-members-former');
  const currentEl = outlet.querySelector('#stat-members-current');

  try {
    const res = await api.get('/api/dashboard/summary');
    const summary = res.data;
    if (totalEl) totalEl.textContent = Number(summary.members?.total || 0).toLocaleString();
    if (formerEl) formerEl.textContent = Number(summary.members?.former || 0).toLocaleString();
    if (currentEl) currentEl.textContent = Number(summary.members?.current || 0).toLocaleString();
  } catch (err) {
    showToast(err.message || 'Failed to load dashboard counts.', 'error');
  }
}
