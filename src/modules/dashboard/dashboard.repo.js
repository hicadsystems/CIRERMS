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

// Current ratings per rate, in the rate list's order; rates with nobody are left out.
async function getCurrentByRate() {
  const rows = await db.query(`
    SELECT rate.id, rate.name, COUNT(*) AS total
      FROM ratings r
      JOIN ref_rate rate ON rate.id = r.rate_id
     WHERE r.status = 'current'
     GROUP BY rate.id, rate.name, rate.sort_order
     ORDER BY rate.sort_order ASC, rate.name ASC
  `);
  return rows.map((r) => ({ rateId: r.id, rate: r.name, total: Number(r.total) || 0 }));
}

// The newest enlistments (date employed, else the day the record was added), with the current ship.
async function getRecentlyEnlisted(limit) {
  const rows = await db.query(
    `
    SELECT r.service_number, r.surname, r.first_name, r.middle_name, r.status, r.passport_photo_path,
           rate.name AS rate_name, ship.name AS current_ship_name,
           COALESCE(r.date_employed, DATE(r.created_at)) AS enlisted
      FROM ratings r
      LEFT JOIN ref_rate rate ON rate.id = r.rate_id
      LEFT JOIN (
        SELECT d.service_number, d.ship_id
          FROM rating_drafting d
          JOIN (SELECT service_number, MAX(id) AS max_id FROM rating_drafting WHERE end_date IS NULL GROUP BY service_number) o
            ON o.max_id = d.id
      ) cur ON cur.service_number = r.service_number
      LEFT JOIN ref_ship ship ON ship.id = cur.ship_id
     ORDER BY enlisted DESC, r.service_number ASC
     LIMIT ?
    `,
    [limit]
  );
  return rows;
}

module.exports = {
  getRatingsCounts,
  getCurrentByRate,
  getRecentlyEnlisted,
};
