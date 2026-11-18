/*
 * documents block: a rating's Navpers files. Category chips (with counts), the
 * file list, and a preview: beside the list at 1280 px and up (the first file
 * picked), in a dialog below that (a bottom sheet on a phone). Upload Document
 * opens a dialog with the category and the file. Used by the record's
 * Documents tab and the Documents screen.
 *
 *   const block = documentsBlock({ serviceNumber, readOnly, onCount })
 *     onCount(n)   after each load, with how many files the rating has
 *   block.el   block.reload()   block.destroy()
 */
import { api } from '../core/api.js';
import { getLookups } from '../core/lookups.js';
import { icon } from '../core/icons.js';
import { formatDisplayDate } from '../core/dates.js';
import { formatBytes } from '../core/dom.js';
import { h, cx, fill } from '../ui/html.js';
import { CARD } from '../ui/classes.js';
import { button } from '../ui/button.js';
import { pill } from '../ui/pill.js';
import { emptyState } from '../ui/empty-state.js';
import { openDialog } from '../ui/dialog.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';
import { field, selectInput, setFieldErrors, clearFieldErrors } from '../ui/field.js';
import { isWide, onLayout } from '../ui/media.js';

const DOC_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx';

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function documentsBlock({ serviceNumber, readOnly = false, onCount } = {}) {
  const sn = encodeURIComponent(serviceNumber);
  let docs = [];
  let categories = [];
  let cat = 'ALL';
  let picked = null;
  let previewUrl = null;

  const chips = h('div', { className: 'mb-3 flex gap-2 overflow-x-auto pb-1', role: 'group', 'aria-label': 'Document categories' });
  const listCard = h('div', { className: cx(CARD, 'self-start overflow-hidden') });
  const aside = h('aside', { className: cx(CARD, 'sticky top-0 self-start overflow-hidden'), 'aria-label': 'Document preview' });
  const grid = h('div', { className: 'grid grid-cols-1 gap-4' }, [listCard]);
  const el = h('div', {}, [chips, grid]);

  const visible = () => (cat === 'ALL' ? docs : docs.filter((d) => d.category_code === cat));

  function drawChips() {
    const items = [{ code: 'ALL', name: 'All' }, ...categories];
    fill(chips, items.map((c) => {
      const n = c.code === 'ALL' ? docs.length : docs.filter((d) => d.category_code === c.code).length;
      const on = cat === c.code;
      return h('button', {
        type: 'button',
        'aria-pressed': String(on),
        className: cx('inline-flex h-8 flex-none items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 phone:h-9', on ? 'border-sidebar bg-sidebar text-sidebar-foreground' : 'border-border bg-background text-foreground hover:bg-subtle'),
        onClick: () => { cat = c.code; picked = null; draw(); },
      }, [c.name, h('span', { className: on ? 'text-sidebar-foreground' : 'text-muted-foreground', text: String(n) })]);
    }));
  }

  function drawList() {
    const rows = visible();
    const wide = isWide();
    const body = rows.length
      ? h('ul', {}, rows.map((d) => h('li', {}, h('button', {
          type: 'button',
          className: cx('flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-ring/15', wide && picked && picked.id === d.id ? 'bg-secondary/10' : 'hover:bg-subtle'),
          'aria-current': wide && picked && picked.id === d.id ? 'true' : undefined,
          onClick: () => pick(d),
        }, [
          h('span', { className: 'flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-error-soft to-background text-error ring-1 ring-error/15' }, icon(String(d.mime_type || '').startsWith('image/') ? 'image' : 'file-text')),
          h('span', { className: 'min-w-0 flex-1' }, [
            h('b', { className: 'block truncate text-sm font-medium', text: d.original_name }),
            h('span', { className: 'block truncate text-xs text-muted-foreground', text: `${d.category_name} · ${formatBytes(d.size_bytes)} · ${formatDisplayDate(d.created_at)}` }),
          ]),
          icon('chevron-right', 'icon text-muted-foreground'),
        ]))))
      : emptyState({ icon: 'folder-open', title: cat === 'ALL' ? 'No Documents Yet' : 'No Documents Here' });
    fill(listCard, [
      body,
      readOnly ? null : h('div', { className: 'border-t border-border bg-subtle px-4 py-3' }, button({ label: 'Upload Document', icon: 'upload', variant: 'primary', onClick: openUpload })),
    ]);
    // the list's last row drops its line
    const last = listCard.querySelector('li:last-child > button');
    if (last) last.classList.remove('border-b');
  }

  function draw() {
    drawChips();
    const rows = visible();
    const wide = isWide();
    if (wide && rows.length) {
      if (!picked || !rows.some((d) => d.id === picked.id)) picked = rows[0];
      grid.className = 'grid grid-cols-2 gap-4';
      if (!aside.isConnected) grid.appendChild(aside);
      drawList();
      showPreview(picked, aside);
    } else {
      grid.className = 'grid grid-cols-1 gap-4';
      aside.remove();
      drawList();
    }
  }

  function pick(d) {
    picked = d;
    if (isWide()) { draw(); return; }
    const dlg = openDialog({ title: 'Document', size: 'lg', body: emptyState({ icon: 'loader-circle', title: 'Loading' }) });
    dlg.body.className = 'min-h-0 flex-1 overflow-y-auto';
    showPreview(d, dlg.body, dlg);
  }

  // host: the dialog showing it (below 1280 px), or none for the panel beside the list
  async function showPreview(d, target, host = null) {
    if (previewUrl && target === aside) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
    const head = h('div', { className: 'flex items-center gap-2 border-b border-border px-4 py-2.5' }, [
      h('b', { className: 'min-w-0 flex-1 truncate text-sm', text: d.original_name }),
      pill(d.category_name, 'info'),
    ]);
    const stage = h('div', { className: 'flex min-h-[18rem] items-center justify-center bg-muted p-4' }, h('span', { className: 'flex items-center gap-2 text-sm text-muted-foreground' }, [icon('loader-circle', 'icon animate-spin'), 'Loading']));
    let blob = null;
    const download = button({ label: 'Download', icon: 'download', variant: 'blue', disabled: true, onClick: () => blob && saveBlob(blob, d.original_name) });
    const actions = h('div', { className: 'flex flex-wrap gap-2 border-t border-border px-4 py-3 phone:flex-col' }, [
      download,
      readOnly ? null : button({ label: 'Delete', icon: 'trash-2', variant: 'outline', className: 'text-destructive', onClick: () => remove(d, host) }),
    ]);
    fill(target, [head, stage, actions]);
    try {
      const res = await api.fetchBlob(d.view_url);
      if (!target.isConnected || (target === aside && picked && picked.id !== d.id)) return;
      blob = res.blob;
      download.disabled = false;
      const url = URL.createObjectURL(blob);
      if (host) host.closed.then(() => URL.revokeObjectURL(url));
      else previewUrl = url;
      const type = res.mimeType || '';
      if (type.includes('pdf')) {
        fill(stage, h('iframe', { src: url, title: d.original_name, className: 'block h-[60vh] w-full rounded-md border-0 bg-background shadow-pop' }));
        stage.className = 'bg-muted p-3';
      } else if (type.startsWith('image/')) {
        fill(stage, h('img', { src: url, alt: d.original_name, className: 'max-h-[60vh] max-w-full rounded-md object-contain shadow-pop' }));
      } else {
        fill(stage, emptyState({ icon: 'file-text', title: 'No Preview for This File', text: 'Download it to open it.' }));
      }
    } catch (err) {
      fill(stage, emptyState({ icon: 'circle-alert', title: 'Could Not Load the File', text: err.message || '' }));
    }
  }

  async function remove(d, host) {
    const ok = await confirmDialog({ title: 'Delete Document', message: `Delete ${d.original_name}? This cannot be undone.`, confirmLabel: 'Delete Document', danger: true });
    if (!ok) return;
    try {
      const res = await api.del(`/api/ratings/${sn}/documents/${d.id}`);
      docs = res.data.documents || [];
      if (picked && picked.id === d.id) picked = null;
      if (host) host.close();
      toast('Document deleted.');
      changed();
    } catch (err) {
      toast(err.message || 'Could not delete the document.', 'error');
    }
  }

  function openUpload() {
    const current = categories.find((c) => c.code === cat);
    const fileInput = h('input', { type: 'file', name: 'document', accept: DOC_TYPES, required: true, className: 'block w-full text-sm text-foreground file:mr-3 file:h-control file:cursor-pointer file:rounded-ctl file:border file:border-input file:bg-background file:px-3 file:text-sm file:font-medium file:text-foreground hover:file:bg-subtle phone:file:h-tap' });
    const form = h('form', { className: 'space-y-4', novalidate: true }, [
      field({ label: 'Category', control: selectInput({ name: 'category_id', options: categories.map((c) => ({ value: c.id, label: c.name })), value: current ? current.id : '' }) }),
      field({ label: 'File', control: fileInput, hint: 'PDF, image or Word document' }),
    ]);
    form.addEventListener('submit', (e) => { e.preventDefault(); send(); });
    const dlg = openDialog({ title: 'Upload Document', body: form });
    const saveBtn = button({ label: 'Upload', icon: 'upload', variant: 'primary', onClick: () => send() });
    dlg.setFooter([button({ label: 'Cancel', variant: 'outline', onClick: () => dlg.close() }), saveBtn]);

    async function send() {
      clearFieldErrors(form);
      const file = fileInput.files && fileInput.files[0];
      const catId = (form.querySelector('[name="category_id"]') || {}).value || '';
      const errors = {};
      if (!catId) errors.category_id = 'Choose a category.';
      if (!file) errors.document = 'Choose a file.';
      if (Object.keys(errors).length) { setFieldErrors(form, errors); return; }
      const fd = new FormData();
      fd.append('category_id', catId);
      fd.append('document', file);
      saveBtn.disabled = true;
      dlg.setDismissible(false);
      try {
        const res = await api.upload(`/api/ratings/${sn}/documents`, fd);
        docs = res.data.documents || [];
        const added = categories.find((c) => String(c.id) === String(catId));
        if (cat !== 'ALL' && added && added.code !== cat) cat = added.code;
        picked = docs.find((d) => d.original_name === file.name && (!added || d.category_code === added.code)) || null;
        dlg.setDismissible(true);
        dlg.close();
        toast('Document uploaded.');
        changed();
      } catch (err) {
        dlg.setDismissible(true);
        saveBtn.disabled = false;
        if (err.fields) setFieldErrors(form, err.fields);
        toast(err.message || 'Upload failed.', 'error');
      }
    }
  }

  function changed() {
    draw();
    if (typeof onCount === 'function') onCount(docs.length);
  }

  async function reload() {
    fill(listCard, h('div', { className: 'flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground' }, [icon('loader-circle', 'icon animate-spin'), 'Loading']));
    try {
      const [lookups, res] = await Promise.all([getLookups(), api.get(`/api/ratings/${sn}/documents`)]);
      categories = lookups.documentCategories || [];
      docs = res.data.documents || [];
      changed();
    } catch (err) {
      fill(listCard, emptyState({ icon: 'circle-alert', title: 'Could Not Load Documents', text: err.message || '' }));
    }
  }

  const off = onLayout(() => { if (el.isConnected) draw(); });
  reload();

  return {
    el,
    reload,
    destroy() {
      off();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
  };
}
