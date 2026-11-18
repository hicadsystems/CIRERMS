/*
 * New Rating: the four steps (Basic Details, Contact, Health, Official) in one
 * wide dialog (a bottom sheet on a phone). Every step's fields stay in the form
 * and only the current one shows, so moving between steps keeps what was typed.
 * Save Rating creates the rating, uploads the passport photo if one was chosen,
 * and opens the new record.
 *
 *   openNewRating({ onClose })   opens it (the lists, the dashboard, the phone's
 *                                button, Ctrl K and #ratings/new all call this)
 */
import { api } from '../core/api.js';
import { getLookups } from '../core/lookups.js';
import { navigate } from '../core/router.js';
import { icon } from '../core/icons.js';
import { h } from '../ui/html.js';
import { LABEL } from '../ui/classes.js';
import { button } from '../ui/button.js';
import { openDialog } from '../ui/dialog.js';
import { stepper } from '../ui/stepper.js';
import { toast } from '../ui/toast.js';
import { setFieldErrors, clearFieldErrors } from '../ui/field.js';
import { SECTIONS, sectionFields, wireCascades, readForm } from './rating-fields.js';

const PHOTO_TYPES = '.jpg,.jpeg,.png,.webp';

/** The passport photo picker: a dashed box with a preview. `box.file()` is the chosen file. */
export function photoPicker({ currentUrl = null } = {}) {
  const input = h('input', { type: 'file', accept: PHOTO_TYPES, className: 'hidden', 'aria-label': 'Passport Photograph' });
  const img = h('img', { alt: 'Passport photograph', className: 'hidden h-full w-full rounded-card object-cover' });
  const hint = h('div', { className: 'flex flex-col items-center gap-2' }, [icon('image', 'icon h-8 w-8'), 'JPG, PNG or WebP, up to 5 MB']);
  const choose = button({ label: 'Choose Photo', icon: 'upload', variant: 'outline', className: 'mt-1', onClick: () => input.click() });
  const frame = h('div', { className: 'relative flex aspect-[4/5] flex-col items-center justify-center gap-2 overflow-hidden rounded-card border-2 border-dashed border-input bg-subtle p-3 text-center text-xs text-muted-foreground phone:aspect-auto phone:py-6' }, [img, hint]);
  let objectUrl = null;

  const show = (src) => {
    img.src = src;
    img.classList.remove('hidden');
    hint.classList.add('hidden');
    frame.classList.remove('border-dashed', 'p-3');
    frame.classList.add('phone:aspect-[4/5]', 'phone:w-40', 'phone:mx-auto');
  };
  input.addEventListener('change', () => {
    const f = input.files && input.files[0];
    if (!f) return;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    show(objectUrl);
    choose.lastChild.textContent = 'Change Photo';
  });
  if (currentUrl) {
    api.fetchBlob(currentUrl).then(({ blob }) => {
      objectUrl = URL.createObjectURL(blob);
      show(objectUrl);
      choose.lastChild.textContent = 'Change Photo';
    }).catch(() => {});
  }

  const box = h('div', { className: 'w-48 flex-none phone:w-full' }, [
    h('span', { className: LABEL, text: 'Passport Photograph' }),
    frame,
    h('div', { className: 'mt-2 flex justify-center' }, choose),
    input,
  ]);
  box.file = () => (input.files && input.files[0]) || null;
  box.release = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  return box;
}

/** Uploads a passport photo for a rating; returns the updated rating. */
export async function uploadPassport(serviceNumber, file) {
  const fd = new FormData();
  fd.append('photo', file);
  const res = await api.upload(`/api/ratings/${encodeURIComponent(serviceNumber)}/photo/passport`, fd);
  return res.data.rating;
}

export async function openNewRating({ onClose } = {}) {
  let lookups;
  try {
    lookups = await getLookups();
  } catch (err) {
    toast(err.message || 'Could not load the form.', 'error');
    if (onClose) onClose();
    return null;
  }

  let step = 1;
  const steps = stepper({ steps: SECTIONS.map((s) => s.title), current: 1, onStep: (n) => go(n) });
  const photo = photoPicker();
  const form = h('form', { novalidate: true, autocomplete: 'off' });
  form.addEventListener('submit', (e) => { e.preventDefault(); if (step < SECTIONS.length) go(step + 1); else save(); });

  const panels = SECTIONS.map((section, i) => h('div', { className: i ? 'hidden' : '', dataset: { panel: String(i + 1) } }, [
    i === 0 ? h('p', { className: 'mb-4 text-sm text-muted-foreground', text: 'Official Number, Surname and First Name are required; everything else can be added later.' }) : null,
    h('div', { className: 'flex gap-6 phone:flex-col' }, [
      h('div', { className: 'min-w-0 flex-1' }, sectionFields(section, lookups, i === 3 ? { status: 'current' } : {})),
      i === 0 ? photo : null,
    ]),
  ]));
  form.append(steps.el, ...panels);

  const dlg = openDialog({
    title: 'New Rating',
    size: '2xl',
    body: form,
    initialFocus: '[name="service_number"]',
    onClose: () => { photo.release(); if (onClose) onClose(); },
  });
  wireCascades(form, lookups);

  const back = button({ label: 'Back', icon: 'chevron-left', variant: 'outline', className: 'desk:mr-auto', onClick: () => go(step - 1) });
  const cancel = button({ label: 'Cancel', variant: 'outline', onClick: () => dlg.close() });
  const next = button({ label: 'Next', iconAfter: 'chevron-right', variant: 'blue', onClick: () => go(step + 1) });
  const saveBtn = button({ label: 'Save Rating', icon: 'check', variant: 'primary', onClick: () => save() });

  function paintFoot() {
    back.disabled = step === 1;
    back.classList.toggle('phone:hidden', step === 1);
    dlg.setFooter([back, cancel, step < SECTIONS.length ? next : saveBtn]);
  }

  function go(n) {
    step = Math.max(1, Math.min(SECTIONS.length, n));
    steps.set(step);
    panels.forEach((p, i) => p.classList.toggle('hidden', i + 1 !== step));
    paintFoot();
    dlg.body.scrollTop = 0;
  }

  async function save() {
    clearFieldErrors(form);
    saveBtn.disabled = true;
    dlg.setDismissible(false);
    try {
      const res = await api.post('/api/ratings', readForm(form));
      const sn = res.data.rating.service_number;
      const file = photo.file();
      if (file) {
        try {
          await uploadPassport(sn, file);
        } catch (err) {
          toast(`Rating saved, but the photo was not: ${err.message}`, 'warning', { timeout: 6000 });
        }
      }
      toast(`Rating ${sn} added.`);
      dlg.setDismissible(true);
      dlg.close('saved');
      navigate(`#ratings/edit/${encodeURIComponent(sn)}`);
    } catch (err) {
      dlg.setDismissible(true);
      saveBtn.disabled = false;
      if (err.fields) {
        setFieldErrors(form, err.fields);
        // show the first step with an error
        const first = Object.keys(err.fields)[0];
        const ctl = first && form.querySelector(`[name="${CSS.escape(first)}"]`);
        const panel = ctl && ctl.closest('[data-panel]');
        if (panel) go(Number(panel.dataset.panel));
      }
      toast(err.message || 'Could not save the rating.', 'error');
    }
  }

  paintFoot();
  return dlg;
}

/** The "New Rating" button: opens the dialog. */
export function newRatingButton({ className = '' } = {}) {
  return button({ label: 'New Rating', icon: 'user-plus', variant: 'primary', className, onClick: () => openNewRating() });
}
