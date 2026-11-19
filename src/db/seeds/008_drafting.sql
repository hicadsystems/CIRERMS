-- Drafting (WP7a): the due-rule settings, the old role "Drafting" and an approver role, their accounts,
-- and demo data so every page has something: a manning requirement for the ships, ratings due for a draft,
-- and a batch at each stage (open in review, open with a rating not recommended, approved and ready to close,
-- closed and waiting for its WEF, closed with ratings reported and one move scheduled). Dates are counted
-- back from the day the seed runs, so months on a ship fall in every band. Safe to rerun.
-- Demo accounts (password Admin@123, as HICO001), each belonging to a rating: B0705 (Drafting),
-- B0706 (Drafting, tied to the Marine Propulsion department), B0707 (Drafting Approver).

-- ---- the due rule: placeholders until Hicad supplies the real rule (PLAN 9 and 9a decision 7) ----
INSERT IGNORE INTO settings (setting_key, value, description) VALUES
  ('drafting.due_months', '10', 'Drafting: a rating is due for a draft after this many whole months on the current ship (placeholder rule).'),
  ('drafting.band_green_to', '20', 'Drafting: months on a ship show green from the due month up to this number.'),
  ('drafting.band_amber_to', '24', 'Drafting: months on a ship show amber above the green band up to this number; red above it.');

-- ---- roles ----
INSERT IGNORE INTO roles (name, description, full_access) VALUES
  ('Drafting', 'The old Drafting role: who is due, batches and their review (proposed ships, not recommended, add and remove), and reads the other drafting pages', 0),
  ('Drafting Approver', 'Approves departments, closes batches, sets the WEF and keeps the manning requirement', 0);

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id FROM roles r JOIN privileges p ON (p.screen, p.action) IN (
       ('dashboard.home', 'view'), ('ratings.list', 'view'), ('ratings.edit', 'view'), ('ratings.my-details', 'view'),
       ('drafting.manning', 'view'), ('drafting.proposal', 'view'), ('drafting.proposal', 'add'),
       ('drafting.review', 'view'), ('drafting.review', 'add'), ('drafting.review', 'edit'), ('drafting.review', 'delete'),
       ('drafting.approval', 'view'), ('drafting.close', 'view'), ('drafting.wef', 'view'))
 WHERE r.name = 'Drafting';

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id FROM roles r JOIN privileges p ON (p.screen, p.action) IN (
       ('dashboard.home', 'view'), ('ratings.list', 'view'), ('ratings.edit', 'view'), ('ratings.my-details', 'view'),
       ('drafting.manning', 'view'), ('drafting.manning', 'add'), ('drafting.manning', 'edit'), ('drafting.manning', 'delete'),
       ('drafting.proposal', 'view'), ('drafting.review', 'view'),
       ('drafting.approval', 'view'), ('drafting.approval', 'approve'),
       ('drafting.close', 'view'), ('drafting.close', 'edit'), ('drafting.wef', 'view'), ('drafting.wef', 'edit'))
 WHERE r.name = 'Drafting Approver';

-- ---- demo ratings (every account belongs to one) ----
INSERT IGNORE INTO ratings (service_number, status, rate_id, surname, first_name, middle_name, gender_id, date_of_birth,
  branch_id, command_id, seniority_date, entry_mode_id, date_employed, specialisation_id)
SELECT v.sn, 'current', (SELECT id FROM ref_rate WHERE code = v.rate), v.sur, v.fst, v.mid,
       (SELECT id FROM ref_gender WHERE name = v.sex), v.dob,
       (SELECT id FROM ref_branch WHERE code = v.br), (SELECT id FROM ref_command WHERE name = 'Western Naval Command'),
       v.sen, (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'), v.emp,
       (SELECT id FROM ref_specialisation WHERE code = v.spec)
  FROM (
            SELECT 'B0701' AS sn, 'LS' AS rate, 'ODIGIE' AS sur, 'Osaro' AS fst, 'Felix' AS mid, 'Male' AS sex, '1991-03-14' AS dob, 'SM' AS br, 'NAV' AS spec, '2021-06-01' AS sen, '2012-04-02' AS emp
  UNION ALL SELECT 'B0702', 'AB',  'NNAJI',      'Chinedu',  'Paul',    'Male',   '1995-07-22', 'SM', 'GUN', '2022-01-01', '2016-09-12'
  UNION ALL SELECT 'B0703', 'OS',  'YAKUBU',     'Haruna',   'Musa',    'Male',   '1999-11-03', 'SM', 'COM', '2023-05-01', '2021-02-15'
  UNION ALL SELECT 'B0704', 'PO',  'ETIM',       'Edet',     'Asuquo',  'Male',   '1987-02-09', 'SM', 'RDP', '2020-03-01', '2009-08-17'
  UNION ALL SELECT 'B0705', 'CPO', 'OGBONNA',    'Ifeoma',   'Grace',   'Female', '1983-05-30', 'ED', 'WRT', '2019-10-01', '2004-06-21'
  UNION ALL SELECT 'B0706', 'WO',  'DANJUMA',    'Ibrahim',  'Sani',    'Male',   '1981-09-18', 'ME', 'MPR', '2018-04-01', '2002-11-04'
  UNION ALL SELECT 'B0707', 'MWO', 'ADEBAYO',    'Olufemi',  'Ade',     'Male',   '1978-12-06', 'SM', 'NAV', '2017-01-01', '1998-03-09'
  UNION ALL SELECT 'B0711', 'LS',  'ONYEKACHI',  'Emeka',    'John',    'Male',   '1992-04-11', 'ME', 'MPR', '2021-09-01', '2013-01-14'
  UNION ALL SELECT 'B0712', 'AB',  'IGWE',       'Kelechi',  'Daniel',  'Male',   '1996-08-25', 'ME', 'MPR', '2022-06-01', '2017-05-08'
  UNION ALL SELECT 'B0713', 'PO',  'OLADIPO',    'Tunde',    'Samuel',  'Male',   '1988-01-19', 'ME', 'HMT', '2020-07-01', '2010-02-22'
  UNION ALL SELECT 'B0714', 'AB',  'UMARU',      'Fatima',   'Hauwa',   'Female', '1997-06-02', 'LG', 'STS', '2022-03-01', '2018-07-30'
  UNION ALL SELECT 'B0715', 'OS',  'EKWUEME',    'Chioma',   'Ada',     'Female', '2000-10-15', 'LG', 'CAT', '2024-01-01', '2022-03-07'
  UNION ALL SELECT 'B0716', 'LS',  'ADAMU',      'Bello',    'Garba',   'Male',   '1990-12-28', 'LG', 'STS', '2021-02-01', '2011-10-10'
  UNION ALL SELECT 'B0717', 'PO',  'OKORO',      'Uchenna',  'Mark',    'Male',   '1986-03-07', 'NP', 'REG', '2020-11-01', '2008-05-19'
  UNION ALL SELECT 'B0718', 'AB',  'ABUBAKAR',   'Zainab',   'Ladi',    'Female', '1996-09-13', 'NP', 'REG', '2022-08-01', '2017-11-27'
  UNION ALL SELECT 'B0719', 'LS',  'ITA',        'Effiong',  'Ekpo',    'Male',   '1991-05-21', 'WE', 'EWS', '2021-04-01', '2012-09-03'
  UNION ALL SELECT 'B0720', 'AB',  'OYELARAN',   'Kunle',    'David',   'Male',   '1995-02-17', 'WE', 'EWS', '2022-02-01', '2016-06-13'
  UNION ALL SELECT 'B0721', 'PO',  'NWACHUKWU',  'Obinna',   'Peter',   'Male',   '1987-10-04', 'WE', 'EWS', '2020-05-01', '2009-01-26'
  UNION ALL SELECT 'B0722', 'AB',  'TANKO',      'Hadiza',   'Amina',   'Female', '1996-12-08', 'MD', 'MAS', '2022-10-01', '2018-02-05'
  UNION ALL SELECT 'B0723', 'LS',  'OBI',        'Nkechi',   'Rita',    'Female', '1992-07-30', 'MD', 'MAS', '2021-12-01', '2013-08-12'
  UNION ALL SELECT 'B0724', 'OS',  'AKPAN',      'Aniekan',  'Joseph',  'Male',   '2000-04-26', 'MD', 'MAS', '2024-02-01', '2022-06-20'
  UNION ALL SELECT 'B0725', 'AB',  'SALAWU',     'Kabiru',   'Ola',     'Male',   '1995-11-11', 'IT', 'ICT', '2022-05-01', '2017-03-06'
  UNION ALL SELECT 'B0726', 'LS',  'EZEOKE',     'Amaka',    'Joy',     'Female', '1990-01-23', 'ED', 'WRT', '2021-07-01', '2011-12-05'
  UNION ALL SELECT 'B0727', 'LS',  'IDOWU',      'Gbenga',   'Sola',    'Male',   '1993-06-16', 'SM', 'NAV', '2022-09-01', '2014-04-28'
  UNION ALL SELECT 'B0728', 'OS',  'BALOGUN',    'Rasheed',  'Ayo',     'Male',   '2001-02-02', 'SM', 'GUN', '2025-01-01', '2023-07-17'
  UNION ALL SELECT 'B0729', 'AB',  'OKEKE',      'Chidi',    'Victor',  'Male',   '1997-03-29', 'ME', 'MPR', '2023-02-01', '2019-01-21'
  UNION ALL SELECT 'B0730', 'AB',  'DIKKO',      'Aisha',    'Rabi',    'Female', '1998-08-08', 'LG', 'CAT', '2023-06-01', '2019-09-16'
  ) v;

-- postings: a previous ship and the current one (months on the current ship counted back from today)
INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT v.sn, (SELECT id FROM ref_ship WHERE name = v.ship), r.rate_id,
       DATE_SUB(CURDATE(), INTERVAL v.from_mo MONTH),
       IF(v.to_mo IS NULL, NULL, DATE_SUB(DATE_SUB(CURDATE(), INTERVAL v.to_mo MONTH), INTERVAL 1 DAY)),
       v.note
  FROM (
            SELECT 'B0701' AS sn, 'NNS DELTA' AS ship, 60 AS from_mo, 26 AS to_mo, 'Bridge watchkeeper' AS note
  UNION ALL SELECT 'B0701', 'NNS THUNDER',       26, NULL, 'Navigator''s yeoman'
  UNION ALL SELECT 'B0702', 'NNS BEECROFT',      50, 22,   'Close-range weapons crew'
  UNION ALL SELECT 'B0702', 'NNS ARADU',         22, NULL, 'Gun crew'
  UNION ALL SELECT 'B0703', 'NAVTRAC EBUTE-ERO', 40, 19,   'Basic training'
  UNION ALL SELECT 'B0703', 'NNS UNITY',         19, NULL, 'Signals rating'
  UNION ALL SELECT 'B0704', 'NNS QUORRA',        55, 14,   'Radar plotting instructor'
  UNION ALL SELECT 'B0704', 'NNS KADA',          14, NULL, 'Operations room'
  UNION ALL SELECT 'B0705', 'NNS BEECROFT',      48, 8,    'Ship''s office'
  UNION ALL SELECT 'B0705', 'NHQ ABUJA',         8,  NULL, 'Drafting office'
  UNION ALL SELECT 'B0706', 'NNS ARADU',         40, 5,    'Engine room'
  UNION ALL SELECT 'B0706', 'NHQ ABUJA',         5,  NULL, 'Drafting office, Marine Propulsion'
  UNION ALL SELECT 'B0707', 'NNS VICTORY',       36, 9,    'Coxswain'
  UNION ALL SELECT 'B0707', 'NHQ ABUJA',         9,  NULL, 'Directorate of Personnel'
  UNION ALL SELECT 'B0711', 'NNS UNITY',         52, 25,   'Stoker'
  UNION ALL SELECT 'B0711', 'NNS OKPABANA',      25, NULL, 'Main propulsion watchkeeper'
  UNION ALL SELECT 'B0712', 'NNS KADA',          44, 18,   'Stoker'
  UNION ALL SELECT 'B0712', 'NNS CENTENARY',     18, NULL, 'Auxiliary machinery'
  UNION ALL SELECT 'B0713', 'NNS PATHFINDER',    48, 21,   'Hull maintenance'
  UNION ALL SELECT 'B0713', 'NNS DELTA',         21, NULL, 'Dockyard liaison'
  UNION ALL SELECT 'B0714', 'NNS JUBILEE',       40, 16,   'Stores assistant'
  UNION ALL SELECT 'B0714', 'NNS BEECROFT',      16, NULL, 'Naval stores'
  UNION ALL SELECT 'B0715', 'NAVTRAC EBUTE-ERO', 30, 13,   'Basic training'
  UNION ALL SELECT 'B0715', 'NNS PROSPERITY',    13, NULL, 'Galley'
  UNION ALL SELECT 'B0716', 'NNS THUNDER',       58, 30,   'Victualling'
  UNION ALL SELECT 'B0716', 'NNS JUBILEE',       30, NULL, 'Stores accountant'
  UNION ALL SELECT 'B0717', 'NNS DELTA',         54, 28,   'Regulating petty officer'
  UNION ALL SELECT 'B0717', 'NNS QUORRA',        28, NULL, 'Provost'
  UNION ALL SELECT 'B0718', 'NNS BEECROFT',      40, 20,   'Gate patrol'
  UNION ALL SELECT 'B0718', 'NNS DELTA',         20, NULL, 'Regulating staff'
  UNION ALL SELECT 'B0719', 'NNS BEECROFT',      60, 24,   'Electrical workshop'
  UNION ALL SELECT 'B0720', 'NNS UNITY',         45, 23,   'Weapons electrician'
  UNION ALL SELECT 'B0721', 'NNS PATHFINDER',    50, 24,   'Fire control'
  UNION ALL SELECT 'B0721', 'NNS UNITY',         24, NULL, 'Weapon systems'
  UNION ALL SELECT 'B0722', 'NNS BEECROFT',      38, 15,   'Sick bay attendant'
  UNION ALL SELECT 'B0722', 'NHQ ABUJA',         15, NULL, 'Medical centre'
  UNION ALL SELECT 'B0723', 'NNS DELTA',         36, 11,   'Sick bay'
  UNION ALL SELECT 'B0723', 'NAVTRAC EBUTE-ERO', 11, NULL, 'Training medical centre'
  UNION ALL SELECT 'B0724', 'NAVTRAC EBUTE-ERO', 30, 12,   'Basic training'
  UNION ALL SELECT 'B0724', 'NNS BEECROFT',      12, NULL, 'Medical centre'
  UNION ALL SELECT 'B0725', 'NNS PATHFINDER',    40, 17,   'Communications systems'
  UNION ALL SELECT 'B0725', 'NHQ ABUJA',         17, NULL, 'ICT directorate'
  UNION ALL SELECT 'B0726', 'NNS DELTA',         55, 27,   'Ship''s office'
  UNION ALL SELECT 'B0726', 'NHQ ABUJA',         27, NULL, 'Records office'
  UNION ALL SELECT 'B0727', 'NNS THUNDER',       42, 12,   'Bridge watchkeeper'
  UNION ALL SELECT 'B0727', 'NNS PATHFINDER',    12, NULL, 'Navigation office'
  UNION ALL SELECT 'B0728', 'NAVTRAC EBUTE-ERO', 20, 4,    'Basic training'
  UNION ALL SELECT 'B0728', 'NNS VICTORY',       4,  NULL, 'Gun crew'
  UNION ALL SELECT 'B0729', 'NNS KADA',          30, 7,    'Stoker'
  UNION ALL SELECT 'B0729', 'NNS ARADU',         7,  NULL, 'Engine room'
  UNION ALL SELECT 'B0730', 'NNS UNITY',         26, 2,    'Galley'
  UNION ALL SELECT 'B0730', 'NNS CENTENARY',     2,  NULL, 'Galley'
  ) v
  JOIN ratings r ON r.service_number = v.sn
 WHERE NOT EXISTS (SELECT 1 FROM rating_drafting d WHERE d.service_number = v.sn AND d.ship_id = (SELECT id FROM ref_ship WHERE name = v.ship));

-- the two ratings of the closed Weapon Engineering batch who have reported: the posting before the draft
-- (ended the day before the WEF, ten days ago) and the new one from the WEF
INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT v.sn, (SELECT id FROM ref_ship WHERE name = v.ship), r.rate_id, v.start_on, v.end_on, v.note
  FROM (
            SELECT 'B0719' AS sn, 'NNS ARADU' AS ship, DATE_SUB(DATE_SUB(CURDATE(), INTERVAL 10 DAY), INTERVAL 23 MONTH) AS start_on, DATE_SUB(CURDATE(), INTERVAL 11 DAY) AS end_on, 'Weapon electrical systems' AS note
  UNION ALL SELECT 'B0719', 'NNS VICTORY', DATE_SUB(CURDATE(), INTERVAL 10 DAY), NULL, 'Drafted under NHQ/NP/DOD/131/2026'
  UNION ALL SELECT 'B0720', 'NNS THUNDER', DATE_SUB(DATE_SUB(CURDATE(), INTERVAL 10 DAY), INTERVAL 22 MONTH), DATE_SUB(CURDATE(), INTERVAL 11 DAY), 'Weapons electrician'
  UNION ALL SELECT 'B0720', 'NNS ARADU',   DATE_SUB(CURDATE(), INTERVAL 10 DAY), NULL, 'Drafted under NHQ/NP/DOD/131/2026'
  ) v
  JOIN ratings r ON r.service_number = v.sn
 WHERE NOT EXISTS (SELECT 1 FROM rating_drafting d WHERE d.service_number = v.sn AND d.ship_id = (SELECT id FROM ref_ship WHERE name = v.ship));

-- ---- accounts ----
INSERT IGNORE INTO users (username, password_hash, role_id, service_number, email, phone, specialisation_id, is_active) VALUES
  ('B0705', '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', (SELECT id FROM roles WHERE name = 'Drafting'), 'B0705', 'i.ogbonna@navy.mil.ng', '08031112305', NULL, 1),
  ('B0706', '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', (SELECT id FROM roles WHERE name = 'Drafting'), 'B0706', 'i.danjuma@navy.mil.ng', '08031112306',
   (SELECT id FROM ref_specialisation WHERE code = 'MPR'), 1),
  ('B0707', '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', (SELECT id FROM roles WHERE name = 'Drafting Approver'), 'B0707', 'o.adebayo@navy.mil.ng', '08031112307', NULL, 1);

-- ---- manning requirement (advisory) ----
INSERT INTO manning_requirements (ship_id, rate_id, specialisation_id, quantity)
SELECT (SELECT id FROM ref_ship WHERE name = v.ship), (SELECT id FROM ref_rate WHERE code = v.rate), (SELECT id FROM ref_specialisation WHERE code = v.spec), v.qty
  FROM (
            SELECT 'NNS ARADU' AS ship, 'AB' AS rate, 'GUN' AS spec, 2 AS qty
  UNION ALL SELECT 'NNS ARADU',         'CPO', 'MPR', 1
  UNION ALL SELECT 'NNS ARADU',         'AB',  'EWS', 2
  UNION ALL SELECT 'NNS BEECROFT',      'OS',  'CAT', 2
  UNION ALL SELECT 'NNS BEECROFT',      'AB',  'STS', 2
  UNION ALL SELECT 'NNS BEECROFT',      'OS',  'MAS', 1
  UNION ALL SELECT 'NNS CENTENARY',     'LS',  'MPR', 1
  UNION ALL SELECT 'NNS CENTENARY',     'MWO', 'RDP', 1
  UNION ALL SELECT 'NNS DELTA',         'PO',  'REG', 1
  UNION ALL SELECT 'NNS DELTA',         'PO',  'HMT', 1
  UNION ALL SELECT 'NNS JUBILEE',       'AB',  'STS', 1
  UNION ALL SELECT 'NNS KADA',          'PO',  'NAV', 2
  UNION ALL SELECT 'NNS KADA',          'PO',  'RDP', 1
  UNION ALL SELECT 'NHQ ABUJA',         'LS',  'ICT', 2
  UNION ALL SELECT 'NHQ ABUJA',         'AB',  'MAS', 2
  UNION ALL SELECT 'NNS OKPABANA',      'AB',  'GUN', 2
  UNION ALL SELECT 'NNS OKPABANA',      'AB',  'MPR', 1
  UNION ALL SELECT 'NNS PATHFINDER',    'LS',  'NAV', 1
  UNION ALL SELECT 'NNS PATHFINDER',    'LS',  'STS', 1
  UNION ALL SELECT 'NNS PROSPERITY',    'PO',  'HMT', 1
  UNION ALL SELECT 'NNS QUORRA',        'OS',  'COM', 3
  UNION ALL SELECT 'NNS QUORRA',        'PO',  'REG', 1
  UNION ALL SELECT 'NNS THUNDER',       'LS',  'NAV', 1
  UNION ALL SELECT 'NNS UNITY',         'OS',  'COM', 2
  UNION ALL SELECT 'NNS VICTORY',       'AB',  'GUN', 2
  UNION ALL SELECT 'NNS VICTORY',       'WO',  'EWS', 1
  UNION ALL SELECT 'NNS VICTORY',       'LS',  'EWS', 1
  ) v
 WHERE NOT EXISTS (SELECT 1 FROM manning_requirements m
                    WHERE m.ship_id = (SELECT id FROM ref_ship WHERE name = v.ship) AND m.rate_id = (SELECT id FROM ref_rate WHERE code = v.rate)
                      AND m.specialisation_id = (SELECT id FROM ref_specialisation WHERE code = v.spec));

-- ---- batches: one at each stage ----
INSERT INTO batches (flow, batch_number, batch_code, sequence, branch_id, status, initiated_by, initiated_at, closed_by, closed_at, close_date, authority)
SELECT 'DOD', CONCAT(v.code, '-000001'), v.code, 1, (SELECT id FROM ref_branch WHERE code = v.br), v.st,
       (SELECT id FROM users WHERE username = v.who), DATE_SUB(NOW(), INTERVAL v.ini DAY),
       IF(v.st = 'closed', (SELECT id FROM users WHERE username = 'B0707'), NULL),
       IF(v.st = 'closed', DATE_SUB(NOW(), INTERVAL v.clo DAY), NULL),
       IF(v.st = 'closed', DATE_SUB(CURDATE(), INTERVAL v.clo DAY), NULL), v.auth
  FROM (
            SELECT 'DOD-SM-ALL-ALL' AS code, 'SM' AS br, 'open' AS st, 'B0705' AS who, 15 AS ini, NULL AS clo, NULL AS auth
  UNION ALL SELECT 'DOD-ME-ALL-ALL', 'ME', 'approved', 'B0706', 10, NULL, NULL
  UNION ALL SELECT 'DOD-LG-ALL-ALL', 'LG', 'open',     'B0705', 7,  NULL, NULL
  UNION ALL SELECT 'DOD-NP-ALL-ALL', 'NP', 'closed',   'B0705', 24, 5,  'NHQ/NP/DOD/134/2026'
  UNION ALL SELECT 'DOD-WE-ALL-ALL', 'WE', 'closed',   'B0705', 35, 14, 'NHQ/NP/DOD/131/2026'
  ) v
 WHERE NOT EXISTS (SELECT 1 FROM batches b WHERE b.batch_number = CONCAT(v.code, '-000001'));

-- approvals: Marine Propulsion and Hull Maintenance (the Marine Engineering batch, ready to close), and the
-- departments of the two closed batches
INSERT INTO batch_approvals (flow, specialisation_id, approver_rank, approver_name, appointment, approved_by, approved_at)
SELECT 'DOD', (SELECT id FROM ref_specialisation WHERE code = v.spec), v.rnk, v.nm, v.appt, (SELECT id FROM users WHERE username = 'B0707'), DATE_SUB(NOW(), INTERVAL v.ago DAY)
  FROM (
            SELECT 'MPR' AS spec, 'LTCDR' AS rnk, 'Amaka Eze' AS nm, 'Director of Personnel (Navy)' AS appt, 3 AS ago
  UNION ALL SELECT 'HMT', 'LTCDR', 'Amaka Eze', 'Director of Personnel (Navy)', 3
  UNION ALL SELECT 'REG', 'CDR', 'Ibrahim Danladi', 'Chief of Naval Personnel', 8
  UNION ALL SELECT 'EWS', 'CDR', 'Ibrahim Danladi', 'Chief of Naval Personnel', 17
  ) v
 WHERE NOT EXISTS (SELECT 1 FROM batch_approvals a WHERE a.flow = 'DOD' AND a.specialisation_id = (SELECT id FROM ref_specialisation WHERE code = v.spec));

-- the batches' ratings: where they were when proposed (ship, date joined, months there) and where they go
INSERT INTO draft_rows (batch_id, service_number, rate_id, specialisation_id, current_ship_id, joined_on, months_on_ship,
  proposed_ship_id, vice, remark, request, not_recommended_reason, not_recommended_by, not_recommended_at, approval_id, status, wef,
  added_by, added_at)
SELECT b.id, v.sn, r.rate_id, r.specialisation_id, (SELECT id FROM ref_ship WHERE name = v.cur),
       DATE_SUB(DATE_SUB(CURDATE(), INTERVAL v.wef_ago DAY), INTERVAL v.mo MONTH), v.mo,
       (SELECT id FROM ref_ship WHERE name = v.prop), v.vice, v.remark, v.req,
       v.nr, IF(v.nr IS NULL, NULL, (SELECT id FROM users WHERE username = 'B0705')), IF(v.nr IS NULL, NULL, DATE_SUB(NOW(), INTERVAL 2 DAY)),
       IF(v.appr = 1, (SELECT MAX(a.id) FROM batch_approvals a WHERE a.flow = 'DOD' AND a.specialisation_id = r.specialisation_id), NULL),
       v.st, IF(v.wef_ago = 0 AND v.st <> 'scheduled', NULL, IF(v.st = 'scheduled', DATE_ADD(CURDATE(), INTERVAL 20 DAY), DATE_SUB(CURDATE(), INTERVAL v.wef_ago DAY))),
       b.initiated_by, b.initiated_at
  FROM (
            SELECT 'DOD-SM-ALL-ALL-000001' AS bn, 'B0701' AS sn, 'NNS THUNDER' AS cur, 26 AS mo, 'NNS PATHFINDER' AS prop, NULL AS vice, NULL AS remark, NULL AS req, NULL AS nr, 0 AS appr, 'proposed' AS st, 0 AS wef_ago
  UNION ALL SELECT 'DOD-SM-ALL-ALL-000001', 'B0702', 'NNS ARADU',      22, 'NNS VICTORY',    'Vice AB BALOGUN', NULL, NULL, NULL, 0, 'proposed', 0
  UNION ALL SELECT 'DOD-SM-ALL-ALL-000001', 'B0703', 'NNS UNITY',      19, NULL,             NULL, NULL, 'Special Requests', NULL, 0, 'proposed', 0
  UNION ALL SELECT 'DOD-SM-ALL-ALL-000001', 'B0704', 'NNS KADA',       14, NULL,             NULL, NULL, NULL, NULL, 0, 'proposed', 0
  UNION ALL SELECT 'DOD-ME-ALL-ALL-000001', 'B0711', 'NNS OKPABANA',   25, 'NNS CENTENARY',  'Deployment', NULL, NULL, NULL, 1, 'proposed', 0
  UNION ALL SELECT 'DOD-ME-ALL-ALL-000001', 'B0712', 'NNS CENTENARY',  18, 'NNS OKPABANA',   NULL, NULL, NULL, NULL, 1, 'proposed', 0
  UNION ALL SELECT 'DOD-ME-ALL-ALL-000001', 'B0713', 'NNS DELTA',      21, 'NNS PROSPERITY', NULL, 'Docking period', NULL, NULL, 1, 'proposed', 0
  UNION ALL SELECT 'DOD-LG-ALL-ALL-000001', 'B0714', 'NNS BEECROFT',   16, 'NNS JUBILEE',    NULL, NULL, NULL, NULL, 0, 'proposed', 0
  UNION ALL SELECT 'DOD-LG-ALL-ALL-000001', 'B0715', 'NNS PROSPERITY', 13, 'NNS BEECROFT',   NULL, NULL, 'Medical', NULL, 0, 'proposed', 0
  UNION ALL SELECT 'DOD-LG-ALL-ALL-000001', 'B0716', 'NNS JUBILEE',    30, NULL,             NULL, NULL, NULL, 'Medical board pending', 0, 'not_recommended', 0
  UNION ALL SELECT 'DOD-NP-ALL-ALL-000001', 'B0717', 'NNS QUORRA',     28, 'NNS BEECROFT',   NULL, NULL, NULL, NULL, 1, 'awaiting_wef', 0
  UNION ALL SELECT 'DOD-NP-ALL-ALL-000001', 'B0718', 'NNS DELTA',      20, 'NNS QUORRA',     'Vice PO OKORO', NULL, NULL, NULL, 1, 'awaiting_wef', 0
  UNION ALL SELECT 'DOD-WE-ALL-ALL-000001', 'B0719', 'NNS ARADU',      23, 'NNS VICTORY',    NULL, NULL, NULL, NULL, 1, 'reported', 10
  UNION ALL SELECT 'DOD-WE-ALL-ALL-000001', 'B0720', 'NNS THUNDER',    22, 'NNS ARADU',      NULL, NULL, NULL, NULL, 1, 'reported', 10
  UNION ALL SELECT 'DOD-WE-ALL-ALL-000001', 'B0721', 'NNS UNITY',      24, 'NNS THUNDER',    NULL, 'Refit crew', NULL, NULL, 1, 'scheduled', 0
  ) v
  JOIN batches b ON b.batch_number = v.bn
  JOIN ratings r ON r.service_number = v.sn
 WHERE NOT EXISTS (SELECT 1 FROM draft_rows d WHERE d.batch_id = b.id AND d.service_number = v.sn);

-- the reported rows point to the posting they opened
UPDATE draft_rows d
  JOIN batches b ON b.id = d.batch_id AND b.batch_number = 'DOD-WE-ALL-ALL-000001'
  JOIN rating_drafting p ON p.service_number = d.service_number AND p.ship_id = d.proposed_ship_id AND p.end_date IS NULL
   SET d.posting_id = p.id
 WHERE d.status = 'reported' AND d.posting_id IS NULL;

-- the scheduled move: NWACHUKWU to NNS THUNDER twenty days from today (the server makes it on that date)
INSERT INTO scheduled_changes (kind, service_number, effective_date, payload, status, source_table, source_id, scheduled_by, scheduled_at)
SELECT 'posting', d.service_number, d.wef,
       JSON_OBJECT('shipId', d.proposed_ship_id, 'authority', b.authority, 'remarks', ''),
       'scheduled', 'draft_rows', d.id, (SELECT id FROM users WHERE username = 'B0707'), DATE_SUB(NOW(), INTERVAL 9 DAY)
  FROM draft_rows d JOIN batches b ON b.id = d.batch_id
 WHERE b.batch_number = 'DOD-WE-ALL-ALL-000001' AND d.status = 'scheduled'
   AND NOT EXISTS (SELECT 1 FROM scheduled_changes c WHERE c.source_table = 'draft_rows' AND c.source_id = d.id);

UPDATE draft_rows d
  JOIN scheduled_changes c ON c.source_table = 'draft_rows' AND c.source_id = d.id AND c.status = 'scheduled'
   SET d.scheduled_change_id = c.id
 WHERE d.status = 'scheduled' AND d.scheduled_change_id IS NULL;
