import { api } from '../core/api.js';
import {
  clear,
  confirmModal,
  el,
  formatBytes,
  populateSelect,
  previewBlobModal,
  showToast,
} from '../core/dom.js';
import { formatDisplayDate } from '../core/dates.js';
import { getLookups } from '../core/lookups.js';

export async function mountRatingsDocuments(outlet, { params = {}, query = {} }) {
  const lookups = await getLookups();
  const categories = lookups.documentCategories || [];

  const lookupForm = outlet.querySelector('#doc-lookup-form');
  const snInput = outlet.querySelector('#doc-service-number');
  const workspace = outlet.querySelector('#doc-workspace');
  const ratingTitle = outlet.querySelector('#doc-rating-title');
  const ratingMeta = outlet.querySelector('#doc-rating-meta');
  const openProfileLink = outlet.querySelector('#doc-open-profile-link');
  const categoryPills = outlet.querySelector('#doc-category-pills');
  const uploadForm = outlet.querySelector('#doc-upload-form');
  const fileInput = outlet.querySelector('#doc-file-input');
  const uploadCategorySelect = outlet.querySelector('#doc-upload-category');
  const uploadBtn = outlet.querySelector('#doc-upload-btn');
  const tableBody = outlet.querySelector('#doc-table-body');

  let activeServiceNumber = null;
  let activeCategoryCode = query.category || 'ALL';
  let allDocs = [];

  populateSelect(uploadCategorySelect, categories, {
    placeholder: null,
    valueKey: 'id',
    labelKey: 'name',
  });

  function renderCategoryPills() {
    clear(categoryPills);
    const pillSpecs = [
      { code: 'ALL', label: 'ALL DOCUMENTS' },
      ...categories.map((c) => ({ code: c.code, label: `VIEW ${c.name.toUpperCase()} DOC` })),
    ];

    for (const spec of pillSpecs) {
      const isSelected = activeCategoryCode === spec.code;
      categoryPills.appendChild(
        el('button', {
          type: 'button',
          className: isSelected
            ? 'rounded bg-cirerms-sidebar px-3 py-1.5 text-xs font-semibold text-on-fill shadow-sm'
            : 'rounded bg-cirerms-teal hover:bg-cirerms-teal-hover px-3 py-1.5 text-xs font-medium text-on-fill shadow-sm transition',
          text: spec.label,
          onClick: () => {
            activeCategoryCode = spec.code;
            renderCategoryPills();
            renderTable();
          },
        })
      );
    }
  }

  async function handleViewDoc(doc) {
    try {
      const { blob, mimeType, fileName } = await api.fetchBlob(doc.view_url);
      previewBlobModal({
        title: `${doc.category_name} — ${doc.original_name}`,
        blob,
        mimeType,
        fileName: fileName || doc.original_name,
      });
    } catch (err) {
      showToast(err.message || 'Unable to preview document.', 'error');
    }
  }

  async function handleDeleteDoc(doc) {
    const ok = await confirmModal({
      title: 'Delete Personnel Document',
      message: `Permanently delete "${doc.original_name}" (${doc.category_name}) from ${doc.service_number}?`,
      confirmLabel: 'Delete Document',
      danger: true,
    });
    if (!ok) return;

    try {
      const res = await api.del(`/api/ratings/${encodeURIComponent(doc.service_number)}/documents/${doc.id}`);
      allDocs = res.data.documents || [];
      renderTable();
      showToast('Document deleted.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to delete document.', 'error');
    }
  }

  function renderTable() {
    clear(tableBody);
    const filtered = activeCategoryCode === 'ALL'
      ? allDocs
      : allDocs.filter((d) => d.category_code === activeCategoryCode);

    if (filtered.length === 0) {
      tableBody.appendChild(
        el('tr', {}, [
          el('td', {
            colSpan: 6,
            className: 'py-8 px-3 text-center text-xs text-gray-500',
            text:
              activeCategoryCode === 'ALL'
                ? 'No documents uploaded for this rating yet.'
                : `No documents found under category "${activeCategoryCode}".`,
          }),
        ])
      );
      return;
    }

    filtered.forEach((doc, idx) => {
      const tr = el('tr', { className: 'hover:bg-gray-50' }, [
        el('td', { className: 'py-2.5 px-3 text-xs', text: String(idx + 1) }),
        el('td', { className: 'py-2.5 px-3 font-medium text-cirerms-ink', text: doc.original_name }),
        el('td', { className: 'py-2.5 px-3 text-xs' }, [
          el('span', {
            className: 'inline-block rounded bg-teal-50 border border-teal-200 text-cirerms-teal px-2 py-0.5 font-medium',
            text: doc.category_name,
          }),
        ]),
        el('td', { className: 'py-2.5 px-3 text-xs text-gray-500', text: formatBytes(doc.size_bytes) }),
        el('td', { className: 'py-2.5 px-3 text-xs text-gray-500', text: formatDisplayDate(doc.created_at) || '-' }),
        el('td', { className: 'py-2.5 px-3 whitespace-nowrap' }, [
          el('div', { className: 'inline-flex items-center gap-1.5' }, [
            el('button', {
              type: 'button',
              className: 'cirerms-btn-teal text-xs px-2.5 py-1',
              text: 'View',
              onClick: () => handleViewDoc(doc),
            }),
            el('button', {
              type: 'button',
              className: 'cirerms-btn-blue text-xs px-2.5 py-1',
              text: 'Download',
              onClick: () => api.downloadFile(doc.download_url, doc.original_name),
            }),
            el('button', {
              type: 'button',
              className: 'cirerms-btn-danger text-xs px-2.5 py-1',
              text: 'Delete',
              onClick: () => handleDeleteDoc(doc),
            }),
          ]),
        ]),
      ]);
      tableBody.appendChild(tr);
    });
  }

  async function loadFolder(serviceNumberRaw) {
    const cleanSn = String(serviceNumberRaw || '').trim().toUpperCase();
    if (!cleanSn) {
      showToast('Please enter a Service Number.', 'error');
      return;
    }

    try {
      const res = await api.get(`/api/ratings/${encodeURIComponent(cleanSn)}/documents`);
      const { rating, documents } = res.data;
      activeServiceNumber = rating.service_number;
      snInput.value = activeServiceNumber;
      allDocs = documents || [];

      ratingTitle.textContent = `${rating.service_number} — ${rating.rate_name ? `${rating.rate_name} ` : ''}${rating.full_name}`;
      ratingMeta.textContent = [
        `Status: ${String(rating.status || 'current').toUpperCase()}`,
        rating.branch_name ? `Branch: ${rating.branch_name}` : null,
        rating.current_ship_name ? `Current Ship: ${rating.current_ship_name}` : null,
      ]
        .filter(Boolean)
        .join('  •  ');
      openProfileLink.href = `#ratings/edit/${encodeURIComponent(rating.service_number)}`;

      workspace.classList.remove('hidden');
      renderCategoryPills();
      renderTable();
    } catch (err) {
      workspace.classList.add('hidden');
      showToast(err.message || 'Could not locate rating service number.', 'error');
    }
  }

  lookupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loadFolder(snInput.value);
  });

  outlet.querySelectorAll('[data-quick-sn]').forEach((btn) => {
    btn.addEventListener('click', () => loadFolder(btn.dataset.quickSn));
  });

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!activeServiceNumber) return;

    const file = fileInput.files?.[0];
    if (!file) {
      showToast('Please choose a document file to upload.', 'error');
      return;
    }

    const fd = new FormData();
    fd.append('document', file);
    fd.append('category_id', uploadCategorySelect.value);

    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Uploading...';

    try {
      const res = await api.upload(`/api/ratings/${encodeURIComponent(activeServiceNumber)}/documents`, fd);
      allDocs = res.data.documents || [];
      fileInput.value = '';
      renderTable();
      showToast('Document uploaded successfully.', 'success');
    } catch (err) {
      showToast(err.message || 'Document upload failed.', 'error');
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'Upload';
    }
  });

  if (params.serviceNumber) {
    await loadFolder(params.serviceNumber);
  }
}
