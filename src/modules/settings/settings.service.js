'use strict';

const db = require('../../db');
const settings = require('../../shared/settings');
const { validationError, notFound } = require('../../shared/errors');
const { GROUPS } = require('./settings.groups');

const n = (rows, key) => (rows.get(key) ? Number(rows.get(key).value) : null);

/** A worked example in plain words, from the numbers as they are now. */
function legendOf(g, rows) {
  if (g.key === 'drafting' || g.key === 'advancement') {
    const due = n(rows, `${g.key}.due_months`);
    const green = n(rows, `${g.key}.band_green_to`);
    const amber = n(rows, `${g.key}.band_amber_to`);
    if (due === null || green === null || amber === null) return [];
    const what = g.key === 'drafting' ? 'on the ship' : 'in the rate';
    return [
      `Under ${due} months ${what}: not due, not listed.`,
      `${due} to ${green} months: due, GREEN. Newly due; start the work.`,
      `${green + 1} to ${amber} months: AMBER. Waiting longer; deal with it soon.`,
      `${amber + 1} months or more: RED. Long overdue; deal with it first.`,
      'The colours only guide the order of work. Nothing happens to a rating automatically.',
    ];
  }
  const v = (k) => n(rows, `discharge.${k}`);
  if ([v('age_due'), v('service_due'), v('age_band_1'), v('age_band_2'), v('age_band_3'), v('service_band_1'), v('service_band_2'), v('service_band_3')].includes(null)) return [];
  return [
    `Due: at age ${v('age_due')}, or after ${v('service_due')} years of service, whichever comes first.`,
    `Age pill: GREEN from ${v('age_band_1')}, AMBER from ${v('age_band_2')}, RED from ${v('age_band_3')}. Younger shows no colour.`,
    `Service pill: GREEN from ${v('service_band_1')} years, AMBER from ${v('service_band_2')}, RED from ${v('service_band_3')}. Fewer years show no colour.`,
    'GREEN means newly due, begin the process. AMBER means deal with it soon. RED means deal with it first. The colours only guide the order of work; nothing happens to a rating automatically.',
  ];
}

/** The groups with each setting's current value and description. */
async function listGroups(conn = null) {
  const rows = new Map((await settings.list('', conn)).map((r) => [r.key, r]));
  return GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    legend: legendOf(g, rows),
    items: g.items.map((i) => {
      const r = rows.get(i.key);
      return { key: i.key, label: i.label, unit: i.unit, min: i.min, max: i.max, value: r ? r.value : null, description: r ? r.description : '', help: i.help };
    }),
  }));
}

/**
 * Changes some of one group's settings. The values are checked as a whole (the ones sent, over the
 * ones stored), then every changed key is saved through settings.set in one transaction.
 */
async function updateGroup(groupKey, body, actor) {
  const group = GROUPS.find((g) => g.key === groupKey);
  if (!group) throw notFound('Unknown settings group.');
  const sent = body && body.values;
  if (!sent || typeof sent !== 'object' || Array.isArray(sent)) throw validationError('Send the values to change.', { values: 'Send the values to change.' });

  const errors = {};
  const known = new Map(group.items.map((i) => [i.key, i]));
  for (const k of Object.keys(sent)) if (!known.has(k)) errors[k] = 'This is not a setting of this group.';
  if (Object.keys(errors).length) throw validationError('Unknown setting.', errors);

  return db.transaction(async (tx) => {
    const stored = new Map((await settings.list(`${group.key}.`, tx.connection)).map((r) => [r.key, r.value]));
    const next = {};
    for (const i of group.items) {
      if (!stored.has(i.key)) throw notFound(`The setting ${i.key} is missing. Run the seeds.`);
      if (!Object.prototype.hasOwnProperty.call(sent, i.key)) { next[i.key] = Number(stored.get(i.key)); continue; }
      const raw = sent[i.key];
      const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
      if (!/^\d+$/.test(text)) { errors[i.key] = 'Enter a whole number.'; continue; }
      const n = Number(text);
      if (n < i.min || n > i.max) { errors[i.key] = `Use a number from ${i.min} to ${i.max}.`; continue; }
      next[i.key] = n;
    }
    for (const i of group.items) {
      if (errors[i.key]) continue;
      if (i.atLeast && !errors[i.atLeast] && next[i.key] < next[i.atLeast]) {
        errors[i.key] = `Must not be below the due value (${next[i.atLeast]}).`;
      } else if (i.above && !errors[i.above] && next[i.key] <= next[i.above]) {
        errors[i.key] = `Must be above the one before it (${next[i.above]}).`;
      }
    }
    if (Object.keys(errors).length) throw validationError('Check the highlighted fields.', errors);

    const changed = [];
    for (const i of group.items) {
      if (!Object.prototype.hasOwnProperty.call(sent, i.key)) continue;
      if (String(next[i.key]) === String(Number(stored.get(i.key)))) continue;
      await settings.set(tx, actor, i.key, String(next[i.key]));
      changed.push(i.key);
    }
    return { changed };
  }).then(async ({ changed }) => ({ changed, group: (await listGroups()).find((g) => g.key === group.key) }));
}

module.exports = { listGroups, updateGroup };
