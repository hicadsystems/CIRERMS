'use strict';

const db = require('../../db');

async function getRatingsCounts() {
  const rows = await db.query(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status = 'former' THEN 1 ELSE 0 END), 0) AS former,
      COALESCE(SUM(CASE WHEN status = 'current' THEN 1 ELSE 0 END), 0) AS current_count
    FROM ratings
  `);

  const row = rows[0] || { total: 0, former: 0, current_count: 0 };
  return {
    total: Number(row.total) || 0,
    former: Number(row.former) || 0,
    current: Number(row.current_count) || 0,
  };
}

module.exports = {
  getRatingsCounts,
};
