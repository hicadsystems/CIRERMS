'use strict';

/*
 * Special Drafting printouts: D4's templates (src/templates/printouts) special-draft-form (Special Draft Report:
 * Preview Draft Form, Print and Mark Printed, Reprint Form) and special-draft-letter (a draft's Draft Letter).
 */
const { renderPdf } = require('../../shared/printouts');
const { dmy, isoDay, todayIso } = require('../drafting/drafting.format');

const f = (label, value, kind) => (kind ? { label, value, kind } : { label, value });
const isoOf = (v) => isoDay(v);

/**
 * The Special Draft Form: the form number, posting type, how many ratings and the date, then each rating with its
 * ship, months, drafted to, deployment or vice, authority and WEF (a WEF after the form's date is marked Scheduled).
 * `form` is null for a preview, which is not numbered.
 */
async function formPdf({ form, postingType, drafts, generatedBy }) {
  const date = form ? isoOf(form.printedAt) : todayIso();
  const number = form ? form.formNumber : 'Not yet numbered';
  return renderPdf('special-draft-form', {
    title: 'SPECIAL DRAFT FORM',
    generatedBy,
    ref: form ? form.formNumber : 'PREVIEW',
    subtitle: `Posting type ${postingType}${form ? '' : ' (preview: nothing is marked printed)'}`,
    facts: [
      f('Form No', number, 'code'), f('Posting Type', postingType, 'code'), f('Ratings', String(drafts.length)),
      f('Date', date, 'date'), f('Prepared By', (form && form.printedBy) || generatedBy || ''),
    ],
    table: {
      dense: true,
      columns: [
        { label: 'Official No', key: 'sn', kind: 'code', w: '8%' }, { label: 'Name', key: 'name', kind: 'name', w: '17%' },
        { label: 'Rate', key: 'rate', w: '5%' }, { label: 'Sex', key: 'sex', kind: 'ctr', w: '4%' },
        { label: 'Current Ship', key: 'from', w: '11%' }, { label: 'Months', key: 'months', kind: 'num', w: '6%' },
        { label: 'Drafted To', key: 'to', w: '11%' }, { label: 'Deployment / Vice', key: 'vice', w: '12%' },
        { label: 'Authority', key: 'auth', kind: 'code', w: '11%' }, { label: 'WEF', key: 'wef', kind: 'date', w: '8%' },
        { label: '', key: 'sched', w: '7%', kind: 'flag' },
      ],
      rows: drafts.map((d) => ({
        sn: d.serviceNumber, name: d.name, rate: d.rateCode, sex: d.sex ? d.sex[0].toUpperCase() : '', from: d.currentShip,
        months: d.months === null || d.months === undefined ? '' : d.months, to: d.draftedTo, vice: d.vice, auth: d.authority, wef: d.wef,
        sched: d.wef > date ? 'Scheduled' : '',
      })),
      empty: 'No drafts on this form.',
    },
    note: 'WEF dates marked Scheduled are in the future: the rating moves on that date. A printed form is final.',
    signatures: [{ role: 'Drafting Officer' }, { role: 'Director of Personnel (Navy)' }],
  });
}

/** The Draft Letter: one rating, one draft. It marks nothing printed. */
async function letterPdf({ draft, branch, generatedBy }) {
  const year = todayIso().slice(0, 4);
  return renderPdf('special-draft-letter', {
    title: 'SPECIAL DRAFT LETTER',
    generatedBy,
    ref: `SDL-${year}-${String(draft.id).padStart(4, '0')}`,
    letterDate: todayIso(),
    subtitle: draft.printed ? `On form ${draft.formNumber}` : 'Not yet printed',
    rating: { sn: draft.serviceNumber, rate: draft.rateCode, name: draft.name, from: draft.currentShip, since: draft.joinedOn },
    draft: { wef: draft.wef },
    facts: [
      f('Official No', draft.serviceNumber, 'code'), f('Name', draft.name), f('Rate', draft.rateCode), f('Branch', branch),
      f('Current Ship', draft.currentShip), f('Joined the Ship', draft.joinedOn, 'date'),
    ],
    table: {
      columns: [
        { label: 'Drafted To', key: 'to', w: '18%' }, { label: 'Posting Type', key: 't', kind: 'code', w: '12%' },
        { label: 'Deployment / Vice', key: 'v', w: '20%' }, { label: 'Authority', key: 'a', kind: 'code', w: '18%' },
        { label: 'WEF', key: 'w', kind: 'date', w: '12%' }, { label: 'Remark', key: 'r' },
      ],
      rows: [{ to: draft.draftedTo, t: draft.postingType, v: draft.vice, a: draft.authority, w: draft.wef, r: draft.remark }],
    },
    note: 'The letter for one rating. Printing it does not mark the draft printed: print the form on Special Draft Report.',
    signatures: [{ role: 'Drafting Officer' }, { role: 'Director of Personnel (Navy)' }],
  });
}

module.exports = { formPdf, letterPdf, dmy };
