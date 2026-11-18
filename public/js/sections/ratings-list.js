import { api } from '../core/api.js';
import { clear, el, previewBlobModal, showToast } from '../core/dom.js';
import { formatDisplayDate } from '../core/dates.js';
import { navigate } from '../core/router.js';

export async function mountRatingsList(outlet, { status = 'current' }) {
  const state = {
    status,
    officialNo: '',
    name: '',
    search: '',
    sortBy: 'service_number',
    sortDir: 'asc',
    page: 1,
    pageSize: 10,
    items: [],
    total: 0,
    totalPages: 1,
  };

  const filterForm = outlet.querySelector('#list-filter-form');
  const officialInput = outlet.querySelector('#filter-official-no');
  const nameInput = outlet.querySelector('#filter-name');
  const resetBtn = outlet.querySelector('#filter-reset-btn');
  const pageSizeSelect = outlet.querySelector('#list-page-size');
  const quickSearchInput = outlet.querySelector('#list-quick-search');
  const theadRow = outlet.querySelector('#list-thead-row');
  const tbody = outlet.querySelector('#list-tbody');
  const summaryText = outlet.querySelector('#list-summary-text');
  const prevBtn = outlet.querySelector('#page-prev-btn');
  const nextBtn = outlet.querySelector('#page-next-btn');
  const pageNumbers = outlet.querySelector('#page-numbers');

  const columns = status === 'former'
    ? [
        { key: 'service_number', label: 'Official No', sortable: true },
        { key: 'first_name', label: 'First Name', sortable: true },
        { key: 'middle_name', label: 'Middle Name', sortable: true },
        { key: 'surname', label: 'Last Name', sortable: true },
        { key: 'rate_name', label: 'Rate', sortable: true },
        { key: 'exit_date', label: 'Exit Date', sortable: true },
        { key: 'exit_type_name', label: 'Exit Reason', sortable: true },
        { key: 'actions', label: 'Action', sortable: false },
      ]
    : [
        { key: 'service_number', label: 'Service No', sortable: true },
        { key: 'first_name', label: 'First Name', sortable: true },
        { key: 'middle_name', label: 'Middle Name', sortable: true },
        { key: 'surname', label: 'Last Name', sortable: true },
        { key: 'rate_name', label: 'Rate', sortable: true },
        { key: 'current_ship_name', label: 'Current Ship', sortable: true },
        { key: 'actions', label: 'Action', sortable: false },
      ];

  function renderHeader() {
    clear(theadRow);
    for (const col of columns) {
      if (!col.sortable) {
        theadRow.appendChild(el('th', { className: 'py-3 px-4 whitespace-nowrap', text: col.label }));
        continue;
      }
      const isSorted = state.sortBy === col.key;
      const arrow = isSorted ? (state.sortDir === 'asc' ? ' ▲' : ' ▼') : ' ⇅';
      const th = el(
        'th',
        {
          className: 'py-3 px-4 whitespace-nowrap cursor-pointer select-none hover:bg-gray-50',
          onClick: () => {
            if (state.sortBy === col.key) {
              state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
            } else {
              state.sortBy = col.key;
              state.sortDir = 'asc';
            }
            state.page = 1;
            loadData();
          },
        },
        [
          el('span', { text: col.label }),
          el('span', { className: `text-[10px] ml-1 ${isSorted ? 'text-cirerms-sidebar' : 'text-gray-300'}`, text: arrow }),
        ]
      );
      theadRow.appendChild(th);
    }
  }

  async function handlePrintReport(serviceNumber) {
    try {
      const url = `/api/ratings/${encodeURIComponent(serviceNumber)}/pdf`;
      const { blob, mimeType, fileName } = await api.fetchBlob(url);
      previewBlobModal({
        title: `Personnel Dossier — ${serviceNumber}`,
        blob,
        mimeType,
        fileName: fileName || `CIRERMS_Dossier_${serviceNumber}.pdf`,
      });
    } catch (err) {
      showToast(err.message || 'Failed to generate Print Report PDF.', 'error');
    }
  }

  function renderRows() {
    clear(tbody);
    if (state.items.length === 0) {
      tbody.appendChild(
        el('tr', {}, [
          el('td', {
            colSpan: columns.length,
            className: 'py-10 px-4 text-center text-sm text-gray-500',
            text: 'No matching ratings records found.',
          }),
        ])
      );
      return;
    }

    for (const row of state.items) {
      const tr = el('tr', { className: 'hover:bg-sky-50/30 transition' });
      tr.appendChild(el('td', { className: 'py-3 px-4 font-medium text-cirerms-ink whitespace-nowrap', text: row.service_number }));
      tr.appendChild(el('td', { className: 'py-3 px-4 whitespace-nowrap', text: row.first_name || '' }));
      tr.appendChild(el('td', { className: 'py-3 px-4 whitespace-nowrap', text: row.middle_name || '' }));
      tr.appendChild(el('td', { className: 'py-3 px-4 whitespace-nowrap', text: row.surname || '' }));
      tr.appendChild(el('td', { className: 'py-3 px-4 whitespace-nowrap text-xs text-gray-600', text: row.rate_name || '-' }));

      if (status === 'former') {
        tr.appendChild(el('td', { className: 'py-3 px-4 whitespace-nowrap text-xs', text: formatDisplayDate(row.exit_date) || '-' }));
        tr.appendChild(el('td', { className: 'py-3 px-4 whitespace-nowrap text-xs', text: row.exit_type_name || '-' }));
      } else {
        tr.appendChild(el('td', { className: 'py-3 px-4 whitespace-nowrap text-xs text-gray-600', text: row.current_ship_name || '-' }));
      }

      const actionCell = el('td', { className: 'py-2.5 px-4 whitespace-nowrap' }, [
        el('div', { className: 'inline-flex items-center gap-1.5' }, [
          el('button', {
            type: 'button',
            className: 'cirerms-btn-blue text-xs px-3 py-1.5',
            text: 'Edit',
            onClick: () => navigate(`#ratings/edit/${encodeURIComponent(row.service_number)}`),
          }),
          el('button', {
            type: 'button',
            className: 'cirerms-btn-blue text-xs px-3 py-1.5',
            text: 'Print Report',
            onClick: () => handlePrintReport(row.service_number),
          }),
        ]),
      ]);
      tr.appendChild(actionCell);
      tbody.appendChild(tr);
    }
  }

  function renderPagination() {
    const startIdx = state.total === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
    const endIdx = Math.min(state.page * state.pageSize, state.total);
    summaryText.textContent = `Showing ${startIdx} to ${endIdx} of ${state.total} entries`;

    prevBtn.disabled = state.page <= 1;
    nextBtn.disabled = state.page >= state.totalPages;

    clear(pageNumbers);
    const maxButtons = 5;
    let startPage = Math.max(1, state.page - 2);
    const endPage = Math.min(state.totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let p = startPage; p <= endPage; p += 1) {
      const active = p === state.page;
      pageNumbers.appendChild(
        el('button', {
          type: 'button',
          className: active
            ? 'rounded bg-cirerms-blue px-3 py-1.5 text-xs font-semibold text-on-fill'
            : 'rounded border border-cirerms-border bg-background px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50',
          text: String(p),
          onClick: () => {
            if (p !== state.page) {
              state.page = p;
              loadData();
            }
          },
        })
      );
    }

    const hasFilters = Boolean(state.officialNo || state.name || state.search);
    resetBtn.classList.toggle('hidden', !hasFilters);
  }

  function buildFilterQuery(extra = {}) {
    const qs = new URLSearchParams({
      status: state.status,
      sortBy: state.sortBy,
      sortDir: state.sortDir,
      ...extra,
    });
    if (state.officialNo) qs.set('officialNo', state.officialNo);
    if (state.name) qs.set('name', state.name);
    if (state.search) qs.set('search', state.search);
    return qs.toString();
  }

  async function loadData() {
    renderHeader();
    try {
      const qs = buildFilterQuery({
        page: String(state.page),
        pageSize: String(state.pageSize),
      });
      const res = await api.get(`/api/ratings?${qs}`);
      state.items = res.data || [];
      state.total = res.meta?.total || 0;
      state.page = res.meta?.page || 1;
      state.totalPages = res.meta?.totalPages || 1;
      renderRows();
      renderPagination();
    } catch (err) {
      showToast(err.message || 'Failed to load ratings list.', 'error');
    }
  }

  // Event wiring
  filterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.officialNo = officialInput.value.trim();
    state.name = nameInput.value.trim();
    state.page = 1;
    loadData();
  });

  resetBtn.addEventListener('click', () => {
    officialInput.value = '';
    nameInput.value = '';
    quickSearchInput.value = '';
    state.officialNo = '';
    state.name = '';
    state.search = '';
    state.page = 1;
    loadData();
  });

  pageSizeSelect.addEventListener('change', () => {
    state.pageSize = Number(pageSizeSelect.value) || 10;
    state.page = 1;
    loadData();
  });

  let searchTimer = null;
  quickSearchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = quickSearchInput.value.trim();
      state.page = 1;
      loadData();
    }, 240);
  });

  prevBtn.addEventListener('click', () => {
    if (state.page > 1) {
      state.page -= 1;
      loadData();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (state.page < state.totalPages) {
      state.page += 1;
      loadData();
    }
  });

  // Export buttons: Copy | Excel | PDF | CSV
  outlet.querySelector('#export-copy-btn').addEventListener('click', async () => {
    const header = columns
      .filter((c) => c.key !== 'actions')
      .map((c) => c.label)
      .join('\t');
    const lines = state.items.map((r) => {
      if (status === 'former') {
        return [
          r.service_number,
          r.first_name || '',
          r.middle_name || '',
          r.surname || '',
          r.rate_name || '',
          formatDisplayDate(r.exit_date),
          r.exit_type_name || '',
        ].join('\t');
      }
      return [
        r.service_number,
        r.first_name || '',
        r.middle_name || '',
        r.surname || '',
        r.rate_name || '',
        r.current_ship_name || '',
      ].join('\t');
    });
    const tsv = [header, ...lines].join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
      showToast(`Copied ${state.items.length} row(s) to clipboard.`, 'success');
    } catch (_) {
      showToast('Clipboard access was denied by browser.', 'error');
    }
  });

  outlet.querySelector('#export-excel-btn').addEventListener('click', async () => {
    try {
      const qs = buildFilterQuery({ format: 'xlsx' });
      await api.downloadFile(`/api/ratings/export?${qs}`, `CIRERMS_${status}_ratings.xlsx`);
    } catch (err) {
      showToast(err.message || 'Excel export failed.', 'error');
    }
  });

  outlet.querySelector('#export-csv-btn').addEventListener('click', async () => {
    try {
      const qs = buildFilterQuery({ format: 'csv' });
      await api.downloadFile(`/api/ratings/export?${qs}`, `CIRERMS_${status}_ratings.csv`);
    } catch (err) {
      showToast(err.message || 'CSV export failed.', 'error');
    }
  });

  outlet.querySelector('#export-pdf-btn').addEventListener('click', async () => {
    try {
      const qs = buildFilterQuery({ format: 'pdf' });
      const { blob, mimeType, fileName } = await api.fetchBlob(`/api/ratings/export?${qs}`);
      previewBlobModal({
        title: status === 'former' ? 'Former Ratings Nominal Roll (PDF)' : 'Current Ratings Nominal Roll (PDF)',
        blob,
        mimeType,
        fileName: fileName || `CIRERMS_${status}_ratings.pdf`,
      });
    } catch (err) {
      showToast(err.message || 'PDF export failed.', 'error');
    }
  });

  await loadData();
  return () => clearTimeout(searchTimer);
}
