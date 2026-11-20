-- Training Drafting (WP6): demo batches for every page (two open, two closed with their history confirmed),
-- the old role "Training" with every privilege of the module, and a role that may only view the batches
-- and the reports (for the walkthrough). Safe to rerun.
-- Demo accounts (password Admin@123, as HICO001), each belonging to a rating: user names are the official numbers:
-- B0562 (Training), B0541 (Training Viewer).

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

INSERT IGNORE INTO users (username, password_hash, full_name, role_id, service_number, is_active)
SELECT r.service_number, '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', CONCAT_WS(' ', r.first_name, r.surname),
       (SELECT id FROM roles WHERE name = 'Training'), r.service_number, 1
  FROM ratings r WHERE r.service_number = 'B0562';

INSERT IGNORE INTO users (username, password_hash, full_name, role_id, service_number, is_active)
SELECT r.service_number, '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpgh2bJhT42', CONCAT_WS(' ', r.first_name, r.surname),
       (SELECT id FROM roles WHERE name = 'Training Viewer'), r.service_number, 1
  FROM ratings r WHERE r.service_number = 'B0541';

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
