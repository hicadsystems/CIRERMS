import { api, downloadFile } from '../core/api.js';
import { can } from '../core/access.js';
import { formatDisplayDate } from '../core/dates.js';
import { h } from '../ui/html.js';
import { CARD } from '../ui/classes.js';
import { button, actionGroup } from '../ui/button.js';
import { pageHeader } from '../ui/page-header.js';
import { listView } from '../ui/list-view.js';
import { openDialog } from '../ui/dialog.js';
import { confirmDialog } from '../ui/confirm.js';
import { ratingSearch } from '../ui/rating-search.js';
import { facts } from '../ui/facts.js';
import { field } from '../ui/field.js';
import { pill } from '../ui/pill.js';
import { emptyState } from '../ui/empty-state.js';
import { toast } from '../ui/toast.js';
import { openPdfPreview } from '../ui/pdf-preview.js';
import { navigate } from '../core/router.js';
import { icon } from '../core/icons.js';
import { statTile } from '../ui/stat-tile.js';
import { mountProcess as mountProcessDemo } from './discharge-process.js';
import { filterBar, rowTips } from './disciplinary-parts.js';

const BASE = '/api/discharge';
const fmt = (v) => formatDisplayDate(v) || '';
const cell = (v) => fmt(v) || '—';
const years = (n) => (n === null || n === undefined ? '' : `${n} ${n === 1 ? 'year' : 'years'}`);
const displayName = (r) => r.name || [r.surname, r.first_name, r.middle_name].filter(Boolean).join(' ');
const options = async () => (await api.get(`${BASE}/options`)).data;
const lookupOptions = (items) => items.map((x) => ({ value: x.id, label: x.name }));
const toQuery = (values) => new URLSearchParams(Object.entries(values).filter(([, v]) => v !== '' && v !== null && v !== undefined));

/** Finding a rating (current or former): a panel with the rating search select, Search and Reset; `show` draws what was found. */
function finder(outlet, { title, subtitle, show }) {
  const idle = () => emptyState({ icon: 'search', title: 'Find a Rating', text: 'Enter an Official Number or a name above. Current and former ratings are found.' });
  const search = ratingSearch({ name: 'serviceNumber', status: 'all', ariaLabel: 'Official No or Name', placeholder: 'Official number or name' });
  const result = h('div', { className: CARD }, idle());
  const find = () => load();
  const reset = () => { search.clear(); result.replaceChildren(idle()); };
  search.addEventListener('change', () => { if (search.value) find(); else result.replaceChildren(idle()); });
  const panel = h('div', { className: 'mb-3 flex flex-wrap items-end gap-3' }, [
    field({ label: 'Official No or Name', control: search, className: 'w-full desk:w-96' }),
    actionGroup([
      button({ label: 'Search', icon: 'search', variant: 'primary', onClick: find }),
      button({ label: 'Reset', icon: 'rotate-ccw', variant: 'outline', onClick: reset }),
    ]),
  ]);
  outlet.replaceChildren(pageHeader({ title, subtitle }), panel, result);
  async function load() {
    if (!search.value) {
      result.replaceChildren(emptyState({ icon: 'search', title: 'Choose a Rating', text: 'Pick a rating from the suggestions under the field.' }));
      return;
    }
    const sn = search.value;
    try {
      result.replaceChildren(await show(sn));
    } catch (error) {
      result.replaceChildren(emptyState({ icon: 'circle-alert', title: 'No Rating Found', text: 'Check the Official Number or the spelling, then search again.' }));
      toast(error.message || 'Rating not found.', 'error');
    }
  }
}

const ratingHead = (x) => h('div', { className: 'flex flex-wrap items-start justify-between gap-3' }, [
  h('div', {}, [
    h('h2', { className: 'text-lg font-semibold', text: displayName(x) }),
    h('p', { className: 'text-sm text-muted-foreground', text: [x.service_number, x.rate_name, x.status === 'current' ? x.current_ship_name : x.exit_date ? `Left ${fmt(x.exit_date)}` : ''].filter(Boolean).join(' · ') }),
  ]),
  pill(x.status === 'current' ? 'Current' : 'Former', x.status === 'current' ? 'success' : 'neutral'),
]);

const preview = (url, title, filename) => openPdfPreview({ url, title, filename });

export async function mountService(outlet) {
  finder(outlet, {
    title: 'Print Service Details', subtitle: 'The personnel details sheet of one rating',
    show: async (sn) => {
      const x = (await api.get(`${BASE}/service-details/${encodeURIComponent(sn)}`)).data;
      return h('div', { className: 'grid gap-4 p-4' }, [
        ratingHead(x),
        facts([
          ['Official No', x.service_number], ['Surname', x.surname], ['First Name', x.first_name], ['Middle Name', x.middle_name],
          ['Date of Birth', fmt(x.date_of_birth)], ['Telephone', x.phone],
          ['Rate History', x.rateHistory.length ? `${x.rateHistory.length} ${x.rateHistory.length === 1 ? 'line' : 'lines'}` : ''],
        ]),
        actionGroup([button({ label: 'Print Service Details', icon: 'printer', variant: 'blue', onClick: () =>
          preview(`${BASE}/service-details/${encodeURIComponent(sn)}/pdf`, 'Personnel Details', `${sn}-personnel-details.pdf`) })]),
      ]);
    },
  });
}

export async function mountForms(outlet) {
  finder(outlet, {
    title: 'Verification Forms', subtitle: 'Re-engagement Verification, Retirement Routine and Engagement Form',
    show: async (sn) => {
      const data = (await api.get(`${BASE}/verification/${encodeURIComponent(sn)}`)).data;
      const forms = [
        { kind: 'reengagement', title: 'Re-engagement Verification', available: !!data.reengagement, text: 'Verifies a re-engagement: its date, period and who approved it.', reason: 'No re-engagement is recorded. Use Re-engage on Process Discharge first.' },
        { kind: 'retirement', title: 'Retirement Routine', available: !!data.discharge, text: 'The release and clearance routine for a rating who is leaving.', reason: 'This rating has no discharge on file. Propose it on Process Discharge first.' },
        { kind: 'engagement', title: 'Engagement Form', available: true, text: 'Date employed, length of service and the engagement history.', reason: '' },
      ];
      return h('div', { className: 'grid gap-4 p-4' }, [
        ratingHead({ ...data.rating, rate_name: data.rating.rate_name }),
        h('div', { className: 'grid grid-cols-3 gap-3 phone:grid-cols-1' }, forms.map((f) => h('section', { className: `${CARD} flex flex-col gap-3 p-4` }, [
          h('h3', { className: 'font-semibold', text: f.title }),
          h('p', { className: 'flex-1 text-sm leading-relaxed text-muted-foreground', text: f.available ? f.text : f.reason }),
          button({ label: 'Preview', icon: 'file-text', variant: 'blue', disabled: !f.available, onClick: () =>
            preview(`${BASE}/verification/${encodeURIComponent(sn)}/${f.kind}/pdf`, f.title, `${sn}-${f.kind}.pdf`) }),
        ]))),
      ]);
    },
  });
}

export async function mountReport(outlet) {
  const o = await options();
  const dischargeTotal = statTile({ label: 'Discharges', value: 0, icon: 'log-out', tone: 'primary' });
  const scheduledTotal = statTile({ label: 'Scheduled', value: 0, icon: 'calendar', tone: 'brand' });
  const reengagementTotal = statTile({ label: 'Re-engagements', value: 0, icon: 'refresh-cw', tone: 'secondary' });
  const summary = h('div', { className: 'mb-3 grid grid-cols-3 gap-3 phone:grid-cols-1', dataset: { figures: '' } }, [dischargeTotal, scheduledTotal, reengagementTotal]);
  const bar = filterBar({
    fields: [
      { name: 'from', label: 'Exit From', type: 'date' }, { name: 'to', label: 'Exit To', type: 'date' },
      { name: 'exitTypeId', label: 'Exit Type', type: 'select', options: [...lookupOptions(o.exitTypes.filter((x) => !x.keepsCurrent)), { value: 'reengagement', label: 'Re-engagement' }], placeholder: 'All Types' },
      { name: 'rateId', label: 'Rate', type: 'select', options: lookupOptions(o.rates), placeholder: 'All Rates' },
      { name: 'branchId', label: 'Branch', type: 'select', options: lookupOptions(o.branches), placeholder: 'All Branches' },
    ],
    onChange: () => { warn(); rows.reload({ resetPage: true }); },
  });
  const notice = h('div');
  const warn = () => {
    const message = bar.bad();
    notice.replaceChildren(...(message ? [h('div', { className: 'mb-3 flex gap-2 rounded-ctl bg-warning-soft px-3 py-2 text-sm text-warning', role: 'alert' }, [icon('triangle-alert', 'icon mt-0.5 flex-none'), message])] : []));
  };
  const printButton = button({ label: 'Print PDF', icon: 'printer', variant: 'blue', disabled: true, onClick: () =>
    openPdfPreview({ url: `${BASE}/report/pdf?${toQuery(bar.query())}`, title: 'Discharge Report', filename: 'discharge-report.pdf' }) });
  const exportButton = button({ label: 'Export Excel', icon: 'file-spreadsheet', variant: 'outline', disabled: true, onClick: () =>
    downloadFile(`${BASE}/report/excel?${toQuery(bar.query())}`, 'discharge-report.xlsx').catch((error) => toast(error.message || 'Could not export the report.', 'error')) });
  const typePill = (r) => h('div', { className: 'grid justify-items-start gap-1' }, [
    pill(
      r.type === 'discharge' ? r.exit_type_name || 'Discharge' : 'Re-engagement',
      r.type === 'reengagement' ? 'success' : o.exitTypes.find((x) => x.name === r.exit_type_name)?.isDeath ? 'error' : r.exit_type_name === 'DISMISSED' ? 'warning' : 'info',
    ),
    r.status === 'scheduled' ? pill('Scheduled', 'warning') : null,
  ]);
  const reportName = (r) => String([r.surname, r.first_name, r.middle_name].filter(Boolean).join(' ')).toUpperCase();
  const rows = listView({
    autoLoad: false,
    columns: [
      { label: 'Official No', key: 'service_number' },
      { label: 'Name', render: (r) => h('div', { className: 'grid gap-1' }, [h('span', { text: reportName(r) }), h('span', { className: 'text-xs text-muted-foreground', text: r.rate_code || r.rate_name || '' })]) },
      { label: 'Type', render: typePill },
      { label: 'Exit Date', render: (r) => cell(r.exit_date) },
    ],
    load: async ({ page: pageNumber }) => {
      if (bar.bad()) return { data: [], meta: { page: 1, pageSize: 25, total: 0, totalPages: 1 } };
      const res = await api.get(`${BASE}/report?${toQuery({ ...bar.query(), page: pageNumber })}`);
      dischargeTotal.setValue(res.data.summary.discharges);
      scheduledTotal.setValue(res.data.summary.scheduled);
      reengagementTotal.setValue(res.data.summary.reengagements);
      printButton.disabled = !res.data.meta.total;
      exportButton.disabled = !res.data.meta.total;
      return { data: res.data.items, meta: res.data.meta };
    },
    onPick: (r) => reportDetails(r),
    rowKey: (r) => `${r.type}:${r.service_number}:${r.exit_date || r.reengage_date}`,
    card: { title: reportName, subtitle: (r) => `${r.service_number} · ${r.type === 'discharge' ? r.exit_type_name : 'Re-engagement'}`, aside: (r) => pill(r.status === 'scheduled' ? 'Scheduled' : r.type === 'discharge' ? 'Discharged' : 'Re-engaged', r.status === 'scheduled' ? 'warning' : r.type === 'discharge' ? 'success' : 'secondary') },
    empty: { icon: 'file-text', title: 'No Records in This Report', text: 'No closed discharge or re-engagement matches these filters. Widen the dates or the exit type.' },
  });
  rowTips(rows.el);
  outlet.replaceChildren(
    pageHeader({ title: 'Discharge Report', subtitle: 'Closed discharges and re-engagements, by exit date', actions: [printButton, exportButton] }),
    bar.el, notice, summary, rows.el,
  );
  function reportDetails(r) {
    const name = reportName(r);
    const proposal = r.proposal_number ? `${r.proposal_number}` : '';
    const dlg = openDialog({ title: name || r.service_number, body: facts([
      ['Official No', r.service_number], ['Type', r.type === 'discharge' ? r.exit_type_name || 'Discharge' : 'Re-engagement'],
      ['Status', r.status === 'scheduled' ? 'Scheduled' : r.type === 'discharge' ? 'Discharged' : 'Re-engaged'],
      [r.type === 'reengagement' ? 'Re-engagement Date' : 'Exit Date', fmt(r.exit_date || r.reengage_date)],
      ['Rate', r.rate_name], ['Branch', r.branch_name], ['Date Employed', fmt(r.date_employed)],
      ['Length of Service', years(r.years_service)],
      r.type === 'reengagement' ? ['Period', `${r.period_months} months`] : ['Exit Reason', r.exit_reason],
      r.type === 'reengagement' ? ['Ends', fmt(r.until_date)] : ['Proposal', proposal],
      ['Approved By', r.approved_by],
      r.type === 'discharge' ? ['Closed', r.recorded_at ? `${fmt(r.recorded_at)}${r.recorded_by_name ? ` by ${r.recorded_by_name}` : ''}` : ''] : ['Recorded', r.recorded_at ? `${fmt(r.recorded_at)}${r.recorded_by_name ? ` by ${r.recorded_by_name}` : ''}` : ''],
      r.type === 'discharge' ? ['Comment', r.comment] : null,
      r.type === 'discharge' ? ['Death Documents', [
        r.death_certificate ? 'Death Certificate' : null,
        r.condolence_letter ? 'Condolence Letter' : null,
        r.dependent_fund_evidence ? 'Evidence of Payment of Dependants Fund' : null,
        r.sworn_affidavit ? 'Sworn Affidavit as Next of Kin' : null,
      ].filter(Boolean).join(', ') || 'None recorded'] : null,
    ].filter(Boolean)) });
    const form = r.type === 'reengagement' ? 'reengagement' : 'retirement';
    const actions = [
      can('ratings.edit', 'view') ? button({ label: 'Open Record', icon: 'id-card', variant: 'outline', onClick: () => { dlg.close(); navigate(`#ratings/edit/${encodeURIComponent(r.service_number)}`); } }) : null,
      can('discharge.forms', 'view') ? button({ label: r.type === 'reengagement' ? 'Re-engagement Verification' : 'Retirement Routine', icon: 'file-text', variant: 'blue', onClick: () => openPdfPreview({
        url: `${BASE}/verification/${encodeURIComponent(r.service_number)}/${form}/pdf`,
        title: r.type === 'reengagement' ? 'Re-engagement Verification' : 'Retirement Routine',
        filename: `${r.service_number}-${form}.pdf`,
      }) }) : null,
      button({ label: 'Close', variant: 'outline', onClick: () => dlg.close() }),
    ].filter(Boolean);
    dlg.setFooter(actionGroup(actions));
  }
  rows.reload();
}

const UPLOAD_COLUMNS = ['Official No', 'Exit Type', 'Exit Date', 'Authority', 'Approved By', 'Comment'];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export async function mountUpload(outlet) {
  const mayImport = can('discharge.upload', 'add');
  let file = null;
  let checked = null; // the server's review of the whole file
  let refused = ''; // why the file was not read
  let imported = null;
  let busy = false;

  const input = h('input', { type: 'file', accept: '.xlsx', className: 'hidden', 'aria-label': 'Workbook', dataset: { uploadInput: '' } });
  input.addEventListener('change', () => {
    const f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    file = f;
    checked = null; refused = ''; imported = null;
    check();
  });

  const s1 = h('section', { className: `${CARD} space-y-3 p-4` });
  const s2 = h('section', { className: `${CARD} space-y-3 p-4` });
  const s3 = h('section', { className: `${CARD} space-y-3 p-4` });
  const report = h('div');

  const form = () => { const fd = new FormData(); fd.append('file', file); return fd; };
  async function check() {
    busy = true; draw();
    try {
      checked = (await api.upload(`${BASE}/upload/check`, form())).data;
      toast('File checked.');
    } catch (error) {
      refused = error.message || 'The file could not be read.';
      toast('The file could not be read.', 'error');
    } finally { busy = false; draw(); }
  }

  async function importNow() {
    const ok = await confirmDialog({
      title: 'Import Discharges',
      message: `Import ${plural(checked.ready, 'discharge')}? A past or today's exit date closes the discharge and the rating becomes Former at once; a later date is scheduled. ${checked.skipped} skipped and ${checked.errors} with errors are left out. A closed discharge is final.`,
      confirmLabel: `Import ${checked.ready}`,
      danger: true,
      icon: 'lock',
    });
    if (!ok) return;
    busy = true; draw();
    try {
      imported = (await api.upload(`${BASE}/upload/import`, form())).data;
      checked = imported;
      toast(`${plural(imported.imported, 'discharge')} imported.`);
    } catch (error) { toast(error.message || 'Could not import.', 'error'); } finally { busy = false; draw(); }
  }

  function stepHead(n, title, state) {
    const done = state === 'done';
    return h('div', { className: 'flex items-center gap-3' }, [
      h('span', { className: `flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-semibold ${done ? 'bg-primary text-primary-foreground' : state === 'on' ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground'}` }, done ? icon('check') : String(n)),
      h('h2', { className: 'text-sm font-semibold', text: title }),
    ]);
  }
  const TONE = { success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', error: 'bg-error-soft text-error' };
  const count = (n, label, tone) => h('div', { className: `rounded-ctl p-2 text-center ${TONE[tone]}` }, [h('b', { className: 'block text-lg', text: String(n) }), h('span', { className: 'text-2xs', text: label })]);
  const resultPill = (i) => (i.result === 'error' ? pill('Error', 'error') : pill('Skipped', 'warning'));
  const notice = (tone, ico, children) => h('div', { className: `flex items-start gap-2 rounded-card p-3 text-sm ${TONE[tone]}` }, [icon(ico, 'icon mt-0.5 h-4 w-4 flex-none'), h('p', {}, children)]);

  function draw() {
    const ok = !!checked;
    s1.replaceChildren(
      stepHead(1, 'Download Template', file ? 'done' : 'on'),
      h('p', { className: 'text-sm text-muted-foreground', text: 'One row for each discharge, keyed by official number. The rating’s name, rate and ship are read from its record, and the exit type stands as the reason.' }),
      h('div', { className: 'flex flex-wrap gap-1.5' }, UPLOAD_COLUMNS.map((c) => pill(c, 'neutral'))),
      button({ label: 'Download Template', icon: 'file-spreadsheet', variant: 'blue', onClick: () =>
        downloadFile(`${BASE}/upload/template`, 'Upload Discharge.xlsx').catch((error) => toast(error.message || 'Could not download the template.', 'error')) }),
    );
    s2.replaceChildren(...[
      stepHead(2, 'Choose File', ok ? 'done' : 'on'),
      h('button', {
        type: 'button', disabled: !mayImport || busy, dataset: { chooseFile: '' },
        className: 'flex w-full flex-col items-center gap-2 rounded-card border-2 border-dashed border-input bg-subtle px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 disabled:opacity-60',
        onClick: () => input.click(),
      }, [
        icon(busy ? 'loader-circle' : 'file-up', `icon h-7 w-7${busy ? ' animate-spin' : ''}`),
        file ? h('b', { className: 'break-all text-foreground', text: file.name }) : 'Choose an .xlsx workbook',
        file ? h('span', { text: refused ? 'Could not be read' : ok ? `${plural(checked.totalRows, 'row')} read` : 'Reading' }) : null,
      ]),
      input,
      mayImport ? null : h('p', { className: 'text-xs text-muted-foreground', text: 'You may download the template; importing needs the add privilege.' }),
    ].filter(Boolean));
    s3.replaceChildren(...[
      stepHead(3, 'Review and Import', imported ? 'done' : ok ? 'on' : 'off'),
      ok
        ? h('div', { className: 'grid grid-cols-3 gap-2', dataset: { uploadCounts: '' } }, [count(imported ? imported.imported : checked.ready, imported ? 'Imported' : 'Ready', 'success'), count(checked.skipped, 'Skipped', 'warning'), count(checked.errors, 'Errors', 'error')])
        : h('p', { className: 'text-sm text-muted-foreground', text: 'Choose a workbook to see what will be imported.' }),
      ok ? button({
        label: imported ? 'Imported' : `Import ${plural(checked.ready, 'Discharge')}`, icon: 'check', variant: 'primary', className: 'w-full',
        disabled: !!imported || busy || !checked.ready || !mayImport, onClick: importNow,
      }) : null,
    ].filter(Boolean));

    const parts = [];
    if (refused) parts.push(h('div', { className: 'mt-4', dataset: { uploadRefused: '' } }, notice('error', 'circle-alert', [h('b', { text: `${file.name} was not read. ` }), refused])));
    if (imported) {
      parts.push(h('div', { className: 'mt-4', dataset: { uploadDone: '' } }, notice('success', 'circle-check', [
        h('b', { text: `${plural(imported.imported, 'discharge')} imported` + (imported.proposalNumber ? ` in proposal ${imported.proposalNumber}. ` : '. ') }),
        `${imported.closed} closed and ${imported.scheduled} scheduled; ${imported.skipped} skipped and ${imported.errors} not imported because of errors.`,
      ])));
    }
    if (ok && checked.issues.length) {
      const issues = checked.issues;
      const lv = listView({
        columns: [
          { key: 'row', label: 'Row', render: (i) => String(i.row) },
          { key: 'serviceNumber', label: 'Official No', render: (i) => i.serviceNumber || '-' },
          { key: 'problem', label: 'Problem', render: (i) => h('span', { className: 'whitespace-normal', text: `${i.field}: ${i.problem}` }), className: 'whitespace-normal' },
          { key: 'result', label: 'Result', render: resultPill },
        ],
        load: async ({ page }) => ({ data: issues.slice((page - 1) * 25, page * 25), meta: { page, pageSize: 25, total: issues.length, totalPages: Math.max(1, Math.ceil(issues.length / 25)) } }),
        rowKey: (i) => `${i.row}:${i.result}:${i.field}`,
        onPick: (i) => openDialog({ title: `Row ${i.row}${i.serviceNumber ? ` · ${i.serviceNumber}` : ''}`, size: 'md', body: facts([['Row', String(i.row)], ['Official No', i.serviceNumber], ['Field', i.field], ['Result', resultPill(i)], ['Problem', i.problem]]) }),
        card: { title: (i) => `Row ${i.row} · ${i.serviceNumber || '-'}`, subtitle: (i) => i.problem, aside: resultPill },
        empty: { icon: 'circle-check', title: 'Every Row Is Ready' },
      });
      parts.push(h('div', { className: 'mt-4', dataset: { uploadIssues: '' } }, [
        h('div', { className: 'mb-2 flex items-center gap-3' }, [
          h('h2', { className: 'text-sm font-semibold', text: imported ? 'Rows Not Imported' : 'Rows Not Ready' }),
          h('div', { className: 'ml-auto' }, button({ label: 'Download Error Rows', icon: 'download', variant: 'ghost', onClick: () => downloadIssues(issues) })),
        ]),
        lv.el,
      ]));
    }
    report.replaceChildren(...parts);
  }

  function downloadIssues(issues) {
    const quote = (value) => `"${String(value ?? '').replace(/^[=+\-@]/, "'$&").replace(/"/g, '""')}"`;
    const rows = [['Row', 'Official No', 'Field', 'Result', 'Problem'], ...issues.map((x) => [x.row, x.serviceNumber, x.field, x.result, x.problem])];
    const csv = rows.map((row) => row.map(quote).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = h('a', { href: url, download: 'Discharge Rows Not Ready.csv' });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  outlet.replaceChildren(
    pageHeader({ title: 'Upload Discharge', subtitle: 'Close many discharges from one workbook' }),
    h('div', { className: 'grid grid-cols-3 gap-4 phone:grid-cols-1' }, [s1, s2, s3]),
    report,
  );
  draw();
}

export { mountProcessDemo as mountProcess };
