'use strict';

const db = require('../../db');
const settings = require('../../shared/settings');
const { validationError, notFound } = require('../../shared/errors');
const { GROUPS } = require('./settings.groups');

/** The groups with each setting's current value and description. */
async function listGroups(conn = null) {
  const rows = new Map((await settings.list('', conn)).map((r) => [r.key, r]));
  return GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    items: g.items.map((i) => {
      const r = rows.get(i.key);
      return { key: i.key, label: i.label, unit: i.unit, min: i.min, max: i.max, value: r ? r.value : null, description: r ? r.description : '' };
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
