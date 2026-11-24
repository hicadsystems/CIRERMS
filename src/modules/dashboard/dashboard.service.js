'use strict';

const dashboardRepo = require('./dashboard.repo');
const { passportPhotoUrl } = require('../../shared/rating-photo');
const appraisalRepo = require('../appraisal/appraisal.repo');

async function getSummary() {
  const [members, byRate, recent, appraisals, drafting, discipline, discharge] = await Promise.all([
    dashboardRepo.getRatingsCounts(),
    dashboardRepo.getCurrentByRate(),
    dashboardRepo.getRecentlyEnlisted(5),
    appraisalRepo.dashboardCounts(),
    dashboardRepo.getDraftingCounts(),
    dashboardRepo.getDisciplineCounts(),
    dashboardRepo.getDischargeCounts(),
  ]);

  return {
    members,
    currentByRate: byRate,
    recentlyEnlisted: recent.map((rating) => {
      const { passport_photo_path: photoPath, ...safeRating } = rating;
      return {
        ...safeRating,
        passport_photo_url: passportPhotoUrl(rating.service_number, photoPath),
      };
    }),
    // the tiles of the other modules, counted from their own tables
    drafting,
    discipline,
    discharge,
    // Naval Character Assessment (WP12): appraisals recorded this month (cancelled ones left out) and the open periods
    appraisals: {
      month: appraisals.month,
      openPeriods: appraisals.openPeriods,
      total: appraisals.month,
    },
  };
}

module.exports = {
  getSummary,
};
