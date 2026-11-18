/*
 * pill: a small rounded status label ("Current", "Soon", a count).
 *
 *   pill(text, tone)        tone: 'success' | 'warning' | 'info' | 'error' | 'neutral'
 *   pillClass(tone)         the class string, for HTML templates
 *
 * Same on a phone.
 */
import { h } from './html.js';

const BASE = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-semibold';

export const PILL = {
  success: `${BASE} bg-success-soft text-success`,
  warning: `${BASE} bg-warning-soft text-warning`,
  info: `${BASE} bg-info-soft text-info`,
  error: `${BASE} bg-error-soft text-error`,
  neutral: `${BASE} bg-muted text-muted-foreground`,
};

export const pillClass = (tone = 'neutral') => PILL[tone] || PILL.neutral;

export function pill(text, tone = 'neutral') {
  return h('span', { className: pillClass(tone), text });
}
