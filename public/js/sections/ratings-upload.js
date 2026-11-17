import { api } from '../core/api.js';
import { clear, el, showToast } from '../core/dom.js';

export async function mountRatingsUpload(outlet) {
  const sampleBtn = outlet.querySelector('#download-sample-btn');
  const form = outlet.querySelector('#batch-upload-form');
  const fileInput = outlet.querySelector('#batch-file-input');
  const submitBtn = outlet.querySelector('#batch-submit-btn');
  const resultPanel = outlet.querySelector('#batch-result-panel');

  sampleBtn.addEventListener('click', async () => {
    sampleBtn.disabled = true;
    try {
      await api.downloadFile('/api/ratings/batch-template', 'CIRERMS_Ratings_Batch_Upload_Template.xlsx');
      showToast('Batch upload Excel template downloaded.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to download template.', 'error');
    } finally {
      sampleBtn.disabled = false;
    }
  });

  function renderResult(summary) {
    clear(resultPanel);
    resultPanel.classList.remove('hidden');

    resultPanel.appendChild(
      el('h3', { className: 'text-sm font-semibold text-cirerms-ink', text: 'Batch Upload Processing Report' })
    );

    const kpiGrid = el('div', { className: 'grid grid-cols-2 sm:grid-cols-4 gap-3' }, [
      el('div', { className: 'rounded border border-gray-200 bg-gray-50 p-3' }, [
        el('div', { className: 'text-[11px] uppercase text-gray-500 font-semibold', text: 'Rows Read' }),
        el('div', { className: 'text-xl font-bold text-cirerms-ink mt-0.5', text: String(summary.totalRows) }),
      ]),
      el('div', { className: 'rounded border border-emerald-200 bg-emerald-50 p-3' }, [
        el('div', { className: 'text-[11px] uppercase text-emerald-700 font-semibold', text: 'Uploaded' }),
        el('div', { className: 'text-xl font-bold text-emerald-800 mt-0.5', text: String(summary.insertedCount) }),
      ]),
      el('div', { className: 'rounded border border-amber-200 bg-amber-50 p-3' }, [
        el('div', { className: 'text-[11px] uppercase text-amber-700 font-semibold', text: 'Duplicates Skipped' }),
        el('div', { className: 'text-xl font-bold text-amber-800 mt-0.5', text: String(summary.skippedDuplicateCount) }),
      ]),
      el('div', { className: 'rounded border border-red-200 bg-red-50 p-3' }, [
        el('div', { className: 'text-[11px] uppercase text-red-700 font-semibold', text: 'Row Errors' }),
        el('div', { className: 'text-xl font-bold text-red-800 mt-0.5', text: String(summary.errorCount) }),
      ]),
    ]);
    resultPanel.appendChild(kpiGrid);

    if (summary.inserted?.length > 0) {
      resultPanel.appendChild(
        el('div', { className: 'space-y-1.5' }, [
          el('h4', { className: 'text-xs font-semibold text-emerald-800 uppercase tracking-wider', text: 'Successfully Imported Ratings' }),
          el(
            'div',
            { className: 'flex flex-wrap gap-2' },
            summary.inserted.map((item) =>
              el('a', {
                href: `#ratings/edit/${encodeURIComponent(item.serviceNumber)}`,
                className: 'inline-flex items-center gap-1.5 rounded border border-emerald-300 bg-emerald-50/70 px-2.5 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100',
                text: `${item.serviceNumber} — ${item.fullName}`,
              })
            )
          ),
        ])
      );
    }

    if (summary.skippedDuplicates?.length > 0) {
      resultPanel.appendChild(
        el('div', { className: 'space-y-1.5' }, [
          el('h4', { className: 'text-xs font-semibold text-amber-800 uppercase tracking-wider', text: 'Skipped Duplicate Official Numbers' }),
          el(
            'ul',
            { className: 'list-disc pl-5 text-xs text-amber-900 space-y-1' },
            summary.skippedDuplicates.map((dup) =>
              el('li', { text: `Row ${dup.rowNumber} (${dup.serviceNumber}): ${dup.reason}` })
            )
          ),
        ])
      );
    }

    if (summary.errors?.length > 0) {
      resultPanel.appendChild(
        el('div', { className: 'space-y-1.5' }, [
          el('h4', { className: 'text-xs font-semibold text-red-800 uppercase tracking-wider', text: 'Rows Rejected Due to Validation Errors' }),
          el(
            'ul',
            { className: 'list-disc pl-5 text-xs text-red-800 space-y-1' },
            summary.errors.map((er) =>
              el('li', { text: `Row ${er.rowNumber} (${er.serviceNumber}): ${er.messages.join(' ')}` })
            )
          ),
        ])
      );
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = fileInput.files?.[0];
    if (!file) {
      showToast('Please select an .xlsx workbook before clicking Upload File.', 'error');
      return;
    }

    const fd = new FormData();
    fd.append('file', file);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    try {
      const res = await api.upload('/api/ratings/batch-upload', fd);
      renderResult(res.data);
      fileInput.value = '';
      showToast(
        `Processed ${res.data.totalRows} row(s): ${res.data.insertedCount} uploaded, ${res.data.skippedDuplicateCount} skipped.`,
        res.data.errorCount > 0 ? 'info' : 'success'
      );
    } catch (err) {
      showToast(err.message || 'Batch upload failed.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Upload File';
    }
  });
}
