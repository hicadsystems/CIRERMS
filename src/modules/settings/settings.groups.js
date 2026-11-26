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
 *   after    (optional) the key whose value this one must not be below (atLeast) or must exceed (above)
 */
const LIMITS = { months: [1, 600], age: [16, 70], years: [1, 50] };

const item = (key, label, unit, rule = {}) => ({ key, label, unit, min: LIMITS[unit][0], max: LIMITS[unit][1], ...rule });

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
