'use strict';

const db = require('../../db');

const like = (q) => `%${String(q).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

async function options() {
  const [exitTypes, branches, rates, entryModes] = await Promise.all([
    db.query('SELECT id, name, code, keeps_current AS keepsCurrent, is_death AS isDeath, is_active FROM ref_exit_type WHERE is_active = 1 ORDER BY sort_order, name'),
    db.query('SELECT id, name, code FROM ref_branch WHERE is_active = 1 ORDER BY sort_order, name'),
    db.query('SELECT id, name, code FROM ref_rate WHERE is_active = 1 ORDER BY sort_order, name'),
    db.query('SELECT id, name, code FROM ref_entry_mode WHERE is_active = 1 ORDER BY sort_order, name'),
  ]);
  return { exitTypes, branches, rates, entryModes };
}

async function exitType(id, conn = null) {
  const r = await db.query('SELECT id, name, code, keeps_current AS keepsCurrent, is_death AS isDeath, is_active FROM ref_exit_type WHERE id = ?', [id], conn);
  return r[0] || null;
}

const DUE_SELECT = `
  SELECT r.service_number, r.surname, r.first_name, r.middle_name, r.date_of_birth,
         r.date_employed, r.status, r.exit_type_id, r.exit_date,
         rt.name AS rate_name, rt.code AS rate_code, br.name AS branch_name, em.name AS entry_mode_name,
         (SELECT sh.name FROM rating_drafting d JOIN ref_ship sh ON sh.id = d.ship_id
           WHERE d.service_number = r.service_number AND d.end_date IS NULL ORDER BY d.id DESC LIMIT 1) AS current_ship_name,
         (SELECT p.proposal_number FROM discharge_rows d JOIN discharge_proposals p ON p.id=d.proposal_id
           WHERE d.service_number=r.service_number AND d.status='pending' ORDER BY p.proposed_at DESC,p.id DESC LIMIT 1) AS proposal_number,
         (SELECT p.id FROM discharge_rows d JOIN discharge_proposals p ON p.id=d.proposal_id
           WHERE d.service_number=r.service_number AND d.status='pending' ORDER BY p.proposed_at DESC,p.id DESC LIMIT 1) AS proposal_id,
         (SELECT x.reengage_date FROM discharge_reengagements x WHERE x.service_number=r.service_number ORDER BY x.reengage_date DESC,x.id DESC LIMIT 1) AS last_reengagement_date,
         (SELECT x.period_months FROM discharge_reengagements x WHERE x.service_number=r.service_number ORDER BY x.reengage_date DESC,x.id DESC LIMIT 1) AS last_reengagement_period,
         (SELECT x.until_date FROM discharge_reengagements x WHERE x.service_number=r.service_number ORDER BY x.reengage_date DESC,x.id DESC LIMIT 1) AS last_reengagement_until,
         TIMESTAMPDIFF(YEAR, r.date_of_birth, ?) AS age,
         TIMESTAMPDIFF(YEAR, r.date_employed, ?) AS years_service,
         (SELECT COUNT(*) FROM discipline_cases c WHERE c.service_number = r.service_number AND c.status = 'pending') AS pending_cases,
         (SELECT COUNT(*) FROM discharge_reengagements x WHERE x.service_number = r.service_number
            AND x.until_date >= ?) AS reengaged
    FROM ratings r
    LEFT JOIN ref_rate rt ON rt.id = r.rate_id
    LEFT JOIN ref_branch br ON br.id = r.branch_id
    LEFT JOIN ref_entry_mode em ON em.id = r.entry_mode_id`;

// The due rule, as one fragment: the age or the years of service reached on `today` (the settings
// discharge.age_due and discharge.service_due), and who it never lists: a rating re-engaged until later, or one with a
// closed or scheduled discharge. Process Discharge and Reports' Retirement Forecast both read these.
const DUE_RULE = '(TIMESTAMPDIFF(YEAR, r.date_of_birth, ?) >= ? OR TIMESTAMPDIFF(YEAR, r.date_employed, ?) >= ?)';
const dueRuleParams = (f) => [f.today, f.ageDue, f.today, f.serviceDue];
const DUE_EXCLUSIONS = [
  'NOT EXISTS (SELECT 1 FROM discharge_reengagements x WHERE x.service_number = r.service_number AND x.until_date >= ?)',
  "NOT EXISTS (SELECT 1 FROM discharge_rows d WHERE d.service_number = r.service_number AND d.status IN ('closed','scheduled'))",
];
const dueExclusionParams = (f) => [f.today];

function dueWhere(f) {
  const sql = ["r.status = 'current'", DUE_RULE];
  const params = dueRuleParams(f);
  if (f.branchId) { sql.push('r.branch_id = ?'); params.push(f.branchId); }
  if (f.rateId) { sql.push('r.rate_id = ?'); params.push(f.rateId); }
  if (f.entryModeId) { sql.push('r.entry_mode_id = ?'); params.push(f.entryModeId); }
  if (f.q) {
    sql.push("(r.service_number LIKE ? OR CONCAT_WS(' ', r.surname, r.first_name, r.middle_name) LIKE ? OR CONCAT_WS(' ', r.first_name, r.middle_name, r.surname) LIKE ?)");
    const term = `%${String(f.q).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    params.push(term, term, term);
  }
  sql.push(...DUE_EXCLUSIONS);
  params.push(...dueExclusionParams(f));
  return { sql: `WHERE ${sql.join(' AND ')}`, params };
}

async function listDue(f, { page = 1, pageSize = 25 } = {}, conn = null) {
  const w = dueWhere(f);
  const dueSql = w.sql;
  const wParams = w.params;
  const [{ total }] = await db.query(`SELECT COUNT(*) AS total FROM ratings r ${dueSql}`, wParams, conn);
  const [{ inProposal }] = await db.query(
    `SELECT COUNT(DISTINCT r.service_number) AS inProposal FROM ratings r ${dueSql}
       AND EXISTS (SELECT 1 FROM discharge_rows d WHERE d.service_number = r.service_number AND d.status = 'pending')`,
    wParams, conn);
  const items = await db.query(
    `${DUE_SELECT} ${dueSql}
     ORDER BY TIMESTAMPDIFF(YEAR, r.date_employed, ?) DESC, TIMESTAMPDIFF(YEAR, r.date_of_birth, ?) DESC, r.service_number
     LIMIT ? OFFSET ?`,
    [f.today, f.today, f.today, ...wParams, f.today, f.today, pageSize, (page - 1) * pageSize], conn);
  return { items, total: Number(total), inProposal: Number(inProposal) };
}

async function ratingBasic(serviceNumber, conn = null) {
  const r = await db.query(
    `SELECT r.service_number, r.status, r.surname, r.first_name, r.middle_name, r.date_of_birth, r.date_employed,
            r.exit_type_id, r.exit_date, r.exit_reason, rt.name AS rate_name, rt.code AS rate_code,
            br.name AS branch_name, em.name AS entry_mode_name, e.name AS exit_type_name,
            (SELECT sh.name FROM rating_drafting d JOIN ref_ship sh ON sh.id=d.ship_id
              WHERE d.service_number=r.service_number AND d.end_date IS NULL ORDER BY d.id DESC LIMIT 1) AS current_ship_name,
            TIMESTAMPDIFF(YEAR, r.date_of_birth, IF(r.status = 'former', COALESCE(r.exit_date, CURDATE()), CURDATE())) AS age,
            TIMESTAMPDIFF(YEAR, r.date_employed, IF(r.status = 'former', COALESCE(r.exit_date, CURDATE()), CURDATE())) AS years_service,
            (SELECT COUNT(*) FROM discipline_cases c WHERE c.service_number = r.service_number AND c.status = 'pending') AS pending_cases
       FROM ratings r LEFT JOIN ref_rate rt ON rt.id = r.rate_id LEFT JOIN ref_branch br ON br.id = r.branch_id
       LEFT JOIN ref_entry_mode em ON em.id = r.entry_mode_id LEFT JOIN ref_exit_type e ON e.id = r.exit_type_id
       WHERE r.service_number = ?`, [serviceNumber], conn);
  return r[0] || null;
}

async function proposalCandidate(serviceNumber, conn = null) {
  const rows = await db.query(
    `SELECT r.service_number, r.status, r.surname, r.first_name, r.middle_name,
            rt.name AS rate_name, rt.code AS rate_code, br.name AS branch_name,
            (SELECT COUNT(*) FROM discipline_cases c WHERE c.service_number=r.service_number AND c.status='pending') AS pending_cases,
            (SELECT p.proposal_number FROM discharge_rows d JOIN discharge_proposals p ON p.id=d.proposal_id
              WHERE d.service_number=r.service_number AND d.status='pending' ORDER BY p.proposed_at DESC,p.id DESC LIMIT 1) AS proposal_number,
            (SELECT d.status FROM discharge_rows d WHERE d.service_number=r.service_number
              AND d.status IN ('scheduled','closed') ORDER BY d.id DESC LIMIT 1) AS discharge_status,
            (SELECT x.until_date FROM discharge_reengagements x WHERE x.service_number=r.service_number
              ORDER BY x.reengage_date DESC,x.id DESC LIMIT 1) AS reengagement_until
       FROM ratings r LEFT JOIN ref_rate rt ON rt.id=r.rate_id LEFT JOIN ref_branch br ON br.id=r.branch_id
       WHERE r.service_number=?`,
    [serviceNumber], conn);
  return rows[0] || null;
}

async function nextProposalNumber(year, conn, lock = true) {
  const prefix = `DIS-${year}-`;
  const r = await db.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(proposal_number, 10) AS UNSIGNED)), 0) AS n FROM discharge_proposals WHERE proposal_number LIKE ?${lock ? ' FOR UPDATE' : ''}`,
    [`${prefix}%`], conn);
  return `${prefix}${String(r[0].n + 1).padStart(4, '0')}`;
}

async function insertProposal(number, userId, conn) {
  const res = await db.query(
    'INSERT INTO discharge_proposals (proposal_number, proposed_by, proposed_at, created_by) VALUES (?, ?, NOW(), ?)',
    [number, userId || null, userId || null], conn);
  return res.insertId;
}

async function proposalRaw(id, conn = null, lock = false) {
  const r = await db.query(`SELECT * FROM discharge_proposals WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id], conn);
  return r[0] || null;
}

async function proposals({ page = 1, pageSize = 25 }, conn = null) {
  const [{ total }] = await db.query('SELECT COUNT(*) AS total FROM discharge_proposals');
  const items = await db.query(
    `SELECT p.*, u.username AS proposed_by_name,
            (SELECT COUNT(*) FROM discharge_rows d WHERE d.proposal_id = p.id) AS ratings,
            (SELECT COUNT(*) FROM discharge_rows d WHERE d.proposal_id = p.id AND d.status = 'pending') AS pending,
            (SELECT COUNT(*) FROM discharge_rows d WHERE d.proposal_id = p.id AND d.status = 'closed') AS closed,
            (SELECT COUNT(*) FROM discharge_reengagements x WHERE x.proposal_id = p.id) AS reengagements
       FROM discharge_proposals p LEFT JOIN users u ON u.id = p.proposed_by
       ORDER BY p.proposed_at DESC, p.id DESC LIMIT ? OFFSET ?`,
    [pageSize, (page - 1) * pageSize], conn);
  return { items, total: Number(total) };
}

async function insertRow(proposalId, serviceNumber, userId, conn) {
  const res = await db.query(
    'INSERT INTO discharge_rows (proposal_id, service_number, status, created_by) VALUES (?, ?, \'pending\', ?)',
    [proposalId, serviceNumber, userId || null], conn);
  return res.insertId;
}

async function rowRaw(id, conn = null, lock = false) {
  const r = await db.query(`SELECT * FROM discharge_rows WHERE id = ?${lock ? ' FOR UPDATE' : ''}`, [id], conn);
  return r[0] || null;
}

async function rowByProposal(proposalId, serviceNumber, conn = null, lock = false) {
  const r = await db.query(`SELECT * FROM discharge_rows WHERE proposal_id = ? AND service_number = ?${lock ? ' FOR UPDATE' : ''}`, [proposalId, serviceNumber], conn);
  return r[0] || null;
}

async function hasExistingProposalRow(serviceNumber, conn = null) {
  const rows = await db.query(
    "SELECT id FROM discharge_rows WHERE service_number=? AND status IN ('pending','scheduled','closed') LIMIT 1 FOR UPDATE",
    [serviceNumber], conn);
  return rows.length > 0;
}

async function listRows(proposalId, conn = null) {
  return db.query(
    `SELECT d.*, r.surname, r.first_name, r.middle_name, r.status AS rating_status, r.date_employed,
            rt.name AS rate_name, rt.code AS rate_code, e.name AS exit_type_name, e.keeps_current AS keepsCurrent, e.is_death AS isDeath,
            u.username AS closed_by_name,
            (SELECT COUNT(*) FROM discipline_cases c WHERE c.service_number = d.service_number AND c.status = 'pending') AS pending_cases
       FROM discharge_rows d JOIN ratings r ON r.service_number = d.service_number
       LEFT JOIN ref_rate rt ON rt.id = r.rate_id
       LEFT JOIN ref_exit_type e ON e.id = d.exit_type_id
       LEFT JOIN users u ON u.id = d.closed_by
       WHERE d.proposal_id = ? ORDER BY r.surname, r.first_name, d.id`, [proposalId], conn);
}

async function pendingProposalRows(proposalId, { page = 1, pageSize = 25 } = {}, conn = null) {
  const where = proposalId ? "WHERE d.status = 'pending' AND d.proposal_id = ?" : "WHERE d.status = 'pending'";
  const params = proposalId ? [proposalId] : [];
  const [counts] = await db.query(
    `SELECT COUNT(*) AS total, SUM(d.exit_type_id IS NOT NULL) AS processed FROM discharge_rows d ${where}`,
    params, conn);
  const items = await db.query(
    `SELECT d.*, r.surname, r.first_name, r.middle_name, r.status AS rating_status,
            r.date_of_birth, r.date_employed,
            rt.name AS rate_name, rt.code AS rate_code, br.name AS branch_name,
            em.name AS entry_mode_name, e.name AS exit_type_name, p.proposal_number, p.proposed_at,
            u.username AS proposed_by_name,
            (SELECT sh.name FROM rating_drafting rd JOIN ref_ship sh ON sh.id = rd.ship_id
              WHERE rd.service_number = r.service_number AND rd.end_date IS NULL ORDER BY rd.id DESC LIMIT 1) AS current_ship_name,
            TIMESTAMPDIFF(YEAR, r.date_of_birth, CURDATE()) AS age,
            TIMESTAMPDIFF(YEAR, r.date_employed, CURDATE()) AS years_service,
            (SELECT COUNT(*) FROM discipline_cases c WHERE c.service_number = d.service_number AND c.status = 'pending') AS pending_cases,
            (SELECT x.reengage_date FROM discharge_reengagements x WHERE x.service_number = d.service_number ORDER BY x.reengage_date DESC, x.id DESC LIMIT 1) AS last_reengagement_date,
            (SELECT x.period_months FROM discharge_reengagements x WHERE x.service_number = d.service_number ORDER BY x.reengage_date DESC, x.id DESC LIMIT 1) AS last_reengagement_period,
            (SELECT x.until_date FROM discharge_reengagements x WHERE x.service_number = d.service_number ORDER BY x.reengage_date DESC, x.id DESC LIMIT 1) AS last_reengagement_until
       FROM discharge_rows d
       JOIN ratings r ON r.service_number = d.service_number
       JOIN discharge_proposals p ON p.id = d.proposal_id
       LEFT JOIN users u ON u.id = p.proposed_by
       LEFT JOIN ref_rate rt ON rt.id = r.rate_id
       LEFT JOIN ref_branch br ON br.id = r.branch_id
       LEFT JOIN ref_entry_mode em ON em.id = r.entry_mode_id
       LEFT JOIN ref_exit_type e ON e.id = d.exit_type_id
       ${where}
       ORDER BY p.proposed_at DESC, p.id DESC, r.surname, r.first_name, d.id
       LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize], conn);
  return { items, total: Number(counts.total), processed: Number(counts.processed || 0) };
}

async function updateRow(id, x, conn) {
  await db.query(
    `UPDATE discharge_rows SET exit_type_id=?, exit_date=?, exit_reason=?, approved_by=?, comment=?,
            death_certificate=?, condolence_letter=?, dependent_fund_evidence=?, sworn_affidavit=?,
            status=?, closed_by=?, closed_at=? WHERE id=?`,
    [x.exitTypeId, x.exitDate, x.exitReason, x.approvedBy, x.comment, x.deathCertificate ? 1 : 0,
      x.condolenceLetter ? 1 : 0, x.dependentFundEvidence ? 1 : 0, x.swornAffidavit ? 1 : 0,
      x.status, x.closedBy || null, x.closedAt || null, id], conn);
}

async function setScheduled(id, scheduledId, conn) {
  await db.query("UPDATE discharge_rows SET status='scheduled', scheduled_change_id=? WHERE id=?", [scheduledId, id], conn);
}

async function rowByScheduledChange(scheduledChangeId, conn = null) {
  const r = await db.query('SELECT * FROM discharge_rows WHERE scheduled_change_id = ? FOR UPDATE', [scheduledChangeId], conn);
  return r[0] || null;
}

/** A scheduled row that cannot be closed goes back to Pending. */
async function reopenRow(id, conn) {
  await db.query("UPDATE discharge_rows SET status='pending', scheduled_change_id=NULL, closed_by=NULL, closed_at=NULL WHERE id=?", [id], conn);
}

async function removeRow(id, conn) {
  await db.query('DELETE FROM discharge_rows WHERE id = ?', [id], conn);
}

async function insertReengagement(x, conn) {
  const res = await db.query(
    'INSERT INTO discharge_reengagements (proposal_id, service_number, reengage_date, period_months, until_date, approved_by, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [x.proposalId, x.serviceNumber, x.reengageDate, x.periodMonths, x.untilDate, x.approvedBy || null, x.userId || null], conn);
  return res.insertId;
}

async function reengagementRaw(id, conn = null) {
  const r = await db.query('SELECT * FROM discharge_reengagements WHERE id = ?', [id], conn);
  return r[0] || null;
}

/** The rating's exit fields, locked: what closing a discharge changes (and what the audit trail keeps). */
async function ratingExitRaw(serviceNumber, conn) {
  const r = await db.query(
    'SELECT service_number, status, exit_type_id, exit_date, exit_reason FROM ratings WHERE service_number = ? FOR UPDATE',
    [serviceNumber], conn);
  return r[0] || null;
}

async function setFormer(serviceNumber, x, conn) {
  await db.query(
    "UPDATE ratings SET status='former', exit_type_id=?, exit_date=?, exit_reason=? WHERE service_number=?",
    [x.exitTypeId, x.exitDate, x.exitReason || null, serviceNumber], conn);
}

async function openPostings(serviceNumber, conn) {
  return db.query('SELECT * FROM rating_drafting WHERE service_number = ? AND end_date IS NULL FOR UPDATE', [serviceNumber], conn);
}

async function postingRaw(id, conn) {
  const r = await db.query('SELECT * FROM rating_drafting WHERE id = ?', [id], conn);
  return r[0] || null;
}

/** A posting ends on the exit date, and never before it began. */
async function endPosting(id, exitDate, conn) {
  await db.query('UPDATE rating_drafting SET end_date = GREATEST(?, COALESCE(start_date, ?)) WHERE id = ?', [exitDate, exitDate, id], conn);
}

async function accountOf(serviceNumber, conn) {
  const r = await db.query(
    'SELECT id, username, service_number, role_id, is_active FROM users WHERE service_number = ? FOR UPDATE',
    [serviceNumber], conn);
  return r[0] || null;
}

async function deactivateAccount(userId, conn) {
  await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [userId], conn);
  const res = await db.query('UPDATE user_sessions SET ended_at = NOW() WHERE user_id = ? AND ended_at IS NULL', [userId], conn);
  return res.affectedRows || 0;
}

/** The end date of the latest re-engagement that has not ended, or null. */
async function runningReengagement(serviceNumber, today, conn = null) {
  const r = await db.query('SELECT MAX(until_date) AS until FROM discharge_reengagements WHERE service_number = ? AND until_date >= ?', [serviceNumber, today], conn);
  return r[0] && r[0].until ? String(r[0].until).slice(0, 10) : null;
}

async function reengagementRow(serviceNumber, conn = null) {
  const r = await db.query(
    'SELECT x.*, p.proposal_number FROM discharge_reengagements x JOIN discharge_proposals p ON p.id=x.proposal_id WHERE x.service_number=? ORDER BY x.reengage_date DESC, x.id DESC LIMIT 1',
    [serviceNumber], conn);
  return r[0] || null;
}

async function reengagementHistory(serviceNumber, conn = null) {
  return db.query(
    `SELECT x.*, p.proposal_number, u.username AS created_by_name
       FROM discharge_reengagements x
       JOIN discharge_proposals p ON p.id=x.proposal_id
       LEFT JOIN users u ON u.id=x.created_by
       WHERE x.service_number=? ORDER BY x.reengage_date DESC,x.id DESC`,
    [serviceNumber], conn);
}

async function verificationDischarge(serviceNumber, conn = null) {
  const rows = await db.query(
    `SELECT d.*, p.proposal_number, e.name AS exit_type_name
       FROM discharge_rows d
       JOIN discharge_proposals p ON p.id=d.proposal_id
       LEFT JOIN ref_exit_type e ON e.id=d.exit_type_id
       WHERE d.service_number=? AND d.status IN ('pending','closed','scheduled')
       ORDER BY d.exit_date DESC,d.id DESC LIMIT 1`,
    [serviceNumber], conn);
  return rows[0] || null;
}

async function report(filters, { page = 1, pageSize = 25, all = false } = {}, conn = null) {
  const dischargeWhere = ["d.status IN ('closed','scheduled')"];
  const dischargeParams = [];
  const reengagementWhere = [];
  const reengagementParams = [];
  if (filters.from) {
    dischargeWhere.push('d.exit_date >= ?'); dischargeParams.push(filters.from);
    reengagementWhere.push('x.reengage_date >= ?'); reengagementParams.push(filters.from);
  }
  if (filters.to) {
    dischargeWhere.push('d.exit_date <= ?'); dischargeParams.push(filters.to);
    reengagementWhere.push('x.reengage_date <= ?'); reengagementParams.push(filters.to);
  }
  if (filters.exitTypeId) {
    dischargeWhere.push('d.exit_type_id = ?'); dischargeParams.push(filters.exitTypeId);
    reengagementWhere.push('1=0');
  }
  if (filters.rateId) {
    dischargeWhere.push('r.rate_id = ?'); dischargeParams.push(filters.rateId);
    reengagementWhere.push('r.rate_id = ?'); reengagementParams.push(filters.rateId);
  }
  if (filters.branchId) {
    dischargeWhere.push('r.branch_id = ?'); dischargeParams.push(filters.branchId);
    reengagementWhere.push('r.branch_id = ?'); reengagementParams.push(filters.branchId);
  }
  if (filters.reengagementOnly) dischargeWhere.push('1=0');

  const dischargeFrom = `FROM discharge_rows d
    JOIN ratings r ON r.service_number=d.service_number
    LEFT JOIN ref_rate rt ON rt.id=r.rate_id LEFT JOIN ref_branch br ON br.id=r.branch_id
    LEFT JOIN ref_exit_type e ON e.id=d.exit_type_id
    LEFT JOIN discharge_proposals p ON p.id=d.proposal_id
    LEFT JOIN users u ON u.id=d.closed_by`;
  const reengagementFrom = `FROM discharge_reengagements x
    JOIN ratings r ON r.service_number=x.service_number
    LEFT JOIN ref_rate rt ON rt.id=r.rate_id LEFT JOIN ref_branch br ON br.id=r.branch_id
    LEFT JOIN discharge_proposals p ON p.id=x.proposal_id
    LEFT JOIN users u ON u.id=x.created_by`;
  const disWhereSql = `WHERE ${dischargeWhere.join(' AND ')}`;
  const reWhereSql = reengagementWhere.length ? `WHERE ${reengagementWhere.join(' AND ')}` : '';
  const [{ total: dischargeCount, closedCount, scheduledCount }] = await db.query(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(d.status='closed'), 0) AS closedCount,
            COALESCE(SUM(d.status='scheduled'), 0) AS scheduledCount
       ${dischargeFrom} ${disWhereSql}`,
    dischargeParams, conn);
  const [{ total: reengagementCount }] = await db.query(
    `SELECT COUNT(*) AS total ${reengagementFrom} ${reWhereSql}`,
    reengagementParams, conn);

  const dischargeSelect = `SELECT d.id, 'discharge' AS type, d.status, d.service_number, d.proposal_id, p.proposal_number,
      d.closed_at AS recorded_at, u.username AS recorded_by_name,
      r.surname, r.first_name, r.middle_name, r.date_employed,
      TIMESTAMPDIFF(YEAR, r.date_employed, d.exit_date) AS years_service,
      rt.name AS rate_name, rt.code AS rate_code, br.name AS branch_name,
      e.name AS exit_type_name, d.exit_date, d.exit_reason, d.approved_by, d.comment,
      d.death_certificate, d.condolence_letter, d.dependent_fund_evidence, d.sworn_affidavit,
      NULL AS period_months, NULL AS until_date, NULL AS reengage_date
    ${dischargeFrom} ${disWhereSql}`;
  const reengagementSelect = `SELECT x.id, 'reengagement' AS type, 'reengagement' AS status, x.service_number, x.proposal_id, p.proposal_number,
      x.created_at AS recorded_at, u.username AS recorded_by_name,
      r.surname, r.first_name, r.middle_name, r.date_employed,
      TIMESTAMPDIFF(YEAR, r.date_employed, x.reengage_date) AS years_service,
      rt.name AS rate_name, rt.code AS rate_code, br.name AS branch_name,
      'Re-engagement' AS exit_type_name, x.reengage_date AS exit_date, NULL AS exit_reason, x.approved_by, NULL AS comment,
      0 AS death_certificate, 0 AS condolence_letter, 0 AS dependent_fund_evidence, 0 AS sworn_affidavit,
      x.period_months, x.until_date, x.reengage_date
    ${reengagementFrom} ${reWhereSql}`;
  const limit = all ? 5000 : pageSize;
  const offset = all ? 0 : (page - 1) * pageSize;
  const items = await db.query(
    `SELECT * FROM (${dischargeSelect} UNION ALL ${reengagementSelect}) AS report_rows
      ORDER BY exit_date DESC, service_number, type LIMIT ? OFFSET ?`,
    [...dischargeParams, ...reengagementParams, limit, offset], conn);
  return {
    items,
    total: Number(dischargeCount) + Number(reengagementCount),
    discharges: Number(closedCount),
    scheduled: Number(scheduledCount),
    reengagements: Number(reengagementCount),
  };
}

async function serviceDetails(serviceNumber, conn = null) {
  const r = await db.query(
    `SELECT r.service_number, r.status, r.surname, r.first_name, r.middle_name, r.date_of_birth, r.phone,
            r.date_employed, r.exit_date, r.exit_reason,
            rt.name AS rate_name, rt.code AS rate_code, br.name AS branch_name, e.name AS exit_type_name,
            (SELECT sh.name FROM rating_drafting d JOIN ref_ship sh ON sh.id=d.ship_id
              WHERE d.service_number=r.service_number AND d.end_date IS NULL ORDER BY d.id DESC LIMIT 1) AS current_ship_name
       FROM ratings r LEFT JOIN ref_rate rt ON rt.id=r.rate_id LEFT JOIN ref_branch br ON br.id=r.branch_id
       LEFT JOIN ref_exit_type e ON e.id=r.exit_type_id WHERE r.service_number=?`,
    [serviceNumber], conn);
  if (!r[0]) return null;
  const rateHistory = await db.query(
    `SELECT rt.name AS rate, a.start_date AS start, a.end_date AS end,
            a.decoration, a.authority, a.gcbno
       FROM rating_advancement a LEFT JOIN ref_rate rt ON rt.id = a.rate_id
       WHERE a.service_number = ? ORDER BY a.start_date, a.id`,
    [serviceNumber], conn);
  return { ...r[0], rateHistory };
}

async function insertUpload(x, conn) {
  const res = await db.query(
    'INSERT INTO discharge_uploads (file_name,source_row_number,service_number,exit_type_id,exit_date,authority,approved_by,comment,proposal_id,row_id,imported_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [x.fileName, x.row, x.serviceNumber, x.exitTypeId, x.exitDate, x.authority || null, x.approvedBy || null, x.comment || null, x.proposalId || null, x.rowId || null, x.userId || null], conn);
  return res.insertId;
}

async function uploadRaw(id, conn = null) {
  const r = await db.query('SELECT * FROM discharge_uploads WHERE id=?', [id], conn);
  return r[0] || null;
}

module.exports = {
  DUE_RULE, dueRuleParams, DUE_EXCLUSIONS, dueExclusionParams, dueWhere,
  options, exitType, listDue, ratingBasic, proposalCandidate, nextProposalNumber, insertProposal, proposalRaw, proposals,
  insertRow, rowRaw, rowByProposal, hasExistingProposalRow, listRows, pendingProposalRows, updateRow, setScheduled, rowByScheduledChange, reopenRow, removeRow,
  insertReengagement, reengagementRaw, runningReengagement, ratingExitRaw, setFormer, openPostings, postingRaw, endPosting, accountOf, deactivateAccount, reengagementRow, reengagementHistory, verificationDischarge, report, serviceDetails,
  insertUpload, uploadRaw,
};
