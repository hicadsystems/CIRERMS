'use strict';

const dashboardRepo = require('./dashboard.repo');
const { passportPhotoUrl } = require('../../shared/rating-photo');

async function getSummary() {
  const [members, byRate, recent] = await Promise.all([
    dashboardRepo.getRatingsCounts(),
    dashboardRepo.getCurrentByRate(),
    dashboardRepo.getRecentlyEnlisted(5),
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
