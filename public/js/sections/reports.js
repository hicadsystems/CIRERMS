/*
 * Reports (WP9): six read-only pages in the Reports module (each page's `view` in core/nav.js).
 *
 *   mountShipHistory        Ship History Report: a ship and a period, the ratings posted to it; Export Excel (the old
 *                           system's workbook; its Print PDF button says so)
 *   mountAllPersonnel       All Personnel: filters, figures, the list; Print PDF (the Ratings Report) and Export Excel
 *   mountDisposition        Disposition Report: where the current ratings serve, by ship or unit and rate; Print PDF
 *   mountNominalRoll        Nominal Roll: the ratings serving on a ship or unit, or on every ship of a command
 *   mountManningState       Manning State: every ship's manning requirement against who is aboard
 *   mountRetirementForecast Retirement Forecast: who becomes due for discharge in the next 6, 12 or 24 months
 *
 * One filtered query feeds each list, its PDF and its workbook: the same filters go to all three. Lists are 25 a page
 * from the server with about four key columns; a row opens its full record in a dialog (a sheet on a phone).
 */
import { api, downloadFile } from '../core/api.js';
import { pageHeader } from '../ui/page-header.js';
import { emptyState } from '../ui/empty-state.js';
import { filterBar } from './disciplinary-parts.js';
import {
  fmt, plural, qs, choicesOf, notice, two, detailsDialog, openRecordButton, list, previewPdf, emptyCard, button, pill, h, cx, icon, toast, can, navigate, CARD,
} from './drafting-parts.js';

const BASE = '/api/reports';
const EMPTY_META = { page: 1, pageSize: 25, total: 0, totalPages: 1 };

const download = (url, name) => downloadFile(url, name).catch((err) => toast(err.message || 'Could not make the file.', 'error'));
const withQuery = (url, query) => { const s = qs(query); return s ? `${url}?${s}` : url; };
const loading = () => h('div', { className: cx(CARD, 'flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground') }, [icon('loader-circle', 'icon animate-spin'), 'Loading']);
const failed = (err) => emptyCard(emptyState({ icon: 'circle-alert', title: 'Could Not Load the Page', text: (err && err.message) || '' }));
const header = (info, actions) => pageHeader({ title: info.title, subtitle: info.subtitle, actions: actions.filter(Boolean) });
const nameLine = (x) => [x.rateCode, x.name].filter(Boolean).join(' ');
const dash = (v) => v || '-';

let optionCache = null;
async function loadOptions() {
  if (!optionCache) optionCache = (await api.get(`${BASE}/options`)).data;
  return optionCache;
}

/** Two to four figures (four fold to two across on a phone), as the demo's tiles: label, value, a tone and a note. */
const FIGURE_COLS = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4 phone:grid-cols-2' };
function figures(items) {
  return h('div', { className: cx('mb-4 grid gap-3 phone:gap-2', FIGURE_COLS[items.length]), dataset: { stats: '' } }, items.map(([label, value, tone, extra]) => h('div', { className: cx(CARD, 'min-w-0 px-4 py-3 phone:px-3') }, [
    h('div', { className: 'truncate text-2xs font-semibold uppercase tracking-wider text-muted-foreground', text: label }),
    h('div', { className: cx('mt-0.5 break-words text-2xl font-semibold', tone === 'primary' ? 'text-primary-hover' : tone === 'warning' ? 'text-warning' : tone === 'error' ? 'text-error' : ''), text: String(value) }),
    extra || null,
  ])));
}

/** A card of small counts in a row that wraps (the demo's rate strip). */
const countStrip = (title, items, dataKey) => h('div', { className: cx(CARD, 'mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-sm'), dataset: { [dataKey]: '' } }, [
  h('b', { className: 'text-sm font-semibold text-brand', text: title }),
  ...items.map((g) => h('span', { className: 'text-muted-foreground' }, [`${g.code || g.label}: `, h('b', { className: 'text-foreground', text: String(g.count) })])),
]);

/** The total and its rate groups in one card (Nominal Roll). */
const totalStrip = (total, groups) => h('div', { className: cx(CARD, 'mb-4 flex flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3'), dataset: { stats: '' } }, [
  h('div', { className: 'min-w-0' }, [
    h('div', { className: 'text-2xs font-semibold uppercase tracking-wider text-muted-foreground', text: 'Total' }),
    h('div', { className: 'text-2xl font-semibold text-primary-hover', text: total.toLocaleString() }),
  ]),
  h('div', { className: 'flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1 text-sm', dataset: { rateStrip: '' } }, [
    h('b', { className: 'text-sm font-semibold text-brand', text: 'By Rate' }),
    ...groups.map((g) => h('span', { className: 'text-muted-foreground' }, [`${g.code}: `, h('b', { className: 'text-foreground', text: String(g.count) })])),
  ]),
]);

/** The Print PDF and Export Excel buttons of a page: both off until the list has something to print. */
function outputs({ screen, pdfUrl, excelUrl, pdfTitle, pdfName, excelName, query, pdf = true }) {
  const allowed = can(screen, 'view');
  const printBtn = allowed && pdf ? button({ label: 'Print PDF', icon: 'printer', variant: 'blue', disabled: true, onClick: () => previewPdf(withQuery(pdfUrl, query()), pdfTitle, pdfName) }) : null;
  const excelBtn = allowed ? button({ label: 'Export Excel', icon: 'file-spreadsheet', variant: 'outline', disabled: true, onClick: () => download(withQuery(excelUrl, query()), excelName) }) : null;
  return { printBtn, excelBtn, enable: (on) => { if (printBtn) printBtn.disabled = !on; if (excelBtn) excelBtn.disabled = !on; } };
}

/** A line saying how many rows the filters left. */
const countLine = () => h('div', { className: 'mb-3 text-sm text-muted-foreground', dataset: { rowCount: '' } });

/** The card that asks for a pick; the list is hidden until the pick is made. */
function pickPrompt(iconName, title, text) {
  const el = emptyCard(emptyState({ icon: iconName, title, text }));
  el.dataset.prompt = '';
  return {
    el,
    show(on, lv, reword) {
      if (reword) { el.replaceChildren(emptyState({ icon: reword.icon || iconName, title: reword.title || title, text: reword.text || text })); }
      el.classList.toggle('hidden', !on);
      lv.el.classList.toggle('hidden', on);
    },
  };
}

/** A note under the filters that holds the date or choice error, or nothing. */
function warner() {
  const el = h('div');
  return { el, say: (msg) => el.replaceChildren(...(msg ? [h('div', { className: 'mb-3' }, notice('error', 'circle-alert', msg))] : [])) };
}

/** The filters' fields from the options' lists. */
const select = (name, label, rows, placeholder, span) => ({ name, label, type: 'select', options: choicesOf(rows), placeholder, span });

/**
 * Ships follow the command: choosing a command narrows the Ship list to its ships (and clears a ship from another).
 * The options of the select are replaced in one call, as the select component expects.
 */
function followCommand(bar, o, placeholder = 'All Ships') {
  const fill = () => {
    const shipSel = bar.el.querySelector('[name="shipId"]');
    const cmdSel = bar.el.querySelector('[name="commandId"]');
    if (!shipSel || !cmdSel) return;
    const cmd = Number(cmdSel.value) || null;
    const ships = o.ships.filter((s) => s.active && (!cmd || s.commandId === cmd));
    const keep = Number(shipSel.value) || null;
    const nodes = [h('option', { value: '', text: placeholder }), ...ships.map((s) => h('option', { value: String(s.id), text: s.name }))];
    shipSel.replaceChildren(...nodes);
    if (keep && ships.some((s) => s.id === keep)) shipSel.value = String(keep);
    else if (keep) shipSel.dispatchEvent(new Event('change', { bubbles: true }));
  };
  return fill;
}

/** Sets a select to a value from the address (a link from another report) and tells the filters. */
function preset(bar, name, value) {
  const el = bar.el.querySelector(`[name="${CSS.escape(name)}"]`);
  if (!el || !value) return;
  el.value = String(value);
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

const rowLink = (label, iconName, href, screen) => (can(screen, 'view') ? button({ label, icon: iconName, variant: 'outline', onClick: () => navigate(href) }) : null);

// =====================================================================================================
// 1. Ship History
// =====================================================================================================
export async function mountShipHistory(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const stats = h('div');
  const count = countLine();
  const warn = warner();
  const bar = filterBar({
    fields: [
      select('shipId', 'Ship or Unit', o.ships.filter((s) => s.active), '-- Select Ship --', 'col-span-2 phone:col-span-1'),
      { name: 'from', label: 'From', type: 'date' },
      { name: 'to', label: 'To', type: 'date' },
    ],
    onChange: () => { redraw(); lv.reload({ resetPage: true }); },
  });
  const ready = () => !!bar.values().shipId && !bar.bad();
  const redraw = () => warn.say(bar.bad());
  const out = outputs({ screen: 'reports.ship-history', excelUrl: `${BASE}/ship-history/excel`, excelName: 'Ship History.xlsx', query: () => bar.query(), pdf: false });
  // the old system's report is a workbook: its Print PDF button says so
  const printBtn = button({ label: 'Print PDF', icon: 'printer', variant: 'blue', onClick: () => toast('The Ship History Report is an Excel workbook, as in the old system. Use Export Excel.', 'info') });
  const prompt = pickPrompt('ship', 'Choose a Ship', 'Pick a ship or unit to see the ratings posted to it.');

  const lv = list({
    columns: [
      { key: 'serviceNumber', label: 'Official No', render: (x) => x.serviceNumber },
      { key: 'name', label: 'Name', render: (x) => two(x.name, x.rateCode), className: 'font-normal' },
      { key: 'from', label: 'From', render: (x) => fmt(x.from) || '-' },
      { key: 'to', label: 'To', render: (x) => (x.aboard ? pill('Aboard', 'success') : fmt(x.to) || '-') },
    ],
    load: async ({ page }) => {
      if (!ready()) {
        const bad = bar.bad();
        prompt.show(true, lv, bad ? { icon: 'circle-alert', title: 'Check the Dates', text: 'Fix the dates above to see the report.' } : { icon: 'ship', title: 'Choose a Ship', text: 'Pick a ship or unit to see the ratings posted to it.' });
        stats.replaceChildren();
        return { data: [], meta: EMPTY_META };
      }
      prompt.show(false, lv);
      const res = await api.get(`${BASE}/ship-history?${qs({ ...bar.query(), page })}`);
      const s = res.summary;
      stats.replaceChildren(figures([['Postings', s.postings, 'primary'], ['Aboard Now', s.aboard], ['Average Tour', s.averageTour || '-']]));
      return res;
    },
    rowKey: (x) => x.id,
    onPick: (x) => record(x),
    onLoaded: ({ meta }) => {
      const n = ready() ? meta.total : 0;
      count.textContent = ready() ? plural(n, 'posting') : '';
      out.enable(n > 0);
    },
    card: { title: (x) => nameLine(x), subtitle: (x) => `${x.serviceNumber} · ${fmt(x.from) || '-'} to ${x.aboard ? 'date' : fmt(x.to) || '-'}`, aside: (x) => (x.aboard ? pill('Aboard', 'success') : null) },
    autoLoad: false,
    empty: { icon: 'search', title: 'No Postings Found', text: 'No rating has been posted to this ship in this period.' },
  });

  function record(x) {
    const shipName = (o.ships.find((s) => s.id === Number(bar.values().shipId)) || {}).name || '';
    detailsDialog({
      title: nameLine(x),
      panels: [
        { title: 'Rating', rows: [['Official No', x.serviceNumber], ['Name', x.name], ['Rate', x.rate], ['Specialisation', x.specialisation]] },
        { title: 'Posting', rows: [['Ship or Unit', shipName], ['From', fmt(x.from)], ['To', x.aboard ? pill('Aboard', 'success') : fmt(x.to)], ['Tour', x.tour], ['Remarks', x.remarks]] },
      ],
      actions: [openRecordButton(x.serviceNumber)],
    });
  }

  outlet.replaceChildren(header(info, [printBtn, out.excelBtn]), stats, bar.el, warn.el, count, prompt.el, lv.el);
  lv.reload({ resetPage: true });
}

// =====================================================================================================
// 2. All Personnel
// =====================================================================================================
export async function mountAllPersonnel(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const stats = h('div');
  const count = countLine();
  const bar = filterBar({
    fields: [
      { name: 'status', label: 'Status', type: 'select', options: [{ value: 'current', label: 'Current' }, { value: 'former', label: 'Former' }], placeholder: 'All' },
      select('rateId', 'Rate', o.rates, 'All Rates'),
      select('branchId', 'Branch', o.branches, 'All Branches'),
      select('commandId', 'Command', o.commands, 'All Commands'),
      select('shipId', 'Ship or Unit', o.ships, 'All Ships'),
      select('specialisationId', 'Specialisation', o.specialisations, 'All Specialisations'),
      select('staffBranchId', 'Staff Branch', o.staffBranches, 'All Staff Branches'),
      select('entryModeId', 'AK (Entry Mode)', o.entryModes, 'All Entry Modes'),
      select('stateId', 'State', o.states, 'All States'),
      select('zoneId', 'Geo-Political Zone', o.zones, 'All Zones'),
      { name: 'sort', label: 'Sort By', type: 'select', options: o.sorts.filter((s) => s.value !== 'number'), placeholder: 'Official Number' },
    ],
    onChange: () => lv.reload({ resetPage: true }),
  });
  const out = outputs({ screen: 'reports.all-personnel', pdfUrl: `${BASE}/personnel/pdf`, excelUrl: `${BASE}/personnel/excel`, pdfTitle: 'Ratings Report', pdfName: 'Personel.pdf', excelName: 'Personel.xlsx', query: () => bar.query() });
  const statusPill = (x) => pill(x.status === 'current' ? 'Current' : 'Former', x.status === 'current' ? 'success' : 'neutral');

  const lv = list({
    columns: [
      { key: 'serviceNumber', label: 'Official No', render: (x) => x.serviceNumber },
      { key: 'name', label: 'Name', render: (x) => two(x.name, x.rateCode), className: 'font-normal' },
      { key: 'ship', label: 'Ship or Unit', render: (x) => dash(x.ship) },
      { key: 'status', label: 'Status', render: statusPill },
    ],
    load: async ({ page }) => {
      const res = await api.get(`${BASE}/personnel?${qs({ ...bar.query(), page })}`);
      const s = res.summary;
      stats.replaceChildren(figures([['Personnel', s.personnel.toLocaleString(), 'primary'], ['Current', s.current.toLocaleString()], ['Former', s.former.toLocaleString()]]));
      return res;
    },
    rowKey: (x) => x.serviceNumber,
    onPick: (x) => record(x),
    onLoaded: ({ meta }) => { count.textContent = plural(meta.total, 'rating'); out.enable(meta.total > 0); },
    card: { title: (x) => nameLine(x), subtitle: (x) => `${x.serviceNumber} · ${x.branch || '-'}`, aside: statusPill },
    empty: { icon: 'users', title: 'No Ratings Match', text: 'Change the filters to see ratings.' },
  });

  function record(x) {
    detailsDialog({
      title: nameLine(x),
      panels: [
        { title: 'Rating', rows: [['Official No', x.serviceNumber], ['Name', x.name], ['Rate', x.rate], ['Sex', x.sex], ['Status', statusPill(x)], ['Date of Birth', fmt(x.dateOfBirth)], ['Date Joined', fmt(x.dateJoined)], ['Seniority Date', fmt(x.seniorityDate)], x.status === 'former' ? ['Exit Date', fmt(x.exitDate)] : null].filter(Boolean) },
        { title: 'Service', rows: [['Ship or Unit', x.ship], ['Command', x.command], ['Area Office', x.areaOffice], ['Branch', x.branch], ['Staff Branch', x.staffBranch], ['Specialisation', x.specialisation], ['AK (Entry Mode)', x.entryMode], ['State', x.state], ['Geo-Political Zone', x.zone]] },
      ],
      actions: [openRecordButton(x.serviceNumber)],
    });
  }

  outlet.replaceChildren(header(info, [out.printBtn, out.excelBtn]), stats, bar.el, count, lv.el);
}

// =====================================================================================================
// 3. Disposition
// =====================================================================================================
export async function mountDisposition(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const stats = h('div');
  const strip = h('div');
  const count = countLine();
  const bar = filterBar({
    fields: [
      select('commandId', 'Command', o.commands, 'All Commands'),
      select('areaId', 'Area Office', o.areas, 'All Area Offices'),
      select('specialisationId', 'Trade', o.specialisations, 'All Trades'),
    ],
    onChange: () => lv.reload({ resetPage: true }),
  });
  const out = outputs({ screen: 'reports.disposition', pdfUrl: `${BASE}/disposition/pdf`, excelUrl: `${BASE}/disposition/excel`, pdfTitle: 'Disposition Report', pdfName: 'Disposition Report.pdf', excelName: 'Disposition Report.xlsx', query: () => bar.query() });

  const share = (s) => {
    const fill = h('div', { className: 'h-2 rounded-full bg-gradient-to-r from-brand-fill to-secondary' });
    fill.style.width = `${s.share}%`;
    return h('div', { className: 'h-2 rounded-full bg-muted', role: 'img', 'aria-label': `${s.share}% of the largest` }, fill);
  };
  const ratesText = (s) => s.rates.filter((r) => r.count).map((r) => `${r.code} ${r.count}`).join(' · ');

  const lv = list({
    columns: [
      { key: 'ship', label: 'Ship or Unit', render: (s) => h('b', { className: 'font-medium', text: s.ship }) },
      { key: 'total', label: 'Ratings', render: (s) => h('b', { text: String(s.total) }), headClassName: 'w-28' },
      { key: 'share', label: 'Share', render: share, headClassName: 'w-1/3' },
    ],
    load: async ({ page }) => {
      const res = await api.get(`${BASE}/disposition?${qs({ ...bar.query(), page })}`);
      const s = res.summary;
      stats.replaceChildren(figures([['Ships and Units', s.ships, 'primary'], ['Current Ratings', s.ratings.toLocaleString()], ['Largest', s.largest || '-']]));
      strip.replaceChildren(countStrip('By Rate', s.byRate, 'rateStrip'));
      return res;
    },
    rowKey: (s) => s.shipId || 0,
    onPick: (s) => record(s),
    onLoaded: ({ meta }) => { count.textContent = plural(meta.total, 'ship or unit', 'ships and units'); out.enable(meta.total > 0); },
    card: { title: (s) => s.ship, subtitle: ratesText, aside: (s) => pill(String(s.total), 'info') },
    empty: { icon: 'ship', title: 'No Ships Found', text: 'No current rating matches these filters.' },
  });

  function record(s) {
    detailsDialog({
      title: s.ship,
      panels: [
        { title: 'Ship or Unit', rows: [['Ship or Unit', h('b', { text: s.ship })], ['Type', s.type], ['Current Ratings', h('b', { text: String(s.total) })]] },
        { title: 'By Rate', rows: [...s.rates.map((r) => [r.name, String(r.count)]), s.noRate ? ['No rate recorded', String(s.noRate)] : null].filter(Boolean) },
      ],
      actions: [s.shipId ? rowLink('Nominal Roll', 'list', `#reports/nominal-roll?shipId=${s.shipId}`, 'reports.nominal-roll') : null],
    });
  }

  outlet.replaceChildren(header(info, [out.printBtn, out.excelBtn]), stats, strip, bar.el, count, lv.el);
}

// =====================================================================================================
// 4. Nominal Roll
// =====================================================================================================
export async function mountNominalRoll(outlet, { info, query = {} } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const stats = h('div');
  const count = countLine();
  let commandWide = false;
  const bar = filterBar({
    fields: [
      select('commandId', 'Command', o.commands, 'All Commands'),
      { name: 'shipId', label: 'Ship or Unit', type: 'select', options: choicesOf(o.ships), placeholder: 'All Ships' },
      select('branchId', 'Branch', o.branches, 'All Branches'),
      select('rateId', 'Rate', o.rates, 'All Rates'),
    ],
    onChange: () => { fill(); lv.reload({ resetPage: true }); },
  });
  const fill = followCommand(bar, o);
  const ready = () => { const v = bar.values(); return !!(v.shipId || v.commandId); };
  const out = outputs({ screen: 'reports.nominal-roll', pdfUrl: `${BASE}/nominal-roll/pdf`, excelUrl: `${BASE}/nominal-roll/excel`, pdfTitle: 'Nominal Roll', pdfName: 'Nominal Roll.pdf', excelName: 'Nominal Roll.xlsx', query: () => bar.query() });
  const prompt = pickPrompt('list', 'Choose a Ship or a Command', 'Pick a ship or unit, or a command, to see who is serving there.');

  const lv = list({
    columns: [
      { key: 'serviceNumber', label: 'Official No', render: (x) => x.serviceNumber },
      { key: 'name', label: 'Name', render: (x) => two(x.name, commandWide ? `${x.rateCode} · ${x.ship}` : x.rateCode), className: 'font-normal' },
      { key: 'specialisation', label: 'Specialisation', render: (x) => dash(x.specialisation) },
      { key: 'joinedOn', label: 'Joined Ship', render: (x) => two(fmt(x.joinedOn) || '-', x.months === null ? '' : `${x.months} ${x.months === 1 ? 'month' : 'months'}`), className: 'font-normal' },
    ],
    load: async ({ page }) => {
      if (!ready()) {
        prompt.show(true, lv);
        stats.replaceChildren();
        return { data: [], meta: EMPTY_META };
      }
      prompt.show(false, lv);
      commandWide = !bar.values().shipId;
      const res = await api.get(`${BASE}/nominal-roll?${qs({ ...bar.query(), page })}`);
      stats.replaceChildren(totalStrip(res.summary.total, res.summary.groups));
      return res;
    },
    rowKey: (x) => x.serviceNumber,
    onPick: (x) => record(x),
    onLoaded: ({ meta }) => {
      const n = ready() ? meta.total : 0;
      count.textContent = ready() ? plural(n, 'rating') : '';
      out.enable(n > 0);
    },
    card: { title: (x) => nameLine(x), subtitle: (x) => `${x.serviceNumber} · ${commandWide ? x.ship : x.specialisation || '-'}`, aside: (x) => (x.months === null ? null : pill(`${x.months} mo`, 'neutral')) },
    autoLoad: false,
    empty: { icon: 'search', title: 'Nobody Is Serving Here', text: 'No current rating matches these filters. Clear the Branch or Rate, or pick another ship.' },
  });

  function record(x) {
    detailsDialog({
      title: nameLine(x),
      panels: [
        { title: 'Rating', rows: [['Official No', x.serviceNumber], ['Name', x.name], ['Rate', x.rate], ['Sex', x.sex], ['Branch', x.branch], ['Specialisation', x.specialisation], ['Seniority Date', fmt(x.seniorityDate)]] },
        { title: 'Posting', rows: [['Ship or Unit', x.ship], ['Command', x.command], ['Joined Ship', fmt(x.joinedOn)], ['Months on Ship', x.months === null ? '' : String(x.months)]] },
      ],
      actions: [openRecordButton(x.serviceNumber)],
    });
  }

  outlet.replaceChildren(header(info, [out.printBtn, out.excelBtn]), stats, bar.el, count, prompt.el, lv.el);
  // a link from Disposition or Manning State arrives with a ship
  if (query.commandId) preset(bar, 'commandId', query.commandId);
  if (query.shipId) preset(bar, 'shipId', query.shipId);
  lv.reload({ resetPage: true });
}

// =====================================================================================================
// 5. Manning State
// =====================================================================================================
const DIFF_PILL = { short: 'error', over: 'warning', exact: 'success' };
const diffText = (d) => (d > 0 ? `+${d}` : String(d));
const diffPill = (x) => pill(diffText(x.difference), DIFF_PILL[x.state]);
const STATE_WORD = { short: 'short', over: 'over', exact: 'exact' };

export async function mountManningState(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const stats = h('div');
  const count = countLine();
  const bar = filterBar({
    fields: [
      select('commandId', 'Command', o.commands, 'All Commands'),
      { name: 'shipId', label: 'Ship or Unit', type: 'select', options: choicesOf(o.ships), placeholder: 'All Ships' },
      select('rateId', 'Rate', o.rates, 'All Rates'),
      select('specialisationId', 'Specialisation', o.specialisations, 'All Specialisations'),
      { name: 'short', label: 'Show', type: 'select', options: [{ value: '1', label: 'Short Only' }], placeholder: 'All Ships' },
    ],
    onChange: () => { fill(); lv.reload({ resetPage: true }); },
  });
  const fill = followCommand(bar, o);
  const out = outputs({ screen: 'reports.manning-state', pdfUrl: `${BASE}/manning-state/pdf`, excelUrl: `${BASE}/manning-state/excel`, pdfTitle: 'Manning State', pdfName: 'Manning State.pdf', excelName: 'Manning State.xlsx', query: () => bar.query() });

  const lv = list({
    columns: [
      { key: 'ship', label: 'Ship or Unit', render: (s) => h('b', { className: 'font-medium', text: s.ship }) },
      { key: 'required', label: 'Required', render: (s) => String(s.required), headClassName: 'w-28' },
      { key: 'borne', label: 'Borne', render: (s) => String(s.borne), headClassName: 'w-28' },
      { key: 'difference', label: 'Difference', render: diffPill, headClassName: 'w-32' },
    ],
    load: async ({ page }) => {
      const res = await api.get(`${BASE}/manning-state?${qs({ ...bar.query(), page })}`);
      const s = res.summary;
      stats.replaceChildren(figures([['Ships', s.ships, 'primary'], ['Required', s.required.toLocaleString()], ['Borne', s.borne.toLocaleString()], ['Short', s.short, s.short ? 'error' : undefined]]));
      return res;
    },
    rowKey: (s) => s.shipId,
    onPick: (s) => record(s),
    onLoaded: ({ meta }) => { count.textContent = plural(meta.total, 'ship or unit', 'ships and units'); out.enable(meta.total > 0); },
    card: { title: (s) => s.ship, subtitle: (s) => `Required ${s.required} · Borne ${s.borne}`, aside: diffPill },
    empty: { icon: 'clipboard-check', title: 'No Ships Found', text: 'No ship has a manning requirement that matches these filters.' },
  });

  function record(s) {
    const lines = h('div', { className: 'divide-y divide-border rounded-card border border-border', dataset: { manningLines: '' } }, s.lines.map((l) => h('div', { className: 'flex items-center gap-3 px-3 py-2' }, [
      h('div', { className: 'min-w-0 flex-1' }, [
        h('b', { className: 'block truncate text-sm font-medium', text: `${l.rateCode} · ${l.specialisation}` }),
        h('span', { className: 'block text-xs text-muted-foreground', text: `Required ${l.required} · Borne ${l.borne}` }),
      ]),
      diffPill(l),
    ])));
    detailsDialog({
      title: s.ship,
      panels: [{ title: 'Ship or Unit', rows: [['Ship or Unit', h('b', { text: s.ship })], ['Required', String(s.required)], ['Borne', String(s.borne)], ['Difference', diffPill(s)], ['State', `The ship is ${STATE_WORD[s.state]}`]] }],
      after: h('div', {}, [h('div', { className: 'mb-1.5 text-sm font-semibold text-brand', text: 'By Rate and Specialisation' }), lines]),
      actions: [rowLink('Nominal Roll', 'list', `#reports/nominal-roll?shipId=${s.shipId}`, 'reports.nominal-roll')],
    });
  }

  outlet.replaceChildren(header(info, [out.printBtn, out.excelBtn]), stats, bar.el, count, lv.el);
}

// =====================================================================================================
// 6. Retirement Forecast
// =====================================================================================================
export async function mountRetirementForecast(outlet, { info } = {}) {
  outlet.replaceChildren(loading());
  let o;
  try { o = await loadOptions(); } catch (err) { outlet.replaceChildren(failed(err)); return; }
  const stats = h('div');
  const strip = h('div');
  const count = countLine();
  const bar = filterBar({
    fields: [
      // 12 months is the default, so it is the placeholder; the choice offers the other two
      { name: 'months', label: 'Period', type: 'select', options: [{ value: '6', label: 'Next 6 Months' }, { value: '24', label: 'Next 24 Months' }], placeholder: 'Next 12 Months' },
      select('branchId', 'Branch', o.branches, 'All Branches'),
      select('rateId', 'Rate', o.rates, 'All Rates'),
      select('shipId', 'Ship or Unit', o.ships, 'All Ships'),
    ],
    onChange: () => lv.reload({ resetPage: true }),
  });
  const out = outputs({ screen: 'reports.retirement-forecast', pdfUrl: `${BASE}/retirement-forecast/pdf`, excelUrl: `${BASE}/retirement-forecast/excel`, pdfTitle: 'Retirement Forecast', pdfName: 'Retirement Forecast.pdf', excelName: 'Retirement Forecast.xlsx', query: () => bar.query() });
  const whyPill = (x) => pill(x.why === 'service' ? 'Service' : x.why === 'age' ? 'Age' : 'Age and Service', x.why === 'service' ? 'info' : 'warning');

  const lv = list({
    columns: [
      { key: 'serviceNumber', label: 'Official No', render: (x) => x.serviceNumber },
      { key: 'name', label: 'Name', render: (x) => two(x.name, x.rateCode), className: 'font-normal' },
      { key: 'ship', label: 'Ship or Unit', render: (x) => dash(x.ship) },
      { key: 'dueOn', label: 'Becomes Due', render: (x) => two(fmt(x.dueOn), x.whyText), className: 'font-normal' },
    ],
    load: async ({ page }) => {
      const res = await api.get(`${BASE}/retirement-forecast?${qs({ ...bar.query(), page })}`);
      const s = res.summary;
      const dischargeLink = can('discharge.process', 'view')
        ? h('a', { href: '#discharge/process', className: 'mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline', dataset: { dueTodayLink: '' } }, ['Open Process Discharge', icon('arrow-right', 'icon h-3.5 w-3.5')])
        : null;
      stats.replaceChildren(figures([[`Due in ${s.months} Months`, s.due.toLocaleString(), 'primary'], ['Already Due Today', s.dueToday.toLocaleString(), s.dueToday ? 'warning' : undefined, dischargeLink]]));
      strip.replaceChildren(countStrip('Each Quarter', s.quarters, 'quarterStrip'));
      return res;
    },
    rowKey: (x) => x.serviceNumber,
    onPick: (x) => record(x),
    onLoaded: ({ meta }) => { count.textContent = plural(meta.total, 'rating'); out.enable(meta.total > 0); },
    card: { title: (x) => nameLine(x), subtitle: (x) => `${x.serviceNumber} · ${x.ship || '-'}`, aside: (x) => pill(fmt(x.dueOn), x.why === 'service' ? 'info' : 'warning') },
    empty: { icon: 'calendar', title: 'Nobody Falls Due', text: 'No rating becomes due in this period with these filters. Choose a longer period.' },
  });

  function record(x) {
    detailsDialog({
      title: nameLine(x),
      panels: [
        { title: 'Rating', rows: [['Official No', x.serviceNumber], ['Name', x.name], ['Rate', x.rate], ['Ship or Unit', x.ship], ['Date of Birth', fmt(x.dateOfBirth)], ['Date Joined', fmt(x.dateEmployed)]] },
        { title: 'Becomes Due', rows: [['Becomes Due', h('b', { text: fmt(x.dueOn) })], ['Why', whyPill(x)], ['Rule', x.whyText], ['Age Reached On', fmt(x.ageDueOn)], ['Service Reached On', fmt(x.serviceDueOn)]] },
      ],
      actions: [openRecordButton(x.serviceNumber)],
    });
  }

  outlet.replaceChildren(header(info, [out.printBtn, out.excelBtn]), stats, strip, bar.el, count, lv.el);
}
