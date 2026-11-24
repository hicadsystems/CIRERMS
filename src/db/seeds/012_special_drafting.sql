-- Special Drafting (WP11): the roles and their grants, two accounts, and demo data so every page has something:
-- special drafts not yet printed (one of each posting type, one with a WEF in the past and one well ahead), a
-- printed form whose ratings have moved, and a printed form with one move scheduled for a later date. Dates are
-- counted from the day the seed runs. Safe to rerun.
-- Demo accounts (password Admin@123, as HICO001), each belonging to a rating: B1101 (Special Drafting: proposes,
-- removes, uploads and reads the report), B1102 (Special Drafting Officer: also Print and Mark Printed).

-- ---- roles ----
INSERT IGNORE INTO roles (name, description, full_access) VALUES
  ('Special Drafting', 'Proposes and removes special drafts, uploads drafts and reads the Special Draft Report and its forms', 0),
  ('Special Drafting Officer', 'Everything Special Drafting does, and prints and marks drafts printed (the ratings move on their WEF)', 0);

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id FROM roles r JOIN privileges p ON (p.screen, p.action) IN (
       ('dashboard.home', 'view'), ('ratings.list', 'view'), ('ratings.edit', 'view'), ('ratings.my-details', 'view'),
       ('special-drafting.proposal', 'view'), ('special-drafting.proposal', 'add'), ('special-drafting.proposal', 'delete'),
       ('special-drafting.report', 'view'),
       ('special-drafting.upload', 'view'), ('special-drafting.upload', 'add'))
 WHERE r.name = 'Special Drafting';

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id FROM roles r JOIN privileges p ON (p.screen, p.action) IN (
       ('dashboard.home', 'view'), ('ratings.list', 'view'), ('ratings.edit', 'view'), ('ratings.my-details', 'view'),
       ('special-drafting.proposal', 'view'), ('special-drafting.proposal', 'add'), ('special-drafting.proposal', 'delete'),
       ('special-drafting.report', 'view'), ('special-drafting.report', 'edit'),
       ('special-drafting.upload', 'view'), ('special-drafting.upload', 'add'))
 WHERE r.name = 'Special Drafting Officer';

-- ---- demo ratings (every account belongs to one) ----
INSERT IGNORE INTO ratings (service_number, status, rate_id, surname, first_name, middle_name, gender_id, date_of_birth,
  branch_id, command_id, seniority_date, entry_mode_id, date_employed, specialisation_id)
SELECT v.sn, 'current', (SELECT id FROM ref_rate WHERE code = v.rate), v.sur, v.fst, v.mid,
       (SELECT id FROM ref_gender WHERE name = v.sex), v.dob,
       (SELECT id FROM ref_branch WHERE code = v.br), (SELECT id FROM ref_command WHERE name = 'Western Naval Command'),
       DATE_SUB(CURDATE(), INTERVAL v.mo MONTH),
       (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'), v.emp,
       (SELECT id FROM ref_specialisation WHERE code = v.spec)
  FROM (
            SELECT 'B1101' AS sn, 'PO' AS rate, 'IDOWU' AS sur, 'BOLANLE' AS fst, 'RUTH' AS mid, 'Female' AS sex, '1987-03-09' AS dob, 'SM' AS br, 'NAV' AS spec, 40 AS mo, '2009-05-18' AS emp
  UNION ALL SELECT 'B1102', 'CPO', 'MUSA',     'ABUBAKAR', 'SANI',     'Male',   '1981-10-21', 'ED', 'WRT', 60, '2002-02-11'
  UNION ALL SELECT 'B1111', 'AB',  'OSAGIE',   'EFOSA',    'PETER',    'Male',   '1993-06-14', 'SM', 'GUN', 26, '2014-04-07'
  UNION ALL SELECT 'B1112', 'LS',  'AKPAN',    'MFON',     'EMMANUEL', 'Male',   '1991-01-30', 'ME', 'MPR', 30, '2012-09-17'
  UNION ALL SELECT 'B1113', 'PO',  'BALOGUN',  'TUNDE',    'SEGUN',    'Male',   '1988-08-05', 'SM', 'NAV', 22, '2010-01-25'
  UNION ALL SELECT 'B1114', 'AB',  'OKORO',    'CHIOMA',   'JANET',    'Female', '1995-11-23', 'LG', 'STS', 18, '2016-06-13'
  UNION ALL SELECT 'B1115', 'LS',  'YAKUBU',   'DANJUMA',  'ISA',      'Male',   '1990-04-02', 'IT', 'ICT', 20, '2012-03-05'
  UNION ALL SELECT 'B1116', 'OS',  'EDET',     'ANIEKAN',  'BASSEY',   'Male',   '1998-12-16', 'LG', 'STS', 15, '2019-08-19'
  UNION ALL SELECT 'B1117', 'AB',  'NWANKWO',  'OBINNA',   'KELECHI',  'Male',   '1994-02-08', 'SM', 'GUN', 28, '2015-01-12'
  UNION ALL SELECT 'B1118', 'LS',  'TIJANI',   'RUKAYAT',  'AISHA',    'Female', '1992-07-27', 'LG', 'STS', 32, '2013-10-14'
  UNION ALL SELECT 'B1119', 'PO',  'AMADI',    'NGOZI',    'RITA',     'Female', '1989-09-12', 'ME', 'HMT', 24, '2011-05-23'
  UNION ALL SELECT 'B1120', 'AB',  'FASHOLA',  'KAYODE',   'WALE',     'Male',   '1995-05-19', 'SM', 'NAV', 21, '2016-11-07'
  UNION ALL SELECT 'B1121', 'AB',  'ONOJA',    'OJO',      'SUNDAY',   'Male',   '1996-03-03', 'SM', 'GUN', 14, '2017-07-24'
  UNION ALL SELECT 'B1122', 'LS',  'UKPONG',   'IDARA',    'GRACE',    'Female', '1993-10-29', 'LG', 'STS', 17, '2014-12-01'
  UNION ALL SELECT 'B1123', 'PO',  'WADA',     'SHEHU',    'HARUNA',   'Male',   '1986-01-17', 'ME', 'MPR', 36, '2008-02-18'
  ) v;

INSERT IGNORE INTO users (username, password_hash, role_id, service_number, email, phone, specialisation_id, is_active) VALUES
  ('B1101', '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', (SELECT id FROM roles WHERE name = 'Special Drafting'), 'B1101', 'b.idowu@navy.mil.ng', '08031119901', NULL, 1),
  ('B1102', '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', (SELECT id FROM roles WHERE name = 'Special Drafting Officer'), 'B1102', 'a.musa@navy.mil.ng', '08031119902', NULL, 1);

-- ---- postings: each rating on its current ship (the open posting), for the months shown ----
INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT v.sn, (SELECT id FROM ref_ship WHERE name = v.ship), r.rate_id, DATE_SUB(CURDATE(), INTERVAL v.mo MONTH), NULL, v.note
  FROM (
            SELECT 'B1101' AS sn, 'NHQ ABUJA' AS ship, 40 AS mo, 'Drafting office' AS note
  UNION ALL SELECT 'B1102', 'NHQ ABUJA',      60, 'Drafting office'
  UNION ALL SELECT 'B1111', 'NNS THUNDER',    26, 'Gunnery'
  UNION ALL SELECT 'B1112', 'NNS ARADU',      30, 'Engine room'
  UNION ALL SELECT 'B1113', 'NNS UNITY',      22, 'Navigation'
  UNION ALL SELECT 'B1114', 'NNS DELTA',      18, 'Stores'
  UNION ALL SELECT 'B1115', 'NNS QUORRA',     20, 'Communications'
  UNION ALL SELECT 'B1116', 'NNS BEECROFT',   15, 'Stores'
  UNION ALL SELECT 'B1120', 'NNS OKPABANA',   21, 'Navigation'
  UNION ALL SELECT 'B1121', 'NNS KADA',       14, 'Gunnery'
  UNION ALL SELECT 'B1122', 'NNS PROSPERITY', 17, 'Stores'
  UNION ALL SELECT 'B1123', 'NNS CENTENARY',  36, 'Engine room'
  ) v
  JOIN ratings r ON r.service_number = v.sn
 WHERE NOT EXISTS (SELECT 1 FROM rating_drafting d WHERE d.service_number = v.sn);

-- the ratings of the printed forms who have moved: the posting before the draft (ended the day before the WEF)
-- and the new one from the WEF. A WEF is counted back from today (wef_ago days).
INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT v.sn, (SELECT id FROM ref_ship WHERE name = v.ship), r.rate_id,
       IF(v.old = 1, DATE_SUB(DATE_SUB(CURDATE(), INTERVAL v.wef_ago DAY), INTERVAL v.mo MONTH), DATE_SUB(CURDATE(), INTERVAL v.wef_ago DAY)),
       IF(v.old = 1, DATE_SUB(CURDATE(), INTERVAL v.wef_ago + 1 DAY), NULL), v.note
  FROM (
            SELECT 'B1117' AS sn, 'NNS JUBILEE' AS ship, 1 AS old, 28 AS mo, 12 AS wef_ago, 'Gunnery' AS note
  UNION ALL SELECT 'B1117', 'NNS VICTORY',   0, 0,  12, 'Drafted under NHQ/NP/SDR/041/2026'
  UNION ALL SELECT 'B1118', 'NNS PATHFINDER', 1, 32, 11, 'Stores'
  UNION ALL SELECT 'B1118', 'NNS DELTA',     0, 0,  11, 'Drafted under NHQ/NP/SDR/042/2026'
  UNION ALL SELECT 'B1119', 'NNS ARADU',     1, 24, 3,  'Engine room'
  UNION ALL SELECT 'B1119', 'NNS CENTENARY', 0, 0,  3,  'Drafted under NHQ/NP/SDR/047/2026 · Vice PO ADELEKE'
  ) v
  JOIN ratings r ON r.service_number = v.sn
 WHERE NOT EXISTS (SELECT 1 FROM rating_drafting d WHERE d.service_number = v.sn);

-- the scheduled mover B1120 stays on NNS OKPABANA (inserted above) until his WEF

-- ---- the printed forms (SDF-YYYY-NNNN, counted per year) ----
INSERT INTO special_draft_forms (form_number, form_year, form_seq, posting_type, draft_count, printed_by, printed_at)
SELECT CONCAT('SDF-', YEAR(CURDATE()), '-', LPAD(v.seq, 4, '0')), YEAR(CURDATE()), v.seq, v.type, v.n,
       (SELECT id FROM users WHERE username = 'B1102'), DATE_SUB(NOW(), INTERVAL v.ago DAY)
  FROM (
            SELECT 1 AS seq, 'Complement' AS type, 2 AS n, 12 AS ago
  UNION ALL SELECT 2, 'Vice', 2, 3
  ) v
 WHERE NOT EXISTS (SELECT 1 FROM special_draft_forms f WHERE f.form_year = YEAR(CURDATE()) AND f.form_seq = v.seq);

-- ---- the special drafts ----
-- cur: the ship the rating was on; to: Drafted To; wef_off: the WEF in days from today (negative: in the past)
INSERT INTO special_drafts (service_number, rate_id, current_ship_id, joined_on, months_on_ship, ship_id, authority, wef, posting_type, vice, remark,
                            status, source, form_id, created_by, created_at)
SELECT v.sn, r.rate_id, (SELECT id FROM ref_ship WHERE name = v.cur), DATE_SUB(DATE_ADD(CURDATE(), INTERVAL v.wef_off DAY), INTERVAL v.mo MONTH), v.mo,
       (SELECT id FROM ref_ship WHERE name = v.dest), v.auth, DATE_ADD(CURDATE(), INTERVAL v.wef_off DAY), v.type, v.vice, v.remark,
       v.st, 'proposal', (SELECT f.id FROM special_draft_forms f WHERE f.form_year = YEAR(CURDATE()) AND f.form_seq = v.form_seq),
       (SELECT id FROM users WHERE username = 'B1101'), DATE_SUB(NOW(), INTERVAL v.created_ago DAY)
  FROM (
            SELECT 'B1111' AS sn, 'NNS THUNDER' AS cur, 26 AS mo, 'NNS PATHFINDER' AS dest, 'NHQ/NP/SDR/051/2026' AS auth, 5 AS wef_off, 'Complement' AS type, NULL AS vice, 'Gunnery course instructor' AS remark, 'unprinted' AS st, NULL AS form_seq, 2 AS created_ago
  UNION ALL SELECT 'B1112', 'NNS ARADU',      30, 'NNS VICTORY',          'NHQ/NP/SDR/052/2026', -3,  'Complement', NULL,               NULL,                       'unprinted', NULL, 2
  UNION ALL SELECT 'B1113', 'NNS UNITY',      22, 'NNS KADA',             'NHQ/NP/SDR/053/2026', 7,   'Vice',       'Vice AB BALOGUN',  'Replaces a casualty',       'unprinted', NULL, 1
  UNION ALL SELECT 'B1114', 'NNS DELTA',      18, 'NNS JUBILEE',          'NHQ/NP/SDR/054/2026', 40,  'Vice',       'Deployment',       'Rotation of the fleet',     'unprinted', NULL, 1
  UNION ALL SELECT 'B1115', 'NNS QUORRA',     20, 'NHQ ABUJA',            'NHQ/NP/SDR/055/2026', 3,   'TY',         NULL,               NULL,                       'unprinted', NULL, 1
  UNION ALL SELECT 'B1116', 'NNS BEECROFT',   15, 'NAVTRAC EBUTE-ERO',    'NHQ/NP/SDR/056/2026', 10,  'DW',         NULL,               'Instructor attachment',     'unprinted', NULL, 0
  UNION ALL SELECT 'B1117', 'NNS JUBILEE',    28, 'NNS VICTORY',          'NHQ/NP/SDR/041/2026', -12, 'Complement', NULL,               NULL,                       'moved',     1,    14
  UNION ALL SELECT 'B1118', 'NNS PATHFINDER', 32, 'NNS DELTA',            'NHQ/NP/SDR/042/2026', -11, 'Complement', NULL,               'Docking period',            'moved',     1,    14
  UNION ALL SELECT 'B1119', 'NNS ARADU',      24, 'NNS CENTENARY',        'NHQ/NP/SDR/047/2026', -3,  'Vice',       'Vice PO ADELEKE',  NULL,                       'moved',     2,    5
  UNION ALL SELECT 'B1120', 'NNS OKPABANA',   21, 'NNS PROSPERITY',       'NHQ/NP/SDR/048/2026', 18,  'Vice',       'Vice LS UGWU',     'Posted on his return',      'scheduled', 2,    5
  ) v
  JOIN ratings r ON r.service_number = v.sn
 WHERE NOT EXISTS (SELECT 1 FROM special_drafts d WHERE d.service_number = v.sn);

-- the moved drafts point to the posting they opened
UPDATE special_drafts d
  JOIN rating_drafting p ON p.service_number = d.service_number AND p.ship_id = d.ship_id AND p.start_date = d.wef
   SET d.posting_id = p.id
 WHERE d.status = 'moved' AND d.posting_id IS NULL;

-- the scheduled move: B1120 to NNS PROSPERITY eighteen days from today (the server makes it on that date)
INSERT INTO scheduled_changes (kind, service_number, effective_date, payload, status, source_table, source_id, scheduled_by, scheduled_at)
SELECT 'posting', d.service_number, d.wef,
       JSON_OBJECT('shipId', d.ship_id, 'authority', d.authority, 'remarks', ''),
       'scheduled', 'special_drafts', d.id, (SELECT id FROM users WHERE username = 'B1102'), DATE_SUB(NOW(), INTERVAL 3 DAY)
  FROM special_drafts d
 WHERE d.status = 'scheduled' AND d.service_number = 'B1120'
   AND NOT EXISTS (SELECT 1 FROM scheduled_changes c WHERE c.source_table = 'special_drafts' AND c.source_id = d.id);

UPDATE special_drafts d
  JOIN scheduled_changes c ON c.source_table = 'special_drafts' AND c.source_id = d.id AND c.status = 'scheduled'
   SET d.scheduled_change_id = c.id
 WHERE d.status = 'scheduled' AND d.scheduled_change_id IS NULL;
