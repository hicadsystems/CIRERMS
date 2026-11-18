/*
 * confirm: asks before something that cannot be undone.
 *
 *   const ok = await confirmDialog({ title, message, confirmLabel, cancelLabel, danger, icon })
 *     danger   true makes the confirm button red (Delete); default teal
 *   Resolves true on confirm, false on Cancel, Esc or the scrim.
 *
 * Phones: a small bottom sheet, the confirm button full width above Cancel.
 */
import { h } from './html.js';
import { openDialog } from './dialog.js';
import { button } from './button.js';

export function confirmDialog({
  title = 'Are You Sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  icon,
} = {}) {
  let answer = false;
  const dlg = openDialog({
    title,
    size: 'sm',
    body: typeof message === 'string' ? h('p', { className: 'text-sm leading-relaxed', text: message }) : message,
    onClose: () => {},
  });
  const cancel = button({ label: cancelLabel, variant: 'outline', onClick: () => dlg.close(false) });
  const ok = button({
    label: confirmLabel,
    icon: icon || (danger ? 'trash-2' : 'check'),
    variant: danger ? 'danger' : 'primary',
    onClick: () => { answer = true; dlg.close(true); },
  });
  dlg.setFooter([cancel, ok]);
  setTimeout(() => ok.focus(), 0);
  return dlg.closed.then(() => answer);
}
