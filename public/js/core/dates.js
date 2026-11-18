/*
 * dates: dates go over the wire as YYYY-MM-DD and show as dd/mm/yyyy.
 *
 *   toInputDate(v)        'YYYY-MM-DD' for <input type="date"> ('' for none or 0001-01-01)
 *   formatDisplayDate(v)  'dd/mm/yyyy' ('' for none)
 *   yearsBetween(from, to)  whole years (an age, years of service); to defaults to today
 *   durationSince(from)   '3 yr 2 mo' or '7 mo' up to today
 *   parseDisplayDate(t)   a typed 'dd/mm/yyyy' as 'YYYY-MM-DD' ('' when empty, null when not a date)
 *   wireDateField(input)  tidies a dd/mm/yyyy field when it loses focus
 */

/** Normalises 'YYYY-MM-DD' or an ISO timestamp to 'YYYY-MM-DD', '' for null or placeholder dates. */
export function toInputDate(value) {
  if (!value) return '';
  const slice = String(value).slice(0, 10);
  if (slice === '0001-01-01' || slice === '0000-00-00') return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : '';
}

/** 'dd/mm/yyyy', or '' when there is no date. */
export function formatDisplayDate(value) {
  const clean = toInputDate(value);
  if (!clean) return '';
  const [y, m, d] = clean.split('-');
  return `${d}/${m}/${y}`;
}

function parts(value) {
  const clean = toInputDate(value);
  if (!clean) return null;
  const [y, m, d] = clean.split('-').map(Number);
  return { y, m, d };
}

function today() {
  const t = new Date();
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
}

/** Whole years from one date to another (default today); null when `from` is missing. */
export function yearsBetween(from, to) {
  const a = parts(from);
  if (!a) return null;
  const b = parts(to) || today();
  let years = b.y - a.y;
  if (b.m < a.m || (b.m === a.m && b.d < a.d)) years -= 1;
  return Math.max(0, years);
}

/** '3 yr 2 mo' (or '7 mo') from a date to today; '' when there is no date. */
export function durationSince(from) {
  const a = parts(from);
  if (!a) return '';
  const b = today();
  let months = (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0);
  months = Math.max(0, months);
  return months >= 12 ? `${Math.floor(months / 12)} yr ${months % 12} mo` : `${months} mo`;
}

/**
 * Reads a typed date: '18/04/1991' (also 18-04-1991, 18.4.1991 or 18041991).
 * Returns 'YYYY-MM-DD', '' when empty, or null when it is not a real date.
 */
export function parseDisplayDate(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  let m = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4})$/.exec(raw);
  if (!m && /^\d{8}$/.test(raw)) m = [raw, raw.slice(0, 2), raw.slice(2, 4), raw.slice(4)];
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * A dd/mm/yyyy text field (the browser's own date field follows its locale).
 * Tidies what was typed when it loses focus; read it with parseDisplayDate.
 */
export function wireDateField(input) {
  input.addEventListener('blur', () => {
    const iso = parseDisplayDate(input.value);
    if (iso) input.value = formatDisplayDate(iso);
  });
  return input;
}
