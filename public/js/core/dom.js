export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs || {})) {
    if (val === undefined || val === null || val === false) continue;
    if (key === 'className') {
      node.className = val;
    } else if (key === 'text') {
      node.textContent = String(val);
    } else if (key === 'dataset' && typeof val === 'object') {
      for (const [dk, dv] of Object.entries(val)) {
        if (dv !== undefined && dv !== null) node.dataset[dk] = String(dv);
      }
    } else if (key.startsWith('on') && typeof val === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), val);
    } else if (val === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(val));
    }
  }

  const childList = Array.isArray(children) ? children : [children];
  for (const child of childList) {
    if (child === null || child === undefined || child === false) continue;
    if (child instanceof Node) {
      node.appendChild(child);
    } else {
      node.appendChild(document.createTextNode(String(child)));
    }
  }
  return node;
}

export function clear(node) {
  if (node) node.replaceChildren();
}

export function populateSelect(
  selectEl,
  items = [],
  { placeholder = '-- Select --', valueKey = 'id', labelKey = 'name', selectedValue = '' } = {}
) {
  if (!selectEl) return;
  selectEl.replaceChildren();

  if (placeholder !== null) {
    selectEl.appendChild(el('option', { value: '', text: placeholder }));
  }

  const target = selectedValue == null ? '' : String(selectedValue);
  for (const item of items) {
    const val = String(item[valueKey]);
    const opt = el('option', { value: val, text: item[labelKey] });
    if (target !== '' && val === target) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  }
}

export function clearFieldErrors(container) {
  if (!container) return;
  container.querySelectorAll('.field-error-msg').forEach((n) => n.remove());
  container.querySelectorAll('.border-red-500').forEach((n) => {
    n.classList.remove('border-red-500', 'ring-1', 'ring-red-500');
  });
}

export function showFieldErrors(container, fields = {}) {
  clearFieldErrors(container);
  if (!container || !fields) return;

  for (const [fieldName, msg] of Object.entries(fields)) {
    const input = container.querySelector(`[name="${CSS.escape(fieldName)}"]`);
    if (!input) continue;
    // A searchable dropdown draws its box on its inner search field, not on the wrapper
    const box = input._customDropdown ? input._customDropdown.searchInput : input;
    box.classList.add('border-red-500', 'ring-1', 'ring-red-500');
    const errNode = el('p', {
      className: 'field-error-msg mt-1 text-xs text-red-600 font-medium',
      text: msg,
    });
    input.insertAdjacentElement('afterend', errNode);
  }
}

export function showToast(message, type = 'success') {
  const root = document.getElementById('toast-root');
  if (!root) return;

  const palette = {
    success: 'bg-emerald-700 border-emerald-800 text-on-fill',
    error: 'bg-cirerms-danger border-red-700 text-on-fill',
    info: 'bg-cirerms-sidebar border-sky-900 text-on-fill',
  };

  const card = el(
    'div',
    {
      className: `pointer-events-auto rounded shadow-lg border px-4 py-3 text-xs font-medium flex items-start justify-between gap-3 transition-opacity duration-200 ${palette[type] || palette.info}`,
      role: 'status',
    },
    [
      el('span', { className: 'leading-relaxed', text: message }),
      el('button', {
        type: 'button',
        className: 'opacity-80 hover:opacity-100 font-bold text-sm leading-none',
        text: '×',
        onClick: () => card.remove(),
      }),
    ]
  );

  root.appendChild(card);
  setTimeout(() => {
    card.classList.add('opacity-0');
    setTimeout(() => card.remove(), 220);
  }, 4200);
}

export function confirmModal({
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    const modalRoot = document.getElementById('modal-root');
    if (!modalRoot) {
      resolve(false);
      return;
    }

    const close = (answer) => {
      modalRoot.classList.add('hidden');
      clear(modalRoot);
      resolve(answer);
    };

    const dialog = el(
      'div',
      { className: 'bg-background rounded-md shadow-2xl border border-cirerms-border max-w-md w-full overflow-hidden' },
      [
        el('div', { className: 'bg-cirerms-subheader border-b border-cirerms-border px-5 py-3.5 flex items-center justify-between' }, [
          el('h3', { className: 'text-sm font-semibold text-cirerms-ink', text: title }),
          el('button', {
            type: 'button',
            className: 'text-gray-400 hover:text-gray-600 text-lg leading-none',
            text: '×',
            onClick: () => close(false),
          }),
        ]),
        el('div', { className: 'p-5 text-sm text-gray-700 leading-relaxed', text: message }),
        el('div', { className: 'bg-gray-50 border-t border-gray-200 px-5 py-3 flex justify-end gap-2' }, [
          el('button', {
            type: 'button',
            className: 'rounded border border-gray-300 bg-background px-3.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50',
            text: 'Cancel',
            onClick: () => close(false),
          }),
          el('button', {
            type: 'button',
            className: danger ? 'cirerms-btn-danger text-xs px-4 py-1.5' : 'cirerms-btn-teal text-xs px-4 py-1.5',
            text: confirmLabel,
            onClick: () => close(true),
          }),
        ]),
      ]
    );

    clear(modalRoot);
    modalRoot.appendChild(dialog);
    modalRoot.classList.remove('hidden');
  });
}

export function previewBlobModal({ title = 'Document Preview', blob, mimeType = '', fileName = 'document' }) {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;

  const objectUrl = URL.createObjectURL(blob);

  const close = () => {
    modalRoot.classList.add('hidden');
    clear(modalRoot);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const triggerDownload = () => {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  let viewerNode;
  if (mimeType.includes('pdf')) {
    viewerNode = el('iframe', {
      src: objectUrl,
      title,
      className: 'w-full h-[72vh] border-0 bg-gray-100',
    });
  } else if (mimeType.startsWith('image/')) {
    viewerNode = el('div', { className: 'w-full h-[72vh] overflow-auto bg-slate-900/5 flex items-center justify-center p-4' }, [
      el('img', { src: objectUrl, alt: title, className: 'max-w-full max-h-full object-contain rounded shadow' }),
    ]);
  } else {
    viewerNode = el('div', { className: 'p-10 text-center space-y-3' }, [
      el('p', { className: 'text-sm text-gray-700', text: `In-browser preview is not supported for "${fileName}".` }),
      el('button', {
        type: 'button',
        className: 'cirerms-btn-teal',
        text: 'Download File',
        onClick: triggerDownload,
      }),
    ]);
  }

  const dialog = el(
    'div',
    { className: 'bg-background rounded-md shadow-2xl border border-cirerms-border max-w-5xl w-full overflow-hidden flex flex-col' },
    [
      el('div', { className: 'bg-cirerms-subheader border-b border-cirerms-border px-5 py-3 flex flex-wrap items-center justify-between gap-2' }, [
        el('h3', { className: 'text-sm font-semibold text-cirerms-ink truncate', text: title }),
        el('div', { className: 'flex items-center gap-2' }, [
          el('button', {
            type: 'button',
            className: 'cirerms-btn-blue text-xs py-1 px-3',
            text: 'Download',
            onClick: triggerDownload,
          }),
          el('a', {
            href: objectUrl,
            target: '_blank',
            rel: 'noopener',
            className: 'rounded border border-gray-300 bg-background px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50',
            text: 'Open in New Tab',
          }),
          el('button', {
            type: 'button',
            className: 'ml-1 rounded px-2 py-0.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800 text-lg leading-none',
            text: '×',
            onClick: close,
          }),
        ]),
      ]),
      viewerNode,
    ]
  );

  clear(modalRoot);
  modalRoot.appendChild(dialog);
  modalRoot.classList.remove('hidden');
}

export function formatBytes(bytes) {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num <= 0) return '-';
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}
