'use strict';

function passportPhotoUrl(serviceNumber, storedPath) {
  if (!serviceNumber || !storedPath) return null;
  return `/api/ratings/${encodeURIComponent(serviceNumber)}/photo/passport?v=${encodeURIComponent(storedPath)}`;
}

module.exports = { passportPhotoUrl };
