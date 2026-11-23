-- Reports (WP9): the old role "Report", its account, and demo ratings so Retirement Forecast has something to show.
-- Reports are read-only, so view is the only action. Dates are counted from the day the seed runs. Safe to rerun.
-- Demo account (password Admin@123, as HICO001), belonging to a rating: B1301 (Report).

INSERT IGNORE INTO roles (name, description, full_access) VALUES
  ('Report', 'The old Report role: the six report pages (Ship History, All Personnel, Disposition, Nominal Roll, Manning State, Retirement Forecast)', 0);

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id FROM roles r JOIN privileges p ON (p.screen, p.action) IN (
  ('dashboard.home', 'view'), ('ratings.list', 'view'), ('ratings.edit', 'view'), ('ratings.my-details', 'view'),
  ('reports.ship-history', 'view'), ('reports.all-personnel', 'view'), ('reports.disposition', 'view'),
  ('reports.nominal-roll', 'view'), ('reports.manning-state', 'view'), ('reports.retirement-forecast', 'view'))
 WHERE r.name = 'Report';

-- ---- demo ratings: the Report officer (B1301), and ratings that become due for discharge over the next two years
-- (B1302 to B1309: by age, by years of service, and one by both on the same day), under the placeholder rule of
-- 50 years of age or 20 years of service; the ones due by age joined late enough to have under 20 years' service ----
INSERT IGNORE INTO ratings (service_number, status, rate_id, surname, first_name, middle_name, gender_id, date_of_birth,
  branch_id, command_id, seniority_date, entry_mode_id, date_employed, specialisation_id)
SELECT v.sn, 'current', (SELECT id FROM ref_rate WHERE code = v.rate), v.sur, v.fst, v.mid,
       (SELECT id FROM ref_gender WHERE name = v.sex), v.dob,
       (SELECT id FROM ref_branch WHERE code = v.br), (SELECT id FROM ref_command WHERE name = v.cmd),
       v.sen, (SELECT id FROM ref_entry_mode WHERE name = v.entry), v.emp,
       (SELECT id FROM ref_specialisation WHERE code = v.spec)
  FROM (
            SELECT 'B1301' AS sn, 'CPO' AS rate, 'OKEKE' AS sur, 'Ngozi' AS fst, 'Amaka' AS mid, 'Female' AS sex, '1985-06-14' AS dob, 'ED' AS br, 'Western Naval Command' AS cmd, 'WRT' AS spec, '2024-01-01' AS sen, '2008-03-10' AS emp, 'Regular Recruitment' AS entry
  UNION ALL SELECT 'B1302', 'PO',  'ADEWALE',  'Kunle',    'Tunde',    'Male',   DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 2 MONTH),  INTERVAL 50 YEAR), 'SM', 'Western Naval Command', 'NAV', '2023-06-01', '2008-05-02', 'Regular Recruitment'
  UNION ALL SELECT 'B1303', 'CPO', 'EZEKWE',   'Ikenna',   'Paul',     'Male',   DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 4 MONTH),  INTERVAL 50 YEAR), 'ME', 'Eastern Naval Command', 'MPR', '2022-09-01', '2008-08-11', 'Regular Recruitment'
  UNION ALL SELECT 'B1304', 'PO',  'GARBA',    'Hassan',   'Umar',     'Male',   DATE_SUB(CURDATE(), INTERVAL 41 YEAR), 'NP', 'Western Naval Command', 'REG', '2023-03-01', DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 5 MONTH),  INTERVAL 20 YEAR), 'Regular Recruitment'
  UNION ALL SELECT 'B1305', 'LS',  'OLATUNJI', 'Bimpe',    'Ronke',    'Female', DATE_SUB(CURDATE(), INTERVAL 40 YEAR), 'ED', 'Central Naval Command', 'WRT', '2024-02-01', DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 8 MONTH),  INTERVAL 20 YEAR), 'Regular Recruitment'
  UNION ALL SELECT 'B1306', 'WO',  'NWOSU',    'Chidi',    'Martin',   'Male',   DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 11 MONTH), INTERVAL 50 YEAR), 'WE', 'Naval Headquarters', 'EWS', '2021-12-01', '2009-02-20', 'Direct Intake'
  UNION ALL SELECT 'B1307', 'AB',  'YUSUF',    'Zainab',   'Halima',   'Female', DATE_SUB(CURDATE(), INTERVAL 39 YEAR), 'MD', 'Eastern Naval Command', 'MAS', '2024-05-01', DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 14 MONTH), INTERVAL 20 YEAR), 'Regular Recruitment'
  UNION ALL SELECT 'B1308', 'CPO', 'ODION',    'Efe',      'Samuel',   'Male',   DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 19 MONTH), INTERVAL 50 YEAR), 'LG', 'Western Naval Command', 'STS', '2022-03-01', '2010-07-15', 'Regular Recruitment'
  UNION ALL SELECT 'B1309', 'PO',  'BASSEY',   'Ekong',    'Emmanuel', 'Male',   DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 23 MONTH), INTERVAL 50 YEAR), 'SM', 'Central Naval Command', 'GUN', '2023-09-01', DATE_SUB(DATE_ADD(CURDATE(), INTERVAL 23 MONTH), INTERVAL 20 YEAR), 'Regular Recruitment'
  ) v;

INSERT IGNORE INTO users (username, password_hash, role_id, service_number, email, phone, is_active) VALUES
  ('B1301', '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', (SELECT id FROM roles WHERE name = 'Report'), 'B1301', 'n.okeke@navy.mil.ng', '08031112831', 1);

-- postings: each serves on a ship or unit, so the Nominal Roll and Manning State have them
INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT v.sn, (SELECT id FROM ref_ship WHERE name = v.ship), r.rate_id, v.start_on, NULL, v.note
  FROM (
            SELECT 'B1301' AS sn, 'NNS ARADU' AS ship, DATE_SUB(CURDATE(), INTERVAL 9 MONTH) AS start_on, 'Ship''s office' AS note
  UNION ALL SELECT 'B1302', 'NNS ARADU',      DATE_SUB(CURDATE(), INTERVAL 15 MONTH), 'Navigating team'
  UNION ALL SELECT 'B1303', 'NNS OKPABANA',   DATE_SUB(CURDATE(), INTERVAL 20 MONTH), 'Engine room'
  UNION ALL SELECT 'B1304', 'NNS THUNDER',    DATE_SUB(CURDATE(), INTERVAL 6 MONTH),  'Provost'
  UNION ALL SELECT 'B1305', 'NNS CENTENARY',  DATE_SUB(CURDATE(), INTERVAL 11 MONTH), 'Ship''s office'
  UNION ALL SELECT 'B1306', 'NHQ ABUJA',      DATE_SUB(CURDATE(), INTERVAL 30 MONTH), 'Weapons maintenance'
  UNION ALL SELECT 'B1307', 'NNS KADA',       DATE_SUB(CURDATE(), INTERVAL 4 MONTH),  'Stores'
  UNION ALL SELECT 'B1308', 'NNS BEECROFT',   DATE_SUB(CURDATE(), INTERVAL 26 MONTH), 'Stores'
  UNION ALL SELECT 'B1309', 'NNS VICTORY',    DATE_SUB(CURDATE(), INTERVAL 13 MONTH), 'Gunnery'
  ) v
  JOIN ratings r ON r.service_number = v.sn
 WHERE NOT EXISTS (SELECT 1 FROM rating_drafting d WHERE d.service_number = v.sn AND d.ship_id = (SELECT id FROM ref_ship WHERE name = v.ship));
