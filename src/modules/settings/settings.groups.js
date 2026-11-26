'use strict';

/*
 * The Settings page's group list: which settings each module shows, in what order, with a plain
 * label, a unit and the limits a value must stay within. A package that adds a setting adds its
 * seed row (INSERT IGNORE into `settings`) and one entry here.
 *
 *   key      the settings.setting_key
 *   label    plain English, as the page shows it
 *   unit     'months' | 'years' | 'age'
 *   min,max  the whole numbers allowed
 *   help     what the number does, in plain words (shown under the value and in the Edit dialog)
 *   after    (optional) the key whose value this one must not be below (atLeast) or must exceed (above)
 */
const LIMITS = { months: [1, 600], age: [16, 70], years: [1, 50] };

const HELP = {
  'drafting.due_months': "A rating appears on Drafting's due list once they have spent this many whole months on their current ship. Before that they are not listed. Raise it and fewer ratings are due; lower it and more are.",
  'drafting.band_green_to': 'On the due list, months on the ship from the due month up to this number show a GREEN pill: newly due, plan the draft. It must not be lower than the due month.',
  'drafting.band_amber_to': 'Months above the green limit up to this number show an AMBER pill: waiting longer, deal with it soon. Above this number the pill turns RED: long overdue, deal with it first. Must be higher than the green limit.',
  'advancement.due_months': "A rating appears on Advancement's due list once they have spent this many whole months in their current rate. Before that they are not listed.",
  'advancement.band_green_to': 'Months in rate from the due month up to this number show a GREEN pill: newly due, prepare the advancement. It must not be lower than the due month.',
  'advancement.band_amber_to': 'Months above the green limit up to this number show an AMBER pill: waiting longer, deal with it soon. Above this number the pill turns RED: long overdue, deal with it first. Must be higher than the green limit.',
  'discharge.age_due': "A rating appears on Discharge's due list when they reach this age, or when they reach the years of service below, whichever comes first.",
  'discharge.service_due': "A rating appears on Discharge's due list after this many whole years of service, or at the age above, whichever comes first.",
  'discharge.age_band_1': 'The Age pill on the due list turns GREEN from this age: newly due, begin the discharge process. Ages below it show no colour.',
  'discharge.age_band_2': 'The Age pill turns AMBER from this age: getting close to the end, deal with it soon. Must be higher than the first threshold.',
  'discharge.age_band_3': 'The Age pill turns RED from this age: past the expected age, deal with it first. Must be higher than the second threshold.',
  'discharge.service_band_1': 'The Service pill on the due list turns GREEN from this many years of service: newly due, begin the discharge process. Fewer years show no colour.',
  'discharge.service_band_2': 'The Service pill turns AMBER from this many years: getting close to the end, deal with it soon. Must be higher than the first threshold.',
  'discharge.service_band_3': 'The Service pill turns RED from this many years: past the expected service, deal with it first. Must be higher than the second threshold.',
};

const item = (key, label, unit, rule = {}) => ({ key, label, unit, min: LIMITS[unit][0], max: LIMITS[unit][1], help: HELP[key], ...rule });

const GROUPS = [
  {
    key: 'drafting',
    label: 'Drafting',
    items: [
      item('drafting.due_months', 'Due for a draft after (months on a ship)', 'months'),
      item('drafting.band_green_to', 'Shown green up to (months on a ship)', 'months', { atLeast: 'drafting.due_months' }),
      item('drafting.band_amber_to', 'Shown amber up to (months on a ship)', 'months', { above: 'drafting.band_green_to' }),
    ],
  },
  {
    key: 'advancement',
    label: 'Advancement',
    items: [
      item('advancement.due_months', 'Due for advancement after (months in the current rate)', 'months'),
      item('advancement.band_green_to', 'Shown green up to (months in rate)', 'months', { atLeast: 'advancement.due_months' }),
      item('advancement.band_amber_to', 'Shown amber up to (months in rate)', 'months', { above: 'advancement.band_green_to' }),
    ],
  },
  {
    key: 'discharge',
    label: 'Discharge',
    items: [
      item('discharge.age_due', 'Due for discharge at age', 'age'),
      item('discharge.service_due', 'Due for discharge after (years of service)', 'years'),
      item('discharge.age_band_1', 'Age pill, first threshold', 'age'),
      item('discharge.age_band_2', 'Age pill, second threshold', 'age', { above: 'discharge.age_band_1' }),
      item('discharge.age_band_3', 'Age pill, final threshold', 'age', { above: 'discharge.age_band_2' }),
      item('discharge.service_band_1', 'Service pill, first threshold (years)', 'years'),
      item('discharge.service_band_2', 'Service pill, second threshold (years)', 'years', { above: 'discharge.service_band_1' }),
      item('discharge.service_band_3', 'Service pill, final threshold (years)', 'years', { above: 'discharge.service_band_2' }),
    ],
  },
];

module.exports = { GROUPS };
