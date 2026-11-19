'use strict';
/* Handlebars helpers for the printouts. WP13 carries these over to the app's renderer unchanged.
   Dates are written dd/mm/yyyy, empty details "N/A" (facts) or "-" (tables), numbers with thousands separators. */

function esc(v) {
  return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function dmy(v) {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v);
}

function dmyTime(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(v || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]} UTC` : dmy(v);
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
