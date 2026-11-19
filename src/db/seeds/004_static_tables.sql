-- Static Tables (WP2): the codes, flags and links the 16 tables carry, demo rows for the tables that
-- are new, the old system's StaticTables role and its privileges. The names of the other tables'
-- rows (branches, states, local governments, ships ...) are already in 001_lookups.sql, as the demo
-- shows them. Insert-only-missing and safe to rerun: a value an administrator has since set or edited
-- is left as it is (codes only where still empty; other columns while updated_at = created_at).

-- Branch codes (the drafting and advancement batch numbers use them: DOD-SM-...)
UPDATE ref_branch t JOIN (SELECT 'Seaman' AS c0, 'SM' AS c1 UNION ALL SELECT 'Marine Engineering', 'ME' UNION ALL SELECT 'Weapon Engineering', 'WE' UNION ALL SELECT 'Logistics', 'LG' UNION ALL SELECT 'Medical', 'MD' UNION ALL SELECT 'Information Technology', 'IT' UNION ALL SELECT 'Education', 'ED' UNION ALL SELECT 'Naval Police', 'NP' UNION ALL SELECT 'Music', 'MU' UNION ALL SELECT 'Physical Training', 'PT') m ON m.c0 = t.name COLLATE utf8mb4_unicode_ci
   SET t.code = m.c1
 WHERE t.code IS NULL;

-- Exit Types: codes, and the flag that keeps a rating Current. The old codes A, M and C kept a
-- rating current; their meaning beyond that is not in the repository, so they are named by their code.
INSERT IGNORE INTO ref_exit_type (name, code, keeps_current, sort_order) VALUES
  ('Serving (A)', 'A', 1, 100), ('Serving (M)', 'M', 1, 101), ('Serving (C)', 'C', 1, 102);
UPDATE ref_exit_type t JOIN (SELECT 'DECEASED' AS c0, 'DE' AS c1 UNION ALL SELECT 'DISCHARGED', 'DS' UNION ALL SELECT 'DISMISSED', 'DM' UNION ALL SELECT 'MEDICAL DISCHARGE', 'MD' UNION ALL SELECT 'RETIRED', 'RT' UNION ALL SELECT 'VOLUNTARY DISCHARGE', 'VD') m ON m.c0 = t.name COLLATE utf8mb4_unicode_ci
   SET t.code = m.c1
 WHERE t.code IS NULL;

-- Entry Mode codes; the demo shows one switched off (out of the dropdowns)
UPDATE ref_entry_mode t JOIN (SELECT 'Regular Recruitment' AS c0, 'RECR' AS c1 UNION ALL SELECT 'Specialist Enlistment', 'SPEC' UNION ALL SELECT 'Direct Intake', 'DIR' UNION ALL SELECT 'Sportsmen Enlistment', 'SPORT') m ON m.c0 = t.name COLLATE utf8mb4_unicode_ci
   SET t.code = m.c1
 WHERE t.code IS NULL;

UPDATE ref_entry_mode SET is_active = 0
 WHERE name = 'Sportsmen Enlistment' AND updated_at = created_at;

-- Relationship: the demo's list beside the two types the demo ratings use, with codes
INSERT IGNORE INTO ref_next_of_kin_type (name, sort_order) VALUES
  ('Spouse', 3), ('Father', 4), ('Mother', 5), ('Son', 6), ('Daughter', 7), ('Brother', 8),
  ('Sister', 9), ('Uncle', 10), ('Aunt', 11), ('Cousin', 12), ('Guardian', 13);
UPDATE ref_next_of_kin_type t JOIN (SELECT 'Primary' AS c0, 'PRIM' AS c1 UNION ALL SELECT 'Secondary', 'SEC' UNION ALL SELECT 'Spouse', 'SPS' UNION ALL SELECT 'Father', 'FTH' UNION ALL SELECT 'Mother', 'MTH' UNION ALL SELECT 'Son', 'SON' UNION ALL SELECT 'Daughter', 'DTR' UNION ALL SELECT 'Brother', 'BRO' UNION ALL SELECT 'Sister', 'SIS' UNION ALL SELECT 'Uncle', 'UNC' UNION ALL SELECT 'Aunt', 'AUN' UNION ALL SELECT 'Cousin', 'CSN' UNION ALL SELECT 'Guardian', 'GRD') m ON m.c0 = t.name COLLATE utf8mb4_unicode_ci
   SET t.code = m.c1
 WHERE t.code IS NULL;

-- Staff Branch: code and command (the rating form's Staff Branch list follows the chosen Command)
UPDATE ref_staff_branch t JOIN (SELECT 'Personnel (Navpers)' AS c0, 'NAVPERS' AS c1, 'Naval Headquarters' AS c2 UNION ALL SELECT 'Operations', 'OPS', 'Naval Headquarters' UNION ALL SELECT 'Administration', 'ADMIN', 'Naval Headquarters' UNION ALL SELECT 'Logistics', 'LOG', 'Logistics Command' UNION ALL SELECT 'Training', 'TRG', 'Naval Training Command' UNION ALL SELECT 'Accounts & Budget', 'ACCTS', 'Naval Headquarters' UNION ALL SELECT 'Fleet Maintenance', 'FLTMT', 'Western Naval Command') m ON m.c0 = t.name COLLATE utf8mb4_unicode_ci
   SET t.code = m.c1, t.command_id = (SELECT id FROM ref_command WHERE name = m.c2)
 WHERE t.code IS NULL;

-- Specialisation codes (they go in the batch numbers)
UPDATE ref_specialisation t JOIN (SELECT 'Gunnery' AS c0, 'GUN' AS c1 UNION ALL SELECT 'Navigation', 'NAV' UNION ALL SELECT 'Communications', 'COM' UNION ALL SELECT 'Radar Plotter', 'RDP' UNION ALL SELECT 'Marine Propulsion', 'MPR' UNION ALL SELECT 'Electrical / Weapon Systems', 'EWS' UNION ALL SELECT 'Hull Maintenance', 'HMT' UNION ALL SELECT 'Stores & Supply', 'STS' UNION ALL SELECT 'Catering', 'CAT' UNION ALL SELECT 'Writer (Admin)', 'WRT' UNION ALL SELECT 'Medical Assistant', 'MAS' UNION ALL SELECT 'Regulating (Provost)', 'REG' UNION ALL SELECT 'ICT / Cyber', 'ICT' UNION ALL SELECT 'Hydrography', 'HYD' UNION ALL SELECT 'Clearance Diver', 'CLD') m ON m.c0 = t.name COLLATE utf8mb4_unicode_ci
   SET t.code = m.c1
 WHERE t.code IS NULL;

-- Ships and bases: Type (as the demo shows), command and description
UPDATE ref_ship t JOIN (SELECT 'NNS ARADU' AS c0, 'Ship' AS c1, 'Western Naval Command' AS c2 UNION ALL SELECT 'NNS THUNDER', 'Ship', 'Western Naval Command' UNION ALL SELECT 'NNS OKPABANA', 'Ship', 'Eastern Naval Command' UNION ALL SELECT 'NNS CENTENARY', 'Ship', 'Eastern Naval Command' UNION ALL SELECT 'NNS UNITY', 'Ship', 'Western Naval Command' UNION ALL SELECT 'NNS PROSPERITY', 'Ship', 'Central Naval Command' UNION ALL SELECT 'NNS KADA', 'Ship', 'Eastern Naval Command' UNION ALL SELECT 'NNS VICTORY', 'Ship', 'Western Naval Command' UNION ALL SELECT 'NNS BEECROFT', 'Base', 'Western Naval Command' UNION ALL SELECT 'NNS PATHFINDER', 'Base', 'Western Naval Command' UNION ALL SELECT 'NNS DELTA', 'Base', 'Eastern Naval Command' UNION ALL SELECT 'NNS JUBILEE', 'Base', 'Eastern Naval Command' UNION ALL SELECT 'NNS QUORRA', 'Base', 'Naval Training Command' UNION ALL SELECT 'NAVTRAC EBUTE-ERO', 'Base', 'Naval Training Command' UNION ALL SELECT 'NHQ ABUJA', 'Base', 'Naval Headquarters') m ON m.c0 = t.name COLLATE utf8mb4_unicode_ci
   SET t.type = m.c1, t.command_id = (SELECT id FROM ref_command WHERE name = m.c2)
 WHERE t.updated_at = t.created_at;

-- States: code and geo-political zone (the rating form fills the zone from the state)
UPDATE ref_state t JOIN (SELECT 'Abia' AS c0, 'AB' AS c1, 'South East' AS c2 UNION ALL SELECT 'Anambra', 'AN', 'South East' UNION ALL SELECT 'Ebonyi', 'EB', 'South East' UNION ALL SELECT 'Enugu', 'EN', 'South East' UNION ALL SELECT 'Imo', 'IM', 'South East' UNION ALL SELECT 'Adamawa', 'AD', 'North East' UNION ALL SELECT 'Bauchi', 'BA', 'North East' UNION ALL SELECT 'Borno', 'BO', 'North East' UNION ALL SELECT 'Gombe', 'GO', 'North East' UNION ALL SELECT 'Taraba', 'TA', 'North East' UNION ALL SELECT 'Yobe', 'YO', 'North East' UNION ALL SELECT 'Akwa Ibom', 'AK', 'South South' UNION ALL SELECT 'Bayelsa', 'BY', 'South South' UNION ALL SELECT 'Cross River', 'CR', 'South South' UNION ALL SELECT 'Delta', 'DE', 'South South' UNION ALL SELECT 'Edo', 'ED', 'South South' UNION ALL SELECT 'Rivers', 'RI', 'South South' UNION ALL SELECT 'Benue', 'BE', 'North Central' UNION ALL SELECT 'FCT - Abuja', 'FC', 'North Central' UNION ALL SELECT 'Kogi', 'KO', 'North Central' UNION ALL SELECT 'Kwara', 'KW', 'North Central' UNION ALL SELECT 'Nasarawa', 'NA', 'North Central' UNION ALL SELECT 'Niger', 'NI', 'North Central' UNION ALL SELECT 'Plateau', 'PL', 'North Central' UNION ALL SELECT 'Ekiti', 'EK', 'South West' UNION ALL SELECT 'Lagos', 'LA', 'South West' UNION ALL SELECT 'Ogun', 'OG', 'South West' UNION ALL SELECT 'Ondo', 'ON', 'South West' UNION ALL SELECT 'Osun', 'OS', 'South West' UNION ALL SELECT 'Oyo', 'OY', 'South West' UNION ALL SELECT 'Jigawa', 'JI', 'North West' UNION ALL SELECT 'Kaduna', 'KD', 'North West' UNION ALL SELECT 'Kano', 'KN', 'North West' UNION ALL SELECT 'Katsina', 'KT', 'North West' UNION ALL SELECT 'Kebbi', 'KE', 'North West' UNION ALL SELECT 'Sokoto', 'SO', 'North West' UNION ALL SELECT 'Zamfara', 'ZA', 'North West') m ON m.c0 = t.name COLLATE utf8mb4_unicode_ci
   SET t.code = m.c1, t.geo_political_zone_id = (SELECT id FROM ref_geo_political_zone WHERE name = m.c2)
 WHERE t.code IS NULL;

-- Title descriptions
UPDATE ref_title t JOIN (SELECT 'OS' AS c0, 'Ordinary Seaman' AS c1 UNION ALL SELECT 'AB', 'Able Seaman' UNION ALL SELECT 'LS', 'Leading Seaman' UNION ALL SELECT 'PO', 'Petty Officer' UNION ALL SELECT 'CPO', 'Chief Petty Officer' UNION ALL SELECT 'WO', 'Warrant Officer' UNION ALL SELECT 'MWO', 'Master Warrant Officer' UNION ALL SELECT 'NWO', 'Navy Warrant Officer' UNION ALL SELECT 'Mr', 'Mister' UNION ALL SELECT 'Mrs', 'Missus' UNION ALL SELECT 'Miss', 'Miss') m ON m.c0 = t.name COLLATE utf8mb4_unicode_ci
   SET t.description = m.c1
 WHERE t.description IS NULL;

-- Rates (no screen): the code, and sort_order is the rank order, lowest rate first (it decides the next rate
-- in Advancement and the rate groups in approval totals)
UPDATE ref_rate t JOIN (SELECT 'Ordinary Seaman (OS)' AS c0, 'OS' AS c1, 1 AS c2 UNION ALL SELECT 'Able Seaman (AB)', 'AB', 2 UNION ALL SELECT 'Leading Seaman (LS)', 'LS', 3 UNION ALL SELECT 'Petty Officer (PO)', 'PO', 4 UNION ALL SELECT 'Chief Petty Officer (CPO)', 'CPO', 5 UNION ALL SELECT 'Warrant Officer (WO)', 'WO', 6 UNION ALL SELECT 'Master Warrant Officer (MWO)', 'MWO', 7 UNION ALL SELECT 'Navy Warrant Officer (NWO)', 'NWO', 8) m ON m.c0 = t.name COLLATE utf8mb4_unicode_ci
   SET t.code = COALESCE(t.code, m.c1), t.sort_order = m.c2
 WHERE 1 = 1;

-- Appraisal Ratings
INSERT IGNORE INTO ref_appraisal_rating (code, name, score_low, score_high, sort_order) VALUES
  ('A', 'Outstanding', 90, 100, 1),
  ('B', 'Very Good', 75, 89, 2),
  ('C', 'Good', 60, 74, 3),
  ('D', 'Fair', 45, 59, 4),
  ('E', 'Poor', 0, 44, 5);

-- Disciplinary Offences and Sanctions
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

-- Institutions
INSERT IGNORE INTO ref_institution (code, name, location, type, sort_order) VALUES
  ('NAVTRAC', 'NAVTRAC Ebute-Ero', 'Lagos', 'Training Centre', 1),
  ('NNSQ', 'NNS Quorra', 'Lagos', 'Training Base', 2),
  ('NEC', 'Naval Engineering College', 'Sapele', 'College', 3),
  ('NDA', 'Nigerian Defence Academy', 'Kaduna', 'University', 4),
  ('FEDPOLYOKO', 'Federal Polytechnic, Oko', 'Anambra', 'Polytechnic', 5),
  ('UNILAG', 'University of Lagos', 'Lagos', 'University', 6);

-- Training courses: who may attend (branch and specialisation empty = any, no rates = every rate)
INSERT IGNORE INTO ref_training (code, name, qualification, institution_id, weeks, branch_id, specialisation_id, sort_order)
SELECT 'BSM', 'Basic Seamanship', 'Certificate in Seamanship', (SELECT id FROM ref_institution WHERE name = 'NAVTRAC Ebute-Ero'), 26, NULL, NULL, 1
UNION ALL SELECT 'LRC', 'Leading Rate Course', 'Leading Rate Certificate', (SELECT id FROM ref_institution WHERE name = 'NNS Quorra'), 12, NULL, NULL, 2
UNION ALL SELECT 'POC', 'Petty Officer Course', 'Petty Officer Certificate', (SELECT id FROM ref_institution WHERE name = 'NNS Quorra'), 16, NULL, NULL, 3
UNION ALL SELECT 'MEA', 'Marine Engineering Artificer', 'Artificer Diploma', (SELECT id FROM ref_institution WHERE name = 'Naval Engineering College'), 52,
  (SELECT id FROM ref_branch WHERE name = 'Marine Engineering'), NULL, 4
UNION ALL SELECT 'GUN', 'Gunnery Course', 'Gunnery Certificate', (SELECT id FROM ref_institution WHERE name = 'NNS Quorra'), 10,
  NULL, (SELECT id FROM ref_specialisation WHERE name = 'Gunnery'), 5
UNION ALL SELECT 'DCF', 'Damage Control and Firefighting', 'Damage Control Certificate', (SELECT id FROM ref_institution WHERE name = 'NNS Quorra'), 4, NULL, NULL, 6
UNION ALL SELECT 'NAVB', 'Navigation Basic', 'Basic Navigation Certificate', (SELECT id FROM ref_institution WHERE name = 'NNS Quorra'), 8,
  NULL, (SELECT id FROM ref_specialisation WHERE name = 'Navigation'), 7
UNION ALL SELECT 'ICTF', 'ICT Fundamentals', 'ICT Certificate', (SELECT id FROM ref_institution WHERE name = 'NAVTRAC Ebute-Ero'), 6, NULL, NULL, 8;

-- Rates: Basic Seamanship is for OS, Leading Rate for AB, Petty Officer for LS, Gunnery for AB to PO;
-- the others are open to every rate (no rows)
INSERT IGNORE INTO ref_training_rate (training_id, rate_id)
SELECT t.id, r.id FROM ref_training t JOIN ref_rate r ON r.code = 'OS' WHERE t.name = 'Basic Seamanship'
UNION ALL SELECT t.id, r.id FROM ref_training t JOIN ref_rate r ON r.code = 'AB' WHERE t.name = 'Leading Rate Course'
UNION ALL SELECT t.id, r.id FROM ref_training t JOIN ref_rate r ON r.code = 'LS' WHERE t.name = 'Petty Officer Course'
UNION ALL SELECT t.id, r.id FROM ref_training t JOIN ref_rate r ON r.code IN ('AB', 'LS', 'PO') WHERE t.name = 'Gunnery Course';

-- The old system's StaticTables role: the whole Static Tables block (system-admin.md 3.4). It gets
-- view, add, edit and delete on each of the 16 tables; the Administrator gets them from the privilege sync.
INSERT IGNORE INTO roles (name, description, full_access)
VALUES ('Static Tables', 'Maintains the Static Tables (all 16)', 0);

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id
  FROM roles r
  JOIN privileges p ON p.screen LIKE 'tables.%'
 WHERE r.name = 'Static Tables';
