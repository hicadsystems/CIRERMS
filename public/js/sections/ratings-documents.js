/*
 * Documents (#ratings/documents, #ratings/documents/:serviceNumber): pick a
 * rating by searching its Official No or name (the server finds the top
 * matches; ratings are never all loaded into one dropdown), then the same
 * documents block as the record.
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { navigate } from '../core/router.js';
import { h, cx, fill } from '../ui/html.js';
import { CARD, LABEL } from '../ui/classes.js';
import { button } from '../ui/button.js';
import { pageHeader } from '../ui/page-header.js';
import { ratingSearch } from '../ui/rating-search.js';
import { avatar } from '../ui/avatar.js';
import { pill } from '../ui/pill.js';
import { emptyState } from '../ui/empty-state.js';
import { documentsBlock } from './rating-documents-block.js';
import { ratingName, personName } from './rating-names.js';

export async function mountRatingsDocuments(outlet, { params = {} } = {}) {
  const sn = params.serviceNumber || '';
  const picker = ratingSearch({ name: 'serviceNumber', value: sn || null, ariaLabel: 'Find a rating', placeholder: 'Official number or name' });
  picker.addEventListener('change', () => { if (picker.value) navigate(`#ratings/documents/${encodeURIComponent(picker.value)}`); });
  const chosen = h('div', { className: 'flex-1 phone:w-full' });
  const body = h('div');
  let block = null;

  outlet.replaceChildren(
    pageHeader({ title: 'Documents', subtitle: 'Navpers files by service number' }),
    h('div', { className: 'mb-4 flex flex-wrap items-end gap-3' }, [h('div', { className: 'w-96 phone:w-full' }, [h('span', { className: LABEL, text: 'Rating' }), picker]), chosen]),
    body,
  );

  if (!sn) {
    fill(body, h('div', { className: CARD }, emptyState({ icon: 'folder-open', title: 'Choose a Rating', text: 'Search by Official No or name to see their documents.' })));
    return null;
  }

  try {
    const res = await api.get(`/api/ratings/${encodeURIComponent(sn)}/documents`);
    const r = res.data.rating;
    fill(chosen, h('div', { className: 'flex flex-wrap items-center gap-3' }, [
      h('div', { className: cx(CARD, 'flex min-w-0 items-center gap-3 px-3 py-2 phone:w-full') }, [
        avatar({ name: r.full_name, size: 'sm' }),
        h('span', { className: 'min-w-0' }, [
          h('b', { className: 'block truncate text-sm', text: ratingName(r) }),
          h('span', { className: 'block truncate text-xs text-muted-foreground', text: `${r.service_number} · ${r.status === 'former' ? 'Former' : r.current_ship_name || 'Current'}` }),
        ]),
        pill(r.status === 'former' ? 'Former' : 'Current', r.status === 'former' ? 'neutral' : 'success'),
      ]),
      can('ratings.edit') ? button({ label: 'Open Record', icon: 'id-card', variant: 'outline', href: `#ratings/edit/${encodeURIComponent(r.service_number)}` }) : null,
    ]));
    block = documentsBlock({ serviceNumber: r.service_number, canUpload: can('ratings.documents', 'add'), canDelete: can('ratings.documents', 'delete') });
    fill(body, block.el);
  } catch (err) {
    fill(body, h('div', { className: CARD }, emptyState({ icon: 'search', title: err.status === 404 ? 'Rating Not Found' : 'Could Not Load Documents', text: err.message || '' })));
  }
  return () => { if (block) block.destroy(); };
}
