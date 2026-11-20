'use strict';

/* The Training Draft Report (PDF), made from the training-draft-report template. */
const { renderPdf } = require('../../shared/printouts');
const { monthName } = require('./training-drafting.format');

const f = (label, value, kind) => (kind ? { label, value, kind } : { label, value });
const upper = (s) => String(s || '').toUpperCase();

/** The batch and the ratings to list ({ sn, name, rate, prev, from, to } each; dates as YYYY-MM-DD). */
async function batchReportPdf({ batch, rows, notListed, generatedBy }) {
  const closed = batch.status === 'closed';
  return renderPdf('training-draft-report', {
    title: 'TRAINING DRAFT REPORT',
    generatedBy,
    ref: batch.batchNumber,
    subtitle: closed ? 'Closed batch' : 'Open batch',
    facts: [
      f('Batch Number', batch.batchNumber, 'code'), f('Training', batch.course), f('Period', `${monthName(batch.month)} ${batch.year}`),
      f('Institution', batch.institution || '-'), f('Status', closed ? 'Closed' : 'Open'), f('Ratings', String(rows.length)),
    ],
    table: {
      columns: [
        { label: 'Official No', key: 'sn', kind: 'code', w: '11%' }, { label: 'Name', key: 'name', kind: 'name', w: '27%' },
        { label: 'Rate', key: 'rate', w: '8%' }, { label: 'Previous Course', key: 'prev', w: '24%' },
        { label: 'From', key: 'from', kind: 'date', w: '12%' }, { label: 'To', key: 'to', kind: 'date', w: '12%' },
      ],
      rows,
      empty: 'No ratings in this batch.',
    },
    note: notListed ? `${notListed} ${notListed === 1 ? 'rating' : 'ratings'} in the batch did not attend and ${notListed === 1 ? 'is' : 'are'} not listed.` : null,
    signatures: [{ role: 'Training Officer' }, { role: 'Director of Training (Navy)' }],
  });
}

module.exports = { batchReportPdf, upper };
