'use strict';

/*
 * Settings: the values the business may change without a code change, kept in the `settings` table
 * (setting_key, value, description). The due rules live here: Drafting's (drafting.*, WP7a), and later
 * Advancement's (WP8) and Discharge's (WP5). A package adds its rows in its seed (INSERT IGNORE, so a
 * value someone has changed is never overwritten) and reads them here; nothing else reads the table.
 *
 *   const settings = require('../../shared/settings');
 *   const months = await settings.number('drafting.due_months');        // throws when the row is missing
 *   const all = await settings.numbers(['drafting.due_months', 'drafting.band_green_to']);
 *   const list = await settings.list('drafting.');                       // [{ key, value, description }]
 *   await db.transaction((tx) => settings.set(tx, actor, 'drafting.due_months', '12'));   // audited
 *
 * Values are text; number() and numbers() refuse a value that is not a whole number, so a mistyped
 * setting stops the screen that needs it with a clear message instead of using a wrong rule.
 */
const audit = require('../audit');
const { AppError } = require('../errors');
const repo = require('./settings.repo');

const settingError = (message) => new AppError(500, 'SETTING_INVALID', message);

async function get(key, conn = null) {
  const row = await repo.find(key, conn);
  if (!row) throw settingError(`The setting ${key} is missing. Run the seeds (npm run seed).`);
  return row.value;
}

async function number(key, conn = null) {
  const v = String(await get(key, conn)).trim();
  if (!/^-?\d+$/.test(v)) throw settingError(`The setting ${key} must be a whole number (it is "${v}").`);
  return Number(v);
}

/** { key: number } for several keys at once. */
async function numbers(keys, conn = null) {
  const out = {};
  for (const k of keys) out[k] = await number(k, conn);
  return out;
}

async function list(prefix = '', conn = null) {
  return (await repo.all(prefix, conn)).map((r) => ({ key: r.setting_key, value: r.value, description: r.description, updatedAt: r.updated_at }));
}

/** Changes one setting inside the caller's transaction, with its audit row. */
async function set(tx, actor, key, value) {
  const before = await repo.find(key, tx.connection, true);
  if (!before) throw settingError(`The setting ${key} is missing.`);
  await repo.update(key, String(value), actor && actor.userId, tx.connection);
  const after = await repo.find(key, tx.connection);
  await audit.record(tx, actor, { action: 'UPDATE', table: 'settings', recordId: key, before, after });
  return after.value;
}

module.exports = { get, number, numbers, list, set };
