/*
 * Current and Former Ratings (#ratings/current, #ratings/former; #ratings/new
 * is the current list with the New Rating dialog open over it).
 *
 * Search (Official No or name) and the Rate and Ship filters above the list;
 * 25 a page from the server; a table on desktop and cards on a phone. A row
 * shows the rating beside the list at 1280 px and up, in a dialog from 761 to
 * 1279 px and in a bottom sheet on a phone (Open Record, Print Report,
 * Documents). The header has Export (Copy Rows, Excel, PDF, CSV, with the
 * list's filters) and New Rating.
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { getLookups } from '../core/lookups.js';
import { formatDisplayDate, yearsBetween, durationSince } from '../core/dates.js';
import { previewBlobModal } from '../core/dom.js';
import { h, cx } from '../ui/html.js';
import { button } from '../ui/button.js';
import { pageHeader } from '../ui/page-header.js';
import { toolbar } from '../ui/toolbar.js';
import { listRecordView } from '../ui/list-record.js';
import { attachMenu } from '../ui/menu.js';
import { pill } from '../ui/pill.js';
import { facts } from '../ui/facts.js';
import { emptyState } from '../ui/empty-state.js';
import { toast } from '../ui/toast.js';
import { openNewRating, newRatingButton } from './rating-new.js';
import { ratingName, personName, shortRate } from './rating-names.js';
import { photoAvatar } from './rating-record.js';

const COLUMNS = {
  current: [
    { key: 'service_number', label: 'Official No', headClassName: 'whitespace-nowrap' },
    { key: 'name', label: 'Name', render: (r) => personName(r) },
    { key: 'rate', label: 'Rate', render: (r) => shortRate(r.rate_name) },
    { key: 'current_ship_name', label: 'Ship' },
    { key: 'branch_name', label: 'Branch' },
  ],
  former: [
    { key: 'service_number', label: 'Official No', headClassName: 'whitespace-nowrap' },
    { key: 'name', label: 'Name', render: (r) => personName(r) },
    { key: 'rate', label: 'Rate', render: (r) => shortRate(r.rate_name) },
    { key: 'exit_date', label: 'Exit Date', render: (r) => formatDisplayDate(r.exit_date) },
    { key: 'exit_type_name', label: 'Reason', render: (r) => r.exit_type_name || r.exit_reason },
  ],
};

async function printReport(sn) {
  try {
    const { blob, mimeType, fileName } = await api.fetchBlob(`/api/ratings/${encodeURIComponent(sn)}/pdf`);
    previewBlobModal({ title: `Report: ${sn}`, blob, mimeType, fileName: fileName || `CIRERMS_Dossier_${sn}.pdf` });
  } catch (err) {
    toast(err.message || 'Could not make the report.', 'error');
  }
}

/** The rating beside the list (or in its dialog or sheet): who, where, and the three actions. */
async function ratingCard(row) {
  let r = row;
  let children = {};
  try {
    const res = await api.get(`/api/ratings/${encodeURIComponent(row.service_number)}`);
    r = res.data.rating;
    children = res.data.children || {};
  } catch (err) {
    return emptyState({ icon: 'circle-alert', title: 'Could Not Load the Rating', text: err.message || '' });
  }
  const current = r.status !== 'former';
  const posting = (children.drafting || []).find((p) => !p.end_date);
  const age = yearsBetween(r.date_of_birth);
  const docs = (children.documents || []).length;
  const rows = current
    ? [
        ['Current Ship', r.current_ship_name],
        ['On Ship For', posting && posting.start_date ? durationSince(posting.start_date) : ''],
        ['Command', r.command_name],
        ['Enlisted', formatDisplayDate(r.date_employed)],
        ['Phone', r.phone],
        ['Age', age === null ? '' : String(age)],
        ['State of Origin', r.state_name],
        ['Documents', String(docs)],
      ]
    : [
        ['Exit Date', formatDisplayDate(r.exit_date)],
        ['Reason', r.exit_type_name || r.exit_reason],
        ['Last Ship', (children.drafting || [])[0] ? children.drafting[0].ship_name : ''],
        ['Enlisted', formatDisplayDate(r.date_employed)],
        ['Service', r.date_employed ? `${yearsBetween(r.date_employed, r.exit_date)} years` : ''],
        ['State of Origin', r.state_name],
      ];
  const sn = encodeURIComponent(r.service_number);
  return h('div', { className: 'space-y-4' }, [
    h('div', { className: 'flex items-start gap-3' }, [
      photoAvatar(r, 'lg'),
      h('div', { className: 'min-w-0' }, [
        h('div', { className: 'text-base font-semibold leading-tight', text: ratingName(r) }),
        h('div', { className: 'text-sm text-muted-foreground', text: [r.service_number, r.rate_name].filter(Boolean).join(' · ') }),
        h('div', { className: 'mt-1.5 flex flex-wrap gap-1.5' }, [pill(current ? 'Current' : 'Former', current ? 'success' : 'neutral'), r.branch_name ? pill(r.branch_name, 'info') : null]),
      ]),
    ]),
    facts(rows),
    h('div', { className: 'flex flex-wrap gap-2 phone:flex-col phone:items-stretch' }, [
      can('ratings.edit') ? button({ label: 'Open Record', icon: 'id-card', variant: 'primary', href: `#ratings/edit/${sn}` }) : null,
      can('ratings.edit') ? button({ label: 'Print Report', icon: 'printer', variant: 'blue', onClick: () => printReport(r.service_number) }) : null,
      can('ratings.documents') ? button({ label: 'Documents', icon: 'folder-open', variant: 'outline', href: `#ratings/documents/${sn}` }) : null,
    ]),
  ]);
}

export async function mountRatingsList(outlet, { status = 'current', info, openNew = false } = {}) {
  const isCurrent = status === 'current';
  const filters = { q: '', rateId: '', shipId: '' };
  const params = (extra = {}) => {
    const p = new URLSearchParams({ status, ...extra });
    Object.entries(filters).forEach(([k, v]) => { if (v) p.set(k, v); });
    return p.toString();
  };

  // Export: the server makes the files with the list's filters; Copy Rows copies the page shown
  const exportItems = [
    { label: 'Copy Rows', icon: 'copy', onSelect: () => copyRows() },
    { label: 'Excel', icon: 'file-spreadsheet', onSelect: () => download('xlsx') },
    { label: 'PDF', icon: 'file-text', onSelect: () => download('pdf') },
    { label: 'CSV', icon: 'file-text', onSelect: () => download('csv') },
  ];
  async function download(format) {
    try {
      await api.downloadFile(`/api/ratings/export?${params({ format })}`, `ratings.${format}`);
      toast(`${format === 'xlsx' ? 'Excel' : format.toUpperCase()} downloaded.`);
    } catch (err) {
      toast(err.message || 'Export failed.', 'error');
    }
  }
  async function copyRows() {
    const cols = COLUMNS[status];
    const rows = view.list.rows();
    const cell = (c, r) => String((c.render ? c.render(r) : r[c.key]) || '');
    const text = [cols.map((c) => c.label).join('\t'), ...rows.map((r) => cols.map((c) => cell(c, r)).join('\t'))].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast(`${rows.length} ${rows.length === 1 ? 'row' : 'rows'} copied.`);
    } catch (_) {
      toast('Copying is blocked in this browser.', 'error');
    }
  }
  const exportBtn = attachMenu(button({ label: 'Export', icon: 'download', iconAfter: 'chevron-down', variant: 'blue' }), exportItems);
  const phoneExport = attachMenu(button({ icon: 'download', ariaLabel: 'Export', variant: 'outline', className: 'desk:hidden' }), exportItems, { title: 'Export' });

  const tb = toolbar({
    search: { placeholder: 'Official No or name', name: 'q' },
    filters: [
      { name: 'rateId', label: 'Rates', options: [], placeholder: 'All Rates', width: 'w-56' },
      { name: 'shipId', label: 'Ships', options: [], placeholder: 'All Ships', width: 'w-48' },
    ],
    noun: ['rating', 'ratings'],
    actions: [phoneExport],
    onChange: (values) => {
      Object.assign(filters, values);
      view.reload({ resetPage: true });
    },
  });

  const view = listRecordView({
    list: {
      columns: COLUMNS[status],
      load: ({ page, pageSize }) => api.get(`/api/ratings?${params({ page, pageSize })}`),
      card: {
        avatar: (r) => personName(r),
        title: (r) => ratingName(r),
        subtitle: (r) => `${r.service_number} · ${isCurrent ? r.current_ship_name || 'No current posting' : `Left ${formatDisplayDate(r.exit_date) || '-'}`}`,
      },
      rowKey: (r) => r.service_number,
      empty: { icon: 'search', title: 'No Ratings Found' },
      onLoaded: ({ meta }) => tb.setCount(meta.total),
    },
    renderRecord: ratingCard,
    recordTitle: (r, { phone }) => (phone ? 'Rating' : ratingName(r)),
  });

  outlet.replaceChildren(
    pageHeader({ title: info ? info.title : isCurrent ? 'Current Ratings' : 'Former Ratings', subtitle: info ? info.subtitle : '', actions: [exportBtn, newRatingButton()], phoneActions: 'hide' }),
    tb.el,
    h('div', { className: cx('min-w-0') }, view.el),
  );

  getLookups().then((lookups) => {
    tb.setOptions('rateId', (lookups.rates || []).map((x) => ({ value: x.id, label: x.name })));
    tb.setOptions('shipId', (lookups.ships || []).map((x) => ({ value: x.id, label: x.name })));
  }).catch(() => {});

  if (openNew) {
    // #ratings/new: the dialog over the current list; closing it leaves the list's address
    openNewRating({
      onClose: () => {
        if (window.location.hash.startsWith('#ratings/new')) window.history.replaceState(null, '', '#ratings/current');
      },
    });
  }

  return () => view.destroy();
}
