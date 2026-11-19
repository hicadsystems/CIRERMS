'use strict';

/*
 * Dates for Drafting. DATE columns arrive as 'YYYY-MM-DD' strings; DATETIME columns as Dates holding the
 * stored wall-clock time in their UTC fields (the pool reads with timezone 'Z'), so the day is read with
 * the UTC getters. "Today" is the server's local day, as the scheduled changes use it.
 */
const pad = (n) => String(n).padStart(2, '0');

/** A DATE string, a DATETIME (Date) or a timestamp string, as 'YYYY-MM-DD'; '' when empty. */
function isoDay(v) {
  if (!v) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

/** dd/mm/yyyy, '' when empty. */
function dmy(v) {
  const s = isoDay(v);
  return s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '';
}

function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 'YYYY-MM-DD' plus n days. */
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

module.exports = { isoDay, dmy, todayIso, addDays };
