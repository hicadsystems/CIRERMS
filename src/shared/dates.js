'use strict';

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Validate and normalise a date input to strict 'YYYY-MM-DD' or null.
 * Rejects legacy '.NET DateTime.MinValue' ('0001-01-01'), '0000-00-00',
 * and impossible calendar dates like '2026-02-30'.
 *
 * Returns { valid: true, value: 'YYYY-MM-DD' | null } or { valid: false, error: string }.
 */
function parseIsoDate(input) {
  if (input === undefined || input === null) {
    return { valid: true, value: null };
  }

  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) {
      return { valid: false, error: 'Invalid date value.' };
    }
    const y = input.getUTCFullYear();
    if (y <= 1900 || y > 2100) {
      return { valid: false, error: `Year ${y} is outside valid range (1901–2100).` };
    }
    const m = String(input.getUTCMonth() + 1).padStart(2, '0');
    const d = String(input.getUTCDate()).padStart(2, '0');
    return { valid: true, value: `${y}-${m}-${d}` };
  }

  const raw = String(input).trim();
  if (!raw) {
    return { valid: true, value: null };
  }

  if (raw === '0001-01-01' || raw === '0000-00-00') {
    return { valid: false, error: 'Placeholder date is not allowed; leave blank when unknown.' };
  }

  // Accept YYYY-MM-DD (or YYYY/MM/DD in spreadsheet imports)
  const match = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(raw);
  if (!match) {
    return { valid: false, error: 'Use YYYY-MM-DD format (e.g. 1992-04-18).' };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1901 || year > 2100) {
    return { valid: false, error: `Year ${year} is outside valid range (1901–2100).` };
  }
  if (month < 1 || month > 12) {
    return { valid: false, error: `Month ${month} is invalid.` };
  }

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year
    || probe.getUTCMonth() + 1 !== month
    || probe.getUTCDate() !== day
  ) {
    return { valid: false, error: `${raw} is not a real calendar date.` };
  }

  const normalised = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { valid: true, value: normalised };
}

/**
 * Format an ISO 'YYYY-MM-DD' string as '18 Apr 1991' for PDF/print reports.
 * Returns '' for null/blank/placeholder values.
 */
function formatDisplayDate(iso) {
  if (!iso) return '';
  const str = String(iso).slice(0, 10);
  if (str === '0001-01-01' || str === '0000-00-00') return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!match) return str;
  const monthIdx = Number(match[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return str;
  return `${match[3]} ${MONTHS_SHORT[monthIdx]} ${match[1]}`;
}

module.exports = {
  parseIsoDate,
  formatDisplayDate,
};
