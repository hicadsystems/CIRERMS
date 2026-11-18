/*
 * stepper: numbered steps of one form (New Rating's Basic Details, Contact,
 * Health, Official). Done steps show a tick; any step can be clicked.
 *
 *   const s = stepper({ steps, current, onStep })
 *     steps     ['Basic Details', 'Contact', ...]
 *     current   1-based step shown first (default 1)
 *     onStep(n) a step was clicked; call s.set(n) to move (validate first if needed)
 *   s.el  s.set(n)  s.current()
 *
 * Keep every step's fields in the form at once and only show the current one,
 * so moving between steps keeps what was typed.
 *
 * Phones: four equal columns, the number over a smaller label.
 */
import { cx, h } from './html.js';
import { icon } from '../core/icons.js';

export function stepper({ steps = [], current = 1, onStep = () => {} } = {}) {
  let at = current;
  const el = h('ol', { className: cx('mb-5 grid gap-1 rounded-card bg-subtle/70 p-1', `grid-cols-${Math.min(Math.max(steps.length, 1), 6)}`) });
  // grid-cols-1 grid-cols-2 grid-cols-3 grid-cols-4 grid-cols-5 grid-cols-6 (so Tailwind keeps them)

  function paint() {
    el.replaceChildren(...steps.map((label, i) => {
      const n = i + 1;
      const done = n < at;
      const on = n === at;
      const b = h('button', {
        type: 'button',
        'aria-current': on ? 'step' : undefined,
        className: cx(
          'flex w-full items-center gap-2.5 rounded-ctl px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/15 phone:flex-col phone:gap-1 phone:px-1 phone:text-center phone:text-2xs',
          on ? 'bg-brand/10 font-semibold text-foreground' : 'text-muted-foreground hover:bg-subtle'
        ),
      }, [
        h('span', {
          className: cx('flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-semibold', done ? 'bg-primary text-primary-foreground' : on ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground'),
        }, done ? icon('check') : String(n)),
        label,
      ]);
      b.addEventListener('click', () => onStep(n));
      return h('li', {}, b);
    }));
  }
  paint();

  return {
    el,
    set(n) { at = Math.max(1, Math.min(steps.length, n)); paint(); },
    current: () => at,
  };
}
