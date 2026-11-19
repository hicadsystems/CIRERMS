'use strict';

/* Dates as the screens and printouts show them: dd/mm/yyyy; and today as YYYY-MM-DD. */
const pad = (n) => String(n).padStart(2, '0');

/** '2026-11-19' (or a Date or a timestamp) as '19/11/2026'; '' when there is no date. */
function dmy(value) {
  if (!value) return '';
  const s = value instanceof Date ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` : String(value).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

module.exports = { dmy, todayIso };
