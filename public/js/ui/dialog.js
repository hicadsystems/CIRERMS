/*
 * dialog: one component, two looks. A centred dialog on desktop, a bottom
 * sheet on a phone. Use it for every "add", every record opened from a list
 * below 1280 px, confirmations, previews and the phone's menus.
 *
 *   const dlg = openDialog({ title, body, footer, size, onClose, dismissible, initialFocus })
 *     size         'sm' | 'md' (default) | 'lg' | 'xl' | '2xl' (desktop widths 448 to 1024 px)
 *     body/footer  node(s) or text; the footer is hidden when empty
 *     onClose(result)   called once, however it closes
 *     dismissible  false keeps it open on Esc and the scrim (a save in progress)
 *     initialFocus a node or selector to focus first (default: the Close button, as in the demo)
 *   dlg.body, dlg.footer, dlg.panel     the parts, to fill or query
 *   dlg.setTitle(t)  dlg.setBody(c)  dlg.setFooter(c)  dlg.close(result)
 *   dlg.closed       a promise of the result
 *   closeAllDialogs()   (the shell calls it on every page change)
 *
 * Esc and the scrim close the top one; Tab stays inside it; focus returns to
 * what was focused before. Dialogs stack (a confirm over an edit form).
 *
 * Phones: a sheet rising from the bottom with a grab handle, rounded top,
 * at most the screen's height; footer buttons stack full width, main action on top.
 */
import { cx, fill, h } from './html.js';
import { icon } from '../core/icons.js';

const SIZES = { sm: 'desk:max-w-md', md: 'desk:max-w-lg', lg: 'desk:max-w-2xl', xl: 'desk:max-w-3xl', '2xl': 'desk:max-w-5xl' };
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const stack = [];
let listening = false;

function root() {
  let r = document.getElementById('overlay-root');
  if (!r) {
    r = h('div', { id: 'overlay-root' });
    document.body.appendChild(r);
  }
  return r;
}

function setInert(on) {
  document.querySelectorAll('[data-shell]').forEach((n) => { n.inert = on; });
}

function visible(node) {
  return !!(node.offsetWidth || node.offsetHeight || node.getClientRects().length);
}

function onKeydown(e) {
  const top = stack[stack.length - 1];
  if (!top) return;
  if (e.key === 'Escape') {
    // a searchable dropdown closes its own list first
    if (e.defaultPrevented) return;
    if (top.dismissible) { e.preventDefault(); top.close(); }
  } else if (e.key === 'Tab') {
    const items = Array.from(top.panel.querySelectorAll(FOCUSABLE)).filter(visible);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (!top.panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

export function openDialog({ title = '', body = null, footer = null, size = 'md', onClose, dismissible = true, initialFocus, className = '' } = {}) {
  if (!listening) {
    document.addEventListener('keydown', onKeydown);
    listening = true;
  }
  const lastFocus = document.activeElement;
  const titleId = `dlg-title-${Date.now().toString(36)}${stack.length}`;

  const titleEl = h('h2', { id: titleId, className: 'min-w-0 flex-1 truncate text-base font-semibold', text: title });
  const closeBtn = h('button', {
    type: 'button',
    className: 'inline-flex h-9 w-9 flex-none items-center justify-center rounded-ctl text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 phone:h-tap phone:w-tap',
    'aria-label': 'Close',
  }, icon('x', 'icon h-5 w-5'));
  const bodyEl = h('div', { className: 'min-h-0 flex-1 overflow-y-auto px-5 py-4' }, body);
  const footEl = h('div', { className: 'flex flex-none flex-wrap justify-end gap-2 border-t border-border px-5 py-3 phone:flex-col-reverse' }, footer);
  const panel = h('div', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titleId,
    className: cx(
      'pointer-events-auto flex max-h-full w-full flex-col overflow-hidden bg-background text-foreground shadow-pop desk:rounded-dialog phone:rounded-t-3xl',
      SIZES[size] || SIZES.md,
      className
    ),
  }, [
    h('div', { className: 'mx-auto mt-2 h-1.5 w-10 flex-none rounded-full bg-border desk:hidden', 'aria-hidden': 'true' }),
    h('div', { className: 'flex flex-none items-center gap-3 border-b border-border px-5 py-3.5' }, [titleEl, closeBtn]),
    bodyEl,
    footEl,
  ]);
  const scrim = h('div', { className: 'absolute inset-0 bg-scrim backdrop-blur-sm' });
  const overlay = h('div', { className: 'fixed inset-0 z-50' }, [
    scrim,
    h('div', { className: 'pointer-events-none absolute inset-0 flex justify-center desk:items-center desk:p-6 phone:items-end phone:pt-10' }, panel),
  ]);

  const syncFooter = () => footEl.classList.toggle('hidden', !footEl.childNodes.length);
  syncFooter();

  let resolveClosed;
  const closed = new Promise((r) => { resolveClosed = r; });
  let done = false;

  const handle = {
    panel,
    body: bodyEl,
    footer: footEl,
    dismissible,
    closed,
    setTitle(t) { titleEl.textContent = t; },
    setBody(c) { fill(bodyEl, c); },
    setFooter(c) { fill(footEl, c); syncFooter(); },
    setDismissible(v) { handle.dismissible = !!v; closeBtn.disabled = !v; },
    close(result) {
      if (done) return;
      done = true;
      const i = stack.indexOf(handle);
      if (i >= 0) stack.splice(i, 1);
      overlay.remove();
      if (!stack.length) setInert(false);
      if (typeof onClose === 'function') {
        try { onClose(result); } catch (err) { console.error(err); }
      }
      resolveClosed(result);
      if (lastFocus && lastFocus.isConnected && typeof lastFocus.focus === 'function') lastFocus.focus();
    },
  };

  closeBtn.addEventListener('click', () => { if (handle.dismissible) handle.close(); });
  scrim.addEventListener('click', () => { if (handle.dismissible) handle.close(); });
  // links inside (More sheet tiles, "Open Record") close it as they navigate
  panel.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (a && !a.hasAttribute('data-keep-open')) handle.close();
  });

  stack.push(handle);
  root().appendChild(overlay);
  setInert(true);

  setTimeout(() => {
    const target = typeof initialFocus === 'string' ? panel.querySelector(initialFocus) : initialFocus;
    (target || closeBtn).focus();
  }, 0);

  return handle;
}

export function closeAllDialogs() {
  stack.slice().reverse().forEach((d) => d.close());
}

export const openDialogCount = () => stack.length;
