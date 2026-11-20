/*
 * Drafting reports (WP7b): three read-only pages added to the Drafting module (the page's `view` in core/nav.js).
 *
 *   mountBatches       Batch/Signal Content: filters (Branch, Rate, Signal Code, Batch No), the batch list with total,
 *                      reported and not reported, Print Summary and Export Excel; a row opens its record, then the batch
 *   mountBatchContent  one batch (drafting/batches/:id): its facts, a filter (Official No with the rating search select,
 *                      Name), its ratings with old and new ship and the date reported, Print Draft Report, Export Excel
 *   mountHistory       Rate DOD History: every draft of every rating, newest first, 25 a page; the rating search select
 *                      narrows it to one rating (clear it for everyone); Print PDF (everyone: 2,000 drafts at most) and Export Excel
 *   mountDraftReport   Draft Report: filters (Specialisation, Authority, From, To); every posting that has reported;
 *                      Print Report and Export Excel (Deployment/Vice shows the vice)
 *
 * One filtered query feeds each list, its PDF and its workbook: the same filters go to all three. Lists are 25 a page
 * from the server with about four key columns; a row opens its full record in a dialog (a sheet on a phone).
 */
import { downloadFile } from '../core/api.js';
import { pageHeader } from '../ui/page-header.js';
import { emptyState } from '../ui/empty-state.js';
import { filterBar } from './disciplinary-parts.js';
import { ratingSearch } from '../ui/rating-search.js';
import { factPanels } from '../ui/facts.js';
import {
  BASE, fmt, plural, qs, loadOptions, batchStatusPill, fullName, two, notice, statStrip, choicesOf, detailsDialog, openRecordButton,
  list, previewPdf, emptyCard, ratingStrip, button, pill, h, cx, icon, toast, api, can, navigate, CARD,
} from './drafting-parts.js';

const download = (url, name) => downloadFile(url, name).catch((err) => toast(err.message || 'Could not make the file.', 'error'));
const header = (info, fallback, subtitle, actions) => pageHeader({ title: info ? info.title : fallback, subtitle: info ? info.subtitle : subtitle, actions });
const loading = () => h('div', { className: cx(CARD, 'flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground') }, [icon('loader-circle', 'icon animate-spin'), 'Loading']);
const failed = (err, title = 'Could Not Load the Page') => emptyCard(emptyState({ icon: 'circle-alert', title, text: (err && err.message) || '' }));
const withQuery = (url, query) => { const s = qs(query); return s ? `${url}?${s}` : url; };

// the row's own words: what a rating's draft row says about the posting
const ROW_PILL = {
  proposed: ['Proposed', 'neutral'], not_recommended: ['Not Recommended', 'error'], awaiting_wef: ['Awaiting WEF', 'warning'],
  scheduled: ['Scheduled', 'info'], reported: ['Reported', 'success'],
};
const statePill = (x) => pill(...(ROW_PILL[x.status] || [x.status, 'neutral']));

/** The date reported: the WEF once reported, the WEF with a Scheduled pill, or what is still to come. */
function reportedCell(x) {
  if (x.status === 'reported') return fmt(x.wef);
  if (x.status === 'scheduled') return h('span', { className: 'flex flex-wrap items-center gap-1.5' }, [fmt(x.wef), pill('Scheduled', 'info')]);
  if (x.status === 'not_recommended') return pill('Not Recommended', 'error');
  return pill('Pending', 'warning');
}
const reportedText = (x) => (x.status === 'reported' ? fmt(x.wef) : x.status === 'scheduled' ? `Scheduled ${fmt(x.wef)}` : x.status === 'not_recommended' ? 'Not recommended' : 'Pending');
const shipText = (x) => (x.status === 'not_recommended' ? h('s', { className: 'text-muted-foreground', text: x.newShip || 'Not recommended' }) : (x.newShip ? h('b', { className: 'font-medium', text: x.newShip }) : '-'));
const batchLabel = (b) => (b.branch === 'All' ? 'All branches' : b.branch);

// =====================================================================================================
// 1. Batch/Signal Content: the list
// =====================================================================================================
export async function mountBatches(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(true); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const stats = h('div');
  const bar = filterBar({
    fields: [
      { name: 'branchId', label: 'Branch', type: 'select', options: choicesOf(o.branches), placeholder: 'All Branches' },
      { name: 'rateId', label: 'Rate', type: 'select', options: o.rates.map((r) => ({ value: r.id, label: r.name })), placeholder: 'All Rates' },
      { name: 'signal', label: 'Signal Code', type: 'text', placeholder: 'e.g. NHQ/NP/DOD/131/2026', span: 'col-span-2 phone:col-span-1' },
      { name: 'batchNo', label: 'Batch No', type: 'text', placeholder: 'e.g. DOD-SM', span: 'col-span-2 phone:col-span-1' },
    ],
    onChange: () => lv.reload({ resetPage: true }),
  });
  const printBtn = can('drafting.batches', 'view') ? button({ label: 'Print Summary', icon: 'printer', variant: 'blue', disabled: true, onClick: () => previewPdf(withQuery(`${BASE}/report/batches/pdf`, bar.query()), 'Draft Batch Summary', 'Draft Batch Summary.pdf') }) : null;
  const excelBtn = can('drafting.batches', 'view') ? button({ label: 'Export Excel', icon: 'file-spreadsheet', variant: 'outline', disabled: true, onClick: () => download(withQuery(`${BASE}/report/batches/excel`, bar.query()), 'Draft Batch Summary.xlsx') }) : null;

  const reportedCol = (b) => two(`${b.reported} of ${b.total}`, b.notReported ? `${b.notReported} not reported` : 'All reported');
  const lv = list({
    columns: [
      { key: 'authority', label: 'Signal Code', render: (b) => (b.authority ? h('b', { className: 'font-medium text-foreground', text: b.authority }) : h('span', { className: 'text-muted-foreground', text: '-' })) },
      { key: 'batchNumber', label: 'Batch Number', render: (b) => two(b.batchNumber, [batchLabel(b), b.rate === 'All' ? '' : b.rateCode].filter(Boolean).join(' · ')), className: 'font-normal' },
      { key: 'status', label: 'Status', render: batchStatusPill },
      { key: 'reported', label: 'Reported', render: reportedCol, className: 'font-normal' },
    ],
    load: async ({ page }) => {
      const res = await api.get(`${BASE}/report/batches?${qs({ ...bar.query(), page })}`);
      const s = res.summary;
      stats.replaceChildren(statStrip([['Batches', s.batches, 'primary'], ['Open', s.open], ['Closed', s.closed]]));
      if (printBtn) printBtn.disabled = s.batches === 0;
      if (excelBtn) excelBtn.disabled = s.batches === 0;
      return res;
    },
    onPick: (b) => batchRecord(b),
    card: { title: (b) => b.batchNumber, subtitle: (b) => `${b.authority || 'No authority yet'} · ${plural(b.total, 'rating')}`, aside: batchStatusPill },
    empty: { icon: 'search', title: 'No Batch Found', text: 'No batch matches these filters. Clear a filter and try again.' },
  });

  function batchRecord(b) {
    const dlg = detailsDialog({
      title: b.batchNumber,
      panels: [
        { title: 'Batch', rows: [['Signal Code', b.authority ? h('b', { text: b.authority }) : 'No authority yet'], ['Batch Number', h('b', { text: b.batchNumber })], ['Status', batchStatusPill(b)], ['Branch', b.branch], ['Specialisation', b.specialisation], ['Rate', b.rate]] },
        { title: 'Progress', rows: [['Total', String(b.total)], ['Reported', String(b.reported)], ['Not Reported', String(b.notReported)], ['Not Recommended', String(b.notRecommended)], ['Initiated', `${fmt(b.initiatedAt)}${b.initiatedBy ? ` by ${b.initiatedBy}` : ''}`], ['Closed', b.closedAt || b.closeDate ? `${fmt(b.closeDate || b.closedAt)}${b.closedBy ? ` by ${b.closedBy}` : ''}` : '']] },
      ],
      actions: [button({ label: 'Open Contents', icon: 'list', variant: 'primary', onClick: () => { dlg.close(); navigate(`#drafting/batches/${b.id}`); } })],
    });
  }

  outlet.replaceChildren(...[
    header(info, 'Batch/Signal Content', '', [printBtn, excelBtn].filter(Boolean)),
    o.department ? h('div', { className: 'mb-3' }, notice('info', 'info', ['You see the batches of your department: ', h('b', { text: o.department.name }), '.'])) : null,
    stats, bar.el, lv.el,
  ].filter(Boolean));
}

// =====================================================================================================
// 2. Batch/Signal Content: one batch
// =====================================================================================================
export async function mountBatchContent(outlet, { info, params = {} } = {}) {
  outlet.replaceChildren(loading());
  const back = button({ label: 'All Batches', icon: 'arrow-left', variant: 'outline', href: '#drafting/batches' });
  let b;
  try { b = (await api.get(`${BASE}/report/batches/${encodeURIComponent(params.id)}`)).data; } catch (err) {
    outlet.replaceChildren(header(info, 'Batch', '', [back]), failed(err, err.status === 404 ? 'Batch Not Found' : 'Could Not Open the Batch'));
    return;
  }
  const bar = filterBar({
    fields: [
      { name: 'serviceNumber', label: 'Official No', type: 'rating', span: 'col-span-3 phone:col-span-1' },
      { name: 'name', label: 'Name', type: 'text', placeholder: 'Surname or first name', span: 'col-span-3 phone:col-span-1' },
    ],
    onChange: () => lv.reload({ resetPage: true }),
  });
  const base = `${BASE}/report/batches/${b.id}`;
  const printBtn = button({ label: 'Print Draft Report', icon: 'printer', variant: 'blue', onClick: () => previewPdf(withQuery(`${base}/pdf`, bar.query()), `Draft Report ${b.batchNumber}`, `Draft Report ${b.batchNumber}.pdf`) });
  const excelBtn = button({ label: 'Export Excel', icon: 'file-spreadsheet', variant: 'outline', onClick: () => download(withQuery(`${base}/excel`, bar.query()), `Draft Report ${b.batchNumber}.xlsx`) });

  const facts = h('section', { className: cx(CARD, 'mb-4 p-4'), dataset: { batchFacts: '' } }, factPanels([
    { title: 'Batch', rows: [['Signal Code', b.authority ? h('b', { text: b.authority }) : 'No authority yet'], ['Batch Number', h('b', { text: b.batchNumber })], ['Status', batchStatusPill(b)], ['Branch', b.branch], ['Specialisation', b.specialisation], ['Rate', b.rate]] },
    { title: 'Progress', rows: [['Initiated', `${fmt(b.initiatedAt)}${b.initiatedBy ? ` by ${b.initiatedBy}` : ''}`], ['Closed', b.status === 'closed' ? `${fmt(b.closeDate)}${b.closedBy ? ` by ${b.closedBy}` : ''}` : ''], ['Total', h('b', { text: String(b.total) })], ['Reported', h('b', { text: String(b.reported) })], ['Not Reported', String(b.notReported)], ['Not Recommended', String(b.notRecommended)]] },
  ]));
  const count = h('div', { className: 'mb-3 text-sm text-muted-foreground', dataset: { rowCount: '' } });

  const lv = list({
    columns: [
      { key: 'serviceNumber', label: 'Official No', render: (x) => x.serviceNumber },
      { key: 'name', label: 'Name', render: (x) => two(fullName(x), x.oldShip ? `from ${x.oldShip}` : ''), className: 'font-normal' },
      { key: 'newShip', label: 'New Ship', render: shipText },
      { key: 'wef', label: 'Date Reported', render: reportedCell },
    ],
    load: ({ page }) => api.get(`${base}/rows?${qs({ ...bar.query(), page })}`),
    rowKey: (x) => x.id,
    onPick: (x) => rowRecord(x),
    onLoaded: ({ meta }) => { count.textContent = `${meta.total.toLocaleString()} ${meta.total === 1 ? 'rating' : 'ratings'}`; },
    card: { title: (x) => fullName(x), subtitle: (x) => `${x.serviceNumber} · ${x.oldShip || '-'} to ${x.newShip || '-'}`, aside: (x) => (x.status === 'reported' ? pill(fmt(x.wef), 'success') : statePill(x)) },
    empty: { icon: 'search', title: 'No Ratings Match', text: 'No rating in this batch matches the Official No or name. Clear them and try again.' },
  });

  function rowRecord(x) {
    detailsDialog({
      title: fullName(x),
      panels: [
        { title: 'Rating', rows: [['Official No', x.serviceNumber], ['Name', x.name], ['Rate', x.rate], ['Sex', x.sex], ['Specialisation', x.specialisation]] },
        {
          title: 'Posting',
          rows: [['Old Ship', x.oldShip], ['New Ship', x.newShip], ['Vice/Deployment', x.vice], ['Remark', x.remark], ['Date Reported', reportedText(x)], ['Status', statePill(x)], ['Not Recommended', x.notRecommendedReason], ['Batch', b.batchNumber]],
        },
      ],
      actions: [openRecordButton(x.serviceNumber)],
    });
  }

  outlet.replaceChildren(pageHeader({ title: `Batch ${b.batchNumber}`, subtitle: b.authority ? `Authority ${b.authority}` : 'Open: no authority yet', actions: [back, printBtn, excelBtn] }), facts, bar.el, count, lv.el);
}

// =====================================================================================================
// 3. Rate DOD History
// =====================================================================================================
export async function mountHistory(outlet, { info, query = {} } = {}) {
  const PDF_MAX = 2000; // the everyone printout holds this many drafts at most (the server holds the same line)
  const picker = ratingSearch({ name: 'serviceNumber', status: 'all', value: query.serviceNumber || null, ariaLabel: 'Rating', placeholder: 'Official number or name' });
  const pickCard = h('div', { className: 'mb-4 min-w-0 desk:w-96 phone:w-full' }, h('label', { className: 'block' }, [
    h('span', { className: 'mb-1 block text-xs font-semibold text-muted-foreground', text: 'Rating' }), picker,
    h('span', { className: 'mt-1 block text-xs text-muted-foreground', text: 'Type at least 2 characters of the official number or name. Clear it to see everyone.' }),
  ]));
  const stripSlot = h('div');
  const noteSlot = h('div');
  const count = h('div', { className: 'mb-3 text-sm text-muted-foreground', dataset: { rowCount: '' } });
  const dept = (await loadOptions(true).catch(() => null) || {}).department;
  let total = 0;

  const query1 = () => (picker.value ? { serviceNumber: picker.value } : {});
  const name = () => (picker.value ? `Draft History ${picker.value}` : 'Draft History');
  const canPrint = can('drafting.history', 'view');
  const sync = () => { if (printBtn) printBtn.disabled = total === 0; if (excelBtn) excelBtn.disabled = total === 0; };
  const tooMany = () => !picker.value && total > PDF_MAX;
  const say = (node) => noteSlot.replaceChildren(...(node ? [h('div', { className: 'mb-3' }, node)] : []));
  const printBtn = canPrint ? button({
    label: 'Print PDF', icon: 'printer', variant: 'blue', disabled: true,
    onClick: () => {
      if (tooMany()) { say(notice('warning', 'triangle-alert', `There are ${total.toLocaleString()} drafts: too many for one PDF (the limit is ${PDF_MAX.toLocaleString()}). Pick a rating with the search to narrow it.`)); return; }
      say(null);
      previewPdf(withQuery(`${BASE}/report/history/pdf`, query1()), name(), `${name()}.pdf`);
    },
  }) : null;
  const excelBtn = canPrint ? button({ label: 'Export Excel', icon: 'file-spreadsheet', variant: 'outline', disabled: true, onClick: () => download(withQuery(`${BASE}/report/history/excel`, query1()), `${name()}.xlsx`) }) : null;

  const lv = list({
    columns: [
      { key: 'serviceNumber', label: 'Official No', render: (x) => two(x.serviceNumber, fullName(x) || '-'), className: 'font-normal' },
      { key: 'newShip', label: 'Old Ship to New Ship', render: (x) => two(shipText(x), x.oldShip ? `from ${x.oldShip}` : ''), className: 'font-normal' },
      { key: 'wef', label: 'Date Reported', render: reportedCell },
      { key: 'batchNumber', label: 'Batch Number', render: (x) => two(x.batchNumber, x.authority || 'No authority yet'), className: 'font-normal' },
    ],
    load: async ({ page }) => {
      say(null);
      try {
        const res = await api.get(`${BASE}/report/history?${qs({ ...query1(), page })}`);
        const r = res.data.rating;
        stripSlot.replaceChildren(...(r ? [h('div', { className: 'mb-4' }, ratingStrip(r.name || r.serviceNumber, `${r.serviceNumber} · ${r.rate || '-'} · ${r.status === 'current' ? (r.ship || 'No ship') : 'Former'}`, openRecordButton(r.serviceNumber)))] : []));
        return { data: res.data.items, meta: res.meta };
      } catch (err) {
        if (err.status !== 404) throw err;
        stripSlot.replaceChildren();
        say(notice('error', 'circle-alert', err.message || 'No rating found.'));
        return { data: [], meta: { page: 1, pageSize: 25, total: 0, totalPages: 1 } };
      }
    },
    rowKey: (x) => x.id,
    onPick: (x) => draftRecord(x),
    onLoaded: ({ meta }) => {
      total = meta ? meta.total : 0;
      count.textContent = `${total.toLocaleString()} ${total === 1 ? 'draft' : 'drafts'}${picker.value ? '' : ' for all ratings'}`;
      sync();
    },
    card: { title: (x) => fullName(x) || x.serviceNumber, subtitle: (x) => `${x.oldShip || '-'} to ${x.newShip || 'not set'} · ${x.batchNumber}`, aside: statePill },
    empty: { icon: 'history', title: 'No Drafts Yet', text: 'No draft has been made for this selection. Clear the rating to see everyone.' },
  });

  function draftRecord(x) {
    const dlg = detailsDialog({
      title: fullName(x) || x.serviceNumber,
      panels: [
        { title: 'Rating', rows: [['Official No', x.serviceNumber], ['Name', x.name], ['Rate', x.rateCode]] },
        { title: 'Batch', rows: [['Batch Number', h('b', { text: x.batchNumber })], ['Authority', x.authority || 'No authority yet'], ['Batch Status', batchStatusPill({ status: x.batchStatus })]] },
        { title: 'Posting', rows: [['Old Ship', x.oldShip], ['New Ship', x.newShip], ['Vice/Deployment', x.vice], ['Date Reported', reportedText(x)], ['Status', statePill(x)], ['Not Recommended', x.notRecommendedReason]] },
      ],
      actions: [
        can('drafting.batches', 'view') ? button({ label: 'Open Batch', icon: 'list', variant: 'outline', onClick: () => { dlg.close(); navigate(`#drafting/batches/${x.batchId}`); } }) : null,
        openRecordButton(x.serviceNumber),
      ],
    });
  }

  picker.addEventListener('change', () => lv.reload({ resetPage: true }));
  outlet.replaceChildren(...[
    header(info, 'Rate DOD History', '', [printBtn, excelBtn].filter(Boolean)),
    dept ? h('div', { className: 'mb-3' }, notice('info', 'info', ['You see the drafts of your department: ', h('b', { text: dept.name }), '.'])) : null,
    pickCard, stripSlot, noteSlot, count, lv.el,
  ].filter(Boolean));
}

// =====================================================================================================
// 4. Draft Report
// =====================================================================================================
export async function mountDraftReport(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(true); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const dept = o.department;
  const warn = h('div');
  const count = h('div', { className: 'mb-3 text-sm text-muted-foreground', dataset: { rowCount: '' } });
  let total = 0;
  const bar = filterBar({
    fields: [
      dept ? null : { name: 'specialisationId', label: 'Specialisation', type: 'select', options: choicesOf(o.specialisations), placeholder: 'All Specialisations', span: 'col-span-2 phone:col-span-1' },
      { name: 'authority', label: 'Authority', type: 'text', placeholder: 'e.g. NHQ/NP/DOD', span: 'col-span-2 phone:col-span-1' },
      { name: 'from', label: 'From', type: 'date' },
      { name: 'to', label: 'To', type: 'date' },
    ].filter(Boolean),
    onChange: () => { redraw(); lv.reload({ resetPage: true }); },
  });
  const redraw = () => { const bad = bar.bad(); warn.replaceChildren(...(bad ? [h('div', { className: 'mb-3' }, notice('error', 'circle-alert', bad))] : [])); sync(); };
  const printBtn = button({ label: 'Print Report', icon: 'printer', variant: 'blue', disabled: true, onClick: () => previewPdf(withQuery(`${BASE}/report/postings/pdf`, bar.query()), 'Draft Report', 'Draft Report.pdf') });
  const excelBtn = button({ label: 'Export Excel', icon: 'file-spreadsheet', variant: 'outline', disabled: true, onClick: () => download(withQuery(`${BASE}/report/postings/excel`, bar.query()), 'Draft Report.xlsx') });
  const sync = () => { const off = !!bar.bad() || total === 0; printBtn.disabled = off; excelBtn.disabled = off; };

  const lv = list({
    columns: [
      { key: 'serviceNumber', label: 'Official No', render: (x) => x.serviceNumber },
      { key: 'name', label: 'Name', render: (x) => two(fullName(x), x.sex), className: 'font-normal' },
      { key: 'proposedShip', label: 'Proposed Ship', render: (x) => (x.proposedShip ? h('b', { className: 'font-medium', text: x.proposedShip }) : '-') },
      { key: 'wef', label: 'WEF', render: (x) => fmt(x.wef) },
    ],
    load: async ({ page }) => {
      if (bar.bad()) return { data: [], meta: { page: 1, pageSize: 25, total: 0, totalPages: 1 } };
      return api.get(`${BASE}/report/postings?${qs({ ...bar.query(), page })}`);
    },
    rowKey: (x) => x.id,
    onPick: (x) => postingRecord(x),
    onLoaded: ({ meta }) => {
      total = meta.total;
      count.textContent = `${total.toLocaleString()} ${total === 1 ? 'posting' : 'postings'} reported`;
      sync();
    },
    card: { title: (x) => fullName(x), subtitle: (x) => `${x.presentShip || '-'} to ${x.proposedShip || '-'}`, aside: (x) => pill(fmt(x.wef), 'success') },
    empty: bar.bad()
      ? { icon: 'circle-alert', title: 'Check the Dates', text: 'Fix the dates above to see the report.' }
      : { icon: 'file-text', title: 'No Postings Found', text: 'No posting reported in this selection. Widen the dates or the authority.' },
  });

  function postingRecord(x) {
    const dlg = detailsDialog({
      title: fullName(x),
      panels: [
        { title: 'Rating', rows: [['Official No', x.serviceNumber], ['Name', x.name], ['Rate', x.rate], ['Sex', x.sex], ['Specialisation', x.specialisation]] },
        { title: 'Posting', rows: [['Batch Number', x.batchNumber], ['Authority', x.authority], ['Present Ship', x.presentShip], ['DOJ', fmt(x.joinedOn)], ['Proposed Ship', x.proposedShip], ['Deployment/Vice', x.vice], ['WEF', fmt(x.wef)]] },
      ],
      actions: [
        can('drafting.batches', 'view') ? button({ label: 'Open Batch', icon: 'list', variant: 'outline', onClick: () => { dlg.close(); navigate(`#drafting/batches/${x.batchId}`); } }) : null,
        openRecordButton(x.serviceNumber),
      ],
    });
  }

  outlet.replaceChildren(...[
    header(info, 'Draft Report', '', [printBtn, excelBtn]),
    dept ? h('div', { className: 'mb-3' }, notice('info', 'info', ['You see the postings of your department: ', h('b', { text: dept.name }), '.'])) : null,
    bar.el, warn, count, lv.el,
  ].filter(Boolean));
}
