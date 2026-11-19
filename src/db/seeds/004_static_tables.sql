-- Static Tables (WP2): demo rows for the tables that are new, the ships' Type, the role the old
-- system had for the Static Tables block, and its privileges. The lists the other tables show
-- (branches, states, local governments, ships ...) are already in 001_lookups.sql, as the demo
-- shows them. Insert-only-missing and safe to rerun: a row an administrator has since edited is
-- left as it is (updated_at moved on), so a re-seed never undoes their work.

-- ----------------------------------------------------------------------------
-- Ships and bases: the demo's Type column
-- ----------------------------------------------------------------------------
UPDATE ref_ship SET type = 'Base'
 WHERE updated_at = created_at
   AND name IN ('NNS BEECROFT', 'NNS PATHFINDER', 'NNS DELTA', 'NNS JUBILEE', 'NNS QUORRA', 'NAVTRAC EBUTE-ERO', 'NHQ ABUJA');

-- Entry Mode: the demo shows one switched off (out of the dropdowns)
UPDATE ref_entry_mode SET is_active = 0
 WHERE name = 'Sportsmen Enlistment' AND updated_at = created_at;

-- Relationship: the demo's list, beside the two types the demo ratings use
INSERT IGNORE INTO ref_next_of_kin_type (name, sort_order) VALUES
  ('Spouse', 3), ('Father', 4), ('Mother', 5), ('Son', 6), ('Daughter', 7), ('Brother', 8),
  ('Sister', 9), ('Uncle', 10), ('Aunt', 11), ('Cousin', 12), ('Guardian', 13);

-- ----------------------------------------------------------------------------
-- Appraisal Ratings
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO ref_appraisal_rating (name, code, score_range, sort_order) VALUES
  ('Outstanding', 'A', '90 - 100', 1),
  ('Very Good', 'B', '75 - 89', 2),
  ('Good', 'C', '60 - 74', 3),
  ('Fair', 'D', '45 - 59', 4),
  ('Poor', 'E', '0 - 44', 5);

-- ----------------------------------------------------------------------------
-- Disciplinary Offences and Sanctions
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO ref_disciplinary_offence (name, code, category, sort_order) VALUES
  ('Absence without leave', 'OF01', 'Discipline', 1),
  ('Insubordination', 'OF02', 'Conduct', 2),
  ('Drunkenness on duty', 'OF03', 'Conduct', 3),
  ('Negligent performance of duty', 'OF04', 'Duty', 4),
  ('Disobedience to standing orders', 'OF05', 'Discipline', 5),
  ('Loss of service property', 'OF06', 'Property', 6),
  ('Sleeping on watch', 'OF07', 'Duty', 7),
  ('Conduct prejudicial to good order', 'OF08', 'Conduct', 8);

INSERT IGNORE INTO ref_disciplinary_sanction (name, severity, sort_order) VALUES
  ('Reprimand', 'Minor', 1),
  ('Severe reprimand', 'Minor', 2),
  ('Extra duties', 'Minor', 3),
  ('Stoppage of leave', 'Minor', 4),
  ('Fine', 'Major', 5),
  ('Detention', 'Major', 6),
  ('Reduction in rate', 'Major', 7),
  ('Dismissal', 'Major', 8);

-- ----------------------------------------------------------------------------
-- Institutions
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO ref_institution (name, location, type, sort_order) VALUES
  ('NAVTRAC Ebute-Ero', 'Lagos', 'Training Centre', 1),
  ('NNS Quorra', 'Lagos', 'Training Base', 2),
  ('Naval Engineering College', 'Sapele', 'College', 3),
  ('Nigerian Defence Academy', 'Kaduna', 'University', 4),
  ('Federal Polytechnic, Oko', 'Anambra', 'Polytechnic', 5),
  ('University of Lagos', 'Lagos', 'University', 6);

-- ----------------------------------------------------------------------------
-- Training courses: who may attend (branch and specialisation empty = any, no rates = every rate)
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO ref_training (name, institution_id, weeks, branch_id, specialisation_id, sort_order)
SELECT 'Basic Seamanship', (SELECT id FROM ref_institution WHERE name = 'NAVTRAC Ebute-Ero'), 26, NULL, NULL, 1
UNION ALL SELECT 'Leading Rate Course', (SELECT id FROM ref_institution WHERE name = 'NNS Quorra'), 12, NULL, NULL, 2
UNION ALL SELECT 'Petty Officer Course', (SELECT id FROM ref_institution WHERE name = 'NNS Quorra'), 16, NULL, NULL, 3
UNION ALL SELECT 'Marine Engineering Artificer', (SELECT id FROM ref_institution WHERE name = 'Naval Engineering College'), 52,
  (SELECT id FROM ref_branch WHERE name = 'Marine Engineering'), NULL, 4
UNION ALL SELECT 'Gunnery Course', (SELECT id FROM ref_institution WHERE name = 'NNS Quorra'), 10,
  NULL, (SELECT id FROM ref_specialisation WHERE name = 'Gunnery'), 5
UNION ALL SELECT 'Damage Control and Firefighting', (SELECT id FROM ref_institution WHERE name = 'NNS Quorra'), 4, NULL, NULL, 6
UNION ALL SELECT 'Navigation Basic', (SELECT id FROM ref_institution WHERE name = 'NNS Quorra'), 8,
  NULL, (SELECT id FROM ref_specialisation WHERE name = 'Navigation'), 7
UNION ALL SELECT 'ICT Fundamentals', (SELECT id FROM ref_institution WHERE name = 'NAVTRAC Ebute-Ero'), 6, NULL, NULL, 8;

-- Rates: Basic Seamanship is for OS, Leading Rate for AB, Petty Officer for LS, Gunnery for AB to PO;
-- the others are open to every rate (no rows)
INSERT IGNORE INTO ref_training_rate (training_id, rate_id)
SELECT t.id, r.id FROM ref_training t JOIN ref_rate r ON r.name = 'Ordinary Seaman (OS)' WHERE t.name = 'Basic Seamanship'
UNION ALL SELECT t.id, r.id FROM ref_training t JOIN ref_rate r ON r.name = 'Able Seaman (AB)' WHERE t.name = 'Leading Rate Course'
UNION ALL SELECT t.id, r.id FROM ref_training t JOIN ref_rate r ON r.name = 'Leading Seaman (LS)' WHERE t.name = 'Petty Officer Course'
UNION ALL SELECT t.id, r.id FROM ref_training t JOIN ref_rate r ON r.name IN ('Able Seaman (AB)', 'Leading Seaman (LS)', 'Petty Officer (PO)') WHERE t.name = 'Gunnery Course';

-- ----------------------------------------------------------------------------
-- The old system's StaticTables role: the whole Static Tables block (system-admin.md 3.4).
-- It gets view, add, edit and delete on each of the 16 tables; the Administrator gets them from
-- the privilege sync.
-- ----------------------------------------------------------------------------
INSERT IGNORE INTO roles (name, description, full_access)
VALUES ('Static Tables', 'Maintains the Static Tables (all 16)', 0);

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id
  FROM roles r
  JOIN privileges p ON p.screen LIKE 'tables.%'
 WHERE r.name = 'Static Tables';
