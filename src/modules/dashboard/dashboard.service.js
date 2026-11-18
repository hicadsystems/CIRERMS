'use strict';

const dashboardRepo = require('./dashboard.repo');

async function getSummary() {
  const [members, byRate, recent] = await Promise.all([
    dashboardRepo.getRatingsCounts(),
    dashboardRepo.getCurrentByRate(),
    dashboardRepo.getRecentlyEnlisted(5),
  ]);

  return {
    members,
    currentByRate: byRate,
    recentlyEnlisted: recent,
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
