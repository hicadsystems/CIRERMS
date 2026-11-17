const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Normalise a database ISO date ('YYYY-MM-DD' or ISO timestamp) to 'YYYY-MM-DD'
 * suitable for `<input type="date">`, returning '' for null or placeholder dates.
 */
export function toInputDate(value) {
  if (!value) return '';
  const slice = String(value).slice(0, 10);
  if (slice === '0001-01-01' || slice === '0000-00-00') return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : '';
}

/**
 * Format an ISO date as '18 Apr 1991' for clean table & dossier display.
 * Never renders '0001-01-01' or raw 'T00:00:00' timestamps.
 */
export function formatDisplayDate(value) {
  const clean = toInputDate(value);
  if (!clean) return '';
  const [y, m, d] = clean.split('-');
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return clean;
  return `${d} ${MONTHS[idx]} ${y}`;
}
