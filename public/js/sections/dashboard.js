/*
 * Dashboard (#dashboard): the stat tiles (Members live, with current and
 * former; Drafting, Memos and Mails and Appraisals stay 0 until those modules
 * exist), Recently Enlisted and Current Ratings by Rate.
 */
import { api } from '../core/api.js';
import { icon } from '../core/icons.js';
import { formatDisplayDate } from '../core/dates.js';
import { h, fill } from '../ui/html.js';
import { button } from '../ui/button.js';
import { pageHeader } from '../ui/page-header.js';
import { statTile } from '../ui/stat-tile.js';
import { card } from '../ui/card.js';
import { avatar } from '../ui/avatar.js';
import { emptyState } from '../ui/empty-state.js';
import { toast } from '../ui/toast.js';
import { newRatingButton } from './rating-new.js';
import { ratingName, personName } from './rating-names.js';

const footLink = (href, n, word) => h('a', { href, className: 'hover:text-foreground' }, [h('b', { className: 'text-foreground', text: String(n) }), ` ${word}`]);
const footText = (n, word) => h('span', {}, [h('b', { className: 'text-foreground', text: String(n) }), ` ${word}`]);
const loading = () => h('div', { className: 'flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground' }, [icon('loader-circle', 'icon animate-spin'), 'Loading']);

export async function mountDashboard(outlet) {
  const currentFoot = h('span');
  const formerFoot = h('span');
  const members = statTile({ label: 'Members', value: '--', icon: 'users', tone: 'primary', foot: [currentFoot, formerFoot] });
  const recent = h('div', {}, loading());
  const byRate = h('div', {}, loading());

  outlet.replaceChildren(
    pageHeader({ title: 'Dashboard', subtitle: 'Ratings at a glance', actions: [newRatingButton()] }),
    h('div', { className: 'grid grid-cols-4 gap-4 phone:grid-cols-2 phone:gap-3' }, [
      members,
      statTile({ label: 'Drafting', value: 0, icon: 'briefcase', tone: 'destructive', foot: footText(0, 'this year') }),
      statTile({ label: 'Memos and Mails', value: 0, icon: 'file-text', tone: 'secondary', foot: footText(0, 'unread') }),
      statTile({ label: 'Appraisals', value: 0, icon: 'clipboard-check', tone: 'brand', foot: footText(0, 'this month') }),
    ]),
    h('div', { className: 'mt-4 grid grid-cols-5 gap-4 phone:grid-cols-1' }, [
      card({
        title: 'Recently Enlisted',
        actions: [button({ label: 'View All', variant: 'ghost', href: '#ratings/current' })],
        body: recent,
        padded: false,
        className: 'col-span-3 phone:col-span-1',
      }),
      card({ title: 'Current Ratings by Rate', body: byRate, padded: false, className: 'col-span-2 phone:col-span-1' }),
    ]),
  );

  try {
    const { data } = await api.get('/api/dashboard/summary');
    const m = data.members || {};
    members.setValue(m.total ?? 0);
    fill(currentFoot, footLink('#ratings/current', m.current ?? 0, 'current'));
    fill(formerFoot, footLink('#ratings/former', m.former ?? 0, 'former'));

    const people = data.recentlyEnlisted || [];
    fill(recent, people.length
      ? h('ul', {}, people.map((r) => h('li', {}, h('a', {
          href: `#ratings/edit/${encodeURIComponent(r.service_number)}`,
          className: 'flex items-center gap-3 border-b border-border/70 px-4 py-2.5 transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/15',
        }, [
          avatar({ name: personName(r), size: 'sm' }),
          h('span', { className: 'min-w-0 flex-1' }, [
            h('b', { className: 'block truncate text-sm font-medium', text: ratingName(r) }),
            h('span', { className: 'block truncate text-xs text-muted-foreground', text: `${r.service_number} · ${r.status === 'former' ? 'Former' : r.current_ship_name || 'No current posting'}` }),
          ]),
          h('span', { className: 'text-xs text-muted-foreground', text: formatDisplayDate(r.enlisted) }),
        ]))))
      : emptyState({ icon: 'users', title: 'No Ratings Yet' }));
    const last = recent.querySelector('li:last-child > a');
    if (last) last.classList.remove('border-b');

    const rates = data.currentByRate || [];
    const max = Math.max(1, ...rates.map((x) => x.total));
    fill(byRate, rates.length
      ? h('div', { className: 'space-y-2.5 p-4' }, rates.map((x) => {
          const bar = h('div', { className: 'h-2 rounded-full bg-gradient-to-r from-brand-fill to-secondary' });
          bar.style.width = `${Math.round((x.total / max) * 100)}%`;
          return h('div', {}, [
            h('div', { className: 'mb-1 flex justify-between gap-2 text-xs' }, [h('span', { text: x.rate }), h('b', { text: String(x.total) })]),
            h('div', { className: 'h-2 rounded-full bg-muted', role: 'img', 'aria-label': `${x.rate}: ${x.total}` }, bar),
          ]);
        }))
      : emptyState({ icon: 'chart-column', title: 'No Current Ratings' }));
  } catch (err) {
    members.setValue(0);
    fill(recent, emptyState({ icon: 'circle-alert', title: 'Could Not Load the Dashboard' }));
    fill(byRate, emptyState({ icon: 'circle-alert', title: 'Could Not Load the Dashboard' }));
    toast(err.message || 'Could not load the dashboard.', 'error');
  }
}
