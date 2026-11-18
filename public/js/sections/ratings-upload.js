/*
 * Batch Upload (#ratings/upload): three steps. 1 Download Template, 2 Upload
 * Workbook (choose the .xlsx), 3 Review and Commit: the server checks every
 * row, skips Official Numbers it already has and rows with errors, and adds
 * the rest in one transaction; the counts and the rows not added show after.
 */
import { api } from '../core/api.js';
import { icon } from '../core/icons.js';
import { h, cx, fill } from '../ui/html.js';
import { CARD, TH } from '../ui/classes.js';
import { button } from '../ui/button.js';
import { pageHeader } from '../ui/page-header.js';
import { pill } from '../ui/pill.js';
import { toast } from '../ui/toast.js';

function stepHead(n, title, state) {
  const done = state === 'done';
  return h('div', { className: 'flex items-center gap-3' }, [
    h('span', { className: cx('flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-semibold', done ? 'bg-primary text-primary-foreground' : state === 'on' ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground') }, done ? icon('check') : String(n)),
    h('h2', { className: 'text-sm font-semibold', text: title }),
  ]);
}

export function mountRatingsUpload(outlet) {
  let stage = 0; // 0 nothing yet, 1 template downloaded, 2 workbook chosen, 3 committed
  let file = null;
  let result = null;
  let busy = false;

  const input = h('input', { type: 'file', accept: '.xlsx', className: 'hidden', 'aria-label': 'Workbook' });
  input.addEventListener('change', () => {
    const f = input.files && input.files[0];
    input.value = '';
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) { toast('Choose an .xlsx workbook.', 'error'); return; }
    file = f;
    result = null;
    stage = 2;
    draw();
  });

  const s1 = h('section', { className: cx(CARD, 'space-y-3 p-4') });
  const s2 = h('section', { className: cx(CARD, 'space-y-3 p-4') });
  const s3 = h('section', { className: cx(CARD, 'space-y-3 p-4') });
  const report = h('div');

  async function template() {
    try {
      await api.downloadFile('/api/ratings/batch-template', 'CIRERMS_Ratings_Batch_Upload_Template.xlsx');
      if (stage < 1) stage = 1;
      toast('Template downloaded.');
      draw();
    } catch (err) {
      toast(err.message || 'Could not download the template.', 'error');
    }
  }

  async function commit() {
    if (!file || busy) return;
    busy = true;
    draw();
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.upload('/api/ratings/batch-upload', fd);
      result = res.data;
      stage = 3;
      toast(`${result.insertedCount} ${result.insertedCount === 1 ? 'rating' : 'ratings'} added.`, result.insertedCount ? 'success' : 'warning');
    } catch (err) {
      toast(err.message || 'The workbook could not be read.', 'error', { timeout: 8000 });
    } finally {
      busy = false;
      draw();
    }
  }

  const TONE = { success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', error: 'bg-error-soft text-error' };
  function count(n, label, tone) {
    return h('div', { className: cx('rounded-ctl p-2 text-center', TONE[tone]) }, [h('b', { className: 'block text-lg', text: String(n) }), h('span', { className: 'text-2xs', text: label })]);
  }

  function draw() {
    fill(s1, [
      stepHead(1, 'Download Template', stage === 0 ? 'on' : 'done'),
      h('p', { className: 'text-sm text-muted-foreground', text: 'The workbook lists every column and its allowed values. Keep its first row as it is.' }),
      button({ label: 'Download Template', icon: 'file-spreadsheet', variant: 'blue', onClick: template }),
    ]);

    fill(s2, [
      stepHead(2, 'Upload Workbook', stage >= 2 ? 'done' : 'on'),
      h('button', {
        type: 'button',
        className: 'flex w-full flex-col items-center gap-2 rounded-card border-2 border-dashed border-input bg-subtle px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15',
        onClick: () => input.click(),
      }, [
        icon('file-up', 'icon h-7 w-7'),
        file ? h('b', { className: 'break-all text-foreground', text: file.name }) : 'Choose an .xlsx workbook',
        file ? h('span', { text: stage === 3 ? 'Choose another workbook' : 'Choose a different file' }) : null,
      ]),
      input,
    ]);

    const committed = stage === 3 && result;
    fill(s3, [
      stepHead(3, 'Review and Commit', committed ? 'done' : stage === 2 ? 'on' : 'off'),
      committed
        ? h('div', { className: 'grid grid-cols-3 gap-2' }, [count(result.insertedCount, 'Added', 'success'), count(result.skippedDuplicateCount, 'Skipped', 'warning'), count(result.errorCount, 'Errors', 'error')])
        : h('p', { className: 'text-sm text-muted-foreground', text: file ? 'Each row is checked. Official Numbers already on file and rows with errors are skipped; the rest are added together.' : 'Choose a workbook to commit it.' }),
      button({
        label: committed ? `Committed (${result.totalRows} rows read)` : busy ? 'Committing' : 'Check and Commit',
        icon: committed ? 'check' : busy ? 'loader-circle' : 'check',
        variant: 'primary',
        className: 'w-full',
        disabled: !file || busy || committed,
        onClick: commit,
      }),
    ]);

    fill(report, committed ? resultReport(result) : null);
  }

  function resultReport(r) {
    const notAdded = [
      ...(r.errors || []).map((e) => ({ row: e.rowNumber, sn: e.serviceNumber, tone: 'error', label: 'Error', text: (e.messages || []).join(' ') })),
      ...(r.skippedDuplicates || []).map((e) => ({ row: e.rowNumber, sn: e.serviceNumber, tone: 'warning', label: 'Skipped', text: e.reason })),
    ].sort((a, b) => a.row - b.row);
    return [
      notAdded.length
        ? h('section', { className: cx(CARD, 'mt-4 overflow-hidden') }, [
            h('div', { className: 'border-b border-border px-4 py-3' }, h('h2', { className: 'text-sm font-semibold', text: 'Rows Not Added' })),
            h('div', { className: 'overflow-x-auto' }, h('table', { className: 'w-full text-sm' }, [
              h('thead', { className: 'bg-subtle' }, h('tr', {}, ['Row', 'Official No', 'Issue'].map((t) => h('th', { className: TH, scope: 'col', text: t })))),
              h('tbody', {}, notAdded.map((x) => h('tr', { className: 'border-t border-border' }, [
                h('td', { className: 'whitespace-nowrap px-4 py-2.5 font-medium', text: `Row ${x.row}` }),
                h('td', { className: 'whitespace-nowrap px-4 py-2.5', text: x.sn || '-' }),
                h('td', { className: 'px-4 py-2.5' }, [pill(x.label, x.tone), ' ', x.text]),
              ]))),
            ])),
          ])
        : null,
      (r.inserted || []).length
        ? h('section', { className: cx(CARD, 'mt-4 overflow-hidden') }, [
            h('div', { className: 'border-b border-border px-4 py-3' }, h('h2', { className: 'text-sm font-semibold', text: 'Ratings Added' })),
            h('ul', { className: 'flex flex-wrap gap-2 p-4' }, r.inserted.map((x) => h('li', {}, h('a', {
              href: `#ratings/edit/${encodeURIComponent(x.serviceNumber)}`,
              className: 'inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-subtle',
            }, [h('b', { text: x.serviceNumber }), x.fullName])))),
          ])
        : null,
    ];
  }

  outlet.replaceChildren(
    pageHeader({ title: 'Batch Upload', subtitle: 'Add many ratings from one workbook' }),
    h('div', { className: 'grid grid-cols-3 gap-4 phone:grid-cols-1' }, [s1, s2, s3]),
    report,
  );
  draw();
}
