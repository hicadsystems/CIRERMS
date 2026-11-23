/*
 * Dashboard (#dashboard): five live stat tiles (Members, Drafting, Disciplinary, Discharge and
 * Appraisals, each from its own tables, each foot line a link to the page it counts),
 * Recently Enlisted and Current Ratings by Rate.
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { icon } from '../core/icons.js';
import { formatDisplayDate } from '../core/dates.js';
import { h, fill } from '../ui/html.js';
import { button } from '../ui/button.js';
import { pageHeader } from '../ui/page-header.js';
import { statTile } from '../ui/stat-tile.js';
import { card } from '../ui/card.js';
import { photoAvatar } from '../ui/avatar.js';
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
  const members = statTile({ label: 'Members', value: '--', icon: 'users', tone: 'primary', foot: [currentFoot, formerFoot], className: 'col-span-2 phone:col-span-1' });
  // the other tiles: the foot lines are links when the person may open the page, plain text when not
  const draftingFoot = [h('span'), h('span')];
  const drafting = statTile({ label: 'Drafting', value: '--', icon: 'briefcase', tone: 'destructive', foot: draftingFoot, className: 'col-span-2 phone:col-span-1' });
  const disciplineFoot = [h('span'), h('span')];
  const discipline = statTile({ label: 'Disciplinary', value: '--', icon: 'gavel', tone: 'brand', foot: disciplineFoot, className: 'col-span-2 phone:col-span-1' });
  const dischargeFoot = [h('span'), h('span')];
  const discharge = statTile({ label: 'Discharge', value: '--', icon: 'door-open', tone: 'secondary', foot: dischargeFoot, className: 'col-span-3 phone:col-span-1' });
  const appraisalFoot = h('span');
  const appraisals = statTile({ label: 'Appraisals', value: '--', icon: 'clipboard-check', tone: 'brand', foot: appraisalFoot, className: 'col-span-3 phone:col-span-2' });
  const recent = h('div', {}, loading());
  const byRate = h('div', {}, loading());

  outlet.replaceChildren(
    pageHeader({ title: 'Dashboard', subtitle: 'Ratings at a glance', actions: [newRatingButton()] }),
    h('div', { className: 'grid grid-cols-6 gap-4 phone:grid-cols-2 phone:gap-3' }, [members, drafting, discipline, discharge, appraisals]),
    h('div', { className: 'mt-4 grid grid-cols-5 gap-4 phone:grid-cols-1' }, [
      card({
        title: 'Recently Enlisted',
        actions: can('ratings.list') ? [button({ label: 'View All', variant: 'ghost', href: '#ratings/current' })] : null,
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

    // a foot line: a link to its page when the person may open it, plain text when not
    const foot = (screen, href, n, word) => (can(screen) ? footLink(href, n, word) : footText(n, word));

    const dr = data.drafting || {};
    drafting.setValue(dr.reportedThisYear ?? 0);
    fill(draftingFoot[0], foot('drafting.report', '#drafting/report', dr.reportedThisYear ?? 0, 'this year'));
    fill(draftingFoot[1], foot('drafting.review', '#drafting/review', dr.openBatches ?? 0, (dr.openBatches ?? 0) === 1 ? 'open batch' : 'open batches'));

    const di = data.discipline || {};
    discipline.setValue(di.pending ?? 0);
    fill(disciplineFoot[0], foot('disciplinary.pending', '#disciplinary/pending', di.pending ?? 0, 'pending'));
    fill(disciplineFoot[1], foot('disciplinary.concluded', '#disciplinary/concluded', di.concludedThisYear ?? 0, 'concluded this year'));

    const dc = data.discharge || {};
    discharge.setValue(dc.thisYear ?? 0);
    fill(dischargeFoot[0], foot('discharge.report', '#discharge/report', dc.thisYear ?? 0, 'this year'));
    fill(dischargeFoot[1], foot('discharge.process', '#discharge/process', dc.proposed ?? 0, 'proposed'));

    // Naval Character Assessment (WP12): appraisals recorded this month, and the open periods
    const ap = data.appraisals || {};
    appraisals.setValue(ap.month ?? 0);
    fill(appraisalFoot, [
      can('appraisal.grading') ? footLink('#assessment/grading', ap.month ?? 0, 'this month') : footText(ap.month ?? 0, 'this month'),
      ' \u00b7 ',
      can('appraisal.periods') ? footLink('#assessment/periods', ap.openPeriods ?? 0, (ap.openPeriods ?? 0) === 1 ? 'open period' : 'open periods') : footText(ap.openPeriods ?? 0, (ap.openPeriods ?? 0) === 1 ? 'open period' : 'open periods'),
    ]);

    const people = data.recentlyEnlisted || [];
    fill(recent, people.length
      ? h('ul', {}, people.map((r) => h('li', {}, h('a', {
          href: `#ratings/edit/${encodeURIComponent(r.service_number)}`,
          className: 'flex items-center gap-3 border-b border-border/70 px-4 py-2.5 transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/15',
        }, [
          photoAvatar(personName(r), r.passport_photo_url, 'sm'),
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
    [members, drafting, discipline, discharge, appraisals].forEach((t) => t.setValue(0));
    fill(recent, emptyState({ icon: 'circle-alert', title: 'Could Not Load the Dashboard' }));
    fill(byRate, emptyState({ icon: 'circle-alert', title: 'Could Not Load the Dashboard' }));
    toast(err.message || 'Could not load the dashboard.', 'error');
  }
}
