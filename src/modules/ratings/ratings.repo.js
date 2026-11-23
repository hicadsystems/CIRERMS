'use strict';

const db = require('../../db');

const CURRENT_SHIP_JOIN = `
  LEFT JOIN (
    SELECT rd1.service_number, rd1.ship_id
      FROM rating_drafting rd1
     INNER JOIN (
       SELECT service_number, MAX(id) AS max_id
         FROM rating_drafting
        WHERE end_date IS NULL
        GROUP BY service_number
     ) latest_open ON latest_open.max_id = rd1.id
  ) cur_draft ON cur_draft.service_number = r.service_number
  LEFT JOIN ref_ship cur_ship ON cur_ship.id = cur_draft.ship_id
`;

const escapeLike = (s) => String(s).replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * The rating search select (GET /api/ratings/search): one page of suggestions. Every word typed must
 * start the official number or one of the names (surname, first, middle, maiden), so more words
 * narrow the list; the first word drives the index lookups. Fetches one row more than `limit` so the
 * caller knows whether another page exists. `account` is 'with' | 'without' | null; when it is given
 * the row carries the user name of the rating's account.
 */
async function searchForSelect({ q, status = 'all', account = null, offset = 0, limit = 10 }, conn = null) {
  const words = String(q).trim().split(/\s+/).filter(Boolean).slice(0, 5);
  const where = [];
  const params = [];
  words.forEach((w, i) => {
    const like = `${escapeLike(w)}%`;
    const cols = ['r.surname', 'r.first_name', 'r.middle_name', 'r.maiden_name'];
    if (words.length === 1 || i === 0) cols.unshift('r.service_number');
    where.push(`(${cols.map((c) => `${c} LIKE ?`).join(' OR ')})`);
    params.push(...cols.map(() => like));
  });
  if (status === 'current' || status === 'former') { where.push('r.status = ?'); params.push(status); }
  if (account === 'with') where.push('EXISTS (SELECT 1 FROM users u WHERE u.service_number = r.service_number)');
  if (account === 'without') where.push('NOT EXISTS (SELECT 1 FROM users u WHERE u.service_number = r.service_number)');
  const accountCol = account
    ? ', (SELECT u.username FROM users u WHERE u.service_number = r.service_number LIMIT 1) AS account'
    : '';
  return db.query(
    `SELECT r.service_number, r.status, r.surname, r.first_name, r.middle_name, r.maiden_name, r.passport_photo_path,
            t.name AS title_name, rt.name AS rate_name${accountCol}
       FROM ratings r
       LEFT JOIN ref_title t ON t.id = r.title_id
       LEFT JOIN ref_rate rt ON rt.id = r.rate_id
      WHERE ${where.join(' AND ')}
      ORDER BY (r.service_number = ?) DESC, r.surname, r.first_name, r.service_number
      LIMIT ? OFFSET ?`,
    [...params, words[0] || '', limit + 1, offset],
    conn
  );
}

const SORT_COLUMNS = Object.freeze({
  service_number: 'r.service_number',
  first_name: 'r.first_name',
  middle_name: 'r.middle_name',
  surname: 'r.surname',
  full_name: 'r.surname',
  rate_name: 'rate.sort_order',
  current_ship_name: 'cur_ship.name',
  exit_type_name: 'exit_t.name',
  exit_date: 'r.exit_date',
  branch_name: 'branch.name',
  command_name: 'cmd.name',
  created_at: 'r.created_at',
});

async function listRatings({
  status = 'current',
  officialNo = '',
  name = '',
  search = '',
  q = '',
  rateId = null,
  shipId = null,
  sortBy = 'service_number',
  sortDir = 'asc',
  page = 1,
  pageSize = 10,
  exportAll = false,
}) {
  const whereClauses = [];
  const params = [];
  if (status) {
    whereClauses.push('r.status = ?');
    params.push(status);
  }

  // Official No or name
  const trimmedQ = String(q || '').trim();
  if (trimmedQ) {
    const like = `%${trimmedQ}%`;
    whereClauses.push(`(
      r.service_number LIKE ?
      OR CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) LIKE ?
      OR CONCAT_WS(' ', r.first_name, r.middle_name, r.surname) LIKE ?
      OR CONCAT_WS(' ', r.first_name, r.surname) LIKE ?
    )`);
    params.push(like, like, like, like);
  }

  if (rateId) {
    whereClauses.push('r.rate_id = ?');
    params.push(rateId);
  }

  if (shipId) {
    whereClauses.push('cur_draft.ship_id = ?');
    params.push(shipId);
  }

  const trimmedOfficial = String(officialNo || '').trim();
  if (trimmedOfficial) {
    whereClauses.push('r.service_number LIKE ?');
    params.push(`%${trimmedOfficial}%`);
  }

  const trimmedName = String(name || '').trim();
  if (trimmedName) {
    const nameLike = `%${trimmedName}%`;
    whereClauses.push(`(
      r.surname LIKE ?
      OR r.first_name LIKE ?
      OR r.middle_name LIKE ?
      OR CONCAT_WS(' ', r.first_name, r.middle_name, r.surname) LIKE ?
      OR CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) LIKE ?
    )`);
    params.push(nameLike, nameLike, nameLike, nameLike, nameLike);
  }

  const trimmedSearch = String(search || '').trim();
  if (trimmedSearch) {
    const like = `%${trimmedSearch}%`;
    whereClauses.push(`(
      r.service_number LIKE ?
      OR r.surname LIKE ?
      OR r.first_name LIKE ?
      OR r.middle_name LIKE ?
      OR CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) LIKE ?
      OR rate.name LIKE ?
      OR cur_ship.name LIKE ?
      OR exit_t.name LIKE ?
      OR branch.name LIKE ?
    )`);
    params.push(like, like, like, like, like, like, like, like, like);
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const sortExpr = SORT_COLUMNS[sortBy] || SORT_COLUMNS.service_number;
  const direction = String(sortDir).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  const orderSql = sortBy === 'full_name'
    ? `ORDER BY r.surname ${direction}, r.first_name ${direction}, r.service_number ASC`
    : `ORDER BY ${sortExpr} ${direction}, r.service_number ASC`;

  const fromJoins = `
    FROM ratings r
    LEFT JOIN ref_rate rate ON rate.id = r.rate_id
    LEFT JOIN ref_title title ON title.id = r.title_id
    LEFT JOIN ref_exit_type exit_t ON exit_t.id = r.exit_type_id
    LEFT JOIN ref_branch branch ON branch.id = r.branch_id
    LEFT JOIN ref_command cmd ON cmd.id = r.command_id
    LEFT JOIN ref_state st ON st.id = r.state_id
    ${CURRENT_SHIP_JOIN}
  `;

  const countRows = await db.query(
    `SELECT COUNT(*) AS total ${fromJoins} ${whereSql}`,
    params
  );
  const total = Number(countRows[0]?.total || 0);

  const selectCols = `
    SELECT
      r.service_number,
      r.status,
      r.surname,
      r.first_name,
      r.middle_name,
      CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) AS full_name,
      r.rate_id,
      rate.name AS rate_name,
      title.name AS title_name,
      cur_ship.name AS current_ship_name,
      r.exit_type_id,
      exit_t.name AS exit_type_name,
      r.exit_date,
      r.exit_reason,
      branch.name AS branch_name,
      cmd.name AS command_name,
      st.name AS state_name,
      r.phone,
      r.email_address,
      r.date_employed
      ${exportAll ? '' : ', r.passport_photo_path'}
  `;

  if (exportAll) {
    const items = await db.query(
      `${selectCols} ${fromJoins} ${whereSql} ${orderSql} LIMIT 10000`,
      params
    );
    return {
      items,
      total: items.length,
      page: 1,
      pageSize: items.length || 1,
      totalPages: 1,
    };
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * pageSize;

  const items = await db.query(
    `${selectCols} ${fromJoins} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    items,
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}

async function findByServiceNumber(serviceNumber, conn = null) {
  const rows = await db.query(
    `
    SELECT
      r.*,
      CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) AS full_name,
      rate.name AS rate_name,
      title.name AS title_name,
      gender.name AS gender_name,
      ms.name AS marital_status_name,
      rel.name AS religion_name,
      denom.name AS religion_denomination_name,
      tribe.name AS tribe_name,
      st.name AS state_name,
      lga.name AS local_government_name,
      mb.name AS mother_base_name,
      gpz.name AS geo_political_zone_name,
      idt.name AS identification_type_name,
      hair.name AS hair_color_name,
      eye.name AS eye_color_name,
      comp.name AS complexion_name,
      bg.name AS blood_group_name,
      geno.name AS blood_genotype_name,
      dis.name AS disability_name,
      branch.name AS branch_name,
      cmd.name AS command_name,
      sbranch.name AS staff_branch_name,
      emode.name AS entry_mode_name,
      exit_t.name AS exit_type_name,
      spec.name AS specialisation_name,
      cur_draft.ship_id AS current_ship_id,
      cur_ship.name AS current_ship_name
    FROM ratings r
    LEFT JOIN ref_rate rate ON rate.id = r.rate_id
    LEFT JOIN ref_title title ON title.id = r.title_id
    LEFT JOIN ref_gender gender ON gender.id = r.gender_id
    LEFT JOIN ref_marital_status ms ON ms.id = r.marital_status_id
    LEFT JOIN ref_religion rel ON rel.id = r.religion_id
    LEFT JOIN ref_religion_denomination denom ON denom.id = r.religion_denomination_id
    LEFT JOIN ref_tribe tribe ON tribe.id = r.tribe_id
    LEFT JOIN ref_state st ON st.id = r.state_id
    LEFT JOIN ref_local_government lga ON lga.id = r.local_government_id
    LEFT JOIN ref_mother_base mb ON mb.id = r.mother_base_id
    LEFT JOIN ref_geo_political_zone gpz ON gpz.id = r.geo_political_zone_id
    LEFT JOIN ref_identification_type idt ON idt.id = r.identification_type_id
    LEFT JOIN ref_hair_color hair ON hair.id = r.hair_color_id
    LEFT JOIN ref_eye_color eye ON eye.id = r.eye_color_id
    LEFT JOIN ref_complexion comp ON comp.id = r.complexion_id
    LEFT JOIN ref_blood_group bg ON bg.id = r.blood_group_id
    LEFT JOIN ref_blood_genotype geno ON geno.id = r.blood_genotype_id
    LEFT JOIN ref_disability dis ON dis.id = r.disability_id
    LEFT JOIN ref_branch branch ON branch.id = r.branch_id
    LEFT JOIN ref_command cmd ON cmd.id = r.command_id
    LEFT JOIN ref_staff_branch sbranch ON sbranch.id = r.staff_branch_id
    LEFT JOIN ref_entry_mode emode ON emode.id = r.entry_mode_id
    LEFT JOIN ref_exit_type exit_t ON exit_t.id = r.exit_type_id
    LEFT JOIN ref_specialisation spec ON spec.id = r.specialisation_id
    ${CURRENT_SHIP_JOIN}
    WHERE r.service_number = ?
    LIMIT 1
    `,
    [serviceNumber],
    conn
  );
  return rows[0] || null;
}

async function existsByServiceNumber(serviceNumber, conn = null) {
  const rows = await db.query(
    'SELECT service_number FROM ratings WHERE service_number = ? LIMIT 1',
    [serviceNumber],
    conn
  );
  return rows.length > 0;
}

async function getAllServiceNumbersSet() {
  const rows = await db.query('SELECT UPPER(service_number) AS sn FROM ratings');
  return new Set(rows.map((r) => r.sn));
}

async function insertRating(fieldsObj, conn = null) {
  const cols = Object.keys(fieldsObj);
  const placeholders = cols.map(() => '?').join(', ');
  const values = cols.map((k) => fieldsObj[k]);
  await db.query(
    `INSERT INTO ratings (${cols.join(', ')}) VALUES (${placeholders})`,
    values,
    conn
  );
}

async function updateRatingByServiceNumber(currentServiceNumber, fieldsObj, conn = null) {
  const cols = Object.keys(fieldsObj);
  if (cols.length === 0) return;
  const assignments = cols.map((k) => `${k} = ?`).join(', ');
  const values = cols.map((k) => fieldsObj[k]);
  await db.query(
    `UPDATE ratings SET ${assignments} WHERE service_number = ?`,
    [...values, currentServiceNumber],
    conn
  );
}

async function deleteRating(serviceNumber, conn = null) {
  const res = await db.query('DELETE FROM ratings WHERE service_number = ?', [serviceNumber], conn);
  return res.affectedRows > 0;
}

/** The ratings row alone (no joined names), for the audit trail's before and after. */
async function findRawRating(serviceNumber, conn = null) {
  const rows = await db.query('SELECT * FROM ratings WHERE service_number = ? LIMIT 1', [serviceNumber], conn);
  return rows[0] || null;
}

// ============================================================================
// Child tables (Next of Kin, Spouse, Children, Advancement, Drafting, Training, Education, Language)
// ============================================================================

async function listNextOfKin(serviceNumber) {
  return db.query(
    `SELECT nok.*, nokt.name AS next_of_kin_type_name
       FROM rating_next_of_kin nok
       LEFT JOIN ref_next_of_kin_type nokt ON nokt.id = nok.next_of_kin_type_id
      WHERE nok.service_number = ?
      ORDER BY nok.id ASC`,
    [serviceNumber]
  );
}

async function listSpouse(serviceNumber) {
  return db.query(
    `SELECT * FROM rating_spouse WHERE service_number = ? ORDER BY id ASC`,
    [serviceNumber]
  );
}

async function listChildren(serviceNumber) {
  return db.query(
    `SELECT * FROM rating_children WHERE service_number = ? ORDER BY id ASC`,
    [serviceNumber]
  );
}

async function listAdvancement(serviceNumber) {
  return db.query(
    `SELECT adv.*, rate.name AS rate_name,
            CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) AS rating_name
       FROM rating_advancement adv
       INNER JOIN ratings r ON r.service_number = adv.service_number
       LEFT JOIN ref_rate rate ON rate.id = adv.rate_id
      WHERE adv.service_number = ?
      ORDER BY COALESCE(adv.start_date, '9999-12-31') DESC, adv.id DESC`,
    [serviceNumber]
  );
}

async function listDrafting(serviceNumber) {
  return db.query(
    `SELECT dr.*, ship.name AS ship_name, rate.name AS rate_name,
            CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) AS rating_name
       FROM rating_drafting dr
       INNER JOIN ratings r ON r.service_number = dr.service_number
       LEFT JOIN ref_ship ship ON ship.id = dr.ship_id
       LEFT JOIN ref_rate rate ON rate.id = dr.rate_id
      WHERE dr.service_number = ?
      ORDER BY (dr.end_date IS NULL) DESC, COALESCE(dr.start_date, '9999-12-31') DESC, dr.id DESC`,
    [serviceNumber]
  );
}

async function listTraining(serviceNumber) {
  return db.query(
    `SELECT tr.*, CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) AS rating_name
       FROM rating_training tr
       INNER JOIN ratings r ON r.service_number = tr.service_number
      WHERE tr.service_number = ?
      ORDER BY COALESCE(tr.start_date, '9999-12-31') DESC, tr.id DESC`,
    [serviceNumber]
  );
}

async function listEducation(serviceNumber) {
  return db.query(
    `SELECT ed.*, CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) AS rating_name
       FROM rating_education ed
       INNER JOIN ratings r ON r.service_number = ed.service_number
      WHERE ed.service_number = ?
      ORDER BY COALESCE(ed.start_date, '9999-12-31') DESC, ed.id DESC`,
    [serviceNumber]
  );
}

async function listLanguage(serviceNumber) {
  return db.query(
    `SELECT lg.*, lang.name AS language_name,
            CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) AS rating_name
       FROM rating_language lg
       INNER JOIN ratings r ON r.service_number = lg.service_number
       LEFT JOIN ref_language lang ON lang.id = lg.language_id
      WHERE lg.service_number = ?
      ORDER BY lang.sort_order ASC, lang.name ASC`,
    [serviceNumber]
  );
}

async function listDocuments(serviceNumber, { categoryId = null, categoryCode = null } = {}) {
  const clauses = ['doc.service_number = ?'];
  const params = [serviceNumber];

  if (categoryId) {
    clauses.push('doc.category_id = ?');
    params.push(categoryId);
  }
  if (categoryCode) {
    clauses.push('cat.code = ?');
    params.push(categoryCode);
  }

  return db.query(
    `SELECT
       doc.id,
       doc.service_number,
       doc.category_id,
       cat.code AS category_code,
       cat.name AS category_name,
       doc.original_name,
       doc.stored_name,
       doc.mime_type,
       doc.size_bytes,
       doc.created_at
     FROM rating_documents doc
     INNER JOIN ref_document_category cat ON cat.id = doc.category_id
     WHERE ${clauses.join(' AND ')}
     ORDER BY doc.created_at DESC, doc.id DESC`,
    params
  );
}

async function fetchAllChildBundles(serviceNumber) {
  const [
    nextOfKin,
    spouse,
    children,
    advancement,
    drafting,
    training,
    education,
    language,
    documents,
  ] = await Promise.all([
    listNextOfKin(serviceNumber),
    listSpouse(serviceNumber),
    listChildren(serviceNumber),
    listAdvancement(serviceNumber),
    listDrafting(serviceNumber),
    listTraining(serviceNumber),
    listEducation(serviceNumber),
    listLanguage(serviceNumber),
    listDocuments(serviceNumber),
  ]);

  return {
    nextOfKin,
    spouse,
    children,
    advancement,
    drafting,
    training,
    education,
    language,
    documents,
  };
}

async function insertChildRow(tableName, fieldsObj, conn = null) {
  const cols = Object.keys(fieldsObj);
  const placeholders = cols.map(() => '?').join(', ');
  const values = cols.map((k) => fieldsObj[k]);
  const res = await db.query(
    `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`,
    values,
    conn
  );
  return res.insertId;
}

async function findChildRow(tableName, id, serviceNumber, conn = null) {
  const rows = await db.query(
    `SELECT * FROM ${tableName} WHERE id = ? AND service_number = ? LIMIT 1`,
    [id, serviceNumber],
    conn
  );
  return rows[0] || null;
}

async function updateChildRow(tableName, id, serviceNumber, fieldsObj, conn = null) {
  const cols = Object.keys(fieldsObj);
  if (cols.length === 0) return false;
  const assignments = cols.map((k) => `${k} = ?`).join(', ');
  const values = cols.map((k) => fieldsObj[k]);
  const res = await db.query(
    `UPDATE ${tableName} SET ${assignments} WHERE id = ? AND service_number = ?`,
    [...values, id, serviceNumber],
    conn
  );
  return res.affectedRows > 0;
}

async function deleteChildRow(tableName, id, serviceNumber, conn = null) {
  const res = await db.query(
    `DELETE FROM ${tableName} WHERE id = ? AND service_number = ?`,
    [id, serviceNumber],
    conn
  );
  return res.affectedRows > 0;
}

async function findDocumentById(docId, serviceNumber, conn = null) {
  const rows = await db.query(
    `SELECT doc.*, cat.code AS category_code, cat.name AS category_name
       FROM rating_documents doc
       INNER JOIN ref_document_category cat ON cat.id = doc.category_id
      WHERE doc.id = ? AND doc.service_number = ?
      LIMIT 1`,
    [docId, serviceNumber],
    conn
  );
  return rows[0] || null;
}

/** The user account that belongs to the rating, if any. */
/** An account's user name is its rating's official number: when the number changes (the link followed it
 *  by ON UPDATE CASCADE) the user name is set to the new number. Returns the account's id, or null. */
async function followOfficialNumber(newServiceNumber, conn = null) {
  const rows = await db.query('SELECT id, username FROM users WHERE service_number = ? LIMIT 1', [newServiceNumber], conn);
  if (!rows[0]) return null;
  if (rows[0].username !== newServiceNumber) {
    await db.query('UPDATE users SET username = ? WHERE id = ?', [newServiceNumber, rows[0].id], conn);
  }
  return { id: rows[0].id, before: rows[0].username };
}

async function usernameTaken(username, exceptServiceNumber, conn = null) {
  const rows = await db.query('SELECT 1 FROM users WHERE username = ? AND service_number <> ? LIMIT 1', [username, exceptServiceNumber], conn);
  return rows.length > 0;
}

async function findAccountUsername(serviceNumber, conn = null) {
  const rows = await db.query('SELECT username FROM users WHERE service_number = ? LIMIT 1', [serviceNumber], conn);
  return rows[0] ? rows[0].username : null;
}

module.exports = {
  findAccountUsername,
  followOfficialNumber,
  usernameTaken,
  listRatings,
  searchForSelect,
  findByServiceNumber,
  existsByServiceNumber,
  getAllServiceNumbersSet,
  insertRating,
  updateRatingByServiceNumber,
  deleteRating,
  findRawRating,
  listNextOfKin,
  listSpouse,
  listChildren,
  listAdvancement,
  listDrafting,
  listTraining,
  listEducation,
  listLanguage,
  listDocuments,
  fetchAllChildBundles,
  insertChildRow,
  findChildRow,
  updateChildRow,
  deleteChildRow,
  findDocumentById,
};
