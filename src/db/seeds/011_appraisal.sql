-- Naval Character Assessment (WP12): the roles and their grants, two accounts, and demo data so every page has
-- something: four appraisal periods (three closed, one open), appraisals in each (grades from the Appraisal Ratings
-- table), one appraisal that was edited (with its change in the audit trail) and one that was cancelled, and ratings
-- still to be appraised in the open period. Safe to rerun.
-- Demo accounts (password Admin@123, as HICO001), each belonging to a rating: B1201 (Naval Assessment: records,
-- edits and reads, cannot cancel or manage periods), B1202 (Naval Assessment Officer: also cancels appraisals and
-- adds, edits and closes periods).

-- ---- roles ----
INSERT IGNORE INTO roles (name, description, full_access) VALUES
  ('Naval Assessment', 'Initiates and edits appraisals and reads the Report on Appraisal and the Appraisal Periods', 0),
  ('Naval Assessment Officer', 'Everything Naval Assessment does, and cancels appraisals and adds, edits and closes appraisal periods', 0);

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id FROM roles r JOIN privileges p ON (p.screen, p.action) IN (
       ('dashboard.home', 'view'), ('ratings.list', 'view'), ('ratings.edit', 'view'), ('ratings.my-details', 'view'),
       ('appraisal.periods', 'view'),
       ('appraisal.grading', 'view'), ('appraisal.grading', 'add'), ('appraisal.grading', 'edit'),
       ('appraisal.report', 'view'))
 WHERE r.name = 'Naval Assessment';

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id FROM roles r JOIN privileges p ON (p.screen, p.action) IN (
       ('dashboard.home', 'view'), ('ratings.list', 'view'), ('ratings.edit', 'view'), ('ratings.my-details', 'view'),
       ('appraisal.periods', 'view'), ('appraisal.periods', 'add'), ('appraisal.periods', 'edit'),
       ('appraisal.grading', 'view'), ('appraisal.grading', 'add'), ('appraisal.grading', 'edit'), ('appraisal.grading', 'delete'),
       ('appraisal.report', 'view'))
 WHERE r.name = 'Naval Assessment Officer';

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
            SELECT 'B1201' AS sn, 'PO' AS rate, 'ADEBAYO' AS sur, 'Funmilayo' AS fst, 'Esther' AS mid, 'Female' AS sex, '1988-02-14' AS dob, 'SM' AS br, 'NAV' AS spec, 44 AS mo, '2009-03-16' AS emp
  UNION ALL SELECT 'B1202', 'CPO', 'EZEKIEL',  'Samuel',   'Dauda',    'Male',   '1982-09-03', 'ED', 'WRT', 62, '2003-07-21'
  UNION ALL SELECT 'B1211', 'AB',  'OGUNLEYE', 'Femi',     'Tobi',     'Male',   '1994-05-11', 'SM', 'GUN', 30, '2015-02-09'
  UNION ALL SELECT 'B1212', 'LS',  'UMAR',     'Hadiza',   'Aisha',    'Female', '1992-12-01', 'LG', 'STS', 34, '2013-06-24'
  UNION ALL SELECT 'B1213', 'PO',  'NNAJI',    'Chidi',    'Emeka',    'Male',   '1987-07-19', 'ME', 'MPR', 52, '2008-10-13'
  UNION ALL SELECT 'B1214', 'AB',  'BASSEY',   'Iniobong', 'Effiong',  'Male',   '1996-01-28', 'SM', 'NAV', 20, '2017-05-15'
  UNION ALL SELECT 'B1215', 'LS',  'LAWAL',    'Sulaimon', 'Kunle',    'Male',   '1991-03-30', 'IT', 'ICT', 38, '2012-09-03'
  UNION ALL SELECT 'B1216', 'OS',  'EZE',      'Chinedu',  'Paul',     'Male',   '1998-10-06', 'LG', 'STS', 16, '2019-04-22'
  UNION ALL SELECT 'B1217', 'AB',  'OKAFOR',   'Nkechi',   'Joy',      'Female', '1995-08-17', 'SM', 'GUN', 26, '2016-01-18'
  UNION ALL SELECT 'B1218', 'LS',  'SALIU',    'Ramat',    'Zainab',   'Female', '1993-04-09', 'LG', 'STS', 40, '2012-11-26'
  UNION ALL SELECT 'B1219', 'PO',  'OGBU',     'Uche',     'Martins',  'Male',   '1989-06-23', 'ME', 'HMT', 46, '2010-02-08'
  UNION ALL SELECT 'B1220', 'AB',  'AJAYI',    'Seun',     'Timothy',  'Male',   '1997-02-12', 'SM', 'NAV', 18, '2018-08-27'
  UNION ALL SELECT 'B1221', 'AB',  'ITA',      'Ekemini',  'Udo',       'Male',   '1996-11-04', 'SM', 'GUN', 22, '2017-03-13'
  UNION ALL SELECT 'B1222', 'LS',  'MOHAMMED', 'Binta',    'Hauwa',    'Female', '1992-05-26', 'LG', 'STS', 33, '2014-01-20'
  UNION ALL SELECT 'B1223', 'PO',  'AGU',      'Ifeanyi',  'Charles',  'Male',   '1986-09-15', 'ME', 'MPR', 58, '2007-06-04'
  UNION ALL SELECT 'B1224', 'AB',  'ADELEKE',  'Kayode',   'Dare',     'Male',   '1995-12-22', 'IT', 'ICT', 24, '2016-10-10'
  ) v;

INSERT IGNORE INTO users (username, password_hash, role_id, service_number, email, phone, specialisation_id, is_active) VALUES
  ('B1201', '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', (SELECT id FROM roles WHERE name = 'Naval Assessment'), 'B1201', 'f.adebayo@navy.mil.ng', '08031120101', NULL, 1),
  ('B1202', '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', (SELECT id FROM roles WHERE name = 'Naval Assessment Officer'), 'B1202', 's.ezekiel@navy.mil.ng', '08031120102', NULL, 1);

-- ---- postings: each rating on a ship (the open posting), so the ship at the time of an appraisal is known ----
INSERT INTO rating_drafting (service_number, ship_id, rate_id, start_date, end_date, remarks)
SELECT v.sn, (SELECT id FROM ref_ship WHERE name = v.ship), r.rate_id, DATE_SUB(CURDATE(), INTERVAL v.mo MONTH), NULL, v.note
  FROM (
            SELECT 'B1201' AS sn, 'NHQ ABUJA' AS ship, 44 AS mo, 'Personnel office' AS note
  UNION ALL SELECT 'B1202', 'NHQ ABUJA',      62, 'Personnel office'
  UNION ALL SELECT 'B1211', 'NNS THUNDER',    14, 'Gunnery'
  UNION ALL SELECT 'B1212', 'NNS DELTA',      16, 'Stores'
  UNION ALL SELECT 'B1213', 'NNS ARADU',      20, 'Engine room'
  UNION ALL SELECT 'B1214', 'NNS UNITY',      12, 'Navigation'
  UNION ALL SELECT 'B1215', 'NNS QUORRA',     18, 'Communications'
  UNION ALL SELECT 'B1216', 'NNS BEECROFT',   10, 'Stores'
  UNION ALL SELECT 'B1217', 'NNS VICTORY',    15, 'Gunnery'
  UNION ALL SELECT 'B1218', 'NNS PATHFINDER', 22, 'Stores'
  UNION ALL SELECT 'B1219', 'NNS CENTENARY',  19, 'Engine room'
  UNION ALL SELECT 'B1220', 'NNS OKPABANA',   11, 'Navigation'
  UNION ALL SELECT 'B1221', 'NNS KADA',       13, 'Gunnery'
  UNION ALL SELECT 'B1222', 'NNS PROSPERITY', 17, 'Stores'
  UNION ALL SELECT 'B1223', 'NNS JUBILEE',    21, 'Engine room'
  UNION ALL SELECT 'B1224', 'NNS THUNDER',     9, 'Communications'
  ) v
  JOIN ratings r ON r.service_number = v.sn
 WHERE NOT EXISTS (SELECT 1 FROM rating_drafting d WHERE d.service_number = v.sn);

-- ---- the periods: three closed, the current half-year open ----
INSERT IGNORE INTO appraisal_periods (name, start_date, end_date, status, closed_at, closed_by) VALUES
  ('2025 First Half',  '2025-01-01', '2025-06-30', 'closed', '2025-07-11 09:30:00', (SELECT id FROM users WHERE username = 'B1202')),
  ('2025 Second Half', '2025-07-01', '2025-12-31', 'closed', '2026-01-12 10:05:00', (SELECT id FROM users WHERE username = 'B1202')),
  ('2026 First Half',  '2026-01-01', '2026-06-30', 'closed', '2026-07-10 11:15:00', (SELECT id FROM users WHERE username = 'B1202')),
  ('2026 Second Half', '2026-07-01', '2026-12-31', 'open', NULL, NULL);

-- ---- the appraisals ----
-- n numbers the ratings 1 to 14 (B1211 to B1224), k the period (1 oldest to 4 the open one). The grades, remarks,
-- COs and directors follow fixed patterns, so the demo has every grade. A closed period misses some ratings (they
-- joined late or were on course); the open period holds the first ten, and the last four are still to be appraised.
-- B1213 and the cancelled B1224 are made below.
INSERT INTO appraisals (period_id, service_number, rate_id, ship_id, character_grade_id, efficiency_grade_id, remark, co_name,
                        director_name, director_date, status, active_slot, created_at, created_by)
SELECT p.id, r.service_number, r.rate_id,
       (SELECT id FROM ref_ship WHERE name = IF(t.k <= 2, v.ship_before, v.ship_now)),
       (SELECT id FROM ref_appraisal_rating WHERE code = SUBSTRING('ABBCABCDBCEBCAD', 1 + MOD(v.n * 7 + t.k * 3, 15), 1)),
       (SELECT id FROM ref_appraisal_rating WHERE code = SUBSTRING('BACBCBDCABCEBCB', 1 + MOD(v.n * 7 + t.k * 3 + v.n, 15), 1)),
       NULLIF(ELT(1 + MOD(v.n + t.k, 8),
         'Reliable and well turned out. Leads the watch with confidence.',
         'Sound technical knowledge; should be given more responsibility.',
         'Good team member who needs closer supervision on paperwork.',
         'Outstanding performance during the fleet exercise.',
         'Meets the standard. Punctuality has improved this period.',
         'Shows initiative and sets a good example to junior ratings.',
         'Capable but inconsistent; counselled on timekeeping.',
         ''), ''),
       ELT(1 + MOD(v.n + t.k, 6), 'CDR A. DANJUMA', 'CAPT O. ADEWALE', 'CDR I. OKEKE', 'CAPT S. BASSEY', 'CDR T. LAWAL', 'LT CDR E. NWACHUKWU'),
       IF(t.k = 4 AND MOD(v.n, 4) = 3, NULL, ELT(1 + MOD(v.n + t.k, 2), 'CDR IBRAHIM DANLADI', 'CAPT NGOZI EZE')),
       IF(t.k = 4, IF(MOD(v.n, 4) = 3, NULL, DATE_SUB(CURDATE(), INTERVAL 2 + v.n DAY)), DATE_ADD(p.end_date, INTERVAL 20 + MOD(v.n * 3, 9) DAY)),
       'active', 1,
       IF(t.k = 4, DATE_SUB(NOW(), INTERVAL v.n - 1 DAY), DATE_ADD(p.end_date, INTERVAL 12 + MOD(v.n * 3, 9) DAY)),
       (SELECT id FROM users WHERE username = 'B1201')
  FROM (
            SELECT 1 AS n, 'B1211' AS sn, 'NNS JUBILEE' AS ship_before, 'NNS THUNDER' AS ship_now
  UNION ALL SELECT 2,  'B1212', 'NNS PATHFINDER', 'NNS DELTA'
  UNION ALL SELECT 3,  'B1213', 'NNS CENTENARY',  'NNS ARADU'
  UNION ALL SELECT 4,  'B1214', 'NNS KADA',       'NNS UNITY'
  UNION ALL SELECT 5,  'B1215', 'NNS DELTA',      'NNS QUORRA'
  UNION ALL SELECT 6,  'B1216', 'NNS UNITY',      'NNS BEECROFT'
  UNION ALL SELECT 7,  'B1217', 'NNS THUNDER',    'NNS VICTORY'
  UNION ALL SELECT 8,  'B1218', 'NNS ARADU',      'NNS PATHFINDER'
  UNION ALL SELECT 9,  'B1219', 'NNS OKPABANA',   'NNS CENTENARY'
  UNION ALL SELECT 10, 'B1220', 'NNS QUORRA',     'NNS OKPABANA'
  UNION ALL SELECT 11, 'B1221', 'NNS VICTORY',    'NNS KADA'
  UNION ALL SELECT 12, 'B1222', 'NNS BEECROFT',   'NNS PROSPERITY'
  UNION ALL SELECT 13, 'B1223', 'NNS PROSPERITY', 'NNS JUBILEE'
  UNION ALL SELECT 14, 'B1224', 'NNS JUBILEE',    'NNS THUNDER'
  ) v
  JOIN ratings r ON r.service_number = v.sn
  JOIN (SELECT 1 AS k, '2025 First Half' AS pname UNION ALL SELECT 2, '2025 Second Half'
        UNION ALL SELECT 3, '2026 First Half' UNION ALL SELECT 4, '2026 Second Half') t
  JOIN appraisal_periods p ON p.name = t.pname
 WHERE ((t.k < 4 AND MOD(v.n + t.k, 5) <> 0) OR (t.k = 4 AND v.n <= 10))
   AND NOT EXISTS (SELECT 1 FROM appraisals x WHERE x.period_id = p.id AND x.service_number = r.service_number);

-- the cancelled appraisal: entered against B1224 by mistake in the open period (B1224 can be appraised again)
INSERT INTO appraisals (period_id, service_number, rate_id, ship_id, character_grade_id, efficiency_grade_id, remark, co_name,
                        status, active_slot, cancelled_reason, cancelled_at, cancelled_by, created_at, created_by)
SELECT p.id, r.service_number, r.rate_id, (SELECT id FROM ref_ship WHERE name = 'NNS THUNDER'),
       (SELECT id FROM ref_appraisal_rating WHERE code = 'D'), (SELECT id FROM ref_appraisal_rating WHERE code = 'D'),
       'Entered against the wrong rating.', 'CDR A. DANJUMA',
       'cancelled', NULL, 'Entered against the wrong rating; recorded again under the correct Official No.',
       DATE_SUB(NOW(), INTERVAL 5 DAY), (SELECT id FROM users WHERE username = 'B1202'), DATE_SUB(NOW(), INTERVAL 6 DAY), (SELECT id FROM users WHERE username = 'B1201')
  FROM ratings r JOIN appraisal_periods p ON p.name = '2026 Second Half'
 WHERE r.service_number = 'B1224'
   AND NOT EXISTS (SELECT 1 FROM appraisals x WHERE x.period_id = p.id AND x.service_number = r.service_number);

-- the audit trail of the demo: the cancel, and the edit of B1213's Efficiency grade in the open period
INSERT INTO audit_trail (created_at, user_id, username, action, table_name, record_id, changes, ip_address)
SELECT a.cancelled_at, a.cancelled_by, 'B1202', 'UPDATE', 'appraisals', CONCAT(a.service_number, ':', a.id),
       JSON_ARRAY(JSON_OBJECT('field', 'Status', 'from', 'active', 'to', 'cancelled'), JSON_OBJECT('field', 'Reason', 'from', NULL, 'to', a.cancelled_reason)),
       '127.0.0.1'
  FROM appraisals a JOIN appraisal_periods p ON p.id = a.period_id AND p.name = '2026 Second Half'
 WHERE a.service_number = 'B1224' AND a.status = 'cancelled'
   AND NOT EXISTS (SELECT 1 FROM audit_trail t WHERE t.table_name = 'appraisals' AND t.record_id = CONCAT(a.service_number, ':', a.id));

INSERT INTO audit_trail (created_at, user_id, username, action, table_name, record_id, changes, ip_address)
SELECT DATE_SUB(NOW(), INTERVAL 2 DAY), (SELECT id FROM users WHERE username = 'B1201'), 'B1201', 'UPDATE', 'appraisals', CONCAT(a.service_number, ':', a.id),
       JSON_ARRAY(JSON_OBJECT('field', 'Efficiency Grade', 'from', 'C - Good', 'to', CONCAT(g.code, ' - ', g.name))),
       '127.0.0.1'
  FROM appraisals a
  JOIN appraisal_periods p ON p.id = a.period_id AND p.name = '2026 Second Half'
  JOIN ref_appraisal_rating g ON g.id = a.efficiency_grade_id
 WHERE a.service_number = 'B1213' AND a.status = 'active' AND g.code <> 'C'
   AND NOT EXISTS (SELECT 1 FROM audit_trail t WHERE t.table_name = 'appraisals' AND t.record_id = CONCAT(a.service_number, ':', a.id));
