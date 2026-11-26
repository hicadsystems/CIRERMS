/*
 * Back to Guide: when a step of the guide sends the reader to a screen, a small chip stays over that screen (and
 * the next ones) until it is pressed, dismissed or the guide is opened again. Pressing it returns to the same step.
 *
 *   keepGuidePlace({ run })   called as the reader presses a link to a screen: `run()` goes back to the step
 *   showGuideBack(path)       the shell calls it on every page: the chip shows on every page but the guide's
 *   clearGuideBack()
 */
import { icon } from '../core/icons.js';
import { h } from '../ui/html.js';

let place = null;
let chip = null;

export function clearGuideBack() {
  place = null;
  if (chip) { chip.remove(); chip = null; }
}

export function keepGuidePlace(next) {
  place = next && typeof next.run === 'function' ? next : null;
}

export function showGuideBack(path) {
  if (!place || /^guide(\/|$)/.test(path || '')) {
    // the guide page itself is where the chip leads: it has done its job
    if (/^guide(\/|$)/.test(path || '')) clearGuideBack();
    else if (chip) { chip.remove(); chip = null; }
    return;
  }
  if (chip) return;
  const go = () => { const { run } = place; clearGuideBack(); run(); };
  chip = h('div', {
    role: 'region',
    'aria-label': 'Back to the guide',
    className: 'fixed bottom-5 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-popover py-1 pl-1 pr-1 text-popover-foreground shadow-pop phone:bottom-24',
    dataset: { guideBack: '' },
  }, [
    h('button', {
      type: 'button',
      className: 'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-full bg-brand px-4 text-sm font-medium text-brand-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 phone:h-tap',
      onClick: go,
    }, [icon('book-open'), 'Back to Guide']),
    h('button', {
      type: 'button',
      className: 'inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 phone:h-tap phone:w-tap',
      'aria-label': 'Dismiss',
      onClick: clearGuideBack,
    }, icon('x')),
  ]);
  document.body.appendChild(chip);
}
