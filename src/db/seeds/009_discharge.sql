-- Discharge Administration (WP5): the due-rule settings, the old role "Discharge", its account, and demo data so every
-- page has something: ratings due for discharge in every age and service band, a proposal waiting to be processed
-- (one rating processed and pending, one with a pending disciplinary case), an older proposal with four closed
-- discharges (one a death with its documents), a re-engagement, and a discharge scheduled for a later date. Dates are
-- counted from the day the seed runs. Safe to rerun.
-- Demo account (password Admin@123, as HICO001), belonging to a rating: B1000 (Discharge).

-- ---- the due rule: placeholders until Hicad supplies the real rule (PLAN 9b decision 6) ----
INSERT IGNORE INTO settings (setting_key, value, description) VALUES
  ('discharge.age_due', '50', 'Discharge: a rating is due at this age (placeholder rule).'),
  ('discharge.service_due', '20', 'Discharge: a rating is due after this many whole years of service (placeholder rule).'),
  ('discharge.age_band_1', '50', 'Discharge due-list age pill: first threshold.'),
  ('discharge.age_band_2', '55', 'Discharge due-list age pill: second threshold.'),
  ('discharge.age_band_3', '60', 'Discharge due-list age pill: final threshold.'),
  ('discharge.service_band_1', '20', 'Discharge due-list service pill: first threshold.'),
  ('discharge.service_band_2', '30', 'Discharge due-list service pill: second threshold.'),
  ('discharge.service_band_3', '35', 'Discharge due-list service pill: final threshold.');

-- ---- the old role "Discharge" ----
INSERT IGNORE INTO roles (name, description, full_access) VALUES
  ('Discharge', 'The old Discharge role: proposals and processing, the printouts, the report and the discharge upload', 0);

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id FROM roles r JOIN privileges p ON (p.screen, p.action) IN (
  ('dashboard.home', 'view'), ('ratings.list', 'view'), ('ratings.edit', 'view'), ('ratings.my-details', 'view'),
  ('discharge.process', 'view'), ('discharge.process', 'add'), ('discharge.process', 'edit'), ('discharge.process', 'delete'),
  ('discharge.service', 'view'), ('discharge.forms', 'view'), ('discharge.report', 'view'),
  ('discharge.upload', 'view'), ('discharge.upload', 'add'))
 WHERE r.name = 'Discharge';

-- ---- demo ratings: the Discharge officer, ratings due (B1001 to B1012), and ratings already discharged,
-- scheduled or re-engaged (B1021 and up) ----
INSERT IGNORE INTO ratings (service_number, status, rate_id, surname, first_name, middle_name, gender_id, date_of_birth,
  branch_id, command_id, seniority_date, entry_mode_id, date_employed, specialisation_id)
SELECT v.sn, 'current', (SELECT id FROM ref_rate WHERE code = v.rate), v.sur, v.fst, v.mid,
       (SELECT id FROM ref_gender WHERE name = v.sex), v.dob,
       (SELECT id FROM ref_branch WHERE code = v.br), (SELECT id FROM ref_command WHERE name = 'Western Naval Command'),
       v.sen, (SELECT id FROM ref_entry_mode WHERE name = v.entry), v.emp,
       (SELECT id FROM ref_specialisation WHERE code = v.spec)
  FROM (
            SELECT 'B1000' AS sn, 'CPO' AS rate, 'AGBAJE' AS sur, 'BISI' AS fst, 'RONKE' AS mid, 'Female' AS sex, '1983-03-21' AS dob, 'ED' AS br, 'WRT' AS spec, '2024-01-01' AS sen, '2010-02-14' AS emp, 'Regular Recruitment' AS entry
  UNION ALL SELECT 'B1001', 'PO',  'ADEKUNLE',  'SAMUEL',    'OLALEKAN', 'Male',   '1974-08-12', 'SM', 'NAV', '2024-02-01', '1994-04-03', 'Regular Recruitment'
  UNION ALL SELECT 'B1002', 'CPO', 'OKPARA',     'PETER',     'CHUKWUMA', 'Male',   '1971-02-09', 'ME', 'MPR', '2024-03-01', '1991-09-16', 'Regular Recruitment'
  UNION ALL SELECT 'B1003', 'WO',  'BAKARE',    'TUNDE',     'WALE',     'Male',   '1966-11-30', 'WE', 'EWS', '2023-12-01', '1987-01-12', 'Direct Intake'
  UNION ALL SELECT 'B1004', 'MWO', 'OGUNDIPE',  'FOLAKE',    'GRACE',    'Female', '1964-05-18', 'LG', 'STS', '2024-01-01', '1985-08-05', 'Direct Intake'
  UNION ALL SELECT 'B1005', 'PO',  'MUSA',      'ALIYU',     'DANLADI',  'Male',   '1975-09-04', 'NP', 'REG', '2024-04-01', '1996-03-25', 'Regular Recruitment'
  UNION ALL SELECT 'B1006', 'LS',  'EKEZIE',    'OBIORA',    'KINGSLEY', 'Male',   '1977-12-22', 'SM', 'GUN', '2024-05-01', '1999-02-08', 'Regular Recruitment'
  UNION ALL SELECT 'B1007', 'CPO', 'ADEYEMO',   'FUNMILAYO', 'RUTH',     'Female', '1973-04-27', 'MD', 'MAS', '2024-02-01', '1993-07-19', 'Specialist Enlistment'
  UNION ALL SELECT 'B1008', 'PO',  'UDOH',      'ETIDO',     'SUNDAY',   'Male',   '1980-01-14', 'ME', 'MPR', '2024-06-01', '2005-06-13', 'Regular Recruitment'
  UNION ALL SELECT 'B1009', 'WO',  'LAWAL',     'IBRAHIM',   'KOLA',     'Male',   '1969-07-08', 'IT', 'ICT', '2024-01-01', '1989-04-17', 'Direct Intake'
  UNION ALL SELECT 'B1010', 'PO',  'NNAMANI',   'CHIAMAKA',  'JOY',      'Female', '1982-10-03', 'LG', 'CAT', '2024-03-01', '2004-11-22', 'Regular Recruitment'
  UNION ALL SELECT 'B1011', 'AB',  'OGBU',      'EMEKA',     'FRANCIS',  'Male',   '1981-06-19', 'SM', 'COM', '2024-07-01', '2003-05-12', 'Regular Recruitment'
  UNION ALL SELECT 'B1012', 'LS',  'HASSAN',    'MARYAM',    'ZAINAB',   'Female', '1979-03-02', 'ED', 'WRT', '2024-05-01', '2000-09-04', 'Regular Recruitment'
  UNION ALL SELECT 'B1021', 'PO',  'AKINWALE',  'ADEBAYO',   'TOSIN',    'Male',   '1972-01-26', 'SM', 'NAV', '2012-05-01', '1992-03-30', 'Regular Recruitment'
  UNION ALL SELECT 'B1022', 'LS',  'NWANKWO',   'IFEANYI',   'CYRIL',    'Male',   '1985-08-15', 'WE', 'EWS', '2015-09-01', '2006-12-04', 'Regular Recruitment'
  UNION ALL SELECT 'B1023', 'CPO', 'SULEIMAN',  'RAMATU',    'HAUWA',    'Female', '1976-12-11', 'MD', 'MAS', '2014-03-01', '1996-10-21', 'Specialist Enlistment'
  UNION ALL SELECT 'B1024', 'PO',  'OSAGIE',    'OSARETIN',  'BLESSING', 'Male',   '1978-05-05', 'NP', 'REG', '2013-07-01', '1998-01-19', 'Regular Recruitment'
  UNION ALL SELECT 'B1031', 'WO',  'IWUCHUKWU', 'NKEM',      'PATIENCE', 'Female', '1967-09-23', 'LG', 'STS', '2024-02-01', '1988-05-30', 'Direct Intake'
  UNION ALL SELECT 'B1041', 'CPO', 'YAHAYA',    'ABDULLAHI', 'SANI',     'Male',   '1970-04-13', 'SM', 'GUN', '2023-06-01', '1990-11-12', 'Regular Recruitment'
  UNION ALL SELECT 'B1042', 'PO',  'EFFIONG',   'MFON',      'GRACE',    'Female', '1972-10-29', 'ED', 'WRT', '2024-01-01', '1993-02-23', 'Regular Recruitment'
  ) v;

-- ---- the account ----
INSERT IGNORE INTO users (username, password_hash, role_id, service_number, email, phone, is_active) VALUES
  ('B1000', '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', (SELECT id FROM roles WHERE name = 'Discharge'), 'B1000', 'b.agbaje@navy.mil.ng', '08031112830', 1);

-- ---- postings: the ratings due serve on a ship; the ones discharged had theirs ended on the exit date ----
INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT v.sn, (SELECT id FROM ref_ship WHERE name = v.ship), r.rate_id, v.start_on, v.end_on, v.note
  FROM (
            SELECT 'B1001' AS sn, 'NNS ARADU' AS ship, DATE_SUB(CURDATE(), INTERVAL 14 MONTH) AS start_on, NULL AS end_on, 'Navigating officer''s team' AS note
  UNION ALL SELECT 'B1002', 'NNS BEECROFT',  DATE_SUB(CURDATE(), INTERVAL 7 MONTH), NULL, 'Engine room'
  UNION ALL SELECT 'B1003', 'NHQ ABUJA',     DATE_SUB(CURDATE(), INTERVAL 4 MONTH), NULL, 'Weapons maintenance'
  UNION ALL SELECT 'B1005', 'NNS DELTA',     DATE_SUB(CURDATE(), INTERVAL 3 MONTH),  NULL, 'Provost'
  UNION ALL SELECT 'B1009', 'NHQ ABUJA',     DATE_SUB(CURDATE(), INTERVAL 6 MONTH), NULL, 'Communications office'
  UNION ALL SELECT 'B1031', 'NNS KADA',      DATE_SUB(CURDATE(), INTERVAL 2 MONTH), NULL, 'Stores'
  UNION ALL SELECT 'B1021', 'NNS JUBILEE',   DATE_SUB(CURDATE(), INTERVAL 30 MONTH), DATE_SUB(CURDATE(), INTERVAL 75 DAY), 'Navigating team'
  UNION ALL SELECT 'B1022', 'NNS CENTENARY', DATE_SUB(CURDATE(), INTERVAL 22 MONTH), DATE_SUB(CURDATE(), INTERVAL 75 DAY), 'Weapon electrical systems'
  ) v
  JOIN ratings r ON r.service_number = v.sn
 WHERE NOT EXISTS (SELECT 1 FROM rating_drafting d WHERE d.service_number = v.sn AND d.ship_id = (SELECT id FROM ref_ship WHERE name = v.ship));

-- ---- the older proposal: four closed discharges (the ratings are Former) and a re-engagement ----
INSERT IGNORE INTO discharge_proposals (proposal_number, proposed_by, proposed_at, created_by)
SELECT CONCAT('DIS-', YEAR(CURDATE()), '-0001'), u.id, DATE_SUB(NOW(), INTERVAL 80 DAY), u.id
  FROM users u WHERE u.username = 'HICO001';
INSERT IGNORE INTO discharge_proposals (proposal_number, proposed_by, proposed_at, created_by)
SELECT CONCAT('DIS-', YEAR(CURDATE()), '-0002'), u.id, DATE_SUB(NOW(), INTERVAL 9 DAY), u.id
  FROM users u WHERE u.username = 'B1000';

UPDATE ratings r
  JOIN (
            SELECT 'B1021' AS sn, 'RETIRED' AS et, DATE_SUB(CURDATE(), INTERVAL 75 DAY) AS xd, 'Compulsory retirement on reaching the age limit' AS rs
  UNION ALL SELECT 'B1022', 'VOLUNTARY DISCHARGE', DATE_SUB(CURDATE(), INTERVAL 75 DAY), 'Voluntary discharge on completing the engagement'
  UNION ALL SELECT 'B1023', 'MEDICAL DISCHARGE', DATE_SUB(CURDATE(), INTERVAL 60 DAY), 'Invalided out on the advice of a medical board'
  UNION ALL SELECT 'B1024', 'DECEASED', DATE_SUB(CURDATE(), INTERVAL 66 DAY), 'Died in service'
  ) x ON x.sn = r.service_number
   SET r.status = 'former', r.exit_type_id = (SELECT id FROM ref_exit_type WHERE name = x.et), r.exit_date = x.xd, r.exit_reason = x.rs
 WHERE r.status = 'current';

INSERT IGNORE INTO discharge_rows (proposal_id, service_number, exit_type_id, exit_date, exit_reason, approved_by, comment,
  death_certificate, condolence_letter, dependent_fund_evidence, sworn_affidavit, status, closed_by, closed_at, created_by)
SELECT p.id, r.service_number, r.exit_type_id, r.exit_date, r.exit_reason, v.approved, v.cmt,
       v.dc, v.cl, v.df, v.sa, 'closed', (SELECT id FROM users WHERE username = 'HICO001'), DATE_SUB(NOW(), INTERVAL 70 DAY),
       (SELECT id FROM users WHERE username = 'HICO001')
  FROM (
            SELECT 'B1021' AS sn, 'Chief of Naval Staff' AS approved, 'Retired on reaching 52.' AS cmt, 0 AS dc, 0 AS cl, 0 AS df, 0 AS sa
  UNION ALL SELECT 'B1022', 'Director of Personnel (Navy)', 'Served out the engagement.', 0, 0, 0, 0
  UNION ALL SELECT 'B1023', 'Chief of Naval Staff', 'Medical board of 12th of the month.', 0, 0, 0, 0
  UNION ALL SELECT 'B1024', 'Chief of Naval Staff', 'Condolence letter sent to the next of kin.', 1, 1, 1, 0
  ) v
  JOIN ratings r ON r.service_number = v.sn
  JOIN discharge_proposals p ON p.proposal_number = CONCAT('DIS-', YEAR(CURDATE()), '-0001');

INSERT IGNORE INTO discharge_reengagements (proposal_id, service_number, reengage_date, period_months, until_date, approved_by, created_by)
SELECT p.id, v.sn, v.dt, v.months, DATE_ADD(v.dt, INTERVAL v.months MONTH), 'Chief of Naval Staff', (SELECT id FROM users WHERE username = 'HICO001')
  FROM (
            SELECT 'B1041' AS sn, DATE_SUB(CURDATE(), INTERVAL 60 DAY) AS dt, 24 AS months
  UNION ALL SELECT 'B1042', DATE_SUB(CURDATE(), INTERVAL 45 DAY), 12
  ) v
  JOIN discharge_proposals p ON p.proposal_number = CONCAT('DIS-', YEAR(CURDATE()), '-0001');

-- ---- the open proposal: ratings waiting to be processed ----
INSERT IGNORE INTO discharge_rows (proposal_id, service_number, exit_type_id, exit_date, exit_reason, approved_by, comment, status, created_by)
SELECT p.id, v.sn,
       IF(v.et IS NULL, NULL, (SELECT id FROM ref_exit_type WHERE name = v.et)), v.xd, v.rs, v.approved, v.cmt, v.st,
       (SELECT id FROM users WHERE username = 'B1000')
  FROM (
            SELECT 'B1002' AS sn, 'RETIRED' AS et, DATE_ADD(CURDATE(), INTERVAL 20 DAY) AS xd, 'Compulsory retirement on reaching the age limit' AS rs, 'Chief of Naval Staff' AS approved, NULL AS cmt, 'pending' AS st
  UNION ALL SELECT 'B1003', NULL, NULL, NULL, NULL, NULL, 'pending'
  UNION ALL SELECT 'B1004', NULL, NULL, NULL, NULL, NULL, 'pending'
  UNION ALL SELECT 'B0640', NULL, NULL, NULL, NULL, NULL, 'pending'
  UNION ALL SELECT 'B1009', 'MEDICAL DISCHARGE', DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'Invalided out on the advice of a medical board', 'Director of Personnel (Navy)', 'Awaiting the board''s signal.', 'pending'
  UNION ALL SELECT 'B1031', 'RETIRED', DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'Retirement on completing 37 years', 'Chief of Naval Staff', 'Leaves at the end of next month.', 'scheduled'
  ) v
  JOIN ratings r ON r.service_number = v.sn
  JOIN discharge_proposals p ON p.proposal_number = CONCAT('DIS-', YEAR(CURDATE()), '-0002');

-- the scheduled discharge: Former on its exit date, through the shared scheduled changes
INSERT INTO scheduled_changes (kind, service_number, effective_date, payload, status, source_table, source_id, scheduled_by, scheduled_at)
SELECT 'discharge', d.service_number, d.exit_date,
       JSON_OBJECT('exitTypeId', d.exit_type_id, 'exitReason', d.exit_reason, 'approvedBy', d.approved_by, 'comment', d.comment,
                   'deathCertificate', false, 'condolenceLetter', false, 'dependentFundEvidence', false, 'swornAffidavit', false),
       'scheduled', 'discharge_rows', d.id, (SELECT id FROM users WHERE username = 'B1000'), DATE_SUB(NOW(), INTERVAL 2 DAY)
  FROM discharge_rows d
 WHERE d.service_number = 'B1031' AND d.status = 'scheduled' AND d.scheduled_change_id IS NULL
   AND NOT EXISTS (SELECT 1 FROM scheduled_changes s WHERE s.kind = 'discharge' AND s.service_number = 'B1031' AND s.status = 'scheduled');

UPDATE discharge_rows d
   SET d.scheduled_change_id = (SELECT s.id FROM scheduled_changes s WHERE s.kind = 'discharge' AND s.service_number = d.service_number AND s.status = 'scheduled' ORDER BY s.id DESC LIMIT 1)
 WHERE d.service_number = 'B1031' AND d.status = 'scheduled' AND d.scheduled_change_id IS NULL;

-- ---- rate history: what Print Service Details lists (each rate, from and to) ----
INSERT INTO rating_advancement (service_number, start_date, end_date, rate_id, authority)
SELECT v.sn, v.start_on, v.end_on, (SELECT id FROM ref_rate WHERE code = v.rate), v.auth
  FROM (
            SELECT 'B1021' AS sn, 'OS' AS rate, '1992-03-30' AS start_on, '1996-05-01' AS end_on, 'NHQ/NP/ADV/021/1996' AS auth
  UNION ALL SELECT 'B1021', 'AB', '1996-05-01', '2003-01-01', 'NHQ/NP/ADV/044/2003'
  UNION ALL SELECT 'B1021', 'LS', '2003-01-01', '2012-05-01', 'NHQ/NP/ADV/110/2012'
  UNION ALL SELECT 'B1021', 'PO', '2012-05-01', NULL, 'NHQ/NP/ADV/087/2012'
  UNION ALL SELECT 'B1041', 'AB', '1990-11-12', '1999-01-01', 'NHQ/NP/ADV/019/1999'
  UNION ALL SELECT 'B1041', 'LS', '1999-01-01', '2005-06-01', 'NHQ/NP/ADV/052/2005'
  UNION ALL SELECT 'B1041', 'PO', '2005-06-01', '2023-06-01', 'NHQ/NP/ADV/071/2011'
  UNION ALL SELECT 'B1041', 'CPO', '2023-06-01', NULL, 'NHQ/NP/ADV/133/2023'
  UNION ALL SELECT 'B1024', 'AB', '1998-01-19', '2005-03-01', 'NHQ/NP/ADV/030/2005'
  UNION ALL SELECT 'B1024', 'PO', '2013-07-01', NULL, 'NHQ/NP/ADV/095/2013'
  ) v
 WHERE NOT EXISTS (SELECT 1 FROM rating_advancement a WHERE a.service_number = v.sn AND a.rate_id = (SELECT id FROM ref_rate WHERE code = v.rate));
