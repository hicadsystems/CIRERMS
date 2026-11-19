'use strict';

/*
 * An account's name comes from its rating (every account belongs to one), written as the rest of the
 * app writes a rating's name: the rate's abbreviation, then surname, first name and middle name
 * ("MWO ADMINISTRATOR HICO"). Select NAME_COLUMNS and join NAME_JOINS (the users table aliased `u`),
 * then read accountName(row) and accountInitials(row); nothing reads users.full_name.
 */
const NAME_COLUMNS = `rg.surname AS rating_surname, rg.first_name AS rating_first_name,
       rg.middle_name AS rating_middle_name, rr.name AS rating_rate_name`;
const NAME_JOINS = `LEFT JOIN ratings rg ON rg.service_number = u.service_number
       LEFT JOIN ref_rate rr ON rr.id = rg.rate_id`;

const shortRate = (rate) => {
  const m = /\(([^)]+)\)/.exec(rate || '');
  return m ? m[1] : rate || '';
};

function accountName(row) {
  const person = [row.rating_surname, row.rating_first_name, row.rating_middle_name].filter(Boolean).join(' ');
  return [shortRate(row.rating_rate_name), person].filter(Boolean).join(' ') || row.username || '';
}

/** Surname and first name initials, no rate ("AH"). */
function accountInitials(row) {
  return [row.rating_surname, row.rating_first_name].filter(Boolean).map((w) => String(w)[0].toUpperCase()).join('') || null;
}

module.exports = { NAME_COLUMNS, NAME_JOINS, accountName, accountInitials };
