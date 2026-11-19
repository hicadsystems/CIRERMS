/*
 * Documents (#ratings/documents, #ratings/documents/:serviceNumber): pick a
 * rating by searching its Official No or name (the server finds the top
 * matches; ratings are never all loaded into one dropdown), then the same
 * documents block as the record.
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { navigate } from '../core/router.js';
import { icon } from '../core/icons.js';
import { h, cx, fill } from '../ui/html.js';
import { CARD, INPUT, LABEL } from '../ui/classes.js';
import { button } from '../ui/button.js';
import { pageHeader } from '../ui/page-header.js';
import { avatar } from '../ui/avatar.js';
import { pill } from '../ui/pill.js';
import { emptyState } from '../ui/empty-state.js';
import { documentsBlock } from './rating-documents-block.js';
import { ratingName, personName } from './rating-names.js';

/** A search box that finds ratings on the server and calls onPick(row). */
function ratingPicker({ onPick, placeholder = 'Official No or name' }) {
  const input = h('input', { type: 'search', placeholder, autocomplete: 'off', className: cx(INPUT, 'pl-9'), role: 'combobox', 'aria-expanded': 'false', 'aria-controls': 'rating-picker-list', 'aria-label': 'Find a rating' });
  const list = h('ul', { id: 'rating-picker-list', role: 'listbox', className: cx(CARD, 'absolute inset-x-0 top-full z-30 mt-1.5 hidden max-h-80 overflow-y-auto bg-popover p-1 shadow-pop') });
  let rows = [];
  let at = 0;
  let timer = null;
  let token = 0;

  const open = (on) => { list.classList.toggle('hidden', !on); input.setAttribute('aria-expanded', String(on)); };

  function draw() {
    if (!rows.length) {
      fill(list, h('li', { className: 'px-3 py-4 text-center text-sm text-muted-foreground', text: input.value.trim() ? 'No ratings match' : 'Type an Official No or a name' }));
      return;
    }
    fill(list, rows.map((r, i) => h('li', {
      role: 'option',
      'aria-selected': String(i === at),
      className: cx('flex cursor-pointer items-center gap-3 rounded-ctl px-2 py-2 text-sm', i === at ? 'bg-secondary/10' : 'hover:bg-subtle'),
      onMousedown: (e) => { e.preventDefault(); choose(r); },
    }, [
      avatar({ name: personName(r), size: 'xs' }),
      h('span', { className: 'min-w-0 flex-1' }, [
        h('b', { className: 'block truncate font-medium', text: ratingName(r) }),
        h('span', { className: 'block truncate text-xs text-muted-foreground', text: `${r.service_number} · ${r.status === 'former' ? 'Former' : r.current_ship_name || 'Current'}` }),
      ]),
    ])));
  }

  async function search() {
    const q = input.value.trim();
    const mine = ++token;
    if (!q) { rows = []; draw(); return; }
    try {
      const res = await api.get(`/api/ratings?${new URLSearchParams({ status: 'all', q, page: '1', pageSize: '8', sortBy: 'surname' })}`);
      if (mine !== token) return;
      rows = res.data || [];
      at = 0;
      draw();
    } catch (_) {
      if (mine === token) { rows = []; draw(); }
    }
  }

  function choose(r) {
    open(false);
    input.value = '';
    onPick(r);
  }

  input.addEventListener('input', () => { clearTimeout(timer); open(true); timer = setTimeout(search, 250); });
  input.addEventListener('focus', () => { draw(); open(true); });
  input.addEventListener('blur', () => setTimeout(() => open(false), 120));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (rows.length) { at = (at + 1) % rows.length; draw(); } }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (rows.length) { at = (at - 1 + rows.length) % rows.length; draw(); } }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[at]) choose(rows[at]); }
    else if (e.key === 'Escape') open(false);
  });

  return h('label', { className: 'relative block' }, [
    h('span', { className: LABEL, text: 'Rating' }),
    h('span', { className: 'relative block' }, [
      h('span', { className: 'pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground' }, icon('search')),
      input,
    ]),
    list,
  ]);
}

export async function mountRatingsDocuments(outlet, { params = {} } = {}) {
  const sn = params.serviceNumber || '';
  const picker = ratingPicker({ onPick: (r) => navigate(`#ratings/documents/${encodeURIComponent(r.service_number)}`) });
  const chosen = h('div', { className: 'flex-1 phone:w-full' });
  const body = h('div');
  let block = null;

  outlet.replaceChildren(
    pageHeader({ title: 'Documents', subtitle: 'Navpers files by service number' }),
    h('div', { className: 'mb-4 flex flex-wrap items-end gap-3' }, [h('div', { className: 'w-80 phone:w-full' }, picker), chosen]),
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
