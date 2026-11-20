-- Discharge Administration (WP5): placeholder due-rule settings, the old role, grants,
-- demo proposals and every discharge page's demo data.

INSERT IGNORE INTO settings (setting_key, value, description) VALUES
  ('discharge.age_due', '50', 'Discharge: a rating is due at this age (placeholder rule).'),
  ('discharge.service_due', '20', 'Discharge: a rating is due after this many whole years of service (placeholder rule).'),
  ('discharge.age_band_1', '50', 'Discharge due-list age pill: first threshold.'),
  ('discharge.age_band_2', '55', 'Discharge due-list age pill: second threshold.'),
  ('discharge.age_band_3', '60', 'Discharge due-list age pill: final threshold.'),
  ('discharge.service_band_1', '20', 'Discharge due-list service pill: first threshold.'),
  ('discharge.service_band_2', '30', 'Discharge due-list service pill: second threshold.'),
  ('discharge.service_band_3', '35', 'Discharge due-list service pill: final threshold.');

INSERT IGNORE INTO ref_exit_type (name, code, keeps_current, is_death, sort_order)
VALUES ('RE-ENGAGEMENT', 'RE', 1, 0, 110);

-- Demo rating for the Discharge account, and due ratings from existing seed ranges.
INSERT IGNORE INTO ratings (service_number, status, rate_id, surname, first_name, middle_name, gender_id, date_of_birth,
  branch_id, date_employed, specialisation_id)
SELECT 'B0801', 'current', (SELECT id FROM ref_rate WHERE code='PO'), 'ADENIJI', 'Samuel', 'Olalekan',
       (SELECT id FROM ref_gender WHERE name='Male'), '1974-08-12',
       (SELECT id FROM ref_branch WHERE code='SM'), '1994-04-03',
       (SELECT id FROM ref_specialisation WHERE code='NAV');

INSERT IGNORE INTO roles (name, description, full_access) VALUES
  ('Discharge', 'Processes discharge proposals, printouts, reports and discharge uploads', 0);

INSERT IGNORE INTO role_privileges (role_id, privilege_id)
SELECT r.id, p.id FROM roles r JOIN privileges p ON (p.screen, p.action) IN (
  ('dashboard.home','view'), ('ratings.list','view'), ('ratings.edit','view'), ('ratings.my-details','view'),
  ('discharge.process','view'), ('discharge.process','add'), ('discharge.process','edit'), ('discharge.process','delete'),
  ('discharge.service','view'), ('discharge.forms','view'), ('discharge.report','view'),
  ('discharge.upload','view'), ('discharge.upload','add'))
WHERE r.name = 'Discharge';

-- Account is deliberately tied to a real rating.
INSERT IGNORE INTO users (username, password_hash, role_id, service_number, email, phone, is_active)
VALUES ('B0801', '$2a$10$DPILpLh/fazxj74u1LMyd.vUIgQbxiAqrYUXzz8C9DZpghbJhT42',
  (SELECT id FROM roles WHERE name='Discharge'), 'B0801', 'discharge@navy.mil.ng', '08038000801', 1);
