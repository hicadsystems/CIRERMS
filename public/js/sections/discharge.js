import { api, downloadFile } from '../core/api.js';
import { can } from '../core/access.js';
import { formatDisplayDate, parseDisplayDate, wireDateField } from '../core/dates.js';
import { h } from '../ui/html.js';
import { CARD, INPUT } from '../ui/classes.js';
import { button, actionGroup } from '../ui/button.js';
import { pageHeader } from '../ui/page-header.js';
import { listView } from '../ui/list-view.js';
import { openDialog } from '../ui/dialog.js';
import { confirmDialog } from '../ui/confirm.js';
import { ratingSearch } from '../ui/rating-search.js';
import { facts } from '../ui/facts.js';
import { field, textInput, selectInput, setFieldErrors, clearFieldErrors } from '../ui/field.js';
import { pill } from '../ui/pill.js';
import { emptyState } from '../ui/empty-state.js';
import { toast } from '../ui/toast.js';
import { openPdfPreview } from '../ui/pdf-preview.js';
import { navigate } from '../core/router.js';
import { icon } from '../core/icons.js';
import { statTile } from '../ui/stat-tile.js';
import { mountProcess as mountProcessDemo } from './discharge-process.js';

const BASE = '/api/discharge';
const fmt = (v) => formatDisplayDate(v) || '—';
const displayName = (r) => r.name || [r.surname, r.first_name, r.middle_name].filter(Boolean).join(' ');
const dateField = (name, value = '', label = 'dd/mm/yyyy') => field({
  label, control: wireDateField(textInput({ name, value: formatDisplayDate(value), placeholder: 'dd/mm/yyyy', inputmode: 'numeric', maxlength: '10' })),
});
const dateValue = (form, name) => parseDisplayDate(form.querySelector(`[name="${name}"]`)?.value || '');
const fieldValue = (form, name) => String(form.querySelector(`[name="${name}"]`)?.value || '').trim();
const options = async () => (await api.get(`${BASE}/options`)).data;
const page = (outlet, title, subtitle, actions = null) => outlet.replaceChildren(pageHeader({ title, subtitle, actions }));
const lookupOptions = (items) => items.map((x) => ({ value: x.id, label: x.name }));
const bodyText = (message) => h('p', { className: 'text-sm leading-relaxed', text: message });
const statusPill = (status) => pill(
  status === 'closed' ? 'Closed' : status === 'scheduled' ? 'Scheduled' : 'Pending',
  status === 'closed' ? 'success' : status === 'scheduled' ? 'warning' : 'neutral',
);
const toQuery = (values) => new URLSearchParams(Object.entries(values).filter(([, v]) => v !== '' && v !== null && v !== undefined));

export async function mountService(outlet) {
  page(outlet, 'Print Service Details', 'The personnel details sheet of one rating');
  const search = ratingSearch({ name: 'serviceNumber', status: 'all', ariaLabel: 'Official No or Name', placeholder: 'Official number or name' });
  const result = h('div', { className: 'mt-4' }, emptyState({ icon: 'search', title: 'Find a Rating', text: 'Enter an Official Number or a name above. Current and former ratings are found.' }));
  const find = button({ label: 'Search', icon: 'search', variant: 'primary', onClick: load });
  const reset = button({ label: 'Reset', icon: 'rotate-ccw', variant: 'outline', onClick: () => {
    search.clear();
    result.replaceChildren(emptyState({ icon: 'search', title: 'Find a Rating', text: 'Enter an Official Number or a name above. Current and former ratings are found.' }));
  } });
  const form = h('div', { className: 'grid max-w-xl gap-3' }, [
    field({ label: 'Official No or Name', control: search }),
    actionGroup([find, reset]),
  ]);
  outlet.append(form, result);
  async function load() {
    if (!search.value) {
      result.replaceChildren(emptyState({ icon: 'search', title: 'Find a Rating', text: 'Choose a rating from the search suggestions.' }));
      return;
    }
    try {
      const x = (await api.get(`${BASE}/service-details/${encodeURIComponent(search.value)}`)).data;
      const name = displayName(x);
      result.replaceChildren(h('section', { className: `${CARD} grid gap-4 p-4` }, [
        h('div', { className: 'flex flex-wrap items-start justify-between gap-3' }, [
          h('div', {}, [
            h('h2', { className: 'text-lg font-semibold', text: name }),
            h('p', { className: 'text-sm text-muted-foreground', text: `${x.service_number} · ${x.rate_name || '—'} · ${x.status === 'current' ? x.current_ship_name || '—' : `Left ${fmt(x.exit_date)}`}` }),
          ]),
          pill(x.status === 'current' ? 'Current' : 'Former', x.status === 'current' ? 'success' : 'neutral'),
        ]),
        h('div', { className: 'rounded-card border border-border p-4' }, [
          h('h3', { className: 'mb-3 text-sm font-semibold', text: 'Personnel Details' }),
          bodyText('Identity, date of birth, telephone and rate history (each rate, from and to).'),
          button({ label: 'Print Service Details', icon: 'printer', variant: 'primary', onClick: () =>
            openPdfPreview({ url: `${BASE}/service-details/${encodeURIComponent(search.value)}/pdf`, title: 'Personnel Details', filename: `${search.value}-personnel-details.pdf` }) }),
        ]),
      ]));
    } catch (error) {
      result.replaceChildren(emptyState({ icon: 'circle-alert', title: 'No Rating Found', text: 'Check the Official Number or the spelling, then search again.' }));
      toast.error(error.message || 'Rating not found.');
    }
  }
}

export async function mountForms(outlet) {
  page(outlet, 'Verification Forms', 'Re-engagement Verification, Retirement Routine and Engagement Form');
  const search = ratingSearch({ name: 'serviceNumber', status: 'all', ariaLabel: 'Official No or Name', placeholder: 'Official number or name' });
  const result = h('div', { className: 'mt-4' }, emptyState({ icon: 'search', title: 'Find a Rating', text: 'Enter an Official Number or a name above. Current and former ratings are found.' }));
  const form = h('div', { className: 'grid max-w-xl gap-3' }, [
    field({ label: 'Official No or Name', control: search }),
    actionGroup([
      button({ label: 'Search', icon: 'search', variant: 'primary', onClick: refresh }),
      button({ label: 'Reset', icon: 'rotate-ccw', variant: 'outline', onClick: () => {
        search.clear();
        result.replaceChildren(emptyState({ icon: 'search', title: 'Find a Rating', text: 'Enter an Official Number or a name above. Current and former ratings are found.' }));
      } }),
    ]),
  ]);
  outlet.append(form, result);
  async function refresh() {
    if (!search.value) {
      result.replaceChildren(emptyState({ icon: 'search', title: 'Find a Rating', text: 'Choose a rating from the search suggestions.' }));
      return;
    }
    try {
      const data = (await api.get(`${BASE}/verification/${encodeURIComponent(search.value)}`)).data;
      const cards = [
        { kind: 'reengagement', title: 'Re-engagement Verification', available: !!data.reengagement, text: 'Verifies a re-engagement: date, period and approval.', reason: 'No re-engagement is recorded. Use Re-engage on Process Discharge first.' },
        { kind: 'retirement', title: 'Retirement Routine', available: !!data.discharge, text: 'The release and clearance routine for a rating leaving.', reason: 'The rating has no discharge on file. Propose it on Process Discharge first.' },
        { kind: 'engagement', title: 'Engagement Form', available: true, text: 'Date employed, length of service and engagement history.', reason: '' },
      ];
      result.replaceChildren(
        h('section', { className: `${CARD} mb-3 grid gap-3 p-4` }, [
          h('div', { className: 'flex flex-wrap items-start justify-between gap-3' }, [
            h('div', {}, [
              h('h2', { className: 'text-lg font-semibold', text: displayName(data.rating) }),
              h('p', { className: 'text-sm text-muted-foreground', text: `${data.rating.service_number} · ${data.rating.rate_name || '—'} · ${data.rating.status === 'current' ? data.rating.current_ship_name || '—' : `Left ${fmt(data.rating.exit_date)}`}` }),
            ]),
            pill(data.rating.status === 'current' ? 'Current' : 'Former', data.rating.status === 'current' ? 'success' : 'neutral'),
          ]),
        ]),
        h('div', { className: 'grid grid-cols-3 gap-3 phone:grid-cols-1' }, cards.map((x) => h('section', { className: `${CARD} flex flex-col gap-3 p-4` }, [
        h('h2', { className: 'font-semibold', text: x.title }),
        h('p', { className: 'flex-1 text-sm leading-relaxed text-muted-foreground', text: x.available ? x.text : x.reason }),
        button({ label: 'Preview', icon: 'file-text', variant: 'outline', disabled: !x.available, onClick: () =>
          openPdfPreview({ url: `${BASE}/verification/${encodeURIComponent(search.value)}/${x.kind}/pdf`, title: x.title, filename: `${search.value}-${x.kind}.pdf` }) }),
      ]))),
      );
    } catch (error) {
      result.replaceChildren(emptyState({ icon: 'circle-alert', title: 'No Rating Found', text: 'Check the Official Number or the spelling, then search again.' }));
      toast.error(error.message || 'Could not load verification form details.');
    }
  }
}

export async function mountReport(outlet) {
  const o = await options();
  page(outlet, 'Discharge Report', 'Closed discharges and re-engagements');
  let filter = { from: '', to: '', exitTypeId: '', rateId: '', branchId: '' };
  const from = wireDateField(textInput({ name: 'from', placeholder: 'dd/mm/yyyy', inputmode: 'numeric', maxlength: '10' }));
  const to = wireDateField(textInput({ name: 'to', placeholder: 'dd/mm/yyyy', inputmode: 'numeric', maxlength: '10' }));
  const exitType = selectInput({ name: 'exitTypeId', options: [...lookupOptions(o.exitTypes), { value: 'reengagement', label: 'Re-engagement' }], placeholder: 'All Types' });
  const rate = selectInput({ name: 'rateId', options: lookupOptions(o.rates), placeholder: 'All Rates' });
  const branch = selectInput({ name: 'branchId', options: lookupOptions(o.branches), placeholder: 'All Branches' });
  const dischargeTotal = statTile({ label: 'Discharges', value: 0, icon: 'log-out', tone: 'primary' });
  const scheduledTotal = statTile({ label: 'Scheduled', value: 0, icon: 'calendar-clock', tone: 'brand' });
  const reengagementTotal = statTile({ label: 'Re-engagements', value: 0, icon: 'rotate-cw', tone: 'secondary' });
  const summary = h('div', { className: 'mb-3 grid grid-cols-3 gap-3 phone:grid-cols-1' }, [dischargeTotal, scheduledTotal, reengagementTotal]);
  const rows = listView({
    autoLoad: false,
    columns: [
      { label: 'Official No', key: 'service_number' },
      { label: 'Name', render: (r) => [r.surname, r.first_name, r.middle_name].filter(Boolean).join(' ') },
      { label: 'Type', render: (r) => h('div', { className: 'grid justify-items-start gap-1' }, [
        pill(
          r.type === 'discharge' ? r.exit_type_name || 'Discharge' : 'Re-engagement',
          r.type === 'reengagement' ? 'success' : o.exitTypes.find((x) => x.name === r.exit_type_name)?.isDeath ? 'error' : r.exit_type_name === 'Dismissed' ? 'warning' : 'info',
        ),
        r.status === 'scheduled' ? pill('Scheduled', 'warning') : null,
      ]) },
      { label: 'Exit Date', render: (r) => fmt(r.exit_date) },
    ],
    load: async ({ page: pageNumber }) => {
      const query = toQuery({ ...filter, page: pageNumber });
      const res = await api.get(`${BASE}/report?${query}`);
      dischargeTotal.setValue(res.data.summary.discharges);
      scheduledTotal.setValue(res.data.summary.scheduled);
      reengagementTotal.setValue(res.data.summary.reengagements);
      printButton.disabled = !res.data.meta.total;
      exportButton.disabled = !res.data.meta.total;
      return { data: res.data.items, meta: res.data.meta };
    },
    onPick: (r) => reportDetails(r),
    rowKey: (r) => `${r.type}:${r.service_number}:${r.exit_date || r.reengage_date}`,
    card: { title: (r) => [r.surname, r.first_name, r.middle_name].filter(Boolean).join(' '), subtitle: (r) => `${r.service_number} · ${r.type === 'discharge' ? r.exit_type_name : 'Re-engagement'}`, aside: (r) => pill(r.status === 'scheduled' ? 'Scheduled' : r.type === 'discharge' ? 'Discharged' : 'Re-engaged', r.status === 'scheduled' ? 'warning' : r.type === 'discharge' ? 'success' : 'secondary') },
    empty: {
      icon: 'file-text', title: 'No Records in This Report', text: 'No closed discharge or re-engagement matches these filters.',
      action: button({ label: 'Reset Filters', icon: 'rotate-ccw', variant: 'outline', onClick: resetReportFilters }),
    },
  });
  const filtersPanel = h('div', { className: `${CARD} mb-3 grid grid-cols-5 gap-3 p-3 phone:grid-cols-1` }, [
    field({ label: 'Exit From', control: from }), field({ label: 'Exit To', control: to }),
    field({ label: 'Exit Type', control: exitType }), field({ label: 'Rate', control: rate }), field({ label: 'Branch', control: branch }),
    actionGroup([
      button({ label: 'Search', icon: 'search', variant: 'primary', onClick: apply }),
      button({ label: 'Reset', icon: 'rotate-ccw', variant: 'outline', onClick: resetReportFilters }),
    ], { className: 'col-span-5 phone:col-span-1' }),
  ]);
  [from, to].forEach((input) => input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); apply(); }
  }));
  const printButton = button({ label: 'Print PDF', icon: 'printer', variant: 'outline', disabled: true, onClick: () => {
      const query = validatedFilter();
      if (query) openPdfPreview({ url: `${BASE}/report/pdf?${toQuery(query)}`, title: 'Discharge Report', filename: 'discharge-report.pdf' });
  } });
  const exportButton = button({ label: 'Export Excel', icon: 'download', variant: 'primary', disabled: true, onClick: exportExcel });
  outlet.replaceChildren(pageHeader({ title: 'Discharge Report', subtitle: 'Closed discharges and re-engagements, by exit date', actions: [printButton, exportButton] }), filtersPanel, summary, rows.el);
  function validatedFilter() {
    const fromDate = dateValue(filtersPanel, 'from');
    const toDate = dateValue(filtersPanel, 'to');
    const errors = {};
    if (from.value && fromDate === null) errors.from = 'Use a real date in dd/mm/yyyy format.';
    if (to.value && toDate === null) errors.to = 'Use a real date in dd/mm/yyyy format.';
    if (fromDate && toDate && fromDate > toDate) errors.from = 'From date must be on or before To date.';
    if (Object.keys(errors).length) { setFieldErrors(filtersPanel, errors); return null; }
    clearFieldErrors(filtersPanel);
    return { from: fromDate, to: toDate, exitTypeId: exitType.value, rateId: rate.value, branchId: branch.value };
  }
  function apply() {
    const next = validatedFilter();
    if (!next) return;
    filter = next;
    rows.reload({ resetPage: true });
  }
  function resetReportFilters() {
    from.value = '';
    to.value = '';
    exitType.value = '';
    rate.value = '';
    branch.value = '';
    apply();
  }
  function exportExcel() {
    const query = validatedFilter();
    if (!query) return;
    downloadFile(`${BASE}/report/excel?${toQuery(query)}`, 'discharge-report.xlsx')
      .catch((error) => toast.error(error.message || 'Could not export report.'));
  }
  function reportDetails(r) {
    const name = [r.surname, r.first_name, r.middle_name].filter(Boolean).join(' ');
    const dlg = openDialog({ title: name || r.service_number, body: facts([
      ['Official No', r.service_number], ['Type', r.type === 'discharge' ? r.exit_type_name || 'Discharge' : 'Re-engagement'],
      ['Status', r.status === 'scheduled' ? 'Scheduled' : r.type === 'discharge' ? 'Discharged' : 'Re-engaged'],
      [r.type === 'reengagement' ? 'Re-engagement Date' : 'Exit Date', fmt(r.exit_date || r.reengage_date)],
      ['Rate', r.rate_name || '—'], ['Branch', r.branch_name || '—'], ['Date Employed', fmt(r.date_employed)],
      ['Length of Service', `${r.years_service ?? '—'} years`],
      r.type === 'reengagement' ? ['Period', `${r.period_months} months`] : ['Exit Reason', r.exit_reason || '—'],
      r.type === 'reengagement' ? ['Ends', fmt(r.until_date)] : ['Proposal', r.proposal_number || '—'],
      ['Approved By', r.approved_by || '—'],
      r.type === 'discharge' ? ['Closed', `${fmt(r.recorded_at)} by ${r.recorded_by_name || '—'}`] : ['Recorded', `${fmt(r.recorded_at)} by ${r.recorded_by_name || '—'}`],
      r.type === 'discharge' ? ['Comment', r.comment || '—'] : null,
      r.type === 'discharge' ? ['Death Documents', [
        r.death_certificate ? 'Death Certificate' : null,
        r.condolence_letter ? 'Condolence Letter' : null,
        r.dependent_fund_evidence ? 'Evidence of Payment of Dependants Fund' : null,
        r.sworn_affidavit ? 'Sworn Affidavit as Next of Kin' : null,
      ].filter(Boolean).join(', ') || 'None recorded'] : null,
    ].filter(Boolean)) });
    const actions = [
      can('ratings.edit', 'view') ? button({ label: 'Open Record', icon: 'id-card', variant: 'outline', onClick: () => { dlg.close(); navigate(`#ratings/edit/${encodeURIComponent(r.service_number)}`); } }) : null,
      can('discharge.forms', 'view') ? button({ label: r.type === 'reengagement' ? 'Re-engagement Verification' : 'Retirement Routine', icon: 'file-text', variant: 'primary', onClick: () => openPdfPreview({
        url: `${BASE}/verification/${encodeURIComponent(r.service_number)}/${r.type === 'reengagement' ? 'reengagement' : 'retirement'}/pdf`,
        title: r.type === 'reengagement' ? 'Re-engagement Verification' : 'Retirement Routine',
        filename: `${r.service_number}-${r.type === 'reengagement' ? 'reengagement' : 'retirement'}.pdf`,
      }) }) : null,
      button({ label: 'Close', variant: 'outline', onClick: () => dlg.close() }),
    ].filter(Boolean);
    dlg.setFooter(actionGroup(actions));
  }
  rows.reload();
}

export async function mountUpload(outlet) {
  page(outlet, 'Upload Discharge', 'Close many discharges from one workbook');
  const file = textInput({ name: 'file', type: 'file', accept: '.xlsx', 'aria-label': 'Excel workbook', className: 'file:mr-3 file:rounded-ctl file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground' });
  const review = h('div', { className: 'mt-4' });
  let checked = false;
  let result = null;
  let uploadStep = 1;
  const stepHeads = [1, 2, 3].map((number) => ({
    number,
    badge: h('span', { className: 'flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-semibold' }),
  }));
  const stepHeading = (number, title) => h('div', { className: 'flex items-center gap-3' }, [
    stepHeads[number - 1].badge,
    h('h2', { className: 'text-sm font-semibold', text: title }),
  ]);
  const setUploadStep = (step) => {
    uploadStep = step;
    stepHeads.forEach(({ number, badge }) => {
      const done = number < uploadStep;
      badge.className = `flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-semibold ${done ? 'bg-primary text-primary-foreground' : number === uploadStep ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground'}`;
      badge.replaceChildren(done ? icon('check') : String(number));
    });
  };
  setUploadStep(uploadStep);
  const template = button({ label: 'Download Template', icon: 'download', variant: 'outline', onClick: () =>
    downloadFile(`${BASE}/upload/template`, 'Upload Discharge.xlsx').catch((error) => toast.error(error.message || 'Could not download template.')) });
  const check = button({ label: 'Review Workbook', icon: 'search-check', variant: 'primary', disabled: true, onClick: checkWorkbook });
  const importButton = can('discharge.upload', 'add')
    ? button({ label: 'Import Discharges', icon: 'upload', variant: 'primary', disabled: true, onClick: importWorkbook })
    : null;
  const fileField = field({ label: 'Excel Workbook', control: file, hint: 'Choose a completed .xlsx template. Review does not change any records.' });
  const cards = h('div', { className: 'grid grid-cols-3 gap-3 phone:grid-cols-1' }, [
    h('section', { className: `${CARD} grid content-start gap-3 p-4` }, [
      stepHeading(1, 'Download Template'),
      bodyText('Use one row for each discharge. The rating’s name, rate and ship are read from its record.'),
      h('div', { className: 'flex flex-wrap gap-1.5' }, ['Official No', 'Exit Type', 'Exit Date', 'Authority', 'Approved By', 'Comment'].map((x) => pill(x, 'neutral'))),
      template,
    ]),
    h('section', { className: `${CARD} grid content-start gap-3 p-4` }, [
      stepHeading(2, 'Choose File'),
      h('p', { className: 'text-sm text-muted-foreground', text: 'Select the completed workbook to begin the review.' }),
      fileField,
    ]),
    h('section', { className: `${CARD} grid content-start gap-3 p-4` }, [
      stepHeading(3, 'Review and Import'),
      h('p', { className: 'text-sm text-muted-foreground', text: 'Check the ready, skipped and error rows before importing.' }),
      actionGroup([check, importButton].filter(Boolean)),
      review,
    ]),
  ]);
  outlet.append(cards);
  file.addEventListener('change', () => {
    checked = false;
    result = null;
    if (importButton) importButton.disabled = true;
    check.disabled = !file.files || !file.files[0];
    setUploadStep(file.files && file.files[0] ? 2 : 1);
    review.replaceChildren();
  });

  async function upload() {
    if (!file.files || !file.files[0]) { toast.error('Choose an Excel workbook.'); return null; }
    const data = new FormData();
    data.append('file', file.files[0]);
    return api.upload(`${BASE}/upload/${checked ? 'import' : 'check'}`, data);
  }
  async function checkWorkbook() {
    try {
      const data = await upload();
      if (!data) return;
      result = data.data;
      checked = true;
      setUploadStep(3);
      if (importButton) importButton.disabled = result.ready === 0;
      renderReview(result, false);
    } catch (error) { toast.error(error.message || 'Could not review workbook.'); }
  }
  async function importWorkbook() {
    if (!checked || !result) { toast.error('Review the workbook before importing.'); return; }
    if (!await confirmDialog({
      title: 'Import Discharge Rows',
      message: `Import ${result.ready} ready discharge(s)? Past and today's exit dates close the discharge; future dates are scheduled. The exit type is recorded as the reason. Errors and skipped rows are not imported.`,
      confirmLabel: 'Import Discharges',
    })) return;
    try {
      const data = await upload();
      if (!data) return;
      result = data.data;
      checked = false;
      if (importButton) importButton.disabled = true;
      setUploadStep(3);
      renderReview(result, true);
      toast.success(`${result.imported} discharge(s) imported.`);
    } catch (error) { toast.error(error.message || 'Could not import workbook.'); }
  }
  function renderReview(data, imported) {
    const issues = data.issues || [];
    const issueText = (r) => `${r.field || 'Row'}: ${r.problem || r.message || ''}`;
    const issueList = listView({
      columns: [
        { label: 'Row', key: 'row' },
        { label: 'Official No', key: 'serviceNumber' },
        { label: 'Result', render: (r) => pill(r.result, r.result === 'error' ? 'error' : 'warning') },
        { label: 'Details', render: issueText },
      ],
      load: async () => ({ data: issues, meta: { page: 1, pageSize: 25, total: issues.length, totalPages: 1 } }),
      rowKey: (r) => `${r.row}:${r.serviceNumber}:${r.result}`,
      card: { title: (r) => `Row ${r.row} · ${r.serviceNumber || '—'}`, subtitle: issueText, aside: (r) => pill(r.result, r.result === 'error' ? 'error' : 'warning') },
      empty: { icon: 'circle-check', title: imported ? 'Import Complete' : 'No Issues Found', text: imported ? 'All ready rows were imported.' : 'All rows are ready to import.' },
    });
    const summary = h('div', { className: 'grid grid-cols-3 gap-2 phone:grid-cols-1' }, [
      statTile({ label: imported ? 'Imported' : 'Ready', value: imported ? data.imported : data.ready, icon: 'circle-check', tone: 'primary' }),
      statTile({ label: 'Skipped', value: data.skipped, icon: 'skip-forward', tone: 'brand' }),
      statTile({ label: 'Errors', value: data.errors, icon: 'circle-alert', tone: 'destructive' }),
    ]);
    const issuesHead = issues.length ? h('div', { className: 'mb-2 flex items-center gap-2' }, [
      h('h3', { className: 'text-sm font-semibold', text: `Rows Not ${imported ? 'Imported' : 'Ready'}` }),
      button({ label: 'Download Issue Rows', icon: 'download', variant: 'ghost', className: 'ml-auto', onClick: () => downloadIssues(issues) }),
    ]) : null;
    review.replaceChildren(
      h('p', { className: 'mb-2 text-xs text-muted-foreground', text: `${data.totalRows} row(s) read${imported ? ` · ${data.closed || 0} closed · ${data.scheduled || 0} scheduled` : ''}` }),
      summary, issuesHead, issues.length ? issueList.el : emptyState({ icon: 'circle-check', title: imported ? 'Import Complete' : 'No Issues Found', text: imported ? `${data.imported} discharges imported.` : 'All rows are ready to import.' }),
    );
  }
  function downloadIssues(issues) {
    const quote = (value) => {
      const text = String(value ?? '').replace(/^[=+\-@]/, "'$&");
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = [['Row', 'Official No', 'Field', 'Result', 'Problem'], ...issues.map((x) => [x.row, x.serviceNumber, x.field, x.result, x.problem])];
    const csv = rows.map((row) => row.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = h('a', { href: url, download: 'discharge-upload-issues.csv' });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export { mountProcessDemo as mountProcess };
