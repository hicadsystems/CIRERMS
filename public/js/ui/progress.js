/*
 * completeness bar: how much of a record is filled in. Thin and plain: red
 * below 50%, amber to 79%, green from 80% (.cirerms-progress-* in input.css).
 *
 *   const bar = completeness({ percent, label })
 *     label   the words after the number (default 'complete': "Record 70% complete")
 *   bar.set(percent)
 *   levelFor(percent)  'low' | 'mid' | 'high'
 *
 * Same on a phone.
 */
import { cx, h } from './html.js';

export const levelFor = (p) => (p >= 80 ? 'high' : p >= 50 ? 'mid' : 'low');
const TEXT = { low: 'text-error', mid: 'text-warning', high: 'text-success' };

export function completeness({ percent = 0, prefix = 'Record', label = 'complete', className = '' } = {}) {
  const bar = h('div', { className: 'cirerms-progress-bar' });
  const track = h('div', { className: 'cirerms-progress-track flex-1', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100' }, bar);
  const num = h('b');
  const el = h('div', { className: cx('flex items-center gap-3 border-t border-border/70 bg-subtle/60 px-4 py-3', className) }, [
    track,
    h('span', { className: 'whitespace-nowrap text-xs text-muted-foreground' }, [`${prefix} `, num, ` ${label}`]),
  ]);
  el.set = (p) => {
    const v = Math.max(0, Math.min(100, Math.round(Number(p) || 0)));
    const level = levelFor(v);
    bar.style.width = `${v}%`;
    bar.dataset.level = level;
    track.setAttribute('aria-valuenow', String(v));
    num.textContent = `${v}%`;
    num.className = TEXT[level];
  };
  el.set(percent);
  return el;
}
