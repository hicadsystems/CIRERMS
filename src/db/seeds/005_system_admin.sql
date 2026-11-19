-- System Administration demo data (WP3): the roles the demo shows besides Administrator, Rating
-- and Static Tables, the grants each had in the old system (docs/legacy/system-admin.md 3.4),
-- and demo accounts so Manage Users, Manage Roles and the Audit Trail have data.
-- Safe to rerun. Passwords (all demo only) are in README section 3.

INSERT IGNORE INTO roles (name, description, full_access) VALUES
  ('Records Officer', 'Keeps the ratings records: new ratings, batch upload, documents and the record''s edits', 0),
  ('Records Clerk', 'Looks up and updates ratings'' records and documents; cannot add or upload', 0),
  ('Auditor', 'Reads the records and the audit trail; changes nothing', 0);

-- Old UpdateDetails, NewRatings, BatchCreation, Former/CurrentRatingsList, ViewDocument ->
-- Records Officer. Grants for the other modules' screens are added by their packages' seeds.
INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id
  FROM roles r
  JOIN privileges p ON (p.screen, p.action) IN (
       ('dashboard.home', 'view'),
       ('ratings.list', 'view'), ('ratings.new', 'add'),
       ('ratings.edit', 'view'), ('ratings.edit', 'add'), ('ratings.edit', 'edit'),
       ('ratings.upload', 'view'), ('ratings.upload', 'add'),
       ('ratings.documents', 'view'), ('ratings.documents', 'add'),
       ('ratings.my-details', 'view'))
 WHERE r.name = 'Records Officer';

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id
  FROM roles r
  JOIN privileges p ON (p.screen, p.action) IN (
       ('dashboard.home', 'view'),
       ('ratings.list', 'view'),
       ('ratings.edit', 'view'), ('ratings.edit', 'edit'),
       ('ratings.documents', 'view'),
       ('ratings.my-details', 'view'))
 WHERE r.name = 'Records Clerk';

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id
  FROM roles r
  JOIN privileges p ON (p.screen, p.action) IN (
       ('dashboard.home', 'view'),
       ('ratings.list', 'view'), ('ratings.edit', 'view'), ('ratings.documents', 'view'),
       ('ratings.my-details', 'view'),
       ('admin.audit', 'view'))
 WHERE r.name = 'Auditor';

-- Ratings for the accounts that are not already one (every account belongs to a rating)
INSERT IGNORE INTO ratings (service_number, status, rate_id, title_id, surname, first_name, gender_id, date_of_birth,
  branch_id, command_id, seniority_date, entry_mode_id, date_employed, specialisation_id)
VALUES ('HICO002', 'current', (SELECT id FROM ref_rate WHERE name = 'Warrant Officer (WO)'), (SELECT id FROM ref_title WHERE name = 'WO'),
  'ADEYEMI', 'FUNKE', (SELECT id FROM ref_gender WHERE name = 'Female'), '1982-06-21',
  (SELECT id FROM ref_branch WHERE name = 'Seaman'), (SELECT id FROM ref_command WHERE name = 'Western Naval Command'),
  '2019-07-01', (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'), '2001-05-10',
  (SELECT id FROM ref_specialisation WHERE name = 'Writer (Admin)'));
INSERT IGNORE INTO ratings (service_number, status, rate_id, title_id, surname, first_name, gender_id, date_of_birth,
  branch_id, command_id, seniority_date, entry_mode_id, date_employed, specialisation_id)
VALUES ('HICO003', 'current', (SELECT id FROM ref_rate WHERE name = 'Petty Officer (PO)'), (SELECT id FROM ref_title WHERE name = 'PO'),
  'EZE', 'NGOZI', (SELECT id FROM ref_gender WHERE name = 'Female'), '1988-09-03',
  (SELECT id FROM ref_branch WHERE name = 'Seaman'), (SELECT id FROM ref_command WHERE name = 'Western Naval Command'),
  '2021-01-01', (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'), '2008-02-18',
  (SELECT id FROM ref_specialisation WHERE name = 'Navigation'));
INSERT IGNORE INTO ratings (service_number, status, rate_id, title_id, surname, first_name, gender_id, date_of_birth,
  branch_id, command_id, seniority_date, entry_mode_id, date_employed, specialisation_id)
VALUES ('HICO004', 'current', (SELECT id FROM ref_rate WHERE name = 'Master Warrant Officer (MWO)'), (SELECT id FROM ref_title WHERE name = 'WO'),
  'LAWAL', 'SADIQ', (SELECT id FROM ref_gender WHERE name = 'Male'), '1979-11-30',
  (SELECT id FROM ref_branch WHERE name = 'Seaman'), (SELECT id FROM ref_command WHERE name = 'Western Naval Command'),
  '2018-12-01', (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'), '1999-09-20',
  (SELECT id FROM ref_specialisation WHERE name = 'Stores & Supply'));
INSERT IGNORE INTO ratings (service_number, status, rate_id, title_id, surname, first_name, gender_id, date_of_birth,
  branch_id, command_id, seniority_date, entry_mode_id, date_employed, specialisation_id)
VALUES ('HICO005', 'current', (SELECT id FROM ref_rate WHERE name = 'Chief Petty Officer (CPO)'), (SELECT id FROM ref_title WHERE name = 'CPO'),
  'OKAFOR', 'BLESSING', (SELECT id FROM ref_gender WHERE name = 'Female'), '1985-04-12',
  (SELECT id FROM ref_branch WHERE name = 'Seaman'), (SELECT id FROM ref_command WHERE name = 'Western Naval Command'),
  '2020-06-01', (SELECT id FROM ref_entry_mode WHERE name = 'Regular Recruitment'), '2005-08-08',
  (SELECT id FROM ref_specialisation WHERE name = 'Writer (Admin)'));

-- Demo accounts. HICO003 is tied to a Specialisation; B0562 is inactive.
INSERT IGNORE INTO users (username, password_hash, full_name, role_id, service_number, email, phone, specialisation_id, is_active)
VALUES
  ('HICO002', '$2a$10$ltXfL6j18xc24Vf3hY92vOX3uH9j04AYusGcHQE26gBly49pMGy8W', 'Lt Cdr Funke Adeyemi',
   (SELECT id FROM roles WHERE name = 'Records Officer'), 'HICO002', 'f.adeyemi@navy.mil.ng', '08031112201', NULL, 1),
  ('HICO003', '$2a$10$ltXfL6j18xc24Vf3hY92vOX3uH9j04AYusGcHQE26gBly49pMGy8W', 'Lt Ngozi Eze',
   (SELECT id FROM roles WHERE name = 'Records Officer'), 'HICO003', 'n.eze@navy.mil.ng', '08031112202',
   (SELECT id FROM ref_specialisation WHERE name = 'Navigation'), 1),
  ('B0541', '$2a$10$xBQU2I5Lce2cNlm8sZb/kuJqyjedfCkn8RN/JTx6PqVM8TiwM6yly', 'CPO Abdullahi Musa',
   (SELECT id FROM roles WHERE name = 'Records Clerk'), 'B0541', 'a.musa@navy.mil.ng', '08031112203', NULL, 1),
  ('HICO004', '$2a$10$wEZJtHR1yVj9BCDPAIuPyu/hYaHgxNsfICUPWsErU2EJ3uYKcRK5S', 'Cdr Sadiq Lawal',
   (SELECT id FROM roles WHERE name = 'Auditor'), 'HICO004', 's.lawal@navy.mil.ng', '08031112204', NULL, 1),
  ('HICO005', '$2a$10$DPPMmQmyTyn8azeuzI6kHuu5Dy2avwX7wH9/RSbluEVPAnHwuFRbm', 'Mrs Blessing Okafor',
   (SELECT id FROM roles WHERE name = 'Static Tables'), 'HICO005', 'b.okafor@navy.mil.ng', '08031112205', NULL, 1),
  ('B0562', '$2a$10$eeqKtMe1fg7uvpMA2h.eE.Lf3g0AdVe7s/PJ2HpZdzVBjg9SDEgdC', 'PO Tamunoemi Briggs',
   (SELECT id FROM roles WHERE name = 'Rating'), 'B0562', NULL, NULL, NULL, 0);
