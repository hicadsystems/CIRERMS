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
