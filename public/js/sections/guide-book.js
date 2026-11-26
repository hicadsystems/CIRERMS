/*
 * The choice behind Download PDF: which pictures the book carries. Four options (desktop or mobile, light or dark
 * mode), the one matching the reader's device and theme chosen first; Make PDF opens the book in the PDF preview.
 *
 *   openBookChoice()
 */
import { h } from '../ui/html.js';
import { openDialog } from '../ui/dialog.js';
import { button } from '../ui/button.js';
import { openPdfPreview } from '../ui/pdf-preview.js';
import { isPhone } from '../ui/media.js';
import { currentTheme } from '../core/theme.js';

const OPTIONS = [
  { device: 'desktop', theme: 'light', label: 'Desktop, Light Mode' },
  { device: 'desktop', theme: 'dark', label: 'Desktop, Dark Mode' },
  { device: 'phone', theme: 'light', label: 'Mobile, Light Mode' },
  { device: 'phone', theme: 'dark', label: 'Mobile, Dark Mode' },
];

export function openBookChoice() {
  const device = isPhone() ? 'phone' : 'desktop';
  const theme = currentTheme();
  let chosen = OPTIONS.find((o) => o.device === device && o.theme === theme) || OPTIONS[0];

  const rows = OPTIONS.map((o) => {
    const input = h('input', {
      type: 'radio', name: 'book-set', value: `${o.device}.${o.theme}`, checked: o === chosen,
      className: 'h-4 w-4 flex-none accent-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15',
    });
    input.addEventListener('change', () => { chosen = o; });
    return h('label', { className: 'flex cursor-pointer items-center gap-3 rounded-ctl border border-border px-3 py-3 text-sm hover:bg-muted phone:min-h-tap' }, [input, h('span', { text: o.label })]);
  });

  const body = h('div', { className: 'space-y-3' }, [
    h('p', { className: 'text-sm text-muted-foreground', text: 'Choose the pictures the book carries. The pages are always printed on light paper.' }),
    h('div', { className: 'space-y-2', role: 'radiogroup', 'aria-label': 'Pictures in the book' }, rows),
  ]);

  const dlg = openDialog({ title: 'Download PDF', size: 'sm', body, initialFocus: 'input:checked' });
  dlg.setFooter([
    button({ label: 'Cancel', variant: 'outline', onClick: () => dlg.close() }),
    button({
      label: 'Make PDF',
      icon: 'file-text',
      variant: 'primary',
      onClick: () => {
        const { device: d, theme: t } = chosen;
        dlg.close();
        openPdfPreview({ url: `/api/guide/book?device=${d}&theme=${t}`, title: 'User Guide', filename: `CIRERMS-User-Guide-${d}-${t}.pdf` });
      },
    }),
  ]);
  return dlg;
}
