/*
 * appraisal-record: the rating's appraisals, a list under the record's Advancement tab (no twelfth tab). Seen only by
 * someone who may view Recommendation and Grading; never on My Details; not counted in the record's completeness.
 *
 *   appraisalList(serviceNumber)   a section with the rating's appraisals (period, grades, CO), each row opening
 *                                  the appraisal, and Initiate Appraisal when a period is open
 */
import { api } from '../core/api.js';
import { can } from '../core/access.js';
import { h, cx } from '../ui/html.js';
import { CARD } from '../ui/classes.js';
import { button } from '../ui/button.js';
import { pill } from '../ui/pill.js';
import { emptyState } from '../ui/empty-state.js';
import { loadOptions, gradePill, openAppraisalForm, openAppraisalRecord } from './appraisal.js';

export function appraisalList(serviceNumber) {
  const box = h('section', { className: 'mt-6', dataset: { recordAppraisals: '' } });
  if (!can('appraisal.grading', 'view')) return box;

  async function draw() {
    let res; let o;
    try {
      [o, res] = await Promise.all([loadOptions(), api.get(`/api/appraisal/rating/${encodeURIComponent(serviceNumber)}/appraisals`)]);
    } catch (_) { box.replaceChildren(); return; }
    const d = res.data;
    const reload = () => draw();
    const th = 'px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-muted-foreground';
    box.replaceChildren(
      h('div', { className: 'mb-3 flex flex-wrap items-center gap-3' }, [
        h('h2', { className: 'text-sm font-semibold', text: 'Appraisals' }),
        pill(String(d.items.length), 'neutral'),
        d.canInitiate && can('appraisal.grading', 'add') ? button({ label: 'Initiate Appraisal', icon: 'plus', variant: 'outline', className: 'ml-auto', onClick: () => openAppraisalForm({ rating: serviceNumber, onDone: reload }) }) : null,
      ]),
      d.items.length
        ? h('div', { className: cx(CARD, 'overflow-hidden') }, h('div', { className: 'overflow-x-auto' }, h('table', { className: 'w-full text-sm' }, [
          h('thead', { className: 'bg-subtle' }, h('tr', {}, ['Period', 'Character', 'Efficiency', 'CO\u2019s Name'].map((t) => h('th', { className: th, scope: 'col', text: t })))),
          h('tbody', {}, d.items.map((a) => {
            const row = h('tr', { className: 'cursor-pointer border-t border-border hover:bg-subtle', tabindex: '0' }, [
              h('td', { className: 'px-4 py-2.5' }, [h('b', { className: 'block font-medium', text: a.periodName }), h('span', { className: 'block text-xs text-muted-foreground', text: a.periodOpen ? 'Open' : 'Closed' })]),
              h('td', { className: 'px-4 py-2.5' }, gradePill(a.character, o)),
              h('td', { className: 'px-4 py-2.5' }, gradePill(a.efficiency, o)),
              h('td', { className: 'px-4 py-2.5', text: a.coName }),
            ]);
            const open = () => openAppraisalRecord(a, { link: false, onChange: reload });
            row.addEventListener('click', open);
            row.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); open(); } });
            return row;
          })),
        ])))
        : h('div', { className: CARD }, emptyState({ icon: 'clipboard-check', title: 'No Appraisals Recorded', text: d.rating.status === 'current' ? 'Recorded on Recommendation and Grading, once a period is open.' : 'A former rating is not appraised.' })),
    );
  }
  draw();
  return box;
}
