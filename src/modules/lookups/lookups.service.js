'use strict';

const lookupsRepo = require('./lookups.repo');
const { badRequest } = require('../../shared/errors');

async function getAllLookups() {
  return lookupsRepo.fetchAllLookups();
}

async function getDenominations(religionIdRaw) {
  if (!religionIdRaw) {
    return lookupsRepo.fetchReligionDenominations(null);
  }
  const religionId = Number.parseInt(religionIdRaw, 10);
  if (!Number.isFinite(religionId) || religionId <= 0) {
    throw badRequest('religionId must be a positive integer.');
  }
  return lookupsRepo.fetchReligionDenominations(religionId);
}

async function getLocalGovernments(stateIdRaw) {
  if (!stateIdRaw) {
    return lookupsRepo.fetchLocalGovernments(null);
  }
  const stateId = Number.parseInt(stateIdRaw, 10);
  if (!Number.isFinite(stateId) || stateId <= 0) {
    throw badRequest('stateId must be a positive integer.');
  }
  return lookupsRepo.fetchLocalGovernments(stateId);
}

module.exports = {
  getAllLookups,
  getDenominations,
  getLocalGovernments,
};
