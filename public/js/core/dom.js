/*
 * dom: small helpers the screens share.
 *   el                ui/html.js h()
 *   clear(node)       empties a node
 *   populateSelect(select, items, { placeholder, valueKey, labelKey, selectedValue })
 *                     refills a select (or its searchable dropdown) from a lookup list
 *   previewBlobModal({ title, blob, mimeType, fileName })
 *                     a PDF or image in a large dialog (a sheet on a phone), with Download
 *   formatBytes(n)    '182.4 KB'
 */
import { h } from '../ui/html.js';
import { openDialog } from '../ui/dialog.js';
import { button } from '../ui/button.js';

export const el = h;

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

export function previewBlobModal({ title = 'Document Preview', blob, mimeType = '', fileName = 'document' }) {
  const objectUrl = URL.createObjectURL(blob);

  const triggerDownload = () => {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  let viewer;
  if (mimeType.includes('pdf')) {
    viewer = h('iframe', { src: objectUrl, title, className: 'block h-[70vh] w-full border-0 bg-muted' });
  } else if (mimeType.startsWith('image/')) {
    viewer = h('div', { className: 'flex h-[70vh] w-full items-center justify-center overflow-auto bg-muted p-4' }, [
      h('img', { src: objectUrl, alt: title, className: 'max-h-full max-w-full rounded-md object-contain shadow-card' }),
    ]);
  } else {
    viewer = h('div', { className: 'space-y-3 p-10 text-center' }, [
      h('p', { className: 'text-sm', text: `This file cannot be previewed here: ${fileName}` }),
      button({ label: 'Download File', icon: 'download', variant: 'blue', onClick: triggerDownload }),
    ]);
  }

  const dlg = openDialog({
    title,
    size: '2xl',
    body: h('div', { className: '-mx-5 -my-4' }, viewer),
    onClose: () => setTimeout(() => URL.revokeObjectURL(objectUrl), 1000),
  });
  dlg.setFooter([
    button({ label: 'Open in New Tab', icon: 'eye', variant: 'outline', href: objectUrl, attrs: { target: '_blank', rel: 'noopener' } }),
    button({ label: 'Download', icon: 'download', variant: 'blue', onClick: triggerDownload }),
  ]);
  return dlg;
}

export function formatBytes(bytes) {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num <= 0) return '-';
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}
