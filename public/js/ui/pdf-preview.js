/*
 * pdf-preview: the app's own preview of a PDF, in a large dialog (a tall sheet on a phone), with only our own
 * title, close, Download PDF and Print.
 *
 *   openPdfPreview({ url, title, filename })   fetches the PDF through the api client (session and all)
 *   openPdfPreview({ blob, title, filename })  or previews a PDF already in hand
 *   returns the dialog handle (see ui/dialog.js)
 *
 * Where the browser can show a PDF inline (navigator.pdfViewerEnabled: desktop Chrome, Edge, Firefox, Safari)
 * the PDF is shown by the browser's own viewer in an iframe from a blob URL, with its toolbar hidden
 * (#toolbar=0&navpanes=0), so it is exactly the PDF that is downloaded, as NAVY-PAYROLL does. Where it cannot
 * (most phones), the pages are drawn by PDF.js from our own origin (/vendor/pdfjs, from the pdfjs-dist
 * package) on canvases, at 2x to 3x resolution, with the PDF's own background.
 * Download PDF saves the file under its name; Print prints the iframe's PDF (or the drawn pages from a
 * hidden frame). The blob URL is revoked when the dialog closes.
 */
import { api } from '../core/api.js';
import { icon } from '../core/icons.js';
import { h, cx } from './html.js';
import { openDialog } from './dialog.js';
import { button } from './button.js';
import { toast } from './toast.js';

const PDFJS = '/vendor/pdfjs';
let pdfjsPromise = null;

function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(`${PDFJS}/build/pdf.min.mjs`).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS}/build/pdf.worker.min.mjs`;
      return lib;
    });
    pdfjsPromise.catch(() => { pdfjsPromise = null; });
  }
  return pdfjsPromise;
}

const canInline = () => typeof navigator !== 'undefined' && navigator.pdfViewerEnabled === true;

const canvasBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

export function openPdfPreview({ url, blob, title = 'Preview', filename = 'document.pdf' } = {}) {
  let objectUrl = null;
  let pdf = null;
  let viewer = null; // the iframe, when the browser shows the PDF itself
  let printFrame = null;
  let closed = false;
  let resizer = null;
  const pageBox = h('div', { className: 'mx-auto flex w-full max-w-3xl flex-col items-center gap-4', dataset: { pdfPages: '' } });
  const count = h('span', { className: 'text-xs text-muted-foreground', dataset: { pdfCount: '' }, text: 'Loading' });
  const stage = h('div', { className: '-mx-5 -my-4 min-h-[60vh] bg-muted p-4 phone:min-h-[70vh] phone:p-2', dataset: { pdfStage: '' } }, [
    h('div', { className: 'flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground', dataset: { pdfLoading: '' } }, [icon('loader-circle', 'icon animate-spin'), 'Preparing the pages']),
    pageBox,
  ]);

  const dlg = openDialog({
    title,
    size: '2xl',
    body: stage,
    className: 'phone:h-full desk:h-[90vh]',
    onClose: () => {
      closed = true;
      if (resizer) resizer.disconnect();
      if (printFrame) printFrame.remove();
      if (pdf) pdf.destroy();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
  });
  // the page count sits in the dialog head beside the title
  const head = dlg.panel.querySelector('h2');
  if (head && head.parentElement) head.parentElement.insertBefore(count, head.nextSibling);

  let source = null; // the PDF's bytes as a Blob
  const download = () => {
    if (!source) return;
    const href = URL.createObjectURL(source);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10000);
  };
  const downloadBtn = button({ label: 'Download PDF', icon: 'download', variant: 'blue', disabled: true, onClick: download });
  const printBtn = button({ label: 'Print', icon: 'printer', variant: 'primary', disabled: true, onClick: () => print() });
  dlg.setFooter([button({ label: 'Close', variant: 'outline', onClick: () => dlg.close() }), downloadBtn, printBtn]);

  /*
   * Each page is drawn at a backing resolution of 2x to 3x its display size (never below 2x, so a normal
   * monitor still gets a supersampled page, and a dense phone gets its full 3x), within a pixel budget per
   * page, then shown at its CSS size, scaled down and never up. The PDF paints its own page background.
   */
  const MAX_PAGE_PIXELS = 16e6;
  let generation = 0;
  let drawnWidth = 0;
  const canvases = [];

  async function drawPage(n, width, gen) {
    const page = await pdf.getPage(n);
    if (closed || gen !== generation) return;
    const base = page.getViewport({ scale: 1 });
    const cssWidth = Math.round(width);
    const cssHeight = Math.round((cssWidth / base.width) * base.height);
    let ratio = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    ratio = Math.min(ratio, Math.sqrt(MAX_PAGE_PIXELS / (cssWidth * cssHeight)));
    const viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio });
    const canvas = h('canvas', { className: 'block max-w-full rounded-sm shadow-card', dataset: { pdfPage: String(n) }, role: 'img', 'aria-label': `Page ${n}` });
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    // CSS size = the page's display size; width in whole pixels, the height follows the canvas's own ratio
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = 'auto';
    canvas.style.aspectRatio = `${canvas.width} / ${canvas.height}`;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    if (closed || gen !== generation) return;
    if (canvases[n - 1]) canvases[n - 1].replaceWith(canvas);
    else pageBox.appendChild(canvas);
    canvases[n - 1] = canvas;
  }

  async function drawAll(width) {
    generation += 1;
    const gen = generation;
    drawnWidth = width;
    for (let n = 1; n <= pdf.numPages; n += 1) {
      if (closed || gen !== generation) return;
      // eslint-disable-next-line no-await-in-loop
      await drawPage(n, width, gen);
      stage.querySelector('[data-pdf-loading]')?.remove();
    }
  }

  const stageWidth = () => Math.max(280, Math.min(pageBox.clientWidth || 700, 760));

  /** The browser's own PDF viewer, toolbar hidden, in an iframe filling the dialog's body. */
  async function showInline() {
    const pdfBlob = source.type === 'application/pdf' ? source : new Blob([source], { type: 'application/pdf' });
    objectUrl = URL.createObjectURL(pdfBlob);
    const frame = h('iframe', {
      title,
      className: 'block h-full w-full border-0 bg-muted',
      dataset: { pdfViewer: '' },
    });
    const loaded = new Promise((resolve) => { frame.addEventListener('load', resolve, { once: true }); });
    frame.src = `${objectUrl}#toolbar=0&navpanes=0`;
    viewer = frame;
    stage.className = 'bg-muted';
    stage.style.cssText = 'position:absolute;inset:0';
    stage.replaceChildren(frame);
    // the body fills the dialog, with no padding, and the iframe is its only content
    Object.assign(dlg.body.style, { position: 'relative', overflow: 'hidden', padding: '0' });
    stage.dataset.ready = '1';
    stage.dataset.pdfInline = '1';
    count.textContent = '';
    await loaded;
    if (closed) return true;
    downloadBtn.disabled = false;
    printBtn.disabled = false;
    return true;
  }

  async function run() {
    try {
      source = blob || (await api.fetchBlob(url)).blob;
      if (closed) return;
      if (canInline() && (await showInline())) return;
      if (closed) return;
      const [lib, bytes] = await Promise.all([loadPdfjs(), source.arrayBuffer()]);
      if (closed) return;
      pdf = await lib.getDocument({
        data: new Uint8Array(bytes),
        standardFontDataUrl: `${PDFJS}/standard_fonts/`,
        isEvalSupported: false,
      }).promise;
      await drawAll(stageWidth());
      if (closed) return;
      count.textContent = `${pdf.numPages} ${pdf.numPages === 1 ? 'page' : 'pages'}`;
      stage.dataset.ready = '1';
      downloadBtn.disabled = false;
      printBtn.disabled = false;
      // draw again, sharp, when the dialog's width changes
      if (typeof ResizeObserver === 'function') {
        let timer = null;
        resizer = new ResizeObserver(() => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            const w = stageWidth();
            if (!closed && pdf && w !== drawnWidth) drawAll(w);
          }, 150);
        });
        resizer.observe(pageBox);
      }
    } catch (err) {
      if (closed) return;
      stage.replaceChildren(h('p', { className: 'py-16 text-center text-sm text-error', role: 'alert', text: (err && err.message) || 'The document could not be opened.' }));
      count.textContent = '';
      toast((err && err.message) || 'The document could not be opened.', 'error');
    }
  }

  /** Print: the pages as images in a hidden frame, sent to the browser's print dialog; no viewer is shown. */
  async function print() {
    if (viewer) {
      try {
        viewer.contentWindow.focus();
        viewer.contentWindow.print();
      } catch (err) {
        // the browser refused to print the frame: open the PDF itself instead
        window.open(objectUrl, '_blank', 'noopener');
      }
      return;
    }
    if (!pdf) return;
    printBtn.disabled = true;
    try {
      if (printFrame) printFrame.remove();
      const urls = [];
      for (let n = 1; n <= pdf.numPages; n += 1) {
        const page = await pdf.getPage(n);
        const viewport = page.getViewport({ scale: 3 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        // eslint-disable-next-line no-await-in-loop
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        // eslint-disable-next-line no-await-in-loop
        urls.push(URL.createObjectURL(await canvasBlob(canvas)));
      }
      const frame = h('iframe', { title: 'Print', className: 'pointer-events-none fixed h-0 w-0 border-0 opacity-0', 'aria-hidden': 'true', dataset: { pdfPrintFrame: String(pdf.numPages) } });
      document.body.appendChild(frame);
      printFrame = frame;
      const d = frame.contentDocument;
      d.open();
      d.write('<!doctype html><title>Print</title><style>@page{margin:0}html,body{margin:0}img{display:block;width:100%;page-break-after:always;break-after:page}img:last-child{page-break-after:auto;break-after:auto}</style>');
      d.close();
      await Promise.all(urls.map((u) => new Promise((resolve) => {
        const img = d.createElement('img');
        img.onload = resolve;
        img.onerror = resolve;
        img.src = u;
        d.body.appendChild(img);
      })));
      frame.contentWindow.focus();
      frame.contentWindow.print();
      frame.contentWindow.addEventListener('afterprint', () => urls.forEach((u) => URL.revokeObjectURL(u)), { once: true });
    } catch (err) {
      toast((err && err.message) || 'Could not print.', 'error');
    } finally {
      printBtn.disabled = false;
    }
  }

  run();
  return dlg;
}
