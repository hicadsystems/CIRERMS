'use strict';
/* Handlebars helpers for the printouts (src/shared/printouts registers them).
   Dates are written dd/mm/yyyy, empty details "N/A" (facts) or "-" (tables), numbers with thousands separators. */

function esc(v) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function dmy(v) {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
}

/* Date and time as dd/mm/yyyy hh:mm in Nigerian time (WAT, Africa/Lagos). A Date, or a string with a zone
   ("...Z", "+01:00"), is converted; a string without a zone is taken as UTC, as the database gives it. */
const WAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Lagos', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function dmyTime(v) {
  if (v === null || v === undefined || v === '') return '';
  let when = v instanceof Date ? v : null;
  if (!when) {
    const s = String(v).trim();
    if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) return dmy(s);
    when = new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s.replace(' ', 'T')}Z`);
  }
  if (Number.isNaN(when.getTime())) return '';
  const p = Object.fromEntries(WAT.formatToParts(when).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

function num(v, digits = 0) {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatValue(v, kind) {
  if (v === null || v === undefined || v === '') return '';
  if (kind === 'date') return dmy(v);
  if (kind === 'num') return num(v);
  if (kind === 'yesno') return v === true || v === 1 || v === 'Yes' ? 'Yes' : 'No';
  return String(v);
}

module.exports = function register(Handlebars) {
  const SafeString = Handlebars.SafeString;
  Handlebars.registerHelper('date', (v) => dmy(v) || '-');
  Handlebars.registerHelper('datetime', (v) => dmyTime(v));
  Handlebars.registerHelper('num', (v, d) => num(v, typeof d === 'number' ? d : 0));
  Handlebars.registerHelper('len', (a) => (Array.isArray(a) ? a.length : 0));
  Handlebars.registerHelper('add', (a, b) => Number(a) + Number(b));
  Handlebars.registerHelper('eq', (a, b) => a === b);
  Handlebars.registerHelper('upper', (v) => String(v || '').toUpperCase());

  /* a fact's value: "N/A" when empty */
  Handlebars.registerHelper('factValue', (f) => {
    const v = formatValue(f.value, f.kind);
    return new SafeString(v === '' ? '<dd class="empty">N/A</dd>' : `<dd${f.kind === 'code' ? ' style="font-family:var(--font-mono)"' : ''}>${esc(v)}</dd>`);
  });

  /* one table row's cells; columns: { key, label, kind: text|code|name|num|date|ctr|yesno|flag|index|check|fill, w, nowrap } */
  Handlebars.registerHelper('rowCells', (row, columns, index) => {
    const cells = columns.map((c) => {
      const kind = c.kind || 'text';
      if (kind === 'check') return '<td class="ctr"><span class="checkbox"></span></td>';
      if (kind === 'fill') return '<td></td>';
      let v = '';
      if (kind === 'index') v = String(index + 1);
      else v = formatValue(row[c.key], kind);
      const cls = [kind === 'num' || kind === 'money' ? 'num' : '', kind === 'ctr' || kind === 'yesno' || kind === 'index' ? 'ctr' : '',
        kind === 'code' ? 'code' : '', kind === 'name' ? 'name' : '', kind === 'date' ? 'date' : '', kind === 'flag' ? 'flag' : '',
        c.nowrap ? 'nowrap' : '', v === '' ? 'empty' : ''].filter(Boolean).join(' ');
      return `<td class="${cls}">${v === '' ? '-' : esc(v)}</td>`;
    });
    return new SafeString(cells.join(''));
  });

  /* the totals row: the label in the first cell it names, figures under their columns */
  Handlebars.registerHelper('totalCells', (totals, columns) => new SafeString(columns.map((c) => {
    const v = totals[c.key];
    const cls = c.kind === 'num' ? 'num' : '';
    return `<td class="${cls}">${v === undefined || v === null ? '' : esc(formatValue(v, c.kind))}</td>`;
  }).join('')));

  Handlebars.registerHelper('headCells', (columns) => new SafeString(columns.map((c) => {
    const cls = c.kind === 'num' ? 'num' : c.kind === 'ctr' || c.kind === 'yesno' || c.kind === 'index' ? 'ctr' : '';
    const w = c.w ? ` style="width:${esc(c.w)}"` : '';
    return `<th class="${cls}"${w}>${esc(c.label)}</th>`;
  }).join('')));
};
module.exports.dmy = dmy;
module.exports.dmyTime = dmyTime;
