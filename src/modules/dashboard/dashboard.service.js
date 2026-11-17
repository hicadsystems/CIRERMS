'use strict';

const dashboardRepo = require('./dashboard.repo');

async function getSummary() {
  const members = await dashboardRepo.getRatingsCounts();

  return {
    members,
    // Non-Ratings modules remain disabled/zeroed in the Ratings Management migration demo
    drafting: {
      postedLastThreeMonths: 0,
    },
    memos: {
      unread: 0,
      total: 0,
    },
    appraisals: {
      total: 0,
    },
  };
}

module.exports = {
  getSummary,
};
