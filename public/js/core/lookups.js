import { api } from './api.js';

let cachedLookups = null;
let inflightPromise = null;

export async function getLookups({ force = false } = {}) {
  if (cachedLookups && !force) {
    return cachedLookups;
  }
  if (inflightPromise && !force) {
    return inflightPromise;
  }

  inflightPromise = api
    .get('/api/lookups')
    .then((res) => {
      cachedLookups = res.data;
      inflightPromise = null;
      return cachedLookups;
    })
    .catch((err) => {
      inflightPromise = null;
      throw err;
    });

  return inflightPromise;
}

/** Forget the cached lists: Static Tables calls it after a change, so the next form reads them afresh. */
export function invalidateLookups() {
  cachedLookups = null;
}

/**
 * The dropdown options of one lookup (`key`: 'ships', 'rates' ...) as { value, label }, plus the row
 * a record still holds when it has since been made inactive (it is not in the active list).
 */
export function optionsWithHeld(lookups, key, held, list = lookups && lookups[key]) {
  const options = (list || []).map((x) => ({ value: x.id, label: x.name }));
  if (held !== undefined && held !== null && held !== '' && !options.some((o) => String(o.value) === String(held))) {
    const off = ((lookups && lookups.inactive && lookups.inactive[key]) || []).find((x) => String(x.id) === String(held));
    if (off) options.push({ value: off.id, label: `${off.name} (Inactive)` });
  }
  return options;
}

export function filterDenominations(lookups, religionId) {
  if (!lookups || !religionId) return [];
  const target = Number(religionId);
  return (lookups.religionDenominations || []).filter((d) => Number(d.religionId) === target);
}

export function filterLgas(lookups, stateId) {
  if (!lookups || !stateId) return [];
  const target = Number(stateId);
  return (lookups.localGovernments || []).filter((l) => Number(l.stateId) === target);
}
