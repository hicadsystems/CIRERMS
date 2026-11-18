/*
 * rating names: how a rating is named on screen, the same everywhere.
 *
 *   shortRate('Petty Officer (PO)')   'PO'
 *   ratingName(r)                     'PO OKONKWO CHUKWUEMEKA IFEANYI' (the record head, search)
 *   personName(r)                     'OKONKWO CHUKWUEMEKA IFEANYI' (for initials and lists)
 */
export function shortRate(rate) {
  const m = /\(([^)]+)\)/.exec(rate || '');
  return m ? m[1] : rate || '';
}

export function personName(r = {}) {
  return r.full_name || [r.surname, r.first_name, r.middle_name].filter(Boolean).join(' ');
}

export function ratingName(r = {}) {
  return [r.title_name || shortRate(r.rate_name), personName(r)].filter(Boolean).join(' ');
}
