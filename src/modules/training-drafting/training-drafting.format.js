'use strict';

/* Dates, periods and batch numbers as the screens and printouts show them. */
const pad = (n) => String(n).padStart(2, '0');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthName = (m) => MONTHS[Number(m) - 1] || '';

/** '2026-11-19' (or a Date) as '19/11/2026'; '' when there is no date. */
function dmy(value) {
  if (!value) return '';
  const s = value instanceof Date ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` : String(value).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

function todayIso(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** DOT-YYYY-MM-NN: the year, the month with its leading zero, and the course's id padded to two digits. */
function batchNumber(year, month, courseId) {
  return `DOT-${year}-${pad(month)}-${pad(courseId)}`;
}

/** Whole years and months from one date to another: '12 yrs 4 mths'; '' when either date is missing. */
function serviceLength(from, to = todayIso()) {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(from ? String(from) : '');
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(to ? String(to) : '');
  if (!a || !b) return '';
  let months = (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2]));
  if (Number(b[3]) < Number(a[3])) months -= 1;
  if (months < 0) return '';
  const y = Math.floor(months / 12);
  const m = months % 12;
  return `${y} ${y === 1 ? 'yr' : 'yrs'} ${m} ${m === 1 ? 'mth' : 'mths'}`;
}

module.exports = { MONTHS, monthName, dmy, todayIso, batchNumber, serviceLength };
