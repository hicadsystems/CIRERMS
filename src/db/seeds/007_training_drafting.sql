-- Training Drafting (WP6): demo batches for every page (two open, two closed with their history confirmed),
-- the old role "Training" with every privilege of the module, and a role that may only view the batches
-- and the reports (for the walkthrough). Safe to rerun.
-- Demo accounts (password Admin@123, as HICO001), each belonging to a rating: user names are the official numbers:
-- B0901 (Training), B0902 (Training Viewer). Each has a rating of its own, made below.

INSERT IGNORE INTO roles (name, description, full_access) VALUES
  ('Training', 'The old Training role: process batches, review them, update the history, the reports and the Excel upload', 0),
  ('Training Viewer', 'May view the open batches and the reports, but cannot change a batch', 0);

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id FROM roles r JOIN privileges p ON p.screen LIKE 'training.%'
 WHERE r.name = 'Training';

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id FROM roles r JOIN privileges p
    ON (p.screen IN ('training.process', 'training.review', 'training.history', 'training.reports') AND p.action = 'view')
 WHERE r.name = 'Training Viewer';

-- the two ratings the accounts belong to (every account belongs to a rating)
INSERT IGNORE INTO ratings (service_number, status, rate_id, surname, first_name, middle_name, gender_id, date_of_birth,
  branch_id, command_id, seniority_date, entry_mode_id, date_employed, specialisation_id)
SELECT v.sn, 'current', (SELECT id FROM ref_rate WHERE code = v.rate), v.sur, v.fst, v.mid,
       (SELECT id FROM ref_gender WHERE name = v.sex), v.dob,
       (SELECT id FROM ref_branch WHERE code = v.br), (SELECT id FROM ref_command WHERE name = 'Western Naval Command'),
       v.sen, (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'), v.emp,
       (SELECT id FROM ref_specialisation WHERE code = v.spec)
  FROM (
            SELECT 'B0901' AS sn, 'PO' AS rate, 'AKPAN' AS sur, 'MFON' AS fst, 'ETIM' AS mid, 'Female' AS sex, '1988-04-12' AS dob, 'ED' AS br, 'WRT' AS spec, '2020-06-01' AS sen, '2008-03-10' AS emp
  UNION ALL SELECT 'B0902', 'LS', 'UDOH', 'EKAETTE', 'GRACE', 'Female', '1993-09-27', 'ED', 'WRT', '2021-08-01', '2014-05-19'
  ) v;

INSERT IGNORE INTO users (username, password_hash, full_name, role_id, service_number, is_active)
SELECT r.service_number, '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', CONCAT_WS(' ', r.first_name, r.surname),
       (SELECT id FROM roles WHERE name = 'Training'), r.service_number, 1
  FROM ratings r WHERE r.service_number = 'B0901';

INSERT IGNORE INTO users (username, password_hash, full_name, role_id, service_number, is_active)
SELECT r.service_number, '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', CONCAT_WS(' ', r.first_name, r.surname),
       (SELECT id FROM roles WHERE name = 'Training Viewer'), r.service_number, 1
  FROM ratings r WHERE r.service_number = 'B0902';

-- ---- the batches: one open and one closed for each of two courses, none of them for the same month ----------
-- Batch numbers are DOT-year-month-course id, as the application makes them.

INSERT INTO training_batches (batch_number, course_id, year, month, status, institution_id, start_date, end_date, opened_by, opened_at, closed_by, closed_at)
SELECT CONCAT('DOT-', v.yr, '-', LPAD(v.mo, 2, '0'), '-', LPAD(t.id, 2, '0')), t.id, v.yr, v.mo, v.st,
       IF(v.st = 'closed', t.institution_id, NULL), v.sd, v.ed,
       (SELECT id FROM users WHERE username = 'HICO001'), v.opened,
       IF(v.st = 'closed', (SELECT id FROM users WHERE username = 'HICO001'), NULL), v.closed
  FROM (
    SELECT 'Leading Rate Course' AS course, 2026 AS yr, 11 AS mo, 'open' AS st, NULL AS sd, NULL AS ed, '2026-11-02 09:00:00' AS opened, NULL AS closed
    UNION ALL SELECT 'Damage Control and Firefighting', 2026, 12, 'open', NULL, NULL, '2026-11-09 10:30:00', NULL
    UNION ALL SELECT 'Basic Seamanship', 2026, 6, 'closed', '2026-01-12', '2026-06-26', '2026-01-05 09:00:00', '2026-06-29 10:00:00'
    UNION ALL SELECT 'ICT Fundamentals', 2026, 3, 'closed', '2026-02-02', '2026-03-13', '2026-01-26 09:00:00', '2026-03-16 11:00:00'
  ) v
  JOIN ref_training t ON t.name = v.course
 WHERE NOT EXISTS (SELECT 1 FROM training_batches b WHERE b.course_id = t.id AND b.year = v.yr AND b.month = v.mo);

-- the ratings of each batch: current ratings by official number, a different group for each batch
INSERT INTO training_batch_ratings (batch_id, service_number, rate_id, attended, start_date, end_date, result, added_by)
SELECT b.id, r.service_number, r.rate_id,
       IF(b.status = 'closed' AND r.n = 3, 0, 1),
       IF(b.status = 'closed' AND r.n = 2, '2026-01-19', NULL),
       IF(b.status = 'closed' AND r.n = 2, '2026-06-26', NULL),
       IF(b.status = 'closed' AND r.n <> 3, ELT(1 + MOD(r.n, 4), 'Distinction', 'Credit', 'Pass', 'Fail'), NULL),
       (SELECT id FROM users WHERE username = 'HICO001')
  FROM training_batches b
  JOIN ref_training t ON t.id = b.course_id
  JOIN (SELECT service_number, rate_id, ROW_NUMBER() OVER (ORDER BY service_number ASC) AS n FROM ratings WHERE status = 'current') r
    ON (t.name = 'Leading Rate Course' AND r.n <= 6)
    OR (t.name = 'Damage Control and Firefighting' AND r.n > 6 AND r.n <= 10)
    OR (t.name = 'Basic Seamanship' AND r.n <= 5)
    OR (t.name = 'ICT Fundamentals' AND r.n > 5 AND r.n <= 8)
 WHERE NOT EXISTS (SELECT 1 FROM training_batch_ratings m WHERE m.batch_id = b.id);

-- the ratings of a closed batch who attended have its Training entry on their record
INSERT INTO rating_training (service_number, institution, institution_id, training_course_id, qualification, classification, start_date, end_date)
SELECT m.service_number, i.name, i.id, t.id, t.name, m.result, COALESCE(m.start_date, b.start_date), COALESCE(m.end_date, b.end_date)
  FROM training_batch_ratings m
  JOIN training_batches b ON b.id = m.batch_id
  JOIN ref_training t ON t.id = b.course_id
  JOIN ref_institution i ON i.id = b.institution_id
 WHERE b.status = 'closed' AND m.attended = 1 AND m.training_id IS NULL;

UPDATE training_batch_ratings m
  JOIN training_batches b ON b.id = m.batch_id
  JOIN rating_training p ON p.service_number = m.service_number AND p.training_course_id = b.course_id
   AND p.start_date <=> COALESCE(m.start_date, b.start_date) AND p.end_date <=> COALESCE(m.end_date, b.end_date)
   SET m.training_id = p.id
 WHERE b.status = 'closed' AND m.attended = 1 AND m.training_id IS NULL;
