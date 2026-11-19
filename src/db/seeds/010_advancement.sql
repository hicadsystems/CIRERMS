-- Advancement Processing (WP8): the due-rule settings, the old role "Advancement" and an approver role,
-- their accounts, and demo data so every page has something: ratings in every months-in-rate band, and a
-- batch at each stage (open in review with a rating not recommended, approved and ready to close, closed and
-- waiting for its board dates, closed with ratings advanced and one rate change scheduled, and an older
-- batch fully advanced). Dates are counted back from the day the seed runs. Safe to rerun.
-- Demo accounts (password Admin@123, as HICO001), each belonging to a rating: B0801 (Advancement),
-- B0802 (Advancement Approver), B0803 (Advancement, tied to the Gunnery department).

-- ---- the due rule: placeholders until Hicad supplies the real rule (PLAN 9 and 9a decision 7) ----
INSERT IGNORE INTO settings (setting_key, value, description) VALUES
  ('advancement.due_months', '48', 'Advancement: a rating is due for the next rate after this many whole months in the current rate (placeholder rule).'),
  ('advancement.band_green_to', '50', 'Advancement: months in rate show green from the due month up to this number.'),
  ('advancement.band_amber_to', '54', 'Advancement: months in rate show amber above the green band up to this number; red above it.');

-- ---- roles ----
INSERT IGNORE INTO roles (name, description, full_access) VALUES
  ('Advancement', 'The old Advancement role: who is due, batches and their review (new rate, not recommended, add and remove), and reads the other advancement pages', 0),
  ('Advancement Approver', 'Approves departments, closes advancement batches, enters board dates and uploads advanced rates', 0);

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id FROM roles r JOIN privileges p ON (p.screen, p.action) IN (
       ('dashboard.home', 'view'), ('ratings.list', 'view'), ('ratings.edit', 'view'), ('ratings.my-details', 'view'),
       ('advancement.due', 'view'), ('advancement.due', 'add'),
       ('advancement.review', 'view'), ('advancement.review', 'add'), ('advancement.review', 'edit'), ('advancement.review', 'delete'),
       ('advancement.approval', 'view'), ('advancement.close', 'view'), ('advancement.board', 'view'),
       ('advancement.promoted', 'view'), ('advancement.upload', 'view'))
 WHERE r.name = 'Advancement';

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id FROM roles r JOIN privileges p ON (p.screen, p.action) IN (
       ('dashboard.home', 'view'), ('ratings.list', 'view'), ('ratings.edit', 'view'), ('ratings.my-details', 'view'),
       ('advancement.due', 'view'), ('advancement.review', 'view'),
       ('advancement.approval', 'view'), ('advancement.approval', 'approve'),
       ('advancement.close', 'view'), ('advancement.close', 'edit'), ('advancement.board', 'view'), ('advancement.board', 'edit'),
       ('advancement.promoted', 'view'), ('advancement.upload', 'view'), ('advancement.upload', 'add'))
 WHERE r.name = 'Advancement Approver';

-- ---- demo ratings (every account belongs to one) ----
-- mo: months in the current rate (or, for an advanced rating, in the rate it was advanced from)
INSERT IGNORE INTO ratings (service_number, status, rate_id, surname, first_name, middle_name, gender_id, date_of_birth,
  branch_id, command_id, seniority_date, entry_mode_id, date_employed, specialisation_id)
SELECT v.sn, 'current', (SELECT id FROM ref_rate WHERE code = v.rate), v.sur, v.fst, v.mid,
       (SELECT id FROM ref_gender WHERE name = v.sex), v.dob,
       (SELECT id FROM ref_branch WHERE code = v.br), (SELECT id FROM ref_command WHERE name = 'Western Naval Command'),
       DATE_SUB(DATE_SUB(CURDATE(), INTERVAL v.mo MONTH), INTERVAL 3 DAY),
       (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'), v.emp,
       (SELECT id FROM ref_specialisation WHERE code = v.spec)
  FROM (
            SELECT 'B0801' AS sn, 'PO' AS rate, 'OKAFOR' AS sur, 'Nnamdi' AS fst, 'Ugo' AS mid, 'Male' AS sex, '1986-04-12' AS dob, 'SM' AS br, 'NAV' AS spec, 30 AS mo, '2008-03-03' AS emp
  UNION ALL SELECT 'B0802', 'CPO', 'ALIYU',     'Hauwa',     'Binta',   'Female', '1982-08-19', 'ED', 'WRT', 26, '2003-07-14'
  UNION ALL SELECT 'B0803', 'PO',  'EKPO',      'Ini',       'Etim',    'Male',   '1985-11-02', 'SM', 'GUN', 22, '2007-09-24'
  UNION ALL SELECT 'B0811', 'AB',  'OGUNLEYE',  'Tobi',      'James',   'Male',   '1994-02-17', 'SM', 'GUN', 52, '2015-05-11'
  UNION ALL SELECT 'B0812', 'AB',  'NWOSU',     'Adaeze',    'Mary',    'Female', '1995-06-30', 'IT', 'ICT', 49, '2016-01-18'
  UNION ALL SELECT 'B0813', 'AB',  'GARBA',     'Sule',      'Idris',   'Male',   '1993-10-08', 'LG', 'STS', 60, '2014-08-04'
  UNION ALL SELECT 'B0814', 'LS',  'EZE',       'Ikenna',    'Paul',    'Male',   '1990-03-21', 'ME', 'MPR', 55, '2011-02-28'
  UNION ALL SELECT 'B0815', 'PO',  'ETUK',      'Edidiong',  'Sam',     'Male',   '1987-12-14', 'ME', 'HMT', 50, '2008-10-06'
  UNION ALL SELECT 'B0816', 'OS',  'ADEOYE',    'Kemi',      'Ruth',    'Female', '1998-05-09', 'LG', 'CAT', 50, '2019-03-11'
  UNION ALL SELECT 'B0817', 'AB',  'MOHAMMED',  'Yusuf',     'Bala',    'Male',   '1994-09-27', 'LG', 'STS', 58, '2015-02-02'
  UNION ALL SELECT 'B0818', 'LS',  'UMOH',      'Imaobong',  'Grace',   'Female', '1991-01-15', 'LG', 'STS', 49, '2012-06-25'
  UNION ALL SELECT 'B0819', 'LS',  'ADEBISI',   'Femi',      'Oluwole', 'Male',   '1993-07-03', 'MD', 'MAS', 51, '2014-04-14'
  UNION ALL SELECT 'B0820', 'PO',  'UCHE',      'Chiamaka',  'Ngozi',   'Female', '1989-11-22', 'MD', 'MAS', 56, '2010-09-13'
  UNION ALL SELECT 'B0821', 'PO',  'IBRAHIM',   'Musa',      'Lawal',   'Male',   '1988-02-11', 'MD', 'MAS', 53, '2009-05-04'
  UNION ALL SELECT 'B0822', 'CPO', 'OLAWALE',   'Segun',     'Tayo',    'Male',   '1984-06-06', 'SM', 'NAV', 62, '2005-01-17'
  UNION ALL SELECT 'B0823', 'CPO', 'EDET',      'Uduak',     'Effiong', 'Male',   '1985-09-18', 'SM', 'RDP', 57, '2006-03-27'
  UNION ALL SELECT 'B0824', 'PO',  'AMADI',     'Chukwudi',  'Kingsley','Male',   '1986-12-01', 'SM', 'COM', 49, '2007-11-05'
  UNION ALL SELECT 'B0825', 'LS',  'BELLO',     'Rukayat',   'Ayo',     'Female', '1992-04-25', 'SM', 'COM', 47, '2013-07-08'
  UNION ALL SELECT 'B0826', 'WO',  'NDUKWE',    'Emmanuel',  'Obi',     'Male',   '1980-10-10', 'WE', 'EWS', 66, '2000-02-21'
  ) v;

-- the Advancement lines: one open line for the current rate (since the seniority date); an advanced rating
-- has the line of the rate it left, ended the day before its board date, and the line of its new rate
INSERT INTO rating_advancement (service_number, start_date, end_date, rate_id, decoration, authority)
SELECT v.sn,
       DATE_SUB(DATE_SUB(CURDATE(), INTERVAL v.mo MONTH), INTERVAL 3 DAY),
       IF(v.board_ago IS NULL, NULL, DATE_SUB(CURDATE(), INTERVAL v.board_ago + 1 DAY)),
       (SELECT id FROM ref_rate WHERE code = v.held), NULL, v.auth
  FROM (
            SELECT 'B0801' AS sn, 'PO' AS held, 30 AS mo, NULL AS board_ago, 'NHQ/NP/DOA/044/2024' AS auth
  UNION ALL SELECT 'B0802', 'CPO', 26, NULL, 'NHQ/NP/DOA/048/2024'
  UNION ALL SELECT 'B0803', 'PO',  22, NULL, 'NHQ/NP/DOA/052/2024'
  UNION ALL SELECT 'B0811', 'AB',  52, NULL, NULL
  UNION ALL SELECT 'B0812', 'AB',  49, NULL, NULL
  UNION ALL SELECT 'B0813', 'AB',  60, NULL, NULL
  UNION ALL SELECT 'B0814', 'LS',  55, NULL, NULL
  UNION ALL SELECT 'B0815', 'PO',  50, NULL, NULL
  UNION ALL SELECT 'B0816', 'OS',  50, NULL, NULL
  UNION ALL SELECT 'B0817', 'AB',  58, NULL, NULL
  UNION ALL SELECT 'B0818', 'LS',  49, NULL, NULL
  UNION ALL SELECT 'B0819', 'AB',  51, 12,   NULL
  UNION ALL SELECT 'B0820', 'LS',  56, 12,   NULL
  UNION ALL SELECT 'B0821', 'PO',  53, NULL, NULL
  UNION ALL SELECT 'B0822', 'PO',  62, 190,  NULL
  UNION ALL SELECT 'B0823', 'PO',  57, 190,  NULL
  UNION ALL SELECT 'B0824', 'PO',  49, NULL, NULL
  UNION ALL SELECT 'B0825', 'LS',  47, NULL, NULL
  UNION ALL SELECT 'B0826', 'WO',  66, NULL, NULL
  ) v
 WHERE NOT EXISTS (SELECT 1 FROM rating_advancement a WHERE a.service_number = v.sn AND a.rate_id = (SELECT id FROM ref_rate WHERE code = v.held));

INSERT INTO rating_advancement (service_number, start_date, end_date, rate_id, decoration, authority)
SELECT v.sn, DATE_SUB(CURDATE(), INTERVAL v.board_ago DAY), NULL, (SELECT id FROM ref_rate WHERE code = v.now_rate), NULL, v.auth
  FROM (
            SELECT 'B0819' AS sn, 'LS' AS now_rate, 12 AS board_ago, 'NHQ/NP/DOA/049/2026' AS auth
  UNION ALL SELECT 'B0820', 'PO',  12,  'NHQ/NP/DOA/049/2026'
  UNION ALL SELECT 'B0822', 'CPO', 190, 'NHQ/NP/DOA/031/2026'
  UNION ALL SELECT 'B0823', 'CPO', 190, 'NHQ/NP/DOA/031/2026'
  ) v
 WHERE NOT EXISTS (SELECT 1 FROM rating_advancement a WHERE a.service_number = v.sn AND a.rate_id = (SELECT id FROM ref_rate WHERE code = v.now_rate));

-- a current posting for each (under ten months, so none of them is due for a draft)
INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT v.sn, (SELECT id FROM ref_ship WHERE name = v.ship), r.rate_id, DATE_SUB(CURDATE(), INTERVAL v.mo MONTH), NULL, v.note
  FROM (
            SELECT 'B0801' AS sn, 'NHQ ABUJA' AS ship, 6 AS mo, 'Directorate of Personnel, advancement office' AS note
  UNION ALL SELECT 'B0802', 'NHQ ABUJA',         8, 'Directorate of Personnel, advancement board'
  UNION ALL SELECT 'B0803', 'NHQ ABUJA',         4, 'Advancement office, Gunnery'
  UNION ALL SELECT 'B0811', 'NAVTRAC EBUTE-ERO', 7, 'Gunnery instructor'
  UNION ALL SELECT 'B0812', 'NAVTRAC EBUTE-ERO', 5, 'Network support'
  UNION ALL SELECT 'B0813', 'NAVTRAC EBUTE-ERO', 9, 'Stores'
  UNION ALL SELECT 'B0814', 'NAVTRAC EBUTE-ERO', 3, 'Engine room instructor'
  UNION ALL SELECT 'B0815', 'NAVTRAC EBUTE-ERO', 6, 'Hull workshop'
  UNION ALL SELECT 'B0816', 'NAVTRAC EBUTE-ERO', 8, 'Galley'
  UNION ALL SELECT 'B0817', 'NAVTRAC EBUTE-ERO', 4, 'Stores'
  UNION ALL SELECT 'B0818', 'NAVTRAC EBUTE-ERO', 7, 'Stores accountant'
  UNION ALL SELECT 'B0819', 'NAVTRAC EBUTE-ERO', 5, 'Training medical centre'
  UNION ALL SELECT 'B0820', 'NAVTRAC EBUTE-ERO', 9, 'Training medical centre'
  UNION ALL SELECT 'B0821', 'NAVTRAC EBUTE-ERO', 6, 'Training medical centre'
  UNION ALL SELECT 'B0822', 'NHQ ABUJA',         8, 'Navigation office'
  UNION ALL SELECT 'B0823', 'NHQ ABUJA',         3, 'Operations room'
  UNION ALL SELECT 'B0824', 'NAVTRAC EBUTE-ERO', 6, 'Signals instructor'
  UNION ALL SELECT 'B0825', 'NAVTRAC EBUTE-ERO', 4, 'Signals'
  UNION ALL SELECT 'B0826', 'NAVTRAC EBUTE-ERO', 9, 'Weapon systems instructor'
  ) v
  JOIN ratings r ON r.service_number = v.sn
 WHERE NOT EXISTS (SELECT 1 FROM rating_drafting d WHERE d.service_number = v.sn);

-- ---- accounts ----
INSERT IGNORE INTO users (username, password_hash, role_id, service_number, email, phone, specialisation_id, is_active) VALUES
  ('B0801', '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', (SELECT id FROM roles WHERE name = 'Advancement'), 'B0801', 'n.okafor@navy.mil.ng', '08031118801', NULL, 1),
  ('B0802', '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', (SELECT id FROM roles WHERE name = 'Advancement Approver'), 'B0802', 'h.aliyu@navy.mil.ng', '08031118802', NULL, 1),
  ('B0803', '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', (SELECT id FROM roles WHERE name = 'Advancement'), 'B0803', 'b.ekpo@navy.mil.ng', '08031118803',
   (SELECT id FROM ref_specialisation WHERE code = 'GUN'), 1);

-- ---- batches: one at each stage ----
INSERT INTO batches (flow, batch_number, batch_code, sequence, branch_id, rate_id, status, initiated_by, initiated_at, closed_by, closed_at, close_date, authority)
SELECT 'DOA', CONCAT(v.code, '-000001'), v.code, 1, (SELECT id FROM ref_branch WHERE code = v.br), (SELECT id FROM ref_rate WHERE code = v.rt), v.st,
       (SELECT id FROM users WHERE username = 'B0801'), DATE_SUB(NOW(), INTERVAL v.ini DAY),
       IF(v.st = 'closed', (SELECT id FROM users WHERE username = 'B0802'), NULL),
       IF(v.st = 'closed', DATE_SUB(NOW(), INTERVAL v.clo DAY), NULL),
       IF(v.st = 'closed', DATE_SUB(CURDATE(), INTERVAL v.clo DAY), NULL), v.auth
  FROM (
            SELECT 'DOA-ALL-ALL-AB' AS code, NULL AS br, 'AB' AS rt, 'open' AS st, 12 AS ini, NULL AS clo, NULL AS auth
  UNION ALL SELECT 'DOA-ME-ALL-ALL', 'ME', NULL, 'approved', 10, NULL, NULL
  UNION ALL SELECT 'DOA-LG-ALL-ALL', 'LG', NULL, 'closed',   18, 6,   'NHQ/NP/DOA/052/2026'
  UNION ALL SELECT 'DOA-MD-ALL-ALL', 'MD', NULL, 'closed',   30, 20,  'NHQ/NP/DOA/049/2026'
  UNION ALL SELECT 'DOA-SM-ALL-PO',  'SM', 'PO', 'closed',   215, 200, 'NHQ/NP/DOA/031/2026'
  ) v
 WHERE NOT EXISTS (SELECT 1 FROM batches b WHERE b.batch_number = CONCAT(v.code, '-000001'));

-- approvals: the departments of the approved batch and of the three closed ones
INSERT INTO batch_approvals (flow, specialisation_id, approver_rank, approver_name, appointment, approved_by, approved_at)
SELECT 'DOA', (SELECT id FROM ref_specialisation WHERE code = v.spec), v.rnk, v.nm, v.appt, (SELECT id FROM users WHERE username = 'B0802'), DATE_SUB(NOW(), INTERVAL v.ago DAY)
  FROM (
            SELECT 'MPR' AS spec, 'CDR' AS rnk, 'Ibrahim Danladi' AS nm, 'Chief of Naval Personnel' AS appt, 4 AS ago
  UNION ALL SELECT 'HMT', 'CDR', 'Ibrahim Danladi', 'Chief of Naval Personnel', 4
  UNION ALL SELECT 'CAT', 'CAPT', 'Adaora Nwankwo', 'Director of Personnel (Navy)', 8
  UNION ALL SELECT 'STS', 'CAPT', 'Adaora Nwankwo', 'Director of Personnel (Navy)', 8
  UNION ALL SELECT 'MAS', 'CAPT', 'Adaora Nwankwo', 'Director of Personnel (Navy)', 22
  UNION ALL SELECT 'NAV', 'CDRE', 'Tunde Ajayi', 'Chief of Naval Personnel', 202
  UNION ALL SELECT 'RDP', 'CDRE', 'Tunde Ajayi', 'Chief of Naval Personnel', 202
  ) v
 WHERE NOT EXISTS (SELECT 1 FROM batch_approvals a WHERE a.flow = 'DOA' AND a.specialisation_id = (SELECT id FROM ref_specialisation WHERE code = v.spec));

-- the batches' ratings: their rate and since when at the proposal, the next rate, and what became of it
INSERT INTO advancement_rows (batch_id, service_number, rate_id, specialisation_id, rate_since, months_in_rate, new_rate_id, remark,
  not_recommended_reason, not_recommended_by, not_recommended_at, approval_id, status, board_date, board_set_by, board_set_at, added_by, added_at)
SELECT b.id, v.sn, (SELECT id FROM ref_rate WHERE code = v.old_rate), r.specialisation_id,
       DATE_SUB(DATE_SUB(CURDATE(), INTERVAL v.mo MONTH), INTERVAL 3 DAY), v.mo,
       (SELECT id FROM ref_rate WHERE code = v.new_rate), v.remark,
       v.nr, IF(v.nr IS NULL, NULL, (SELECT id FROM users WHERE username = 'B0801')), IF(v.nr IS NULL, NULL, DATE_SUB(NOW(), INTERVAL 2 DAY)),
       IF(v.appr = 1, (SELECT MAX(a.id) FROM batch_approvals a WHERE a.flow = 'DOA' AND a.specialisation_id = r.specialisation_id), NULL),
       v.st,
       CASE v.st WHEN 'advanced' THEN DATE_SUB(CURDATE(), INTERVAL v.board_ago DAY) WHEN 'scheduled' THEN DATE_ADD(CURDATE(), INTERVAL 15 DAY) ELSE NULL END,
       IF(v.st IN ('advanced','scheduled'), (SELECT id FROM users WHERE username = 'B0802'), NULL),
       IF(v.st IN ('advanced','scheduled'), DATE_SUB(NOW(), INTERVAL 5 DAY), NULL),
       b.initiated_by, b.initiated_at
  FROM (
            SELECT 'DOA-ALL-ALL-AB-000001' AS bn, 'B0811' AS sn, 'AB' AS old_rate, 52 AS mo, 'LS' AS new_rate, 'Recommended by the commanding officer' AS remark, NULL AS nr, 0 AS appr, 'proposed' AS st, NULL AS board_ago
  UNION ALL SELECT 'DOA-ALL-ALL-AB-000001', 'B0812', 'AB', 49, NULL, NULL, NULL, 0, 'proposed', NULL
  UNION ALL SELECT 'DOA-ALL-ALL-AB-000001', 'B0813', 'AB', 60, NULL, NULL, 'Failed the professional examination', 0, 'not_recommended', NULL
  UNION ALL SELECT 'DOA-ME-ALL-ALL-000001', 'B0814', 'LS', 55, 'PO', NULL, NULL, 1, 'proposed', NULL
  UNION ALL SELECT 'DOA-ME-ALL-ALL-000001', 'B0815', 'PO', 50, 'CPO', 'Docking period: advance after the refit', NULL, 1, 'proposed', NULL
  UNION ALL SELECT 'DOA-LG-ALL-ALL-000001', 'B0816', 'OS', 50, 'AB', NULL, NULL, 1, 'awaiting_board', NULL
  UNION ALL SELECT 'DOA-LG-ALL-ALL-000001', 'B0817', 'AB', 58, 'LS', NULL, NULL, 1, 'awaiting_board', NULL
  UNION ALL SELECT 'DOA-LG-ALL-ALL-000001', 'B0818', 'LS', 49, 'PO', NULL, NULL, 1, 'awaiting_board', NULL
  UNION ALL SELECT 'DOA-MD-ALL-ALL-000001', 'B0819', 'AB', 51, 'LS', NULL, NULL, 1, 'advanced', 12
  UNION ALL SELECT 'DOA-MD-ALL-ALL-000001', 'B0820', 'LS', 56, 'PO', NULL, NULL, 1, 'advanced', 12
  UNION ALL SELECT 'DOA-MD-ALL-ALL-000001', 'B0821', 'PO', 53, 'CPO', NULL, NULL, 1, 'scheduled', NULL
  UNION ALL SELECT 'DOA-SM-ALL-PO-000001',  'B0822', 'PO', 62, 'CPO', NULL, NULL, 1, 'advanced', 190
  UNION ALL SELECT 'DOA-SM-ALL-PO-000001',  'B0823', 'PO', 57, 'CPO', NULL, NULL, 1, 'advanced', 190
  UNION ALL SELECT 'DOA-SM-ALL-PO-000001',  'B0824', 'PO', 49, NULL, NULL, 'Pending medical board', 0, 'not_recommended', NULL
  ) v
  JOIN batches b ON b.batch_number = v.bn
  JOIN ratings r ON r.service_number = v.sn
 WHERE NOT EXISTS (SELECT 1 FROM advancement_rows x WHERE x.batch_id = b.id AND x.service_number = v.sn);

-- the advanced rows point to the Advancement line they opened
UPDATE advancement_rows x
  JOIN rating_advancement a ON a.service_number = x.service_number AND a.rate_id = x.new_rate_id AND a.start_date = x.board_date
   SET x.advancement_id = a.id
 WHERE x.status = 'advanced' AND x.advancement_id IS NULL;

-- the scheduled change: IBRAHIM to CPO fifteen days from today (the server makes it on that date)
INSERT INTO scheduled_changes (kind, service_number, effective_date, payload, status, source_table, source_id, scheduled_by, scheduled_at)
SELECT 'advancement', x.service_number, x.board_date,
       JSON_OBJECT('fromRateId', x.rate_id, 'toRateId', x.new_rate_id, 'authority', b.authority, 'decoration', ''),
       'scheduled', 'advancement_rows', x.id, (SELECT id FROM users WHERE username = 'B0802'), DATE_SUB(NOW(), INTERVAL 5 DAY)
  FROM advancement_rows x JOIN batches b ON b.id = x.batch_id
 WHERE b.batch_number = 'DOA-MD-ALL-ALL-000001' AND x.status = 'scheduled'
   AND NOT EXISTS (SELECT 1 FROM scheduled_changes c WHERE c.source_table = 'advancement_rows' AND c.source_id = x.id);

UPDATE advancement_rows x
  JOIN scheduled_changes c ON c.source_table = 'advancement_rows' AND c.source_id = x.id AND c.status = 'scheduled'
   SET x.scheduled_change_id = c.id
 WHERE x.status = 'scheduled' AND x.scheduled_change_id IS NULL;
